/**
 * Brouillon du formulaire dans le stockage de session (docs/architecture.md §6.1, D26) : quatre
 * champs non sensibles seulement (besoin, pays, langue, créneau), sous les clés `mt-draft-*`.
 * Jamais le nom, le contact, « pour qui », l'urgence, l'origine ni le mot libre. Effacé quand la
 * demande est traitée. La présélection du besoin (liens `data-besoin` des pages de service, de
 * l'accueil) écrit la même clé : rien ne passe par l'URL ni par les journaux du serveur.
 * Stockage indisponible (navigation privée, quota) : on continue sans brouillon.
 */

export const CHAMPS_BROUILLON = ['besoin', 'pays', 'langue', 'creneau'] as const
export type ChampBrouillon = (typeof CHAMPS_BROUILLON)[number]
export const PREFIXE_BROUILLON = 'mt-draft-'

export function estChampBrouillon(nom: string): nom is ChampBrouillon {
  return (CHAMPS_BROUILLON as readonly string[]).includes(nom)
}

export function lireBrouillon(champ: ChampBrouillon): string | null {
  try {
    return window.sessionStorage.getItem(PREFIXE_BROUILLON + champ)
  } catch {
    return null
  }
}

export function ecrireBrouillon(champ: ChampBrouillon, valeur: string): void {
  try {
    window.sessionStorage.setItem(PREFIXE_BROUILLON + champ, valeur)
  } catch {
    // Stockage refusé : la présélection est un confort, pas une condition.
  }
}

export function effacerBrouillon(): void {
  try {
    for (const champ of CHAMPS_BROUILLON)
      window.sessionStorage.removeItem(PREFIXE_BROUILLON + champ)
  } catch {
    // Rien à effacer.
  }
}
