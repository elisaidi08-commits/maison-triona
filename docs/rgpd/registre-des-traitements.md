# Registre des activités de traitement (article 30 du RGPD)

> **Statut** : brouillon du 06/11/2026, à valider par Cat. Mis à jour à chaque nouveau traitement, outil ou prestataire (`README.md` §5).
> **Pourquoi un registre** : l'exemption des entreprises de moins de 250 personnes (article 30.5) ne s'applique pas ici, car les traitements sont **réguliers** (pas occasionnels) et peuvent porter sur des **données de santé** (article 9).

## Responsable du traitement

| | |
|---|---|
| Nom ou dénomination | `[CONTENU À FOURNIR PAR CAT]` (nom commercial : Maison Triona) |
| Forme juridique, numéro BCE | `[CONTENU À FOURNIR PAR CAT]` |
| Siège ou établissement | `[CONTENU À FOURNIR PAR CAT]` (Wallonie, Belgique) |
| Contact pour les données | `[À DÉFINIR]` (`confidentialite@…` sur le domaine, D47) |
| Représentant dans l'UE | Sans objet (établi en Belgique) |
| Délégué à la protection des données | Aucun (`README.md` §1) |
| Personnes ayant accès aux données de santé | Cat (fondatrice, relation avec les familles) ; Sady (maintenance technique). Liste tenue à la disposition de l'APD ; engagement de confidentialité écrit pour chacune (loi belge du 30 juillet 2018, article 9) |

## Vue d'ensemble

| # | Traitement | Données sensibles possibles | Durée |
|---|---|---|---|
| T1 | Demandes de contact (formulaire) | Santé, mineurs | Le temps des échanges ; plafond `[À DÉFINIR]` |
| T2 | Réservation d'appel (D57) | Non | Comme T1 ; coordonnées d'envoi : appel + 24 h |
| T3 | Échanges et suivi de la relation | Santé, mineurs | `[À DÉFINIR]` |
| T4 | Présentation au professionnel choisi | Santé, mineurs | Comme T3 |
| T5 | Sélection et suivi des professionnels | Non | Collaboration + `[À DÉFINIR]` |
| T6 | Commissions et comptabilité | Non | Délais légaux `[À CONFIRMER avec le comptable]` |
| T7 | Mesure d'audience | Non | Agrégats ; empreinte : 24 h |
| T8 | Sécurité et fonctionnement du site | Non | 24 h à `[À DÉFINIR]` |
| T9 | Exercice des droits et violations | Selon la demande | `[À DÉFINIR]` |
| T10 | Stockage dans le navigateur du visiteur | Non | Session |
| T11 | Prescripteurs et contacts professionnels | Non | `[À DÉFINIR]` |
| T12 | Tests utilisateurs avant l'ouverture | Non | Fin des tests + `[À DÉFINIR]` |

Les mesures de sécurité sont décrites dans `analyse-impact.md` §5 ; les prestataires dans `sous-traitants.md`.

---

## T1 · Demandes de contact

| | |
|---|---|
| **Finalité** | Répondre aux personnes qui écrivent à la maison et, si elles le souhaitent, leur présenter un professionnel. |
| **Personnes concernées** | Visiteurs qui écrivent (clients potentiels) ; personnes pour qui la demande est faite (un parent, des enfants), si le visiteur les évoque. |
| **Données** | Service ; « pour qui » (facultatif) ; pays ; urgence ; nom ; e-mail ou téléphone ; créneau ; langue ; message (facultatif) ; « Comment avez-vous connu la maison ? » (liste fermée, D41, facultatif) ; accord ; dates. **Aucun champ de santé** ; une aide sous le message demande de ne pas donner de détails médicaux. |
| **Données sensibles possibles** | Santé (choix « grand âge », contenu du message) ; données de mineurs (garde d'enfants), si le visiteur les écrit. |
| **Source** | La personne elle-même ; un proche, pour la personne concernée ; un prescripteur (notaire, gestionnaire de patrimoine), avec l'accord de la famille (T11). |
| **Destinataires** | Cat ; Sady (maintenance, compte nominatif) ; sous-traitants : Vercel (transit, le temps du chiffrement), Scaleway (coffre chiffré ; e-mails : notification à Cat **sans contenu**, hormis « Prioritaire » dans l'objet si la demande est urgente (D06), et confirmation au visiteur **texte fixe**). |
| **Transferts hors UE** | Vercel (société américaine, fonctions à Paris). |
| **Conservation** | Le temps des échanges, puis effacement automatique par le coffre au plafond retenu `[À DÉFINIR]` (D05) ; Cat peut effacer plus tôt. Sauvegardes : 7 jours après l'effacement, contenu chiffré. |
| **Caractère obligatoire** | Service, pays, urgence, nom, e-mail ou téléphone, langue et accord : nécessaires pour répondre ; le reste est facultatif. `[À CONFIRMER avec le formulaire, story 3.1]` |
| **Sécurité (résumé)** | Contenu chiffré dès réception (sealed box) ; colonnes de tri en clair : service, pays, langue, urgence, source, dates, statut ; coffre UE ; double authentification ; journal d'accès ; rien de la demande dans les journaux techniques. ; adresse de confirmation aussi chiffrée avec la clé serveur (Key Manager) le temps des envois, puis effacée après le dernier essai (D57) ; aucun choix de « Comment avez-vous connu la maison ? » ne laisse deviner une situation de santé (liste fermée, D41) |

## T2 · Réservation d'appel (D57, remplace le rappel)

| | |
|---|---|
| **Finalité** | Convenir d'un appel téléphonique avec Cat et appeler la personne au créneau choisi ; envoyer le lien personnel, la confirmation, les rappels, les messages de déplacement ou d'annulation. |
| **Personnes concernées** | Personnes qui demandent un appel. |
| **Données** | E-mail ; nom ; numéro ; langue ; créneau ; « pas de message vocal » ; origine (facultatif) ; choix SMS ; jetons des liens (seule leur empreinte est gardée) ; statut de l'appel. ; empreinte de l'e-mail (pour retrouver un appel sans garder l'adresse lisible) |
| **Destinataires** | Cat ; Sady ; Scaleway (coffre, Key Manager, e-mails) ; fournisseur de SMS `[À DÉFINIR]` ; Google (agenda de Cat) : prévu, le titre neutre, l'heure et le lien vers le coffre, **aucun nom ni coordonnée** `[À VÉRIFIER en story 3.10 ; à revoir si la messagerie est chez Google]`. |
| **Transferts hors UE** | Vercel et Google (sociétés américaines). |
| **Conservation** | Comme T1. E-mail et numéro chiffrés avec la clé serveur : **effacés 24 h après l'appel**. Jetons : supprimés 7 jours après leur expiration. Lien d'accès valable 48 h. |
| **Sécurité (résumé)** | Sealed box comme T1 ; e-mail et numéro aussi chiffrés avec une **clé serveur** (Scaleway Key Manager) le temps des envois : exception à la sealed box, validée (D57). Aucun cookie : le lien sert de clé. |

## T3 · Échanges et suivi de la relation

| | |
|---|---|
| **Finalité** | Échanger avec la famille (e-mail, téléphone, rendez-vous), comprendre la situation, les habitudes et les attentes, présenter des personnes, prendre des nouvelles, ajuster ou remplacer (déroulé de Cat, D40). |
| **Personnes concernées** | Familles clientes ; personnes accompagnées (un parent, des enfants). |
| **Données** | Identité et coordonnées ; situation, habitudes et attentes ; éventuellement santé, si la famille en parle ; professionnel présenté et choisi ; dates ; suivi. |
| **Où** | `[À DÉFINIR]`. **Recommandation** : les notes de Cat seulement dans le coffre (chiffrées, attachées à la demande), courtes, sans diagnostic ; jamais dans un carnet, un téléphone ou une messagerie personnels. E-mails dans la messagerie de la maison (`contact@…`), hébergée par `[À DÉFINIR]`. `[À PRÉVOIR dans le coffre, story 3.2]` |
| **Destinataires** | Cat ; le professionnel choisi (T4). |
| **Transferts hors UE** | Selon l'hébergeur de la messagerie `[À DÉFINIR]`. |
| **Conservation** | `[À DÉFINIR]`. |

## T4 · Présentation au professionnel choisi

| | |
|---|---|
| **Finalité** | Permettre au professionnel présenté (indépendant ou maison partenaire) de rencontrer la famille et de lui proposer son contrat. |
| **Données transmises** | Nom ; coordonnées ; ce qui est utile de la situation (besoin, lieu, horaires souhaités, habitudes) ; **rien de plus**. |
| **Trace** | Accord de la famille à chaque présentation : date, professionnel, informations transmises `[À PRÉVOIR dans le coffre]`. |
| **Destinataires** | Le professionnel ou la maison partenaire choisis, pour leur propre relation avec la famille. Clause de confidentialité et de protection des données dans la convention avec chaque professionnel `[À RÉDIGER]`. |
| **Transferts hors UE** | Selon le lieu d'établissement du professionnel. |
| **Conservation** | Chez la maison : comme T3. Chez le professionnel : sous sa responsabilité. |
| **Canal** | `[À DÉFINIR]` : de préférence de vive voix ou par un message court, sans information de santé écrite. |

## T5 · Sélection et suivi des professionnels

| | |
|---|---|
| **Finalité** | Rencontrer, vérifier et choisir les professionnels présentés ; suivre la collaboration ; en présenter un autre si besoin (« Chaque professionnel présenté a été rencontré et vérifié. », principe Sélection, confirmé par Cat). |
| **Personnes concernées** | Professionnels indépendants (personnes physiques) ; contacts des maisons partenaires ; candidats non retenus. |
| **Données** | Identité ; coordonnées ; statut (indépendant, société) et numéro d'entreprise ; qualifications, expérience, références ; langues, zones, disponibilités ; retours des familles ; convention ; plus tard, accords d'affichage (D46). |
| **Destinataires** | Cat ; familles, au moment d'une présentation (ce qui est utile : prénom, qualifications, expérience) ; comptable (T6). |
| **Transferts hors UE** | Aucun. |
| **Information des personnes** | Notice d'information remise aux professionnels et aux candidats `[À RÉDIGER]`. |
| **Conservation** | Durée de la collaboration, puis `[À DÉFINIR]` ; candidats non retenus : `[À DÉFINIR]`. |
| **Phase 2** | Partenaires affichés sur le site : fiche à créer avant l'affichage (accord écrit de chaque partenaire, D46 ; `docs/partners-credibility.md`). |

## T6 · Commissions et comptabilité

| | |
|---|---|
| **Finalité** | Facturer aux professionnels la commission sur leurs prestations mensuelles (D40) ; tenir la comptabilité. |
| **Personnes concernées** | Professionnels indépendants (personnes physiques) ; familles, seulement si une facture les mentionne (à éviter : référence interne plutôt que leur nom `[À DÉFINIR]`). |
| **Données** | Identité ; numéro d'entreprise et de TVA ; coordonnées bancaires ; montants ; prestations concernées. |
| **Destinataires** | Comptable `[À DÉFINIR]` ; administration fiscale sur demande ; banque. |
| **Transferts hors UE** | Aucun. |
| **Conservation** | Délais légaux belges de conservation des pièces comptables `[À CONFIRMER avec le comptable]`. |

## T7 · Mesure d'audience

| | |
|---|---|
| **Finalité** | Savoir si le site est utile et quels choix d'entrée sont utilisés, en totaux. |
| **Personnes concernées** | Visiteurs du site. |
| **Données** | Pages vues **sans paramètres** ; événements `Entrée` (choix), `Langue`, `Partage`, sans identifiant ; pour compter les visiteurs, empreinte quotidienne de l'IP et du navigateur avec une clé effacée toutes les 24 h ; IP non conservée ; pays, région et ville déduits. |
| **Destinataires** | Plausible (UE ; données en Allemagne, à vérifier à la signature), servi depuis le domaine du site. |
| **Transferts hors UE** | Aucun. |
| **Conservation** | Totaux ; empreinte : 24 h. |

## T8 · Sécurité et fonctionnement du site

| | |
|---|---|
| **Finalité** | Protéger les formulaires contre les envois abusifs ; faire fonctionner et sécuriser le site ; tracer les accès au coffre. |
| **Personnes concernées** | Visiteurs du site ; personnes qui envoient un formulaire ; Cat et Sady (comptes du coffre). |
| **Données** | Empreinte d'IP calculée avec une clé changée chaque jour, empreinte de l'adresse de confirmation, compteurs (Upstash) ; journaux de l'hébergeur (adresse de la page, date, IP, navigateur) ; journal d'accès au coffre (compte, date, action, identifiant de demande, **jamais le contenu**) ; statut technique des envois (identifiant d'événement et résultat). ; comptes du coffre (identifiant, empreinte du mot de passe, secret de double authentification, sessions ; adresse IP et navigateur des sessions `[À VÉRIFIER en story 3.2]`) ; journaux d'envoi des fournisseurs d'e-mail et de SMS et listes de rebonds (durée `[À VÉRIFIER selon le fournisseur]`) |
| **Destinataires** | Upstash, Vercel, Scaleway ; Cat et Sady. |
| **Transferts hors UE** | Upstash et Vercel (sociétés américaines). |
| **Conservation** | Anti-abus : 24 h au plus. Journaux de l'hébergeur : 1 jour `[À CONFIRMER à la mise en ligne]` (aucun export de journaux, pas d'option d'observabilité étendue). Journal d'accès : `[À DÉFINIR]`. |
| **Point d'attention** | Les liens de réservation (avec leur jeton) apparaissent dans les journaux de l'hébergeur : validité de 48 h, annulés à la réservation. Aucun lien vers le formulaire ne porte plus le service dans son adresse (`?service=` retiré, D26, PR n° 40). |

## T9 · Exercice des droits et violations de données

| | |
|---|---|
| **Finalité** | Répondre aux demandes d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité ; documenter les violations de données et leur traitement (`procedures.md`). |
| **Personnes concernées** | Personnes qui exercent leurs droits ; personnes touchées par une violation. |
| **Données** | Identité du demandeur ; objet de la demande ; échanges ; réponse ; dates. Violations : faits, données et personnes touchées, effets, mesures prises. |
| **Destinataires** | Cat ; Sady pour l'exécution technique ; APD en cas de notification. |
| **Transferts hors UE** | Aucun. |
| **Conservation** | `[À DÉFINIR]` (le temps de pouvoir prouver la réponse ou la gestion de la violation). |

## T10 · Stockage dans le navigateur du visiteur

| | |
|---|---|
| **Finalité** | Fonctions demandées par le visiteur : ne pas perdre ses choix d'une page ou d'une étape à l'autre ; ne pas reproposer la suggestion de langue fermée ; garder les vidéos en pause. |
| **Personnes concernées** | Visiteurs du site. |
| **Données** | Choix du formulaire (service, pays, langue, créneau) ; suggestion de langue fermée ; vidéos en pause. **Jamais** « pour qui », le nom, les coordonnées, le message ni l'urgence. |
| **Où** | Navigateur du visiteur seulement (`sessionStorage`) ; rien n'est envoyé à la maison. |
| **Destinataires** | Aucun. |
| **Conservation** | Effacé à la fermeture de l'onglet ; choix du formulaire effacés aussi à l'envoi. |

## T11 · Prescripteurs et contacts professionnels

| | |
|---|---|
| **Finalité** | Entretenir les relations avec les prescripteurs (notaires, gestionnaires de patrimoine) et les contacts rencontrés lors de salons ; recevoir leurs recommandations (D41). |
| **Personnes concernées** | Prescripteurs ; contacts professionnels. |
| **Données** | Nom, fonction, organisation, coordonnées professionnelles, échanges. |
| **Source** | Cartes de visite, salons, recommandations. |
| **Destinataires** | Cat. |
| **Transferts hors UE** | Selon l'hébergeur de la messagerie `[À DÉFINIR]`. |
| **Conservation** | `[À DÉFINIR]`. |
| **Point d'attention** | Quand un prescripteur recommande une famille, les informations de la famille relèvent de T1 et T3, avec son accord. |

## T12 · Tests utilisateurs avant l'ouverture

| | |
|---|---|
| **Finalité** | Vérifier avec quelques personnes que le site est clair et accessible avant l'ouverture (`docs/usability-protocol.md`, D47). |
| **Personnes concernées** | Testeurs volontaires, hors clients, prestataires et proches (D47). |
| **Données** | Prénom ou pseudonyme, profil utile au test, observations ; aucun nom dans le rapport. |
| **Source** | Les testeurs, avec leur accord. |
| **Destinataires** | Cat ; Sady. |
| **Transferts hors UE** | Aucun. |
| **Conservation** | Le temps des tests, puis `[À DÉFINIR]` ; le rapport reste anonyme. |

## Traitements à créer avant leur mise en service

- **Partenaires affichés** (phase 2) : voir T5.
- **Lettre d'information** (envisagée par D57) : base (consentement), désinscription, second fournisseur d'e-mail (Scaleway TEM interdit l'envoi commercial).
- **CMS** (après l'ouverture, D45) : textes publics seulement, aucune donnée personnelle ; à vérifier au branchement.
