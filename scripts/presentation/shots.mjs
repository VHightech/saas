// Elenco canonico degli screenshot attesi dalla presentazione.
//
// Unica fonte di verità: il template li referenzia tramite `key`, il README
// chiede all'utente di produrre i file `file`, e il builder collega i due.
// Aggiungere uno screenshot significa toccare questo array e il template.

export const SHOTS = [
    {
        key: 'shot_01_home',
        file: '01-home.png',
        viewport: 'desktop',
        page: '/profile',
        what: 'Home del portale cliente: riepilogo, ultima bolletta, grafici',
    },
    {
        key: 'shot_02_bollette',
        file: '02-bollette.png',
        viewport: 'desktop',
        page: '/bollette',
        what: 'Elenco bollette con filtri per fornitura e periodo',
    },
    {
        key: 'shot_03_confronto',
        file: '03-confronto.png',
        viewport: 'desktop',
        page: '/confronto',
        what: 'Confronto consumi fra periodi e forniture',
    },
    {
        key: 'shot_04_mobile_home',
        file: '04-mobile-home.png',
        viewport: 'mobile',
        page: '/profile — scheda Home',
        what: 'Riepilogo su telefono',
    },
    {
        key: 'shot_05_mobile_bollette',
        file: '05-mobile-bollette.png',
        viewport: 'mobile',
        page: '/profile — scheda Bollette',
        what: 'Elenco bollette su telefono',
    },
    {
        key: 'shot_06_mobile_dettaglio',
        file: '06-mobile-dettaglio.png',
        viewport: 'mobile',
        page: '/profile — scheda Bollette, poi tocca una bolletta',
        what: 'Dettaglio della singola bolletta su telefono',
    },
    {
        key: 'shot_07_admin_utenti',
        file: '07-admin-utenti.png',
        viewport: 'desktop',
        page: '/admin/users',
        what: 'Anagrafica clienti con ricerca e filtri',
    },
    {
        key: 'shot_08_admin_dettaglio',
        file: '08-admin-dettaglio.png',
        viewport: 'desktop',
        page: '/admin/users/[id]',
        what: 'Scheda cliente con forniture, bollette e grafico di spesa',
    },
    {
        key: 'shot_09_admin_upload',
        file: '09-admin-upload.png',
        viewport: 'desktop',
        page: '/admin/upload',
        what: 'Caricamento massivo e storico dei lotti',
    },
]

export const VIEWPORTS = {
    desktop: { width: 1440, height: 900, label: 'finestra 1440 × 900' },
    mobile: { width: 390, height: 844, label: 'telefono 390 × 844' },
}
