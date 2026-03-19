const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3459;

app.use(express.static(path.join(__dirname, 'public')));

// API modes: 1=24h, 2=7 days, 3=30 days
// City filter uses city_0=name parameter (server-side filtered, bypasses 3000-record national cap)
function fetchAlerts(mode, city) {
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
app.get('/api/history', async (req, res) => {
  try {
    const { location, mode = '3' } = req.query;
    const modeNum = parseInt(mode) || 3;

    // mode=4 means "current month": fetch last 30 days, then filter to 1st of this month
    const apiMode = modeNum === 4 ? 3 : Math.min(Math.max(modeNum, 1), 3);
    const allAlerts = await fetchAlerts(apiMode, location || null);

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
  return new Promise((resolve, reject) => {
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
          // label format: "cityName | areaName" — extract just the city name
          resolve(cities.map(c => c.label.split(' | ')[0]).sort());
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

// API: get full city registry (not limited to recent alerts)
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await fetchCities();
    res.json({ locations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Real-time alerts ──────────────────────────────────────────────────────────

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
// Fetches last 24h, returns alerts from the last 15 min as a pseudo-live feed.
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

          // Sort newest-first by rid (sequential ID)
          const sorted = [...alerts].sort((a, b) => b.rid - a.rid);
          const latest = sorted[0];

          // alertDate is in Israeli time (UTC+2 winter / UTC+3 summer).
          // Parse with +02:00 and allow a 15-min window (covers DST shift too).
          const latestMs = new Date(latest.alertDate.replace(' ', 'T') + '+02:00').getTime();
          const nowMs = Date.now();
          const FIFTEEN_MIN = 15 * 60 * 1000;

          if (nowMs - latestMs > FIFTEEN_MIN) { resolve(null); return; }

          // Collect cities from the same burst (within 90 s of the latest alert)
          const BURST = 90 * 1000;
          const recent = sorted.filter(a => {
            const t = new Date(a.alertDate.replace(' ', 'T') + '+02:00').getTime();
            return (latestMs - t) <= BURST && (a.category === 1 || a.category === 6);
          });
          const cities = [...new Set(recent.map(a => a.data))];
          if (!cities.length) { resolve(null); return; }

          resolve({
            id: `hist-${latest.rid}`,
            cat: String(latest.category),
            title: latest.category === 1 ? 'ירי רקטות וטילים' : 'כלי טיס עוין',
            data: cities,
            desc: '',
          });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchRealtimeAlerts() {
  const direct = await fetchOrefDirect();
  if (direct) return direct;
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

app.listen(PORT, () => {
  console.log(`oref-risk server running at http://localhost:${PORT}`);
  // Pre-fetch polygon data on startup
  ensureCityPolygonData().catch(() => {});

  // Keep Render free instance alive (it spins down after inactivity).
  // Ping /api/realtime every 10 minutes so the server never goes cold.
  if (process.env.RENDER_EXTERNAL_URL) {
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    setInterval(() => {
      https.get(`${selfUrl}/api/realtime`, (r) => {
        console.log(`[keep-alive] pinged self → HTTP ${r.statusCode}`);
        r.resume();
      }).on('error', (e) => console.warn('[keep-alive] ping error:', e.message));
    }, 10 * 60 * 1000); // every 10 minutes
    console.log(`[keep-alive] scheduled self-ping every 10 min → ${selfUrl}`);
  }
});
