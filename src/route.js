// 航点 / 航线 / 目标导航：标注、发光航线、到点自动切换
import * as Cesium from 'cesium';
import { toast } from './hud.js';

const ARRIVE_DIST = 650; // 米，水平进入即算到达

export class Route {
  constructor(viewer, aircraft) {
    this.viewer = viewer;
    this.aircraft = aircraft;
    this.pinBuilder = new Cesium.PinBuilder();
    this.waypoints = []; // { name, carto, entity, reached }
    this.current = 0;
    this._geodesic = new Cesium.EllipsoidGeodesic();
    this._scratch = new Cesium.Cartographic();

    // 从飞机到当前目标的动态引导线
    this.guideLine = viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const wp = this.currentWaypoint;
          if (!wp) return [];
          return [this.aircraft.position.clone(), this._wpCartesian(wp)];
        }, false),
        width: 8,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.18,
          color: Cesium.Color.fromCssColorString('#39d0ff'),
        }),
        arcType: Cesium.ArcType.GEODESIC,
      },
      show: false,
    });
  }

  get currentWaypoint() {
    return this.current < this.waypoints.length ? this.waypoints[this.current] : null;
  }

  _wpCartesian(wp) {
    return Cesium.Cartesian3.fromRadians(wp.carto.longitude, wp.carto.latitude, wp.carto.height);
  }

  add(latDeg, lonDeg, heightM, name) {
    const idx = this.waypoints.length + 1;
    const carto = Cesium.Cartographic.fromDegrees(lonDeg, latDeg, heightM);
    const entity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, heightM),
      billboard: {
        image: this.pinBuilder.fromText(String(idx), Cesium.Color.fromCssColorString('#ff5533'), 52).toDataURL(),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 200000, 0.4),
      },
      label: {
        text: name,
        font: '14px "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -58),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 200000, 0.5),
      },
    });
    this.waypoints.push({ name, carto, entity, reached: false });
    this.guideLine.show = true;
    toast(`已设为目标：${name}`);
  }

  clear() {
    for (const wp of this.waypoints) this.viewer.entities.remove(wp.entity);
    this.waypoints = [];
    this.current = 0;
    this.guideLine.show = false;
  }

  // 返回 { name, dist, bearing } 给 HUD；到点自动切下一个
  update() {
    const wp = this.currentWaypoint;
    if (!wp) return null;
    this._geodesic.setEndPoints(this.aircraft.carto, wp.carto);
    const dist = this._geodesic.surfaceDistance;
    if (dist < ARRIVE_DIST) {
      wp.reached = true;
      wp.entity.billboard.image = this.pinBuilder
        .fromText('✓', Cesium.Color.fromCssColorString('#2ecc71'), 52).toDataURL();
      this.current += 1;
      toast(this.currentWaypoint ? `已到达 ${wp.name}，前往下一目标` : `🎉 已到达 ${wp.name}，航线完成`);
      this.guideLine.show = !!this.currentWaypoint;
      return this.update();
    }
    return { name: wp.name, dist, bearing: this._geodesic.startHeading };
  }
}
