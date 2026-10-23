import Link from 'next/link'
import type { ReactNode } from 'react'

// Bouton plein (docs/art-direction.md §7.5) : aplat sapin, texte ivoire, bordure or 1 px, rayon 0,
// hauteur 52 px, libellé en corps 18 px comme le lien. Survol : bordure champagne et filet sous
// le texte qui se dessine (M4). Lisible sur sapin comme sur ivoire (« Continuer » du formulaire).
// Variante `discret` (« Retour ») : texte sapin sans aplat ni bordure, filet or permanent, comme
// le lien à filet (la commande ne repose pas sur la seule couleur, WCAG 1.4.1).
// États du formulaire (lot 4) : `disabled` (bordure sauge, texte encre 68 %) et `pending` (envoi
// en cours : même aplat, seul le libellé change, en ivoire 80 % ; rien qui inquiète au moment
// d'envoyer). L'annonce de l'envoi aux lecteurs d'écran revient au formulaire (`aria-live`).

const BASE =
  'group inline-flex min-h-button items-center justify-center text-body transition-colors duration-micro ease-standard'

const VARIANTS = {
  plein: 'border border-or bg-sapin px-32 text-ivoire hover:border-champagne',
  discret: 'text-sapin hover:text-cypres',
} as const

const INACTIF = 'cursor-not-allowed border border-sauge px-32 text-encre-68'
const EN_COURS = 'border border-or bg-sapin px-32 text-ivoire-80'

type Variant = keyof typeof VARIANTS

type CommonProps = {
  children: ReactNode
  variant?: Variant
}

type ButtonProps =
  | (CommonProps & { href: string; type?: never; disabled?: never; pending?: never })
  | (CommonProps & {
      href?: never
      type?: 'button' | 'submit'
      disabled?: boolean
      // Libellé affiché pendant l'envoi (« Envoi en cours »), fourni par messages/*.json.
      pending?: string
    })

function Label({ children, variant }: { children: ReactNode; variant: Variant }) {
  return variant === 'discret' ? (
    <span className="underline decoration-or decoration-1 underline-offset-8">{children}</span>
  ) : (
    <span className="filet-survol">{children}</span>
  )
}

export function Button({
  children,
  href,
  type = 'button',
  variant = 'plein',
  disabled = false,
  pending,
}: ButtonProps) {
  if (href) {
    return (
      <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
        <Label variant={variant}>{children}</Label>
      </Link>
    )
  }

  if (disabled) {
    return (
      <button type={type} disabled className={`${BASE} ${INACTIF}`}>
        {children}
      </button>
    )
  }

  if (pending) {
    // Pas de `disabled` pendant l'envoi : le bouton garde le focus ; `aria-disabled` le dit inerte
    // et le formulaire ignore un second envoi.
    return (
      <button type={type} aria-disabled="true" aria-busy="true" className={`${BASE} ${EN_COURS}`}>
        {pending}
      </button>
    )
  }

  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]} cursor-pointer`}>
      <Label variant={variant}>{children}</Label>
    </button>
  )
}
