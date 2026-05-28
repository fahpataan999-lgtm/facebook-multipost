export async function onRequest({ request, env }) {
  const appsScriptUrl = env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    return json({ ok: false, error: "Missing APPS_SCRIPT_URL environment variable." }, 500);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const body = request.method === "GET"
      ? JSON.stringify({ action: "list" })
      : await request.text();

    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/json;charset=utf-8"
      }
    });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json;charset=utf-8"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
