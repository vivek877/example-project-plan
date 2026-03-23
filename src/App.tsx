import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Search, Trash2, Edit2, ChevronRight, ChevronDown,
  RefreshCw, AlertCircle, Settings, X, CheckCircle2, Loader2,
  FolderOpen, ListTodo, Clock, BarChart3, Zap, Link2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useSmartsheet } from '@/hooks/useSmartsheet'
import { SmartsheetRow, SmartsheetColumn, COL_TYPE, isReadOnly, apiGetSheetList } from '@/lib/smartsheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import toast from 'react-hot-toast'

// ─── Setup Screen ────────────────────────────────────────────────────────────
function SetupScreen({ onConnect }: { onConnect: (token: string, sheetId: string) => void }) {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [sheets, setSheets] = useState<{ id: number; name: string }[]>([])
  const [loadingSheets, setLoadingSheets] = useState(false)

  const handleFetchSheets = async () => {
    if (!token.trim()) { toast.error('Enter API token first'); return }
    setLoadingSheets(true)
    try {
      const data = await apiGetSheetList(token.trim())
      setSheets(data.data || [])
      if ((data.data || []).length === 0) toast.error('No sheets found for this token')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingSheets(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim() || !sheetId.trim()) { toast.error('Both fields required'); return }
    localStorage.setItem('sm_token', token.trim())
    localStorage.setItem('sm_sheet', sheetId.trim())
    onConnect(token.trim(), sheetId.trim())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-blue-500/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Project Manager</h1>
          <p className="text-blue-300 mt-2 text-center text-sm">Connected to Smartsheet</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 space-y-5 shadow-2xl">
          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-semibold">Smartsheet API Token</Label>
            <Input
              type="password"
              placeholder="Paste your access token..."
              value={token}
              onChange={e => setToken(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 focus-visible:ring-blue-400"
            />
            <p className="text-white/40 text-xs">Account → Personal Settings → API Access → Generate Token</p>
          </div>

          <div className="space-y-2">
            <Label className="text-white/80 text-sm font-semibold">Sheet</Label>
            <div className="flex gap-2">
              {sheets.length > 0 ? (
                <Select value={sheetId} onValueChange={setSheetId}>
                  <SelectTrigger className="flex-1 bg-white/10 border-white/20 text-white h-12 focus:ring-blue-400">
                    <SelectValue placeholder="Select a sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Sheet ID (e.g. 1234567890)"
                  value={sheetId}
                  onChange={e => setSheetId(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 focus-visible:ring-blue-400"
                />
              )}
              <Button
                type="button"
                onClick={handleFetchSheets}
                disabled={loadingSheets}
                className="h-12 w-12 bg-white/10 border border-white/20 hover:bg-white/20 text-white"
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSheets ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-white/40 text-xs">Click refresh to load your sheets, or paste the numeric ID</p>
          </div>

          <Button type="submit" className="w-full h-12 bg-blue-500 hover:bg-blue-400 text-white font-bold text-base shadow-lg shadow-blue-500/30">
            <Link2 className="w-4 h-4 mr-2" />
            Connect to Smartsheet
          </Button>
        </form>
      </div>
    </div>
  )
}

// ─── Field Renderer for Forms ─────────────────────────────────────────────────
function FormField({
  col, value, onChange
}: {
  col: SmartsheetColumn
  value: any
  onChange: (v: any) => void
}) {
  if (col.type === COL_TYPE.CHECKBOX) {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <div
          onClick={() => onChange(!value)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            value ? 'bg-blue-500 border-blue-500' : 'border-slate-300 group-hover:border-blue-400'
          }`}
        >
          {value && <CheckCircle2 className="w-3 h-3 text-white" />}
        </div>
        <span className="text-sm text-slate-600">{value ? 'Yes' : 'No'}</span>
      </label>
    )
  }

  if (col.type === COL_TYPE.PICKLIST && col.options?.length) {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-blue-400">
          <SelectValue placeholder={`Select ${col.title}...`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— None —</SelectItem>
          {col.options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (col.type === COL_TYPE.DATE) {
    // Smartsheet dates are ISO strings like "2024-03-15"
    const dateVal = value ? String(value).slice(0, 10) : ''
    return (
      <Input
        type="date"
        value={dateVal}
        onChange={e => onChange(e.target.value || null)}
        className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-blue-400"
      />
    )
  }

  if (col.type === COL_TYPE.CONTACT_LIST) {
    return (
      <Input
        type="email"
        placeholder="email@example.com"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-blue-400"
      />
    )
  }

  // TEXT_NUMBER and default
  return (
    <Input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={`Enter ${col.title}...`}
      className="h-10 bg-slate-50 border-slate-200 focus-visible:ring-blue-400"
    />
  )
}

// ─── Health Badge ─────────────────────────────────────────────────────────────
function HealthBadge({ value }: { value: string }) {
  const v = String(value || '').toLowerCase()
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    green:  { bg: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500',  label: 'Green' },
    yellow: { bg: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', label: 'Yellow' },
    red:    { bg: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500',   label: 'Red' },
    blue:   { bg: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-500',  label: 'Blue' },
  }
  const style = map[v]
  if (!style) return <span className="text-slate-400 text-xs">—</span>
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${style.bg}`}>
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ value }: { value: string }) {
  const v = String(value || '')
  const color =
    v.toLowerCase().includes('complete') ? 'bg-green-100 text-green-700 border-green-200' :
    v.toLowerCase().includes('progress') ? 'bg-blue-100 text-blue-700 border-blue-200' :
    v.toLowerCase().includes('not start') ? 'bg-slate-100 text-slate-500 border-slate-200' :
    v.toLowerCase().includes('block') || v.toLowerCase().includes('at risk') ? 'bg-red-100 text-red-600 border-red-200' :
    'bg-slate-100 text-slate-600 border-slate-200'
  if (!v) return <span className="text-slate-400 text-xs">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${color}`}>
      {v}
    </span>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState('')
  const [sheetId, setSheetId] = useState('')
  const [isConfigured, setIsConfigured] = useState(false)

  // Dialog state
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SmartsheetRow | null>(null)
  const [deletingRow, setDeletingRow] = useState<SmartsheetRow | null>(null)

  // Form state
  const [formData, setFormData] = useState<Record<number, any>>({})
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null)

  // UI state
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [lastSynced, setLastSynced] = useState(new Date())

  const { sheet, tasks, isLoading, isMutating, error, refetch, completionStats, addRow, updateRow, deleteRow } =
    useSmartsheet(token, sheetId)

  // Load saved config
  useEffect(() => {
    const t = localStorage.getItem('sm_token')
    const s = localStorage.getItem('sm_sheet')
    if (t && s) { setToken(t); setSheetId(s); setIsConfigured(true) }
  }, [])

  // Auto poll every 30s
  useEffect(() => {
    if (!isConfigured) return
    const id = setInterval(() => refetch().then(() => setLastSynced(new Date())), 30000)
    return () => clearInterval(id)
  }, [isConfigured, refetch])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const editableCols = useMemo(
    () => (sheet?.columns || []).filter(c => !isReadOnly(c)),
    [sheet]
  )

  // Parent candidates = phases (level=1) only — tasks should go under phases
  const parentCandidates = useMemo(
    () => tasks.filter(t => t.level <= 1),
    [tasks]
  )

  const getPrimaryValue = (row: SmartsheetRow) => {
    const col = sheet?.columns.find(c => c.primary)
    if (!col) return '(Unnamed)'
    const cell = row.cells.find(c => c.columnId === col.id)
    return cell?.displayValue || cell?.value || '(Unnamed)'
  }

  const getCellDisplay = (row: SmartsheetRow, col: SmartsheetColumn) => {
    const cell = row.cells.find(c => c.columnId === col.id)
    return cell?.displayValue ?? cell?.value ?? null
  }

  // Visibility with collapse
  const isVisible = (task: SmartsheetRow & { calculatedParentId?: number }): boolean => {
    if (!task.calculatedParentId) return true
    if (collapsed.has(task.calculatedParentId)) return false
    const parent = tasks.find(t => t.id === task.calculatedParentId)
    if (!parent) return true
    return isVisible(parent)
  }

  const visibleTasks = useMemo(() => {
    const s = search.toLowerCase()
    return tasks.filter(t => {
      if (!isVisible(t)) return false
      if (!s) return true
      return t.cells.some(c =>
        String(c.displayValue || c.value || '').toLowerCase().includes(s)
      )
    })
  }, [tasks, collapsed, search])

  const toggleCollapse = (id: number) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── CRUD Handlers ─────────────────────────────────────────────────────────
  const openAddDialog = (parentId: number | null = null) => {
    setSelectedParentId(parentId)
    setFormData({})
    setAddOpen(true)
  }

  const openEditDialog = (row: SmartsheetRow) => {
    setEditingRow(row)
    const init: Record<number, any> = {}
    row.cells.forEach(cell => { init[cell.columnId] = cell.value })
    setFormData(init)
    setEditOpen(true)
  }

  const openDeleteDialog = (row: SmartsheetRow) => {
    if (row.level <= 1) { toast.error('Cannot delete project or phase rows'); return }
    setDeletingRow(row)
    setDeleteOpen(true)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const cells = Object.entries(formData)
      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
      .map(([colId, value]) => ({ columnId: Number(colId), value }))

    if (cells.length === 0) { toast.error('Fill in at least one field'); return }

    try {
      await addRow({ cells, parentId: selectedParentId || undefined })
      setAddOpen(false)
      if (selectedParentId) setCollapsed(prev => { const n = new Set(prev); n.delete(selectedParentId); return n })
    } catch (_) { /* error toast already shown */ }
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
    } catch (_) { /* error toast already shown */ }
  }

  const handleDelete = async () => {
    if (!deletingRow) return
    try {
      await deleteRow(deletingRow.id)
      setDeleteOpen(false)
      setDeletingRow(null)
    } catch (_) { /* error toast already shown */ }
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!isConfigured) {
    return <SetupScreen onConnect={(t, s) => { setToken(t); setSheetId(s); setIsConfigured(true) }} />
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {isLoading ? <Skeleton className="w-40 h-4" /> : (sheet?.name || 'Project Dashboard')}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[11px] text-slate-400 font-medium">
                Live sync · {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-9 w-64 h-9 bg-slate-100 border-none text-sm focus-visible:ring-1 focus-visible:ring-blue-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          <Button
            onClick={() => openAddDialog()}
            className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Task
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => refetch().then(() => setLastSynced(new Date()))}
            className="h-9 w-9 text-slate-500 hover:bg-slate-100 rounded-lg"
            title="Refresh from Smartsheet"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => setIsConfigured(false)}
            className="h-9 w-9 text-slate-400 hover:bg-slate-100 rounded-lg"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-screen-2xl mx-auto w-full">
        {/* Stats */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: 'Total Tasks', value: tasks.filter(t => t.level > 1).length,
                icon: <ListTodo className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50'
              },
              {
                label: 'Phases', value: tasks.filter(t => t.level === 1).length,
                icon: <FolderOpen className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50'
              },
              {
                label: 'Completed', value: completionStats.completed,
                icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, bg: 'bg-green-50'
              },
              {
                label: 'Avg Progress', value: `${completionStats.avg}%`,
                icon: <BarChart3 className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50',
                extra: (
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${completionStats.avg}%` }} />
                  </div>
                )
              },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
                  <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center`}>{stat.icon}</div>
                </div>
                <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                {stat.extra}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white rounded-2xl border border-red-100 p-12 text-center shadow-sm">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800 mb-1">Could not load sheet</h2>
            <p className="text-sm text-slate-500 mb-4">{(error as any).message}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">Retry</Button>
          </div>
        )}

        {/* Table */}
        {!error && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left w-10">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#</span>
                    </th>
                    {sheet?.columns.map(col => (
                      <th key={col.id} className="px-4 py-3 text-left whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{col.title}</span>
                      </th>
                    ))}
                    <th className="sticky right-0 z-20 bg-slate-50 px-4 py-3 text-right w-28">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-4 py-3"><Skeleton className="h-3 w-6" /></td>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className={`h-3 w-${j === 0 ? '40' : '24'}`} /></td>
                        ))}
                        <td className="px-4 py-3"><Skeleton className="h-7 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : visibleTasks.length === 0 ? (
                    <tr>
                      <td colSpan={999} className="py-16 text-center text-slate-400 text-sm">
                        {search ? `No tasks matching "${search}"` : 'No tasks found'}
                      </td>
                    </tr>
                  ) : (
                    visibleTasks.map(task => {
                      const isRoot = task.level === 0
                      const isPhase = task.level === 1
                      const isLeaf = task.level > 1
                      const isCollapsed = collapsed.has(task.id)
                      const hasChildren = tasks.some(t => t.calculatedParentId === task.id)
                      const indent = task.level * 24

                      return (
                        <tr
                          key={task.id}
                          className={`
                            border-b border-slate-50 group transition-colors
                            ${isRoot ? 'bg-blue-50/60 hover:bg-blue-50' : ''}
                            ${isPhase ? 'bg-slate-50/80 hover:bg-slate-100/60' : ''}
                            ${isLeaf ? 'hover:bg-slate-50/60' : ''}
                          `}
                        >
                          {/* Row number */}
                          <td className="sticky left-0 z-10 bg-inherit px-4 py-3 text-xs text-slate-400 font-mono w-10">
                            {task.rowNumber}
                          </td>

                          {/* All columns */}
                          {sheet?.columns.map((col, colIdx) => {
                            const val = getCellDisplay(task, col)
                            const isPrimary = col.primary
                            const isHealth = col.title.toLowerCase() === 'health'
                            const isStatus = col.title.toLowerCase().includes('status')

                            return (
                              <td key={col.id} className="px-4 py-3 max-w-[300px]">
                                {isPrimary ? (
                                  // Primary column: indent + collapse toggle
                                  <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
                                    {/* Tree connector */}
                                    {task.level > 0 && (
                                      <div className="w-3 h-3 border-l-2 border-b-2 border-slate-200 rounded-bl-sm mr-1 flex-shrink-0" />
                                    )}

                                    {/* Collapse toggle */}
                                    {hasChildren ? (
                                      <button
                                        onClick={() => toggleCollapse(task.id)}
                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 mr-1.5 flex-shrink-0 transition-colors"
                                      >
                                        {isCollapsed
                                          ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                          : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                                        }
                                      </button>
                                    ) : (
                                      <div className="w-5 mr-1.5 flex-shrink-0 flex justify-center">
                                        {isLeaf && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                                      </div>
                                    )}

                                    <span className={`
                                      truncate
                                      ${isRoot ? 'font-bold text-slate-900 text-[15px]' : ''}
                                      ${isPhase ? 'font-semibold text-slate-800 text-sm' : ''}
                                      ${isLeaf ? 'font-medium text-slate-700 text-sm' : ''}
                                    `}>
                                      {String(val || '—')}
                                    </span>
                                  </div>
                                ) : isHealth ? (
                                  <HealthBadge value={String(val || '')} />
                                ) : isStatus ? (
                                  <StatusBadge value={String(val || '')} />
                                ) : col.type === COL_TYPE.CHECKBOX ? (
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${val ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                    {val && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                ) : col.type === COL_TYPE.DATE ? (
                                  <span className="text-sm text-slate-600 whitespace-nowrap flex items-center gap-1.5">
                                    {val ? (
                                      <>
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        {new Date(String(val)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </>
                                    ) : <span className="text-slate-300">—</span>}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-600 truncate block max-w-[200px]">
                                    {val != null && val !== '' ? String(val) : <span className="text-slate-300">—</span>}
                                  </span>
                                )}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="sticky right-0 z-10 bg-inherit px-3 py-2">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Add child */}
                              {!isLeaf && (
                                <button
                                  onClick={() => openAddDialog(task.id)}
                                  title="Add child task"
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* Edit */}
                              <button
                                onClick={() => openEditDialog(task)}
                                title="Edit"
                                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete — only tasks (level > 1) */}
                              {isLeaf && (
                                <button
                                  onClick={() => openDeleteDialog(task)}
                                  title="Delete task"
                                  className="w-7 h-7 flex items-center justify-center rounded-md text-red-400 hover:bg-red-50 transition-colors"
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

      {/* ── Add Task Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              Create New Task
            </DialogTitle>
            <DialogDescription>
              {selectedParentId
                ? `Adding under: "${tasks.find(t => t.id === selectedParentId) ? getPrimaryValue(tasks.find(t => t.id === selectedParentId)!) : '...' }"`
                : 'Task will be added to the project plan'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            {/* Parent selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parent Phase</Label>
              <Select
                value={selectedParentId ? String(selectedParentId) : 'none'}
                onValueChange={v => setSelectedParentId(v === 'none' ? null : Number(v))}
              >
                <SelectTrigger className="h-10 bg-slate-50 border-slate-200 focus:ring-blue-400">
                  <SelectValue placeholder="Select parent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Top level (no parent) —</SelectItem>
                  {parentCandidates.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {'  '.repeat(p.level)}{p.level === 0 ? '📁 ' : '📂 '}{getPrimaryValue(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {editableCols.map(col => (
                <div key={col.id} className={`space-y-1.5 ${col.primary ? 'sm:col-span-2' : ''}`}>
                  <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {col.title}
                    {col.primary && <span className="text-blue-500 ml-1">*</span>}
                  </Label>
                  <FormField
                    col={col}
                    value={formData[col.id] ?? ''}
                    onChange={v => setFormData(prev => ({ ...prev, [col.id]: v }))}
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isMutating} className="bg-blue-500 hover:bg-blue-600 text-white px-8">
                {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Task Dialog ────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center">
                <Edit2 className="w-4 h-4 text-white" />
              </div>
              Edit Task
            </DialogTitle>
            <DialogDescription>
              {editingRow ? getPrimaryValue(editingRow) : ''}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEdit} className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editableCols.map(col => (
              <div key={col.id} className={`space-y-1.5 ${col.primary ? 'sm:col-span-2' : ''}`}>
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{col.title}</Label>
                <FormField
                  col={col}
                  value={formData[col.id] ?? ''}
                  onChange={v => setFormData(prev => ({ ...prev, [col.id]: v }))}
                />
              </div>
            ))}

            <DialogFooter className="sm:col-span-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isMutating} className="bg-blue-500 hover:bg-blue-600 text-white px-8">
                {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Delete Task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>"{deletingRow ? getPrimaryValue(deletingRow) : ''}"</strong>?
              This will permanently remove it from Smartsheet and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={isMutating}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
