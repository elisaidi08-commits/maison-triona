# Délivrabilité des e-mails — brouillon

> **Statut** : brouillon phase 0 (15/10/2026), story **E3-S9**. Fournisseur retenu : **Scaleway TEM** (D07). Notification à Cat et alertes à Sady **livrées en 3.3, partie A** (18/11/2026, D69) ; confirmation au visiteur reportée. Valeurs des §2 et §7 vérifiées dans la doc Scaleway le 18/11/2026. Reste à remplir : les tests de réception (§5).
> **Sources** : `docs/trust-contact-launch.md` §4.2 ; options de fournisseurs : même document, annexe D ; mise en œuvre : `docs/architecture.md` §6.6 et §6.7.
> **Principe** : un e-mail perdu ne doit jamais faire perdre une demande. Le **coffre** est la source de vérité ; l'e-mail n'est qu'une notification.

---

## 1. Les e-mails (et SMS) du site

| E-mail | Destinataire | Contenu | Données sensibles |
|---|---|---|---|
| Notification de demande (3.3 A) | Cat | **La date et le lien vers la demande dans le coffre, rien d'autre** (D06) : « Une demande est arrivée le mercredi 18 novembre 2026 à 22 h 14. », le lien `<SITE_URL>/coffre/demandes/<id>`, puis « Ce message ne contient rien de la demande. ». Objet « Nouvelle demande · Maison Triona », + « · Prioritaire » si l'urgence est « urgent » | **Aucune** (ni nom, ni contact, ni service, ni pays, ni langue, ni origine, ni message) |
| Confirmation | Visiteur | **Reportée** (D69 : partie B, seulement si Cat la veut). Prévu : texte fixe, « votre demande est bien arrivée », la suite, aucun écho du contenu. D'ici là, la page `/contact/merci` confirme à l'écran, et la réponse de Cat sous 48 heures ouvrées sert de confirmation écrite | Aucune |
| Alerte technique (3.3 A) | Sady | Objet « Alerte technique · Maison Triona » : échec définitif de l'envoi, message non délivré (rebond, spam, liste de blocage), ou livraison non confirmée après 72 heures | Identifiant du message de la boîte d'envoi et date seulement |
| Lien d'accès (D57) | Personne qui veut convenir d'un appel | Lien personnel valable 48 h | Aucune |
| Confirmation d'appel, déplacement, annulation (D57) | Personne | Jour, heure, lien de gestion, invitation .ics | Aucune (aucun service nommé) |
| Rappel de la veille (D57) | Personne | Jour, heure, lien de gestion | Aucune |
| Nouvel appel (D57) | Cat | Jour, heure, lien vers l'appel dans le coffre, invitation .ics « Appel · Maison Triona » | **Aucune** (ni nom, ni numéro) |
| SMS de confirmation et de rappel (D57, option) | Personne | ≤ 160 caractères GSM-7, jour, heure, lien | Aucune ; visible sur l'écran verrouillé, donc aucun service nommé |

Messages de la réservation d'appel : `docs/reservation-appel.md` §2 et §3.3. Les invitations .ics sont à tester dans Google Agenda, Apple Calendrier et Outlook ; les SMS dans chacun des cinq pays.

Tous en **FR et EN** (langue du visiteur pour la confirmation), texte simple et HTML sobre, **sans image distante, sans pixel de suivi, sans lien traqué**. Les deux e-mails internes (notification, alerte) sont en **français** et en **texte brut** seulement (`src/lib/email/templates.ts`).

## 2. Domaine et authentification

TEM n'envoie que depuis un domaine à l'état **`checked`**. La vérification des enregistrements peut prendre **jusqu'à 48 heures**.

| Élément | Valeur | Statut |
|---|---|---|
| Domaine | `maisontriona.com` (D65) ; registraire et titulaire `[À CONFIRMER]` | Acheté |
| Sous-domaine d'envoi dédié | `mail.maisontriona.com`, ajouté dans TEM (protège la réputation du domaine principal) | À faire par Sady |
| Expéditeur (`EMAIL_FROM`) | `Maison Triona <…@mail.maisontriona.com>`, adresse `[À CONFIRMER]` | À choisir |
| `Reply-To` | Adresse de Cat sur le domaine (pas une messagerie personnelle), pour les messages aux visiteurs. Les e-mails internes n'en ont pas | Proposé |
| **SPF** | TXT sur le domaine d'envoi : `v=spf1 include:_spf.tem.scaleway.com -all` | À publier |
| **DKIM** | Nom et valeur donnés par la console ou l'API de TEM, publiés en DNS | À publier |
| **DMARC** | TXT `_dmarc` du domaine d'envoi, en commençant par `p=none` avec rapports agrégés (`rua`) vers une adresse dédiée → `p=quarantine` après 2 à 4 semaines sans échec légitime → `p=reject` | À publier, durcissement progressif |
| **MX** | Le nôtre, ou `blackhole.tem.scaleway.com.` | À publier |
| Alignement | SPF **et** DKIM alignés sur le domaine de l'expéditeur | À vérifier sur les tests (§5) |

Les rapports DMARC contiennent des adresses IP d'envoi, pas de contenu : les lire une fois par semaine pendant le durcissement.

## 3. Envoi fiable : boîte d'envoi et reprises

1. La demande est **d'abord écrite dans le coffre** (chiffrée). Si cette écriture échoue, le visiteur voit l'écran d'échec (sa saisie est conservée) ; aucun e-mail ne part.
2. La notification est inscrite dans la **boîte d'envoi** (table `outbox`, même base que le coffre), **dans la même transaction** que la demande, derrière un point de sauvegarde. Si elle ne peut pas s'écrire, la demande est gardée seule et `[demande] failed:outbox` est journalisé : personne n'est prévenu par e-mail, d'où une alerte sur ce journal (`docs/launch-checklist.md` §3).
3. **Premier essai** juste après la réponse au visiteur (`after()` de Next). Puis une tâche planifiée Vercel Cron, **toutes les 5 minutes**, reprend les échecs : après **5 min**, **30 min**, puis **2 h** (4 tentatives en tout).
4. Après la dernière tentative : **alerte à Sady** ; la demande reste lisible dans le coffre. Jamais d'alerte sur une alerte.
5. Aucun contenu de demande n'est journalisé ; la boîte d'envoi ne contient que des identifiants, des dates, des statuts et le gabarit d'e-mail, jamais une adresse. Ses lignes sont **effacées après 30 jours**.
6. **Envoi coupé** (variables vides) ou mal configuré : la demande s'enregistre quand même, sans notification, et ne sera **jamais notifiée après coup**. Cat la trouve dans le coffre.
7. TEM n'a **pas de clé d'idempotence** : un envoi accepté dont la réponse se perd peut partir deux fois. Ce doublon rare est accepté (D69).

## 4. Rebonds, plaintes, réponses

- **Suivi par interrogation** (D69), sans webhook : la tâche planifiée demande le statut de chaque message accepté (`GET /emails/{id}`), jusqu'à un état final ou **72 heures**. `sent` : délivré. `failed` ou `canceled`, ou drapeau `hard_bounce`, `spam`, `blocklisted` ou `mailbox_not_found` : non délivré, **alerte à Sady**. Toujours en attente après 72 heures : alerte. Les webhooks de TEM passent par Topics and Events (service payant à part, signatures SNS, messages qui contiennent `email_to`) : écartés.
- **Aucun événement « plainte »** chez TEM : le drapeau `spam` en tient lieu, et il déclenche une alerte.
- **Listes de blocage de TEM** : une adresse en échec (`mailbox_not_found`, `mailbox_full`) est bloquée **une semaine**, puis **un mois**, puis **sans fin**. Si l'adresse de Cat y entre, ses notifications ne partent plus : l'alerte le signale à Sady. Levée d'un blocage chez TEM : `[À CONFIRMER]`.
- Un rebond définitif sur la confirmation visiteur (si la partie B est faite) n'empêche rien (la demande est dans le coffre) ; Cat recontacte par l'autre moyen indiqué.
- L'adresse de réponse est relevée **chaque jour ouvré** (à confirmer avec Cat).

## 5. Tests de réception (avant l'ouverture)

Une fois le domaine `checked`, avec des **demandes factices**. En 3.3 A, tester la notification et l'alerte ; les lignes « Confirmation » attendent la partie B (D69).

| Date | Boîte | Type d'e-mail | Langue | Reçu | Dossier (principal / promotions / spam) | SPF | DKIM | DMARC | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | Gmail | Notification | FR | | | | | | |
| | Gmail | Confirmation | EN | | | | | | |
| | Outlook / Hotmail | Notification | FR | | | | | | |
| | Outlook / Hotmail | Confirmation | FR | | | | | | |
| | Proton Mail | Confirmation | FR | | | | | | |
| | Apple iCloud Mail | Confirmation | EN | | | | | | |
| | Messagerie professionnelle de Cat | Notification | FR | | | | | | |
| | Messagerie de Sady | Alerte technique | FR | | | | | | |

Vérification des en-têtes (`Authentication-Results`) pour chaque message ; capture conservée. Utiliser **uniquement des contenus de test**.

## 6. Règles de contenu

- Objet court et factuel, sans majuscules ni points d'exclamation, sans mot « promotionnel ». Il reste **neutre** : TEM le garde tant que le domaine est actif (§7).
- Version texte toujours présente ; HTML sans image distante ni police distante.
- Pas de lien raccourci, pas de paramètre de suivi dans les liens.
- Pied de page : nom de la maison, lien vers la politique de confidentialité. Les e-mails internes (notification, alerte) n'en ont pas : texte brut, et pour seul lien celui du coffre.
- Le suivi des ouvertures et des clics est **désactivé** chez le fournisseur (à vérifier dans le tableau de bord après configuration).

## 7. Ce que garde Scaleway TEM

Source : page de confidentialité de Scaleway TEM, publiée le 19/10/2026, lue le 18/11/2026.

- Traitement **à Paris** uniquement.
- **Contenu** du message : supprimé dès son acceptation par le serveur destinataire, ou après 36 heures d'échecs temporaires.
- **Métadonnées** (expéditeur, destinataire, sujet, IP, statut) : gardées **tant que le domaine est actif**, sans réglage possible (un réglage est annoncé pour 2027).
- Aucun pixel, aucune réécriture des liens.

En 3.3 A, TEM garde donc l'adresse de Cat, celle de Sady et les sujets « Nouvelle demande · Maison Triona » (« · Prioritaire » pour une demande urgente) et « Alerte technique · Maison Triona ». **Aucune adresse de visiteur** ne lui est confiée tant que la confirmation au visiteur est reportée (D69).
