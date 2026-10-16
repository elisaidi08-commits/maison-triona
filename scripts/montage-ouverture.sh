#!/usr/bin/env bash
# Maison Triona : montage du film d'ouverture de l'accueil (D25).
# Assemble des masters déjà étalonnés (media-incoming/*/masters/), 4 s par plan, fondu enchaîné
# d'1 s, puis encode en deux passes (H.264 et VP9) à la résolution native 1280 × 720, sans son.
# Le plan i commence à i × 3 s : le minutage des légendes (src/lib/ouverture.ts) en dépend.
#
# Usage :
#   scripts/montage-ouverture.sh <master>[@<début en s>] …
# Exemple :
#   scripts/montage-ouverture.sh media-incoming/lot1/masters/V01-master.mp4@1 \
#     media-incoming/lot1/masters/V03-master.mp4@0
#
# Sortie : public/media/ouverture/ouverture.{mp4,webm} et le poster du premier plan est l'image P01.

set -euo pipefail

PLAN=4      # durée de chaque plan (s)
FONDU=1     # durée du fondu enchaîné (s)
OUT="public/media/ouverture"
# Budget : le film est plus long qu'une boucle (≈ 20 s), d'où un débit plus bas (docs/media-pipeline.md §3).
H264_RATE=1100k
VP9_RATE=850k

[ "$#" -ge 2 ] || { echo "⛔ au moins deux plans" >&2; exit 2; }

inputs=()
filters=""
i=0
for spec in "$@"; do
  file="${spec%@*}"
  start=0
  [ "$spec" != "$file" ] && start="${spec##*@}"
  [ -f "$file" ] || { echo "⛔ introuvable : $file" >&2; exit 2; }
  inputs+=(-i "$file")
  filters+="[$i:v]trim=start=${start}:duration=${PLAN},setpts=PTS-STARTPTS,fps=24,format=yuv420p[v$i];"
  i=$((i + 1))
done

# Chaîne de fondus : le k-ième fondu commence à k × (PLAN − FONDU).
previous="v0"
for ((k = 1; k < i; k++)); do
  offset=$((k * (PLAN - FONDU)))
  filters+="[$previous][v$k]xfade=transition=fade:duration=${FONDU}:offset=${offset}[x$k];"
  previous="x$k"
done
filters="${filters%;}"

mkdir -p "$OUT"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filters" -map "[$previous]" -an \
  -c:v libx264 -crf 12 -preset slow -pix_fmt yuv420p "$work/master.mp4"

ffmpeg -v error -y -i "$work/master.mp4" -an -c:v libx264 -preset slow -b:v "$H264_RATE" \
  -maxrate 1400k -bufsize 2800k -pass 1 -passlogfile "$work/h" -f mp4 /dev/null
ffmpeg -v error -y -i "$work/master.mp4" -an -c:v libx264 -preset slow -b:v "$H264_RATE" \
  -maxrate 1400k -bufsize 2800k -pass 2 -passlogfile "$work/h" -pix_fmt yuv420p \
  -movflags +faststart "$OUT/ouverture.mp4"
ffmpeg -v error -y -i "$work/master.mp4" -an -c:v libvpx-vp9 -b:v "$VP9_RATE" -row-mt 1 \
  -deadline good -cpu-used 4 -pass 1 -passlogfile "$work/v" -f webm /dev/null
ffmpeg -v error -y -i "$work/master.mp4" -an -c:v libvpx-vp9 -b:v "$VP9_RATE" -row-mt 1 \
  -deadline good -cpu-used 2 -pass 2 -passlogfile "$work/v" "$OUT/ouverture.webm"

for f in "$OUT"/ouverture.mp4 "$OUT"/ouverture.webm; do
  printf "%-36s %6s ko  %s\n" "$f" $(( $(stat -f%z "$f") / 1024 )) \
    "$(ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration -of csv=p=0 "$f" | tr '\n' ' ')"
done
echo "Plans : $i · durée attendue : $(( i * (PLAN - FONDU) + FONDU )) s"
