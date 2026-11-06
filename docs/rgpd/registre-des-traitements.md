# Registre des activités de traitement (article 30 du RGPD)

> **Statut** : brouillon du 06/11/2026, à valider par Cat et son juriste. Mis à jour à chaque nouveau traitement, outil ou prestataire (`README.md` §6).
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

## Vue d'ensemble

| # | Traitement | Base légale (proposée) | Données sensibles possibles | Durée |
|---|---|---|---|---|
| T1 | Demandes de contact (formulaire) | 6.1.b ; 9.2.a si santé | Santé, mineurs | Échanges + 12 mois au plus |
| T2 | Réservation d'appel (D57) | 6.1.b | Non | Comme T1 ; coordonnées d'envoi : appel + 24 h |
| T3 | Échanges et suivi de la relation | 6.1.b ; 9.2.a si santé | Santé, mineurs | `[À DÉFINIR]` |
| T4 | Présentation au professionnel choisi | 6.1.b, avec l'accord de la famille ; 9.2.a si santé | Santé, mineurs | Comme T3 |
| T5 | Sélection et suivi des professionnels | 6.1.b ; 6.1.f | Condamnations pénales (à exclure sauf base légale, J14) | Collaboration + `[À DÉFINIR]` |
| T6 | Commissions et comptabilité | 6.1.b ; 6.1.c | Non | Délais légaux `[À CONFIRMER avec le comptable]` |
| T7 | Mesure d'audience | 6.1.f | Non | Agrégats ; empreinte : 24 h |
| T8 | Sécurité et fonctionnement du site | 6.1.f | Non | 24 h à `[À DÉFINIR]` |
| T9 | Exercice des droits et violations | 6.1.c | Selon la demande | `[À DÉFINIR]` |
| T10 | Stockage dans le navigateur du visiteur | Strictement nécessaire (fonction demandée) | Non | Session |

Toutes les bases légales et durées sont `[À VALIDER JURIDIQUEMENT]` (question J10). Les mesures de sécurité sont décrites dans `analyse-impact.md` §5 ; les prestataires dans `sous-traitants.md`.

---

## T1 · Demandes de contact

| | |
|---|---|
| **Finalité** | Répondre aux personnes qui écrivent à la maison et, si elles le souhaitent, leur présenter un professionnel. |
| **Base légale** | Mesures précontractuelles prises à la demande de la personne (6.1.b). Si le message révèle malgré tout une information de santé : consentement explicite (9.2.a), recueilli par la case cochée avant l'envoi. `[À VALIDER JURIDIQUEMENT]` (J2, J10) |
| **Personnes concernées** | Visiteurs qui écrivent (clients potentiels) ; personnes pour qui la demande est faite (un parent, des enfants), si le visiteur les évoque. |
| **Données** | Service ; « pour qui » (facultatif) ; pays ; urgence ; nom ; e-mail ou téléphone ; créneau ; langue ; message (facultatif) ; « Comment avez-vous connu la maison ? » (liste fermée, D41, facultatif) ; accord ; dates. **Aucun champ de santé** ; une aide sous le message demande de ne pas donner de détails médicaux. |
| **Données sensibles possibles** | Santé (choix « grand âge », contenu du message) ; données de mineurs (garde d'enfants), si le visiteur les écrit. |
| **Source** | La personne elle-même (ou un proche, pour la personne concernée : question J2). |
| **Destinataires** | Cat ; Sady (maintenance, compte nominatif) ; sous-traitants : Vercel (transit, le temps du chiffrement), Scaleway (coffre chiffré ; e-mails : notification à Cat **sans contenu**, confirmation au visiteur **texte fixe**), Upstash (anti-abus). |
| **Transferts hors UE** | Vercel (société américaine, fonctions à Paris) : cadre de protection des données UE–États-Unis et clauses du contrat `[À VALIDER JURIDIQUEMENT]`. |
| **Conservation** | Le temps des échanges, puis **au plus 12 mois après le dernier échange**, que la demande ait abouti ou non (plafond appliqué chaque jour par le coffre, D05) ; Cat peut effacer plus tôt. Sauvegardes : 7 jours après l'effacement, contenu chiffré. |
| **Caractère obligatoire** | Service, pays, urgence, nom, e-mail ou téléphone, langue et accord : nécessaires pour répondre ; le reste est facultatif. `[À CONFIRMER avec le formulaire, story 3.1]` |
| **Sécurité (résumé)** | Contenu chiffré dès réception (sealed box) ; colonnes de tri en clair : service, pays, langue, urgence, source, dates, statut ; coffre UE ; double authentification ; journal d'accès ; rien de la demande dans les journaux techniques. |

## T2 · Réservation d'appel (D57, remplace le rappel)

| | |
|---|---|
| **Finalité** | Convenir d'un appel téléphonique avec Cat et appeler la personne au créneau choisi ; envoyer le lien personnel, la confirmation, les rappels, les messages de déplacement ou d'annulation. |
| **Base légale** | Mesures précontractuelles (6.1.b). SMS seulement si la personne les demande (case non cochée par défaut). `[À VALIDER JURIDIQUEMENT]` (J13) |
| **Personnes concernées** | Personnes qui demandent un appel. |
| **Données** | E-mail ; nom ; numéro ; langue ; créneau ; « pas de message vocal » ; origine (facultatif) ; choix SMS ; jetons des liens (seule leur empreinte est gardée) ; statut de l'appel. |
| **Destinataires** | Cat ; Sady ; Scaleway (coffre, Key Manager, e-mails) ; fournisseur de SMS `[À DÉFINIR]` ; Google (agenda de Cat : titre neutre, heure, lien vers le coffre, **aucun nom ni coordonnée**). |
| **Transferts hors UE** | Vercel et Google (sociétés américaines) : cadre UE–États-Unis `[À VALIDER JURIDIQUEMENT]` ; Google ne reçoit aucune donnée qui nomme la personne. |
| **Conservation** | Comme T1. E-mail et numéro chiffrés avec la clé serveur : **effacés 24 h après l'appel**. Jetons : supprimés 7 jours après leur expiration. Lien d'accès valable 48 h. |
| **Sécurité (résumé)** | Sealed box comme T1 ; e-mail et numéro aussi chiffrés avec une **clé serveur** (Scaleway Key Manager) le temps des envois : exception à la sealed box, validée (D57). Aucun cookie : le lien sert de clé. |

## T3 · Échanges et suivi de la relation

| | |
|---|---|
| **Finalité** | Échanger avec la famille (e-mail, téléphone, rendez-vous), comprendre la situation, les habitudes et les attentes, présenter des personnes, prendre des nouvelles, ajuster ou remplacer (déroulé de Cat, D40). |
| **Base légale** | Mesures précontractuelles puis service de mise en relation demandé par la famille (6.1.b) ; consentement explicite (9.2.a) pour toute information de santé que la famille confie et que Cat note. `[À VALIDER JURIDIQUEMENT]` (J2, J10) |
| **Personnes concernées** | Familles clientes ; personnes accompagnées (un parent, des enfants). |
| **Données** | Identité et coordonnées ; situation, habitudes et attentes ; éventuellement santé, si la famille en parle ; professionnel présenté et choisi ; dates ; suivi. |
| **Où** | `[À DÉFINIR]`. **Recommandation** : les notes de Cat seulement dans le coffre (chiffrées, attachées à la demande), courtes, sans diagnostic ; jamais dans un carnet, un téléphone ou une messagerie personnels. E-mails dans la messagerie de la maison (`contact@…`), hébergée par `[À DÉFINIR]`. |
| **Destinataires** | Cat ; le professionnel choisi (T4). |
| **Transferts hors UE** | Selon l'hébergeur de la messagerie `[À DÉFINIR]`. |
| **Conservation** | `[À DÉFINIR]`. Proposition : le temps de la relation, puis 12 mois après le dernier échange, comme T1. |

## T4 · Présentation au professionnel choisi

| | |
|---|---|
| **Finalité** | Permettre au professionnel présenté (indépendant ou maison partenaire) de rencontrer la famille et de lui proposer son contrat. |
| **Base légale** | À la demande de la famille (6.1.b), **avec son accord à chaque présentation** ; consentement explicite (9.2.a) pour toute information de santé transmise. `[À VALIDER JURIDIQUEMENT]` (J5) |
| **Données transmises** | Nom ; coordonnées ; ce qui est utile de la situation (besoin, lieu, horaires souhaités, habitudes) ; **rien de plus**. |
| **Destinataires** | Le professionnel ou la maison partenaire choisis : **responsables distincts** pour leur propre relation avec la famille (ce ne sont pas des sous-traitants). Clause de confidentialité et de protection des données dans la convention avec chaque professionnel `[À RÉDIGER avec le juriste]`. |
| **Transferts hors UE** | Professionnel établi en Suisse : décision d'adéquation de l'UE pour la Suisse. Professionnel établi à **Monaco** : pas de décision d'adéquation à notre connaissance ; base du transfert à faire trancher `[À VALIDER JURIDIQUEMENT]` (J8). |
| **Conservation** | Chez la maison : comme T3. Chez le professionnel : sous sa responsabilité. |
| **Canal** | `[À DÉFINIR]` : de préférence de vive voix ou par un message court, sans information de santé écrite. |

## T5 · Sélection et suivi des professionnels

| | |
|---|---|
| **Finalité** | Rencontrer, vérifier et choisir les professionnels présentés ; suivre la collaboration ; en présenter un autre si besoin (« Chaque personne présentée a été rencontrée et vérifiée », principe Sélection, confirmé par Cat). |
| **Base légale** | Mesures précontractuelles et convention avec le professionnel (6.1.b) ; intérêt légitime de la maison à présenter des personnes sûres (6.1.f). **Données relatives aux condamnations pénales** (extrait de casier judiciaire) : interdites sans base légale (article 10) `[À VALIDER JURIDIQUEMENT]` (J14). |
| **Personnes concernées** | Professionnels indépendants (personnes physiques) ; contacts des maisons partenaires ; candidats non retenus. |
| **Données** | Identité ; coordonnées ; statut (indépendant, société) et numéro d'entreprise ; qualifications, expérience, références ; langues, zones, disponibilités ; retours des familles ; convention ; plus tard, accords d'affichage (D46). |
| **Destinataires** | Cat ; familles, au moment d'une présentation (ce qui est utile : prénom, qualifications, expérience) ; comptable (T6). |
| **Conservation** | Durée de la collaboration, puis `[À DÉFINIR]` ; candidats non retenus : `[À DÉFINIR]` (proposition : 12 mois, avec leur accord pour une collaboration future). |
| **Phase 2** | Partenaires affichés sur le site : fiche à créer avant l'affichage (accord écrit de chaque partenaire, D46 ; `docs/partners-credibility.md`). |

## T6 · Commissions et comptabilité

| | |
|---|---|
| **Finalité** | Facturer aux professionnels la commission sur leurs prestations mensuelles (D40) ; tenir la comptabilité. |
| **Base légale** | Convention avec le professionnel (6.1.b) ; obligations comptables et fiscales (6.1.c). |
| **Personnes concernées** | Professionnels indépendants (personnes physiques) ; familles, seulement si une facture les mentionne (à éviter : référence interne plutôt que leur nom `[À DÉFINIR]`). |
| **Données** | Identité ; numéro d'entreprise et de TVA ; coordonnées bancaires ; montants ; prestations concernées. |
| **Destinataires** | Comptable `[À DÉFINIR]` ; administration fiscale sur demande ; banque. |
| **Conservation** | Délais légaux belges de conservation des pièces comptables `[À CONFIRMER avec le comptable]`. |

## T7 · Mesure d'audience

| | |
|---|---|
| **Finalité** | Savoir si le site est utile et quels choix d'entrée sont utilisés, en totaux. |
| **Base légale** | Intérêt légitime (6.1.f) ; sans cookie ni stockage sur l'appareil. `[À VALIDER JURIDIQUEMENT]` (J9) |
| **Données** | Pages vues **sans paramètres** ; événements `Entrée` (choix), `Langue`, `Partage`, sans identifiant ; pour compter les visiteurs, empreinte quotidienne de l'IP et du navigateur avec une clé effacée toutes les 24 h ; IP non conservée ; pays, région et ville déduits. |
| **Destinataires** | Plausible (UE, données en Allemagne), servi depuis le domaine du site. |
| **Conservation** | Totaux ; empreinte : 24 h. |

## T8 · Sécurité et fonctionnement du site

| | |
|---|---|
| **Finalité** | Protéger les formulaires contre les envois abusifs ; faire fonctionner et sécuriser le site ; tracer les accès au coffre. |
| **Base légale** | Intérêt légitime (6.1.f) : sécurité du service et des données. |
| **Données** | Empreinte d'IP calculée avec une clé changée chaque jour, empreinte de l'adresse de confirmation, compteurs (Upstash) ; journaux de l'hébergeur (adresse de la page, date, IP, navigateur) ; journal d'accès au coffre (compte, date, action, identifiant de demande, **jamais le contenu**) ; statut technique des envois (identifiant d'événement et résultat). |
| **Destinataires** | Upstash, Vercel, Scaleway ; Cat et Sady. |
| **Transferts hors UE** | Upstash et Vercel (sociétés américaines) : cadre UE–États-Unis `[À VALIDER JURIDIQUEMENT]`. |
| **Conservation** | Anti-abus : 24 h au plus. Journaux de l'hébergeur : 1 jour `[À CONFIRMER à la mise en ligne]` (aucun export de journaux, pas d'option d'observabilité étendue). Journal d'accès : `[À DÉFINIR]` (proposition : 12 mois). |
| **Point d'attention** | Les liens de réservation (avec leur jeton) apparaissent dans les journaux de l'hébergeur : validité de 48 h, annulés à la réservation. Les liens vers le formulaire n'ont plus de paramètre `?service=` (D26, PR n° 40). |

## T9 · Exercice des droits et violations de données

| | |
|---|---|
| **Finalité** | Répondre aux demandes d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité ; documenter les violations de données et leur traitement (`procedures.md`). |
| **Base légale** | Obligations légales (6.1.c ; articles 12 à 22, 33.5). |
| **Données** | Identité du demandeur ; objet de la demande ; échanges ; réponse ; dates. Violations : faits, données et personnes touchées, effets, mesures prises. |
| **Destinataires** | Cat ; Sady pour l'exécution technique ; APD en cas de notification. |
| **Conservation** | `[À DÉFINIR]` (le temps de pouvoir prouver la réponse ou la gestion de la violation). |

## T10 · Stockage dans le navigateur du visiteur

| | |
|---|---|
| **Finalité** | Fonctions demandées par le visiteur : ne pas perdre ses choix d'une page ou d'une étape à l'autre ; ne pas reproposer la suggestion de langue fermée ; garder les vidéos en pause. |
| **Base légale** | Stockage strictement nécessaire à une fonction demandée (exemption de consentement des règles ePrivacy) `[À VALIDER JURIDIQUEMENT]` (J9). |
| **Données** | Choix du formulaire (service, pays, langue, créneau) ; suggestion de langue fermée ; vidéos en pause. **Jamais** « pour qui », le nom, les coordonnées, le message ni l'urgence. |
| **Où** | Navigateur du visiteur seulement (`sessionStorage`) ; rien n'est envoyé à la maison. |
| **Conservation** | Effacé à la fermeture de l'onglet ; choix du formulaire effacés aussi à l'envoi. |

## Traitements à créer avant leur mise en service

- **Partenaires affichés** (phase 2) : voir T5.
- **Lettre d'information** (envisagée par D57) : base (consentement), désinscription, second fournisseur d'e-mail (Scaleway TEM interdit l'envoi commercial).
- **CMS** (après l'ouverture, D45) : textes publics seulement, aucune donnée personnelle ; à vérifier au branchement.
