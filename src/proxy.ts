import createMiddleware from 'next-intl/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { creerNonce, cspCoffre, estCheminCoffre } from './lib/coffre/securite'

// Site public : préfixe de langue (/ → /fr) et chemins localisés, sans détection ni cookie
// (routing.ts). Coffre (/coffre, story 3.2 C) : hors de next-intl ; CSP à nonce, neuve à chaque
// requête, posée sur la requête (Next y lit le nonce de ses scripts) et sur la réponse. Les autres
// en-têtes du coffre (noindex, no-store…) sont dans next.config.ts.

const intl = createMiddleware(routing)
const dev = process.env.NODE_ENV === 'development'
const deploye = Boolean(process.env.VERCEL_ENV)

export default function proxy(request: NextRequest) {
  if (!estCheminCoffre(request.nextUrl.pathname)) return intl(request)

  const csp = cspCoffre(creerNonce(), { dev, deploye })
  const entetes = new Headers(request.headers)
  entetes.set('Content-Security-Policy', csp)
  const reponse = NextResponse.next({ request: { headers: entetes } })
  reponse.headers.set('Content-Security-Policy', csp)
  return reponse
}

// Second motif : tout /coffre, y compris une adresse avec un point (`/coffre/x.y`), que le premier
// écarte ; elle reçoit aussi la CSP du coffre.
export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)', '/coffre/:path*'],
}
