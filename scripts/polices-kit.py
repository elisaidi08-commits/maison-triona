"""Polices du site. Prototype D76 : Plus Jakarta Sans pour les titres (graisses 400 à 500, comme la
maquette Figma) et Inter pour le texte (400 à 600, taille optique fixée à 14, la version « texte »). Kit précédent (D43, D50), gardé pour revenir en arrière :
Cormorant Garamond (300 à 400) et EB Garamond (400 à 500). Polices variables réduites à leur plage de graisses, sous-ensemble latin du
français, en woff2 : deux fichiers préchargés pour un budget de 80 ko (docs/architecture.md).

Prérequis (outil de développement, hors du site) :
  python3 -m venv .venv-kit && .venv-kit/bin/pip install fonttools brotli
  Polices (licence OFL) dans <polices>/ : PlusJakartaSans.ttf (fichier [wght]) et Inter.ttf (fichier
  [opsz,wght]) de https://github.com/google/fonts/tree/main/ofl/plusjakartasans et .../ofl/inter (kit précédent :
  CormorantGaramond.ttf et EBGaramond.ttf, .../ofl/cormorantgaramond et .../ofl/ebgaramond).
Usage :
  .venv-kit/bin/python -I scripts/polices-kit.py <polices> src/fonts
"""
import io
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])

# Latin de base et Latin-1, Œ œ Ÿ, ponctuation française (espaces fines insécables, trait d'union
# insécable de « vous‑même », guillemets, apostrophe typographique, tirets, points de suspension,
# puce, point médian) et l'euro.
UNICODES = [
    *range(0x20, 0x7F), *range(0xA0, 0x100),
    0x131, 0x152, 0x153, 0x178, 0x2C6, 0x2DC,
    0x2009, 0x200A, 0x2011, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
    0x2022, 0x2026, 0x202F, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2212,
]

JOBS = [
    ('PlusJakartaSans.ttf', {'wght': (400, 500)}, 'plus-jakarta-sans.woff2'),
    # Inter : taille optique fixée à 14 (dessin « texte ») : 24 ko au lieu de 36 avec l'axe entier.
    ('Inter.ttf', {'wght': (400, 600), 'opsz': 14}, 'inter.woff2'),
]

for source, axes, target in JOBS:
    # Réenregistrer la police réduite avant le sous-ensemble (variations gvar à matérialiser).
    buffer = io.BytesIO()
    instantiateVariableFont(TTFont(SRC / source), axes).save(buffer)
    buffer.seek(0)
    font = TTFont(buffer)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
    options.name_IDs = ['*']  # garde le copyright et la licence OFL
    options.hinting = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(OUT / target)
    print(f'{target} : {(OUT / target).stat().st_size / 1024:.1f} ko, graisses {axes["wght"][0]} à {axes["wght"][1]}')
