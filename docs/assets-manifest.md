# Manifeste des assets IA — Maison Triona

> **Statut** : v1, phase 0 (15/10/2026). **Aucune génération lancée.** Source : `docs/assets-ia-brief.md` (brief de Sady), `docs/ux-entry-i18n-a11y.md` (spec d'entrée, prioritaire), style bible figée dans `docs/art-direction.md` §6.
> **Mis à jour par** : l'agent `media-producer` à chaque génération, validation ou intégration.
> **Statuts** : `à générer` → `généré` → `validé Sady` → `validé Cat` → `intégré`.

---

## 0. Capacités Higgsfield réellement disponibles (vérifiées le 15/10/2026)

Vérifié par la CLI officielle (`@higgsfield/cli` 1.1.26, connectée au workspace « Private », **offre starter, 278,88 crédits**) et par les réponses de Sady (image → vidéo, référence de style, upscale, 1080p natif). Aucun job créé ; les coûts viennent de `higgsfield generate cost`, qui ne consomme rien.

| Besoin | Modèle retenu (ID CLI) | Paramètres utiles | Coût estimé |
|---|---|---|---|
| Brouillons d'images, personnes / plans cinéma | `soul_cinematic` | `--aspect_ratio` 16:9, 3:4, 1:1… (**pas de 4:5**) · `--quality 2k` (= 1080p réel) · 1 image de référence | **0,12** crédit |
| Brouillons d'images, lieux sans personne | `soul_location` | ratios fixes, dont 16:9 et 3:4 | **0,12** |
| Images finales ≥ 2 400 px | `bytedance_image_upscale` (`--resolution 4k`) sur le brouillon retenu, **ou** `nano_banana_pro` (`--resolution 4k`, 4:5 natif, jusqu'à 14 images de référence) | — | upscale : à estimer sur fichier · Nano Banana Pro 4k : **4** |
| Vidéo 16:9, 1080p, boucle | **`kling3_0`** `--mode pro --duration 8 --sound off` | `--start-image` **et** `--end-image` (même image = boucle native), ratios 16:9, 9:16, 1:1 | **12** |
| Vidéo de secours (plan difficile) | `veo3_1` `--duration 8 --quality high` | `--start-image` seulement | 32 |
| À éviter avec ce budget | `seedance_2_5` (défaut de la skill Higgsfield) | 1080p à forcer, audio actif par défaut | **128** (brouillon 24) |

**Points d'attention vérifiés**
- **Son actif par défaut** sur Kling (`sound on`) et Seedance (`generate_audio true`) : toujours `--sound off`, et `-an` à l'export.
- **Aucun prompt négatif** sur les modèles retenus (Soul, Nano Banana Pro, Kling 3.0, Veo 3.1) : le bloc `NEGATIVE` du brief ne s'applique pas ; on utilise `QUALITY_GUARD` (§1), formulé positivement, comme le recommande le guide officiel.
- **Pas de 4:5 sur Soul** : brouillon en 3:4, puis recadrage ou version finale Nano Banana Pro en 4:5.
- **Soul « 2k » = 1080p réel** : l'upscale est nécessaire pour atteindre 2 400 px.
- La skill installée (`~/.claude/skills/higgsfield-generate`) conseille de **ne pas estimer les coûts** et pousse **Seedance 2.5** par défaut. **Nos règles priment** : estimation `generate cost` puis accord de Sady avant chaque lot, Kling 3.0 par défaut.
- Les fichiers locaux passés en `--image` sont **téléversés automatiquement** : n'y passer que **nos** images générées, jamais un fichier du moodboard. Hors contrat Enterprise, les entrées et sorties peuvent servir à l'entraînement de Higgsfield.

---

## 1. Blocs de prompt (versionnés)

### `STYLE_ANCHOR` v1 (brief, inchangé)
```
quiet-luxury Mediterranean-inspired lifestyle photography, shot on 35mm film,
Kodak Portra 400 look, soft natural light, warm golden hour tones, fine film grain,
muted warm palette of ivory, ochre, terracotta, sage and deep forest green with
touches of champagne gold, shallow depth of field, calm unhurried mood,
understated elegance, generic location with no recognizable landmarks
```

### `STYLE_ANCHOR` v1.1 (proposé, à comparer à v1 au lot 0)
Deux changements, notés ici comme l'exige le brief §4.2 : grain **très léger** (un grain fort incrusté rend la compression impossible, voir `docs/media-pipeline.md` §5) et bleus **grisés** (la palette mesurée du moodboard montre des ciels saturés à éviter).
```
quiet-luxury Mediterranean-inspired lifestyle photography, shot on 35mm film,
Kodak Portra 400 look, soft natural light, warm golden hour tones, very subtle fine film grain,
muted warm palette of ivory, ochre, terracotta, olive, sage and deep cypress green with
touches of champagne gold, blues kept soft and greyed, shallow depth of field,
calm unhurried mood, understated elegance, generic location with no recognizable landmarks
```

### `QUALITY_GUARD` v1 (remplace `NEGATIVE` sur les modèles sans prompt négatif)
```
natural, correctly formed hands in relaxed poses; plain unmarked surfaces and objects;
only the people described, with calm natural expressions; soft diffused light;
gentle, desaturated colour; steady unhurried camera; timeless setting with nothing
modern or electronic in view
```

### `NEGATIVE` v1 (brief, inchangé)
À utiliser **seulement** si un modèle expose un champ négatif (dans le catalogue de Sady : Kling 2.5 Turbo, Wan 2.6 et 2.7, PixVerse V6 ; aucun n'est retenu).

### Prompt vidéo (image → vidéo)
Le guide officiel Higgsfield est clair : en image → vidéo, **ne décrire que le mouvement**, jamais la scène (elle est dans l'image de départ). Les prompts V ci-dessous ne contiennent donc pas `STYLE_ANCHOR`.

---

## 2. Écarts relevés dans le brief et adaptations

| Asset | Écart avec les règles du brief | Adaptation proposée |
|---|---|---|
| V01 / P01 | Reprend presque le cadrage de `cosmos_147496275` (fenêtre ouverte, battant, horizon) ; « deep-blue sea » contredit « pas de bleu saturé » | Portes-fenêtres vues **depuis le fond de la pièce**, rideau, bande de soleil au sol, mer **gris-bleu** ; zone gauche calme pour le texte du hero |
| V02 / P02 | Décrit élément par élément la façade `cosmos_759147631` (§1.1) | Mur ocre **de biais**, porte en arche **entrouverte** (« on vous attend »), jasmin, citronnier ; ni balcon ni volets |
| V03 / P03 | Lac de Côme et bateau type Riva : **lieu et marque identifiables** (§1.5, §1.6), proche de `cosmos_970719795` | Pont verni d'un petit bateau à quai, ponton de pierre, brume, **aucune rive identifiable**. Alternative pour Cat : console d'entrée, clés, bouquet frais, valise prête |
| V04 / P04 | Décrit trait pour trait une **personne réelle** (portrait Unsplash `hosein-sediqi`) : §1.3 | **Version sûre en principal** (mains, livre, tasse) ; version visage : vue de dos, cheveux courts, cardigan camel, **debout** à une fenêtre (autonomie) |
| V05 | Correct ; le mouvement latéral ne boucle pas nativement | Boucle par fondu en post-production ; mains cadrées à hauteur de poitrine |
| V06 | Mains d'enfant et d'adulte qui interagissent : risque d'artefacts élevé | Gardé, contrôle qualité renforcé ; c'est le **visuel principal de S5** (destination « enfants ») |
| S5 | Le message (« Table et générations ») parle peu de **garde d'enfants**, destination du choix 3 | V06 en visuel principal ; option P06b « détail enfant » sans enfant visible (cardigan tricoté, livre d'images) |
| V07 / P07 | Collines à cyprès, villa et longue piscine bleue, vue aérienne : **cliché toscan** (§1.5), drone (§2.5), bleu saturé | Brume matinale sur un lac calme entre des collines boisées, maison de pierre lointaine, **à hauteur d'œil** ; aucune piscine |
| V08 / P08 | Reprend `cosmos_814515771` (mur, cyprès, jasmin, fenêtre étroite) | **Portail en bois entrouvert** dans un mur de pierre sèche, jasmin débordant, couchant ; invitation à entrer, sans cyprès en vis-à-vis |
| P02, P03, P04… | Le brief les donne en **4:5** alors qu'elles sont aussi le **poster** et l'**image de départ** de vidéos **16:9** | Deux déclinaisons par scène vidéo : **Pxx-d** (16:9, poster + image de départ) et **Pxx-m** (4:5, mobile) |
| §7 Livraison | `public/media/_incoming/` est dans `public/` : un `vercel deploy` local ou un `next build` local l'embarqueraient | Recommandé : `media-incoming/` à la racine, ignoré par Git **et** par Vercel |

---

## 3. Manifeste

### 3.1 Style sheet (lot 0 · images d'ancrage)

| ID | Rôle | Type | Ratio | Modèle | Statut | Fichier | Notes |
|---|---|---|---|---|---|---|---|
| A01 | Extérieur lumineux | Image | 16:9 | `soul_location` → upscale 4k | à générer | `media-incoming/A01-exterieur.png` | Référence de style pour V02, V07, V08 |
| A02 | Intérieur sombre à fenêtre | Image | 16:9 | `soul_cinematic` → upscale 4k | à générer | `media-incoming/A02-interieur.png` | Référence pour V01, V04 |
| A03 | Détail de matière | Image | 1:1 | `soul_cinematic` → upscale 4k | à générer | `media-incoming/A03-matiere.png` | Référence pour P09, V06 |

Les ancres ne sont **jamais publiées** : elles servent de référence de style (`--image A0x.png`, une référence par génération Soul).

### 3.2 Vidéos (priorité 1)

| ID | Scène | Destination du choix | Ratio | Durée | Flags | Image de départ | Modèle | Statut | Fichier final |
|---|---|---|---|---|---|---|---|---|---|
| V01 | S1 Seuil · hero + entrée | — (porte les 4 choix) | 16:9 | 8 s | boucle · scrub | P01-d | `kling3_0` pro | à générer | `public/media/seuil/V01-fenetre-mer.{mp4,webm}` |
| V02 | S2 La maison | — | 16:9 | 8 s | boucle | P02-d | `kling3_0` pro | à générer | `public/media/maison/V02-porte-ocre.{mp4,webm}` |
| V03 | S3 Conciergerie | **Choix 1** `#conciergerie` | 16:9 | 8 s | scrub | P03-d | `kling3_0` pro | à générer | `public/media/conciergerie/V03-bateau-quai.{mp4,webm}` |
| V04 | S4 Grand âge | **Choix 2** `#grand-age` | 16:9 | 8 s | boucle | P04-d | `kling3_0` pro | à générer | `public/media/grand-age/V04-mains-livre.{mp4,webm}` |
| V05 | S5 Table et générations | **Choix 3** `#enfants` (secondaire) | 16:9 | 8 s | boucle (post) | P05-d | `kling3_0` pro | à générer | `public/media/enfants/V05-table-partagee.{mp4,webm}` |
| V06 | S5 Table et générations | **Choix 3** `#enfants` (principal) | 16:9 | 8 s | boucle | P06-d | `kling3_0` pro | à générer | `public/media/enfants/V06-mains-romarin.{mp4,webm}` |
| V07 | S6 Territoires | — | 16:9 | 8 s | scrub | P07-d | `kling3_0` pro | à générer | `public/media/territoires/V07-brume-lac.{mp4,webm}` |
| V08 | S7 Contact | **Choix 4** `/contact` | 16:9 | 8 s | boucle | P08-d | `kling3_0` pro | à générer | `public/media/contact/V08-portail.{mp4,webm}` |

Scrub : au plus **deux** scènes en version liée au scroll (recommandé : V01 et V07), encodées en plus (`-scrub.mp4`, toutes images clés).

### 3.3 Photos (priorité 2)

| ID | Usage | Destination du choix | Ratio | Modèle (brouillon → final) | Statut | Fichier final (racine) |
|---|---|---|---|---|---|---|
| P01-d | Poster V01, image de départ | — | 16:9 | `soul_cinematic` (réf. A02) → upscale 4k | à générer | `public/media/seuil/P01-fenetre-mer` |
| P01-m | Hero mobile | — | 4:5 | `nano_banana_pro` 4k (réf. P01-d) | à générer | `public/media/seuil/P01-fenetre-mer-m` |
| P02-d / P02-m | Poster V02 / mobile | — | 16:9 / 4:5 | `soul_location` (réf. A01) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/maison/P02-porte-ocre[-m]` |
| P03-d / P03-m | Poster V03 / mobile | **Choix 1** | 16:9 / 4:5 | `soul_location` → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/conciergerie/P03-bateau-quai[-m]` |
| P04-d / P04-m | Poster V04 / mobile | **Choix 2** | 16:9 / 4:5 | `soul_cinematic` (réf. A02) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/grand-age/P04-mains-livre[-m]` |
| P05-d / P05-m | Poster V05 / mobile | **Choix 3** | 16:9 / 4:5 | `soul_cinematic` → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/enfants/P05-table-partagee[-m]` |
| P06-d / P06-m | Poster V06 / mobile (**visuel principal S5**) | **Choix 3** | 16:9 / 4:5 | `soul_cinematic` (réf. A03) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/enfants/P06-mains-romarin[-m]` |
| P06b | Option : détail « enfants » sans enfant visible | **Choix 3** | 4:5 | `nano_banana_pro` 4k | à décider | `public/media/enfants/P06b-cardigan-livre` |
| P07-d / P07-m | Poster V07 / mobile | — | 16:9 / 4:5 | `soul_location` (réf. A01) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/territoires/P07-brume-lac[-m]` |
| P08-d / P08-m | Poster V08 / mobile | **Choix 4** | 16:9 / 4:5 | `soul_location` (réf. A01) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/contact/P08-portail[-m]` |
| P09-1 à 6 | Détails et textures | — | 1:1 | `soul_cinematic` (réf. A03) → upscale | à générer | `public/media/details/P09-{lin,olivier,terre-cuite,porcelaine,laiton,calcaire}` |
| P10 | Image de partage (OG) | — | 1200 × 630 | **non générée** : composition en code sur recadrage de P01-d | phase 1 | `public/brand/og-{fr,en}.png` |

Exports de chaque photo : AVIF puis WebP, largeurs 640 · 828 · 1080 · 1280 · 1920 · 2400 (selon l'usage).

### 3.4 Couverture des destinations (contrôle de la spec d'entrée §6)

| Choix | Destination | Vidéo desktop | Photo mobile | OK |
|---|---|---|---|---|
| 1 · Organiser le quotidien | `#conciergerie` · `/services/conciergerie` | V03 | P03-m | ✅ |
| 2 · Accompagner un proche, ou vous-même | `#grand-age` · `/services/grand-age` | V04 | P04-m | ✅ |
| 3 · Prendre soin des enfants | `#enfants` · `/services/enfants` | V06 (+ V05) | P06-m (+ P05-m, option P06b) | ✅ (message à confirmer) |
| 4 · Je ne sais pas encore | `/contact` | V08 | P08-m | ✅ |

---

## 4. Prompts prêts à copier

**Images** : `STYLE_ANCHOR` (v1, ou v1.1 si retenue au lot 0) + description de la scène + `QUALITY_GUARD`.
**Vidéos** : description du mouvement seulement.
**Avant chaque lot** : `higgsfield generate cost …` avec les mêmes paramètres, puis accord de Sady.

### Lot 0 · Style sheet
- **A01** (`soul_location`, 16:9) : `A sun-washed limestone garden wall beside a path of pale gravel, olive trees and a single tall cypress, late-afternoon light casting long soft shadows across the stone.`
- **A02** (`soul_cinematic`, 16:9) : `A quiet, dim room with lime-washed walls and a linen-covered armchair; a tall window lets in warm low sunlight that falls across a worn terracotta floor; the rest of the room rests in soft shadow.`
- **A03** (`soul_cinematic`, 1:1) : `Close-up of washed ivory linen draped over the edge of an olive-wood table beside a white porcelain bowl, warm raking light revealing the weave and the grain of the wood.`

### Images de départ et posters (16:9)
- **P01-d** (réf. A02) : `Seen from deep inside a dim lime-plastered room, a pair of tall weathered ivory French windows stands half open; through the gap, a calm grey-blue sea meets a hazy horizon; a sheer linen curtain lifts slightly; warm low sunlight draws a long stripe across a terracotta tile floor; the left third of the room stays in soft shadow.`
- **P02-d** (réf. A01) : `An old country house wall of deep ochre lime plaster seen at an angle, a single arched doorway framed in pale stone with its weathered wooden door left ajar, climbing jasmine and a potted lemon tree beside it, dappled afternoon light through olive leaves.`
- **P03-d** : `The varnished wooden deck of a small classic boat moored at a quiet stone jetty at dawn, a neatly folded cream canvas cover and a coiled rope on the deck, still dark-green water, soft mist on the far shore, no buildings in view.`
- **P04-d** (réf. A02) : `The elegant, well-kept hands of an elderly woman wearing a simple gold ring rest on an open hardback book on a linen-covered table, beside a white porcelain cup; the edge of a muted ochre silk scarf; soft window light from the side.`
  - *Variante visage `[À VALIDER]`* : `Seen from behind and slightly to the side, an elegant elderly woman with short silver hair and a camel cashmere cardigan stands upright at an open window, looking out at a garden in soft morning light, poised and unhurried.`
- **P05-d** : `A long linen-covered table in a shaded garden at golden hour, framed at chest height so only arms and hands are in view, passing ceramic dishes of fresh vegetables and herbs, water glasses catching the light, dappled pine shade.`
- **P06-d** (réf. A03) : `Close-up on a sunlit wooden table: a small child's hand places a sprig of rosemary into a clear glass vase while an adult's hand gently steadies it, a folded linen napkin and a white porcelain cup nearby.`
- **P07-d** (réf. A01) : `Early-morning mist drifting over a still lake ringed by low wooded hills, a line of poplars and a single pale stone house far away on the shore, soft silvery light, seen at eye level.`
- **P08-d** (réf. A01) : `A heavy old wooden gate set in a dry-stone wall stands slightly open onto a sunlit garden, jasmine spilling over the top of the wall, the setting sun warming the stones to orange, long soft shadows on the path.`

### Versions mobiles 4:5 (`nano_banana_pro`, `--resolution 4k`, image de référence = Pxx-d)
Même description que la version 16:9, suivie de : `Vertical 4:5 composition of the same scene, main subject in the upper two thirds, calm empty space at the bottom.` Pour **P06b** : `A small hand-knitted cream cardigan hanging on the back of a wooden chair, an open picture book with plain illustrations and no lettering on a linen-covered bed, a garden with an olive tree beyond the tall window.`

### Détails P09 (1:1, réf. A03)
`Close-up of [linen weave | olive-wood grain | glazed terracotta | the rim of white porcelain | aged brass | limestone surface] in warm raking light, shallow depth of field.`

### Vidéos (`kling3_0 --mode pro --duration 8 --sound off --aspect_ratio 16:9`)

| ID | Images | Prompt de mouvement |
|---|---|---|
| V01 (boucle) | `--start-image P01-d --end-image P01-d` | `Static camera. The linen curtain breathes slowly in and out with the breeze, the stripe of sunlight shimmers softly on the floor and the sea surface moves very slightly. Everything else stays still.` |
| V01-s (scrub, option) | `--start-image P01-d` | `A very slow, steady push-in from the back of the room toward the half-open window and the sea, perfectly smooth, no other movement.` |
| V02 | `--start-image P02-d --end-image P02-d` | `Static camera. Olive-leaf shadows slide slowly across the ochre plaster and the jasmine trembles in a light breeze; the door stays still.` |
| V03 (scrub) | `--start-image P03-d` | `A slow, smooth forward glide along the varnished deck toward the misty water, a single continuous camera move, gentle ripples on the water.` |
| V04 | `--start-image P04-d --end-image P04-d` | `Static camera. Thin steam rises from the porcelain cup and the window light breathes softly across the table; the hands rest calmly, barely moving.` |
| V05 (boucle en post) | `--start-image P05-d` | `A slow lateral glide along the table as hands pass a ceramic dish from one side to the other, unhurried, light flickering through the pine shade.` |
| V06 | `--start-image P06-d --end-image P06-d` | `Static camera with a gentle focus pull from the porcelain cup to the vase; the rosemary sprig settles into the water; minimal, natural hand movement.` |
| V07 (scrub) | `--start-image P07-d` | `A very slow forward drift at eye level over the still water toward the far shore, mist curling gently, one continuous move.` |
| V08 | `--start-image P08-d --end-image P08-d` | `Static camera. The low sunlight slides slowly across the stones and jasmine petals tremble in a light breeze; the gate stays slightly open.` |

### Commandes CLI (modèles ; à lancer par Sady ou avec son accord explicite)
```bash
# 1. Coût (ne consomme rien)
higgsfield generate cost soul_cinematic --prompt "<STYLE_ANCHOR>, <scène>. <QUALITY_GUARD>" --aspect_ratio 16:9 --quality 2k --image media-incoming/A02-interieur.png
# 2. Brouillon d'image
higgsfield generate create soul_cinematic --prompt "…" --aspect_ratio 16:9 --quality 2k --image media-incoming/A02-interieur.png --wait
# 3. Upscale du brouillon retenu
higgsfield generate create bytedance_image_upscale --image media-incoming/P01-d.png --resolution 4k --wait
# 4. Vidéo en boucle native
higgsfield generate create kling3_0 --prompt "<mouvement>" --start-image media-incoming/P01-d.png --end-image media-incoming/P01-d.png --duration 8 --mode pro --sound off --aspect_ratio 16:9 --wait
```

---

## 5. Plan de lots et budget

Le brief demande « style sheet → validation Cat → V01-V03 → P01-P03 → reste » mais aussi « image d'abord, vidéo ensuite » (§4.3, §6). Les deux se concilient : **dans chaque scène, l'image Pxx-d précède la vidéo Vxx**.

| Lot | Contenu | Crédits estimés | Validation |
|---|---|---|---|
| Lot | Contenu | Détail du calcul | Crédits estimés | Validation |
|---|---|---|---|---|
| 0 | A01-A03 ; comparaison `STYLE_ANCHOR` v1 / v1.1 | 30 brouillons × 0,12 + 3 upscales × ~4 | ~16 | Sady, puis **Cat** (porte d'entrée de tout le reste) |
| 1 | S1-S3 : P01-d, P02-d, P03-d → V01, V02, V03 (2 prises) → P01-m, P02-m, P03-m | 30 × 0,12 + 3 × 4 + 6 × 12 + 3 × 4 | ~100 | Sady, puis Cat |
| 2 | S4-S7 : P04-d à P08-d → V04 (2 prises), V05 à V08 (1 prise) → P04-m à P08-m | 50 × 0,12 + 5 × 4 + 6 × 12 + 5 × 4 | ~118 | Sady, puis Cat |
| 3 | P09 (6 détails), P06b si retenue | 30 × 0,12 + 6 × 4 + 4 | ~32 | Sady |
| **Total** | | | **~266 sur 278,88** | |

**Le budget est juste** : environ 13 crédits de marge, et **deux prises pour toutes les vidéos coûteraient 48 crédits de plus** (total ~314). Recommandation : une recharge d'environ 100 crédits avant le lot 2. Le coût de l'upscale (compté ~4 ici) sera mesuré au lot 0 avec `generate cost` sur le premier brouillon.

---

## 6. Contrôle qualité (brief §8, à cocher par asset)

`[ ]` mains · `[ ]` visages · `[ ]` architecture et objets sans élément qui fond ni texte parasite · `[ ]` palette conforme (aucun bleu saturé), grain homogène · `[ ]` mouvement lent, continu, sans dérive ni scintillement · `[ ]` raccord de boucle invisible (SSIM ≥ 0,99, voir `docs/media-pipeline.md` §5.4) · `[ ]` lieu non identifiable, ni logo, ni marque, ni écran · `[ ]` aucune ressemblance avec une image du moodboard ou une personne réelle · `[ ]` audio supprimé, poids et résolution respectés · `[ ]` validé Sady · `[ ]` validé Cat.

---

## 7. Journal de génération

Une ligne par génération, **y compris les prises écartées** (traçabilité, provenance, transparence IA).

| Date | ID | Outil | Modèle | Paramètres | Graine | Bloc style | Prompt exact (ou lien) | Job ID | Crédits | Prise retenue | Statut | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | |
