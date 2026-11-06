# Analyse d'impact relative à la protection des données (AIPD, article 35 du RGPD)

> **Statut** : brouillon du 06/11/2026, à compléter et valider par Cat, après avis de son juriste, **avant l'ouverture**. À revoir à chaque changement important (nouveau traitement, nouvel outil, incident).
> **Périmètre** : les demandes de contact et la réservation d'appel (T1, T2), les échanges qui suivent et la présentation au professionnel choisi (T3, T4). Les autres traitements du registre présentent un risque faible ; ils sont couverts par les mesures du §5.

## 1. Pourquoi une AIPD

Les lignes directrices européennes sur l'AIPD (WP248 rév. 01) considèrent qu'une analyse est en général nécessaire quand **deux critères** au moins sont réunis. Ici :

| Critère | Ici | Retenu |
|---|---|---|
| Données sensibles (santé) | Le choix « grand âge », le message libre et les échanges de vive voix peuvent révéler l'état de santé d'un parent | **Oui** |
| Personnes vulnérables | Parents âgés, enfants ; demandes souvent faites par un proche | **Oui** |
| Grande échelle | Une maison, une interlocutrice : volume faible `[À ESTIMER : demandes par mois]` | Non |
| Croisement de données, surveillance, décision automatisée, technologie nouvelle | Aucun | Non |

**Conclusion** : une AIPD est réalisée par précaution. Le juriste confirme si elle est obligatoire et si la liste des traitements soumis à AIPD publiée par l'APD s'applique `[À VALIDER JURIDIQUEMENT]`.

## 2. Description

**Ce que fait la maison** : une famille confie une situation ; la maison trouve la bonne personne, la présente, et veille à ce que tout reste à la hauteur. Le contrat est signé entre la famille et le professionnel ; la maison n'est jamais l'employeur (D40).

**Parcours des données**

1. Le visiteur remplit le formulaire (ou demande un appel). Rien de sensible n'est gardé dans son navigateur.
2. La fonction du site (Vercel, Paris) reçoit la demande, la **chiffre aussitôt avec la clé publique du coffre** (sealed box) et l'enregistre dans la base du coffre (Scaleway, France). Seules les colonnes de tri restent en clair : service, pays, langue, urgence, source, dates, statut.
3. Un e-mail **sans contenu** prévient Cat (date et lien vers le coffre, D06). Le visiteur reçoit une confirmation à **texte fixe**.
4. Cat se connecte au coffre (mot de passe et double authentification) ; la demande est déchiffrée **dans son navigateur**, avec sa clé privée protégée par phrase de passe. Chaque lecture est journalisée.
5. Pour un appel (D57) : l'e-mail et le numéro sont aussi chiffrés avec une clé serveur, le temps d'envoyer confirmation et rappels, puis effacés 24 h après l'appel. L'agenda de Cat (Google) ne reçoit que l'heure et un lien.
6. Échanges avec la famille (téléphone, e-mail, rendez-vous), puis présentation d'une ou plusieurs personnes : la maison transmet au professionnel choisi, avec l'accord de la famille, ce qui lui est utile.
7. Au plus 12 mois après le dernier échange, la demande est effacée automatiquement ; elle subsiste 7 jours dans les sauvegardes, chiffrée.

**Volume, personnes, durée** : `[À ESTIMER avec Cat]` ; voir le registre (T1 à T4).

## 3. Nécessité et proportionnalité

| Principe | Comment il est tenu | Reste à faire |
|---|---|---|
| Finalités déterminées | Répondre, présenter, suivre (registre) | — |
| Bases légales | 6.1.b ; 9.2.a pour la santé | Avis du juriste (J2, J10) |
| Minimisation | Aucun champ santé ; « pour qui » facultatif ; message facultatif avec l'aide « Inutile de nous donner des détails médicaux » ; aucune donnée de mineur demandée ; notification à Cat sans contenu ; agenda sans nom | Notes de Cat dans le coffre seulement, courtes, sans diagnostic (T3) |
| Exactitude | La personne saisit ses données ; Cat les corrige à la demande | — |
| Durées | Plafond automatique de 12 mois ; coordonnées d'envoi effacées 24 h après l'appel | Durées encore ouvertes (registre) |
| Information | Politique de confidentialité FR et EN, lien près de la case d'accord | Information du parent quand la demande vient d'un proche (J2, article 14) |
| Droits | Procédure et outils du coffre (lecture, export, suppression journalisés) | Exercice à blanc avant l'ouverture |
| Sous-traitants | Contrats de traitement à signer au nom de la société | `sous-traitants.md` |
| Transferts | Prestataires américains : cadre UE–États-Unis ; Google ne reçoit rien qui nomme la personne | Avis du juriste ; Monaco (J8) |

## 4. Risques pour les personnes

Échelle (proposition à valider) : **négligeable, limitée, importante, maximale**.

### 4.1 Ce qui pourrait arriver

| Événement redouté | Impacts pour les personnes | Sources de risque |
|---|---|---|
| **Accès illégitime** aux demandes ou aux notes | Révélation de l'état de santé ou de la fin de vie d'un parent, d'une situation familiale, de la présence d'enfants ; **révélation de l'absence des propriétaires** (« préparer une résidence avant une arrivée », « un séjour sur la Riviera ») et de leur aisance : risque de cambriolage, de démarchage, d'escroquerie | Compromission d'un compte du coffre ou du poste de Cat ; compromission de l'hébergeur ou d'une fonction pendant le chiffrement ; e-mail ou note gardés hors du coffre ; erreur de destinataire lors d'une présentation ; journal ou lien exposé |
| **Modification non désirée** | Mauvaise personne présentée, mauvais horaire d'appel | Compte compromis ; erreur de saisie |
| **Disparition** | Une famille sans réponse, un appel manqué | Perte de la clé privée du coffre ; panne de la base ; suppression par erreur |

### 4.2 Évaluation (proposition)

| Événement | Gravité | Vraisemblance avant mesures | Vraisemblance après mesures (§5) |
|---|---|---|---|
| Accès illégitime | **Importante** (santé, sécurité des biens) | Importante | **Limitée** |
| Modification non désirée | Limitée | Limitée | Négligeable |
| Disparition | Limitée | Limitée | Négligeable (copie de la clé hors ligne, sauvegardes) |

## 5. Mesures de sécurité (article 32)

### 5.1 Techniques (prévues par `docs/architecture.md` §6 et §9, `docs/reservation-appel.md`)

- **Chiffrement** : TLS partout (HSTS) ; contenu des demandes chiffré dès réception avec la clé publique du coffre (sealed box), déchiffré seulement dans le navigateur de Cat ; base chiffrée au repos ; clé serveur (Key Manager) limitée à l'e-mail et au numéro des appels à venir, effacés 24 h après l'appel.
- **Accès** : deux comptes nominatifs (Cat, Sady), créés à la main, inscriptions fermées ; mot de passe et **double authentification obligatoire** (TOTP, passkey en complément) ; verrouillage après échecs ; sessions courtes ; aucun compte partagé.
- **Traçabilité** : journal d'accès au coffre (connexion, lecture, export, suppression ; jamais le contenu).
- **Minimisation technique** : rien de la demande dans les journaux (identifiant et statut seulement) ; notification sans contenu ; agenda sans nom ; jetons de lien gardés sous forme d'empreinte ; aucun cookie ni traceur sur le site public ; aucun script ni ressource tiers dans le navigateur (`check:third-party`).
- **Protection des envois** : validation stricte côté serveur, champ piège, limitation de débit par empreinte d'IP et par adresse, taille des envois limitée.
- **Conservation** : effacement quotidien automatique au plafond ; effacement à la demande journalisé ; sauvegardes 7 jours, contenu déjà chiffré.
- **Continuité** : copie de secours de la clé privée **hors ligne** chez Cat et chez Sady ; procédure de perte de clé (story 3.2) ; boîte d'envoi avec reprises, pour qu'une panne d'e-mail ne fasse perdre aucun contact.

### 5.2 Organisationnelles

- **Règles pour Cat** `[À VALIDER avec Cat]` : ne jamais transférer une demande par e-mail ni la copier hors du coffre ; notes courtes dans le coffre, sans diagnostic ; présentation au professionnel avec l'accord de la famille et seulement ce qui est utile, de préférence de vive voix ; ne jamais laisser de message vocal (D41).
- **Poste et téléphone de Cat** `[À DÉFINIR]` : disque chiffré, verrouillage automatique, système à jour, gestionnaire de mots de passe, application d'authentification sur un appareil personnel.
- **Engagement de confidentialité** de Sady, et contrat selon son statut (J4).
- **Convention avec chaque professionnel** : confidentialité, usage limité des données transmises, suppression si la famille ne donne pas suite (J5).
- **Contrats de traitement** signés avec chaque sous-traitant ; revue annuelle du dossier.
- **Procédures** : violation de données (Cat et Sady prévenus dans l'heure, D47), exercice des droits (`procedures.md`).

## 6. Risques résiduels connus (repris de `docs/privacy.md` §8 et D57)

1. **Vercel voit la demande en clair** dans la fonction, le temps de la chiffrer ; société américaine, exposée au droit américain même en Europe. Chiffrer dans le navigateur casserait le fonctionnement sans JavaScript. Mitigations : aucun journal du contenu, région UE, contrat.
2. **Fenêtre de sauvegarde** de 7 jours après un effacement (contenu chiffré).
3. **Données de santé et HDS** (France) : question pour le juriste (J3).
4. **Confirmation envoyée à une adresse saisie par un inconnu** : texte fixe sans contenu, limites par adresse et par IP.
5. **Clé serveur** : pendant la fenêtre d'envoi, un serveur compromis permettrait de lire l'e-mail et le numéro des appels à venir.
6. **Liens de réservation dans les journaux** de l'hébergeur : validité de 48 h, annulés à la réservation, accès aux journaux restreint.
7. **Notes et échanges hors du site** (messagerie, téléphone de Cat) : le niveau de protection dépend de leur hébergement et de la discipline (§5.2).

## 7. Plan d'action avant l'ouverture

| Action | Qui | Échéance |
|---|---|---|
| Avis du juriste (J1 à J14) et report des réponses | Cat | Avant l'ouverture |
| Choix et contrat de la messagerie de la maison ; règles de notes | Cat, Sady | Avant l'ouverture |
| Poste et téléphone de Cat sécurisés (§5.2) | Cat, Sady | Avant l'ouverture |
| Contrats de traitement signés (`sous-traitants.md`) | Cat | Après l'inscription, avant l'ouverture |
| Clause « données » de la convention avec les professionnels | Cat, juriste | Avant la première présentation |
| Exercice à blanc : violation et demande d'accès | Cat, Sady | Avant l'ouverture |
| Revue de cette AIPD | Cat | Chaque année et à chaque changement |

## 8. Validation

| | |
|---|---|
| Avis du juriste | `[À COMPLÉTER]` |
| Avis des personnes concernées (facultatif) | `[À COMPLÉTER]` : par exemple, l'avis des cinq testeurs (D47) sur la clarté de l'information |
| Décision de Cat (responsable du traitement) | `[À COMPLÉTER]` : traitement mis en œuvre, avec les mesures du §5 et le plan du §7 |
| Date et signature | `[À COMPLÉTER]` |
