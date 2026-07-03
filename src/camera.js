// 三种视角：追尾 / 机舱 / 环绕（C 键循环）
import * as Cesium from 'cesium';

const MODES = [
  { id: 'chase', label: '追尾视角' },
  { id: 'cockpit', label: '机舱视角' },
  { id: 'orbit', label: '环绕视角' },
];

const CHASE = {
  plane: { back: 46, up: 14 },
  heli: { back: 28, up: 10 },
  drone: { back: 15, up: 5 },
};

const COCKPIT_OFFSET = {
  plane: [7.5, 0, 1.6],
  heli: [3.4, 0, 0.7],
  drone: [1.6, 0, 0.5],
};

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export class CameraController {
  constructor(viewer, aircraft) {
    this.viewer = viewer;
    this.camera = viewer.camera;
    this.aircraft = aircraft;
    this.modeIdx = 0;
    this.smHeading = 0;
    this.smPitch = 0;
    this._enu = new Cesium.Matrix4();
    this._offset = new Cesium.Cartesian3();
    this._camPos = new Cesium.Cartesian3();
  }

  get mode() { return MODES[this.modeIdx].id; }
  get label() { return MODES[this.modeIdx].label; }

  reset() {
    this.smHeading = this.aircraft.heading;
    this.smPitch = 0;
    this.modeIdx = 0;
    this._applyInputMode();
  }

  cycle() {
    if (this.mode === 'orbit') this.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    this.modeIdx = (this.modeIdx + 1) % MODES.length;
    if (this.mode === 'orbit') {
      this.camera.lookAt(
        this.aircraft.position,
        new Cesium.HeadingPitchRange(this.aircraft.heading + Math.PI * 0.75, -0.25, 130)
      );
    }
    this._applyInputMode();
    return this.label;
  }

  _applyInputMode() {
    const ctrl = this.viewer.scene.screenSpaceCameraController;
    ctrl.enableInputs = this.mode === 'orbit';
  }

  update(dt) {
    const a = this.aircraft;
    const pos = a.position;
    if (this.mode === 'orbit') {
      // 跟随飞机移动，保留用户鼠标环绕的相对位置
      Cesium.Transforms.eastNorthUpToFixedFrame(pos, Cesium.Ellipsoid.WGS84, this._enu);
      this.camera.lookAtTransform(this._enu);
      return;
    }

    const t = Math.min(1, 4.5 * dt);
    this.smHeading = lerpAngle(this.smHeading, a.heading, t);
    this.smPitch += (a.pitch - this.smPitch) * t;

    if (this.mode === 'cockpit') {
      const off = COCKPIT_OFFSET[a.craft] || COCKPIT_OFFSET.plane;
      Cesium.Matrix4.multiplyByPoint(a.modelMatrix, new Cesium.Cartesian3(...off), this._camPos);
      this.camera.setView({
        destination: this._camPos,
        orientation: { heading: a.heading, pitch: a.pitch, roll: a.roll },
      });
      return;
    }

    // 追尾
    const cfg = CHASE[a.craft] || CHASE.plane;
    Cesium.Transforms.eastNorthUpToFixedFrame(pos, Cesium.Ellipsoid.WGS84, this._enu);
    const back = cfg.back;
    this._offset.x = -Math.sin(this.smHeading) * back; // east
    this._offset.y = -Math.cos(this.smHeading) * back; // north
    this._offset.z = cfg.up - Math.sin(this.smPitch) * back * 0.4;
    Cesium.Matrix4.multiplyByPoint(this._enu, this._offset, this._camPos);
    this.camera.setView({
      destination: this._camPos,
      orientation: {
        heading: this.smHeading,
        pitch: -0.18 + this.smPitch * 0.55,
        roll: 0,
      },
    });
  }
}
