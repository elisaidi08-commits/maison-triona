# Checklist de lancement — Maison Triona

> **Statut** : créée en phase 0 (15/10/2026), story **E5-S9**. À cocher avant l'ouverture, **preuve à l'appui** pour chaque case (commande, capture, lien, date).
> **Sources** : `docs/trust-contact-launch.md` §6.3 (socle), complétée par les autres documents de cadrage (cases marquées « + »).
> **Règle** : une case non cochée bloque l'ouverture générale. Les cases « + » ont le même poids que le socle.

---

## 1. Domaine, redirections, indexation
- [ ] Redirections : `www` ↔ domaine nu, `/` → `/fr` (stratégie retenue : `/fr` en `x-default`), anciennes URL éventuelles.
- [ ] `robots.txt` et `sitemap.xml` de **production** (multilingue, alternances FR/EN).
- [ ] `noindex` retiré **uniquement** à l'ouverture ; toujours présent sur `/fr/demo`, `/contact/merci`, la 404 et le coffre.
- [ ] + Search Console : domaine vérifié, sitemap soumis (`docs/seo-strategy.md`).
- [ ] + Métadonnées, `canonical`, `hreflang` + `x-default` contrôlés sur chaque page ; données structurées valides (Organization, Service, FAQPage), sans le nom de Cat.

## 2. Sécurité
- [ ] HTTPS forcé, HSTS, CSP, en-têtes de sécurité vérifiés (`curl -sI`, aucune violation dans la console).
- [ ] + Aucun secret dans le dépôt ni l'historique ; variables d'environnement de production complètes.
- [ ] + Coffre : comptes nominatifs, A2F active pour chaque compte, journal d'accès opérationnel, aucun accès partagé.
- [ ] + Préproduction toujours protégée et `noindex` après l'ouverture.

## 3. Contact, coffre, e-mails
- [ ] Soumission de test de bout en bout, **formulaire et rappel** : demande présente et chiffrée dans le coffre, notification minimale reçue par Cat, e-mail de confirmation reçu par le visiteur (sans écho du contenu), **aucune donnée dans les logs**.
- [ ] + Test sans JavaScript : formulaire envoyé, confirmation affichée.
- [ ] + Simulation de panne d'e-mail : la demande reste dans le coffre, la reprise fonctionne, Sady reçoit l'alerte.
- [ ] SPF / DKIM / DMARC validés ; tests de réception réalisés et consignés (`docs/email-deliverability.md`).
- [ ] + Suppression d'une demande testée (y compris la politique de sauvegarde documentée).
- [ ] + Lien « Situation urgente » : présent **seulement** si Cat l'a validé ; numéros d'urgence vérifiés.

## 4. Contenu et langues
- [ ] FR/EN relus par un humain ; parité des clés vérifiée (`check:i18n`) ; `hreflang` correct.
- [ ] + `check:content` vert : aucun `[CONTENU À FOURNIR PAR CAT]`, aucun brouillon, aucun chiffre ni critère non vérifié.
- [ ] + Aucune promesse médicale ; aucun délai de réponse affiché que Cat ne puisse tenir.
- [ ] + Section partenaires : absente tant qu'aucun accord écrit (phase 2).

## 5. Légal et confidentialité
- [ ] Pages légales **par pays** (mentions légales avec données réelles), politique de confidentialité FR/EN, **déclaration d'accessibilité**.
- [ ] Mention sur les images générées par IA (décision de Cat ; recommandation : pied de page + mentions légales).
- [ ] + DPA signés avec chaque sous-traitant listé dans `docs/privacy.md`.
- [ ] + Avis juridique obtenu : base légale, absence de bandeau, mention IA, « Notre indépendance », vocabulaire réglementé des services.

## 6. Mesure
- [ ] Analytics sans traceurs actif (servi via notre domaine) ; **pas de bandeau** si aucun traceur.
- [ ] + Événement `Entrée` agrégé, sans identifiant ; pages vues sans paramètres de requête.

## 7. Qualité
- [ ] Pages 404 et 500 soignées (FR/EN), favicon, image de partage (FR/EN).
- [ ] + Lighthouse ≥ 95 (Perf, A11y, SEO) mobile et desktop, **vidéo comprise** ; INP ≤ 200 ms (données de terrain, dès qu'elles existent).
- [ ] + `docs/a11y-report.md` complet (axe, clavier, VoiceOver, NVDA, zoom 200 %, mobile réel).
- [ ] + Tests utilisateurs réalisés, aucun problème **bloquant** ouvert (`docs/usability-report.md`).
- [ ] + Tous les médias publiés ont le statut « validé Cat » dans `docs/assets-manifest.md`, et aucune référence au moodboard ne subsiste.

## 8. Exploitation
- [ ] Surveillance de disponibilité, alertes (site, coffre, e-mails), sauvegardes, **procédure de restauration testée**.
- [ ] + Personne de garde désignée pour la première semaine (Sady) et procédure en cas de fuite de données (qui prévenir, sous quel délai).

## 9. Lancement en douceur
- [ ] Ouverture à un **cercle restreint** (date, liste, canal de retour).
- [ ] Retours traités ; corrections bloquantes faites.
- [ ] Ouverture générale : `noindex` retiré, sitemap soumis, annonce de bouche-à-oreille.
