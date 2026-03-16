import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Edit2, Loader2, ChevronRight, ChevronDown, Sheet, AlertCircle, RefreshCw } from 'lucide-react'
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

  const { sheet, tasks, isLoading, error, refetch, addRow, updateRow, deleteRow } = useSmartsheet(token, sheetId)

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
    
    const newRow: any = { cells }
    if (parentRowId) {
      newRow.parentId = parentRowId
      newRow.toBottom = true
    } else {
      newRow.toBottom = true
    }

    addRow([newRow], {
      onSuccess: () => setIsAddDialogOpen(false)
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
    if (confirm('Are you sure you want to delete this task?')) {
      deleteRow(row.id)
    }
  }

  const filteredTasks = tasks.filter(task => {
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

  const isEditable = (column: SmartsheetColumn) => {
    // Basic logic for editable columns
    return !column.primary // Typically the primary column is editable, but let's allow most for now
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
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="h-16 border-b flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sheet className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-secondary-foreground">
            {sheet?.name || 'Loading...'}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground/40 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search tasks..." 
              className="pl-9 w-64 h-10 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={() => handleOpenAddDialog()} className="h-10 px-4 gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => refetch()} 
            className="h-10 w-10 hover:bg-secondary rounded-full"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              localStorage.removeItem('smartsheet_token')
              localStorage.removeItem('smartsheet_sheet_id')
              setIsConfigured(false)
            }}
            className="h-10 w-10 hover:bg-red-50 text-red-500 rounded-full"
            title="Disconnect"
          >
            <AlertCircle className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6 max-w-[1600px] mx-auto w-full">
        {error ? (
          <Card className="p-12 text-center border-dashed border-2">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Failed to load sheet</h2>
            <p className="text-secondary-foreground/60 mb-6">{(error as any).message}</p>
            <Button onClick={() => refetch()} variant="outline">Try Again</Button>
          </Card>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-secondary/30 text-left border-b">
                    <th className="p-4 font-semibold text-secondary-foreground/70 text-sm whitespace-nowrap sticky left-0 bg-secondary/30 z-10 w-16">#</th>
                    {sheet?.columns.map(col => (
                      <th key={col.id} className="p-4 font-semibold text-secondary-foreground/70 text-sm whitespace-nowrap min-w-[150px]">
                        {col.title}
                      </th>
                    ))}
                    <th className="p-4 font-semibold text-secondary-foreground/70 text-sm whitespace-nowrap text-right sticky right-0 bg-secondary/30 z-10">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
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
                      <td colSpan={100} className="p-12 text-center text-secondary-foreground/50">
                        {searchQuery ? 'No tasks match your search' : 'No tasks found in this sheet'}
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-secondary/20 transition-colors group">
                        <td className="p-4 text-sm text-secondary-foreground/40 font-mono sticky left-0 bg-white group-hover:bg-secondary/20 z-10">{task.rowNumber}</td>
                        {sheet?.columns.map(col => (
                          <td key={col.id} className="p-4 text-sm text-secondary-foreground">
                            <div className="flex items-center gap-2">
                              {col.primary && task.level > 0 && (
                                <div style={{ paddingLeft: `${task.level * 20}px` }} className="flex items-center gap-2">
                                  {/* Just visual padding for hierarchy */}
                                </div>
                              )}
                              <span className={col.primary ? 'font-medium' : ''}>
                                {getCellValue(task, col.id)}
                              </span>
                            </div>
                          </td>
                        ))}
                        <td className="p-4 text-right sticky right-0 bg-white group-hover:bg-secondary/20 z-10">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenAddDialog(task.id)}
                              className="h-8 w-8 text-primary hover:bg-primary/10 rounded-full"
                              title="Add sub-task"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenEditDialog(task)}
                              className="h-8 w-8 text-secondary-foreground/60 hover:bg-secondary rounded-full"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(task)}
                              className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-full"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
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
            {sheet?.columns.map(col => (
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
            {sheet?.columns.map(col => (
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
                      id={`edit-${col.id}`}
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
