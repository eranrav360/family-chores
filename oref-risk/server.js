const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3459;

app.use(express.static(path.join(__dirname, 'public')));

// API modes: 1=24h, 2=7 days, 3=30 days
// City filter uses city_0=name parameter (server-side filtered, bypasses 3000-record national cap)
// cfWorkerUrl: optional CF Worker base URL — used when oref history is geo-blocked from this server
function fetchAlerts(mode, city, cfWorkerUrl) {
  if (cfWorkerUrl) {
    // Proxy through the CF Worker (runs from Israeli IP, not geo-blocked)
    return new Promise((resolve) => {
      let workerPath = `/history?mode=${mode}`;
      if (city) workerPath += `&city=${encodeURIComponent(city)}`;
      const fullUrl = new URL(workerPath, cfWorkerUrl);
      const mod = fullUrl.protocol === 'https:' ? https : require('http');
      const options = {
        hostname: fullUrl.hostname,
        path: fullUrl.pathname + fullUrl.search,
        headers: { 'User-Agent': 'oref-risk/1.0' },
      };
      mod.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(data.length > 2 ? JSON.parse(data) : []); }
          catch { resolve([]); }
        });
      }).on('error', () => resolve([]));
    });
  }

  return new Promise((resolve, reject) => {
    let path = `/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=${mode}`;
    if (city) path += `&city_0=${encodeURIComponent(city)}`;

    const options = {
      hostname: 'alerts-history.oref.org.il',
      path,
      headers: {
        'Referer': 'https://alerts-history.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity',
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(data.length > 2 ? JSON.parse(data) : []);
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

// API: get alerts history
// mode: 1=24h, 2=7d, 3=30d, 4=current month
// location: optional city name (Hebrew)
// cfWorker: optional CF Worker URL to proxy oref history through (needed when geo-blocked)
app.get('/api/history', async (req, res) => {
  try {
    const { location, mode = '3', cfWorker } = req.query;
    const modeNum = parseInt(mode) || 3;

    // mode=4 means "current month": fetch last 30 days, then filter to 1st of this month
    const apiMode = modeNum === 4 ? 3 : Math.min(Math.max(modeNum, 1), 3);
    const allAlerts = await fetchAlerts(apiMode, location || null, cfWorker || null);

    // Filter to rockets/missiles (cat 1) and UAV (cat 6) only
    let attackAlerts = allAlerts.filter(a => a.category === 1 || a.category === 6);

    let periodLabel, periodDays;
    if (modeNum === 4) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      attackAlerts = attackAlerts.filter(a => new Date(a.alertDate) >= monthStart);
      const monthName = now.toLocaleString('en-US', { month: 'long' });
      periodLabel = `${monthName} ${now.getFullYear()}`;
      periodDays = now.getDate(); // days elapsed this month
    } else {
      const periodLabels = { 1: '24 hours', 2: '7 days', 3: '30 days' };
      periodLabel = periodLabels[apiMode];
      periodDays = [1, 7, 30][apiMode - 1];
    }

    res.json({
      total: attackAlerts.length,
      alerts: attackAlerts,
      allLocations: [...new Set(attackAlerts.map(a => a.data))].sort(),
      period: periodLabel,
      periodDays,
      cappedAt3000: allAlerts.length >= 3000,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Fetch all known cities from oref registry (1350 locations)
function fetchCities() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'alerts-history.oref.org.il',
      path: '/Shared/Ajax/GetCities.aspx?lang=he',
      headers: {
        'Referer': 'https://alerts-history.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity',
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const cities = JSON.parse(data);
          if (!Array.isArray(cities) || cities.length === 0) { resolve([]); return; }
          // label format: "cityName | areaName" — extract just the city name
          resolve(cities.map(c => c.label.split(' | ')[0]).sort());
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

// API: get full city registry (not limited to recent alerts)
// Primary: GitHub-hosted cities.json (not geo-blocked, ~1350 cities)
// Fallback: oref GetCities.aspx (requires Israeli IP)
app.get('/api/locations', async (req, res) => {
  try {
    // Use the already-cached GitHub cities data (same source as the map geo data)
    await ensureCityPolygonData();
    let locations = (citiesGeoCache || [])
      .map(c => c.name)
      .filter(n => n && n !== 'בחר הכל')
      .sort();

    if (locations.length === 0) {
      // Last-resort fallback: oref cities registry
      locations = await fetchCities();
    }
    res.json({ locations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Real-time alerts ──────────────────────────────────────────────────────────

// Israel UTC offset: +02:00 (standard/winter) or +03:00 (DST/summer, Apr–Oct)
function israelOffset() {
  const m = new Date().getMonth(); // 0-indexed
  return (m >= 3 && m <= 9) ? '+03:00' : '+02:00';
}

// Primary: try www.oref.org.il (works locally / Israeli IPs)
function fetchOrefDirect() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.oref.org.il',
      path: '/WarningMessages/alert/alerts.json',
      headers: {
        'Referer': 'https://www.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity',
        'User-Agent': 'Mozilla/5.0',
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const trimmed = data.trim();
        if (!trimmed || trimmed.length < 5) { resolve(null); return; }
        try { resolve(JSON.parse(trimmed)); } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// Fallback: derive "live" alerts from history API (not geo-blocked).
// Fetches last 24h, returns the most recent attack burst if within 30 min.
function fetchRealtimeFromHistory() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'alerts-history.oref.org.il',
      path: '/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=1',
      headers: {
        'Referer': 'https://alerts-history.oref.org.il/',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Encoding': 'identity',
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const alerts = data.length > 2 ? JSON.parse(data) : [];
          if (!alerts.length) { resolve(null); return; }

          const offset = israelOffset();

          // Sort newest-first; filter to attack categories FIRST so we don't
          // anchor to a cat-10 "all-clear" record and miss the actual attack.
          const sorted = [...alerts].sort((a, b) => b.rid - a.rid);
          const attackSorted = sorted.filter(a => a.category === 1 || a.category === 6);
          if (!attackSorted.length) { resolve(null); return; }

          const latest = attackSorted[0];
          const latestMs = new Date(latest.alertDate.replace(' ', 'T') + offset).getTime();
          const nowMs = Date.now();
          // 30-min window — covers history-API lag (can be 5-15 min behind live)
          const THIRTY_MIN = 30 * 60 * 1000;

          if (nowMs - latestMs > THIRTY_MIN) { resolve(null); return; }

          // Collect cities from the same burst (within 5 min of the latest attack)
          const BURST = 5 * 60 * 1000;
          const recent = attackSorted.filter(a => {
            const t = new Date(a.alertDate.replace(' ', 'T') + offset).getTime();
            return Math.abs(latestMs - t) <= BURST;
          });
          const cities = [...new Set(recent.map(a => a.data))];
          if (!cities.length) { resolve(null); return; }

          resolve({
            id: `hist-${latest.rid}`,
            cat: String(latest.category),
            // Preserve the actual title so pre-warnings (title contains 'התרעה') are detected
            title: latest.title || (latest.category === 1 ? 'ירי רקטות וטילים' : 'כלי טיס עוין'),
            data: cities,
            desc: latest.desc || '',
          });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// Third source: tzevaadom community mirror (real-time, not geo-blocked)
function fetchTzevaadom() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.tzevaadom.co.il',
      path: '/alerts',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          // May return [] or [{ cities: [...], threat: N }] or similar
          if (!result || (Array.isArray(result) && result.length === 0)) {
            resolve(null); return;
          }
          // Normalise to the same shape as the oref direct API
          if (Array.isArray(result)) {
            const first = result[0];
            const cities = first.cities || first.data || first.alerts || [];
            if (!cities.length) { resolve(null); return; }
            resolve({
              id: `tz-${Date.now()}`,
              cat: String(first.threat || first.cat || first.category || '1'),
              title: first.title || 'התרעה',
              data: cities,
              desc: first.desc || '',
            });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchRealtimeAlerts() {
  // Race all three sources; return first non-null result
  const [direct, tzevaadom] = await Promise.all([fetchOrefDirect(), fetchTzevaadom()]);
  if (direct) return direct;
  if (tzevaadom) return tzevaadom;
  return fetchRealtimeFromHistory();
}

app.get('/api/realtime', async (req, res) => {
  try {
    const alert = await fetchRealtimeAlerts();
    res.json({ alert });
  } catch {
    res.json({ alert: null });
  }
});

// Debug endpoint — returns raw responses from all three sources so we can see
// exactly what each API is returning without deploying changes.
app.get('/api/debug-realtime', async (req, res) => {
  const offset = israelOffset();

  const rawHistory = await new Promise((resolve) => {
    const options = {
      hostname: 'alerts-history.oref.org.il',
      path: '/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=1',
      headers: { 'Referer': 'https://alerts-history.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest', 'Accept-Encoding': 'identity' }
    };
    https.get(options, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const arr = JSON.parse(d);
          const sorted = [...arr].sort((a, b) => b.rid - a.rid);
          resolve({ count: arr.length, newest5: sorted.slice(0, 5), httpStatus: r.statusCode });
        } catch { resolve({ error: 'parse failed', raw: d.slice(0, 200), httpStatus: r.statusCode }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });

  const rawDirect = await new Promise((resolve) => {
    const options = {
      hostname: 'www.oref.org.il',
      path: '/WarningMessages/alert/alerts.json',
      headers: { 'Referer': 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest', 'Accept-Encoding': 'identity', 'User-Agent': 'Mozilla/5.0' }
    };
    https.get(options, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ httpStatus: r.statusCode, raw: d.slice(0, 500) }));
    }).on('error', e => resolve({ error: e.message }));
  });

  const rawTzevaadom = await new Promise((resolve) => {
    const options = { hostname: 'api.tzevaadom.co.il', path: '/alerts', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } };
    https.get(options, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ httpStatus: r.statusCode, raw: d.slice(0, 500) }));
    }).on('error', e => resolve({ error: e.message }));
  });

  res.json({
    serverTime: new Date().toISOString(),
    israelOffset: offset,
    direct: rawDirect,
    tzevaadom: rawTzevaadom,
    history: rawHistory,
  });
});

// ── City/polygon data (community data, cached in memory) ──────────────────────

let citiesGeoCache = null;
let polygonsCache = null;

function fetchGitHubJSON(filePath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'raw.githubusercontent.com',
      path: filePath,
      headers: { 'User-Agent': 'oref-risk/1.0', 'Accept-Encoding': 'identity' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function ensureCityPolygonData() {
  if (!citiesGeoCache || !polygonsCache) {
    [citiesGeoCache, polygonsCache] = await Promise.all([
      fetchGitHubJSON('/eladnava/pikud-haoref-api/master/cities.json'),
      fetchGitHubJSON('/eladnava/pikud-haoref-api/master/polygons.json'),
    ]);
  }
}

app.get('/api/cities-geo', async (req, res) => {
  try {
    await ensureCityPolygonData();
    res.json(citiesGeoCache || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/polygon-data', async (req, res) => {
  try {
    await ensureCityPolygonData();
    res.json(polygonsCache || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export for Vercel serverless (no spin-down, instant cold-start)
module.exports = app;

// Local / Render: start the HTTP server normally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`oref-risk server running at http://localhost:${PORT}`);
    ensureCityPolygonData().catch(() => {});

    // Keep Render free instance alive (spins down after inactivity)
    if (process.env.RENDER_EXTERNAL_URL) {
      const selfUrl = process.env.RENDER_EXTERNAL_URL;
      setInterval(() => {
        https.get(`${selfUrl}/api/realtime`, (r) => {
          console.log(`[keep-alive] pinged self → HTTP ${r.statusCode}`);
          r.resume();
        }).on('error', (e) => console.warn('[keep-alive] ping error:', e.message));
      }, 10 * 60 * 1000);
      console.log(`[keep-alive] scheduled self-ping every 10 min → ${selfUrl}`);
    }
  });
}
