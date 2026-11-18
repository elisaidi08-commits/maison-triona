// Filet 1 px : or (ivoire et sapin), discret (sapin à 20 % sur ivoire). Sauge, hors kit, retirée (D64).
// `short` = filet de 48 px, toujours décoratif (avant un label ou le « K. »).

const TONES = {
  or: 'border-or',
  discret: 'border-sapin-20',
} as const

type RuleProps = {
  tone?: keyof typeof TONES
  short?: boolean
}

export function Rule({ tone = 'or', short = false }: RuleProps) {
  if (short) {
    return <span aria-hidden="true" className={`block w-48 border-t ${TONES[tone]}`} />
  }
  return <hr className={`m-0 w-full border-0 border-t ${TONES[tone]}`} />
}
