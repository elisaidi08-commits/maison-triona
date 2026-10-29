"""Kit du logo « le sillage » (D48, D49, piste L1-A) : symbole, nom en Cormorant Garamond vectorisé,
déclinaisons du kit de Cat, chemins des composants du site.

Prérequis (outil de développement, hors du site) :
  python3 -m venv .venv-kit && .venv-kit/bin/pip install fonttools uharfbuzz
  Polices (licence OFL) dans <polices>/ : CormorantGaramond.ttf et CormorantGaramond-Italic.ttf, depuis
  https://github.com/google/fonts/tree/main/ofl/cormorantgaramond (fichiers [wght]).
Usage :
  .venv-kit/bin/python -I scripts/kit-logo.py <polices> brand/sources/L1-A-symbole.svg brand/kit \
    src/components/brand/logo-paths.ts
PNG : voir brand/README.md."""
import io, json, re, sys
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS, SYMBOL, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
OUT.mkdir(parents=True, exist_ok=True)

SAPIN, CHAMP, OR, IVOIRE, ENCRE = '#26382F', '#C6A96B', '#B58E4C', '#F3EDE1', '#2A241F'

# --- Symbole -----------------------------------------------------------------------------------
# Original L1-A (affichage, >= 240 px de haut) : boîte mesurée 398 x 738 à partir de (825, 668).
SYM_W, SYM_H = 398, 738
raw = SYMBOL.read_text()
D_DISPLAY = re.search(r'fill="rgb\(198,169,107\)" d="([^"]+)"', raw).group(1)
DISPLAY = f'<path transform="translate(-825 -668)" d="{D_DISPLAY}"/>'


def screen_mark(cb, br, st, lb, ys, spread):
    """Version écran du même T, dessinée : barre cb, congé br, demi-fût st, filet bas lb."""
    cx, h = SYM_W / 2, SYM_H
    # Barre plus fine aux extrémités (tip), filets qui s'effilent vers le bas comme un sillage (lb).
    split = ys + st * 1.8
    tip = cb * 0.6
    f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
    d = (
        f'M0 0H{SYM_W}V{f(tip)}L{f(cx + br)} {f(cb)}Q{f(cx + st)} {f(cb)} {f(cx + st)} {f(cb + br * 0.9)}'
        f'V{f(ys)}L{f(cx + spread)} {h}H{f(cx + spread - lb)}L{f(cx)} {f(split)}'
        f'L{f(cx - spread + lb)} {h}H{f(cx - spread)}L{f(cx - st)} {f(ys)}'
        f'V{f(cb + br * 0.9)}Q{f(cx - st)} {f(cb)} {f(cx - br)} {f(cb)}L0 {f(tip)}Z'
    )
    return f'<path d="{d}"/>'


SCREEN = screen_mark(cb=24, br=62, st=20, lb=8, ys=140, spread=52)  # en-tête, sceau (>= 32 px)
ICON = screen_mark(cb=62, br=96, st=40, lb=28, ys=170, spread=88)  # favicon (16 à 48 px)

# --- Texte vectorisé ---------------------------------------------------------------------------
_cache = {}


def instance(name, wght):
    key = (name, wght)
    if key not in _cache:
        var = TTFont(FONTS / name)
        inst = instantiateVariableFont(var, {'wght': wght})
        buf = io.BytesIO()
        inst.save(buf)
        data = buf.getvalue()
        _cache[key] = (TTFont(io.BytesIO(data)), data)
    return _cache[key]


def text(name, wght, s, size, tracking):
    """Chemin SVG du texte, ligne de base à y = 0 ; renvoie (path d, boîte (x0, y0, x1, y1))."""
    tt, data = instance(name, wght)
    face = hb.Face(data)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(s)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': False})
    gs, order, k = tt.getGlyphSet(), tt.getGlyphOrder(), size / face.upem
    x, parts, bounds = 0.0, [], BoundsPen(gs)
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        g = gs[order[info.codepoint]]
        t = (k, 0, 0, -k, x + pos.x_offset * k, -pos.y_offset * k)
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
        g.draw(TransformPen(pen, t))
        g.draw(TransformPen(bounds, t))
        parts.append(pen.getCommands())
        x += pos.x_advance * k + tracking * size
    return ''.join(parts), bounds.bounds


R, I = 'CormorantGaramond.ttf', 'CormorantGaramond-Italic.ttf'

# --- Assemblage --------------------------------------------------------------------------------


def svg(w, h, body, title='Maison Triona', bg=None):
    rect = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ''
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img">'
        f'<title>{title}</title>{rect}{body}</svg>\n'
    )


def place(path, x, y, s, fill):
    return f'<g fill="{fill}" transform="translate({x:.2f} {y:.2f}) scale({s:.5f})">{path}</g>'


def text_at(d, x, y, fill):
    return f'<path fill="{fill}" transform="translate({x:.2f} {y:.2f})" d="{d}"/>'


def principal(mark, mark_fill, name_fill, k_fill, bg=None, pad=80):
    """Logo principal vertical : symbole, « Maison Triona » (Light), « by K. » (italique)."""
    name, nb = text(R, 300, 'Maison Triona', 100, 0.06)
    byk, kb = text(I, 400, 'by K.', 42, 0.01)
    mh = 250
    ms = mh / SYM_H
    mw = SYM_W * ms
    nw, kw = nb[2] - nb[0], kb[2] - kb[0]
    w = max(nw, mw, kw) + 2 * pad
    y_mark = pad
    y_name = y_mark + mh + 50 + 62.5  # ligne de base : hauteur de capitale 62,5
    y_k = y_name + 26 + 45 + (-kb[1] if kb[1] < 0 else 0)
    h = y_k + max(kb[3], 0) + pad
    body = (
        place(mark, (w - mw) / 2, y_mark, ms, mark_fill)
        + text_at(name, (w - nw) / 2 - nb[0], y_name, name_fill)
        + text_at(byk, (w - kw) / 2 - kb[0], y_k, k_fill)
    )
    return svg(w, h, body, bg=bg)


def horizontal(mark, mark_fill, name_fill, k_fill, bg=None, pad=0):
    """En-tête : symbole, « MAISON TRIONA » (Medium, capitales espacées), « by K. »."""
    name, nb = text(R, 500, 'MAISON TRIONA', 100, 0.24)
    byk, kb = text(I, 400, 'by K.', 62, 0.01)
    mh = 200
    ms = mh / SYM_H
    mw = SYM_W * ms
    cap = 62.5
    x_name = pad + mw + 72
    x_k = x_name + (nb[2] - nb[0]) + 36
    w = x_k + (kb[2] - kb[0]) + pad
    h = mh + 2 * pad
    base = pad + mh / 2 + cap / 2  # capitales centrées sur le symbole
    body = (
        place(mark, pad, pad, ms, mark_fill)
        + text_at(name, x_name - nb[0], base, name_fill)
        + text_at(byk, x_k - kb[0], base, k_fill)
    )
    return svg(w, h, body, bg=bg)


def seal(fill, bg=None):
    """Sceau : le T écran dans un anneau fin (une seule famille avec le logo)."""
    size, r, stroke, mh = 1000, 478, 13, 540
    ms = mh / SYM_H
    mw = SYM_W * ms
    body = (
        f'<path fill="{fill}" fill-rule="evenodd" d="M500 {500 - r}a{r} {r} 0 1 0 0.01 0Z'
        f'M500 {500 - r + stroke}a{r - stroke} {r - stroke} 0 1 0 0.01 0Z"/>' + place(SCREEN, (size - mw) / 2, (size - mh) / 2 + 12, ms, fill)
    )
    return svg(size, size, body, title='Maison Triona, sceau', bg=bg)


def symbol(mark, fill, bg=None, pad=60):
    return svg(SYM_W + 2 * pad, SYM_H + 2 * pad, place(mark, pad, pad, 1, fill), title='Maison Triona', bg=bg)


def icon(bg, fill):
    size, mh = 64, 48
    ms = mh / SYM_H
    mw = SYM_W * ms
    return svg(size, size, place(ICON, (size - mw) / 2, (size - mh) / 2 + 1, ms, fill), bg=bg)


files = {
    # Cat : principal or, sillage ivoire, version claire
    'logo-principal-or.svg': principal(DISPLAY, CHAMP, CHAMP, CHAMP),
    'logo-principal-sillage-ivoire.svg': principal(DISPLAY, IVOIRE, IVOIRE, CHAMP),
    'logo-principal-clair.svg': principal(DISPLAY, OR, SAPIN, SAPIN),
    # Horizontale d'en-tête (symbole écran)
    'logo-horizontal-clair.svg': horizontal(SCREEN, OR, SAPIN, SAPIN),
    'logo-horizontal-sombre.svg': horizontal(SCREEN, CHAMP, IVOIRE, CHAMP),
    # Sceau seul, or et sapin
    'sceau-or.svg': seal(CHAMP),
    'sceau-sapin.svg': seal(SAPIN),
    # Symbole seul : affichage (original) et écran
    'symbole-affichage-or.svg': symbol(DISPLAY, CHAMP),
    'symbole-ecran-or.svg': symbol(SCREEN, CHAMP),
    'symbole-ecran-sapin.svg': symbol(SCREEN, SAPIN),
    # Favicon
    'icone.svg': icon(SAPIN, CHAMP),
}
for name, content in files.items():
    (OUT / name).write_text(content)

# Chemins pour les composants du site (couleurs par jetons) : même géométrie que horizontal() et seal().
if len(sys.argv) > 4:
    name_caps, nb = text(R, 500, 'MAISON TRIONA', 100, 0.24)
    byk_h, kb = text(I, 400, 'by K.', 62, 0.01)
    mh, gap_name, gap_k, cap = 200, 72, 36, 62.5
    ms = mh / SYM_H
    x_name = SYM_W * ms + gap_name
    main_w = x_name + (nb[2] - nb[0])
    r, stroke, smh = 478, 13, 540
    sms = smh / SYM_H
    n = lambda v: round(v, 2)
    data = {
        'height': mh,
        'baseline': n(mh / 2 + cap / 2),
        'main': {'width': n(main_w), 'markScale': n(ms * 1e5) / 1e5, 'nameX': n(x_name - nb[0])},
        'byK': {'width': n(gap_k + kb[2] - kb[0]), 'x': n(gap_k - kb[0])},
        'seal': {
            'ring': f'M500 {500 - r}a{r} {r} 0 1 0 0.01 0ZM500 {500 - r + stroke}a{r - stroke} {r - stroke} 0 1 0 0.01 0Z',
            'markX': n((1000 - SYM_W * sms) / 2),
            'markY': n((1000 - smh) / 2 + 12),
            'markScale': n(sms * 1e5) / 1e5,
        },
        'mark': re.search(r'd="([^"]+)"', SCREEN).group(1),
        'name': name_caps,
        'byKPath': byk_h,
    }
    body = json.dumps(data, indent=2, ensure_ascii=False)
    Path(sys.argv[4]).write_text(
        '// Généré par scripts/kit-logo.py (D48, D49) : ne pas modifier à la main.\n'
        '// Logo horizontal (T écran, « MAISON TRIONA » en Cormorant Garamond Medium vectorisé,\n'
        '// « by K. » en italique) et sceau, dans des boîtes de 200 et 1 000 unités.\n'
        f'export const LOGO = {body} as const\n'
    )
print('\n'.join(sorted(files)))
