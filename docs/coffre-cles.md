# Clés du coffre des demandes · procédure

> **Story 3.2, partie B** (18/11/2026, relecture sécurité comprise). À lire avant de générer, copier, remplacer ou détruire une clé du coffre, et avant de brancher le site sur la base. Cadre : D07 (sealed box libsodium), D05 (conservation), `docs/architecture.md` §6.5, `docs/privacy.md` §5.
> **La règle à retenir** : si **tous** les paquets sont perdus, ou toutes les phrases oubliées, la lecture des demandes est perdue pour toujours. Personne ne peut les rouvrir : ni Vercel, ni Scaleway, ni Sady, ni Claude.

---

## 1. Principe

| Élément | Où il vit | Secret ? |
|---|---|---|
| **Clé publique** (32 octets, 44 caractères en base64) | Variable `VAULT_PUBLIC_KEY` du projet Vercel ; champ `publicKey` de chaque paquet | Non. Elle permet seulement de **sceller** |
| **Clé privée** | Uniquement **chiffrée**, dans les paquets ; en clair, seulement dans la mémoire du navigateur de l'administratrice ou de l'administrateur, le temps d'une session du coffre (partie C) | Oui |
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
7. Dès que `/coffre` existe (partie C) : chacun ouvre le coffre **avec son paquet**, une fois, pour vérifier paquet et phrase.

## 3. Brancher le site sur le coffre

### 3.1 Un rôle qui ne sait qu'insérer : `site_public`

Le site public écrit des demandes, il n'a jamais besoin d'en lire une. Son compte PostgreSQL a donc le rôle **`site_public`** (`db/roles/site_public.sql`) : `USAGE` sur le schéma `public` et `INSERT` sur `vault_requests`, **rien d'autre**. Ni `SELECT` (l'identifiant d'une demande est tiré par le serveur, l'insertion se fait sans `RETURNING`), ni `UPDATE`, ni `DELETE`, ni le journal d'accès. Un serveur compromis ou une injection ne peut donc ni lire, ni modifier, ni effacer le coffre. Prouvé par `tests/integration/vault-role.test.ts`.

1. Avec le compte **administrateur** de l'instance : appliquer les migrations (`DATABASE_URL=<URL administrateur> npm run db:migrate`), puis le rôle : `psql "<URL administrateur>" -f db/roles/site_public.sql`. Le fichier est rejouable ; il n'est pas dans les migrations automatiques, et il se rejoue après chaque migration qui ajoute une table que le site doit remplir.
2. Créer le compte de connexion du site (sur Scaleway : console de l'instance, utilisateur sans aucun droit donné par la console) et lui donner le rôle : `GRANT site_public TO <compte du site>;`. Mot de passe long et aléatoire, jamais dans le dépôt. La façon exacte de créer un compte sans droit sur l'offre gérée de Scaleway reste **à vérifier sur l'instance**.
3. Vérifier, connecté avec ce compte : `SELECT count(*) FROM vault_requests;` doit être **refusé** (`permission denied`).

### 3.2 Un second rôle pour l'espace du coffre : `coffre` (partie C)

L'espace `/coffre` et le script des comptes (`npm run coffre:compte`) se connectent avec **un autre compte**, qui a le rôle **`coffre`** (`db/roles/coffre.sql`) : `USAGE` sur le schéma ; lecture, écriture et effacement sur les six tables de Better Auth (`"user"`, `"session"`, `"account"`, `"verification"`, `"twoFactor"`, `"rateLimit"`) ; **lecture seule** de `vault_requests` ; **`INSERT` et `SELECT` seulement** sur `vault_access_log` (le journal ne se modifie ni ne s'efface). Ni la table des migrations, ni la création d'objet. Le gel et l'effacement des demandes viendront en partie D, qui étendra ce fichier. Prouvé par `tests/integration/coffre-roles.test.ts`, qui vérifie aussi que `site_public` ne lit, n'écrit ni n'efface **aucune** table de Better Auth ; toute l'authentification y est testée sous ce rôle.

1. Avec le compte administrateur, **après** `npm run db:migrate` : `psql "<URL administrateur>" -f db/roles/site_public.sql -f db/roles/coffre.sql`. Les deux fichiers sont rejouables ; les rejouer après chaque migration qui ajoute une table.
2. Créer le compte de connexion du coffre, distinct de celui du site, et lui donner le rôle : `GRANT coffre TO <compte du coffre>;`. Mot de passe long et aléatoire, jamais dans le dépôt.
3. Vérifier, connecté avec ce compte : `UPDATE vault_requests SET status = status;` et `DELETE FROM vault_access_log;` doivent être **refusés**.

### 3.3 Deux URL de connexion

| Variable | Compte | Utilisé par | Droits |
|---|---|---|---|
| `DATABASE_URL` | compte du site (`site_public`) | Server Action du formulaire | Insertion seule |
| `COFFRE_DATABASE_URL` | compte du coffre (`coffre`) | Espace `/coffre` (connexion, sessions, liste) et `npm run coffre:compte` | Tables de Better Auth ; lecture des demandes ; journal en insertion et lecture |
| URL administrateur | propriétaire du schéma | `npm run db:migrate` et `db/roles/*.sql`, à la main | Tous ; **jamais** dans une variable de Vercel |

Deux pools distincts dans le code (`getPool`, `getCoffrePool`, `src/lib/db/pool.ts`) : le site public ne peut pas emprunter le compte du coffre. Sur un déploiement, une `COFFRE_DATABASE_URL` identique à `DATABASE_URL` est refusée au démarrage du coffre.

TLS est exigé sur **tout** déploiement Vercel (production, aperçus, branches) : sans `DATABASE_CA_CERT`, la connexion est refusée. Délais : 5 s pour se connecter, 5 s par requête ; au-delà, l'envoi échoue (« L'envoi n'a pas abouti ») et le visiteur garde sa saisie.

### 3.4 Poser `VAULT_PUBLIC_KEY`

1. Vercel → projet → *Settings* → *Environment Variables* : `VAULT_PUBLIC_KEY` = la clé publique affichée, environnement **Production** seulement. Vérifier qu'elle est identique au champ `publicKey` des paquets.
2. Le formulaire n'enregistre une demande que si **`DATABASE_URL` et `VAULT_PUBLIC_KEY`** sont posées. Sans l'une des deux, il garde l'état « L'envoi des demandes ouvrira bientôt » et n'écrit rien.
3. Redéployer : Vercel n'applique une variable modifiée qu'aux nouveaux déploiements.
4. Contrôle : une demande de test arrive sur `/contact/merci` et apparaît dans le coffre. Une clé mal copiée fait échouer chaque envoi (« L'envoi n'a pas abouti », statut `failed:config` dans les journaux, sans aucun contenu).

## 4. Que faire si…

| Situation | Conséquence | Que faire |
|---|---|---|
| **Un paquet est perdu ou une phrase oubliée**, l'autre paquet et sa phrase sont intacts | Rien n'est perdu : l'autre paquet ouvre le coffre | Refaire le paquet de la personne avec `--ajouter`, à partir du paquet restant (§2.4), avec une phrase neuve. Si le support a pu être **volé** plutôt qu'égaré, traiter comme une compromission (ligne suivante, par prudence) |
| **Un paquet et sa phrase ont pu tomber entre d'autres mains** (vol, phrase vue ou tapée dans un outil en ligne) | Quiconque a les deux **et** un accès à la base ou à une sauvegarde peut lire les demandes | Changer de paire **sans attendre** (§5). C'est une violation de données au sens du RGPD : en parler aussitôt à Sady ; la notification à l'autorité de contrôle se fait sous 72 heures, sauf si la violation est peu susceptible d'engendrer un risque (RGPD, art. 33) |
| **Tous les paquets sont perdus, ou toutes les phrases oubliées** | Les demandes scellées avec cette paire sont **définitivement illisibles** ; seules les colonnes en clair restent (date, service, pays…) | 1. Générer une nouvelle paire (§2), poser la nouvelle `VAULT_PUBLIC_KEY`, redéployer : les demandes suivantes sont lisibles. 2. Les anciennes ne peuvent plus servir : les effacer depuis le coffre (effacement journalisé, partie D). Aucune récupération n'existe, inutile de la chercher |
| **Un détenteur s'en va** (fin de collaboration) | Il a son paquet et sa phrase | Changer de paire (§5) ; récupérer ou faire détruire son paquet |

## 5. Changer de paire (rotation)

1. Générer une nouvelle paire et ses deux paquets (§2), sous de nouveaux noms datés. **Ne jamais écraser un ancien paquet.**
2. Remplacer `VAULT_PUBLIC_KEY` sur Vercel, redéployer. Les demandes suivantes sont scellées avec la nouvelle clé.
3. **Garder les anciens paquets** tant qu'une demande scellée avec eux existe : jusqu'au plafond de conservation (D05, 12 mois proposés), plus la fenêtre des sauvegardes (7 jours, `docs/privacy.md` §5). Le coffre (partie C) déverrouille chaque paquet gardé et essaie chaque clé : une clé qui ne convient pas échoue aussitôt.
4. Quand la dernière de ces demandes est effacée et la fenêtre de sauvegarde passée : détruire les anciens paquets et leurs copies (formatage du support) et noter la date.
5. Après une compromission, la rotation protège les demandes **à venir**, pas celles déjà scellées avec l'ancienne paire. Pour celles-là : les effacer dès qu'elles ne servent plus ; re-sceller les demandes encore utiles avec la nouvelle clé, dans le navigateur, est une fonction à prévoir avec le coffre (parties C et D), pas encore écrite.

## 6. Limites (à connaître)

- **Vercel voit la demande en clair** dans la fonction, le temps de la sceller (`docs/architecture.md` §6.5, `docs/privacy.md` §8). Le corps de la requête n'est jamais journalisé.
- Toutes les demandes scellées ont la **même taille** (16 Kio de texte complété, 16 432 octets) : la taille ne dit rien du message. Une demande plus longue est refusée ; la validation du formulaire l'empêche (la plus longue tient en moins de 14 Kio).
- Une phrase saisie reste quelque temps dans la mémoire du programme (JavaScript ne permet pas de l'effacer) : générer les clés sur un poste de confiance, fermer le terminal ensuite.
- Le déchiffrement dans le navigateur (partie C) exige `'wasm-unsafe-eval'` dans la CSP de `/coffre` : libsodium s'y exécute en WebAssembly (`docs/architecture.md` §9.1).
