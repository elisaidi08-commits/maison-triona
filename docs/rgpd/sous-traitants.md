# Sous-traitants, destinataires et transferts (articles 28 et 44 à 49 du RGPD)

> **Statut** : brouillon du 06/11/2026. Aucun contrat n'est encore signé : ils le seront **au nom de la société, après son inscription** (janvier 2027, D38, D47), avant l'ouverture. Choix des prestataires : D07 (Scaleway), D47 (Vercel Pro, Plausible), D57 (réservation d'appel). Détail des options : `docs/trust-contact-launch.md` annexe D, `docs/privacy.md` §7.

## 1. Sous-traitants (ils traitent des données pour le compte de la maison)

| Prestataire | Rôle | Données | Où | Transfert hors UE | Contrat de traitement | Statut |
|---|---|---|---|---|---|---|
| **Vercel Inc.** (États-Unis) | Hébergement du site, fonctions (région Paris, `cdg1`), tâches planifiées | Demandes en transit le temps du chiffrement ; journaux techniques (adresse des pages, date, IP, navigateur) ; liens de réservation dans les journaux | Fonctions à Paris ; société américaine | Oui : cadre UE–États-Unis (décision d'adéquation du 10 juillet 2023), si la société y est certifiée ; sinon clauses contractuelles types | À signer (offre Pro, D35, D47) | Retenu |
| **Scaleway SAS** (France) | Base du coffre (PostgreSQL gérée), Key Manager, e-mails transactionnels (TEM) | Demandes et appels chiffrés, colonnes de tri, journal d'accès, boîte d'envoi ; adresses e-mail pour les envois | France | Non | À signer | Retenu (D07) |
| **Upstash Inc.** (États-Unis) | Limitation de débit des formulaires | Empreinte d'IP (clé changée chaque jour), empreinte de l'adresse de confirmation, compteurs (24 h au plus) | Région UE ; société américaine | Possible : cadre UE–États-Unis ou clauses types `[À VÉRIFIER à la signature]` | À signer | Proposé |
| **Plausible Insights OÜ** (Estonie) | Mesure d'audience sans cookie | Empreinte quotidienne (IP et navigateur, clé effacée en 24 h), totaux | UE (données en Allemagne `[À VÉRIFIER à la signature]`) | Non | À signer | Retenu (D47) |
| **Fournisseur de SMS** | Confirmation et rappel des appels, sur demande de la personne | Numéro, texte du message | UE exigée | Non attendu | À signer | `[À TRANCHER]` (pistes : Sweego, seven, GatewayAPI, D57) |
| **Google** (agenda de Cat) | Reçoit les invitations des appels | Prévu : titre neutre, heure, lien vers le coffre ; **aucun nom ni coordonnée** `[À VÉRIFIER en story 3.10 ; à revoir si la messagerie est chez Google]` | Société américaine | Oui | Seulement avec un **compte professionnel** (Google Workspace et son avenant de traitement) ; un compte personnel n'en offre pas | Proposé (D57) |
| **Messagerie de la maison** (`contact@`, `confidentialite@`) | Échanges avec les familles et les professionnels | Tout ce qui s'écrit par e-mail | `[À DÉFINIR]` (préférer un hébergeur européen) | Selon le choix | À signer | `[À TRANCHER]` |
| **Comptable** | Tenue de la comptabilité | Factures de commissions, données des professionnels | Belgique `[À DÉFINIR]` | Non | Contrat de sous-traitance ou responsable distinct, selon sa mission `[À VALIDER avec le comptable]` | `[À DÉFINIR]` |
| **CMS** (Sanity, après l'ouverture, D45) | Textes publics du site | **Aucune donnée personnelle** | Backend UE (Belgique) | À vérifier au branchement | À signer s'il y a des comptes d'édition | Plus tard |

**Sady (maintenance technique)** : accès au coffre et à une copie de la clé ; engagement de confidentialité écrit.

## 2. Ce que chaque contrat de traitement doit contenir (article 28.3)

À vérifier sur chaque contrat avant la signature, et à noter dans la colonne « Contrat » ci-dessus (date, version, lien vers la copie).

- [ ] L'**objet**, la **durée**, la **nature** et la **finalité** du traitement, les **types de données** et les **catégories de personnes** sont décrits.
- [ ] Le prestataire n'agit **que sur instructions documentées** de la maison, y compris pour les transferts hors UE, et la prévient si une instruction lui paraît contraire au RGPD.
- [ ] Ses personnes sont tenues à la **confidentialité**.
- [ ] Les **mesures de sécurité** sont décrites (article 32).
- [ ] La liste de ses **propres sous-traitants** est fournie, la maison est prévenue de tout changement, avec la possibilité de s'y opposer, et ils sont tenus aux mêmes obligations (article 28.4).
- [ ] Il **aide la maison** à répondre aux demandes des personnes, à assurer la sécurité, à gérer une violation et à réaliser l'AIPD (articles 32 à 36).
- [ ] Il **notifie les violations** sans délai, avec un délai chiffré (24 à 48 h souhaitées).
- [ ] Il **supprime ou restitue** les données à la fin du contrat.
- [ ] Il permet les **audits** ; à défaut, ses rapports ISO 27001 ou SOC 2 sont acceptés comme éléments de preuve.
- [ ] Le **lieu de stockage** et les **transferts** hors UE sont indiqués, avec leur garantie.

## 3. Transferts hors de l'Union européenne

| Vers | Qui | Garantie | À faire |
|---|---|---|---|
| États-Unis | Vercel, Upstash, Google | Cadre de protection des données UE–États-Unis pour les sociétés certifiées ; sinon clauses contractuelles types | Vérifier la certification de chaque société sur la liste officielle du cadre **le jour de la signature** ; noter la date |
| Suisse | Professionnel établi en Suisse (T4) | Décision d'adéquation de l'UE pour la Suisse | — |

La politique de confidentialité le dit aux visiteurs (section « Hors de l'Union européenne »).

## 4. Destinataires qui ne sont pas des sous-traitants

| Destinataire | Rôle | Ce qu'il reçoit | Encadrement |
|---|---|---|---|
| **Professionnel choisi** (indépendant ou maison partenaire) | Responsable distinct de sa relation avec la famille | Ce qui est utile pour rencontrer la famille, avec son accord (T4) | Clause de confidentialité et de protection des données dans la convention `[À RÉDIGER]` |
| **Administration fiscale** | Contrôle | Pièces comptables, sur demande | Obligation légale |
| **Banque** | Paiements des commissions | Coordonnées bancaires des professionnels | Obligation contractuelle et légale |
| **APD** | Autorité de contrôle | Notifications de violation, réponses aux demandes | Obligation légale |
