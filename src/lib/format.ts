/**
 * Shared display formatters. Centralises the Italian number/currency/date
 * conventions that were previously duplicated across dashboard and admin views.
 */

/**
 * Formats a numeric amount as Italian-locale Euro (comma decimals).
 *
 * @param n        Amount; null/undefined/NaN render as zero.
 * @param position 'suffix' → "175,89 €" (default, user + admin views),
 *                 'prefix' → "€175,89" (desktop bollette header).
 */
export function formatEuro(
    n: number | null | undefined,
    position: 'prefix' | 'suffix' = 'suffix',
): string {
    const amount = (Number(n) || 0).toFixed(2).replace('.', ',')
    return position === 'prefix' ? `€${amount}` : `${amount} €`
}

/** Formats an ISO date string as "marzo 2026" (lowercase Italian month + year). */
export function monthYear(date: string): string {
    return new Date(date).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
}
