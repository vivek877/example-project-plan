import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SmartsheetData, SmartsheetRow,
  apiGetSheet, apiAddRow, apiUpdateRow, apiDeleteRow, AddRowPayload, UpdateRowPayload
} from '@/lib/smartsheet';
import toast from 'react-hot-toast';

export const useSmartsheet = (token: string, sheetId: string) => {
  const queryClient = useQueryClient();
  const queryKey = ['sheet', sheetId, token];

  const { data: sheet, isLoading, error, refetch } = useQuery<SmartsheetData>({
    queryKey,
    queryFn: () => apiGetSheet(token, sheetId),
    enabled: !!token && !!sheetId,
    staleTime: 1000 * 20, // 20s
    retry: 1,
  });

  const addRowMutation = useMutation({
    mutationFn: (row: AddRowPayload) => apiAddRow(token, sheetId, row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Task created successfully');
    },
    onError: (err: any) => toast.error(`Failed to create: ${err.message}`),
  });

  const updateRowMutation = useMutation({
    mutationFn: (row: UpdateRowPayload) => apiUpdateRow(token, sheetId, row),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Task updated');
    },
    onError: (err: any) => toast.error(`Failed to update: ${err.message}`),
  });

  const deleteRowMutation = useMutation({
    mutationFn: (rowId: number) => apiDeleteRow(token, sheetId, rowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Task deleted');
    },
    onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
  });

  // Compute parent mapping from Smartsheet's own parentId field
  const tasks = useMemo((): (SmartsheetRow & { calculatedParentId?: number })[] => {
    if (!sheet?.rows) return [];
    const sorted = [...sheet.rows].sort((a, b) => a.rowNumber - b.rowNumber);
    return sorted.map(row => ({
      ...row,
      calculatedParentId: row.parentId, // Smartsheet already gives us parentId
    }));
  }, [sheet]);

  // Compute real completion percentage from % Complete column
  const completionStats = useMemo(() => {
    if (!sheet) return { avg: 0, total: 0, completed: 0 };
    const pctCol = sheet.columns.find(c =>
      c.title.toLowerCase().includes('complete') || c.title.toLowerCase().includes('%')
    );
    if (!pctCol) return { avg: 0, total: 0, completed: 0 };
    const taskRows = tasks.filter(t => t.level > 1);
    if (!taskRows.length) return { avg: 0, total: 0, completed: 0 };
    let sum = 0;
    let count = 0;
    taskRows.forEach(row => {
      const cell = row.cells.find(c => c.columnId === pctCol.id);
      const v = parseFloat(String(cell?.value || '0'));
      if (!isNaN(v)) { sum += v; count++; }
    });
    const avg = count > 0 ? Math.round(sum / count) : 0;
    return { avg, total: taskRows.length, completed: taskRows.filter(r => {
      const cell = r.cells.find(c => c.columnId === pctCol.id);
      return parseFloat(String(cell?.value || '0')) >= 100;
    }).length };
  }, [tasks, sheet]);

  return {
    sheet,
    tasks,
    isLoading,
    isMutating: addRowMutation.isPending || updateRowMutation.isPending || deleteRowMutation.isPending,
    error,
    refetch,
    completionStats,
    addRow: addRowMutation.mutateAsync,
    updateRow: updateRowMutation.mutateAsync,
    deleteRow: deleteRowMutation.mutateAsync,
  };
};
