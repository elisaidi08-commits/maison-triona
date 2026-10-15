import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { Rule } from '@/components/ui/Rule'
import { Stamp } from '@/components/ui/Stamp'
import { TextField } from '@/components/ui/TextField'
import { TextLink } from '@/components/ui/TextLink'
import { contrastLevel, contrastRatio } from '@/lib/contrast'
import {
  benchCormorant,
  benchInstrument,
  benchNewsreader,
  benchNewsreaderDisplay,
  benchNewsreaderStatic,
} from './fonts'

// Banc d'essai interne (story 1.2) : tokens, typographie, composants de base.
// Jamais indexé, absent de la production (déplacé sous /fr/demo en story 1.4).

export const metadata: Metadata = {
  title: 'Banc d’essai · Maison Triona',
  robots: { index: false, follow: false },
}

const PALETTE = [
  { token: 'ivoire', hex: '#F4EDE0', role: 'Fond principal' },
  { token: 'pierre', hex: '#D8C8AE', role: 'Surface secondaire rare' },
  { token: 'sapin', hex: '#1C3B2A', role: 'Signature (à trancher) : titres, bloc Contact, focus' },
  { token: 'cypres', hex: '#3F5A3C', role: 'Vert secondaire : numéros, survols' },
  { token: 'sauge', hex: '#9AAE8F', role: 'Filets sur fond sombre, désactivé' },
  { token: 'or', hex: '#B8944D', role: 'Filets, point du « K. », bordure de bouton sur sapin' },
  { token: 'champagne', hex: '#D2B98A', role: 'Seul or autorisé en texte, sur sapin uniquement' },
  { token: 'encre', hex: '#1F1E1A', role: 'Texte courant' },
  { token: 'encre-68', hex: '#1F1E1AAD', role: 'Texte secondaire, ligne des champs' },
  { token: 'ivoire-80', hex: '#F4EDE0CC', role: 'Texte secondaire sur sapin' },
  { token: 'terracotta', hex: '#A66A4E', role: 'Ligne des champs en erreur' },
] as const

const SWATCH_BG: Record<(typeof PALETTE)[number]['token'], string> = {
  ivoire: 'bg-ivoire',
  pierre: 'bg-pierre',
  sapin: 'bg-sapin',
  cypres: 'bg-cypres',
  sauge: 'bg-sauge',
  or: 'bg-or',
  champagne: 'bg-champagne',
  encre: 'bg-encre',
  'encre-68': 'bg-encre-68',
  'ivoire-80': 'bg-ivoire-80',
  terracotta: 'bg-terracotta',
}

const HEX = Object.fromEntries(PALETTE.map(({ token, hex }) => [token, hex])) as Record<
  (typeof PALETTE)[number]['token'],
  string
>

// texte = paire de texte ; interface = bordure, ligne ou anneau (WCAG 1.4.11, 3:1) ;
// controle = paire interdite en texte, affichée pour le prouver.
const PAIRS = [
  ['encre', 'ivoire', 'Corps de texte', 'texte'],
  ['encre', 'pierre', 'Corps sur pierre', 'texte'],
  ['sapin', 'ivoire', 'Titres, liens', 'texte'],
  ['sapin', 'pierre', 'Titre sur pierre', 'texte'],
  ['ivoire', 'sapin', 'Texte du bloc Contact', 'texte'],
  ['ivoire-80', 'sapin', 'Texte secondaire sur sapin', 'texte'],
  ['champagne', 'sapin', 'Label, focus sur sombre', 'texte'],
  ['cypres', 'ivoire', 'Numéros, survols (jamais le corps)', 'texte'],
  ['encre-68', 'ivoire', 'Ligne des champs au repos, placeholders', 'texte'],
  ['or', 'sapin', 'Bordure de bouton', 'interface'],
  ['terracotta', 'ivoire', 'Ligne d’erreur des champs', 'interface'],
  ['or', 'ivoire', 'Or en texte sur ivoire', 'controle'],
  ['champagne', 'ivoire', 'Champagne en texte sur ivoire', 'controle'],
] as const

function pairLevel(ratio: number, kind: (typeof PAIRS)[number][3]): string {
  if (kind === 'interface') return ratio >= 3 ? 'interface seulement (≥ 3:1)' : 'insuffisant'
  if (kind === 'controle') return 'interdit en texte'
  return contrastLevel(ratio)
}

const SCALE = [
  { token: 'display-xl', spec: 'Display Light · 44 → 72 px · interligne 1,06', display: true },
  { token: 'display-l', spec: 'Display Light · 38 → 56 px · interligne 1,08', display: true },
  { token: 'title-h2', spec: 'Display Regular · 32 → 44 px · interligne 1,15', display: true },
  { token: 'title-h3', spec: 'Manrope Medium · 20 → 24 px · interligne 1,35', display: false },
  { token: 'body-l', spec: 'Manrope Regular · 18 → 20 px · interligne 1,7', display: false },
  { token: 'body', spec: 'Manrope Regular · 18 px partout · interligne 1,65', display: false },
  {
    token: 'body-s',
    spec: 'Manrope Regular · 16 px · mentions et aides seulement',
    display: false,
  },
  { token: 'label', spec: 'Manrope Medium · 13 px · capitales · +0,12 em', display: false },
  { token: 'nav', spec: 'Manrope Medium · 16 px · +0,01 em', display: false },
] as const

const SCALE_CLASS: Record<(typeof SCALE)[number]['token'], string> = {
  'display-xl': 'text-display-xl',
  'display-l': 'text-display-l',
  'title-h2': 'text-title-h2',
  'title-h3': 'text-title-h3',
  'body-l': 'text-body-l',
  body: 'text-body',
  'body-s': 'text-body-s',
  label: 'text-label uppercase',
  nav: 'text-nav',
}

const CANDIDATES = [
  {
    id: 'newsreader',
    name: 'Newsreader, taille optique complète (Google)',
    note: 'Référence : axe de taille optique de 6 à 72, déliés fins en grand, solides en moyen corps. 128 ko, hors budget.',
    font: benchNewsreader,
  },
  {
    id: 'newsreader-display',
    name: 'Newsreader, tailles display 32 à 72 (locale)',
    note: 'Proposée : même dessin que la référence entre 32 et 72 px, Light et Regular. 60 ko, soit 84 ko avec Manrope (budget 80 ko).',
    font: benchNewsreaderDisplay,
  },
  {
    id: 'newsreader-sans-opsz',
    name: 'Newsreader sans taille optique (Google)',
    note: 'Version provisoire du site : 56 ko, mais taille optique de texte (18) agrandie, plus épaisse en grand. Déconseillée par le directeur artistique.',
    font: benchNewsreaderStatic,
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    note: 'Alternative classique, petit œil, fragile sous 40 px ; circonflexes très hauts en Light, gênants en français. 36 ko.',
    font: benchCormorant,
  },
  {
    id: 'instrument',
    name: 'Instrument Serif',
    note: 'Une seule graisse (le Light retombe sur le Regular), condensée, très vue en 2024-2025. 14 ko.',
    font: benchInstrument,
  },
] as const

// Accroche validée par Cat ; les autres textes de la page sont des essais, non publiés.
const ACCROCHE = 'Une seconde vie, comme des vacances qui ne s’arrêtent pas.'

const CHOICES = [
  {
    href: '#liste',
    number: '01',
    label: 'Organiser le quotidien',
    category: 'Conciergerie de luxe',
  },
  {
    href: '#liste',
    number: '02',
    label: 'Accompagner un proche, ou vous-même',
    category: 'Accompagnement du grand âge',
  },
  { href: '#liste', number: '03', label: 'Prendre soin des enfants', category: 'Garde d’enfants' },
  { href: '#liste', label: 'Je ne sais pas encore', note: 'Parlons-en, en toute discrétion.' },
]

function SectionTitle({ id, label, title }: { id: string; label: string; title: string }) {
  return (
    <div className="flex flex-col gap-16">
      <Rule short />
      <p className="text-label text-encre uppercase">{label}</p>
      <h2 id={id} className="font-display text-title-h2 text-sapin">
        {title}
      </h2>
    </div>
  )
}

export default function DemoPage() {
  if (process.env.VERCEL_ENV === 'production') notFound()

  return (
    <main className="mx-auto flex max-w-content flex-col gap-128 px-margin py-96">
      <header className="flex max-w-measure flex-col gap-24">
        <p className="text-label text-encre uppercase">Banc d’essai · story 1.2</p>
        <h1 className="font-display text-display-l text-sapin">Tokens et typographie</h1>
        <p>
          Page interne, jamais indexée et absente de la production. Elle sert à choisir la serif
          display et le vert signature sur pièce, sur ivoire et sur sapin. Hormis l’accroche, les
          textes sont des essais.
        </p>
      </header>

      <section aria-labelledby="palette" className="flex flex-col gap-48">
        <SectionTitle id="palette" label="Couleurs" title="Palette" />
        <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {PALETTE.map(({ token, hex, role }) => (
            <li key={token} className="flex flex-col gap-12">
              {token === 'ivoire-80' ? (
                // Couleur à alpha, montrée sur son seul fond autorisé (sapin).
                <span aria-hidden="true" className="block bg-sapin p-16">
                  <span className={`block h-64 ${SWATCH_BG[token]}`} />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className={`block h-96 border border-sapin-20 ${SWATCH_BG[token]}`}
                />
              )}
              <span className="text-title-h3">{token}</span>
              <span className="text-body-s text-encre">
                {hex} · {role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="contrastes" className="flex flex-col gap-48">
        <SectionTitle id="contrastes" label="Accessibilité" title="Contrastes calculés" />
        <p className="max-w-measure">
          Ratios recalculés à chaque build (WCAG 2.x, alpha composé sur le fond). AAA = 7:1 pour le
          texte courant ; les deux dernières lignes sont des contrôles de paires interdites.
        </p>
        {/* Zone défilante en mobile, atteignable au clavier (WCAG 2.1.1). */}
        <div
          role="region"
          aria-label="Tableau des contrastes"
          tabIndex={0}
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-or">
                <th scope="col" className="py-12 pr-16 text-label uppercase">
                  Texte
                </th>
                <th scope="col" className="py-12 pr-16 text-label uppercase">
                  Fond
                </th>
                <th scope="col" className="py-12 pr-16 text-label uppercase">
                  Ratio
                </th>
                <th scope="col" className="py-12 pr-16 text-label uppercase">
                  Niveau
                </th>
                <th scope="col" className="py-12 text-label uppercase">
                  Usage
                </th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map(([fore, back, usage, kind]) => {
                const ratio = contrastRatio(HEX[fore], HEX[back])
                return (
                  <tr key={`${fore}-${back}`} className="border-b border-sapin-20">
                    <td className="py-12 pr-16">{fore}</td>
                    <td className="py-12 pr-16">{back}</td>
                    <td className="py-12 pr-16">{ratio.toFixed(2).replace('.', ',')}:1</td>
                    <td className="py-12 pr-16">{pairLevel(ratio, kind)}</td>
                    <td className="py-12 text-body-s">{usage}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="echelle" className="flex flex-col gap-48">
        <SectionTitle id="echelle" label="Typographie" title="Échelle typographique" />
        <ul className="flex flex-col">
          {SCALE.map(({ token, spec, display }) => (
            <li key={token} className="flex flex-col gap-8 border-b border-sapin-20 py-24">
              <span className="text-label text-cypres uppercase">
                {token} · {spec}
              </span>
              <span
                className={`${SCALE_CLASS[token]} ${display ? 'font-display text-balance text-sapin' : 'text-encre'}`}
              >
                {display ? ACCROCHE : 'Chaque mot mérite son espace, et chaque phrase son air.'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="banc" className="flex flex-col gap-48">
        <SectionTitle
          id="banc"
          label="Décision à prendre"
          title="Banc d’essai de la serif display"
        />
        <p className="max-w-measure">
          Mêmes textes, mêmes corps, sur ivoire puis sur sapin, lignes équilibrées. La ligne en
          italique teste un seul mot (règle n° 18 des anti-patterns) ; le directeur artistique la
          déconseille. Satoshi, sans empattement, n’est pas testée ici.
        </p>
        {CANDIDATES.map(({ id, name, note, font }) => (
          <article key={name} aria-labelledby={`banc-${id}`} className="flex flex-col gap-24">
            <div className="flex flex-col gap-8">
              <h3 id={`banc-${id}`} className="text-title-h3 text-sapin">
                {name}
              </h3>
              <p className="text-body-s">{note}</p>
            </div>
            <div className="flex flex-col gap-32 border border-sapin-20 p-24 md:p-48">
              <p className={`${font.className} text-display-xl font-light text-balance text-sapin`}>
                {ACCROCHE}
              </p>
              <p className={`${font.className} text-display-xl font-light text-balance text-sapin`}>
                Une seconde vie, comme des <em>vacances</em> qui ne s’arrêtent pas.
              </p>
              <p className={`${font.className} text-title-h2 font-normal text-sapin`}>
                Parlons-en, en toute discrétion.
              </p>
              <p className={`${font.className} text-stamp-lg text-sapin`} aria-hidden="true">
                K<span className="text-or">.</span>
              </p>
            </div>
            <div data-surface="sapin" className="flex flex-col gap-32 p-24 md:p-48">
              <p className={`${font.className} text-display-xl font-light text-balance`}>
                {ACCROCHE}
              </p>
              <p className={`${font.className} text-title-h2 font-normal`}>
                Parlons-en, en toute discrétion.
              </p>
              <p className="max-w-measure text-ivoire-80">
                Texte secondaire en ivoire 80 % sur sapin, pour juger l’ensemble.
              </p>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="vert" className="flex flex-col gap-48">
        <SectionTitle
          id="vert"
          label="Décision à prendre"
          title="Vert signature : sapin ou cyprès"
        />
        <p className="max-w-measure">
          Même titre, même lien, même numéro, en sapin puis en cyprès. Le bloc Contact reste en
          sapin dans les deux cas. Décision finale à prendre sur le logo réel.
        </p>
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {(
            [
              ['sapin', '#1C3B2A · 10,56:1 sur ivoire', 'text-sapin'],
              ['cyprès', '#3F5A3C · 6,58:1 sur ivoire', 'text-cypres'],
            ] as const
          ).map(([name, spec, color]) => (
            <div key={name} className="flex flex-col gap-24 border border-sapin-20 p-24 md:p-48">
              <p className="text-label text-encre uppercase">
                {name} · {spec}
              </p>
              <p className={`font-display text-title-h2 text-balance ${color}`}>
                Parlons-en, en toute discrétion.
              </p>
              <p className={`flex items-baseline gap-24 ${color}`}>
                <span className="text-label">01</span>
                <a
                  href="#vert"
                  className="inline-flex min-h-touch items-center underline decoration-or decoration-1 underline-offset-8"
                >
                  Parlez-nous de votre situation
                </a>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="filets" className="flex flex-col gap-48">
        <SectionTitle id="filets" label="Formes" title="Filets et cachet" />
        <div className="flex flex-col gap-32">
          <p className="text-body-s">
            Filet or · filet discret (sapin 20 %) · filet court de 48 px
          </p>
          <Rule tone="or" />
          <Rule tone="discret" />
          <Rule short />
        </div>
        <div className="flex flex-wrap items-end gap-64">
          <Stamp size="sm" />
          <Stamp size="md" />
          <Stamp size="lg" />
        </div>
        <div data-surface="sapin" className="flex flex-wrap items-end gap-64 p-24 md:p-48">
          <Rule tone="sauge" short />
          <Stamp size="md" onDark />
        </div>
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-48">
        <SectionTitle id="actions" label="Interactions" title="Bouton, lien et focus" />
        <p className="max-w-measure">
          Tabulez pour voir l’anneau de focus de 3 px : sapin sur ivoire, champagne sur sapin.
        </p>
        <p>
          <TextLink href="#actions">Parlez-nous de votre situation</TextLink>
        </p>
        <div data-surface="sapin" className="flex flex-col items-start gap-24 p-24 md:p-48">
          <p className="text-label text-champagne uppercase">Contact</p>
          <Button href="#actions">Nous écrire</Button>
        </div>
      </section>

      <section aria-labelledby="champs" className="flex flex-col gap-48">
        <SectionTitle id="champs" label="Formulaire" title="Champs" />
        <div className="flex max-w-measure flex-col gap-48">
          <TextField id="demo-nom" name="nom" label="Nom" autoComplete="name" />
          <TextField
            id="demo-message"
            name="message"
            label="Un mot libre (facultatif)"
            hint="Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix."
          />
          <TextField
            id="demo-email"
            name="email"
            type="email"
            label="E-mail"
            autoComplete="email"
            error="Erreur : merci d’indiquer une adresse e-mail valide."
          />
        </div>
      </section>

      <section aria-labelledby="liste" className="flex flex-col gap-48">
        <SectionTitle id="liste" label="Entrée par besoin" title="Liste d’entrée" />
        <div className="max-w-measure">
          <ChoiceList choices={CHOICES} />
        </div>
      </section>
    </main>
  )
}
