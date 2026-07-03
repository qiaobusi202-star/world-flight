// 全屏地图（Leaflet + OpenStreetMap 真实地图）：查看飞机位置、点击定位/传送/设目标
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const R2D = 180 / Math.PI;

export class MapView {
  // callbacks: { onTeleport(lat, lon), onTarget(lat, lon) }
  constructor(callbacks) {
    this.cb = callbacks;
    this.map = null;
    this.aircraftMarker = null;
    this.wpLayer = null;
    this.follow = true;
    this.open = false;
    this._popup = null;
  }

  _init() {
    if (this.map) return;
    this.map = L.map('map-container', { zoomControl: true, worldCopyJump: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.map.setView([28.19, 113.22], 12);

    this.aircraftMarker = L.marker([0, 0], {
      icon: L.divIcon({ className: '', html: '<div id="map-plane">✈</div>', iconSize: [36, 36], iconAnchor: [18, 18] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(this.map);

    this.wpLayer = L.layerGroup().addTo(this.map);

    // 点击地图 → 定位菜单
    this.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const div = document.createElement('div');
      div.className = 'map-popup';
      div.innerHTML = `<b>${lat.toFixed(4)}, ${lng.toFixed(4)}</b>`;
      const row = document.createElement('div');
      row.className = 'row';
      const tp = document.createElement('button');
      tp.textContent = '⚡ 传送到此';
      tp.onclick = () => { this.map.closePopup(); this.cb.onTeleport(lat, lng); };
      const tg = document.createElement('button');
      tg.textContent = '🎯 设为目标';
      tg.onclick = () => { this.map.closePopup(); this.cb.onTarget(lat, lng); };
      row.append(tp, tg);
      div.appendChild(row);
      L.popup().setLatLng(e.latlng).setContent(div).openOn(this.map);
    });

    // 用户拖动地图时暂停跟随
    this.map.on('dragstart', () => { this.follow = false; this._syncFollowUi(); });
    document.getElementById('map-follow').addEventListener('change', (e) => {
      this.follow = e.target.checked;
    });
  }

  _syncFollowUi() {
    document.getElementById('map-follow').checked = this.follow;
  }

  show(aircraft) {
    document.getElementById('map-modal').classList.remove('hidden');
    this.open = true;
    this._init();
    this.follow = true;
    this._syncFollowUi();
    // 容器刚显示需要重算尺寸
    setTimeout(() => {
      this.map.invalidateSize();
      this.map.setView([aircraft.carto.latitude * R2D, aircraft.carto.longitude * R2D], Math.max(this.map.getZoom(), 12));
    }, 50);
  }

  hide() {
    document.getElementById('map-modal').classList.add('hidden');
    this.open = false;
  }

  toggle(aircraft) {
    this.open ? this.hide() : this.show(aircraft);
  }

  // 每 ~0.5s 调一次（仅在打开时）
  update(aircraft, waypoints, currentIdx) {
    if (!this.open || !this.map) return;
    const lat = aircraft.carto.latitude * R2D;
    const lon = aircraft.carto.longitude * R2D;
    this.aircraftMarker.setLatLng([lat, lon]);
    const el = document.getElementById('map-plane');
    if (el) el.style.transform = `rotate(${aircraft.heading * R2D - 45}deg)`; // ✈ 字形自带 45° 朝向
    if (this.follow) this.map.panTo([lat, lon], { animate: false });

    // 同步航点
    if (this._wpCount !== waypoints.length || this._wpIdx !== currentIdx) {
      this._wpCount = waypoints.length;
      this._wpIdx = currentIdx;
      this.wpLayer.clearLayers();
      const pts = [];
      waypoints.forEach((wp, i) => {
        const p = [wp.carto.latitude * R2D, wp.carto.longitude * R2D];
        pts.push(p);
        L.circleMarker(p, {
          radius: 8,
          color: wp.reached ? '#2ecc71' : i === currentIdx ? '#39d0ff' : '#ff5533',
          fillOpacity: 0.85,
        }).bindTooltip(`${i + 1}. ${wp.name}`).addTo(this.wpLayer);
      });
      if (pts.length) L.polyline(pts, { color: '#39d0ff', weight: 3, dashArray: '6 6' }).addTo(this.wpLayer);
    }
  }
}
