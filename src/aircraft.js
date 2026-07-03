// 飞行动力学：街机手感的飞机 & 直升机
// 位置用 Cartographic 积分（全球有效），姿态用 heading/pitch/roll
import * as Cesium from 'cesium';
import { HeliModel } from './heli.js';

const EARTH_R = 6371000;
const G = 9.81;
const D2R = Math.PI / 180;

// Cesium_Air / 程序化直升机 都是 +x 朝前（配合 north-west 本地系）
const FIXED_FRAME = Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west');

const PLANE = {
  minSpeed: 28,        // m/s ≈ 100 km/h
  maxSpeed: 250,       // ≈ 900 km/h
  gear: 3.2,           // 起落架离地高
  maxPitch: 50 * D2R,
  maxRoll: 62 * D2R,
  pitchRate: 45 * D2R,
  rollEase: 3.0,
  spaceClimb: 13,      // 空格直接爬升 m/s
};

const HELI = {
  maxFwd: 50, maxBack: 16, boost: 2.4,
  climb: 22, descend: 18,
  yawRate: 68 * D2R,
  skid: 1.7,
};

const DRONE = {
  maxFwd: 46, maxBack: 32, boost: 2.6,
  climb: 32, descend: 28,
  yawRate: 115 * D2R,
  gear: 0.5,
  ease: 0.35, // 响应时间常数：越小越跟手
};

export class Aircraft {
  constructor(viewer) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.craft = 'plane';
    this.carto = Cesium.Cartographic.fromDegrees(113.2196, 28.1892, 200);
    this.heading = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0;        // 飞机：沿机头速度；直升机：前向速度
    this.vSpeed = 0;       // 垂直速度（直升机与空格爬升用）
    this.throttle = 0.5;
    this.grounded = false;
    this.autoStab = false;
    this.groundHeight = 0;
    this._groundTimer = 0;
    this._pos = new Cesium.Cartesian3();
    this._hpr = new Cesium.HeadingPitchRoll();
    this._matrix = Cesium.Matrix4.IDENTITY.clone();
    this.planeModel = null;
    this.heliModel = null;
    this.ready = this._load();
  }

  async _load() {
    const base = import.meta.env.BASE_URL;
    this.planeModel = await Cesium.Model.fromGltfAsync({
      url: base + 'models/plane.glb',
      scale: 1.0,
      minimumPixelSize: 24,
      show: false,
    });
    this.scene.primitives.add(this.planeModel);
    this.droneModel = await Cesium.Model.fromGltfAsync({
      url: base + 'models/drone.glb',
      scale: 2.2,
      minimumPixelSize: 24,
      show: false,
    });
    this.scene.primitives.add(this.droneModel);
    this.droneModel.readyEvent.addEventListener(() => {
      try { this.droneModel.activeAnimations.addAll({ loop: Cesium.ModelAnimationLoop.REPEAT, multiplier: 2 }); } catch { /* 无内置动画 */ }
    });
    this.heliModel = new HeliModel(this.scene);
  }

  get position() {
    return Cesium.Cartesian3.fromRadians(
      this.carto.longitude, this.carto.latitude, this.carto.height, Cesium.Ellipsoid.WGS84, this._pos
    );
  }

  get modelMatrix() { return this._matrix; }
  get agl() { return this.carto.height - this.groundHeight; }
  get speedKmh() {
    const v = this.craft === 'plane' ? this.speed : Math.hypot(this.speed, this.vSpeed);
    return Math.abs(v) * 3.6;
  }

  spawn({ lon, lat, height, heading, speed, groundElev }, craft) {
    this.craft = craft;
    this.carto = Cesium.Cartographic.fromDegrees(lon, lat, height);
    this.heading = heading;
    this.pitch = 0; this.roll = 0;
    this.speed = speed ?? 0;
    this.vSpeed = 0;
    this.throttle = craft === 'plane' ? Math.max(0.35, (speed - PLANE.minSpeed) / (PLANE.maxSpeed - PLANE.minSpeed)) : 0.5;
    this.grounded = false;
    this.autoStab = false;
    this.groundHeight = Number.isFinite(groundElev) ? groundElev : height - 300;
    this._terrainHeight = undefined;
    this._groundTimer = 0;
    if (this.planeModel) this.planeModel.show = craft === 'plane';
    if (this.droneModel) this.droneModel.show = craft === 'drone';
    if (this.heliModel) this.heliModel.setShow(craft === 'heli');
    this._updateMatrix(0);
  }

  toggleStab() { this.autoStab = !this.autoStab; return this.autoStab; }

  update(dt, keys) {
    if (this.craft === 'plane') this._updatePlane(dt, keys);
    else if (this.craft === 'drone') this._updateDrone(dt, keys);
    else this._updateHeli(dt, keys);
    this._integrate(dt);
    this._sampleGround(dt);
    this._collide(dt, keys);
    this._updateMatrix(dt);
  }

  // —— 飞机：W 低头 / S 抬头 / A D 压坡度转弯 / 空格轻松爬升 / Shift Ctrl 油门 ——
  _updatePlane(dt, k) {
    const accel = k.shift ? 1 : 0;
    const decel = k.ctrl || k.x ? 1 : 0;
    this.throttle = Cesium.Math.clamp(this.throttle + (accel - decel) * 0.35 * dt, 0, 1);
    const targetSpeed = PLANE.minSpeed + this.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt / 1.6);

    const rollIn = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const pitchIn = (k.s ? 1 : 0) - (k.w ? 1 : 0); // S 抬头
    const stab = this.autoStab && !rollIn && !pitchIn;

    const targetRoll = this.grounded ? 0 : rollIn * PLANE.maxRoll;
    this.roll += (targetRoll - this.roll) * Math.min(1, PLANE.rollEase * dt);

    if (pitchIn) {
      this.pitch = Cesium.Math.clamp(this.pitch + pitchIn * PLANE.pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
    } else {
      const ease = stab ? 2.2 : 0.3; // 自动稳定时快速回平
      this.pitch += (0 - this.pitch) * Math.min(1, ease * dt);
    }
    if (stab) this.roll += (0 - this.roll) * Math.min(1, 2.2 * dt);

    // 压坡度转弯：转向速率 = g·tan(roll)/v
    if (!this.grounded && this.speed > 5) {
      this.heading += (G * Math.tan(this.roll) / this.speed) * dt;
    } else if (this.grounded) {
      this.heading += rollIn * 25 * D2R * dt; // 地面滑行用 A/D 转向
    }

    // Q/E 平稳转向：不压坡度直接偏航，转弯更温和好控
    const yawIn = (k.e ? 1 : 0) - (k.q ? 1 : 0);
    if (yawIn) {
      this.heading += yawIn * 20 * D2R * dt;
      if (!rollIn) this.roll += (yawIn * 10 * D2R - this.roll) * Math.min(1, 2 * dt); // 轻微侧倾视觉
    }

    // 空格：无脑爬升辅助
    this.vSpeed = k.space && !this.grounded ? PLANE.spaceClimb : 0;
    if (k.space && this.pitch < 8 * D2R) this.pitch += 20 * D2R * dt;
  }

  // —— 直升机：W S 前后 / A D 或 Q E 转向 / 空格升 / Ctrl 降+刹车 / Shift 快速前行 ——
  _updateHeli(dt, k) {
    const yawIn = ((k.d || k.e) ? 1 : 0) - ((k.a || k.q) ? 1 : 0);
    this.heading += yawIn * HELI.yawRate * dt;

    const fwdIn = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    let target = 0;
    if (k.shift) target = HELI.maxFwd * HELI.boost; // Shift 直接快速前行
    else if (fwdIn > 0) target = HELI.maxFwd;
    else if (fwdIn < 0) target = -HELI.maxBack;
    this.speed += (target - this.speed) * Math.min(1, dt / 1.1);
    if (k.ctrl || k.x) this.speed *= Math.max(0, 1 - 2.2 * dt); // 刹车

    let vTarget = 0;
    if (k.space) vTarget = HELI.climb;
    else if (k.ctrl || k.x) vTarget = -HELI.descend;
    this.vSpeed += (vTarget - this.vSpeed) * Math.min(1, dt / 0.5);

    // 姿态跟随（纯视觉）
    const tPitch = -(this.speed / HELI.maxFwd) * 9 * D2R;
    const tRoll = -yawIn * 10 * D2R;
    this.pitch += (tPitch - this.pitch) * Math.min(1, 3 * dt);
    this.roll += (tRoll - this.roll) * Math.min(1, 3 * dt);

    if (this.autoStab) { this.speed *= Math.max(0, 1 - 1.2 * dt); this.vSpeed *= Math.max(0, 1 - 1.5 * dt); }
  }

  // —— 无人机：响应最快 —— W S 疾速前后 / A D Q E 急转 / 空格急升 / Ctrl 急降 / Shift 疾行
  _updateDrone(dt, k) {
    const yawIn = ((k.d || k.e) ? 1 : 0) - ((k.a || k.q) ? 1 : 0);
    this.heading += yawIn * DRONE.yawRate * dt;

    const fwdIn = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    let target = 0;
    if (k.shift) target = DRONE.maxFwd * DRONE.boost;
    else if (fwdIn > 0) target = DRONE.maxFwd;
    else if (fwdIn < 0) target = -DRONE.maxBack;
    this.speed += (target - this.speed) * Math.min(1, dt / DRONE.ease);
    if (k.ctrl || k.x) this.speed *= Math.max(0, 1 - 3.5 * dt); // 急刹

    let vTarget = 0;
    if (k.space) vTarget = DRONE.climb;
    else if (k.ctrl || k.x) vTarget = -DRONE.descend;
    this.vSpeed += (vTarget - this.vSpeed) * Math.min(1, dt / DRONE.ease);

    // 机身姿态跟随（无人机倾角更大，更有机动感）
    const max = DRONE.maxFwd * DRONE.boost;
    const tPitch = -(this.speed / max) * 22 * D2R;
    const tRoll = -yawIn * 16 * D2R;
    this.pitch += (tPitch - this.pitch) * Math.min(1, 6 * dt);
    this.roll += (tRoll - this.roll) * Math.min(1, 6 * dt);

    if (this.autoStab) { this.speed *= Math.max(0, 1 - 2 * dt); this.vSpeed *= Math.max(0, 1 - 2.5 * dt); }
  }

  _integrate(dt) {
    let vN, vE, vU;
    if (this.craft === 'plane') {
      const cp = Math.cos(this.pitch);
      vN = this.speed * cp * Math.cos(this.heading);
      vE = this.speed * cp * Math.sin(this.heading);
      vU = this.speed * Math.sin(this.pitch) + this.vSpeed;
    } else {
      vN = this.speed * Math.cos(this.heading);
      vE = this.speed * Math.sin(this.heading);
      vU = this.vSpeed;
    }
    this._vU = vU;
    const r = EARTH_R + this.carto.height;
    this.carto.latitude += (vN * dt) / r;
    this.carto.longitude += (vE * dt) / (r * Math.cos(this.carto.latitude));
    this.carto.height += vU * dt;
    this.carto.latitude = Cesium.Math.clamp(this.carto.latitude, -89 * D2R, 89 * D2R);
    if (this.carto.longitude > Math.PI) this.carto.longitude -= 2 * Math.PI;
    if (this.carto.longitude < -Math.PI) this.carto.longitude += 2 * Math.PI;
    this.heading = Cesium.Math.zeroToTwoPi(this.heading);
  }

  setTerrain(provider) { this._terrain = provider; }

  _sampleGround(dt) {
    this._groundTimer -= dt;
    if (this._groundTimer > 0) return;
    this._groundTimer = 0.35;

    // 1) 真实地形高度（Cesium World Terrain，与屏幕 LOD 无关，权威值）
    if (this._terrain && !this._terrainBusy) {
      this._terrainBusy = true;
      const probe = new Cesium.Cartographic(this.carto.longitude, this.carto.latitude);
      Cesium.sampleTerrainMostDetailed(this._terrain, [probe])
        .then((r) => {
          if (Number.isFinite(r?.[0]?.height)) this._terrainHeight = r[0].height;
        })
        .catch(() => {})
        .finally(() => { this._terrainBusy = false; });
    }

    // 2) 瓦片网格高度：只有与真实地形吻合时才采纳（用于楼顶等精细几何；
    //    否则是未加载完的粗糙 LOD，会出现几百米的假地面）
    let visual;
    try {
      const exclude = [];
      if (this.planeModel) exclude.push(this.planeModel);
      if (this.droneModel) exclude.push(this.droneModel);
      if (this.heliModel) exclude.push(...this.heliModel.primitives);
      visual = this.scene.sampleHeight(this.carto, exclude);
    } catch { /* 瓦片未就绪 */ }

    const terrain = this._terrainHeight;
    if (Number.isFinite(terrain)) {
      if (Number.isFinite(visual) && visual >= terrain - 15 && visual <= terrain + 120) {
        this.groundHeight = visual;
      } else {
        this.groundHeight = terrain;
      }
    } else if (Number.isFinite(visual) && Math.abs(visual - this.groundHeight) < 120) {
      this.groundHeight = visual;
    }
  }

  _collide(dt, k) {
    const gear = this.craft === 'plane' ? PLANE.gear : this.craft === 'drone' ? DRONE.gear : HELI.skid;
    const floor = this.groundHeight + gear;
    if (this.carto.height <= floor) {
      this.carto.height = floor;
      if (this._vU <= 0) {
        this.grounded = true;
        this.vSpeed = Math.max(0, this.vSpeed);
        if (this.craft === 'plane') {
          this.pitch = Math.max(0, this.pitch);
          this.roll *= Math.max(0, 1 - 4 * dt);
          if (this.throttle < 0.3) this.speed *= Math.max(0, 1 - 1.2 * dt); // 地面摩擦
        } else {
          this.speed *= Math.max(0, 1 - 3 * dt);
        }
      }
    } else if (this.carto.height > floor + 1) {
      this.grounded = false;
    }
  }

  _updateMatrix(dt) {
    const pos = this.position;
    this._hpr.heading = this.heading;
    this._hpr.pitch = this.pitch;
    this._hpr.roll = this.roll;
    Cesium.Transforms.headingPitchRollToFixedFrame(pos, this._hpr, Cesium.Ellipsoid.WGS84, FIXED_FRAME, this._matrix);
    if (this.craft === 'plane' && this.planeModel) {
      this.planeModel.modelMatrix = this._matrix;
    } else if (this.craft === 'drone' && this.droneModel) {
      this.droneModel.modelMatrix = this._matrix;
    } else if (this.craft === 'heli' && this.heliModel) {
      const rotor = this.grounded && Math.abs(this.speed) < 0.5 && this.vSpeed <= 0 ? 8 : 24;
      this.heliModel.update(this._matrix, dt, rotor);
    }
  }
}
