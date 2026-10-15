import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Liens et redirections qui respectent la langue et les chemins localisés.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
