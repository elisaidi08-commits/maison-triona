---
name: maison-triona-seo
description: Méthode et règles SEO de Maison Triona - requêtes de besoin par pays (BE, FR, LU, MC, CH) et par service, intention, difficulté estimée sans chiffres inventés, carte des 3 types de concurrents avec sources datées, architecture des pages, briefs FR/EN, checklist technique par page (titre, description, canonical, hreflang + x-default, données structurées autorisées, Core Web Vitals), visibilité dans les moteurs IA, discrétion (Cat jamais dans les données structurées, aucune donnée de santé dans les URL ou la mesure). À utiliser pour toute recherche de mots-clés, étude de concurrence, brief de contenu, métadonnée ou donnée structurée.
---

# SEO Maison Triona

Spec et étude complètes : `docs/seo-strategy.md`.

## 1. Méthode : le besoin d'abord
1. Matrice **pays × besoin** : BE, FR, LU, MC, CH × organiser le quotidien · accompagner un proche · enfants · « je ne sais pas encore ». Langues : FR (principal), EN (résidents internationaux).
2. Pour chaque requête : langue · **intention** (information / comparaison / prise de contact) · **difficulté estimée** (faible / moyenne / forte, justifiée par la composition des résultats) · pays · **page cible**.
3. **Où gagner** : accompagnement, mise en relation, indépendance, discrétion, « une seule interlocutrice ». **Où ne pas se battre** : « aide à domicile + ville », « baby-sitter + ville », dominés par les annuaires et plateformes.
4. Une page cible **par intention**, jamais deux pages pour la même requête, jamais de page vide.

## 2. Règles de véracité
- Toute affirmation sur un concurrent : **URL + date + niveau de confiance**.
- Volumes : « non mesuré (outil payant requis) » ; aucun chiffre deviné.
- Constats de résultats de recherche : moteur utilisé, localisation (souvent **non localisée** depuis nos outils), date.
- Aucun faux avis, aucun faux chiffre, aucun critère non vérifié, aucune promesse de classement.

## 3. Checklist par page (FR et EN)
- [ ] `title` unique, environ 50 à 60 caractères, requête principale en tête, marque en fin (« … · Maison Triona »).
- [ ] `meta description` unique, environ 140 à 160 caractères, factuelle, sans promesse non tenue.
- [ ] Un seul `h1`, hiérarchie de titres propre, langue déclarée (`lang`).
- [ ] `canonical` vers soi-même ; `hreflang` FR, EN **et** `x-default` (→ `/fr`) réciproques.
- [ ] URL propre et stable (`/fr/services/grand-age`), **sans donnée de santé** ni paramètre de suivi.
- [ ] Données structurées **autorisées** : `Organization` (nom, URL, logo, sans adresse ni personne ; pris en charge par Google), `BreadcrumbList` si utile ; `Service` (par service) et `FAQPage` (page FAQ) restent **valides dans schema.org mais sans résultat enrichi Google** (FAQ retirée en mai 2026, `Service` absent de la galerie) : légers, jamais présentés comme un levier de classement. **Exclus** : `HowTo`, `LocalBusiness` (pas d'adresse publique), `Review` / `AggregateRating`. **Jamais** le nom de Cat. Validation : validateur schema.org et outil de test des résultats enrichis (pour `Organization` et `BreadcrumbList`). Faits datés : `docs/seo-strategy.md` §G.
- [ ] Liens internes vers la scène de service et vers « Parlez-nous de votre situation ».
- [ ] Images : `alt` FR/EN utile ; poster LCP non différé ; vidéo sans effet sur le LCP.
- [ ] Core Web Vitals : LCP ≤ 2,5 s, **INP ≤ 200 ms**, CLS ≤ 0,1 (cibles projet plus strictes dans `docs/architecture.md` §8).
- [ ] Mots-clés **naturels** : écrits pour un lecteur, relus par `i18n-copy-editor` ; aucune répétition forcée.
- [ ] Vocabulaire réglementé signalé (garde-malade, aide à domicile, placement, agréé…).

## 4. Moteurs IA (GEO / AEO)
- Réponses **courtes, factuelles et sourcées** en tête de page ; FAQ claire ; données structurées valides ; contenus à jour et datés.
- Pas de texte écrit « pour les robots » ; le contenu utile aux humains reste la base.
- Distinguer les consignes **officielles** (Google Search Central) des opinions du secteur.

## 5. Brief de contenu (modèle)
```
Page : … (FR / EN) · URL : … · Intention : … · Requêtes visées : … (sans bourrage)
Question principale à laquelle répondre en 2 phrases : …
Plan (h2) : …
Faits à faire valider par Cat : …   (aucun publié sans validation)
Liens internes : … · CTA : Parlez-nous de votre situation
Données structurées : …
```

## 6. Mesure
Search Console + analytics sans cookie, agrégés ; aucun identifiant visiteur ; aucun besoin de santé associé à une personne ; rapport mensuel simple (pages d'entrée, requêtes, demandes envoyées en volume global).

## 7. Plugin `claude-seo` (phase 1 et après)
Installation seulement après relecture de son code et accord de Sady. Usages : `/seo audit`, `/seo technical`, `/seo schema`, `/seo hreflang`, `/seo geo`, `/seo competitor-pages`, `/seo content-brief`, `/seo cluster`, `/seo drift` ; `/seo local` et `/seo maps` seulement si une présence locale est décidée. Sans clés Google, les Core Web Vitals sont des estimations de laboratoire ; backlinks et volumes précis demandent des outils payants.
