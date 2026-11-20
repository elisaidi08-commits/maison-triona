# Réservation d'appel — spec

> **Statut** : conception validée par Sady le 06/11/2026 (D57). **Story 3.8 livrée** : moteur de calcul (partie A, #44) et disponibilités dans le coffre (partie B, 19/11/2026 : `docs/architecture.md` §6.3). **Story 3.10 livrée le 19/11/2026** : réservation par lien personnel, confirmation et fichier .ics, lien créé depuis le coffre en attendant l'e-mail (§10). **Story 3.9 livrée le 20/11/2026** : demande de lien et e-mail d'accès (§10). Le reste (3.11 à 3.14) n'est pas installé.
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

1. **CTA « Convenir d'un appel »** `[À VALIDER : absent de la liste des CTA approuvés]` vers `/fr/contact/appel` (`/en/contact/call` ; table des URL : `docs/architecture.md` §4). La page ne demande que l'**adresse e-mail** ; la langue vient de l'URL. Réponse toujours identique : « Un lien vient de vous être envoyé. Il est valable 48 heures. »
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
| Semaine type (plages par jour) | Lundi à vendredi, 10 h 30-12 h 30 et 16 h-18 h (D41 : fin de matinée, fin d'après-midi) | Validé par Sady (06/11) ; heures exactes à confirmer par Cat |
| Durée d'un appel | 30 min | Validé par Sady (06/11) |
| Pause entre deux appels | 15 min | Validé par Sady (06/11) |
| Délai minimal avant un appel | 24 h | Validé par Sady (06/11) |
| Horizon de réservation | 3 semaines | Validé par Sady (06/11) |
| Plafond d'appels par jour | **4** | Validé par Sady (06/11 : « 4 appels par jour, c'est parfait ») |

Toutes ces valeurs restent réglables par Cat dans le coffre, dans des bornes proposées `[À CONFIRMER par Sady]` (3.8 B, `SETTINGS_LIMITS`, doublées par la base) : durée de 15 à 120 min et pause de 0 à 60 min, par pas de 5 ; délai d'une heure à une semaine, à l'heure près ; horizon de 1 à 90 jours ; plafond de 1 à 12 appels par jour.
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
| Nouvelle réservation (option) | SMS à Cat | « Maison Triona : nouvel appel mardi 24/11 à 10 h 30. » (`renderCatSms`, `src/lib/sms/templates.ts` : en Belgique, l'expéditeur est un numéro court) |
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

Fonction pure `computeSlots({ settings, rules, exceptions, bookings, busy, now })` dans `src/lib/booking/slots.ts` : semaine type, moins les absences, moins les réservations confirmées, moins les heures occupées (option Google), dans le délai minimal et l'horizon, sous le plafond quotidien. Fuseau `Europe/Brussels`, passages à l'heure d'été et d'hiver couverts par les tests. Gestion des fuseaux : API `Intl`, sans dépendance (`src/lib/booking/zoned-time.ts`) ; Node 24 n'a pas `Temporal` (vérifié le 06/11/2026). Les appels confirmés gardent la plage enregistrée en base (`slot` : début, fin + pause du moment de la réservation), même si Cat change la pause ensuite : le calcul ne propose jamais un créneau que la contrainte d'exclusion refuserait.

### 4.4 Liens et sécurité

- Jeton de 32 octets aléatoires (base64url) ; la base ne garde que son empreinte.
- **Ouvrir un lien n'engage rien** : la page affichée par `GET` ne modifie rien (les messageries d'entreprise ouvrent les liens pour les analyser) ; seule la Server Action (`POST`) réserve, déplace ou annule.
- Pages de lien : `noindex`, `Cache-Control: no-store`, `Referrer-Policy: strict-origin` (l'origine seule, jamais le chemin ni le jeton ; `no-referrer` ferait envoyer `Origin: null` au formulaire sans JavaScript, que Next refuse : écart de la 3.10, §10), hors du sitemap.
- Anti-abus (3.5) : honeypot, horodatage signé, limitation de débit (Upstash, UE) sur la demande de lien : 3 par 10 minutes par empreinte d'IP, 3 par 24 heures par `email_hmac`.
- **Aucun cookie** sur le site public : le lien sert de clé.
- **Risque résiduel** à écrire dans `docs/privacy.md` : le chemin du lien apparaît dans les journaux de Vercel ; délai court de 48 heures, accès aux journaux restreint.

### 4.5 Envois

- **Boîte d'envoi** de 3.3, étendue : `send_at` (messages programmés), `channel` (`email` · `sms`), gabarit, `booking_id`. Elle ne contient **aucune coordonnée** : le serveur lit `contact_kms` au moment de l'envoi ; si elle est effacée, le message est abandonné. Tâche planifiée Vercel Cron toutes les 5 minutes.
- **Tâche quotidienne** (`/api/cron/booking`) : appels passés en « à qualifier », effacement de `contact_kms`, purge des jetons.
- **Invitations** : `src/lib/booking/ics.ts`, écrit à la main (sous-ensemble RFC 5545), sans dépendance. `METHOD:REQUEST` puis `METHOD:CANCEL`, `UID` stable par destinataire (`<id>-guest@`, `<id>-host@`), `SEQUENCE` incrémentée à chaque déplacement, `VTIMEZONE` Europe/Brussels. À tester dans Google Agenda, Apple Calendrier et Outlook.
- **SMS** : adaptateur `src/lib/sms` (fournisseur interchangeable, comme `lib/email`). Fournisseur **seven** (Allemagne, D71 ; comparaison et questions à poser avant la signature : `docs/sms-fournisseur.md`). Expéditeur **« Triona »** en France, au Luxembourg, à Monaco et en Suisse ; **numéro court en Belgique**, où les opérateurs refusent tout nom d'expéditeur : le texte commence donc toujours par « Maison Triona ». **Aucun lien** : le SMS renvoie à l'e-mail pour déplacer ou annuler (D71). Textes de **145 caractères au plus** dans l'alphabet GSM-7, pour garder la marge d'un « STOP » ajouté par un opérateur (un seul caractère hors GSM-7 ramène la limite à 70) ; dates en chiffres ; aucun service nommé, car le SMS s'affiche sur l'écran verrouillé. En Belgique, la personne peut répondre STOP au numéro court : le rappel programmé est alors abandonné, si seven nous le signale `[À VÉRIFIER : question 5 à seven]`.

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
| Messages de l'appel | E-mail, numéro | Mesures précontractuelles ; SMS seulement sur demande de la personne | Fournisseur e-mail (TEM) ; SMS : seven (Allemagne, D71) | TEM : métadonnées tant que le domaine est actif ; seven : journal réglé sur l'effacement immédiat, journaux de trafic jusqu'à 60 jours selon ses conditions `[À VÉRIFIER : question 1 à seven]` |
| Invitation à Cat | Titre neutre, heure, lien vers le coffre | Intérêt légitime | Google (agenda de Cat) | Dans son agenda |

- **Nouveau sous-traitant** : seven (D71), contrat de traitement signé au nom de la société avant l'ouverture. Envoi vers Monaco, sans décision d'adéquation de l'UE : `[À VALIDER par le juriste]`.
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
2. ~~Plages, durée, pause, délai, horizon, plafond (§3.1)~~ : validés par Sady le 06/11 ; heures exactes des plages à confirmer par Cat.
3. ~~Fournisseur SMS et nom d'expéditeur~~ : seven, « Triona », SMS sans lien (D71) ; « Triona » à présenter à Cat.
4. Rencontre en personne hors de ce périmètre : à confirmer.
5. Base légale, consentement et mention du SMS : juriste.
6. Adresse qui reçoit les notifications de Cat tant que les boîtes du domaine ne sont pas choisies (D47).
7. **Lettre d'information** : hors de cette spec. Scaleway TEM **interdit les envois marketing** ([FAQ](https://www.scaleway.com/en/docs/transactional-email/faq/), consultée le 06/11/2026) ; il faudra un second fournisseur européen sans suivi, une inscription confirmée en deux temps et une désinscription en un clic.

## 10. Documents mis à jour (06/11/2026, après relecture de Sady)

`docs/architecture.md` (§3 arborescence, §6.3 rappel remplacé, §6.6 boîte d'envoi étendue, §6.5 exception de chiffrement) · `docs/privacy.md` (§1, §7, §8) · `docs/plan-implementation.md` (epic 3) · `docs/email-deliverability.md` (§1 liste des messages) · `docs/trust-contact-launch.md` (§3.1 deux entrées) · `CLAUDE.md` (table des documents).

**19/11/2026, story 3.8 B** (disponibilités dans le coffre) : `docs/architecture.md` §6.3 (tables, page, droits, journal, point d'accroche de la 3.10) et §6.5 (journal d'accès : `availability`) · `docs/coffre-cles.md` §3.2 (droits du rôle `coffre`) · `docs/plan-implementation.md` (3.8, lot E). Écarts avec cette spec : le fuseau est **figé** sur Bruxelles par la base (en changer demande une migration) ; jours fériés préremplis de **2026 à 2035** par la migration, années suivantes par un bouton de la page ; bornes des réglages proposées `[À CONFIRMER par Sady]` (§3.1, ci-dessous).

**19/11/2026, story 3.10** (réservation) : `docs/architecture.md` §3, §6.3 (réservation livrée, point d'accroche branché), §6.5 (journal : `booking_link`) et §9.1 (en-têtes des liens) · `docs/coffre-cles.md` §3.1 et §3.2 (droits des deux rôles) · `docs/privacy.md` §1 et §8 · `docs/rgpd/registre-des-traitements.md` (T2) · `docs/plan-implementation.md` (3.9 en partie, 3.10, lot E). Écarts avec cette spec, à valider par Sady :
- **Données** (§4.1) : la langue, le choix SMS et l'origine sont **scellés** avec le nom et le numéro (consigne de la story), pas en clair ; restent en clair le créneau, le statut, la version de la politique acceptée et l'échéance de conservation. La 3.12 devra relire langue et choix SMS pour envoyer (clé serveur, `contact_kms`). Ni e-mail, ni `email_hmac`, ni `request_id` dans `bookings` tant que la 3.9 n'existe pas ; `booking_tokens.email_hmac` existe, vide.
- **« Pas de message vocal »** (§2) : une **mention** (« Nous ne laissons jamais de message vocal »), pas une case : rien n'est recueilli. La politique de confidentialité en brouillon parle encore d'une « préférence » : à aligner.
- **Lien d'accès consommé** (§2, étape 4) : sans lien de gestion (3.11), le lien d'accès utilisé ne rouvre plus la réservation mais sert de clé à la confirmation et au fichier .ics jusqu'à la fin de l'appel. La 3.11 le remplacera par le lien de gestion.
- **Invitation** (§4.5) : fichier « Ajouter à mon agenda » téléchargé (`METHOD:PUBLISH`, heures en UTC, sans VTIMEZONE) ; les invitations par e-mail (`REQUEST`, `CANCEL`, VTIMEZONE) viendront avec l'envoi. Ni e-mail, ni notification à Cat (3.3) : points d'accroche notés dans `src/actions/booking.ts`.
- **Fuseau** (§2) : heure de Bruxelles seulement ; le lien « Changer de fuseau » n'est pas fait.
- **Numéro** : même contrôle que le formulaire de contact (`telephoneValide`) ; `libphonenumber-js` non installé.
- **Anti-abus** (§4.4) : sur la page de réservation, limitation de débit par empreinte d'IP (5 envois valides par 10 minutes) et lien lu avant tout scellement ; piège et horodatage restent pour la demande de lien (3.9).
- **SMS** : case masquée tant que le fournisseur n'est pas choisi (`BOOKING_SMS_OPT_IN` absente) ; la politique de confidentialité (brouillon) ne parle ni d'e-mail, ni de SMS, ni d'agenda Google pour les appels tant qu'ils ne partent pas.
- **Conservation** : par la tâche existante (`/api/cron/retention`, pas `/api/cron/booking`) : réservations effacées à leur échéance, jetons 48 h après leur expiration (pas 7 jours), sauf le lien qui sert encore à revoir la confirmation d'un appel à venir. Deux compteurs au journal (`purged_bookings`, `purged_tokens`, migration 0010).
- **Consommation d'un lien** : un déclencheur (migration 0010) refuse toute mise à jour de `used_at` déjà posée, remise à zéro ou sans réservation qui pointe vers le jeton.


**19/11/2026, fournisseur SMS (D71)** : `docs/sms-fournisseur.md` (comparaison, questions à seven) · cette spec §4.5, §7 et §9 · `docs/privacy.md` (§1, sous-traitants) · `docs/rgpd/sous-traitants.md` (seven, transferts vers la Suisse et Monaco) · `docs/rgpd/registre-des-traitements.md` (T2, T8) · `docs/rgpd/analyse-impact.md` · `docs/email-deliverability.md` §1 · `docs/architecture.md` §6.6 · `docs/plan-implementation.md` (3.12) · `docs/launch-checklist.md` §3 · `CLAUDE.md`. Aucun code : la case SMS reste masquée jusqu'à la 3.12.

**20/11/2026, story 3.9** (demande de lien) : `docs/architecture.md` §6.3 · `docs/coffre-cles.md` §3.1 · `docs/privacy.md` (§1, §7, §8) · `docs/rgpd/` (sous-traitants, registre) · `docs/plan-implementation.md` (3.9, lot E). Écarts avec cette spec, à valider par Sady :
- **E-mail d'accès sans reprise** (§4.5) : ni l'adresse ni le jeton ne sont gardés (pas encore de Key Manager, `email_kms` non créé) ; le message part au premier essai (deux tentatives à 2 s), sinon il est abandonné (`no_contact`) avec une alerte à Sady, et la personne redemande un lien. **Accepté par Sady (D72)** : pas de renvoi avant le Key Manager (3.12 B), l'alerte suffit.
- **Réponse** : « Un lien vient de vous être envoyé. » s'affiche aussi quand rien ne part (adresse ou IP limitée, plafond du jour, robot) : c'est le prix de la réponse identique (§2). **Gardée telle quelle (D72).** Le lien et l'e-mail s'écrivent **après** la réponse (`after()`) : une base injoignable ne se voit pas à l'écran.
- **Limites** (§4.4) : comme la spec, plus un plafond global **bloquant** de 100 liens par jour et une demande **fermée** sans Upstash sur un déploiement (sa panne n'ouvre jamais l'envoi sans limite). **Confirmé par Sady (D72, 20/11/2026)**, avec une **alerte à Sady au premier dépassement du jour** (la date seulement, `docs/architecture.md` §6.6).
- **Appel à venir** (§2, étape 2) : pas encore de « une réservation à venir par adresse » ni d'ouverture de la page de gestion (3.11) ; un nouveau lien est envoyé.
- **Lien expiré** (§5) : « Recevoir un nouveau lien » mène à la page de demande (l'adresse n'est pas connue, elle est ressaisie).
- **Chemins** : `/en/contact/call` et `/en/contact/call/sent` pour la demande ; les liens personnels gardent `/en/contact/appel/<jeton>` (écart de la 3.10).

**19/11/2026, story 3.13, en partie** (agenda de Cat, `/coffre/appels`) : `docs/architecture.md` §6.3 (agenda), §6.5 (journal : `booking_list`, `booking_read`, `booking_status`, `booking_attach`, colonne `booking_id`) et §9.1 (`'wasm-unsafe-eval'` sur `/coffre/appels`) · `docs/coffre-cles.md` §3.2 (droits du rôle `coffre`) · `docs/privacy.md` §1 (journal d'accès, réservation installée) · `docs/rgpd/` (registre T2, analyse d'impact §6, procédures) · `docs/decisions.md` (D75) · `docs/plan-implementation.md` (3.13). Fait : vues « Aujourd'hui » et « Cette semaine » ; statuts, « à qualifier » déduit et jamais stocké ; « Fait » et « Pas de réponse » ; rattachement à une demande (`request_id`, remis à nul si la demande est effacée) ; nom, numéro (lien `tel:`), langue, « pas de message vocal » et origine déchiffrés dans le navigateur seulement ; chaque lecture et chaque action au journal, sans contenu (migration `0013_agenda.sql`). Écarts avec cette spec (§3.2), **validés par Sady le 20/11/2026 (D75)** :
- **Qualification dès le début de l'appel**, pas seulement après l'heure de fin : un appel sans réponse se sait tout de suite. « À qualifier » s'affiche, lui, à l'heure de fin. Cat peut corriger « fait » en « pas de réponse » et l'inverse ; jamais de retour à « confirmé ». La base l'impose sous tout rôle (déclencheur), et refuse toute annulation jusqu'à la 3.11.
- **« Restent à qualifier »** : section en plus des deux vues, pour les appels confirmés d'avant la vue jamais qualifiés (50 au plus) ; sans elle, un appel du vendredi serait perdu le lundi.
- **« Pas de message vocal »** : rappelé à chaque appel comme règle de la maison (D41), puisque la 3.10 n'en recueille rien (mention, pas une case).
- **Le choix SMS** (scellé) n'est pas affiché : aucun SMS ne part avant la 3.12.
- **Rattachement** : liste des 30 demandes les plus récentes, colonnes en clair seulement (date, type, besoin, pays), plus la demande déjà rattachée ; l'affichage de cette liste est couvert par la ligne `booking_list`, sans ligne `list` à part.
- **Plage et plafond d'un appel qualifié** (relecture sécurité, 20/11/2026) : un appel « fait » ou « pas de réponse » garde sa plage dans la contrainte d'exclusion et compte dans le plafond du jour, comme un appel confirmé (`listConfirmedCalls`, migration 0013) ; seul un appel annulé (3.11) libérera la sienne.
- **Page d'une demande** : elle montre ses appels rattachés (date, heure, statut, sans contenu), pour que l'effacement à la demande de la personne n'oublie pas l'appel (`docs/rgpd/procedures.md`).
- **Lecture** : `lireScellesAppels` accepte tout identifiant d'appel (pas seulement ceux de la page), puisque la session est autorisée et que chaque appel rendu est journalisé ; borne de 134 appels par lecture, tirée des constantes (une semaine au plafond le plus haut, plus 50 à qualifier), à revoir avec la 3.11.
- **Hors périmètre, notés seulement** : déplacer et annuler depuis le coffre, avec le message courtois et le lien vers un autre créneau (3.11) ; messages et SMS à la personne (3.12) ; notification sans nom à Cat, invitation Google, SMS à Cat et récapitulatif du matin (§3.3 ; en attente de Scaleway Key Manager et de la boîte d'envoi).
