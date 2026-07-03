# 寰宇飞行 World Flight ✈️🌏

网页版真实地球飞行模拟器：**真实地球 · 真实城市 · 真实机场**，在浏览器里驾驶飞机、直升机或无人机飞遍全世界。

## 真实数据来源

| 数据 | 来源 |
|---|---|
| 全球照片级 3D 地球（地形+影像+城市建筑） | Google Photorealistic 3D Tiles（经 Cesium ion 资产 2275207） |
| 物理碰撞地形高度 | Cesium World Terrain |
| 全球 1178 个大型机场（坐标/标高/跑道朝向） | [OurAirports](https://ourairports.com/) 开放数据 |
| 地名搜索 | Cesium ion 地理编码 |
| 2D 世界地图 | OpenStreetMap（Leaflet） |

> ⚠️ Google 3D Tiles 瓦片由 Google 服务器提供，中国大陆访问需开启代理/VPN。

## 操控（简单，适合所有人）

| 按键 | 功能 |
|---|---|
| `W / S` | 飞机：俯仰；直升机/无人机：前进/后退 |
| `A / D` | 转向（飞机为压坡度转弯） |
| `Q / E` | 平稳转向（不压坡度） |
| `空格` | 上升 |
| `Shift` | 加速（直升机/无人机：疾速前行） |
| `Ctrl / X` | 减速 / 下降 |
| `R` | 自动稳定 |
| `C` | 切换视角（追尾/机舱/环绕） |
| `M` | 世界地图（查看位置、点击传送/设目标） |
| 双击地面 | 设为目标航点 |

## 功能

- 三种载具：✈️ 飞机（巡航 100–900 km/h）、🚁 直升机（悬停）、🛸 无人机（极速机动）
- 全球任意城市/机场/地标起飞（20 个精选 + 1178 个真实机场搜索）
- 目标导航：发光航线、距离/方位实时显示、到点自动切换
- HUD：空速、海拔、离地高度、垂直速度、罗盘带、油门
- 天空大气、体积积云、真实太阳位置昼夜变化（清晨/正午/黄昏/夜晚 + 时间流速）
- 三档画质

## 本地运行

```bash
npm install
npm run dev          # http://localhost:5199
npm run airports     # 重新生成机场数据（可选）
npm run build        # 产出 dist/
```

首次使用需要 Cesium ion 令牌（免费注册 [ion.cesium.com](https://ion.cesium.com)），并在 Asset Depot 中添加 **Google Photorealistic 3D Tiles** 资产。令牌可在游戏内"更换令牌"处修改。

## 技术栈

CesiumJS + Vite + Leaflet，纯 vanilla JS。飞机模型来自 CesiumGS 官方示例（Apache-2.0），直升机为程序化图元拼装。
