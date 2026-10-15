---
description: Audite un écran de Maison Triona (URL locale ou de préproduction, ou node Figma) contre la DA v2, les anti-patterns, l'accessibilité et la performance, puis rend un rapport unique.
argument-hint: <url | node Figma | nom d'écran>
---

Audite l'écran suivant : **$ARGUMENTS**

1. Identifie la cible :
   - une URL → rendu réel (build de production, pas `npm run dev`) ;
   - un node Figma (`99:2`, `90:2`…) ou un nom d'écran → maquette du fichier `fAbQP3eV9zM6R3Bq75ehFN` (correspondances dans `docs/audit-v1.md` §1 et §7) ;
   - si la cible est ambiguë ou si aucun serveur ne tourne, demande-la avant de continuer. N'invente aucun rendu.
2. Délègue en parallèle :
   - à l'agent **`art-director`** : relecture visuelle en 1440, 834 et 390 px contre `docs/art-direction.md` et `anti-patterns.md` ;
   - à l'agent **`qa-a11y-perf`** (si la cible est une URL) : Lighthouse mobile et desktop, axe, clavier, reduced-motion, requêtes tierces ;
   - à l'agent **`i18n-copy-editor`** : ton, vocabulaire interdit, parité FR/EN des textes visibles.
3. Consolide un **rapport unique** :

```
Écran : … · Cible : … · Date : …
Verdict global : ✅ / ⚠️ / ⛔

⛔ Bloquants (doivent être corrigés avant le point de contrôle)
⚠️ À corriger
✅ Ce qui fonctionne
Mesures : tableau Lighthouse / axe (si URL)
Questions pour Sady
```

Ne modifie aucun fichier : ce rapport sert de base à la correction.
