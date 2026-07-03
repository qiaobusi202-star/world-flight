// 精选出发地：真实机场（真实坐标/标高/跑道朝向）与著名地标
// type: 'airport' 在跑道上空对准跑道方向出生; 'landmark' 在目标附近空中出生、机头朝向目标

export const PRESETS = [
  // —— 机场 ——
  { type: 'airport', name: '长沙黄花国际机场', en: 'Changsha Huanghua (CSX)', lat: 28.1892, lon: 113.2196, elev: 66, hdg: 180, emoji: '🛫' },
  { type: 'airport', name: '北京大兴国际机场', en: 'Beijing Daxing (PKX)', lat: 39.5098, lon: 116.4105, elev: 30, hdg: 170, emoji: '🛫' },
  { type: 'airport', name: '上海浦东国际机场', en: 'Shanghai Pudong (PVG)', lat: 31.1443, lon: 121.8083, elev: 4, hdg: 170, emoji: '🛫' },
  { type: 'airport', name: '香港国际机场', en: 'Hong Kong (HKG)', lat: 22.3080, lon: 113.9185, elev: 9, hdg: 73, emoji: '🛫' },
  { type: 'airport', name: '东京羽田机场', en: 'Tokyo Haneda (HND)', lat: 35.5494, lon: 139.7798, elev: 6, hdg: 337, emoji: '🛫' },
  { type: 'airport', name: '新加坡樟宜机场', en: 'Singapore Changi (SIN)', lat: 1.3644, lon: 103.9915, elev: 7, hdg: 23, emoji: '🛫' },
  { type: 'airport', name: '迪拜国际机场', en: 'Dubai (DXB)', lat: 25.2532, lon: 55.3657, elev: 19, hdg: 121, emoji: '🛫' },
  { type: 'airport', name: '伦敦希思罗机场', en: 'London Heathrow (LHR)', lat: 51.4700, lon: -0.4543, elev: 25, hdg: 270, emoji: '🛫' },
  { type: 'airport', name: '巴黎戴高乐机场', en: 'Paris CDG', lat: 49.0097, lon: 2.5479, elev: 119, hdg: 87, emoji: '🛫' },
  { type: 'airport', name: '纽约肯尼迪机场', en: 'New York JFK', lat: 40.6413, lon: -73.7781, elev: 4, hdg: 130, emoji: '🛫' },

  // —— 地标 ——
  { type: 'landmark', name: '长沙橘子洲头', en: 'Orange Isle, Changsha', lat: 28.1965, lon: 112.9633, spawnAlt: 500, approach: 180, emoji: '🏞️' },
  { type: 'landmark', name: '上海陆家嘴', en: 'Lujiazui, Shanghai', lat: 31.2397, lon: 121.4998, spawnAlt: 700, approach: 90, emoji: '🏙️' },
  { type: 'landmark', name: '香港维多利亚港', en: 'Victoria Harbour', lat: 22.2938, lon: 114.1694, spawnAlt: 600, approach: 180, emoji: '🌃' },
  { type: 'landmark', name: '慕田峪长城', en: 'Great Wall (Mutianyu)', lat: 40.4319, lon: 116.5704, spawnAlt: 1400, approach: 200, emoji: '🏯' },
  { type: 'landmark', name: '珠穆朗玛峰', en: 'Mount Everest', lat: 27.9881, lon: 86.9250, spawnAlt: 9600, approach: 180, emoji: '🏔️' },
  { type: 'landmark', name: '富士山', en: 'Mount Fuji', lat: 35.3606, lon: 138.7274, spawnAlt: 4600, approach: 90, emoji: '🗻' },
  { type: 'landmark', name: '东京塔', en: 'Tokyo Tower', lat: 35.6586, lon: 139.7454, spawnAlt: 700, approach: 135, emoji: '🗼' },
  { type: 'landmark', name: '迪拜哈利法塔', en: 'Burj Khalifa', lat: 25.1972, lon: 55.2744, spawnAlt: 900, approach: 315, emoji: '🌆' },
  { type: 'landmark', name: '埃菲尔铁塔', en: 'Eiffel Tower', lat: 48.8584, lon: 2.2945, spawnAlt: 600, approach: 45, emoji: '🗼' },
  { type: 'landmark', name: '马特洪峰', en: 'Matterhorn', lat: 45.9766, lon: 7.6585, spawnAlt: 5000, approach: 0, emoji: '⛰️' },
  { type: 'landmark', name: '伦敦塔桥', en: 'Tower Bridge', lat: 51.5055, lon: -0.0754, spawnAlt: 500, approach: 270, emoji: '🌉' },
  { type: 'landmark', name: '自由女神像', en: 'Statue of Liberty', lat: 40.6892, lon: -74.0445, spawnAlt: 600, approach: 180, emoji: '🗽' },
  { type: 'landmark', name: '金门大桥', en: 'Golden Gate Bridge', lat: 37.8199, lon: -122.4783, spawnAlt: 600, approach: 270, emoji: '🌁' },
  { type: 'landmark', name: '大峡谷', en: 'Grand Canyon', lat: 36.0999, lon: -112.1124, spawnAlt: 2600, approach: 0, emoji: '🏜️' },
  { type: 'landmark', name: '尼亚加拉瀑布', en: 'Niagara Falls', lat: 43.0782, lon: -79.0742, spawnAlt: 500, approach: 30, emoji: '💦' },
  { type: 'landmark', name: '悉尼歌剧院', en: 'Sydney Opera House', lat: -33.8568, lon: 151.2153, spawnAlt: 600, approach: 45, emoji: '🎭' },
  { type: 'landmark', name: '里约基督像', en: 'Christ the Redeemer', lat: -22.9519, lon: -43.2105, spawnAlt: 1100, approach: 315, emoji: '⛪' },
];

// 把预设换算成出生参数 { lon, lat, height(MSL m), heading(rad), name }
export function spawnFromPreset(p, craft) {
  const rad = (d) => (d * Math.PI) / 180;
  if (p.type === 'airport') {
    const hover = craft !== 'plane'; // 直升机/无人机悬停出生
    const agl = hover ? (craft === 'drone' ? 25 : 40) : 80;
    return {
      lon: p.lon, lat: p.lat,
      height: p.elev + agl,
      heading: rad(p.hdg),
      speed: hover ? 0 : 55, // m/s ≈ 200 km/h
      name: p.name,
      groundElev: p.elev,
    };
  }
  // 地标：在 approach 方向后方 2.5km 处出生，机头朝向地标
  const dist = 2500;
  const brg = rad(p.approach);
  const R = 6371000;
  const dLat = (dist * -Math.cos(brg)) / R;
  const dLon = (dist * -Math.sin(brg)) / (R * Math.cos(rad(p.lat)));
  return {
    lon: p.lon + (dLon * 180) / Math.PI,
    lat: p.lat + (dLat * 180) / Math.PI,
    height: p.spawnAlt,
    heading: brg,
    speed: craft === 'plane' ? 70 : 20,
    name: p.name,
  };
}
