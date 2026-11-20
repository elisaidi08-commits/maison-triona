# Mesure d'audience et Search Console (story 5.2)

> **Statut** : codée le 20/11/2026, **désactivée** tant que `PLAUSIBLE_DOMAIN` n'est pas posée sur Vercel. Règles : `docs/privacy.md` §3 ; registre RGPD T7.

## Comment ça marche

1. Le navigateur envoie une **page vue** à chaque changement de page, et un **événement** quand on clique sur un élément marqué `data-mesure` (composant `src/components/mesure/Mesure.tsx`, un seul écouteur délégué).
2. L'envoi va **à notre domaine seulement** (`POST /api/m`, `sendBeacon`, aucun cookie). Aucun script de Plausible n'est chargé, même servi par notre domaine.
3. Notre serveur (`src/app/api/m/route.ts`) filtre de nouveau, puis transmet à Plausible **après** la réponse (`POST https://plausible.io/api/event`, Events API lue le 20/11/2026), avec le navigateur (`User-Agent`) et l'IP du visiteur (`X-Forwarded-For`). Plausible en tire une empreinte quotidienne pour compter les visiteurs uniques, sans garder l'IP. Sans IP réelle, il écarterait l'événement comme un robot.
4. La route répond toujours **204**, sans corps, et ne journalise rien. Elle ne garde que les envois **venus de notre site** (`Sec-Fetch-Site: same-origin` ou `Origin` du site) et **60 par minute au plus par réseau** (empreinte de l'IP avec la clé du jour, Upstash, comme la demande de lien) : un autre site ne peut pas faire compter des événements par ses visiteurs.
5. **Coupée sur les aperçus Vercel** (`VERCEL_ENV` autre que `production`) : une visite de test ne compte jamais.

**Filtres** (`src/lib/mesure/evenements.ts`, appliqués dans le navigateur **et** sur le serveur) :
- chemin sans paramètres ni ancre (`/fr/contact?service=…&s=…` devient `/fr/contact`) ;
- **liste fermée des pages** (`PATHNAMES`, deux langues) : tout autre chemin sous `/fr` ou `/en` est compté comme `/404` ;
- un **événement** est rattaché à la racine de la langue (`/fr`, `/en`), jamais à la page : « Partage e-mail » ne dit pas quelle page de service a été partagée ;
- jamais compté : les liens personnels de réservation `/<langue>/contact/appel/<jeton>…` (le jeton ne quitte pas le navigateur), le coffre, la démo, tout chemin hors de `/fr` et `/en` ;
- référent : l'**origine** d'un site externe seulement, et seulement à l'arrivée sur le site ;
- événements : liste fermée, ci-dessous. Tout autre code est ignoré.

## Événements

Le choix est dans le **nom** de l'événement, pas dans une propriété : les propriétés personnalisées de Plausible demandent l'offre Business (doc lue le 20/11/2026). Le tableau de bord donne les mêmes totaux.

| Code (`data-mesure`) | Nom dans Plausible | Où |
|---|---|---|
| `entree:conciergerie` | Entrée conciergerie | Choix 01 de l'accueil |
| `entree:grand-age` | Entrée grand âge | Choix 02 |
| `entree:enfants` | Entrée enfants | Choix 03 |
| `entree:indecis` | Entrée demande particulière | Choix 4 |
| `langue:fr`, `langue:en` | Langue fr, Langue en | Sélecteur de l'en-tête et du menu (langue inactive), suggestion de langue |
| `partage:email`, `partage:lien` | Partage e-mail, Partage lien | « Envoyer à un proche », « Copier le lien » |

Les demandes envoyées se lisent dans les pages vues de `/fr/contact/merci` et `/en/contact/merci` (aucune donnée de la demande).

## À faire par Sady (pour l'activer)

1. Compte **Plausible** (hébergé dans l'UE ; pays des données à vérifier à la signature du DPA), site `maisontriona.com`.
2. Dans Plausible, créer un **objectif d'événement personnalisé** pour chacun des huit noms ci-dessus (orthographe exacte, accents compris).
3. Vercel (production) : `PLAUSIBLE_DOMAIN=maisontriona.com` (nom du site dans Plausible, sans `https://`), avec `SITE_URL` déjà posée ; redéployer (la variable est lue au build).
4. Vérifier : une visite de test apparaît dans le tableau de bord en temps réel ; dans l'onglet Réseau du navigateur, seules des requêtes vers notre domaine.

## Search Console

Propriété **de domaine** `maisontriona.com`, vérifiée par un enregistrement DNS TXT (aucune balise, aucun script dans nos pages), compte de la maison avec A2F (D64 n° 9). Soumettre `https://maisontriona.com/sitemap.xml` **à l'ouverture seulement** (le site est `noindex` avant, D62).

## Rapport mensuel (modèle)

À remplir le premier lundi du mois, en totaux seulement, sans objectif de classement promis.

| Rubrique | Ce mois | Mois précédent | Remarque |
|---|---|---|---|
| Visiteurs uniques | | | |
| Pages les plus vues (5) | | | |
| Choix d'entrée (4 totaux) | | | |
| Demandes envoyées (pages de remerciement vues) | | | |
| Langue : FR, EN, bascules | | | |
| Partages (e-mail, lien) | | | |
| Sources (5 premières origines) | | | |
| Search Console : clics, impressions, 5 requêtes principales | | | |
| Une décision à prendre ou à surveiller | | | |

## Relecture sécurité (20/11/2026)

`security-privacy-reviewer` : rien de bloquant. Corrigé avant la PR : texte de la politique publiée (« servi depuis notre domaine » remplacé par la transmission par notre serveur, version `2026-11-20.2`), envois d'autres sites refusés et débit limité, aperçus coupés, événements à la racine de la langue, liste fermée des pages, risque n° 12 (recoupement) dans `docs/privacy.md` §8, Vercel parmi les destinataires (registre T7), `PLAUSIBLE_DOMAIN` dans `.env.example`. **À trancher par Sady** : tronquer l'IP avant de l'envoyer (risque n° 12). **Au juriste** : exemption de consentement avec envoi de l'IP à chaque événement.

## Vérification du 20/11/2026

Build local avec `PLAUSIBLE_DOMAIN`, `/api/m` intercepté dans le navigateur (rien n'est parti vers Plausible) : page vue de `/fr/contact?service=grand-age&s=salon` envoyée comme `/fr/contact`, référent réduit à `https://www.google.be` ; clic sur le choix 01 (`entree:conciergerie`) ; bascule de langue (`langue:en`) ; partage par e-mail (`partage:email`) ; **aucun envoi** sur `/fr/contact/appel/<jeton>` ; **aucun domaine tiers** contacté. Sans `PLAUSIBLE_DOMAIN` (build de la CI) : aucun envoi (`tests/e2e/mesure.spec.ts`).
