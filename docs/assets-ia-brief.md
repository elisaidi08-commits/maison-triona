<!--
Brief rédigé par Sady (PO), enregistré tel quel le 15/10/2026.
Seule modification : §3 (storyboard), mis à jour selon docs/ux-entry-i18n-a11y.md §6 (la spec d'entrée prime).
Les remarques de Claude (écarts, risques, prompts adaptés) sont dans docs/assets-manifest.md, pas ici.
-->

# MAISON TRIONA — by K. · BRIEF ASSETS IA (vidéos puis photos)

> **Statut** : complément du « prompt Claude Code · Phase 0 ». **Ce document remplace la §5 (Médias)** du prompt Phase 0 et s'ajoute à la §7.3 (agents/skills).
> **À placer dans** : `docs/assets-ia-brief.md` (et le moodboard dans `docs/moodboard/`, voir §1).
> Auteur / PO : Sady. Cliente : Cat (« K. »). Langue de travail : français ; prompts de génération en anglais.
> Toujours valable : **phase 0 = zéro code applicatif**. Tu écris uniquement dans `docs/`, `.claude/`, `CLAUDE.md`.

---

## 0. Contexte et décision

Le site n'utilisera **aucune photo ni vidéo existante**. Le moodboard fourni vient de Cosmos : ce sont des **références de style internes**, sans droits de publication. **Tous les assets du site seront générés par IA**, dans la même gamme visuelle :
1. **Vidéos d'abord** (scènes de l'accueil desktop).
2. **Photos ensuite** (mobile, vignettes de services, territoires, contact, partage).

Sady génère dans **Higgsfield**. Toi (Claude Code), tu prépares : la style bible, le manifeste d'assets, les prompts prêts à copier, les contrôles qualité, et tu intègres les fichiers livrés. Tu ne génères rien toi-même, sauf si un accès Higgsfield (MCP/API) existe réellement dans cette session : **vérifie, et dis-le-moi, sans rien supposer**.

---

## 1. Règles non négociables

1. **Moodboard = référence de style uniquement.** Dossier `docs/moodboard/` (images + 3 vidéos + `README.md` d'index, fournis séparément).
   - Jamais dans `public/`, jamais publié, jamais déployé (ajoute `docs/moodboard/` aux exclusions de build et vérifie qu'il n'est pas servi).
   - **Jamais utilisé comme image de départ** (start frame), image de référence de composition, inpainting ou variation dans un outil de génération. On s'inspire de la lumière, de la palette, des matières, des cadrages, **pas des images**.
   - **Aucune reproduction à l'identique** d'un lieu, d'un visage, d'une scène ou d'un cadrage du moodboard.
2. **Assets finaux = prompts texte originaux** (ou images de départ **générées par nous**, voir §4).
3. **Personnes générées** : aucune ressemblance volontaire avec une personne réelle. Ne jamais utiliser le visage de Cat, de clients ou de prestataires sans accord écrit.
4. **Transparence IA** `[À CONFIRMER avec Cat]` : décider si les images générées par IA sont signalées (mention discrète dans les mentions légales ou ailleurs). Vérifie les obligations de transparence applicables dans l'UE et signale-moi ce qui s'applique ; ne tranche pas seul.
5. **Neutralité géographique** : les 5 zones sont BE · FR · LU · MC · CH. **Aucun lieu reconnaissable** (pas de monument, pas de villa identifiable), **aucune légende de pays sous une image**, aucun paysage clairement italien ou espagnol présenté comme une zone desservie.
6. **Pas de texte dans les images**, pas de logo, pas de marque, pas d'écran/téléphone visibles.
7. **Grand âge** : montrer l'élégance, l'autonomie, la dignité. Jamais de fragilité, de matériel médical, de masque, de fauteuil roulant, d'ambiance « maison de retraite ».

---

## 2. STYLE BIBLE (extraite du moodboard : vérifie-la en regardant les images, corrige-la, puis fige-la dans `docs/art-direction.md`)

> Vérifiée et figée dans `docs/art-direction.md` §6 (version corrigée).

### 2.1 Lumière
- Lumière naturelle **chaude et rasante** (matin, fin d'après-midi, couchant) ; ombres douces, jamais dures.
- Intérieurs à **fort contraste doux** : pièce sombre, ouverture lumineuse (fenêtre, porte).
- Flash argentique discret possible pour les moments humains de soirée (grain visible).

### 2.2 Palette (estimations visuelles, à calibrer sur les images : ne pas copier telles quelles dans les tokens)
- Ivoire / crème · ocre / jaune sable · terracotta · sauge · vert cyprès profond · bleu mer sourd · accents **champagne / or doux** (mosaïque, laiton, bois verni).
- **Pas de bleu saturé**, pas de vert fluo, pas de rouge vif. Les bleus restent dans la mer, le ciel et des volets patinés.

### 2.3 Matières et détails récurrents
Enduit à la chaux, pierre sèche, tuiles terracotta, bois verni et bois d'olivier, lin, porcelaine blanche, verre, fer forgé, pots en terre, cyprès, oliviers, jasmin, agaves, eau calme et reflets.

### 2.4 Grain et optique
- Rendu **film 35 mm** : grain fin, léger voile, couleurs un peu désaturées, hautes lumières douces.
- Optique entre 35 et 85 mm, profondeur de champ moyenne à faible, **aucun effet HDR, aucun rendu « plastique »**.

### 2.5 Cadrages et mouvements
- Cadrages posés, **symétriques ou légèrement décalés**, beaucoup d'air, sujets en tiers.
- Mouvements de caméra **très lents** : poussée avant, glissé latéral, léger travelling vertical, plan quasi fixe avec mouvement naturel (rideau, feuillage, eau).
- Jamais de zoom rapide, de drone spectaculaire, de coupes rapides.

### 2.6 Sujets humains
- Mains, dos, épaules, profils : **à privilégier** (moins d'artefacts IA, plus de discrétion, plus de « luxe discret »).
- Visages : seulement si le rendu est irréprochable ; regards naturels, sourires mesurés (pas de sourire « stock »).
- Portrait de référence d'attitude : dame âgée élégante, regard vers la lumière d'une fenêtre, tenue soignée.

### 2.7 À éviter (déduit du moodboard et de l'audit)
Bleu saturé et mobilier « souvenir de famille », portrait de profil avec lunettes noires (lecture « endormi »), contraste croisé et grain excessif, intérieur trop sombre, masque médical, téléphones à l'écran, foule, éléments de marque, architecture ultra-moderne froide.

---

## 3. STORYBOARD → ASSETS `[À VALIDER par Sady, puis Cat]`

> **Mise à jour du 15/10/2026** (spec `docs/ux-entry-i18n-a11y.md` §6) : S1 devient « **hero + entrée par besoin** » (V01 en fond, texte lisible). S3, S4 et S5 deviennent les **destinations des choix 1, 2 et 3** ; le choix 4 mène au contact (S7). L'ordre de défilement reste le même.

Fil : **« entrer dans la maison »**. Une scène vidéo par chapitre (desktop uniquement). Sur mobile : photos fixes, pas de vidéo, parcours court.

| Scène | Chapitre | Message (indicatif) | Destination du choix | Vidéo | Photo (mobile / fallback) |
|---|---|---|---|---|---|
| S1 | Le seuil · **hero + entrée par besoin** | « Une seconde vie, comme des vacances qui ne s'arrêtent pas. » + « Que pouvons-nous faire pour vous, ou pour l'un de vos proches ? » | — (porte les 4 choix) | V01 | P01 |
| S2 | La maison | « Ici, on vous attend. » | — | V02 | P02 |
| S3 | Conciergerie | « Une seule interlocutrice pour tout organiser. » | **Choix 1** · `#conciergerie` | V03 | P03 |
| S4 | Grand âge | « Des journées qui gardent leur rythme et leurs plaisirs. » | **Choix 2** · `#grand-age` | V04 | P04 |
| S5 | Table et générations | « Une présence choisie, pour quelques heures ou une saison. » | **Choix 3** · `#enfants` | V05 + V06 | P05 / P06 |
| S6 | Territoires | Cinq pays, un carnet d'adresses. | — | V07 | P07 |
| S7 | Contact | « Parlons-en, en toute discrétion. » | **Choix 4** · `/contact` | V08 | P08 |

Les textes sont indicatifs : le contenu final vient de Cat. Marque `[CONTENU À FOURNIR PAR CAT]` partout où il manque.

---

## 4. MÉTHODE DE GÉNÉRATION (cohérence entre tous les assets)

1. **Style sheet d'abord** : 3 images fixes de référence **générées par nous** (une extérieur lumineux, un intérieur sombre à fenêtre, un détail de matière). Sady les fait valider par Cat **avant** tout lot de vidéos. Elles deviennent nos **images d'ancrage** (à la place des images du moodboard).
2. **Ancre de style** : chaque prompt commence par le même bloc `STYLE_ANCHOR` (ci-dessous) et utilise le même `NEGATIVE`. Ne change pas ces blocs sans le noter dans `docs/assets-manifest.md`.
3. **Image d'abord, vidéo ensuite** : pour chaque scène, génère d'abord l'**image fixe** (Pxx) puis anime-la en **image → vidéo** (Vxx). Avantages : le poster est identique à la vidéo (bon pour le LCP) et la cohérence est meilleure. Les images de départ sont **nos** images générées, jamais celles du moodboard.
4. **Boucles** : chaque vidéo hero doit boucler proprement (début ≈ fin). Sinon, prévois un fondu enchaîné début/fin en post-production (commande en §7).
5. **Journal** : dans `docs/assets-manifest.md`, note pour chaque génération l'outil, le modèle, la date, la graine (seed) si disponible, le prompt exact, la version retenue et le statut.
6. **Capacités Higgsfield** : demande à Sady quels modèles et fonctions il a (image → vidéo, presets de mouvement de caméra, durée max, résolution max, upscaling, références de style/personnage). **N'invente aucune fonction.** Adapte les prompts à ce qu'il te répond.
7. **Résolution** : cible desktop 1920×1080. Si l'outil sort moins (720p), propose l'upscaling ou une mise en page encadrée plus petite (largeur ≤ 900 px) pour éviter le flou sur grand écran.

### Blocs réutilisables

```
STYLE_ANCHOR:
quiet-luxury Mediterranean-inspired lifestyle photography, shot on 35mm film,
Kodak Portra 400 look, soft natural light, warm golden hour tones, fine film grain,
muted warm palette of ivory, ochre, terracotta, sage and deep forest green with
touches of champagne gold, shallow depth of field, calm unhurried mood,
understated elegance, generic location with no recognizable landmarks

NEGATIVE:
text, letters, logos, watermarks, brand names, oversaturated colors, saturated blue,
neon, HDR look, plastic skin, uncanny eyes, distorted faces, extra fingers,
deformed hands, stock-photo smile, medical equipment, face mask, wheelchair,
hospital, crowd, phones, screens, modern gadgets, harsh flash, fast camera motion
```

---

## 5. MANIFESTE VIDÉOS (priorité 1)

Format commun : **16:9, 6 à 8 s, sans audio, mouvement très lent**. `[boucle]` = doit boucler. `[scrub]` = adapté au défilement lié au scroll (mouvement monotone, un seul geste de caméra).

| ID | Scène | Prompt (à faire précéder de STYLE_ANCHOR) | Mouvement | Flags |
|---|---|---|---|---|
| **V01** | Seuil / hero | An old white wooden window opened wide onto a calm deep-blue sea and a soft horizon, dark cool interior in shadow, sunlight grazing the window sill, a sheer linen curtain barely moving in the breeze | Poussée avant très lente vers l'horizon | boucle · scrub |
| **V02** | La maison | An ochre lime-plaster farmhouse facade with a rustic arched wooden door, sage-green shutters, wrought-iron balcony and terracotta pots with herbs, dappled sunlight moving through olive leaves across the stone | Plan presque fixe, très léger travelling vertical | boucle |
| **V03** | Conciergerie | The bow of a polished varnished wooden boat gliding slowly on calm dark-green lake water toward a distant ochre villa framed by tall cypress trees, soft reflections, a cream canvas cover folded on deck | Glissé avant lent | scrub |
| **V04** | Grand âge | An elegant elderly woman with silver hair and a pearl hair clip, seated by a window, turning her head slowly toward soft daylight, warm room, patterned silk blouse, calm dignified expression, hands resting gently *(version sûre : mains seules sur un napperon en lin et une tasse en porcelaine, lumière de fenêtre)* | Plan quasi fixe, souffle de lumière | boucle |
| **V05** | Table partagée | A long linen-covered table in a shaded garden at golden hour, hands passing ceramic dishes of fresh vegetables and herbs, water glasses catching the light, seen from shoulder height, no faces visible, pine tree shade | Glissé latéral lent | boucle |
| **V06** | Générations | Close-up of a child's small hand placing a sprig of rosemary into a glass vase beside an elderly hand adjusting a linen napkin, sunlit wooden table, soft grain | Plan quasi fixe, léger focus pull | boucle |
| **V07** | Territoires | A slow aerial drift over rolling green hills, rows of tall cypress and a pale stone house with a long blue pool, soft cumulus clouds, warm afternoon light, generic landscape with no recognizable landmarks | Dérive lente vers l'avant | scrub |
| **V08** | Contact | A dry-stone wall glowing orange in the setting sun beside a tall cypress and a flowering jasmine hedge, a slim wooden window in the wall, long soft shadows, petals trembling in a light breeze | Plan fixe, lumière qui glisse | boucle |

Ajouter des variantes **si besoin** (portrait 4:5 pour cadres en arche, ratios 9:16 pour tests) seulement après validation de la style sheet.

---

## 6. MANIFESTE PHOTOS (priorité 2, même gamme)

Génère d'abord **P01 à P03** (elles servent aussi d'images de départ des vidéos). Résolution : **bord long ≥ 2400 px**.

| ID | Usage | Ratio | Prompt (STYLE_ANCHOR + …) |
|---|---|---|---|
| **P01** | Hero / poster V01 | 16:9 (+ crop 4:5 mobile) | Same scene as V01: open white window onto a calm blue sea, dark interior, warm sunlight on the sill |
| **P02** | La maison / poster V02 | 4:5 | Ochre lime-plaster facade, arched wooden door, sage shutters, iron balcony, terracotta pots, cobbled courtyard, afternoon light |
| **P03** | Conciergerie / poster V03 | 4:5 | Bow of a varnished wooden boat on calm lake water, cypress-framed ochre villa in the background |
| **P04** | Grand âge | 4:5 | Dignified elderly woman with silver hair and a pearl hair clip near a window, soft side light, elegant patterned blouse, serene gaze |
| **P05** | Table partagée | 4:5 | Overhead-angle detail of a linen tablecloth with ceramic dishes, olive-wood board, herbs and vegetables, hands in frame, no faces |
| **P06** | Générations | 4:5 | A child's hand and an elderly hand together over a bouquet of rosemary and a porcelain cup, warm window light |
| **P07** | Territoires | 16:9 | Pale stone house with a long pool among cypress and rolling hills, soft clouds, golden afternoon light |
| **P08** | Contact | 4:5 | Dry-stone wall at sunset with a tall cypress and jasmine, warm orange light on the stone |
| **P09** | Détails / textures | 1:1 (×6) | Close-ups, one each: linen weave, olive wood grain, terracotta glaze, white porcelain edge, aged brass, limestone surface |
| **P10** | Image de partage (OG) | 1200×630 | **Pas générée** : composition typographique (nom + « K. » + filet or) sur un recadrage de P01, assemblée en code en phase 1 |

`[À CONFIRMER]` : un portrait de Cat est-il souhaité sur le site (photo réelle fournie par elle, jamais générée à sa ressemblance) ?

---

## 7. SPÉCIFICATIONS TECHNIQUES ET INGESTION

### Livraison
- Sady dépose les fichiers bruts dans `public/media/_incoming/` (dossier **ignoré par Git**).
- Convention de nommage finale : `public/media/{scene}/{id}-{slug}.{ext}` (ex. `public/media/seuil/V01-fenetre-mer.mp4`).
- Tu **valides chaque fichier** (ffprobe) avant de le déclarer « prêt » : résolution, durée, codec, présence d'audio, poids.

### Objectifs d'export
- **Vidéo** : MP4 H.264 + WebM VP9 (AV1 si le temps d'encodage est acceptable), **sans audio**, 1080p max, **≤ 2,5 Mo** par vidéo hero (≤ 4 Mo pour une version scrub si indispensable).
- **Poster** : AVIF + WebP, extrait de la même scène (c'est l'élément LCP).
- **Photos** : master JPEG/PNG conservé hors dépôt public ; exports AVIF/WebP en plusieurs largeurs (responsive).

### Commandes de référence (à tester et à ajuster dans `docs/media-pipeline.md`)

```bash
# Lecture : MP4 sans audio, 1080p, faststart
ffmpeg -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 24 -preset slow \
  -pix_fmt yuv420p -movflags +faststart out.mp4

# WebM VP9
ffmpeg -i in.mp4 -an -vf "scale=1920:-2" -c:v libvpx-vp9 -crf 34 -b:v 0 out.webm

# Version « scrub » : toutes les images sont des images clés (plus lourd)
ffmpeg -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 26 -g 1 \
  -pix_fmt yuv420p -movflags +faststart out-scrub.mp4

# Poster
ffmpeg -ss 0.5 -i in.mp4 -frames:v 1 poster.png

# Boucle sans coupure : fondu enchaîné fin/début de 0,5 s (durée D à adapter)
# (détaille la commande xfade dans docs/media-pipeline.md après test)
```

### Règles d'intégration (phase 1+)
`<video muted loop playsinline preload="none">`, démarrage après le LCP, **poster = LCP**, chargement conditionné par `matchMedia` (écran large, pointeur précis, pas de `prefers-reduced-motion`, pas de `Save-Data`) : **sur mobile, aucune vidéo n'est téléchargée**. Fallback photo dans tous les autres cas. Le scrub (vidéo liée au scroll) est limité à 1 ou 2 scènes (V01, V03 ou V07).

---

## 8. CONTRÔLE QUALITÉ DES GÉNÉRATIONS IA (checklist par asset)

- [ ] Mains : doigts corrects, gestes plausibles.
- [ ] Visages : yeux naturels, aucune déformation, expression sobre.
- [ ] Architecture et objets : lignes cohérentes, aucun élément « qui fond », pas de texte parasite.
- [ ] Palette conforme à la style bible (aucun bleu saturé), grain homogène avec les autres assets.
- [ ] Mouvement : lent, continu, aucune dérive d'identité, pas de scintillement.
- [ ] Boucle : pas de saut visible au raccord.
- [ ] Lieu non identifiable, pas de logo, pas de marque, pas d'écran.
- [ ] Piste audio supprimée, poids et résolution respectés.
- [ ] Validé par Sady, puis par Cat, avant intégration.

---

## 9. CE QUE TU FAIS EN PHASE 0 SUR LES ASSETS

1. **Regarde réellement** les images et vidéos de `docs/moodboard/`, puis **vérifie, corrige et complète** la style bible (§2). Signale tout écart.
2. Crée `docs/assets-manifest.md` : une ligne par asset (ID, scène, type, ratio, durée, statut `à générer / généré / validé Sady / validé Cat / intégré`, fichier, prompt, notes).
3. Complète `docs/media-pipeline.md` (commandes testées, budgets d'octets, stratégie LCP, scrub).
4. Prépare, **sans exécuter**, le script d'ingestion `scripts/ingest-media.*` (ffprobe + encodage) pour la phase 1, et la commande slash `/ingest-media`.
5. Mets à jour l'agent `media-producer` et la skill `maison-triona-media` avec : règles §1, style bible §2, blocs §4, QA §8.
6. Ajoute au rapport de fin de phase 0 :
   - la liste de ce que Higgsfield permet réellement (d'après les réponses de Sady) ;
   - les prompts V01-V08 et P01-P09 **adaptés** à ces capacités ;
   - le plan de lots : style sheet → validation Cat → V01-V03 → P01-P03 → reste ;
   - tes questions ouvertes (max 10, avec ta recommandation).

> Si la validation du storyboard (§3) change l'ordre ou le nombre de scènes, mets à jour manifeste et prompts avant tout autre travail.
