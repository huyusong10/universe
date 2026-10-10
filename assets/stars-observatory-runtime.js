import { destinationInView, locatingPanelPlacement } from './observatory-framing.js?v=cosmic-explore-20261010gu';
import { qualityProfile } from './observatory-quality.js?v=cosmic-explore-20261010gu';
import { DESTINATIONS, TARGET_NOTES, DESTINATION_CATEGORIES, targetDisplayNames, describeTarget, describeSpaceContext, describeObservationScale, browseDestinations, searchDestinations } from './observatory-guide.js?v=cosmic-explore-20261010gu';
import { createObservationImage, observationSources, observationSourceDescription } from './observatory-capture.js?v=cosmic-explore-20261010gu';
import { sceneMotionMode } from './observatory-motion.js?v=cosmic-explore-20261010gu';
import { availableExplorationRoutes, describeExplorationRoute, createRouteProgress, rememberRouteObservation, nextRouteStop } from './observatory-routes.js?v=cosmic-explore-20261010gu';

const VERSION = "cosmic-explore-20261010gu";
const GALAXY_REGION_NAMES={
  en:{arm:'Spiral-arm stars','outer-arm':'Outer spiral arm','inner-arm':'Inner spiral arm',bar:'Stellar bar',ring:'Outer ring','outer-ring':'Across the ring',dust:'Dust lane','old-stars':'Old stellar population','outer-stars':'Outer stellar layer',halo:'Stellar halo',starburst:'Star-forming region',wind:'Upper outflow','outer-wind':'Lower outflow','disc-stars':'Stellar disc','outer-disc':'Outer stellar disc','central-stars':'Central stellar population',spoke:'Inner spoke',cloud:'Luminous cloud','outer-cloud':'Another cloud bank',wing:'Stellar wing',nucleus:'First stellar core',companion:'Companion core',tail:'Tidal tail','outer-tail':'Outer tidal tail','curved-arm':'Curved stellar arm',shell:'Stellar shell','outer-shell':'Outer stellar shell','polar-ring':'Polar ring crest','inner-disc':'Inner stellar disc'},
  zh:{arm:'旋臂星区','outer-arm':'外侧旋臂','inner-arm':'内侧旋臂',bar:'恒星棒',ring:'外环星区','outer-ring':'外环另一侧',dust:'暗尘通道','old-stars':'老恒星群','outer-stars':'外侧恒星层',halo:'恒星晕层',starburst:'恒星形成区',wind:'盘上逸出层','outer-wind':'盘下逸出层','disc-stars':'恒星盘','outer-disc':'外侧恒星盘','central-stars':'中央恒星群',spoke:'内侧辐条',cloud:'发光云区','outer-cloud':'另一片云岸',wing:'延伸星翼',nucleus:'第一恒星核心',companion:'伴随核心',tail:'潮汐尾','outer-tail':'远端潮汐尾','curved-arm':'弯曲星臂',shell:'恒星壳层','outer-shell':'外侧恒星壳层','polar-ring':'极环高处','inner-disc':'内侧恒星盘'}
};

const COPY = {
  en: {
    title: "Universe — Cosmic Observatory",
    canvas: "Interactive cosmic observatory",
    boot: "Gathering starlight…",
    firstLight: "The sky is taking shape…",
    ready: "Drag to orbit · Scroll to approach",
    instructions: "Drag or use the arrow keys to orbit. Scroll or use plus and minus to zoom. Select a body to approach, or use the scale controls to explore its surroundings. Press / to find a named body. Body information can be hidden and restored. Home resets the view. Escape stops navigation.",
    keyboard: "Arrow keys to orbit · + / − to zoom",
    observationContext: "Observation and navigation", pausedDestination: name => `Stopped · Destination: ${name}`,
    changingScale: "Changing observation scale",
    observatory: "COSMIC OBSERVATORY", navigation: "Exploration controls", zoom: "View distance",
    allDestinations: "All bodies", wideOverview: "Beyond the galaxy", closeExplorer: "Close explorer", spaceScope: "Where to explore",
    scopeNames: { all: "All space", 'milky-way': "Milky Way", 'outside-milky-way': "Beyond the Milky Way" },
    realObject: "REAL CELESTIAL OBJECT", proceduralObject: "PROCEDURAL STAR", mapHint: "Illustrative scale & layout · Procedural background stars", wideScale: "Intergalactic map",
    guideSections: "Observation sections", guideObserve: "Observe", guideRead: "Read", guideRelated: "Nearby",
    relatedHint: "Explore the real bodies connected to this destination. Choose one to travel there.", relatedSearch: "Find a related body",
    overviewCompact: "Map", wideCompact: "Beyond", destinationsCompact: "Explore",
    overview: "Return to map", destinations: "Explore", choose: "A FEW PLACES TO BEGIN",
    routes: "Routes", routeHeading: "EXPLORE WITH A QUESTION", routeList: "← All routes", routeLeave: "Leave route",
    routeHint: "Choose every departure yourself. You can stop, explore elsewhere and return to this route. Progress stays only in this page.",
    routeProgress: (count, total) => `${count} of ${total} places observed`,
    routeGuide: (name, count, total) => `${name} · ${count}/${total} →`,
    routeStart: name => `Start at ${name} →`, routeContinue: name => `Continue to ${name} →`,
    routeAgain: "Explore again →", routeFinished: "Route complete · Review your places →", routeVisited: "Observed",
    dynamics: "Motion", sceneMotion: "Observation motion", sceneMotionHint: "Orbits, flow and coronal arcs use compressed artistic time, not live astronomical positions.",
    sceneMotionNames: { flow: "Flow", paused: "Pause", accelerated: "4× flow" },
    sceneMotionStates: { flow: "Flowing", paused: "Paused", accelerated: "Flowing · 4×" },
    sceneMotionReduced: "Automatic motion is off for your reduced motion preference. Navigation remains available.",
    sceneMotionControl: name => `Observation motion: ${name}. Pause, continue or accelerate.`,
    locateDestination: "Locate", locateDestinationLabel: name=>`Locate ${name} in this view`,
    locatingDestination: name=>`Locating ${name}`, returnToResults: "Back to results", previewTravel: "Travel here →",
    previewHint: "The marker follows the real scene position. Orbit freely, travel here or return to your results.",
    browseBodies: "Find bodies →",
    solarFamily: "Solar system", systemHeading: "AVAILABLE SOLAR FAMILY",
    systemHint: "See the family together, then choose a world to observe. Moons are listed under their parent bodies.",
    systemOverview: "Open Solar overview →", systemView: "Solar overview", systemCentre: "Centred on the Sun",
    systemNote: "Follow the moving members, or pause to choose one. Orbits, positions and periods are artistic illustrations, not a live ephemeris.",
    systemObservation: "Choose a member to observe up close. The Solar system navigation brings you back to this view.",
    systemChoose: "Choose a Solar member →", systemRepresentation: "Moving Solar family · Artistic orbits and scale",
    innerSystemName: "Inner worlds", innerSystemView: "Inner Solar system",
    innerSystemOpen: "Unfold the inner worlds →", innerSystemReturn: "Return to the inner worlds →",
    innerSystemRepresentation: "Four rocky planets · Artistic orbits and scale",
    innerSystemObservation: "Follow Mercury, Venus, Earth and Mars around the Sun. Choose a world to approach, then return here or open the whole Solar system.",
    systemPair: (first, second) => `${first} and ${second}`, systemAround: name => `Around ${name}`,
    localSystemOpen: name => `Observe ${name} together →`, localSystemReturn: name => `Return to ${name} together →`,
    localSystemCentre: name => `Centred on ${name}`, localSystemRepresentation: "Shared space · Artistic orbit and scale",
    localSystemObservation: "Watch the bodies move through their shared space. Choose one to approach, then return to this view.",
    stellarSystemObservation: "Compare the broad blue-white main star with its small pale companion. Choose either star to approach, then return here from its guide.",
    systemMember: "Central star", systemChild: name => `Belongs to ${name} · Visit this body`,
    recent: "THIS EXPLORATION", recentHint: "Return to your last distance and angle. Available until this page closes.",
    revisit: name => `Return to your last view of ${name}`, revisitReason: stage => `${stage} · Last distance and angle`,
    first: "YOUR FIRST DESTINATION", observing: "NOW OBSERVING", about: "About this body",
    representation: "Science notes include sources. UO stars and the surrounding galaxy are procedural; scene positions, sizes and surfaces are artistic simulations.",
    closer: "Explore closer +", stop: "Stop moving", zoomIn: "Move closer", zoomOut: "Move farther away",
    enterNebula: "Enter the cloud +", deeperNebula: "Explore deeper +",
    nebulaOutside: "A cloud has no solid surface. Move closer to enter its luminous layers, or orbit to discover the dark dust lanes.",
    nebulaInside: "You are within the cloud. Orbit to follow the embedded lights through the gas; move farther away to see the whole nebula again.",
    nebulaSystem: "The glowing cloud is opening into layers. Approach the luminous centre, then continue into the cloud.",
    galaxyRegions:"OBSERVE A REGION",galaxyRegionHint:"Hover or focus a region to locate it, then select to approach. Regions and travel distances are authored illustrations.",galaxyWhole:"See the whole galaxy",galaxyRegionMoving:name=>`Moving toward ${name}`,galaxyRegionViewing:name=>`Observing ${name}`,
    source: "Source", observationSource: "Observation reference", mapSource: "Surface map", shapeSource: "Shape reference", target: "Target", paused: "Movement stopped",
    spaceContext: "Astronomical context", realLocation: "ASTRONOMICAL CONTEXT", spaceSource: "Context source",
    spaceSimulation: "Travel distances and scale are artistically compressed.",
    approach: name => `Approach ${name} →`, flying: name => `Approaching ${name}`,
    resume: name => `Continue to ${name}`,
    continueFlight: "Continue",
    departing: (origin, destination) => `Leaving ${origin} → ${destination}`,
    crossing: name => `Crossing to ${name}`, viewing: "Viewing",
    flightHints: { departing: "Your previous body recedes into its surroundings before the journey continues.", crossing: "Follow the named starlight to your next destination. You can stop or change direction.", approaching: "The new body opens into view. You can still explore closer after arrival." },
    returning: "Returning to the map", arrived: name => `Arrived at ${name}. Drag to orbit; you can still move closer.`,
    returned: name => `Back on the map. ${name} remains your target.`,
    exploring: "CONTINUE EXPLORING", scale: "Exploration scale", scaleGo: name => `Observe at ${name} scale`,
    scaleHeading: "Scale", scaleHint: "Scroll / drag",
    scaleShort: { Surface: "Close", LocalSystem: "Whole", LocalMap: "Nearby", Regional: "Region", Galactic: "Map" },
    scaleShortKind: { galaxy: "Whole", nebula: "Cloud", comet: "Tails", pulsar: "Beams", blackhole: "Disk" },
    scaleSelected: name => `Moving to ${name} scale. Your target is unchanged.`,
    scaleTravel: (percent, stage) => `${percent}% requested; currently ${stage}`,
    scaleScrub: "Explore along the scale axis · Your target is unchanged",
    scaleArrived: (stage, name) => `At ${stage} scale. ${name} is still your target.`,
    viewHints: { Regional: "The galaxy opens into a region of stars. Named lights are places you can visit.", LocalMap: "Explore the surrounding starlight. Select a named body to begin another visit.", LocalSystem: "Your target is becoming a sphere. Move closer to discover its surface." },
    search: "Find a named body", searchPlaceholder: "Find a body…", noResults: "The observatory has no matching named body. Try another name.",
    searchHint: "Search named bodies, for example Earth or Vega. Press / to open search.", searchResults: count => `${count} matching bodies`,
    viewFilter: "Filter by the current view", allViews: "All targets", inViewCount: count => `In view · ${count}`, viewDirectionHint: "Hover or focus to locate. Locate opens the scene; select a target to travel.",
    noVisibleDestinations: "No matching targets in this view. Show all targets, or close navigation and look around.",
    destinationDirections: { visible:"○ In the scene", covered:"◌ Behind controls", behind:"↶ Behind the camera", occluded:"◌ Hidden by a body", unresolved:"· Too small at this scale", left:"← Outside left", right:"→ Outside right", up:"↑ Outside above", down:"↓ Outside below", "up-left":"↖ Outside upper left", "up-right":"↗ Outside upper right", "down-left":"↙ Outside lower left", "down-right":"↘ Outside lower right" },
    categories: "Browse by body category", categoryNames: { featured: "Featured", planet: "Planets", dwarfplanet: "Dwarf planets & candidates", asteroid: "Asteroids", moon: "Moons", comet: "Comets", star: "Stars", pulsar: "Pulsars", blackhole: "Black holes", nebula: "Nebulae", galaxy: "Galaxies" },
    categoryLabel: (name, count) => `${name}, ${count} available`, categoryResults: (name, count) => `${name} · ${count} places`,
    categorySearch: name => `Find in ${name.toLowerCase()}…`, categoryHint: name => `Browse the ${name.toLowerCase()} available here, or find one by name. Press / to search every category.`,
    categorySearchLabel: name => `Find a named body in ${name.toLowerCase()}`,
    categoryEmpty: name => `No matching name in ${name.toLowerCase()}. Clear the name to browse, or choose another category.`,
    clearSearch: "Clear name", searchHeading: "SEARCH RESULTS",
    refineDestinations:"Filters",refineDestinationsLabel:(category,scope)=>`Return to filters: ${category}, ${scope}`,
    namedTargetReason: "Named body · Artistic representation",
    hideGuide: "Hide body information", showGuide: "Body information",
    compareWith: name => `Compare with ${name} ↗`,
    relations: 'Related bodies', parentStar: 'Orbits', parentPlanet: 'Belongs to', childStar: 'Stellar companion', childMoon: 'Satellite', childPlanet: 'Planet', childDwarfplanet: 'Dwarf planet', childAsteroid: 'Asteroid', childComet: 'Comet', visitRelated: name => `Visit ${name} →`,
    quality: "Quality", qualityTitle: "Visual quality", closeQuality: "Return to exploration",
    qualityHint: "Switch whenever you like. Your target and view are preserved.",
    qualityNames: { safe: "Smooth", standard: "Balanced", immersive: "Detailed" },
    qualityDescriptions: { safe: "Lighter textures and space detail, with smooth exploration in mind.", standard: "Clear worlds and a balanced amount of space detail.", immersive: "4K Earth, Mars and Jupiter maps, richer starlight and finer cloud volumes." },
    qualityPreparing: "Preparing visual quality…", qualityReady: name => `${name} quality is active.`, qualityFailed: "Quality could not be changed. Your previous view is still available; try again.",
    inspectSurface: "Inspect terrain details", inspectCloud: "Inspect cloud details", inspectNucleus: "Inspect nucleus details", wholeNucleus: "Return to whole nucleus", nucleusDetailHint: "Orbit the local nucleus crust and illustrative activity sites. The tail stays attached to the same body. Return to the whole nucleus at any time; surface details are artistic, not measured terrain.", wholeSurface: "Return to whole body", surfaceDetailHint: "Orbit the local terrain. Parts of the body may extend beyond the view. Return to the whole body at any time; the sunlit-side control can recover current light.", cloudDetailHint: "Orbit the local cloud structure. This is an artistic view of the atmosphere, not a landing surface. Return to the whole body at any time.",
    terrain: "Observe mapped terrain", terrainTurning: "Turning toward mapped terrain", terrainHint: "Your distance stays the same. Stop or orbit to take control. Map coverage and current light may be limited.", terrainReady: "Mapped terrain in view. Your distance and scene light are unchanged.",
    sunlit: "Observe sunlit side", sunlitTurning: "Turning toward the sunlit side", sunlitHint: "Your distance stays the same. Stop or orbit to take control; the scene light is unchanged.", sunlitReady: "Sunlit side in view. Your distance is unchanged; keep exploring freely.",
    viewTools: "Observation tools", capture: "Save this observation", captureTitle: "Keep this view", closeCapture: "Return to exploration",
    download: "Download PNG", captureHint: "Keep this observation as a PNG. Close the preview to continue from the same place.",
    capturePreparing: "Preparing your observation…", captureReady: "Your observation is ready to save.", captureFailed: "The image could not be prepared. You can keep exploring and try again.",
    captureNote: "Artistic simulation. Scene positions, sizes and surfaces are not astronomical measurements.",
    unsupported: "This observatory needs WebGPU, Dedicated Worker and OffscreenCanvas. Open it in a current Chromium browser through a local server.",
    failed: "The observatory could not start its renderer. Please reload to try again.",
    debug: { catalog: "Catalog", draw: "Drawn", labels: "Labels", distance: "Distance", active: "Focus" }
  },
  zh: {
    title: "Universe — 宇宙观测台",
    canvas: "可交互宇宙观测台",
    boot: "正在汇聚星光…",
    firstLight: "星空正在显现…",
    ready: "拖拽环视 · 滚轮接近",
    instructions: "拖拽或使用方向键环视；滚轮或加减键缩放。点击天体靠近，或用尺度导航探索它的周边。按 / 寻找已命名天体。天体资料可收起和恢复。Home 键重置视角，Escape 键停止导航。",
    keyboard: "方向键环视 · + / − 缩放",
    observationContext: "观察位置与导航", pausedDestination: name => `已停止 · 目的地：${name}`,
    changingScale: "正在改变观察尺度",
    observatory: "宇宙观测台", navigation: "探索控制", zoom: "观察距离",
    allDestinations: "全部目标", wideOverview: "银河之外", closeExplorer: "关闭探索目录", spaceScope: "探索范围",
    scopeNames: { all: "全部空间", 'milky-way': "银河系内", 'outside-milky-way': "银河之外" },
    realObject: "真实天体", proceduralObject: "程序生成恒星", mapHint: "比例与位置为示意 · 背景星场为程序生成", wideScale: "河外星图",
    guideSections: "观察内容", guideObserve: "观察", guideRead: "资料", guideRelated: "周围",
    relatedHint: "探索与这里有关的真实天体。选择一处，继续前往。", relatedSearch: "寻找相关天体",
    overviewCompact: "星图", wideCompact: "河外", destinationsCompact: "探索",
    overview: "返航星图", destinations: "探索导航", choose: "从这些地方开始",
    routes: "路线", routeHeading: "带着好奇出发", routeList: "← 所有路线", routeLeave: "退出路线",
    routeHint: "每次出发都由你决定。可以停止、自由探索，再回来继续；进度仅在当前页面保留。",
    routeProgress: (count, total) => `已观察 ${count} / ${total} 站`,
    routeGuide: (name, count, total) => `${name} · ${count}/${total} →`,
    routeStart: name => `从${name}出发 →`, routeContinue: name => `继续前往${name} →`,
    routeAgain: "再次探索 →", routeFinished: "路线已完成 · 回看各站 →", routeVisited: "已观察",
    dynamics: "动态", sceneMotion: "观测动态", sceneMotionHint: "轨道、流动与日冕弧使用艺术化压缩时间，不代表实时天象。",
    sceneMotionNames: { flow: "流动", paused: "暂停", accelerated: "4× 流动" },
    sceneMotionStates: { flow: "正在流动", paused: "已暂停", accelerated: "正在流动 · 4×" },
    sceneMotionReduced: "遵循减少动态偏好，自动活动已暂停；仍可自由导航。",
    sceneMotionControl: name => `观测动态：${name}。可暂停、恢复或加速。`,
    locateDestination: "看位置", locateDestinationLabel: name=>`在当前星图中定位${name}`,
    locatingDestination: name=>`正在定位${name}`, returnToResults: "返回列表", previewTravel: "前往这里 →",
    previewHint: "标记跟随天体的场景位置。可以环视、前往，或回到原来的列表。",
    browseBodies: "寻找天体 →",
    solarFamily: "太阳系", systemHeading: "可探索的太阳系",
    systemHint: "先看见家族的全貌，再选择一个世界观察。卫星位于各自所属天体的成员入口下。",
    systemOverview: "进入太阳系总览 →", systemView: "太阳系总览", systemCentre: "以太阳为中心",
    systemNote: "观察成员沿路径移动，或暂停选择一个。轨道、位置与周期经过艺术化压缩，并非实时星历。",
    systemObservation: "选择一位成员，到近处观察；通过太阳系导航，随时返回这个视角。",
    systemChoose: "选择太阳系成员 →", systemRepresentation: "流动的太阳系 · 轨道与比例为艺术示意",
    innerSystemName: "内侧世界", innerSystemView: "内太阳系",
    innerSystemOpen: "展开内侧世界 →", innerSystemReturn: "返回内侧世界 →",
    innerSystemRepresentation: "四颗岩质行星 · 轨道与比例为艺术示意",
    innerSystemObservation: "观察水星、金星、地球与火星围绕太阳移动。选择一个世界靠近，再返回这里，或展开完整太阳系。",
    systemPair: (first, second) => `${first}与${second}`, systemAround: name => `${name}的周边`,
    localSystemOpen: name => `共同观察${name} →`, localSystemReturn: name => `返回${name}共同视角 →`,
    localSystemCentre: name => `以${name}为中心`, localSystemRepresentation: "共同空间 · 轨道与比例为艺术示意",
    localSystemObservation: "停留，观察天体在共同空间中移动。选择其中一个靠近，再返回这里。",
    stellarSystemObservation: "对照较大的蓝白主星与小而淡色的伴星。选择任意一颗靠近，再从它的资料返回这里。",
    systemMember: "中心恒星", systemChild: name => `属于${name} · 前往观察`,
    recent: "本次探索", recentHint: "回到上次观察的距离与角度，仅在当前页面保留。",
    revisit: name => `回到${name}的上次视角`, revisitReason: stage => `${stage} · 上次观察的距离与角度`,
    first: "第一次出发", observing: "正在观察", about: "关于这个天体",
    representation: "科普资料附有来源。UO 恒星与周围银河为程序生成；场景位置、尺寸与表面为艺术化模拟。",
    closer: "继续靠近 +", stop: "停止移动", zoomIn: "靠近目标", zoomOut: "离开目标",
    enterNebula: "进入云中 +", deeperNebula: "继续深入 +",
    nebulaOutside: "星云没有固体表面。继续靠近进入发光云层，或环视寻找暗尘通道。",
    nebulaInside: "你正在云中。环视，让核心星光穿过不同云层；向外退离，可以重新看见整片星云。",
    nebulaSystem: "发光的云正在展开成层次。接近明亮的核心，再继续进入云中。",
    galaxyRegions:"选择一个星系区域",galaxyRegionHint:"指向或聚焦入口，在星系中定位；选择后靠近。区域与飞行距离均为作者示意。",galaxyWhole:"恢复星系全貌",galaxyRegionMoving:name=>`前往${name}`,galaxyRegionViewing:name=>`观察${name}`,
    source: "资料来源", observationSource: "观测依据", mapSource: "底图来源", shapeSource: "形状依据", target: "目标", paused: "已停止移动",
    spaceContext: "天文学中的空间归属", realLocation: "天文归属", spaceSource: "归属资料来源",
    spaceSimulation: "飞行距离与场景比例经过艺术化压缩。",
    approach: name => `前往${name} →`, flying: name => `正在飞向${name}`,
    resume: name => `继续前往${name}`,
    continueFlight: "继续前往",
    departing: (origin, destination) => `离开${origin} → ${destination}`,
    crossing: name => `穿越空间 · 前往${name}`, viewing: "观察",
    flightHints: { departing: "先退离刚刚观察的天体，看它回到周围星光中。", crossing: "沿着有名称的星光前往下一站。可以随时停止或改变方向。", approaching: "新的天体正在展开。抵达后，仍可继续靠近观察。" },
    returning: "正在返航星图", arrived: name => `已抵达${name}。拖拽环视，也可以继续靠近。`,
    returned: name => `已返回星图，仍以${name}为目标。`,
    exploring: "继续探索", scale: "探索尺度", scaleGo: name => `观察${name}尺度`,
    scaleHeading: "尺度", scaleHint: "滚动 / 拖动",
    scaleShort: { Surface: "近景", LocalSystem: "全貌", LocalMap: "周边", Regional: "星区", Galactic: "星图" },
    scaleShortKind: { galaxy: "全貌", nebula: "云体", comet: "彗尾", pulsar: "辐射束", blackhole: "吸积盘" },
    scaleSelected: name => `正在前往${name}尺度，保持当前目标。`,
    scaleTravel: (percent, stage) => `目标尺度 ${percent}%，目前${stage}`,
    scaleScrub: "沿尺度轴探索 · 保持当前目标",
    scaleArrived: (stage, name) => `已到${stage}尺度，当前目标${name}。`,
    viewHints: { Regional: "银河展开成一片星区。有名称的星光，可以成为你的下一站。", LocalMap: "探索目标周围的星光。点击有名称的天体，前往下一站。", LocalSystem: "目标正从星点变成球面。继续靠近，观察它的表面。" },
    search: "寻找已命名天体", searchPlaceholder: "寻找一个天体…", noResults: "当前观测台没有匹配的已命名天体，请换一个名字。",
    searchHint: "搜索已命名天体，例如地球或 Vega；按 / 可直接搜索。", searchResults: count => `找到 ${count} 个天体`,
    viewFilter: "按当前视野筛选", allViews: "全部目标", inViewCount: count => `视野中 · ${count}`, viewDirectionHint: "指向或聚焦结果可定位；“看位置”展开星图，选择天体才会启程。",
    noVisibleDestinations: "当前视野内没有符合条件的目标。切换全部目标，或退出导航后环视寻找。",
    destinationDirections: { visible:"○ 画面中", covered:"◌ 界面后方", behind:"↶ 视野后方", occluded:"◌ 被天体遮挡", unresolved:"· 此尺度不可辨", left:"← 画面左侧之外", right:"→ 画面右侧之外", up:"↑ 画面上方之外", down:"↓ 画面下方之外", "up-left":"↖ 画面左上方之外", "up-right":"↗ 画面右上方之外", "down-left":"↙ 画面左下方之外", "down-right":"↘ 画面右下方之外" },
    categories: "按天体类别浏览", categoryNames: { featured: "推荐", planet: "行星", dwarfplanet: "矮行星与候选", asteroid: "小行星", moon: "卫星", comet: "彗星", star: "恒星", pulsar: "脉冲星", blackhole: "黑洞", nebula: "星云", galaxy: "星系" },
    categoryLabel: (name, count) => `${name}，可探索 ${count} 个`, categoryResults: (name, count) => `${name} · ${count} 个目的地`,
    categorySearch: name => `在${name}中寻找…`, categoryHint: name => `浏览这里已有的${name}，也可按名称寻找；按 / 搜索所有类别。`,
    categorySearchLabel: name => `在${name}中寻找已命名天体`,
    categoryEmpty: name => `${name}中没有匹配的名称。清除名称继续浏览，或选择其他类别。`,
    clearSearch: "清除名称", searchHeading: "搜索结果",
    refineDestinations:"筛选",refineDestinationsLabel:(category,scope)=>`返回筛选：${category}，${scope}`,
    namedTargetReason: "已命名天体 · 艺术化模拟",
    hideGuide: "收起天体资料", showGuide: "天体资料",
    compareWith: name => `对照${name} ↗`,
    relations: '相关天体', parentStar: '围绕', parentPlanet: '所属天体', childStar: '恒星伴星', childMoon: '天然卫星', childPlanet: '行星', childDwarfplanet: '矮行星', childAsteroid: '小行星', childComet: '彗星', visitRelated: name => `前往${name} →`,
    quality: "画质", qualityTitle: "选择画质", closeQuality: "返回探索",
    qualityHint: "可随时切换，保留当前目标与视角。",
    qualityNames: { safe: "流畅", standard: "均衡", immersive: "精细" },
    qualityDescriptions: { safe: "更轻的纹理与空间细节，优先保持顺畅。", standard: "清晰的天体与适度的空间细节。", immersive: "4K 地球、火星与木星底图，更丰富的星光与云层层次。" },
    qualityPreparing: "正在准备画质…", qualityReady: name => `已切换为${name}画质。`, qualityFailed: "暂时未能切换画质，仍可使用原来的视图，请重试。",
    inspectSurface: "近观地貌", inspectCloud: "近观云层", inspectNucleus: "近观彗核", wholeNucleus: "退回完整彗核", nucleusDetailHint: "环视局部核体岩壳与示意活动区，尾迹始终连接同一天体。随时退回完整彗核；表面细节为艺术示意，并非实测地形。", wholeSurface: "退回完整天体", surfaceDetailHint: "环视局部地貌，部分天体可能超出视野。随时退回完整天体；受光面工具可找回当前光照。", cloudDetailHint: "环视局部云层，这是大气的艺术示意，并非着陆地表。随时退回完整天体，继续观察周围空间。",
    terrain: "观察已有地貌", terrainTurning: "正在转向已有地貌", terrainHint: "保持当前距离，可以停止或环视接管。底图覆盖与当前受光可能有限。", terrainReady: "已转向已有地貌，距离与场景光照不变。",
    sunlit: "观察受光面", sunlitTurning: "正在转向受光面", sunlitHint: "保持当前距离。可以随时停止或环视接管，场景光照不变。", sunlitReady: "已转向受光面，保持当前距离，可以继续自由观察。",
    viewTools: "观测工具", capture: "保存这次观测", captureTitle: "留住这次观测", closeCapture: "返回探索",
    download: "下载 PNG", captureHint: "下载图片，留住这次观测。关闭预览后，从原来的位置继续探索。",
    capturePreparing: "正在整理这次观测…", captureReady: "观测图已准备好，可以下载。", captureFailed: "暂时未能生成图片，可以继续探索并重试。",
    captureNote: "艺术化模拟。场景位置、尺寸与表面不作为天文测量。",
    unsupported: "观测台需要 WebGPU、Dedicated Worker 和 OffscreenCanvas。请通过本地服务器，在新版 Chromium 浏览器中打开。",
    failed: "观测台未能启动渲染器。请刷新页面重试。",
    debug: { catalog: "目录", draw: "绘制", labels: "标签", distance: "距离", active: "焦点" }
  }
};

function boolParam(params, key) {
  return ["1", "true", "yes"].includes(params.get(key));
}

function intParam(params, key, fallback, min, max) {
  const raw = params.get(key);
  if (!raw || !/^-?\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function number(value, digits = 0) {
  if (!Number.isFinite(value)) return "—";
  return value !== 0 && Math.abs(value) < 0.01 ? value.toExponential(2) : value.toFixed(digits);
}

export function bootStarsObservatory(options) {
  const params = new URLSearchParams(window.location.search);
  const language = (params.get("lang") || navigator.language || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
  const copy = COPY[language];
  const inspectionLabel = inspection => inspection?.close
    ? inspection.kind === 'nucleus' ? copy.wholeNucleus : copy.wholeSurface
    : inspection?.kind === 'nucleus' ? copy.inspectNucleus : inspection?.kind === 'cloud' ? copy.inspectCloud : copy.inspectSurface;
  const inspectionHint = inspection => inspection.kind === 'nucleus' ? copy.nucleusDetailHint
    : inspection.kind === 'cloud' ? copy.cloudDetailHint : copy.surfaceDetailHint;
  const scaleName = (stage, bodyKind = 'star', insideCloud = false) => describeObservationScale(stage, bodyKind, language, insideCloud);
  const { root, scene, labels, status, debug, unsupported, scaleAxis, instructions, controls } = options;
  const unsupportedText = options.unsupportedText || unsupported;
  const debugEnabled = boolParam(params, "debug");
  const budget = qualityProfile(params.get("budget")).key;
  let qualityPending = false, qualityKey = budget;
  const events = new AbortController();
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let statusTimer = 0;
  let resizeFrame = 0;
  let framingFrame = 0, framingKey = '';
  let destroyed = false;
  let worker = null;
  let observer = null;
  let framingObserver = null;
  let pointerId = null;
  let lastPoint = null;
  let dragDistance = 0;
  let downAt = 0;
  let ready = false;
  let failed = false;
  let lastState = null;
  let hasExplored = false;
  let scaleEditing = false;
  let availableDestinations = DESTINATIONS;
  let destinationCategory = 'featured';
  let destinationRegion = 'all';
  let visibleDestinationsOnly = false, destinationViews = new Map();
  let captureSerial = 0, pendingCaptureId = null, previewCaptureId = null, captureTimer = 0, captureUrl = '';

  const fields = Object.fromEntries(Array.from((root || controls)?.querySelectorAll('[data-field]') || [], element => [element.dataset.field, element]));
  const masthead = root?.querySelector('[data-testid="observatory-masthead"]');
  const destinationPanel = controls?.querySelector('#destinations');
  const destinationPeek=controls?.querySelector('[data-testid="destination-peek"]');
  const destinationPeekName=destinationPeek?.querySelector('[data-testid="destination-peek-name"]');
  const destinationPeekDirection=destinationPeek?.querySelector('[data-testid="destination-peek-direction"]');
  let destinationHover=null,destinationPreviewSent=null,navigationPeek=null,peekOpener=null,peekPlacement=null;
  function syncDestinationPreview() {
    const focused=destinationPanel?.contains(document.activeElement)?document.activeElement.closest('[data-preview-id]')?.dataset.previewId:null;
    const focusId=focused===undefined||focused===null?null:Number(focused);
    const id=navigationPeek?.id ?? ((!destinationPanel?.hidden && navigationView==='browse')?(document.activeElement?.matches(':focus-visible') && focusId!==null?focusId:destinationHover ?? focusId):null);
    if(id!==destinationPreviewSent) {destinationPreviewSent=id;send('destination-preview',{id});}
  }
  function clearDestinationPreview() {
    destinationHover=null;destinationPreviewSent=null;send('destination-preview',{id:null});
  }
  function finishDestinationPeek() {
    navigationPeek=null;peekOpener=null;peekPlacement=null;
    if(destinationPeek) destinationPeek.hidden=true;
    if(root) root.dataset.locating='false';
    if(guide) guide.inert=!destinationPanel.hidden;
    clearDestinationPreview();
  }
  function peekDestination(button) {
    const id=Number(button.dataset.previewId),destination=availableDestinations.find(item=>item.id===id);
    if(!destination) return;
    navigationPeek={id,target:destination.target};peekOpener=button;
    destinationPanel.hidden=true;destinationToggle.setAttribute('aria-expanded','false');
    root.dataset.explorer='false';root.dataset.locating='true';guide.inert=true;
    destinationPeek.hidden=false;destinationPeekName.textContent=describeTarget(destination.target,language).name;
    destinationPeekDirection.textContent='';
    destinationPeek.setAttribute('aria-label',copy.locatingDestination(destinationPeekName.textContent));
    send('discovery',{open:true});syncDestinationPreview();positionDestinationPeek(lastState);scheduleFraming();
    scene.focus({preventScroll:true});
  }
  function positionDestinationPeek(state) {
    if(!navigationPeek || !destinationPeek || destinationPeek.hidden) return;
    const sceneRect=scene.getBoundingClientRect(),panel=destinationPeek.getBoundingClientRect();
    const top=(masthead?.getBoundingClientRect().bottom||sceneRect.top+100)-sceneRect.top+16;
    const bottom=(observationConsole?.getBoundingClientRect().top||sceneRect.bottom)-sceneRect.top-16;
    const point=state?.destinationPreview?.id===navigationPeek.id?state.destinationPreview:null;
    peekPlacement=locatingPanelPlacement(sceneRect.width,sceneRect.height,panel,top,bottom,point,peekPlacement);
    destinationPeek.style.left=`${peekPlacement.x}px`;destinationPeek.style.top=`${peekPlacement.y}px`;
    scheduleFraming();
  }
  function returnFromDestinationPeek() {
    const opener=peekOpener;
    finishDestinationPeek();destinationPanel.hidden=false;root.dataset.explorer='true';guide.inert=true;
    destinationToggle.setAttribute('aria-expanded','true');send('discovery',{open:true});scheduleFraming();
    (opener?.isConnected?opener:searchField)?.focus({preventScroll:true});keepNavigationFocusVisible();syncDestinationPreview();
  }
  const navigationToolbar = destinationPanel?.querySelector('.destination-browse');
  const navigationContent = destinationPanel?.querySelector('[data-testid="navigation-content"]');
  const navigationQuery = destinationPanel?.querySelector('[data-testid="navigation-query"]');
  const destinationFiltersReturn = destinationPanel?.querySelector('[data-testid="destination-filters-return"]');
  const destinationToggle = controls?.querySelector('[data-action="destinations"]');
  const dynamicsButton = controls?.querySelector('[data-testid="open-dynamics"]');
  const motionDisclosure = controls?.querySelector('[data-testid="scene-motion-controls"]');
  const motionOptions = controls?.querySelector('[data-testid="scene-motion-options"]');
  const motionFeedback = controls?.querySelector('[data-testid="scene-motion-feedback"]');
  const navigationBrowser = controls?.querySelector('[data-testid="navigation-browser"]');
  const visibleDestinationsButton = controls?.querySelector('[data-testid="browse-visible"]');
  const allDestinationsButton = controls?.querySelector('[data-testid="browse-all-views"]');
  const navigationCategories = controls?.querySelector('[data-testid="destination-categories"]');
  const navigationMotion = controls?.querySelector('[data-testid="navigation-dynamics"]');
  const navigationBrowse = controls?.querySelector('[data-testid="navigation-browse"]');
  const navigationSystem = controls?.querySelector('[data-testid="navigation-system"]');
  const navigationRoutes = controls?.querySelector('[data-testid="navigation-routes"]');
  const routeSection = controls?.querySelector('[data-testid="exploration-routes"]');
  const routeList = controls?.querySelector('[data-testid="route-list"]');
  const routePlan = controls?.querySelector('[data-testid="route-plan"]');
  const routeStops = controls?.querySelector('[data-testid="route-stops"]');
  const routeProgress = controls?.querySelector('[data-testid="route-progress"]');
  const routeNext = controls?.querySelector('[data-testid="route-next"]');
  const routeLeave = controls?.querySelector('[data-testid="route-leave"]');
  const routeGuide = controls?.querySelector('[data-testid="route-guide"]');
  const routeCards = [], routeStopButtons = [], routeSessions = new Map();
  let routePlanKey = null, activeRouteKey = null, renderedRouteKey = '';
  const systemNavigation = controls?.querySelector('[data-testid="solar-navigation"]');
  const systemOverviewButton = controls?.querySelector('[data-testid="system-overview"]');
  const innerSystemOverviewButton = controls?.querySelector('[data-testid="inner-system-overview"]');
  const innerSystemGuideButton = controls?.querySelector('[data-testid="guide-inner-system"]');
  const solarOverviewGuideButton = controls?.querySelector('[data-testid="guide-solar-overview"]');
  const systemGuideButton = controls?.querySelector('[data-testid="guide-system-members"]');
  const localSystemGuideButton = controls?.querySelector('[data-testid="guide-local-system"]');
  const bodyDetails = controls?.querySelector('[data-testid="target-details"]');
  const systemButtons = [], localSystemButtons = [], localSystems = [];
  let availableSystem = null, availableFamilies = [], navigationView = 'browse';
  let destinationOpener = destinationToggle, activityKey = '';
  const approachButton = controls?.querySelector('[data-action="approach"]');
  const stopButton = controls?.querySelector('[data-action="stop"]');
  const viewTools = controls?.querySelector('.view-controls');
  const observationConsole = controls?.querySelector('[data-testid="observation-console"]');
  const terrainButtons = [...(controls?.querySelectorAll('[data-action="terrain"]') || [])];
  const sunlitButton = controls?.querySelector('[data-testid="observe-sunlit"]');
  const inspectionButton = controls?.querySelector('[data-testid="inspect-surface"]');
  const resumeButton = controls?.querySelector('[data-action="resume"]');
  const overviewButton = controls?.querySelector('[data-action="overview"]');
  const closerButton = controls?.querySelector('[data-testid="zoom-in"]');
  const guide = controls?.querySelector('[data-testid="target-guide"]');
  const mapDetailsButton = controls?.querySelector('[data-testid="map-details"]');
  let guideMode = 'observe', guideIdentity = null;
  const guideTabs = controls?.querySelector('[data-testid="guide-tabs"]');
  const guideModeButtons = [...(guideTabs?.querySelectorAll('[data-guide-view]') || [])];
  const guidePanels = [...(guide?.querySelectorAll('[data-guide-panel]') || [])];
  const relatedSearch = controls?.querySelector('[data-testid="related-search"]');
  const relatedEmpty = controls?.querySelector('[data-testid="related-empty"]');
  let relationEntries = [];
  const bodyReading = controls?.querySelector('[data-testid="body-reading"]');
  const hideGuideButton = controls?.querySelector('[data-testid="hide-guide"]');
  const restoreGuideButton = controls?.querySelector('[data-testid="restore-guide"]');
  const nextObservation = controls?.querySelector('[data-testid="next-observation"]');
  const relationGroup = controls?.querySelector('[data-testid="body-relations"]');
  const spaceContext = controls?.querySelector('[data-testid="space-context"]');
  const galaxyRegions=controls?.querySelector('[data-testid="galaxy-regions"]');
  const galaxyRegionOptions=controls?.querySelector('[data-testid="galaxy-region-options"]');
  const galaxyWholeButtons=[...controls?.querySelectorAll('[data-action="galaxy-whole"]')||[]];
  let galaxyRegionKey='', galaxyRegionHover=null, galaxyRegionPreviewSent=null;
  function galaxyRegionName(key,target=lastState?.active) {
    const label=target==='Needle Galaxy'?({'arm':'disc-stars','outer-arm':'outer-disc','inner-arm':'central-stars'}[key]||key):key;
    return GALAXY_REGION_NAMES[language][label];
  }
  function syncGalaxyRegionPreview(state=lastState) {
    const focused=galaxyRegionOptions?.contains(document.activeElement)?document.activeElement.dataset.region:null;
    const eligible=state && !guide?.hidden && guideMode==='observe' && !galaxyRegions?.hidden && !state.flight && !state.galaxyInspection?.region && state.activeId===state.observedId;
    const key=eligible?(galaxyRegionHover||focused||null):null;
    const identity=key?`${state.activeId}:${key}`:null;
    if(identity!==galaxyRegionPreviewSent) {
      galaxyRegionPreviewSent=identity;send('galaxy-region-preview',{key,id:state?.activeId});
    }
  }
  function clearGalaxyRegionPreview() {
    galaxyRegionHover=null;galaxyRegionPreviewSent=null;send('galaxy-region-preview',{key:null});
  }
  let relationKey = '';
  const destinationButtons = [];
  const revisitButtons = [];
  const recentGroup = controls?.querySelector('[data-testid="recent-views"]');
  let trailKey = '';
  const searchField = fields.search;
  const emptyResults = controls?.querySelector('[data-testid="destination-empty"]');
  const categoryGroup = controls?.querySelector('[data-testid="destination-categories"]');
  const categoryButtons = categoryGroup ? DESTINATION_CATEGORIES.map(key => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'destination-category';
    button.dataset.category = key;
    button.dataset.testid = `browse-${key}`;
    button.setAttribute('aria-pressed', String(key === destinationCategory));
    const name = document.createElement('span'), count = document.createElement('span');
    count.setAttribute('aria-hidden', 'true');
    button.append(name, count);
    return button;
  }) : [];
  categoryGroup?.replaceChildren(...categoryButtons);
  const scopeGroup = controls?.querySelector('[data-testid="destination-regions"]');
  const scopeButtons = scopeGroup ? ['all', 'milky-way', 'outside-milky-way'].map(region => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'destination-region'; button.dataset.region = region;
    button.dataset.testid = `scope-${region}`; button.textContent = copy.scopeNames[region];
    return button;
  }) : [];
  scopeGroup?.replaceChildren(...scopeButtons);
  const clearSearch = controls?.querySelector('[data-testid="clear-search"]');
  const captureButton = controls?.querySelector('[data-testid="capture-view"]');
  const capturePreview = controls?.querySelector('[data-testid="capture-preview"]');
  const observationImage = controls?.querySelector('[data-testid="observation-image"]');
  const downloadObservation = controls?.querySelector('[data-testid="download-observation"]');

  const qualityButton = controls?.querySelector('[data-testid="open-quality"]');
  const qualityPanel = controls?.querySelector('[data-testid="quality-panel"]');
  const qualityOptions = controls?.querySelector('[data-testid="quality-options"]');
  const qualityFeedback = controls?.querySelector('[data-testid="quality-feedback"]');
  if (!scene || !labels) throw new Error("The observatory requires scene and label canvases.");
  document.documentElement.lang = language;
  document.title = copy.title;
  scene.setAttribute("aria-label", copy.canvas);
  if (instructions) instructions.textContent = copy.instructions;
  if (debug) debug.dataset.enabled = String(debugEnabled);
  for (const element of controls?.querySelectorAll('[data-copy]') || []) element.textContent = copy[element.dataset.copy] || '';
  for (const element of (root || controls)?.querySelectorAll('[data-copy-label]') || []) element.setAttribute('aria-label', copy[element.dataset.copyLabel] || '');
  for (const element of controls?.querySelectorAll('[data-copy-placeholder]') || []) element.placeholder = copy[element.dataset.copyPlaceholder] || '';
  if (searchField) searchField.placeholder = copy.searchPlaceholder;
  if (captureButton) { captureButton.title = copy.capture; captureButton.disabled = true; }
  if (qualityButton) { qualityButton.title = copy.qualityTitle; qualityButton.disabled = true; }
  if (dynamicsButton) dynamicsButton.disabled = true;
  if (navigationSystem) navigationSystem.disabled = true;
  if (systemOverviewButton) systemOverviewButton.disabled = true;
  for (const element of controls?.querySelectorAll('[data-motion-name]') || []) element.textContent = copy.sceneMotionNames[element.dataset.motionName];
  updateSceneMotion({ mode: 'flow', reduced: motionPreference.matches });
  for (const element of controls?.querySelectorAll('[data-quality-name]') || []) element.textContent = copy.qualityNames[element.dataset.qualityName];
  for (const element of controls?.querySelectorAll('[data-quality-description]') || []) element.textContent = copy.qualityDescriptions[element.dataset.qualityDescription];
  updateQuality(budget);
  function updateQuality(key, error = false) {
    qualityKey = qualityProfile(key).key;
    qualityPending = false;
    if (qualityOptions) {
      qualityOptions.disabled = false;
      for (const input of qualityOptions.querySelectorAll('input')) input.checked = input.value === qualityKey;
    }
    qualityPanel?.setAttribute('aria-busy', 'false');
    if (qualityFeedback) qualityFeedback.textContent = error ? copy.qualityFailed : copy.qualityReady(copy.qualityNames[qualityKey]);
  }

  renderDestinations();
  function renderDestinations({ preserve = false } = {}) {
    if (!fields.destinations) return;
    const focused = document.activeElement?.closest('[data-preview-id]');
    const focusedId=focused?.dataset.previewId,focusedLocate=focused?.dataset.action==='destination-peek';
    const scrollTop = navigationContent?.scrollTop || 0;
    const query = searchField?.value.trim() || '';
    if (recentGroup) recentGroup.hidden = visibleDestinationsOnly || destinationRegion !== 'all' || destinationCategory !== 'featured' || Boolean(query) || revisitButtons.length === 0;
    if (navigationContent && !preserve) navigationContent.scrollTop = 0;
    const visibleIds = new Set([...destinationViews].filter(([, direction]) => destinationInView(direction)).map(([id]) => id));
    const scope = { category: destinationCategory, query, region: destinationRegion };
    const visibleMatches = browseDestinations(availableDestinations, { ...scope, visibleIds });
    const matches = visibleDestinationsOnly ? visibleMatches : browseDestinations(availableDestinations, scope);
    visibleDestinationsButton?.setAttribute('aria-pressed', String(visibleDestinationsOnly));
    allDestinationsButton?.setAttribute('aria-pressed', String(!visibleDestinationsOnly));
    if (visibleDestinationsButton) visibleDestinationsButton.textContent = copy.inViewCount(visibleMatches.length);
    for (const button of scopeButtons) button.setAttribute('aria-pressed', String(button.dataset.region === destinationRegion));
    const categoryName = copy.categoryNames[destinationCategory];
    if(destinationFiltersReturn) {
      destinationFiltersReturn.disabled=!ready;
      destinationFiltersReturn.setAttribute('aria-label',copy.refineDestinationsLabel(categoryName,copy.scopeNames[destinationRegion]));
    }
    for (const button of categoryButtons) {
      const key = button.dataset.category;
      const total = browseDestinations(availableDestinations, { category: key, region: destinationRegion }).length;
      const categoryTitle = key === 'featured' && destinationRegion !== 'all' ? copy.allDestinations : copy.categoryNames[key];
      button.children[0].textContent = categoryTitle;
      button.children[1].textContent = String(total);
      button.setAttribute('aria-label', copy.categoryLabel(categoryTitle, total));
      button.setAttribute('aria-pressed', String(key === destinationCategory));
      button.disabled = !ready || total === 0;
      button.hidden = destinationRegion !== 'all' && total === 0;
    }
    if (searchField) {
      searchField.placeholder = destinationCategory === 'featured' ? copy.searchPlaceholder : copy.categorySearch(categoryName);
      searchField.setAttribute('aria-label', destinationCategory === 'featured' ? copy.search : copy.categorySearchLabel(categoryName));
    }
    if (clearSearch) clearSearch.hidden = !query;
    if (fields['search-hint']) fields['search-hint'].textContent = destinationCategory === 'featured' ? copy.searchHint : copy.categoryHint(categoryName);
    fields.destinations.replaceChildren();
    destinationButtons.length = 0;
    if (emptyResults) {
      emptyResults.hidden = matches.length > 0;
      emptyResults.textContent = visibleDestinationsOnly ? copy.noVisibleDestinations : destinationCategory === 'featured' ? copy.noResults : copy.categoryEmpty(categoryName);
    }
    const count = destinationRegion !== 'all' && destinationCategory === 'featured' && !query ? `${copy.scopeNames[destinationRegion]} · ${matches.length}` : destinationCategory === 'featured' ? query ? copy.searchResults(matches.length) : copy.choose : copy.categoryResults(categoryName, matches.length);
    if (fields['destination-scope']) fields['destination-scope'].textContent = visibleDestinationsOnly ? copy.inViewCount(matches.length) : destinationCategory === 'featured' && query ? `${copy.searchHeading} · ${matches.length}` : count;
    if (fields['search-count'] && fields['search-count'].textContent !== (visibleDestinationsOnly ? copy.inViewCount(matches.length) : count)) fields['search-count'].textContent = visibleDestinationsOnly ? copy.inViewCount(matches.length) : count;
    for (const destination of matches) {
      const detail = describeTarget(destination.target, language);
      const recommended=destinationCategory==='featured' && destinationRegion==='all' && !query && !visibleDestinationsOnly;
      const reason=detail.key?(recommended?detail.invitation:detail.fact||detail.invitation):copy.namedTargetReason;
      const button=destinationButton(detail,reason);
      button.classList.add('destination--catalog');
      button.dataset.target = destination.target;
      button.dataset.destinationId = destination.id;
      button.dataset.testid = `destination-${detail.key || `star-${destination.id}`}`;
      button.setAttribute('aria-current', String(destination.target === lastState?.active));
      button.dataset.previewId=destination.id;
      const row=document.createElement('div');row.className='destination-row';
      const locate=document.createElement('button');locate.type='button';locate.className='destination-locate';
      locate.dataset.action='destination-peek';locate.dataset.previewId=destination.id;
      locate.setAttribute('aria-label',copy.locateDestinationLabel(detail.name));locate.textContent=copy.locateDestination;
      row.append(button,locate);fields.destinations.append(row);
      destinationButtons.push(button);
    }
    destinationHover=null;
    updateDestinationViews();
    if (preserve) {
      if (navigationContent) navigationContent.scrollTop = scrollTop;
      if(focusedId) (fields.destinations.querySelector(`${focusedLocate?'button[data-action=destination-peek]':'button[data-destination-id]'}[data-preview-id="${focusedId}"]`) || visibleDestinationsButton)?.focus({preventScroll:true});
      keepNavigationFocusVisible();
    }
    syncDestinationPreview();
  }

  function updateDestinationViews() {
    for (const button of destinationButtons) {
      const direction = destinationViews.get(Number(button.dataset.destinationId));
      const line = button.querySelector('[data-destination-direction]');
      line.hidden = !direction;
      button.dataset.direction = direction || '';
      const text = copy.destinationDirections[direction] || '';
      if (line.textContent !== text) line.textContent = text;
    }
  }

  function destinationButton(detail, reasonText, arrowText = '↗') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'destination';
    button.dataset.bodyKind = detail.bodyKind;
    button.dataset.material = detail.key || '';
    button.style.setProperty('--star-color', detail.color || '#b9c1d1');
    const star = document.createElement('span');
    star.className = 'destination__star';
    star.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'destination__name';
    name.textContent = detail.name;
    const reason = document.createElement('span');
    reason.className = 'destination__reason';
    reason.textContent = reasonText;
    const direction = document.createElement('span');
    direction.className = 'destination__direction';
    direction.dataset.destinationDirection = '';
    direction.hidden = true;
    text.append(name, reason, direction);
    const arrow = document.createElement('span');
    arrow.className = 'destination__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = arrowText;
    button.append(star, text, arrow);
    return button;
  }

  function renderTrail(state) {
    const views = state.recentViews || [];
    const key = views.map(view => `${view.id}:${view.stage}`).join('|');
    if (key !== trailKey && fields['recent-views']) {
      trailKey = key;
      const focusedId = document.activeElement?.dataset.revisit;
      fields['recent-views'].replaceChildren();
      revisitButtons.length = 0;
      for (const view of views) {
        const detail = describeTarget(view.target, language);
        const button = destinationButton(detail, copy.revisitReason(scaleName(view.stage, detail.bodyKind)), '↶');
        button.dataset.revisit = String(view.id);
        button.dataset.testid = `revisit-${view.id}`;
        button.setAttribute('aria-label', copy.revisit(detail.name));
        fields['recent-views'].append(button);
        revisitButtons.push(button);
      }
      revisitButtons.find(button => button.dataset.revisit === focusedId)?.focus({ preventScroll: true });
    }
    if (recentGroup) recentGroup.hidden = visibleDestinationsOnly || destinationRegion !== 'all' || destinationCategory !== 'featured' || Boolean(searchField?.value.trim()) || views.length === 0;
    for (const button of revisitButtons) button.setAttribute('aria-current', String(Number(button.dataset.revisit) === state.observedId && state.observedId === state.activeId));
  }

  function visibleDestinationButtons() {
    if (navigationView === 'routes') return routePlanKey ? [...routeStopButtons, routeNext, routeLeave].filter(button => button && !button.hidden) : routeCards;
    if (navigationView === 'system') return [systemOverviewButton, innerSystemOverviewButton, ...localSystemButtons, ...systemButtons].filter(Boolean);
    if (navigationView === 'motion') return [];
    return recentGroup?.hidden ? destinationButtons : [...revisitButtons, ...destinationButtons];
  }

  function renderRoutes() {
    if (!routeSection || !routeList || !routePlan) return;
    const available = availableExplorationRoutes(availableDestinations);
    if (navigationRoutes) navigationRoutes.disabled = !ready || available.length === 0;
    if (!routeCards.length && available.length) {
      for (const route of available) {
        const detail = describeExplorationRoute(route.key, language);
        const button = destinationButton({ ...detail, bodyKind: 'route' }, detail.invitation);
        button.dataset.routePlan = detail.key;
        button.dataset.testid = `route-${detail.key}`;
        routeCards.push(button);
        routeList.append(button);
      }
    }
    for (const button of routeCards) {
      const key = button.dataset.routePlan;
      const detail = describeExplorationRoute(key, language);
      const count = routeSessions.get(key)?.visited.length || 0;
      button.querySelector('.destination__reason').textContent = count ? copy.routeProgress(count, detail.stops.length) : detail.invitation;
    }
    routeList.hidden = Boolean(routePlanKey);
    routePlan.hidden = !routePlanKey;
    routeSection.querySelector('#routes-heading').hidden = Boolean(routePlanKey);
    routeSection.setAttribute('aria-labelledby', routePlanKey ? 'route-plan-heading' : 'routes-heading');
    if (!routePlanKey) return;
    const detail = describeExplorationRoute(routePlanKey, language);
    const progress = routeSessions.get(routePlanKey) || createRouteProgress(routePlanKey);
    if (renderedRouteKey !== routePlanKey) {
      renderedRouteKey = routePlanKey;
      routePlan.querySelector('[data-testid="route-name"]').textContent = detail.name;
      routePlan.querySelector('[data-testid="route-context"]').textContent = detail.context;
      const source = routePlan.querySelector('[data-testid="route-source"]');
      source.textContent = `${copy.source} · ${detail.sourceLabel} ↗`;
      source.href = detail.sourceUrl;
      routeStops.replaceChildren();
      routeStopButtons.length = 0;
      detail.stops.forEach((stop, index) => {
        const body = describeTarget(stop.target, language);
        const button = destinationButton(body, stop.prompt);
        button.dataset.routeStop = stop.target;
        button.dataset.testid = `route-stop-${body.key}`;
        const number = button.querySelector('.destination__star');
        number.className = 'route-step-number';
        number.textContent = String(index + 1).padStart(2, '0');
        routeStopButtons.push(button);
        routeStops.append(button);
      });
    }
    routePlan.dataset.routeKey = detail.key;
    routePlan.dataset.active = String(activeRouteKey === detail.key);
    routePlan.dataset.complete = String(!nextRouteStop(progress));
    routeProgress.textContent = copy.routeProgress(progress.visited.length, detail.stops.length);
    routeProgress.dataset.observedCount = String(progress.visited.length);
    for (const button of routeStopButtons) {
      const visited = progress.visited.includes(button.dataset.routeStop);
      button.dataset.visited = String(visited);
      button.querySelector('.destination__arrow').textContent = visited ? '✓' : '↗';
      button.setAttribute('aria-current', String(lastState?.observed === button.dataset.routeStop && !lastState?.flight));
      button.setAttribute('aria-label', `${describeTarget(button.dataset.routeStop, language).name}${visited ? ` · ${copy.routeVisited}` : ''}`);
    }
    const next = nextRouteStop(progress, language);
    routeNext.textContent = !next ? copy.routeAgain : (progress.visited.length ? copy.routeContinue : copy.routeStart)(describeTarget(next.target, language).name);
    routeLeave.hidden = activeRouteKey !== detail.key;
  }

  function visitRouteStop(target, { restart = false } = {}) {
    if (!routePlanKey || !describeExplorationRoute(routePlanKey)?.stops.some(stop => stop.target === target)) return;
    if (restart || !routeSessions.has(routePlanKey)) routeSessions.set(routePlanKey, createRouteProgress(routePlanKey));
    activeRouteKey = routePlanKey;
    send('focus', { target, resume: lastState?.active === target && lastState?.navigationState === 'paused' });
    renderRoutes();
    toggleDestinations(false);
    scene.focus({ preventScroll: true });
  }

  function localSystemMembers(rootId) {
    if (!availableSystem) return [];
    const authored = [...availableSystem.members, ...availableFamilies.flatMap(family => family.members)];
    const root = authored.find(body => body.id === rootId);
    if (!root) return [];
    const members = [root], seen = new Set([root.id]);
    for (let index = 0; index < members.length; index++) for (const body of authored) {
      if (body.parentId === members[index].id && !seen.has(body.id)) { seen.add(body.id); members.push(body); }
    }
    return members;
  }

  function localSystemName(rootId) {
    const members = localSystemMembers(rootId), name = describeTarget(members[0]?.target, language).name;
    return members.length === 2 ? copy.systemPair(name, describeTarget(members[1].target, language).name) : copy.systemAround(name);
  }

  function systemViewName(view) {
    return view?.scope === 'inner' ? copy.innerSystemView : view?.scope === 'local' ? localSystemName(view.rootId) : copy.systemView;
  }

  function systemViewCentre(view) {
    return view?.scope === 'local' ? copy.localSystemCentre(describeTarget(view.root, language).name) : copy.systemCentre;
  }

  function renderSystem(system, families = []) {
    availableSystem = system;
    availableFamilies = families;
    localSystems.length = localSystemButtons.length = 0;
    fields['local-systems']?.replaceChildren();
    if (navigationSystem) navigationSystem.disabled = !system;
    if (systemOverviewButton) systemOverviewButton.disabled = !system;
    if (innerSystemOverviewButton) innerSystemOverviewButton.disabled = !system?.innerMemberIds?.length;
    if (!fields['system-members'] || !system) return;
    fields['system-members'].replaceChildren();
    systemButtons.length = 0;
    for (const member of system.members) {
      if (member.parentId === undefined || !system.members.some(body => body.parentId === member.id)) continue;
      localSystems.push(member);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'system-navigation__overview';
      button.dataset.action = 'system-local-overview';
      button.dataset.rootId = String(member.id);
      button.dataset.testid = `local-system-${member.id}`;
      button.textContent = copy.localSystemOpen(localSystemName(member.id));
      fields['local-systems']?.append(button);
      localSystemButtons.push(button);
    }
    const add = (member, depth) => {
      const detail = describeTarget(member.target, language);
      const parent = system.members.find(body => body.id === member.parentId);
      const button = destinationButton(detail, parent ? copy.systemChild(describeTarget(parent.target, language).name) : copy.systemMember);
      button.dataset.target = member.target;
      button.dataset.memberId = String(member.id);
      button.dataset.nested = String(depth > 1);
      button.dataset.testid = `system-member-${member.id}`;
      fields['system-members'].append(button);
      systemButtons.push(button);
      for (const child of system.members.filter(body => body.parentId === member.id)) add(child, depth + 1);
    };
    add(system.members.find(body => body.id === system.rootId), 0);
    // Other authored families have their own contextual guide entrance. They
    // are not Solar members and do not appear in the Solar navigation tree.
    for (const family of families) {
      const root = family.members.find(body => body.id === family.rootId);
      if (root) localSystems.push(root);
    }
  }
  const stageTicks = Array.from(scaleAxis?.querySelectorAll("[data-level]") || []);
  const scaleSlider = scaleAxis?.querySelector('[data-testid="scale-slider"]');
  if (scaleAxis) scaleAxis.setAttribute('aria-label', copy.scale);
  if (scaleSlider) scaleSlider.setAttribute('aria-label', copy.scale);
  for (const label of scaleAxis?.querySelectorAll('[data-copy]') || []) label.textContent = copy[label.dataset.copy] || '';
  for (const tick of stageTicks) {
    const name = scaleName(tick.dataset.level);
    updateScaleLabel(tick, name);
  }

  function updateScaleLabel(tick, name, bodyKind = 'star') {
    tick.dataset.label = name;
    tick.setAttribute('aria-label', copy.scaleGo(name));
    tick.title = copy.scaleGo(name);
    const full = tick.querySelector('[data-scale-name]');
    const short = tick.querySelector('[data-scale-short]');
    if (full && full.textContent !== name) full.textContent = name;
    const compact = tick.dataset.level === 'LocalSystem'
      ? copy.scaleShortKind[bodyKind] || (language === 'zh' ? '系统' : 'System') : copy.scaleShort[tick.dataset.level];
    if (short && short.textContent !== compact) short.textContent = compact;
  }

  function setStatus(text, autoHide = false, kind = 'hint') {
    window.clearTimeout(statusTimer);
    if (!status) return;
    if (status.textContent !== text) status.textContent = text;
    status.dataset.hidden = "false";
    status.dataset.kind = kind;
    if (autoHide) statusTimer = window.setTimeout(() => { status.dataset.hidden = "true"; }, 6500);
  }

  function unavailable(text, detail) {
    failed = true;
    ready = false;
    releaseCapture();
    if (capturePreview?.open) capturePreview.close();
    if (qualityPanel?.open) qualityPanel.close();
    if (root) root.dataset.state = "unavailable";
    scene.setAttribute("aria-busy", "false");
    setStatus("");
    if (unsupportedText) unsupportedText.textContent = text;
    if (unsupported) unsupported.dataset.visible = "true";
    if (detail) console.error("Observatory renderer failed", detail);
  }

  function send(type, payload = {}) {
    if (ready && ['focus','revisit','overview','space-overview','system-overview','galaxy-region','reset'].includes(type)) setStatus(copy.ready, true);
    if (!destroyed && !failed && worker) worker.postMessage({ type, ...payload });
  }

  function listen(target, name, handler, options = {}) {
    target.addEventListener(name, handler, { ...options, signal: events.signal });
  }

  function restoreDialogFocus(dialog, opener) {
    const focused = document.activeElement;
    if (!destroyed && !failed && !dialog.open &&
        (!focused || focused === document.body || dialog.contains(focused))) {
      opener?.focus({ preventScroll: true });
    }
  }

  function toggleDestinations(open, { restoreFocus = false, globalSearch = false, view = 'browse', opener = null } = {}) {
    if (!destinationPanel || !destinationToggle) return;
    if(navigationPeek) finishDestinationPeek();
    clearDestinationPreview();
    if (open && destinationPanel.hidden) destinationViews = new Map();
    destinationPanel.hidden = !open;
    send('discovery', { open: open && view === 'browse' });
    scheduleFraming();
    if (root) root.dataset.explorer = String(open);
    if (guide) guide.inert = open;
    destinationToggle.setAttribute('aria-expanded', String(open));
    navigationRoutes?.setAttribute('aria-expanded', String(open && view === 'routes'));
    routeGuide?.setAttribute('aria-expanded', String(open && view === 'routes'));
    dynamicsButton?.setAttribute('aria-expanded', String(open && motionDisclosure?.open));
    if (open) {
      navigationView = view;
      const motionControls = view === 'motion';
      const browsing = view === 'browse';
      if (navigationBrowser) navigationBrowser.hidden = !browsing;
      if (navigationCategories) navigationCategories.hidden = !browsing;
      if (scopeGroup) scopeGroup.hidden = !browsing;
      if (searchField) searchField.hidden = !browsing;
      if (navigationQuery) navigationQuery.hidden = !browsing;
      if (navigationMotion) navigationMotion.hidden = motionControls;
      if (navigationBrowse) navigationBrowse.hidden = browsing;
      if (navigationSystem) { navigationSystem.hidden = view === 'system'; navigationSystem.setAttribute('aria-expanded', String(view === 'system')); }
      if (systemNavigation) systemNavigation.hidden = view !== 'system';
      if (navigationRoutes) { navigationRoutes.hidden = view === 'routes'; navigationRoutes.setAttribute('aria-expanded', String(view === 'routes')); }
      if (routeSection) routeSection.hidden = view !== 'routes';
      if (motionDisclosure) { motionDisclosure.hidden = !motionControls; motionDisclosure.open = motionControls; }
      destinationOpener = opener || destinationToggle;
      navigationContent.scrollTop = 0;
      if (view === 'system') { systemOverviewButton?.focus(); return; }
      if (view === 'routes') {
        renderRoutes();
        (routePlanKey ? routePlan.querySelector('[data-testid="route-name"]') : routeCards[0])?.focus({ preventScroll: true });
        return;
      }
      if (motionControls && motionDisclosure) {
        motionDisclosure.open = true;
        dynamicsButton?.setAttribute('aria-expanded', 'true');
        const chosen = motionOptions?.querySelector('input:checked:not(:disabled)');
        (chosen || motionDisclosure.querySelector('summary'))?.focus();
        return;
      }
      if (globalSearch) { destinationCategory = 'featured'; destinationRegion = 'all'; visibleDestinationsOnly = false; }
      if (searchField) { searchField.value = ''; renderDestinations(); searchField.focus(); }
      else destinationButtons[0]?.focus();
    }
    else if (restoreFocus) {
      const reachable = destinationPanel.contains(destinationOpener) ? navigationView === 'motion' ? dynamicsButton : destinationToggle : destinationOpener;
      (reachable?.getClientRects().length && !reachable.disabled ? reachable : destinationToggle)?.focus();
    }
  }

  function updateSceneMotion(activity) {
    const mode = sceneMotionMode(activity.mode);
    const key = `${mode}:${Boolean(activity.reduced)}`;
    if (key === activityKey) return;
    activityKey = key;
    if (motionOptions) {
      motionOptions.disabled = Boolean(activity.reduced);
      for (const input of motionOptions.querySelectorAll('input')) input.checked = input.value === mode;
    }
    if (motionFeedback) motionFeedback.textContent = activity.reduced ? copy.sceneMotionReduced : copy.sceneMotionStates[mode];
    if (dynamicsButton) {
      dynamicsButton.dataset.paused = String(activity.reduced || mode === 'paused');
      const label = copy.sceneMotionControl(activity.reduced ? copy.sceneMotionStates.paused : copy.sceneMotionStates[mode]);
      dynamicsButton.setAttribute('aria-label', label);
      dynamicsButton.title = label;
    }
  }

  function toggleGuide() {
    if (!guide || !hideGuideButton || !restoreGuideButton) return;
    clearGalaxyRegionPreview();
    const open = guide.hidden;
    guide.hidden = !open;
    restoreGuideButton.hidden = open;
    for (const button of [hideGuideButton, restoreGuideButton]) button.setAttribute('aria-expanded', String(open));
    (open ? hideGuideButton : restoreGuideButton).focus({ preventScroll: true });
    scheduleFraming();
  }

  function showGuideSection(mode) {
    if (!lastState || !['observe', 'read', 'related'].includes(mode)) return;
    clearGalaxyRegionPreview();
    guideMode = mode;
    if (mode === 'read' && bodyDetails) bodyDetails.open = true;
    updateGuide(lastState);
    if (bodyReading) bodyReading.scrollTop = 0;
    scheduleFraming();
  }

  function filterRelations() {
    if (!relationGroup) return;
    const matches = new Set(searchDestinations(relationEntries, relatedSearch?.value || '').map(body => body.id));
    for (const section of relationGroup.children) {
      let count = 0;
      for (const button of section.querySelectorAll('[data-related-id]')) {
        button.hidden = !matches.has(Number(button.dataset.relatedId));
        if (!button.hidden) count++;
      }
      section.hidden = count === 0;
    }
    if (relatedEmpty) relatedEmpty.hidden = matches.size > 0;
  }

  function updateGuideSections() {
    const related = guideModeButtons.find(button => button.dataset.guideView === 'related');
    if (related) {
      related.hidden = !relationEntries.length || relationGroup.hidden;
      related.textContent = `${copy.guideRelated} · ${relationEntries.length}`;
    }
    if (guideMode === 'related' && related?.hidden) guideMode = 'observe';
    const selected = guideModeButtons.find(button => button.dataset.guideView === guideMode);
    for (const panel of guidePanels) {
      const hidden = panel.dataset.guidePanel !== guideMode;
      if (hidden && panel.contains(document.activeElement)) selected?.focus({ preventScroll: true });
      panel.hidden = hidden;
    }
    for (const button of guideModeButtons) {
      const active = button === selected;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    mapDetailsButton?.setAttribute('aria-expanded', String(guideMode === 'read'));
    if (guide) guide.dataset.guideMode = guideMode;
  }

  function inspectSurface() {
    if (!lastState?.surfaceInspection?.available) return;
    const retreat = lastState.surfaceInspection.close;
    const progress = retreat ? lastState.scaleStops?.find(stop => stop.stage === 'Surface')?.progress : 1;
    if (!Number.isFinite(progress)) return;
    // An explicit inspection opens the observation area. Reading can be
    // restored independently; scale input retains the same body and direction.
    if (!retreat && !guide.hidden) toggleGuide();
    send('scale', { progress });
    scene.focus({ preventScroll: true });
    setStatus(inspectionLabel(lastState.surfaceInspection), true);
  }

  function releaseCapture() {
    window.clearTimeout(captureTimer);
    const id = pendingCaptureId ?? previewCaptureId;
    pendingCaptureId = previewCaptureId = null;
    observationImage?.removeAttribute('src');
    observationImage?.removeAttribute('aria-description');
    downloadObservation?.removeAttribute('href');
    if (captureUrl) URL.revokeObjectURL(captureUrl);
    captureUrl = '';
    if (captureButton) { captureButton.disabled = !ready; captureButton.removeAttribute('aria-busy'); }
    if (id !== null) send('resume', { id });
  }

  function requestCapture() {
    if (!ready || !capturePreview || pendingCaptureId !== null || previewCaptureId !== null || capturePreview.open) return;
    toggleDestinations(false);
    pendingCaptureId = ++captureSerial;
    captureButton.disabled = true;
    captureButton.setAttribute('aria-busy', 'true');
    setStatus(copy.capturePreparing, false, 'event');
    send('capture', { id: pendingCaptureId });
    captureTimer = window.setTimeout(() => { releaseCapture(); setStatus(copy.captureFailed, true, 'event'); }, 12000);
  }

  async function receiveCapture(message) {
    const { id, bitmap, view } = message;
    try {
      if (id !== pendingCaptureId) { send('resume', { id }); return; }
      const observed = describeTarget(view.observed, language);
      const destination = describeTarget(view.active, language);
      const destinationName = view.systemView?.pending ? systemViewName(view.systemView) : destination.name;
      const stage = scaleName(view.scaleStage, view.observedKind || observed.bodyKind, view.insideNebula);
      const familyView = Boolean(view.systemView?.visible && !view.systemView.pending);
      const title = familyView ? systemViewName(view.systemView) : view.scaleStage === 'Galactic' ? stage : observed.name;
      let context = familyView ? `${systemViewCentre(view.systemView)} · ${copy.systemNote}` : view.scaleStage === 'Galactic' ? `${copy.target}: ${destinationName}` :
        `${stage} · ${copy.viewing}: ${observed.name}${view.observedId !== view.activeId || view.systemView?.pending ? ` · ${copy.target}: ${destinationName}` : ''}`;
      if(view.galaxyRegion) context+=` · ${galaxyRegionName(view.galaxyRegion,view.observed)}`;
      const space = describeSpaceContext(view.observed, language);
      const location = space ? `${copy.spaceContext}: ${space.path}${space.reference ? ` · ${space.reference}` : ''} · ${space.sourceLabel}` : '';
      const sources = observationSources(view, language);
      const representationNote = !familyView && view.scaleStage !== 'Galactic'
        ? observed.representationNote || (observed.kind === 'procedural' ? observed.story : '') : '';
      const captureNote = copy.captureNote + (representationNote ? ` ${representationNote}` : '');
      const credit = observationSourceDescription(sources, language);
      const blob = await createObservationImage(bitmap, { title, context, location, note: captureNote, sources }, language);
      if (destroyed || failed || id !== pendingCaptureId) { send('resume', { id }); return; }
      captureUrl = URL.createObjectURL(blob);
      observationImage.src = captureUrl;
      observationImage.alt = `${title} · ${context}. ${location ? `${location}. ` : ''}${captureNote}`;
      observationImage.setAttribute('aria-description', credit);
      if (space) observationImage.dataset.spaceRegion = space.region;
      else delete observationImage.dataset.spaceRegion;
      observationImage.dataset.observedId = String(view.observedId);
      observationImage.dataset.activeId = String(view.activeId);
      observationImage.dataset.scaleStage = view.scaleStage;
      observationImage.dataset.systemRootId = familyView ? String(view.systemView.rootId) : '';
      observationImage.dataset.systemScope = familyView ? view.systemView.scope : '';
      observationImage.dataset.galaxyRegion = view.galaxyRegion || '';
      downloadObservation.href = captureUrl;
      const name = familyView ? view.systemView.scope === 'inner' ? 'inner-solar-system' : view.systemView.scope === 'local' ? `${view.systemView.root}-system` : 'solar-system' : view.scaleStage === 'Galactic' ? 'galaxy' : view.observed;
      downloadObservation.download = `universe-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.png`;
      await observationImage.decode();
      if (destroyed || failed || id !== pendingCaptureId) { send('resume', { id }); return; }
      capturePreview.showModal();
      window.clearTimeout(captureTimer);
      pendingCaptureId = null;
      previewCaptureId = id;
      captureButton.disabled = false;
      captureButton.removeAttribute('aria-busy');
      downloadObservation.focus({ preventScroll: true });
      setStatus(copy.captureReady, true, 'event');
    } catch {
      if (id === pendingCaptureId) { releaseCapture(); setStatus(copy.captureFailed, true, 'event'); }
    } finally { bitmap.close(); }
  }

  function updateGuide(state) {
    if (!controls) return;
    const detail = describeTarget(state.active, language);
    const observed = describeTarget(state.observed || state.active, language);
    if (fields['object-evidence']) fields['object-evidence'].textContent = detail.kind === 'procedural' ? copy.proceduralObject : copy.realObject;
    const inspection=state.galaxyInspection;
    if(galaxyRegions && galaxyRegionOptions) {
      galaxyRegions.hidden=!inspection?.supported || state.scaleStage!=='Surface' || state.observedId!==state.activeId;
      const key=`${state.activeId}:${inspection?.options?.map(item=>item.key).join(',')}`;
      if(key!==galaxyRegionKey) {
        clearGalaxyRegionPreview();galaxyRegionKey=key;galaxyRegionOptions.replaceChildren();
        for(const {key} of inspection?.options||[]) {
          const button=document.createElement('button');button.type='button';button.className='quiet-button';
          button.dataset.action='galaxy-region';button.dataset.region=key;button.dataset.testid=`galaxy-region-${key}`;
          button.textContent=galaxyRegionName(key,state.active);galaxyRegionOptions.append(button);
        }
      }
      for(const button of galaxyRegionOptions.children) {
        button.disabled=!inspection?.available;
        button.setAttribute('aria-pressed',String(button.dataset.region===inspection?.region));
      }
    }
    syncGalaxyRegionPreview(state);
    for(const button of galaxyWholeButtons) {
      button.hidden=(!inspection?.region && !inspection?.pending) || (button.dataset.testid==='galaxy-whole-control' && !guide?.hidden);
      button.disabled=!inspection?.available;
    }
    if (activeRouteKey) {
      const previous = routeSessions.get(activeRouteKey);
      const progress = rememberRouteObservation(previous, state);
      if (progress !== previous) { routeSessions.set(activeRouteKey, progress); renderRoutes(); }
    }
    if (routeGuide) {
      const route = describeExplorationRoute(activeRouteKey, language);
      routeGuide.hidden = !route;
      if (route) routeGuide.textContent = copy.routeGuide(route.name, routeSessions.get(activeRouteKey).visited.length, route.stops.length);
    }
    const atDestination = state.observedId === undefined || state.observedId === state.activeId;
    const navigation = state.navigationState || (state.flight ? 'flying' : 'observing');
    const arriving = navigation === 'flying';
    const returning = navigation === 'returning';
    const observationScale = state.scaleStage === 'Surface' || (['comet', 'pulsar', 'blackhole'].includes(detail.bodyKind) && state.scaleStage === 'LocalSystem');
    const close = atDestination && observationScale && ['observing', 'zooming'].includes(navigation);
    const familyView = Boolean(state.systemView && atDestination && !arriving && !returning);
    if (guideIdentity !== state.activeId) {
      guideIdentity = state.activeId;
      guideMode = 'observe';
      if (relatedSearch) relatedSearch.value = '';
    }
    const mapView = state.distance > 28 && !familyView;
    if (root) root.dataset.spaceView = mapView ? 'map' : 'observe';
    if (guide) guide.dataset.mapSummary = String(mapView && guideMode === 'observe');
    const localFamilyView = familyView && state.systemView.scope === 'local';
    const innerFamilyView = familyView && state.systemView.scope === 'inner';
    const destinationName = state.systemView?.pending || state.systemView?.visible ? systemViewName(state.systemView) : detail.name;
    const regionName=inspection?.region && galaxyRegionName(inspection.region,state.active);
    const flightText = regionName ? copy.galaxyRegionMoving(regionName) : state.terrainTurn ? copy.terrainTurning : state.sunlitTurn ? copy.sunlitTurning : state.flightPhase === 'departing' ? copy.departing(observed.name, destinationName) : state.flightPhase === 'crossing' ? copy.crossing(destinationName) : copy.flying(destinationName);
    const write = (field, value) => { if (fields[field] && fields[field].textContent !== value) fields[field].textContent = value; };
    write('name', innerFamilyView ? copy.innerSystemName : localFamilyView ? systemViewName(state.systemView) : familyView ? copy.solarFamily : detail.name);
    write('type', innerFamilyView ? copy.innerSystemRepresentation : localFamilyView ? copy.localSystemRepresentation : familyView ? copy.systemRepresentation : detail.type);
    if (systemGuideButton) systemGuideButton.hidden = !familyView || localFamilyView || innerFamilyView;
    if (innerSystemGuideButton) {
      innerSystemGuideButton.hidden = innerFamilyView || !availableSystem?.innerMemberIds?.includes(state.activeId) || arriving || returning;
      innerSystemGuideButton.textContent = close || localFamilyView ? copy.innerSystemReturn : copy.innerSystemOpen;
    }
    if (solarOverviewGuideButton) solarOverviewGuideButton.hidden = !innerFamilyView;
    if (localSystemGuideButton) {
      const group = localSystems.find(body => localSystemMembers(body.id).some(member => member.id === state.activeId)) ||
        (state.activeId === availableSystem?.rootId && (state.scaleStage === 'Galactic' || familyView) ? localSystems[0] : null);
      localSystemGuideButton.hidden = !group || localFamilyView || arriving || returning;
      if (group) {
        localSystemGuideButton.dataset.rootId = String(group.id);
        localSystemGuideButton.textContent = (close ? copy.localSystemReturn : copy.localSystemOpen)(localSystemName(group.id));
      } else delete localSystemGuideButton.dataset.rootId;
    }
    if (bodyDetails) bodyDetails.hidden = familyView;
    if (state.scaleStage !== 'Galactic' || state.flight) hasExplored = true;
    write('eyebrow', arriving ? flightText : returning ? copy.returning : navigation === 'paused' ? copy.paused : familyView ? systemViewName(state.systemView) : close ? copy.observing : hasExplored ? copy.exploring : copy.first);
    const cloudHint = close && detail.bodyKind === 'nebula' ? state.insideNebula ? copy.nebulaInside : copy.nebulaOutside : atDestination && detail.bodyKind === 'nebula' && state.scaleStage === 'LocalSystem' ? copy.nebulaSystem : atDestination && detail.bodyKind === 'galaxy' && ['Surface', 'LocalSystem'].includes(state.scaleStage) ? detail.observation : '';
    const stellarFamilyView = localFamilyView && localSystemMembers(state.systemView.rootId).every(body => body.kind === 'star');
    write('invitation', state.terrainTurn ? copy.terrainHint : state.sunlitTurn ? copy.sunlitHint : arriving && copy.flightHints[state.flightPhase] ? copy.flightHints[state.flightPhase] : innerFamilyView ? copy.innerSystemObservation : localFamilyView ? stellarFamilyView ? copy.stellarSystemObservation : copy.localSystemObservation : familyView ? copy.systemObservation : cloudHint || (close ? state.surfaceInspection?.supported && state.surfaceInspection.close ? inspectionHint(state.surfaceInspection) : detail.observation : !arriving && !returning && copy.viewHints[state.scaleStage] ? copy.viewHints[state.scaleStage] : detail.invitation));
    write('story', detail.story);
    write('fact', detail.fact);
    if (fields.source) {
      fields.source.hidden = !detail.sourceUrl;
      if (detail.sourceUrl) { fields.source.href = detail.sourceUrl; write('source', `${copy.source} · ${detail.sourceLabel} ↗`); }
      else fields.source.removeAttribute('href');
    }
    if (fields['shape-source']) {
      fields['shape-source'].hidden = !detail.shapeSourceUrl;
      if (detail.shapeSourceUrl) { fields['shape-source'].href = detail.shapeSourceUrl; write('shape-source', `${copy.shapeSource} · ${detail.shapeSourceLabel} ↗`); }
      else fields['shape-source'].removeAttribute('href');
    }
    if (fields['map-source']) {
      fields['map-source'].hidden = !detail.mapSourceUrl;
      if (detail.mapSourceUrl) { fields['map-source'].href = detail.mapSourceUrl; write('map-source', `${copy.mapSource} · ${detail.mapSourceLabel} ↗`); }
      else fields['map-source'].removeAttribute('href');
    }
    if (fields['observation-source']) {
      fields['observation-source'].hidden = !detail.observationSourceUrl;
      if (detail.observationSourceUrl) { fields['observation-source'].href = detail.observationSourceUrl; write('observation-source', `${copy.observationSource} · ${detail.observationSourceLabel} ↗`); }
      else fields['observation-source'].removeAttribute('href');
    }
    if (guide) { guide.dataset.target = state.active; guide.dataset.kind = detail.kind; guide.dataset.bodyKind = detail.bodyKind; guide.dataset.view = familyView ? 'system' : 'body'; }
    if (spaceContext) {
      const space = describeSpaceContext(state.active, language);
      spaceContext.hidden = !space;
      if (space) {
        spaceContext.dataset.target = state.active;
        spaceContext.dataset.region = space.region;
        write('space-path', space.path);
        write('space-reference', space.reference);
        if (fields['space-reference']) fields['space-reference'].hidden = !space.reference;
        if (fields['space-source']) {
          fields['space-source'].href = space.sourceUrl;
          write('space-source', `${space.sourceLabel} ↗`);
          fields['space-source'].setAttribute('aria-label', `${copy.spaceSource} · ${space.sourceLabel} ↗`);
        }
      } else {
        delete spaceContext.dataset.target;
        delete spaceContext.dataset.region;
        fields['space-source']?.removeAttribute('href');
      }
    }
    const childRelationLabel = body => ({ star: copy.childStar, moon: copy.childMoon, dwarfplanet: copy.childDwarfplanet, asteroid: copy.childAsteroid, comet: copy.childComet })[body.kind] || copy.childPlanet;
    if (relationGroup) {
      const relation = state.relations || { parent: null, children: [] };
      const familyMembers = innerFamilyView ? availableSystem.members.filter(body => state.systemView.memberIds.includes(body.id)) : localFamilyView ? localSystemMembers(state.systemView.rootId) : null;
      const entries = familyMembers ? familyMembers.map(body =>
        ({ ...body, label: body.id === state.systemView.rootId && body.kind === 'star' ? copy.systemMember : childRelationLabel(body) })) : [
        ...(relation.parent ? [{ ...relation.parent, label: relation.parent.kind === 'star' ? copy.parentStar : copy.parentPlanet }] : []),
        ...relation.children.map(body => ({ ...body, label: childRelationLabel(body) }))
      ];
      const key = JSON.stringify(entries);
      if (key !== relationKey) {
        relationKey = key;
        relationEntries = entries;
        relationGroup.replaceChildren();
        relationGroup.setAttribute('aria-label', copy.relations);
        const groups = new Map();
        for (const body of entries) {
          if (!groups.has(body.label)) {
            const section = document.createElement('section');
            section.className = 'body-relations__group';
            const heading = document.createElement('h3');
            heading.textContent = body.label;
            const list = document.createElement('div');
            list.className = 'body-relations__list';
            section.append(heading, list);relationGroup.append(section);groups.set(body.label, list);
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.target = body.target;
          button.dataset.testid = 'related-body';
          button.dataset.relatedId = String(body.id);
          button.textContent = describeTarget(body.target, language).name;
          button.setAttribute('aria-label', copy.visitRelated(describeTarget(body.target, language).name));
          groups.get(body.label).append(button);
        }
        filterRelations();
      }
      relationGroup.hidden = !relationGroup.childElementCount || (familyView && !localFamilyView && !innerFamilyView) || arriving || returning;
      for (const button of relationGroup.querySelectorAll('[data-related-id]')) button.setAttribute('aria-current', String(Number(button.dataset.relatedId) === state.activeId));
    }
    if (approachButton) {
      approachButton.textContent = state.revisiting ? `${copy.revisit(detail.name)} →` : copy.approach(detail.name);
      approachButton.hidden = close || familyView;
      approachButton.disabled = arriving || returning;
    }
    if (closerButton) {
      closerButton.hidden = !close || familyView;
      closerButton.disabled = state.surfaceInspection?.supported ? !state.surfaceInspection.available : state.distance <= state.minDistance * 1.01;
      closerButton.textContent = state.surfaceInspection?.supported ? inspectionLabel(state.surfaceInspection) : detail.bodyKind === 'nebula' ? state.insideNebula ? copy.deeperNebula : copy.enterNebula : copy.closer;
    }
    if (nextObservation) {
      const observingStopped = atDestination && observationScale && navigation === 'paused';
      nextObservation.hidden = familyView || !(close || observingStopped) || !detail.nextTarget;
      if (detail.nextTarget) {
        nextObservation.dataset.target = detail.nextTarget;
        write('next-name', copy.compareWith(describeTarget(detail.nextTarget, language).name));
        write('next-reason', detail.nextReason);
      } else delete nextObservation.dataset.target;
      delete nextObservation.dataset.action;
      const route = describeExplorationRoute(activeRouteKey, language);
      const progress = routeSessions.get(activeRouteKey);
      if (route && close && route.stops.some(stop => stop.target === state.observed)) {
        const next = nextRouteStop(progress, language);
        nextObservation.hidden = false;
        delete nextObservation.dataset.target;
        nextObservation.dataset.action = next ? 'route-continue' : 'route-navigation';
        nextObservation.querySelector('[data-field="next-name"]').textContent = next ? copy.routeContinue(describeTarget(next.target, language).name) : copy.routeFinished;
        nextObservation.querySelector('[data-field="next-reason"]').textContent = next?.prompt || copy.routeProgress(progress.visited.length, route.stops.length);
      }
    }
    if (sunlitButton) {
      sunlitButton.hidden = !state.sunlitAvailable && !state.sunlitTurn;
      sunlitButton.disabled = !state.sunlitAvailable;
    }
    if (inspectionButton) {
      inspectionButton.hidden = !state.surfaceInspection?.supported || state.scaleStage !== 'Surface';
      inspectionButton.disabled = !state.surfaceInspection?.available;
      const label = inspectionLabel(state.surfaceInspection);
      inspectionButton.setAttribute('aria-label', label);
      inspectionButton.title = label;
      inspectionButton.setAttribute('aria-pressed', String(Boolean(state.surfaceInspection?.close)));
    }
    for (const button of terrainButtons) {
      button.hidden = !state.terrainAvailable && !state.terrainTurn;
      button.disabled = !state.terrainAvailable;
    }
    if (stopButton) stopButton.hidden = !state.flight && navigation !== 'zooming';
    if (resumeButton) {
      resumeButton.hidden = navigation !== 'paused' || (atDestination && !state.revisiting && !state.systemView?.pending && !state.galaxyInspection?.pending);
      resumeButton.textContent = copy.continueFlight;
      resumeButton.setAttribute('aria-label', copy.resume(destinationName));
      resumeButton.title = copy.resume(destinationName);
    }
    const overviewProgress = state.scaleStops?.find(stop => stop.stage === 'Galactic')?.progress;
    const atOverview = Number.isFinite(overviewProgress) && Math.abs(state.scaleAxisProgress - overviewProgress) < 0.0001;
    if (overviewButton) overviewButton.disabled = atOverview && !state.flight && navigation !== 'zooming';
    for (const button of destinationButtons) button.setAttribute('aria-current', String(button.dataset.target === state.active));
    for (const button of systemButtons) button.setAttribute('aria-current', String(Number(button.dataset.memberId) === state.activeId && !state.systemView?.visible));
    systemOverviewButton?.setAttribute('aria-current', String(Boolean(state.systemView?.visible && state.systemView.scope === 'family')));
    innerSystemOverviewButton?.setAttribute('aria-current', String(Boolean(state.systemView?.visible && state.systemView.scope === 'inner')));
    for (const button of localSystemButtons) button.setAttribute('aria-current', String(Boolean(state.systemView?.visible && state.systemView.scope === 'local' && state.systemView.rootId === Number(button.dataset.rootId))));
    updateGuideSections();
  }

  function updateObservationContext(state) {
    const observed = describeTarget(state.observed || state.active, language);
    const target = describeTarget(state.active, language);
    const destinationName = state.systemView?.pending || state.systemView?.visible ? systemViewName(state.systemView) : target.name;
    const atDestination = state.observedId === undefined || state.observedId === state.activeId;
    const navigation = state.navigationState || (state.flight ? 'flying' : 'observing');
    const stage = state.distance > 28 ? copy.wideScale : scaleName(state.scaleStage, state.observedKind || observed.bodyKind, state.insideNebula);
    const label = state.distance <= 28 && state.scaleStage === 'Galactic' && atDestination && !state.flight ? copy.target : copy.viewing;
    const regionName=state.galaxyInspection?.region && galaxyRegionName(state.galaxyInspection.region,state.active);
    const location = state.systemView?.visible && !state.systemView.pending ? `${systemViewName(state.systemView)} · ${systemViewCentre(state.systemView)}` : `${stage} · ${label}: ${observed.name}${regionName?` · ${regionName}`:''}`;
    let feedback = '';
    if (navigation === 'flying') feedback = regionName ? copy.galaxyRegionMoving(regionName) : state.terrainTurn ? copy.terrainTurning : state.sunlitTurn ? copy.sunlitTurning : state.flightPhase === 'departing' ? copy.departing(observed.name, destinationName) : state.flightPhase === 'crossing' ? copy.crossing(destinationName) : copy.flying(destinationName);
    else if (navigation === 'returning') feedback = copy.returning;
    else if (navigation === 'paused') feedback = state.systemView?.pending ? copy.pausedDestination(destinationName) : atDestination ? copy.paused : copy.pausedDestination(target.name);
    else if (navigation === 'zooming') feedback = copy.changingScale;
    else if (!atDestination) feedback = `${copy.target}: ${target.name}`;
    if (fields['map-hint']) {
      fields['map-hint'].hidden = false;
      if (fields['map-hint'].textContent !== copy.mapHint) fields['map-hint'].textContent = copy.mapHint;
    }
    if (root) root.dataset.navigation = navigation;
    const sharedView = state.systemView?.visible && !state.systemView.pending;
    const readout = {
      'position-scale': sharedView ? systemViewName(state.systemView) : stage,
      'position-relation': sharedView ? ' · ' : ` · ${label}: `,
      'position-body': sharedView ? systemViewCentre(state.systemView) : observed.name,
      'position-region': regionName ? ` · ${regionName}` : ''
    };
    for (const [key, text] of Object.entries(readout)) if (fields[key] && fields[key].textContent !== text) fields[key].textContent = text;
    if (fields['position-region']) fields['position-region'].hidden = !regionName;
    if (fields['navigation-feedback']) {
      const element = fields['navigation-feedback'];
      element.hidden = !feedback;
      if (element.textContent !== feedback) element.textContent = feedback;
    }
    scene.dataset.observedId = String(state.observedId ?? state.activeId);
    scene.dataset.activeId = String(state.activeId);
    const accessibleView = `${copy.canvas} · ${location}${!atDestination ? ` · ${copy.target}: ${target.name}` : ''}${feedback ? ` · ${feedback}` : ''}`;
    if (scene.getAttribute('aria-label') !== accessibleView) scene.setAttribute('aria-label', accessibleView);
    if (lastState && navigation === 'observing' && (lastState.navigationState !== navigation || lastState.observedId !== state.observedId)) {
      if (lastState.navigationState === 'flying') setStatus(regionName ? copy.galaxyRegionViewing(regionName) : lastState.terrainTurn ? copy.terrainReady : lastState.sunlitTurn ? copy.sunlitReady : copy.arrived(destinationName), true);
      else if (lastState.navigationState === 'returning') setStatus(copy.returned(target.name), true);
      else if (lastState.navigationState === 'zooming') setStatus(copy.scaleArrived(stage, target.name), true);
      else if (lastState.observedId !== state.observedId) setStatus(copy.arrived(destinationName), true);
    }
  }

  function keepNavigationFocusVisible() {
    const focused = document.activeElement;
    if (!destinationPanel || destinationPanel.hidden || !destinationPanel.contains(focused) || navigationToolbar?.contains(focused)) return;
    if(!navigationContent?.contains(focused)) return;
    const area=navigationContent.getBoundingClientRect(),item=focused.getBoundingClientRect();
    if(item.top<area.top+4 || item.bottom>area.bottom-4 || item.left<area.left || item.right>area.right) focused.scrollIntoView({block:'nearest',inline:'nearest'});
  }

  function keepReadingFocusVisible() {
    const focused = document.activeElement;
    if (!guide || guide.hidden || !bodyReading || focused === bodyReading || !bodyReading.contains(focused)) return;
    const area = bodyReading.getBoundingClientRect(), item = focused.getBoundingClientRect();
    if (item.top < area.top || item.bottom > area.bottom || item.left < area.left || item.right > area.right) {
      focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function resize() {
    if (destroyed) return;
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      const rect = scene.getBoundingClientRect();
      const cap = budget === "safe" ? 1.25 : budget === "immersive" ? 1.75 : 1.5;
      send("resize", {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        dpr: Math.min(window.devicePixelRatio || 1, cap)
      });
      keepNavigationFocusVisible();
      keepReadingFocusVisible();
      positionDestinationPeek(lastState);
      scheduleFraming();
    });
  }

  function scheduleFraming() {
    if (destroyed || framingFrame) return;
    framingFrame = window.requestAnimationFrame(() => {
      framingFrame = 0;
      const sceneRect = scene.getBoundingClientRect();
      const width = sceneRect.width, height = sceneRect.height;
      if (!width || !height) return;
      const consoleRect = observationConsole?.getBoundingClientRect();
      const consoleHeight = `${consoleRect?.height || 88}px`;
      if (root && root.style.getPropertyValue('--observation-console-height') !== consoleHeight) root.style.setProperty('--observation-console-height', consoleHeight);
      const observationBottom = consoleRect ? consoleRect.top - sceneRect.top - 16 : height - 24;
      const contextBottom = (masthead?.getBoundingClientRect().bottom || fields.position?.getBoundingClientRect().bottom || 60) - sceneRect.top;
      // Reserve room for short operation feedback without reframing on its expiry.
      const clearance = `${Math.max(120, contextBottom + 48).toFixed(2)}px`;
      if (root && root.style.getPropertyValue('--observation-clearance') !== clearance) root.style.setProperty('--observation-clearance', clearance);
      let area = { x: 0, y: 0, width, height }, panels = [];
      if (ready && guide && !guide.hidden) {
        const card = guide.getBoundingClientRect();
        const space = guide.querySelector('.guide-card__space').getBoundingClientRect();
        if (getComputedStyle(guide).visibility !== 'hidden') panels = [{ x: card.left - sceneRect.left, y: card.top - sceneRect.top, width: card.width, height: card.height }];
        // Reading a map overlays the held view. Near observation retains the
        // existing composition and silhouette fit beside the reading card.
        if (root.dataset.spaceView !== 'map') {
        const top = Math.max(80, contextBottom + 16);
        const above = { x: 16, y: top, width: Math.max(1, width - 32), height: Math.max(1, space.top - sceneRect.top - top - 22) };
        const right = { x: card.right - sceneRect.left + 22, y: top,
          width: Math.max(0, width - 24 - (card.right - sceneRect.left + 22)), height: Math.max(1, observationBottom - top) };
        area = above.width * above.height >= right.width * right.height ? above : right;
        }
      }
      // UI exclusion affects annotations and discovery only. The reading
      // area's camera composition above remains independent of these boxes.
      for (const element of root?.querySelectorAll('.observatory-masthead,.observation-console,.destination-panel,.quality-panel,.guide-restore,.destination-peek') || []) {
        if (element.hidden || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) panels.push({ x: rect.left - sceneRect.left, y: rect.top - sceneRect.top, width: rect.width, height: rect.height });
      }
      const centerX = Math.max(0, Math.min(1, (area.x + area.width / 2) / width));
      const centerY = Math.max(0, Math.min(1, (area.y + area.height / 2) / height));
      const key = [centerX, centerY, area.x, area.y, area.width, area.height, ...panels.flatMap(panel => [panel.x, panel.y, panel.width, panel.height])].map(value => value.toFixed(4)).join(':');
      if (key !== framingKey) { framingKey = key; send('framing', { centerX, centerY, area, panels }); }
    });
  }

  function updateState(state) {
    if (!state) return;
    if (state.sceneMotion) updateSceneMotion(state.sceneMotion);
    updateObservationContext(state);
    const progress = Number.isFinite(state.scaleAxisProgress) ? Math.max(0, Math.min(1, state.scaleAxisProgress)) : 0;
    if (scaleAxis) {
      scaleAxis.style.setProperty("--scale-progress", String(progress));
      scaleAxis.dataset.lod = state.lod || "Galactic";
      scaleAxis.dataset.stage = state.scaleStage || "Galactic";
      const travelling = Math.abs(state.scaleAxisTargetProgress - progress) > 0.004;
      for (const tick of stageTicks) {
        const name = scaleName(tick.dataset.level, state.observedKind);
        updateScaleLabel(tick, name, state.observedKind);
        const current = tick.dataset.level === state.scaleStage;
        tick.dataset.current = String(current);
        tick.setAttribute('aria-current', String(current));
        const stop = state.scaleStops?.find(item => item.stage === tick.dataset.level);
        if (stop) tick.dataset.progress = String(stop.progress);
        tick.dataset.destination = String(travelling && !!stop && Math.abs(stop.progress - state.scaleAxisTargetProgress) < 0.001);
      }
      if (scaleSlider && !scaleEditing && Number.isFinite(state.scaleAxisTargetProgress)) {
        scaleSlider.value = String(Math.round(state.scaleAxisTargetProgress * 1000));
        const stage = scaleName(state.scaleStage, state.observedKind, state.insideNebula);
        scaleSlider.setAttribute('aria-valuetext', travelling ? copy.scaleTravel(Math.round(state.scaleAxisTargetProgress * 100), stage) : stage);
      }
    }
    updateGuide(state);
    renderTrail(state);
    lastState = state;
    if (Array.isArray(state.destinationViews) && !destinationPanel?.hidden && navigationView === 'browse') {
      const previousVisible = [...destinationViews].filter(([, value]) => destinationInView(value)).map(([id]) => id).join(',');
      destinationViews = new Map(state.destinationViews.map(view => [view.id, view.direction]));
      const currentVisible = [...destinationViews].filter(([, value]) => destinationInView(value)).map(([id]) => id).join(',');
      if (visibleDestinationsOnly && previousVisible !== currentVisible) renderDestinations({ preserve: true });
      else {
        updateDestinationViews();
        const matches = browseDestinations(availableDestinations, { category: destinationCategory, query: searchField?.value.trim() || '', region: destinationRegion,
          visibleIds: new Set([...destinationViews].filter(([, value]) => destinationInView(value)).map(([id]) => id)) });
        const text = copy.inViewCount(matches.length);
        if (visibleDestinationsButton && visibleDestinationsButton.textContent !== text) visibleDestinationsButton.textContent = text;
      }
    }
    if(navigationPeek && destinationPeekDirection) {
      const direction=state.destinationPreview?.id===navigationPeek.id?state.destinationPreview.direction:null;
      destinationPeekDirection.textContent=copy.destinationDirections[direction]||'';
      positionDestinationPeek(state);
    }
    if (!debugEnabled) return;
    window.__universeObservatoryState = { ...state, runtimeVersion: VERSION };
    if (debug) debug.textContent = [
      `${VERSION} · WebGPU · ${number(state.fps)} RAF · ${number(state.frameMs, 1)} ms`,
      state.performance ? `GPU p95 ${number(state.performance.gpuMsP95, 2)} ms · CPU p95 ${number(state.performance.cpuMsP95, 2)} ms` : '',
      `${scaleName(state.scaleStage, state.observedKind, state.insideNebula)} · ${copy.debug.active} ${state.active || "—"}`,
      `${copy.debug.catalog} ${number(state.catalog)} · ${copy.debug.draw} ${number(state.draw)} · ${copy.debug.labels} ${number(state.labels)}`,
      `${copy.debug.distance} ${number(state.distance, 2)} → ${number(state.distanceTarget, 2)}`
    ].join("\n");
  }

  function destroy() {
    if (destroyed) return;
    releaseCapture();
    if (capturePreview?.open) capturePreview.close();
    if (qualityPanel?.open) qualityPanel.close();
    send("destroy");
    destroyed = true;
    events.abort();
    observer?.disconnect();
    framingObserver?.disconnect();
    window.cancelAnimationFrame(resizeFrame);
    window.cancelAnimationFrame(framingFrame);
    window.clearTimeout(statusTimer);
    worker?.terminate();
    scene.classList.remove("is-dragging");
    if (debugEnabled) delete window.__universeObservatoryState;
  }

  const hasRuntime = "Worker" in window && "OffscreenCanvas" in window &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype && "gpu" in navigator;
  if (!hasRuntime) {
    unavailable(copy.unsupported);
    return { destroy };
  }

  setStatus(copy.boot);
  try {
    const workerUrl = new URL("./stars-observatory-worker.js", import.meta.url);
    workerUrl.searchParams.set("v", VERSION);
    worker = new Worker(workerUrl, { type: "module", name: "stellar-observatory" });
    worker.onmessage = ({ data: message }) => {
      if (destroyed || failed || !message) { message?.bitmap?.close(); return; }
      if (message.type === "boot") setStatus(copy.boot);
      else if (message.type === "firstLight") setStatus(copy.firstLight);
      else if (message.type === "ready") {
        ready = true;
        if (captureButton) captureButton.disabled = false;
        if (qualityButton) qualityButton.disabled = false;
        if (dynamicsButton) dynamicsButton.disabled = false;
        if (Array.isArray(message.destinations)) { availableDestinations = message.destinations; renderDestinations(); renderRoutes(); }
        renderSystem(message.system, message.localFamilies);
        if (lastState) updateGuide(lastState);
        if (root) root.dataset.state = "ready";
        scene.setAttribute("aria-busy", "false");
        setStatus(copy.ready, true);
        scheduleFraming();
      } else if (message.type === "state") updateState(message.state);
      else if (message.type === 'quality-ready') { updateQuality(message.key); setStatus(copy.qualityReady(copy.qualityNames[qualityKey]), true, 'event'); }
      else if (message.type === 'quality-error') { updateQuality(qualityKey, true); setStatus(copy.qualityFailed, true, 'event'); }
      else if (message.type === 'capture') void receiveCapture(message);
      else if (message.type === 'capture-error' && message.id === pendingCaptureId) { releaseCapture(); setStatus(copy.captureFailed, true, 'event'); }
      else if (message.type === "error") unavailable(copy.failed, message.message);
    };
    worker.onerror = (event) => unavailable(copy.failed, event.message);
    worker.onmessageerror = () => unavailable(copy.failed);
    const sceneOffscreen = scene.transferControlToOffscreen();
    const labelsOffscreen = labels.transferControlToOffscreen();
    worker.postMessage({
      type: "init",
      scene: sceneOffscreen,
      labels: labelsOffscreen,
      config: {
        debug: debugEnabled,
        budget,
        catalog: intParam(params, "catalog", 0, 1000, 50000),
        seed: intParam(params, "seed", 728281, 1, 2147483646),
        target: params.get("target") || "",
        language,
        displayNames: targetDisplayNames(language),
        reducedMotion: motionPreference.matches
      }
    }, [sceneOffscreen, labelsOffscreen]);
  } catch (error) {
    unavailable(copy.failed, error);
    return { destroy };
  }

  observer = new ResizeObserver(resize);
  observer.observe(scene);
  framingObserver = new ResizeObserver(scheduleFraming);
  if (guide) framingObserver.observe(guide);
  if (viewTools) framingObserver.observe(viewTools);
  if (observationConsole) framingObserver.observe(observationConsole);
  if (masthead) framingObserver.observe(masthead);
  if (destinationPanel) framingObserver.observe(destinationPanel);
  if(destinationPeek) framingObserver.observe(destinationPeek);
  if (scaleAxis) framingObserver.observe(scaleAxis);
  if (destinationPanel) listen(destinationPanel, 'focusin', keepNavigationFocusVisible);
  listen(window, "resize", resize, { passive: true });
  listen(motionPreference, "change", (event) => {
    updateSceneMotion({ mode: lastState?.sceneMotion?.mode || 'flow', reduced: event.matches });
    send("preferences", { reducedMotion: event.matches });
  });
  resize();

  if (scaleAxis) {
    listen(scaleAxis, 'click', event => {
      const tick = event.target.closest('[data-level]');
      if (!ready || !tick || !Number.isFinite(Number(tick.dataset.progress))) return;
      send('scale', { progress: Number(tick.dataset.progress) });
      setStatus(copy.scaleSelected(tick.dataset.label), true);
    });
    listen(scaleAxis, 'wheel', event => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientHeight : 1;
      send('wheel', { deltaY: event.deltaY * unit });
    }, { passive: false });
  }
  if (scaleSlider) {
    listen(scaleSlider, 'keydown', event => {
      if (!ready || (event.key !== 'Home' && event.key !== 'End')) return;
      event.preventDefault();
      const progress = event.key === 'End' ? 1 : 0;
      scaleSlider.value = String(progress * 1000);
      send('scale', { progress });
      setStatus(copy.scaleScrub, true);
    });
    listen(scaleSlider, 'input', () => {
      if (!ready) return;
      send('scale', { progress: Number(scaleSlider.value) / 1000 });
      setStatus(copy.scaleScrub, true);
    });
    listen(scaleSlider, 'pointerdown', () => { scaleEditing = true; });
    listen(window, 'pointerup', () => { scaleEditing = false; });
    listen(scaleSlider, 'pointercancel', () => { scaleEditing = false; });
    listen(scaleSlider, 'blur', () => { scaleEditing = false; });
  }

  if (controls) {
    if (guideTabs) listen(guideTabs, 'keydown', event => {
      const buttons = guideModeButtons.filter(button => !button.hidden);
      const index = buttons.indexOf(event.target);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) : buttons[(index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length];
      event.preventDefault();next.focus({ preventScroll: true });showGuideSection(next.dataset.guideView);
    });
    const relatedButtons = () => [...relationGroup?.querySelectorAll('[data-related-id]') || []].filter(button => button.getClientRects().length);
    if (relatedSearch) {
      listen(relatedSearch, 'input', filterRelations);
      listen(relatedSearch, 'keydown', event => {
        if (event.key === 'ArrowDown') { relatedButtons()[0]?.focus();event.preventDefault(); }
        else if (event.key === 'Enter') { relatedButtons()[0]?.click();event.preventDefault(); }
      });
    }
    if (relationGroup) listen(relationGroup, 'keydown', event => {
      const buttons = relatedButtons(), index = buttons.indexOf(event.target);
      if (index < 0 || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) relatedSearch?.focus();
      else buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    });
    if(galaxyRegionOptions) {
      listen(galaxyRegionOptions,'pointerover',event=>{galaxyRegionHover=event.target.closest('button[data-region]')?.dataset.region||null;syncGalaxyRegionPreview();});
      listen(galaxyRegionOptions,'pointerleave',()=>{galaxyRegionHover=null;syncGalaxyRegionPreview();});
      listen(galaxyRegionOptions,'focusin',()=>syncGalaxyRegionPreview());
      listen(galaxyRegionOptions,'focusout',()=>queueMicrotask(()=>syncGalaxyRegionPreview()));
    }
    if(fields.destinations) {
      listen(fields.destinations,'pointerover',event=>{const id=event.target.closest('[data-preview-id]')?.dataset.previewId;destinationHover=id===undefined?null:Number(id);syncDestinationPreview();});
      listen(fields.destinations,'pointerleave',()=>{destinationHover=null;syncDestinationPreview();});
    }
    if(destinationPanel) {
      listen(destinationPanel,'focusin',()=>syncDestinationPreview());
      listen(destinationPanel,'focusout',()=>queueMicrotask(()=>syncDestinationPreview()));
    }
    if (guide) listen(guide, 'focusin', keepReadingFocusVisible);
    if (qualityPanel && qualityOptions) {
      listen(qualityOptions, 'change', event => {
        const key = event.target.value;
        if (!ready || qualityPending || key === qualityKey) return;
        qualityPending = true;
        qualityOptions.disabled = true;
        qualityPanel.setAttribute('aria-busy', 'true');
        if (qualityFeedback) qualityFeedback.textContent = copy.qualityPreparing;
        send('quality', { key });
      });
      listen(qualityPanel, 'close', () => restoreDialogFocus(qualityPanel, qualityButton));
      listen(qualityPanel, 'keydown', event => {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(qualityPanel.querySelectorAll('button, input:checked')).filter(element => !element.matches(':disabled'));
        const first = focusable[0], last = focusable.at(-1);
        const next = event.shiftKey && document.activeElement === first ? last : !event.shiftKey && document.activeElement === last ? first : null;
        if (next) { event.preventDefault(); next.focus(); }
      });
    }
    if (capturePreview) {
      listen(capturePreview, 'close', () => {
        releaseCapture();
        if (!destroyed && !failed) { restoreDialogFocus(capturePreview, captureButton); setStatus(copy.ready, true); }
      });
      listen(capturePreview, 'keydown', event => {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(capturePreview.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]'))
          .filter(element => !element.disabled && element.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        const destination = event.shiftKey && document.activeElement === first ? last : !event.shiftKey && document.activeElement === last ? first : null;
        if (destination) { event.preventDefault(); destination.focus(); }
      });
    }
    if (searchField) {
      listen(searchField, 'input', renderDestinations);
      listen(searchField, 'keydown', event => {
        if (event.key === 'ArrowDown') { visibleDestinationButtons()[0]?.focus(); event.preventDefault(); }
        else if (event.key === 'Enter') { visibleDestinationButtons()[0]?.click(); event.preventDefault(); }
      });
    }
    listen(controls, 'keydown', event => {
      const buttons = visibleDestinationButtons();
      const index = buttons.indexOf(event.target.closest('button'));
      if (index < 0) return;
      if (event.key === 'ArrowDown') { buttons[Math.min(buttons.length - 1, index + 1)]?.focus(); event.preventDefault(); }
      else if (event.key === 'ArrowUp') { if (index === 0 && navigationView === 'browse') searchField?.focus(); else buttons[Math.max(0, index - 1)]?.focus(); event.preventDefault(); }
    });
    listen(controls, 'click', event => {
      const button = event.target.closest('button');
      if (!button || !ready || button.disabled) return;
      if(button.dataset.action==='destination-peek') {peekDestination(button);return;}
      if(button.dataset.action==='destination-peek-back') {returnFromDestinationPeek();return;}
      if(button.dataset.action==='destination-peek-travel') {
        const target=navigationPeek?.target;
        toggleDestinations(false);
        if(target) send('focus',{target});
        scene.focus({preventScroll:true});return;
      }
      if (button.dataset.action === 'inspect') inspectSurface();
      if (button.dataset.action === 'terrain') {
        send('terrain');
        scene.focus({ preventScroll: true });
        setStatus(motionPreference.matches ? copy.terrainReady : copy.terrainTurning, true);
      }
      if (button.dataset.action === 'sunlit') {
        send('sunlit');
        scene.focus({ preventScroll: true });
        setStatus(motionPreference.matches ? copy.sunlitReady : copy.sunlitTurning, true);
      }
      else if (button.dataset.action === 'capture') requestCapture();
      else if (button.dataset.action === 'close-capture') capturePreview.close();
      else if (button.dataset.action === 'quality') { toggleDestinations(false); qualityPanel?.showModal(); qualityOptions?.querySelector('input:checked')?.focus(); }
      else if (button.dataset.action === 'close-quality') qualityPanel?.close();
      else if (pendingCaptureId !== null) return;
      else if (button.dataset.action === 'dynamics') toggleDestinations(destinationPanel.hidden || !motionDisclosure.open, { view: 'motion', opener: button });
      else if (button.dataset.action === 'browse-navigation') toggleDestinations(true);
      else if (button.dataset.action === 'route-navigation') {
        if (button === routeGuide || button === nextObservation) routePlanKey = activeRouteKey;
        toggleDestinations(true, { view: 'routes', opener: button });
      }
      else if (button.dataset.routePlan) {
        routePlanKey = button.dataset.routePlan;
        renderRoutes();
        routePlan.querySelector('[data-testid="route-name"]')?.focus({ preventScroll: true });
        navigationContent.scrollTop = 0;
      }
      else if (button.dataset.action === 'route-list') {
        routePlanKey = null;
        renderRoutes();
        routeCards[0]?.focus();
      }
      else if (button.dataset.action === 'route-next' || button.dataset.action === 'route-continue') {
        if (button === nextObservation) routePlanKey = activeRouteKey;
        const progress = routeSessions.get(routePlanKey) || createRouteProgress(routePlanKey);
        const next = nextRouteStop(progress, language);
        visitRouteStop(next?.target || describeExplorationRoute(routePlanKey)?.stops[0].target, { restart: !next });
      }
      else if (button.dataset.routeStop) visitRouteStop(button.dataset.routeStop);
      else if (button.dataset.action === 'route-leave') {
        activeRouteKey = null;
        renderRoutes();
        if (lastState) updateGuide(lastState);
        routeNext?.focus();
      }
      else if (button.dataset.action === 'system-navigation') toggleDestinations(true, { view: 'system', opener: button });
      else if (button.dataset.action === 'system-inner-overview' && availableSystem?.innerMemberIds?.length) {
        send('system-overview', { id: availableSystem.rootId, region: 'inner' });
        toggleDestinations(false);
        scene.focus({ preventScroll: true });
      }
      else if (button.dataset.action === 'system-overview' && availableSystem) {
        send('system-overview', { id: availableSystem.rootId });
        toggleDestinations(false);
        scene.focus({ preventScroll: true });
      }
      else if (button.dataset.action === 'system-local-overview' && localSystems.some(body => body.id === Number(button.dataset.rootId))) {
        send('system-overview', { id: Number(button.dataset.rootId), local: true });
        toggleDestinations(false);
        scene.focus({ preventScroll: true });
      }
      else if (button === visibleDestinationsButton || button === allDestinationsButton) {
        visibleDestinationsOnly = button === visibleDestinationsButton;
        renderDestinations();
      }
      else if (scopeButtons.includes(button)) {
        destinationRegion = button.dataset.region;
        destinationCategory = 'featured';
        if (searchField) searchField.value = '';
        renderDestinations();
      }
      else if (button.dataset.action === 'space-overview') {
        send('space-overview'); toggleDestinations(false); scene.focus({ preventScroll: true });
      }
      else if (DESTINATION_CATEGORIES.includes(button.dataset.category)) {
        destinationCategory = button.dataset.category;
        renderDestinations();
      }
      else if(button.dataset.action==='destination-filters') {
        if(navigationContent) navigationContent.scrollTop=0;
        (categoryButtons.find(item=>item.dataset.category===destinationCategory)||scopeButtons[0])?.focus();
      }
      else if (button.dataset.action === 'clear-search') {
        if (searchField) searchField.value = '';
        renderDestinations();
        searchField?.focus();
      }
      else if (button.dataset.revisit) {
        send('revisit', { id: Number(button.dataset.revisit) });
        toggleDestinations(false);
        scene.focus({ preventScroll: true });
      }
      else if (button.dataset.target) {
        send('focus', { target: button.dataset.target });
        toggleDestinations(false);
        scene.focus({ preventScroll: true });
      } else if (button.dataset.action === 'destinations') toggleDestinations(destinationPanel.hidden, { restoreFocus: !destinationPanel.hidden });
      else if (button.dataset.action === 'guide') toggleGuide();
      else if (button.dataset.action === 'map-details') showGuideSection('read');
      else if (button.dataset.action === 'guide-view') showGuideSection(button.dataset.guideView);
      else if(button.dataset.action==='galaxy-region' || button.dataset.action==='galaxy-whole') {
        clearGalaxyRegionPreview();
        send('galaxy-region',{key:button.dataset.action==='galaxy-whole'?null:button.dataset.region});
        scene.focus({preventScroll:true});
      }
      else if (button.dataset.action === 'overview') { send('overview'); toggleDestinations(false); scene.focus({ preventScroll: true }); }
      else if (button.dataset.action === 'approach' && lastState) { send('focus', { target: lastState.active, resume: lastState.navigationState === 'paused' }); scene.focus({ preventScroll: true }); }
      else if (button.dataset.action === 'resume' && lastState) { send('focus', { target: lastState.active, resume: true }); scene.focus({ preventScroll: true }); }
      else if (button.dataset.action === 'stop') { send('cancelFlight'); scene.focus({ preventScroll: true }); }
      else if (button.dataset.action === 'nearer') {
        if (button === closerButton && lastState?.surfaceInspection?.supported) inspectSurface();
        else if (button === closerButton && lastState?.observedKind === 'nebula' && !lastState.insideNebula) {
          send('nebula-entry');
        } else send('wheel', { deltaY: -220 });
      }
      else if (button.dataset.action === 'farther') send('wheel', { deltaY: 220 });
    });
    if (motionOptions) listen(motionOptions, 'change', event => {
      if (!ready || motionPreference.matches || !event.target.matches('input[name="scene-motion"]')) return;
      send('scene-motion', { mode: event.target.value });
    });
    if (motionDisclosure) listen(motionDisclosure, 'toggle', () => {
      dynamicsButton?.setAttribute('aria-expanded', String(!destinationPanel.hidden && motionDisclosure.open));
    });
    listen(document, 'keydown', event => {
      if (qualityPanel?.open || capturePreview?.open || pendingCaptureId !== null) return;
      const editable = event.target.matches('input, textarea, select') || event.target.isContentEditable;
      if (event.key === '/' && !editable && ready && !event.ctrlKey && !event.metaKey && !event.altKey) {
        toggleDestinations(true, { globalSearch: true });
        event.preventDefault();
      } else if(event.key==='Escape' && navigationPeek) {returnFromDestinationPeek();event.preventDefault();
      } else if (event.key === 'Escape' && destinationPanel && !destinationPanel.hidden) {
        toggleDestinations(false, { restoreFocus: true });
        event.preventDefault();
      } else if (event.key === 'Escape' && ready) send('cancelFlight');
    });
  }

  listen(scene, "pointerdown", (event) => {
    if (pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerId = event.pointerId;
    if(!navigationPeek) toggleDestinations(false);
    scene.focus({ preventScroll: true });
    try { scene.setPointerCapture(pointerId); } catch { /* Synthetic events cannot capture. */ }
    scene.classList.add("is-dragging");
    lastPoint = canvasPoint(event, scene);
    dragDistance = 0;
    downAt = performance.now();
    send("pointerdown", lastPoint);
  });

  listen(scene, "pointermove", (event) => {
    const point = canvasPoint(event, scene);
    if (pointerId === event.pointerId && lastPoint) {
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      dragDistance += Math.hypot(dx, dy);
      send("drag", { ...point, dx, dy });
      lastPoint = point;
    } else if (pointerId === null) send("pointermove", point);
  });

  function finishPointer(event, cancelled = false) {
    if (pointerId !== event.pointerId) return;
    const point = canvasPoint(event, scene);
    const completedPointer = pointerId;
    pointerId = null;
    lastPoint = null;
    scene.classList.remove("is-dragging");
    send("pointerup", point);
    if (!navigationPeek && !cancelled && dragDistance < 8 && performance.now() - downAt < 700) send("tap", point);
    try { scene.releasePointerCapture(completedPointer); } catch { /* Capture can already be released. */ }
  }

  listen(scene, "pointerup", (event) => finishPointer(event));
  listen(scene, "pointercancel", (event) => finishPointer(event, true));
  listen(scene, "lostpointercapture", (event) => finishPointer(event, true));
  listen(scene, "pointerleave", () => { if (pointerId === null) send("pointerleave"); });
  listen(scene, "wheel", (event) => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scene.clientHeight : 1;
    send("wheel", { deltaY: event.deltaY * unit, ctrlKey: event.ctrlKey });
  }, { passive: false });

  listen(scene, "keydown", (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey || !ready) return;
    const orbit = {
      ArrowLeft: { dx: -22, dy: 0 }, ArrowRight: { dx: 22, dy: 0 },
      ArrowUp: { dx: 0, dy: -22 }, ArrowDown: { dx: 0, dy: 22 }
    }[event.key];
    if (orbit) {
      const center = { x: scene.clientWidth / 2, y: scene.clientHeight / 2 };
      send("pointerdown", center);
      send("drag", { ...center, ...orbit });
      send("pointerup", center);
    } else if (event.key === "+" || event.key === "=") send("wheel", { deltaY: -160, ctrlKey: false });
    else if (event.key === "-" || event.key === "_") send("wheel", { deltaY: 160, ctrlKey: false });
    else if (event.key === "Home") { if(navigationPeek) toggleDestinations(false); send("reset"); }
    else if (event.key === "Escape") { if(navigationPeek) return; send("cancelFlight"); }
    else return;
    event.preventDefault();
    setStatus(copy.keyboard, true);
  });

  listen(scene, "focus", () => { if (ready && scene.matches(":focus-visible")) setStatus(copy.keyboard, true); });
  return { destroy };
}
