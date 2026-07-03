// vite-plugin-static-copy v4 会保留完整源路径结构，把 Cesium 资源搬回 cesiumStatic 根下
import { renameSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cesiumStatic');
const nested = join(root, 'node_modules', 'cesium', 'Build', 'Cesium');
if (existsSync(nested)) {
  for (const d of readdirSync(nested)) renameSync(join(nested, d), join(root, d));
  rmSync(join(root, 'node_modules'), { recursive: true, force: true });
  console.log('cesiumStatic 目录结构已修正');
} else {
  console.log('无需修正');
}
