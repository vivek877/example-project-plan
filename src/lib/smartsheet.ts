const FUNCTION_URL = "https://m5a8lwxg--smartsheet.functions.blink.new";

export interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
  options?: string[];
  primary?: boolean;
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
  level: number;
}

export interface SmartsheetData {
  id: number;
  name: string;
  columns: SmartsheetColumn[];
  rows: SmartsheetRow[];
}

export class SmartsheetService {
  private static getHeaders(token?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  static async getSheet(token: string, sheetId: string): Promise<SmartsheetData> {
    const url = new URL(FUNCTION_URL);
    url.searchParams.set("action", "getSheet");
    url.searchParams.set("sheetId", sheetId);

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch sheet");
    }

    return response.json();
  }

  static async addRow(token: string, sheetId: string, row: any) {
    const url = new URL(FUNCTION_URL);
    url.searchParams.set("action", "addRow");
    url.searchParams.set("sheetId", sheetId);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add row");
    }

    return response.json();
  }

  static async updateRow(token: string, sheetId: string, row: any) {
    const url = new URL(FUNCTION_URL);
    url.searchParams.set("action", "updateRow");
    url.searchParams.set("sheetId", sheetId);

    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: this.getHeaders(token),
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update row");
    }

    return response.json();
  }

  static async deleteRow(token: string, sheetId: string, rowId: number) {
    const url = new URL(FUNCTION_URL);
    url.searchParams.set("action", "deleteRow");
    url.searchParams.set("sheetId", sheetId);
    url.searchParams.set("rowId", rowId.toString());

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete row");
    }

    return response.json();
  }

  static async getSheetList(token: string) {
    const url = new URL(FUNCTION_URL);
    url.searchParams.set("action", "getSheetList");

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(token),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch sheets");
    }

    return response.json();
  }
}
