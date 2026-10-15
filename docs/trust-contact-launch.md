<!--
Spec rédigée par Sady (PO), enregistrée telle quelle le 15/10/2026 (sections 1 à 8).
Les annexes A à D (après la section 8) sont les propositions de Claude demandées en §8.
-->

# MAISON TRIONA — by K. · SPEC « CONFIANCE, CONTACT, SÉCURITÉ, LANCEMENT »

> **Statut** : 5ᵉ complément du prompt Claude Code. À placer dans `docs/trust-contact-launch.md`.
> **Portée** : pages de réassurance, parcours de contact, coffre sécurisé des demandes, délivrabilité des e-mails, partage familial, tests utilisateurs, prévisualisation et lancement.
> **Priorité en cas de conflit** : `ux-entry-i18n-a11y` (entrée par besoin, i18n, a11y) > ce document > brief assets IA > prompt Phase 0 > PRD (design). Le PRD reste la référence fonctionnelle (formulaire, RGPD, SEO) ; ce document le **précise et l'étend** sans le contredire.
> **Phase 0 = zéro code applicatif** : tu écris uniquement dans `docs/`, `.claude/`, `CLAUDE.md`.
> Auteur / PO : Sady. Cliente : Cat (« K. »).

---

## 1. Les 5 chantiers

| # | Chantier | Phase |
|---|---|---|
| 1 | Pages de réassurance : **FAQ**, **Comment ça se passe**, **Notre indépendance** | Phase 1 (contenu `[CONTENU À FOURNIR PAR CAT]`) |
| 2 | **Parcours de contact** : rappel à la demande, formulaire en étapes, lien « Situation urgente » (conditionnel) | Phase 1 |
| 3 | **Coffre sécurisé des demandes** + **délivrabilité e-mail** | Phase 1 (cœur du MVP) |
| 4 | **Partage familial** : e-mail, copie du lien, PDF | Phase 1 |
| 5 | **Tests utilisateurs** + **site de prévisualisation protégé** + **checklist de lancement** | Fin de phase 1 / phase 5 du plan |

Principes transversaux : sobre, luxueux, convivial ; langage clair ; **FR + EN** partout ; accessibilité **WCAG 2.2 AA** ; aucune donnée sensible exposée ; aucun tiers de pistage.

---

## 2. Chantier 1 · Pages de réassurance

### 2.1 FAQ
- **Questions de départ** (à valider avec Cat ; les réponses restent `[CONTENU À FOURNIR PAR CAT]`) :
  - Mes informations restent-elles confidentielles ?
  - Qui paie qui ? Combien cela me coûte-t-il ?
  - Comment choisissez-vous les sociétés avec lesquelles vous travaillez ?
  - Que se passe-t-il si la personne ou la société ne me convient pas ?
  - Dans quels pays travaillez-vous ?
  - En combien de temps recevrai-je une réponse ? *(n'afficher un délai que si Cat peut le tenir)*
  - Dois-je donner des informations médicales ?
  - Puis-je faire la demande pour un proche ?
- **Implémentation** : accordéon **accessible** (`<details>/<summary>` ou ARIA correct), contenu **présent dans le HTML sans JS**, réponses courtes, un seul `h1` par page, ancres par question pour les liens directs, parité FR/EN.
- **SEO** : balisage sémantique propre ; n'ajoute pas de promesses que le contenu ne tient pas.

### 2.2 « Comment ça se passe »
- **4 à 5 étapes visibles pour le visiteur** (version simplifiée du parcours interne) : vous nous écrivez → un premier échange court → nous cernons vos besoins → nous vous présentons des sociétés adaptées → nous restons à vos côtés après le démarrage.
- Chaque étape : titre court + 1 à 2 phrases. Pas de jargon, pas de délai non tenu. `[À CONFIRMER avec Cat : le vrai déroulé, les canaux, les délais]`.
- **Version en langage très simple** (phrases courtes, un mot par idée) accessible depuis la page : lien « Version en langage simple ». Même contenu, lecture facile.
- **PDF à télécharger** (FR et EN) généré au build : texte réel (pas d'image), titres balisés, langue déclarée, bon contraste.

### 2.3 « Notre indépendance »
- Explique **comment la maison est rémunérée, sans montants**, et ce que cela signifie pour le client.
- Ne l'écris **que si c'est vrai** : par exemple « le même taux pour toutes les sociétés partenaires », « aucune commission cachée », « le client signe directement avec la société ». `[À CONFIRMER avec Cat avant toute formulation]`.
- Renvoie vers « Comment nous choisissons » (voir la spec partenaires, phase 2) quand elle existera. En attendant, relie à la FAQ.
- À faire relire par un juriste (information du consommateur sur la rémunération par les prestataires, pays par pays). Ce n'est pas un avis juridique.

---

## 3. Chantier 2 · Parcours de contact

### 3.1 Deux entrées, un même coffre
- **A. Formulaire en étapes** (principal).
- **B. Rappel à la demande** : « Être rappelé(e) » avec nom, numéro, **langue**, **créneau** (matin / après-midi / soir, jours), option « **Ne pas laisser de message vocal** ».
- Les deux alimentent le **même coffre** (§4) et le même suivi.

### 3.2 Formulaire en étapes (4 écrans courts, barre de progression, retour possible)
1. **Besoin** : prérempli depuis `?service=` si présent, modifiable.
2. **Pour qui, où, quand** : pour moi / pour un proche / autre ; pays (BE · FR · LU · MC · CH) ; urgence (aucune / dans les semaines à venir / urgent).
3. **Comment vous joindre** : e-mail ou téléphone, créneau, langue.
4. **Un mot libre (facultatif)**, avec le message visible : « Inutile de donner des détails médicaux ; nous en parlerons de vive voix. » + **case de consentement RGPD** (lien vers la politique de confidentialité).
- **Brouillon** : conserver uniquement les champs **non sensibles** (besoin, pays, langue, créneau) dans `sessionStorage`, effacé à l'envoi. **Ne jamais sauvegarder le champ libre côté serveur ni dans le navigateur.**
- **Anti-spam** : honeypot + limitation de débit ; pas de captcha visible (PRD).
- **Validation** claire, messages d'erreur proches du champ, `autocomplete` adapté, aucun effacement de saisie en cas d'erreur.
- **Confirmation** : page soignée + e-mail au visiteur qui **explique la suite** (« Nous vous répondons à … ») **sans répéter le contenu de la demande**.

### 3.3 Lien « Situation urgente » `[CONDITIONNEL : n'implémenter que si Cat valide qu'elle peut y répondre]`
- Lien discret dans l'en-tête et sur la page contact → variante raccourcie du formulaire marquée comme **prioritaire**, ou numéro de téléphone si Cat l'autorise.
- **Aucune promesse de délai** sans engagement réel. Mention visible : « **En cas d'urgence médicale, contactez immédiatement les services d'urgence de votre pays.** » (vérifie les numéros à afficher pour chacun des 5 pays ; ne cite pas un numéro sans l'avoir vérifié).
- La maison n'est pas un service d'urgence : formule-le simplement et clairement.

### 3.4 Questions à poser à Sady `[BLOQUANT pour le texte]`
Cat veut-elle un numéro de téléphone public (et dans quels pays) ? Peut-elle tenir un engagement de délai de réponse (lequel) ? Valide-t-elle le lien « Situation urgente » ?

---

## 4. Chantier 3 · Coffre sécurisé des demandes + délivrabilité e-mail

### 4.1 Coffre
- Chaque demande est **enregistrée chiffrée** (au repos et en transit) dans une base **hébergée dans l'UE**, **en plus** de la notification par e-mail : une panne d'e-mail ne doit jamais faire perdre un contact.
- **Notification à Cat** : par défaut, un e-mail **sans le contenu sensible** (service, pays, langue, urgence, source anonyme) avec un lien vers la demande dans le coffre (connexion sécurisée). `[À TRANCHER avec Cat : confort du contenu dans l'e-mail vs sécurité ; recommandation = notification minimale + lien sécurisé]`.
- **Accès** : comptes nominatifs, authentification forte (A2F), journal d'accès, aucun accès partagé.
- **Durée de conservation** et **suppression à la demande** : définis avec Cat et un juriste (`[À CONFIRMER]`) ; implémente la suppression effective (et dans les sauvegardes selon une politique documentée).
- **Minimisation** : pas de champ santé, pas de pièce d'identité, pas de données inutiles. Ne journalise jamais le contenu des demandes.
- **Sous-traitants** : liste tenue dans `docs/privacy.md` (hébergeur, base, e-mail, analytics) avec contrat de traitement (DPA) à signer et localisation des données. Propose 2 à 3 options de composants avec avantages et limites ; **ne les installe pas en phase 0**.
- **Qualification** : le coffre stocke aussi la **source anonyme** (ex. `?s=carte`, code d'invitation) sans lier à un identifiant.

### 4.2 Délivrabilité e-mail
- Domaine propre : **SPF, DKIM, DMARC** configurés (démarrage prudent de DMARC, puis durcissement après vérification), sous-domaine d'envoi dédié, adresse expéditrice alignée avec le domaine, **Reply-To** de Cat.
- **Aucun pixel de suivi** dans les e-mails.
- **Tests réels** de réception (Gmail, Outlook, boîte privée type Proton, Apple Mail) et vérification de **non-classement en spam**, consignés dans `docs/email-deliverability.md`.
- **File d'attente avec reprise** en cas d'échec d'envoi + alerte à Sady. La demande reste dans le coffre quoi qu'il arrive.
- Surveillance des rebonds (bounces) et des plaintes ; adresse de réponse relevée régulièrement.

---

## 5. Chantier 4 · Partage familial

- Sur « Comment ça se passe », les pages de service et la FAQ : boutons **« Envoyer à un proche »** (lien `mailto:` prérempli : objet et courte phrase + URL, rédigés en FR/EN) et **« Copier le lien »** (avec retour accessible : message annoncé aux lecteurs d'écran).
- **PDF** « Comment ça se passe » en FR et EN (voir §2.2), à partager ou imprimer.
- **Aucun widget tiers de partage**, aucun script de réseau social, aucun pistage.
- Version **imprimable** (feuille de style print) des pages de réassurance : lisibles sur papier, sans en-tête ni navigation superflue.

---

## 6. Chantier 5 · Tests utilisateurs, prévisualisation, lancement

### 6.1 Site de prévisualisation protégé
- URL de préproduction **protégée par mot de passe**, `noindex` (robots + en-tête), **aucune donnée réelle** ; accès pour Sady et Cat.
- Chaque version de revue = une URL de prévisualisation datée ; Cat peut commenter sur écran (captures annotées) sans compte.

### 6.2 Tests utilisateurs (`docs/usability-protocol.md` puis `docs/usability-report.md`)
- **5 participants minimum** : 2 seniors (65 ans et plus), 2 enfants adultes qui s'occupent d'un parent, 1 utilisateur de lecteur d'écran. Consentement oral/écrit, aucun enregistrement sans accord, aucune donnée médicale réelle.
- **Tâches** : trouver « accompagner un proche », comprendre qui paie qui, faire une demande, demander un rappel, partager la page à un proche, basculer en anglais.
- **Mesures** : temps pour atteindre le service, achèvement du formulaire, compréhension de « qui paie », points de blocage, confort de lecture. Un seuil de succès par tâche, défini avant les tests.
- Le rapport liste les **problèmes classés** (bloquant / important / mineur) et les corrections décidées.

### 6.3 Checklist de lancement (`docs/launch-checklist.md`)
- [ ] Redirections : `www` ↔ domaine nu, `/` → `/fr` ou `/en` selon la stratégie, anciennes URL.
- [ ] `robots.txt` et `sitemap.xml` de production ; `noindex` retiré **uniquement** à l'ouverture.
- [ ] HTTPS, HSTS, CSP, en-têtes de sécurité vérifiés.
- [ ] Soumission de test de bout en bout (formulaire + rappel) : coffre, notification, e-mail de confirmation, absence de données dans les logs.
- [ ] SPF / DKIM / DMARC validés, tests de réception réalisés.
- [ ] FR/EN relus (humain), parité des clés vérifiée, `hreflang` correct.
- [ ] Pages légales par pays, politique de confidentialité, **déclaration d'accessibilité**, mention éventuelle sur les images générées par IA (décision de Cat).
- [ ] Analytics sans traceurs actif ; pas de bandeau si aucun traceur.
- [ ] Pages 404 et 500 soignées, favicon, image de partage.
- [ ] Surveillance de disponibilité, alertes, sauvegardes, procédure de restauration testée.
- [ ] Plan de **lancement en douceur** : ouverture à un cercle restreint, retours, puis ouverture générale.

---

## 7. Impact sur les autres documents (à mettre à jour en phase 0)
- `docs/plan-implementation.md` : ajoute les stories ci-dessous.
- `docs/architecture.md` : coffre chiffré UE, file d'attente d'e-mails, authentification forte, génération de PDF au build, protection de la préproduction.
- `docs/privacy.md` : sous-traitants, durées de conservation, suppression, mesure.
- Agents : `security-privacy-reviewer` (coffre, DPA, logs, A2F), `qa-a11y-perf` (formulaire en étapes, accordéon, PDF accessible), `i18n-copy-editor` (FAQ, pages de réassurance, e-mails), `art-director` (pages sobres, cohérentes avec le luxe chaleureux).
- Skill `maison-triona-qa` : ajoute la checklist de lancement §6.3.

### Stories à ajouter

| ID | Story | Critères d'acceptation |
|---|---|---|
| E2-S3 | FAQ accessible | Contenu sans JS ; accordéon utilisable au clavier ; FR/EN ; ancres par question |
| E2-S4 | Comment ça se passe + version simple + PDF | 4 à 5 étapes ; version simple ; PDF FR/EN avec texte réel ; aucun délai non validé |
| E2-S5 | Notre indépendance | Seulement des affirmations validées par Cat ; relu juridiquement ; FR/EN |
| E3-S5 | Formulaire en étapes | 4 écrans ; brouillon non sensible en `sessionStorage` ; champ libre jamais sauvegardé ; consentement RGPD ; confirmation sans écho du contenu |
| E3-S6 | Rappel à la demande | Créneau, langue, « pas de message vocal » ; alimente le coffre ; confirmation claire |
| E3-S7 | Situation urgente *(conditionnel)* | Implémentée seulement si Cat valide ; mention des services d'urgence ; aucune promesse de délai |
| E3-S8 | Coffre sécurisé | Chiffré, hébergé UE ; A2F ; journal d'accès ; durée de conservation et suppression ; aucune donnée dans les logs |
| E3-S9 | Délivrabilité e-mail | SPF/DKIM/DMARC ; tests de réception documentés ; file d'attente avec reprise ; aucun pixel de suivi |
| E2-S6 | Partage familial | `mailto:` prérempli ; copie du lien accessible ; PDF ; aucun widget tiers ; feuille de style print |
| E5-S7 | Prévisualisation protégée | Mot de passe, `noindex`, aucune donnée réelle |
| E5-S8 | Tests utilisateurs | Protocole + rapport ; 5 participants dont seniors et lecteur d'écran ; seuils de succès définis avant |
| E5-S9 | Checklist de lancement | Tous les points §6.3 cochés avant l'ouverture |

---

## 8. Ce que tu fais en phase 0

1. Mets à jour les documents de la §7 ; crée `docs/trust-contact-launch.md` (ce document), `docs/usability-protocol.md` (brouillon), `docs/launch-checklist.md`, `docs/email-deliverability.md` (brouillon).
2. Écris les **textes FR et EN** de la FAQ (questions seulement, réponses en `[CONTENU À FOURNIR PAR CAT]`), de « Comment ça se passe » (structure et phrases d'ossature) et de « Notre indépendance » (squelette conditionné par les validations de Cat).
3. Propose **2 variantes de wireframe en texte** du formulaire en étapes (progress en haut vs étapes latérales) et recommande-en une.
4. Propose **2 à 3 options** pour le coffre, l'e-mail transactionnel et l'authentification forte (UE, RGPD), avec avantages et limites. **Ne rien installer.**
5. Ajoute au rapport de fin de phase 0 les questions de la §3.4 et celles du §4.1 (durée de conservation, contenu de la notification), formulées en une ligne avec ta recommandation.
6. Rappelle-toi la phrase finale : **« Phase 0 terminée. J'attends `GO PHASE 1`. »**

---
---

# Annexes : propositions de phase 0 (Claude, 15/10/2026)

> **Décisions de Sady du 15/10/2026** (D01 à D16) : `docs/decisions.md`. Elles sont reportées ci-dessous là où elles changent un texte ou une option.

## Annexe A · Décisions et écarts relevés

| Sujet | Constat | Proposition |
|---|---|---|
| **Le coffre change une règle actée** | Jusqu'ici : « aucune copie des demandes stockée par le site » (CLAUDE.md, architecture, privacy, agents) | La règle devient : **chaque demande est stockée chiffrée dans un coffre UE**, l'e-mail n'est qu'une notification. Tous les documents et agents sont mis à jour en conséquence. |
| Formulaire en étapes et « sans JavaScript » | La spec d'entrée exige que tout fonctionne sans JS | **Un seul formulaire HTML en 4 `fieldset`**. Avec JS : affichage étape par étape, progression, retour. Sans JS : les 4 parties s'affichent à la suite sur une seule page, et l'envoi fonctionne. Aucune étape n'est envoyée au serveur avant l'envoi final : rien n'est stocké côté serveur entre deux écrans. |
| Brouillon | `sessionStorage` pour besoin, pays, langue, créneau | Clés préfixées `mt-draft-`, effacées à l'envoi et à la fermeture de l'onglet ; **jamais** le nom, le contact, « pour qui », l'urgence ni le message. « Pour qui » et l'urgence révèlent une situation : ils restent hors brouillon. |
| Case de consentement | Demandée par la spec | Libellé proposé au §B.4. Base légale à faire trancher par le juriste : mesures précontractuelles pour traiter la demande, **consentement explicite** (art. 9.2.a) si le visiteur écrit malgré tout des informations de santé dans le message. La case couvre ce second cas. |
| E-mail de confirmation au visiteur | Nouveau : un e-mail part vers une adresse saisie par un inconnu | Risque d'abus (envoi de messages à des tiers). Parades : texte fixe **sans aucun contenu saisi**, envoi seulement après écriture dans le coffre, limitation de débit par IP et par adresse, honeypot. |
| Champ « urgence » et lien « Situation urgente » | Conditionnels | Le champ « urgence » du formulaire reste (il aide Cat à trier) ; le **lien d'en-tête** n'existe que si Cat le valide. La mention des services d'urgence apparaît dès qu'« urgent » est coché, avec les numéros vérifiés (§D.5). |
| FAQ en accordéon | `anti-patterns.md` n° 23 l'interdit | Cette spec prime. `<details>`/`<summary>` natifs, ouverts à l'impression, une ancre par question. **Mettre l'anti-pattern à jour.** |
| « Combien cela me coûte-t-il ? » | Le site n'affiche aucun tarif | La réponse explique **le principe** (qui paie qui), jamais un montant, et seulement après validation de Cat. |
| Version en langage simple | Nouvelle page | `/fr/comment-ca-se-passe/langage-simple`, `/en/how-it-works/easy-read`, liée depuis la page principale et depuis le PDF. |
| PDF au build | Accessible : texte réel, titres, langue | Génération à partir de la page imprimable (même source, même contenu), version balisée ; option technique au §D.4. |
| Partage | `mailto:` + copie du lien | Copie avec l'API Presse-papiers et un message `aria-live` (« Lien copié »). Aucune API de partage tierce. Le menu de partage natif du téléphone (`navigator.share`) est possible en option, car ce n'est pas un script tiers : **à valider par Sady**. |
| Source anonyme `?s=` | Stockée avec la demande | Liste fermée de codes (ex. `carte`, `salon`, `ami`) ; toute autre valeur est ignorée ; jamais envoyée à l'outil de mesure avec la demande. |
| Préproduction protégée | Mot de passe, `noindex`, Cat sans compte | Option technique et coût au §D.6. |
| Cat discrète | La spec SEO demande que Cat ne soit pas mise en avant | Les étapes disent « nous » plutôt que « Cat » ; décision « Cat » / « Catriona » / « nous » toujours ouverte. |

## Annexe B · Textes FR / EN

Statut : **brouillons**. `[À VALIDER PAR CAT]` partout ; les affirmations conditionnelles sont marquées `[SI VRAI]`. Rien n'est publié sans validation (`check:content`).

### B.1 FAQ (questions ; réponses à fournir par Cat)

| # | Ancre | FR | EN | Réponse |
|---|---|---|---|---|
| 1 | `#confidentialite` | Mes informations restent-elles confidentielles ? | Will my information remain confidential? | `[CONTENU À FOURNIR PAR CAT]` |
| 2 | `#qui-paie` | Qui paie qui ? Combien cela me coûte-t-il ? | Who pays whom? What will it cost me? | `[CONTENU À FOURNIR PAR CAT]` (principe seulement, aucun montant) |
| 3 | `#selection` | Comment choisissez-vous les sociétés avec lesquelles vous travaillez ? | How do you choose the companies you work with? | `[CONTENU À FOURNIR PAR CAT]` |
| 4 | `#si-cela-ne-convient-pas` | Que se passe-t-il si la personne ou la société ne me convient pas ? | What happens if the person or company is not right for me? | `[CONTENU À FOURNIR PAR CAT]` |
| 5 | `#pays` | Dans quels pays travaillez-vous ? | Which countries do you work in? | Proposition : « En Belgique, en France, au Luxembourg, à Monaco et en Suisse. » / « In Belgium, France, Luxembourg, Monaco and Switzerland. » `[À VALIDER]` |
| 6 | `#delai` | En combien de temps recevrai-je une réponse ? | How quickly will I hear back? | Proposition (D03) : « Sous 48 heures, le plus souvent par e-mail. » / « Within 48 hours, usually by email. » `[À VALIDER PAR CAT : heures ouvrées ou calendaires]` |
| 7 | `#informations-medicales` | Dois-je donner des informations médicales ? | Do I need to share medical information? | Proposition : « Non. Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. » / « No. There's no need to share any medical details; we'll talk about it in person. » `[À VALIDER]` |
| 8 | `#pour-un-proche` | Puis-je faire la demande pour un proche ? | Can I make a request for someone close to me? | Proposition : « Oui. Beaucoup de demandes viennent d'un enfant, d'un conjoint ou d'un proche. » / « Yes. Many requests come from a son or daughter, a partner or a friend. » `[À VALIDER]` |

### B.2 « Comment ça se passe » (ossature)

| Étape | FR | EN |
|---|---|---|
| 1 | **Vous nous écrivez.** Quelques lignes suffisent, pour vous ou pour un proche. | **You write to us.** A few lines are enough, for yourself or for someone close to you. |
| 2 | **Un premier échange, court.** Nous vous répondons sous 48 heures, le plus souvent par e-mail. `[À VALIDER PAR CAT]` (D02, D03) | **A short first conversation.** We reply within 48 hours, usually by email. `[TO BE CONFIRMED]` |
| 3 | **Nous cernons vos besoins.** Ce qui compte pour vous, vos habitudes, vos contraintes. | **We understand your needs.** What matters to you, your habits, your constraints. |
| 4 | **Nous vous présentons des sociétés adaptées.** Choisies parmi celles avec lesquelles nous travaillons. Vous décidez. | **We introduce you to suitable companies.** Chosen from those we work with. You decide. |
| 5 | **Nous restons à vos côtés.** Après le démarrage, nous prenons des nouvelles. `[À CONFIRMER : forme et durée du suivi]` | **We stay by your side.** Once things have started, we keep in touch. `[TO BE CONFIRMED]` |

**Version en langage simple** (FR / EN) :
1. Vous écrivez. · You write.
2. Nous vous répondons. · We reply to you.
3. Nous parlons de ce dont vous avez besoin. · We talk about what you need.
4. Nous vous proposons des personnes de confiance. · We suggest people you can trust.
5. Vous choisissez. · You choose.
6. Nous restons là, après. · We stay in touch afterwards.

### B.3 « Notre indépendance » (squelette conditionnel)

Chaque bloc n'est publié **que si** Cat confirme qu'il est vrai, puis après relecture juridique.

| Bloc | FR | EN |
|---|---|---|
| Titre | Notre indépendance | Our independence |
| Introduction | Il est normal de se demander comment la maison est rémunérée. Voici comment cela fonctionne, simplement. | It is natural to wonder how the house is paid. Here is how it works, simply. |
| `[SI VRAI]` Qui paie | La maison est rémunérée par les sociétés avec lesquelles elle travaille, une fois la collaboration engagée. | The house is paid by the companies it works with, once a collaboration has begun. |
| `[SI VRAI]` Même taux | Le taux est le même pour toutes : aucune société ne peut obtenir une place à part. | The rate is the same for all of them: no company can buy a better place. |
| `[SI VRAI]` Pas de frais cachés | Aucune commission cachée ne vous est facturée. | No hidden commission is charged to you. |
| `[SI VRAI]` Contrat direct | Vous signez directement avec la société choisie. | You sign directly with the company you choose. |
| Lien | Voir aussi : comment nous choisissons les sociétés (phase 2) · la FAQ | See also: how we choose companies (phase 2) · the FAQ |

### B.4 Parcours de contact (libellés)

| Élément | FR | EN |
|---|---|---|
| Progression | Étape 2 sur 4 · Pour qui, où, quand | Step 2 of 4 · Who, where, when |
| Étape 1 | Votre besoin | Your need |
| Étape 2 | Pour qui ? (Pour moi · Pour un proche · Autre) · Pays · Urgence (Aucune · Dans les semaines à venir · Urgent) | Who is it for? (For myself · For someone close to me · Other) · Country · Urgency (None · In the coming weeks · Urgent) |
| Étape 3 | Comment vous joindre · E-mail · Téléphone · Créneau (Matin · Après-midi · Soir) · Langue (Français · English) | How to reach you · Email · Phone · Time slot (Morning · Afternoon · Evening) · Language (Français · English) |
| Étape 4 | Un mot libre (facultatif). Aide : « Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. » | A few words (optional). Hint: "There's no need to share any medical details; we'll talk about it in person." |
| Consentement | J'accepte que Maison Triona utilise ces informations pour répondre à ma demande, comme décrit dans la politique de confidentialité. | I agree that Maison Triona may use this information to respond to my request, as described in the privacy policy. |
| Boutons | Continuer · Retour · Envoyer | Continue · Back · Send |
| Rappel | Être rappelé(e) · Nom · Numéro · Langue · Créneau et jours · Ne pas laisser de message vocal | Request a call back · Name · Number · Language · Time slot and days · Please don't leave a voicemail |
| Confirmation (page) | Merci, votre demande est bien arrivée. Nous vous répondrons sous 48 heures. `[À VALIDER PAR CAT]` | Thank you, your request has arrived safely. We will reply within 48 hours. `[TO BE CONFIRMED]` |
| E-mail au visiteur (objet) | Maison Triona · Votre demande est bien arrivée | Maison Triona · Your request has arrived |
| E-mail au visiteur (corps) | Bonjour, nous avons bien reçu votre demande. Nous vous répondrons sous 48 heures, par le moyen que vous avez indiqué. Pour votre confidentialité, ce message ne reprend pas son contenu. `[À VALIDER PAR CAT]` | Hello, we have received your request. We will reply within 48 hours, by the channel you chose. For your privacy, this message does not repeat its content. `[TO BE CONFIRMED]` |
| Notification à Cat (objet) | Nouvelle demande · Maison Triona (+ « · Prioritaire » si urgent) ; corps : date et lien vers le coffre, rien d'autre (D06, très minimaliste) | — (interface interne en français) |
| Mention d'urgence | La maison n'est pas un service d'urgence. En cas d'urgence médicale, appelez immédiatement les services d'urgence (numéros au §D.5). | The house is not an emergency service. In a medical emergency, call the emergency services immediately (numbers in §D.5). |
| Partage | Envoyer à un proche · Copier le lien · Lien copié | Send to someone close · Copy the link · Link copied |
| `mailto:` (objet / corps) | Maison Triona · Comment ça se passe / Je pense que cette page peut nous aider : <URL> | Maison Triona · How it works / I think this page could help us: <URL> |

## Annexe C · Wireframes du formulaire en étapes

### Variante A · Progression en haut (recommandée)

```
DESKTOP (colonne de 640 px, centrée, aplat ivoire)      MOBILE 390
┌─────────────────────────────────────────────────┐     ┌────────────────────────┐
│ ÉTAPE 2 SUR 4 · POUR QUI, OÙ, QUAND              │     │ ÉTAPE 2 SUR 4           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━──────────────────────── │     │ ━━━━━━━━━━──────────── │
│ (filet or 1 px, rempli à 50 %)                   │     │ Pour qui ?              │
│                                                 │     │ ○ Pour moi              │
│ Pour qui ?                                      │     │ ○ Pour un proche        │
│ ○ Pour moi  ○ Pour un proche  ○ Autre           │     │ ○ Autre                 │
│                                                 │     │ Pays                    │
│ Pays                                            │     │ BE FR LU MC CH Autre    │
│ BE · FR · LU · MC · CH · Autre                  │     │ Urgence                 │
│                                                 │     │ ○ Aucune …              │
│ Urgence                                         │     │                         │
│ ○ Aucune  ○ Dans les semaines à venir  ○ Urgent │     │ [Retour]   [Continuer]  │
│                                                 │     └────────────────────────┘
│ Retour                              Continuer   │
└─────────────────────────────────────────────────┘
```
**Pour** : identique en desktop et en mobile ; l'étape est annoncée par un titre (« Étape 2 sur 4 · … ») lu par les lecteurs d'écran, sans dépendre de la barre ; peu d'éléments, très sobre ; la colonne reste à 640 px.
**Contre** : on ne voit pas d'emblée les intitulés des étapes suivantes (compensé par le titre et le bouton Retour).

### Variante B · Étapes latérales

```
DESKTOP
┌───────────────────────┬──────────────────────────────────────────┐
│ 1 · Votre besoin    ✓ │ Pour qui, où, quand                      │
│ 2 · Pour qui…   ←     │ ○ Pour moi  ○ Pour un proche  ○ Autre    │
│ 3 · Vous joindre      │ Pays · Urgence …                         │
│ 4 · Un mot libre      │ Retour                       Continuer   │
└───────────────────────┴──────────────────────────────────────────┘
MOBILE : la colonne latérale se replie en « Étape 2 sur 4 » au-dessus (= variante A)
```
**Pour** : vue d'ensemble du parcours. **Contre** : une seconde colonne qui alourdit l'écran ; elle doit de toute façon disparaître en mobile ; la tentation de rendre les étapes cliquables complique le clavier et la validation ; un registre plus « administratif ».

**Recommandation : variante A, retenue par Sady le 15/10/2026 (D08).** Plus légère, identique sur tous les écrans, et plus simple à rendre accessible (un titre d'étape, un seul ordre de tabulation). La « barre » est un filet or qui se remplit : aucune couleur nouvelle, aucun pictogramme.

## Annexe D · Options techniques (UE, RGPD) — rien n'est installé

Recherche du 15/10/2026 sur les pages officielles (documentation, tarifs, contrats). Prix hors taxes, à revérifier au moment de souscrire. `NON VÉRIFIÉ` = non confirmé sur une source officielle.

### Trois limites à connaître avant de choisir
1. **Vercel voit la demande en clair au moment de l'envoi**, quel que soit le lieu de la base (TLS jusqu'à la fonction, puis chiffrement immédiat). Chiffrer dans le navigateur du visiteur l'éviterait, mais casserait la règle « tout fonctionne sans JavaScript ». **Proposition** : chiffrement côté serveur dès la réception, aucune journalisation, risque résiduel documenté dans `docs/privacy.md`. Une base UE réduit l'exposition au droit américain (CLOUD Act) sans la supprimer.
2. **Aucun fournisseur ne documente la purge d'une ligne dans ses sauvegardes.** Une demande supprimée subsiste jusqu'à la fin de la fenêtre de sauvegarde : 7 jours chez Scaleway, Clever Cloud et Supabase Pro, **30 jours chez Neon**. Cette fenêtre doit figurer dans la politique de confidentialité.
3. **Données de santé** : même sans champ santé, une demande « grand âge » peut en révéler. Savoir si l'hébergement de données de santé (HDS, France) s'applique à une conciergerie est une question **pour le juriste**. Scaleway et Clever Cloud sont certifiés HDS sous contrat spécifique (chez Scaleway, la base gérée n'est pas dans la liste des produits HDS).

### D.1 Base du coffre

| Option | Société et données | Chiffrement au repos | Sauvegardes | Prix indicatif | Connexion depuis Vercel | Remarques |
|---|---|---|---|---|---|---|
| **Scaleway Managed PostgreSQL** | Scaleway SAS (France), régions UE | Option à activer (LUKS, clé gérée par Scaleway) ; **sauvegardes logiques non chiffrées** | 1 par jour, 7 jours par défaut ; à supprimer à la main | DB-DEV-S ≈ 11,4 €/mois + stockage | Filtrage par IP : ouvrir l'accès avec TLS et identifiants forts, ou IP fixes Vercel (100 $/mois) | ISO 27001 ; DPA publié ; même fournisseur que l'e-mail TEM et le KMS |
| **Clever Cloud PostgreSQL** | Société française, centres à Paris | LUKS2, une clé par base, **sur base dédiée et sur demande au support** | 1 par jour, 7 jours ; restauration à un instant donné possible | Petites offres dès ≈ 5 à 15 (devise et unité `NON VÉRIFIÉ`) | `NON VÉRIFIÉ` | ISO 27001, **HDS sous contrat**, SecNumCloud en cours ; DPA publié |
| **Supabase Pro** (Paris, eu-west-3) | Supabase Pte. Ltd. (Singapour), groupe américain ; données dans la région choisie | AES-256 | Pro : 7 jours ; restauration à un instant donné en option (100 $/mois) | 25 $/mois | Pooler intégré, prêt pour le serverless | Auth avec TOTP incluse ; SOC 2, ISO 27001 ; DPA avec clauses types |
| ~~Neon~~ | Racheté par Databricks (États-Unis) | AES-256 | **30 jours** | À l'usage | Pilote serverless | Écarté : sauvegardes trop longues, groupe américain |

**Chiffrement applicatif (dans tous les cas)** :
- **Recommandé : « sealed box » libsodium.** La fonction ne connaît que la **clé publique** ; la clé privée, protégée par une phrase de passe (Argon2id), ne se déchiffre que dans le navigateur de l'admin ; copie de secours hors ligne. Une fuite de la base, d'une sauvegarde ou des variables d'environnement ne révèle rien. Contreparties : **perdre la clé, c'est perdre les demandes** ; pas de recherche côté serveur.
- Alternative : chiffrement en enveloppe avec un KMS (Scaleway Key Manager, quelques centimes par mois) : rotation et audit des clés, mais le serveur déchiffre.

### D.2 Authentification forte (1 à 2 comptes)

| Option | Où vivent les données | Points clés | Verdict |
|---|---|---|---|
| **Better Auth** | Dans notre base (le coffre) | Open source, maintenu (rejoint Vercel en 2026) ; TOTP, codes de secours, passkeys ; verrouillage après échecs. L'A2F obligatoire ne couvre que la connexion par identifiants : désactiver les autres méthodes | **Recommandé** : mot de passe + TOTP obligatoire, passkey en complément, inscriptions fermées, 2 comptes créés à la main |
| Supabase Auth | Projet Supabase UE | TOTP inclus ; passkeys en bêta | Si l'option Supabase est retenue |
| Hanko | Allemagne (hébergé sur AWS Francfort) | Passkeys et MFA ; gratuit à cette échelle | Alternative européenne, un fournisseur de plus |
| ~~Auth.js~~ | — | WebAuthn « expérimental, déconseillé en production » | Écarté |

### D.3 E-mail transactionnel et file d'attente

| Option | Société et données | Suivi des ouvertures et des clics | Prix pour ~500 e-mails/mois | Verdict |
|---|---|---|---|---|
| **Scaleway TEM** | France, données traitées dans l'UE | Aucun événement d'ouverture ni de clic dans les webhooks (absence de pixel à confirmer à l'essai) | 300 gratuits, puis 0,25 € les 1 000 (≈ 0,05 €) | **Recommandé** avec la base Scaleway |
| **Lettermint** | Pays-Bas | **Désactivé par défaut** | 300 gratuits ; 10 €/mois pour 10 000 | **Recommandé** sinon |
| Mailjet | Groupe Sinch ; données à Francfort et en Belgique (partiellement vérifié) | Désactivable message par message | Offre gratuite avec logo Mailjet ; 19 $/mois | Possible |
| ~~Brevo~~ | UE | **Aucun interrupteur pour couper le suivi** | — | Écarté (exigence « aucun pixel ») |
| ~~Resend~~ | Données de compte aux États-Unis | — | — | Écarté |

**File d'attente** : une table « boîte d'envoi » dans la base du coffre, écrite **dans la même transaction** que la demande ; premier envoi juste après la réponse au visiteur ; reprise par une tâche planifiée Vercel (toutes les 5 à 10 minutes, avec un délai croissant) ; alerte après N échecs. Aucun sous-traitant de plus. Écartés : Vercel Queues (bêta, sans file des messages en échec), Upstash QStash (un fournisseur de plus).

### D.4 PDF accessible
**Playwright** (déjà prévu pour les tests) : `page.pdf({ tagged: true, outline: true })` (options disponibles depuis la version 1.42) sur une page d'impression par langue (`<html lang>`, titre, h1 à h3), générée en CI puis publiée dans `public/`. Contrôle avec PAC ou veraPDF (conformité PDF/UA non garantie). Écarté : `@react-pdf/renderer` (pas de PDF balisé).

### D.5 Numéros d'urgence (sources officielles)

| Pays | Urgence générale | Urgence médicale | Source |
|---|---|---|---|
| Belgique | 112 | **112** (ambulance, pompiers) ; médecin de garde 1733 | 112.be (consulté le 15/10/2026) |
| France | 112 ; 114 (personnes sourdes ou malentendantes) | **15** (SAMU) | service-public.gouv.fr (vérifié le 25/08/2026) |
| Luxembourg | 112 | **112** | guichet.public.lu, 112.public.lu |
| Monaco | 112 ou 18 | **18 ou 112** (sapeurs-pompiers) | pompiers.gouv.mc, monservicepublic.gouv.mc |
| Suisse | 112 | **144** | ch.ch (modifiée le 23/09/2026) |

Texte proposé : « La maison n'est pas un service d'urgence. En cas d'urgence médicale, appelez le **112**, ou le **15** en France, le **144** en Suisse. » / « The house is not an emergency service. In a medical emergency, call **112**, or **15** in France, **144** in Switzerland. » `[À VALIDER]`. À revérifier avant l'ouverture.

### D.6 Préproduction protégée
- **Recommandé** : protection standard de Vercel + **liens partageables** (inclus dans Pro, révocables) : Cat ouvre la préproduction **sans compte**.
- Alternative : protection par mot de passe, **20 $/mois par projet** sur Pro.
- Vercel ajoute `X-Robots-Tag: noindex` aux préproductions **sauf si un domaine personnalisé est attribué à la branche** : dans ce cas, l'ajouter nous-mêmes.
- Repli gratuit : authentification simple dans `proxy.ts`, seulement quand `VERCEL_ENV` vaut `preview`.

### D.7 Trois combinaisons possibles

**Retenue par Sady le 15/10/2026 (D07) : combinaison 1, Scaleway.**

| | **1 · Souveraine, un fournisseur (recommandée)** | 2 · Souveraineté maximale | 3 · Simplicité maximale |
|---|---|---|---|
| Base du coffre | Scaleway Managed PostgreSQL, chiffrement au repos activé | Clever Cloud PostgreSQL dédié, chiffré, HDS possible | Supabase Pro, Paris |
| Chiffrement | Sealed box libsodium | Sealed box libsodium | Sealed box ou enveloppe |
| Authentification | Better Auth (TOTP + passkey) | Better Auth | Supabase Auth (TOTP) |
| E-mail | Scaleway TEM | Lettermint ou TEM | Lettermint ou Mailjet |
| File d'attente | Boîte d'envoi + tâche planifiée Vercel | Idem | Idem |
| Coût mensuel indicatif | ≈ 12 à 15 € | ≈ 10 à 20 € (à confirmer) | ≈ 25 $ |
| Pour | Entreprise française, un seul contrat pour la base et l'e-mail, coût faible | HDS disponible si le juriste l'exige, restauration à un instant donné | Le moins de code, auth et pooling prêts |
| Contre | Accès réseau à la base à ouvrir proprement (ou IP fixes à 100 $/mois) | Plus de démarches (base dédiée, support) | Groupe américain et singapourien |
