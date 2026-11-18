import type { ReactNode } from 'react'
import { TransitionPage } from '@/components/layout/TransitionPage'

// Se remonte à chaque navigation interne : la page qui arrive apparaît en fondu (M6, D37).

export default function SiteTemplate({ children }: { children: ReactNode }) {
  return <TransitionPage>{children}</TransitionPage>
}
