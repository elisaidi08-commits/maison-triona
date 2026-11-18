import Link from 'next/link'
import type { ReactNode } from 'react'

// Bouton plein (docs/art-direction.md §7.5) : aplat sapin, texte ivoire, bordure or 1 px, rayon 0,
// hauteur 52 px, libellé en corps 18 px comme le lien. Survol : bordure champagne et filet sous
// le texte qui se dessine (M4). Lisible sur sapin comme sur ivoire (« Continuer » du formulaire).
// Variante `discret` (« Retour ») : texte sapin sans aplat ni bordure, filet or permanent, comme
// le lien à filet (la commande ne repose pas sur la seule couleur, WCAG 1.4.1) ; au survol, le filet
// passe au sapin (couleurs du kit, D64).
// États du formulaire (lot 4) : `disabled` (bordure sapin 20 %, texte encre 68 % ; un contrôle
// inactif n'a pas de seuil de contraste, WCAG 1.4.3) et `pending` (envoi
// en cours : même aplat, seul le libellé change, en ivoire 80 % ; rien qui inquiète au moment
// d'envoyer). L'annonce de l'envoi aux lecteurs d'écran revient au formulaire (`aria-live`).
// `besoin` (lien seulement) : pose `data-besoin`, lu par l'écouteur de présélection du formulaire
// (D26, story 3.4). `onClick` (bouton seulement) : « Retour » du formulaire en étapes.

const BASE =
  'group inline-flex min-h-button items-center justify-center text-body transition-colors duration-micro ease-standard'

const VARIANTS = {
  plein: 'border border-or bg-sapin px-32 text-ivoire hover:border-champagne',
  discret: 'text-sapin',
} as const

const INACTIF = 'cursor-not-allowed border border-sapin-20 px-32 text-encre-68'
const EN_COURS = 'border border-or bg-sapin px-32 text-ivoire-80'

type Variant = keyof typeof VARIANTS

type CommonProps = {
  children: ReactNode
  variant?: Variant
}

type ButtonProps =
  | (CommonProps & {
      href: string
      besoin?: string
      type?: never
      disabled?: never
      pending?: never
      onClick?: never
    })
  | (CommonProps & {
      href?: never
      besoin?: never
      type?: 'button' | 'submit'
      disabled?: boolean
      // Libellé affiché pendant l'envoi (« Envoi en cours »), fourni par messages/*.json.
      pending?: string
      onClick?: () => void
    })

function Label({ children, variant }: { children: ReactNode; variant: Variant }) {
  return variant === 'discret' ? (
    <span className="underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard group-hover:decoration-sapin">
      {children}
    </span>
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
  besoin,
  onClick,
}: ButtonProps) {
  if (href) {
    return (
      <Link href={href} data-besoin={besoin} className={`${BASE} ${VARIANTS[variant]}`}>
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
    <button type={type} onClick={onClick} className={`${BASE} ${VARIANTS[variant]} cursor-pointer`}>
      <Label variant={variant}>{children}</Label>
    </button>
  )
}
