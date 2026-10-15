---
description: Ingère un média généré pour Maison Triona (vidéo ou image) - garde-fou moodboard, contrôle ffprobe, encodages deux passes, posters, rapport de poids et de raccord de boucle, mise à jour du manifeste.
argument-hint: <fichier> <ID> <scene> <slug> [--scrub] [--loop-xfade] [--dry-run]
---

Ingère le média suivant : **$ARGUMENTS**

1. Charge la skill `maison-triona-media` et lis la ligne de l'asset dans `docs/assets-manifest.md` §3 (ID, scène, ratio, flags `boucle` / `scrub`). Si l'ID n'existe pas dans le manifeste, arrête-toi et demande.
2. **Garde-fous avant tout** : le fichier vient de `media-incoming/` (jamais du moodboard, d'`ASSETS PHOTO MAQUETTE/`, de `MOODBOARD PHOTO/` ni d'Unsplash) ; sa génération est notée dans le journal du manifeste (§7). Sinon, arrête-toi.
3. **Regarde le fichier** (image, ou quelques images extraites de la vidéo) et passe la checklist qualité du brief §8. Un défaut visuel (mains, texte parasite, lieu identifiable, bleu saturé, ressemblance avec le moodboard ou une personne réelle) = refus, sans encodage.
4. Lance d'abord le script en `--dry-run` pour montrer à Sady les fichiers qui seront créés :
   ```bash
   bash scripts/ingest-media.sh <fichier> <ID> <scene> <slug> [--scrub] [--loop-xfade] --dry-run
   ```
   (script déplacé dans `scripts/` en story 1.1 ; à lancer depuis la racine du dépôt, chemins entre guillemets).
5. Après accord, lance-le sans `--dry-run`. Ajoute `--scrub` seulement pour les scènes marquées scrub (V01, V07 au plus) et `--loop-xfade` si le raccord natif ne passe pas (SSIM < 0,99).
6. Rends le rapport : fichiers créés, poids et budgets, audio absent, SSIM du raccord, avertissements.
7. Mets à jour le statut dans le manifeste (`généré`, ou `validé Sady` si Sady l'a confirmé) et le chemin du fichier final. Ne passe jamais un asset en `validé Cat` ou `intégré` sans confirmation explicite.
