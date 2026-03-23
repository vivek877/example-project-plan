import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Search, Trash2, Edit2, ChevronRight, ChevronDown,
  RefreshCw, AlertCircle, Settings, X, CheckCircle2, Loader2,
  FolderOpen, ListTodo, Clock, BarChart3, Zap, Link2,
  TrendingUp, Users, Target, CalendarDays
} from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select'
import { useSmartsheet } from '@/hooks/useSmartsheet'
import { SmartsheetRow, SmartsheetColumn, COL_TYPE, isReadOnly, apiGetSheetList } from '@/lib/smartsheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateDisplay(val: any): string {
  if (!val) return ''
  try {
    const d = typeof val === 'string' ? parseISO(val) : new Date(val)
    return isValid(d) ? format(d, 'MMM d, yyyy') : String(val)
  } catch { return String(val) }
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function hashColor(str: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
  ]
  let hash = 0
  for (const c of str) hash = ((hash << 5) - hash) + c.charCodeAt(0)
  return colors[Math.abs(hash) % colors.length]
}

// ─── Health Badge ──────────────────────────────────────────────────────────────
function HealthBadge({ value }: { value: string }) {
  const v = String(value || '').toLowerCase()
  const map: Record<string, { bg: string; ring: string; dot: string; text: string; label: string }> = {
    green:  { bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'On Track' },
    yellow: { bg: 'bg-amber-50',   ring: 'ring-amber-200',   dot: 'bg-amber-400',   text: 'text-amber-700',  label: 'At Risk' },
    red:    { bg: 'bg-red-50',     ring: 'ring-red-200',     dot: 'bg-red-500',     text: 'text-red-700',    label: 'Off Track' },
    blue:   { bg: 'bg-blue-50',    ring: 'ring-blue-200',    dot: 'bg-blue-500',    text: 'text-blue-700',   label: 'In Progress' },
  }
  const s = map[v]
  if (!s) return <span className="text-slate-300 text-xs">—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ${s.bg} ${s.ring} ${s.text} text-[11px] font-bold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </span>
  )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ value }: { value: string }) {
  const v = String(value || '')
  if (!v) return <span className="text-slate-300 text-xs">—</span>
  const vl = v.toLowerCase()
  const s =
    vl.includes('complete') ? { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' } :
    vl.includes('progress')  ? { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-200' }    :
    vl.includes('not start') ? { bg: 'bg-slate-100',   text: 'text-slate-500',   ring: 'ring-slate-200' }   :
    vl.includes('block') || vl.includes('at risk') ? { bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200' } :
    { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold ${s.bg} ${s.text} ${s.ring}`}>
      {v}
    </span>
  )
}

// ─── Assignee Pills ────────────────────────────────────────────────────────────
function AssigneePills({ value }: { value: any }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>
  const names: string[] = Array.isArray(value)
    ? value.map((v: any) => v.name || v.email || String(v))
    : [String(value)]
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {names.slice(0, 3).map((n, i) => (
        <div key={i} title={n} className={`w-7 h-7 rounded-full bg-gradient-to-br ${hashColor(n)} flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white -ml-1 first:ml-0`}>
          {getInitials(n)}
        </div>
      ))}
      {names.length > 3 && (
        <span className="text-xs text-slate-500 font-medium">+{names.length - 3}</span>
      )}
    </div>
  )
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value }: { value: any }) {
  const pct = Math.min(100, Math.max(0, parseFloat(String(value || '0')) * (String(value).includes('.') && parseFloat(String(value)) <= 1 ? 100 : 1)))
  if (isNaN(pct)) return <span className="text-slate-300 text-xs">—</span>
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-500 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── Form Field ────────────────────────────────────────────────────────────────
function FormField({ col, value, onChange }: {
  col: SmartsheetColumn; value: any; onChange: (v: any) => void
}) {
  if (col.type === COL_TYPE.CHECKBOX) {
    const checked = Boolean(value)
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-3 h-10 px-3 rounded-lg border-2 transition-all w-full ${
          checked ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
        }`}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
          checked ? 'bg-blue-500 border-blue-500' : 'border-slate-300'
        }`}>
          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
        <span className="text-sm font-medium">{checked ? 'Yes / Complete' : 'No / Incomplete'}</span>
      </button>
    )
  }

  if (col.type === COL_TYPE.DATE) {
    return (
      <DatePicker
        value={value || null}
        onChange={onChange}
        placeholder={`Pick ${col.title}...`}
      />
    )
  }

  if (col.type === COL_TYPE.PICKLIST && col.options?.length) {
    return (
      <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-10 bg-white border-slate-200 focus:ring-blue-400/20 hover:border-slate-300 transition-all">
          <SelectValue placeholder={`Select ${col.title}...`} />
        </SelectTrigger>
        <SelectContent className="shadow-xl border-slate-200 rounded-xl">
          <SelectItem value="__none__">— None —</SelectItem>
          {col.options.map(opt => (
            <SelectItem key={opt} value={opt}>
              <div className="flex items-center gap-2">
                <StatusBadge value={opt} />
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (col.type === COL_TYPE.CONTACT_LIST) {
    // Parse current value to array of strings
    let currentValues: string[] = []
    if (Array.isArray(value)) {
      currentValues = value.map((v: any) => v.email || v.name || String(v))
    } else if (value && typeof value === 'object') {
      currentValues = [value.email || value.name || '']
    } else if (typeof value === 'string' && value) {
      currentValues = value.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    // Build options from any existing contact data in the column
    const opts: MultiSelectOption[] = col.options?.map(o => ({
      value: o, label: o, email: o.includes('@') ? o : undefined
    })) || []

    // Also add currently selected values as options if not present
    currentValues.forEach(v => {
      if (!opts.find(o => o.value === v)) {
        opts.push({ value: v, label: v, email: v.includes('@') ? v : undefined })
      }
    })

    const handleChange = (vals: string[]) => {
      // Smartsheet CONTACT_LIST expects array of {email} objects
      if (vals.length === 0) {
        onChange(null)
      } else if (vals.length === 1) {
        onChange({ email: vals[0], name: vals[0] })
      } else {
        onChange(vals.map(v => ({ email: v, name: v })))
      }
    }

    return (
      <div className="space-y-2">
        <MultiSelect
          options={opts}
          value={currentValues}
          onChange={handleChange}
          placeholder={`Assign ${col.title}...`}
        />
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="Or type email to add..."
            className="h-8 text-xs bg-slate-50 border-slate-200"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const v = (e.target as HTMLInputElement).value.trim()
                if (v && !currentValues.includes(v)) {
                  handleChange([...currentValues, v]);
                  (e.target as HTMLInputElement).value = ''
                }
              }
            }}
          />
          <span className="text-xs text-slate-400 self-center whitespace-nowrap">Press Enter</span>
        </div>
      </div>
    )
  }

  // Default: TEXT_NUMBER
  return (
    <Input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={`Enter ${col.title}...`}
      className="h-10 bg-white border-slate-200 focus-visible:ring-blue-400/20 hover:border-slate-300 transition-all"
    />
  )
}

// ─── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }: { onConnect: (token: string, sheetId: string) => void }) {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [sheets, setSheets] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSheets = async () => {
    if (!token.trim()) { toast.error('Enter API token first'); return }
    setLoading(true)
    try {
      const data = await apiGetSheetList(token.trim())
      const list = data.data || []
      setSheets(list)
      if (!list.length) toast.error('No sheets found')
      else toast.success(`Found ${list.length} sheet${list.length > 1 ? 's' : ''}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim() || !sheetId.trim()) { toast.error('Both fields are required'); return }
    localStorage.setItem('sm_token', token.trim())
    localStorage.setItem('sm_sheet', sheetId.trim())
    onConnect(token.trim(), sheetId.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-full bg-gradient-to-b from-transparent via-blue-500/20 to-transparent" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="relative inline-flex mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-400 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-[8px] font-black">SS</span>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Project Manager</h1>
          <p className="text-blue-300/80 mt-2 text-base">Powered by Smartsheet · Real-time sync</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.07] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500/20 rounded-md flex items-center justify-center text-blue-300 text-xs">🔑</span>
                API Access Token
              </Label>
              <Input
                type="password"
                placeholder="Your Smartsheet access token..."
                value={token}
                onChange={e => setToken(e.target.value)}
                className="h-12 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-blue-400/40 focus-visible:border-blue-400/50 rounded-xl"
              />
              <p className="text-white/30 text-xs pl-1">
                Account → Personal Settings → API Access → Generate New Token
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500/20 rounded-md flex items-center justify-center text-blue-300 text-xs">📋</span>
                Project Sheet
              </Label>
              <div className="flex gap-2">
                {sheets.length > 0 ? (
                  <Select value={sheetId} onValueChange={setSheetId}>
                    <SelectTrigger className="flex-1 h-12 bg-white/5 border-white/15 text-white rounded-xl">
                      <SelectValue placeholder="Select your project sheet" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl border-slate-200">
                      {sheets.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Sheet ID (numeric ID from sheet URL)"
                    value={sheetId}
                    onChange={e => setSheetId(e.target.value)}
                    className="flex-1 h-12 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-blue-400/40 rounded-xl"
                  />
                )}
                <Button
                  type="button"
                  onClick={fetchSheets}
                  disabled={loading}
                  variant="outline"
                  className="h-12 w-12 bg-white/5 border-white/15 hover:bg-white/10 text-white rounded-xl"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-white/30 text-xs pl-1">Click ↺ to load your sheets, or paste the numeric ID</p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5"
            >
              <Link2 className="w-5 h-5 mr-2" />
              Connect to Smartsheet
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-6 text-white/30 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />Secure</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />Real-time</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />Bi-directional</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Task Form Modal ───────────────────────────────────────────────────────────
function TaskFormModal({
  open, onClose, title, description, editableCols, formData, onChange,
  onSubmit, isMutating, parentCandidates, selectedParentId, setSelectedParentId, getPrimaryValue,
  mode
}: {
  open: boolean; onClose: () => void; title: string; description: string
  editableCols: SmartsheetColumn[]; formData: Record<number, any>
  onChange: (colId: number, value: any) => void
  onSubmit: (e: React.FormEvent) => void
  isMutating: boolean; parentCandidates: SmartsheetRow[]
  selectedParentId: number | null; setSelectedParentId: (id: number | null) => void
  getPrimaryValue: (row: SmartsheetRow) => string
  mode: 'add' | 'edit'
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl border-slate-200 shadow-2xl">
        {/* Modal Header */}
        <div className={`px-6 py-5 border-b border-slate-100 flex-shrink-0 ${mode === 'add' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-slate-50'}`}>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${mode === 'add' ? 'bg-blue-500 shadow-lg shadow-blue-500/30' : 'bg-slate-700 shadow-lg shadow-slate-700/20'}`}>
              {mode === 'add' ? <Plus className="w-5 h-5 text-white" /> : <Edit2 className="w-5 h-5 text-white" />}
            </div>
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500 ml-12">{description}</DialogDescription>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Parent selector (only for add) */}
          {mode === 'add' && (
            <div className="mb-5 pb-5 border-b border-slate-100">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                Parent Phase / Task
              </Label>
              <Select
                value={selectedParentId ? String(selectedParentId) : '__top__'}
                onValueChange={v => setSelectedParentId(v === '__top__' ? null : Number(v))}
              >
                <SelectTrigger className="h-10 bg-white border-slate-200 hover:border-slate-300 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="shadow-xl rounded-xl border-slate-200 max-h-60">
                  <SelectItem value="__top__">
                    <span className="flex items-center gap-2 text-slate-500">
                      <Target className="w-4 h-4" /> Top level — no parent
                    </span>
                  </SelectItem>
                  {parentCandidates.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="flex items-center gap-2">
                        {p.level === 0
                          ? <FolderOpen className="w-4 h-4 text-blue-500" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                        <span style={{ paddingLeft: `${p.level * 12}px` }} className="font-medium">
                          {getPrimaryValue(p)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fields grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {editableCols.map(col => {
              const isWide = col.primary || col.type === COL_TYPE.CONTACT_LIST
              return (
                <div key={col.id} className={isWide ? 'sm:col-span-2' : ''}>
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                    {col.title}
                    {col.primary && <span className="ml-1 text-blue-400">*</span>}
                  </Label>
                  <FormField
                    col={col}
                    value={formData[col.id] ?? ''}
                    onChange={v => onChange(col.id, v)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="px-5 rounded-xl border-slate-200">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isMutating}
            className={`px-8 rounded-xl font-semibold shadow-lg transition-all hover:-translate-y-0.5 ${
              mode === 'add'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-blue-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-white shadow-slate-700/20'
            }`}
          >
            {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === 'add' ? 'Create Task' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SmartsheetRow | null>(null)
  const [deletingRow, setDeletingRow] = useState<SmartsheetRow | null>(null)
  const [formData, setFormData] = useState<Record<number, any>>({})
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [lastSynced, setLastSynced] = useState(new Date())

  const { sheet, tasks, isLoading, isMutating, error, refetch, completionStats, addRow, updateRow, deleteRow } =
    useSmartsheet(token, sheetId)

  useEffect(() => {
    const t = localStorage.getItem('sm_token')
    const s = localStorage.getItem('sm_sheet')
    if (t && s) { setToken(t); setSheetId(s); setIsConfigured(true) }
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    const id = setInterval(() => refetch().then(() => setLastSynced(new Date())), 30000)
    return () => clearInterval(id)
  }, [isConfigured, refetch])

  const editableCols = useMemo(() => (sheet?.columns || []).filter(c => !isReadOnly(c)), [sheet])
  const parentCandidates = useMemo(() => tasks.filter(t => t.level <= 1), [tasks])

  const getPrimaryValue = useCallback((row: SmartsheetRow) => {
    const col = sheet?.columns.find(c => c.primary)
    if (!col) return '(Unnamed)'
    const cell = row.cells.find(c => c.columnId === col.id)
    return String(cell?.displayValue || cell?.value || '(Unnamed)')
  }, [sheet])

  const getCellDisplay = (row: SmartsheetRow, col: SmartsheetColumn) => {
    const cell = row.cells.find(c => c.columnId === col.id)
    return cell?.displayValue ?? cell?.value ?? null
  }

  const isVisible = useCallback((task: SmartsheetRow & { calculatedParentId?: number }): boolean => {
    if (!task.calculatedParentId) return true
    if (collapsed.has(task.calculatedParentId)) return false
    const parent = tasks.find(t => t.id === task.calculatedParentId)
    return parent ? isVisible(parent) : true
  }, [collapsed, tasks])

  const visibleTasks = useMemo(() => {
    const s = search.toLowerCase()
    return tasks.filter(t => {
      if (!isVisible(t)) return false
      if (!s) return true
      return t.cells.some(c => String(c.displayValue || c.value || '').toLowerCase().includes(s))
    })
  }, [tasks, collapsed, search, isVisible])

  const toggleCollapse = (id: number) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const setField = (colId: number, value: any) => setFormData(prev => ({ ...prev, [colId]: value }))

  const openAdd = (parentId: number | null = null) => {
    setSelectedParentId(parentId)
    setFormData({})
    setAddOpen(true)
  }

  const openEdit = (row: SmartsheetRow) => {
    setEditingRow(row)
    const init: Record<number, any> = {}
    row.cells.forEach(cell => { init[cell.columnId] = cell.value })
    setFormData(init)
    setEditOpen(true)
  }

  const openDelete = (row: SmartsheetRow) => {
    if (row.level <= 1) { toast.error('Cannot delete project or phase rows'); return }
    setDeletingRow(row)
    setDeleteOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const cells = Object.entries(formData)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([colId, value]) => ({ columnId: Number(colId), value }))
    if (!cells.length) { toast.error('Fill in at least one field'); return }
    try {
      await addRow({ cells, parentId: selectedParentId || undefined })
      setAddOpen(false)
      if (selectedParentId) setCollapsed(p => { const n = new Set(p); n.delete(selectedParentId!); return n })
    } catch (_) {}
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRow) return
    const cells = Object.entries(formData)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([colId, value]) => ({ columnId: Number(colId), value }))
    try {
      await updateRow({ id: editingRow.id, cells })
      setEditOpen(false)
    } catch (_) {}
  }

  const handleDelete = async () => {
    if (!deletingRow) return
    try {
      await deleteRow(deletingRow.id)
      setDeleteOpen(false)
      setDeletingRow(null)
    } catch (_) {}
  }

  if (!isConfigured) {
    return <SetupScreen onConnect={(t, s) => { setToken(t); setSheetId(s); setIsConfigured(true) }} />
  }

  // Compute which column to special-render
  const colRenderers: Record<string, (row: SmartsheetRow, col: SmartsheetColumn) => React.ReactNode> = {
    health:   (row, col) => <HealthBadge value={String(getCellDisplay(row, col) || '')} />,
    status:   (row, col) => <StatusBadge value={String(getCellDisplay(row, col) || '')} />,
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-[60px] bg-white border-b border-slate-200/80 flex items-center justify-between px-5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">
              {isLoading ? <Skeleton className="h-4 w-48" /> : (sheet?.name || 'Project Dashboard')}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Live · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 w-60 h-8 bg-slate-100 border-none text-sm focus-visible:ring-1 focus-visible:ring-blue-400/40 rounded-lg"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          <Button
            onClick={() => openAdd()}
            className="h-8 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/20 gap-1.5 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </Button>

          <button
            onClick={() => refetch().then(() => setLastSynced(new Date()))}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            title="Sync from Smartsheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsConfigured(false)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-5 max-w-screen-2xl mx-auto w-full">
        {/* ── Stats Row ───────────────────────────────────────────────────── */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              {
                label: 'Total Tasks', value: tasks.filter(t => t.level > 1).length,
                icon: <ListTodo className="w-4 h-4" />, grad: 'from-blue-500 to-blue-600',
                sub: `across ${tasks.filter(t => t.level === 1).length} phases`
              },
              {
                label: 'Active Phases', value: tasks.filter(t => t.level === 1).length,
                icon: <FolderOpen className="w-4 h-4" />, grad: 'from-violet-500 to-purple-600',
                sub: 'project phases'
              },
              {
                label: 'Completed', value: completionStats.completed,
                icon: <CheckCircle2 className="w-4 h-4" />, grad: 'from-emerald-500 to-teal-600',
                sub: `of ${completionStats.total} tasks`
              },
              {
                label: 'Avg Progress', value: `${completionStats.avg}%`,
                icon: <TrendingUp className="w-4 h-4" />, grad: 'from-orange-500 to-amber-600',
                sub: 'overall completion',
                progress: completionStats.avg
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.grad} flex items-center justify-center text-white shadow-lg`}>
                    {stat.icon}
                  </div>
                </div>
                {'progress' in stat ? (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-700"
                        style={{ width: `${stat.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{stat.sub}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">{stat.sub}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Error State ─────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Could not load sheet</h2>
            <p className="text-sm text-slate-500 mb-5">{(error as any).message}</p>
            <Button onClick={() => refetch()} size="sm" variant="outline" className="rounded-xl px-6">Retry</Button>
          </div>
        )}

        {/* ── Project Table ─────────────────────────────────────────────── */}
        {!error && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Table toolbar */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">Project Plan</span>
                {!isLoading && (
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {visibleTasks.length} rows
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CalendarDays className="w-3.5 h-3.5" />
                Synced with Smartsheet
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-slate-50/30">
                    <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left w-10 border-r border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#</span>
                    </th>
                    {sheet?.columns.map(col => (
                      <th key={col.id} className="px-4 py-3 text-left whitespace-nowrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{col.title}</span>
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 bg-slate-50 px-4 py-3 w-[100px] border-l border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-4 py-3"><Skeleton className="h-3 w-5" /></td>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className={`h-3 w-${j === 0 ? '36' : '20'}`} /></td>
                        ))}
                        <td className="px-4 py-3"><Skeleton className="h-6 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : visibleTasks.length === 0 ? (
                    <tr>
                      <td colSpan={999} className="py-20 text-center">
                        <div className="text-slate-300 text-4xl mb-3">📋</div>
                        <p className="text-slate-400 text-sm font-medium">
                          {search ? `No tasks matching "${search}"` : 'No tasks yet'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    visibleTasks.map(task => {
                      const isRoot = task.level === 0
                      const isPhase = task.level === 1
                      const isLeaf = task.level >= 2
                      const isCollapsed = collapsed.has(task.id)
                      const hasChildren = tasks.some(t => t.calculatedParentId === task.id)
                      const indent = task.level * 20

                      return (
                        <tr
                          key={task.id}
                          className={`border-b group transition-all duration-100 ${
                            isRoot
                              ? 'border-blue-100 bg-blue-50/40 hover:bg-blue-50/70'
                              : isPhase
                                ? 'border-slate-100 bg-slate-50/60 hover:bg-slate-50'
                                : 'border-slate-50 bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Row number */}
                          <td className="sticky left-0 z-10 bg-inherit px-4 py-3 w-10 border-r border-slate-100/50">
                            <span className="text-[11px] text-slate-300 font-mono">{task.rowNumber}</span>
                          </td>

                          {/* Data columns */}
                          {sheet?.columns.map((col) => {
                            const val = getCellDisplay(task, col)
                            const isPrimary = col.primary
                            const colKey = col.title.toLowerCase().replace(/\s+/g, '')
                            const isHealth = colKey === 'health'
                            const isStatus = colKey.includes('status')
                            const isDate = col.type === COL_TYPE.DATE
                            const isContact = col.type === COL_TYPE.CONTACT_LIST
                            const isPct = col.title.toLowerCase().includes('%') || col.title.toLowerCase().includes('complete')

                            return (
                              <td key={col.id} className="px-4 py-2.5 align-middle">
                                {isPrimary ? (
                                  <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
                                    {/* Tree connector lines */}
                                    {task.level > 0 && (
                                      <div className="flex-shrink-0 mr-1">
                                        <div className="w-3 h-3.5 border-l-2 border-b-2 border-slate-200 rounded-bl-sm" />
                                      </div>
                                    )}

                                    {/* Expand/collapse */}
                                    {hasChildren ? (
                                      <button
                                        onClick={() => toggleCollapse(task.id)}
                                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-slate-200 transition-colors mr-1 flex-shrink-0"
                                      >
                                        {isCollapsed
                                          ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                          : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                                        }
                                      </button>
                                    ) : (
                                      <div className="w-5 mr-1 flex-shrink-0 flex items-center justify-center">
                                        {isLeaf && <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                                      </div>
                                    )}

                                    <span className={`truncate max-w-[320px] ${
                                      isRoot ? 'font-black text-slate-900 text-[15px]' :
                                      isPhase ? 'font-bold text-slate-800 text-sm' :
                                      'font-medium text-slate-700 text-sm'
                                    }`}>
                                      {String(val || '—')}
                                    </span>
                                  </div>
                                ) : isHealth ? (
                                  <HealthBadge value={String(val || '')} />
                                ) : isStatus ? (
                                  <StatusBadge value={String(val || '')} />
                                ) : isDate ? (
                                  val ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg font-medium whitespace-nowrap">
                                      <CalendarDays className="w-3 h-3 text-slate-400" />
                                      {formatDateDisplay(val)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )
                                ) : isContact ? (
                                  <AssigneePills value={val} />
                                ) : isPct && val !== null && val !== undefined && val !== '' ? (
                                  <ProgressBar value={val} />
                                ) : col.type === COL_TYPE.CHECKBOX ? (
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${val ? 'bg-blue-500 border-blue-500' : 'border-slate-200'}`}>
                                    {val && <CheckCircle2 className="w-3 h-3 text-white" />}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-600 max-w-[180px] block truncate">
                                    {val !== null && val !== undefined && val !== '' ? String(val) : <span className="text-slate-200">—</span>}
                                  </span>
                                )}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="sticky right-0 z-10 bg-inherit px-3 py-2 border-l border-slate-100/50">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              {!isLeaf && (
                                <button
                                  onClick={() => openAdd(task.id)}
                                  title="Add child task"
                                  className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => openEdit(task)}
                                title="Edit"
                                className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {isLeaf && (
                                <button
                                  onClick={() => openDelete(task)}
                                  title="Delete"
                                  className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Add Dialog ──────────────────────────────────────────────────────── */}
      <TaskFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create New Task"
        description={
          selectedParentId
            ? `Adding under: "${parentCandidates.find(p => p.id === selectedParentId) ? getPrimaryValue(parentCandidates.find(p => p.id === selectedParentId)!) : '...' }"`
            : 'New task will be added to the project plan'
        }
        editableCols={editableCols}
        formData={formData}
        onChange={setField}
        onSubmit={handleAdd}
        isMutating={isMutating}
        parentCandidates={parentCandidates}
        selectedParentId={selectedParentId}
        setSelectedParentId={setSelectedParentId}
        getPrimaryValue={getPrimaryValue}
        mode="add"
      />

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <TaskFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Task"
        description={editingRow ? getPrimaryValue(editingRow) : ''}
        editableCols={editableCols}
        formData={formData}
        onChange={setField}
        onSubmit={handleEdit}
        isMutating={isMutating}
        parentCandidates={parentCandidates}
        selectedParentId={null}
        setSelectedParentId={() => {}}
        getPrimaryValue={getPrimaryValue}
        mode="edit"
      />

      {/* ── Delete Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={v => !v && setDeleteOpen(false)}>
        <DialogContent className="max-w-sm rounded-2xl border-slate-200 shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-50 px-6 py-5 border-b border-red-100">
            <DialogTitle className="text-base font-bold text-red-700 flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              Delete Task
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-red-600/70">
              This action cannot be undone.
            </DialogDescription>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">"{deletingRow ? getPrimaryValue(deletingRow) : ''}"</strong>{' '}
              from Smartsheet?
            </p>
          </div>
          <div className="px-6 pb-5 flex gap-3">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="flex-1 rounded-xl border-slate-200">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isMutating}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
