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
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.replace("Bearer ", "") || Deno.env.get("SMARTSHEET_ACCESS_TOKEN");

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "SMARTSHEET_ACCESS_TOKEN required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const envSheetId = Deno.env.get("SMARTSHEET_SHEET_ID");
    const targetSheetId = url.searchParams.get("sheetId") || envSheetId;

    const ssHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let response: Response;
    let body: any;

    if (action === "getSheet") {
      if (!targetSheetId) {
        return new Response(JSON.stringify({ error: "sheetId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Fetch with expanded rows to get level information
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}?include=parentId`, {
        headers: ssHeaders,
      });
      body = await response.json();

    } else if (action === "getSheetList") {
      response = await fetch(`${SMARTSHEET_API_BASE}/sheets`, { headers: ssHeaders });
      body = await response.json();

    } else if (action === "addRow") {
      if (!targetSheetId) {
        return new Response(JSON.stringify({ error: "sheetId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Smartsheet expects an array of row objects
      const payload = await req.json();
      // payload should be an array of rows already
      const rows = Array.isArray(payload) ? payload : [payload];

      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows`, {
        method: "POST",
        headers: ssHeaders,
        body: JSON.stringify(rows),
      });
      body = await response.json();

    } else if (action === "updateRow") {
      if (!targetSheetId) {
        return new Response(JSON.stringify({ error: "sheetId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const payload = await req.json();
      const rows = Array.isArray(payload) ? payload : [payload];

      response = await fetch(`${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows`, {
        method: "PUT",
        headers: ssHeaders,
        body: JSON.stringify(rows),
      });
      body = await response.json();

    } else if (action === "deleteRow") {
      if (!targetSheetId) {
        return new Response(JSON.stringify({ error: "sheetId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Smartsheet delete supports multiple rowIds via query params
      const rowIds = url.searchParams.get("rowIds");
      const rowId = url.searchParams.get("rowId");
      const idsParam = rowIds || rowId;

      if (!idsParam) {
        return new Response(JSON.stringify({ error: "rowId or rowIds required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      response = await fetch(
        `${SMARTSHEET_API_BASE}/sheets/${targetSheetId}/rows?ids=${idsParam}&ignoreRowsNotFound=true`,
        { method: "DELETE", headers: ssHeaders }
      );
      body = await response.json();

    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
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
