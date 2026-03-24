import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Trash2, Edit2, ChevronRight, ChevronDown,
  RefreshCw, AlertCircle, Settings, X, CheckCircle2, Loader2,
  FolderOpen, ListTodo, Zap, Link2, TrendingUp,
  CalendarDays, Clock, Lock, Info, Users2
} from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select'
import { useSmartsheet } from '@/hooks/useSmartsheet'
import { SmartsheetRow, SmartsheetColumn, isReadOnly, apiGetSheetList } from '@/lib/smartsheet'
import { getFieldMeta, validateField, sanitiseValue, FieldMeta } from '@/lib/columnMeta'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import toast from 'react-hot-toast'

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } }
const stagger = { show: { transition: { staggerChildren: 0.06 } } }
const slideIn = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } }
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────
function fmtDate(val: any): string {
  if (!val) return ''
  try {
    const d = typeof val === 'string' ? parseISO(val) : new Date(val)
    return isValid(d) ? format(d, 'MMM d, yyyy') : String(val)
  } catch { return String(val) }
}
function colorFor(s: string) {
  const c = ['from-violet-500 to-purple-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600','from-pink-500 to-rose-600','from-indigo-500 to-blue-600']
  let h = 0; for (const ch of s) h = ((h<<5)-h)+ch.charCodeAt(0)
  return c[Math.abs(h)%c.length]
}
function initials(s: string) {
  return s.split(/[\s@._-]+/).map(w=>w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)||'?'
}

// ─── Smart Animated Counter ───────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    let start = 0; const end = value; if (start === end) { setDisplayed(end); return }
    const dur = 800; const startTime = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(start + (end - start) * ease))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])
  return <>{displayed}</>
}

// ─── Health Badge ─────────────────────────────────────────────────────────────
function HealthBadge({ value }: { value: string }) {
  const v = String(value||'').toLowerCase()
  const map: Record<string,{bg:string;ring:string;dot:string;text:string;label:string}> = {
    green:  {bg:'bg-emerald-50',ring:'ring-emerald-200',dot:'bg-emerald-500',text:'text-emerald-700',label:'On Track'},
    yellow: {bg:'bg-amber-50',  ring:'ring-amber-200',  dot:'bg-amber-400', text:'text-amber-700', label:'At Risk'},
    red:    {bg:'bg-red-50',    ring:'ring-red-200',    dot:'bg-red-500',   text:'text-red-700',   label:'Off Track'},
    blue:   {bg:'bg-blue-50',   ring:'ring-blue-200',   dot:'bg-blue-500',  text:'text-blue-700',  label:'In Progress'},
  }
  const s = map[v]; if (!s) return <span className="text-slate-300 text-xs">—</span>
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ${s.bg} ${s.ring} ${s.text} text-[11px] font-bold`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </motion.span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ value }: { value: string }) {
  const v = String(value||''); if (!v) return <span className="text-slate-300 text-xs">—</span>
  const vl = v.toLowerCase()
  const s =
    vl.includes('complete') ? {bg:'bg-emerald-100',text:'text-emerald-700',ring:'ring-emerald-200'} :
    vl.includes('progress')  ? {bg:'bg-blue-100',  text:'text-blue-700',  ring:'ring-blue-200'}    :
    vl.includes('not start') ? {bg:'bg-slate-100', text:'text-slate-500', ring:'ring-slate-200'}   :
    vl.includes('block')||vl.includes('at risk') ? {bg:'bg-red-100',text:'text-red-600',ring:'ring-red-200'} :
    {bg:'bg-slate-100',text:'text-slate-600',ring:'ring-slate-200'}
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full ring-1 text-[11px] font-semibold ${s.bg} ${s.text} ${s.ring}`}>
      {v}
    </span>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value }: { value: any }) {
  const raw = parseFloat(String(value ?? '0'))
  const pct = isNaN(raw) ? 0 : Math.min(100, Math.max(0, raw <= 1 ? raw*100 : raw))
  const col = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${col} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4,0,0.2,1] }}
        />
      </div>
      <span className="text-xs font-bold text-slate-500 w-9 text-right tabular-nums">{Math.round(pct)}%</span>
    </div>
  )
}

// ─── Assignee Stack ───────────────────────────────────────────────────────────
function AssigneeStack({ value }: { value: any }) {
  if (!value) return <span className="text-slate-300 text-xs">—</span>
  const names: string[] = Array.isArray(value)
    ? value.map((v:any) => v.name||v.email||String(v))
    : typeof value==='object' ? [value.name||value.email||''] : [String(value)]
  const visible = names.slice(0,4); const extra = names.length-4
  return (
    <div className="flex items-center gap-1">
      {visible.map((n,i) => (
        <motion.div
          key={i} title={n}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i*0.05 }}
          className={`w-7 h-7 rounded-full bg-gradient-to-br ${colorFor(n)} flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white -ml-1 first:ml-0 shadow-sm`}
        >
          {initials(n)}
        </motion.div>
      ))}
      {extra > 0 && <span className="text-xs text-slate-500 font-bold ml-1">+{extra}</span>}
    </div>
  )
}

// ─── Smart Form Field ─────────────────────────────────────────────────────────
interface FieldProps { col: SmartsheetColumn; meta: FieldMeta; value: any; onChange:(v:any)=>void; error?:string }

function SmartField({ col, meta, value, onChange, error }: FieldProps) {
  if (meta.renderType === 'readonly') {
    return (
      <div className="flex items-center gap-2 h-11 px-3.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
        <Lock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
        <span className="text-sm text-slate-400 truncate">{value != null && value !== '' ? String(value) : 'Calculated automatically'}</span>
        <div className="ml-auto group relative">
          <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-400 cursor-help" />
          <div className="absolute right-0 bottom-6 w-48 bg-slate-800 text-white text-xs rounded-lg p-2 hidden group-hover:block z-50 shadow-xl">
            {meta.readonlyReason}
          </div>
        </div>
      </div>
    )
  }

  if (meta.renderType === 'date') {
    return <DatePicker value={value||null} onChange={onChange} placeholder={`Select ${col.title}...`} error={!!error} />
  }

  if (meta.renderType === 'picklist' && col.options?.length) {
    return (
      <Select value={value||'__none__'} onValueChange={v => onChange(v==='__none__'?null:v)}>
        <SelectTrigger className={`h-11 border-2 rounded-xl font-medium transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
          <SelectValue placeholder={`Select ${col.title}...`} />
        </SelectTrigger>
        <SelectContent className="rounded-xl shadow-2xl border-slate-200">
          <SelectItem value="__none__"><span className="text-slate-400">— None —</span></SelectItem>
          {col.options.map(opt => (
            <SelectItem key={opt} value={opt}><StatusBadge value={opt} /></SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (meta.renderType === 'contact') {
    let currentVals: string[] = []
    if (Array.isArray(value)) currentVals = value.map((v:any) => v.email||v.name||String(v))
    else if (value && typeof value==='object') currentVals = [value.email||value.name||'']
    else if (typeof value==='string' && value) currentVals = [value]

    const opts: MultiSelectOption[] = (col.options||[]).map(o=>({value:o, label:o, email: o.includes('@')?o:undefined}))
    currentVals.forEach(v => { if (!opts.find(o=>o.value===v)) opts.push({value:v,label:v,email:v.includes('@')?v:undefined}) })

    const handleChange = (vals: string[]) => {
      if (!vals.length) onChange(null)
      else if (vals.length===1) onChange({email:vals[0],name:vals[0]})
      else onChange(vals.map(v=>({email:v,name:v})))
    }
    return (
      <div className="space-y-2">
        <MultiSelect options={opts} value={currentVals} onChange={handleChange} placeholder={`Assign ${col.title}...`} error={!!error} />
        <div className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Type email + press Enter to add..."
            className="flex-1 h-8 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/20 focus:border-blue-400 placeholder:text-slate-400"
            onKeyDown={e => {
              if (e.key==='Enter') {
                e.preventDefault()
                const v = (e.target as HTMLInputElement).value.trim()
                if (v && !currentVals.includes(v)) { handleChange([...currentVals,v]); (e.target as HTMLInputElement).value='' }
              }
            }}
          />
          <span className="text-[10px] text-slate-400 whitespace-nowrap">↵ Enter</span>
        </div>
      </div>
    )
  }

  if (meta.renderType === 'checkbox') {
    const checked = Boolean(value)
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex items-center gap-3 h-11 px-3.5 w-full rounded-xl border-2 transition-all duration-200 ${
          checked ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 hover:border-blue-300 text-slate-500'
        }`}
      >
        <motion.div
          animate={{ scale: checked ? 1 : 0.8, backgroundColor: checked ? '#10b981' : '#fff' }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'border-emerald-500' : 'border-slate-300'}`}
        >
          {checked && <motion.div initial={{scale:0}} animate={{scale:1}}><CheckCircle2 className="w-3 h-3 text-white" /></motion.div>}
        </motion.div>
        <span className="text-sm font-semibold">{checked ? 'Yes / Complete' : 'No / Not complete'}</span>
      </button>
    )
  }

  if (meta.renderType === 'percentage') {
    const numVal = value===''||value===null||value===undefined ? '' : String(value)
    const pct = parseFloat(numVal)||0
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-3 h-11 px-3.5 rounded-xl border-2 transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300 focus-within:border-blue-400'}`}>
          <input
            type="number"
            min={0} max={100} step={1}
            value={numVal}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="0"
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 focus:outline-none placeholder:text-slate-400 no-spinner"
          />
          <span className="text-slate-400 font-bold">%</span>
        </div>
        <input
          type="range" min={0} max={100} step={1}
          value={isNaN(pct) ? 0 : Math.min(100,Math.max(0,pct))}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full accent-blue-500 cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
    )
  }

  if (meta.renderType === 'number') {
    return (
      <div className={`flex items-center h-11 px-3.5 rounded-xl border-2 transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300 focus-within:border-blue-400'}`}>
        <input
          type="number"
          min={meta.min} max={meta.max}
          value={value??''}
          onChange={e => onChange(e.target.value===''? null : Number(e.target.value))}
          placeholder={`Enter number...`}
          className="flex-1 bg-transparent text-sm font-medium text-slate-800 focus:outline-none placeholder:text-slate-400 no-spinner"
        />
        {meta.unit && <span className="text-slate-400 text-sm">{meta.unit}</span>}
      </div>
    )
  }

  if (meta.renderType === 'duration') {
    return (
      <div className={`flex items-center h-11 px-3.5 rounded-xl border-2 transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300 focus-within:border-blue-400'}`}>
        <Clock className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          value={value??''}
          onChange={e => onChange(e.target.value||null)}
          placeholder="e.g. 5d or 8h..."
          className="flex-1 bg-transparent text-sm font-medium text-slate-800 focus:outline-none placeholder:text-slate-400"
        />
        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">d/h/w</span>
      </div>
    )
  }

  // Text (default)
  return (
    <div className={`flex items-center h-11 px-3.5 rounded-xl border-2 transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-blue-300 focus-within:border-blue-400'}`}>
      <input
        type="text"
        value={value??''}
        onChange={e => onChange(e.target.value)}
        placeholder={`Enter ${col.title}...`}
        className="flex-1 bg-transparent text-sm font-medium text-slate-800 focus:outline-none placeholder:text-slate-400"
      />
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }: { onConnect: (token: string, sheetId: string) => void }) {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [sheets, setSheets] = useState<{id:number;name:string}[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'token'|'sheet'>('token')

  const fetchSheets = async () => {
    if (!token.trim()) { toast.error('Enter your API token first'); return }
    setLoading(true)
    try {
      const data = await apiGetSheetList(token.trim())
      const list = data.data||[]; setSheets(list)
      if (!list.length) toast.error('No sheets found')
      else { toast.success(`Found ${list.length} sheets`); setStep('sheet') }
    } catch (e:any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()||!sheetId.trim()) { toast.error('Both fields required'); return }
    localStorage.setItem('sm_token', token.trim())
    localStorage.setItem('sm_sheet', sheetId.trim())
    onConnect(token.trim(), sheetId.trim())
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div animate={{ scale:[1,1.2,1], opacity:[0.15,0.25,0.15] }} transition={{ duration:8, repeat:Infinity }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px]" />
        <motion.div animate={{ scale:[1.2,1,1.2], opacity:[0.1,0.2,0.1] }} transition={{ duration:10, repeat:Infinity }}
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600 rounded-full blur-[120px]" />
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <motion.div className="w-full max-w-md relative z-10" initial="hidden" animate="show" variants={stagger}>
        {/* Logo */}
        <motion.div variants={fadeUp} className="text-center mb-10">
          <div className="relative inline-block mb-5">
            <motion.div
              animate={{ rotate: [0,5,-5,0] }} transition={{ duration:4, repeat:Infinity }}
              className="w-20 h-20 bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-blue-500/40 mx-auto"
            >
              <Zap className="w-10 h-10 text-white" />
            </motion.div>
            <motion.div
              animate={{ scale:[1,1.1,1] }} transition={{ duration:2, repeat:Infinity }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-400 rounded-xl flex items-center justify-center shadow-lg"
            >
              <span className="text-white text-[8px] font-black">SS</span>
            </motion.div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">Project Manager</h1>
          <p className="text-blue-300/70 mt-2 text-sm">Powered by Smartsheet · Real-time sync</p>
        </motion.div>

        {/* Card */}
        <motion.div variants={fadeUp} className="bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Token */}
            <div className="space-y-2">
              <Label className="text-white/70 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-500/30 rounded-md flex items-center justify-center text-blue-300 text-[10px] font-bold">1</span>
                API Access Token
              </Label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="Paste your Smartsheet access token..."
                  value={token}
                  onChange={e => { setToken(e.target.value); if (step==='sheet') setStep('token') }}
                  className="h-12 bg-white/5 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-blue-400/30 focus-visible:border-blue-400/60 rounded-xl pr-28"
                />
                <Button
                  type="button"
                  onClick={fetchSheets}
                  disabled={loading||!token}
                  className="absolute right-1.5 top-1.5 h-9 px-3 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-lg shadow-lg"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Load Sheets'}
                </Button>
              </div>
              <p className="text-white/30 text-[11px] pl-1">Account → Personal Settings → API Access</p>
            </div>

            {/* Step 2: Sheet */}
            <AnimatePresence>
              {step === 'sheet' && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="space-y-2">
                  <Label className="text-white/70 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 bg-emerald-500/30 rounded-md flex items-center justify-center text-emerald-300 text-[10px] font-bold">2</span>
                    Select Project Sheet
                  </Label>
                  {sheets.length > 0 ? (
                    <Select value={sheetId} onValueChange={setSheetId}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/15 text-white rounded-xl">
                        <SelectValue placeholder="Choose your sheet..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-2xl">
                        {sheets.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Sheet ID (numeric, from URL)"
                      value={sheetId}
                      onChange={e => setSheetId(e.target.value)}
                      className="h-12 bg-white/5 border-white/15 text-white placeholder:text-white/30 rounded-xl"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={!token||!sheetId}
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 text-white font-bold text-base rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Link2 className="w-5 h-5 mr-2" />
              Connect to Smartsheet
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 flex justify-center gap-6">
            {['Encrypted','Real-time','Bi-directional'].map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 text-white/30 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${['bg-emerald-400','bg-blue-400','bg-violet-400'][i]}`} />
                {label}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
interface FormModalProps {
  open: boolean; onClose: () => void
  title: string; description: string
  cols: SmartsheetColumn[]; formData: Record<number,any>
  onChange: (id: number, v: any) => void
  errors: Record<number,string>
  onSubmit: (e: React.FormEvent) => void
  isMutating: boolean
  mode: 'add'|'edit'
  parentCandidates?: SmartsheetRow[]
  selectedParentId?: number|null
  setSelectedParentId?: (v: number|null) => void
  getPrimaryValue?: (r: SmartsheetRow) => string
}

function TaskFormModal(props: FormModalProps) {
  const { open, onClose, title, description, cols, formData, onChange, errors, onSubmit, isMutating, mode, parentCandidates, selectedParentId, setSelectedParentId, getPrimaryValue } = props

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
        {/* Header */}
        <div className={`px-7 py-5 flex-shrink-0 ${mode==='add' ? 'bg-gradient-to-r from-blue-500 to-violet-600' : 'bg-gradient-to-r from-slate-700 to-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              {mode==='add' ? <Plus className="w-5 h-5 text-white" /> : <Edit2 className="w-5 h-5 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white font-black text-lg leading-none">{title}</DialogTitle>
              <DialogDescription className="text-white/60 text-xs mt-1">{description}</DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          {/* Parent selector */}
          {mode==='add' && parentCandidates && setSelectedParentId && getPrimaryValue && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="pb-5 border-b border-slate-100">
              <Label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Parent Phase</Label>
              <Select
                value={selectedParentId ? String(selectedParentId) : '__top__'}
                onValueChange={v => setSelectedParentId(v==='__top__' ? null : Number(v))}
              >
                <SelectTrigger className="h-11 border-2 rounded-xl border-slate-200 hover:border-blue-300 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl border-slate-200 max-h-60">
                  <SelectItem value="__top__">
                    <span className="flex items-center gap-2 text-slate-500 font-medium">
                      <FolderOpen className="w-4 h-4" /> Top level — no parent
                    </span>
                  </SelectItem>
                  {parentCandidates.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <span className="flex items-center gap-2" style={{ paddingLeft: `${p.level*12}px` }}>
                        {p.level===0 ? <FolderOpen className="w-4 h-4 text-blue-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <span className="font-semibold">{getPrimaryValue(p)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          )}

          {/* Fields grid */}
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5" initial="hidden" animate="show" variants={stagger}>
            {cols.map(col => {
              const meta = getFieldMeta(col)
              const isWide = col.primary || meta.renderType==='contact' || meta.renderType==='percentage'
              return (
                <motion.div key={col.id} variants={fadeUp} className={isWide ? 'sm:col-span-2' : ''}>
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    {meta.label}
                    {meta.required && <span className="text-blue-500">*</span>}
                    {meta.renderType==='readonly' && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                    {meta.hint && <span className="text-slate-400 font-normal normal-case tracking-normal">({meta.hint})</span>}
                  </Label>
                  <SmartField col={col} meta={meta} value={formData[col.id]??''} onChange={v => onChange(col.id,v)} error={errors[col.id]} />
                  <AnimatePresence>
                    {errors[col.id] && (
                      <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
                        className="text-xs text-red-500 font-medium mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors[col.id]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60 flex-shrink-0">
          <p className="text-xs text-slate-400">Changes sync to Smartsheet immediately</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="px-5 rounded-xl border-slate-200">Cancel</Button>
            <Button
              onClick={onSubmit}
              disabled={isMutating}
              className={`px-8 rounded-xl font-bold shadow-lg transition-all hover:-translate-y-0.5 ${
                mode==='add'
                  ? 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-400 hover:to-violet-500 text-white shadow-blue-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 text-white shadow-slate-700/20'
              }`}
            >
              {isMutating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode==='add' ? 'Create Task' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SmartsheetRow|null>(null)
  const [deletingRow, setDeletingRow] = useState<SmartsheetRow|null>(null)
  const [formData, setFormData] = useState<Record<number,any>>({})
  const [formErrors, setFormErrors] = useState<Record<number,string>>({})
  const [selectedParentId, setSelectedParentId] = useState<number|null>(null)
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
    const id = setInterval(() => refetch().then(()=>setLastSynced(new Date())), 30000)
    return () => clearInterval(id)
  }, [isConfigured, refetch])

  // Only show editable columns in forms (excludes system/formula, but shows readonly-heuristic ones as locked)
  const formCols = useMemo(() =>
    (sheet?.columns||[]).filter(c => !isReadOnly(c)),
    [sheet]
  )

  const parentCandidates = useMemo(() => tasks.filter(t => t.level <= 1), [tasks])

  const getPrimaryValue = useCallback((row: SmartsheetRow) => {
    const col = sheet?.columns.find(c => c.primary)
    if (!col) return '(Unnamed)'
    const cell = row.cells.find(c => c.columnId===col.id)
    return String(cell?.displayValue||cell?.value||'(Unnamed)')
  }, [sheet])

  const getCellDisplay = (row: SmartsheetRow, col: SmartsheetColumn) => {
    const cell = row.cells.find(c => c.columnId===col.id)
    return cell?.displayValue ?? cell?.value ?? null
  }

  const isVisible = useCallback((task: SmartsheetRow & {calculatedParentId?:number}): boolean => {
    if (!task.calculatedParentId) return true
    if (collapsed.has(task.calculatedParentId)) return false
    const p = tasks.find(t => t.id===task.calculatedParentId)
    return p ? isVisible(p) : true
  }, [collapsed, tasks])

  const visibleTasks = useMemo(() => {
    const s = search.toLowerCase()
    return tasks.filter(t => {
      if (!isVisible(t)) return false
      if (!s) return true
      return t.cells.some(c => String(c.displayValue||c.value||'').toLowerCase().includes(s))
    })
  }, [tasks, collapsed, search, isVisible])

  const toggleCollapse = (id: number) =>
    setCollapsed(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  const setField = (colId: number, value: any) => {
    setFormData(p => ({...p,[colId]:value}))
    // Clear error on change
    setFormErrors(p => { const n={...p}; delete n[colId]; return n })
  }

  const validateForm = (): boolean => {
    const errs: Record<number,string> = {}
    formCols.forEach(col => {
      const meta = getFieldMeta(col)
      const err = validateField(meta, formData[col.id])
      if (err) errs[col.id] = err
    })
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const openAdd = (parentId: number|null = null) => {
    setSelectedParentId(parentId); setFormData({}); setFormErrors({}); setAddOpen(true)
  }

  const openEdit = (row: SmartsheetRow) => {
    setEditingRow(row)
    const init: Record<number,any> = {}
    row.cells.forEach(cell => { init[cell.columnId] = cell.value })
    setFormData(init); setFormErrors({}); setEditOpen(true)
  }

  const openDelete = (row: SmartsheetRow) => {
    if (row.level<=1) { toast.error('Cannot delete project or phase rows'); return }
    setDeletingRow(row); setDeleteOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) { toast.error('Please fix validation errors'); return }
    const cells = formCols
      .map(col => ({ columnId: col.id, value: sanitiseValue(getFieldMeta(col), formData[col.id]) }))
      .filter(c => c.value !== null && c.value !== undefined)
    if (!cells.length) { toast.error('Enter at least one field'); return }
    try {
      await addRow({ cells, parentId: selectedParentId||undefined })
      setAddOpen(false)
      if (selectedParentId) setCollapsed(p => { const n=new Set(p); n.delete(selectedParentId!); return n })
    } catch(_) {}
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRow||!validateForm()) { if (!editingRow) return; toast.error('Please fix validation errors'); return }
    const cells = formCols
      .map(col => ({ columnId: col.id, value: sanitiseValue(getFieldMeta(col), formData[col.id]) }))
      .filter(c => c.value !== null && c.value !== undefined)
    try { await updateRow({id:editingRow.id, cells}); setEditOpen(false) } catch(_) {}
  }

  const handleDelete = async () => {
    if (!deletingRow) return
    try { await deleteRow(deletingRow.id); setDeleteOpen(false); setDeletingRow(null) } catch(_) {}
  }

  if (!isConfigured) {
    return <SetupScreen onConnect={(t,s)=>{ setToken(t); setSheetId(s); setIsConfigured(true) }} />
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y:-60, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ type:'spring', stiffness:200, damping:25 }}
        className="h-[58px] bg-white/80 backdrop-blur-xl border-b border-slate-200/70 flex items-center justify-between px-5 sticky top-0 z-40 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 leading-none">
              {isLoading ? <Skeleton className="h-4 w-48" /> : (sheet?.name||'Project Dashboard')}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                Live sync · {lastSynced.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
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
              placeholder="Search..."
              className="pl-8 w-56 h-8 bg-slate-100 border-none text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-blue-400/40"
            />
            {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-slate-400" /></button>}
          </div>
          <motion.button
            whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
            onClick={()=>openAdd()}
            className="flex items-center gap-1.5 h-8 px-4 bg-gradient-to-r from-blue-500 to-violet-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </motion.button>
          <button
            onClick={()=>refetch().then(()=>setLastSynced(new Date()))}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all hover:scale-105"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading?'animate-spin':''}`} />
          </button>
          <button
            onClick={()=>{ localStorage.removeItem('sm_token'); localStorage.removeItem('sm_sheet'); setIsConfigured(false) }}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-slate-500 transition-all"
            title="Disconnect"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.header>

      <main className="flex-1 p-5 max-w-screen-2xl mx-auto w-full">
        {/* Stats */}
        {!isLoading && !error && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            {[
              { label:'Total Tasks', value: tasks.filter(t=>t.level>1).length, icon:<ListTodo className="w-4 h-4" />, grad:'from-blue-500 to-cyan-600', sub:`in ${tasks.filter(t=>t.level===1).length} phases` },
              { label:'Active Phases', value: tasks.filter(t=>t.level===1).length, icon:<FolderOpen className="w-4 h-4" />, grad:'from-violet-500 to-purple-600', sub:'project phases' },
              { label:'Completed', value: completionStats.completed, icon:<CheckCircle2 className="w-4 h-4" />, grad:'from-emerald-500 to-teal-600', sub:`of ${completionStats.total} tasks` },
              { label:'Progress', value: `${completionStats.avg}%`, rawNum: completionStats.avg, icon:<TrendingUp className="w-4 h-4" />, grad:'from-orange-500 to-amber-600', sub:'avg completion', isProgress:true },
            ].map(stat => (
              <motion.div
                key={stat.label} variants={fadeUp}
                whileHover={{ y:-3, boxShadow:'0 12px 32px -8px rgba(0,0,0,0.12)' }}
                className="bg-white rounded-2xl border border-slate-100 p-4 transition-all cursor-default"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-2xl font-black text-slate-900">
                      {'rawNum' in stat ? <AnimatedNumber value={stat.rawNum as number} /> : stat.value}
                      {'isProgress' in stat && stat.isProgress && <span className="text-lg text-slate-600">%</span>}
                    </p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.grad} flex items-center justify-center text-white shadow-lg`}>
                    {stat.icon}
                  </div>
                </div>
                {'isProgress' in stat && stat.isProgress ? (
                  <>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <motion.div
                        initial={{width:0}} animate={{width:`${stat.rawNum}%`}} transition={{duration:1,ease:[0.4,0,0.2,1]}}
                        className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{stat.sub}</p>
                  </>
                ) : (
                  <p className="text-[10px] text-slate-400">{stat.sub}</p>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} className="bg-white rounded-2xl border border-red-100 p-16 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-black text-slate-800 mb-1">Could not load sheet</h2>
            <p className="text-sm text-slate-500 mb-5">{(error as any).message}</p>
            <Button onClick={()=>refetch()} size="sm" variant="outline" className="rounded-xl px-6">Retry</Button>
          </motion.div>
        )}

        {/* Table */}
        {!error && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.15}} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ListTodo className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-sm font-black text-slate-800">Project Plan</span>
                {!isLoading && (
                  <motion.span initial={{scale:0}} animate={{scale:1}} className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {visibleTasks.length} rows
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                <CalendarDays className="w-3.5 h-3.5" />
                Synced with Smartsheet
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{minWidth:'900px'}}>
                <thead>
                  <tr className="border-b-2 border-slate-100">
                    <th className="sticky left-0 z-20 bg-slate-50/80 backdrop-blur-sm px-4 py-3 text-left w-10 border-r border-slate-100/80">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#</span>
                    </th>
                    {sheet?.columns.map(col => (
                      <th key={col.id} className="px-4 py-3 text-left whitespace-nowrap">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{col.title}</span>
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 bg-slate-50/80 backdrop-blur-sm px-4 py-3 text-right w-28 border-l border-slate-100/80">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({length:7}).map((_,i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-4 py-3"><Skeleton className="h-3 w-5" /></td>
                        {Array.from({length:5}).map((_,j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className={`h-3 ${j===0?'w-40':'w-20'}`} /></td>
                        ))}
                        <td className="px-4 py-3 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : visibleTasks.length===0 ? (
                    <tr><td colSpan={999} className="py-20 text-center">
                      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
                        <div className="text-5xl mb-3">📋</div>
                        <p className="text-slate-400 text-sm font-semibold">
                          {search?`No results for "${search}"`:'No tasks yet'}
                        </p>
                        {!search && (
                          <button onClick={()=>openAdd()} className="mt-4 text-blue-500 hover:text-blue-600 text-sm font-bold flex items-center gap-1 mx-auto">
                            <Plus className="w-4 h-4" /> Add your first task
                          </button>
                        )}
                      </motion.div>
                    </td></tr>
                  ) : (
                    <AnimatePresence initial={false}>
                      {visibleTasks.map((task, idx) => {
                        const isRoot = task.level===0
                        const isPhase = task.level===1
                        const isLeaf = task.level>=2
                        const isCol = collapsed.has(task.id)
                        const hasChildren = tasks.some(t=>t.calculatedParentId===task.id)
                        const indent = task.level*20

                        return (
                          <motion.tr
                            key={task.id}
                            initial={{ opacity:0, x:-10 }}
                            animate={{ opacity:1, x:0 }}
                            exit={{ opacity:0, x:10, height:0 }}
                            transition={{ delay: idx*0.02, type:'spring', stiffness:300, damping:28 }}
                            className={`border-b group transition-all duration-150 ${
                              isRoot ? 'border-blue-100/80 bg-gradient-to-r from-blue-50/70 to-transparent hover:from-blue-100/60' :
                              isPhase ? 'border-slate-100 bg-slate-50/80 hover:bg-slate-100/60' :
                              'border-slate-50 hover:bg-blue-50/20'
                            }`}
                          >
                            <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 w-10 border-r border-slate-100/60">
                              <span className="text-[11px] text-slate-300 font-mono tabular-nums">{task.rowNumber}</span>
                            </td>

                            {sheet?.columns.map(col => {
                              const val = getCellDisplay(task, col)
                              const isPrimary = col.primary
                              const title = col.title.toLowerCase().replace(/\s+/g,'')
                              const isHealth = title==='health'
                              const isStatus = title.includes('status')
                              const isDate = col.type==='DATE'
                              const isContact = col.type==='CONTACT_LIST'
                              const isPct = col.title.toLowerCase().includes('complete')||col.title.toLowerCase().includes('%')

                              return (
                                <td key={col.id} className="px-4 py-2.5 align-middle">
                                  {isPrimary ? (
                                    <div className="flex items-center" style={{paddingLeft:`${indent}px`}}>
                                      {task.level>0 && (
                                        <div className="flex-shrink-0 mr-1">
                                          <div className="w-3 h-4 border-l-2 border-b-2 border-slate-200 rounded-bl-sm" />
                                        </div>
                                      )}
                                      {hasChildren ? (
                                        <motion.button
                                          whileTap={{ scale:0.85 }}
                                          onClick={()=>toggleCollapse(task.id)}
                                          className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-blue-100 transition-colors mr-1.5 flex-shrink-0"
                                        >
                                          <motion.div animate={{ rotate: isCol?-90:0 }} transition={{ duration:0.2 }}>
                                            <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                                          </motion.div>
                                        </motion.button>
                                      ) : (
                                        <div className="w-5 mr-1.5 flex-shrink-0 flex items-center justify-center">
                                          {isLeaf && <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                                        </div>
                                      )}
                                      <span className={`truncate max-w-[280px] ${
                                        isRoot ? 'font-black text-slate-900 text-[15px]' :
                                        isPhase ? 'font-bold text-slate-800 text-sm' :
                                        'font-semibold text-slate-700 text-sm'
                                      }`}>
                                        {String(val||'—')}
                                      </span>
                                    </div>
                                  ) : isHealth ? <HealthBadge value={String(val||'')} />
                                    : isStatus ? <StatusBadge value={String(val||'')} />
                                    : isDate && val ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg font-semibold whitespace-nowrap">
                                        <CalendarDays className="w-3 h-3 text-blue-400" />
                                        {fmtDate(val)}
                                      </span>
                                    ) : isContact ? <AssigneeStack value={val} />
                                    : isPct && val!=null && val!=='' ? <ProgressBar value={val} />
                                    : col.type==='CHECKBOX' ? (
                                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${val?'bg-emerald-500 border-emerald-500':'border-slate-200'}`}>
                                        {val && <CheckCircle2 className="w-3 h-3 text-white" />}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-slate-600 max-w-[180px] block truncate">
                                        {val!=null&&val!=='' ? String(val) : <span className="text-slate-200">—</span>}
                                      </span>
                                    )}
                                </td>
                              )
                            })}

                            {/* Actions */}
                            <td className="sticky right-0 z-10 bg-inherit px-3 py-2 border-l border-slate-100/60">
                              <motion.div
                                initial={{ opacity:0 }}
                                whileHover={{ opacity:1 }}
                                className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {!isLeaf && (
                                  <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                                    onClick={()=>openAdd(task.id)} title="Add child task"
                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 flex items-center justify-center"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </motion.button>
                                )}
                                <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                                  onClick={()=>openEdit(task)} title="Edit"
                                  className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </motion.button>
                                {isLeaf && (
                                  <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                                    onClick={()=>openDelete(task)} title="Delete"
                                    className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </motion.button>
                                )}
                              </motion.div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </main>

      {/* ── Add Dialog ─────────────────────────────────────────────────── */}
      <TaskFormModal
        open={addOpen} onClose={()=>setAddOpen(false)}
        title="Create New Task"
        description={selectedParentId ? `Adding under: "${parentCandidates.find(p=>p.id===selectedParentId)?getPrimaryValue(parentCandidates.find(p=>p.id===selectedParentId)!):'...'}"` : 'New task will sync to Smartsheet immediately'}
        cols={formCols} formData={formData} onChange={setField} errors={formErrors}
        onSubmit={handleAdd} isMutating={isMutating} mode="add"
        parentCandidates={parentCandidates} selectedParentId={selectedParentId}
        setSelectedParentId={setSelectedParentId} getPrimaryValue={getPrimaryValue}
      />

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
      <TaskFormModal
        open={editOpen} onClose={()=>setEditOpen(false)}
        title="Edit Task"
        description={editingRow ? getPrimaryValue(editingRow) : ''}
        cols={formCols} formData={formData} onChange={setField} errors={formErrors}
        onSubmit={handleEdit} isMutating={isMutating} mode="edit"
        parentCandidates={parentCandidates} selectedParentId={null}
        setSelectedParentId={()=>{}} getPrimaryValue={getPrimaryValue}
      />

      {/* ── Delete Dialog ────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={v=>!v&&setDeleteOpen(false)}>
        <DialogContent className="max-w-sm rounded-3xl border border-slate-200 shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 px-7 py-6">
            <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:300}}
              className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
              <Trash2 className="w-6 h-6 text-white" />
            </motion.div>
            <DialogTitle className="text-white font-black text-lg">Delete Task</DialogTitle>
            <DialogDescription className="text-red-100 text-sm mt-1">This action cannot be undone</DialogDescription>
          </div>
          <div className="px-7 py-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              Permanently delete{' '}
              <strong className="text-slate-900">"{deletingRow ? getPrimaryValue(deletingRow) : ''}"</strong>
              {' '}from Smartsheet?
            </p>
          </div>
          <div className="px-7 pb-6 flex gap-3">
            <Button variant="outline" onClick={()=>setDeleteOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button
              onClick={handleDelete} disabled={isMutating}
              className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white shadow-lg shadow-red-500/20 font-bold"
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete Forever
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
