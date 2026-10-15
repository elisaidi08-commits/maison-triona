<!--
Partie I : spec rédigée par Sady (PO), enregistrée telle quelle le 15/10/2026.
Partie II : étude de phase 0 (Claude, 15/10/2026), produite à partir de recherches sur sources publiques.
Toutes les consultations datent du 15/10/2026 sauf mention contraire.
-->

# Partie I · Spec

# MAISON TRIONA — by K. · SPEC « STRATÉGIE SEO & CONCURRENCE »

> **Statut** : 6ᵉ complément du prompt Claude Code. À placer dans `docs/seo-strategy.md`.
> **Calendrier** : recherche et plan en **phase 0** (documents uniquement) ; plugin `claude-seo` et audit du site réel en **phase 1+**.
> Phase 0 = zéro code applicatif : tu écris uniquement dans `docs/`, `.claude/`, `CLAUDE.md`. Tu attends `GO PHASE 1`.
> Auteur / PO : Sady. Cliente : Cat (« K. », reste discrète, jamais mise en avant).
> Priorité en cas de conflit : ux-entry-i18n-a11y > trust-contact-launch > **seo-strategy** > assets brief > prompt Phase 0 > PRD.

---

## 1. Objectif

Faire de la recherche organique le canal d'acquisition principal de Maison Triona, **sans réseaux sociaux** et sans que Cat se montre. Le SEO doit amener des personnes qui ont **un besoin précis** (accompagner un proche, garde, organisation du quotidien) vers le formulaire « Parlez-nous de votre situation ».

Principe : on ne cherche pas le trafic le plus gros, on cherche **les requêtes de personnes qui ont déjà un besoin**, pays par pays.

---

## 2. Les trois types de concurrents (à ne pas mélanger)

| Type | Exemples repérés (**à vérifier**, liste non exhaustive) | Ce qu'on en tire |
|---|---|---|
| **A. Conciergeries de luxe** | La Conciergerie (groupe Pastor, Monaco, réservée aux résidents) ; Home Select Paris ; conciergeries de résidences et de banques | Positionnement, ton, offre, preuves de confiance |
| **B. Agences d'aide à domicile / garde / nanny premium** | Privilege Services (Luxembourg, à confirmer) ; agences haut de gamme locales | Vocabulaire des besoins, pages services, villes ciblées |
| **C. Annuaires et plateformes** | Aladom, Petits-fils, Adenior, sites de comparaison | Ce sont eux qui captent les requêtes « besoin + ville » ; on les étudie pour savoir **où on ne peut pas gagner** |

Règle : **n'affirme rien sur un concurrent que tu n'as pas vérifié sur sa page officielle.** Chaque ligne du tableau final porte une URL, une date de consultation et un niveau de confiance. Aucun chiffre inventé.

---

## 3. Ce que tu produis en phase 0

### 3.1 `docs/seo-strategy.md`
1. **Étude de mots-clés par pays** (BE, FR, LU, MC, CH) et par besoin (organiser le quotidien / accompagner un proche / enfants / « je ne sais pas encore »). Pour chaque requête : langue, intention (information, comparaison, prise de contact), difficulté estimée, pays, et page cible.
2. **Carte des concurrents** (3 types ci-dessus) : qui est positionné sur quoi, quelles pages, quel ton, quelles preuves.
3. **Où gagner / où ne pas se battre** : par exemple, ne pas viser frontalement « aide à domicile + ville » dominé par les annuaires ; viser la **mise en relation, l'accompagnement, l'indépendance, la discrétion**.
4. **Architecture des pages SEO** alignée sur le site : une page par service, une page par pays (si pertinent), FAQ, « Comment ça se passe », « Notre indépendance », « Comment nous choisissons » (phase 2).
5. **Contenu à produire** (briefs seulement) : titres, intention, plan, FR + EN. **Aucun texte inventé sur des faits non vérifiés.**
6. **SEO technique** : métadonnées par page et par langue, `hreflang` FR/EN, sitemap, robots, canonical, URL propres (`/fr`, `/en`), schema.org (Organization, Service, FAQPage ; types obsolètes exclus), performance (LCP, INP, CLS ; la vidéo ne doit jamais dégrader le LCP, le poster est le LCP).
7. **SEO local sans visage** : décision à prendre avec Cat sur une fiche Google Business Profile (adresse, visibilité, discrétion). Si pas d'adresse publique, on ne la crée pas. **Cohérence NAP** ou absence assumée.
8. **Visibilité dans les moteurs IA (GEO/AEO)** : pages claires, réponses courtes et sourcées, FAQ, données structurées.
9. **Mesure** : indicateurs agrégés et anonymes (cookieless), Search Console, pas d'identifiant visiteur. Objectifs réalistes **sans promesse de classement**.

### 3.2 Autres livrables
- Ajouter les stories ci-dessous dans `docs/plan-implementation.md`.
- Créer l'agent `.claude/agents/seo-strategist.md` et la skill `.claude/skills/maison-triona-seo/SKILL.md` (méthode, règles de véracité, checklist par page).
- Mettre à jour `qa-a11y-perf` (contrôles SEO technique) et `i18n-copy-editor` (mots-clés FR/EN naturels, pas de bourrage).

---

## 4. Règles non négociables

- **Aucun bourrage de mots-clés**, aucun contenu généré en masse, aucune page « ville » vide ou dupliquée (risque de pénalité, et incompatible avec le luxe).
- **Honnêteté** : pas de faux avis, pas de faux chiffres, pas de critère de sélection affiché s'il n'est pas vérifié.
- **Pas de données de santé** dans les URLs, paramètres, titres ou mesures. Le choix du besoin n'est jamais envoyé à un outil tiers avec un identifiant.
- **Discrétion** : le nom de Cat n'apparaît dans aucune donnée structurée ni métadonnée, sauf décision écrite de sa part.
- **Réglementation** : les formulations de service (« garde-malade », « aide à domicile », « placement ») peuvent être encadrées selon le pays. Signale ce point à Sady et ne tranche pas.
- **Données concurrentielles** : sources publiques uniquement. Si un chiffre vient d'un outil payant ou d'une estimation, dis-le.
- Les réponses des moteurs de recherche changent : date chaque constat.

---

## 5. Plugin `claude-seo` (phase 1 et après, pas en phase 0)

- Dépôt : `AgriciDaniel/claude-seo` (MIT). Installation : `/plugin marketplace add AgriciDaniel/claude-seo`, puis `/plugin install claude-seo@agricidaniel-claude-seo`, puis `/seo setup`, puis `/seo doctor`.
- **Avant de l'installer** : lis son code et ses scripts, vérifie ce qu'il envoie à l'extérieur et ce qu'il écrit sur le disque. Signale à Sady toute dépendance ou extension payante. N'active aucune extension qui exige un compte sans son accord.
- Usage prévu : `/seo audit` et `/seo technical` (site réel), `/seo schema`, `/seo hreflang`, `/seo geo`, `/seo competitor-pages`, `/seo content-brief`, `/seo cluster`, `/seo drift` (suivi dans le temps). `/seo local` et `/seo maps` uniquement si une présence locale est décidée.
- Limites à rappeler dans le rapport : sans clés Google, les Core Web Vitals sont des estimations de laboratoire ; les données de backlinks et de volumes précis demandent des outils payants.
- Les audits complets coûtent cher en tokens : lance-les par lot, après accord de Sady.

---

## 6. Stories

| ID | Story | Critères d'acceptation |
|---|---|---|
| E7-S1 | Étude de mots-clés et carte des concurrents | Par pays et par besoin ; sources et dates ; 3 types de concurrents ; aucun chiffre inventé |
| E7-S2 | Architecture SEO et briefs de contenu | Une page cible par intention ; FR/EN ; pas de pages vides ou dupliquées |
| E7-S3 | SEO technique de base | Métadonnées, hreflang, sitemap, canonical, schema.org valides ; Lighthouse SEO ≥ 95 |
| E7-S4 | Installation et audit avec `claude-seo` | Code relu avant installation ; audit sur le site réel ; plan d'action priorisé |
| E7-S5 | Mesure anonyme et suivi | Search Console + analytics cookieless ; aucun identifiant ; rapport mensuel simple |
| E7-S6 | Visibilité IA (GEO/AEO) | FAQ et pages claires, données structurées, réponses sourcées |

---

## 7. Questions pour le rapport de phase 0 (une ligne chacune, avec ta recommandation)

- Quels pays sont prioritaires au lancement, et dans quel ordre ?
- Cat accepte-t-elle une fiche Google Business Profile, et sous quelle adresse ?
- Quels termes de service sont autorisés selon le pays (garde-malade, aide à domicile, placement) ?
- Quel budget outils SEO (aucun, ponctuel, mensuel) ?
- Qui produit et relit les textes FR/EN, et à quel rythme ?

Termine par : **« Phase 0 terminée. J'attends `GO PHASE 1`. »**

---
---

# Partie II · Étude de phase 0 (15/10/2026)

## A. En bref

1. **Le terrain est ouvert là où Maison Triona est la plus singulière** : accompagnement **non médical** haut de gamme des seniors (mal servi partout), Belgique (aucune agence haut de gamme vérifiée), Luxembourg (un seul acteur direct), et l'**interlocuteur unique pour trois services dans cinq pays** (aucun équivalent vérifié).
2. **Le terrain est fermé** sur les requêtes génériques « besoin + ville » : annuaires et réseaux d'agences en France, plateformes de baby-sitting en BE, LU et CH, agences internationales de personnel de maison à Monaco et à Genève.
3. **L'indépendance et la discrétion expliquée** différencient : les concurrents sont employeurs de leur propre personnel ou payés au placement, et tous affirment la discrétion en un mot sans jamais montrer comment elle est tenue.
4. **Google en 2026** : plus de résultat enrichi FAQ (depuis mai 2026) ni HowTo ; aucune optimisation spéciale exigée pour les réponses IA (« still SEO ») ; `llms.txt` ignoré par Google Search.
5. **Pas de fiche Google Business Profile** recommandée au lancement (adresse à masquer, inéligibilité possible d'un apporteur d'affaires, anonymat de la fondatrice).
6. ⚠️ **Point juridique majeur, au-delà du SEO** : « mettre en relation contre commission » ressemble, à première lecture, à du **placement** réglementé en Suisse, en France et en Belgique (§K). À faire trancher par un juriste **avant** d'écrire les pages de service.

Limites : volumes de recherche **non mesurés** (aucun outil payant) ; résultats de recherche observés depuis un moteur **non localisé** (ni Google, ni google.ch / .be / .lu / .fr) ; classements Google **non mesurés**.

## B. Carte des concurrents

Consultés le 15/10/2026. Confiance : **V** = vérifié sur la page officielle · **S** = source secondaire · **NV** = non vérifié.

### B.1 Type A · Conciergeries de luxe

| Nom | URL | Couverture | Offre (telle qu'affichée) | Ton | Preuves | Prix | Confiance |
|---|---|---|---|---|---|---|---|
| La Conciergerie (Centre Immobilier Pastor, groupe Michel Pastor) | cip.mc | Monaco, 5 résidences | Services 24/7 : transport, bien-être, maison, baby-sitting, médecins, infirmières | Immobilier de prestige | « 40 ans d'expertise à Monaco » | Non | V. **Corrections** : pas le « groupe Pastor » ; le site ne dit pas « réservé aux résidents » mais ne s'adresse qu'à eux (« la conciergerie de votre résidence ») |
| Home Select | homeselect.paris | Paris, Île-de-France | **Chasseur immobilier**, pas une conciergerie | Expert, chiffré | Avis Google, carte T, FCI | Oui (%) | V. Concurrent seulement sur « conciergerie luxe Paris », par un article de blog |
| John Paul (Accor) | johnpaul.com/fr | Paris, Lisbonne, Miami, Doha, Toronto ; aucun bureau BE, LU, CH, MC | Surtout B2B ; abonnement « Elite » pour particuliers | Corporate premium | Logos de grandes marques | Sur demande | V (présence à Luxembourg : NV) |
| Quintessentially | quintessentially.com | Belgique, Luxembourg, France, Monaco | Lifestyle management par abonnement | Luxe international | Clients prestigieux cités | Inconnu | S (site bloqué, HTTP 403) |
| Alta Services | alta-services.com | Genève | Gestion de maison, personnel, nanny, assistance | Luxe, superlatifs | « strictest confidence » | Non | V, mais site **ancien** (activité actuelle NV) |
| Perfect.Live | perfect.live | « 127 pays » | Voyages, accès, assistant, family office | Spectaculaire | « 10k+ partners », cas à Monaco | Adhésion | V |

### B.2 Type B · Personnel de maison, nannies, accompagnement seniors haut de gamme

| Nom | URL | Couverture | Offre | Preuves | Prix | Confiance |
|---|---|---|---|---|---|---|
| **Privilege Services** | privilege-services.lu | Luxembourg | **Les trois services** : recrutement (gouvernante, nanny, majordome, **dame de compagnie**), services hôteliers à domicile, conciergerie et assistance privée | Depuis 2012, « Fournisseur de la Cour », sélection en 4 étapes (entretien, 2 références, casier), remplacement sous 3 mois | Sur devis | V · **concurrent le plus direct** |
| Morgan & Mallet International | householdstaff.agency | Monaco, France, Suisse, international | Placement de personnel de maison (nanny, butler, caregiver…), « Employer of Record » | Garantie 90 jours, vérifications, « One Point of Contact » | Grilles de salaires, honoraires non vus | V |
| Lighthouse Careers | lighthouse-careers.com | Genève, Monaco | Nannies et personnel privé (et yachting) | « 7-Step Vetting », note 4,9, garantie | « Success-fee », sans montant | V |
| Baby Prestige | baby-prestige.com | Paris, Côte d'Azur, Londres | Garde d'enfants en hôtel et à domicile, gouvernantes | Grands hôtels, avis Google, langues | Oui (abonnement) | V |
| Dovida Suisse | dovida.ch/fr | Suisse | Accompagnement **et soins de base** | « reconnus par les assurances maladie » | NV | V (pas de positionnement haut de gamme) |
| Les Demoiselles de Compagnie | — | Paris | Compagnie haut de gamme pour seniors | — | — | NV (aucun site trouvé) |
| Happy Days | — | Bruxelles | Titres-services + compagnie hors titres-services | — | 30 à 39 €/h (presse) | S (site injoignable) |

**Belgique** : aucune agence haut de gamme basée en Belgique vérifiée.

### B.3 Type C · Annuaires, plateformes et réseaux « besoin + ville »

| Pays | Acteur | Nature | Ce qu'on voit |
|---|---|---|---|
| FR | Aladom (aladom.fr) | Annuaire et annonces | Pages catégorie × ville, avis, prix par annonce |
| FR | Petits-fils (petits-fils.com) | **Réseau d'agences** en mode mandataire (pas un annuaire) | 12 900 avis affichés, pages par ville |
| FR | Adenior (adenior.com) | **Réseau d'agences** prestataire et mandataire | Devis gratuit, charte qualité |
| BE | Bsit (bsit.com) | Plateforme baby-sitting | Volume d'avis, prix publics, pages villes |
| BE · LU · CH | Babysits, Yoopies | Plateformes | Vérification d'identité, abonnement, pages villes |
| BE | Helpper, Aide & Soins à Domicile (FASD) | Mise en relation subventionnée ; portail fédératif | Public subventionné |
| LU | Babysitting.lu ; Stëftung Hëllef Doheem ; Help | Plateforme accréditée ; prestataires de soins | Institutionnel |
| CH | Croix-Rouge genevoise ; imad | Institutions | Aide et soins à domicile, babysitting |

« Dominant » **non mesuré** : présence vérifiée, pas le classement.

### B.4 Ce que la concurrence enseigne
- **Preuves du haut de gamme** : processus de sélection détaillé, garantie de remplacement (souvent 3 mois), ancienneté, distinction, clients prestigieux. **Le volume d'avis** est l'arme des plateformes de masse, pas la nôtre.
- **Prix** : le haut de gamme travaille sur devis ; ne pas afficher de tarif est cohérent avec le segment.
- **Ton** : « excellence », « sur-mesure », superlatifs ou chiffres. **Le ton chaleureux et retenu est rare** : c'est un espace libre.
- **Seniors** : beaucoup mêlent compagnie et soins ; une formulation nette, « accompagnement, pas de soins », distingue.

## C. Requêtes par pays et par besoin

Formulations hypothétiques et naturelles. **Volumes non mesurés.** Difficulté estimée d'après la composition des résultats observés le 15/10/2026 (moteur **non localisé**, à revalider sur Google par pays).

| Requête | Pays | Langue | Intention | Difficulté estimée | Ce qui occupe les résultats | Page cible |
|---|---|---|---|---|---|---|
| conciergerie privée Genève | CH | FR | Contact | Moyenne | Registres, immobilier « avec conciergerie », hôtels ; terme ambigu (concierge d'immeuble) | Conciergerie (+ page Suisse si contenu réel) |
| conciergerie de luxe Monaco | MC | FR | Comparaison / contact | Moyenne | Presse locale, immobilier de luxe, hôtels | Conciergerie |
| private concierge Monaco | MC | EN | Contact | Moyenne à forte | Presse, groupe hôtelier, agences | Concierge (EN) |
| conciergerie privée Bruxelles | BE | FR | Contact | Faible, intention détournée (gestion Airbnb) | Gestion locative, emplois | Conciergerie, avec un vocabulaire qui écarte l'Airbnb |
| private concierge Luxembourg | LU | EN | Contact | Faible à moyenne | Presse économique, annuaires | Concierge (EN) |
| conciergerie pour particuliers Luxembourg | LU | FR | Comparaison | Faible à moyenne | Presse, annuaires | Conciergerie |
| conciergerie privée Paris | FR | FR | Contact | Forte | Presse, emplois, grands acteurs | Conciergerie (pas un objectif de lancement) |
| dame de compagnie Monaco | MC | FR | Contact | Faible | **Aucun prestataire** ; sens historique (dame d'honneur) | Grand âge |
| accompagnement personne âgée à domicile Bruxelles | BE | FR | Comparaison / contact | Faible à moyenne | Institutions, presse, peu de prestataires | Grand âge |
| elderly companion Geneva | CH | EN | Contact | Faible à moyenne, bruitée | Plateformes, emplois | Senior companionship (EN) |
| dame de compagnie personne âgée Paris | FR | FR | Contact | **Forte** | Annuaires (aladom ×8) | Grand âge (pas un objectif de lancement) |
| aide personne âgée à domicile Luxembourg | LU | FR | Comparaison | Moyenne ; « aide » renvoie aux soins agréés | Emplois, réglementation | Grand âge, en évitant « aide à domicile » |
| comment trouver une dame de compagnie pour sa mère | FR, BE | FR | Information | Moyenne | Blogs d'annuaires, offres d'emploi | **Comment ça se passe** + FAQ |
| home care for elderly parent Switzerland English speaking | CH | EN | Information | Faible côté commercial | Publications, forums d'expatriés | FAQ (EN) |
| nanny anglophone Luxembourg | LU | FR/EN | Contact | Moyenne | Privilege Services, plateformes | Enfants |
| nanny Monaco | MC | EN | Contact | **Forte** | Agences internationales de personnel de maison | Enfants (pas un objectif de lancement en EN) |
| garde d'enfants à domicile Genève | CH | FR | Comparaison | Moyenne | Pages officielles, plateformes | Enfants |
| nounou anglophone Paris | FR | FR | Contact | Forte | Annuaires, agences | — |
| English speaking nanny Brussels | BE | EN | Contact | Moyenne | Emplois, plateformes | Childcare (EN) |
| household staff agency Geneva | CH | EN | Contact | **Forte** | Agences internationales | — (ne pas se battre) |
| agence personnel de maison Monaco | MC | FR | Comparaison | Faible à moyenne en FR | Presse locale, annuaires | Page d'orientation |
| aide à domicile senior Monaco | MC | FR | Comparaison | Moyenne | Annuaire, **offre publique de la Mairie** | Grand âge |
| assistante personnelle privée famille Genève | CH | FR | — | Sans objet | **Uniquement des offres d'emploi** | À éviter (attire des candidats) |
| conciergerie familiale discrète | toutes | FR | Contact | NV | — | Accueil / orientation |

**Pièges sémantiques** : « conciergerie » (gestion Airbnb, concierge d'immeuble), « dame de compagnie » (sens historique), « aide à domicile » (soins agréés), requêtes qui attirent surtout des **candidats** à un emploi.

## D. Où gagner, où ne pas se battre

| Gagner (cibles de lancement) | Ne pas se battre |
|---|---|
| Longue traîne **besoin + ville + langue + discrétion** sans prestataire direct en tête : dame de compagnie Monaco, accompagnement personne âgée Bruxelles, elderly companion Geneva, private concierge Luxembourg, conciergerie pour particuliers Luxembourg | « aide à domicile + ville », « dame de compagnie + Paris », « nounou + Paris » (annuaires et réseaux d'agences) |
| Requêtes **EN** de résidents internationaux à Luxembourg, Genève, Monaco, Bruxelles | « nanny Monaco », « household staff agency Geneva » (agences internationales aux centaines de pages) |
| Requêtes d'**information** de première main : « comment trouver une dame de compagnie pour sa mère », « s'occuper d'un parent âgé à distance », « qui paie qui » | Baby-sitting de masse (Bsit, Babysits, Yoopies) |
| Thèmes de fond : **indépendance**, **discrétion expliquée**, **un seul interlocuteur**, **accompagnement sans soins** | Requêtes à intention « emploi » |

## E. Architecture des pages SEO

| Page | URL FR / EN | Intention | Statut |
|---|---|---|---|
| Accueil (entrée par besoin) | `/fr` · `/en` | Marque, orientation | Phase 1 |
| Conciergerie | `/fr/services/conciergerie` · `/en/services/concierge` | Contact | Phase 1 |
| Grand âge | `/fr/services/grand-age` · `/en/services/senior-companionship` | Contact, comparaison | Phase 1 |
| Enfants | `/fr/services/enfants` · `/en/services/childcare` | Contact | Phase 1 |
| Comment ça se passe (+ langage simple, PDF) | `/fr/comment-ca-se-passe` · `/en/how-it-works` | Information | Phase 1 |
| FAQ | `/fr/faq` · `/en/faq` | Information | Phase 1 |
| Notre indépendance | `/fr/notre-independance` · `/en/our-independence` | Comparaison, confiance | Phase 1 |
| Territoires | `/fr/territoires` · `/en/where-we-work` | Orientation | Phase 1 |
| **Pages pays** | `/fr/territoires/suisse` … | Contact local | **Phase 2, seulement avec un contenu local réel** fourni par Cat (comment la maison travaille sur place, langues, particularités). Sinon, pas de page : jamais de page « ville » vide |
| Comment nous choisissons | `/fr/comment-nous-choisissons` · `/en/how-we-choose` | Confiance | Phase 2 (spec partenaires) |

Une seule page cible par intention ; les pages de service et la FAQ se renvoient l'une à l'autre ; chaque page mène à « Parlez-nous de votre situation ».

## F. Briefs de contenu (squelettes)

Aucun fait n'est publié sans validation de Cat. Les briefs détaillés seront produits par l'agent `seo-strategist` en phase 1 (story E7-S2), dans `docs/content-briefs/`.

| Page | Question principale à laquelle répondre en 2 phrases | Plan (h2) | Faits à faire valider par Cat |
|---|---|---|---|
| Grand âge | « Comment trouver une présence de confiance pour un parent âgé, sans soins médicaux ? » | Ce que nous faisons · Ce que nous ne faisons pas (pas de soins) · Comment ça se passe · Où · Parlons-en | Périmètre exact, pays couverts, délai de réponse, statut juridique (§K) |
| Conciergerie | « Que fait une conciergerie privée pour une famille, au quotidien ? » | Ce que la maison organise · Un seul interlocuteur · Discrétion · Parlons-en | Exemples de demandes réelles (anonymisés), limites |
| Enfants | « Comment trouver une personne de confiance pour garder ses enfants, en français ou en anglais ? » | Ce que nous proposons · Comment nous choisissons · Langues · Parlons-en | Langues réellement proposées, âges, statut juridique (§K) |
| Comment ça se passe | « Que se passe-t-il après ma demande ? » | Les 5 étapes · Qui paie qui · Confidentialité | Déroulé réel, délais, canaux |
| FAQ | Les 8 questions de `docs/trust-contact-launch.md` §B.1 | Une réponse courte par question, sourcée quand c'est un fait | Toutes les réponses |
| Notre indépendance | « Comment la maison est-elle rémunérée, et qu'est-ce que cela change pour moi ? » | Qui paie · Même taux pour tous · Ce que vous signez | Chaque affirmation `[SI VRAI]` |

## G. SEO technique

| Sujet | Règle (sources officielles Google, consultées le 15/10/2026) |
|---|---|
| Métadonnées | `title` et `meta description` uniques par page **et** par langue ; pas de nom de Cat |
| `hreflang` | `fr`, `en` et `x-default` (→ `/fr`) sur chaque page, **réciproques**, URL absolues ; pas de variantes `fr-BE`, `fr-CH` tant qu'il n'y a pas de contenu distinct par pays |
| Canonical | Vers soi-même, dans la même langue ; les éventuelles pages pays ont **leur propre canonical** (ce ne sont pas des alternates) |
| Redirections | Jamais de redirection automatique selon l'IP ou la langue du navigateur (Googlebot explore surtout depuis les États-Unis, sans `Accept-Language`) ; `/` → `/fr` |
| Sitemap, robots | Sitemap multilingue avec alternances ; `noindex` sur la confirmation, la démo, la 404, le coffre et la préproduction |
| Données structurées | `Organization` (pris en charge par Google : nom, URL, logo, **sans adresse ni personne**) ; `BreadcrumbList` ; `FAQPage` et `Service` **valides dans schema.org mais sans résultat enrichi Google** (FAQ retirée en mai 2026, `Service` absent de la galerie) : utiles pour d'autres moteurs, à garder légers ; **exclus** : `HowTo` (retiré en 2023), `LocalBusiness` (pas d'adresse publique) |
| Core Web Vitals | LCP ≤ 2,5 s, **INP ≤ 200 ms**, CLS ≤ 0,1 au 75ᵉ percentile (cibles du projet plus strictes) ; le poster est le LCP |
| Avis | Aucun avis affiché ni balisé (Google a durci ses règles sur les avis incités en juillet 2026) |

## H. SEO local sans visage

**Recommandation : pas de fiche Google Business Profile au lancement.**
- Une entreprise sans vitrine doit **masquer son adresse** ; l'éligibilité exige un **contact en personne** avec les clients ; les **« lead generation agents or companies »** sont inéligibles (terme non défini par Google : un apporteur d'affaires pourrait y être assimilé, interprétation non vérifiée).
- La vérification de la fiche par le propriétaire se concilie mal avec l'anonymat de la fondatrice.
- **Absence assumée** de NAP (nom, adresse, téléphone) public : cohérente avec la discrétion. À rouvrir si Cat choisit une adresse professionnelle et un contact en personne.

## I. Moteurs IA (GEO / AEO)

- **Consigne officielle de Google** : aucune exigence supplémentaire pour apparaître dans AI Overviews ou AI Mode ; « optimizing for generative AI search is… still SEO » ; pas besoin de fichiers dédiés ni de découpage du contenu ; `llms.txt` ignoré par Google Search ; le contenu produit en masse relève du « scaled content abuse ».
- **Ce qu'on fait** : pages claires, réponse principale en tête, FAQ visible, faits sourcés et datés, contenu de première main (l'expérience de Cat, sans la nommer).
- **`llms.txt`** : pas prioritaire (aucun grand moteur ne s'engage publiquement à l'utiliser ; l'audit Lighthouse correspondant est informatif). Coût nul si on le fait plus tard.
- « GEO » et « AEO » sont des termes du secteur, pas de Google.

## J. Mesure

- **Search Console** (requêtes, pages, rapport « IA générative ») + **Plausible** servi via notre domaine.
- Rapport mensuel simple : pages d'entrée, requêtes principales, demandes envoyées (volume global), aucune donnée individuelle.
- Objectifs **sans promesse de classement** : au lancement, être trouvé sur le nom de la maison ; à 6 mois, apparaître sur les requêtes de longue traîne du §D dans les pays prioritaires.
- Outils gratuits à utiliser après la mise en ligne : Google Trends (tendances relatives), Keyword Planner (fourchettes, compte Ads requis), Search Console.

## K. ⚠️ Vocabulaire réglementé et modèle d'activité (signalement, pas un avis juridique)

Constat tiré de sources officielles ; **rien n'est conclu**. Ces points dépassent le vocabulaire : ils peuvent concerner le **modèle même** de mise en relation contre commission.

| Pays | Ce que disent les sources consultées | Source |
|---|---|---|
| **Suisse** | La LSE soumet à **autorisation** « les personnes qui pratiquent le placement régulièrement et contre rémunération ». La mise en contact s'entend « dans un sens très large » (transmission de coordonnées, Internet) ; peu importe qui paie ; exploiter un site est un indice de régularité. Autorisation cantonale (à Genève : OCIRT) et, pour l'international, fédérale (SECO) ; les agences étrangères ne peuvent pas placer en Suisse. Mettre à disposition de ménages du personnel d'assistance aux personnes âgées relève de la **location de services**, aussi soumise à autorisation | Directives SECO sur la LSE (juin 2024), arbeit.swiss ; ge.ch ; fr.ch |
| **France** | Le **placement** est défini comme le fait de « rapprocher les offres et les demandes d'emploi » sans devenir partie à la relation de travail (L5321-1). Les services à la personne (L7231-1) ont trois modes (L7232-6), dont le placement de travailleurs chez des particuliers employeurs (« mandataire »), soumis à **agrément** pour les personnes âgées et la garde d'enfants de moins de 3 ans (D7231-1) ; en mode prestataire auprès de publics fragiles : **autorisation départementale** | code.travail.gouv.fr ; banquedesterritoires.fr |
| **Belgique** | Placement privé de compétence régionale : **enregistrement** obligatoire en Wallonie (dont « recrutement et sélection »), agrément à Bruxelles, régime flamand à vérifier ; titres-services limités à des tâches ménagères ; accueil d'enfants encadré par l'ONE | wallonie.be ; commissioner.brussels |
| **Luxembourg** | **Autorisation d'établissement** pour toute activité économique habituelle ; agrément ASFT pour certains services d'aide et d'assistance ; régime du placement privé non établi | guichet.lu ; mfsva.gouvernement.lu |
| **Monaco** | Déclaration des offres d'emploi par l'employeur, autorisation pour l'emploi d'étrangers ; aucune disposition trouvée sur les agences de placement privées ; activité économique soumise à autorisation ou déclaration | legimonaco.mc ; monentreprise.gouv.mc |

**Mots à manier avec prudence** jusqu'à l'avis juridique : « placement », « agréé », « soins », « garde-malade », « auxiliaire de vie », « aide à domicile », « crédit d'impôt », « recrutement ».

## L. Plugin `claude-seo` (lecture du README seulement, sans installation)

- Licence MIT, v2.4.2 ; environ 30 commandes `/seo …`.
- **Services externes** : API Google (PageSpeed, CrUX, Search Console, Indexing, GA4, Keyword Planner), Moz, Common Crawl, Keywords Everywhere, Bing Webmaster et IndexNow, extensions SE Ranking, Profound, génération d'images ; pages auditées récupérées directement.
- **Comptes** : identifiants Google par paliers (jusqu'au jeton développeur Google Ads) ; comptes propres aux extensions (tarifs non indiqués).
- **Écritures** : environnement Python et Chromium dans le dossier du plugin ; identifiants dans `~/.config/claude-seo/` ; rapports Markdown, PDF, JSON ; base SQLite pour le suivi ; **les installeurs d'extensions modifient `~/.claude.json`** (à refuser sans accord de Sady).
- **Position** : utile en phase 1 pour `/seo technical`, `/seo hreflang`, `/seo schema` sur le site réel, avec les seules clés Google de Sady ; extensions désactivées par défaut ; code relu avant installation (story E7-S4).

## M. Questions pour Sady

**Réponses du 15/10/2026** (`docs/decisions.md`) : Belgique d'abord, puis le Benelux (D10) ; pas de fiche Google Business Profile au lancement (D11) ; termes de service définis plus tard, vocabulaire prudent d'ici là (D12) ; aucun budget d'outils SEO pour l'instant, `claude-seo` après le lancement (D13) ; rédaction et relecture : sans réponse (D15).

**Conséquences pour la Belgique** : cibles de lancement du §D côté belge (« accompagnement personne âgée à domicile Bruxelles », « conciergerie privée Bruxelles » en écartant l'intention Airbnb, « English speaking nanny Brussels ») ; revalidation sur google.be en story 7.1. ⚠️ Une partie des requêtes belges se fait **en néerlandais** (Flandre, Bruxelles) : non couvertes par un site FR/EN. ⚠️ Benelux inclut les **Pays-Bas**, absents des 5 territoires actuels : à confirmer.

Questions d'origine et recommandations :

1. Pays prioritaires au lancement ? *Reco : Luxembourg, Belgique, Monaco (terrain ouvert), puis Suisse romande après l'avis juridique ; la France en dernier (terrain le plus dense).*
2. Fiche Google Business Profile ? *Reco : non au lancement.*
3. Termes de service autorisés par pays ? *Reco : avis juridique par pays avant d'écrire les pages de service ; d'ici là « accompagnement », « présence », « mise en relation » prudemment, jamais « placement », « soins », « agréé ».*
4. Budget outils SEO ? *Reco : aucun au lancement (Search Console, Trends, Keyword Planner gratuits) ; un mois d'outil payant au 3ᵉ mois si besoin de volumes.*
5. Qui produit et relit les textes ? *Reco : Cat fournit les faits, l'agent `seo-strategist` prépare les briefs, `i18n-copy-editor` rédige, Cat valide, un relecteur natif anglais relit ; rythme : une page de fond par mois après le lancement.*
