# 观测台持续演进

更新：2026-10-10。Goal 已恢复激活，长期演进没有既定终点。

## 当前重点

用户重点是所有天体的两档 LOD、更精细近景、更多天体和浩瀚空间。成批完成相关实现后集中验证完整路径；未改边界复用已有证据。内置浏览器因反复挂起已停止重试，当前使用实际 Apple Metal WebGPU 的自动化录像与截图审阅。

第 162 轮把当前位置、途中目的地及停止/继续、全局探索和返回组织到共同观察栏；资料收起时仍能认出正在观察的天体。短屏长名称可阅读正文与来源，短提示消失不改变构图；第 161 轮的名称定位、触屏查看及返回筛选保留。主体材质和空间布局本批未改，整体一体感仍未解决。下一批回到场景主次和星系的远近结构，先诊断明确形态收益，不围绕观察栏继续微调。

## 已完成成果

| 范围 | 用户现在能够做什么 | 证据入口 |
| --- | --- | --- |
| 1–144 连续探索与各类天体 | 从星图发现真实目标，连续接近、进入局部或内部区域、环视、比较家族、暂停、会话回访、保存双语 PNG 并返回；河外星系、银河厚度与共享前景已逐批演进。 | [既有详表与证据](../artifacts/evolution/2026-10-10/round-154/after/design/progress.md) |
| 145 镜头内发现与统一注记 | 在当前镜头内寻找真实命名目标，查看视野外方向，组合名称、类别和银河归属后选择抵达；列表变化保留焦点，窄屏覆盖目标仍可访问，短屏退出恢复工具。 | [桌面对照](../artifacts/evolution/2026-10-10/round-145/discovery-desktop.jpg)、[窄屏](../artifacts/evolution/2026-10-10/round-145/discovery-narrow.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-145/verification.json) |
| 146 星系与星云的共同照明 | 沿有光暗方向的云岸接近、环视、退回全貌；真实身份、原气尘密度与光点前景遮挡保持一致，三档画质、暂停、窄屏保存和返航完整。 | [星系前后](../artifacts/evolution/2026-10-10/round-146/before-after-galaxy-light.jpg)、[星云前后](../artifacts/evolution/2026-10-10/round-146/before-after-nebula-light.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-146/verification.json) |
| 147 保留云岸的星云执行优化 | 保留同一云岸、光点与连续进入/退离，三档画质和暂停照常使用；两处实际星云近景的中位 GPU 成本降低，未支持稳定收益的星系候选已撤回。 | [最终画面对照](../artifacts/evolution/2026-10-10/round-147/final-same-view.jpg)、[计时与取舍](../artifacts/evolution/2026-10-10/round-147/performance-summary.json)、[统一证据](../artifacts/evolution/2026-10-10/round-147/verification.json) |
| 148 星系区域定位与有参照的抵达 | 在全貌中指向或键盘聚焦区域入口，先看见对应位置再进入；棒旋星系入口落到实际结构，薄盘与尘环保留周围参照，连续切换、恢复全貌与返航完整。 | [入口前后](../artifacts/evolution/2026-10-10/round-148/before-after-regions.jpg)、[鼠标与键盘定位](../artifacts/evolution/2026-10-10/round-148/locators-review.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-148/verification.json) |
| 149 可扫描与可返回的探索导航 | 用已有事实比较目标，连续滚动时搜索和退出仍可达；一键回到当前筛选，保留查询、结果、选择与镜头；短屏和窗口变化后的键盘选择完整。 | [桌面对照](../artifacts/evolution/2026-10-10/round-149/before-after-desktop.jpg)、[窄屏列表末尾](../artifacts/evolution/2026-10-10/round-149/before-after-list-end.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-149/verification.json) |
| 150 更完整的云岸采样与星云首次进入 | 沿同一云岸靠近和环视，鹰状、马头和船底座首次操作可真正进入云体，再退回同一天体的全貌；既有身份、来源、光点和最近距离保留。 | [近景对照](../artifacts/evolution/2026-10-10/round-150/before-after-nebula-near.jpg)、[受影响入口](../artifacts/evolution/2026-10-10/round-150/first-entry-review.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-150/verification.json) |
| 152 贯穿探索的天体名称 | 用当前语言从画面认出资料中的同一天体，点选家族或河外标注抵达，再返回和保存；目录身份、搜索别名与程序背景披露保留。 | [全类别与双语](../artifacts/evolution/2026-10-10/round-152/journey-review-2.jpg)、[窄屏与家族](../artifacts/evolution/2026-10-10/round-152/journey-review-5.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-152/verification.json) |
| 153 明暗环境中的可读界面 | 在明亮云顶、岩面、星云与暗背景中辨认位置和反馈，阅读资料、操作尺度、切换目标、保存并返回；界面衬底不改变天体照明或镜头。 | [原版与最终顶部](../artifacts/evolution/2026-10-10/round-153/header-before-after.jpg)、[双语窄屏](../artifacts/evolution/2026-10-10/round-153/narrow-review.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-153/verification.json) |
| 154 目标链接与导航的统一取景 | 从目标链接进入总览后，连续接近同一推荐视角；辨认木星明面、木卫一与母星、星系盘面，继续近观、环视、保存和返航。 | [入口前后](../artifacts/evolution/2026-10-10/round-154/before-after-entry.jpg)、[连续过程](../artifacts/evolution/2026-10-10/round-154/continuous-review-4.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-154/verification.json) |
| 155 脉冲星本体、扫束与风区 | 分辨磁极亮区、转动扫束与独立喷流，连续接近同一核心、暂停环视、比较四种风区、保存并返回。 | [整体前后](../artifacts/evolution/2026-10-10/round-155/final-before-after-extended.jpg)、[近景与限制](../artifacts/evolution/2026-10-10/round-155/final-before-after-near.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-155/verification.json) |
| 156 可读且归属清楚的保存图 | 分清科学资料、主体与邻体底图/形状；保留作者及许可，窄屏滚动阅读、下载并回到原观察位置。 | [排版与素材归属](../artifacts/evolution/2026-10-10/round-156/poster-review-1.jpg)、[窄屏预览](../artifacts/evolution/2026-10-10/round-156/review-gh-en-retry/narrow-preview-bottom.png)、[统一证据](../artifacts/evolution/2026-10-10/round-156/verification.json) |
| 157 远景光色与背景层级 | 远处星系渐进显露细节，背景亮点不抢占近景主体；从最大视野进入星区或星系、环视、观察局部、保存并返回。 | [总览对照](../artifacts/evolution/2026-10-10/round-157/before-after-outer80-orbit.jpg)、[内部全景对照](../artifacts/evolution/2026-10-10/round-157/before-after-inside4.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-157/verification.json) |
| 158 整组星系的星光与气体主次 | 在 26 个星系中分辨连续星光、有限恒星、暗尘与局部气体；保留各自形态和强风，进入局部、恢复全貌、保存并返航。 | [旋臂前后](../artifacts/evolution/2026-10-10/round-158/before-after-1.jpg)、[环与风区前后](../artifacts/evolution/2026-10-10/round-158/before-after-2.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-158/verification.json) |
| 159 共同观察台与独立观察空间 | 在同一区域操作五阶段尺度、连续缩放、镜头和保存；收起或恢复资料后继续观察，短窄屏仍可辨认主体、滚动资料并返回。 | [桌面对照](../artifacts/evolution/2026-10-10/round-159/before-after-2.jpg)、[窄屏对照](../artifacts/evolution/2026-10-10/round-159/before-after-3.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-159/verification.json) |
| 160 紧致核心与发光层交界 | 从扫束或吸积盘连续靠近同一本体，环视时辨认前景发光与暗影；三档画质、双语窄屏、保存与返回完整。 | [脉冲星轮廓对照](../artifacts/evolution/2026-10-10/round-160/edge-0.jpg)、[黑洞交界对照](../artifacts/evolution/2026-10-10/round-160/edge-4.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-160/verification.json) |
| 161 名称与场景之间的定位 | 指向或键盘聚焦真实命名结果，先看清同一天体的位置；触屏展开星图、环视后再前往，或返回原筛选、滚动与焦点。导航打开时工具不遮挡结果。 | [列表到场景](../artifacts/evolution/2026-10-10/round-161/gq-journey-1.jpg)、[双语触屏](../artifacts/evolution/2026-10-10/round-161/gq-touch-1.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-161/verification.json) |
| 162 当前位置、飞行与全局操作的共同秩序 | 资料收起时仍辨认当前天体与不同目的地，停止/继续就近操作；短屏读长名称、正文和来源，再回到同一镜头。 | [界面前后](../artifacts/evolution/2026-10-10/round-162/before-after.jpg)、[短屏阅读与定位](../artifacts/evolution/2026-10-10/round-162/final-touch-3.jpg)、[统一证据](../artifacts/evolution/2026-10-10/round-162/verification.json) |

## 当前证据与限制

- 20261010gu：两个应用文件有语义变化，整合观察位置、导航、暂时反馈和程序背景/示意布局披露；其余 37 个应用文件只更新缓存版本。目录、材质、相机模型、来源、GPU 资源与绘制预算保持，界面排除区适应新的共同观察栏。较完整的阅读区会影响允许的构图，不以该变化冒充材质提升。
- 最终 157 项快检通过。实际非回退 Apple Metal3 WebGPU 集中完成双语停止、继续、换目标、画质、保存、返回、两档触屏窗口、定位与阅读：最终同一应用版本的 38 张截图、一张真实英文 PNG 已审阅。56 个四分之一秒连续画面中，50 个覆盖选择/停止/继续、月球退离、仙女座穿越/接近/抵达/返航，6 个为之后显式减少动态的中文重载，不是场景黑屏；非逐渲染帧验收。静态身份审计保留全部既有 ID 和测试入口。
- 原候选的顶部背景带过重，已压缩；英文短屏长名称曾挤掉资料正文，视觉审阅发现后修复，补入已有反馈旅程，验证来源确实绘在阅读区内、可直接操作，滚动不改镜头，仍保留独立观察空间。部分初始脚本误用入口或假设同一目标停止后有继续按钮，另一次既有测试的主标题选择器匹配了多个段标题；均保留失败证据，修正证据入口，未改变导航契约。
- 短屏的非关键短提示可折行截断，完整内容仍通过可访问状态提供；当前主体、不同目的地和停止/继续保持完整。某些短横屏目标确实落在底部工具后方，定位如实提示，可自行环视。脉冲星本体仍偏光滑、黑洞物质与星系近景仍偏柔，整体场景连贯性仍不足。本批未新增天体、持久数据、付费服务或发布；内置浏览器不重试。

## 少量候选

| 方向 | 判断 |
| --- | --- |
| 观察界面的共同秩序 | 顶部与底部工具已成组，定位、阅读和返回已连通；后续由新的旅程断点推动，不继续局部微调。 |
| 整体场景的主次与连贯性（下一批走查） | 名称与场景的联系已补齐，星系与背景的体积、清晰度及光色仍缺少整体收益；下一次材质批次须获得明确形态改善，避免反复调亮度和噪声。 |
| 云体形态与近处可观察范围 | 云体仍偏柔；参照观测与现有披露评估方法，尘柱不能成为光滑实体，有限射线不得产生共同条带。有明显形态收益后再评估近观范围。 |
| 河外目标之间的空间关系 | 通过已有真实关联引导连续探索，不能把随机背景提升为真实目标。 |
| 探索记录 | 会话回访可用；持久记录涉及用户数据，准备边界后征询。 |

## 接续与回退

不提交、推送或公开发布，保留用户修改及删除的 `assets/stellar-02/star_colorshift.png`。第 134 轮保留 60 份原版、61 份最终态；第 135–141 轮各保留 61 份前后版本；第 142 轮保留 61 份原版、62 份最终态（新增共享体积纹理边界测试），第 143–162 轮各保留 62 份前后版本，均保留可反向恢复并校验哈希的增量。第 151 轮只有评审结论与进度变化留在最终态，被拒绝的应用候选另保留增量；第 155 轮被拒绝的较强表面候选同样保留增量与评审。未改材质复用既有快照，主要连续录像、前后对照、关键帧与失败报告保留；已审阅拆帧清理。历史详表继续引用既有快照，阶段成果不结束长期 Goal。
