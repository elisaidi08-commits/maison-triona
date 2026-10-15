# Charte anti-clichés — Maison Triona — by K.

**Statut** : v1 — garde-fou de design, à lire avant toute génération de code, avant toute maquette, avant toute PR.
**Auteur** : Sady (Eli Saïdi), en collaboration avec Cat.
**Portée** : contraignante. Un item violé = un bug bloquant, à corriger avant merge.

---

## Pourquoi ce document existe

Maison Triona est une conciergerie de luxe discrète. Elle ne peut pas se permettre de ressembler à un site généré par un template SaaS de 2024, ni à une "AI-startup-luxury" avec les tics visuels de son époque. Le site est la seule vitrine publique de la maison (pas de réseaux sociaux, pas de blog) — il doit incarner à lui seul le prestige, la retenue et l'exigence de la marque.

Ce document liste **ce qu'on ne fait pas**, avec pour chaque interdit **ce qu'on fait à la place**. Un "ne fais pas" sans alternative laisse trop de flou pour un agent (Claude Code, Codex) ou pour un humain pressé.

**Trois usages :**
- **Dans le dépôt** — lecture obligatoire pour tout agent IA avant chaque story, avant chaque génération de composant.
- **En review** — à chaque PR, on relit la liste et on coche. Zéro exception.
- **Pour Cat** — une version simplifiée existe en annexe (langage non-technique).

---

## Table des matières

- [1. Couleur & matière](#1-couleur--matière)
- [2. Typographie](#2-typographie)
- [3. Composants & mise en page](#3-composants--mise-en-page)
- [4. Motion & interactions](#4-motion--interactions)
- [5. Rigueur système](#5-rigueur-système)
- [6. Contenu & rhétorique](#6-contenu--rhétorique)
- [Annexe A — Version courte pour Cat](#annexe-a--version-courte-pour-cat)
- [Annexe B — Checklist de review PR](#annexe-b--checklist-de-review-pr)

---

## 1. Couleur & matière

### 01 · Pas de dégradé violet → bleu, ni aucun dégradé "tech"
- **Interdit** : les gradients `from-purple-500 to-blue-500` et toutes leurs variantes (indigo/violet/rose/cyan). C'est la signature immédiate d'un site SaaS 2023-2024.
- **À la place** : un vert forêt uni. Si un dégradé est indispensable, uniquement **deux valeurs très proches de la même teinte** (ex. ivoire `#F5F0E8` → crème `#EDE7D8`). Jamais deux teintes différentes.

### 02 · Pas de hero text en dégradé
- **Interdit** : `bg-gradient-to-r bg-clip-text text-transparent` sur un H1.
- **À la place** : titre en **une seule couleur pleine** — vert forêt sur ivoire, ou ivoire sur vert forêt. Le contraste porteur d'identité vient de la **taille** et de la **respiration**, pas de la couleur.

### 20 · Pas de texture de grain superposée à un dégradé
- **Interdit** : `noise.png` en overlay sur un fond dégradé.
- **À la place** : si texture il y a, alors **grain fin sur aplat mat** (papier, terre, vert profond uni), 3-5 % d'opacité maximum. Jamais sur du dégradé — le mélange trahit le procédé.

### 26 · Pas de couleurs saturées "tech"
- **Interdit** : `#00FF88` verts fluos, `#FF3366` rouges/roses vifs, `#0088FF` bleus électriques.
- **À la place** : palette Maison Triona uniquement (voir `design-tokens.md`). Toute couleur hors tokens = bug.

---

## 2. Typographie

### 04 · Pas d'Inter partout
- **Interdit** : Inter en titres ET en corps. Le site perd son identité et ressemble à Linear/Vercel/Notion.
- **À la place** : **Cormorant Garamond** en display (H1, H2, wordmark), **Inter** en corps de texte uniquement. Le contraste serif/sans-serif porte l'identité.

### 16 · Pas d'em dashes partout
- **Interdit** : em dash (—) comme séparateur générique, entre chaque idée, dans les titres, dans les CTA, dans les nav labels. C'est LA signature de texte généré par IA en 2024-2025.
- **À la place** :
  - Nav labels et CTA : jamais d'em dash.
  - Titres : point ou rien.
  - Paragraphes éditoriaux (page *La Maison* uniquement) : em dash toléré pour incise réelle, une fois par paragraphe maximum.
  - Séparateurs de section : filet 1 px or antique, ou glyphe typographique (§, ¶, ·).

### 17 · Pas de buzzwords
- **Interdit** : *premium, exclusif, unique en son genre, révolutionnaire, sur-mesure* (utilisé comme argument marketing plutôt que description factuelle), *écosystème, expérience client, ADN de la marque, à votre écoute, savoir-faire d'exception*.
- **À la place** : du **concret et du factuel**.
  - ❌ *"Une expérience premium sur-mesure"*
  - ✅ *"Cat sélectionne chaque prestataire elle-même."*
  - ❌ *"Un savoir-faire d'exception au service de votre quotidien"*
  - ✅ *"Vingt ans à orchestrer, en silence, ce que d'autres n'ont pas le temps de chercher."*

### 18 · Pas d'italique serif sur les mots d'accent
- **Interdit** : italique typographique appliqué à un mot au hasard dans une phrase pour "donner du caractère". C'est un tic éditorial signature 2024.
- **À la place** : l'emphase se fait par la **respiration** (retour à la ligne, taille, isolement du mot). Un mot en italique par page maximum, et seulement s'il porte une nuance sémantique réelle (mot étranger non naturalisé, titre d'œuvre, terme technique).

### 19 · Pas de Space Grotesk + Instrument Serif
- **Interdit** : ce combo est la signature "AI-luxury-startup 2024-2025" (Perplexity, Cursor, tous les clones). Immédiatement daté.
- **À la place** : **Cormorant Garamond + Inter** (combo A, safe) OU **Fraunces + Instrument Sans** (combo B, plus signé). Voir `design-tokens.md`.

### 27 · Pas de font-weight 900 sur les H1
- **Interdit** : titres serif en Black weight. Ça écrase la finesse de la lettre.
- **À la place** : Cormorant Regular (400) ou Medium (500) pour les H1. La force vient de la **taille** (80-120 px desktop), pas du poids.

### 28 · Pas de letter-spacing positif sur les titres serif
- **Interdit** : `tracking-wide` sur du Cormorant. La serif est dessinée pour un tracking serré.
- **À la place** : `letter-spacing: -0.01em` à `-0.02em` sur les display serif. Tracking positif réservé aux **labels en petites capitales sans-serif** (`tracking: +0.08em`).

---

## 3. Composants & mise en page

### 05 · Pas de cartes à bordure colorée
- **Interdit** : `border-2 border-purple-500` ou toute bordure épaisse colorée qui "délimite" une carte.
- **À la place** : cartes délimitées par **un filet 1 px vert forêt à 20 % d'opacité**, ou simplement par un **espacement généreux** sans cadre visible. Le vide sépare, la bordure alourdit.

### 06 · Pas de glassmorphism
- **Interdit** : `backdrop-blur`, cartes translucides avec bordure blanche à faible opacité, effets de verre dépoli.
- **À la place** : **aplats mats uniquement**. Le blur trahit immédiatement le site généré et n'a rien à voir avec le vocabulaire "maison de luxe discrète".

### 07 · Pas de dark mode sans contraste
- **Interdit** : dark mode gris foncé sur gris moyen. Illisible, mou, prétentieux.
- **À la place** : si dark mode il y a (**à décider avec Cat, probablement non pour le MVP**), alors :
  - Fond : vert forêt très profond `#1A2E1F`
  - Texte : ivoire `#F5F0E8`
  - Contraste WCAG AAA obligatoire (7:1 minimum sur le corps de texte).
  - **Pas de dark mode "gris moderne"**, ce n'est pas notre vocabulaire.

### 08 · Pas de trois icon boxes alignées
- **Interdit** : la structure "3 colonnes égales, chacune avec icône + titre + baseline de 2 lignes". C'est LE cliché SaaS absolu.
- **À la place** : trois **paragraphes courts numérotés** *01 · 02 · 03*, alignés à gauche, gros espacement vertical entre chaque (128 px min desktop). **Aucune icône**. Le numéro fait le rythme.

### 09 · Pas de badge / pill au-dessus du titre
- **Interdit** : petite étiquette arrondie *"NOUVEAU"* / *"MAISON TRIONA · CONCIERGERIE"* en pill au-dessus du H1, avec fond coloré et bordure.
- **À la place** :
  - Le titre commence directement, sans introduction.
  - Ou est précédé d'un **label en petites capitales**, tracking large `+0.08em`, taille 12-13 px, **sans fond, sans bordure, sans pill**. Juste du texte.

### 10 · Pas d'icônes Lucide (ni Feather, Heroicons, etc.)
- **Interdit** : **aucune icône pictographique** sur le site. Pas de check mark vert à côté des services, pas de flèche décorative dans les CTA, pas d'icône house/user/mail dans le footer.
- **À la place** :
  - Séparateur visuel nécessaire → **filet 1 px or antique** ou **glyphe typographique** (·, —, §, ¶).
  - CTA → juste du texte souligné, sans flèche.
  - Contact → mot "email" ou "téléphone" en toutes lettres, pas d'icône enveloppe.
  - **Exception unique** : l'icône du sélecteur de langue peut être un simple "FR / EN" typographique, jamais un drapeau, jamais un globe.

### 11 · Pas de composants shadcn/ui bruts
- **Interdit** : `<Button>`, `<Card>`, `<Dialog>` de shadcn sortis de la boîte, avec radius 8/12/16 px, shadow-md, focus ring bleu.
- **À la place** : si shadcn/ui est utilisé comme base (formulaires, dialog), **override systématique** :
  - `border-radius: 0` ou `2px` maximum (jamais 8/12/16)
  - `box-shadow: none` (aucune ombre)
  - Focus ring en vert forêt, pas en bleu système
  - Tokens Maison Triona uniquement (voir `design-tokens.md`)
  - **Recommandation** : partir de zéro sur les composants visibles (bouton, input, formulaire). Utiliser shadcn/ui uniquement pour la logique headless (Radix primitives).

### 29 · Pas de sticky header opaque au scroll
- **Interdit** : header qui devient blanc/coloré + shadow au scroll.
- **À la place** : header **fixe et transparent** au-dessus de l'ivoire (le logo reste vert forêt, toujours lisible). Si absolument nécessaire, un **filet 1 px vert forêt** en bas du header au scroll, rien d'autre.

### 30 · Pas de mega-footer à 4 colonnes
- **Interdit** : footer avec 4 colonnes de liens, newsletter, réseaux sociaux, sélecteur de langue, mentions.
- **À la place** : footer minimal — logo "K.", 3 liens (mentions, confidentialité, contact), copyright, sélecteur FR/EN. Une seule ligne desktop si possible.

---

## 4. Motion & interactions

### 12 · Pas de fade-in au scroll
- **Interdit** : `AOS`, `Framer Motion` sur l'apparition des sections, `whileInView`, `initial={{ opacity: 0 }}`.
- **À la place** : le contenu est **là dès le premier rendu**, statique. Rien n'apparaît, rien ne monte, rien ne fade. On peut animer une **transition de page** (fondu 150 ms max), c'est tout.

### 13 · Pas de traînée qui suit le curseur
- **Interdit** : cursor custom, blob qui suit la souris, spotlight radial autour du pointeur.
- **À la place** : **curseur système par défaut**. Aucune magie visuelle. Ce n'est pas un portfolio créatif, c'est une conciergerie de luxe.

### 14 · Pas de boutons qui s'estompent au survol
- **Interdit** : `hover:opacity-80`, `hover:scale-105`, `hover:shadow-lg`, ombre qui grossit au survol.
- **À la place** : au survol d'un lien →
  - Soit un **soulignement 1 px apparaît** (300 ms `cubic-bezier(0.4, 0, 0.2, 1)`)
  - Soit la **couleur passe de vert forêt à or antique**
  - Jamais opacité, jamais scale, jamais shadow.

### 31 · Pas d'animation de chiffre qui compte
- **Interdit** : "20+ années d'expérience" qui s'anime de 0 à 20 au scroll.
- **À la place** : le chiffre est là, écrit, immobile. Et de toute façon, **pas de stats en gros chiffres** (voir §22).

### 32 · Pas de carrousel automatique
- **Interdit** : slider qui défile tout seul toutes les 5 secondes.
- **À la place** : si plusieurs éléments à montrer, ils sont **empilés verticalement** avec beaucoup d'espace. Le scroll est déjà l'interaction.

---

## 5. Rigueur système

### 15 · Pas d'espacements incohérents
- **Interdit** : `margin: 23px`, `padding: 17px`, valeurs pifométriques.
- **À la place** : **tokens d'espacement obligatoires** — 4, 8, 16, 24, 32, 48, 64, 96, 128, 160 (échelle en px, base 8). Toute valeur hors de cette échelle = bug à corriger. Défini dans `docs/design-tokens.md`, appliqué via `tailwind.config.ts` custom.

### 33 · Pas de tailwind classes arbitraires
- **Interdit** : `text-[17px]`, `mt-[23px]`, `bg-[#3a5a40]`. Les crochets arbitraires = tokens contournés.
- **À la place** : tout doit être un token nommé (`text-body`, `mt-lg`, `bg-forest`). Si un token manque, on l'ajoute au design system, on ne bricole pas inline.

### 34 · Pas de responsive fait à la va-vite
- **Interdit** : `md:text-xl lg:text-2xl xl:text-3xl` empilés sans logique claire.
- **À la place** : **3 breakpoints canoniques** — mobile (< 768), tablette (768-1023), desktop (≥ 1024). Chaque composant a un comportement défini pour chacun, documenté dans les stories.

---

## 6. Contenu & rhétorique

### 21 · Pas de bandeau "Trusted by" / logos clients
- **Interdit** : bandeau défilant avec logos de marques prestigieuses.
- **À la place** : on ne montre **pas** les clients. C'est la marque conciergerie qui l'exige — la discrétion est un argument, pas un vide à combler. Le silence est éloquent.

### 22 · Pas de stats en gros chiffres
- **Interdit** : *"20+ ans d'expérience · 500 prestataires vérifiés · 98 % de satisfaction"* affichés en display 96 px.
- **À la place** : l'expérience de Cat est **racontée** dans la page *La Maison*, en prose, dans une phrase qui respire. *"Vingt ans à orchestrer, en silence."* > *"20+ ans d'expérience"*.

### 23 · Pas de FAQ en accordéon
- **Interdit** : composant `<Accordion>` avec 8 questions déroulantes.
- **À la place** : si des questions récurrentes existent, elles deviennent des **paragraphes courts** intégrés à la page *La Maison* ou *Services*. Un accordéon = un site qui a peur de la longueur de son texte. Chez Triona, chaque mot mérite son espace.

### 24 · Pas de CTA agressifs
- **Interdit** : *"Commencer maintenant"*, *"Book a call"*, *"Get started"*, *"Réservez dès aujourd'hui"*, *"Rejoignez-nous"*.
- **À la place** : le CTA unique du site est **"Nous écrire"** ou **"Prendre contact"**. Pas de verbe d'urgence, pas d'anglicisme, pas d'exclamation.

### 25 · Pas de testimonials avec photos et étoiles
- **Interdit** : bloc "Ils nous font confiance" avec photo de profil + 5 étoiles + citation + nom-prénom-poste.
- **À la place** : si un mot de client est cité (**à valider avec Cat, probablement jamais**), c'est une **citation typographique en italique**, initiale + ville uniquement (*"— M., Genève"*). Aucune photo, aucune note, aucun système de rating. La confiance ne se prouve pas, elle s'inspire.

### 35 · Pas d'anglicismes commerciaux
- **Interdit** : *booking, feedback, workflow, insight, mindset, delivery, onboarding, pipeline*.
- **À la place** : le français, toujours. *Prise de contact, retour, méthode, regard, approche, remise, accueil, suivi*. Si un mot anglais est incontournable (rare), il reste **en italique** pour signaler qu'on en a conscience.

### 36 · Pas de "notre équipe" / bios enjouées
- **Interdit** : page "Notre équipe" avec photos souriantes, "Cat aime les orchidées et le café le matin", etc.
- **À la place** : la page *La Maison* parle de Cat en **une seule phrase de troisième personne sobre**. Sa personne est au service de la maison, pas l'inverse.

---

## Annexe A — Version courte pour Cat

*À lire par Cat pour valider qu'elle voit la même chose que Sady.*

Le site de Maison Triona doit éviter **tout ce qui trahit un site fait à la va-vite en 2025**. Voici ce à quoi on ne veut **pas** ressembler :

- **Pas de couleurs "tech"** — pas de dégradés violets, bleus électriques, rien qui rappelle une application ou un logiciel.
- **Pas d'effets de mode** — pas d'animations qui apparaissent au scroll, pas de curseur qui laisse une trace, pas de boutons qui grossissent au survol. Le site est calme.
- **Pas d'icônes partout** — pas de petits pictogrammes à côté des services, pas de flèches décoratives. Le texte parle seul.
- **Pas de "3 colonnes avec icônes"** — c'est le format des sites d'entreprise 2020. Chez nous, chaque idée respire, seule, sur toute la largeur.
- **Pas de badges, pas de pills, pas d'étoiles** — pas de petites étiquettes colorées, pas d'avis clients notés sur 5.
- **Pas de mots creux** — on ne dit pas *"premium"*, *"exclusif"*, *"unique en son genre"*. On dit ce qu'on fait, avec des mots simples et précis.
- **Pas de photos souriantes** — pas de portraits de clients heureux, pas de "notre équipe". La discrétion est notre signature.
- **Pas de logos de clients** — on ne dit jamais qui nous fait confiance. C'est la promesse même de la maison.
- **Pas d'anglicismes** — le site est en français impeccable. L'anglais existe uniquement dans la version EN du site.

Si tu vois **une seule de ces choses** en regardant une maquette, dis-le. C'est un signal que quelque chose s'est glissé où il ne devait pas.

---

## Annexe B — Checklist de review PR

À copier-coller dans chaque PR avant merge.

```
Design review — Maison Triona
─────────────────────────────
□ 01  Aucun dégradé multi-teintes
□ 02  Aucun texte en gradient
□ 04  Cormorant + Inter respectés (pas Inter seul)
□ 05  Aucune bordure colorée épaisse
□ 06  Aucun glassmorphism / backdrop-blur
□ 08  Aucun bloc "3 colonnes icônes"
□ 09  Aucun badge/pill au-dessus des titres
□ 10  Aucune icône Lucide/Feather/Heroicons
□ 11  Shadcn/ui overridé si utilisé (radius, shadow, focus)
□ 12  Aucun fade-in / animation d'apparition au scroll
□ 14  Hover = soulignement ou changement de couleur, pas opacity/scale
□ 15  Espacements uniquement dans l'échelle tokens
□ 16  Em dashes bannis des nav/CTA/titres
□ 17  Aucun buzzword (premium, exclusif, unique, etc.)
□ 18  Italique serif ≤ 1 par page, justifiable
□ 20  Aucun grain sur dégradé
□ 21  Aucun bandeau "Trusted by"
□ 22  Aucune stat en gros chiffres
□ 23  Aucune FAQ en accordéon
□ 24  CTA = "Nous écrire" ou "Prendre contact" uniquement
□ 25  Aucun testimonial avec photo/étoiles
□ 33  Aucune classe Tailwind arbitraire ([xxpx], [#xxx])
□ 35  Aucun anglicisme commercial
```

---

**Version** : 1.0
**Date** : 24 septembre 2026
**À réviser** : à chaque itération majeure du design system, ou à chaque fois qu'un nouveau tic visuel émerge sur le web.
