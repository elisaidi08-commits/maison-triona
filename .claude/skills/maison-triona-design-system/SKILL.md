---
name: maison-triona-design-system
description: Référence rapide du design system Maison Triona (tokens couleur, typo fluide, espacements, règles or/vert, arche, cachet « K. », composants bouton, lien à filet, filet, label). À utiliser avant d'écrire ou de relire tout composant, toute classe Tailwind, toute couleur ou tout espacement du site Maison Triona.
---

# Design system Maison Triona (référence rapide)

Source complète : `docs/design-tokens.md` et `docs/art-direction.md`. En cas d'écart, **les docs priment** sur cette fiche.

## Couleurs (`src/styles/tokens.css`)
| Classe | Hex | Rôle |
|---|---|---|
| `ivoire` | `#F3EDE1` | Fond (~80 %) |
| `sapin` | `#26382F` | Signature : titres, nom du logo, bloc Contact, focus |
| `cypres` | `#3F5A3C` | Second rôle : numéros, survols |
| `pierre` | `#D8C8AE` | Surface rare |
| `sauge` | `#9AAE8F` | Filets sur sombre, désactivé |
| `or` | `#B58E4C` | Filets, T du logo sur ivoire, point du « K. », bordure de bouton sur sapin |
| `champagne` | `#C6A96B` | Seul or **en texte**, sur sapin uniquement |
| `encre` / `encre-68` | `#2A241F` / 68 % | Texte / texte secondaire |
| `ivoire-80` | ivoire 80 % | Texte secondaire sur sapin (AAA) |
| `terracotta` | `#A66A4E` | Ligne de champ en erreur |

**Paires interdites** : or, champagne ou sauge en texte sur ivoire ou pierre ; cyprès sur sapin ; filet or sur pierre (invisible).

## Typographie
| Classe | Usage | Famille |
|---|---|---|
| `text-display-xl` | Titre du hero (72 px desktop → 44 px mobile) | Cormorant Garamond Light |
| `text-display-l` | Titre de page | Cormorant Garamond Light |
| `text-title-h2` | Titre de section | Cormorant Garamond Regular |
| `text-title-h3` | Titre de ligne (services) | EB Garamond Medium |
| `text-body-l` / `text-body` / `text-body-s` | Textes | EB Garamond Regular (corps 20 px) |
| `text-label` | Label capitales, +0,12 em, 14 px | EB Garamond Medium |

Règles : display jamais en Bold, jamais sous ~32 px ; un seul titre display par écran ; pas d'italique (sauf arbitrage Q4) ; **corps 20 px (EB Garamond, D50), jamais sous 18 px minimum** ; colonne de lecture `max-w-measure` (640 px).

Texte sur image : seul le titre display du hero, sur voile sapin ≥ 58 % (`--veil-hero`) ; tout texte courant sur aplat (`docs/design-tokens.md` §2.4).

## Espacements
Échelle unique : `0 4 8 12 16 24 32 48 64 96 128 160 192` (px). `p-24` = 24 px. **Aucune classe arbitraire** (`mt-[23px]`, `text-[17px]`, `bg-[#…]`). Sections : `py-section` ; marges : `px-margin`.

## Formes
Rayon **0** partout, aucune ombre, aucun dégradé, aucun flou. Anneau de focus 2 px (sapin sur clair, champagne sur sapin). Arche : utilitaire `arch`, **une seule occurrence** (image du hero) si validée.

## Le cachet « K. »
K en sapin (ou ivoire sur sapin), point en or (ou champagne sur sapin), dans la serif display. Tailles : 24 px (fin du hero, menu), 48 px (pied de page), 64 px (confirmation). Toujours seul, entouré d'air, jamais animé autrement qu'en fondu, `aria-hidden` s'il est décoratif.

```tsx
const sizes = { sm: 'text-stamp-sm', md: 'text-stamp-md', lg: 'text-stamp-lg' } as const;

export function Stamp({ size = 'sm', onDark = false }: { size?: keyof typeof sizes; onDark?: boolean }) {
  return (
    <span aria-hidden="true" className={`font-display font-light leading-none ${sizes[size]} ${onDark ? 'text-ivoire' : 'text-sapin'}`}>
      K<span className={onDark ? 'text-champagne' : 'text-or'}>.</span>
    </span>
  );
}
```

## Recettes de composants

**Lien à filet** (CTA sur fond clair, liens de navigation) :
```tsx
<a href="/contact" className="group relative inline-block py-8 text-body text-sapin transition-colors duration-micro ease-standard hover:text-cypres focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sapin">
  Nous écrire
  <span aria-hidden="true" className="absolute inset-x-0 bottom-4 h-px origin-left scale-x-0 bg-or transition-transform duration-hover ease-standard group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none" />
</a>
```

**Bouton du bloc Contact** (sur sapin uniquement) :
```tsx
<a href="/contact" className="inline-flex items-center border border-or px-32 py-16 text-body text-ivoire transition-colors duration-micro ease-standard hover:border-champagne focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-champagne">
  Nous écrire
</a>
```

**Liste de l'entrée par besoin** (spec d'entrée, variante B) : vrais liens, filets or, lignes ≥ 56 px.
```tsx
<h2 id="besoin" className="text-body-l text-encre">{t('entry.question')}</h2>
<ul aria-labelledby="besoin" className="mt-24 border-t border-or">
  {choices.map((c, i) => (
    <li key={c.id} className="border-b border-or">
      <a href={c.href} className="group flex min-h-touch-lg items-baseline gap-16 py-16 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sapin">
        {c.numbered && <span className="text-label text-cypres">{String(i + 1).padStart(2, '0')}</span>}
        <span>
          <span className="block text-title-h3 text-sapin">{c.label}</span>
          <span className="block text-label uppercase text-encre">{c.service}</span>
        </span>
      </a>
    </li>
  ))}
</ul>
```
Le 4ᵉ choix (« Je ne sais pas encore ») n'a pas de numéro et mène à `/contact`.

**Filet** : `<hr className="h-px w-48 border-0 bg-or" />` (48 px avant un label, pleine largeur en tête du pied de page).

**Label** : `<p className="text-label uppercase text-encre">Services</p>` (sur sapin : `text-champagne`). Jamais de fond, de bordure ni de pastille (anti-pattern n° 09).

## Avant de rendre un composant
- [ ] Uniquement des classes de tokens ; `grep -nE "\[[0-9#]"` vide.
- [ ] Contraste conforme au tableau des paires (`node docs/tools/contrast-check.mjs`).
- [ ] Focus visible (anneau 3 px), cible ≥ 48 px (56 px pour les choix d’entrée), élément HTML natif.
- [ ] Comportement défini pour < 768, 768-1023, ≥ 1024 px.
- [ ] Aucune icône, aucun emoji, aucun tiret cadratin dans un titre ou un CTA.
