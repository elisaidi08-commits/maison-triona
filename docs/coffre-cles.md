# Clés du coffre des demandes · procédure

> **Story 3.2, partie B** (18/11/2026). À lire avant de générer, copier, remplacer ou détruire une clé du coffre. Cadre : D07 (sealed box libsodium), D05 (conservation), `docs/architecture.md` §6.5, `docs/privacy.md` §5.
> **La règle à retenir** : perdre la clé privée **ou** la phrase de passe, c'est perdre pour toujours la lecture des demandes. Personne ne peut les rouvrir : ni Vercel, ni Scaleway, ni Sady, ni Claude.

---

## 1. Principe

| Élément | Où il vit | Secret ? |
|---|---|---|
| **Clé publique** (32 octets, 44 caractères en base64) | Variable `VAULT_PUBLIC_KEY` du projet Vercel ; champ `publicKey` du paquet | Non. Elle permet seulement de **sceller** |
| **Clé privée** | Uniquement **chiffrée**, dans le paquet ; en clair, seulement dans la mémoire du navigateur de l'administratrice ou de l'administrateur, le temps d'une session du coffre (partie C) | Oui |
| **Paquet** (`*.json`) | Deux copies **hors ligne**, l'une chez Cat, l'autre chez Sady | Protégé par la phrase |
| **Phrase de passe** | Connue de Cat et de Sady ; une trace écrite sur papier, rangée **ailleurs** que les paquets | Oui |

- Le serveur reçoit la demande, la **scelle** avec la clé publique (`crypto_box_seal`) et n'écrit que les octets scellés. Il ne peut pas les rouvrir : il n'a jamais la clé privée.
- Le paquet contient le sel et les paramètres d'Argon2id (3 passes, 256 Mio : niveau « moderate » de libsodium), un nonce, la clé privée chiffrée par `crypto_secretbox` et la clé publique. Sans la phrase, il ne révèle rien.
- Restent **en clair**, pour le tri : type, date, service, pays, langue de réponse, urgence, origine, statut, échéance de conservation. Tout le reste est scellé : nom, e-mail, téléphone, « pour qui », créneau, mot libre.
- Jamais la clé privée, le paquet ni la phrase dans le dépôt, une variable d'environnement, un e-mail, une messagerie, un ticket, une capture d'écran ou un journal.

## 2. Générer les clés (une fois, avant l'ouverture de l'envoi)

Une **paire par environnement** : la production a la sienne ; une préproduction avec sa propre base aurait une autre paire, jamais celle de la production.

1. Poste de confiance, dépôt à jour, `npm ci` fait. Le script n'a besoin d'aucun réseau : couper le Wi-Fi est une bonne habitude.
2. Brancher le support de la **copie 1** (clé USB chiffrée, par exemple). Choisir la phrase de passe : **16 caractères au moins** ; une suite de cinq ou six mots tirés au hasard se retient mieux et résiste mieux qu'un mot de passe court.
3. Lancer, chemin entre guillemets (le nom des volumes peut contenir des espaces) :
   ```bash
   npm run vault:keys -- "/Volumes/COFFRE 1/maison-triona-coffre-2026-11.json"
   ```
   - Le script **refuse** tout chemin dans le dépôt (liens symboliques compris), tout fichier existant (il n'écrase jamais) et tout dossier absent.
   - La phrase se tape **deux fois**, rien ne s'affiche. Jamais en argument : si elle a été tapée dans la commande, elle est dans l'historique du terminal, il faut en choisir une autre.
   - Le fichier est écrit en lecture et écriture réservées au compte (0600).
4. Le script affiche la **clé publique**, seule, sur la dernière ligne. La garder pour l'étape 3.
5. Copier le fichier sur le support de la **copie 2**, puis comparer les deux copies : `shasum -a 256 "/Volumes/COFFRE 1/…json" "/Volumes/COFFRE 2/…json"` doit donner deux empreintes identiques.
6. Ne laisser aucune copie intermédiaire (Téléchargements, Bureau, Corbeille). Ranger la copie 1 chez Cat, la copie 2 chez Sady, dans deux lieux différents ; la trace écrite de la phrase, ailleurs encore.
7. Dès que `/coffre` existe (partie C) : ouvrir le coffre **avec chacune des deux copies**, une fois, pour vérifier copie et phrase.

## 3. Poser `VAULT_PUBLIC_KEY`

1. Vercel → projet → *Settings* → *Environment Variables* : `VAULT_PUBLIC_KEY` = la clé publique affichée, environnement **Production** seulement. Vérifier qu'elle est identique au champ `publicKey` du paquet.
2. Le formulaire n'enregistre une demande que si **`DATABASE_URL` et `VAULT_PUBLIC_KEY`** sont posées (plus `DATABASE_CA_CERT` en production). Sans l'une des deux, il garde l'état « L'envoi des demandes ouvrira bientôt » et n'écrit rien.
3. Redéployer : Vercel n'applique une variable modifiée qu'aux nouveaux déploiements.
4. Contrôle : une demande de test arrive sur `/contact/merci` et apparaît dans le coffre. Une clé mal copiée fait échouer chaque envoi (« L'envoi n'a pas abouti », statut `failed:config` dans les journaux, sans aucun contenu).

## 4. Que faire si…

| Situation | Conséquence | Que faire |
|---|---|---|
| **Une copie du paquet est perdue**, l'autre et la phrase sont intactes | Rien n'est perdu. Le paquet seul ne suffit pas à lire (Argon2id) | Refaire une copie depuis la copie restante (étape 2.5). Si le support a pu être **volé** plutôt qu'égaré, traiter comme une compromission (ligne suivante, par prudence) |
| **Le paquet et la phrase ont pu tomber entre d'autres mains** (vol, phrase vue ou tapée dans un outil en ligne) | Quiconque a les deux **et** un accès à la base ou à une sauvegarde peut lire les demandes | Changer de paire **sans attendre** (§5). C'est une violation de données au sens du RGPD : en parler aussitôt à Sady ; la notification à l'autorité de contrôle se fait sous 72 heures, sauf si la violation est peu susceptible d'engendrer un risque (RGPD, art. 33) |
| **Les deux copies sont perdues, ou la phrase est oubliée** | Les demandes scellées avec cette paire sont **définitivement illisibles** ; seules les colonnes en clair restent (date, service, pays…) | 1. Générer une nouvelle paire (§2), poser la nouvelle `VAULT_PUBLIC_KEY`, redéployer : les demandes suivantes sont lisibles. 2. Les anciennes ne peuvent plus servir : les effacer depuis le coffre (effacement journalisé, partie D). Aucune récupération n'existe, inutile de la chercher |
| **Un détenteur s'en va** (fin de collaboration) | Il connaît la phrase et peut avoir gardé une copie | Changer de paire (§5) et récupérer sa copie |

## 5. Changer de paire (rotation)

1. Générer une nouvelle paire (§2), sur deux nouveaux supports ou sous un nouveau nom daté. **Ne jamais écraser l'ancien paquet.**
2. Remplacer `VAULT_PUBLIC_KEY` sur Vercel, redéployer. Les demandes suivantes sont scellées avec la nouvelle clé.
3. **Garder l'ancien paquet** tant qu'une demande scellée avec lui existe : jusqu'au plafond de conservation (D05, 12 mois proposés), plus la fenêtre des sauvegardes (7 jours, `docs/privacy.md` §5). Le coffre (partie C) déverrouille chaque paquet gardé et essaie chaque clé : une clé qui ne convient pas échoue aussitôt.
4. Quand la dernière de ces demandes est effacée et la fenêtre de sauvegarde passée : détruire les deux copies de l'ancien paquet (formatage du support) et noter la date.
5. Après une compromission, la rotation protège les demandes **à venir**, pas celles déjà scellées avec l'ancienne paire. Pour celles-là : les effacer dès qu'elles ne servent plus ; re-sceller les demandes encore utiles avec la nouvelle clé, dans le navigateur, est une fonction à prévoir avec le coffre (parties C et D), pas encore écrite.

## 6. Limites (à connaître)

- **Vercel voit la demande en clair** dans la fonction, le temps de la sceller (`docs/architecture.md` §6.5, `docs/privacy.md` §8). Le corps de la requête n'est jamais journalisé.
- Le texte scellé est complété par blocs de 256 octets : la taille ne trahit pas la longueur exacte du message, seulement son ordre de grandeur.
- Une seule phrase pour Cat et Sady : le paquet n'a qu'une phrase. Une phrase par personne demanderait un second paquet de la même clé, que le script ne produit pas.
- Une phrase saisie reste quelque temps dans la mémoire du programme (JavaScript ne permet pas de l'effacer) : générer les clés sur un poste de confiance, fermer le terminal ensuite.
- Le déchiffrement dans le navigateur (partie C) exige `'wasm-unsafe-eval'` dans la CSP de `/coffre` : libsodium s'y exécute en WebAssembly (`docs/architecture.md` §9.1).
