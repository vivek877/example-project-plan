import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SmartsheetService, SmartsheetData, SmartsheetRow, SmartsheetColumn } from '@/lib/smartsheet';
import toast from 'react-hot-toast';

export const useSmartsheet = (token: string, sheetId: string) => {
  const queryClient = useQueryClient();

  const { data: sheet, isLoading, error, refetch } = useQuery<SmartsheetData>({
    queryKey: ['sheet', sheetId],
    queryFn: () => SmartsheetService.getSheet(token, sheetId),
    enabled: !!token && !!sheetId,
    staleTime: 1000 * 60, // 1 minute
  });

  const addRowMutation = useMutation({
    mutationFn: (rowData: any) => SmartsheetService.addRow(token, sheetId, rowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
      toast.success('Task added successfully');
    },
    onError: (err: any) => toast.error(`Error adding task: ${err.message}`),
  });

  const updateRowMutation = useMutation({
    mutationFn: (rowData: any) => SmartsheetService.updateRow(token, sheetId, rowData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
      toast.success('Task updated successfully');
    },
    onError: (err: any) => toast.error(`Error updating task: ${err.message}`),
  });

  const deleteRowMutation = useMutation({
    mutationFn: (rowId: number) => SmartsheetService.deleteRow(token, sheetId, rowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheet', sheetId] });
      toast.success('Task deleted successfully');
    },
    onError: (err: any) => toast.error(`Error deleting task: ${err.message}`),
  });

  const tasks = useMemo(() => {
    if (!sheet) return [];
    
    // Sort rows by row number to maintain order
    const sortedRows = [...sheet.rows].sort((a, b) => a.rowNumber - b.rowNumber);
    
    // Build hierarchy (if needed for rendering)
    // For now, let's just return sorted rows as Smartsheet rows already contain order
    return sortedRows;
  }, [sheet]);

  return {
    sheet,
    tasks,
    isLoading,
    error,
    refetch,
    addRow: addRowMutation.mutate,
    updateRow: updateRowMutation.mutate,
    deleteRow: deleteRowMutation.mutate,
  };
};
