# Dossier RGPD de Maison Triona

> **Statut** : brouillon du 06/11/2026, rédigé par Claude pour Sady, à relire par Cat puis par son juriste. **Ce n'est pas un avis juridique.** Chaque point `[À VALIDER JURIDIQUEMENT]` attend le juriste ; chaque `[CONTENU À FOURNIR PAR CAT]` attend l'inscription de la société (janvier 2027, D38).
> **Sources** : `docs/privacy.md`, `docs/architecture.md` §6 et §9, `docs/reservation-appel.md`, `docs/decisions.md` (D05 à D07, D38, D40, D41, D44, D47, D57), réponses de Cat du 26/10/2026.

Ce dossier rassemble ce que la maison doit pouvoir montrer à l'Autorité de protection des données (APD) : ce qu'elle fait des données personnelles, pourquoi, combien de temps, avec qui, et comment elle les protège. La politique de confidentialité publiée sur le site (`/fr/confidentialite`, `/en/privacy`) en est la partie visible : elle informe les visiteurs. Ce dossier est la partie interne : il prouve que la maison respecte le règlement (principe de responsabilité, article 5.2 du RGPD).

---

## 1. Qui fait quoi

| Rôle | Qui | Remarque |
|---|---|---|
| **Responsable du traitement** | Maison Triona `[CONTENU À FOURNIR PAR CAT]` : forme juridique, siège ou établissement, numéro BCE | Si Cat s'installe en personne physique, c'est elle qui est responsable du traitement, et son nom doit figurer dans la politique de confidentialité et les mentions légales (question J1). |
| **Personne de contact pour les données** | Cat, à une adresse dédiée sur le domaine (`confidentialite@…`, D47) | `[À DÉFINIR]` : adresse créée après la réservation du domaine. |
| **Délégué à la protection des données (DPO)** | Aucun | Non obligatoire (article 37) : la maison n'est pas une autorité publique, et son activité de base ne consiste pas à traiter à grande échelle des données sensibles ni à suivre des personnes de façon régulière et systématique. Décision à confirmer par le juriste ; à revoir si l'activité grandit. |
| **Maintenance technique** | Sady | Accès au coffre (compte nominatif, double authentification). Statut à fixer : sous-traitant avec contrat (article 28) ou personne agissant sous l'autorité de la maison (article 29), avec engagement de confidentialité (question J4). |
| **Autorité de contrôle chef de file** | Autorité de protection des données (APD), Belgique | Établissement unique en Belgique (Wallonie). Les clients des autres pays peuvent aussi saisir leur propre autorité (CNIL, CNPD, APDP, PFPDT). |

## 2. Textes applicables

- **RGPD** (règlement (UE) 2016/679).
- **Loi belge du 30 juillet 2018** relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel.
- **Règles « cookies » (ePrivacy)** pour tout stockage sur l'appareil du visiteur : le site public ne pose aucun cookie et n'utilise que le stockage de session pour des fonctions demandées (`docs/privacy.md` §1). Absence de bandeau à confirmer (question J9).
- **Clients en Suisse et à Monaco** : la nLPD suisse et la loi monégasque n° 1.565 peuvent s'appliquer en plus du RGPD `[À VALIDER JURIDIQUEMENT]` (question J8).

## 3. Contenu du dossier

| Document | Article du RGPD | Ce qu'il contient |
|---|---|---|
| [Registre des traitements](registre-des-traitements.md) | 30 | Une fiche par traitement : finalité, base légale, personnes, données, destinataires, transferts, durée, sécurité |
| [Analyse d'impact (AIPD)](analyse-impact.md) | 35, 32 | Pourquoi elle est nécessaire, description, nécessité et proportionnalité, risques, mesures de sécurité, plan d'action |
| [Procédures](procedures.md) | 12 à 22, 33, 34 | Répondre à une demande d'exercice des droits ; réagir à une violation de données ; registre des demandes et des violations |
| [Sous-traitants et destinataires](sous-traitants.md) | 28, 44 à 49 | Prestataires techniques, contrats de traitement, transferts hors UE, destinataires qui ne sont pas des sous-traitants |
| Politique de confidentialité (site) | 13, 14 | Information des visiteurs : textes dans `messages/*.json` (namespace `Privacy`), PR n° 40 |

## 4. Avant l'ouverture (premier trimestre 2027)

- [ ] Inscription de la société ; compléter les `[CONTENU À FOURNIR PAR CAT]` du dossier, de la politique et des mentions légales.
- [ ] Avis du juriste sur les questions J1 à J14 (§5) ; reporter ses réponses ici et dans `docs/decisions.md`.
- [ ] Valider l'analyse d'impact (signature de Cat, date) ; la revoir si un traitement change.
- [ ] Signer les contrats de traitement (DPA) au nom de la société avec chaque sous-traitant retenu (`sous-traitants.md`) ; en garder une copie datée.
- [ ] Arrêter les durées encore ouvertes : journal d'accès au coffre, messagerie, notes de Cat, données des professionnels.
- [ ] Créer l'adresse `confidentialite@…` et la relever chaque jour ouvré.
- [ ] Rédiger la clause de confidentialité et de protection des données de la convention avec chaque professionnel présenté (J5).
- [ ] Tester une fois la procédure de violation (exercice à blanc) et la procédure d'exercice des droits (demande fictive) ; noter les résultats.
- [ ] Montrer à Cat comment ouvrir le coffre avec sa copie de clé hors ligne (D41).

## 5. Questions pour le juriste

Les questions J1 à J12 viennent de la relecture `security-privacy-reviewer` du 06/11/2026 ; J13 et J14 de la réservation d'appel (D57) et de la sélection des professionnels.

| # | Question |
|---|---|
| J1 | **Forme juridique** : en personne physique, Cat est responsable du traitement et éditrice du site, son nom devient obligatoire et la BCE publique, contre la règle « Cat jamais nommée » (D45). « Responsable de la publication » (notion française) : à afficher, et sous quelle forme ? |
| J2 | **Demande faite pour un proche** : la personne concernée est le parent, pas le visiteur. Le consentement explicite du visiteur (article 9.2.a) couvre-t-il les données de santé du parent ? Comment informer le parent (article 14) ? Une case obligatoire pour envoyer est-elle un consentement libre ? |
| J3 | **Données de santé** : le choix « grand âge », lisible dans le coffre pour le tri, est-il une donnée de santé ? L'hébergement de données de santé (HDS, France) s'applique-t-il ? |
| J4 | **Accès de Sady** au contenu déchiffré et à une copie de la clé : contrat de sous-traitance (article 28) ou personne sous l'autorité de la maison (article 29) ? |
| J5 | **Transmission au professionnel choisi** : base légale, rôle de chacun (responsables distincts ?), clause de confidentialité dans la convention avec le professionnel. |
| J6 | **Mentions légales belges** (Code de droit économique, livre XII) : adresse de domiciliation, second moyen de contact rapide sans téléphone (D02), enregistrement régional de l'activité de mise en relation et autorité de surveillance à citer. |
| J7 | **Droit applicable** face aux consommateurs de France, du Luxembourg, de Suisse et de Monaco. |
| J8 | **nLPD suisse et loi monégasque** : applicables ? Formalités (représentant, déclaration) ? |
| J9 | **Absence de bandeau** avec trois clés de stockage de session et une mesure d'audience sans cookie (lignes directrices EDPB 2/2023). |
| J10 | **Bases légales et durées** : mesures précontractuelles (6.1.b) pour la demande et l'appel, intérêt légitime (6.1.f) pour la mesure et la sécurité ; plafond de 12 mois ; durée du journal d'accès. |
| J11 | **« Vous ne payez rien à la maison »** alors que la commission du professionnel peut se répercuter sur son prix : risque de pratique trompeuse ? (question 8 de la liste de Cat) |
| J12 | **Sceau généré par IA** (D53) : protection par le droit d'auteur incertaine ; dépôt de marque (OBPI ou EUIPO), aussi utile pour le .mc (D47). |
| J13 | **Réservation d'appel (D57)** : base des SMS (demande de la personne ou consentement) ; agenda de Cat chez Google (compte professionnel avec contrat de traitement ou compte personnel) ; clé serveur pour les envois différés. |
| J14 | **Sélection des professionnels** : quelles vérifications la maison peut-elle faire sur eux (références, diplômes, extrait de casier judiciaire pour la garde d'enfants) ? Les données relatives aux condamnations pénales relèvent de l'article 10 du RGPD et de règles belges strictes. |

## 6. Tenir le dossier à jour

- **Nouveau traitement, nouvel outil ou nouveau prestataire** (formulaire, partenaires en phase 2, lettre d'information, CMS) : ajouter ou modifier sa fiche dans le registre, vérifier l'analyse d'impact, signer le contrat de traitement, mettre à jour la politique de confidentialité, **avant** la mise en service.
- **Au moins une fois par an** : relire le registre, les durées, la liste des personnes qui ont accès au coffre et les contrats.
- Chaque modification est datée en tête du document concerné.
