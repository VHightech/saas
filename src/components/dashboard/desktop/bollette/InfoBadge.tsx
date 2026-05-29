import { cn } from '@/lib/utils'

interface InfoBadgeProps {
    label: string
    value: string
    full?: boolean
}

/** Frosted label/value pill used inside the "Ultima Bolletta" hero. */
export function InfoBadge({ label, value, full }: InfoBadgeProps) {
    return (
        <div className={cn(
            "px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col",
            full ? "w-full" : "min-w-[90px]"
        )}>
            <span className="text-[9px] font-medium text-white/40 uppercase tracking-[0.1em] leading-none mb-1.5">{label}</span>
            <span className="text-[12px] font-medium text-white leading-none truncate">{value}</span>
        </div>
    )
}
