#!/usr/bin/env node
// Maison Triona : calcul des ratios de contraste WCAG 2.1 (formule de luminance relative).
// Outil de documentation, sans dépendance. Usage : node docs/tools/contrast-check.mjs
// Les couleurs avec alpha sont composées sur leur fond avant calcul (comme le rendu navigateur).
// Seuils : texte normal 4,5:1 · grand texte (>= 24 px, ou >= 18,66 px en gras) 3:1 · composant UI / graphique 3:1 (1.4.11).

const THRESHOLD = { text: 4.5, large: 3, ui: 3, deco: null, logo: null };

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
};

// "#1F1E1A@0.68" : alpha explicite ; "#1F1E1AAD" : alpha en hexa
const parse = (spec) => {
  const [hex, alpha] = spec.split('@');
  const c = hexToRgb(hex);
  if (alpha !== undefined) c.a = Number(alpha);
  return c;
};

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export const ratio = (fgSpec, bgSpec) => {
  const bg = parse(bgSpec);
  const fg = over(parse(fgSpec), bg);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// Plus petit alpha d'une couleur sur un fond pour atteindre un ratio cible
const minAlpha = (fgHex, bgHex, target) => {
  for (let a = 0.3; a <= 1.0001; a += 0.01) {
    if (ratio(`${fgHex}@${a.toFixed(2)}`, bgHex) >= target) return a.toFixed(2);
  }
  return null;
};

const C = {
  ivoire: '#F4EDE0', pierre: '#D8C8AE', cypres: '#3F5A3C', sauge: '#9AAE8F', or: '#B8944D',
  encre: '#1F1E1A', encre68: '#1F1E1A@0.68', terracotta: '#C4876A',
  sapin: '#1C3B2A', champagneClair: '#D2B98A',
  v1Ivory: '#F5F0E8', v1Forest: '#2D5016', v1Olive: '#4E5E47',
  prdIvoire: '#F7F2E7', prdSapinClair: '#2E5D45', prdChampagneClair: '#E8DAB8', prdNoir: '#1A1A17',
};

const groups = [
  {
    title: 'A. Paires réellement utilisées dans la maquette Figma (pages 04 à 08, collection `color`)',
    rows: [
      ['cyprès', C.cypres, 'ivoire', C.ivoire, 'text', 'Titres, nav active, liens, CTA (17 à 88 px)'],
      ['encre', C.encre, 'ivoire', C.ivoire, 'text', 'Corps, nav, labels (12 à 20 px)'],
      ['encre-68', C.encre68, 'ivoire', C.ivoire, 'text', 'Placeholders, EN inactif, séparateurs (14 à 17 px)'],
      ['encre', C.encre, 'pierre', C.pierre, 'text', 'Label et corps du bloc Contact'],
      ['cyprès', C.cypres, 'pierre', C.pierre, 'text', 'Titre et lien « Nous écrire » du bloc Contact (20 à 48 px)'],
      ['or', C.or, 'ivoire', C.ivoire, 'logo', 'Point du « K. » (24 à 32 px), logotype'],
      ['encre-68', C.encre68, 'ivoire', C.ivoire, 'ui', 'Ligne des champs au repos (1.4.11)'],
      ['cyprès', C.cypres, 'ivoire', C.ivoire, 'ui', 'Soulignement du bouton, anneau de focus 2 px'],
      ['sauge', C.sauge, 'ivoire', C.ivoire, 'deco', 'Filets, soulignement désactivé'],
      ['terracotta', C.terracotta, 'ivoire', C.ivoire, 'ui', 'Ligne d’erreur des champs (le message reste en encre)'],
      ['v1 forest', C.v1Forest, 'v1 ivory', C.v1Ivory, 'text', 'Couverture (7:12), encore liée aux variables v1'],
      ['v1 olive', C.v1Olive, 'v1 ivory', C.v1Ivory, 'text', 'Sous-titre de couverture, 12 px'],
    ],
  },
  {
    title: 'B. Paires proposées pour la DA v2',
    rows: [
      ['sapin profond', C.sapin, 'ivoire', C.ivoire, 'text', 'Titres, liens, wordmark'],
      ['ivoire', C.ivoire, 'sapin profond', C.sapin, 'text', 'Texte du bloc Contact sombre, footer sombre'],
      ['ivoire-80', '#F4EDE0@0.80', 'sapin profond', C.sapin, 'text', 'Texte secondaire sur sapin (AAA)'],
      ['champagne clair', C.champagneClair, 'sapin profond', C.sapin, 'text', 'Texte or sur sombre (labels, lien CTA)'],
      ['or', C.or, 'sapin profond', C.sapin, 'ui', 'Bordure du bouton, filets sur sombre'],
      ['champagne clair', C.champagneClair, 'sapin profond', C.sapin, 'ui', 'Anneau de focus sur fond sombre'],
      ['sapin profond', C.sapin, 'ivoire', C.ivoire, 'ui', 'Anneau de focus sur fond clair'],
      ['sapin profond', C.sapin, 'pierre', C.pierre, 'text', 'Titre sur surface pierre'],
      ['cyprès', C.cypres, 'ivoire', C.ivoire, 'text', 'Vert secondaire (numéros, sous-titres)'],
      ['ivoire', C.ivoire, 'cyprès', C.cypres, 'text', 'Texte sur aplat cyprès (si utilisé)'],
      ['encre', C.encre, 'ivoire', C.ivoire, 'text', 'Corps de texte'],
      ['encre', C.encre, 'pierre', C.pierre, 'text', 'Corps sur pierre'],
      ['encre-68', C.encre68, 'pierre', C.pierre, 'text', 'Texte secondaire sur pierre'],
      ['sauge', C.sauge, 'sapin profond', C.sapin, 'deco', 'Filets sur sombre'],
      ['or', C.or, 'ivoire', C.ivoire, 'deco', 'Filets or sur ivoire : décoratif uniquement'],
      ['or', C.or, 'ivoire', C.ivoire, 'text', 'Contrôle : or en texte sur ivoire (interdit)'],
      ['champagne clair', C.champagneClair, 'ivoire', C.ivoire, 'text', 'Contrôle : champagne clair sur ivoire (interdit)'],
      ['terracotta', C.terracotta, 'sapin profond', C.sapin, 'ui', 'Ligne d’erreur si un champ est posé sur sapin'],
    ],
  },
  {
    title: 'C. Référence : palette du PRD §6.2',
    rows: [
      ['PRD sapin', C.sapin, 'PRD ivoire', C.prdIvoire, 'text', '#1C3B2A sur #F7F2E7'],
      ['PRD sapin clair', C.prdSapinClair, 'PRD ivoire', C.prdIvoire, 'text', '#2E5D45 sur #F7F2E7'],
      ['PRD champagne', C.champagneClair, 'PRD sapin', C.sapin, 'text', '#D2B98A sur #1C3B2A'],
      ['PRD champagne clair', C.prdChampagneClair, 'PRD sapin', C.sapin, 'text', '#E8DAB8 sur #1C3B2A'],
      ['PRD noir chaud', C.prdNoir, 'PRD ivoire', C.prdIvoire, 'text', '#1A1A17 sur #F7F2E7'],
    ],
  },
];

const verdict = (r, kind) => {
  const t = THRESHOLD[kind];
  if (t === null) return kind === 'logo' ? 'exempté (logotype, 1.4.3)' : 'décoratif, pas de seuil';
  const aaa = kind === 'text' ? (r >= 7 ? ' · AAA' : '') : '';
  return r >= t ? `OK (≥ ${t}:1)${aaa}` : `**ÉCHEC** (< ${t}:1)`;
};

const fmt = (r) => r.toFixed(2).replace('.', ',');
const kindLabel = { text: 'texte', large: 'grand texte', ui: 'UI 1.4.11', deco: 'décoratif', logo: 'logotype' };

for (const g of groups) {
  console.log(`\n### ${g.title}\n`);
  console.log('| Avant-plan | Fond | Ratio | Usage | Type | Verdict |');
  console.log('|---|---|---|---|---|---|');
  for (const [fgName, fg, bgName, bg, kind, usage] of g.rows) {
    const r = ratio(fg, bg);
    const fgShown = fg.includes('@') ? `${fg} (= ${toHex(over(parse(fg), parse(bg)))})` : fg;
    console.log(`| ${fgName} \`${fgShown}\` | ${bgName} \`${bg}\` | ${fmt(r)}:1 | ${usage} | ${kindLabel[kind]} | ${verdict(r, kind)} |`);
  }
}

console.log('\n### D. Alpha minimal pour un texte secondaire conforme (AA 4,5:1 · AAA 7:1)\n');
console.log(`- encre sur ivoire : AA alpha ≥ ${minAlpha(C.encre, C.ivoire, 4.5)} · AAA alpha ≥ ${minAlpha(C.encre, C.ivoire, 7)}`);
console.log(`- encre sur pierre : AA alpha ≥ ${minAlpha(C.encre, C.pierre, 4.5)} · AAA alpha ≥ ${minAlpha(C.encre, C.pierre, 7)}`);
console.log(`- ivoire sur sapin profond : AA alpha ≥ ${minAlpha(C.ivoire, C.sapin, 4.5)} · AAA alpha ≥ ${minAlpha(C.ivoire, C.sapin, 7)}`);
console.log(`- encre sur ivoire pour une ligne de champ (3:1) : alpha ≥ ${minAlpha(C.encre, C.ivoire, 3)}`);

// E. Voile posé sur une image ou une vidéo : on calcule contre le PIRE pixel possible
// (blanc pur sous un texte clair, noir pur sous un texte foncé), donc valable quelle que soit l'image.
const minVeil = (textHex, veilHex, worstHex, target) => {
  for (let a = 0; a <= 1.0001; a += 0.01) {
    const veil = toHex(over(parse(`${veilHex}@${a.toFixed(2)}`), parse(worstHex)));
    if (ratio(textHex, veil) >= target) return a.toFixed(2);
  }
  return 'impossible';
};
console.log('\n### E. Opacité minimale d’un voile sous du texte posé sur une image (pire cas)\n');
console.log('| Texte | Voile | Pire pixel dessous | AA grand texte 3:1 | AA 4,5:1 | AAA 7:1 |');
console.log('|---|---|---|---|---|---|');
for (const [tn, t, vn, v, wn, w] of [
  ['ivoire', C.ivoire, 'sapin', C.sapin, 'blanc', '#FFFFFF'],
  ['ivoire', C.ivoire, 'encre', C.encre, 'blanc', '#FFFFFF'],
  ['sapin', C.sapin, 'ivoire', C.ivoire, 'noir', '#000000'],
  ['encre', C.encre, 'ivoire', C.ivoire, 'noir', '#000000'],
]) {
  console.log(`| ${tn} \`${t}\` | ${vn} \`${v}\` | ${wn} | ${minVeil(t, v, w, 3)} | ${minVeil(t, v, w, 4.5)} | ${minVeil(t, v, w, 7)} |`);
}
