# Pipeline média — technique

> **Statut** : v2 (15/10/2026). Maintenu par l'agent `media-producer`.
> **Ce qui a changé** : le brief `docs/assets-ia-brief.md` **remplace** la partie « médias » du cadrage initial. La direction, la shot list et les prompts vivent désormais dans `docs/assets-manifest.md` ; la style bible dans `docs/art-direction.md` §6. Ce document ne garde que la **technique** : outils, commandes testées, specs, ingestion, intégration, budgets.
> **Rappel** : tous les assets du site sont **générés par IA**. Aucune photo ni vidéo existante n'est publiée.

---

## 1. Outils

| Outil | État (15/10/2026) | Usage |
|---|---|---|
| **Higgsfield CLI** `@higgsfield/cli` 1.1.26 | Installée (globale), connectée, workspace « Private » sélectionné (starter, 278,88 crédits) | Génération par Sady, ou par Claude **avec accord explicite par lot**. Capacités réelles : `docs/assets-manifest.md` §0 |
| Skill `higgsfield-generate` | Installée au niveau utilisateur (`~/.claude/skills/`), hors du dépôt | Recettes CLI. **Deux règles neutralisées** par les nôtres : elle déconseille d'estimer les coûts et pousse Seedance 2.5 (128 crédits / 8 s) |
| Connecteur MCP Higgsfield (claude.ai) | **Non autorisé** (à faire dans les réglages des connecteurs claude.ai si souhaité) | Non nécessaire : la CLI couvre le besoin |
| ffmpeg (libx264, libvpx-vp9, libsvtav1), ffprobe | Installés | Encodage, boucles, posters, contrôle |
| ImageMagick (AVIF, WebP), cwebp | Installés | Posters et exports d'images |

**Règles d'usage de la CLI**
1. `higgsfield generate cost …` avant chaque lot ; **accord de Sady** avant tout `generate create`.
2. `kling3_0 --mode pro --sound off` par défaut pour la vidéo ; jamais Seedance 2.5 sans demande explicite.
3. Ne passer en `--image`, `--start-image` ou `--end-image` que **nos** images générées : la CLI téléverse les fichiers locaux, et Higgsfield peut entraîner ses modèles sur les entrées hors contrat Enterprise.
4. Noter chaque génération (y compris les prises écartées) dans le journal du manifeste.

---

## 2. Moodboard et droits

- Index et règles : `docs/moodboard/README.md`. Le moodboard est une **référence de style interne** : jamais publié, jamais déployé, jamais utilisé comme entrée d'une génération.
- **Aucun fichier existant n'est publiable** : images `cosmos_*` sans droits, portraits Unsplash écartés (et l'un d'eux est la source trop directe du prompt V04), vidéos de provenance inconnue.
- Masters et sorties brutes : **hors du dépôt** (dossier `MEDIA SOURCES/` sur le disque projet), avec un fichier `provenance.md` (outil, modèle, date, prompt, job ID, licence). Le journal du manifeste en est la version courte.

---

## 3. Specs d'export

| Livrable | Format | Dimensions | Cible de poids | Notes |
|---|---|---|---|---|
| Vidéo de scène | **MP4 H.264** + **WebM VP9** (AV1 en option) | 1920 × 1080 ; une variante 1280 × 720 | **≤ 2,5 Mo** (H.264), ≤ 2 Mo (VP9) | Sans audio, `+faststart`, 6 à 8 s, boucle propre |
| Vidéo « scrub » (≤ 2 scènes) | MP4 H.264 **toutes images clés** (`-g 1`) | 1920 × 1080 | **≤ 4 Mo** | Permet une recherche fluide de `currentTime` |
| Poster desktop (Pxx-d) | AVIF + WebP | 1280 et 1920 | ≤ 120 Ko en AVIF 1280 | Image identique à la première image de la vidéo |
| Photo mobile (Pxx-m) | AVIF + WebP | 640, 828, 1080 | ≤ 80 Ko en AVIF 828 | Recadrage ou version 4:5 |
| Photos de section | AVIF + WebP | 640 à 2 400 | ≤ 150 Ko en AVIF 1280 | `next/image` |

**Nommage** (brief §7) : `public/media/{scene}/{ID}-{slug}.{ext}`, scènes `seuil`, `maison`, `conciergerie`, `grand-age`, `enfants`, `territoires`, `contact`, `details`. Exemples : `public/media/seuil/V01-fenetre-mer.mp4`, `…/V01-fenetre-mer.webm`, `…/V01-fenetre-mer-scrub.mp4`, `…/P01-fenetre-mer-1280.avif`, `…/P01-fenetre-mer-m-828.avif`.

---

## 4. Ingestion

1. Sady dépose les sorties brutes dans **`media-incoming/`** à la racine du projet (ignoré par Git **et** par Vercel). Le brief prévoyait `public/media/_incoming/` : à éviter, car tout ce qui est dans `public/` est servi par un `next build` local et envoyé par un `vercel deploy` local s'il n'est pas exclu.
2. `/ingest-media <fichier ou dossier>` lance le script d'ingestion (`scripts/ingest-media.sh`, déplacé en story 1.1) : contrôle ffprobe → encodages → posters → rapport de poids → mise à jour du statut dans le manifeste.
3. Contrôle qualité du brief §8 (agent `media-producer` + regard de Sady), puis validation Cat.
4. Seuls les fichiers **validés** rejoignent `public/media/{scene}/`.

---

## 5. Commandes testées

Tests du 15/10/2026 sur ce poste (Apple Silicon), avec une **source synthétique** générée par ffmpeg (aucun fichier du moodboard utilisé) : 1920 × 1080, 25 i/s, 8 s, dégradés en mouvement lent, **avec** une piste audio pour vérifier sa suppression. Deux variantes : « propre » et « grain » (bruit temporel fort, pire cas pour la compression).

### 5.1 Résultats

| Commande | Fonctionne | Audio supprimé | Temps (grain) | Poids (propre) | Poids (grain) |
|---|---|---|---|---|---|
| H.264 CRF 24 `-preset slow` (brief) | ✅ | ✅ | 33 s | 244 Ko | **177 Mo** |
| VP9 CRF 34 `-b:v 0` (brief, + `-row-mt 1 -deadline good -cpu-used 2`) | ✅ | ✅ | 44 s | 29 Ko | 228 Mo |
| AV1 SVT CRF 38 `-preset 6` | ✅ | ✅ | 15 s | 52 Ko | 182 Mo |
| Scrub H.264 CRF 26 `-g 1` (brief) | ✅ | ✅ | 7 s | 1,3 Mo | 113 Mo |
| **H.264 deux passes, 2 300 kbit/s** | ✅ | ✅ | 12 s | — | **2,0 Mo** |
| **VP9 deux passes, 1 800 kbit/s** | ✅ | ✅ | 99 s | — | **1,7 Mo** |
| **Scrub H.264 deux passes, `-g 1`, plafond 4 000 kbit/s** | ✅ | ✅ | 11 s | — | **2,1 Mo** |
| Boucle par fondu enchaîné 0,5 s (xfade) | ✅ | ✅ | 30 s | 271 Ko | — |
| Poster AVIF 828 / 1280 / 1920 (ImageMagick, qualité 50-55) | ✅ | — | < 1 s | — | 79 Ko / 228 Ko / 886 Ko |

### 5.2 Ce qu'on en retient
1. **Toutes les commandes du brief fonctionnent** et `-an` supprime bien l'audio.
2. **Le CRF seul ne garantit pas le poids.** Selon le contenu, la même commande donne 244 Ko ou 177 Mo. Le poids réel ne sera connu que sur les vraies sorties Higgsfield.
3. **L'encodage en deux passes à débit cible tient le budget quel que soit le contenu** (2,0 Mo, 1,7 Mo, 2,1 Mo). C'est la méthode retenue pour les livrables ; le CRF sert aux essais rapides.
4. **Le grain incrusté est l'ennemi du poids.** À débit fixe, un grain fort se transforme en bouillie. D'où la proposition `STYLE_ANCHOR` v1.1 (grain « très subtil ») et, si besoin, un grain restitué à l'affichage par une texture CSS fixe à 3-5 % d'opacité (quelques Ko, identique sur toutes les scènes). Le débruitage `hqdn3d` n'a pas aidé sur le bruit synthétique : à réévaluer sur de vraies sorties.
5. **Le fondu enchaîné rend la boucle quasi invisible** : similarité (SSIM) entre la dernière et la première image de **0,997** avec le fondu, contre 0,989 sans. Seuil retenu : **SSIM ≥ 0,99**.
6. Le poster AVIF 1280 dépasse la cible sur du contenu bruité (228 Ko) : baisser la qualité (40-45) ou débruiter le poster seul.

### 5.3 Commandes de référence (validées)

```bash
# Vidéo de scène : H.264 deux passes, sans audio, 1080p, faststart (~2,3 Mo pour 8 s)
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -preset slow -b:v 2300k -maxrate 2500k -bufsize 5000k -pass 1 -passlogfile /tmp/x -f mp4 /dev/null
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -preset slow -b:v 2300k -maxrate 2500k -bufsize 5000k -pass 2 -passlogfile /tmp/x -pix_fmt yuv420p -movflags +faststart out.mp4

# WebM VP9 deux passes (~1,8 Mo)
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 1800k -row-mt 1 -deadline good -cpu-used 4 -pass 1 -passlogfile /tmp/v -f webm /dev/null
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libvpx-vp9 -b:v 1800k -row-mt 1 -deadline good -cpu-used 2 -pass 2 -passlogfile /tmp/v out.webm

# Scrub : toutes images clés, plafond ~4 Mo
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -preset slow -g 1 -b:v 3800k -maxrate 4000k -bufsize 8000k -pass 1 -passlogfile /tmp/s -f mp4 /dev/null
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -preset slow -g 1 -b:v 3800k -maxrate 4000k -bufsize 8000k -pass 2 -passlogfile /tmp/s -pix_fmt yuv420p -movflags +faststart out-scrub.mp4

# Scrub long (16 s, prototype V5) : 12 images par seconde, toutes images clés, ~3,2 Mo en 720p.
# À poids égal (~4 Mo), mesuré le 16/10/2026 : -g 1 à 24 i/s SSIM 0,974 ; -g 1 à 12 i/s 0,984 ;
# -g 6 à 24 i/s 0,987 mais recherche moins sûre dans Safari. Retenu : 12 i/s, 1 600 kbit/s (0,982).
ffmpeg -y -i in.mp4 -an -vf fps=12 -c:v libx264 -preset slow -g 1 -b:v 1600k -pass 1 -passlogfile /tmp/s -f mp4 /dev/null
ffmpeg -y -i in.mp4 -an -vf fps=12 -c:v libx264 -preset slow -g 1 -b:v 1600k -maxrate 2200k -bufsize 3200k -pass 2 -passlogfile /tmp/s -movflags +faststart out-scrub.mp4

# Scrub à cadence variable (22/10/2026) : 12 i/s sur la partie lente, 24 i/s sur la fin rapide
# (ici à partir de 12 s), pour qu'un pas de défilement ne saute pas d'un coup. Sur la chaîne V10 +
# V11 en 1080p : 242 images, 3,85 Mo à 1 900 kbit/s ; plus grand écart entre deux pas de défilement
# ramené de 4,9 à 2,8 fois la médiane. La courbe de défilement se calcule sur le master à cadence fixe.
ffmpeg -y -i in.mp4 -an -vf "select='if(gte(t\,12)\,1\,not(mod(n\,2)))'" -fps_mode vfr -c:v libx264 -preset slow -g 1 -b:v 1900k -pass 1 -passlogfile /tmp/s -f mp4 /dev/null
ffmpeg -y -i in.mp4 -an -vf "select='if(gte(t\,12)\,1\,not(mod(n\,2)))'" -fps_mode vfr -c:v libx264 -preset slow -g 1 -b:v 1900k -maxrate 2660k -bufsize 3800k -pass 2 -passlogfile /tmp/s -movflags +faststart out-scrub.mp4

# Essai rapide (CRF, commande du brief)
ffmpeg -y -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart out-crf.mp4
```

### 5.4 Boucle sans coupure (fondu enchaîné fin → début)
Pour une vidéo de durée `D` et un fondu de `X` secondes, la sortie dure `D − X` et sa dernière image est identique à sa première.

```bash
D=8; X=0.5; O=$(echo "$D-$X" | bc)
ffmpeg -y -i in.mp4 -an -filter_complex \
 "[0:v]split[a][b];[a]trim=0:$O,setpts=PTS-STARTPTS[main];[b]trim=$O:$D,setpts=PTS-STARTPTS[tail];[tail][main]xfade=transition=fade:duration=$X:offset=0,format=yuv420p[v]" \
 -map "[v]" -c:v libx264 -crf 18 -preset slow loop-master.mp4      # master, puis encodages du §5.3

# Contrôle du raccord : SSIM dernière ↔ première image (exiger ≥ 0,99)
N=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 loop-master.mp4)
ffmpeg -v error -y -i loop-master.mp4 -vf "select=eq(n\,0)" -frames:v 1 first.png
ffmpeg -v error -y -i loop-master.mp4 -vf "select=eq(n\,$((N-1)))" -frames:v 1 last.png
ffmpeg -i last.png -i first.png -lavfi ssim -f null - 2>&1 | grep -o "All:[0-9.]*"
```
Avec Kling 3.0, une boucle **native** s'obtient en donnant la même image en `--start-image` et `--end-image` ; le fondu reste le filet de sécurité.

### 5.5 Poster et contrôle
```bash
ffmpeg -y -ss 0 -i out.mp4 -frames:v 1 poster.png      # première image = image de départ (LCP identique)
magick poster.png -resize 1280x -quality 50 P01-fenetre-mer-1280.avif
magick poster.png -resize 1280x -quality 70 P01-fenetre-mer-1280.webp
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height -show_entries format=duration,size -of compact out.mp4
```
Refuser : piste audio · > 2,5 Mo (> 4 Mo en scrub) · > 1080p · poster absent · nommage non conforme · provenance absente · raccord de boucle sous 0,99.

---

## 6. Intégration (phase 1 et suivantes)

1. **Le poster est l'élément LCP** : `next/image` en priorité haute (`fetchPriority="high"` ou `preload`), AVIF puis WebP, `aspect-ratio` réservé. La vidéo se superpose **ensuite**. L'attribut `poster` seul ne gère ni `srcset` ni AVIF ni `fetchpriority`. Un poster trop sombre ou trop flou peut être ignoré comme candidat LCP par Chrome : le titre devient alors le LCP et sa police doit s'afficher vite.
2. **Élément** : `<video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" disablepictureinpicture disableremoteplayback>`, sources AV1 (option) puis WebM puis MP4.
3. **Conditions de chargement** (toutes requises, sinon photo fixe, définitivement) : `(min-width: 1024px)`, `(pointer: fine)`, `prefers-reduced-motion: no-preference`, pas de `Save-Data`, pas de `prefers-reduced-data`, connexion non signalée comme lente. **Sur mobile, aucune vidéo n'est téléchargée.**
4. **Hero (V01)** : demandée après l'événement `load` puis un moment d'inactivité (`requestIdleCallback`, délai maximal ~2 s).
5. **Scènes suivantes** : chaque vidéo n'est demandée qu'à l'approche de sa scène (IntersectionObserver, marge d'environ un demi-écran). **Une seule vidéo joue à la fois** ; celles qui sortent de l'écran se mettent en pause.
6. **Pause** : un bouton texte « Mettre la vidéo en pause / Lire la vidéo », atteignable au clavier, sur chaque vidéo qui joue (WCAG 2.2.2). Un choix « pause » s'applique à toutes les scènes pour la session (`sessionStorage`).
7. **Scrub** (V01 et V07 au plus) : `currentTime` piloté par la progression de la scène dans le viewport, en `requestAnimationFrame`, uniquement quand la scène est visible. **Aucun épinglage** si un test clavier, lecteur d'écran ou zoom le dégrade : la section reste une section normale avec son poster. Défilement natif, jamais détourné. Un plan qui accélère (lent au début, rapide à la fin) passerait d'un coup au défilement : `node scripts/scrub-timeline.mjs <vidéo>` calcule une courbe « progression → temps » qui donne plus de défilement aux passages rapides (prop `timeline` de `ScrubVideo`). Sur le franchissement du prototype V5, le changement à l'image entre le premier et le dernier cinquième de la piste passe d'un rapport de 5,3 à 2,2.
8. **Texte sur la vidéo** : seulement le titre display, avec un voile sapin ≥ 58 % (grand texte, 3:1 dans le pire cas) ; tout texte courant sur aplat (`docs/design-tokens.md` §2.4). Variante : mesurer à l'ingestion le pixel le plus clair sous la zone de texte, sur plusieurs images du clip, et ajuster le voile avec une marge.

---

## 7. Performance et budgets

### 7.1 Chargement initial (ce que Lighthouse mesure)

| Poste | Mobile (4G lente simulée, CPU × 4) | Desktop |
|---|---|---|
| HTML compressé | ≤ 30 Ko | ≤ 30 Ko |
| CSS | ≤ 25 Ko | ≤ 25 Ko |
| JavaScript initial | ≤ 100 Ko gzip | ≤ 100 Ko gzip |
| Polices préchargées | 2 WOFF2, ≤ 80 Ko | idem |
| Image LCP | P01-m 828 AVIF ≤ 80 Ko | P01-d 1280-1920 AVIF ≤ 120 Ko |
| **Total avant LCP** | **≤ 320 Ko** | **≤ 360 Ko** |
| Vidéo | **jamais** | V01 ≤ 2,5 Mo, après `load` + inactivité |

### 7.2 Au fil de la visite (desktop)
Jusqu'à 8 vidéos de ≤ 2,5 Mo chacune (+ ≤ 4 Mo par scène en scrub), **chargées à l'approche** de leur scène : une visite complète de l'accueil peut atteindre ~20 à 25 Mo, sans effet sur le score (Lighthouse ne fait pas défiler la page). C'est acceptable en desktop sur une connexion rapide ; c'est précisément pourquoi le mobile n'en reçoit aucune.

### 7.3 Si le budget ne tient pas (ordre de sacrifice)
1. Vidéo mobile (déjà exclue).
2. Versions scrub : on garde la lecture en boucle simple.
3. Vidéos 1080p : on ne sert que le 720p (~1 Mo).
4. Vidéos des scènes S2 à S7 : photos fixes ; on ne garde que V01.
5. V01 : poster fixe. Aucun ersatz animé.
6. Parallaxe et révélations au scroll.

---

## 8. Cadre légal des visuels générés

Détail et sources : `docs/privacy.md` §4. En bref :
- **Transparence (règlement européen sur l'IA, art. 50(4) et 50(5), applicable depuis le 2 août 2026)** : mention probablement requise, **au plus tard à la première exposition**. Recommandation : une ligne discrète permanente en pied de page, détaillée dans les mentions légales. `[À CONFIRMER avec Cat, À VALIDER JURIDIQUEMENT]`
- **Higgsfield (conditions du 26/07/2026)** : usage commercial des sorties autorisé ; entrées et sorties utilisables pour l'entraînement hors contrat Enterprise ; marquage de provenance C2PA à ne pas retirer (le réencodage le supprime : conserver les originaux).
- **Neutralité** : aucune image ne doit se faire passer pour un lieu réel identifiable ni ressembler à une personne réelle (`docs/assets-manifest.md` §2).
