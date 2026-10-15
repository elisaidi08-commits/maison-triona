---
name: maison-triona-qa
description: Checklist de sortie de story et de lancement Maison Triona - build, lint, typecheck, anti-patterns, accessibilité WCAG 2.2 AA (axe, clavier, focus non masqué, cibles 48 px, contrastes AAA du texte courant, reduced-motion, pause vidéo, formulaire en étapes avec et sans JavaScript, accordéon, PDF balisé), performance (Lighthouse ≥ 95 mobile et desktop, budgets d'octets, LCP, CLS, INP), SEO technique (titres, descriptions, canonical, hreflang, sitemap, noindex, données structurées), discrétion et RGPD (aucun cookie public, aucun appel tiers, aucune donnée de demande dans les logs, coffre chiffré, e-mails sans contenu), contenu (placeholders, blocs [SI VRAI], parité FR/EN) et livrables du point de contrôle visuel ; checklist de mise en production. À utiliser avant de déclarer une story terminée, de demander une validation à Sady ou d'ouvrir le site.
---

# Checklist de sortie de story

Une case non cochée = story **non terminée**. Seuils : `docs/architecture.md` §8 et §9. Lancement : §7 ci-dessous et `docs/launch-checklist.md`.

## 1. Code
- [ ] `npm run lint` · `npm run typecheck` · `npm run build` : OK.
- [ ] Aucune classe Tailwind arbitraire : `grep -rnE "\[[0-9#]" src/` sans nouveau résultat.
- [ ] Aucune couleur, taille ou durée hors `src/styles/tokens.css`.
- [ ] Aucune nouvelle dépendance non justifiée (poids, licence, alternative).
- [ ] Checklist de `anti-patterns.md` (annexe B) passée.

## 2. Accessibilité (WCAG 2.2 AA ; texte courant AAA quand possible)
- [ ] `npm run test:a11y` : 0 violation axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) sur les pages touchées, FR et EN.
- [ ] Clavier : tout est atteignable, ordre logique, focus 3 px **toujours visible et jamais masqué** (en-tête, mini-menu, barre mobile), aucun piège (scènes à vidéo comprises) ; menu mobile fermable par Échap.
- [ ] Cibles ≥ 48 px (choix d'entrée ≥ 56 px) ; corps de texte ≥ 18 px.
- [ ] Entrée par besoin : 4 vrais liens, fonctionnent sans JavaScript, focus déplacé sur le titre de la scène ; parcours mobile en 3 écrans au plus.
- [ ] Vidéo : bouton pause nommé et atteignable ; aucune vidéo en mobile ; reduced-motion = version statique complète.
- [ ] `docs/a11y-report.md` mis à jour ; VoiceOver et NVDA passés par Sady pour les stories ⛳.
- [ ] Contrastes : uniquement des paires du tableau `docs/design-tokens.md` §2.2.
- [ ] `lang` correct sur `<html>`, titres hiérarchisés (un `h1` par page), repères `header/nav/main/footer`, lien d'évitement.
- [ ] Images : `alt` pertinent FR/EN ou `alt=""` si décoratives ; vidéo `aria-hidden`, bouton pause.
- [ ] `prefers-reduced-motion: reduce` émulé : aucune animation hors repli prévu.
- [ ] Zoom 200 % et largeur 320 px : aucun contenu perdu, aucun défilement horizontal.
- [ ] Formulaire : labels visibles et associés, erreurs annoncées, résumé focalisé.
- [ ] Formulaire en étapes et rappel : titre d'étape focalisé à chaque changement ; Retour sans perte ; **sans JavaScript**, toutes les parties visibles et l'envoi fonctionne ; aucune ressaisie (3.3.7) ; consentement requis, non coché par défaut.
- [ ] FAQ : `<details>`/`<summary>` au clavier, état annoncé, ancre par question, ouverts à l'impression.
- [ ] Partage : « Lien copié » annoncé (`aria-live`) ; lien visible sans JavaScript.
- [ ] PDF : texte réel, langue, titres et signets ; contrôle PAC ou veraPDF consigné.

## 3. Performance (build de production, jamais `npm run dev`)
- [ ] Lighthouse **mobile et desktop** ≥ 95 en Performance, Accessibilité, SEO.
- [ ] LCP ≤ 2,0 s (mobile), CLS = 0, TBT < 150 ms, INP ≤ 200 ms (changement d'étape du formulaire compris).
- [ ] Avant LCP : ≤ 320 Ko mobile, ≤ 360 Ko desktop ; 2 polices préchargées au plus.
- [ ] Image LCP non animée, préchargée, AVIF ; vidéo absente sur mobile.
- [ ] libsodium et le code du coffre absents du JavaScript du site public.

## 3 bis. SEO technique (pages publiques, FR et EN)
- [ ] `title` et `meta description` présents et **uniques** ; un seul `h1` ; `lang`.
- [ ] `canonical` vers soi-même ; `hreflang` `fr`, `en`, `x-default` **réciproques**, URL absolues.
- [ ] Page dans `sitemap.xml`, ou `noindex` si elle doit l'être (confirmation, impression, démo, 404, `/coffre`, préproduction).
- [ ] JSON-LD valide (validateur schema.org) : `Organization` sans adresse ni personne ; **jamais le nom de Cat**.
- [ ] Aucune redirection selon la langue du navigateur ou l'IP ; aucune donnée de santé ni paramètre de suivi dans les URL.

## 4. Discrétion, sécurité, RGPD
- [ ] Réseau : **0 requête vers un domaine tiers** (`npm run check:third-party` + onglet Réseau).
- [ ] Aucun `Set-Cookie` sur le site public (seul `/coffre` pose un cookie de session) ; `sessionStorage` limité à la suggestion de langue et au brouillon `mt-draft-*` non sensible.
- [ ] Aucun secret dans le code ; `.env.example` à jour.
- [ ] Aucune donnée personnelle dans les logs (formulaire, rappel, coffre, e-mails) ; aucun champ santé ; service choisi jamais journalisé.
- [ ] Demandes écrites **chiffrées** dans le coffre UE ; notification à Cat sans nom, contact ni message ; confirmation visiteur sans écho du contenu ; aucun pixel ni lien traqué.
- [ ] `/coffre` : A2F obligatoire, journal d'accès, `noindex`, `no-store`.
- [ ] Mesure : événement `Entrée` sans identifiant ; pages vues sans paramètres de requête (`docs/privacy.md` §3).
- [ ] Aucune référence au moodboard (`cosmos_`, `docs/moodboard`) dans `src/` ou `public/`.
- [ ] Console : aucune erreur, aucune violation CSP.

## 5. Contenu
- [ ] Parité FR/EN de chaque clé et de chaque texte (`npm run check:i18n`) ; aucune traduction automatique non relue.
- [ ] Placeholders et brouillons recensés ; `npm run check:content` bloque la production s'il en reste.
- [ ] Aucun texte inventé (chiffres, lieux, délais, montants, mentions légales) ; blocs `[SI VRAI]` masqués tant que Cat ne les a pas confirmés.
- [ ] Aucun terme réglementé non validé (`docs/seo-strategy.md` §K) ; aucun bourrage de mots-clés.

## 6. Livrables du point de contrôle ⛳ (stories visuelles)
- [ ] Captures pleine page **1440, 834, 390** (et reduced-motion pour les stories 2.4 et 2.5).
- [ ] Rapport `art-director` (écarts avec Figma et la DA v2).
- [ ] Rapport `qa-a11y-perf` (tableau des mesures).
- [ ] Liste des contenus provisoires.
- [ ] **Arrêt** : attendre « OK story X.Y » de Sady avant la story suivante.

## 7. Checklist de lancement (story 5.5, `docs/trust-contact-launch.md` §6.3)
Détail, preuves et responsables : `docs/launch-checklist.md`. Chaque case porte une **date**, un **nom** et une **preuve** ; sans preuve, elle reste vide.
- [ ] Redirections : `www` ↔ domaine nu, `/` → `/fr`, anciennes URL.
- [ ] `robots.txt` et `sitemap.xml` de production ; `noindex` retiré **uniquement** à l'ouverture.
- [ ] HTTPS, HSTS, CSP, en-têtes de sécurité vérifiés.
- [ ] Soumission de test de bout en bout (formulaire + rappel) : coffre, notification, e-mail de confirmation, absence de données dans les logs.
- [ ] SPF / DKIM / DMARC validés, tests de réception réalisés (`docs/email-deliverability.md`).
- [ ] FR/EN relus (humain), parité des clés vérifiée, `hreflang` correct.
- [ ] Pages légales par pays, politique de confidentialité, **déclaration d'accessibilité**, mention éventuelle sur les images générées par IA (décision de Cat).
- [ ] Analytics sans traceurs actif ; pas de bandeau si aucun traceur.
- [ ] Pages 404 et 500 soignées, favicon, image de partage.
- [ ] Surveillance de disponibilité, alertes, sauvegardes, procédure de restauration testée.
- [ ] Plan de **lancement en douceur** : ouverture à un cercle restreint, retours, puis ouverture générale.
