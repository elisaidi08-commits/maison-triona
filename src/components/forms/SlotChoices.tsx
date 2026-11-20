import { ChoiceRow } from '@/components/ui/ChoiceRow'
import type { CreneauAffiche } from '@/lib/booking/form'
import { grouperParSemaine, teteDeListe } from '@/lib/booking/grouping'

// Créneaux d'un appel, partagés par la réservation (story 3.10) et le déplacement (story 3.11) : en
// tête, les trois prochains (après un créneau pris, les trois plus proches de lui) ; puis les autres,
// par semaine (`fieldset`, `legend`) et par jour, en liste. Tous les choix portent le même `name` : un
// seul possible, d'un groupe à l'autre. Libellés composés sur le serveur (src/lib/booking/display.ts).

export type TextesCreneaux = { legend: string; next: string; nearby: string; week: string }

type SlotChoicesProps = {
  /** Préfixe des identifiants : `<prefixe>-creneau` (tête), `<prefixe>-jour-<date>`. */
  prefixe: string
  creneaux: CreneauAffiche[]
  /** Début du créneau qui vient d'être pris : ses voisins viennent en tête. */
  creneauPris?: string
  defaultValue?: string
  error?: string
  textes: TextesCreneaux
}

export function SlotChoices({
  prefixe,
  creneaux,
  creneauPris,
  defaultValue,
  error,
  textes,
}: SlotChoicesProps) {
  const tete = teteDeListe(creneaux, creneauPris)
  const semaines = grouperParSemaine(creneaux, tete)
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-48 border-0 p-0">
      <legend className="mb-24 p-0 font-display text-title-h2 text-sapin">{textes.legend}</legend>
      <ChoiceRow
        id={`${prefixe}-creneau`}
        name="creneau"
        legend={creneauPris ? textes.nearby : textes.next}
        required
        defaultValue={defaultValue}
        error={error}
        options={tete.map((creneau) => ({
          value: creneau.debut,
          label: `${creneau.libelleJour}, ${creneau.libelleHeure}`,
        }))}
      />
      {semaines.map((semaine) => (
        <fieldset key={semaine.semaine} className="m-0 flex min-w-0 flex-col gap-32 border-0 p-0">
          <legend className="mb-16 p-0 text-label text-encre uppercase">
            {textes.week.replace('{date}', semaine.libelle)}
          </legend>
          {semaine.jours.map((jour) => (
            <ChoiceRow
              key={jour.jour}
              id={`${prefixe}-jour-${jour.jour}`}
              name="creneau"
              legend={jour.libelle}
              required
              columns={3}
              defaultValue={defaultValue}
              options={jour.creneaux.map((creneau) => ({
                value: creneau.debut,
                label: creneau.libelleHeure,
              }))}
            />
          ))}
        </fieldset>
      ))}
    </fieldset>
  )
}
