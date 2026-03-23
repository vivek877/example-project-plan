export const FUNCTION_URL = "https://m5a8lwxg--smartsheet.functions.blink.new";

export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string; // TEXT_NUMBER, PICKLIST, DATE, CHECKBOX, CONTACT_LIST, etc.
  options?: string[];
  primary?: boolean;
  systemColumnType?: string; // AUTO_NUMBER, MODIFIED_DATE, etc.
  formula?: string;
}

export interface SmartsheetCell {
  columnId: number;
  value: any;
  displayValue?: string;
}

export interface SmartsheetRow {
  id: number;
  rowNumber: number;
  parentId?: number;
  siblingId?: number;
  expanded?: boolean;
  cells: SmartsheetCell[];
  // level is NOT returned by default by Smartsheet API — we compute it
  level: number;
  calculatedParentId?: number;
}

export interface SmartsheetData {
  id: number;
  name: string;
  columns: SmartsheetColumn[];
  rows: SmartsheetRow[];
}

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

export async function apiGetSheet(token: string, sheetId: string): Promise<SmartsheetData> {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("action", "getSheet");
  url.searchParams.set("sheetId", sheetId);

  const res = await fetch(url.toString(), { headers: getHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch sheet");

  // Smartsheet API returns rows with `parentId` field
  // We compute `level` by building a parentId -> level map
  const rows: any[] = data.rows || [];
  const levelMap: Record<number, number> = {};

  const processedRows: SmartsheetRow[] = rows.map((row: any) => {
    let level = 0;
    if (row.parentId) {
      level = (levelMap[row.parentId] ?? 0) + 1;
    }
    levelMap[row.id] = level;
    return { ...row, level };
  });

  return { ...data, rows: processedRows };
}

export async function apiGetSheetList(token: string) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("action", "getSheetList");

  const res = await fetch(url.toString(), { headers: getHeaders(token) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to list sheets");
  return data;
}

export interface AddRowPayload {
  cells: { columnId: number; value: any }[];
  parentId?: number;
  toBottom?: boolean;
  siblingId?: number;
}

export async function apiAddRow(token: string, sheetId: string, row: AddRowPayload) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("action", "addRow");
  url.searchParams.set("sheetId", sheetId);

  const body: any = { cells: row.cells };
  if (row.parentId) {
    body.parentId = row.parentId;
    body.toBottom = true;
  } else {
    body.toBottom = true;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify([body]), // Smartsheet expects array
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to add row");
  return data;
}

export interface UpdateRowPayload {
  id: number;
  cells: { columnId: number; value: any }[];
}

export async function apiUpdateRow(token: string, sheetId: string, row: UpdateRowPayload) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("action", "updateRow");
  url.searchParams.set("sheetId", sheetId);

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify([{ id: row.id, cells: row.cells }]), // Smartsheet expects array
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to update row");
  return data;
}

export async function apiDeleteRow(token: string, sheetId: string, rowId: number) {
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("action", "deleteRow");
  url.searchParams.set("sheetId", sheetId);
  url.searchParams.set("rowId", String(rowId));

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Failed to delete row");
  return data;
}

// Column types we care about for form rendering
export const COL_TYPE = {
  TEXT_NUMBER: "TEXT_NUMBER",
  PICKLIST: "PICKLIST",
  DATE: "DATE",
  CHECKBOX: "CHECKBOX",
  CONTACT_LIST: "CONTACT_LIST",
};

export function isSystemColumn(col: SmartsheetColumn): boolean {
  return !!(col.systemColumnType || col.formula);
}

export function isReadOnly(col: SmartsheetColumn): boolean {
  // Row ID and system columns are always read-only
  return isSystemColumn(col);
}
