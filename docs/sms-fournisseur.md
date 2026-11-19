# Fournisseur SMS · proposition à trancher

> **Statut** : **décidé le 19/11/2026 (D71)** : seven, expéditeur « Triona », SMS sans lien. Story **3.12** (D57). Rien n'est encore ouvert ni signé : le compte et le DPA se font au nom de la société, après son inscription (D38).
> **Méthode** : sites officiels des fournisseurs (conditions, DPA, listes de sous-traitants, grilles de prix, documentation de l'API), directives des opérateurs et de l'af2m, guides par pays des agrégateurs ; **tout lu le 19/11/2026**, sources au §8. Ce qui n'a pas pu être lu sur une source officielle est noté « non vérifié ».
> **Documents mis à jour avec D71** : `docs/decisions.md`, `docs/reservation-appel.md` §4.5, §7, §9 et §10, `docs/rgpd/sous-traitants.md`, `docs/privacy.md` (§1 et sous-traitants), `docs/rgpd/registre-des-traitements.md` (T2, T8), `docs/rgpd/analyse-impact.md`, `docs/email-deliverability.md` §1, `docs/architecture.md` §6.6, `docs/plan-implementation.md` (3.12), `docs/launch-checklist.md` §3, `CLAUDE.md`.

---

## 1. En bref

1. **Retenu : seven** (Kiel, Allemagne, D71). **En second : GatewayAPI, plateforme `.eu`** (Odense, Danemark), si les réponses de seven aux questions du §9 ne conviennent pas. Ce sont les deux seuls dont les serveurs, le DPA et la conservation tiennent nos exigences sans réserve majeure (§4).
2. **En Belgique, aucun nom d'expéditeur n'est possible**, quel que soit le fournisseur. Les directives des opérateurs belges l'interdisent, et les SMS partent d'un **numéro court** (8xxx). Le texte doit donc dire qui écrit (§3).
3. **« Maison Triona » ne peut pas servir d'expéditeur** : il compte 13 caractères, pour 11 au plus, en lettres et chiffres et sans espace. **« Triona » est retenu** (D71), à présenter à Cat.
4. **Aucun lien dans les SMS** (D71). Le fournisseur garde le texte dans ses journaux, si bien qu'un lien de gestion y resterait comme une clé valable. Le lien est déjà dans l'e-mail (§6.2).
5. **Le coût ne départage pas** : moins de 15 € HT par mois au plafond de 4 appels par jour, même si chaque personne coche le SMS.
6. **Calendrier** : le compte et le DPA se font **au nom de la société**, après son inscription (janvier 2027, D38). L'expéditeur français s'enregistre ensuite, avec un délai annoncé de quelques jours à 8 semaines. D'ici là, la 3.12 se code avec un faux adaptateur, comme `lib/email`.

---

## 2. Ce que le SMS doit faire (rappel de la spec)

- **Option** cochée par la personne (« Me prévenir aussi par SMS », non cochée par défaut) : confirmation de l'appel, puis rappel **deux heures avant**. En option, un SMS à Cat pour chaque nouvel appel (3.13).
- **Volume** : au plafond de 4 appels par jour sur environ 21 jours ouvrés, 84 appels au plus par mois, soit **170 SMS au plus** si tout le monde coche la case. En pratique, bien moins.
- **Destinations** : Belgique, France, Luxembourg, Monaco, Suisse.
- **Contraintes déjà écrites** :
  - 160 caractères au plus, dans l'alphabet GSM-7 ;
  - aucun service nommé (le SMS s'affiche sur l'écran verrouillé) ;
  - la boîte d'envoi programme les messages (`send_at`), ce qui rend inutile l'envoi programmé du fournisseur ;
  - le numéro vient de `contact_kms`, effacé après le dernier message ;
  - un SMS en échec n'empêche pas l'e-mail (`docs/reservation-appel.md` §4.5).

---

## 3. Expéditeur par pays

| Pays | Nom d'expéditeur | Enregistrement | Restrictions | Confiance |
|---|---|---|---|---|
| **Belgique** | **Impossible** : remplacé par un numéro court (8xxx) | Sans objet | Consentement préalable ; la personne doit pouvoir répondre **STOP**, gratuitement, à chaque message (directives des opérateurs §4.4 et §4.5) | **Moyenne** : directives de 2023 et quatre sources concordantes (CM.com, LINK, Bird, GatewayAPI). Twilio dit le contraire. |
| **France** | Possible | **En pratique, exigé par les fournisseurs** (charte af2m depuis le 01/03/2026). Le nom doit désigner la marque, les noms génériques sont refusés. Pièces de la société demandées. | Messages transactionnels **exemptés** des plages horaires (8 h-21 h 30), du dimanche et des jours fériés ; liens raccourcis filtrés ; certains fournisseurs ajoutent « STOP » d'office | Moyenne à haute |
| **Luxembourg** | Possible | Non | Aucune trouvée | Faible (guides d'agrégateurs seulement) |
| **Monaco** | **Contradictoire** : possible selon Twilio, Telnyx, LINK et GatewayAPI ; « filtré » selon le PDF de seven (février 2023) | Non, sauf « approbation préalable » chez GatewayAPI, sans précision | Noms génériques interdits | **Faible : à tester** |
| **Suisse** | Possible | Non | Aucune trouvée | Faible à moyenne |

**Partout, on ne peut pas répondre à un nom d'expéditeur.** Pour déplacer ou annuler, la personne passe par le lien de l'e-mail.

---

## 4. Comparatif

Prix en euros HT par SMS d'un segment. « Non vérifié » : absent des sources officielles lues.

| | **seven** | **GatewayAPI `.eu`** | Sweego | smsmode | CM.com | OVHcloud |
|---|---|---|---|---|---|---|
| **Société** | seven communications GmbH & Co. KG, Kiel (DE) ; parent hors UE : non trouvé | ONLINECITY.IO ApS, Odense (DK), filiale à 100 % d'un groupe danois | Mindbaz SAS, Lille (FR) | Calade Technologies SARL, Marseille (FR) | CM.com N.V., Breda (NL), cotée | OVH SAS, Roubaix (FR) |
| **Hébergement** | « Exclusivement en Allemagne » (Hetzner) | Hetzner (Allemagne, Finlande). **La version `.com` tourne chez Google LLC** | France ; **SMS acheminés par CM.com** (Pays-Bas) | Marseille et Scaleway Paris | EEE, **plus Cloudflare (États-Unis)** sur le point d'accès conseillé | France, mais le groupe (Canada, Royaume-Uni) figure parmi les sous-traitants de « tous les services » |
| **Sous-traitants publiés** | Oui, mais pas les opérateurs d'acheminement ; fournisseur HLR (vérification des numéros) « sur demande » | Oui (annexe B du DPA `.eu`) ; opérateurs non listés | Oui (15/07/2026) | **Sur demande seulement** ; transferts hors UE possibles par eux | Oui (07/05/2026) | Oui (16/10/2025) ; agrégateurs SMS non nommés |
| **DPA** | Signé en ligne dans le compte ; versions 2.1 et 2.3 citées | Accepté dans le compte (en vigueur depuis le 05/08/2026) ; le silence vaut accord pour un nouveau sous-traitant | Accepté à l'inscription ; vague (clause tronquée) | Annexe des conditions | Annexe des conditions | Annexe acceptée à la commande |
| **Conservation du texte et du numéro** | **Réglable jusqu'à « immédiatement »** (valeur par défaut non indiquée) ; les conditions gardent 60 jours de journaux de trafic (expéditeur, destinataire, heure) | **30 jours puis anonymisés** ; sauvegardes 3 mois | **7 à 90 jours selon l'offre, texte complet, sans suppression possible** | Non vérifié | Non vérifié | Non vérifié |
| **Suivi des liens** | Désactivé (seulement si l'on passe `performance_tracking`) | Aucun ; liens raccourcis refusés, domaines en liste blanche | **Raccourcissement activé par défaut** | Option | Non vérifié | Aucun documenté |
| **Double authentification du compte** | **Application TOTP, qu'on peut imposer** | Code par e-mail ou SMS ; contournée par la connexion Google | Non trouvée | Non vérifié | Non vérifié | Non vérifié |
| **Webhooks de livraison** | Signés (signature, horodatage, nonce) | Signés (HMAC-SHA-256) | Signés ; événement « delivered » absent de la doc | Oui | Non vérifié | Oui |
| **BE · FR · LU · MC · CH** | 0,075 partout | 0,070 · 0,043 · 0,092 · 0,105 · 0,077 | 0,072 · 0,040 · 0,084 · **0,190** · 0,068 | 0,085 · 0,061 · 0,098 · 0,165 · 0,092 | Non vérifié | 0,081 · 0,060 · 0,102 · **absent** · 0,060 |
| **Minimum, frais** | Recharge dès 1 € ; **10 % de la dernière recharge par mois après 6 mois sans envoi** | 150 € par virement (par carte : non trouvé) ; crédit de moins de 100 € non remboursé | Pack de 20 € valable 12 mois | Pack de 61 € ou 9 € par mois | Sans frais mensuels | Pack de 6 € |
| **Essai** | Bac à sable sans envoi réel ; 0,50 € de crédit | 30 jours, SMS préfixés « THIS IS A TEST SMS: » | Aucun bac à sable | Non vérifié | Non vérifié | Non vérifié |
| **Verdict** | **Retenu (D71)** | **En second** | Écarté | En réserve | Écarté | **Écarté** |

**Écartés d'emblée** :
- **Scaleway** : aucune offre SMS.
- **Spryng** et **SMSFactor** : maison mère britannique (Commify UK).
- **Brevo** : hébergé chez Google Cloud, SMS acheminés par des sociétés américaines (Vonage, Twilio).

**Raisons des autres verdicts** :
- **Sweego** : il garde le texte complet sans suppression possible, raccourcit les liens par défaut, n'a pas de double authentification trouvée, et ses SMS passent de toute façon par CM.com.
- **CM.com** : passe par Cloudflare (États-Unis), sauf point d'accès obtenu sur demande, et ajoute « STOP 36047 » d'office en France.
- **OVHcloud** : **Monaco est absent**, alors que c'est l'un de nos cinq pays.
- **smsmode** (en réserve) : bon hébergement, mais ses sous-traitants ne sont communiqués que sur demande.

---

## 5. Recommandation

### 5.1 seven, pour cinq raisons

1. **Données en Allemagne seulement**, sans parent hors UE trouvé.
2. **Journal réglable jusqu'à l'effacement immédiat** : c'est le seul fournisseur qui permet de ne garder ni le texte ni le numéro.
3. **Double authentification par application, qu'on peut imposer**, au niveau du coffre.
4. **Aucun suivi des liens** sans le demander, et **webhooks signés** avec horodatage et nonce (protégés contre le rejeu).
5. **Bac à sable sans envoi réel**, et un prix unique de 0,075 € qui simplifie le budget.

**Ses réserves, à lever par écrit avant de signer** (§5.3) :
- les 60 jours de journaux de trafic prévus par ses conditions ;
- les opérateurs qui acheminent les SMS et le fournisseur HLR, absents de la liste ;
- les deux numéros de version du DPA ;
- **les frais d'inactivité**. Parade : ouvrir le compte et recharger peu (10 à 20 €) près de l'ouverture, pas avant.

### 5.2 GatewayAPI `.eu`, en second

Son principal atout : **anonymisation fixe à 30 jours**, sans réglage à oublier. En revanche :
- double authentification plus faible (code par e-mail ou SMS) ;
- **150 € au minimum par virement** ;
- l'option « Secret » (rien de stocké) n'est couverte par aucun DPA, d'après son propre blog.

**Attention** : il faut bien la plateforme `.eu`. Le même service en `.com` tourne chez Google.

### 5.3 Questions à poser par écrit au fournisseur retenu

1. Le réglage d'effacement immédiat du journal efface-t-il aussi le texte, le numéro et les journaux de trafic des conditions (60 jours chez seven) ? Quelle est sa valeur par défaut ?
2. Quels opérateurs et agrégateurs acheminent les SMS vers chacun des cinq pays ? Qui fait la vérification des numéros (HLR) ? Un message transite-t-il hors UE ?
3. **Belgique** : quel numéro court est utilisé ? Le STOP gratuit est-il géré, et nous est-il signalé (webhook) ?
4. **Monaco** : le nom d'expéditeur est-il livré ou remplacé ?
5. **France** : quelles pièces faut-il pour enregistrer l'expéditeur, et avec quel délai ? « STOP » est-il ajouté aux messages transactionnels ?
6. Peut-on ouvrir un compte de test, ou utiliser le bac à sable, avant l'inscription de la société ?
7. Quelle est la version du DPA en vigueur ?

L'e-mail prêt à envoyer à seven est au §9. Il ajoute deux questions : les sauvegardes, et les frais d'inactivité avant l'ouverture.

---

## 6. Conséquences pour la story 3.12

### 6.1 Expéditeur

- **Nom** : 11 caractères au plus, lettres et chiffres, sans espace (charte af2m) ; **« Triona »** (6 caractères), retenu par Sady (D71), à présenter à Cat.
- **Discrétion** : le nom s'affiche sur l'écran verrouillé, ce qui est déjà identifié comme risque dans `docs/rgpd/analyse-impact.md`. En Belgique, seul un numéro s'affiche.
- **Le texte commence par « Maison Triona »**. Sans cela, une personne en Belgique recevrait un SMS d'un numéro inconnu sans savoir qui lui écrit.

### 6.2 Aucun lien dans le SMS (D71)

**Pourquoi** :
- le texte reste dans les journaux du fournisseur (jusqu'à 30 jours chez GatewayAPI, 90 jours chez Sweego) : un lien de gestion y serait une clé valable pour l'appel ;
- en France, les liens sont filtrés ;
- chez GatewayAPI, chaque domaine doit être en liste blanche ;
- le lien prend à lui seul 91 caractères sur 160.

**Ce que ça change** : la ligne « SMS » de `docs/email-deliverability.md` §1 dit désormais « jour, heure, renvoi à l'e-mail ». Le SMS renvoie à l'e-mail pour déplacer ou annuler.

### 6.3 Textes : rester dans l'alphabet GSM-7

Un seul caractère hors GSM-7 fait passer **tout le message** en Unicode, et la limite tombe alors de 160 à 70 caractères.

**Caractères à exclure** : `â ê î ô û ç œ`, les guillemets `« »`, l'apostrophe typographique `’`, les espaces insécables, et `€` (qui compte double).

**Pièges** :
- « août » contient un û : **écrire les dates en chiffres** (« 24/11 ») ;
- une apostrophe copiée depuis `messages/*.json` peut être typographique.

**Garder 145 caractères au plus**, au cas où un fournisseur ajouterait « STOP » en France. Le test unitaire de la 3.12 vérifie chaque gabarit dans le pire cas : « mercredi » ou « Wednesday », et une heure à deux chiffres.

**Textes** relus par `i18n-copy-editor` le 19/11/2026, en brouillon jusqu'à la validation de Cat. Ils vivent dans `messages/*.json` (`Sms.*`), qui font foi. Les longueurs sont calculées au pire cas par `src/lib/sms` (table GSM 03.38, 3GPP TS 23.038) :

| Message | Texte | Longueur |
|---|---|---|
| Confirmation FR | Maison Triona : votre appel est convenu pour le mercredi 25/11 à 16 h 30. Pour le déplacer ou l'annuler, suivez le lien de notre e-mail. | 136 |
| Rappel FR | Maison Triona : comme convenu, nous vous appelons aujourd'hui à 16 h 30. Pour déplacer ou annuler l'appel, suivez le lien de notre e-mail. | 138 |
| Confirmation EN | Maison Triona: your call is arranged for Wednesday 25/11 at 16:30. To rearrange or cancel, please use the link in our email. | 124 |
| Rappel EN | Maison Triona: as arranged, we will call you today at 16:30. To rearrange or cancel, please use the link in our email. | 118 |
| À Cat (3.13) | Nouvel appel mercredi 25/11 à 16 h 30. | 38 |

### 6.4 STOP, retours, réglages

- **STOP** : en Belgique, la personne peut répondre STOP au numéro court. Si le fournisseur nous le signale, la réservation passe `sms_opt_in = false` et le rappel programmé est abandonné. S'il ne le signale pas, il faut le noter comme risque résiduel `[À VÉRIFIER auprès du fournisseur]`.
- **Retours de livraison** : un webhook signé, ou une interrogation du statut comme pour TEM (D69). À choisir en 3.12 ; aucune donnée du SMS dans nos journaux, dans les deux cas.
- **Réglages du compte à poser à l'ouverture** :
  - journal effacé immédiatement ;
  - aucun suivi des liens ;
  - double authentification imposée ;
  - clé d'API dédiée au site, dans les variables de Vercel ;
  - petites recharges.

### 6.5 Transferts hors UE

- **Suisse** : décision d'adéquation de l'UE, rien à ajouter.
- **Monaco** : n'apparaît pas sur la liste des décisions d'adéquation de la Commission (à revérifier à la signature). Livrer un SMS à un numéro monégasque passe par Monaco Telecom. La base proposée est l'article 49.1.b du RGPD (mesures précontractuelles prises à la demande de la personne). `[À VALIDER par le juriste]`

---

## 7. Ce qui reste à trancher

| Point | Qui | Quand |
|---|---|---|
| ~~Fournisseur~~ : seven (D71) | Sady | Fait le 19/11/2026 |
| ~~Nom d'expéditeur~~ : « Triona » (D71), à présenter à Cat | Sady, puis Cat | Avant l'enregistrement de l'expéditeur en France |
| ~~SMS sans lien~~ (D71) | Sady | Fait le 19/11/2026 |
| Textes des SMS | Cat (après `i18n-copy-editor`) | Avant l'ouverture |
| Questions du §5.3 (e-mail rédigé au §9) | Sady (envoi) | Avant la signature |
| Base légale des SMS, consentement, transfert vers Monaco | Juriste | Avant l'ouverture |
| Compte, DPA, enregistrement de l'expéditeur en France, tests de réception dans les cinq pays | Sady, au nom de la société | Après l'inscription de la société (janvier 2027), avant l'ouverture |

---

## 8. Sources (toutes lues le 19/11/2026)

**Règles par pays**
- af2m, charte 2026 : https://af2m.org/charte-business-messaging-2026-laf2m-renforce-les-regles-du-jeu/ (13/02/2026) ; noms protégés : https://af2m.org/protection-des-oadc-sensibles/
- Arcep, plan de numérotation : https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/plan-de-numerotation-021225.html (02/12/2025)
- Directives des opérateurs belges (Base, juillet 2023) : https://www.base.be/content/dam/www-base-be/en/legals/third-party-services/Directives%20MNO%20Services%20messagerie%20FINAL.pdf
- OFCOM, règles anti-usurpation (appels seulement) : https://www.bakom.admin.ch/dam/fr/sd-web/57JB2x-o50r1/Swiss%20Anti-Spoofing%20Rules%20-%20V2.0%20%20-%20FINAL.pdf
- Guides par pays : LINK Mobility https://docs.linkmobility.com/regulatory-guidelines/sender-id/ (pages France, Belgium, Luxembourg, Monaco, Switzerland, 30/04 ou 11/05/2026) · LINK, France : https://www.linkmobility.com/fr/news/nouvelle-reglementation-sur-les-expediteurs-sms-en-france (01/02/2026) · Twilio https://www.twilio.com/en-us/guidelines/fr/sms (et `be`, `lu`, `mc`, `ch`) · Telnyx https://support.telnyx.com/en/articles/6531603-france-sms-guidelines · Bird https://bird.com/sms-api/features/destinations/belgium et `/switzerland` · CM.com https://knowledgecenter.cm.com/knowledge-center/communications-platform/sms/is-it-possible-to-use-a-custom-sender-name-sender-
- Réponses impossibles vers un nom d'expéditeur : https://help.twilio.com/articles/223181348-Alphanumeric-Sender-ID-for-Twilio-Programmable-SMS

**seven**
- Mentions légales : https://www.seven.io/en/company/imprint/
- RGPD : https://www.seven.io/en/company/gdpr/
- Sous-traitants : https://www.seven.io/en/annex-subcontractors/
- DPA : https://help.seven.io/en/legal/data-processing-agreement
- Journal : https://help.seven.io/en/account/managing-the-journal
- Conditions : https://www.seven.io/en/company/terms/
- Expéditeur : https://help.seven.io/en/sms/set-sender-id · https://help.seven.io/en/sms/sender-id-pre-registration · https://www.seven.io/wp-content/uploads/International-sms-regulations-1.pdf (février 2023)
- Prix : https://www.seven.io/en/full-sms-pricelist/
- API : https://docs.seven.io/en/rest-api/authentication · https://docs.seven.io/en/rest-api/webhooks · https://docs.seven.io/en/rest-api/endpoints/sms
- Bac à sable : https://help.seven.io/en/account/use-test-environment-aka-sandbox
- Double authentification : https://help.seven.io/en/account/two-factor-authentication-2fa

**GatewayAPI**
- Documents légaux (conditions, DPA `.com` et `.eu`) : https://onlinecity.io/legal-documents/gatewayapi
- Plateforme `.eu` : https://gatewayapi.com/eu-setup/
- Restrictions par pays : https://gatewayapi.com/i/country-restrictions/FR (et `BE`, `LU`, `MC`, `CH`)
- Prix : https://gatewayapi.com/api/prices/list/sms/csv
- API : https://gatewayapi.com/docs/message/overview/
- Liste blanche des liens : https://gatewayapi.com/help-center/url-whitelisting/
- Double authentification : https://gatewayapi.com/help-center/ocid-and-two-factor-authentication-2fa/

**Sweego**
- Mentions légales : https://www.sweego.io/legal-notice
- Sous-traitants : https://www.sweego.io/list-of-subsequent-subcontractors
- DPA : https://www.sweego.io/data-privacy-agreement-dpa
- Journaux : https://learn.sweego.io/docs/sweego/log-logs-swg-uid-get
- Expéditeur : https://learn.sweego.io/docs/sms/what_is_a_senderid
- Prix : https://www.sweego.io/worldwide-sms-pricing
- Raccourcissement des liens : https://learn.sweego.io/docs/sending/how_to_send_sms_by_api

**Autres fournisseurs**
- smsmode : https://www.smsmode.com/tarifs-sms/ · https://www.smsmode.com/conditions-generales-dutilisation/
- CM.com : https://www.cm.com/cdn/web/en/file/subprocessors-2026-10-v2.pdf
- OVHcloud : https://www.ovhcloud.com/fr/sms/prices/ · https://contract.eu.ovhapis.com/1.0/pdf/OVH_Sub_processors-fr.pdf
- Spryng : https://www.spryng.nl/en/about-us/
- SMSFactor : https://www.smsfactor.com/mentions-legales
- Brevo : https://www.brevo.com/legal/termsofuse/
- Scaleway (aucun produit SMS dans la documentation) : https://github.com/scaleway/docs-content

---

## 9. E-mail à seven, prêt à envoyer

**Avant l'envoi** :
- L'envoyer depuis l'adresse de la maison, si elle existe déjà.
- **Ne rien y ajouter sur les services** ni sur la clientèle : le fournisseur n'a besoin que de l'usage (rendez-vous, rappel) et du volume.
- Formulaire de contact ou adresse du support : à prendre sur https://www.seven.io/en/company/imprint/ au moment de l'envoi.
- En anglais : le support de seven répond en allemand et en anglais.
- Les réponses se notent au §5.3, avec leur date.

**Variante GatewayAPI `.eu`** : remplacer les questions suivantes.
- **1 et 2** : les 30 jours avant anonymisation comprennent-ils les sauvegardes, gardées 3 mois selon les conditions (art. 13.1) ? L'option « Secret » est-elle couverte par le DPA `.eu` ?
- **6** : que recouvre la mention « Pre-approval required » pour Monaco ?
- **10** : y a-t-il des frais ou une expiration du crédit, et peut-on recharger moins de 150 € par carte ?
- **Ajouter** : la double authentification peut-elle se faire par application (TOTP), et la connexion par Google peut-elle être désactivée sur le compte ?

```text
Subject: Pre-sales questions: transactional SMS, data retention and sender IDs (BE, FR, LU, MC, CH)

Hello,

We are a small company being set up in Belgium (registration expected in
January 2027). We plan to use seven for transactional SMS only: the
confirmation of a phone appointment and a reminder two hours before it,
sent only when the recipient has asked for them. Expected volume: under
200 SMS per month, to Belgium, France, Luxembourg, Monaco and Switzerland.

Before opening an account and signing your DPA, we would be grateful for
written answers to the questions below.

Data retention
1. If "Automatic Journal Deletion" is set to "Immediately", what exactly
   is deleted (message text, recipient number, sender, delivery status)?
   Does it also cover the traffic data in section 8 of your terms
   (sender, recipient, time, available for 60 days)? What is the default
   value of this setting on a new account?
2. Are message texts or recipient numbers kept anywhere else, such as
   backups, application logs or routing partners? If so, for how long?

Sub-processors and routing
3. Which carriers or aggregators route SMS to each of the five countries
   above? Is any message stored or processed outside the EU/EEA, apart
   from delivery to the destination network?
4. Who is the HLR provider that your sub-processor annex names "on
   request"? Is an HLR lookup made for every message, or only when we
   ask for one?

Sender IDs
5. Belgium: we understand that alphanumeric sender IDs are replaced by a
   short code. Which short code is used? Is a free STOP reply handled,
   and is it reported to us (webhook or API)?
6. Monaco: your international regulations PDF (February 2023) says that
   alphanumeric IDs are filtered. Is this still the case? If so, which
   sender do recipients see?
7. France: which documents are required to register an alphanumeric
   sender ID for transactional traffic, and what is the usual delay? Is
   a STOP mention added to transactional messages?

Account and contract
8. Can we open an account and use the sandbox before the company is
   registered, and then put the account and the DPA in the company's
   name once it is registered?
9. Which version of the DPA is current? Your GDPR page mentions version
   2.3 and your changelog of 12 May 2026 mentions version 2.1.
10. Does the inactivity fee in section 4 of your terms apply to an
    account that has not sent any SMS yet, between its opening and our
    launch?

Thank you in advance for your answers.

Kind regards,
[Name]
```
