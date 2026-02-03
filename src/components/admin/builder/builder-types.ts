
export type WidgetType =
    | 'stats_card'
    | 'line_chart'
    | 'bar_chart'
    | 'data_table'
    | 'user_widget'
    | 'consumption_chart'
    | 'recent_bills'
    | 'user_profile'
    | 'quick_actions'

export interface WidgetDataMapping {
    field: string // The prop name in the widget (e.g. "value", "title", "data")
    sourceColumn?: string // The CSV column name
    staticValue?: string // Or a static string
    type?: 'text' | 'number' | 'currency' | 'date'
}

export interface BuilderWidget {
    id: string
    type: WidgetType
    x: number // Grid X (1-12)
    y: number // Grid Y
    w: number // Width (1-12)
    h: number // Height
    mappings: Record<string, WidgetDataMapping>
    settings?: Record<string, any> // Visibility toggles, etc.
    styles?: {
        primaryColor?: string
        backgroundColor?: string
        accentColor?: string
    }
    title?: string
}

export interface WidgetDefinition {
    type: WidgetType
    label: string
    description: string
    iconName: string // Lucide icon name
    defaultW: number
    defaultH: number
    mappableFields: {
        name: string
        label: string
        type: 'text' | 'number' | 'array'
    }[]
    customizableSettings?: {
        name: string
        label: string
        type: 'boolean' | 'color' | 'select'
        options?: string[]
    }[]
}
