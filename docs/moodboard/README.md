# Moodboard — index (référence de style interne)

> **Statut** : index rédigé en phase 0 (15/10/2026). **Aucun fichier n'a été copié ici** : les images restent dans leurs dossiers d'origine, à la racine du dossier projet. Sady décide s'il les copie dans `docs/moodboard/`.
> **Règles** (`docs/assets-ia-brief.md` §1) : références de **style** uniquement. Jamais dans `public/`, jamais publiées, jamais déployées, **jamais utilisées comme image de départ, référence de composition, inpainting ou variation** dans un outil de génération. Aucune reproduction d'un lieu, d'un visage, d'une scène ou d'un cadrage.
> **Droits** : aucun. Images collectées sur Cosmos (sources inconnues) et sur Unsplash.

---

## ⚠️ Quel dossier fait foi ? `[À CONFIRMER par Sady]`

| Dossier | Contenu observé | Rôle déduit |
|---|---|---|
| `MOODBOARD PHOTO/` (11 JPEG + `anti-patterns.webp`) | Architecture blanche organique et futuriste, arches de béton, bassins à nénuphars, champs d'herbe surréalistes (chaise, bureau, ordinateur), disques dorés dans l'eau ; `anti-patterns.webp` = villa toscane et piscine | **Direction v1, écartée** : la page Figma « 07 · Moodboard v2 » (`109:2`) dit remplacer « les images de la charte v1, jugées trop futuristes » |
| `ASSETS PHOTO MAQUETTE/` (14 WebP `cosmos_*` + 3 vidéos `cosmos_*.mp4` + 4 JPEG Unsplash) | Villas ocre, fenêtre sur la mer, scènes de table, lac, mur de pierre et cyprès, vidéos de ferme en pierre, de repas et de terrasse sur la mer | **Moodboard v2** : c'est lui que décrit la style bible du brief (`docs/assets-ia-brief.md` §2) et dont s'inspirent les prompts V01-V08 |

Sady a indiqué le 15/10/2026 que le moodboard « est dans `MOODBOARD PHOTO` ». Or son contenu contredit la style bible (aucun ocre, aucune terracotta, aucun grain film, aucune scène humaine). **Hypothèse de travail retenue** : la référence de style est `ASSETS PHOTO MAQUETTE/` ; `MOODBOARD PHOTO/` sert de **contre-référence** (ce qu'on ne fait plus). À confirmer.

---

## Moodboard v2 — `ASSETS PHOTO MAQUETTE/`

| Fichier | Ce qu'on y voit | Ce qu'on en retient | Ce qu'on n'en reprend pas | Assets inspirés |
|---|---|---|---|---|
| `cosmos_147496275.webp` | Fenêtre blanche ouverte sur la mer, intérieur sombre | Contraste doux pièce sombre / ouverture lumineuse ; bleu mer **sourd** (`#69778A`) | Le cadrage (battant à gauche, horizon au tiers) | V01, P01 |
| `cosmos_759147631.webp` | Façade ocre, porte en arche, volets sauge, balcon en fer forgé, pots | Enduit à la chaux, sauge des volets, terre cuite | La façade elle-même, sa symétrie, la liste exacte de ses éléments ; rendu lisse « IA » sans grain | V02, P02 |
| `cosmos_970719795.webp` | Proue d'un bateau verni (type Riva) sur un lac, villa et cyprès | Bois verni, eau sombre, reflets | **Le lac de Côme** (identifiable), **le bateau de marque**, la villa | V03, P03 |
| `cosmos_46868240.webp` | Villa sur un promontoire, lac de Côme | Lumière douce sur l'eau | Lieu **identifiable** (Italie) | — |
| `cosmos_814515771.webp` | Mur de pierre sèche orangé au couchant, cyprès, haie de jasmin, fenêtre étroite | Lumière rasante orangée sur la pierre, jasmin | Le cadrage et la fenêtre étroite (trop proche du prompt V08) | V08, P08 |
| `cosmos_1624835032.webp` | Vue aérienne d'une villa, rangées de cyprès, piscine bleue | — | **Paysage clairement toscan**, piscine turquoise, drone | V07 (à revoir) |
| `cosmos_134230054.webp` | Villa ocre, piscine, parasols à franges, transats | Ocre des façades | Registre hôtel-club, piscine turquoise, ciel saturé | — |
| `cosmos_2087776455.webp` | Villa ocre parmi les cyprès, jardin à l'italienne | Vert profond des cyprès | Lieu à l'identité italienne marquée | — |
| `cosmos_1758708434.webp` | Deux femmes préparant des légumes, nappe bleue vive | Spontanéité, lumière de fin de journée | **Bleu saturé**, mobilier « souvenir de famille », visages | V05 (sans visage) |
| `cosmos_564714712.webp` | Grand-mère et bébé au dîner, flash | Flash argentique, chaleur d'une tablée | Visages réels identifiables | V06 (mains seules) |
| `cosmos_9850313.webp` | Dîner au flash, femme âgée avec un **masque médical** sous le menton | Grain, flash | Masque médical (interdit §1.7) | — |
| `cosmos_702660585 (1).webp` | Terrasse à Majorque, agaves, montagnes | Agaves, lin des coussins | Lieu identifiable (Espagne), ciel saturé | — |
| `cosmos_702660585.webp` | Soleil peint en ocre sur un mur blanc | Ocre doré sur enduit | — | P09 (texture) |
| `cosmos_1947398336.webp` | Collage 3 × 3 (table dressée, lecture, piscine, fruits, chambre) | Ambiance « maison de vacances » | Collage, piscine | — |
| `cosmos_1744635856.mp4` (7,4 s, 1080 × 1350) | Ferme en pierre à arcades, lavande, fleurs blanches, très léger vent | **Le rythme du mouvement** : plan fixe, seule la végétation bouge | La bâtisse | V02 (mouvement) |
| `cosmos_1754338567.mp4` (8,5 s, 720 × 900, audio) | Repas en intérieur, plats passés de main en main | Gestes de service, plats en céramique | **Téléphone sur la table**, casquettes, visages | V05 (mouvement) |
| `cosmos_664298586.mp4` (7,2 s, 720 × 1278, audio) | Terrasse de villa, pins parasols, falaises sur la mer | Lumière dorée rasante | Côte **identifiable** (type amalfitaine) | — |
| `*-unsplash.jpg` (4) | Portraits de seniors en intérieur | — | **Personnes réelles identifiables** ; le prompt V04 décrit trait pour trait `hosein-sediqi-Nlj1xRntr7U-unsplash.jpg` | V04 (à revoir) |

## Contre-référence v1 — `MOODBOARD PHOTO/`
Architecture blanche organique, arches de béton ouvrant sur des collines, bassins et nénuphars, végétation luxuriante sous verrière, champs d'herbe surréalistes, disques dorés. **Ce qu'on garde** : l'arche comme cadrage (motif de la DA v2, une occurrence) et le calme. **Ce qu'on évite** : tout le reste (rendu 3D, surréalisme, blanc froid, absence de matière).

## Exclusion du build
- Next.js ne sert que `public/` et les routes de l'application : `docs/` n'est jamais servi.
- En phase 1 (story 1.1) : ajouter `docs/moodboard/`, `ASSETS PHOTO MAQUETTE/`, `MOODBOARD */`, `LOGO/`, `TYPO/` à `.vercelignore` (fichiers jamais envoyés à Vercel) et vérifier, après le premier déploiement, qu'aucune URL `/docs/…` ni `/media/…cosmos…` ne répond.
- Hook proposé `block-third-party.sh` (non activé, testé) : refuse toute référence à `cosmos_`, `docs/moodboard`, aux dossiers sources et aux fichiers Unsplash dans `src/`, `public/`, `messages/` et `next.config`.
