// Durées des sessions du coffre (story 3.2, parties C et D ; docs/architecture.md §6.5), sans
// dépendance ni secret : lues par le serveur (src/lib/auth/config.ts les réexporte) et par le
// navigateur (src/app/coffre/_composants/LectureDemande.tsx verrouille la lecture après la même
// inactivité). Repère : OWASP ASVS 4.0.3, V3.3.2, niveau 3 (nouvelle authentification au plus tard
// après 12 heures, ou 15 minutes d'inactivité). La durée maximale est ramenée à une journée de
// travail ; l'inactivité suit le niveau 3, le coffre affiche des demandes qui peuvent révéler une
// situation de santé.

export const DUREE_MAX_SESSION_S = 8 * 60 * 60
export const INACTIVITE_MAX_S = 15 * 60
