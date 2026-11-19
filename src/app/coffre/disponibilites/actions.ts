'use server'

import { redirect } from 'next/navigation'

import { lireAccesRequete } from '@/lib/auth/serveur'
import {
  addLeave,
  addRule,
  blockDay,
  prefillHolidays,
  removeAbsence,
  removeRule,
  setHolidays,
  updateSettings,
} from '@/lib/booking/repository'
import { DEFAULT_BOOKING_SETTINGS } from '@/lib/booking/settings'
import { zonedParts } from '@/lib/booking/zoned-time'
import { adresseRetour } from '@/lib/coffre/disponibilites'
import type { ErreurDisponibilites, Statut } from '@/lib/coffre/disponibilites'
import { getCoffrePool } from '@/lib/db/pool'
import {
  validerAbsence,
  validerAnnee,
  validerIdentifiant,
  validerJournee,
  validerJoursFeries,
  validerPlage,
  validerReglages,
} from '@/lib/validation/disponibilites'

// Formulaires de /coffre/disponibilites (story 3.8, partie B) : POST natif vers ces actions, sans
// JavaScript nécessaire. Chacune revérifie l'accès (session ouverte par le TOTP), valide (Zod) puis
// écrit par src/lib/booking/repository.ts, qui inscrit `availability` au journal dans la même
// transaction, sans valeur. Retour sur la page avec un code (`?ok=` ou `?erreur=`), jamais une
// valeur reçue ; rien n'est journalisé ici. `redirect()` lève une exception : toujours hors des try.

// Une action sur les disponibilités n'aboutit jamais sans session ouverte par le second facteur.
async function accesAutorise() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  return acces
}

function retour(statut: NonNullable<Statut>): never {
  redirect(adresseRetour(statut))
}

function erreur(code: ErreurDisponibilites): never {
  retour({ erreur: code })
}

// Écriture en base : une panne (base injoignable, contrainte) devient « indisponible », sans détail.
async function ecrire<T>(operation: () => Promise<T>): Promise<{ ok: true; valeur: T } | null> {
  try {
    return { ok: true, valeur: await operation() }
  } catch {
    return null
  }
}

function aujourdhui(): string {
  return zonedParts(new Date(), DEFAULT_BOOKING_SETTINGS.timeZone).date
}

export async function enregistrerReglages(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerReglages(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => updateSettings(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  retour({ ok: 'reglages' })
}

export async function ajouterPlage(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerPlage(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => addRule(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  if (fait.valeur === 'overlap') erreur('plage-chevauchement')
  retour({ ok: 'plage-ajoutee' })
}

export async function retirerPlage(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerIdentifiant(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => removeRule(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  if (!fait.valeur) erreur('identifiant')
  retour({ ok: 'plage-retiree' })
}

export async function ajouterAbsence(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerAbsence(donnees, aujourdhui())
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => addLeave(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  retour({ ok: 'absence-ajoutee' })
}

// Congé ou journée bloquée ; un jour férié se décoche (enregistrerJoursFeries).
export async function retirerAbsence(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerIdentifiant(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => removeAbsence(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  if (!fait.valeur) erreur('identifiant')
  retour({ ok: 'absence-retiree' })
}

// « Bloquer cette journée », en un clic depuis l'aperçu. Les appels déjà confirmés ce jour-là sont
// gardés ; la page les signale dans la liste des absences (listConfirmedCalls, story 3.10).
export async function bloquerJournee(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerJournee(donnees, aujourdhui())
  if (!lu.ok) erreur(lu.erreur)
  // Déjà bloquée (double clic) : même réponse.
  const fait = await ecrire(() => blockDay(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  retour({ ok: 'journee-bloquee' })
}

export async function enregistrerJoursFeries(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerJoursFeries(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => setHolidays(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  retour({ ok: 'feries' })
}

export async function preremplirJoursFeries(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerAnnee(donnees)
  if (!lu.ok) erreur(lu.erreur)
  const fait = await ecrire(() => prefillHolidays(getCoffrePool(), lu.valeur, acces.compte.email))
  if (!fait) erreur('indisponible')
  retour({ ok: 'feries-preremplis' })
}
