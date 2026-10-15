# Direction artistique v2 — « Le luxe chaleureux »

> **Statut** : proposition phase 0 (15/10/2026), v2.1 après le brief assets IA et la spec d'entrée par besoin ; à valider par Sady puis Cat.
> **Priorités** : `docs/ux-entry-i18n-a11y.md` > `docs/assets-ia-brief.md` > ce document > PRD §6.
> **Remplace** : la direction visuelle de la maquette Figma actuelle (voir `docs/audit-v1.md`).
> **Complète** : `anti-patterns.md` (racine), qui reste la liste des interdits. Les points où cette DA s'en écarte sont signalés `[À TRANCHER]` et listés au §9.
> **Priorité** : sur la direction artistique, ce document prime sur le PRD §6. Sur le fonctionnel, le PRD prime.

---

## 1. La formule

**Un hôtel particulier où l'on est reçu comme à la maison.**

Précision et retenue dans la forme, chaleur dans le fond. Cat a validé le concept et la chaleur de la maquette ; elle demande plus de luxe sans perdre la convivialité. On ne change donc pas d'univers : on **élève l'exécution**. Moins d'éléments, plus d'air, une typographie plus noble, une photographie plus juste, l'or posé là où il signe.

Test de chaque écran : *si Cat recevait ce site imprimé sur papier épais, le poserait-elle sur une table de salon ?*

---

## 2. Références d'ambiance (décrites par mots)

Aucune œuvre à copier ; des sensations à retrouver.

- **Le papier** : une lettre à en-tête sur papier vergé crème, un monogramme gravé en vert profond, une marge large.
- **La lumière** : fin d'après-midi sur un mur à la chaux, ombres longues et douces, jamais de plein midi.
- **Les matières** : lin lavé, bois d'olivier, porcelaine blanche, pierre calcaire, eau calme, laiton patiné (jamais doré brillant).
- **Le geste** : une main qui pose une clé sur une table, une nappe qu'on lisse, une porte entrouverte. Le service se devine, il ne se montre pas.
- **Le rythme** : celui d'un carnet d'adresses relié toile, où chaque page porte peu de choses, très bien écrites.

Ce qu'on ne veut **pas** évoquer : le hall d'hôtel cinq étoiles clinquant, le magazine de déco saturé, la start-up « luxury », la carte postale de vacances.

---

## 3. Principes

| # | Principe | Règle opérationnelle |
|---|---|---|
| 1 | **Le vide est un luxe** | Une idée par écran. Sections espacées de 160 px en desktop, 112 px en tablette, 72 px en mobile. Colonne de lecture ≤ 640 px (~65 caractères). |
| 2 | **Le champagne en filets, jamais en aplats** | L'or n'apparaît qu'en filet 1 px, en bordure de bouton sur fond sombre, dans le point du « K. » et au survol. Jamais en fond, jamais en texte sur fond clair (contraste insuffisant, voir `docs/design-tokens.md`). |
| 3 | **Un seul étalonnage photo** | Chaud, légèrement désaturé, grain fin, lumière rasante. Détails de matières et de lieux plutôt que des scènes. **Un seul portrait humain** sur tout le site, bien cadré. |
| 4 | **L'arche comme motif** `[À TRANCHER]` | Cadrage d'image en arche (demi-cercle en tête), écho à la porte de la façade. **Une seule occurrence recommandée** (image du hero), trois au maximum. Conflit avec la règle 02 du moodboard Figma (« aucun arrondi »). |
| 5 | **Le « K. » en cachet** | Plus présent mais jamais tapageur : fin du hero (petit), pied de page (moyen), confirmation du formulaire (grand). Toujours seul, toujours entouré d'air. |
| 6 | **Micro-interactions minimales** | Transitions douces et lentes, sur `opacity` et `transform` uniquement. Rien ne rebondit, rien ne suit le curseur. Détail : `docs/motion-spec.md`. |
| 7 | **La convivialité par le ton** | Première personne du pluriel (« la maison », « nous »), phrases courtes, vouvoiement, présence de Cat nommée avec sobriété. Pas d'effet pour « faire chaleureux ». Détail : skill `maison-triona-copy-fr-en`. |

---

## 4. Couleur

Valeurs, ratios et tokens : `docs/design-tokens.md`.

| Rôle | Couleur | Part de surface | Usage |
|---|---|---|---|
| Fond | **ivoire** `#F4EDE0` | ~80 % | Toutes les pages. |
| Signature | **sapin profond** `#1C3B2A` `[À TRANCHER]` | ~10 % | Titres, wordmark, bloc Contact, focus. |
| Vert secondaire | **cyprès** `#3F5A3C` | < 5 % | Numéros, états de survol, liens secondaires. |
| Surface douce | **pierre** `#D8C8AE` | < 5 % | Fonds d'images en chargement, rares encarts. Jamais de filet or sur pierre (1,73:1, invisible). |
| Respiration | **sauge** `#9AAE8F` | filets | Filets sur fond sombre, états désactivés. Jamais en texte. |
| Accent | **or champagne** `#B8944D` | < 2 % | Filets, point du « K. », bordure du bouton sur sapin, soulignement au survol. |
| Or sur sombre | **champagne clair** `#D2B98A` | ponctuel | Le seul or autorisé **en texte**, et uniquement sur sapin. |
| Texte | **encre** `#1F1E1A` | — | Corps de texte. |
| Erreur | **terracotta** `#A66A4E` | ponctuel | Ligne des champs en erreur. Le message reste en encre. |

**Vert signature `[À TRANCHER]`** : la recommandation est le **sapin profond `#1C3B2A`** (PRD) pour les titres et les aplats, et le **cyprès `#3F5A3C`** (Figma) en second rôle. Le sapin donne la profondeur « hôtel particulier » qui manque à la maquette (10,56:1 sur ivoire contre 6,58:1). Décision finale à prendre sur le logo réel.

---

## 5. Typographie

### 5.1 Familles

| Rôle | Famille | Statut |
|---|---|---|
| Display (titres ≥ 40 px desktop, ≥ 32 px mobile) | Serif élégante en **Light ou Regular** | `[À TRANCHER]` par banc d'essai (story 1.2) |
| Texte, labels, navigation | **Manrope** (Regular, Medium) | Acté |
| Cachet « K. » | La serif display retenue | Suit la décision display |

**Banc d'essai display** (page de démo en phase 1, mêmes textes, mêmes corps, sur ivoire et sur sapin) :

| Candidate | Pour | Contre |
|---|---|---|
| **Newsreader** (Display, Light/Regular) | Axe de taille optique : déliés fins en grand, solides en moyen corps. Chaleur éditoriale, peu vue dans le luxe. Italique disponible. | Moins « signée » qu'une Garamond. |
| **Cormorant Garamond** (Light/Regular) | Recommandée par le PRD et `anti-patterns.md`. Élégance classique immédiate. | Très vue ; petit œil, fragile sous 40 px ; peut évoquer le faire-part. |
| **Instrument Serif** (Regular) | Caractère contemporain, condensé. | Une seule graisse. Signature « AI-luxury 2024-2025 » citée par `anti-patterns.md` n° 19 : à tester en dernier. |
| *Satoshi* (statu quo Figma) | Déjà intégrée aux maquettes, licence vérifiée. | Sans-serif : ne répond pas au retour « il manque du luxe ». |

**Recommandation** : partir sur **Newsreader**, avec Cormorant Garamond comme alternative au banc d'essai. Décision : Sady, puis Cat sur la page de démo.

### 5.2 Règles

- Display en **Light (300) ou Regular (400)**, jamais Bold. La force vient de la taille et de l'air (`anti-patterns.md` n° 27).
- Interlettrage display **légèrement négatif** (−0,01 à −0,02 em), jamais positif (n° 28).
- Labels en capitales Manrope Medium, **interlettrage positif +0,12 em**, 13 px minimum.
- Corps Manrope **18 px minimum sur tous les écrans** (spec d'entrée, WCAG 2.2 visé), interligne ≥ 1,6. Colonne ≤ 640 px (≈ 65-70 caractères).
- **Italique** `[À TRANCHER]` : le brief l'autorise sur un mot du hero, `anti-patterns.md` n° 18 le limite à un mot par page avec un sens réel. Proposition : **aucun italique dans la version de base**, une variante avec un mot en italique au banc d'essai, décision sur pièce.
- **Un seul titre display par écran visible.** Le hero porte le plus grand corps du site ; aucune autre section ne s'en approche (Territoires passe au niveau h2).
- Pas de tiret cadratin dans les titres, la navigation ni les CTA (n° 16). Le nom de marque « Maison Triona — by K. » est la seule exception, en couverture et dans les métadonnées.

---

## 6. Style bible v2 : photographie et vidéo (figée le 15/10/2026)

Tous les visuels du site sont **générés par IA** (`docs/assets-ia-brief.md`). Cette style bible reprend celle du brief (§2), **vérifiée sur les images** du moodboard v2 (`ASSETS PHOTO MAQUETTE/`, 14 images et 3 vidéos, voir `docs/moodboard/README.md`), puis corrigée et complétée. Shot list et prompts : `docs/assets-manifest.md`. Technique : `docs/media-pipeline.md`.

> **Quel moodboard ?** `MOODBOARD PHOTO/` contient la direction v1 (architecture blanche futuriste), écartée par le moodboard v2 de Figma. La style bible ci-dessous suit `ASSETS PHOTO MAQUETTE/`. `[À CONFIRMER par Sady]`

### 6.1 Lumière
- Naturelle, **chaude et rasante** : matin, fin d'après-midi, couchant. Ombres longues et douces.
- Intérieurs à **fort contraste doux** : pièce dans la pénombre, ouverture lumineuse (fenêtre, porte, portail).
- Flash argentique discret toléré pour une scène de soirée, jamais dur.
- *Correction* : plusieurs images du moodboard sont prises **en plein midi sous un ciel saturé** (piscines, lac, terrasse). On ne les suit pas.

### 6.2 Palette observée (mesurée sur les 14 images, à ne pas copier dans les tokens)

| Famille | Teintes relevées | Usage dans l'image |
|---|---|---|
| Crèmes, ivoires | `#E5E0D7` `#CEC2AE` `#C9B9AD` | Murs à la chaux, lin, porcelaine |
| Ocres, sable | `#C99F67` `#B19263` `#A18F6B` `#936F49` | Façades, enduits, lumière |
| Terre cuite, bois | `#95643E` `#5D412C` `#A1492A` (bois verni) | Tuiles, pots, bois |
| **Olive, kaki** (dominant) | `#5C634F` `#5A5B45` `#535A34` | Végétation, volets |
| Cyprès profond | `#334D43` `#202D27` | Cyprès, ombres de feuillage |
| Bleu **sourd** (seul autorisé) | `#69778A` | Mer à distance, volets patinés |
| Noirs chauds | `#1C1F0A` `#18080A` | Ombres, intérieurs |
| **À éviter** | `#709BD3` `#A3D0E3` `#B1E2EF` `#6392A9` | Ciels saturés, nappe bleue |

Mesures moyennes : saturation 0,32, luminance 0,38. Cible des générations : **saturation ≤ 0,35**, ombres chaudes, jamais de noir pur.
*Correction* : les verts du moodboard sont **olive et kaki** plus que sauge ; les prompts disent donc « olive, sage and deep cypress green ».

### 6.3 Matières et détails
Enduit à la chaux, pierre sèche, calcaire, tuiles et pots en terre cuite, bois verni et bois d'olivier, lin lavé, porcelaine blanche, verre, fer forgé, laiton patiné ; cyprès, oliviers, pins parasols, jasmin, lavande et fleurs blanches, agaves ; eau calme et reflets.

### 6.4 Grain et optique
- Rendu **film 35 mm** (registre Portra 400) : léger voile, couleurs un peu désaturées, hautes lumières douces.
- *Correction* : grain **très subtil** à la génération. Un grain fort incrusté rend la vidéo impossible à compresser sous 2,5 Mo (mesuré, `docs/media-pipeline.md` §5) ; si on veut plus de grain, il se restitue à l'affichage par une texture fixe.
- Focales de 35 à 85 mm, profondeur de champ moyenne à faible ; aucun HDR, aucun rendu « plastique ». *Correction* : la façade du moodboard a un rendu IA lisse, sans matière : ne pas la suivre.

### 6.5 Cadrages et mouvements
- Cadrages posés, symétriques ou légèrement décalés, beaucoup d'air, sujet au tiers.
- *Complément* : le moodboard est **vertical** (4:5), nos vidéos sont **16:9**. Chaque composition se pense en paysage ; celle du hero laisse son **tiers gauche calme et sombre** (colonne de texte).
- Mouvements **très lents** : plan fixe avec mouvement naturel (rideau, feuillage, eau, lumière) **de préférence**, car il boucle sans raccord (même image en début et en fin). Poussée avant, glissé latéral ou dérive lente seulement pour les scènes « scrub » (un seul geste de caméra).
- Jamais de zoom rapide, de **drone**, de coupe rapide. *Correction* : la vue aérienne prévue pour les territoires devient un plan à hauteur d'œil.

### 6.6 Sujets humains
- **Mains, dos, épaules, profils** d'abord ; un visage seulement si le rendu est irréprochable ; **aucun visage d'enfant**.
- **Aucune ressemblance avec une personne réelle**. *Correction* : le portrait « dame âgée, cheveux argentés, barrette en perle, chemisier imprimé, à la fenêtre » décrit trait pour trait un portrait Unsplash ; la version retenue montre des mains (ou une silhouette de dos, autrement vêtue).
- **Grand âge** : élégance, autonomie, dignité (lire, se tenir debout à une fenêtre, recevoir). Jamais de fragilité, de matériel médical, de masque, de fauteuil roulant.
- **Un seul portrait** humain sur tout le site.

### 6.7 À éviter
Bleu saturé et mobilier « souvenir de famille » · profil avec lunettes noires · contraste croisé, grain excessif, intérieur trop sombre · masque médical · téléphones et écrans · foule · marques et logos · architecture ultra-moderne et froide (direction v1) · *ajouts* : piscines turquoise, parasols à franges, transats (registre hôtel-club) · **lieux identifiables** (lac de Côme, côte amalfitaine, Majorque, collines toscanes à cyprès) · bateaux de marque reconnaissable · casquettes et tenues de sport · ciels de plein midi · collages.

### 6.8 Texte et image
- Ailleurs que dans le hero, **le texte reste à côté de l'image**, jamais dessus (règle 04 du moodboard).
- **Hero** (spec d'entrée, prioritaire) : la vidéo V01 est en fond. Seul le **titre display** peut passer sur l'image, avec un voile sapin d'au moins **58 %** (grand texte, 3:1 dans le pire cas). La question et les 4 choix sont posés sur un **aplat ivoire**. Calculs : `docs/design-tokens.md` §2.4.
- **Cadrage** : plein cadre, sans arrondi ni bordure, sauf l'**arche** si elle est retenue (Q4).

---

## 7. Composants clés

Mesures en px desktop ; tablette et mobile dans `docs/design-tokens.md`.

### 7.1 En-tête
- Logo « le sillage » (hauteur 28 px) + wordmark « Maison Triona » en display Regular 22 px, en sapin.
- **4 entrées** : La Maison · Services · Territoires · Contact (le logo mène à l'accueil ; « Accueil » disparaît). Manrope Medium 16 px, encre ; page courante soulignée d'un filet or 1 px ; cibles ≥ 48 px.
- Sélecteur **FR · EN** typographique, 13 px, langue inactive en encre-68. Jamais de drapeau, jamais de globe.
- En-tête **transparent sur ivoire**, non collant en V1. Si on le rend collant : filet 1 px sapin à 20 % au scroll, rien d'autre (n° 29).
- Mobile : wordmark + « Menu » en toutes lettres ; menu plein écran ivoire, entrées en display 32 px, « K. » en bas.
- Tant que le logo n'est pas livré, **wordmark seul**, avec un emplacement réservé de 28 × 28 px pour éviter tout décalage de mise en page à son arrivée.

### 7.2 Hero et entrée par besoin (Accueil, scène S1)
Spec : `docs/ux-entry-i18n-a11y.md` (prioritaire), variante **B** recommandée (Annexe B).
- **Desktop** : colonne de texte sur **aplat ivoire** (colonnes 1 à 5) ; vidéo V01 en plein cadre sur le reste de l'écran, poster P01-d. Le titre peut déborder sur l'image avec un voile sapin ≥ 58 %.
- Titre display-xl **72/76 Light** (contre 88 Medium dans la maquette), 3 lignes maximum, sapin.
- Question (h2, Manrope 20/34) puis **liste de 4 choix** : vrais liens, filet or 1 px entre chaque ligne ; numéro 01-03 en cyprès, libellé en Manrope Medium 20-22, sous-libellé en label capitales (« CONCIERGERIE DE LUXE ») ; ligne ≥ 56 px. Le choix 4 (« Je ne sais pas encore ») n'a pas de numéro : c'est une porte de sortie.
- Survol ou focus d'une ligne : le filet or se dessine (M4). Aucune icône, aucune flèche.
- **Mobile** : photo P01-m en bande courte, titre, question, 4 lignes pleine largeur ; pas de vidéo. Parcours « choisir → service → contacter » en 3 écrans.
- **Image en arche** `[À TRANCHER]` : seulement si l'on renonce à la vidéo plein cadre (les deux ne cohabitent pas bien).
- Fin du hero : **« K. » 24 px** précédé d'un filet or de 48 px.

### 7.3 Services (Accueil : scènes S3 à S5 ; page Services)
- **3 services** (spec d'entrée) : conciergerie de luxe, accompagnement du grand âge, garde d'enfants. La **mise en relation** n'est plus un univers à part : c'est le modèle de la maison, expliqué dans chaque service.
- Sur l'accueil, chaque service est une **scène** (vidéo desktop, photo mobile), ancre `#conciergerie`, `#grand-age`, `#enfants`, structure du §7.8.
- Page Services : les 3 services en **3 lignes de hauteur égale**, numérotées 01 à 03, filets or, chaque ligne menant à sa page dédiée (`/services/conciergerie`…).
- Survol d'une ligne : le filet or se dessine de gauche à droite.

### 7.4 Territoires (Accueil)
- Label + titre **h2** (et non plus display-l, pour ne pas concurrencer le hero).
- **Ligne fine des pays** en Manrope Medium 15 px, capitales, +0,12 em : BELGIQUE · FRANCE · LUXEMBOURG · MONACO · SUISSE.
- Option P2 : carte au trait très abstraite (contours simplifiés en filet sauge 1 px, cinq points or), sans fond de carte ni nom de ville.

### 7.5 Bloc Contact (fin de page)
- **Aplat sapin profond pleine largeur**, padding vertical 160 px.
- Composition **centrée** dans une colonne de 640 px (fin de la moitié droite vide).
- Filet or 48 px, label « Contact » en champagne clair, titre h2 display en ivoire : **« Parlons-en, en toute discrétion. »** (microcopy du brief, à valider par Cat).
- Réassurance en ivoire-80 (7,4:1, AAA) : « Chaque demande est lue personnellement et reste confidentielle. » (texte Figma, à valider par Cat).
- **Bouton « Nous écrire »** : texte ivoire, bordure or 1 px, rayon 0, hauteur 52 px, padding horizontal 32 px. Survol : la bordure passe au champagne clair et un filet se dessine sous le texte. Focus : anneau champagne clair 2 px, décalé de 4 px.
- Variante pour la page Contact elle-même : le bloc n'apparaît pas.

### 7.6 Pied de page
- Fond ivoire, **filet or 1 px pleine largeur** en tête.
- Desktop, une ligne : **« K. » 48 px** à gauche · Mentions légales · Confidentialité · Contact au centre · FR · EN et © à droite.
- Mobile : les mêmes éléments empilés, centrés, « K. » en tête.
- Pas de répétition de la navigation principale, pas de colonnes (n° 30).
- Sous la ligne, en body-s : « Images créées avec l'aide de l'intelligence artificielle. » `[À CONFIRMER avec Cat]` (transparence IA, `docs/privacy.md` §4).

### 7.7 Formulaire
- Reprend la planche Figma `110:7` : champs soulignés, labels au-dessus, résumé d'erreurs en tête, messages en encre sous une ligne terracotta.
- Changements : labels 13 px ; ligne d'erreur `#A66A4E` ; **Pays / zone en rangée de choix** (BE · FR · LU · MC · CH · Autre) plutôt qu'un select sans affordance `[À CONFIRMER]`.
- Confirmation : « K. » 64 px centré, titre, une phrase, lien de retour. Aucune animation sinon un fondu.
- Ajouts de la spec d'entrée : présélection de « Nature de la demande » par `?service=` ; champ facultatif « Pour qui ? » ; aide « Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. »

### 7.8 Scène de service (structure identique × 3)
1. Label + titre h2 (nom du service) + **promesse** en une phrase (display Regular, sapin).
2. **3 points de réassurance** en liste typographique (numéros ou filets, pas d'icônes).
3. **Comment ça se passe** : 3 étapes courtes (01 · 02 · 03).
4. Une phrase sur le modèle (« Chaque personne que la maison vous présente, Cat la connaît personnellement. »).
5. **CTA unique** « Parlez-nous de votre situation » (lien à filet), vers `/contact?service=…`.
Aucun tarif, aucune liste de prestataires, aucune promesse médicale. Textes : `docs/ux-entry-i18n-a11y.md` Annexe C.

### 7.9 Mini-menu (desktop)
Après le hero, une rangée discrète « Conciergerie · Grand âge · Enfants · Contact » (Manrope Medium 16, encre ; actif souligné d'un filet or ; cibles ≥ 48 px), collante **sous** l'en-tête. Fond ivoire plein, aucun flou, aucune ombre. Jamais de mini-menu en mobile.

### 7.10 Barre mobile « Écrire en toute discrétion »
Fixée en bas, 56 px, fond sapin, texte ivoire, filet or en haut. Masquée sur `/contact` et pendant la saisie au clavier ; la page réserve sa hauteur (`scroll-padding-bottom`) pour ne jamais masquer un élément focalisé.

### 7.11 Suggestion de langue
Si la langue du navigateur diffère de la page : une ligne discrète sous l'en-tête (« This site is also available in English. · Switch to English · Close »), Manrope 16 en encre sur pierre (10,16:1), sans animation, refermable. Jamais de redirection automatique, jamais de fenêtre modale.

---

## 8. À faire / à ne pas faire

| À faire | À ne pas faire |
|---|---|
| Un titre, une phrase, beaucoup d'air | Empiler label + titre + intro + bouton + image dans la même hauteur d'écran |
| L'or en filet 1 px qui souligne | L'or en aplat, en dégradé, en texte sur ivoire |
| Sapin plein pour le bloc Contact | Dégradés, voiles colorés, glassmorphism (n° 01, 06) |
| Serif Light en grand, Manrope en petit | Serif en petit corps, sans-serif Medium en 88 px |
| Numéros 01 · 02 · 03 · 04 pour rythmer | Icônes, pictogrammes, flèches décoratives (n° 08, 10) |
| Une image par idée, au même étalonnage | Deux étalonnages sur un écran, bleus vifs, sourires de stock |
| « Nous écrire » / « Prendre contact » | « Réservez dès maintenant », « Get started » (n° 24) |
| Une seule arche, sur l'image du hero | Arches répétées en décor, coins arrondis sur les cartes |
| Le « K. » seul, entouré d'air | Le « K. » animé, en filigrane, en fond |
| Filet qui se dessine au survol, 300 ms | Zoom, ombre, opacité au survol (n° 14) |
| Parler de ce que la maison fait, concrètement | Buzzwords, stats en gros chiffres, logos clients (n° 17, 21, 22) |

---

## 9. Points `[À TRANCHER]` portés par cette DA

| Point | Options | Recommandation |
|---|---|---|
| Serif display | Newsreader · Cormorant Garamond · Instrument Serif · statu quo Satoshi | Newsreader, au banc d'essai |
| Vert signature | sapin `#1C3B2A` · cyprès `#3F5A3C` | Sapin en signature, cyprès en second rôle |
| Arche | Hero seul · 2-3 occurrences · aucune (règle moodboard) | Hero seul |
| Apparition au scroll | Interdit (`anti-patterns.md` n° 12) · autorisé (brief) | Autorisé pour les images et les titres de section seulement, texte statique |
| Vidéo liée au scroll (scrub) | Aucune · 1 à 2 scènes (brief assets) | V01 et V07 au plus, sans épinglage s'il nuit à l'accessibilité |
| Italique dans le hero | Non (n° 18) · un mot (brief) | Non par défaut, testé au banc d'essai |
| ~~Services sur l'Accueil~~ | ~~3 ou 4 univers~~ | **Tranché par la spec d'entrée : 3 services**, la mise en relation est le modèle |
| Pays / zone | Select · rangée de choix | Rangée de choix |
| Quel moodboard fait foi | `ASSETS PHOTO MAQUETTE/` · `MOODBOARD PHOTO/` | `ASSETS PHOTO MAQUETTE/` (c'est lui que décrit la style bible) |
| Mention des images IA | Pied de page · mentions légales seules · aucune | Pied de page + mentions légales (art. 50 du règlement IA) |
| Logos partenaires (`anti-patterns.md` n° 21) | Aucun logo · grille de partenaires (spec partenaires §6) | Autorisé en **phase 2** pour des **partenaires** (jamais des clients) : grille statique, monochrome, non cliquable, après accord écrit ; jamais de défilement ni de « Trusted by » |
| Compteurs (n° 22) | Aucun chiffre · « 12 sociétés partenaires, 4 pays » (spec partenaires §3) | Dans une phrase, au corps du texte, seulement s'ils sont vrais et tenus à jour ; jamais en display |
| FAQ (n° 23) | Paragraphes dans *La Maison* · page FAQ en accordéon (spec confiance §2.1) | **Tranché par la spec confiance** (prioritaire) : page FAQ avec `<details>`/`<summary>` natifs, ancre par question, ouverts à l'impression, signe d'ouverture discret |
| Mise à jour de `anti-patterns.md` | Typo, espacements, motion, pied de page, focus, CTA (« Parlez-nous de votre situation », « Écrire en toute discrétion »), barre mobile collante, scrub, **n° 21 à 23** (ci-dessus) | À faire par Sady dès les arbitrages rendus (le fichier est hors du périmètre d'écriture de la phase 0) |
