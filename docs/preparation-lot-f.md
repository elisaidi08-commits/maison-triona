# Préparation du lot F (mesure, QA, ouverture) — état au 20/11/2026

> **Pour** : Sady (et la liste des éléments à demander à Cat, au juriste et au relecteur anglais).
> **Lot F** (`docs/plan-implementation.md` §2 ter) : 5.2 mesure et Search Console, 5.3 accessibilité et performance, 5.4 tests utilisateurs, 5.5 checklist et mise en production, `check:content` vert, DPA, médias validés par Cat. Ouverture **pas avant l'inscription de la société** (janvier 2027, D38).

## En bref

- **Rien ne peut ouvrir avant janvier 2027** : les contrats de traitement (DPA), les mentions légales et la politique de confidentialité dépendent de la société inscrite (D38, D47).
- **Le code est presque prêt** : en-têtes de sécurité, SEO technique, accessibilité automatisée (axe 0 violation, Lighthouse accessibilité 100) sont faits. Il manque **la mesure (5.2)**, que je peux coder dès maintenant, désactivée tant que le compte Plausible n'existe pas.
- **Le contenu bloque** : `check:content` relève **111 contenus provisoires**. 63 sont des brouillons de textes (à valider par Cat, et en anglais par un relecteur natif), 48 sont des emplacements à remplir (données de la société, avis du juriste).
- **La checklist de lancement** (`docs/launch-checklist.md`) a **0 case cochée sur 45** : la plupart demandent la production (domaine, comptes, DPA) ; une dizaine sont déjà vraies dans le code et n'attendent que leur preuve en production.

## 1. Contenus provisoires (`npm run check:content`, 20/11/2026)

| Groupe | Nombre | Où | Qui |
|---|---|---|---|
| Brouillons de textes FR | 31 sections | `messages/fr.json` (accueil, services, La Maison, Territoires, FAQ, Comment ça se passe, Notre indépendance, contact, réservation…) | **Cat** valide ou réécrit |
| Brouillons de textes EN | 32 sections | `messages/en.json` | **Relecteur natif** (D64 n° 15), après la version française validée |
| Mentions légales | 14 | `Legal` FR/EN (`[CONTENU À FOURNIR PAR CAT]`, `[À DÉFINIR]`) | **Cat** : dénomination, forme, siège, numéro d'entreprise, TVA, directeur de publication, hébergeur ; par pays (checklist §5) |
| Politique de confidentialité | 24 | `Privacy` FR/EN (`[À DÉFINIR]`, `[À CONFIRMER]`, `[CONTENU À FOURNIR PAR CAT]`) | **Cat** (responsable du traitement, contacts) et **juriste** (bases légales, durées, transferts, SMS) |
| Déclaration d'accessibilité | 2 + page | `Accessibility`, `src/app/[locale]/(site)/accessibilite/page.tsx` | **Sady** (résultats de la 5.3) et **Cat** (contact) |
| Gabarit légal | 1 | `src/components/sections/LegalDocument.tsx` | **Cat** |
| Durées de conservation | 2 | `src/lib/vault/conservation.ts`, `retention.ts` (`[À VALIDER]`, D05 : 12 mois proposés) | **Juriste**, puis Sady |
| Textes d'e-mail et de SMS | 2 | `src/lib/email/access-link.ts`, `src/lib/sms/templates.ts` (`[BROUILLON]`) | **Cat** (et le nom d'expéditeur « Triona », D71) |
| Réservation d'appel | 2 | `src/actions/booking-link.ts` (plafond de 100 liens par jour), `src/app/[locale]/(appel)/contact/appel/page.tsx` (CTA « Convenir d'un appel ») | **Sady** |

**Ordre conseillé** : Cat valide les textes français par page (une page à la fois, avec la préproduction sous les yeux), puis le relecteur anglais, puis Cat et le juriste remplissent les pages légales une fois la société inscrite.

## 2. Checklist de lancement : ce qui est prêt et ce qui manque

| § | Prêt dans le code (à prouver en production) | À faire, et par qui |
|---|---|---|
| 1. Domaine, indexation | `/` → `/fr`, `robots.txt`, `sitemap.xml` multilingue, `hreflang` et `x-default`, `noindex` des pages internes, `SITE_URL` exigé au build, redirection 308 de vercel.app (lot B) | **Sady** : DNS de maisontriona.com, redirections .be .fr .lu (D64 n° 8), Search Console (D64 n° 9) ; à l'ouverture seulement : `SITE_INDEXABLE=true` |
| 2. Sécurité | CSP (dont nonce du coffre), HSTS, en-têtes (`src/proxy.ts`, `next.config.ts`) ; coffre avec comptes nominatifs, TOTP, journal (3.2) | **Sady** : comptes de Cat et de Sady créés en production, A2F, variables complètes ; **Claude** : vérification `curl -sI` sur la production |
| 3. Contact, coffre, e-mails | Formulaire, coffre chiffré, boîte d'envoi et reprises, réservation, transport SMS ; tests de bout en bout en CI | **Sady** : TEM (domaine `mail.maisontriona.com`, SPF, DKIM, DMARC, clé IAM), base de production et rôles, `CRON_SECRET`, comptes seven et Key Manager ; **Claude** : suite de la 3.12 (plan prêt, D77) ; **ensemble** : tests de réception (Gmail, Outlook, Proton, Apple), panne d'e-mail simulée |
| 4. Contenu et langues | `check:i18n` vert (parité des clés) | §1 de ce document ; **Cat** : lien « Situation urgente » oui ou non (3.7) |
| 5. Légal | Mention IA au pied de page (texte en attente du juriste) | **Cat et juriste** : pages légales par pays, politique ; **Sady** : DPA signés au nom de la société (Vercel, Scaleway, Upstash, Plausible, seven ; messagerie `[À DÉFINIR]`) |
| 6. Mesure | Aucun cookie, aucun script tiers (`check:third-party`) | **Claude** : story 5.2 (ci-dessous) ; **Sady** : compte Plausible UE |
| 7. Qualité | 404, 500, favicon, image de partage FR/EN ; axe 0 violation ; Lighthouse accessibilité 100, performance 96 à 100 | **Claude** : fin de la 5.3 automatisée (LCP mobile 2,0 à 2,8 s à améliorer) ; **Sady** : VoiceOver, NVDA, mobile réel ; **Sady et Cat** : tests utilisateurs (5.4) ; **Cat** : médias encore « à valider » (`docs/assets-manifest.md` : 5 validés, 4 en attente) |
| 8. Exploitation | — | **Sady** : surveillance de disponibilité, sauvegardes Scaleway et **restauration testée**, personne de garde, procédure en cas de fuite (`docs/rgpd/procedures.md`) |
| 9. Lancement en douceur | — | **Sady et Cat** : cercle restreint (date, liste, canal de retour), puis ouverture générale |

## 3. Les stories du lot F

| Story | État | Peut commencer ? |
|---|---|---|
| **5.2 Mesure et Search Console** | Rien de codé | **Oui, maintenant**, désactivée sans variable : Plausible servi par notre domaine (réécriture), événements `Entrée`, `Langue`, `Partage` sans identifiant, pages vues sans paramètres, **`/*/contact/appel/*` jamais compté** (le jeton partirait sinon), modèle de rapport mensuel. Le compte Plausible et Search Console attendent le domaine (Sady). |
| **5.3 Accessibilité et performance** | Pré-passe faite (PR n° 80) ; césure des titres en cours dans `~/maison-triona-cesure` (D73) | Les parties automatisées, oui (après la césure) ; VoiceOver, NVDA et mobile réel : Sady |
| **5.4 Tests utilisateurs** | Protocole écrit (`docs/usability-protocol.md`) | Quand les textes français sont validés par Cat : 5 participants (2 seniors, 2 enfants adultes aidants, 1 utilisateur de lecteur d'écran), sur la préproduction, seuils fixés avant |
| **5.5 Checklist et mise en production** | 0 / 45 | Après la société inscrite, les DPA et `check:content` vert |

## 4. Calendrier proposé jusqu'à l'ouverture

| Quand | Quoi |
|---|---|
| Fin novembre 2026 | 5.2 codée (désactivée) ; suite de la 3.12 dès la fusion de la 3.11 ; fin de la 5.3 automatisée |
| Décembre 2026 | Cat valide les textes français page par page ; relecture anglaise ; décision sur la typographie (PR n° 83) et le pied de page ; médias restants validés ; Sady prépare DNS, TEM, Scaleway, Plausible, seven en mode essai |
| Décembre 2026 | Tests utilisateurs (5.4) sur la préproduction, corrections des bloquants |
| Janvier 2027, société inscrite | DPA signés ; mentions légales et politique remplies avec le juriste ; variables de production ; tests de réception ; restauration testée |
| Janvier 2027 | Cercle restreint, puis ouverture générale (`SITE_INDEXABLE=true`, sitemap soumis) |

## 5. À demander dès maintenant

- **À Cat** : la validation des textes français (le plus long) ; les informations de la société pour les mentions légales dès qu'elles existent ; le lien « Situation urgente » (oui ou non) ; les quatre médias en attente ; son avis sur le pied de page resserré (D74) et la typographie Inter (PR n° 83, D76).
- **Au juriste** : bases légales, durées de conservation (D05), mention IA, SMS (consentement, STOP en Belgique, D77 n° 6), vocabulaire réglementé des services, « Notre indépendance ».
- **Au relecteur anglais** : les 32 sections, après la validation française.
