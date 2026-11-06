# Manifeste des assets IA — Maison Triona

> **Statut** : v1.1 (15/10/2026). Lot 0 en cours : passe 1 faite (12 brouillons, journal §7). Source : `docs/assets-ia-brief.md` (brief de Sady), `docs/ux-entry-i18n-a11y.md` (spec d'entrée, prioritaire), style bible figée dans `docs/art-direction.md` §6.
> **Mis à jour par** : l'agent `media-producer` à chaque génération, validation ou intégration.
> **Statuts** : `à générer` → `généré` → `validé Sady` → `validé Cat` → `intégré`.

---

## 0. Capacités Higgsfield réellement disponibles (vérifiées le 15/10/2026)

Vérifié par la CLI officielle (`@higgsfield/cli` 1.1.26, connectée au workspace « Private », **offre starter, 278,88 crédits**) et par les réponses de Sady (image → vidéo, référence de style, upscale, 1080p natif). Aucun job créé ; les coûts viennent de `higgsfield generate cost`, qui ne consomme rien.

| Besoin | Modèle retenu (ID CLI) | Paramètres utiles | Coût estimé |
|---|---|---|---|
| Brouillons d'images, personnes / plans cinéma | `soul_cinematic` | `--aspect_ratio` 16:9, 3:4, 1:1… (**pas de 4:5**) · `--quality 2k` (= 1080p réel) · 1 image de référence | **0,12** crédit |
| Brouillons d'images, lieux sans personne | `soul_location` | `--aspect_ratio` seulement (pas de qualité, **pas d'image de référence**) | **0,12** |
| Images finales ≥ 2 400 px | `bytedance_image_upscale` (`--resolution 4k`) sur le brouillon retenu, **ou** `nano_banana_pro` (`--resolution 4k`, 4:5 natif, jusqu'à 14 images de référence) | — | upscale 4k : **2** (mesuré le 15/10/2026 sur une image neutre 16:9 et 1:1) · Nano Banana Pro 4k : **4** |
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

### `QUALITY_GUARD_EMPTY` v1 (proposé après la passe 1 du lot 0, scènes sans personne)
Constat du 15/10/2026 : avec `QUALITY_GUARD` v1, qui parle de mains et de personnes, Soul ajoute des personnes dans 11 brouillons sur 12, même quand la scène n'en décrit aucune. Pour les ancres, les lieux et les natures mortes :
```
an unoccupied, quiet scene, empty of people, with no figures, hands or silhouettes anywhere in the frame;
plain unmarked surfaces and objects; soft diffused light; gentle, desaturated colour;
timeless setting with nothing modern or electronic in view
```
`QUALITY_GUARD` v1 reste réservé aux scènes **avec** des personnes ou des mains (P04, P05, P06, V04 à V06).

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
| A01 | Extérieur lumineux | Image | 16:9 | `soul_location` → upscale 4k | **validé Sady**, upscalé 4k (v1.1-p1)  ; **validé Cat** (D20) | `media-incoming/A01-exterieur.png` | Référence de style pour V02, V07, V08 |
| A02 | Intérieur sombre à fenêtre | Image | 16:9 | `soul_cinematic` → upscale 4k | **validé Sady**, upscalé 4k (v1.1-vide-p2)  ; **validé Cat** (D20) | `media-incoming/A02-interieur.png` | Référence pour V01, V04 |
| A03 | Détail de matière | Image | 1:1 | `soul_cinematic` → upscale 4k | **validé Sady**, upscalé 4k (v1-vide-p2)  ; **validé Cat** (D20) | `media-incoming/A03-matiere.png` | Référence pour P09, V06 |

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
| P01-d | Poster V01, image de départ | — | 16:9 | `soul_cinematic` (sans référence) → upscale 4k | **généré**, choisi (D21), à montrer à Sady | `public/media/seuil/P01-fenetre-mer` |
| P01-m | Hero mobile | — | 4:5 | recadrage 4:5 de P01-d (Nano Banana Pro 4k réservé à l'offre Pro) | **généré** | `public/media/seuil/P01-fenetre-mer-m` |
| P02-d / P02-m | Poster V02 / mobile | — | 16:9 / 4:5 | `soul_cinematic` (réf. A01) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/maison/P02-porte-ocre[-m]` |
| P03-d / P03-m | Poster V03 / mobile | **Choix 1** | 16:9 / 4:5 | `soul_cinematic` (réf. A01) → upscale ; Nano Banana Pro 4:5 | à générer | `public/media/conciergerie/P03-bateau-quai[-m]` |
| P04-d / P04-m | Poster V04 / mobile | **Choix 2** | 16:9 / 4:5 | `soul_cinematic` (sans référence) → upscale ; 4:5 recadré | **généré** : prise p4 retenue, upscalée 4k (`media-incoming/lot2/upscale/P04-d.png`, non étalonnée) ; lot 2 interrompu | `public/media/grand-age/P04-mains-livre[-m]` |
| P05-d / P05-m | Poster V05 / mobile | **Choix 3** | 16:9 / 4:5 | `soul_cinematic` (sans référence) → upscale ; 4:5 recadré | brouillons générés, prise p1 choisie, **non upscalée** (lot 2 interrompu) | `public/media/enfants/P05-table-partagee[-m]` |
| P06-d / P06-m | Poster V06 / mobile (**visuel principal S5**) | **Choix 3** | 16:9 / 4:5 | `soul_cinematic` (sans référence) → upscale ; 4:5 recadré | brouillons générés, prise p4 choisie, **non upscalée** (lot 2 interrompu) | `public/media/enfants/P06-mains-romarin[-m]` |
| P06b | Option : détail « enfants » sans enfant visible | **Choix 3** | 4:5 | `nano_banana_pro` 4k | à décider | `public/media/enfants/P06b-cardigan-livre` |
| P07-d / P07-m | Poster V07 / mobile | — | 16:9 / 4:5 | `soul_cinematic` (sans référence) → upscale ; 4:5 recadré | brouillons générés, prise p3 choisie, **non upscalée** (lot 2 interrompu) | `public/media/territoires/P07-brume-lac[-m]` |
| P08-d / P08-m | Poster V08 / mobile | **Choix 4** | 16:9 / 4:5 | `soul_cinematic` (sans référence) → upscale ; 4:5 recadré | brouillons générés, prise p2 choisie, **non upscalée** (lot 2 interrompu) | `public/media/contact/P08-portail[-m]` |
| P09-1 à 6 | Détails et textures | — | 1:1 | `soul_cinematic` (sans référence) → upscale | brouillons générés (24) ; prises choisies pour olivier, terre cuite, porcelaine, laiton (faible), calcaire ; **lin : aucune prise acceptable** ; aucune upscalée (lot 2 interrompu) | `public/media/details/P09-{lin,olivier,terre-cuite,porcelaine,laiton,calcaire}` |
| P10 | Image de partage (OG) | — | 1200 × 630 | **non générée** : composition en code sur recadrage de P01-d | phase 1 | `public/brand/og-{fr,en}.png` |

Exports de chaque photo : AVIF puis WebP, largeurs 640 · 828 · 1080 · 1280 · 1920 · 2400 (selon l'usage).

### 3.4 Couverture des destinations (contrôle de la spec d'entrée §6)

| Choix | Destination | Vidéo desktop | Photo mobile | OK |
|---|---|---|---|---|
| 1 · Organiser le quotidien | `#conciergerie` · `/services/conciergerie` | V03 | P03-m | ✅ |
| 2 · Accompagner un proche, ou vous-même | `#grand-age` · `/services/grand-age` | V04 | P04-m | ✅ |
| 3 · Veiller sur les enfants | `#enfants` · `/services/enfants` | V06 (+ V05) | P06-m (+ P05-m, option P06b) | ✅ (message à confirmer) |
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
- **P02-d** (réf. A01, via `soul_cinematic`) : `An old country house wall of deep ochre lime plaster seen at an angle, a single arched doorway framed in pale stone with its weathered wooden door left ajar, climbing jasmine and a potted lemon tree beside it, dappled afternoon light through olive leaves.`
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
| V01-s (scrub, **obligatoire depuis D19**) | `--start-image P01-d` | `A very slow, steady push-in from the back of the room toward the half-open window and the sea, perfectly smooth, no other movement.` |
| V02 | `--start-image P02-d --end-image P02-d` | `Static camera. Olive-leaf shadows slide slowly across the ochre plaster and the jasmine trembles in a light breeze; the door stays still.` |
| V03 (scrub) | `--start-image P03-d` | `A slow, smooth forward glide along the varnished deck toward the misty water, a single continuous camera move, gentle ripples on the water.` |
| V04 | `--start-image P04-d --end-image P04-d` | `Static camera. Thin steam rises from the porcelain cup and the window light breathes softly across the table; the hands rest calmly, barely moving.` |
| V05 (boucle en post) | `--start-image P05-d` | `A slow lateral glide along the table as hands pass a ceramic dish from one side to the other, unhurried, light flickering through the pine shade.` |
| V06 | `--start-image P06-d --end-image P06-d` | `Static camera with a gentle focus pull from the porcelain cup to the vase; the rosemary sprig settles into the water; minimal, natural hand movement.` |
| V07 (scrub) | `--start-image P07-d` | `A very slow forward drift at eye level over the still water toward the far shore, mist curling gently, one continuous move.` |
| V08 | `--start-image P08-d --end-image P08-d` | `Static camera. The low sunlight slides slowly across the stones and jasmine petals tremble in a light breeze; the gate stays slightly open.` |

### Lot 1 · fiches prêtes (préparées le 15/10/2026, **rien n'est lancé** avant la validation de Cat et l'accord de Sady)

Corrections apportées par le lot 0 :
- `soul_location` **n'accepte pas d'image de référence** (vérifié avec `higgsfield model get`) : P02-d et P03-d passent en `soul_cinematic` avec l'ancre A01, comme P01-d avec A02, pour garder un seul étalonnage.
- Scènes **sans personne** (P01-d, P02-d, P03-d) : `QUALITY_GUARD_EMPTY` v1, sinon le modèle ajoute des silhouettes.
- Bloc de style par défaut : `STYLE_ANCHOR` **v1.1** (deux ancres sur trois ; grain plus léger, meilleur pour l'encodage).
- Offre starter : **4 jobs simultanés au plus** ; on lance par 3.

| Étape | Asset | Modèle et paramètres | Image | Prises | Coût unitaire (mesuré) | Sous-total |
|---|---|---|---|---|---|---|
| 1 | P01-d (hero, poster et image de départ V01) | `soul_cinematic` 16:9, qualité 2k | `--image media-incoming/A02-interieur.*` | 4 | 0,12 | 0,48 |
| 1 | P02-d (la maison) | `soul_cinematic` 16:9, qualité 2k | `--image media-incoming/A01-exterieur.*` | 4 | 0,12 | 0,48 |
| 1 | P03-d (conciergerie) | `soul_cinematic` 16:9, qualité 2k | `--image media-incoming/A01-exterieur.*` | 4 | 0,12 | 0,48 |
| 2 | Upscale 4k des 3 retenues | `bytedance_image_upscale --resolution 4k` | Pxx-d retenue | 3 | 2 | 6 |
| 3 | V01 boucle, V02 boucle, V03 scrub | `kling3_0 --mode pro --duration 8 --sound off --aspect_ratio 16:9` | `--start-image` (et `--end-image` pour les boucles) = Pxx-d | 2 × 3 | 12 | 72 |
| 3 bis | **V01-s** (avancée vers la fenêtre, scrub, D19) | idem, `--start-image` P01-d seulement | P01-d | 1 | 12 | 12 |
| 4 | P01-m, P02-m, P03-m (mobile 4:5) | `nano_banana_pro --resolution 4k --aspect_ratio 4:5` | `--image` Pxx-d | 3 | 4 | 12 |
| | **Total lot 1** | | | | | **≈ 103,4** |

Chaque étape attend le choix de Sady sur la précédente (brouillons → upscale → vidéo → mobile). Kling en mode `4k` coûterait 48 par clip : non retenu.

Prompts images (`STYLE_ANCHOR` v1.1 + scène + `QUALITY_GUARD_EMPTY` v1) : scènes P01-d, P02-d, P03-d du §4 ci-dessus, inchangées. P01-d garde son **tiers gauche dans l'ombre** (colonne de texte du hero).

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

### Logo « le sillage » · lot L1 (29/10/2026, D48)

Brief de Cat (`docs/reponses-cat-2026-10-26.md`) : un T tracé comme le sillage d'une pirogue, sans le navigateur ; « by K. » petit, en cachet ; couleurs du kit ; jamais une « banane ». Le symbole seul est exploré par l'IA ; le nom est composé ensuite en vraie Cormorant Garamond. Le moodboard logo n'est jamais passé en entrée.

- **Symboles** : `recraft_v4_1 --model_type vector --colors '["#C6A96B"]' --background_color "#26382F" --aspect_ratio 1:1` (SVG natif, 2,5 crédits). Chaque prompt finit par `TAIL` : « Logo symbol for a discreet European luxury house. Flat vector emblem in one single colour, generous negative space, centred and small within the frame. Crisp, taut strokes with fine thick-to-thin contrast, like an engraved Garamond capital. Quiet, restrained, timeless. Symbol only, a single glyph-like mark. »
  - **L1-A** : « A capital letter T drawn as the wake of a pirogue gliding on still water: the crossbar is one fine horizontal stroke like a calm waterline; the stem is formed by two hairline strokes that part slowly downward, like the trace a boat leaves behind. The boat itself is absent, only its elegant trace remains. » + `TAIL`
  - **L1-B** : « Seen from above, the narrow V-shaped wake left behind an unseen boat on calm water, its two fine straight lines and a short central stroke composing a capital letter T. Taut straight lines with a slight calligraphic swell, perfectly symmetrical. » + `TAIL`
  - **L1-C** : « One continuous calligraphic pen stroke that draws a capital letter T: it starts as a fine horizontal crossbar, turns with tension and runs down as the stem, then tapers into a hairline wake on still water. A confident, taut line, like an engraver's signature. » + `TAIL`
  - **L1-D** : « A small round seal: a thin perfect circle enclosing a capital letter T formed by the fine wake of a gliding pirogue on still water, the crossbar a calm waterline, the stem two hairlines parting downward. Engraved, balanced, centred. » + `TAIL`
- **Mises en page avec le nom** : `gpt_image_2_5 --quality medium --resolution 2k --aspect_ratio 16:9 --background opaque` (1 crédit).
  - **L1-G1** : « Brand identity logo lockup on a plain warm ivory background (#F3EDE1). Centred: a small emblem of a capital T drawn as the fine wake of a pirogue gliding on still water, in champagne gold (#C6A96B). Beneath it, the name "Maison Triona" in an elegant high-contrast Garamond serif in the style of Cormorant Garamond, title case, deep fir green (#26382F), generous letter spacing. Below, much smaller, "by K." in an italic serif, fir green. Flat and vector-like, lots of empty space, quiet luxury, nothing else on the page. »
  - **L1-G2** : « Horizontal logo lockup for a website header on a plain warm ivory background (#F3EDE1): on the left a small champagne gold (#C6A96B) emblem, a capital T drawn as the fine wake of a pirogue gliding on still water; to its right the words "MAISON TRIONA" in letter-spaced high-contrast Garamond capitals, deep fir green (#26382F); a very small "by K." in an italic serif just after the name. Flat and vector-like, thin and refined, lots of empty space, nothing else on the page. »

---

## 5. Plan de lots et budget

Le brief demande « style sheet → validation Cat → V01-V03 → P01-P03 → reste » mais aussi « image d'abord, vidéo ensuite » (§4.3, §6). Les deux se concilient : **dans chaque scène, l'image Pxx-d précède la vidéo Vxx**.

| Lot | Contenu | Crédits estimés | Validation |
|---|---|---|---|
| Lot | Contenu | Détail du calcul | Crédits estimés | Validation |
|---|---|---|---|---|
| 0 | A01-A03 ; comparaison `STYLE_ANCHOR` v1 / v1.1 | passe 1 : 12 brouillons × 0,12 ; passe 2 éventuelle : 12 × 0,12 ; 3 upscales × 2 | ~9 | Sady, puis **Cat** (porte d'entrée de tout le reste) |
| 1 | S1-S3 : P01-d, P02-d, P03-d → V01, V02, V03 (2 prises) → P01-m, P02-m, P03-m | 30 × 0,12 + 3 × 2 + 6 × 12 + 3 × 4 | ~94 | Sady, puis Cat |
| 2 | S4-S7 : P04-d à P08-d → V04 (2 prises), V05 à V08 (1 prise) → P04-m à P08-m | 50 × 0,12 + 5 × 2 + 6 × 12 + 5 × 4 | ~108 | Sady, puis Cat |
| 3 | P09 (6 détails), P06b si retenue | 30 × 0,12 + 6 × 2 + 4 | ~20 | Sady |
| **Total** | | | **~231 sur 278,88** | |

**Coûts remesurés le 15/10/2026** (`generate cost`, sans rien consommer) : brouillon Soul 0,12 ; upscale 4k **2** (et non ~4) ; Nano Banana Pro 4k 4 ; Kling 3.0 pro 8 s 12. Marge d'environ **48 crédits** : deux prises pour toutes les vidéos (+48) tiendraient tout juste. Une recharge reste conseillée avant le lot 2 si les reprises se multiplient.

---

## 6. Contrôle qualité (brief §8, à cocher par asset)

`[ ]` mains · `[ ]` visages · `[ ]` architecture et objets sans élément qui fond ni texte parasite · `[ ]` palette conforme (aucun bleu saturé), grain homogène · `[ ]` mouvement lent, continu, sans dérive ni scintillement · `[ ]` raccord de boucle invisible (SSIM ≥ 0,99, voir `docs/media-pipeline.md` §5.4) · `[ ]` lieu non identifiable, ni logo, ni marque, ni écran · `[ ]` aucune ressemblance avec une image du moodboard ou une personne réelle · `[ ]` audio supprimé, poids et résolution respectés · `[ ]` validé Sady · `[ ]` validé Cat.

---

## 7. Journal de génération

Une ligne par génération, **y compris les prises écartées** (traçabilité, provenance, transparence IA).

| Date | ID | Outil | Modèle | Paramètres | Graine | Bloc style | Prompt exact (ou lien) | Job ID | Crédits | Prise retenue | Statut | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 772209 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A01 (§4) + `QUALITY_GUARD` v1 | `dad3d934-390c-49a3-aa03-1f8c45af42b5` | 0,12 | non | écartée | deux femmes ajoutées, fleurs rouges et jaunes saturées, verre de vin |
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 910151 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A01 (§4) + `QUALITY_GUARD` v1 | `cee4ae9e-225b-4144-ba9c-d9283f3d386b` | 0,12 | non | écartée | mur de pierre sèche, oliveraie, cyprès : très juste, mais silhouettes au fond |
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 305515 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A01 (§4) + `QUALITY_GUARD` v1 | `f5ad7374-bcc7-4ebd-b16b-7d16a58b5760` | 0,12 | oui (candidate) | candidate | mur de calcaire, olivier, cyprès, gravier, aucune personne ; ciel un peu pâle |
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 704303 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A01 (§4) + `QUALITY_GUARD` v1 | `f470736d-c5bc-4a26-9ee9-322aaa81fc04` | 0,12 | non | écartée | architecture trop moderne (règle §6.7) |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 420227 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A02 (§4) + `QUALITY_GUARD` v1 | `37be0176-34b7-4b3d-90c5-257798f76eb8` | 0,12 | non | écartée | main sur le fauteuil et silhouette à gauche |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 941907 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A02 (§4) + `QUALITY_GUARD` v1 | `d67157b0-9204-46fc-b2d3-5569f0e8d9e4` | 0,12 | non | écartée | mains au premier plan ; fenêtre et fauteuil justes |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 432480 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A02 (§4) + `QUALITY_GUARD` v1 | `9378e902-6a48-4431-8edb-f807f5e780ff` | 0,12 | non | écartée | personne allongée |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 186002 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A02 (§4) + `QUALITY_GUARD` v1 | `fb108d51-b7ff-4fa0-a9a0-d7ab671eb17d` | 0,12 | non | écartée | visage flou au premier plan |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 381144 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A03 (§4) + `QUALITY_GUARD` v1 | `b97e26e8-c8a4-423e-aa1b-06cff7d229df` | 0,12 | non | écartée | mains posées sur le lin ; lumière et matière excellentes |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 831969 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A03 (§4) + `QUALITY_GUARD` v1 | `b0ca9526-78a4-44d5-beaa-4021338220ce` | 0,12 | non | écartée | bras et buste |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 958868 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A03 (§4) + `QUALITY_GUARD` v1 | `ccd41917-28fe-437e-a34c-c7b3d0b9e884` | 0,12 | non | écartée | mains et buste |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 612878 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A03 (§4) + `QUALITY_GUARD` v1 | `94dd4c28-c2ce-46f3-b7e0-06fc38c82bfc` | 0,12 | non | écartée | main sur le bord de la table |
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 338687 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A01 (§4) + `QUALITY_GUARD_EMPTY` v1 | `36bd7cb3-c110-42e1-92a1-f20692254ee4` | 0,12 | non | écartée | mur de pierre, cyprès, olivier, mais palmier et pénombre |
| 15/10/2026 | A01 | Higgsfield CLI 1.1.26 | `soul_location` | 16:9, 2048 × 1152 | 585664 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A01 (§4) + `QUALITY_GUARD_EMPTY` v1 | `1b6ab81f-0909-4f57-8b21-ebb340062119` | 0,12 | non | écartée | mur ocre lisse, architecture trop moderne |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 595584 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A02 (§4) + `QUALITY_GUARD_EMPTY` v1 | `1bb54336-14b4-4fe7-b111-6c5c7192740e` | 0,12 | non | écartée | pièce vide juste, fauteuil housse, mais composition sombre et fermée |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 450836 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A02 (§4) + `QUALITY_GUARD_EMPTY` v1 | `d6aa7669-85da-452a-ad4a-99a3323372e7` | 0,12 | non | écartée | fauteuil et fenêtre à volets, plat |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 374010 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A02 (§4) + `QUALITY_GUARD_EMPTY` v1 | `c40982a7-bee3-4999-be85-71c1c2e24174` | 0,12 | non | écartée | cheminée et objet décoratif, bleu de fenêtre |
| 15/10/2026 | A02 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152 | 42904 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A02 (§4) + `QUALITY_GUARD_EMPTY` v1 | `2fe6e36e-4fe6-409a-8829-2ba6e36ddccc` | 0,12 | oui (candidate) | candidate | pénombre, porte-fenêtre, tomettes, fauteuil housse ; petit objet au mur à droite |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 127379 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A03 (§4) + `QUALITY_GUARD_EMPTY` v1 | `0974a053-e431-4934-9d2d-4e646c87a8fb` | 0,12 | non | seconde | lin et bord de bol, lumière rasante, très juste |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 639154 | `STYLE_ANCHOR` v1 | `STYLE_ANCHOR` v1 + scène A03 (§4) + `QUALITY_GUARD_EMPTY` v1 | `3b51337a-4e8e-43e3-99cd-7b161bed7040` | 0,12 | oui (candidate) | candidate | lin sur le bord de la table, bol de porcelaine ; bois plutôt chêne qu'olivier |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 895238 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A03 (§4) + `QUALITY_GUARD_EMPTY` v1 | `8b7d9cb1-cf59-4ccf-8370-76f64d811c3b` | 0,12 | non | écartée | tasse haute, composition posée |
| 15/10/2026 | A03 | Higgsfield CLI 1.1.26 | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048 | 553608 | `STYLE_ANCHOR` v1.1 | `STYLE_ANCHOR` v1.1 + scène A03 (§4) + `QUALITY_GUARD_EMPTY` v1 | `d8d2d4e4-47e3-4b8f-a40d-ceed06a520c5` | 0,12 | non | écartée | angle rouge saturé en bas à droite |
| 15/10/2026 | P01-d, P02-d, P03-d | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, **avec** ancre en référence (A02 pour P01, A01 pour P02 et P03) | — | `STYLE_ANCHOR` v1.1 | + scène (§4) + `QUALITY_GUARD_EMPTY` v1 | 12 jobs | 12 × 0,12 | non | **écartées** | La référence Soul **recopie le contenu de l'ancre** (pièce au fauteuil, mur au cyprès) au lieu de la scène ; personnes et une main ajoutées |
| 15/10/2026 | P01-d, P02-d, P03-d | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, **sans** référence | — | `STYLE_ANCHOR` v1.1 | + scène (§4) + `QUALITY_GUARD_EMPTY` v1 ; P01-d : « tiers bas calme » (D19) | 12 jobs | 12 × 0,12 | P01-d p2, P02-d p2, P03-d p1 | **retenues (D21)** | P01-d : porte-fenêtre, rideau, mer, rai de soleil ; P02-d : porte entrouverte, **interrupteur effacé par retouche locale** (copie du mur voisin) ; P03-d : pont verni, cordage, quai (quelques maisons minuscules au loin, non identifiables) |
| 15/10/2026 | P01-d, P02-d, P03-d | Higgsfield CLI 1.1.26 | `bytedance_image_upscale` 4k | via `upload create` puis `--image <id>` | — | — | — | `68f58803…` (P01), `4138857d…` (P02, 2ᵉ essai ; le 1ᵉʳ `e74cabf7…` a échoué, non facturé), `78eb2f01…` (P03) | 3 × 2 | — | 4096 × 2304 | `media-incoming/lot1/P0x-d.png` |
| 15/10/2026 | P01-m, P02-m, P03-m | ImageMagick (local) | recadrage 4:5 | 1843 × 2304 dans Pxx-d | — | — | — | — | 0 | — | 4:5 | **Nano Banana Pro 4k exige l'offre Pro** (refus à la création, non facturé, alors que `generate cost` l'estimait à 4) : versions mobiles recadrées dans les upscales, centrées sur le sujet |
| 15/10/2026 | V01 à V03 | Higgsfield CLI 1.1.26 | `kling3_0` **pro** | 8 s, sans son, 16:9 | — | — | mouvements du §4 | 7 créations refusées | 0 | — | **refusées** | « Pro or Ultimate plan required » : l'offre starter refuse le mode pro (D24) |
| 15/10/2026 | V01 | Higgsfield CLI 1.1.26 | `kling3_0` **std** | 8 s, sans son, 16:9, début = fin = P01-d | — | — | mouvement V01 (§4) | `55da8fd9-9fa8-49b8-a4cf-6200374d4df5` | 10 | oui | **intégrée** | 1280 × 720, 24 i/s ; boucle par fondu de 1 s (SSIM 0,96 → 0,995) ; `public/media/seuil/V01-fenetre-mer.{mp4,webm}` 1 028 / 601 ko |
| 15/10/2026 | V01-s | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, début = P01-d | — | — | mouvement V01-s (§4) | `6c736626-d5f8-431e-b7b3-e7046cc89d0e` | 10 | oui | **intégrée** | Avancée vers la fenêtre ; toutes images clés ; `public/media/seuil/V01-s-fenetre-mer-scrub.mp4` 3 129 ko (M15) |
| 15/10/2026 | V02 | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, début = fin = P02-d | — | — | mouvement V02 (§4) | `7b91ab53-ca4c-4149-9eb8-2bb93735d637` | 10 | oui | **intégrée** | Boucle par fondu (SSIM 0,98 → 0,992) ; `public/media/maison/V02-porte-ocre.{mp4,webm}` 1 305 / 781 ko |
| 15/10/2026 | V03 | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, début = P03-d | — | — | mouvement V03 (§4) | `506ac662-7390-4355-95de-c932ebb01f1c` | 10 | oui | **intégrée, puis retirée de S3** (720p trop agrandie en demi-largeur ; P03 fixe en attendant la décision de Sady) | Le mouvement dépasse le bateau : **coupé à 5,4 s** ; toutes images clés ; `public/media/conciergerie/V03-bateau-quai-scrub.mp4` 2 130 ko |
| 15/10/2026 | P04-d | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, 2048 × 1152, sans référence | 352856 | `STYLE_ANCHOR` v1.1 | + scène P04 (§4) + cadrage ajouté (note) + `QUALITY_GUARD` v1 | `b7117a5d-cc1f-4db5-adef-f1f48ae4453b` | 0,12 | non | écartée | Phrase ajoutée à la scène P04 pour exclure tout visage (lot 2) : « Close-up framed at table height, so only her hands, wrists, the book and the cup are in view. » Prise : main levée au-dessus du livre, tranche rouge saturée |
| 15/10/2026 | P04-d | idem | `soul_cinematic` | idem | 528244 | v1.1 | idem | `d82d4059-520b-42e3-9786-2f99f5cd24b9` | 0,12 | non | seconde | deux mains justes, foulard ocre ; manche bleue, pseudo-texte lisible comme des lignes sur la page, tasse coupée |
| 15/10/2026 | P04-d | idem | `soul_cinematic` | idem | 960676 | v1.1 | idem | `01dbb90d-649e-4d54-acbe-4c7b23f1b4c5` | 0,12 | non | écartée | mains plausibles, lumière froide et plate, page couverte de pseudo-texte |
| 15/10/2026 | P04-d | idem | `soul_cinematic` | idem | 25975 | v1.1 | idem | `c56bd11e-6db4-4ef4-aa43-013d183a71ba` | 0,12 | **oui** | retenue | mains au repos, bague, tasse nette (vapeur de V04), aucun visage ; fond sarcelle ramené au vert-gris par l'étalonnage (saturation HSL moyenne 0,27 → 0,22) |
| 15/10/2026 | P05-d | idem | `soul_cinematic` | 16:9, qualité 2k, sans référence | 207379 | v1.1 | + scène P05 (§4) + `QUALITY_GUARD` v1 | `c9f51dae-cfaa-47f1-bace-fc45e7ab45b2` | 0,12 | **oui** | retenue (non upscalée) | deux personnes dressent la table, mains naturelles, lumière dorée dans les pins ; quelques cheveux en haut à gauche (aucun visage) |
| 15/10/2026 | P05-d | idem | `soul_cinematic` | idem | 506073 | v1.1 | idem | `371db833-7b20-470d-9a9f-48db16ce0986` | 0,12 | non | écartée | manche bleue saturée au bord droit, montre, pastèque et poivron rouges |
| 15/10/2026 | P05-d | idem | `soul_cinematic` | idem | 562569 | v1.1 | idem | `869c220b-0cdf-4a8c-b469-140f953bfa7d` | 0,12 | non | écartée | très belle lumière, mais main floue au premier plan et bras d'attribution ambiguë |
| 15/10/2026 | P05-d | idem | `soul_cinematic` | idem | 225829 | v1.1 | idem | `f8a2af3b-e61e-49a6-b16c-03565ddcfed5` | 0,12 | non | seconde | poing fermé avec bague, fond sombre, moins chaud |
| 15/10/2026 | P06-d | idem | `soul_cinematic` | 16:9, qualité 2k, sans référence | 285098 | v1.1 | + scène P06 (§4) + `QUALITY_GUARD` v1 | `6ce08201-8a23-4682-8566-9d86ff9d70a2` | 0,12 | non | écartée | buste d'enfant visible (sans visage), coins noirs arrondis, torchon à rayures bleues |
| 15/10/2026 | P06-d | idem | `soul_cinematic` | idem | 188343 | v1.1 | idem | `9238951f-f33d-469e-bec1-e48606129853` | 0,12 | non | écartée | la main « d'enfant » se lit comme une main d'adulte |
| 15/10/2026 | P06-d | idem | `soul_cinematic` | idem | 29843 | v1.1 | idem | `ab45e545-39ab-47a4-8174-eda98b9cb221` | 0,12 | non | seconde | main de jeune enfant très lisible, lumière dorée ; mains un peu floues, rouleau bleu marine au premier plan |
| 15/10/2026 | P06-d | idem | `soul_cinematic` | idem | 507900 | v1.1 | idem | `9b152d0d-608e-4f9b-a85a-00109501cbf0` | 0,12 | **oui** | retenue (non upscalée) | petite main qui pince le romarin, main d'adulte qui tient le verre, tasse au premier plan ; mains nettes ; avant-bras long (enfant de 8-10 ans plutôt que tout-petit) ; fond gris-bleu sourd |
| 15/10/2026 | P07-d | idem | `soul_cinematic` | 16:9, qualité 2k, sans référence | 494700 | v1.1 | + scène P07 (§4) + `QUALITY_GUARD_EMPTY` v1 | `47bf2e8c-aecc-4ea7-befe-b834cb33d50d` | 0,12 | non | écartée | rangée de cyprès, grande bâtisse, sommet : cliché toscan (§2) |
| 15/10/2026 | P07-d | idem | `soul_cinematic` | idem | 567909 | v1.1 | idem | `05f5f022-eed0-4dd3-980c-1f85adfcb5e7` | 0,12 | non | écartée | premier plan orange saturé, bord bleu, objet rond parasite |
| 15/10/2026 | P07-d | idem | `soul_cinematic` | idem | 499609 | v1.1 | idem | `463d66b2-7c42-4f06-b46b-a2ce472e5578` | 0,12 | **oui** | retenue (non upscalée) | brume sur l'eau, collines boisées, roselière, petite maison lointaine, aucun cyprès ; saturation HSL 0,44 → 0,29 après étalonnage |
| 15/10/2026 | P07-d | idem | `soul_cinematic` | idem | 166158 | v1.1 | idem | `04f17122-d4a4-426b-be0e-57082f90bc70` | 0,12 | non | seconde | maison au bord de l'eau, brume, lumière chaude ; petite rangée de cyprès derrière la maison |
| 15/10/2026 | P08-d | idem | `soul_cinematic` | 16:9, qualité 2k, sans référence | 403789 | v1.1 | + scène P08 (§4) + `QUALITY_GUARD_EMPTY` v1 | `667b4abd-012c-406a-91ee-7e013a7de6f6` | 0,12 | non | écartée | porte de maison à panneaux plutôt que portail, ciel gris-sarcelle, lumière plate |
| 15/10/2026 | P08-d | idem | `soul_cinematic` | idem | 517487 | v1.1 | idem | `5a272484-d8c9-472e-992c-7b3586140337` | 0,12 | **oui** | retenue (non upscalée) | portail à deux vantaux entrouvert dans un mur de pierre sèche, jasmin débordant, jardin au soleil, ferrures plausibles |
| 15/10/2026 | P08-d | idem | `soul_cinematic` | idem | 801571 | v1.1 | idem | `81ff7279-610f-4fb0-a085-f7bb9e0eac0c` | 0,12 | non | écartée | image floue, poteau blanc peint |
| 15/10/2026 | P08-d | idem | `soul_cinematic` | idem | 338537 | v1.1 | idem | `d3b98d1a-164b-41ed-8af5-c99b1f27ac19` | 0,12 | non | seconde | portail cintré au couchant, mais murs en pierre de taille, plus sombre |
| 15/10/2026 | P09 lin | idem | `soul_cinematic` | 1:1, qualité 2k, 2048 × 2048, sans référence | 201191 | v1.1 | + « Détails P09 » (§4, `linen weave`) + `QUALITY_GUARD_EMPTY` v1 | `4b375f2f-4e61-4e89-8e85-1e50f2c50486` | 0,12 | non | écartée | aplat beige, aucun tissage visible |
| 15/10/2026 | P09 lin | idem | `soul_cinematic` | idem | 947065 | v1.1 | idem | `a0df3b7b-2fde-4470-8df6-19317da39086` | 0,12 | non | écartée | rebord d'enduit, pas de lin |
| 15/10/2026 | P09 lin | idem | `soul_cinematic` | idem | 666529 | v1.1 | idem | `e0ff0abd-08d2-480d-aba6-727b5c722b61` | 0,12 | non | écartée | jambes nues en arrière-plan |
| 15/10/2026 | P09 lin | idem | `soul_cinematic` | idem | 345610 | v1.1 | idem | `7d83d1a8-4a4f-40d7-a101-e225764c82f0` | 0,12 | non | écartée | main floue à droite. **Aucune prise de lin acceptable**, non relancé |
| 15/10/2026 | P09 olivier | idem | `soul_cinematic` | 1:1, qualité 2k, sans référence | 159313 | v1.1 | + « Détails P09 » (`olive-wood grain`) + `QUALITY_GUARD_EMPTY` v1 | `f0dab13c-ecc7-4ae6-b8df-4ecdfea5325c` | 0,12 | **oui** | retenue (non upscalée) | fil du bois net en lumière rasante ; bois plutôt chêne qu'olivier ; montant sarcelle et lac flou en fond |
| 15/10/2026 | P09 olivier | idem | `soul_cinematic` | idem | 975133 | v1.1 | idem | `9961eee0-29a3-41a1-a54c-8b5783f94580` | 0,12 | non | écartée | cadre noir de film autour de l'image |
| 15/10/2026 | P09 olivier | idem | `soul_cinematic` | idem | 764698 | v1.1 | idem | `3c96f2a2-93a4-43b4-a2bd-c0ea9a971b4e` | 0,12 | non | seconde | planche au fil rosé, arbres en fond |
| 15/10/2026 | P09 olivier | idem | `soul_cinematic` | idem | 340834 | v1.1 | idem | `06b2792c-f62c-4b17-a701-7466f1d3630f` | 0,12 | non | écartée | fil peu visible, forme brune floue en haut à droite |
| 15/10/2026 | P09 terre cuite | idem | `soul_cinematic` | 1:1, qualité 2k, sans référence | 217401 | v1.1 | + « Détails P09 » (`glazed terracotta`) + `QUALITY_GUARD_EMPTY` v1 | `a0e2df57-3663-4fe3-8afd-e404b356836c` | 0,12 | non | écartée | pot conique renversé, composition étrange |
| 15/10/2026 | P09 terre cuite | idem | `soul_cinematic` | idem | 473403 | v1.1 | idem | `485490d7-74a1-4a76-90d0-677cbc0598d8` | 0,12 | non | seconde | petit vase mat sur un rebord, paysage flou |
| 15/10/2026 | P09 terre cuite | idem | `soul_cinematic` | idem | 424932 | v1.1 | idem | `4a340abc-6410-4818-aafb-4f0c30db96c6` | 0,12 | **oui** | retenue (non upscalée) | bol de terre cuite sur surface ivoire, ombre rasante nette ; terre cuite mate, non émaillée |
| 15/10/2026 | P09 terre cuite | idem | `soul_cinematic` | idem | 877425 | v1.1 | idem | `db2bfabd-707c-4396-99b0-5375e9d42d34` | 0,12 | non | écartée | jarre en gros plan, coin inférieur droit assombri |
| 15/10/2026 | P09 porcelaine | idem | `soul_cinematic` | 1:1, qualité 2k, sans référence | 647523 | v1.1 | + « Détails P09 » (`the rim of white porcelain`) + `QUALITY_GUARD_EMPTY` v1 | `55c2c1c2-dad6-4a3b-be1b-27c69fc1377c` | 0,12 | non | seconde | bol blanc au bord net, collines et côte floues en fond |
| 15/10/2026 | P09 porcelaine | idem | `soul_cinematic` | idem | 699225 | v1.1 | idem | `fcdce03d-ddd0-41cd-be09-b6e33216f45b` | 0,12 | **oui** | retenue (non upscalée) | assiette creuse sur rebord ivoire, bord de porcelaine en lumière rasante chaude |
| 15/10/2026 | P09 porcelaine | idem | `soul_cinematic` | idem | 868136 | v1.1 | idem | `2598f462-62c3-4d5e-b5e4-f2345357ba40` | 0,12 | non | écartée | grande forme blanche indistincte |
| 15/10/2026 | P09 porcelaine | idem | `soul_cinematic` | idem | 447679 | v1.1 | idem | `539cfcab-334f-4ae1-9500-15222f6b1e91` | 0,12 | non | écartée | formes brunes floues en haut à droite (silhouette possible) |
| 15/10/2026 | P09 laiton | idem | `soul_cinematic` | 1:1, qualité 2k, sans référence | 155399 | v1.1 | + « Détails P09 » (`aged brass`) + `QUALITY_GUARD_EMPTY` v1 | `e7d46564-26fc-4a11-a1a4-41616958fb60` | 0,12 | non | écartée | petit ornement sur un pilier, murs blancs modernes, coin assombri |
| 15/10/2026 | P09 laiton | idem | `soul_cinematic` | idem | 361832 | v1.1 | idem | `81f527aa-d036-459d-a469-83e36db43fcd` | 0,12 | **oui** (faute de mieux) | retenue (non upscalée) | boîte de laiton patiné **floue** sur table terre cuite, aucune figure |
| 15/10/2026 | P09 laiton | idem | `soul_cinematic` | idem | 893005 | v1.1 | idem | `3093945d-eb9e-49a8-9a31-642b45c3599d` | 0,12 | non | écartée | objet hérissé étrange sur socle carré |
| 15/10/2026 | P09 laiton | idem | `soul_cinematic` | idem | 815897 | v1.1 | idem | `edb43adf-d68f-482d-bf64-ef0f3f33fc88` | 0,12 | non | écartée | pied de coupe net, mais forme verticale couleur chair en fond (silhouette possible) |
| 15/10/2026 | P09 calcaire | idem | `soul_cinematic` | 1:1, qualité 2k, sans référence | 614008 | v1.1 | + « Détails P09 » (`limestone surface`) + `QUALITY_GUARD_EMPTY` v1 | `df5c01ac-5b2b-46ed-8232-5ff848cac5e6` | 0,12 | non | écartée | coins supérieurs arrondis (cadre de film), porte vert sombre |
| 15/10/2026 | P09 calcaire | idem | `soul_cinematic` | idem | 315149 | v1.1 | idem | `38643486-23d4-4a66-8b21-907aba6537e1` | 0,12 | non | écartée | bloc de terre cuite flou, surface floue |
| 15/10/2026 | P09 calcaire | idem | `soul_cinematic` | idem | 414429 | v1.1 | idem | `ec01212a-2ae1-4d5c-994c-a008a1081ff0` | 0,12 | non | écartée | coins arrondis, image entièrement floue |
| 15/10/2026 | P09 calcaire | idem | `soul_cinematic` | idem | 506970 | v1.1 | idem | `9dfd6478-d841-484d-8b74-fa41a2eee6c9` | 0,12 | **oui** | retenue (non upscalée) | bord de bassin en calcaire, lumière rasante ; cyprès et horizon flous en fond |
| 15/10/2026 | P04-d | Higgsfield CLI 1.1.26 | `bytedance_image_upscale` 4k | `upload create` (`6d729681-bb6e-46c9-b38d-cd0b0a13bea3`) puis `--image <id>` | — | — | — | `b59744c5-5aa6-43b3-9da0-b5bb658a20ab` | 2 | — | **upscalé**, 4096 × 2304 | `media-incoming/lot2/upscale/P04-d.png` (brut, non étalonné). La commande `create` est restée bloquée environ 10 min (téléversement 22:31:10, job enregistré 22:41:29) avant de rendre l'identifiant ; facturé une fois (208,08 → 206,08), non relancé |
| 16/10/2026 | V01 (essai d'agrandissement) | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` standard, 1080p, préréglage `aigc` | source `media-incoming/lot1/V01.mp4` (720p brut, avant étalonnage) ; `upload create` (`d57566d4-2a7c-4c02-843a-da81ee7ce101`) puis `--video <id>` | — | — | — | `1e1af39b-ba51-41d4-8e97-20da8d58c395` | **1,61** (estimé à 1 par `generate cost`) | — | **essai, à juger** | 1920 × 1080, 193 images ; netteté (écart type du laplacien) 3,8 → 9,8, conservée après étalonnage commun et encodage deux passes à 2 300 kbit/s (2 148 ko) ; écart moyen d'une image à l'autre multiplié par 4 (0,036 → 0,155) : scintillement possible. Fichiers : `media-incoming/essai-upscale/` (brut, encodé, planches, comparaison côte à côte) |
| 16/10/2026 | P06-d | Higgsfield CLI 1.1.26 | `bytedance_image_upscale` 4k | source `media-incoming/lot2/brouillons/P06-p4.png`, upload `16173829-5b60-4038-bfe4-3080932f4bfd`, 4096 × 2304 | — | — | — | `12b9cd62-cbd8-41b5-8e08-b8b95ca238c4` | 2 | oui | généré | mains cohérentes, grain lissé ; `media-incoming/lot2/upscale/P06-d.png` |
| 16/10/2026 | P07-d | Higgsfield CLI 1.1.26 | `bytedance_image_upscale` 4k | source `media-incoming/lot2/brouillons/P07-p3.png`, upload `4c81597f-160d-4007-be20-a62bd51312af`, 4096 × 2304 | — | — | — | `08cf1e70-5920-4aa1-abd9-2edee620fe7f` | 2 | oui | généré | maison = cabane de bois générique ; `media-incoming/lot2/upscale/P07-d.png` |
| 16/10/2026 | V04 | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, sans son, 16:9, début = fin = P04-d (upload `3b601c3d-5711-44c9-ae20-3ad24151a4fe`) | — | — | `Static camera. Thin steam rises from the porcelain cup and the window light breathes softly across the table; the hands rest calmly, barely moving.` | `ef17999a-d960-46e8-878c-c0190fb403aa` | 10 | oui | généré | 1280 × 720, 193 images ; quasi immobile, vapeur à peine visible ; raccord brut SSIM 0,984 ; `media-incoming/lot2/video/V04-brut.mp4` |
| 16/10/2026 | V06 | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, sans son, 16:9, début = fin = P06-d agrandie (upload `62a7a13b-f228-41f3-9535-23ae4a45285c`) | — | — | `Static camera. The rosemary sprig settles gently into the glass and the warm light shimmers softly through the water; the hands stay almost still, with only minimal, natural movement.` | `8214e387-aa4b-4cc1-bae8-bee6722ff2be` | 10 | oui | généré | prompt adapté (verre et non vase ; mise au point glissée écartée car début = fin) ; mains stables ; raccord brut 0,982 ; `media-incoming/lot2/video/V06-brut.mp4` |
| 16/10/2026 | V01-s | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | 1080p, preset aigc, `--video-references` upload `8c2c22d8-2c1d-435e-8f95-fa3c76b7692b` | — | — | — | `03e0d0f7-66e5-4db0-95dd-8bc89a9f8886` | 1,61 (1 annoncé) | oui | généré | requête enregistrée : vidéo listée deux fois malgré `--video-references` ; `…/upscale-video/V01-s-1080p-brut.mp4` |
| 16/10/2026 | V02 | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | idem, upload `11220bc8-a71a-423a-8a35-28df9f49a373` | — | — | — | `6072115c-bb1e-40eb-a41a-20d6e1addf4d` | 1,61 | oui | généré | bois de la porte un peu sur-accentué ; `…/V02-1080p-brut.mp4` |
| 16/10/2026 | V03 | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | idem, upload `712ff2b3-a92c-4021-b4f1-91584ca1760f` | — | — | — | `a185d903-25db-4f33-af2d-f43ed1ea3cdd` | 1,61 | oui | généré | `…/V03-1080p-brut.mp4` |
| 16/10/2026 | V04 | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | idem, upload `567fb81d-2356-4339-8995-075bda9ee368` | — | — | — | `8e8e04cf-ac9d-41e2-81e8-c17a9cf9a430` | 1,61 | oui | généré | `…/V04-1080p-brut.mp4` |
| 16/10/2026 | V06 | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | idem, upload `e4da1b6c-7f9c-4860-a96c-3a4c2aa90baf` | — | — | — | `19e61f5a-6938-4c6c-b9de-14a1b1292156` | 1,61 | oui | généré | 1re création refusée « rate_limit_reached » (2 agrandissements vidéo simultanés au plus en starter), non facturée ; `…/V06-1080p-brut.mp4` |
| 16/10/2026 | P10-d (plan 01, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « vestibule, porte en bois entrouverte » (`media-incoming/lot3/prompt-P10-porte.txt`) + `QUALITY_GUARD_EMPTY` v1 | `d585f8f6-0861-4d32-8a6d-3312b898f6e3` | 0,12 | non | écartée | p1 : coins arrondis (cadre de film), rai de lumière très beau |
| 16/10/2026 | P10-d (plan 01, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « vestibule, porte en bois entrouverte » (`media-incoming/lot3/prompt-P10-porte.txt`) + `QUALITY_GUARD_EMPTY` v1 | `2645c6a6-8527-4d89-8c7d-92eef443dadd` | 0,12 | non | écartée | p2 : coins arrondis, porte ancienne très forte |
| 16/10/2026 | P10-d (plan 01, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « vestibule, porte en bois entrouverte » (`media-incoming/lot3/prompt-P10-porte.txt`) + `QUALITY_GUARD_EMPTY` v1 | `82dfd898-0581-4716-be39-0982a4e7cd81` | 0,12 | non | écartée | p3 : sol bleu froid |
| 16/10/2026 | P10-d (plan 01, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « vestibule, porte en bois entrouverte » (`media-incoming/lot3/prompt-P10-porte.txt`) + `QUALITY_GUARD_EMPTY` v1 | `129b48b4-27e1-4346-830a-73f403e0dc19` | 0,12 | oui | retenue | p4 : porte double entrouverte dans l'axe, lumière chaude, mur sombre à gauche pour le titre, aucun coin arrondi |
| 16/10/2026 | V10 (plan 01, l'invitation) | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, sans son, 16:9, image de départ P10-p4 seule (upload `cc157005-3cb3-4c0a-98a8-99baf0ac867c`) | — | — | portes qui s'ouvrent, rai qui s'élargit, avancée de deux mètres (`media-incoming/lot3/prompt-V10-mouvement.txt`) | `8a93087e-e81a-44b5-aec0-7c7b2a21666e` | 10 | oui | **APPROUVABLE** (QC V5), à juger par Sady | Mouvement continu, aucun pic ; les portes s'ouvrent jusqu'au jardin ; glissement surtout latéral (pilier qui sort du cadre, escalier révélé par parallaxe), peu d'avancée ; décor stable ; `media-incoming/lot3/video/V10-porte-p1.mp4` |
| 16/10/2026 | V11 (plan 02, le franchissement) | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, sans son, 16:9, image de départ = dernière image de V10 (upload `c6b9d53c-3dac-49d6-9ba3-3350fd856f92`) | — | — | avancée continue à travers les portes jusqu'au jardin (`media-incoming/lot3/prompt-V11-mouvement.txt`) | `e830cbe5-5986-4fa0-80b9-9cb795d7f0c9` | 10 | oui | **APPROUVABLE après correction**, à juger par Sady | Vrai franchissement ; raccord avec V10 à 0,9 niveau ; reflet bleu de 5,8 à 8 s neutralisé à l'étalonnage ; chaîne V10 + V11 de 16 s sans pic à la jointure : `media-incoming/lot3/video/V10-V11-chaine-etalonnee.mp4` |
| 16/10/2026 | P12-d (plan 03, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console, vase vide, main qui tient des fleurs » (`media-incoming/lot3/prompt-P12-geste.txt`) + `QUALITY_GUARD` v1 | `f93d9250-f21d-4312-b160-6b046b0709e9` | 0,12 | oui | retenue | p1 : la main tient les fleurs au-dessus du vase vide : tout le geste reste à faire ; porte ouverte à gauche |
| 16/10/2026 | P12-d (plan 03, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console, vase vide, main qui tient des fleurs » (`media-incoming/lot3/prompt-P12-geste.txt`) + `QUALITY_GUARD` v1 | `04fa885c-ef00-4718-90e9-2021a7d1e5f6` | 0,12 | non | écartée | p2 : manche démesurée qui envahit un tiers du cadre |
| 16/10/2026 | P12-d (plan 03, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console, vase vide, main qui tient des fleurs » (`media-incoming/lot3/prompt-P12-geste.txt`) + `QUALITY_GUARD` v1 | `c51bfdd6-69e8-4a2a-b115-f665f9247c47` | 0,12 | non | écartée | p3 : fleurs déjà dans le vase, geste presque fini |
| 16/10/2026 | P12-d (plan 03, image de départ) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console, vase vide, main qui tient des fleurs » (`media-incoming/lot3/prompt-P12-geste.txt`) + `QUALITY_GUARD` v1 | `5f2be699-708a-414c-898a-6227c12f24a2` | 0,12 | non | seconde | p4 : plus belle lumière dorée et jardin raccord, mais fleurs déjà dans le vase |
| 16/10/2026 | V12 (plan 03, le geste d'accueil) | Higgsfield CLI 1.1.26 | `kling3_0` std | 8 s, sans son, 16:9, image de départ P12-p1 seule (upload `7721cdf0-78f8-47b7-997f-da6c204f2fd6`) | — | — | la main pose les fleurs, lâche, ajuste une tige, ressort ; légère avancée (`media-incoming/lot3/prompt-V12-mouvement.txt`) | `620da715-f8b1-4cc5-9939-6ff9e12ebec9` | 10 | oui | **APPROUVABLE** (QC V5), à juger par Sady | Geste complet de 0 à 7,9 s ; main correcte à 100 % aux instants clés ; aucune main en trop ; zoom 1,00 → 1,30 ; lumière plus froide que V10 et V11 ; `media-incoming/lot3/video/V12-geste-p1.mp4` et `V12-geste-etalonnee.mp4` |
| 16/10/2026 | P13-d (plan 04, conciergerie) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console du vestibule préparée pour l'arrivée des propriétaires » (`media-incoming/lot3/prompt-P13-conciergerie.txt`) + `QUALITY_GUARD_EMPTY` v1 | `a7b972e1-6e66-46aa-b9ac-9cbc3ea25d2c` | 0,12 | oui | retenue | p1 : vraies clés sur leur anneau, paire de gants lisible, carnet sans inscription ; composition frontale, crayon un peu épais |
| 16/10/2026 | P13-d (plan 04, conciergerie) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console du vestibule préparée pour l'arrivée des propriétaires » (`media-incoming/lot3/prompt-P13-conciergerie.txt`) + `QUALITY_GUARD_EMPTY` v1 | `7259d481-fa91-4c5b-8111-c78bdb7469d9` | 0,12 | non | écartée | p2 : bande bleu-vert froide sur le bord gauche, vase aux formes étranges, mur verdâtre |
| 16/10/2026 | P13-d (plan 04, conciergerie) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console du vestibule préparée pour l'arrivée des propriétaires » (`media-incoming/lot3/prompt-P13-conciergerie.txt`) + `QUALITY_GUARD_EMPTY` v1 | `9c2abd8e-e89b-4b22-ab0b-6a92a6c096ea` | 0,12 | non | écartée | p3 : clés en amas, gants froissés en boule |
| 16/10/2026 | P13-d (plan 04, conciergerie) | Higgsfield CLI 1.1.26 | `soul_cinematic` | 16:9, qualité 2k, sans référence | — | `STYLE_ANCHOR` v1.1 | + scène « console du vestibule préparée pour l'arrivée des propriétaires » (`media-incoming/lot3/prompt-P13-conciergerie.txt`) + `QUALITY_GUARD_EMPTY` v1 | `69219e2f-cd3f-4fe9-b383-641ec442124f` | 0,12 | non | écartée | p4 : plus belle lumière (ombre de feuillage), mais à 100 % les clés sont une cordelette nouée et les gants une masse sans doigts |
| 16/10/2026 | P13-d (plan 04, conciergerie) | Higgsfield CLI 1.1.26 | `bytedance_image_upscale` 4k | `upload create` (`b9681e00-8709-47e8-8e0d-9800c0149034`) puis `--image <id>` | — | — | — | `a8784a8d-ee61-45f5-9b2e-76c66950dfb8` | 2 | — | **upscalé**, 4096 × 2304, APPROUVABLE (QC V5), à juger par Sady | Aucun artefact à 100 % ; `media-incoming/lot3/upscale/P13-p1.png` (brut, non étalonné) |
| 22/10/2026 | V10 (plan 01, les portes) | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | 1080p, préréglage `aigc`, `standard`, `--video-references` upload `b3354da5-3aac-4806-ac43-e8a521544196` (sortie Kling brute 720p) | — | — | — | `a6d239e1-485b-4847-a236-56ccab553be6` | 1,61 (1 annoncé) | oui | **APPROUVABLE**, à juger par Sady | 1920 × 1080, 193 images ; netteté (variance du laplacien) 6,7 → 28,8 ; écart d'une image à l'autre + 9 % ; luminance identique ; bois des portes plus net, grain lissé, jardin un peu « peint » par endroits ; `media-incoming/lot3/upscale-video/V10-porte-p1-1080p.mp4` |
| 22/10/2026 | V11 (plan 02, le seuil) | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | 1080p, préréglage `aigc`, `standard`, `--video-references` upload `07a756dd-2496-4c65-a386-5bc252e0cf2f` (sortie Kling brute 720p) | — | — | — | `e64597e9-c2c5-47dd-bc24-22a5aa9e90b9` | 1,61 (1 annoncé) | oui | **APPROUVABLE**, à juger par Sady | idem ; netteté 7,0 → 34,9 ; écart d'une image à l'autre + 9 % ; `…/V11-seuil-p1-1080p.mp4` (n'est plus utilisé par le prototype du 22/10) |
| 22/10/2026 | V12 (plan 03, le geste) | Higgsfield CLI 1.1.26 | `bytedance_video_upscale` | 1080p, préréglage `aigc`, `standard`, `--video-references` upload `2797b3e7-6f96-446f-89f6-2415405b84fd` (sortie Kling brute 720p) | — | — | — | `aec9bb0d-5cb9-4afc-857b-0bf00ac0cc00` | 1,61 | oui | **APPROUVABLE**, à juger par Sady | 1re demande refusée (`rate_limit_reached`, 2 tâches simultanées au plus en offre starter, non facturée) ; 2e bloquée 55 min sans identifiant ni débit, arrêtée ; 3e créée et débitée. Main correcte à 100 % à 0,7, 2,2, 4 et 6,5 s ; netteté 6,0 → 20,1 ; écart d'une image à l'autre + 18 % ; `…/V12-geste-p1-1080p.mp4` |
| 22/10/2026 | P14 (avant-plan de l'ouverture, voilage) | OpenArt (MCP) | Kling 3 Omni `text2image` | 9:16, 2k, 4 images, sans référence | — | ton de `STYLE_ANCHOR` (film 35 mm, lumière dorée) | voilage de lin isolé sur fond noir, avec liste d'interdits (personnes, mains, silhouettes) | historique `1DtjZQRkYOoeqiQpfYYL` | 40 (OpenArt) | non | **écartées** (4) | un visage de femme derrière le lin sur les 4 prises, tringle sur 2 : la liste d'interdits a appelé les personnes ; `media-incoming/lot4-openart/brouillons/P14-voilage-p1..4.png`, jamais publiées |
| 22/10/2026 | P14 (avant-plan de l'ouverture, voilage) | OpenArt (MCP) | Nano Banana 2 `text2image` | 9:16, 2K, 4 images, sans référence | — | idem | photo produit : un pan de lin transparent suspendu, fond de studio noir uni, descriptions positives seulement | historique `teTHDaUGqXeSGnNegB7i` | 120 (OpenArt) | oui | nb-p4 **retenue** ; p1 (bande de tête), p2 (sol et ourlet) écartées ; p3 seconde | aucune personne ; nb-p4 recadrée sur le tissu, étalonnage commun, flou de profondeur léger, transparence tirée de la luminosité ; `public/media/prototype/P14-voilage.webp` (648 × 1800, 230 ko) |
| 22/10/2026 | L1 (plan de liaison : des portes ouvertes à la console) | OpenArt (MCP) | Kling 3.0 `image2video` | 8 s, `pro` (1920 × 1080), sans son ; image de départ = dernière image de V10 1080p (upload `bOIy2A9uUmgqyB9pHZCi`), image d'arrivée = première image de V12 1080p (`ZlS3Dlm5Zbljrgt60YYI`) | — | — | « la caméra quitte les portes, longe le vestibule et s'arrête face à la console où une main tient un bouquet » | historique `3OfUuKcEKY3sPWV6gXMu` | 280 (OpenArt) | oui | **APPROUVABLE** après recadrage, à juger par Sady | vrai mouvement de caméra (un pan de mur au premier plan sert de raccord), raccords 1,1 et 2,0 niveaux ; défaut : un pied de table « fond » au bord droit de 1,8 à 2,6 s, sorti du cadre par un recadrage progressif de 9 % (de 1,2 à 3,4 s, ancré à gauche) ; `media-incoming/lot4-openart/liaison/L1-kling3-pro.mp4` et `L1-recadre.mp4` |
| 22/10/2026 | P15 (le salon du grand âge, image pivot) | OpenArt (MCP) | Nano Banana 2 `image2image` | 16:9, 2K, 4 images ; référence : P04-d brut (upload `LPT3wdDmfGLQXO8fD0ZE`) | — | ton de `STYLE_ANCHOR` | même main, même livre, même tasse, recomposés dans le tiers gauche ; mur calme et fenêtre à droite pour la légende | historique `YujLu4JbLHqf1LoOMW1v` | 120 (OpenArt) | oui | p4 **retenue** (lumière la plus chaude, foulard ocre comme P04) ; p1 à p3 secondes | aucune personne visible au-delà de l'épaule ; main juste à 100 % ; lignes du livre illisibles ; `media-incoming/lot4-openart/salon/P15-salon-p1..4.png` |
| 22/10/2026 | L2 (plan de liaison : de la console au salon) | OpenArt (MCP) | Kling 3.0 `image2video` | 8 s, `pro`, sans son ; départ = dernière image de V12 1080p (`YpQzynfU3YeCDppgcSl9`), arrivée = P15-p4 en 1920 × 1080 (`txMDBpM6AqdqetaNks7u`) | — | — | « la caméra quitte la console et entre dans le salon » | historique `HGUYrVCuuUlPh6AEfpgP` | 280 (OpenArt) | oui | **à juger par Sady** | le modèle a fait un **fondu enchaîné** (surimpression de 2,8 à 4,2 s) au lieu d'un mouvement de caméra ; raccords 1,1 et 1,2 niveaux ; `media-incoming/lot4-openart/salon/L2-kling3-pro.mp4` |
| 22/10/2026 | G3 (geste du salon : la page qui tourne) | OpenArt (MCP) | Kling 3.0 `image2video` | 8 s, `pro`, sans son ; départ = P15-p4 (`txMDBpM6AqdqetaNks7u`) | — | — | la main tourne une page, la vapeur monte de la tasse, légère avancée | historique `mWYWzmVuj7jBtZPlwI87` | 280 (OpenArt) | oui | **APPROUVABLE**, à juger par Sady | page tournée de 4,3 à 5,7 s, main plausible à 100 % ; vapeur absente ; côté droit calme ; `media-incoming/lot4-openart/salon/G3-salon-kling3-pro.mp4` |
| 29/10/2026 | L1-A (logo, symbole : le T-sillage) | Higgsfield CLI | `recraft_v4_1` (vector) | 1:1, 1k, couleur `#C6A96B`, fond `#26382F` | — | — | §4 « Logo · lot L1 », L1-A | `82999da6-02b5-4c33-9234-4b6c5c4d7641` | 2,5 | — | **piste recommandée**, à choisir avec Sady | T et sillage lisibles d'un coup d'œil : barre fine, pied en deux filets qui s'écartent ; SVG de 4 tracés ; `media-incoming/logo-higgsfield/L1-A.svg` |
| 29/10/2026 | L1-B (logo, symbole : le sillage vu du ciel) | Higgsfield CLI | `recraft_v4_1` (vector) | idem | — | — | §4, L1-B | `ad47a1ad-2586-43c4-b2d8-3be646a69737` | 2,5 | — | écartée (proposition) | se lit comme un V à barre, pas comme un T |
| 29/10/2026 | L1-C (logo, symbole : le trait continu) | Higgsfield CLI | `recraft_v4_1` (vector) | idem | — | — | §4, L1-C | `eabd24ea-d2ce-48c8-9025-b4dfc830f971` | 2,5 | — | à juger | élégant, mais la longue courbe frôle la « banane » de Cat et se lit aussi 7 ou J |
| 29/10/2026 | L1-D (logo, sceau) | Higgsfield CLI | `recraft_v4_1` (vector) | idem | — | — | §4, L1-D | `8d3da29d-e4a7-4fd3-b07d-504a791e7bc5` | 2,5 | — | **sceau possible**, à juger | T à empattements dans un anneau, sillage en éventail de filets ; filets trop fins sous 32 px (favicon à part) ; 10 tracés |
| 29/10/2026 | L1-G1 (logo, mise en page verticale) | Higgsfield CLI | `gpt_image_2_5` | 16:9, 2k, `medium`, opaque | — | — | §4, L1-G1 | `54d04ca6-54ae-440b-9d66-fc98cdbc059b` | 1 | — | référence de mise en page | texte juste (« Maison Triona », « by K. ») ; symbole à reflets plus faible que L1-A ; PNG 2688 × 1520 |
| 29/10/2026 | L1-G2 (logo, mise en page horizontale d'en-tête) | Higgsfield CLI | `gpt_image_2_5` | idem | — | — | §4, L1-G2 | `f0a53e4e-45a3-4af1-ae12-0454aa34d104` | 1 | — | référence de mise en page | capitales espacées et « by K. » en italique justes ; symbole à vague sous le T |

Passe 1 du lot 0 : 12 brouillons, 1,44 crédit (278,88 → 277,44). Trois jobs relancés après un refus « rate_limit_reached » (non facturé) : l'offre starter limite à **4 jobs simultanés**.
**Upscales du lot 0 (15/10/2026, incident)** : 4 upscales `bytedance_image_upscale` 4k facturés (4 × 2 = **8 crédits**, 276,24 → 268,24) au lieu de 3. Les processus de la CLI semblaient bloqués (le disque externe était en train de se déconnecter) ; une relance de A02 a créé un quatrième job. La CLI ne liste pas les jobs d'upscale (`generate list` n'affiche que Soul) et les transactions ne donnent pas d'identifiant : les résultats sont à récupérer dans l'historique web de Higgsfield (« Bytedance Image Upscale », 16:07 UTC). **Relance propre (accord de Sady)** : téléversement (`upload create`), création sans `--wait`, identifiant noté, puis `generate wait` ; jobs `5c6af3da-b013-4020-a891-46f55918e75b` (A01), `0a518aac-25ff-4d01-a8d7-ca7e535fa8d6` (A02), `93ee8efb-0ccb-4954-bb74-41eebc4a3f15` (A03), 3 × 2 = 6 crédits (268,24 → 262,24). Résultats : `media-incoming/A01-exterieur.png` et `A02-interieur.png` en 4096 × 2304, `A03-matiere.png` en 4096 × 4096 ; aucun artefact visible à 100 %. **Coût total du lot 0 : 16,64 crédits** (dont 8 perdus). **Leçons** : passer par `higgsfield upload create` puis `--image <upload_id>` ; enregistrer chaque identifiant de job avant d'attendre (`create` sans `--wait`, puis `generate wait <id>`) ; ne jamais relancer un job dont le statut est inconnu.
**Lot 1, images (D21)** : 8,88 crédits (262,24 → 253,36). **Lot 1, vidéos (D24)** : 40 crédits (253,36 → 213,36), 4 clips Kling std en 720p, encodés en deux passes à la résolution native (pas d'agrandissement). Leçons : ne **jamais** passer une ancre en `--image` à Soul pour une autre scène ; Nano Banana Pro 4k indisponible en offre starter.
**Étalonnage unique (15/10/2026, 0 crédit, revue DA du point de contrôle ②)** : P01 à P03 avaient trois dominantes (vert-jaune acide, ocre moutarde, virage jaune et sarcelle). Filtre ffmpeg appliqué à l'identique aux sources `media-incoming/lot1/P0x-{d,m}.png` (posters JPEG régénérés : 2400 et 1440 px, qualité 86) et aux masters vidéo de V01, V01-s, V02 et V03 (réencodés avec les mêmes réglages en deux passes) : jaunes désaturés, verts et sarcelles ramenés vers l'olive, ombres légèrement réchauffées. Saturation HSL moyenne : P02 0,37 → 0,26, P03 0,34 → 0,32 (P01 inchangé en moyenne : sa dominante est orangée, seuls les murs vert-jaune bougent). Écart poster / première image de la vidéo : ≤ 2 niveaux sur 255 par canal. Filtre : `huesaturation=hue=0:saturation=-0.32:colors=y:strength=20,huesaturation=hue=-22:saturation=-0.30:colors=g:strength=20,huesaturation=hue=-25:saturation=-0.45:colors=c:strength=20,colorbalance=rs=0.03:bs=-0.04:rm=0.01:bm=-0.02,eq=saturation=0.92`. À appliquer tel quel aux lots suivants.
Passe 2 du lot 0 (garde-fou « scène vide ») : 10 brouillons, 1,20 crédit (277,44 → 276,24) ; aucune personne dans les 10. Un job échoué côté Higgsfield (`ae3ed336…`, non facturé) a été relancé.
**Lot 2 + textures (D25), interrompu le 15/10/2026 sur demande de Sady (audit créatif, aucune génération payante avant nouvelle validation).** Fait : 44 brouillons `soul_cinematic` sans référence (20 scènes P04 à P08 en 16:9, 24 textures P09 en 1:1), 44 × 0,12 = 5,28 crédits (213,36 → 213,24 après le premier, 210,96 après les scènes, 208,08 après les textures) ; choix des prises (planches `media-incoming/lot2/planche-P04.jpg` à `planche-P09.jpg`) ; **un seul upscale** 4k (P04-d, 2 crédits, 208,08 → 206,08). **Total dépensé : 7,28 crédits ; solde 206,08.** Aucun job en échec, aucune relance. Non fait : upscale des 4 autres scènes (P05-d à P08-d) et des 5 textures retenues, vidéos V04 à V08, post-production (étalonnage, JPEG, 4:5, encodages) ; `media-incoming/lot2/final/` et `video/` sont vides. Lin (P09) : aucune prise acceptable, non relancé. Constat : le prompt court « Détails P09 » produit des natures mortes minimalistes plutôt que des gros plans de matière (3 prises sur 24 avec cadre de film ou coins arrondis, 4 avec une silhouette ou une main parasite, avérée ou possible) : à reprendre avant toute nouvelle passe.
**Essai d'agrandissement vidéo (D26, 16/10/2026)** : un seul clip, V01, pour 1 crédit annoncé ; **1,61 débité** (206,08 → 204,47). La requête enregistrée par Higgsfield liste la vidéo deux fois dans `medias` (alias `--video`), cause possible de l'écart : à vérifier avant tout lot d'agrandissements (essayer `--video-references`). Le coût réel d'un lot d'agrandissements vidéo se calcule donc à 1,61 par clip de 8 s, pas 1.
**Lot 2, accueil et services (D26, 16/10/2026)** : accord de Sady pour 9 jobs (≈ 32 crédits) ; **32,05 crédits débités** (204,47 → 172,42) : P06-d et P07-d agrandies en 4k (2 × 2), V04 et V06 en Kling std (2 × 10), agrandissements 1080p de V01-s, V02, V03, V04, V06 (5 × 1,61, avec `--video` comme avec `--video-references`). Tous les jobs étaient lancés quand la directive V4 de Sady a demandé l'arrêt : aucun n'a été relancé, **rien n'est intégré**. Fichiers et post-production dans `media-incoming/lot2/` (`final/`, `masters/`, planches) ; rapport complet : `media-incoming/lot2/RAPPORT-lot2-16-10-2026.md`. Constats à reprendre : les boucles V01 et V02 publiées (lot 1) reculent d'une seconde à la fin du fondu de raccord ; V03 en boucle saute (travelling) ; les vidéos du lot 2 sont 2 à 3 niveaux plus sombres que leur poster ; P04 ne tient pas entièrement en 4:5.
**Lot 3, plans 01 et 02 enchaînés (V5, 16/10/2026)** : accord de Sady pour un plafond de 40,48 crédits ; **20,48 débités** (172,42 → 151,94) : 4 brouillons P10 et 2 prises Kling std, aucune seconde prise. Méthode : image de départ seule et mouvement explicite (jamais début = fin ni « Static camera », cause des clips figés V01, V02, V04, V06 relevée par l'audit V5) ; le plan 02 part de la dernière image du plan 01. Contrôle : script de mesure (planche de 12 images, écart d'une image à l'autre, ressemblance avec la première image, zoom apparent, part de l'image qui bouge) puis visionnage de Sady sur `media-incoming/revue-v5/index.html`.
**Lot 3, plan 03 (V5, 16/10/2026)** : « passe au plan 3 » de Sady, sur l'enveloppe annoncée d'environ 12,5 crédits ; **10,48 débités** (151,94 → 141,46) : 4 brouillons P12 et 1 prise Kling std, sans agrandissement (le brouillon 2k sert de poster). Image de départ avec la main déjà présente, pour que Kling anime une main existante plutôt que d'en inventer une.
**Lot 3, plan 04, image de la conciergerie (V5, 16/10/2026)** : « oui je veux bien » de Sady sur l'enveloppe annoncée de 2,48 crédits ; **2,48 débités** (141,46 → 138,98) : 4 brouillons P13 et 1 agrandissement 4k. Même maison que P10 et P12 (calcaire, console de noyer, lumière de fin d'après-midi), scène vide : le quotidien préparé, sans personne. `generate cost` n'a pas rendu de prix pour l'agrandissement (paramètre image manquant) ; tarif de 2 crédits déjà mesuré au lot 0 et confirmé par le débit.
**Agrandissements 1080p du lot 3 (22/10/2026)** : « Maintenant (≈ 4,83 crédits) » de Sady ; **4,83 débités** (138,98 → 134,15), 3 × 1,61 pour 1 annoncé par `generate cost`. Leçons : l'offre starter n'accepte que **2 agrandissements simultanés** (la 3e demande est refusée sans frais) ; une demande peut rester bloquée sans rendre d'identifiant : le solde inchangé prouve qu'aucune tâche n'existe (le débit tombe à la création), on peut alors l'arrêter et la recréer une fois ; la CLI écrit le JSON de `generate get` sur la sortie d'erreur ; `generate list` n'affiche toujours pas les agrandissements.
**OpenArt, avant-plan de l'ouverture (22/10/2026, D29)** : accords de Sady pour 40 puis 120 crédits OpenArt ; **160 débités** (10 320 → 10 160). Leçon : pour un objet seul, décrire une photo produit en studio, sans liste d'interdits (elle a fait apparaître un visage dans les 4 prises de Kling 3 Omni). Fond noir : détourage local par la luminosité, aucun outil payant.
**OpenArt, plan de liaison (22/10/2026)** : accord de Sady pour Kling 3.0 en 1080p, 280 crédits OpenArt ; **280 débités** (10 160 → 9 880). Méthode : image de départ et image d'arrivée prises sur les plans voisins, pour que le film s'enchaîne sans coupure ; contrôle des raccords, du mouvement et des bords à 100 %.
**OpenArt, section 3 · le salon (22/10/2026)** : accords de Sady pour la liaison et le geste (280 chacun), puis pour l'image pivot (Nano Banana 2, 120) ; **680 débités** (9 880 → 9 200). Le plan de liaison L2 est un fondu enchaîné, pas un mouvement : à refaire seulement si Sady le demande (280).
**Logo, lot L1 (29/10/2026, D48)** : Sady n'a pas le kit annoncé par Cat (« on doit le faire ensemble ») ; Higgsfield à sa demande (exception à D29) ; enveloppe annoncée de 12 crédits, **12 débités** (134,15 → 122,15). Recraft V4.1 en mode `vector` rend un **SVG natif** (4 à 10 tracés, aucun bitmap, manifeste C2PA intégré) et respecte la couleur imposée ; GPT Image 2.5 écrit juste « Maison Triona » et « by K. ». Le cinquième job a été refusé (« rate_limit_reached », non facturé) : 4 jobs simultanés au plus en offre starter, relancé après la fin des quatre premiers. Fichiers bruts et planches : `media-incoming/logo-higgsfield/`.
