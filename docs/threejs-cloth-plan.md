# 像素风海景窗 · 3D 布料窗帘改造方案

> 目标：在**不改变现有像素画风**的前提下，把窗帘从“2D 程序化贴片”升级为：
> Three.js + 高细分 PlaneGeometry + Verlet / Spring 布料模拟 + 自定义顶点着色器 +
> 鼠标速度风场 + 布料贴图 / 法线 / 光照。

## 1. 现状与目标

**现状**

- 整体是单个 `480×360` 低分辨率 `<canvas>`，像素风靠“低分辨率渲染 + `nearest` 放大”实现。
- 窗帘目前是纯 JS 的 2D 扫描线绘制 + CPU verlet（上一版已实现基础布料），
  但没有贴图 / 法线 / 光照，也缺少 3D 立体感与“纱帘透光”的质感。

**目标**

1. 用 Three.js 的 `PlaneGeometry` 高细分平面承载窗帘。
2. 保留并升级 CPU Verlet 模拟（后续可再迁移到 GPU）。
3. 自定义 vertex / fragment shader，做布料位移、法线重建与像素化光照。
4. 鼠标速度作为风场输入，吹动窗帘并沿弹簧约束向周围传播。
5. 程序化蕾丝贴图 + 法线贴图 + 光照，让纱帘有透光与立体感。
6. 全程保持像素风：低分辨率渲染 + 色阶量化 + `NearestFilter`。

## 2. 总体架构（推荐：双画布混合合成）

**不重写整个场景**，采用“双画布叠加”：

- 画布 A（现有 2D `<canvas>`）：继续画墙、窗、海、时钟、猫、蜡烛，**去掉窗帘**。
- 画布 B（Three.js `<canvas>`）：只画窗帘，背景透明，用正交相机与画布 A 对齐。

两者统一到 `480×360` 内部分辨率：

```js
// 1 个世界单位 = 1 个像素
const camera = new THREE.OrthographicCamera(-240, 240, 180, -180, -10, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(480, 360);
renderer.setPixelRatio(1);
```

最后把画布 B 通过 CSS 绝对定位叠在画布 A 上，或 `ctxA.drawImage(canvasB)`。

**优点**：改动最小、画风 100% 保留、窗帘可独立调试。
**备选**：未来若想连海面 / 玻璃也 3D 化，可整体迁移到单一 Three.js 场景。

## 3. 布料模拟（Verlet / Spring）

### 3.1 网格

```js
const cols = 12, rows = 30;
const geometry = new THREE.PlaneGeometry(width, height, cols, rows);
// 顶点数 = (cols + 1) * (rows + 1)
```

- 顶行固定（对应窗帘杆），其余顶点自由。
- `width / height` 取左窗帘 `104×228`、右窗帘 `104×228`（像素单位）。

### 3.2 Verlet 数据结构

沿用现有 JS 结构，改成与 `BufferGeometry.position` 同步：

```js
const count = (cols + 1) * (rows + 1);
const positions = new Float32Array(count * 3);
const prev = positions.slice();
const pinned = new Uint8Array(count); // 顶行 = 1
```

### 3.3 每帧积分

```js
for (let i = 0; i < count; i++) {
  if (pinned[i]) continue;
  const ix = i * 3, iy = ix + 1;
  const vx = (positions[ix] - prev[ix]) * damping;
  const vy = (positions[iy] - prev[iy]) * damping;
  prev[ix] = positions[ix];
  prev[iy] = positions[iy];
  positions[ix] += vx + windX(i) + mouseForceX(i);
  positions[iy] += vy + gravity + windY(i) + mouseForceY(i);
}
```

### 3.4 约束（弹簧 / PBD）

- 结构约束：水平、竖直相邻顶点。
- 剪切约束：两条对角线（形成小三角形，产生自然褶皱）。
- 迭代 3~4 次：

```js
const diff = (dist - rest) / dist;
if (!pinned[a]) { positions[a] += dx * diff * 0.5; ... }
if (!pinned[b]) { positions[b] -= dx * diff * 0.5; ... }
```

## 4. 高细分 PlaneGeometry 与自定义顶点着色器

### 4.1 每帧同步

```js
geometry.attributes.position.array.set(positions);
geometry.attributes.position.needsUpdate = true;
geometry.computeVertexNormals(); // 或 CPU 自算更平滑的法线
```

### 4.2 顶点着色器骨架

```glsl
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
uniform float uTime;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vec3 p = position;

  // 在着色器里叠加高频微摆动，增强“纱质”细节
  float micro = sin(p.y * 0.35 + uTime * 2.0) * 0.6;
  p.x += micro * (p.y / 288.0);

  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
```

### 4.3 法线重建

- 简单：`geometry.computeVertexNormals()`（几何法线）。
- 更好：CPU 用相邻顶点叉积求面法线再平滑，写入 `normal` attribute，
  让光照过渡更自然、没有明显三角面块。

## 5. 鼠标速度 → 风场

```js
// 每帧：把屏幕坐标映射到 480×360 场景坐标
const vx = clamp(mouse.x - mouse.prevX, -40, 40);
const vy = clamp(mouse.y - mouse.prevY, -40, 40);

// 高斯衰减的局部风场
function mouseWind(i) {
  const dx = positions[i*3] - mouse.x;
  const dy = positions[i*3+1] - mouse.y;
  const r2 = dx * dx + dy * dy;
  if (r2 > R * R) return 0;
  return Math.exp(-r2 / (2 * sigma * sigma)); // 再乘 vx / vy
}
```

- 速度越快，`vx / vy` 越大，作用力越强。
- 从左向右扫过：近处顶点先被带动，运动通过弹簧约束向周围“波纹式”传播。
- 可选：把风场做成“定向风”，鼠标移动方向即风向，并向后拖出尾迹。

## 6. 布料贴图 / 法线 / 光照

### 6.1 程序化蕾丝贴图

用 2D `<canvas>` 生成重复蕾丝花纹，做成 `CanvasTexture`：

```js
const tex = new THREE.CanvasTexture(laceCanvas);
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
tex.magFilter = THREE.NearestFilter;
tex.minFilter = THREE.NearestFilter;
```

- `map`（反照率）：奶油底色 + 蕾丝暗纹。
- `alphaMap`：镂空处透明，让后面海景透出。
- 材质设置 `transparent: true`，纱帘半透明。

### 6.2 法线贴图

- 程序化生成细小编织纹路法线贴图，或直接用几何法线。
- 用于纱帘的细碎高光，让布面更有“织物质感”。

### 6.3 像素化光照

```glsl
vec3 N = normalize(vNormal);
vec3 L = normalize(vec3(0.4, 0.6, 0.8)); // 可随昼夜/日月方向变化
float diff = max(dot(N, L), 0.0);
diff = floor(diff * 5.0) / 5.0;            // 色阶量化，保持像素感

vec3 V = normalize(-vViewPos);
vec3 R = reflect(-L, N);
float spec = pow(max(dot(R, V), 0.0), 12.0);
spec = floor(spec * 3.0) / 3.0;

vec3 col = baseColor * (ambient + diff * lightColor) + spec * specColor;
```

- 光照方向随真实时间 / 太阳月亮位置变化：白天偏暖、夜晚偏冷。
- 蕾丝镂空透光：`alphaMap` 透明处透出后面海景，叠加轻微“蕾丝投影”更像真实纱帘。

## 7. 与现有像素画风的整合

- Three.js 画布分辨率 = `480×360`，`renderer.setPixelRatio(1)`。
- 贴图全部 `NearestFilter`，关闭抗锯齿。
- 渲染结果与 2D 画布逐像素对齐，最终一起 `drawImage` 到显示画布，或 CSS 叠加。
- shader 里所有颜色做 `floor(c * N) / N` 色阶量化，避免 Three.js 默认的平滑渐变。

## 8. 性能与参数

- 顶点数控制在 500~900，约束迭代 3 次，CPU 压力很小。
- 每帧只更新 `position` / `normal`，不重建几何、不重建材质。
- 备选：把模拟迁到 GPU（ping-pong FBO 或 compute），可支持数千顶点。
- 关键参数：`damping`、`gravity`、`restLength`、`iterations`、`R`、`sigma`。

## 9. 更多创意点

| 创意 | 说明 | 难度 |
| --- | --- | --- |
| 蕾丝投影 | 阳光透过镂空在墙 / 窗台投下摇曳的蕾丝影子（伪 caustics） | 中 |
| 昼夜光照联动 | 太阳 / 月亮方向驱动高光与暖冷色调 | 低 |
| 拉开窗帘 | 双击或拖到边缘 → 窗帘向两侧收拢，露出更多海景 | 中 |
| 绒毛 / 灰尘粒子 | 快速扫过时飘落细小绒毛粒子 | 低 |
| 3D 海面 | 海面也用 Plane + 顶点波浪，闪光用 3D points | 高 |
| 猫尾巴扫到窗帘 | 猫尾巴与布料做简单碰撞 | 高 |
| 触摸支持 | 移动端 `touch` 事件映射为同样的风场 | 低 |
| 窗帘夹 / 打结 | 增加一个可拖拽的“窗帘夹”，改变布料形态 | 中 |
| 声音反馈 | 布料沙沙声（WebAudio 噪声包络） | 中 |

## 10. 实施步骤（里程碑）

1. **M0**：搭 Three.js 双画布骨架，正交相机对齐，渲染一块静态 Plane。
2. **M1**：接入 CPU Verlet，顶行固定，跑通重力 + 阻尼 + 约束。
3. **M2**：写顶点 / 片段着色器，接入位置与法线。
4. **M3**：鼠标速度风场 + 约束传播。
5. **M4**：程序化蕾丝贴图 / alphaMap + 法线 + 像素化光照。
6. **M5**：昼夜光照联动 + 参数调优 + 性能测试。

## 11. 风险与回退

- **风险**：Three.js 与 2D 画布坐标 / 缩放不一致 → 统一用 `480×360` 内部坐标 + 正交相机解决。
- **风险**：性能 → 控制顶点数、减少迭代、必要时迁 GPU。
- **风险**：画风变“3D 油滑” → 色阶量化 + `NearestFilter` + 关闭抗锯齿。
- **回退**：保留现有 2D 窗帘代码，用一个开关一键切换 2D / 3D。

## 12. 参考代码骨架（Three.js 主循环）

```js
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setSize(480, 360);
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-240, 240, 180, -180, -10, 10);
camera.position.z = 1;

const cloth = new THREE.Mesh(geometry, material);
scene.add(cloth);

function animate() {
  stepCloth(dt);                 // CPU Verlet + 鼠标风场
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

> 说明：本方案中 Three.js 主要承担“高细分几何 + 着色器光照 + 贴图”的渲染职责，
> 物理仍优先用现有 CPU Verlet（结构清晰、易调参），GPU 化可作为后续性能优化项。
