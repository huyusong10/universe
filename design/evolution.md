# Evolution Toward 100,000 Stars

Status: Active implementation

Date: 2026-05-01

## 目标

把当前观测台从“克制的 catalog 星图仪”演进为更接近 `100,000 Stars` 的电影化尺度旅行体验：更强的银心、星云、光学镜头感、中景桥接层和近景恒星活性。

这不是 1:1 复刻。当前项目要保留 Worker/WebGPU 架构、同一 catalog 连续 LOD 语义、固定预算和低 HUD 设计；借鉴的是美术动势和尺度感，不借用老项目的 DOM 标记堆叠、硬切层级或英文文案契约。

## 稳定不变量

| 不变量 | 约束 |
| --- | --- |
| Catalog 连续性 | 宏观亮点、中景目标、近景 active 恒星、标签和点击热区必须来自同一 catalog 索引。 |
| LOD 连续性 | 缩放时允许曝光、尺寸、光晕、参考层和标签权重变化；旧层必须先收缩点尺寸、halo、标签和拾取权重，再让新层接管主体；进入局部系统后，非 active 恒星必须从局部 metric space 退场，而不是继续作为近处星点存在。 |
| 视觉主次 | catalog 恒星承担主视觉；星云、尘带、lens flare、参考环和背景星尘只增强尺度与空气感。 |
| 交互主流程 | 拖拽、滚轮、点击聚焦和 idle orbit 仍是核心旅程，不能被面板、教程或常驻说明打断。 |
| 性能预算 | 美术增强必须保持固定同屏复杂度，不能引入每星 DOM、每星 mesh/material 或无界标签。 |
| 多语言与可访问性 | 不把具体说明文案、字体效果或语言内容写成稳定契约。 |

## 对照观察

`100,000 Stars` 的优势不只是静态画面，而是缩放时的多层响应：

| 尺度 | 对照项目的美术经验 | 当前项目差距 |
| --- | --- | --- |
| Galactic | 高亮银心、蓝紫星云、尘带、倾斜银河盘和强 bloom 共同建立远景冲击力。 | 结构清楚但偏安静，银心过白且旋臂/尘带偏软，缺少镜头曝光和色散变化。 |
| Regional | 近邻星有强 halo、距离线、命名注记和 Oort Cloud 等桥接元素，帮助用户理解尺度变化。 | `Galactic` 辅助层退场后，需要明确的 `LocalMap -> LocalSystem` 桥，而不是黑底地图和文字。 |
| Local | 近景恒星有本地系统层、表面纹理、corona、flare、lens flare 和持续扰动。 | 当前阶段把 Local 拆成星图入口、本地系统和表面三段；后续仍需要更丰富的 flare、磁场线和遮挡。 |
| Motion | 相机缩放、FOV、点尺寸、曝光、蓝移和层级淡入淡出共同制造“旅行感”。 | 当前主要是相机 scale 缓动与慢 orbit，光学响应较少。 |

## 当前阶段

当前开发阶段聚焦最大的 gap：`LOD Visibility And Continuity`。验收标准是滚轮缩放完成 `Galactic -> Regional -> LocalMap -> LocalSystem -> Surface` 的连续尺度旅行，并像 `100,000 Stars` 一样以 Sol 作为默认焦点；滚轮必须即时改变目标距离，真实相机快速追随目标距离，不能直接跳帧也不能拖得迟钝。点击 catalog 恒星后，切换焦点并用同一套世界中心化和缩放动画快速到达该目标的近景尺度。点击落点不是缩放硬终点，焦点建立后滚轮仍可继续向内推进。焦点恒星必须是绑定 catalog 目标的唯一 active sphere，而不是独立 2D 圆盘或贴图假体；canvas 可提供随 active sphere 半径和 presence 耦合的表面可见辅助层，但不能拥有独立实体、拾取或尺度语义。该 sphere 是绑定 catalog 目标的 local-domain 表面模型，不是 catalog map 单位里的巨大固定半径球。尺度栏表达语义阶段进度，不直接暴露 raw distance；LOD 过渡由 layer optical mixer 管理，旧层点径、halo、标签和拾取权重退场后，新层才成为主体。debug 中的 radius/presence 不能替代真实画面：close sphere 必须实际出现实体球体轮廓、非均匀自发光表面和边缘 emission。进入 `LocalSystem` 后，非 active 恒星必须退出局部 metric space，转为极远天球背景或淡出；`Surface` 才允许 active sphere 成为画面主体。

## 演进方向

### Galactic

- 提升银心和旋臂的层次：让 catalog 密度、色温和亮度形成主结构，辅助 veil 只做低频光学增强。
- 增强尘带：从均匀暗线改为随旋臂、视角和 zoom 连续变化的遮蔽/吸收层。
- 引入尺度相关曝光：远景允许更强 bloom、软焦、色散和边缘暗角；进入中景时逐步收束。
- 进入 Regional 前，大尺度星点应先收缩 point size 和 halo，再降低 opacity，避免新旧尺度同时成为主体。
- 保持宏观标签克制：只标注高权重 catalog 目标和必要区域锚点。

### Regional

- 新增桥接视觉层：命名星 halo、弱距离线、局部参考弧、稀疏坐标提示和 active 周边邻域。
- 让银河背景慢退而不是突然消失：中景仍能看到远处结构残影，避免黑场。
- 标签按语义稳定重权：active/hover、命名星、近邻和高亮目标优先；拖动与缩放中只更新位置和透明度。
- 进入 LocalMap 前，Regional 星点、halo、标签和拾取权重应同步退场，active halo 保留为焦点锚点。
- 点击聚焦时让目标光晕、标签、背景 dim 和相机 scale 同步变化，形成明确的飞抵感。

### Local

- 把近景拆成 `LocalMap`、`LocalSystem` 和 `Surface`：默认焦点是 Sol；点击目标后切换焦点，让世界中心化、相机距离、active billboard、远景天球、local system shell 和 active sphere 沿同一路径发生；Local 入口只能看到星点或很小的 surface preview，继续向内滚轮或点击飞抵后才逐步显出表面。
- 把近景恒星从塑料感光照升级为真实球体上的自发光动态表面：低频等离子纹理、稳定自转、颗粒、活动亮区、暗斑、边缘 emission、corona shell 和少量 flare。
- 近景不再保留近处星图上下文：非 active 恒星退出局部 metric space，只能作为极远天球背景或消失；尺度环、系统 shell、赤道/倾角参考和辅助弧承担局部空间感。
- 根据 catalog 色温和亮度驱动恒星颜色、光晕范围、表面活性和 lens flare 强度。
- 只允许当前 active 目标使用高成本近景表现，其他恒星继续使用 impostor 或点层。

## 分阶段计划

| 阶段 | 目标 | 完成信号 |
| --- | --- | --- |
| 0. Baseline | 初始化 git 并记录当前稳定契约。 | 当前代码有 baseline commit；`design/README.md` 存在。 |
| 1. Capture | 建立 LOD 视觉检查基线。 | 能固定种子抓取 Galactic、Regional、LocalMap、LocalSystem、Surface、飞抵过程和 zoom-out 画面；截图或视频不依赖人工临时操作。 |
| 2. Optical Response | 为缩放加入曝光、点尺寸、halo、soft focus 和色散响应。 | 静态三段 LOD 与滚轮过程都能读出尺度变化，且没有星群替换断层。 |
| 3. Regional Bridge | 补足中景桥接层。 | Regional 不再像空黑地图；active 周边、距离感和远景残影同时可读。 |
| 4. True Active Star | 建立 WebGPU active sphere 底座，再在其上升级表面、corona、flare 和接近连续性。 | Local 边界不硬切表面；默认滚轮沿 Sol 连续进入；点击目标后从同一 catalog 位置连续进入真实球体近景，且还能继续缩放。 |
| 4.5. Stellar Material And Reference | 把 active sphere 材质改为自发光恒星材质，并建立 Local 参照系。 | close sphere 能读出非均匀表面、自转相位、边缘 emission 和低亮 reference frame；active label 不压住球心。 |
| 4.6. LOD Visibility And Continuity | 修正 debug 状态与实际画面的可见性错位，并重建 LocalMap 到 Surface 的连续桥。 | `Regional-entry` 已有 bridge，`Local-map-entry` 不黑场，`Local-system` 中非 active 恒星退出 metric space 并转为远景天球，`Sphere-close` 实际画面出现 active sphere 主体；active sphere 半径经过中间阶段且不短距离爆发；zoom-out 时 sphere/reference 退场且 active 身份保持。 |
| 4.7. Semantic Scale And Layer Mixer | 修正尺度轴虚位，并让每个 LOD 层以点径、halo、标签和拾取权重退场。 | 尺度栏按语义阶段推进；滚轮过渡中旧层先缩小/退远，新层再成为主体；debug 暴露 layer presence、point scale、label weight 和 pick weight。 |
| 5. Label And Scale UX | 调整标签和尺度轴的权重、出现时机和动态稳定性。 | 标签不洗牌、不压过星体；尺度状态可读但不抢画面。 |
| 6. Verification | 把高风险历史坑沉淀为测试或脚本。 | 有自动化入口验证 LOD 状态、预算边界、启动能力拦截和核心交互。 |

## 验证策略

| 验证类型 | 覆盖内容 |
| --- | --- |
| 固定种子视觉截图 | Galactic、Regional-entry、Regional-mid、Local-map-entry、Local-system、Sphere-emerge、Sphere-close、Local-reference、点击飞抵、焦点继续深缩放、Zoom-out 返航。 |
| 动态录制或帧采样 | 缩放过程是否连续，曝光、标签、semantic scale axis、layer mixer、camera FOV、active sphere 半径和 sphere 接管是否跳变。 |
| Debug 状态检查 | LOD、scale stage、scale axis progress、layer presence、point scale、label/pick weight、catalog、draw、labels、fps、celestial backdrop presence 和 active 目标是否在预算内。 |
| 性能预算 | 标准 catalog 与压测 catalog 都不能线性增加标签、拾取或主线程工作。 |
| 无障碍/多语言检查 | 状态语义、交互入口和测试锚点不依赖固定展示文案。 |

## 非目标

- 不把 `100,000 Stars` 的 DOM 标签、旧 Three.js 对象结构或硬切阈值照搬为架构。
- 不新增大面积教程、常驻详情卡或营销式落地页。
- 不把具体英文/中文文案、CSS 类名、DOM 层级或 shader 内部变量写成契约。
- 不为了远景电影感牺牲 catalog 可导航性。
