"use client"

import * as React from "react"
import { X, ChevronDown, Check, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface MultiSelectOption {
  value: string
  label: string
  email?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
  maxDisplay?: number
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className,
  maxDisplay = 3,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.email || "").toLowerCase().includes(search.toLowerCase())
  )

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v))
    } else {
      onChange([...value, v])
    }
  }

  const remove = (v: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(x => x !== v))
  }

  const displayedLabels = value.slice(0, maxDisplay).map(v => {
    const opt = options.find(o => o.value === v)
    return opt?.label || v
  })
  const extra = value.length - maxDisplay

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-10 w-full flex items-center gap-1.5 flex-wrap px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 transition-all text-left",
            className
          )}
        >
          {value.length === 0 ? (
            <span className="text-slate-400 text-sm">{placeholder}</span>
          ) : (
            <>
              {displayedLabels.map((label, i) => (
                <span
                  key={value[i]}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-100"
                >
                  <User className="w-2.5 h-2.5" />
                  {label}
                  <X
                    className="w-2.5 h-2.5 hover:text-blue-900 cursor-pointer"
                    onClick={e => remove(value[i], e)}
                  />
                </span>
              ))}
              {extra > 0 && (
                <span className="text-xs text-slate-500 font-medium">+{extra} more</span>
              )}
            </>
          )}
          <ChevronDown className="ml-auto w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-xl border-slate-200 rounded-xl overflow-hidden" align="start">
        <div className="p-2 border-b border-slate-100">
          <input
            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 placeholder:text-slate-400"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-slate-400">No results</div>
          ) : (
            filtered.map(opt => {
              const selected = value.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors",
                    selected && "bg-blue-50/50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    selected ? "bg-blue-500 border-blue-500" : "border-slate-300"
                  )}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {opt.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{opt.label}</div>
                      {opt.email && <div className="text-xs text-slate-400 truncate">{opt.email}</div>}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
        {value.length > 0 && (
          <div className="p-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-center text-xs text-red-500 hover:text-red-600 font-medium py-1"
            >
              Clear all ({value.length})
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
