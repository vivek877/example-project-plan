import { createClient } from "npm:@blinkdotnew/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SMARTSHEET_API_BASE = "https://api.smartsheet.com/2.0";

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Get access token from header or environment
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.replace("Bearer ", "") || Deno.env.get("SMARTSHEET_ACCESS_TOKEN");
    const sheetId = Deno.env.get("SMARTSHEET_SHEET_ID");

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "SMARTSHEET_ACCESS_TOKEN required. Configure in settings or provide via Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Get sheet ID from query param or environment
    const targetSheetId = url.searchParams.get("sheetId") || sheetId;

    if (!targetSheetId) {
      return new Response(
        JSON.stringify({ error: "Sheet ID required. Set SMARTSHEET_SHEET_ID or provide smartsheetUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let response;
    let body;

    if (action === "getSheet") {
      // Get sheet metadata and data
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}`, {
        headers,
      });
      body = await response.json();
    } else if (action === "getColumns") {
      // Get only columns
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/columns`, {
        headers,
      });
      body = await response.json();
    } else if (action === "addRow") {
      // Add a new row
      const rowData = await req.json();
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...rowData, returnOf: true }),
      });
      body = await response.json();
    } else if (action === "updateRow") {
      // Update an existing row
      const rowData = await req.json();
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...rowData, returnOf: true }),
      });
      body = await response.json();
    } else if (action === "deleteRow") {
      // Delete a row
      const rowId = url.searchParams.get("rowId");
      if (!rowId) {
        return new Response(
          JSON.stringify({ error: "rowId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows/${rowId}`, {
        method: "DELETE",
        headers,
      });
      body = await response.json();
    } else if (action === "getSheetList") {
      // List all sheets (for user to select)
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets`, {
        headers,
      });
      body = await response.json();
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use: getSheet, getColumns, addRow, updateRow, deleteRow, getSheetList" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Smartsheet proxy error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
