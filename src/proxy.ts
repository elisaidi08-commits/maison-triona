import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Préfixe de langue (/ → /fr) et chemins localisés. Pas de détection ni de cookie (routing.ts).
export default createMiddleware(routing)

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
