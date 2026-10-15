# Délivrabilité des e-mails — brouillon

> **Statut** : brouillon phase 0 (15/10/2026), story **E3-S9**. À compléter en phase 1 avec le fournisseur retenu et les résultats des tests de réception.
> **Sources** : `docs/trust-contact-launch.md` §4.2 ; options de fournisseurs : même document, annexe D.
> **Principe** : un e-mail perdu ne doit jamais faire perdre une demande. Le **coffre** est la source de vérité ; l'e-mail n'est qu'une notification.

---

## 1. Les trois e-mails du site

| E-mail | Destinataire | Contenu | Données sensibles |
|---|---|---|---|
| Notification de demande | Cat | Service, pays, langue, urgence, source anonyme + lien vers la demande dans le coffre | **Aucune** (ni nom, ni contact, ni message) |
| Confirmation | Visiteur | Texte fixe : « votre demande est bien arrivée », la suite, aucun écho du contenu | Aucune |
| Alerte technique | Sady | Échec d'envoi après reprises, rebond, plainte | Identifiant technique de la demande seulement |

Tous en **FR et EN** (langue du visiteur pour la confirmation), texte simple et HTML sobre, **sans image distante, sans pixel de suivi, sans lien traqué**.

## 2. Domaine et authentification

| Élément | Proposition | Statut |
|---|---|---|
| Domaine | `[À CONFIRMER : domaine de Maison Triona]` | Bloquant |
| Sous-domaine d'envoi dédié | `mail.<domaine>` (protège la réputation du domaine principal) | Proposé |
| Expéditeur | `Maison Triona <bonjour@mail.<domaine>>` ou `<demandes@…>`, adresse alignée sur le domaine | Proposé |
| `Reply-To` | Adresse de Cat sur le domaine (pas une messagerie personnelle) | Proposé |
| **SPF** | Enregistrement TXT sur le sous-domaine, n'autorisant que le fournisseur retenu, terminé par `-all` après vérification | Phase 1 |
| **DKIM** | Clés générées par le fournisseur (2048 bits), publiées en DNS | Phase 1 |
| **DMARC** | Démarrage `p=none` avec rapports agrégés (`rua`) vers une adresse dédiée → `p=quarantine` après 2 à 4 semaines sans échec légitime → `p=reject` | Phase 1, durcissement progressif |
| Alignement | SPF **et** DKIM alignés sur le domaine de l'expéditeur | Phase 1 |

Les rapports DMARC contiennent des adresses IP d'envoi, pas de contenu : les lire une fois par semaine pendant le durcissement.

## 3. Envoi fiable : boîte d'envoi et reprises

1. La demande est **d'abord écrite dans le coffre** (chiffrée). Si cette écriture échoue, le visiteur voit l'écran d'échec (sa saisie est conservée) ; aucun e-mail ne part.
2. Les e-mails à envoyer sont inscrits dans une **table « boîte d'envoi »** (même base que le coffre), puis envoyés.
3. En cas d'échec : nouvelles tentatives espacées (par exemple 1 min, 5 min, 30 min, 2 h), par une tâche planifiée.
4. Après la dernière tentative : **alerte à Sady** ; la demande reste lisible dans le coffre.
5. Aucun contenu de demande n'est journalisé ; la boîte d'envoi ne contient que des identifiants et le gabarit d'e-mail.

## 4. Rebonds, plaintes, réponses

- Webhooks du fournisseur pour les **rebonds** (définitifs et temporaires) et les **plaintes** : consignés par identifiant technique, sans adresse en clair dans les journaux.
- Un rebond définitif sur la confirmation visiteur n'empêche rien (la demande est dans le coffre) ; Cat recontacte par l'autre moyen indiqué.
- L'adresse de réponse est relevée **chaque jour ouvré** (à confirmer avec Cat).

## 5. Tests de réception (avant l'ouverture)

| Date | Boîte | Type d'e-mail | Langue | Reçu | Dossier (principal / promotions / spam) | SPF | DKIM | DMARC | Notes |
|---|---|---|---|---|---|---|---|---|---|
| | Gmail | Notification | FR | | | | | | |
| | Gmail | Confirmation | EN | | | | | | |
| | Outlook / Hotmail | Notification | FR | | | | | | |
| | Outlook / Hotmail | Confirmation | FR | | | | | | |
| | Proton Mail | Confirmation | FR | | | | | | |
| | Apple iCloud Mail | Confirmation | EN | | | | | | |
| | Messagerie professionnelle de Cat | Notification | FR | | | | | | |

Vérification des en-têtes (`Authentication-Results`) pour chaque message ; capture conservée. Utiliser **uniquement des contenus de test**.

## 6. Règles de contenu

- Objet court et factuel, sans majuscules ni points d'exclamation, sans mot « promotionnel ».
- Version texte toujours présente ; HTML sans image distante ni police distante.
- Pas de lien raccourci, pas de paramètre de suivi dans les liens.
- Pied de page : nom de la maison, lien vers la politique de confidentialité.
- Le suivi des ouvertures et des clics est **désactivé** chez le fournisseur (à vérifier dans le tableau de bord après configuration).
