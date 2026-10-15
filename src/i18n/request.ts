import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { routing } from './routing'

// La langue vient du segment racine [locale] (next/root-params) : rendu statique, sans en-tête lu.
export default getRequestConfig(async ({ locale }) => {
  const value = locale ?? (await rootParams.locale())
  if (!hasLocale(routing.locales, value)) notFound()
  return {
    locale: value,
    messages: (await import(`../../messages/${value}.json`)).default,
  }
})
