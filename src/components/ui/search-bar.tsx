import { Search } from 'lucide-react'

interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export function SearchBar({ value, onChange, placeholder = "Cerca...", className = "" }: SearchBarProps) {
    return (
        <div className={`relative group w-full ${className}`}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 group-focus-within:bg-sky-500 group-focus-within:text-white transition-all duration-300">
                <Search size={14} strokeWidth={2.5} />
            </div>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#333333] rounded-full py-2.5 pl-12 pr-4 text-xs font-bold focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 ring-sky-500/10 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500 dark:text-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800"
            />
        </div>
    )
}
