// 构建期数据脚本：从 OurAirports 拉取真实机场与跑道数据，
// 过滤全球 large_airport，联表取最长跑道真实朝向，输出 src/data/airports.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function fetchCsv(url) {
  console.log('下载', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return toObjects(parseCsv(await res.text()));
}

const [airports, runways] = await Promise.all([fetchCsv(AIRPORTS_URL), fetchCsv(RUNWAYS_URL)]);

// 每机场取最长跑道的真航向
const rwyByAirport = new Map();
for (const r of runways) {
  if (r.closed === '1') continue;
  const len = Number(r.length_ft) || 0;
  const prev = rwyByAirport.get(r.airport_ident);
  if (!prev || len > prev.len) {
    rwyByAirport.set(r.airport_ident, { len, hdg: Number(r.le_heading_degT) });
  }
}

const out = airports
  .filter((a) => a.type === 'large_airport' && a.latitude_deg && a.longitude_deg)
  .map((a) => {
    const rwy = rwyByAirport.get(a.ident);
    return {
      icao: a.ident,
      iata: a.iata_code || '',
      name: a.name,
      city: a.municipality || '',
      country: a.iso_country || '',
      lat: Number(Number(a.latitude_deg).toFixed(5)),
      lon: Number(Number(a.longitude_deg).toFixed(5)),
      elev: Math.round((Number(a.elevation_ft) || 0) * 0.3048),
      hdg: rwy && Number.isFinite(rwy.hdg) ? Math.round(rwy.hdg) : 0,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const dest = join(ROOT, 'src', 'data', 'airports.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out));
console.log(`已写出 ${out.length} 个真实大型机场 -> ${dest}`);
