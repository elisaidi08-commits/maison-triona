---
name: maison-triona-motion
description: Recettes de mouvement approuvées pour Maison Triona avec Motion (paquet motion, LazyMotion + m) et CSS - entrée du hero, filet qui se dessine au survol, révélation à l'entrée dans le viewport, transition de page, parallaxe du hero - avec repli prefers-reduced-motion et garde-fou sans JavaScript. À utiliser avant d'écrire ou de relire toute animation, transition ou effet de survol du site.
---

# Mouvement Maison Triona (recettes)

Catalogue, statuts et interdits : `docs/motion-spec.md`. N'implémente **que** ce qui y figure avec un statut validé (arbitrage Q4 pour M2, M3, M7).

## Constantes
- Courbe d'entrée : `[0.22, 1, 0.36, 1]` (`ease-maison`) · survols : `ease-standard`.
- Durées : 150 ms (couleur) · 300 ms (filet) · 240 ms (page) · 700 ms (révélation) · 900 ms (hero).
- Déplacement ≤ 12 px. Seulement `opacity` et `transform`. Jamais de ressort. Toujours `once`.

## 1. Fournisseur (une seule fois, dans le layout)
```tsx
'use client';
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
```
`strict` lève une erreur si un `motion.*` (bundle complet) est utilisé : n'utiliser que `m.*`.

## 2. Révélation (M2 images, M3 titres de section ; jamais les paragraphes)
```tsx
'use client';
import * as m from 'motion/react-m';
import { useReducedMotion } from 'motion/react';

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  // MotionConfig "user" garde l'opacité : on court-circuite entièrement en reduced-motion
  if (useReducedMotion()) return <div>{children}</div>;
  return (
    <m.div
      data-reveal
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </m.div>
  );
}
```
Garde-fou sans JavaScript, dans le layout :
```tsx
<noscript><style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style></noscript>
```
(L'empreinte de ce style est à ajouter à la CSP.)

## 3. Entrée du hero (M1, CSS pur, aucune dépendance JS)
```css
@theme {
  --animate-entree-1: entree 900ms var(--ease-maison) both;
  --animate-entree-2: entree 900ms var(--ease-maison) 120ms both;
  --animate-entree-3: entree 900ms var(--ease-maison) 240ms both;
  @keyframes entree { from { opacity: 0; transform: translateY(12px); } }
}
```
```tsx
<h1 className="animate-entree-1 motion-reduce:animate-none">…</h1>
<p className="animate-entree-2 motion-reduce:animate-none">…</p>
```
**L'image ou le poster du hero n'est jamais animé** (c'est l'élément LCP).

## 4. Filet au survol (M4) et couleur (M5)
CSS uniquement : voir la recette « Lien à filet » de la skill `maison-triona-design-system` (`scale-x-0` → `group-hover:scale-x-100`, `origin-left`, `duration-hover`, `motion-reduce:transition-none`).

## 5. Transition de page (M6)
Entrée seule, fondu 240 ms, **pas au premier affichage** (sinon le LCP serait animé). Option à valider en story 2.2 : View Transitions si stables dans la version de Next installée ; sinon `template.tsx` avec une classe d'animation appliquée seulement après une navigation interne.

## 6. Parallaxe du hero (M7, P2, desktop seulement)
```tsx
'use client';
import { useRef } from 'react';
import { useScroll, useTransform, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

export function HeroParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -24]);
  if (useReducedMotion()) return <div ref={ref}>{children}</div>;
  return (
    <div ref={ref} className="overflow-hidden">
      {/* sous 1024 px, la transformation est neutralisée */}
      <m.div style={{ y }} className="max-lg:transform-none!">{children}</m.div>
    </div>
  );
}
```

## 7. Ancre de service et focus (M12)
```css
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
.scene-title { scroll-margin-top: calc(var(--header-h) + var(--mini-menu-h)); }
```
```ts
// Après arrivée sur /fr#grand-age (clic ou lien partagé) : focus sur le titre de la scène
window.addEventListener('hashchange', () => {
  const el = document.getElementById(location.hash.slice(1))?.querySelector<HTMLElement>('[data-scene-title]');
  el?.focus({ preventScroll: true });   // le titre porte tabindex="-1"
});
```
Sans JavaScript, l'ancre fonctionne quand même (défilement natif).

## 8. Vidéo liée au scroll (M13, V01 et V07 au plus)
Pas de Motion : `requestAnimationFrame` + IntersectionObserver ; `video.currentTime = progression × durée` seulement quand la scène est visible ; fichier encodé toutes images clés (`-g 1`) ; reduced-motion ou conditions non remplies → poster fixe ; **aucun épinglage** si un test clavier, lecteur d'écran ou zoom le dégrade. Défilement natif, jamais détourné.

## 9. Pause (M14, obligatoire)
Bouton texte « Mettre la vidéo en pause / Lire la vidéo » sur toute vidéo de plus de 5 s ; choix mémorisé pour la session (`sessionStorage`) et appliqué à toutes les scènes.

## Interdits (rappel)
Ressorts, zoom au survol, scale > 1,02, animation de texte (mots, lettres), curseur personnalisé, défilement détourné (scroll hijacking), carrousel, compteur, splash, boucle infinie hors vidéo, animation de `filter`/`width`/`height`/`top`.

## Vérification
Émulation `prefers-reduced-motion: reduce` · JavaScript désactivé · Lighthouse avant/après (LCP, CLS identiques) · poids du JS de mouvement ≤ 30 ko gzip · relecture `art-director`.
