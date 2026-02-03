import { WidgetDefinition } from "./builder-types";

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
    stats_card: {
        type: 'stats_card',
        label: 'Stat Card',
        description: 'Single metric display (e.g. Total Amount)',
        iconName: 'LayoutTemplate',
        defaultW: 3,
        defaultH: 4,
        mappableFields: [
            { name: 'label', label: 'Label', type: 'text' },
            { name: 'value', label: 'Value Source', type: 'text' }
        ]
    },
    data_table: {
        type: 'data_table',
        label: 'Data Table',
        description: 'List of records (e.g. Recent Bills)',
        iconName: 'Table',
        defaultW: 12, // Full width by default
        defaultH: 8,
        mappableFields: [
            { name: 'title', label: 'Table Title', type: 'text' },
            // Tables are special, they have dynamic column mapping handled separately
        ]
    },
    line_chart: {
        type: 'line_chart',
        label: 'Line Chart',
        description: 'Trend analysis over time',
        iconName: 'LineChart',
        defaultW: 8,
        defaultH: 8,
        mappableFields: [
            { name: 'title', label: 'Chart Title', type: 'text' },
            { name: 'xAxis', label: 'X Axis (Date)', type: 'text' },
            { name: 'yAxis', label: 'Y Axis (Value)', type: 'number' }
        ]
    },
    quick_actions: {
        type: 'quick_actions',
        label: 'Quick Actions',
        description: 'Common button actions',
        iconName: 'Zap',
        defaultW: 4,
        defaultH: 4,
        mappableFields: []
    },
    user_widget: {
        type: 'user_widget',
        label: 'Profilo Utente',
        description: 'Visualizza dati anagrafici e codice cliente',
        iconName: 'User',
        defaultW: 3,
        defaultH: 8,
        mappableFields: [
            { name: 'name', label: 'Nome Intestatario', type: 'text' },
            { name: 'client_code', label: 'Codice Cliente', type: 'text' }
        ],
        customizableSettings: [
            { name: 'show_welcome', label: 'Mostra Messaggio Benvenuto', type: 'boolean' },
            { name: 'accent_color', label: 'Colore Accento (Icona)', type: 'color' },
            { name: 'bg_style', label: 'Stile Sfondo', type: 'select', options: ['Vetro (Light)', 'Vetro (Dark)', 'Solido Blue'] }
        ]
    },
    consumption_chart: {
        type: 'consumption_chart',
        label: 'Grafico Consumi',
        description: 'Trend consumi mensili',
        iconName: 'BarChart',
        defaultW: 3,
        defaultH: 8,
        mappableFields: [
            { name: 'last_consumption', label: 'Ultimo Consumo', type: 'number' }
        ],
        customizableSettings: [
            { name: 'chart_color', label: 'Colore Barre', type: 'color' },
            { name: 'show_percentage', label: 'Mostra Percentuale Delta', type: 'boolean' }
        ]
    },
    recent_bills: {
        type: 'recent_bills',
        label: 'Ultime Fatture',
        description: 'Lista fatture emesse',
        iconName: 'FileText',
        defaultW: 6,
        defaultH: 10,
        mappableFields: [],
        customizableSettings: [
            { name: 'limit', label: 'Numero Fatture Visibili', type: 'select', options: ['3', '5', '10'] },
            { name: 'show_status', label: 'Mostra Stato Pagamento', type: 'boolean' }
        ]
    },
    user_profile: {
        type: 'user_profile',
        label: 'Profilo Utente (Legacy)',
        description: 'Visualizza dati anagrafici e codice cliente',
        iconName: 'User',
        defaultW: 4,
        defaultH: 8,
        mappableFields: []
    }
}
