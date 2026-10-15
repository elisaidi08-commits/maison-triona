# Confidentialité et mesure — brouillon

> **Statut** : brouillon phase 0 (15/10/2026), rédigé par Claude pour Sady, mis à jour après la spec **confiance, contact, sécurité, lancement** (`docs/trust-contact-launch.md` : coffre chiffré, formulaire en étapes, rappel, confirmation au visiteur) et la spec **partenaires** (`docs/partners-credibility.md`). **Ce n'est pas un avis juridique.** Chaque point `[À VALIDER JURIDIQUEMENT]` doit être relu par un professionnel du droit (RGPD, ePrivacy, nLPD suisse, loi monégasque) avant la mise en ligne.
> **Sources** : PRD NFR5, `docs/ux-entry-i18n-a11y.md` §5, `docs/trust-contact-launch.md` §4 et annexe D, `docs/architecture.md` §6 et §9.
> **Principe** : la discrétion est la promesse de la maison. On collecte le moins possible, on chiffre ce qu'on garde, on ne garde rien plus longtemps que nécessaire, on ne partage rien.

**Changement de règle (15/10/2026)** : jusqu'ici, le site ne stockait aucune copie des demandes (seul l'e-mail reçu par Cat en gardait trace). Désormais, **chaque demande est enregistrée chiffrée dans un coffre hébergé dans l'UE**, et l'e-mail n'est plus qu'une **notification sans contenu**. Raison : une panne d'e-mail ne doit jamais faire perdre un contact, et une demande sensible ne doit pas dormir en clair dans une messagerie.

---

## 1. Ce que le site collecte

| Traitement | Données | Finalité | Base légale (proposée) | Où ça va | Conservation |
|---|---|---|---|---|---|
| **Demande** (formulaire en étapes) | Besoin ; « pour qui » (facultatif) ; pays ; urgence ; nom ; e-mail **ou** téléphone ; créneau ; langue ; mot libre (facultatif) ; source anonyme | Répondre à la demande | Mesures précontractuelles (art. 6.1.b) ; **consentement explicite** (art. 9.2.a) pour le cas où le mot libre révèle malgré tout une information de santé `[À VALIDER JURIDIQUEMENT]` | **Coffre** chiffré (base UE, Scaleway) ; notification **sans contenu** à Cat | Au cas par cas, plafond proposé de 12 mois après le dernier échange (§5) + fenêtre de sauvegarde |
| **Rappel à la demande** | Nom ; numéro ; langue ; créneau et jours ; « ne pas laisser de message vocal » | Rappeler la personne | Mesures précontractuelles | Coffre ; notification sans contenu | Idem |
| **Confirmation au visiteur** | Adresse e-mail saisie | Confirmer la réception et annoncer la suite | Mesures précontractuelles | Fournisseur d'e-mail (texte fixe, aucun contenu de la demande) | Journaux d'envoi du fournisseur `[À VÉRIFIER selon le fournisseur retenu]` |
| **Brouillon du formulaire** | Besoin, pays, langue, créneau | Ne pas perdre sa saisie en changeant d'étape | Strictement nécessaire à une fonction demandée | **Navigateur uniquement** (`sessionStorage`, clés `mt-draft-*`) ; effacé à l'envoi et à la fermeture de l'onglet | Session |
| **Journal d'accès au coffre** | Compte, date, action (connexion, lecture, export, suppression), identifiant de demande | Sécurité, traçabilité | Intérêt légitime (art. 6.1.f) | Base du coffre | `[À DÉFINIR]` (proposition : 12 mois) |
| **Limitation de débit** (anti-abus) | Empreinte d'IP salée (sel changé chaque jour), empreinte de l'adresse de confirmation, compteur | Sécurité des envois | Intérêt légitime (art. 6.1.f) | Upstash Redis, région UE | 24 h maximum |
| **Mesure d'audience** | Pages vues et événements **agrégés**, sans identifiant | Savoir si le site sert, quels choix d'entrée sont utilisés | Intérêt légitime ; exemption de consentement `[À VALIDER JURIDIQUEMENT]` | Plausible (UE), servi via notre domaine | Selon Plausible (agrégats) |
| **Journaux techniques** | Requêtes HTTP (chemin, date, IP selon l'hébergeur) | Fonctionnement, sécurité | Intérêt légitime | Vercel (logs d'exécution) | Rétention courte de l'offre ; **aucun export de logs** (pas de « log drain ») |
| **Préférence de langue** | Aucune donnée : la langue est dans l'URL (`/fr`, `/en`) | — | — | — | — |
| **Suggestion de langue fermée** | Un indicateur dans `sessionStorage` du navigateur | Ne pas reproposer la suggestion | Strictement nécessaire à une fonction demandée | Navigateur uniquement, effacé à la fermeture de l'onglet | Session |
| **Partenaires** (phase 2) | Nom, pays, services, statut, consentements d'affichage, dates de vérification | Gérer la relation et l'affichage autorisé | Contrat / intérêt légitime | Champs internes dans la base du coffre ; seuls les champs publics validés dans le CMS | Durée du partenariat + `[À DÉFINIR]` |

**Aucun cookie sur le site public**, aucun pixel, aucun script tiers, aucune intégration de réseau social. Le cookie de langue de next-intl (`NEXT_LOCALE`) est désactivé : l'URL suffit, le cookie n'est pas strictement nécessaire. → **Pas de bandeau cookies** `[À VALIDER JURIDIQUEMENT]` (les lignes directrices EDPB 2/2023 étendent la directive ePrivacy au-delà des cookies ; une mesure sans stockage sur l'appareil reste le cas le plus défendable). Seul l'**espace du coffre** (2 utilisateurs) pose un cookie de session strictement nécessaire, limité à `/coffre`.

### 1.1 Case de consentement (étape 4 du formulaire et rappel)
- Libellé proposé : « J'accepte que Maison Triona utilise ces informations pour répondre à ma demande, comme décrit dans la politique de confidentialité. » / « I agree that Maison Triona may use this information to respond to my request, as described in the privacy policy. » `[À VALIDER]`
- Case **non cochée par défaut**, requise, avec un lien vers la politique.
- Le traitement de la demande repose sur les mesures précontractuelles ; la case sert surtout au **consentement explicite** si le visiteur écrit malgré tout une information de santé dans le mot libre. Le juriste tranche la formulation et la base légale.

---

## 2. Données sensibles : le choix du besoin

Choisir « Accompagner un proche » peut révéler une situation de santé ou de vie privée. On le traite donc comme **sensible**.

| Règle | Mise en œuvre |
|---|---|
| Pas de champ santé | Aucun champ médical. Sous le mot libre : « Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. » |
| Chiffrement dès réception | Le serveur chiffre la demande avec la **clé publique** du coffre (sealed box) avant de l'écrire ; seul le navigateur d'une administratrice ou d'un administrateur authentifié peut la déchiffrer. Restent en clair, pour le tri : service, pays, langue, urgence, source, dates, statut |
| Rien n'est journalisé | Les fonctions ne journalisent qu'un identifiant d'événement et un statut (`stored`, `rejected:honeypot`, `rejected:rate`, `failed:vault`, `queued`, `sent`, `failed:provider`). Jamais le nom, le contact, le service, le message ni l'IP |
| Notification minimale | L'e-mail à Cat ne contient **ni nom, ni contact, ni message** : service, pays, langue, urgence, source et un lien vers le coffre `[À TRANCHER avec Cat]` |
| Confirmation neutre | L'e-mail au visiteur est un texte fixe ; il ne répète **rien** de la demande |
| Brouillon prudent | « Pour qui », l'urgence, le nom, le contact et le mot libre ne sont **jamais** gardés en brouillon, ni dans le navigateur ni sur le serveur |
| Le choix n'est jamais lié à une personne | La mesure du choix d'entrée est un **compteur agrégé** (§3). Il n'est ni stocké avec une IP, ni associé à la demande envoyée |
| Fournisseur d'e-mail | **Européen**, suivi des ouvertures et des clics désactivé. Écartés : Brevo (suivi non désactivable), Resend (données de compte aux États-Unis) |

**Point résiduel (paramètres `?service=` et `?s=`)** : le choix est transmis au formulaire par l'URL (`/fr/contact?service=grand-age`), ce qui fonctionne sans JavaScript. En contrepartie, le chemin complet peut apparaître dans les journaux de l'hébergeur, associé à une IP, pendant leur durée de rétention. Mitigations : rétention minimale, aucun export de logs, aucune mesure d'audience sur la chaîne de requête (Plausible doit enregistrer `/contact` sans paramètres : **à vérifier en story 5.2**). Alternative plus stricte : passer le choix par `sessionStorage` (mais la présélection ne marcherait plus sans JavaScript). `[À TRANCHER par Sady]`

**Source anonyme `?s=`** : liste fermée de codes (carte, salon, recommandation…), toute autre valeur ignorée ; stockée avec la demande pour savoir d'où viennent les contacts, **jamais** envoyée à l'outil de mesure avec la demande ni associée à un identifiant.

---

## 3. Ce que l'on mesure (et rien d'autre)

| Mesure | Événement | Propriétés | Ce qui n'est **pas** mesuré |
|---|---|---|---|
| Pages vues | automatique (Plausible) | chemin **sans** paramètres de requête | durée de session individuelle, parcours individuel, empreinte d'appareil |
| Choix d'entrée | `Entrée` | `choix` ∈ `conciergerie`, `grand-age`, `enfants`, `indecis` | qui a cliqué, depuis quelle IP |
| Demande envoyée | page `/contact/merci` vue | aucune | le service demandé, le pays, la langue, l'urgence, la source |
| Rappel demandé | page de confirmation du rappel vue | aucune | idem |
| Bascule de langue | `Langue` | `vers` ∈ `fr`, `en` | — |
| Partage | `Partage` | `moyen` ∈ `email`, `lien` | la page partagée avec le service, le destinataire |
| Section partenaires (phase 2) | au plus une vue agrégée | aucune | quel partenaire a été regardé |

Plausible n'utilise pas de cookie et compte les visiteurs avec une empreinte quotidienne salée, effacée au bout de 24 h, sans conserver l'IP. Le script est servi depuis notre domaine (réécriture dans `next.config`) : aucun appel vers un domaine tiers depuis le navigateur. Search Console (côté Google, sans script dans nos pages) donne des requêtes et des pages, jamais des personnes.

---

## 4. Images générées par IA : transparence

**Ce qui s'applique (vérifié le 15/10/2026, texte de l'article 50 du règlement européen sur l'IA)**
- **Art. 50(4)** : celui qui **utilise** une IA pour produire une image ou une vidéo constituant un **« deep fake »** doit indiquer que le contenu a été généré. Le « deep fake » est défini (art. 3(60)) comme un contenu « qui ressemble à des personnes, objets, lieux, entités ou événements existants et paraîtrait faussement authentique ou véridique ».
- Pour une œuvre manifestement artistique ou créative, l'obligation se limite à signaler l'existence du contenu généré, d'une manière qui ne gêne pas sa présentation.
- **Art. 50(5)** : l'information doit être donnée de façon **claire et distinguable, au plus tard lors de la première exposition**, et respecter les exigences d'accessibilité.
- **Date** : applicable depuis le **2 août 2026**. D'après des sources secondaires, le règlement « Digital Omnibus » (UE 2026/1744) n'a **pas** reporté cette obligation pour les utilisateurs ; seul le marquage technique dû par les fournisseurs (art. 50(2)) bénéficie d'un délai. Un code de bonnes pratiques sur le marquage et l'étiquetage a été publié en juin 2026.
- **Art. 50(2)** concerne Higgsfield (le fournisseur), pas nous : marquage lisible par machine (C2PA). Les conditions d'utilisation de Higgsfield interdisent par ailleurs de **retirer** ce marquage.

**Ce que cela implique pour le site** `[À CONFIRMER avec Cat, À VALIDER JURIDIQUEMENT]`
- Nos images sont photoréalistes et montrent des lieux, des objets et des mains qui ressemblent à des choses existantes : la qualification de « deep fake » est **plausible**, surtout pour un site commercial où un visiteur pourrait croire voir de vrais lieux ou de vrais clients.
- Une mention **seulement** dans les mentions légales ne satisfait probablement pas l'exigence d'information « au plus tard lors de la première exposition ».
- **Option recommandée** : une ligne discrète et permanente en pied de page, sur chaque page (« Images créées avec l'aide de l'intelligence artificielle. » / « Images created with the help of artificial intelligence. »), détaillée dans les mentions légales. Coût visuel faible, conformité défendable.
- Le réencodage web (ffmpeg) **supprime** les métadonnées C2PA : conserver les originaux marqués, et faire trancher par le conseil si cela pose problème.
- Hors UE : la Suisse et Monaco ne sont pas soumis au règlement IA, mais le droit de la concurrence déloyale (publicité trompeuse) s'applique partout. La mention en pied de page couvre aussi ce risque.

---

## 5. Conservation, suppression, sauvegardes

| Sujet | Proposition |
|---|---|
| Durée de conservation des demandes | **Au cas par cas** (décision du 15/10/2026, `docs/decisions.md` D05). La politique doit malgré tout annoncer une **durée ou des critères** (RGPD, art. 13) : la demande est gardée le temps de l'échange ; sans suite, elle est supprimée **au plus tard 12 mois** après le dernier échange (plafond automatique, tâche planifiée quotidienne) ; Cat peut la supprimer plus tôt. Plafond `[À VALIDER JURIDIQUEMENT]` |
| Demande devenue mission | Les échanges suivants sortent du site (contrat direct entre le client et la société choisie) ; la demande du coffre suit la même durée |
| Suppression à la demande | Depuis le coffre, par une personne authentifiée, journalisée ; réponse à la personne sous un mois (délai légal RGPD) |
| Sauvegardes | Aucun fournisseur ne documente la purge d'une ligne dans ses sauvegardes. Une demande supprimée **subsiste jusqu'à la fin de la fenêtre de sauvegarde** : **7 jours** pour les options proposées (Scaleway, Clever Cloud, Supabase Pro). La politique de confidentialité le dit en clair. Les sauvegardes contiennent des données **déjà chiffrées** (sealed box) |
| Restauration | Après une restauration, les suppressions intervenues depuis la sauvegarde sont **rejouées** à partir du journal (procédure écrite en E3-S8) |
| Perte de la clé privée | Les demandes deviennent illisibles. Copie de secours hors ligne chez Cat et Sady ; procédure écrite |

---

## 6. Droits des personnes

Accès, rectification, effacement, opposition, limitation, portabilité ; réclamation auprès de l'autorité de contrôle compétente (APD en Belgique, CNIL en France, CNPD au Luxembourg, PFPDT en Suisse, APDP à Monaco). Contact : `[CONTENU À FOURNIR PAR CAT]` (adresse dédiée, par exemple sur le domaine du site). Les demandes d'exercice des droits se traitent depuis le coffre (lecture, export, suppression), toujours journalisées.

## 7. Sous-traitants envisagés

Chaque sous-traitant signe un **contrat de traitement (DPA)** avant la mise en ligne. Options et sources : `docs/trust-contact-launch.md` annexe D.

| Sous-traitant | Rôle | Localisation | Garanties | Statut |
|---|---|---|---|---|
| Vercel | Hébergement, fonctions (région `cdg1`, Paris), tâches planifiées | Entreprise américaine ; fonctions en UE | DPA, clauses de transfert `[À VÉRIFIER]` | Proposé |
| Base du coffre : **Scaleway** (reco), Clever Cloud ou Supabase | Stockage chiffré des demandes, journal d'accès, boîte d'envoi | UE (France) ; Supabase : société singapourienne, groupe américain, données à Paris | DPA publié ; ISO 27001 ; HDS sous contrat chez Clever Cloud (et Scaleway hors base gérée) | `[À TRANCHER]` |
| Fournisseur d'e-mail : **Scaleway TEM** (reco) ou Lettermint | Notification à Cat, confirmation au visiteur, alertes | UE (France / Pays-Bas) | DPA ; suivi désactivé | `[À TRANCHER]` |
| Upstash | Limitation de débit | Région UE | DPA | Proposé |
| Plausible | Mesure d'audience | UE | DPA, sans cookie | Proposé |
| CMS (Sanity, recommandé) | Textes publics uniquement, **aucune donnée personnelle**, aucun champ interne des partenaires | Backend UE (Belgique) | DPA | Proposé |

## 8. Risques résiduels (à écrire honnêtement dans la politique)

1. **Vercel voit la demande en clair** dans la fonction, le temps de la chiffrer. Chiffrer dans le navigateur du visiteur l'éviterait mais casserait « tout fonctionne sans JavaScript ». Mitigations : aucune journalisation du corps, région UE, DPA. Une base UE réduit l'exposition au droit américain (CLOUD Act) sans la supprimer, puisque l'hébergeur reste américain.
2. **Fenêtre de sauvegarde** de 7 jours après une suppression (§5).
3. **Hébergement de données de santé (HDS, France)** : même sans champ santé, une demande « grand âge » peut en révéler. Question **pour le juriste** : l'hébergement HDS s'applique-t-il à une conciergerie ? Si oui, option Clever Cloud (HDS sous contrat).
4. **Adresse de confirmation saisie par un inconnu** : risque d'envoi à un tiers. Mitigations : texte fixe sans contenu, limite par adresse et par IP, honeypot.

## 9. Points à valider avant la mise en ligne

1. Base légale de la demande et du rappel ; formulation de la case de consentement (§1.1).
2. Plafond de conservation des demandes (« au cas par cas » dans un plafond écrit) et durée du journal d'accès.
3. ~~Contenu de la notification à Cat~~ : tranché, très minimaliste (D06).
4. Absence de bandeau cookies avec la mesure retenue.
5. Paramètres `?service=` et `?s=` dans les journaux de l'hébergeur (§2).
6. Question HDS (§8).
7. Mention IA : formulation et emplacement (§4).
8. Garde-malade et promesses médicales : aucune tant que le périmètre n'est pas confirmé (`docs/ux-entry-i18n-a11y.md` §2.6) ; vocabulaire réglementé (`docs/seo-strategy.md` §K).
9. Politique de confidentialité et mentions légales en FR et en EN, avec des données légales réelles et la liste des sous-traitants retenus.
10. Partenaires (phase 2) : droit d'usage des noms et logos, information sur la rémunération (`docs/partners-credibility.md` §4).
