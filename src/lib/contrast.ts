// Ratio de contraste WCAG 2.x entre deux couleurs hexadécimales.
// Une couleur à 8 chiffres (alpha) est d'abord composée sur le fond, comme à l'écran.

type Rgb = [number, number, number]

function parse(hex: string): { rgb: Rgb; alpha: number } {
  const value = hex.replace('#', '')
  const channel = (index: number) => parseInt(value.slice(index, index + 2), 16)
  return {
    rgb: [channel(0), channel(2), channel(4)],
    alpha: value.length === 8 ? channel(6) / 255 : 1,
  }
}

function luminance([r, g, b]: Rgb): number {
  const linear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(foreground: string, background: string): number {
  const back = parse(background).rgb
  const { rgb, alpha } = parse(foreground)
  // Composition sans arrondi, comme docs/tools/contrast-check.mjs.
  const front = rgb.map((c, i) => c * alpha + (back[i] ?? 0) * (1 - alpha)) as Rgb
  const [light, dark] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [
    number,
    number,
  ]
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA grand texte et interface' | 'insuffisant'

export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA grand texte et interface'
  return 'insuffisant'
}
