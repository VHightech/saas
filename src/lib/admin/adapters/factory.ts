import { ImportAdapter } from "./types";
import { StandardCsvAdapter } from "./standard-csv";
import { DynamicCsvAdapter, ColumnMapping } from "./dynamic-csv";

export function getAdapterForTenant(
    tenantSlug: string,
    adapterName?: string,
    mapping?: ColumnMapping
): ImportAdapter {
    // If we have a specific adapter name from DB config, use it.
    // Otherwise fallback to slug-based switch or default.
    const strategy = adapterName || tenantSlug;

    switch (strategy) {
        case 'dynamic-csv':
            return new DynamicCsvAdapter(mapping || {});
        case 'standard-csv':
            return new StandardCsvAdapter();
        default:
            return new StandardCsvAdapter();
    }
}

export function getTenantStoragePath(tenantSlug: string): string {
    // Avoid directory traversal attacks
    const safeSlug = tenantSlug.replace(/[^a-z0-9-]/g, '');
    return `invoices/${safeSlug}`;
}
