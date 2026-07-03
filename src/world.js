// 地球场景：Google 照片级 3D Tiles、天空大气、云层、昼夜光照、画质档位
import * as Cesium from 'cesium';
import { getIonToken, GOOGLE_TILES_ASSET_ID, QUALITY_PRESETS } from './config.js';

export function createViewer() {
  Cesium.Ion.defaultAccessToken = getIonToken();
  const viewer = new Cesium.Viewer('cesiumContainer', {
    globe: false, // 由 Google 3D Tiles 提供整个地球，避免双重渲染
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    requestRenderMode: false,
  });
  const scene = viewer.scene;
  // 个别瓦片纹理解码失败不该终止整个游戏：自动恢复渲染循环
  let recoveries = 0;
  scene.renderError.addEventListener((_s, err) => {
    console.warn('[world-flight] 渲染错误，自动恢复', err);
    if (recoveries++ > 20) return;
    setTimeout(() => {
      document.querySelectorAll('.cesium-widget-errorPanel').forEach((e) => e.remove());
      viewer.cesiumWidget.useDefaultRenderLoop = true;
    }, 300);
  });
  scene.skyAtmosphere.show = true;
  scene.fog.enabled = true;
  scene.fog.density = 0.00012;
  scene.sun.show = true;
  scene.moon.show = true;
  viewer.clock.shouldAnimate = true;
  viewer.clock.multiplier = 1;
  return viewer;
}

// 物理用真实地形（Cesium World Terrain）：不渲染，只做精确地面高度采样
export async function loadPhysicsTerrain() {
  try {
    return await Cesium.createWorldTerrainAsync();
  } catch (e) {
    console.warn('[world-flight] World Terrain 不可用，退回瓦片采样', e);
    return null;
  }
}

export async function loadGoogleTiles(viewer) {
  try {
    const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(GOOGLE_TILES_ASSET_ID, {
      maximumScreenSpaceError: 16,
      dynamicScreenSpaceError: true,
      skipLevelOfDetail: true,
      preloadFlightDestinations: true,
    });
    viewer.scene.primitives.add(tileset);
    return tileset;
  } catch (err) {
    const msg = String(err?.message || err);
    let reason;
    if (msg.includes('401') || /invalid.*token|unauthorized/i.test(msg)) {
      reason = 'ion 令牌无效或已过期。请到 ion.cesium.com → Access Tokens 检查令牌，然后点下方"更换令牌"。';
    } else if (msg.includes('404') || /not found|does not exist/i.test(msg)) {
      reason = '你的 ion 账号还没有添加 Google Photorealistic 3D Tiles 资产。请登录 ion.cesium.com → Asset Depot → 搜索 "Google Photorealistic 3D Tiles" → 点 "Add to my assets"，然后刷新本页。';
    } else {
      reason = '无法连接地图服务。Google 3D Tiles 瓦片由 Google 服务器提供，中国大陆需开启代理/VPN 后刷新本页。';
    }
    const e = new Error(reason);
    e.original = err;
    throw e;
  }
}

// —— 昼夜：按当地太阳时设置时钟；亮度随太阳高度角平滑变化 ——
export function setTimeOfDay(viewer, localHour, lonDeg) {
  const utcHour = localHour - lonDeg / 15;
  const now = new Date();
  const ms = ((utcHour % 24) + 24) % 24 * 3600000;
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + ms);
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(date);
}

export function localTimeString(viewer, lonDeg) {
  const date = Cesium.JulianDate.toDate(viewer.clock.currentTime);
  const local = new Date(date.getTime() + lonDeg / 15 * 3600000);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')} 当地`;
}

// 简化太阳高度角（度）：赤纬 + 时角近似，够游戏用
export function sunElevationDeg(viewer, latRad, lonRad) {
  const date = Cesium.JulianDate.toDate(viewer.clock.currentTime);
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - start) / 86400000;
  const decl = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365) * (Math.PI / 180);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarHour = utcHours + (lonRad * 180 / Math.PI) / 15;
  const hourAngle = ((solarHour - 12) * 15) * (Math.PI / 180);
  const sinEl = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle);
  return Math.asin(Cesium.Math.clamp(sinEl, -1, 1)) * (180 / Math.PI);
}

// 夜晚压暗 + 冷色调（Google 瓦片是白天烘焙贴图，需要后处理补偿昼夜）
export function createNightStage(scene) {
  const stage = new Cesium.PostProcessStage({
    fragmentShader: `
      uniform sampler2D colorTexture;
      uniform float u_brightness;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 c = texture(colorTexture, v_textureCoordinates);
        float night = clamp((1.0 - u_brightness) * 0.7, 0.0, 0.7);
        vec3 tinted = mix(c.rgb, c.rgb * vec3(0.5, 0.62, 1.05), night);
        out_FragColor = vec4(tinted * u_brightness, c.a);
      }`,
    uniforms: { u_brightness: 1.0 },
  });
  scene.postProcessStages.add(stage);
  return stage;
}

export function updateNight(stage, elevDeg) {
  // 太阳 -10° 以下全黑夜(0.2)，+12° 以上全白天(1.0)
  const t = Cesium.Math.clamp((elevDeg + 10) / 22, 0, 1);
  const smooth = t * t * (3 - 2 * t);
  stage.uniforms.u_brightness = 0.2 + 0.8 * smooth;
}

// —— 云层：跟随飞机按网格生成/回收积云 ——
const CLOUD_CELL = 5000;   // 米
const CLOUD_RADIUS = 3;    // 单侧格数（7x7 范围）
const R_EARTH = 6371000;

function hash(ix, iy, k) {
  let h = ix * 374761393 + iy * 668265263 + k * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class CloudField {
  constructor(scene) {
    this.collection = scene.primitives.add(new Cesium.CloudCollection());
    this.cells = new Map();
    this.enabled = true;
  }

  setEnabled(on) {
    this.enabled = on;
    this.collection.show = on;
  }

  update(carto) {
    if (!this.enabled) return;
    const latM = carto.latitude * R_EARTH;
    const lonM = carto.longitude * R_EARTH * Math.cos(carto.latitude);
    const cx = Math.round(lonM / CLOUD_CELL);
    const cy = Math.round(latM / CLOUD_CELL);
    const want = new Set();
    for (let dx = -CLOUD_RADIUS; dx <= CLOUD_RADIUS; dx++) {
      for (let dy = -CLOUD_RADIUS; dy <= CLOUD_RADIUS; dy++) {
        const ix = cx + dx, iy = cy + dy;
        if (hash(ix, iy, 1) < 0.45) continue; // 疏密
        want.add(`${ix},${iy}`);
      }
    }
    for (const [key, cloud] of this.cells) {
      if (!want.has(key)) { this.collection.remove(cloud); this.cells.delete(key); }
    }
    for (const key of want) {
      if (this.cells.has(key)) continue;
      const [ix, iy] = key.split(',').map(Number);
      const jx = (hash(ix, iy, 2) - 0.5) * CLOUD_CELL * 0.8;
      const jy = (hash(ix, iy, 3) - 0.5) * CLOUD_CELL * 0.8;
      const lon = ((ix * CLOUD_CELL + jx) / (R_EARTH * Math.cos(carto.latitude)));
      const lat = ((iy * CLOUD_CELL + jy) / R_EARTH);
      const height = 1600 + hash(ix, iy, 4) * 1400;
      const w = 1800 + hash(ix, iy, 5) * 2600;
      const cloud = this.collection.add({
        position: Cesium.Cartesian3.fromRadians(lon, lat, height),
        scale: new Cesium.Cartesian2(w, w * (0.28 + hash(ix, iy, 6) * 0.14)),
        maximumSize: new Cesium.Cartesian3(28, 12, 15),
        slice: 0.32 + hash(ix, iy, 7) * 0.2,
        brightness: 0.85 + hash(ix, iy, 8) * 0.15,
      });
      this.cells.set(key, cloud);
    }
  }
}

export function applyQuality(viewer, tileset, cloudField, presetKey) {
  const p = QUALITY_PRESETS[presetKey] || QUALITY_PRESETS.medium;
  if (tileset) tileset.maximumScreenSpaceError = p.sse;
  viewer.resolutionScale = p.resolutionScale;
  viewer.scene.msaaSamples = p.msaa;
  cloudField?.setEnabled(p.clouds);
}
