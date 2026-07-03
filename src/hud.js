// HUD：速度 / 高度 / 垂直速度 / 罗盘带 / 油门 / 目标导航
const R2D = 180 / Math.PI;

export class Hud {
  constructor() {
    this.el = {
      speed: document.getElementById('hud-speed'),
      alt: document.getElementById('hud-alt'),
      agl: document.getElementById('hud-agl'),
      vs: document.getElementById('hud-vs'),
      hdg: document.getElementById('hud-hdg'),
      tape: document.getElementById('compass-tape'),
      throttle: document.getElementById('throttle-fill'),
      coords: document.getElementById('hud-coords'),
      target: document.getElementById('hud-target'),
      targetName: document.getElementById('target-name'),
      targetDist: document.getElementById('target-dist'),
      targetArrow: document.getElementById('target-arrow'),
      stab: document.getElementById('hud-stab'),
      camMode: document.getElementById('hud-cam'),
      ground: document.getElementById('hud-ground'),
      clock: document.getElementById('hud-clock'),
    };
    this._buildTape();
  }

  _buildTape() {
    // 罗盘带：-180° ~ 540° 的刻度，覆盖环绕，2px/度
    const frag = document.createDocumentFragment();
    const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let d = -180; d <= 540; d += 10) {
      const norm = ((d % 360) + 360) % 360;
      const tick = document.createElement('div');
      tick.className = 'tick' + (norm % 30 === 0 ? ' major' : '');
      tick.style.left = `${(d + 180) * 2}px`;
      if (norm % 30 === 0) {
        const lbl = document.createElement('span');
        lbl.textContent = names[norm] ?? String(norm / 10).padStart(2, '0');
        if (names[norm]) lbl.className = 'cardinal';
        tick.appendChild(lbl);
      }
      frag.appendChild(tick);
    }
    this.el.tape.appendChild(frag);
  }

  update(aircraft, camLabel, targetInfo, localTimeStr) {
    const a = aircraft;
    const hdgDeg = ((a.heading * R2D) % 360 + 360) % 360;
    this.el.speed.textContent = Math.round(a.speedKmh);
    this.el.alt.textContent = Math.round(a.carto.height);
    this.el.agl.textContent = `离地 ${Math.max(0, Math.round(a.agl))} m`;
    const vs = a.craft === 'plane' ? a.speed * Math.sin(a.pitch) + a.vSpeed : a.vSpeed;
    this.el.vs.textContent = `${vs >= 0 ? '↑' : '↓'} ${Math.abs(vs).toFixed(1)} m/s`;
    this.el.hdg.textContent = String(Math.round(hdgDeg)).padStart(3, '0') + '°';
    // tape 中心对准当前航向：中心位置 = (hdg+180)*2，容器宽 280 → 偏移
    const center = (hdgDeg + 180) * 2;
    this.el.tape.style.transform = `translateX(${140 - center}px)`;
    this.el.throttle.style.width = `${Math.round(a.throttle * 100)}%`;
    const lat = (a.carto.latitude * R2D).toFixed(4);
    const lon = (a.carto.longitude * R2D).toFixed(4);
    this.el.coords.textContent = `${lat}, ${lon}`;
    this.el.stab.classList.toggle('on', a.autoStab);
    this.el.camMode.textContent = camLabel;
    this.el.ground.style.display = a.grounded ? '' : 'none';
    this.el.clock.textContent = localTimeStr;

    if (targetInfo) {
      this.el.target.style.display = '';
      this.el.targetName.textContent = targetInfo.name;
      this.el.targetDist.textContent = targetInfo.dist >= 1000
        ? `${(targetInfo.dist / 1000).toFixed(1)} km`
        : `${Math.round(targetInfo.dist)} m`;
      const rel = targetInfo.bearing - a.heading;
      this.el.targetArrow.style.transform = `rotate(${rel}rad)`;
    } else {
      this.el.target.style.display = 'none';
    }
  }
}

export function toast(msg, ms = 2600) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
}
