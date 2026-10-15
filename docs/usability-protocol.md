# Protocole de tests utilisateurs — brouillon

> **Statut** : brouillon phase 0 (15/10/2026), story **E5-S8**. À finaliser avec Sady avant la fin de la phase 1 ; les résultats iront dans `docs/usability-report.md`.
> **Source** : `docs/trust-contact-launch.md` §6.2.
> **Support** : la préproduction protégée (story E5-S7), **sans aucune donnée réelle**.

---

## 1. Objectif

Vérifier, avant l'ouverture, que des personnes réelles **trouvent leur service, comprennent qui paie qui, font une demande ou demandent un rappel, partagent une page et changent de langue**, sans aide et sans gêne de lecture.

## 2. Participants (5 minimum)

| Profil | Nombre | Recrutement | Points d'attention |
|---|---|---|---|
| Seniors de 65 ans et plus | 2 | Entourage de Sady et de Cat, hors clients | Lecture, taille de texte, clics précis, compréhension du vocabulaire |
| Enfants adultes qui s'occupent d'un parent | 2 | Idem | Rapidité, confiance, « qui paie », demande pour un proche |
| Utilisateur de lecteur d'écran | 1 | Association locale ou réseau personnel `[À TROUVER]` | Clavier, annonces, formulaire en étapes, FAQ |

Pas de client réel, pas de prestataire, pas de proche de Cat qui connaîtrait déjà le projet en détail.

## 3. Éthique et consentement

- Consentement **écrit**, ou oral consigné par écrit, avant la séance : but du test, durée, droit d'arrêter à tout moment.
- **Aucun enregistrement** (écran, voix, visage) sans accord explicite et séparé. Par défaut : notes manuscrites seulement.
- **Aucune donnée médicale réelle** : les participants utilisent un scénario fictif fourni.
- Aucune donnée personnelle des participants conservée au-delà du rapport (prénom ou initiale, profil, tranche d'âge).

## 4. Matériel

- Ordinateur (navigateur courant) et téléphone (iOS ou Android) du participant si possible, sinon fournis.
- Pour le lecteur d'écran : la configuration habituelle du participant (VoiceOver, NVDA, TalkBack).
- Scénarios imprimés en grands caractères (18 pt minimum).
- Une grille d'observation par participant (§7).

## 5. Scénarios fictifs remis aux participants

- **Grand âge** : « Votre mère, 82 ans, vit seule à Bruxelles. Vous aimeriez qu'une personne de confiance passe quelques heures avec elle chaque semaine. »
- **Conciergerie** : « Vous vous installez à Monaco pour l'été et voulez qu'une seule personne organise votre arrivée. »
- **Enfants** : « Vous cherchez quelqu'un pour vos deux enfants, trois après-midi par semaine, au Luxembourg. »

Chaque participant reçoit le scénario le plus proche de sa situation.

## 6. Tâches et seuils de succès (fixés avant les tests)

| # | Tâche | Mesure | Seuil de succès |
|---|---|---|---|
| T1 | Depuis l'accueil, trouver le service qui correspond au scénario | Temps, chemin, hésitations | Atteint sans aide en **≤ 60 s** (≤ 2 min au lecteur d'écran) |
| T2 | Expliquer avec ses mots « qui paie qui » | Compréhension orale | Explication correcte sans relire la page, pour 4 participants sur 5 |
| T3 | Faire une demande avec le formulaire en étapes | Achèvement, erreurs, retours arrière | Envoi réussi sans aide ; aucune saisie perdue |
| T4 | Demander un rappel avec un créneau | Achèvement | Réussi sans aide pour 4 sur 5 |
| T5 | Envoyer la page « Comment ça se passe » à un proche | Trouve le bouton, comprend le résultat | Réussi sans aide pour 4 sur 5 |
| T6 | Passer le site en anglais, puis revenir | Trouve le sélecteur | Réussi en **≤ 20 s** |
| T7 | (Question de fin) Confort de lecture, impression générale | Échelle de 1 à 5 + verbatim | Moyenne ≥ 4 pour la lisibilité |

## 7. Grille d'observation

Pour chaque tâche : réussite (oui / avec aide / non) · temps · chemin suivi · hésitations · citations · problème observé · gravité (bloquant / important / mineur).

## 8. Déroulé d'une séance (45 min)

1. Accueil, consentement, rappel « on teste le site, pas vous » (5 min).
2. Tâches T1 à T6, en pensant à voix haute, sans aide sauf blocage de plus de 2 min (30 min).
3. Questions de fin : ce qui a rassuré, ce qui a inquiété, ce qui manque ; T7 (10 min).

## 9. Rapport (`docs/usability-report.md`)

- Tableau des résultats par tâche et par participant.
- Problèmes **classés** (bloquant / important / mineur), chacun avec la correction décidée, la story concernée et le statut.
- Un bloquant = correction **avant** l'ouverture (`docs/launch-checklist.md`).
