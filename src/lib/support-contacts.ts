/**
 * Contatti di assistenza mostrati all'utente finale.
 *
 * Modulo separato di proposito: `login/actions.ts` è `'use server'`, dove tutti
 * gli export devono essere funzioni async — una costante esportata da lì non
 * compila. Da qui la importano sia il Server Action sia la pagina client, così
 * l'indirizzo vive in un solo posto.
 */

/** Ufficio che associa un indirizzo email a un'utenza che ne è priva. */
export const CED_EMAIL = 'ced.segnalazioni@acquambientemarche.it'

/**
 * Messaggio per l'utenza esistente ma senza email a sistema: non potendo inviare
 * il link di attivazione, la si indirizza al CED. Testo fornito dal committente,
 * riportato alla lettera.
 */
export const NO_EMAIL_ON_FILE_MESSAGE =
    'Non è stato possibile completare la richiesta è necessario contattare ' +
    `l'ufficio CED tramite mail ${CED_EMAIL} inserendo il proprio nome cognome, ` +
    "codice utente, indirizzo mail e il numero di cellulare da associare all'utenza"
