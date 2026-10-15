---
name: maison-triona-media
description: Règles et recettes des visuels de Maison Triona, tous générés par IA (Higgsfield) - interdits du brief (moodboard jamais en entrée, aucune personne réelle, aucun lieu identifiable), style bible, blocs STYLE_ANCHOR et QUALITY_GUARD, commandes CLI avec estimation de coût, contrôle qualité par asset, encodage deux passes, poster LCP, vidéo conditionnelle, scrub, bouton pause. À utiliser avant de rédiger un prompt, de générer, de contrôler, d'encoder ou d'intégrer une image, un poster ou une vidéo.
---

# Médias Maison Triona

Sources complètes : `docs/assets-ia-brief.md` (brief de Sady) · `docs/assets-manifest.md` (prompts, statuts, budget, journal) · `docs/art-direction.md` §6 (style bible) · `docs/media-pipeline.md` (technique).

## 1. Interdits (brief §1)
- **Moodboard = style seulement.** Jamais dans `public/`, jamais déployé, **jamais passé à un outil** (`--image`, `--start-image`, `--end-image`, référence, inpainting, variation). Aucune reproduction d'un lieu, d'un visage, d'une scène ou d'un cadrage.
- **Aucune ressemblance** avec une personne réelle ; jamais le visage de Cat ou d'un client sans accord écrit.
- **Aucun lieu identifiable** (pas de lac de Côme, de côte amalfitaine, de Majorque, de collines toscanes à cyprès) ; aucune légende de pays sous une image.
- Ni texte, ni logo, ni marque, ni écran, ni téléphone dans l'image.
- **Grand âge** : élégance, autonomie, dignité ; jamais de matériel médical, de masque, de fauteuil roulant.

## 2. Style bible (résumé)
Lumière chaude et rasante (matin, fin d'après-midi, couchant) · intérieurs sombres ouverts sur la lumière · palette ivoire, ocre, terre cuite, **olive**, sauge, cyprès profond, bleu **sourd** · saturation ≤ 0,35 · film 35 mm, **grain très subtil** · plans fixes à mouvement naturel (rideau, feuillage, eau, lumière) · mains, dos, profils plutôt que visages · paysage 16:9 pour la vidéo, tiers gauche du hero calme.

## 3. Blocs de prompt (versionnés dans le manifeste §1)
- Images : `STYLE_ANCHOR` (v1 ou v1.1) + **scène** + `QUALITY_GUARD`.
- Vidéo (image → vidéo) : **le mouvement seulement** (« Static camera. The linen curtain breathes slowly… »).
- `NEGATIVE` ne sert qu'aux modèles qui ont ce champ ; les modèles retenus n'en ont pas : formuler positivement.

## 4. CLI Higgsfield : coût, accord, génération
```bash
# 1. Toujours estimer d'abord (ne consomme rien)
higgsfield generate cost kling3_0 --prompt "<mouvement>" --start-image media-incoming/P01-d.png --end-image media-incoming/P01-d.png --duration 8 --mode pro --sound off --aspect_ratio 16:9
# 2. Présenter à Sady : crédits du lot, crédits restants (higgsfield account status). Attendre « OK lot N ».
# 3. Générer
higgsfield generate create kling3_0 --prompt "<mouvement>" --start-image media-incoming/P01-d.png --end-image media-incoming/P01-d.png --duration 8 --mode pro --sound off --aspect_ratio 16:9 --wait
```
| Usage | Modèle | Coût |
|---|---|---|
| Brouillon image (personnes, cinéma / lieux) | `soul_cinematic` / `soul_location` (`--quality 2k` = 1080p, **pas de 4:5**) | 0,12 |
| Finale ≥ 2 400 px | `bytedance_image_upscale --resolution 4k` ou `nano_banana_pro --resolution 4k` (4:5 natif) | ~4 |
| Vidéo 16:9, 8 s, boucle | `kling3_0 --mode pro --sound off` (+ même image début/fin) | 12 |
| À éviter | `seedance_2_5` (défaut de la skill `higgsfield-generate`) | 128 |

Chaque génération (prises écartées comprises) est notée dans le journal du manifeste §7.

## 5. Contrôle qualité par asset (brief §8)
`[ ]` mains · `[ ]` visages · `[ ]` objets et architecture sans élément qui fond ni texte parasite · `[ ]` palette (aucun bleu saturé) et grain homogènes · `[ ]` mouvement lent, sans dérive ni scintillement · `[ ]` boucle invisible (SSIM ≥ 0,99) · `[ ]` lieu non identifiable, ni logo, ni marque, ni écran · `[ ]` aucune ressemblance avec le moodboard ou une personne réelle · `[ ]` audio supprimé, poids et résolution respectés · `[ ]` validé Sady · `[ ]` validé Cat.

## 6. Encodage (commandes testées, `docs/media-pipeline.md` §5)
- **Deux passes à débit cible** : H.264 2 300 kbit/s (≈ 2 Mo pour 8 s), VP9 1 800 kbit/s, scrub `-g 1` plafonné à 4 000 kbit/s. Le CRF seul ne garantit pas le poids.
- Toujours `-an` et `-movflags +faststart` ; 1080p maximum ; variante 720p.
- Boucle de secours : fondu enchaîné `xfade` de 0,5 s fin → début ; contrôle SSIM dernière ↔ première image ≥ 0,99.
- Nommage : `public/media/{scene}/{ID}-{slug}.{ext}` (`seuil`, `maison`, `conciergerie`, `grand-age`, `enfants`, `territoires`, `contact`, `details`).

## 7. Intégration
```tsx
<div className="relative aspect-portrait lg:aspect-hero">   {/* tokens --aspect-portrait 4/5, --aspect-hero 16/9 */}
  <Image src="/media/seuil/P01-fenetre-mer-1920.avif" alt="" fill
         sizes="(min-width: 1024px) 58vw, 100vw" fetchPriority="high" />   {/* LCP, jamais animé */}
  <SceneVideo id="V01" />                                    {/* client, superposée plus tard */}
</div>
```
- **Conditions vidéo** (toutes) : `(min-width: 1024px)`, `(pointer: fine)`, `prefers-reduced-motion: no-preference`, pas de `Save-Data` ni `prefers-reduced-data`, connexion non lente. Sinon : photo fixe, définitivement. **Jamais de vidéo en mobile.**
- `<video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" disablepictureinpicture disableremoteplayback>` ; V01 après `load` + inactivité ; les autres à l'approche de leur scène ; **une seule en lecture** ; pause hors écran.
- **Bouton pause** texte, nommé, atteignable au clavier, sur chaque vidéo (WCAG 2.2.2).
- **Scrub** (V01, V07 au plus) : `currentTime` suit la progression de la scène (rAF + IntersectionObserver) ; jamais d'épinglage qui piège clavier, lecteur d'écran ou zoom ; reduced-motion → poster.
- **Texte sur la vidéo** : titre seul, voile sapin ≥ 58 % ; texte courant sur aplat.

## 8. Si le budget ne tient pas (ordre de sacrifice)
1. vidéo mobile (déjà exclue) → 2. versions scrub → 3. 1080p (garder 720p) → 4. vidéos S2-S7 (photos fixes) → 5. V01 (poster fixe) → 6. parallaxe et révélations.
