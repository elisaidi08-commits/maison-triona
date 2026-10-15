---
description: Prépare la fiche de génération Higgsfield prête à copier pour un asset du manifeste Maison Triona (A01-A03, P01-P10, V01-V08) - prompts adaptés aux modèles réellement disponibles, commande CLI, estimation de coût - sans jamais lancer de génération.
argument-hint: <ID, ex. V01 ou P04-d>
---

Prépare la fiche de génération de l'asset **$ARGUMENTS**.

1. Lis la ligne de l'asset dans `docs/assets-manifest.md` §3, ses prompts au §4, les blocs versionnés au §1 et les écarts au §2. Si l'ID n'existe pas, liste les IDs disponibles et arrête-toi.
2. Charge la skill `maison-triona-media` (interdits, style bible, modèles, QA).
3. Vérifie que l'image de départ ou de référence éventuelle est **une de nos images générées** (A01-A03, Pxx-d) présente dans `media-incoming/`, jamais un fichier du moodboard.
4. Estime le coût, sans rien consommer :
   ```bash
   higgsfield generate cost <modèle> --prompt "…" <paramètres exacts>
   higgsfield account status   # crédits restants
   ```
5. Rends la fiche :

```
Asset : $ARGUMENTS · Scène : … · Destination du choix : … · Ratio : … · Durée : …
Modèle : <ID CLI> · Paramètres : … (vidéo : --mode pro --sound off --duration 8 --aspect_ratio 16:9)
Images : --image / --start-image / --end-image <nos fichiers uniquement>

Prompt (prêt à copier) :
<image : STYLE_ANCHOR + scène + QUALITY_GUARD · vidéo : mouvement seulement>

Commande :
higgsfield generate create <modèle> --prompt "…" <paramètres> --wait

Coût estimé : … crédits · Crédits restants : …
Contrôles après génération (brief §8) : mains, texte parasite, visages, palette, lieu identifiable, ressemblance, raccord de boucle, poids.
```

6. **Ne lance aucune génération.** Attends l'accord explicite de Sady (« OK lot N » ou « OK $ARGUMENTS »). Après génération, consigne la ligne dans le journal du manifeste (§7) puis passe à `/ingest-media`.
