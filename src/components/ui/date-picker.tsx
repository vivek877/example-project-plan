"use client"
import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import "react-day-picker/dist/style.css"

interface DatePickerProps {
  value?: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  className?: string
  error?: boolean
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, error }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const parsed = React.useMemo(() => {
    if (!value) return undefined
    try {
      const d = typeof value === "string" ? parseISO(value) : new Date(value)
      return isValid(d) ? d : undefined
    } catch { return undefined }
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    onChange(date ? format(date, "yyyy-MM-dd") : null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-11 w-full flex items-center gap-2.5 px-3.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium",
            "bg-white focus:outline-none",
            error
              ? "border-red-300 focus:border-red-400 bg-red-50/30"
              : "border-slate-200 hover:border-blue-300 focus:border-blue-400",
            !parsed && "text-slate-400",
            parsed && "text-slate-800",
            className
          )}
        >
          <CalendarIcon className={`w-4 h-4 flex-shrink-0 ${error ? 'text-red-400' : 'text-blue-400'}`} />
          <span className="flex-1 text-left">
            {parsed ? format(parsed, "MMM d, yyyy") : placeholder}
          </span>
          {parsed && (
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700 flex-shrink-0 transition-colors"
              onClick={e => { e.stopPropagation(); onChange(null) }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 shadow-2xl border border-slate-200 rounded-2xl overflow-hidden bg-white"
        align="start"
      >
        <div className="px-4 pt-4 pb-2 bg-gradient-to-br from-blue-500 to-blue-600">
          <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest">Select Date</p>
          <p className="text-white text-lg font-bold mt-0.5">
            {parsed ? format(parsed, "MMMM d, yyyy") : "Choose a date"}
          </p>
        </div>
        <DayPicker
          mode="single"
          selected={parsed}
          onSelect={handleSelect}
          initialFocus
          className="p-3"
          classNames={{
            months: "flex flex-col",
            month: "flex flex-col gap-1",
            caption: "flex justify-center items-center pt-1 mb-2 relative",
            caption_label: "text-sm font-bold text-slate-700",
            nav: "flex items-center gap-1",
            nav_button: "h-7 w-7 bg-transparent hover:bg-blue-50 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex mb-1",
            head_cell: "text-slate-400 w-9 text-center font-bold text-[11px] uppercase",
            row: "flex w-full mt-1",
            cell: "h-9 w-9 text-center text-sm relative p-0",
            day: "h-9 w-9 p-0 font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all",
            day_selected: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white rounded-xl font-bold shadow-md",
            day_today: "ring-2 ring-blue-300 ring-offset-1 text-blue-600 font-bold",
            day_outside: "text-slate-200 opacity-50",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
