// 键盘输入：WASD 方向 / Q E 平稳转向 / 空格上升 / Shift 加速 / Ctrl(或X) 减速下降
// R 自动稳定 / C 切换视角 / M 地图
export class Controls {
  constructor() {
    this.keys = { w: false, a: false, s: false, d: false, q: false, e: false, space: false, shift: false, ctrl: false, x: false };
    this.onStab = null;   // R 按下回调
    this.onCamera = null; // C 按下回调
    this.onMap = null;    // M 按下回调
    this.enabled = false;

    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    window.addEventListener('blur', () => this._reset());
  }

  _reset() {
    for (const k of Object.keys(this.keys)) this.keys[k] = false;
  }

  _onKey(e, down) {
    if (!this.enabled) return;
    // 输入框聚焦时不接管
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    let handled = true;
    switch (e.code) {
      case 'KeyW': this.keys.w = down; break;
      case 'KeyA': this.keys.a = down; break;
      case 'KeyS': this.keys.s = down; break;
      case 'KeyD': this.keys.d = down; break;
      case 'KeyQ': this.keys.q = down; break;
      case 'KeyE': this.keys.e = down; break;
      case 'KeyX': this.keys.x = down; break;
      case 'Space': this.keys.space = down; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.shift = down; break;
      case 'ControlLeft': case 'ControlRight': this.keys.ctrl = down; break;
      case 'KeyR': if (down && !e.repeat) this.onStab?.(); break;
      case 'KeyC': if (down && !e.repeat) this.onCamera?.(); break;
      case 'KeyM': if (down && !e.repeat) this.onMap?.(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }
}
