// 寰宇飞行：主程序 —— 串联场景 / 飞行 / 视角 / HUD / 导航 / UI
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { setIonToken } from './config.js';
import {
  createViewer, loadGoogleTiles, loadPhysicsTerrain, setTimeOfDay, localTimeString,
  sunElevationDeg, createNightStage, updateNight, CloudField, applyQuality,
} from './world.js';
import { Aircraft } from './aircraft.js';
import { Controls } from './controls.js';
import { CameraController } from './camera.js';
import { Hud, toast } from './hud.js';
import { Route } from './route.js';
import { geocode, searchAirports, allAirportsCount } from './search.js';
import { PRESETS, spawnFromPreset } from './locations.js';
import { MapView } from './mapview.js';

const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;

const state = {
  started: false,
  craft: 'plane',
  startHour: 12,
  quality: 'medium',
  tileset: null,
};

let viewer, aircraft, controls, camCtl, hud, route, clouds, nightStage, mapView;
let lastTime = 0;
let mapTimer = 0;

// ———————————————————— 启动 ————————————————————
async function boot() {
  viewer = createViewer();
  nightStage = createNightStage(viewer.scene);
  clouds = new CloudField(viewer.scene);
  aircraft = new Aircraft(viewer);
  controls = new Controls();
  camCtl = new CameraController(viewer, aircraft);
  hud = new Hud();
  route = new Route(viewer, aircraft);
  mapView = new MapView({
    onTeleport: (lat, lon) => {
      aircraft.spawn(
        { lon, lat, height: Math.max(aircraft.carto.height, 800), heading: aircraft.heading, speed: state.craft === 'plane' ? 70 : 15 },
        state.craft
      );
      camCtl.reset(); camCtl.update(1);
      mapView.hide();
      toast('⚡ 已传送到地图选中位置');
    },
    onTarget: (lat, lon) => {
      route.add(lat, lon, Math.max(300, aircraft.carto.height), '地图标注');
      mapView.hide();
    },
  });

  wireStartScreen();
  wireGameUi();
  wirePicking();

  controls.onStab = () => {
    if (!state.started) return;
    toast(aircraft.toggleStab() ? '✅ 自动稳定 开启' : '自动稳定 关闭');
  };
  controls.onCamera = () => {
    if (!state.started) return;
    toast(`📷 ${camCtl.cycle()}`);
  };
  controls.onMap = () => {
    if (!state.started) return;
    mapView.toggle(aircraft);
  };

  // 主循环
  viewer.scene.preUpdate.addEventListener(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (!state.started) {
      // 起始界面背景：地球缓慢自转
      viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.00012);
      return;
    }
    aircraft.update(dt, controls.keys);
    camCtl.update(dt);
    clouds.update(aircraft.carto);
    const lonDeg = aircraft.carto.longitude / D2R;
    updateNight(nightStage, sunElevationDeg(viewer, aircraft.carto.latitude, aircraft.carto.longitude));
    hud.update(aircraft, camCtl.label, route.update(), localTimeString(viewer, lonDeg));
    mapTimer -= dt;
    if (mapTimer <= 0) { mapTimer = 0.5; mapView.update(aircraft, route.waypoints, route.current); }
  });

  // 起始界面背景视角：太空看亚洲
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(110, 24, 16000000),
  });

  // 真实地形（物理碰撞用），后台加载即可
  loadPhysicsTerrain().then((t) => { if (t) aircraft.setTerrain(t); });

  try {
    state.tileset = await loadGoogleTiles(viewer);
    applyQuality(viewer, state.tileset, clouds, state.quality);
    await aircraft.ready;
    $('loading').classList.add('hidden');
    $('start-screen').classList.remove('hidden');
  } catch (err) {
    console.error(err.original || err);
    $('loading').classList.add('hidden');
    $('error-reason').textContent = err.message;
    $('error-card').classList.remove('hidden');
  }
}

// ———————————————————— 开始/结束飞行 ————————————————————
function startFlight(spawn) {
  route.clear();
  aircraft.spawn(
    { lon: spawn.lon, lat: spawn.lat, height: spawn.height, heading: spawn.heading, speed: spawn.speed, groundElev: spawn.groundElev },
    state.craft
  );
  if (spawn.landmarkTarget) {
    route.add(spawn.landmarkTarget.lat, spawn.landmarkTarget.lon, Math.max(80, spawn.height - 150), spawn.landmarkTarget.name);
  }
  setTimeOfDay(viewer, state.startHour, spawn.lon);
  camCtl.reset();
  camCtl.update(1);
  state.started = true;
  controls.enabled = true;
  $('start-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  const craftName = { plane: '飞机', heli: '直升机', drone: '无人机' }[state.craft];
  toast(`🛫 ${spawn.name} · ${craftName} · 祝飞行愉快`, 3200);
}

function backToStart() {
  state.started = false;
  controls.enabled = false;
  hideAllPanels();
  mapView.hide();
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.scene.screenSpaceCameraController.enableInputs = true;
  const c = aircraft.carto;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, 12000000),
  });
  $('hud').classList.add('hidden');
  $('start-screen').classList.remove('hidden');
}

// ———————————————————— 起始界面 ————————————————————
function wireStartScreen() {
  $('airport-count').textContent = String(allAirportsCount());

  document.querySelectorAll('.craft-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.craft-card').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.craft = btn.dataset.craft;
    });
  });

  document.querySelectorAll('.time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.startHour = Number(btn.dataset.hour);
    });
  });

  // 精选卡片
  const grid = $('preset-grid');
  for (const p of PRESETS) {
    const card = document.createElement('button');
    card.className = 'preset-card';
    card.innerHTML = `<span class="emoji">${p.emoji}</span><b>${p.name}</b><small>${p.en}</small>`;
    card.addEventListener('click', () => {
      const s = spawnFromPreset(p, state.craft);
      if (p.type === 'landmark') s.landmarkTarget = { lat: p.lat, lon: p.lon, name: p.name };
      startFlight(s);
    });
    grid.appendChild(card);
  }

  // 机场搜索
  const input = $('airport-search');
  const results = $('airport-results');
  input.addEventListener('input', () => {
    results.innerHTML = '';
    const list = searchAirports(input.value, 14);
    for (const a of list) {
      const item = document.createElement('div');
      item.className = 'airport-item';
      item.innerHTML = `<span class="iata">${a.iata || a.icao}</span><span>${a.name}</span><small>${a.city} ${a.country} · 标高${a.elev}m</small>`;
      item.addEventListener('click', () => {
        const s = spawnFromPreset({ type: 'airport', name: a.name, lat: a.lat, lon: a.lon, elev: a.elev, hdg: a.hdg }, state.craft);
        startFlight(s);
      });
      results.appendChild(item);
    }
  });

  const changeToken = () => {
    const t = prompt('粘贴新的 Cesium ion 访问令牌（留空恢复默认）：');
    if (t === null) return;
    setIonToken(t);
    location.reload();
  };
  $('btn-token-small').addEventListener('click', changeToken);
  $('btn-change-token').addEventListener('click', changeToken);
  $('btn-retry').addEventListener('click', () => location.reload());
}

// ———————————————————— 游戏内 UI ————————————————————
function hideAllPanels() {
  document.querySelectorAll('.panel').forEach((p) => p.classList.add('hidden'));
}

function wireGameUi() {
  document.querySelectorAll('#toolbar button[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = $(btn.dataset.panel);
      const wasHidden = panel.classList.contains('hidden');
      hideAllPanels();
      if (wasHidden) panel.classList.remove('hidden');
    });
  });
  $('btn-relocate').addEventListener('click', backToStart);
  $('btn-map').addEventListener('click', () => mapView.toggle(aircraft));
  $('map-close').addEventListener('click', () => mapView.hide());
  $('btn-clear-route').addEventListener('click', () => { route.clear(); toast('已清除航线'); });

  // 时间
  document.querySelectorAll('.game-time-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.startHour = Number(btn.dataset.hour);
      setTimeOfDay(viewer, state.startHour, aircraft.carto.longitude / D2R);
      toast(`🕐 时间已切换：${btn.textContent.trim()}`);
    });
  });
  $('time-speed').addEventListener('change', (e) => {
    viewer.clock.multiplier = Number(e.target.value);
  });

  // 画质
  document.querySelectorAll('.q-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.q-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.quality = btn.dataset.q;
      applyQuality(viewer, state.tileset, clouds, state.quality);
      toast(`🎨 画质：${btn.textContent.trim()}`);
    });
  });

  // 地点搜索
  const doSearch = async () => {
    const q = $('geo-input').value.trim();
    if (!q) return;
    const box = $('geo-results');
    box.innerHTML = '<div class="dim" style="padding:8px">搜索中…</div>';
    try {
      const list = await geocode(q);
      box.innerHTML = list.length ? '' : '<div class="dim" style="padding:8px">没有找到结果</div>';
      for (const r of list) {
        const item = document.createElement('div');
        item.className = 'geo-item';
        const name = document.createElement('span');
        name.textContent = r.name;
        name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px';
        const actions = document.createElement('div');
        actions.className = 'geo-actions';
        const goBtn = document.createElement('button');
        goBtn.textContent = '⚡ 传送';
        goBtn.addEventListener('click', () => {
          aircraft.spawn(
            { lon: r.lon, lat: r.lat, height: aircraft.carto.height > 3000 ? aircraft.carto.height : 800, heading: aircraft.heading, speed: state.craft === 'plane' ? 70 : 15 },
            state.craft
          );
          camCtl.reset(); camCtl.update(1);
          hideAllPanels();
          toast(`⚡ 已传送到 ${r.name}`);
        });
        const tgtBtn = document.createElement('button');
        tgtBtn.textContent = '🎯 设为目标';
        tgtBtn.addEventListener('click', () => {
          route.add(r.lat, r.lon, Math.max(300, aircraft.carto.height), r.name);
          hideAllPanels();
        });
        actions.append(goBtn, tgtBtn);
        item.append(name, actions);
        box.appendChild(item);
      }
    } catch (e) {
      box.innerHTML = '<div class="dim" style="padding:8px">搜索失败，请检查网络或令牌</div>';
    }
  };
  $('geo-go').addEventListener('click', doSearch);
  $('geo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
}

// 双击地面：设为目标航点
function wirePicking() {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    if (!state.started) return;
    const pos = viewer.scene.pickPosition(movement.position);
    if (!Cesium.defined(pos)) return;
    const c = Cesium.Cartographic.fromCartesian(pos);
    route.add(c.latitude / D2R, c.longitude / D2R, c.height + 60, '标注点');
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

boot();
// 调试入口
window.__wf = { get viewer() { return viewer; }, get aircraft() { return aircraft; }, get state() { return state; }, get camCtl() { return camCtl; }, get controls() { return controls; }, startFlight, spawnFromPreset, PRESETS };
