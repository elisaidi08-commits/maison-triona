# Réservation d'appel — spec

> **Statut** : conception validée par Sady le 06/11/2026 (D57), à relire avant le plan d'implémentation. Rien n'est installé.
> **Dépend de** : stories 3.2 (coffre), 3.3 (envoi et boîte d'envoi), 3.5 (anti-abus). **Remplace** la story 3.6 (rappel à la demande).
> **Priorité** : cette spec précise `docs/architecture.md` §6 et `docs/trust-contact-launch.md` §3 pour la réservation ; en cas de conflit sur un point de confidentialité, `docs/privacy.md` et les règles de discrétion de `CLAUDE.md` priment.

---

## 1. But et périmètre

Un « Calendly maison », plus léger et plus discret qu'un outil générique : depuis le site, une personne convient d'un **appel téléphonique** avec Cat, à une heure précise, sans compte ni mot de passe. Cat règle ses disponibilités et retrouve ses appels dans le coffre et dans son agenda Google.

| Dans le périmètre | Hors périmètre |
|---|---|
| Demande d'un lien par e-mail, réservation, déplacement, annulation | Rencontre en personne (Cat l'organise elle-même après l'appel) `[À CONFIRMER]` |
| Confirmations et rappels par e-mail, SMS en option | Visioconférence, paiement |
| Réglages des disponibilités et agenda de Cat dans le coffre | Lettre d'information (voir §9) |
| Invitations d'agenda (Google Agenda en priorité) | Lecture des heures occupées de Cat dans Google (option, §4.7, après l'ouverture) |

**Options écartées** (06/11/2026) :
- **Calendly ou Cal.com en ligne** : script tiers, données aux États-Unis, cookies.
- **Cal.com hébergé chez nous** : une deuxième application à maintenir, JavaScript et cookies obligatoires, données hors du coffre.
- **Resend** : sa région UE ne règle que l'envoi ; les données des clients sont stockées et traitées aux États-Unis ([régions](https://www.resend.com/docs/dashboard/domains/regions.md), [RGPD](https://resend.com/security/gdpr), consultés le 06/11/2026). Seul son outil de gabarits **React Email**, indépendant du fournisseur, peut servir (à évaluer en 3.3).

## 2. Parcours de la personne

Le site garde **deux entrées** : écrire (formulaire en étapes, 3.1) ou convenir d'un appel.

1. **CTA « Convenir d'un appel »** `[À VALIDER : absent de la liste des CTA approuvés]` vers `/[locale]/contact/appel`. La page ne demande que l'**adresse e-mail** ; la langue vient de l'URL. Réponse toujours identique : « Un lien vient de vous être envoyé. Il est valable 48 heures. »
2. **E-mail d'accès** : un lien personnel `/[locale]/contact/appel/[jeton]`, valable **48 heures**, réutilisable pendant ce délai. Un nouveau lien annule le précédent. Si l'adresse a déjà un appel à venir, le lien ouvre la page de gestion de cet appel.
3. **Page de réservation, un seul écran** :
   - en tête, les **trois prochains créneaux** libres ;
   - puis les jours suivants, **groupés par semaine**, en liste (pas de grille de calendrier : plus lisible, plus accessible, moins « outil ») ;
   - puis **nom**, **numéro**, case « Ne pas laisser de message vocal », liste facultative « Comment avez-vous connu la maison ? » (liste fermée de D41), case « Me prévenir aussi par SMS » (non cochée), consentement ;
   - **un seul bouton**. L'adresse e-mail est déjà connue : elle n'est pas redemandée.
4. **Confirmation** à l'écran et par e-mail, avec l'invitation d'agenda (.ics) et un lien de gestion (déplacer, annuler) valable jusqu'à la fin de l'appel. Le lien d'accès est alors révoqué : seul le lien de gestion reste valable.
5. **Rappels** : e-mail la veille ; SMS deux heures avant si la case est cochée.
6. **Déplacer** : la personne choisit un nouveau créneau, l'ancien n'est libéré qu'une fois le nouveau pris ; l'invitation existante est **mise à jour**, pas dupliquée. **Annuler** : l'invitation est retirée des agendas.

**Fuseau** : les cinq pays sont sur l'heure de Bruxelles et de Paris, affichée par défaut. Un lien « Changer de fuseau » (liste courte, fonctionne sans JavaScript, paramètre `?tz=`) affiche les deux heures pour une personne à l'étranger.

**Limites** : une seule réservation à venir par adresse ; une fois l'appel passé ou annulé, une nouvelle réservation est possible.

**Textes** : tous en FR et EN dans `messages/{fr,en}.json`, rédigés par Sady, validés par Cat, relus par `i18n-copy-editor` (mots bannis de D39, vouvoiement, « la maison »). Aucun texte de cette spec n'est un texte publié.

## 3. Côté de Cat (dans le coffre)

### 3.1 Réglages (`/coffre/disponibilites`)

| Réglage | Valeur proposée | Statut |
|---|---|---|
| Semaine type (plages par jour) | Lundi à vendredi, 10 h 30-12 h 30 et 16 h-18 h (D41 : fin de matinée, fin d'après-midi) | `[À VALIDER avec Cat]` |
| Durée d'un appel | 30 min | `[À VALIDER avec Cat]` |
| Pause entre deux appels | 15 min | `[À VALIDER avec Cat]` |
| Délai minimal avant un appel | 24 h | `[À VALIDER avec Cat]` |
| Horizon de réservation | 3 semaines | `[À VALIDER avec Cat]` |
| Plafond d'appels par jour | 4 | `[À VALIDER avec Cat]` |
| Absences | Congés (plages de dates) ; jours fériés belges préremplis, décochables ; « bloquer cette journée » en un clic | — |

Jours fériés belges préremplis : 1er janvier, lundi de Pâques, 1er mai, Ascension, lundi de Pentecôte, 21 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre.

Bloquer une journée qui contient déjà des appels ne les annule pas : le coffre les signale et propose de les déplacer un par un.

### 3.2 Agenda (`/coffre/appels`)

- Vues **« Aujourd'hui »** et **« Cette semaine »** : heure, nom, numéro (lien `tel:` pour appeler depuis le téléphone), langue, « pas de message vocal », origine.
- **Statuts** : confirmé · fait · pas de réponse · annulé par la personne · annulé par la maison. Après l'heure de fin, un appel passe « à qualifier » jusqu'à ce que Cat choisisse « fait » ou « pas de réponse ».
- **Rattacher** un appel au dossier d'une demande existante du coffre.
- **Déplacer ou annuler** depuis le coffre : la personne reçoit un message courtois avec un lien pour choisir un autre créneau.
- Chaque lecture et chaque action est inscrite au **journal d'accès** (§6.5 de l'architecture).

### 3.3 Notifications, toujours sans nom (D06)

| Message | Canal | Contenu |
|---|---|---|
| Nouvelle réservation | E-mail + invitation | Objet « Nouvel appel · Maison Triona » ; jour, heure, lien vers l'appel dans le coffre. Invitation « Appel · Maison Triona », description = lien vers le coffre |
| Déplacement, annulation | Invitation mise à jour ou retirée | Idem |
| Nouvelle réservation (option) | SMS à Cat | « Nouvel appel mardi 10 h 30 » |
| Récapitulatif du matin (option) | E-mail, 8 h les jours ouvrés | « Vos appels du jour : 10 h 30, 16 h » |

**Google Agenda** : Gmail reconnaît les invitations ; chaque appel apparaît dans l'agenda de Cat sans configuration. Google ne reçoit que le titre neutre, l'heure et le lien vers le coffre.

## 4. Technique

### 4.1 Données (base du coffre, Scaleway, D07)

Trois niveaux de protection : **en clair** (rien de personnel), **sealed box** (le serveur ne peut pas lire, seule Cat dans son navigateur), **clé serveur** (chiffrement en enveloppe avec Scaleway Key Manager : le serveur peut lire, pour envoyer un message).

| Table | Colonnes principales | Protection |
|---|---|---|
| `booking_settings` | durée, pause, délai minimal, horizon, plafond, fuseau | En clair |
| `availability_rules` | jour de la semaine, début, fin | En clair |
| `availability_exceptions` | date de début, date de fin, type (congé, férié, journée bloquée) | En clair |
| `booking_tokens` | `token_hash` (SHA-256), `purpose` (`access` · `manage`), `email_hmac`, `email_kms`, `booking_id`, `expires_at`, `revoked_at` | Jeton : seule l'empreinte est stockée ; e-mail : clé serveur |
| `bookings` | `starts_at`, `ends_at`, `slot` (`tstzrange` début → fin + pause), `status`, `locale`, `no_voicemail`, `sms_opt_in`, `source`, `email_hmac`, `request_id` (rattachement) | En clair |
| | `guest_sealed` : nom, e-mail, numéro, origine | Sealed box |
| | `contact_kms` : e-mail, et numéro si SMS choisi | Clé serveur, **effacée** après le dernier message (fin de l'appel + 24 h) |

- `email_hmac` : HMAC-SHA256 de l'adresse normalisée, avec un secret serveur. Sert à limiter les demandes et à retrouver un appel à venir sans stocker l'adresse en clair.
- **Exception à la sealed box (D57)** : seuls l'e-mail et le numéro, et seulement le temps d'envoyer les messages. Le même mécanisme règle les reprises de la confirmation du formulaire (3.3), qui ont aussi besoin de l'adresse.
- **Conservation** : celle des demandes (D05, plafond proposé de 12 mois après le dernier échange) ; jetons supprimés 7 jours après leur expiration.

### 4.2 Un créneau ne se prend qu'une fois

- **Contrainte d'exclusion PostgreSQL** : `EXCLUDE USING gist (slot WITH &&) WHERE (status = 'confirmed')`. Deux appels confirmés ne peuvent pas se chevaucher, pause comprise, même si deux personnes valident à la même seconde.
- **Verrous transactionnels** (`pg_advisory_xact_lock`) sur le jour et sur `email_hmac`, pour appliquer le plafond quotidien et « une réservation à venir par adresse » sans course.
- Échec de la contrainte → la page se réaffiche avec « Ce créneau vient d'être pris », les créneaux voisins en tête et **la saisie conservée**.
- Double clic ou renvoi du formulaire : le même jeton ne crée jamais deux réservations.

### 4.3 Calcul des créneaux

Fonction pure `computeSlots(settings, rules, exceptions, bookings, busy, now)` dans `src/lib/booking/slots.ts` : semaine type, moins les absences, moins les réservations confirmées, moins les heures occupées (option Google), dans le délai minimal et l'horizon, sous le plafond quotidien. Fuseau `Europe/Brussels`, passages à l'heure d'été et d'hiver couverts par les tests. Gestion des fuseaux : `Temporal` natif s'il est disponible dans Node 24 au moment de la story, sinon une petite bibliothèque, justifiée par écrit.

### 4.4 Liens et sécurité

- Jeton de 32 octets aléatoires (base64url) ; la base ne garde que son empreinte.
- **Ouvrir un lien n'engage rien** : la page affichée par `GET` ne modifie rien (les messageries d'entreprise ouvrent les liens pour les analyser) ; seule la Server Action (`POST`) réserve, déplace ou annule.
- Pages de lien : `noindex`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, hors du sitemap.
- Anti-abus (3.5) : honeypot, horodatage signé, limitation de débit (Upstash, UE) sur la demande de lien : 3 par 10 minutes par empreinte d'IP, 3 par 24 heures par `email_hmac`.
- **Aucun cookie** sur le site public : le lien sert de clé.
- **Risque résiduel** à écrire dans `docs/privacy.md` : le chemin du lien apparaît dans les journaux de Vercel ; délai court de 48 heures, accès aux journaux restreint.

### 4.5 Envois

- **Boîte d'envoi** de 3.3, étendue : `send_at` (messages programmés), `channel` (`email` · `sms`), gabarit, `booking_id`. Elle ne contient **aucune coordonnée** : le serveur lit `contact_kms` au moment de l'envoi ; si elle est effacée, le message est abandonné. Tâche planifiée Vercel Cron toutes les 5 minutes.
- **Tâche quotidienne** (`/api/cron/booking`) : appels passés en « à qualifier », effacement de `contact_kms`, purge des jetons.
- **Invitations** : `src/lib/booking/ics.ts`, écrit à la main (sous-ensemble RFC 5545), sans dépendance. `METHOD:REQUEST` puis `METHOD:CANCEL`, `UID` stable par destinataire (`<id>-guest@`, `<id>-host@`), `SEQUENCE` incrémentée à chaque déplacement, `VTIMEZONE` Europe/Brussels. À tester dans Google Agenda, Apple Calendrier et Outlook.
- **SMS** : adaptateur `src/lib/sms` (fournisseur interchangeable, comme `lib/email`). Fournisseur `[À TRANCHER]` après vérification sur les sites officiels du contrat de traitement, de l'hébergement UE, de l'expéditeur alphanumérique en BE, FR, LU, MC et CH, et du prix. Pistes : Sweego (France), seven (Allemagne), GatewayAPI (Danemark) ; environ 5 à 10 centimes par SMS (annuaires, non vérifié). Textes ≤ 160 caractères dans l'alphabet GSM-7 (sinon découpage en segments de 70) ; aucun service nommé, car le SMS s'affiche sur l'écran verrouillé.

### 4.6 Arborescence

```
src/app/[locale]/(site)/contact/appel/page.tsx              ← demande de lien
src/app/[locale]/(site)/contact/appel/[token]/page.tsx      ← réservation
src/app/[locale]/(site)/contact/appel/gerer/[token]/page.tsx ← déplacer, annuler
src/app/coffre/appels/page.tsx · coffre/disponibilites/page.tsx
src/app/api/cron/booking/route.ts
src/actions/booking.ts                                      ← 'use server'
src/lib/booking/   slots.ts · tokens.ts · ics.ts · repository.ts
src/lib/sms/       adaptateur SMS
src/lib/validation/booking.ts                               ← schémas Zod
tests/e2e/booking.spec.ts · tests/unit/slots.test.ts
```

**Dépendance nouvelle** : `libphonenumber-js`, pour valider les numéros des cinq pays et de l'étranger (version vérifiée sur le registre en story). Le Key Manager, le SMS et Google passent par de simples appels HTTP, sans kit de développement.

### 4.7 Google Agenda, heures occupées (option, après l'ouverture)

Bouton « Connecter Google Agenda » dans le coffre : OAuth limité à la **lecture des heures occupées** (scope exact et statut à vérifier dans la documentation Google), aucun contenu de rendez-vous lu, rien sur les familles envoyé à Google. Jeton de rafraîchissement chiffré avec la clé serveur. **Piège** : une application OAuth laissée en mode « test » perd son accès au bout de 7 jours ; la publier correctement (à revérifier en story). Si Google ne répond pas, les créneaux sont calculés sans lui.

## 5. Erreurs et cas limites

| Cas | Comportement |
|---|---|
| Créneau pris entre-temps | Message, créneaux voisins en tête, saisie conservée |
| Lien expiré ou annulé | Page « Ce lien n'est plus valable » et bouton « Recevoir un nouveau lien » (à la même adresse, jamais affichée) |
| Plus aucun créneau dans l'horizon | Phrase d'excuse et renvoi vers le formulaire « Nous écrire » |
| Coffre indisponible | « L'envoi n'a pas abouti », saisie conservée, aucun message envoyé |
| Fournisseur e-mail ou SMS en panne | Réservation enregistrée ; reprises de la boîte d'envoi ; alerte à Sady après la dernière tentative ; un SMS en échec n'empêche pas l'e-mail |
| Changement d'heure | Créneaux calculés en heure locale ; tests sur les derniers dimanches de mars et d'octobre |
| Cat bloque une journée qui a des appels | Appels gardés, signalés dans le coffre |
| Robot | Rejet silencieux (honeypot, horodatage), limitation de débit |

## 6. Tests et critères d'acceptation

- **E2E Playwright, sans JavaScript** : demande de lien → e-mail capturé par un transport de test → réservation → confirmation → déplacement → annulation, en FR et en EN.
- **Course** : deux envois simultanés sur le même créneau → exactement une réservation confirmée.
- Lien expiré, lien révoqué, une seule réservation à venir par adresse, plafond quotidien.
- **Calcul des créneaux** : tests unitaires avec le testeur intégré de Node (`node --test`), sans dépendance : plages, pause, délai, horizon, absences, plafond, changements d'heure.
- **Accessibilité** : axe WCAG 2.2 AA en FR et EN ; groupes de créneaux en `fieldset` et `legend` ; cibles ≥ 48 px ; résumé d'erreurs qui reçoit le focus ; corps 20 px.
- **Discrétion** : aucun `Set-Cookie` sur les pages publiques ; `check:third-party` vert ; aucun e-mail, numéro ou jeton en clair dans les journaux (vérifié avec des données de test).
- **Performance** : Lighthouse ≥ 95 sur les trois pages.
- **Manuels** : invitations dans Google Agenda, Apple Calendrier et Outlook ; réception des SMS dans chacun des cinq pays (`docs/email-deliverability.md` §5, à étendre).

## 7. Confidentialité (à reporter dans `docs/privacy.md`)

| Traitement | Données | Base légale (proposée) | Où | Conservation |
|---|---|---|---|---|
| Réservation d'appel | E-mail, nom, numéro, langue, créneau, « pas de message vocal », origine, choix SMS | Mesures précontractuelles `[À VALIDER par le juriste]` | Coffre (sealed box) ; e-mail et numéro aussi chiffrés avec la clé serveur jusqu'au dernier message | Comme les demandes (D05) |
| Messages de l'appel | E-mail, numéro | Mesures précontractuelles ; SMS seulement sur demande de la personne | Fournisseur e-mail (TEM), fournisseur SMS `[À TRANCHER]` | Journaux d'envoi du fournisseur `[À VÉRIFIER]` |
| Invitation à Cat | Titre neutre, heure, lien vers le coffre | Intérêt légitime | Google (agenda de Cat) | Dans son agenda |

- **Nouveau sous-traitant** : le fournisseur SMS (contrat de traitement signé avant l'ouverture).
- **Risques résiduels** : la clé serveur permet, pendant la fenêtre d'envoi, de lire l'e-mail et le numéro des appels à venir si le serveur est compromis ; le chemin des liens apparaît dans les journaux de Vercel.

## 8. Découpage en stories (à reporter dans `docs/plan-implementation.md` après relecture)

Prérequis : 3.2, 3.3, 3.5. Point de contrôle : ④ (contact). La story 3.6 est remplacée.

| Story | Contenu |
|---|---|
| 3.8 · Disponibilités | Tables, réglages dans le coffre, calcul des créneaux, tests unitaires |
| 3.9 · Demande de lien | Page du CTA, jetons, e-mail d'accès, anti-abus |
| 3.10 · Réservation | Page de réservation, contrainte et verrous, confirmation, invitations, notification à Cat |
| 3.11 · Déplacer et annuler | Côté personne et côté Cat, invitations mises à jour |
| 3.12 · Rappels et SMS | Fournisseur SMS, messages programmés, effacement des coordonnées |
| 3.13 · Agenda de Cat | Vues, statuts, rattachement, options SMS à Cat et récapitulatif du matin |
| 3.14 · Google Agenda (option) | Heures occupées, après l'ouverture |

## 9. Questions ouvertes

1. Libellé du CTA « Convenir d'un appel » et pages où il apparaît (contact, « Comment ça se passe », FAQ) : Cat.
2. Plages, durée, pause, délai, horizon, plafond (§3.1) : Cat.
3. Fournisseur SMS et nom d'expéditeur : après vérification.
4. Rencontre en personne hors de ce périmètre : à confirmer.
5. Base légale, consentement et mention du SMS : juriste.
6. Adresse qui reçoit les notifications de Cat tant que les boîtes du domaine ne sont pas choisies (D47).
7. **Lettre d'information** : hors de cette spec. Scaleway TEM **interdit les envois marketing** ([FAQ](https://www.scaleway.com/en/docs/transactional-email/faq/), consultée le 06/11/2026) ; il faudra un second fournisseur européen sans suivi, une inscription confirmée en deux temps et une désinscription en un clic.

## 10. Documents à mettre à jour après relecture

`docs/architecture.md` (§3 arborescence, §6.3 rappel remplacé, §6.6 boîte d'envoi étendue, §6.5 exception de chiffrement) · `docs/privacy.md` (§1, §7, §8) · `docs/plan-implementation.md` (epic 3) · `docs/email-deliverability.md` (§1 liste des messages) · `docs/trust-contact-launch.md` (§3.1 deux entrées) · `CLAUDE.md` (table des documents).
