"use client"
import * as React from "react"
import { X, ChevronDown, Check, UserCircle, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface MultiSelectOption { value: string; label: string; email?: string }

function colorFor(s: string) {
  const c = ['from-violet-400 to-purple-500','from-blue-400 to-cyan-500','from-emerald-400 to-teal-500',
    'from-orange-400 to-amber-500','from-pink-400 to-rose-500','from-indigo-400 to-blue-500']
  let h = 0; for (const ch of s) h = ((h << 5) - h) + ch.charCodeAt(0)
  return c[Math.abs(h) % c.length]
}

function initials(s: string) {
  return s.split(/[\s@._-]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2) || '?'
}

interface Props {
  options: MultiSelectOption[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  error?: boolean
}

export function MultiSelect({ options, value, onChange, placeholder = "Select...", error }: Props) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(q.toLowerCase()) ||
    (o.email || "").toLowerCase().includes(q.toLowerCase())
  )

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }
  const removeItem = (v: string, e: React.MouseEvent) => { e.stopPropagation(); onChange(value.filter(x => x !== v)) }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-11 w-full flex items-start gap-1.5 flex-wrap px-3 py-2 rounded-xl border-2 transition-all duration-200 text-left focus:outline-none",
            "bg-white",
            error ? "border-red-300 bg-red-50/30" : "border-slate-200 hover:border-blue-300 focus:border-blue-400"
          )}
        >
          {value.length === 0 ? (
            <span className="text-slate-400 text-sm self-center flex-1 py-0.5">{placeholder}</span>
          ) : (
            <>
              {value.map((v) => {
                const opt = options.find(o => o.value === v)
                const label = opt?.label || v
                return (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
                    <div className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${colorFor(label)} flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0`}>
                      {initials(label)[0]}
                    </div>
                    {label}
                    <X className="w-2.5 h-2.5 text-blue-400 hover:text-blue-700 cursor-pointer" onClick={e => removeItem(v, e)} />
                  </span>
                )
              })}
            </>
          )}
          <ChevronDown className="ml-auto w-4 h-4 text-slate-400 flex-shrink-0 self-center" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 shadow-2xl border border-slate-200 rounded-2xl overflow-hidden bg-white" align="start">
        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 placeholder:text-slate-400"
              placeholder="Search people..."
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400 flex flex-col items-center gap-2">
              <UserCircle className="w-8 h-8 text-slate-200" />
              No results
            </div>
          ) : (
            filtered.map(opt => {
              const sel = value.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    sel ? "bg-blue-50" : "hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                    sel ? "bg-blue-500 border-blue-500" : "border-slate-300"
                  )}>
                    {sel && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorFor(opt.label)} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-sm`}>
                    {initials(opt.label)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{opt.label}</p>
                    {opt.email && <p className="text-xs text-slate-400 truncate">{opt.email}</p>}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {value.length > 0 && (
          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-center text-xs text-red-500 hover:text-red-600 font-semibold py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Clear all ({value.length} selected)
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
