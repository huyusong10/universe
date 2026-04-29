# Universe OS Template Library

本目录是一套全新的 `Universe OS` 前台原型库，目标不是传统 sitemap 式页面集合，而是把 v2 文档里的核心宇宙场景拆成可直接评审的模板。

设计基线来自：

- [knowledge_universe_v2_portal_os.md](/Users/hys/dev/Sediment/design/evolution/knowledge_universe_v2_portal_os.md)
- [PLAN.md](/Users/hys/dev/Sediment/design/PLAN.md)
- [web-surfaces.md](/Users/hys/dev/Sediment/design/current/web-surfaces.md)

它复用了当前 `design/image` 已验证过的技术路线，但重新组织成更完整的产品壳层。

## 核心原则

- 统一的是 `WebGPU observatory runtime`、HUD 语言、叠层语法和天体语法，不是“每页都背一颗大恒星”。
- 页面覆盖的是同一前台系统的不同状态，而不是不同视觉壳。
- 视觉目标是“静谧、古老、文明尺度感”的知识宇宙，而不是企业控制台换星空皮肤。
- 默认桌面优先；不把窄屏当正式交付形态。
- 主模板先严格对应 v2 文档中的九个大场景；其他页面只作为参考预设与视觉语法板。
- 主要界面面板默认应支持收缩，让场景本体重新获得可见面积。

## 关键文件

| 文件 | 说明 |
| --- | --- |
| `assets/observatory-stage.js` | 共享 WebGPU 场景运行时，包含多种 scene family 与统一的 observatory 光学语言 |
| `assets/observatory-ui.css` | 共享 UI 骨架、HUD、面板、卡片、状态与桌面式布局语法 |
| `assets/academy-stage-shell.js` | Academy 面板的共享运行时 glue code |
| `assets/academy-star/` | 近景主星所需的表面与 palette 纹理 |
| `assets/scale-observatory-runtime.js` | `13-scale-observatory` 的主线程 HUD、输入、尺度轴与 Worker 通讯 |
| `assets/scale-observatory-worker.js` | `13-scale-observatory` 的 Dedicated Worker + OffscreenCanvas + three/webgpu 多尺度渲染器 |
| `assets/luminous-stellar-atlas-runtime.js` | `14-luminous-stellar-atlas` 的主线程输入、尺度轴与 Worker 通讯 |
| `assets/luminous-stellar-atlas-worker.js` | `14-luminous-stellar-atlas` 的 Dedicated Worker + OffscreenCanvas + three/webgpu 发光星图渲染器 |
| `assets/galactic-star-map-runtime.js` | `15-galactic-star-map` 的主线程 canvas、输入、极简尺度轴与 loading/debug 状态 glue code |
| `assets/galactic-star-map-worker.js` | `15-galactic-star-map` 的 Dedicated Worker + OffscreenCanvas + WebGPU 星图渲染器，catalog、LOD、拾取和标签均在 worker 内完成 |

## 九个核心场景模板

| 文件 | v2 场景 | 作用 |
| --- | --- | --- |
| `01-arrival.html` | `intro / arrival` | 首次访问时的史诗抵达、诗性文案与稳定知识体亮相 |
| `02-roaming.html` | `roaming` | 回访默认态，低干扰漫游壳层 |
| `03-survey.html` | `survey / searching` | 战略俯瞰搜索与导航态 |
| `04-entry-focus.html` | `focused` | 飞抵节点后的 `Spatial Card` 阅读态 |
| `06-seed-dock.html` | `submitting` | 宇宙内提交与种子投放 |
| `07-academy.html` | `overlay_open / academy` | 人类使用者的 Academy 面板，含 MCP / Skill 指引 |
| `08-system-overlay.html` | `overlay_open / system` | 语言、声音、motion、budget、快捷键、帮助 |
| `09-cruise.html` | `clear / cruising` | 清屏后的巡游与低 HUD 导览态 |
| `11-unsupported.html` | `unsupported` | 缺失 WebGPU 主干能力时的明确拦截页 |

## 参考模板

这些页面不是 v2 文档中的一级主场景，而是帮助我们理解同一宇宙壳的附加预设与语法板：

| 文件 | 类型 | 作用 |
| --- | --- | --- |
| `index.html` | 总览 | 展示整套模板结构与主次关系 |
| `05-sector-atlas.html` | graph-view preset | `/portal/graph-view` 的沉浸漫游预设 |
| `10-celestial-atlas.html` | celestial grammar board | 五类公开天体骨架与视觉图例 |
| `12-signal-log.html` | signal language board | 事件流、回执、巡游状态、能力提示的 UI 语言 |
| `13-scale-observatory.html` | scale rig board | Dedicated Worker 多尺度恒星导航样板，验证沉浸式星图、渐进加载、GPU 内稳定标签、万级默认可导航恒星目录、目标聚焦与近景恒星 shader |
| `14-luminous-stellar-atlas.html` | luminous atlas board | `13` 的保留式新版本，强化背景星海与真实可导航恒星之间的亮度、拾取和叙事层级 |
| `15-galactic-star-map.html` | galactic star map board | 重新打底的 100,000 Stars 风格可缩放银河星图观测台，以同一套 catalog 恒星驱动宏观银河、亮点、halo、标签和拾取 |

## 场景家族

共享 runtime 目前按这些 scene family 组织：

- `hero star`
  - 用于 arrival、entry focus、academy 等需要近景主焦点的页面
- `peripheral star`
  - 用于 roaming，主星退到构图边缘，强调天空地图感
- `deep field`
  - 用于 survey、signal log、system 类页面，让背景读成结构星海而非单一主星
- `formation cloud`
  - 用于 seed dock，表达“知识种子尚未定型”
- `taxonomy / multi-body`
  - 用于 celestial atlas，表达五类天体的骨架差异
- `catalog field`
  - 用于 index 与 sector atlas，表现目录感、区域感、航路感

`/portal/graph-view` 在 v2 文档里属于“同一壳的沉浸漫游预设”，不是另一套前台架构。

## 天体设计语法

前台公开只承认五类宇宙语义：

1. 稳定知识：成熟恒星
2. 形成中知识：原恒星 / 吸积体
3. 问题星座：异常信号簇
4. 知识盆地：引力井 / 暗星云区
5. 导航结构：远古几何导航体

`10-celestial-atlas.html` 是这套语法的集中展示页。

## 技术路线

- `three/webgpu`
- `three/tsl`
- 共享 observatory stage
- 静态 buffer + 少量 hero optical sprites / quads
- 克制 bloom
- 共享 collapsible panel 机制
- 预设化场景，而不是页面各自持有一套渲染器
- `13-scale-observatory` 已作为专用性能样板接入 `Dedicated Worker + OffscreenCanvas`，主线程只保留输入、尺度轴和低频状态同步；宏观尺度使用 GPU 点层与生成式 catalog，高精恒星 shader 只分配给当前选中目标，低干扰标签在 worker/WebGPU 场景内渲染，拾取只处理当前星图 LOD 的有限候选池
- `13-scale-observatory` 默认是无界沉浸式星图，不显示顶部命令栏、底部目标导航、常驻详情卡或卡片式尺度控件；目标详情只在 Approach / Surface 等近景观测尺度以光学读数层出现
- `13-scale-observatory` 的场景标签不是装饰层：默认只标注主目标、选中目标、悬停目标和少量高评分 catalog；标签必须保持地图标注感、正常大小写、无发光招牌、无下划线、无胶囊背景，并且 hover 不应触发全局标签洗牌
- `13-scale-observatory` 默认从最高视野层级进入，交互语义是可缩放星图观测台；拖拽用于 orbit/pan 星图，滚轮用于跨尺度缩放，点击恒星后飞向该目标所在的推荐 LOD
- `13-scale-observatory` 默认 `standard` 预算固定为 10000 颗可导航恒星，`safe` 为 6000，`immersive` 为 20000；`?catalog=` 可用于压测更大目录，但不得让 DOM、mesh 或标签数量线性爆炸
- `13-scale-observatory` 的初始化必须渐进可见：先显示低干扰 loading overlay，再尽快给出基础星空首帧，随后后台补齐 catalog、星云、近景表面与光学层；页面不应长时间黑屏等待完整增强层
- `13-scale-observatory` 以 UHD770 等级核心显卡为默认性能基线；当帧时间持续超标时，可以降低 PSF、星云、标签数量、背景强度或 DPR 上限，但不能降低核心 catalog 可导航性
- `14-luminous-stellar-atlas` 保留 `13` 的 Worker/WebGPU 架构，但把视觉语义进一步拆成背景 deep field、可导航 catalog 恒星、featured/active 恒星三层；背景可以浩瀚密集，但真实恒星必须通过更高亮度、presence 光晕、稳定小标注和更大拾取热区与背景星尘区分
- `14-luminous-stellar-atlas` 的宏观亮点必须优先来自真实 catalog / featured / active 恒星；不得用独立装饰点云、装饰亮星或彩色雾团冒充可导航重点，避免缩放时出现“亮点消失后再换一批真实恒星”的断层
- `14-luminous-stellar-atlas` 默认不是平均铺满星点的平面图，而是带有导演感的可缩放星图：Deep Field 需要由真实 catalog 密度形成高密度银河核心、疏密变化和轻微自动 orbit，Cluster 需要出现低干扰天球坐标参考与更多可读标注，Approach / Surface 则逐步压低背景并突出当前恒星
- `14-luminous-stellar-atlas` 默认仍以万级 catalog 和固定同屏复杂度为性能边界；新增的真实恒星 presence layer 必须是单个 GPU 批处理层，不允许变成每颗星独立 DOM、mesh 或材质
- `15-galactic-star-map` 不继承 `13` / `14` 的近景表面和补丁式 presence 结构；它以同一套 typed-array catalog 作为银河本体，宏观密度核心、旋臂、星团、外围锚点、halo、标签与拾取都从 catalog 索引派生
- `15-galactic-star-map` 的 worker 使用原生 WebGPU instanced quad impostor 绘制 catalog 恒星，每颗可见恒星只是一条 instance 数据；不创建 DOM 星体，不为每颗恒星创建独立 mesh/material，也不使用装饰亮星冒充真实目标
- `15-galactic-star-map` 允许低亮 deep-field 星尘和低对比坐标参考，但这些层只提供空间空气感；默认第一屏的主要亮度、银河核心和可点击目标必须来自 catalog 恒星本体
- `15-galactic-star-map` 默认 catalog 预算为 `safe=6000`、`standard=10000`、`immersive=20000`，`?catalog=` 最高可压测 50000；同屏可见恒星、标签池、拾取候选和 GPU buffer 预算固定，不随 catalog 总量线性扩大
- `15-galactic-star-map` 的 LOD 为 `Galactic / Regional / Local` 三段连续混合；同一颗 catalog 恒星跨尺度只改变 `size / alpha / halo / labelWeight / pickWeight`，不得出现宏观亮点整批消失后再换一批中景恒星的断层

### `13-scale-observatory` / `14-luminous-stellar-atlas` 稳定契约

| 能力 | 契约 |
| --- | --- |
| 首屏 | 无 query 参数时进入最高视野层级，并随机选择一个主目标作为当前焦点；`?target=` 可以覆盖随机焦点 |
| 加载 | `bootProgress -> firstFrameReady -> ready` 是加载状态的稳定消息顺序；loading overlay 只由这些状态驱动，不靠定时器猜测 |
| 星体目录 | 默认可导航 catalog 为万级，按天空方向均匀分布；每个 LOD 只显示该尺度需要的子集，普通 catalog 可点击聚焦但默认不进入底部固定列表 |
| 详情层 | Deep / Cluster 默认隐藏左侧详情，Approach / Surface 自动显示当前目标解说；详情必须是无框光学读数层，不使用卡片边框、统计格子或玻璃底板；运行时调试信息只在显式 debug 模式显示 |
| 标签 | 标签属于渲染场景，不属于 DOM 装饰；Deep、Cluster、Approach、Surface 各自有固定标签预算，必须保持清晰、低开销和地图标注感；标签是辅助命名而不是主视觉，交互期间只更新位置与透明度，不应因轻微拖动、缩放或 hover 造成全局重排，也不应呈现霓虹招牌感 |
| 拾取 | 拾取只检查当前 LOD 可见集、当前 sector 候选和主目标，不遍历纯视觉星海，也不为每颗星创建独立对象 |
| 相机 | 相机模式为可缩放星图观测台，而不是第一人称宇宙漫游；拖拽方向应与星图被用户拖动的直觉一致，垂直方向使用连续 orbit，不应撞到硬边界、极点翻转或突然回弹；点击目标后平滑迁移地图中心和尺度 |
| 近景 | 任何时刻只有当前选中恒星启用高精 surface shader；其他恒星必须保持 GPU impostor 或点层表现 |
| 发光星图 | `14` 中背景星海是低优先级空间氛围，catalog 与 featured 恒星是可导航实体；真实恒星本体承担主要可见性与可点击性，不能依赖放大标签来区分，也不能被背景星点淹没 |
| 宏观核心 | `14` 的宏观核心必须由真实 catalog 恒星的密度、色温和亮度形成；最显眼的光学 halo、PSF 与标签必须绑定到真实恒星，不使用独立装饰核心或装饰亮星 |
| 动感与尺度 | `14` 的宏观尺度应有轻微自运动和中心-边缘疏密差异，避免静态、均匀、平铺直叙；中尺度可使用低成本天球坐标参考帮助用户理解星图空间，但不得出现方形地板网格或压过恒星本体 |

### `15-galactic-star-map` 稳定契约

| 能力 | 契约 |
| --- | --- |
| 首屏 | 无 query 参数时进入 `Galactic`，画面中心应呈现由 catalog 恒星密度、色温和亮度形成的银河核心，外围有旋臂、星团、暗洞和稀疏锚点；默认自动缓慢 orbit |
| Catalog | 默认 `standard=10000` 可导航恒星，`safe=6000`，`immersive=20000`；`?catalog=50000` 只增加全量目录，不允许增加 DOM 星体、每星 mesh/material 或无界标签数量 |
| 渲染 | catalog 恒星使用单个 WebGPU instanced impostor 管线绘制 core、soft halo、色温、亮度和拾取权重；显眼亮点、halo、标签和可点击目标必须来自同一 catalog 索引 |
| 背景 | deep-field 星尘、暗尘带和坐标参考只能低亮辅助空间层次，不能成为主视觉重点，也不能在缩放时替代 catalog 恒星 |
| LOD | `Galactic / Regional / Local` 连续混合；同一颗 catalog 恒星跨尺度只改变 size、alpha、halo、labelWeight 和 pickWeight，不硬切星群 |
| 标签 | 标签在 worker 内通过固定 label 池绘制；active/hover 必显，Galactic 约 8-16 个，Regional 约 24-60 个，Local 显示 active 和少量近邻；拖拽、滚轮、飞行期间不全局洗牌 |
| 拾取 | 拾取只检查当前可见 catalog 候选和标签矩形；点击热区包含 halo、标签 rect 和屏幕空间最小半径 |
| 相机 | 拖拽为连续 orbit，方向符合星图拖动直觉，释放后保留惯性并衰减；滚轮连续缩放，点击目标后平滑迁移焦点和推荐尺度，缩放时鼠标位置提供弱锚点 |
| UI | 主线程只显示 canvas、极简尺度轴、loading 状态和显式 `?debug=1` 调试行；默认无顶部标题栏、底部导航栏、左侧详情卡或大面积 HUD |
| 性能 | UHD770 等级核显作为默认基线；降级只能减少同屏预算、标签数量、坐标参考或背景星尘，不得牺牲 catalog 可导航性和同一批恒星连续 LOD 语义 |

这套原型仍然是静态模板层；除 `13-scale-observatory` 和 `15-galactic-star-map` 外，大多数页面还没有接入正式前台的 `Dedicated Worker + OffscreenCanvas` 运行时，但视觉和交互组织已经按那条技术路线设计。

如果后续继续推进正式实现，优先级应当是：

1. 先验证九个核心场景之间的状态切换是否成立
2. 再把 graph-view、signal language、celestial grammar 当作补充预设接回统一壳层

## 如何查看

建议通过本地静态服务器打开：

```bash
cd /Users/hys/dev/Sediment
python3 -m http.server 8123
```

然后访问：

- [http://127.0.0.1:8123/design/universeos-template/index.html](http://127.0.0.1:8123/design/universeos-template/index.html)

若只评审尺度观测模板，也可以直接在模板目录启动：

```bash
cd /Users/hys/dev/Sediment/design/universeos-template
python3 -m http.server 9000
```

然后访问：

- [http://127.0.0.1:9000/13-scale-observatory.html](http://127.0.0.1:9000/13-scale-observatory.html)
- [http://127.0.0.1:9000/14-luminous-stellar-atlas.html](http://127.0.0.1:9000/14-luminous-stellar-atlas.html)
- [http://127.0.0.1:9000/15-galactic-star-map.html](http://127.0.0.1:9000/15-galactic-star-map.html)
