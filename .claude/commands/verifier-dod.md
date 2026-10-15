---
description: Vérifie qu'une story de Maison Triona remplit ses critères d'acceptation et la Definition of Done, preuves à l'appui, avant le point de contrôle.
argument-hint: <story, ex. 2.1>
---

Vérifie la Definition of Done de la story **$ARGUMENTS**.

1. Lis la story dans `docs/plan-implementation.md` (objectif, critères d'acceptation, point de contrôle ⛳ ou non) et la DoD commune (§3).
2. Charge la skill `maison-triona-qa` et parcours sa checklist.
3. Exécute ce qui peut l'être et **garde la sortie comme preuve** : `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, `npm run test:a11y`, `npm run check:content`, `npm run check:third-party`. Si un script n'existe pas encore, dis-le (ne le simule pas).
4. Délègue :
   - à **`qa-a11y-perf`** pour Lighthouse, axe, clavier, budgets ;
   - à **`security-privacy-reviewer`** si la story touche le formulaire, les en-têtes, le légal, l'analytics ou une dépendance ;
   - à **`art-director`** si la story est visuelle.
5. Rends le tableau suivant, sans arrondir : une case sans preuve est ⛔.

```
Story $ARGUMENTS · Verdict : ✅ TERMINÉE | ⛔ NON TERMINÉE

| Critère | Statut | Preuve (commande, mesure, capture) |
|---|---|---|
…
Restes à faire :
Point de contrôle ⛳ : captures 1440 / 834 / 390 jointes ? oui / non
```

Si la story est terminée et visuelle : **arrête-toi** et attends « OK story $ARGUMENTS » de Sady. Ne commence pas la story suivante.
