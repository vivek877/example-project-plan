import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Edit2, Loader2, ChevronRight, ChevronDown, Sheet, AlertCircle, RefreshCw, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useSmartsheet } from '@/hooks/useSmartsheet'
import { SmartsheetRow, SmartsheetCell, SmartsheetColumn } from '@/lib/smartsheet'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import toast from 'react-hot-toast'

// Smartsheet column types
const COLUMN_TYPES = {
  TEXT_NUMBER: 'TEXT_NUMBER',
  PICKLIST: 'PICKLIST',
  DATE: 'DATE',
  CHECKBOX: 'CHECKBOX',
};

function App() {
  const [token, setToken] = useState<string>('')
  const [sheetId, setSheetId] = useState<string>('')
  const [isConfigured, setIsConfigured] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SmartsheetRow | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState<Record<number, any>>({})
  const [parentRowId, setParentRowId] = useState<number | null>(null)
  const [availableSheets, setAvailableSheets] = useState<{ id: number, name: string }[]>([])
  const [isLoadingSheets, setIsLoadingSheets] = useState(false)
  const [collapsedRows, setCollapsedRows] = useState<Set<number>>(new Set())
  const [lastSynced, setLastSynced] = useState<Date>(new Date())

  const { sheet, tasks, isLoading, error, refetch, addRow, updateRow, deleteRow } = useSmartsheet(token, sheetId)

  // Auto-refresh every 30 seconds for bi-directional sync
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(() => {
      refetch().then(() => setLastSynced(new Date()));
    }, 30000);
    return () => clearInterval(interval);
  }, [isConfigured, refetch]);

  // Load from local storage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('smartsheet_token')
    const savedSheetId = localStorage.getItem('smartsheet_sheet_id')
    if (savedToken && savedSheetId) {
      setToken(savedToken)
      setSheetId(savedSheetId)
      setIsConfigured(true)
    }
  }, [])

  const fetchSheets = async () => {
    if (!token) {
      toast.error('Please enter an access token first')
      return
    }
    setIsLoadingSheets(true)
    try {
      const data = await SmartsheetService.getSheetList(token)
      setAvailableSheets(data.data || [])
    } catch (err: any) {
      toast.error(`Failed to fetch sheets: ${err.message}`)
    } finally {
      setIsLoadingSheets(false)
    }
  }

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault()
    if (token && sheetId) {
      localStorage.setItem('smartsheet_token', token)
      localStorage.setItem('smartsheet_sheet_id', sheetId)
      setIsConfigured(true)
      refetch()
    }
  }

  const handleOpenAddDialog = (parentId: number | null = null) => {
    setParentRowId(parentId)
    setFormData({})
    setIsAddDialogOpen(true)
  }

  const handleOpenEditDialog = (row: SmartsheetRow) => {
    setEditingRow(row)
    const initialFormData: Record<number, any> = {}
    row.cells.forEach(cell => {
      initialFormData[cell.columnId] = cell.value
    })
    setFormData(initialFormData)
    setIsEditDialogOpen(true)
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cells = Object.entries(formData).map(([columnId, value]) => ({
      columnId: Number(columnId),
      value
    }))
    
    // Determine where to add the row
    const newRow: any = { cells }
    if (parentRowId) {
      newRow.parentId = parentRowId;
      // In Smartsheet, when adding with parentId, it's automatically placed as a child
    } else {
      newRow.toBottom = true;
    }

    addRow([newRow], {
      onSuccess: () => {
        setIsAddDialogOpen(false);
        // Expand the parent if it was collapsed
        if (parentRowId) {
          setCollapsedRows(prev => {
            const next = new Set(prev);
            next.delete(parentRowId);
            return next;
          });
        }
      }
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRow) return

    const cells = Object.entries(formData).map(([columnId, value]) => ({
      columnId: Number(columnId),
      value
    }))

    updateRow([{
      id: editingRow.id,
      cells
    }], {
      onSuccess: () => setIsEditDialogOpen(false)
    })
  }

  const handleDelete = (row: SmartsheetRow) => {
    // Protection for phases and project
    if (row.level <= 1) {
      toast.error('Phases and Project rows cannot be deleted.');
      return;
    }

    if (confirm('Are you sure you want to delete this task?')) {
      deleteRow(row.id)
    }
  }

  const toggleCollapse = (rowId: number) => {
    setCollapsedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const isRowVisible = (task: any) => {
    // Check if any ancestor is collapsed
    const parentId = task.calculatedParentId;
    if (!parentId) return true;
    
    if (collapsedRows.has(parentId)) return false;
    
    // Find parent object to check its visibility recursively
    const parent = tasks.find((t: any) => t.id === parentId);
    if (parent) return isRowVisible(parent);
    
    return true;
  };

  const filteredTasks = tasks.filter(task => {
    // Check visibility first
    if (!isRowVisible(task)) return false;

    const searchStr = searchQuery.toLowerCase()
    return task.cells.some(cell => 
      cell.displayValue?.toLowerCase().includes(searchStr) || 
      String(cell.value || '').toLowerCase().includes(searchStr)
    )
  })

  const getCellValue = (row: SmartsheetRow, columnId: number) => {
    const cell = row.cells.find(c => c.columnId === columnId)
    return cell?.displayValue || cell?.value || '-'
  }

  const renderHealthIndicator = (value: string) => {
    const val = value.toLowerCase();
    let colorClass = "bg-slate-200";
    let textColor = "text-slate-500";
    
    if (val === 'green') {
      colorClass = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]";
      textColor = "text-green-600";
    }
    else if (val === 'yellow') {
      colorClass = "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]";
      textColor = "text-yellow-600";
    }
    else if (val === 'red') {
      colorClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]";
      textColor = "text-red-600";
    }
    else if (val === 'blue') {
      colorClass = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]";
      textColor = "text-blue-600";
    }
    
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-50 border border-slate-100 w-fit">
        <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
        <span className={`text-[11px] font-bold uppercase tracking-wider ${textColor}`}>{val || 'N/A'}</span>
      </div>
    );
  }

  const isEditable = (column: SmartsheetColumn) => {
    // Hide formula columns or system columns from editing
    // Smartsheet API docs: columns have 'formula' and 'systemColumnType'
    return !(column as any).formula && !(column as any).systemColumnType;
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 shadow-xl border-none">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Sheet className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-secondary-foreground">Smartsheet Manager</h1>
            <p className="text-secondary-foreground/60 text-center mt-2">
              Connect your Smartsheet to start managing tasks.
            </p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">API Access Token</Label>
              <Input 
                id="token"
                type="password"
                placeholder="Enter your Smartsheet token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="bg-secondary/50 border-none h-12"
              />
              <p className="text-[10px] text-secondary-foreground/40 px-1">
                Found in Account Settings &gt; Personal Settings &gt; API Access
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheetId">Sheet</Label>
              <div className="flex gap-2">
                <Select value={sheetId} onValueChange={setSheetId}>
                  <SelectTrigger id="sheetId" className="bg-secondary/50 border-none h-12 flex-1">
                    <SelectValue placeholder="Select or enter ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSheets.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                    <div className="p-2 border-t">
                      <Input 
                        placeholder="Or enter numeric ID"
                        value={sheetId}
                        onChange={(e) => setSheetId(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </SelectContent>
                </Select>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={fetchSheets} 
                  className="h-12 w-12"
                  disabled={isLoadingSheets}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-[10px] text-secondary-foreground/40 px-1">
                Select from your sheets or enter the numeric ID from your sheet URL
              </p>
            </div>
            <Button type="submit" className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90">
              Connect Sheet
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="h-16 border-b flex items-center justify-between px-6 sticky top-0 bg-white/80 backdrop-blur-md z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">
              {sheet?.name || 'Project Dashboard'}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-slate-500 font-medium">
                Live Sync Active • Last updated {lastSynced.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search project..." 
              className="pl-9 w-72 h-10 bg-slate-100 border-none focus-visible:ring-2 focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => handleOpenAddDialog()} className="h-10 px-4 gap-2 bg-primary hover:bg-primary/90 shadow-md">
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => refetch().then(() => setLastSynced(new Date()))} 
            className="h-10 w-10 text-slate-500 hover:bg-slate-100 rounded-lg"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsConfigured(false)}
            className="h-10 w-10 text-slate-500 hover:bg-slate-100 rounded-lg"
            title="Project Settings"
          >
            <AlertCircle className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 max-w-[1800px] mx-auto w-full">
        {/* Statistics Cards */}
        {!error && !isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 border-none shadow-sm bg-white flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500">Total Tasks</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-900">{tasks.filter(t => t.level > 1).length}</span>
                <span className="text-xs text-green-600 font-medium">+2 this week</span>
              </div>
            </Card>
            <Card className="p-4 border-none shadow-sm bg-white flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500">Active Phases</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-900">{tasks.filter(t => t.level === 1).length}</span>
              </div>
            </Card>
            <Card className="p-4 border-none shadow-sm bg-white flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500">Avg Completion</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-slate-900">68%</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden ml-2">
                  <div className="h-full bg-primary" style={{ width: '68%' }} />
                </div>
              </div>
            </Card>
            <Card className="p-4 border-none shadow-sm bg-white flex flex-col justify-between">
              <span className="text-sm font-medium text-slate-500">Project Status</span>
              <div className="mt-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none font-bold">On Track</Badge>
              </div>
            </Card>
          </div>
        )}

        {error ? (
          <Card className="p-12 text-center border-dashed border-2 bg-white">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-slate-900">Failed to load sheet</h2>
            <p className="text-slate-500 mb-6 font-medium">{(error as any).message}</p>
            <Button onClick={() => refetch()} variant="outline" className="px-8">Try Again</Button>
          </Card>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-left border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider sticky left-0 bg-slate-50 z-20 w-16">No.</th>
                    {sheet?.columns.map(col => {
                      const isHealth = col.title.toLowerCase() === 'health';
                      return (
                        <th key={col.id} className={`p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider min-w-[180px] ${isHealth ? 'w-24 min-w-0 text-center' : ''}`}>
                          {col.title}
                        </th>
                      );
                    })}
                    <th className="p-4 font-bold text-slate-500 text-[11px] uppercase tracking-wider text-right sticky right-0 bg-slate-50 z-20 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i}>
                        <td className="p-4"><Skeleton className="h-4 w-4" /></td>
                        {sheet?.columns.map(col => (
                          <td key={col.id} className="p-4"><Skeleton className="h-4 w-full" /></td>
                        )) || <td className="p-4"><Skeleton className="h-4 w-full" /></td>}
                        <td className="p-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={100} className="p-16 text-center text-slate-400 font-medium">
                        {searchQuery ? 'No tasks matching your criteria' : 'This project plan is empty'}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const isRoot = task.level === 0;
                      const isPhase = task.level === 1;
                      const isTask = task.level > 1;
                      const isCollapsed = collapsedRows.has(task.id);
                      
                      return (
                        <tr 
                          key={task.id} 
                          className={`
                            hover:bg-slate-50/80 transition-colors group
                            ${isRoot ? 'bg-slate-50/50 font-bold border-l-[6px] border-l-primary' : ''}
                            ${isPhase ? 'bg-white font-semibold border-l-[6px] border-l-slate-300' : ''}
                            ${isTask ? 'bg-white border-l-[6px] border-l-transparent' : ''}
                          `}
                        >
                          <td className="p-4 text-[13px] text-slate-400 font-mono sticky left-0 bg-inherit group-hover:bg-slate-50 z-10">{task.rowNumber}</td>
                          {sheet?.columns.map(col => {
                            const isHealth = col.title.toLowerCase() === 'health';
                            const cellValue = getCellValue(task, col.id);
                            const isPrimary = col.primary;
                            
                            return (
                              <td key={col.id} className={`p-4 text-[14px] text-slate-700 ${isHealth ? 'text-center' : ''}`}>
                                <div className="flex items-center gap-2">
                                  {isPrimary && (
                                    <div style={{ paddingLeft: `${task.level * 28}px` }} className="flex items-center relative">
                                      {/* Vertical Line Guide */}
                                      {task.level > 0 && (
                                        <div className="absolute top-[-24px] bottom-[-24px] left-[-14px] w-px bg-slate-200" />
                                      )}
                                      
                                      {(isRoot || isPhase) ? (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-6 w-6 rounded-md hover:bg-slate-200 mr-1 shrink-0"
                                          onClick={() => toggleCollapse(task.id)}
                                        >
                                          {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-primary" />}
                                        </Button>
                                      ) : (
                                        <div className="w-6 shrink-0 flex justify-center">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {isHealth ? (
                                    <div className="flex justify-center w-full">
                                      {renderHealthIndicator(String(cellValue))}
                                    </div>
                                  ) : (
                                    <span className={`
                                      ${isRoot ? 'text-slate-900 text-base' : ''}
                                      ${isPhase ? 'text-slate-800' : 'text-slate-600'}
                                      ${isPrimary ? 'truncate max-w-[400px]' : ''}
                                    `}>
                                      {cellValue}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-4 text-right sticky right-0 bg-inherit group-hover:bg-slate-50 z-10 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {(isRoot || isPhase) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleOpenAddDialog(task.id)}
                                  className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg"
                                  title="Add Child Task"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleOpenEditDialog(task)}
                                className="h-8 w-8 text-slate-500 hover:bg-slate-200 rounded-lg"
                                title="Quick Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {isTask && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDelete(task)}
                                  className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Task Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              {parentRowId ? 'This task will be added as a child of the selected task.' : 'Add a new task to the sheet.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-2 gap-4 py-4">
            {sheet?.columns.filter(isEditable).map(col => (
              <div key={col.id} className={`space-y-2 ${col.primary ? 'col-span-2' : ''}`}>
                <Label htmlFor={`add-${col.id}`} className="text-xs font-semibold text-secondary-foreground/70 uppercase tracking-wider">{col.title}</Label>
                {col.type === COLUMN_TYPES.PICKLIST ? (
                  <Select 
                    value={formData[col.id] || ''} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, [col.id]: val }))}
                  >
                    <SelectTrigger id={`add-${col.id}`} className="bg-secondary/30 border-none h-11">
                      <SelectValue placeholder={`Select ${col.title}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {col.options?.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : col.type === COLUMN_TYPES.DATE ? (
                  <Input 
                    id={`add-${col.id}`}
                    type="date"
                    className="bg-secondary/30 border-none h-11"
                    onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
                  />
                ) : col.type === COLUMN_TYPES.CHECKBOX ? (
                  <div className="flex items-center h-11">
                    <input 
                      type="checkbox"
                      id={`add-${col.id}`}
                      className="w-5 h-5 rounded border-secondary"
                      onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.checked }))}
                    />
                  </div>
                ) : (
                  <Input 
                    id={`add-${col.id}`}
                    placeholder={`Enter ${col.title}`}
                    className="bg-secondary/30 border-none h-11"
                    onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} className="px-8 shadow-lg shadow-primary/20">Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the details for this task.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4 py-4">
            {sheet?.columns.filter(isEditable).map(col => (
              <div key={col.id} className={`space-y-2 ${col.primary ? 'col-span-2' : ''}`}>
                <Label htmlFor={`edit-${col.id}`} className="text-xs font-semibold text-secondary-foreground/70 uppercase tracking-wider">{col.title}</Label>
                {col.type === COLUMN_TYPES.PICKLIST ? (
                  <Select 
                    value={String(formData[col.id] || '')} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, [col.id]: val }))}
                  >
                    <SelectTrigger id={`edit-${col.id}`} className="bg-secondary/30 border-none h-11">
                      <SelectValue placeholder={`Select ${col.title}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {col.options?.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : col.type === COLUMN_TYPES.DATE ? (
                  <Input 
                    id={`edit-${col.id}`}
                    type="date"
                    value={formData[col.id] ? String(formData[col.id]).split('T')[0] : ''}
                    className="bg-secondary/30 border-none h-11"
                    onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
                  />
                ) : col.type === COLUMN_TYPES.CHECKBOX ? (
                  <div className="flex items-center h-11">
                    <input 
                      type="checkbox"
                      id={`add-${col.id}`}
                      checked={!!formData[col.id]}
                      className="w-5 h-5 rounded border-secondary"
                      onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.checked }))}
                    />
                  </div>
                ) : (
                  <Input 
                    id={`edit-${col.id}`}
                    value={formData[col.id] || ''}
                    placeholder={`Enter ${col.title}`}
                    className="bg-secondary/30 border-none h-11"
                    onChange={(e) => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSubmit} className="px-8 shadow-lg shadow-primary/20">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
