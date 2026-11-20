# Clés du coffre des demandes · procédure

> **Story 3.2, partie B** (18/11/2026, relecture sécurité comprise) ; lecture, export, rotation dans le coffre et conservation planifiée : **partie D** (§8 et §9). À lire avant de générer, copier, remplacer ou détruire une clé du coffre, et avant de brancher le site sur la base. Cadre : D07 (sealed box libsodium), D05 (conservation), `docs/architecture.md` §6.5, `docs/privacy.md` §5.
> **La règle à retenir** : si **tous** les paquets sont perdus, ou toutes les phrases oubliées, la lecture des demandes est perdue pour toujours. Personne ne peut les rouvrir : ni Vercel, ni Scaleway, ni Sady, ni Claude.

---

## 1. Principe

| Élément | Où il vit | Secret ? |
|---|---|---|
| **Clé publique** (32 octets, 44 caractères en base64) | Variable `VAULT_PUBLIC_KEY` du projet Vercel ; champ `publicKey` de chaque paquet | Non. Elle permet seulement de **sceller** |
| **Clé privée** | Uniquement **chiffrée**, dans les paquets ; en clair, seulement dans la mémoire du navigateur de l'administratrice ou de l'administrateur, le temps de la page de lecture d'une demande (§8) | Oui |
| **Paquets** (`*.json`) | **Un par personne** : celui de Cat, celui de Sady. Même paire de clés, chacun chiffré par la phrase de son détenteur. Chacun garde le sien hors ligne, et peut en garder une seconde copie | Protégé par la phrase |
| **Phrases de passe** | Une par personne, connue d'elle seule ; une trace écrite sur papier, rangée **ailleurs** que le paquet | Oui |

- Le serveur reçoit la demande, la **scelle** avec la clé publique (`crypto_box_seal`) et n'écrit que les octets scellés. Il ne peut pas les rouvrir : il n'a jamais la clé privée.
- Chaque paquet contient le sel et les paramètres d'Argon2id (3 passes, 256 Mio : niveau « moderate » de libsodium), un nonce, la clé privée chiffrée par `crypto_secretbox` et la clé publique. Sans sa phrase, il ne révèle rien.
- Deux paquets, deux phrases : un paquet perdu ou une phrase oubliée ne coûte rien, l'autre ouvre encore le coffre (§4). Personne n'a à connaître la phrase de l'autre.
- Restent **en clair**, pour le tri : type, date, service, pays, langue de réponse, urgence, origine, statut, échéance de conservation, version de la politique de confidentialité acceptée. Tout le reste est scellé : nom, e-mail, téléphone, « pour qui », créneau, mot libre.
- Jamais une clé privée, un paquet ni une phrase dans le dépôt, une variable d'environnement, un e-mail, une messagerie, un ticket, une capture d'écran ou un journal.

## 2. Générer les clés (une fois, avant l'ouverture de l'envoi)

Une **paire par environnement** : la production a la sienne ; une préproduction avec sa propre base aurait une autre paire, jamais celle de la production.

1. Poste de confiance, dépôt à jour, `npm ci` fait. Le script n'a besoin d'aucun réseau : couper le Wi-Fi est une bonne habitude. Cat et Sady sont là tous les deux, chacun avec son support (clé USB chiffrée, par exemple).
2. Chacun choisit sa phrase : **16 caractères au moins** ; une suite de cinq ou six mots tirés au hasard se retient mieux et résiste mieux qu'un mot de passe court. Les deux phrases doivent différer.
3. **Premier paquet** (Sady tape sa phrase) ; chemins entre guillemets, le nom des volumes peut contenir des espaces :
   ```bash
   npm run vault:keys -- "/Volumes/COFFRE SADY/maison-triona-coffre-2026-11-sady.json"
   ```
   - Le script **refuse** tout chemin dans le dépôt (liens symboliques et casse compris), tout fichier existant (il n'écrase jamais), tout dossier absent et tout chemin qui ne finit pas par `.json`.
   - La phrase se tape **deux fois**, rien ne s'affiche. Jamais en argument : si elle a été tapée dans la commande, elle est dans l'historique du terminal, il faut en choisir une autre.
   - Le fichier est écrit en lecture et écriture réservées au compte (0600). Le script affiche la **clé publique**, seule, sur la dernière ligne.
4. **Second paquet, même paire** : Sady tape sa phrase (ouverture du premier paquet), puis Cat tape la sienne, deux fois :
   ```bash
   npm run vault:keys -- --ajouter "/Volumes/COFFRE SADY/…-sady.json" "/Volumes/COFFRE CAT/maison-triona-coffre-2026-11-cat.json"
   ```
   La clé publique affichée doit être **la même** qu'à l'étape 3.
5. Chacun peut copier **son** paquet sur un second support à lui ; comparer les copies : `shasum -a 256 <copie 1> <copie 2>` doit donner deux empreintes identiques.
6. Ne laisser aucune copie intermédiaire (Téléchargements, Bureau, Corbeille). Ranger les supports de Cat et de Sady dans des lieux différents ; la trace écrite de chaque phrase, ailleurs encore.
7. Dès que `/coffre` est en service : chacun ouvre une demande de test **avec son paquet** (§8), une fois, pour vérifier paquet et phrase.

## 3. Brancher le site sur le coffre

### 3.1 Un rôle qui ne sait qu'insérer : `site_public`

Le site public écrit des demandes, il n'a jamais besoin d'en lire une. Son compte PostgreSQL a donc le rôle **`site_public`** (`db/roles/site_public.sql`) : `USAGE` sur le schéma `public`, `INSERT` sur `vault_requests` et, depuis la story 3.3, `INSERT` sur `outbox` limité aux colonnes d'une notification (`id`, `template`, `request_id`, `priority` : la notification de sa demande, écrite dans la même transaction), **rien d'autre**. L'état, les tentatives, les dates, l'identifiant du prestataire et les alertes restent au rôle `envoi`. Ni `SELECT` (l'identifiant d'une demande est tiré par le serveur, l'insertion se fait sans `RETURNING`), ni `UPDATE`, ni `DELETE`, ni le journal d'accès. Un serveur compromis ou une injection ne peut donc ni lire, ni modifier, ni effacer le coffre. Prouvé par `tests/integration/vault-role.test.ts` et `tests/integration/outbox-roles.test.ts`.

Depuis la story 3.10 (réservation d'appel), il calcule aussi les créneaux et enregistre une réservation : **lecture** des trois tables de disponibilités ; sur `bookings`, lecture des seules colonnes `id`, `access_token_id`, `starts_at`, `ends_at`, `slot`, `status` (**jamais** `sealed`, ni la version de la politique, ni les dates de création et de conservation) et insertion d'une réservation (sans `status` : elle naît « confirmée ») ; sur `booking_tokens`, lecture des colonnes de vérification (empreinte, usage, dates) et modification de la seule colonne `used_at`. Ni effacement. Prouvé par `tests/integration/reservations-schema.test.ts`.

Depuis la story 3.9 (demande de lien, migration `0011_demande_de_lien.sql`), il **crée un lien d'accès** (insertion de `id`, `token_hash`, `purpose`, `email_hmac`, `created_at`, `expires_at` ; jamais `used_at` ni `revoked_at`) et **annule les liens vivants d'une empreinte d'adresse** par la seule fonction `revoke_live_access_links(empreinte, instant)` (`SECURITY DEFINER`, chemin de recherche figé, exécution retirée à `PUBLIC`) : ni lecture des empreintes `email_hmac`, ni écriture de `revoked_at` sur un autre lien. Une annulation ne se retire jamais (déclencheur, quel que soit le rôle). L'e-mail d'accès entre dans la boîte d'envoi par l'insertion déjà permise (gabarit `booking_access`, sans demande ni priorité : contrainte). **Rejouer `site_public.sql` après la migration 0011** : sans ce passage, la demande de lien échoue (« L'envoi n'a pas abouti », `[lien] failed:vault`). Prouvé par `tests/integration/demande-de-lien.test.ts`.

Depuis la story 3.11 (déplacer et annuler, migration `0014_deplacer_annuler.sql`, après relecture sécurité), il n'a **aucun droit d'insertion ni d'écriture sur `bookings`**, **aucune lecture ni écriture directe sur `booking_tokens`** (seule reste l'insertion d'un lien d'accès de la 3.9, sans `RETURNING`) et n'exécute plus `issue_manage_token` : il **lit** en plus `bookings.sequence`, et passe par des fonctions `SECURITY DEFINER` (chemin de recherche figé, noms qualifiés, droit retiré à PUBLIC) qui exigent l'empreinte du jeton qu'il a reçu : `find_booking_token` et `lock_booking_token` (retrouver, verrouiller un lien), **`book_slot_as_guest`** (réserver : lien d'accès vivant, appel inséré dans les bornes de la base, lien consommé et **lien de gestion** créé dans la même transaction), `lock_call_as_guest`, `move_booking_as_guest` et `cancel_booking_as_guest` (verrouiller, déplacer, annuler « par la personne » l'appel d'un lien de gestion valable, et lui seul). Ni qualification, ni annulation au nom de la maison. Des déclencheurs, sous tout rôle, bornent une réservation et un déplacement (durée et pause des réglages, délai minimal, horizon, plafond du jour ; appel confirmé à venir pour un déplacement). Chaque fichier de rôle commence par `revoke create on schema public from public`, posent la séquence de l'invitation (aucun rôle n'écrit `sequence`) et recalculent l'échéance de conservation. Ni le contenu scellé, ni l'échéance de conservation, ni le rattachement ; aucun effacement. Prouvé par `tests/integration/gestion.test.ts`. **À rejouer** : `db/roles/site_public.sql` et `db/roles/coffre.sql` après `npm run db:migrate`.

1. Avec le compte **administrateur** de l'instance : appliquer les migrations (`DATABASE_URL=<URL administrateur> npm run db:migrate`), puis le rôle : `psql "<URL administrateur>" -f db/roles/site_public.sql`. Le fichier est rejouable ; il n'est pas dans les migrations automatiques, et il se rejoue après chaque migration qui ajoute une table que le site doit remplir. C'est le cas de **`0006_boite_envoi.sql`** (story 3.3) : sans ce nouveau passage, la notification ne s'écrit pas, chaque demande est gardée sans elle et `[demande] failed:outbox` apparaît dans les journaux (§3.3).
2. Créer le compte de connexion du site (sur Scaleway : console de l'instance, utilisateur sans aucun droit donné par la console) et lui donner le rôle : `GRANT site_public TO <compte du site>;`. Mot de passe long et aléatoire, jamais dans le dépôt. La façon exacte de créer un compte sans droit sur l'offre gérée de Scaleway reste **à vérifier sur l'instance**.
3. Vérifier, connecté avec ce compte : `SELECT count(*) FROM vault_requests;` doit être **refusé** (`permission denied`).

### 3.2 Un second rôle pour l'espace du coffre : `coffre` (partie C)

L'espace `/coffre`, la tâche de conservation (§9) et le script des comptes (`npm run coffre:compte`) se connectent avec **un autre compte**, qui a le rôle **`coffre`** (`db/roles/coffre.sql`) : `USAGE` sur le schéma ; lecture, écriture et effacement sur les six tables de Better Auth (`"user"`, `"session"`, `"account"`, `"verification"`, `"twoFactor"`, `"rateLimit"`) ; sur `vault_requests`, **lecture, effacement et modification de la seule colonne `frozen`** (gel ; partie D) : ni insertion, ni modification du contenu scellé, de l'échéance ou du statut ; **`INSERT` et `SELECT` seulement** sur `vault_access_log` (le journal ne se modifie ni ne s'efface) ; depuis la story 3.8 B, les **disponibilités** : lecture de `booking_settings`, `availability_rules` et `availability_exceptions`, modification des seules colonnes de réglage (jamais le fuseau, ni insertion ni effacement de la ligne), ajout et retrait de plages et d'absences, et pour une absence seulement `active` (jour férié décoché) ; depuis la story 3.3 (suites C), la **lecture de cinq colonnes de la boîte d'envoi** `outbox` (`template`, `status`, `request_id`, `next_attempt_at`, `created_at`), pour compter sur l'accueil les messages en retard ou en échec et les demandes sans notification : ni l'identifiant du message (il relierait une ligne `[envoi] <statut> <id>` des journaux à une demande), ni celui du prestataire, ni le code d'erreur, ni les tentatives, et aucune écriture (l'envoi reste au rôle `envoi`, §3.3). Ni la table des migrations, ni la création d'objet. Les disponibilités sont prouvées par `tests/integration/disponibilites-schema.test.ts`, qui vérifie aussi que `site_public` ne fait que les lire (depuis la story 3.10). Depuis la story 3.10, le rôle **lit `bookings`** (contenu scellé compris, ouvert dans le navigateur par l'agenda de la 3.13) et **insère un jeton** de lien de réservation (empreinte, usage, dates ; « Créer un lien de réservation ») ; ni lecture, ni modification des jetons, ni écriture des réservations ; pour la conservation planifiée (migration 0010), effacement des réservations échues et des jetons expirés, avec la seule lecture de l'identifiant et de l'expiration des jetons (`tests/integration/reservations-schema.test.ts`, `conservation.test.ts`). Depuis la story 3.13 (agenda des appels, migration 0013), il **modifie deux colonnes de `bookings`**, et elles seules : `status` (« fait » ou « pas de réponse » ; un déclencheur refuse tout autre changement, sous tout rôle) et `request_id` (rattachement à une demande) ; `site_public` ne reçoit rien (`tests/integration/agenda-schema.test.ts`). Depuis la story 3.11 (migration 0014), il **déplace** un appel (modification de `starts_at`, `ends_at`, `slot` ; `status` lui est déjà accordé pour « annulé par la maison ») et l'**efface** (droit à l'effacement : `DELETE` déjà accordé pour la conservation, sur `bookings` et `booking_tokens`) ; il ne peut ni écrire la séquence, ni créer un lien de gestion, ni appeler aucune fonction du site public (`tests/integration/gestion.test.ts`). Pour la conservation planifiée (D78), il remet à NULL le contenu scellé d'un appel annulé dont le créneau d'origine est fini (`UPDATE (sealed)`, borné par le déclencheur `bookings_sealed_guard` : jamais un contenu écrit, jamais un appel actif ; `tests/integration/conservation.test.ts`). Prouvé par `tests/integration/coffre-roles.test.ts`, qui vérifie aussi que `site_public` ne lit, n'écrit ni n'efface **aucune** table de Better Auth ; toute l'authentification y est testée sous ce rôle.

1. Avec le compte administrateur, **après** `npm run db:migrate` : `psql "<URL administrateur>" -f db/roles/site_public.sql -f db/roles/coffre.sql`. Les deux fichiers sont rejouables ; les rejouer après chaque migration qui ajoute une table.
2. Créer le compte de connexion du coffre, distinct de celui du site, et lui donner le rôle : `GRANT coffre TO <compte du coffre>;`. Mot de passe long et aléatoire, jamais dans le dépôt.
3. Vérifier, connecté avec ce compte : `UPDATE vault_requests SET status = status;`, `DELETE FROM vault_access_log;` et `SELECT id FROM outbox;` doivent être **refusés** ; `SELECT count(*) FROM outbox WHERE status = 'failed';` doit **passer**.

### 3.3 Un troisième rôle pour l'envoi des e-mails : `envoi` (story 3.3)

Le premier essai d'envoi (juste après la demande) et la tâche planifiée `/api/cron/envoi` se connectent avec **un troisième compte**, qui a le rôle **`envoi`** (`db/roles/envoi.sql`) : `USAGE` sur le schéma ; lecture, insertion, modification et effacement de la boîte d'envoi `outbox`, **rien d'autre**. Aucun droit sur les demandes, le journal d'accès ni les tables de Better Auth. La boîte d'envoi ne contient d'ailleurs ni adresse ni contenu : un gabarit, des identifiants, des dates et des statuts. Prouvé par `tests/integration/outbox-roles.test.ts`.

1. Avec le compte administrateur, **après** `npm run db:migrate` (migration `0006_boite_envoi.sql`) : `psql "<URL administrateur>" -f db/roles/site_public.sql -f db/roles/coffre.sql -f db/roles/envoi.sql`. Les trois fichiers sont rejouables. **Rejouer `site_public.sql` est indispensable** : c'est lui qui donne au site le droit d'écrire la notification ; sans lui, chaque demande est gardée sans notification (`[demande] failed:outbox`), et Cat n'est prévenue d'aucune.
2. Créer le compte de connexion de l'envoi, distinct des deux autres, et lui donner le rôle : `GRANT envoi TO <compte de l'envoi>;`. Mot de passe long et aléatoire, jamais dans le dépôt. Son URL va dans `ENVOI_DATABASE_URL` (§3.4).
3. Vérifier, connecté avec ce compte : `SELECT count(*) FROM outbox;` doit **passer**, `SELECT count(*) FROM vault_requests;` doit être **refusé**. Connecté avec le compte du site : `SELECT count(*) FROM outbox;` doit être **refusé**.

### 3.4 Trois URL de connexion

| Variable | Compte | Utilisé par | Droits |
|---|---|---|---|
| `DATABASE_URL` | compte du site (`site_public`) | Server Action du formulaire | Insertion seule (demandes, notifications) |
| `COFFRE_DATABASE_URL` | compte du coffre (`coffre`) | Espace `/coffre` (connexion, sessions, liste, lecture, gel, effacement), tâche de conservation et `npm run coffre:compte` | Tables de Better Auth ; lecture, gel et effacement des demandes ; journal en insertion et lecture |
| `ENVOI_DATABASE_URL` | compte de l'envoi (`envoi`) | Premier essai d'envoi (`after()`) et tâche planifiée `/api/cron/envoi` | Boîte d'envoi seulement |
| URL administrateur | propriétaire du schéma | `npm run db:migrate` et `db/roles/*.sql`, à la main | Tous ; **jamais** dans une variable de Vercel |

Trois pools distincts dans le code (`getPool`, `getCoffrePool`, `getEnvoiPool`, `src/lib/db/pool.ts`) : le site public n'emprunte jamais le compte du coffre. Il **emprunte en revanche celui de l'envoi** : la Server Action du formulaire lance le premier essai d'envoi avec `after()`, après la réponse, avec le pool du rôle `envoi` et le transport TEM (`src/lib/outbox/deps.ts`). La fonction serveur du formulaire a donc accès à `ENVOI_DATABASE_URL` et à `TEM_SECRET_KEY` ; elle ne peut toujours ni lire, ni modifier, ni effacer une demande (le rôle `envoi` n'a aucun droit sur `vault_requests`). Risque résiduel : `docs/privacy.md` §8. Sur un déploiement, une `COFFRE_DATABASE_URL` identique à `DATABASE_URL` est refusée au démarrage du coffre, et une `ENVOI_DATABASE_URL` identique à l'une des deux autres est refusée à l'envoi.

TLS est exigé sur **tout** déploiement Vercel (production, aperçus, branches) : sans `DATABASE_CA_CERT`, la connexion est refusée. Délais : 5 s pour se connecter, 5 s par requête ; au-delà, l'envoi échoue (« L'envoi n'a pas abouti ») et le visiteur garde sa saisie.

### 3.5 Poser `VAULT_PUBLIC_KEY`

1. Vercel → projet → *Settings* → *Environment Variables* : `VAULT_PUBLIC_KEY` = la clé publique affichée, environnement **Production** seulement. Vérifier qu'elle est identique au champ `publicKey` des paquets.
2. Le formulaire n'enregistre une demande que si **`DATABASE_URL` et `VAULT_PUBLIC_KEY`** sont posées. Sans l'une des deux, il garde l'état « L'envoi des demandes ouvrira bientôt » et n'écrit rien.
3. Redéployer : Vercel n'applique une variable modifiée qu'aux nouveaux déploiements.
4. Contrôle : une demande de test arrive sur `/contact/merci` et apparaît dans le coffre. Une clé mal copiée fait échouer chaque envoi (« L'envoi n'a pas abouti », statut `failed:config` dans les journaux, sans aucun contenu).

## 4. Que faire si…

| Situation | Conséquence | Que faire |
|---|---|---|
| **Un paquet est perdu ou une phrase oubliée**, l'autre paquet et sa phrase sont intacts | Rien n'est perdu : l'autre paquet ouvre le coffre | Refaire le paquet de la personne avec `--ajouter`, à partir du paquet restant (§2.4), avec une phrase neuve. Si le support a pu être **volé** plutôt qu'égaré, traiter comme une compromission (ligne suivante, par prudence) |
| **Un paquet et sa phrase ont pu tomber entre d'autres mains** (vol, phrase vue ou tapée dans un outil en ligne) | Quiconque a les deux **et** un accès à la base ou à une sauvegarde peut lire les demandes | Changer de paire **sans attendre** (§5). C'est une violation de données au sens du RGPD : en parler aussitôt à Sady ; la notification à l'autorité de contrôle se fait sous 72 heures, sauf si la violation est peu susceptible d'engendrer un risque (RGPD, art. 33) |
| **Tous les paquets sont perdus, ou toutes les phrases oubliées** | Les demandes scellées avec cette paire sont **définitivement illisibles** ; seules les colonnes en clair restent (date, service, pays…) | 1. Générer une nouvelle paire (§2), poser la nouvelle `VAULT_PUBLIC_KEY`, redéployer : les demandes suivantes sont lisibles. 2. Les anciennes ne peuvent plus servir : les effacer depuis le coffre (page de la demande, « Effacer la demande », journalisé). Aucune récupération n'existe, inutile de la chercher |
| **Un détenteur s'en va** (fin de collaboration) | Il a son paquet et sa phrase | Changer de paire (§5) ; récupérer ou faire détruire son paquet |

## 5. Changer de paire (rotation)

1. Générer une nouvelle paire et ses deux paquets (§2), sous de nouveaux noms datés. **Ne jamais écraser un ancien paquet.**
2. Remplacer `VAULT_PUBLIC_KEY` sur Vercel, redéployer. Les demandes suivantes sont scellées avec la nouvelle clé.
3. **Garder les anciens paquets** tant qu'une demande scellée avec eux existe : jusqu'au plafond de conservation (D05, 12 mois proposés), plus la fenêtre des sauvegardes (7 jours, `docs/privacy.md` §5). Pour lire une demande, **déposer l'ancien et le nouveau paquet ensemble** (même phrase) ou l'un après l'autre (phrases différentes) : le coffre déverrouille chaque paquet et essaie chaque clé sur la demande ; une clé qui ne convient pas échoue aussitôt (§8).
4. Quand la dernière de ces demandes est effacée et la fenêtre de sauvegarde passée : détruire les anciens paquets et leurs copies (formatage du support) et noter la date.
5. Après une compromission, la rotation protège les demandes **à venir**, pas celles déjà scellées avec l'ancienne paire. Pour celles-là : les effacer dès qu'elles ne servent plus ; re-sceller les demandes encore utiles avec la nouvelle clé, dans le navigateur, est une fonction à prévoir avec le coffre (parties C et D), pas encore écrite.

## 6. Limites (à connaître)

- **Vercel voit la demande en clair** dans la fonction, le temps de la sceller (`docs/architecture.md` §6.5, `docs/privacy.md` §8). Le corps de la requête n'est jamais journalisé.
- Toutes les demandes scellées ont la **même taille** (16 Kio de texte complété, 16 432 octets) : la taille ne dit rien du message. Une demande plus longue est refusée ; la validation du formulaire l'empêche (la plus longue tient en moins de 14 Kio).
- Une phrase saisie reste quelque temps dans la mémoire du programme (JavaScript ne permet pas de l'effacer) : générer les clés sur un poste de confiance, fermer le terminal ensuite.
- Le déchiffrement dans le navigateur (partie D) exige `'wasm-unsafe-eval'` dans la CSP de `/coffre`, posé en partie D : libsodium s'y exécute en WebAssembly (`docs/architecture.md` §9.1).
- Pendant la lecture, la phrase, la clé privée et le texte déchiffré sont dans la mémoire du navigateur ; la clé est effacée en quittant la page, le texte seulement oublié (JavaScript ne permet pas d'effacer une chaîne). Lire sur un poste de confiance, fermer l'onglet après.

## 7. Comptes du coffre : création et réenrôlement (partie C)

Deux comptes nominatifs au plus (Cat, Sady), créés à la main avec `COFFRE_DATABASE_URL` (compte du coffre, §3.2). Les inscriptions sont fermées : aucun autre chemin ne crée un compte.

**Créer un compte**, en présence des deux personnes, sur un poste de confiance :

1. `npm run coffre:compte -- --nom "Prénom Nom" --email adresse@exemple.be`.
2. Le script **génère** le mot de passe (35 caractères, environ 148 bits) et l'affiche **une seule fois** : la personne l'enregistre aussitôt dans son gestionnaire de mots de passe, puis on ferme le terminal. Pour en choisir un soi-même : `--saisir` (saisie masquée et confirmée ; refusé sous 24 caractères). Jamais en argument.
3. **Dans les 24 heures** : se connecter sur `/coffre/connexion`, enrôler le TOTP (application d'authentification sur un appareil personnel : scanner le QR code, ou saisir le secret affiché à côté), noter les 10 codes de secours hors ligne, à part du mot de passe. Au-delà de 24 heures, l'activation du TOTP est refusée et il faut réenrôler (ci-dessous). Tant que le TOTP n'est pas enrôlé, la session ne donne accès qu'à l'enrôlement.
4. L'enrôlement est inscrit au journal d'accès (`totp_enrolled`) ; une page de consultation du journal dans le coffre reste à écrire (lecture par l'administrateur de la base d'ici là).

**Réenrôler** (téléphone perdu ou remplacé sans les codes de secours, délai de 24 heures dépassé, doute sur un mot de passe) :

1. Les deux personnes sont présentes ; la personne concernée confirme son identité à l'autre de vive voix, jamais par un message.
2. `npm run coffre:compte -- --reenroler --email adresse@exemple.be` : le compte est supprimé (sessions, secret TOTP, codes de secours, ancien mot de passe) puis recréé sous le même nom et la même adresse, avec un mot de passe **neuf** affiché une seule fois (`--saisir` possible).
3. Supprimer l'ancienne entrée « Maison Triona » de l'application d'authentification, puis enrôler le nouveau TOTP dans les 24 heures (étape 3 ci-dessus).
4. Les demandes ne sont pas touchées : elles appartiennent au coffre, pas au compte. Le paquet de clé et la phrase de passe (§2) ne changent pas.

Le journal d'accès garde l'adresse du compte comme acteur : il reste lisible après un réenrôlement.

## 8. Lire et exporter une demande (partie D)

1. Se connecter au coffre (mot de passe et code TOTP), sur un poste de confiance. Dans la liste, la date d'une demande mène à sa page, `/coffre/demandes/<identifiant>` (le lien de la notification e-mail mènera au même endroit).
2. La page montre les colonnes de tri. Pour le contenu : **déposer son paquet** (fichier `.json`, depuis son support hors ligne) et **taper sa phrase**, puis « Déverrouiller et lire ». **Ne jamais enregistrer la phrase de passe dans le gestionnaire de mots de passe du navigateur** (ni dans aucun autre) : si le navigateur propose de l'enregistrer, refuser (« Jamais pour ce site »). Avec le paquet sur le même poste, elle suffirait à lire toutes les demandes. Après une rotation (§5), déposer aussi l'ancien paquet : chaque paquet est essayé, puis chaque clé obtenue. Le déverrouillage prend une à deux secondes (Argon2id), la page reste immobile pendant ce temps.
3. Ce qui se passe : la clé privée est déchiffrée **dans le navigateur** ; le serveur ne remet que les octets scellés de la demande et inscrit `read` au journal (identifiant de la demande, jamais le contenu) ; la demande s'ouvre dans le navigateur. Ni la phrase, ni la clé privée, ni le texte ne partent au serveur, ni dans le stockage du navigateur. Les champs du formulaire sont vidés aussitôt.
4. La clé reste en mémoire **le temps de la page**, et jamais plus de **15 minutes sans interaction** : « Verrouiller », quitter la page (même vers le cache « Précédent » du navigateur), la recharger, ou 15 minutes sans clic ni touche l'efface (octets remplis de zéros) avec le texte affiché. Une autre demande redemande le paquet et la phrase.
5. **Exporter** (« Exporter en fichier texte ») : `export` est inscrit au journal, puis le navigateur compose et télécharge `demande-<identifiant>.txt` (colonnes de tri et contenu déchiffré, texte brut), sans le faire passer par le serveur ; si l'inscription au journal échoue, aucun fichier n'est créé. Sert à répondre à une demande d'accès ou de portabilité (`docs/rgpd/procedures.md`). Ce fichier est **en clair** : le transmettre par un canal sûr, ne pas le laisser dans Téléchargements, le supprimer (Corbeille vidée) dès qu'il a servi.
6. **Geler** (limitation) : une demande gelée n'est jamais effacée par la conservation automatique, même échue ; « Dégeler » la rend à la règle commune. **Effacer** : case de confirmation, puis « Effacer la demande » ; définitif, journalisé (`delete`), la demande subsiste 7 jours dans les sauvegardes, chiffrée. Le gel ou l'effacement recharge la page : la clé est à redéposer.

## 9. Conservation planifiée (partie D)

- Chaque jour à 03:00 UTC, Vercel Cron appelle `/api/cron/retention` (`vercel.json`), sur le déploiement de **production** seulement. La tâche, avec le compte du coffre : efface les demandes échues non gelées (une ligne `purge` chacune), purge les sessions échues ou inactives, les compteurs de limitation de débit de plus de 15 minutes et les défis du second facteur expirés, puis inscrit un résumé `retention` au journal, **en nombres seulement**.
- **`CRON_SECRET`** (à poser sur Vercel, environnement **Production**, puis redéployer) : 32 caractères au moins, lettres et chiffres (`openssl rand -hex 32`), jamais dans le dépôt. Sans lui, ou s'il est mal formé, chaque appel répond 401 et **rien n'est effacé** : le plafond de conservation n'est plus appliqué. Rotation : changer la variable, redéployer, vérifier dans Vercel (*Settings*, *Schedules*, *Cron Jobs*, *View Logs*) que le passage suivant répond 200. Le même secret protège la tâche de l'envoi des e-mails (`/api/cron/envoi`, story 3.3, §3.3), avec la même vérification.
- Vérification : après le premier passage, une ligne `retention` (acteur `system`) au journal ; l'accueil du coffre affiche la date du dernier passage et **une alerte en texte au-delà de 48 heures** (ou tant qu'aucun passage n'est inscrit). Un passage peut manquer (Vercel ne réessaie pas) : le suivant rattrape tout ce qui est échu.
- Sans `CRON_SECRET`, chaque appel laisse dans les journaux de Vercel une ligne fixe `[conservation] refused:no-secret`. En production, si `COFFRE_DATABASE_URL` ou `TEM_SECRET_KEY` (e-mails) est posée sans `CRON_SECRET` valable, **le build échoue** (`next.config.ts`) ; l'aperçu public sans coffre ni envoi (D62) n'est pas concerné.
