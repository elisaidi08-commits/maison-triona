# Journal des décisions — Maison Triona

> Une ligne par décision de Sady (ou de Cat via Sady). Chaque décision renvoie au document qui l'applique. Les interprétations de Claude sont marquées *(interprétation)* et restent `[À CONFIRMER]` tant que Sady ne les a pas relues.
> Les messages de Sady sont souvent dictés : « 4 » ou « A4 » = Cat / à Cat, « scale whale » = Scaleway.

---

## 15/10/2026 · Réponses au rapport de fin de phase 0

| # | Sujet | Décision | Conséquence | Reste ouvert |
|---|---|---|---|---|
| D01 | Partenaires | **Aucun partenaire pour l'instant.** | `PartnersBand` reste vide (rien n'est rendu) ; epic 6 en attente ; « Comment nous choisissons » non publiée | Partenaires nommables, niveau d'affichage, clauses de la convention : à reprendre quand le premier partenaire existe |
| D02 | Téléphone public | **Aucun numéro sur le site.** Le numéro de Cat n'est donné qu'une fois la relation engagée. La première réponse se fera **probablement par e-mail**. | « Comment ça se passe », étape 2 : « Nous vous répondons, le plus souvent par e-mail » ; aucun numéro dans le pied de page ni les données structurées | Garder le **rappel à la demande** (story 3.6, où c'est le visiteur qui laisse son numéro) ? `[À CONFIRMER]` |
| D03 | Délai de réponse | **48 heures.** | FAQ n° 6 visible ; page et e-mail de confirmation : « sous 48 heures » `[À VALIDER PAR CAT]` | 48 heures ouvrées ou calendaires (week-ends) ? `[À CONFIRMER]` |
| D04 | Situation urgente | Seulement si Cat peut y répondre ; dans tous les cas, elle répond **sous 24 à 48 heures**. | *(interprétation)* Un délai de 24 à 48 heures n'est pas une urgence pour le visiteur : **pas de lien « Situation urgente » dans l'en-tête** (story 3.7 close sans code). Le champ « Urgence » reste dans le formulaire pour le tri (les demandes « urgent » sont lues en premier) et la mention des services d'urgence s'affiche quand il est coché. | `[À CONFIRMER]` : lien ou pas de lien |
| D05 | Conservation des demandes | **Au cas par cas.** | La politique de confidentialité doit tout de même donner une **durée ou des critères** (RGPD, art. 13). Proposition : la demande est gardée le temps de l'échange ; sans suite, elle est supprimée **au plus tard 12 mois** après le dernier échange (plafond appliqué automatiquement par le coffre) ; Cat peut la supprimer plus tôt. `docs/privacy.md` §5 | Plafond à valider par Cat et le juriste |
| D06 | Notification à Cat | **Très minimaliste.** | *(interprétation)* Objet « Nouvelle demande · Maison Triona » (+ « prioritaire » si urgent), **sans service ni pays** (« Grand âge » dans un objet d'e-mail en dit déjà trop) ; corps : date et lien vers le coffre. `docs/architecture.md` §6.6 | — |
| D07 | Option technique du coffre | **Option 1 : Scaleway.** Scaleway Managed PostgreSQL (chiffrement au repos), sealed box libsodium, Better Auth (TOTP obligatoire, passkey), Scaleway TEM. | `docs/architecture.md` §1, §6.5, §6.6 ; versions vérifiées en story 3.2 | — |
| D08 | Wireframe du formulaire | **Variante A : progression en haut.** | Story 3.1 | — |
| D09 | Partage | Menu de partage natif accepté (ce n'est pas un script tiers), **le plus épuré possible**. | Deux liens texte au plus : « Envoyer à un proche » (menu natif du téléphone quand il existe, sinon `mailto:`) et « Copier le lien ». Aucun bouton de réseau social. Story 2.11 | — |
| D10 | Pays prioritaire | **Belgique d'abord, puis le Benelux.** | SEO : cibles belges en premier (FR et EN, Bruxelles et Wallonie), puis Luxembourg. Avis juridique **belge** en premier (enregistrement des activités de placement selon la région). `docs/seo-strategy.md` §M | ⚠️ Les **Pays-Bas** ne font pas partie des 5 pays actuels : Benelux = Belgique + Luxembourg, ou ajout des Pays-Bas ? ⚠️ La Flandre et Bruxelles sont aussi **néerlandophones** ; le site est FR/EN : requêtes en néerlandais non couvertes. `[À CONFIRMER]` |
| D11 | Google Business Profile | **Pas au lancement.** | Aucune fiche, aucune adresse publique | À rouvrir après le lancement |
| D12 | Termes de service autorisés | **À définir plus tard.** | D'ici là, vocabulaire prudent : « accompagnement », « présence », « mise en relation » ; jamais « placement », « soins », « agréé » (`docs/seo-strategy.md` §K) | Avis juridique **avant la mise en ligne** (pas avant le développement) |
| D13 | Budget outils SEO | **Aucun pour l'instant.** | Seuls les outils gratuits (Search Console, Google Trends) ; story 7.4 (`claude-seo`) reportée après le lancement | — |
| D14 | Périmètre | **« On fait d'abord la vitrine »** ; ce qui manque viendra ensuite. | *(interprétation)* Le plan commence déjà par la vitrine (epics 1 et 2). Les briques avancées (outils SEO, partenaires, fiche Google) passent après le lancement. | Mettre la vitrine en ligne **avant** le coffre et le formulaire complet ? À trancher à la fin de l'epic 2 |
| D15 | Rédaction et relecture des textes | Non répondu | — | `[À CONFIRMER]` |
| D16 | Passage en phase 1 | **`GO PHASE 1` confirmé** (réponse explicite, 15/10/2026) | Phase 1 ouverte : une story à la fois, dans l'ordre du plan ; première story : 1.1 | — |
| D17 | Emplacement du dépôt | ~~Renommer les dossiers~~ → **« Travaille dans ce repo-là »** : le dépôt reste dans le dossier actuel, `/Volumes/DISQUE SADY/06_CLIENTS/MAMAN /MAISON TRIONA ` (espaces finaux conservés). | Dépôt git privé à cet endroit ; dossiers de travail exclus de Git par motif ; build vérifié malgré les espaces finaux (story 1.1) | Le disque externe peut s'éjecter : pousser souvent vers le dépôt distant privé |

## 15/10/2026 · Story 1.2

| # | Sujet | Décision | Conséquence | Reste ouvert |
|---|---|---|---|---|
| D18 | Story 1.2 (tokens, banc d'essai) | **« Okay »** de Sady : story validée, passage aux assets | Commit, PR ; serif provisoire inchangée (Newsreader sans taille optique) | Serif (reco : Newsreader locale, tailles optiques 32-72, 60 ko, 84 ko avec Manrope), vert sapin ou cyprès, italique (déconseillé), taille des libellés de la liste d'entrée (24 ou 20-22 px) |

## 15/10/2026 · Home immersive

| # | Sujet | Décision | Conséquence | Reste ouvert |
|---|---|---|---|---|
| D19 | Home immersive (références : pahari.vercel.app, theboringblog.ai) | **Direction A, « Seuil plein écran »** : premier écran = vidéo V01 plein cadre, titre sur voile sapin, les 4 besoins visibles tout de suite sur une bande ivoire ; en défilant, la caméra avance vers la fenêtre (vidéo pilotée par le scroll, « on entre »), puis chaque service arrive en plein écran | `docs/art-direction.md` §7.2 et `docs/motion-spec.md` (M13, M15) mis à jour ; V01-s (avancée) devient obligatoire au lot 1 (+12 crédits) ; story 2.1 réalisée selon cette direction | Écartés : galerie 3D flottante (B) et maison-diorama (C). Des références, on garde le plein écran, l'interface minimale et la sensation d'entrer ; on laisse la 3D WebGL (46 à 53 Mo et 1,5 à 1,9 Mo de JS mesurés, contre 320 ko et 100 ko pour notre budget) |

## Toujours ouverts (rapports précédents)

Serif display (choisie au banc d'essai de la story 1.2) · vert signature · logo « le sillage » · mouvement (Q4) · « Cat », « Catriona » ou « nous » (Q9) · moodboard de référence (`ASSETS PHOTO MAQUETTE/` présumé) · domaine et adresse de réception · CMS (Sanity recommandé) · mention IA · paramètre `?service=` dans les journaux · option « Autre » dans les pays · absence de bandeau cookies (juriste).
