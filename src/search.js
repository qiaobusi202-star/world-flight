// 地点搜索：Cesium ion 地理编码 REST + 本地真实机场数据
import { getIonToken } from './config.js';
import airports from './data/airports.json';

// ion 地理编码：返回 [{ name, lat, lon }]
export async function geocode(text) {
  const url = `https://api.cesium.com/v1/geocode/search?text=${encodeURIComponent(text)}&access_token=${getIonToken()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const json = await res.json();
  return (json.features || []).slice(0, 8).map((f) => {
    let lat, lon;
    if (Array.isArray(f.bbox) && f.bbox.length >= 4) {
      lon = (f.bbox[0] + f.bbox[2]) / 2;
      lat = (f.bbox[1] + f.bbox[3]) / 2;
    } else if (f.geometry?.type === 'Point') {
      [lon, lat] = f.geometry.coordinates;
    }
    const name = f.properties?.label || f.properties?.name || text;
    return { name, lat, lon };
  }).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

// 本地机场搜索（OurAirports 真实数据，构建期生成）
export function searchAirports(query, limit = 20) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const a of airports) {
    const iata = (a.iata || '').toLowerCase();
    const hay = `${a.name} ${a.city || ''} ${a.country || ''} ${a.icao || ''}`.toLowerCase();
    let score = -1;
    if (iata === q) score = 100;
    else if (hay.includes(q)) score = 50 - Math.min(40, hay.indexOf(q));
    if (score >= 0) scored.push([score, a]);
  }
  scored.sort((x, y) => y[0] - x[0]);
  return scored.slice(0, limit).map((s) => s[1]);
}

export function allAirportsCount() { return airports.length; }
