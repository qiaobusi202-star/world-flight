// 程序化直升机模型：Cesium 图元拼装（机身/尾梁/滑橇/旋翼），旋翼每帧旋转
// 本地坐标系约定（与 headingPitchRollToFixedFrame 一致）：+x 前，+y 左，+z 上
import * as Cesium from 'cesium';

const C = Cesium.Color.fromCssColorString;

const PARTS = [
  { kind: 'box', dims: [4.6, 1.6, 1.5], offset: [0.3, 0, 0], color: C('#c8392b') },      // 机身
  { kind: 'box', dims: [1.3, 1.3, 1.1], offset: [2.9, 0, -0.1], color: C('#2b3a4a') },   // 机头/座舱
  { kind: 'box', dims: [4.2, 0.38, 0.38], offset: [-3.6, 0, 0.35], color: C('#c8392b') },// 尾梁
  { kind: 'box', dims: [0.35, 0.08, 1.1], offset: [-5.5, 0, 0.9], color: C('#c8392b') }, // 垂尾
  { kind: 'box', dims: [3.2, 0.16, 0.12], offset: [0.3, 0.95, -1.15], color: C('#333940') }, // 左滑橇
  { kind: 'box', dims: [3.2, 0.16, 0.12], offset: [0.3, -0.95, -1.15], color: C('#333940') },// 右滑橇
  { kind: 'box', dims: [0.1, 0.1, 0.5], offset: [1.1, 0.95, -0.9], color: C('#333940') },
  { kind: 'box', dims: [0.1, 0.1, 0.5], offset: [-0.5, 0.95, -0.9], color: C('#333940') },
  { kind: 'box', dims: [0.1, 0.1, 0.5], offset: [1.1, -0.95, -0.9], color: C('#333940') },
  { kind: 'box', dims: [0.1, 0.1, 0.5], offset: [-0.5, -0.95, -0.9], color: C('#333940') },
  { kind: 'cylinder', r: 0.16, len: 0.6, offset: [0.3, 0, 1.05], color: C('#22262b') },  // 旋翼轴
  { kind: 'box', dims: [10.4, 0.34, 0.06], offset: [0.3, 0, 1.35], color: C('#181b1f'), spin: 'main' },   // 主旋翼叶 1
  { kind: 'box', dims: [10.4, 0.34, 0.06], offset: [0.3, 0, 1.41], color: C('#181b1f'), spin: 'main90' }, // 主旋翼叶 2
  { kind: 'box', dims: [1.7, 0.05, 0.2], offset: [-5.5, 0.28, 0.35], color: C('#181b1f'), spin: 'tail' }, // 尾旋翼
];

function makeGeometry(p) {
  if (p.kind === 'box') {
    return Cesium.BoxGeometry.fromDimensions({
      vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      dimensions: new Cesium.Cartesian3(...p.dims),
    });
  }
  return new Cesium.CylinderGeometry({
    vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
    topRadius: p.r, bottomRadius: p.r, length: p.len,
  });
}

export class HeliModel {
  constructor(scene) {
    this.scene = scene;
    this.parts = PARTS.map((p) => {
      const prim = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: makeGeometry(p),
          attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(p.color) },
        }),
        appearance: new Cesium.PerInstanceColorAppearance({ translucent: false, closed: true }),
        asynchronous: false,
        allowPicking: false,
        show: false,
      });
      scene.primitives.add(prim);
      return { prim, def: p };
    });
    this.rotorAngle = 0;
    this._t = new Cesium.Matrix4();
    this._r3 = new Cesium.Matrix3();
    this._r4 = new Cesium.Matrix4();
  }

  get primitives() { return this.parts.map((p) => p.prim); }

  setShow(show) { this.parts.forEach((p) => { p.prim.show = show; }); }

  // rootMatrix: headingPitchRollToFixedFrame 的结果；rotorSpeed: rad/s
  update(rootMatrix, dt, rotorSpeed) {
    this.rotorAngle = (this.rotorAngle + dt * rotorSpeed) % (Math.PI * 2);
    for (const { prim, def } of this.parts) {
      let m = Cesium.Matrix4.multiplyByTranslation(
        rootMatrix, new Cesium.Cartesian3(...def.offset), this._t
      );
      if (def.spin) {
        let rot;
        if (def.spin === 'tail') rot = Cesium.Matrix3.fromRotationY(this.rotorAngle * 4, this._r3);
        else rot = Cesium.Matrix3.fromRotationZ(this.rotorAngle + (def.spin === 'main90' ? Math.PI / 2 : 0), this._r3);
        m = Cesium.Matrix4.multiply(m, Cesium.Matrix4.fromRotation(rot, this._r4), this._t);
      }
      prim.modelMatrix = Cesium.Matrix4.clone(m, prim.modelMatrix);
    }
  }
}
