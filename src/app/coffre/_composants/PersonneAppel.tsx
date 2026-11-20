'use client'

import { telHref } from '@/lib/booking/agenda'
import { LANGUES, libelle, ORIGINES } from '@/lib/coffre/libelles'

import { useAppelsDechiffres } from './DeverrouillageAppels'

// La personne d'un appel (story 3.13) : nom, numéro (lien `tel:` pour appeler depuis le téléphone),
// langue de l'appel, « pas de message vocal », origine. Rien avant le déverrouillage dans le
// navigateur (DeverrouillageAppels) ; rendu comme texte. « Pas de message vocal » n'est pas recueilli
// (une mention de la page de réservation, story 3.10) : c'est la règle de la maison (D41), rappelée
// à chaque appel.

export function PersonneAppel({ id }: { id: string }) {
  const ouverts = useAppelsDechiffres()
  const champs = ouverts?.get(id)

  if (!ouverts || champs === undefined) {
    return <p className="text-body-s text-encre">Nom et numéro chiffrés.</p>
  }
  if (champs === null) {
    return (
      <p className="text-body-s text-encre">
        Erreur : cet appel ne s’ouvre avec aucune des clés déverrouillées.
      </p>
    )
  }

  const lien = telHref(champs.telephone)
  const lignes = [
    { libelle: 'Nom', valeur: champs.nom },
    {
      libelle: 'Numéro',
      valeur: lien ? (
        <a
          href={lien}
          className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
        >
          {champs.telephone}
        </a>
      ) : (
        champs.telephone
      ),
    },
    { libelle: 'Langue de l’appel', valeur: libelle(LANGUES, champs.langue) },
    { libelle: 'Message vocal', valeur: 'Ne pas en laisser' },
    { libelle: 'Origine', valeur: libelle(ORIGINES, champs.origine) },
  ]

  return (
    <dl className="flex flex-col gap-8">
      {lignes.map(({ libelle: titre, valeur }) => (
        <div key={titre} className="flex flex-wrap items-baseline gap-x-16">
          <dt className="text-label text-encre uppercase">{titre}</dt>
          <dd className="text-body text-encre wrap-break-word">{valeur}</dd>
        </div>
      ))}
    </dl>
  )
}
