# Dossier RGPD de Maison Triona

> **Statut** : brouillon du 06/11/2026, rédigé par Claude pour Sady, à relire par Cat. Il ne contient que ce que la maison peut affirmer aujourd'hui (D61) ; chaque `[CONTENU À FOURNIR PAR CAT]` attend l'inscription de la société (janvier 2027, D38).
> **Sources** : `docs/privacy.md`, `docs/architecture.md` §6 et §9, `docs/reservation-appel.md`, `docs/decisions.md` (D05 à D07, D38, D40, D41, D44, D47, D57), réponses de Cat du 26/10/2026.

Ce dossier rassemble ce que la maison doit pouvoir montrer à l'Autorité de protection des données (APD) : ce qu'elle fait des données personnelles, pourquoi, combien de temps, avec qui, et comment elle les protège. La politique de confidentialité publiée sur le site (`/fr/confidentialite`, `/en/privacy`) en est la partie visible : elle informe les visiteurs. Ce dossier est la partie interne : il prouve que la maison respecte le règlement (principe de responsabilité, article 5.2 du RGPD).

---

## 1. Qui fait quoi

| Rôle | Qui | Remarque |
|---|---|---|
| **Responsable du traitement** | Maison Triona `[CONTENU À FOURNIR PAR CAT]` : forme juridique, siège ou établissement, numéro BCE | — |
| **Personne de contact pour les données** | Cat, à une adresse dédiée sur le domaine (`confidentialite@…`, D47) | `[À DÉFINIR]` : adresse créée après la réservation du domaine. |
| **Délégué à la protection des données (DPO)** | Aucun | Non obligatoire (article 37.1) : la maison n'est pas une autorité publique, et son activité de base ne consiste ni en un suivi régulier et systématique à grande échelle des personnes, ni en un traitement à grande échelle de données de santé ou relatives aux condamnations pénales. À revoir si l'activité grandit. |
| **Maintenance technique** | Sady | Accès au coffre (compte nominatif, double authentification) ; engagement de confidentialité écrit. |
| **Autorité de contrôle chef de file** | Autorité de protection des données (APD), Belgique | Établissement unique en Belgique (Wallonie) ; autorité chef de file aussi pour les traitements qui concernent la France et le Luxembourg (article 56). Une personne peut aussi saisir l'autorité de son lieu de résidence dans l'UE, comme la CNIL ou la CNPD (article 77). Les autorités de Monaco (APDP) et de Suisse (PFPDT) relèvent de leur propre loi. |

## 2. Textes applicables

- **RGPD** (règlement (UE) 2016/679).
- **Loi belge du 30 juillet 2018** relative à la protection des personnes physiques à l'égard des traitements de données à caractère personnel ; son article 9 demande, pour les données de santé, une liste des personnes qui y ont accès, tenue à la disposition de l'APD, et un engagement de confidentialité (registre, en tête).
- **Règles « cookies » (ePrivacy)** pour tout stockage sur l'appareil du visiteur : le site public ne pose aucun cookie et n'utilise que le stockage de session pour des fonctions demandées (`docs/privacy.md` §1).

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
- [ ] Valider l'analyse d'impact (signature de Cat, date) ; la revoir si un traitement change.
- [ ] Signer les contrats de traitement (DPA) au nom de la société avec chaque sous-traitant retenu (`sous-traitants.md`) ; en garder une copie datée.
- [ ] Arrêter les durées encore ouvertes : journal d'accès au coffre, messagerie, notes de Cat, données des professionnels.
- [ ] Créer l'adresse `confidentialite@…` et la relever chaque jour ouvré.
- [ ] Rédiger la clause de confidentialité et de protection des données de la convention avec chaque professionnel présenté.
- [ ] Tester une fois la procédure de violation (exercice à blanc) et la procédure d'exercice des droits (demande fictive) ; noter les résultats.
- [ ] Montrer à Cat comment ouvrir le coffre avec sa copie de clé hors ligne (D41).

## 5. Tenir le dossier à jour

- **Nouveau traitement, nouvel outil ou nouveau prestataire** (formulaire, partenaires en phase 2, lettre d'information, CMS) : ajouter ou modifier sa fiche dans le registre, vérifier l'analyse d'impact, signer le contrat de traitement, mettre à jour la politique de confidentialité, **avant** la mise en service.
- **Au moins une fois par an** : relire le registre, les durées, la liste des personnes qui ont accès au coffre et les contrats.
- Chaque modification est datée en tête du document concerné.
