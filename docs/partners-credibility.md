<!--
Spec rédigée par Sady (PO), enregistrée telle quelle le 15/10/2026 (sections 1 à 8).
L'annexe (après la section 8) contient les notes de Claude demandées en §8 (phase 0).
-->

# MAISON TRIONA — by K. · SPEC « PARTENAIRES = PREUVE DE CRÉDIBILITÉ »

> **Statut** : 4ᵉ complément du prompt Claude Code. À placer dans `docs/partners-credibility.md`.
> **Calendrier** : **phase 2** (après la mise en ligne). En phase 0/1 tu prépares seulement le modèle de contenu et la place dans la maquette ; **rien n'est affiché publiquement** tant qu'aucun partenaire n'a donné son accord écrit.
> Phase 0 = zéro code applicatif : tu écris uniquement dans `docs/`, `.claude/`, `CLAUDE.md`.
> Auteur / PO : Sady. Cliente : Cat (« K. »).

---

## 1. Principe

Les sociétés partenaires (accompagnement à domicile, garde, etc.) sont présentées **comme une preuve de sérieux**, **pas comme un annuaire**. Le visiteur ne contacte jamais un partenaire par le site : **c'est Maison Triona qui fait la mise en relation**, après un échange et un bilan des besoins.

Conséquences de conception :
- **Aucun lien sortant, aucun site web, aucun e-mail, aucun téléphone, aucun bouton « contacter ce partenaire »** associé à un partenaire.
- Le contenu est **purement informatif** (logos non cliquables ou fiches anonymisées).
- Le seul appel à l'action reste : **« Parlez-nous de votre situation »** (formulaire).

---

## 2. Trois niveaux d'affichage (à trancher avec Cat, partenaire par partenaire)

| Niveau | Ce que voit le visiteur | Avantage | Risque |
|---|---|---|---|
| **A. Nom + logo** | Logo en monochrome, non cliquable | Crédibilité maximale | Le visiteur peut chercher le partenaire seul et contourner Maison Triona |
| **B. Fiche anonymisée** | « Société d'accompagnement à domicile agréée, 15 ans d'expérience, active en France et au Luxembourg » | Zéro risque de contournement | Moins de force de preuve |
| **C. Hybride (recommandé)** | Quelques partenaires emblématiques en niveau A (avec accord écrit) + un compteur et des critères de sélection pour les autres (niveau B) | Crédibilité + protection + discrétion | Demande une gestion partenaire par partenaire |

**Règle** : chaque partenaire a un niveau d'affichage **choisi et validé par écrit**. Par défaut : **masqué**.

La protection contre le contournement repose surtout sur le **contrat** (clause de non-contournement dans la convention de partenariat), pas sur la dissimulation. Le site ne doit pas promettre ce que le contrat ne garantit pas.

---

## 3. Ce qui fait la crédibilité (plus que les logos)

Section « **Comment nous choisissons** » : les critères de sélection, présentés sobrement :
- licences / agréments vérifiés selon le pays ;
- assurance en responsabilité civile ;
- références contrôlées ;
- engagement de remplacement et de réactivité ;
- retours de clients suivis dans le temps.

`[CONTENU À FOURNIR PAR CAT]` : le contenu et la formulation exacts. **N'affiche jamais un critère que Maison Triona ne vérifie pas réellement.**

Compteurs possibles (uniquement s'ils sont **vrais et mis à jour**) : « 12 sociétés partenaires », « 4 pays ». Aucun chiffre inventé, aucun faux logo, aucun témoignage fictif, aucun placeholder visible en production.

---

## 4. Règles de formulation (conformité et honnêteté)

- Utilise « **sociétés avec lesquelles nous travaillons** » ou « **notre cercle de partenaires** ». N'utilise « **recommandées** », « **les meilleures** », « **certifiées** », « **labellisées** » **que si** c'est vrai et démontrable.
- **Cohérence avec la transparence de rémunération** : si Maison Triona est rémunérée par les partenaires, la page « Notre indépendance » l'explique (sans les montants), et la section partenaires y renvoie. Un logo ne doit jamais ressembler à une publicité payée présentée comme un conseil neutre.
- Même **taux de commission pour tous**, donc aucun partenaire ne peut « acheter » sa place. Si un affichage préférentiel était un jour envisagé, il faudrait le signaler comme tel (à valider juridiquement).
- **Usage du nom et du logo** : accord écrit du partenaire (droit d'usage + retrait sous un délai défini à la fin du partenariat). Respecte la charte graphique du partenaire (pas de déformation, pas de recoloration non autorisée) ; si elle n'autorise pas la monochromie, utilise la version officielle ou ne l'affiche pas.
- Ne cite **aucune décision de santé ou de qualité** propre à un partenaire comme garantie. Aucune promesse médicale.
- À valider par un juriste dans chaque pays (consommation, publicité, marques). Ce n'est pas un avis juridique.

---

## 5. Modèle de contenu (CMS) : « Partenaire »

Champs **internes** (jamais publiés) :
- `nom_interne`, `pays`, `services`, `statut` (`prospect / actif / suspendu / terminé`),
- `consentement_affichage` : `aucun / anonymisé / nom_et_logo`,
- `consentement_date`, `consentement_reference` (document), `droit_logo` (conditions),
- `licences_verifiees_le` (date) + `notes`,
- `visible_sur_le_site` (bool, **faux par défaut**).

Champs **publics** (publiés uniquement si `visible_sur_le_site = true` et le niveau de consentement le permet) :
- niveau A : `logo` (SVG) + `alt` (nom) ;
- niveau B : `description_anonymisee` (FR + EN), `territoires`, `ancienneté`.

Interdit : champ `url`, `email`, `telephone` publiables ; aucune route `/partenaires/[slug]` publique. Chaque texte public existe en **FR et EN**, avec parité contrôlée.

Garde-fous du modèle : une validation empêche de publier un partenaire sans `consentement_date` ; une alerte signale les `licences_verifiees_le` trop anciennes (seuil à définir avec Cat).

---

## 6. Design et accessibilité

- Section sobre, **fond ivoire**, filets or fins, logos **monochromes** (sapin ou encre) de taille homogène, beaucoup d'air. Pas de carrousel défilant automatique (accessibilité et lenteur du luxe) : grille statique.
- Logos **non focalisables** (pas de lien) ; `alt` pertinent ; contraste AA ; version mobile en une colonne ou une grille de 2.
- Où : une bande discrète sur la page d'accueil (après les services) et une section détaillée sur « La Maison » ou « Services » avec les critères de sélection.
- Dans chaque scène de service, un **court texte de réassurance** (ex. « Des sociétés agréées, sélectionnées une à une ») sans logo, plus un lien vers « Comment nous choisissons ».
- Prévois en phase 1 un **emplacement masqué** et un **état vide** : tant qu'il n'y a pas de partenaire validé, la section ne s'affiche pas du tout.

---

## 7. Mesure et confidentialité

- Mesure agrégée et anonyme (ex. vues de la section), sans identifiant.
- Aucun enregistrement de qui regarde quel partenaire.
- Données des partenaires : minimum nécessaire, hébergement UE, accès restreint au CMS.

---

## 8. Ce que tu fais

**Phase 0** : ajoute ce document au plan ; crée le modèle de contenu « Partenaire » dans `docs/architecture.md` (sans l'installer) ; ajoute dans `docs/plan-implementation.md` la story ci-dessous ; mets à jour l'agent `security-privacy-reviewer` et la skill `maison-triona-copy-fr-en` avec les règles de formulation de la §4.

**Phase 1** : prévois seulement l'emplacement et l'état vide.

**Phase 2** : implémente la section après validation de Sady et de Cat.

| ID | Story | Critères d'acceptation |
|---|---|---|
| E6-S1 | Section partenaires (preuve de crédibilité) | Aucun lien/contact partenaire ; niveau d'affichage respecté ; publication impossible sans consentement ; FR/EN ; alt corrects ; section masquée si vide |
| E6-S2 | Page « Comment nous choisissons » | Critères vérifiés uniquement ; texte validé par Cat ; renvoi depuis chaque service |
| E6-S3 | Page « Notre indépendance » | Explique la rémunération sans montants ; cohérente avec la section partenaires |

**Questions pour le rapport de phase 0** (à poser à Sady, une ligne chacune, avec ta recommandation) : quels partenaires acceptent d'être nommés ; niveau d'affichage souhaité ; la convention de partenariat prévoit-elle le droit d'usage du nom/logo et la non-contournement ?

---
---

# Annexe : notes de phase 0 (Claude, 15/10/2026)

> **15/10/2026 (D01)** : aucun partenaire pour l'instant. La section reste masquée ; l'epic 6 attend le premier accord écrit.

## A. Où c'est rangé

| Élément | Emplacement |
|---|---|
| Modèle de contenu « Partenaire » (champs, validations, requête publique filtrée) | `docs/architecture.md` §5.1 |
| Emplacement masqué en phase 1, stories E6-S1 à E6-S3 en phase 2 | `docs/plan-implementation.md` (story 2.2 pour l'emplacement, Epic 6) |
| Règles de formulation (§4) | Skill `maison-triona-copy-fr-en`, agent `security-privacy-reviewer` |
| Page « Notre indépendance » | Avancée en **phase 1** par la spec confiance (`docs/trust-contact-launch.md` §2.3, story E2-S5) ; E6-S3 la complète en phase 2 avec le renvoi vers la section partenaires |

## B. Conflits à arbitrer avec `anti-patterns.md`

| Anti-pattern | Ce que dit cette spec | Proposition |
|---|---|---|
| n° 21 « Pas de bandeau *Trusted by* / logos clients » | Bande de logos **partenaires** sur l'accueil | Compatible si ce sont des partenaires (jamais des clients), en **grille statique**, monochrome, non cliquable, après accord écrit. Mettre l'anti-pattern à jour pour le préciser. |
| n° 22 « Pas de stats en gros chiffres » | Compteurs « 12 sociétés partenaires », « 4 pays » | Compteurs **dans une phrase**, au corps du texte (« Nous travaillons aujourd'hui avec douze sociétés, dans quatre pays. »), jamais en display. Mis à jour par Cat, sinon absents. |

## C. Emplacement masqué et état vide (phase 1)

- Un composant `PartnersBand` existe dès la phase 1 mais **ne rend rien** (aucun titre, aucun espace réservé, aucun texte d'attente) tant que la requête « partenaires visibles » renvoie zéro résultat.
- La requête publique ne lit **que** les champs publics des partenaires où `visible_sur_le_site = true` **et** `consentement_affichage ≠ aucun` **et** `consentement_date` est renseignée. Les champs internes ne quittent jamais leur stockage.
- Le court texte de réassurance des scènes de service (« Des sociétés agréées, sélectionnées une à une ») reste `[À VALIDER PAR CAT]` : « agréées » n'est affichable que si c'est vérifié pour **chaque** société concernée.

## D. Points d'attention

- **Où vivent les champs internes** : le CMS recommandé (Sanity, offre gratuite) a un dataset **public**. Les consentements, notes et statuts n'y ont pas leur place. **Recommandation** : champs internes dans la base du coffre (UE, accès A2F, `docs/trust-contact-launch.md` §4), seuls les champs publics validés dans le CMS. Alternative : dataset privé (offre payante).
- **Mesure** : une vue de section agrégée au plus ; aucun événement par partenaire.
- **Juridique** : droit d'usage des marques, publicité trompeuse, information sur la rémunération : à valider pays par pays avant la phase 2.
