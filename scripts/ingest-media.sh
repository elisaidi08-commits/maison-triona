#!/usr/bin/env bash
# Maison Triona : ingestion d'un média généré (vidéo ou image).
# Contrôle (ffprobe, garde-fou moodboard) → encodages → poster → rapport de poids et de conformité.
#
# PRÉPARÉ EN PHASE 0, JAMAIS EXÉCUTÉ SUR UN VRAI FICHIER. À déplacer dans scripts/ en story 1.1.
# Les commandes d'encodage reprennent celles testées dans docs/media-pipeline.md §5.
#
# Usage :
#   ingest-media.sh <fichier> <ID> <scene> <slug> [--scrub] [--loop-xfade] [--out <dossier>] [--dry-run]
# Exemples :
#   ingest-media.sh media-incoming/V01-prise2.mp4 V01 seuil fenetre-mer --scrub
#   ingest-media.sh media-incoming/P01-d-final.png P01-d seuil fenetre-mer
#
# ID    : V01..V08 (vidéo), P01-d / P01-m .. P10, P06b, P09-1..6 (image), A01..A03 (ancres, jamais publiées)
# scene : seuil | maison | conciergerie | grand-age | enfants | territoires | contact | details

set -euo pipefail

# --- Budgets (docs/media-pipeline.md §3)
MAX_VIDEO_KB=2560        # 2,5 Mo
MAX_SCRUB_KB=4096        # 4 Mo
MAX_POSTER_1280_KB=120
MAX_MOBILE_828_KB=80
MIN_SSIM_LOOP=0.99

die()  { echo "⛔ $*" >&2; exit 2; }
warn() { echo "⚠️  $*" >&2; WARNINGS=$((WARNINGS + 1)); }
WARNINGS=0

# --- Arguments
[ $# -ge 4 ] || die "Usage : ingest-media.sh <fichier> <ID> <scene> <slug> [--scrub] [--loop-xfade] [--out <dossier>] [--dry-run]"
SRC="$1"; ID="$2"; SCENE="$3"; SLUG="$4"; shift 4
SCRUB=0; XFADE=0; DRY=0; OUT_ROOT="public/media"
while [ $# -gt 0 ]; do
  case "$1" in
    --scrub) SCRUB=1 ;;
    --loop-xfade) XFADE=1 ;;
    --dry-run) DRY=1 ;;
    --out) shift; OUT_ROOT="${1:?--out exige un dossier}" ;;
    *) die "Option inconnue : $1" ;;
  esac
  shift
done

[ -f "$SRC" ] || die "Fichier introuvable : $SRC"
[[ "$ID" =~ ^(V0[1-8]|P(0[1-9]|10)(-[dm])?|P06b|P09-[1-6]|A0[1-3])$ ]] || die "ID non conforme : $ID"
[[ "$SCENE" =~ ^(seuil|maison|conciergerie|grand-age|enfants|territoires|contact|details)$ ]] || die "Scène inconnue : $SCENE"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || die "Slug non conforme (minuscules, chiffres, tirets) : $SLUG"
[[ "$ID" == A0* ]] && die "Les ancres A01-A03 ne sont jamais publiées : rien à ingérer dans $OUT_ROOT."

# --- Garde-fou moodboard (docs/assets-ia-brief.md §1) : rien qui en provienne ne doit entrer dans public/
case "$SRC" in
  *cosmos_*|*MOODBOARD*|*"ASSETS PHOTO MAQUETTE"*|*docs/moodboard*|*unsplash*)
    die "Source issue du moodboard ou d'une banque d'images : interdit en production." ;;
esac

command -v ffprobe >/dev/null || die "ffprobe absent"
command -v ffmpeg  >/dev/null || die "ffmpeg absent"
command -v magick  >/dev/null || die "ImageMagick (magick) absent"

OUT="$OUT_ROOT/$SCENE"
BASE="$OUT/$ID-$SLUG"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

run() { if [ "$DRY" = 1 ]; then printf '[dry-run] %q ' "$@"; echo; else "$@"; fi; }
kb()  { [ -f "$1" ] && echo $(( ($(stat -f%z "$1" 2>/dev/null || stat -c%s "$1") + 1023) / 1024 )) || echo 0; }
has_audio() { [ -n "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$1")" ]; }
check_size() { local f="$1" max="$2" s; s=$(kb "$f"); if [ "$s" -gt "$max" ]; then warn "$(basename "$f") : ${s} Ko > ${max} Ko"; else echo "✅ $(basename "$f") : ${s} Ko (≤ ${max} Ko)"; fi; }

echo "== Source =="
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate -show_entries format=duration,size -of compact "$SRC"
TYPE=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$SRC" || true)
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$SRC")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$SRC")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC" | cut -d. -f1)

run mkdir -p "$OUT"

if [[ "$ID" == V* ]]; then
  # ======================= VIDÉO =======================
  [[ "$TYPE" =~ ^(h264|hevc|vp9|av1|prores)$ ]] || warn "Codec source inhabituel : $TYPE"
  [ "$H" -ge 1080 ] || warn "Source en ${W}×${H} : sous le 1080p (upscale à prévoir, ou cadre ≤ 900 px de large)"
  has_audio "$SRC" && echo "ℹ️  Piste audio présente dans la source : elle sera supprimée (-an)."

  MASTER="$SRC"
  if [ "$XFADE" = 1 ]; then
    # Boucle de secours : fondu enchaîné fin → début de 0,5 s (docs/media-pipeline.md §5.4)
    D="${DUR:-8}"; X=0.5; O=$(echo "$D - $X" | bc)
    MASTER="$TMP/loop-master.mp4"
    run ffmpeg -v error -y -i "$SRC" -an -filter_complex \
      "[0:v]split[a][b];[a]trim=0:$O,setpts=PTS-STARTPTS[main];[b]trim=$O:$D,setpts=PTS-STARTPTS[tail];[tail][main]xfade=transition=fade:duration=$X:offset=0,format=yuv420p[v]" \
      -map "[v]" -c:v libx264 -crf 18 -preset slow "$MASTER"
  fi

  if [ "$DRY" = 0 ]; then
    # Contrôle du raccord de boucle : SSIM dernière ↔ première image
    N=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$MASTER")
    ffmpeg -v error -y -i "$MASTER" -vf "select=eq(n\,0)" -frames:v 1 "$TMP/first.png"
    ffmpeg -v error -y -i "$MASTER" -vf "select=eq(n\,$((N - 1)))" -frames:v 1 "$TMP/last.png"
    SSIM=$(ffmpeg -i "$TMP/last.png" -i "$TMP/first.png" -lavfi ssim -f null - 2>&1 | grep -o 'All:[0-9.]*' | cut -d: -f2)
    if [ "$(echo "${SSIM:-0} >= $MIN_SSIM_LOOP" | bc)" = 1 ]; then echo "✅ Raccord de boucle : SSIM $SSIM"; else warn "Raccord de boucle : SSIM ${SSIM:-?} < $MIN_SSIM_LOOP (relancer avec --loop-xfade ou régénérer)"; fi
  fi

  # H.264 1080p, deux passes (~2,3 Mo pour 8 s)
  run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libx264 -preset slow -b:v 2300k -maxrate 2500k -bufsize 5000k -pass 1 -passlogfile "$TMP/h" -f mp4 /dev/null
  run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libx264 -preset slow -b:v 2300k -maxrate 2500k -bufsize 5000k -pass 2 -passlogfile "$TMP/h" -pix_fmt yuv420p -movflags +faststart "$BASE.mp4"
  # H.264 720p (repli, ~1 Mo)
  run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1280:-2" -c:v libx264 -preset slow -b:v 1100k -maxrate 1300k -bufsize 2600k -pix_fmt yuv420p -movflags +faststart "$BASE-720.mp4"
  # VP9 1080p, deux passes (~1,8 Mo)
  run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 1800k -row-mt 1 -deadline good -cpu-used 4 -pass 1 -passlogfile "$TMP/v" -f webm /dev/null
  run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 1800k -row-mt 1 -deadline good -cpu-used 2 -pass 2 -passlogfile "$TMP/v" "$BASE.webm"
  # Scrub (option) : toutes images clés, plafond ~4 Mo
  if [ "$SCRUB" = 1 ]; then
    run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libx264 -preset slow -g 1 -b:v 3800k -maxrate 4000k -bufsize 8000k -pass 1 -passlogfile "$TMP/s" -f mp4 /dev/null
    run ffmpeg -v error -y -i "$MASTER" -an -vf "scale=1920:-2" -c:v libx264 -preset slow -g 1 -b:v 3800k -maxrate 4000k -bufsize 8000k -pass 2 -passlogfile "$TMP/s" -pix_fmt yuv420p -movflags +faststart "$BASE-scrub.mp4"
  fi
  # Poster de secours extrait de la première image (le poster de référence reste P0x-d, ingéré comme image)
  run ffmpeg -v error -y -ss 0 -i "$MASTER" -frames:v 1 "$TMP/poster.png"
  run magick "$TMP/poster.png" -resize 1920x -quality 50 "$BASE-poster-1920.avif"
  run magick "$TMP/poster.png" -resize 1280x -quality 50 "$BASE-poster-1280.avif"
  run magick "$TMP/poster.png" -resize 1280x -quality 70 "$BASE-poster-1280.webp"

  if [ "$DRY" = 0 ]; then
    echo "== Contrôle des sorties =="
    for f in "$BASE.mp4" "$BASE-720.mp4" "$BASE.webm"; do has_audio "$f" && warn "$(basename "$f") contient encore une piste audio"; check_size "$f" "$MAX_VIDEO_KB"; done
    [ "$SCRUB" = 1 ] && check_size "$BASE-scrub.mp4" "$MAX_SCRUB_KB"
    check_size "$BASE-poster-1280.avif" "$MAX_POSTER_1280_KB"
  fi
else
  # ======================= IMAGE =======================
  [ "$W" -ge 2400 ] || [[ "$ID" == *-m ]] || warn "Image de ${W} px de large : sous les 2 400 px attendus pour une finale (upscale 4k à prévoir)"
  case "$ID" in
    *-d) WIDTHS="1280 1920 2400" ;;
    *-m) WIDTHS="640 828 1080" ;;
    P09-*) WIDTHS="640 1080" ;;
    *)   WIDTHS="640 828 1080 1280 1920 2400" ;;
  esac
  for w in $WIDTHS; do
    [ "$W" -ge "$w" ] || { warn "Largeur $w ignorée (source de ${W} px : pas d'agrandissement)"; continue; }
    run magick "$SRC" -resize "${w}x" -strip -quality 50 "$BASE-$w.avif"
    run magick "$SRC" -resize "${w}x" -strip -quality 70 "$BASE-$w.webp"
  done
  if [ "$DRY" = 0 ]; then
    echo "== Contrôle des sorties =="
    [ -f "$BASE-1280.avif" ] && check_size "$BASE-1280.avif" "$MAX_POSTER_1280_KB"
    [ -f "$BASE-828.avif" ] && check_size "$BASE-828.avif" "$MAX_MOBILE_828_KB"
  fi
fi

echo
echo "== À reporter dans docs/assets-manifest.md =="
echo "ID $ID · scène $SCENE · source $(basename "$SRC") · ${W}×${H} · ${DUR:-?} s · sorties : $BASE*"
if [ "$WARNINGS" -gt 0 ]; then
  echo "⚠️  $WARNINGS avertissement(s) : statut à laisser sur « généré », corriger avant validation."
  exit 1
fi
echo "✅ Conforme. Statut suivant : « validé Sady » après contrôle visuel (brief §8)."
