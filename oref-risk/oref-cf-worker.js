/**
 * Cloudflare Worker — Oref real-time alert + history proxy
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *   www.oref.org.il and alerts-history.oref.org.il are geo-blocked to
 *   Israeli IPs only. All cloud servers (Vercel, Render, AWS…) are blocked.
 *
 *   Cloudflare has a PoP in Tel Aviv (TLV). When an Israeli browser hits this
 *   Worker, Cloudflare routes execution to TLV — so the outgoing fetch to
 *   oref.org.il originates from a real Israeli IP and is never blocked.
 *
 * ROUTES
 *   GET /          → proxies alerts.json (real-time active alerts)
 *   GET /history   → proxies GetAlarmsHistory.aspx (historical alert data)
 *                    query params: mode (1/2/3), city (optional Hebrew name)
 *
 * DEPLOY (free, ~2 min)
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create application
 *   2. Click "Create Worker", give it a name (e.g. "oref-proxy")
 *   3. Click "Edit code", replace everything with the contents of this file
 *   4. Click "Deploy"
 *   5. Copy the Worker URL shown (e.g. https://oref-proxy.YOUR-NAME.workers.dev)
 *   6. Open the alert map and click ⚙ to paste that URL
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    // Route: /history — proxy to alerts-history.oref.org.il
    if (url.pathname === '/history') {
      return handleHistory(url.searchParams);
    }

    // Default route: proxy real-time alerts.json
    return handleRealtime();
  },
};

async function handleRealtime() {
  try {
    const resp = await fetch(
      'https://www.oref.org.il/WarningMessages/alert/alerts.json',
      {
        headers: {
          'Referer': 'https://www.oref.org.il/',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      }
    );

    const text = await resp.text();
    const trimmed = text.trim();

    // Empty body (or whitespace only) = no active alert right now
    let alert = null;
    if (trimmed && trimmed.length >= 5) {
      try { alert = JSON.parse(trimmed); } catch { /* malformed — treat as no alert */ }
    }

    return jsonResponse({ alert });
  } catch (e) {
    return jsonResponse({ alert: null, error: e.message });
  }
}

async function handleHistory(params) {
  try {
    const mode = params.get('mode') || '3';
    const city = params.get('city') || '';

    let path = `/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=${encodeURIComponent(mode)}`;
    if (city) path += `&city_0=${encodeURIComponent(city)}`;

    const resp = await fetch(`https://alerts-history.oref.org.il${path}`, {
      headers: {
        'Referer': 'https://alerts-history.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    const text = await resp.text();
    const data = text.length > 2 ? JSON.parse(text) : [];
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: e.message });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
    },
  });
}
