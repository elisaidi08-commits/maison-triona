# Procédures RGPD

> **Statut** : brouillon du 06/11/2026, à valider par Cat et son juriste. À tester une fois avant l'ouverture (demande fictive, violation à blanc).

## 1. Répondre à une personne qui exerce ses droits (articles 12 à 22)

### 1.1 Recevoir

- Une demande peut arriver **par n'importe quel canal** : `confidentialite@…`, `contact@…`, courrier, téléphone. Toutes comptent.
- Noter la date de réception dans le registre (§3.1) : **le délai court à partir de ce jour**.
- Répondre gratuitement.

### 1.2 Vérifier l'identité, sans en demander trop

- Si la demande vient de l'adresse e-mail ou du numéro donnés dans la demande d'origine : c'est suffisant.
- Sinon : demander une information que seule la personne connaît (date approximative de sa demande, service choisi). Une copie de pièce d'identité seulement en cas de doute sérieux, et l'effacer aussitôt après la vérification.
- **Demande faite pour un proche** : le parent peut exercer ses droits sur les données qui le concernent ; le proche qui a écrit, sur les siennes. En cas de doute, demander l'avis du juriste (J2).

### 1.3 Répondre dans le mois

- **Un mois** à compter de la réception. Prolongation possible de deux mois si la demande est complexe ou si les demandes sont nombreuses, à condition de **prévenir la personne dans le premier mois** en disant pourquoi (article 12.3).

| Droit | Ce que fait la maison |
|---|---|
| **Accès** (15) | Exporter depuis le coffre ce qui concerne la personne (demande, appel, notes) ; rassembler les e-mails de la messagerie ; envoyer une copie lisible avec les informations de l'article 15 : finalités, données, destinataires, durée, droits, source. |
| **Rectification** (16) | Corriger dans le coffre ; confirmer à la personne. |
| **Effacement** (17) | Effacer dans le coffre (action journalisée), dans la messagerie et dans les notes ; prévenir que la copie subsiste 7 jours dans les sauvegardes, chiffrée. Si des données ont été transmises à un professionnel, **le prévenir** (article 19) et dire à la personne qu'il est responsable de ses propres données. Exception : ce que la maison doit garder pour une obligation légale (comptabilité). |
| **Limitation** (18) | Marquer la demande comme « gelée » dans le coffre `[À PRÉVOIR dans le coffre]` ; ne plus l'utiliser sauf pour la conserver. |
| **Opposition** (21) | Pour les traitements fondés sur l'intérêt légitime (sécurité, mesure d'audience) : la mesure ne permet pas d'identifier quelqu'un ; expliquer simplement ce qui est gardé et pendant combien de temps. |
| **Portabilité** (20) | Export structuré (JSON ou CSV) de ce que la personne a fourni elle-même `[À PRÉVOIR dans le coffre]`. |
| **Retrait du consentement** (7.3) | Cesser d'utiliser les informations de santé concernées et les effacer, sans remettre en cause ce qui a été fait avant. |

### 1.4 Refuser, si c'est justifié

Une demande manifestement infondée ou excessive peut être refusée (article 12.5). Toujours motiver le refus par écrit et rappeler que la personne peut saisir l'**APD** (ou l'autorité de son pays) et un tribunal.

### 1.5 Modèles de réponse (à adapter)

**Accusé de réception (FR)**
> Madame, Monsieur,
> Nous avons bien reçu votre demande du [date] concernant vos informations. Nous vous répondons au plus tard le [date + 1 mois].
> Avec nos sentiments les meilleurs,
> Maison Triona

**Acknowledgement (EN)**
> Dear [name],
> We have received your request of [date] regarding your information. We will reply no later than [date + 1 month].
> With kind regards,
> Maison Triona

**Effacement effectué (FR)**
> Madame, Monsieur,
> Les informations que vous nous aviez confiées ont été effacées le [date]. Une copie chiffrée peut subsister jusqu'à 7 jours dans nos sauvegardes, avant de disparaître à son tour. [Si transmission : Nous avons prévenu [le professionnel] ; il reste responsable des informations que vous lui avez confiées directement.]
> Avec nos sentiments les meilleurs,
> Maison Triona

**Erasure completed (EN)**
> Dear [name],
> The information you entrusted to us was erased on [date]. An encrypted copy may remain in our backups for up to 7 days before it disappears in turn. [If passed on: We have informed [the professional]; they remain responsible for the information you gave them directly.]
> With kind regards,
> Maison Triona

## 2. Réagir à une violation de données (articles 33 et 34)

Une violation, c'est tout incident qui entraîne la **destruction, la perte, la modification, la divulgation ou l'accès non autorisé** à des données personnelles : compte du coffre compromis, ordinateur ou téléphone de Cat perdu, e-mail envoyé à la mauvaise personne, faille chez un sous-traitant, clé du coffre perdue.

| Étape | Quand | Qui | Quoi |
|---|---|---|---|
| 1. Prévenir | **Dans l'heure** (D47) | Celui qui découvre | Prévenir Cat et Sady en même temps, par téléphone, puis par écrit. |
| 2. Contenir | Aussitôt | Sady, avec Cat | Fermer les sessions, changer les mots de passe et les clés concernées, couper l'accès en cause, garder les traces (journal d'accès, journaux du prestataire). |
| 3. Évaluer | Dans les 24 h | Cat et Sady | Quelles données, combien de personnes, quelles conséquences possibles (§2.1). Le contenu chiffré par la sealed box est-il resté illisible ? |
| 4. Notifier l'APD | **Dans les 72 h** suivant la découverte, sauf si la violation ne présente **aucun risque** | Cat | Formulaire de notification de l'APD `[lien à vérifier sur le site de l'APD]` ; si tout n'est pas connu, notifier quand même et compléter ensuite. Au-delà de 72 h, dire pourquoi. `[À CONFIRMER avec le juriste]` (D47) |
| 5. Prévenir les personnes | Dans les meilleurs délais, si le **risque est élevé** | Cat | En langage clair : ce qui s'est passé, les conséquences possibles, ce que fait la maison, ce que la personne peut faire, un contact. Pas nécessaire si les données étaient chiffrées et que la clé n'est pas compromise (article 34.3.a). |
| 6. Documenter | Toujours, même sans notification | Cat | Registre des violations (§3.2). |
| 7. Tirer les leçons | Sous un mois | Cat et Sady | Corriger la cause, mettre à jour l'AIPD et ce dossier. |

### 2.1 Évaluer le risque (repères)

- **Aucun risque** : par exemple, la base du coffre volée mais le contenu chiffré par la sealed box, et la clé privée intacte ; seules des colonnes de tri, sans nom, exposées.
- **Risque** : e-mail ou numéro de quelques personnes exposés.
- **Risque élevé** : nom associé à une situation de santé, à la présence d'enfants, ou à l'absence des propriétaires d'une résidence ; notes de Cat exposées ; clé privée du coffre compromise.

### 2.2 Message aux personnes (à adapter)

**FR**
> Madame, Monsieur,
> Le [date], nous avons découvert [ce qui s'est passé, en une phrase]. Les informations concernées sont [lesquelles]. Nous avons aussitôt [mesures prises]. Par prudence, nous vous conseillons de [précaution utile]. Nous avons informé l'Autorité de protection des données. Pour toute question, écrivez-nous à [adresse].
> Avec nos sentiments les meilleurs,
> Maison Triona

**EN**
> Dear [name],
> On [date], we discovered [what happened, in one sentence]. The information concerned is [which]. We immediately [measures taken]. As a precaution, we advise you to [useful step]. We have informed the Data Protection Authority. For any question, write to us at [address].
> With kind regards,
> Maison Triona

## 3. Registres à tenir

Tenus par Cat, hors du site public, dans un document à accès restreint `[À DÉFINIR : où]`. Ils ne contiennent que le nécessaire.

### 3.1 Demandes d'exercice des droits

| Reçue le | Canal | Demande (identifiant interne) | Droit | Vérification | Réponse envoyée le | Résultat | Prolongation (motif) |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### 3.2 Violations de données (article 33.5)

| Découverte le | Ce qui s'est passé | Données et nombre de personnes | Conséquences possibles | Mesures prises | Notifiée à l'APD (date, ou motif de non-notification) | Personnes prévenues (date) |
|---|---|---|---|---|---|---|
| | | | | | | |

## 4. Avant chaque nouveau traitement, outil ou prestataire

1. Fiche ajoutée ou mise à jour dans le registre (`registre-des-traitements.md`).
2. AIPD relue (`analyse-impact.md`) : le risque change-t-il ?
3. Contrat de traitement signé et noté (`sous-traitants.md`) ; transfert hors UE vérifié.
4. Politique de confidentialité mise à jour (FR et EN) **avant** la mise en service.
