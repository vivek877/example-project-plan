"use client"

import * as React from "react"
import { format, parseISO, isValid } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import "react-day-picker/dist/style.css"

interface DatePickerProps {
  value?: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const parsedDate = React.useMemo(() => {
    if (!value) return undefined
    try {
      const d = typeof value === "string" ? parseISO(value) : new Date(value)
      return isValid(d) ? d : undefined
    } catch {
      return undefined
    }
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"))
    } else {
      onChange(null)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all",
            !parsedDate && "text-slate-400",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 flex-shrink-0" />
          {parsedDate ? (
            <span className="text-slate-800">{format(parsedDate, "MMM d, yyyy")}</span>
          ) : (
            <span>{placeholder}</span>
          )}
          {parsedDate && (
            <X
              className="ml-auto h-3.5 w-3.5 text-slate-400 hover:text-slate-600 flex-shrink-0"
              onClick={e => { e.stopPropagation(); onChange(null) }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-xl border-slate-200 rounded-xl overflow-hidden" align="start">
        <DayPicker
          mode="single"
          selected={parsedDate}
          onSelect={handleSelect}
          initialFocus
          className="p-3"
          classNames={{
            months: "flex flex-col sm:flex-row gap-2",
            month: "flex flex-col gap-1",
            caption: "flex justify-center items-center pt-1 mb-2 relative",
            caption_label: "text-sm font-semibold text-slate-800",
            nav: "flex items-center gap-1",
            nav_button: "h-7 w-7 bg-transparent hover:bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors",
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex",
            head_cell: "text-slate-400 rounded-md w-9 font-medium text-[0.8rem]",
            row: "flex w-full mt-1",
            cell: "h-9 w-9 text-center text-sm relative p-0",
            day: "h-9 w-9 p-0 font-normal text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors",
            day_selected: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white rounded-lg font-semibold",
            day_today: "bg-slate-100 text-slate-900 font-bold",
            day_outside: "text-slate-300",
            day_disabled: "text-slate-300 cursor-not-allowed",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
