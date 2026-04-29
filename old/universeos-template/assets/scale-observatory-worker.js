import * as THREE from "https://esm.sh/three@0.180.0/webgpu";
import {
    clamp as tslClamp,
    color,
    dot,
    normalLocal,
    normalView,
    positionLocal,
    positionViewDirection,
    texture,
    time,
    uniform,
    uv,
    vec2
} from "https://esm.sh/three@0.180.0/tsl";

const MIN_DISTANCE = 24;
const MAX_DISTANCE = 40000;
const TAU = Math.PI * 2;
const LOD_HYSTERESIS = 0.12;
const TARGET_FLIGHT_MS = 900;
const STATE_INTERVAL = 1000 / 12;
const SKY_AZIMUTH_BINS = 24;
const SKY_ELEVATION_BINS = 12;
const CATALOG_VISIBILITY_INTERVAL = 120;
const LABEL_SELECTION_INTERVAL = 260;

let renderer = null;
let scene = null;
let camera = null;
let canvasSize = { width: 1, height: 1, dpr: 1 };
let targets = [];
let targetSprites = new Map();
let targetMaterials = new Map();
let targetOpticSprites = new Map();
let targetOpticMaterials = new Map();
let activeTarget = null;
let hoverTargetId = null;
let focusGroup = null;
let surfaceMesh = null;
let surfaceMaterial = null;
let surfaceUniforms = null;
let surfaceTexture = null;
let activityTexture = null;
let limbGlowMesh = null;
let limbGlowMaterial = null;
let chromosphereMesh = null;
let chromosphereMaterial = null;
let outlineMesh = null;
let outlineMaterial = null;
let paletteTexture = null;
let farField = null;
let farFieldMaterial = null;
let approachDustField = null;
let approachDustMaterial = null;
let starClusterField = null;
let starClusterMaterial = null;
let galaxyField = null;
let galaxyMaterial = null;
let galaxySparkField = null;
let galaxySparkMaterial = null;
let cosmicMistField = null;
let cosmicMistMaterial = null;
let galaxyBackdropLayers = [];
let galaxyBackdropOffset = { x: 0, y: 0 };
let brightStars = [];
let sceneLabels = [];
let sceneLabelTargets = [];
let labelHitTargets = [];
let lastLabelSelection = 0;
let lastLabelSelectionSignature = "";
let assetTextures = {};
let photosphereSprite = null;
let photosphereMaterial = null;
let haloSprite = null;
let haloMaterial = null;
let coronaSprite = null;
let coronaMaterial = null;
let flareSprites = [];
let prominenceSprites = [];
let activeRegime = "Cluster";
let disposed = false;
let initialized = false;
let firstFramePosted = false;
let initPhase = "boot";
let catalogCount = 0;
let visibleCatalogCount = 0;
let visibleLabelCount = 0;
let adaptiveLevel = 0;
let qualityTier = "standard";
let debugVisible = false;
let slowFrameWindows = 0;
let fastFrameWindows = 0;
let dragging = false;
let lastStatePost = 0;
let featuredTargets = [];
let catalogTargets = [];
let interactiveTargets = [];
let deepCatalogTargets = [];
let visibleCatalogTargets = [];
let nearCatalogTargets = [];
let skySectorIndex = new Map();
let catalogField = null;
let catalogMaterial = null;
let lastCatalogVisibilityUpdate = 0;
let lastCatalogVisibilitySignature = "";
let qualitySettings = {
    far: 36000,
    galaxy: 12000,
    spark: 1600,
    mist: 9000,
    approachDust: 2400,
    cluster: 5000,
    bright: 18,
    catalog: 10000,
    pickable: 3600,
    labels: 16,
    prominence: 0,
    backdropWidth: 3072,
    backdropHeight: 1536,
    backdropDustWidth: 2048,
    backdropDustHeight: 1024,
    backdropHazeWidth: 1536,
    backdropHazeHeight: 768,
    surfaceWidth: 2048,
    surfaceHeight: 1024,
    activityWidth: 1024,
    activityHeight: 512,
    sphereWidth: 224,
    sphereHeight: 112,
    label: "standard"
};
let measuredFps = 0;
let measuredFrameMs = 0;
let fpsFrames = 0;
let fpsTime = 0;
let fpsRenderMs = 0;

const clock = new THREE.Clock();
const focusCurrent = new THREE.Vector3();
const focusTarget = new THREE.Vector3();
const flightStart = new THREE.Vector3();
const flightEnd = new THREE.Vector3();
const cameraPosition = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUpVector = new THREE.Vector3();
const cameraLookDirection = new THREE.Vector3();
const cameraAimTarget = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const yawQuaternion = new THREE.Quaternion();
const pitchQuaternion = new THREE.Quaternion();
const pickVector = new THREE.Vector3();
const labelVector = new THREE.Vector3();
const labelAnchor = new THREE.Vector3();

const cameraState = {
    distance: MAX_DISTANCE,
    targetDistance: MAX_DISTANCE,
    yaw: Math.PI / 2,
    targetYaw: Math.PI / 2,
    pitch: 0.52,
    targetPitch: 0.52
};

const flightState = {
    active: false,
    startedAt: 0,
    targetId: null
};

const LOD_SCENE_PROFILES = {
    "Deep Field": {
        backdrop: 1.0,
        far: 0.96,
        galaxy: 0.12,
        cluster: 0.78,
        mist: 0.42,
        spark: 0.18,
        bright: 1.0,
        catalogTargets: 0.95,
        approachDust: 0,
        targetOptics: 0.42,
        targetSprites: 0.86,
        focusedStar: 0,
        optics: 0.55
    },
    Cluster: {
        backdrop: 0.62,
        far: 0.76,
        galaxy: 0.078,
        cluster: 0.68,
        mist: 0.34,
        spark: 0.12,
        bright: 0.62,
        catalogTargets: 1.0,
        approachDust: 0.28,
        targetOptics: 0.92,
        targetSprites: 1.0,
        focusedStar: 0.12,
        optics: 0.78
    },
    "System Approach": {
        backdrop: 0.32,
        far: 0.42,
        galaxy: 0.034,
        cluster: 0.34,
        mist: 0.3,
        spark: 0.075,
        bright: 0.34,
        catalogTargets: 0.64,
        approachDust: 1.18,
        targetOptics: 1.46,
        targetSprites: 0.56,
        focusedStar: 1.0,
        optics: 1.52
    },
    Surface: {
        backdrop: 0.025,
        far: 0.035,
        galaxy: 0,
        cluster: 0,
        mist: 0.015,
        spark: 0,
        bright: 0.035,
        catalogTargets: 0.035,
        approachDust: 0.06,
        targetOptics: 0.06,
        targetSprites: 0,
        focusedStar: 1.16,
        optics: 1.82
    }
};

const LOD_VISIBLE_BUDGETS = {
    "Deep Field": {
        visible: 132,
        labels: 10,
        pickable: 220,
        sectorRadius: 3
    },
    Cluster: {
        visible: 680,
        labels: 16,
        pickable: 720,
        sectorRadius: 3
    },
    "System Approach": {
        visible: 128,
        labels: 4,
        pickable: 180,
        sectorRadius: 1
    },
    Surface: {
        visible: 0,
        labels: 0,
        pickable: 12,
        sectorRadius: 0
    }
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function mix(a, b, t) {
    return a + (b - a) * t;
}

function inverseMix(a, b, value) {
    return clamp((value - a) / (b - a), 0, 1);
}

function smoothstep(edge0, edge1, value) {
    const t = inverseMix(edge0, edge1, value);
    return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function scaleFromDistance(distance) {
    const t = clamp((distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE), 0, 1);
    return Math.cbrt(t) * 100;
}

function wrapSignedRadians(value) {
    return Math.atan2(Math.sin(value), Math.cos(value));
}

function getTarget(id) {
    return targets.find((target) => target.id === id) || targets[0];
}

function targetPosition(target) {
    return new THREE.Vector3(target.position[0], target.position[1], target.position[2]);
}

function setVectorFromTarget(vector, target) {
    vector.set(target.position[0], target.position[1], target.position[2]);
    return vector;
}

function postBootProgress(phase, progress, detail) {
    initPhase = phase;
    self.postMessage({
        type: "bootProgress",
        phase,
        progress: clamp(progress, 0, 1),
        detail
    });
}

function yieldToRender() {
    return new Promise((resolve) => {
        if (typeof self.requestAnimationFrame === "function") {
            self.requestAnimationFrame(() => resolve());
            return;
        }

        setTimeout(resolve, 0);
    });
}

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean, 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function paletteColor(target, offset = 2) {
    if (!target?.palette?.length) {
        return "#ffd28a";
    }

    return target.palette[Math.max(0, target.palette.length - offset)] || target.palette[target.palette.length - 1];
}

function serializeTarget(target) {
    if (!target) {
        return null;
    }

    return {
        id: target.id,
        name: target.name,
        spectrum: target.spectrum,
        spectralIndex: target.spectralIndex,
        radius: target.radius,
        position: target.position,
        summary: target.summary,
        palette: target.palette,
        stability: target.stability,
        brightness: target.brightness,
        featured: Boolean(target.featured)
    };
}

const CATALOG_ARCHETYPES = [
    {
        spectrum: "G4 V",
        spectralIndex: 0.62,
        radius: [0.82, 1.08],
        stability: "Calm",
        palette: ["#230704", "#7f260d", "#e17326", "#ffd074", "#fff6db"],
        brightness: [0.46, 0.82],
        summary: "A stable knowledge star suspended in the wider observatory field."
    },
    {
        spectrum: "K2 IV",
        spectralIndex: 0.86,
        radius: [0.92, 1.22],
        stability: "Luminous",
        palette: ["#210806", "#7b2a14", "#d96e2b", "#ffbd74", "#fff1d0"],
        brightness: [0.38, 0.76],
        summary: "A warm subgiant marker for slow synthesis and adjacent discovery."
    },
    {
        spectrum: "M5 III",
        spectralIndex: 1.36,
        radius: [1.18, 1.72],
        stability: "Turbulent",
        palette: ["#160302", "#5a1008", "#c7391d", "#ff8f4c", "#ffd9a7"],
        brightness: [0.34, 0.72],
        summary: "A red convective body with broad, volatile surface activity."
    },
    {
        spectrum: "A3 V",
        spectralIndex: 0.18,
        radius: [0.68, 0.96],
        stability: "Sharp",
        palette: ["#06142a", "#155891", "#72c2ff", "#def4ff", "#ffffff"],
        brightness: [0.52, 0.94],
        summary: "A blue-white navigation star with a crisp optical signature."
    },
    {
        spectrum: "F6 V",
        spectralIndex: 0.42,
        radius: [0.78, 1.06],
        stability: "Luminous",
        palette: ["#072324", "#0f696e", "#66edcf", "#d4fff5", "#ffffff"],
        brightness: [0.44, 0.86],
        summary: "A cyan connective star for spacious route-finding states."
    },
    {
        spectrum: "DA3",
        spectralIndex: 0.02,
        radius: [0.44, 0.66],
        stability: "Dense",
        palette: ["#151d34", "#627196", "#d9e7ff", "#ffffff", "#ffffff"],
        brightness: [0.58, 1.0],
        summary: "A compact white archive point with hard, concentrated light."
    },
    {
        spectrum: "B9 X",
        spectralIndex: 0.08,
        radius: [0.55, 0.82],
        stability: "Volatile",
        palette: ["#130622", "#4c2178", "#af7cff", "#ead2ff", "#ffffff"],
        brightness: [0.5, 0.96],
        summary: "A violet anomaly star whose edge glow hints at unstable signals."
    }
];

const CATALOG_NAME_ROOTS = [
    "Aster", "Boreal", "Cinder", "Dawn", "Eidolon", "Farrow", "Gleam", "Hollow",
    "Ion", "Jade", "Kepler", "Lumen", "Morrow", "Nadir", "Orion", "Pale",
    "Quanta", "Rime", "Solace", "Tidal", "Umbra", "Vesper", "Warden", "Zenith"
];

const CATALOG_NAME_SUFFIXES = [
    "Gate", "Index", "Field", "Archive", "Forge", "Veil", "Beacon", "Harbor",
    "Well", "Spire", "Array", "Signal", "Crown", "Wake", "Mirror", "Drift"
];

function normalizeFeaturedTargets(sourceTargets = []) {
    return sourceTargets.map((target, index) => ({
        ...target,
        featured: true,
        seed: hashString(`featured-${target.id}`),
        brightness: target.brightness ?? (0.74 + index * 0.025)
    }));
}

function generateCatalogTargets(count, existing = []) {
    const generated = [];
    const random = seededRandom(0x5ed17a1);
    const usedIds = new Set(existing.map((target) => target.id));
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i += 1) {
        const archetype = CATALOG_ARCHETYPES[Math.floor(random() * CATALOG_ARCHETYPES.length)];
        const t = (i + 0.5) / Math.max(1, count);
        const yBase = 1 - 2 * t;
        const theta = i * goldenAngle + (random() - 0.5) * 0.12;
        const jitter = (random() - 0.5) * 0.045;
        const dy = clamp(yBase + jitter, -0.98, 0.98);
        const adjustedRadius = Math.sqrt(Math.max(0, 1 - dy * dy));
        const shell = 6200 + Math.pow(random(), 0.58) * 33500;
        const swirl = Math.sin(theta * 2.1 + dy * 3.4) * 0.035;
        const x = Math.cos(theta + swirl) * adjustedRadius * shell;
        const y = dy * shell;
        const z = Math.sin(theta - swirl) * adjustedRadius * shell;
        const radius = mix(archetype.radius[0], archetype.radius[1], random());
        const brightness = mix(archetype.brightness[0], archetype.brightness[1], Math.pow(random(), 0.72));
        const root = CATALOG_NAME_ROOTS[Math.floor(random() * CATALOG_NAME_ROOTS.length)];
        const suffix = CATALOG_NAME_SUFFIXES[Math.floor(random() * CATALOG_NAME_SUFFIXES.length)];
        let id = `catalog-${i.toString(36)}-${hashString(`${root}-${suffix}-${i}`).toString(36).slice(0, 4)}`;
        while (usedIds.has(id)) {
            id = `${id}-${Math.floor(random() * 999)}`;
        }
        usedIds.add(id);

        generated.push({
            id,
            name: `${root} ${suffix}`,
            spectrum: archetype.spectrum,
            spectralIndex: archetype.spectralIndex,
            radius,
            position: [x, y, z],
            summary: archetype.summary,
            palette: archetype.palette,
            stability: archetype.stability,
            brightness,
            seed: hashString(id),
            featured: false
        });
    }

    return generated;
}

function skySectorKeyFromVector(x, y, z) {
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = clamp(y / length, -1, 1);
    const nz = z / length;
    const azimuth = (Math.atan2(nz, nx) + TAU) % TAU;
    const elevation = Math.asin(ny);
    const azimuthIndex = Math.floor((azimuth / TAU) * SKY_AZIMUTH_BINS) % SKY_AZIMUTH_BINS;
    const elevationIndex = clamp(
        Math.floor(((elevation + Math.PI / 2) / Math.PI) * SKY_ELEVATION_BINS),
        0,
        SKY_ELEVATION_BINS - 1
    );
    return `${azimuthIndex}:${elevationIndex}`;
}

function skySectorKeyForTarget(target) {
    const [x, y, z] = target.position;
    return skySectorKeyFromVector(x, y, z);
}

function skySectorNeighborKeys(centerKey, radius = 1) {
    const [azimuthText, elevationText] = centerKey.split(":");
    const azimuth = Number(azimuthText);
    const elevation = Number(elevationText);
    const keys = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
        const elevationIndex = elevation + dy;
        if (elevationIndex < 0 || elevationIndex >= SKY_ELEVATION_BINS) {
            continue;
        }

        for (let dx = -radius; dx <= radius; dx += 1) {
            const azimuthIndex = (azimuth + dx + SKY_AZIMUTH_BINS) % SKY_AZIMUTH_BINS;
            keys.push(`${azimuthIndex}:${elevationIndex}`);
        }
    }

    return keys;
}

function buildSkySectorIndex(perSectorLimit = 6) {
    skySectorIndex = new Map();
    catalogTargets.forEach((target) => {
        const key = skySectorKeyForTarget(target);
        if (!skySectorIndex.has(key)) {
            skySectorIndex.set(key, []);
        }
        skySectorIndex.get(key).push(target);
    });

    skySectorIndex.forEach((sectorTargets, key) => {
        sectorTargets.sort((a, b) => (b.brightness || 0) - (a.brightness || 0));
        skySectorIndex.set(key, sectorTargets.slice(0, perSectorLimit));
    });
}

function buildInteractiveTargets(limit = 384) {
    const sectors = Math.max(1, SKY_AZIMUTH_BINS * SKY_ELEVATION_BINS);
    const perSectorLimit = Math.max(2, Math.ceil(Math.max(0, limit - featuredTargets.length) / sectors));
    buildSkySectorIndex(perSectorLimit);
    const selected = [];
    skySectorIndex.forEach((sectorTargets) => {
        selected.push(...sectorTargets);
    });
    deepCatalogTargets = [...catalogTargets]
        .sort((a, b) => catalogImportance(b) - catalogImportance(a))
        .slice(0, Math.max(limit, 128));
    interactiveTargets = [...featuredTargets, ...selected]
        .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.brightness || 0) - (a.brightness || 0));
}

function currentInteractiveTargets() {
    const selected = new Map();
    featuredTargets.forEach((target) => selected.set(target.id, target));
    if (activeTarget) {
        selected.set(activeTarget.id, activeTarget);
    }
    if (hoverTargetId) {
        const hoverTarget = targets.find((target) => target.id === hoverTargetId);
        if (hoverTarget) {
            selected.set(hoverTarget.id, hoverTarget);
        }
    }

    visibleCatalogTargets.forEach((target) => selected.set(target.id, target));

    return Array.from(selected.values());
}

function catalogImportance(target) {
    return (target.featured ? 100 : 0) +
        (target.brightness || 0.5) * 64 +
        Math.sqrt(target.radius || 1) * 16 +
        (target.stability === "Volatile" ? 5 : 0);
}

function distanceSqToTarget(target, vector) {
    const dx = target.position[0] - vector.x;
    const dy = target.position[1] - vector.y;
    const dz = target.position[2] - vector.z;
    return dx * dx + dy * dy + dz * dz;
}

function recommendedFocusDistance(currentDistance) {
    if (currentDistance > 2500) {
        return 1400;
    }

    if (currentDistance > 400) {
        return 260;
    }

    if (currentDistance > 70) {
        return 72;
    }

    return currentDistance;
}

function getVisibleCatalogBudget() {
    const base = LOD_VISIBLE_BUDGETS[activeRegime] || LOD_VISIBLE_BUDGETS.Cluster;
    const adaptiveScale = adaptiveLevel === 0 ? 1 : adaptiveLevel === 1 ? 0.72 : 0.5;
    return {
        ...base,
        visible: Math.max(0, Math.round(base.visible * adaptiveScale)),
        labels: Math.max(0, Math.round(base.labels * adaptiveScale)),
        pickable: Math.max(0, Math.round(base.pickable * adaptiveScale))
    };
}

function mapCenterSectorVector() {
    if (focusCurrent.lengthSq() > 0.0001) {
        return focusCurrent;
    }

    return cameraLookDirection.lengthSq() > 0.0001 ? cameraLookDirection : worldUp;
}

function collectSectorTargets(radius = 1) {
    if (!skySectorIndex.size) {
        return [];
    }

    const center = mapCenterSectorVector();
    const centerKey = skySectorKeyFromVector(center.x, center.y, center.z);
    const selected = [];
    skySectorNeighborKeys(centerKey, radius).forEach((key) => {
        selected.push(...(skySectorIndex.get(key) || []));
    });
    return selected;
}

function rebuildNearCatalogTargets() {
    if (!activeTarget) {
        nearCatalogTargets = [];
        return;
    }

    const center = targetPosition(activeTarget);
    nearCatalogTargets = [...catalogTargets]
        .sort((a, b) => distanceSqToTarget(a, center) - distanceSqToTarget(b, center))
        .slice(0, 180);
}

function selectVisibleCatalogTargets() {
    const budget = getVisibleCatalogBudget();
    if (budget.visible <= 0) {
        visibleCatalogTargets = [];
        return visibleCatalogTargets;
    }

    const selected = new Map();
    featuredTargets.forEach((target) => selected.set(target.id, target));
    if (activeTarget) {
        selected.set(activeTarget.id, activeTarget);
    }
    if (hoverTargetId) {
        const hoverTarget = targets.find((target) => target.id === hoverTargetId);
        if (hoverTarget) {
            selected.set(hoverTarget.id, hoverTarget);
        }
    }

    let candidates = [];
    if (activeRegime === "Deep Field") {
        candidates = deepCatalogTargets;
    } else if (activeRegime === "Cluster") {
        candidates = collectSectorTargets(budget.sectorRadius)
            .sort((a, b) => catalogImportance(b) - catalogImportance(a));
    } else if (activeRegime === "System Approach") {
        candidates = nearCatalogTargets;
    }

    for (const target of candidates) {
        if (selected.size >= budget.visible) {
            break;
        }
        selected.set(target.id, target);
    }

    if (selected.size < budget.visible && activeRegime !== "System Approach") {
        for (const target of deepCatalogTargets) {
            if (selected.size >= budget.visible) {
                break;
            }
            selected.set(target.id, target);
        }
    }

    visibleCatalogTargets = Array.from(selected.values()).slice(0, budget.visible);
    return visibleCatalogTargets;
}

function catalogVisibilitySignature(selected) {
    const anchor = mapCenterSectorVector();
    const sectorKey = skySectorKeyFromVector(anchor.x, anchor.y, anchor.z);
    const sample = selected.slice(0, 10).map((target) => target.id).join(",");
    return `${activeRegime}:${adaptiveLevel}:${activeTarget?.id || ""}:${hoverTargetId || ""}:${sectorKey}:${selected.length}:${sample}`;
}

function labelSelectionSignature(maxLabels) {
    const anchor = mapCenterSectorVector();
    const sectorKey = skySectorKeyFromVector(anchor.x, anchor.y, anchor.z);
    const distanceBand = Math.round(scaleFromDistance(cameraState.distance) / 6);
    return `${activeRegime}:${adaptiveLevel}:${activeTarget?.id || ""}:${sectorKey}:${maxLabels}:${visibleCatalogCount}:${distanceBand}`;
}

function updateCatalogVisibility(force = false) {
    if (!catalogField?.geometry) {
        visibleCatalogCount = 0;
        return;
    }

    const now = performance.now();
    if (!force && now - lastCatalogVisibilityUpdate < CATALOG_VISIBILITY_INTERVAL) {
        return;
    }

    const selected = selectVisibleCatalogTargets();
    const signature = catalogVisibilitySignature(selected);
    if (!force && signature === lastCatalogVisibilitySignature) {
        return;
    }

    const visibleIds = new Set(selected.map((target) => target.id));
    const colors = catalogField.geometry.getAttribute("color");
    targets.forEach((target, index) => {
        const base = target.catalogBaseColor || [0, 0, 0];
        const visible = visibleIds.has(target.id);
        const featured = Boolean(target.featured);
        const intensity = visible
            ? featured
                ? activeRegime === "Deep Field" ? 1.35 : 1.12
                : activeRegime === "Deep Field" ? 0.82 : activeRegime === "Cluster" ? 1.0 : 0.58
            : 0;
        colors.setXYZ(index, base[0] * intensity, base[1] * intensity, base[2] * intensity);
    });
    colors.needsUpdate = true;
    visibleCatalogCount = selected.length;
    lastCatalogVisibilityUpdate = now;
    lastCatalogVisibilitySignature = signature;
}

function lerpColor(stops, t) {
    const scaled = clamp(t, 0, 1) * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(scaled));
    const localT = scaled - index;
    const a = hexToRgb(stops[index]);
    const b = hexToRgb(stops[index + 1]);
    return [
        Math.round(mix(a[0], b[0], localT)),
        Math.round(mix(a[1], b[1], localT)),
        Math.round(mix(a[2], b[2], localT))
    ];
}

function makeDataTexture(data, width, height, colorSpace = THREE.SRGBColorSpace) {
    const textureObject = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
    textureObject.colorSpace = colorSpace;
    textureObject.wrapS = THREE.RepeatWrapping;
    textureObject.wrapT = THREE.RepeatWrapping;
    textureObject.minFilter = THREE.LinearFilter;
    textureObject.magFilter = THREE.LinearFilter;
    textureObject.generateMipmaps = false;
    textureObject.needsUpdate = true;
    return textureObject;
}

function configureTexture(textureObject, colorSpace = THREE.SRGBColorSpace) {
    textureObject.colorSpace = colorSpace;
    textureObject.wrapS = THREE.RepeatWrapping;
    textureObject.wrapT = THREE.RepeatWrapping;
    textureObject.minFilter = THREE.LinearFilter;
    textureObject.magFilter = THREE.LinearFilter;
    textureObject.generateMipmaps = false;
    textureObject.needsUpdate = true;
    return textureObject;
}

async function loadBitmapTexture(path, colorSpace = THREE.SRGBColorSpace) {
    if (typeof fetch !== "function" || typeof createImageBitmap !== "function") {
        return null;
    }

    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) {
        throw new Error(`Unable to load texture ${path}: ${response.status}`);
    }

    const bitmap = await createImageBitmap(await response.blob());
    return configureTexture(new THREE.Texture(bitmap), colorSpace);
}

async function loadLuminanceAlphaTexture(path) {
    if (typeof fetch !== "function" || typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
        return null;
    }

    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) {
        throw new Error(`Unable to load texture ${path}: ${response.status}`);
    }

    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const source = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const data = new Uint8Array(bitmap.width * bitmap.height * 4);

    for (let i = 0; i < bitmap.width * bitmap.height; i += 1) {
        const sourceIndex = i * 4;
        const r = source[sourceIndex];
        const g = source[sourceIndex + 1];
        const b = source[sourceIndex + 2];
        const luminance = Math.max(r, g, b);
        data[sourceIndex] = r;
        data[sourceIndex + 1] = g;
        data[sourceIndex + 2] = b;
        data[sourceIndex + 3] = Math.round(Math.pow(luminance / 255, 1.18) * 255);
    }

    return makeDataTexture(data, bitmap.width, bitmap.height);
}

function hashNoise(ix, iy) {
    let value = (ix * 374761393 + iy * 668265263) >>> 0;
    value = (value ^ (value >> 13)) >>> 0;
    value = Math.imul(value, 1274126177) >>> 0;
    return ((value ^ (value >> 16)) >>> 0) / 4294967295;
}

function valueNoisePeriodic(u, v, scaleX, scaleY) {
    const wrappedU = ((u % 1) + 1) % 1;
    const wrappedV = ((v % 1) + 1) % 1;
    const x = wrappedU * scaleX;
    const y = wrappedV * scaleY;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const ix0 = ((ix % scaleX) + scaleX) % scaleX;
    const iy0 = ((iy % scaleY) + scaleY) % scaleY;
    const ix1 = (ix0 + 1) % scaleX;
    const iy1 = (iy0 + 1) % scaleY;
    const a = hashNoise(ix0, iy0);
    const b = hashNoise(ix1, iy0);
    const c = hashNoise(ix0, iy1);
    const d = hashNoise(ix1, iy1);
    return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

function fbmPeriodic(u, v, scale, octaves = 5) {
    let value = 0;
    let amplitude = 0.54;
    let frequency = Math.max(2, Math.round(scale));
    let total = 0;

    for (let octave = 0; octave < octaves; octave += 1) {
        value += valueNoisePeriodic(u, v, frequency, Math.max(2, Math.round(frequency * 0.5))) * amplitude;
        total += amplitude;
        frequency *= 2;
        amplitude *= 0.52;
    }

    return value / total;
}

function surfaceProfile(target = {}) {
    const spectral = target.spectralIndex ?? 0.6;
    const stability = target.stability || "";
    const compact = target.radius < 0.7;
    const turbulent = stability === "Turbulent" || stability === "Volatile";
    const sharp = stability === "Sharp" || stability === "Dense";
    const seed = hashString(`${target.id || "star"}-${target.spectrum || "G"}`);

    return {
        seed,
        warp: compact ? 0.07 : turbulent ? 0.2 : 0.13,
        convectionScale: compact ? 13 : spectral > 1 ? 5.4 : sharp ? 10.5 : 7.8,
        cellScale: compact ? 34 : turbulent ? 14 : spectral < 0.25 ? 28 : 22,
        grainScale: compact ? 150 : turbulent ? 68 : 104,
        veins: turbulent ? 0.28 : sharp ? 0.08 : 0.17,
        contrast: turbulent ? 1.22 : sharp ? 0.74 : 0.95,
        spotCount: compact ? 3 : turbulent ? 12 : spectral > 1 ? 10 : 7,
        spotStrength: compact ? 0.22 : turbulent ? 0.72 : spectral > 1 ? 0.64 : 0.48,
        base: compact ? 0.56 : spectral < 0.25 ? 0.5 : spectral > 1 ? 0.38 : 0.45,
        grain: compact ? 0.18 : turbulent ? 0.34 : 0.26,
        banding: stability === "Volatile" ? 0.13 : stability === "Luminous" ? 0.08 : 0.04,
        facula: compact ? 0.12 : turbulent ? 0.24 : stability === "Luminous" ? 0.22 : 0.16,
        pores: compact ? 0.08 : turbulent ? 0.22 : spectral > 1 ? 0.18 : 0.13,
        superGranules: compact ? 19 : turbulent ? 8.5 : spectral > 1 ? 7.2 : 11.4
    };
}

function opticalProfile(target = {}) {
    const spectral = target.spectralIndex ?? 0.6;
    const radius = target.radius || 1;
    const stability = target.stability || "";
    const compact = radius < 0.7;
    const turbulent = stability === "Turbulent" || stability === "Volatile";
    const luminous = stability === "Luminous";
    const dense = stability === "Dense";
    const baseRotation = turbulent ? 0.36 : dense ? 0.18 : compact ? 0.24 : luminous ? 0.28 : spectral < 0.22 ? 0.32 : 0.25;

    return {
        surfaceScale: mix(0.9, 1.1, clamp((radius - 0.55) / 0.75, 0, 1)),
        haloScale: compact ? 3.9 : turbulent ? 5.25 : luminous ? 4.95 : 4.55,
        auraScale: compact ? 5.9 : turbulent ? 7.45 : luminous ? 6.9 : 6.28,
        coronaScale: compact ? 3.45 : turbulent ? 4.95 : luminous ? 4.55 : 4.15,
        haloOpacity: compact ? 0.28 : turbulent ? 0.42 : dense ? 0.25 : 0.33,
        auraOpacity: compact ? 0.078 : turbulent ? 0.154 : luminous ? 0.13 : 0.1,
        coronaOpacity: compact ? 0.128 : turbulent ? 0.24 : luminous ? 0.208 : 0.158,
        flareStrength: compact ? 0.92 : turbulent ? 1.55 : spectral < 0.12 ? 1.7 : 1.18,
        rotationSpeed: baseRotation,
        flowRotationSpeed: baseRotation * (turbulent ? 1.42 : compact ? 1.18 : 1.28),
        wobble: turbulent ? 0.052 : compact ? 0.018 : 0.034
    };
}

function surfaceShaderProfile(target = {}) {
    const spectral = target.spectralIndex ?? 0.6;
    const stability = target.stability || "";
    const compact = target.radius < 0.7;
    const turbulent = stability === "Turbulent" || stability === "Volatile";
    const dense = stability === "Dense";
    const sharp = stability === "Sharp";
    const seed = hashString(`${target.id || "star"}-${target.spectrum || "G"}`) % 4096;
    const luminous = stability === "Luminous";
    const whiteHot = compact || spectral < 0.12;

    return {
        seedOffset: seed / 4096,
        flowSpeed: turbulent ? 3.9 : compact ? 2.05 : sharp ? 2.55 : spectral < 0.25 ? 3.0 : 2.75,
        detailScale: compact ? 1.58 : turbulent ? 0.78 : spectral > 1 ? 0.72 : 1.08,
        microScale: compact ? 1.7 : turbulent ? 0.82 : dense ? 1.42 : 1.05,
        contrast: compact ? 0.88 : turbulent ? 1.34 : dense ? 0.76 : 1.12,
        bias: compact ? 0.2 : spectral < 0.25 ? 0.18 : turbulent ? 0.08 : 0.125,
        surfaceEmission: whiteHot ? 2.72 : turbulent ? 2.5 : spectral > 1 ? 2.36 : luminous ? 2.42 : 2.28
    };
}

function profileNoise(seed, index) {
    return hashNoise(seed + index * 7919, seed ^ (index * 104729));
}

function makeSurfaceTexture(width = 2048, height = 1024, target = activeTarget) {
    const data = new Uint8Array(width * height * 4);
    const profile = surfaceProfile(target);
    const spots = Array.from({ length: profile.spotCount }, (_, index) => {
        const su = profileNoise(profile.seed, index * 5 + 1);
        const sv = 0.22 + profileNoise(profile.seed, index * 5 + 2) * 0.56;
        const sx = 0.018 + profileNoise(profile.seed, index * 5 + 3) * (profile.contrast > 1 ? 0.075 : 0.04);
        const sy = 0.012 + profileNoise(profile.seed, index * 5 + 4) * (profile.contrast > 1 ? 0.038 : 0.022);
        const strength = profile.spotStrength * (0.42 + profileNoise(profile.seed, index * 5 + 5) * 0.78);
        return [su, sv, sx, sy, strength];
    });

    for (let y = 0; y < height; y += 1) {
        const v = y / height;
        for (let x = 0; x < width; x += 1) {
            const u = x / width;
            const seedOffset = (profile.seed % 997) / 997;
            const warpU = fbmPeriodic(u + seedOffset, v - 0.31, 4, 4) - 0.5;
            const warpV = fbmPeriodic(u - seedOffset * 0.7, v + 0.11, 5, 4) - 0.5;
            const warpedU = u + warpU * profile.warp;
            const warpedV = v + warpV * profile.warp * 0.7;
            const latitudeShear = Math.sin(v * Math.PI) * Math.sin((u * 1.8 + v * 0.7) * TAU) * profile.banding;
            const convection = fbmPeriodic(warpedU + latitudeShear * 0.18, warpedV, profile.convectionScale, 5);
            const cells = Math.abs(
                fbmPeriodic(
                    warpedU + convection * profile.warp * 0.72,
                    warpedV - convection * profile.warp * 0.52,
                    profile.cellScale,
                    4
                ) - 0.5
            ) * 2;
            const granulation = fbmPeriodic(warpedU + cells * 0.02, warpedV - cells * 0.018, profile.grainScale, 3);
            const superGranules = fbmPeriodic(warpedU - convection * 0.04, warpedV + granulation * 0.025, profile.superGranules, 4);
            const network = Math.pow(clamp(1 - Math.abs(superGranules - 0.52) * 5.4, 0, 1), 1.6);
            const pores = Math.pow(clamp(1 - granulation, 0, 1), 3.4) * profile.pores;
            const veins = Math.pow(1 - cells, 2.2) * profile.veins;
            const filament = Math.sin((u * (7 + (profile.seed % 7)) + v * (2.8 + profile.banding * 12)) * TAU) * profile.banding;
            let darkSpots = 0;

            spots.forEach(([su, sv, sx, sy, strength]) => {
                let dx = Math.abs(u - su);
                dx = Math.min(dx, 1 - dx);
                const dy = v - sv;
                darkSpots += Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy))) * strength;
            });

            const equator = Math.pow(Math.sin(v * Math.PI), 0.55);
            const value = clamp(
                profile.base +
                    (convection - 0.34) * 0.42 * profile.contrast +
                    granulation * profile.grain +
                    network * profile.facula -
                    pores +
                    veins * 1.22 +
                    equator * 0.045 +
                    filament -
                    darkSpots * 0.78,
                0,
                1
            );
            const shapedValue = clamp((value - 0.52) * 1.28 + 0.56, 0, 1);
            const i = (y * width + x) * 4;
            const channel = Math.round(shapedValue * 255);
            data[i] = channel;
            data[i + 1] = channel;
            data[i + 2] = channel;
            data[i + 3] = 255;
        }
    }

    return makeDataTexture(data, width, height, THREE.NoColorSpace);
}

function activityProfile(target = {}) {
    const spectral = target.spectralIndex ?? 0.6;
    const radius = target.radius || 1;
    const stability = target.stability || "";
    const compact = radius < 0.7;
    const turbulent = stability === "Turbulent" || stability === "Volatile";
    const dense = stability === "Dense";
    const luminous = stability === "Luminous";
    const sharp = stability === "Sharp";
    const seed = hashString(`activity-${target.id || "star"}-${target.spectrum || "G"}`);

    return {
        seed,
        spotCount: compact ? 2 : turbulent ? 14 : dense ? 3 : luminous ? 8 : 6,
        spotStrength: compact ? 0.28 : turbulent ? 0.78 : dense ? 0.2 : spectral > 1 ? 0.66 : 0.52,
        plageStrength: compact ? 0.28 : turbulent ? 0.72 : luminous ? 0.68 : sharp ? 0.38 : 0.48,
        streamStrength: turbulent ? 0.82 : luminous ? 0.58 : sharp ? 0.34 : compact ? 0.24 : 0.42,
        polarStrength: spectral < 0.12 ? 0.62 : turbulent ? 0.42 : 0.18,
        spotScale: compact ? 0.54 : turbulent ? 1.32 : spectral > 1 ? 1.5 : 1,
        laneFrequency: turbulent ? 8.5 : compact ? 15 : spectral > 1 ? 4.5 : 6.5
    };
}

function fillActivityData(data, width, height, target = activeTarget) {
    const profile = activityProfile(target);
    const spots = Array.from({ length: profile.spotCount }, (_, index) => {
        const su = profileNoise(profile.seed, index * 7 + 1);
        const sv = 0.16 + profileNoise(profile.seed, index * 7 + 2) * 0.68;
        const sx = (0.015 + profileNoise(profile.seed, index * 7 + 3) * 0.055) * profile.spotScale;
        const sy = (0.01 + profileNoise(profile.seed, index * 7 + 4) * 0.034) * profile.spotScale;
        const strength = profile.spotStrength * (0.45 + profileNoise(profile.seed, index * 7 + 5) * 0.72);
        const tilt = (profileNoise(profile.seed, index * 7 + 6) - 0.5) * 0.38;
        const plage = profile.plageStrength * (0.42 + profileNoise(profile.seed, index * 7 + 7) * 0.75);
        return [su, sv, sx, sy, strength, tilt, plage];
    });

    for (let y = 0; y < height; y += 1) {
        const v = y / height;
        const latitude = Math.abs(v - 0.5) * 2;
        for (let x = 0; x < width; x += 1) {
            const u = x / width;
            const drift = profileNoise(profile.seed, 91) * 0.23;
            const streamA = fbmPeriodic(
                u + Math.sin(v * Math.PI) * 0.045 + drift,
                v + Math.sin(u * TAU * 1.8) * 0.026,
                profile.laneFrequency,
                4
            );
            const streamB = fbmPeriodic(
                u * 0.84 - drift * 0.5,
                v + streamA * 0.12,
                profile.laneFrequency * 2.1,
                3
            );
            const belt = Math.pow(Math.sin(v * Math.PI), 0.65);
            const polar = Math.pow(latitude, 3.2) * profile.polarStrength;
            let dark = 0;
            let plage = 0;

            spots.forEach(([su, sv, sx, sy, strength, tilt, plageStrength]) => {
                let dx = Math.abs(u - su);
                dx = Math.min(dx, 1 - dx);
                const dy = v - sv;
                const lx = dx + dy * tilt;
                const core = Math.exp(-((lx * lx) / (sx * sx) + (dy * dy) / (sy * sy)));
                const halo = Math.exp(-((lx * lx) / (sx * sx * 6.8) + (dy * dy) / (sy * sy * 5.2)));
                dark += core * strength;
                plage += Math.max(0, halo - core * 0.35) * plageStrength;
            });

            const streams = Math.pow(clamp(streamA * 0.62 + streamB * 0.38, 0, 1), 1.55) * profile.streamStrength * belt;
            const activeNet = Math.pow(clamp(1 - Math.abs(streamB - 0.52) * 4.2, 0, 1), 1.4) * profile.streamStrength;
            const magnetic = clamp(streams * 0.68 + activeNet * 0.32 + polar, 0, 1);
            const i = (y * width + x) * 4;
            data[i] = Math.round(clamp(dark, 0, 1) * 255);
            data[i + 1] = Math.round(clamp(plage + magnetic * 0.22, 0, 1) * 255);
            data[i + 2] = Math.round(clamp(magnetic, 0, 1) * 255);
            data[i + 3] = 255;
        }
    }
}

function makeActivityTexture(width = 1024, height = 512, target = activeTarget) {
    const data = new Uint8Array(width * height * 4);
    fillActivityData(data, width, height, target);
    return makeDataTexture(data, width, height, THREE.NoColorSpace);
}

function updateActivityTexture(target) {
    if (!activityTexture?.image?.data) {
        return;
    }

    fillActivityData(activityTexture.image.data, activityTexture.image.width, activityTexture.image.height, target);
    activityTexture.needsUpdate = true;
}

function updateSurfaceUniforms(target) {
    if (!surfaceUniforms) {
        return;
    }

    const profile = surfaceShaderProfile(target);
    surfaceUniforms.seed.value = profile.seedOffset;
    surfaceUniforms.flowSpeed.value = profile.flowSpeed;
    surfaceUniforms.detailScale.value = profile.detailScale;
    surfaceUniforms.microScale.value = profile.microScale;
    surfaceUniforms.contrast.value = profile.contrast;
    surfaceUniforms.bias.value = profile.bias;
    surfaceUniforms.surfaceEmission.value = profile.surfaceEmission;
}

function makePaletteTexture(stops) {
    const width = 256;
    const data = new Uint8Array(width * 4);
    for (let x = 0; x < width; x += 1) {
        const [r, g, b] = lerpColor(stops, x / (width - 1));
        const i = x * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }

    return makeDataTexture(data, width, 1);
}

function updatePaletteTexture(stops) {
    if (!paletteTexture?.image?.data) {
        return;
    }

    const data = paletteTexture.image.data;
    const width = paletteTexture.image.width;
    for (let x = 0; x < width; x += 1) {
        const [r, g, b] = lerpColor(stops, x / (width - 1));
        const i = x * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
    }

    paletteTexture.needsUpdate = true;
}

function updateOpticalColors(target) {
    if (!target) {
        return;
    }

    const warm = target.palette[Math.max(0, target.palette.length - 2)];
    const rim = target.palette[target.palette.length - 1];
    const mid = target.palette[Math.max(0, target.palette.length - 3)];
    photosphereMaterial?.color.set(warm);
    haloMaterial?.color.set(warm);
    coronaMaterial?.color.set(mid);
    outlineMaterial?.color?.set?.(rim);
    flareSprites.forEach(({ material }) => material.color.set(rim));
}

function makeRadialTexture(size = 128, inner = [255, 255, 255], outer = [255, 190, 98], power = 2.4) {
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const dx = (x + 0.5 - half) / half;
            const dy = (y + 0.5 - half) / half;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const alpha = Math.pow(clamp(1 - dist, 0, 1), power);
            const hot = Math.pow(clamp(1 - dist * 2.3, 0, 1), 1.2);
            const i = (y * size + x) * 4;
            data[i] = Math.round(mix(outer[0], inner[0], hot));
            data[i + 1] = Math.round(mix(outer[1], inner[1], hot));
            data[i + 2] = Math.round(mix(outer[2], inner[2], hot));
            data[i + 3] = Math.round(alpha * 255);
        }
    }

    return makeDataTexture(data, size, size);
}

function makeCoronaTexture(size = 512) {
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const dx = (x + 0.5 - half) / half;
            const dy = (y + 0.5 - half) / half;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const fade = 1 - smoothstep(0.86, 1.0, dist);
            const shell = Math.exp(-Math.pow((dist - 0.37) / 0.16, 2)) * 0.22;
            const outer = Math.exp(-dist * 3.2) * 0.34;
            const rayMask = Math.exp(-Math.pow((dist - 0.58) / 0.28, 2));
            const rayNoise = (
                Math.sin(angle * 5.0 + Math.sin(angle * 3.0) * 0.9) * 0.5 +
                Math.cos(angle * 11.0 - Math.sin(angle * 2.0) * 0.7) * 0.25 +
                0.5
            );
            const rays = Math.pow(clamp(rayNoise, 0, 1), 2.4) * rayMask * 0.09;
            const alpha = clamp((shell + outer + rays) * fade, 0, 1);
            const i = (y * size + x) * 4;
            data[i] = 255;
            data[i + 1] = 216;
            data[i + 2] = 145;
            data[i + 3] = Math.round(alpha * 255);
        }
    }

    return makeDataTexture(data, size, size);
}

function makeProminenceTexture(width = 256, height = 128) {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        const v = (y + 0.5) / height;
        for (let x = 0; x < width; x += 1) {
            const u = (x + 0.5) / width;
            const centered = (u - 0.5) * 2;
            const arc = 0.72 - Math.sin(u * Math.PI) * 0.46;
            const lowerArc = arc + 0.13 + Math.sin(u * Math.PI * 2.0) * 0.018;
            const distanceOuter = Math.abs(v - arc);
            const distanceInner = Math.abs(v - lowerArc);
            const taper = Math.pow(clamp(Math.sin(u * Math.PI), 0, 1), 0.55);
            const threadA = Math.exp(-distanceOuter * distanceOuter * 1650) * taper;
            const threadB = Math.exp(-distanceInner * distanceInner * 950) * taper * 0.46;
            const foot = Math.exp(-Math.pow(Math.abs(centered) - 0.86, 2) * 85) * Math.exp(-Math.pow(v - 0.76, 2) * 130) * 0.46;
            const alpha = clamp(threadA * 0.72 + threadB * 0.38 + foot, 0, 1);
            const hot = Math.pow(clamp(threadA + foot * 0.6, 0, 1), 0.7);
            const i = (y * width + x) * 4;
            data[i] = Math.round(mix(255, 255, hot));
            data[i + 1] = Math.round(mix(116, 232, hot));
            data[i + 2] = Math.round(mix(54, 168, hot));
            data[i + 3] = Math.round(alpha * 255);
        }
    }

    return makeDataTexture(data, width, height);
}

function configureProminenceProfile(target = activeTarget) {
    if (!prominenceSprites.length) {
        return;
    }

    const profile = activityProfile(target);
    const optics = opticalProfile(target);
    let seed = profile.seed;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const activeCount = clamp(
        Math.round(qualitySettings.prominence * (target.stability === "Turbulent" || target.stability === "Volatile" ? 1 : target.stability === "Dense" ? 0.45 : 0.72)),
        2,
        qualitySettings.prominence
    );

    prominenceSprites.forEach((entry, index) => {
        const enabled = index < activeCount;
        entry.enabled = enabled;
        entry.angle = random() * TAU;
        entry.phase = random() * TAU;
        entry.drift = (random() - 0.5) * optics.rotationSpeed * 0.36;
        entry.width = 0.52 + random() * (target.stability === "Turbulent" || target.stability === "Volatile" ? 0.74 : 0.42);
        entry.height = 0.16 + random() * (target.stability === "Turbulent" || target.stability === "Volatile" ? 0.18 : 0.11);
        entry.opacity = enabled ? 0.035 + random() * (target.stability === "Dense" ? 0.018 : 0.055) : 0;
        entry.altitude = 0.08 + random() * 0.18;
        entry.tilt = (random() - 0.5) * 0.62;
        entry.material.opacity = 0;
        entry.sprite.visible = false;
    });
}

function createProminenceSprites(count) {
    prominenceSprites = [];
    const textureObject = makeProminenceTexture(256, 128);
    for (let i = 0; i < count; i += 1) {
        const material = new THREE.SpriteMaterial({
            map: textureObject,
            color: 0xffd8a8,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.renderOrder = 26 + i * 0.01;
        scene.add(sprite);
        prominenceSprites.push({
            sprite,
            material,
            enabled: true,
            angle: 0,
            phase: 0,
            drift: 0,
            width: 0.8,
            height: 0.22,
            opacity: 0.04,
            altitude: 0.1,
            tilt: 0
        });
    }
    configureProminenceProfile(activeTarget);
}

function periodicDistance(a, b) {
    const d = Math.abs(a - b);
    return Math.min(d, 1 - d);
}

function stampBackdropCloudlets(data, width, height, variant = 0) {
    let seed = 71321 + variant * 9187;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const palettes = [
        [74, 92, 146],
        [88, 82, 136],
        [132, 92, 136],
        [152, 104, 88],
        [164, 136, 96],
        [92, 142, 156]
    ];
    const count = variant === 0 ? 72 : variant === 1 ? 54 : 120;

    for (let i = 0; i < count; i += 1) {
        const cx = random() * width;
        const u = cx / width;
        const lane = 0.5 + Math.sin((u + 0.07 * variant) * TAU) * 0.06 + Math.sin(u * TAU * 2.2 + 1.2) * 0.03;
        const spread = variant === 2 ? 0.62 : 0.22 + random() * 0.26;
        const cy = (lane + (random() - 0.5) * spread) * height;
        const rx = (variant === 2 ? 8 + Math.pow(random(), 3.2) * 46 : 34 + Math.pow(random(), 1.55) * 190) * (width / 2048);
        const ry = (variant === 2 ? 4 + Math.pow(random(), 2.6) * 20 : 11 + Math.pow(random(), 1.9) * 54) * (height / 1024);
        const angle = -0.1 + Math.sin(u * TAU) * 0.18 + (random() - 0.5) * 0.18;
        const colorValue = palettes[Math.floor(random() * palettes.length)];
        const opacity = variant === 2 ? 0.008 + Math.pow(random(), 2.4) * 0.028 : 0.006 + Math.pow(random(), 1.7) * 0.022;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const minX = Math.floor(cx - rx * 2.6);
        const maxX = Math.ceil(cx + rx * 2.6);
        const minY = Math.max(0, Math.floor(cy - ry * 3.0));
        const maxY = Math.min(height - 1, Math.ceil(cy + ry * 3.0));

        for (let y = minY; y <= maxY; y += 1) {
            for (let x = minX; x <= maxX; x += 1) {
                const wrappedX = ((x % width) + width) % width;
                const dx = x - cx;
                const dy = y - cy;
                const lx = (dx * cosA + dy * sinA) / rx;
                const ly = (-dx * sinA + dy * cosA) / ry;
                const d = lx * lx + ly * ly;
                if (d > 7.2) {
                    continue;
                }

                const falloff = Math.exp(-d * 0.56) * opacity;
                const index = (y * width + wrappedX) * 4;
                data[index] = Math.round(clamp(data[index] + colorValue[0] * falloff, 0, 255));
                data[index + 1] = Math.round(clamp(data[index + 1] + colorValue[1] * falloff, 0, 255));
                data[index + 2] = Math.round(clamp(data[index + 2] + colorValue[2] * falloff, 0, 255));
                data[index + 3] = Math.round(clamp(data[index + 3] + 255 * falloff * 0.8, 0, 255));
            }
        }
    }
}

function makeGalaxyBackdropTexture(width = 2048, height = 1024, variant = 0) {
    const data = new Uint8Array(width * height * 4);
    const seedShift = variant * 0.137;
    const isDustLayer = variant === 1;
    const isHazeLayer = variant === 2;

    for (let y = 0; y < height; y += 1) {
        const v = y / height;
        for (let x = 0; x < width; x += 1) {
            const u = x / width;
            const center = 0.5 + Math.sin((u + seedShift) * TAU) * 0.052 + Math.sin(u * TAU * 2.45 - 0.7) * 0.032;
            const lane = v - center;
            const absLane = Math.abs(lane);
            const latitudeFade = Math.exp(-Math.pow(absLane / 0.48, 2));
            const band = Math.exp(-Math.pow(absLane / (isHazeLayer ? 0.95 : 0.82), 2));
            const armA = Math.exp(-Math.pow((lane - Math.sin((u * 3.35 + seedShift) * TAU) * 0.05) / 0.072, 2));
            const armB = Math.exp(-Math.pow((lane + Math.cos((u * 2.7 - seedShift) * TAU) * 0.044) / 0.066, 2));
            const armC = Math.exp(-Math.pow((lane - Math.sin((u * 4.6 + 0.3) * TAU) * 0.03) / 0.048, 2));
            const skyWash = fbmPeriodic(u + seedShift * 0.31, v - seedShift * 0.27, 3, 5);
            const veil = fbmPeriodic(u * 0.73 + seedShift, v * 0.86 + 0.19, 5, 4);
            const gas = fbmPeriodic(u + seedShift, v - seedShift * 0.4, isHazeLayer ? 7 : 5, 5);
            const fineGas = fbmPeriodic(u * 0.7 + 0.11, v + seedShift, isDustLayer ? 13 : 9, 4);
            const coreA = Math.exp(-Math.pow(periodicDistance(u, 0.57) / 0.075, 2) - Math.pow(lane / 0.16, 2));
            const coreB = Math.exp(-Math.pow(periodicDistance(u, 0.14) / 0.1, 2) - Math.pow((lane + 0.04) / 0.2, 2)) * 0.18;
            const darkLane = Math.exp(-Math.pow((lane + Math.sin(u * TAU * 2.1) * 0.024) / 0.034, 2));
            const dust = clamp(darkLane * (0.18 + latitudeFade * 0.18) + Math.pow(1 - fineGas, 2.1) * band * 0.1, 0, 0.46);
            const starSalt = hashNoise(x + variant * 197, y + 53);
            const starlets = starSalt > (isHazeLayer ? 0.994 : 0.9984)
                ? Math.pow((starSalt - (isHazeLayer ? 0.994 : 0.9984)) / (isHazeLayer ? 0.006 : 0.0016), 0.55)
                : 0;
            const allSky = clamp(0.075 + skyWash * 0.09 + veil * 0.065, 0.08, isHazeLayer ? 0.26 : 0.2);
            const blueCloud = (armA * 0.055 + armC * 0.035 + band * 0.02) * (0.22 + gas * 0.22);
            const roseCloud = armB * (0.035 + (1 - gas) * 0.08) + fineGas * band * 0.02;
            const goldCore = (coreA * 0.035 + coreB * 0.025) * (0.42 + gas * 0.12);
            const cloudAlpha = isDustLayer
                ? clamp((allSky * 0.82 + band * 0.008 + roseCloud * 0.01 + blueCloud * 0.008) * (1 - dust * 0.14), 0.13, 0.24)
                : isHazeLayer
                    ? clamp(allSky * 0.88 + starlets * 0.1 + band * gas * 0.006 + goldCore * 0.004, 0.12, 0.24)
                    : clamp((allSky * 0.9 + band * (0.008 + gas * 0.01) + blueCloud * 0.014 + roseCloud * 0.012 + goldCore * 0.016 + starlets * 0.05) * (1 - dust * 0.16), 0.15, 0.28);
            const i = (y * width + x) * 4;
            data[i] = Math.round(clamp(18 + allSky * 86 + blueCloud * 5 + roseCloud * 12 + goldCore * 12 + starlets * 84 - dust * 8, 0, 255));
            data[i + 1] = Math.round(clamp(22 + allSky * 106 + blueCloud * 12 + roseCloud * 7 + goldCore * 10 + starlets * 82 - dust * 7, 0, 255));
            data[i + 2] = Math.round(clamp(44 + allSky * 152 + blueCloud * 28 + roseCloud * 14 + goldCore * 6 + starlets * 92 - dust * 5, 0, 255));
            data[i + 3] = Math.round(Math.pow(cloudAlpha, isHazeLayer ? 1.05 : 1.3) * 255);
        }
    }

    stampBackdropCloudlets(data, width, height, variant);
    return makeDataTexture(data, width, height);
}

function makePsfTexture(size = 160) {
    const data = new Uint8Array(size * size * 4);
    const half = size / 2;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const dx = (x + 0.5 - half) / half;
            const dy = (y + 0.5 - half) / half;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const core = Math.exp(-dist * dist * 34);
            const halo = Math.exp(-dist * 5.2) * 0.42;
            const spikeX = Math.exp(-Math.abs(dy) * 58) * Math.exp(-Math.abs(dx) * 2.6) * 0.42;
            const spikeY = Math.exp(-Math.abs(dx) * 82) * Math.exp(-Math.abs(dy) * 3.1) * 0.16;
            const diagonalA = Math.exp(-Math.abs(dx - dy) * 96) * Math.exp(-dist * 4.3) * 0.08;
            const diagonalB = Math.exp(-Math.abs(dx + dy) * 96) * Math.exp(-dist * 4.3) * 0.08;
            const alpha = clamp(core + halo + spikeX + spikeY + diagonalA + diagonalB, 0, 1);
            const i = (y * size + x) * 4;
            data[i] = 255;
            data[i + 1] = 246;
            data[i + 2] = 226;
            data[i + 3] = Math.round(alpha * 255);
        }
    }

    return makeDataTexture(data, size, size);
}

function createStarField(count, radius, disk = false) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = disk ? 9317 : 4721;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    for (let i = 0; i < count; i += 1) {
        let x;
        let y;
        let z;
        if (disk) {
            const angle = random() * TAU;
            const r = radius * Math.pow(random(), 0.42);
            x = Math.cos(angle) * r + 9800;
            z = Math.sin(angle) * r * 0.56 + 7200;
            y = (random() - 0.5) * radius * 0.12 + 10800;
        } else {
            const theta = random() * TAU;
            const phi = Math.acos(2 * random() - 1);
            const r = radius * (0.28 + random() * 0.72);
            x = Math.sin(phi) * Math.cos(theta) * r;
            y = Math.cos(phi) * r;
            z = Math.sin(phi) * Math.sin(theta) * r;
        }

        const temperature = random();
        const brightness = disk ? 0.36 + random() * 0.58 : 0.2 + Math.pow(random(), 3.2) * 0.82;
        const cool = [0.46, 0.58, 1.0];
        const warm = [1.0, 0.72, 0.42];
        const white = [0.92, 0.96, 1.0];
        const colorA = temperature < 0.5 ? cool : white;
        const colorB = temperature < 0.5 ? white : warm;
        const t = temperature < 0.5 ? temperature * 2 : (temperature - 0.5) * 2;
        const offset = i * 3;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        colors[offset] = mix(colorA[0], colorB[0], t) * brightness;
        colors[offset + 1] = mix(colorA[1], colorB[1], t) * brightness;
        colors[offset + 2] = mix(colorA[2], colorB[2], t) * brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createStarClusterField(count, radius) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 247113;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const clusterCenters = [
        [-0.42, 0.12, -0.54, 0.88, [0.52, 0.64, 1.0]],
        [0.34, -0.16, -0.28, 0.7, [1.0, 0.72, 0.42]],
        [0.58, 0.22, 0.24, 0.54, [0.76, 0.9, 1.0]],
        [-0.18, -0.28, 0.52, 0.62, [0.72, 0.55, 0.96]],
        [0.08, 0.04, -0.82, 1.0, [1.0, 0.86, 0.58]],
        [-0.68, 0.26, 0.12, 0.46, [0.44, 0.78, 0.9]]
    ];

    for (let i = 0; i < count; i += 1) {
        const cluster = clusterCenters[Math.floor(random() * clusterCenters.length)];
        const spread = radius * (0.018 + Math.pow(random(), 2.2) * 0.072) * cluster[3];
        const theta = random() * TAU;
        const phi = Math.acos(2 * random() - 1);
        const localR = spread * Math.pow(random(), 0.38);
        const centerRadius = radius * (0.44 + random() * 0.34);
        const offset = i * 3;
        const x = cluster[0] * centerRadius + Math.sin(phi) * Math.cos(theta) * localR;
        const y = cluster[1] * centerRadius + Math.cos(phi) * localR;
        const z = cluster[2] * centerRadius + Math.sin(phi) * Math.sin(theta) * localR;
        const core = 1 - clamp(localR / Math.max(1, spread), 0, 1);
        const temp = random();
        const base = cluster[4];
        const whiteMix = Math.pow(core, 2) * 0.28 + Math.pow(random(), 3) * 0.18;
        const brightness = 0.06 + core * 0.26 + Math.pow(random(), 5.2) * 0.34;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        colors[offset] = mix(base[0], 1.0, whiteMix) * brightness * (temp < 0.18 ? 1.18 : 1);
        colors[offset + 1] = mix(base[1], 0.96, whiteMix) * brightness;
        colors[offset + 2] = mix(base[2], 1.0, whiteMix) * brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createApproachDustField(count, radius) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 921433;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const palette = [
        [0.42, 0.54, 0.82],
        [0.88, 0.62, 0.34],
        [0.64, 0.76, 0.88],
        [0.36, 0.62, 0.62]
    ];

    for (let i = 0; i < count; i += 1) {
        const theta = random() * TAU;
        const phi = Math.acos(2 * random() - 1);
        const r = radius * (0.08 + Math.pow(random(), 0.64) * 0.92);
        const wake = random() < 0.38;
        const offset = i * 3;
        const lane = (random() - 0.5) * radius * 0.36;
        const x = wake ? (random() - 0.5) * radius * 0.9 : Math.sin(phi) * Math.cos(theta) * r;
        const y = wake ? lane + Math.sin(random() * TAU) * radius * 0.08 : Math.cos(phi) * r;
        const z = wake ? -radius * (0.18 + random() * 0.78) : Math.sin(phi) * Math.sin(theta) * r;
        const colorValue = palette[Math.floor(random() * palette.length)];
        const brightness = 0.11 + Math.pow(random(), 3.2) * 0.42;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        colors[offset] = colorValue[0] * brightness;
        colors[offset + 1] = colorValue[1] * brightness;
        colors[offset + 2] = colorValue[2] * brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createGalaxyField(count, radius) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 73491;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    let written = 0;
    let attempts = 0;
    while (written < count && attempts < count * 20) {
        attempts += 1;
        const along = (random() - 0.5) * radius * 2.2;
        const depth = (random() - 0.5) * radius * (0.24 + random() * 0.34);
        const centerWave = Math.sin(along * 0.00013) * radius * 0.018 + Math.sin(along * 0.00031 + 1.8) * radius * 0.01;
        const bandWidth = radius * (0.16 + Math.pow(random(), 1.8) * 0.34);
        const vertical = centerWave + (random() - 0.5) * bandWidth;
        const coreBias = 1 - clamp(Math.abs(along) / (radius * 1.1), 0, 1);
        const dustLaneA = Math.abs(vertical - centerWave - Math.sin(along * 0.00022) * radius * 0.014);
        const dustLaneB = Math.abs(vertical - centerWave + Math.cos(along * 0.00019) * radius * 0.021);
        const dustProbability = (
            dustLaneA < radius * 0.012 || dustLaneB < radius * 0.01
        ) ? 0.34 + coreBias * 0.12 : 0.02;
        if (random() < dustProbability) {
            continue;
        }

        const knot = random() < 0.035 ? Math.pow(random(), 5) * radius * 0.04 : 0;
        const x = depth + knot * (random() - 0.5);
        const y = vertical + knot * (random() - 0.5) * 0.22;
        const z = along + knot * (random() - 0.5);
        const temperature = clamp(0.38 + random() * 0.44 + coreBias * 0.08, 0, 1);
        const brightness = clamp(0.025 + coreBias * 0.07 + Math.pow(random(), 3.4) * 0.1, 0, 0.22);
        const cool = [0.34, 0.44, 0.82];
        const warm = [0.86, 0.62, 0.38];
        const white = [0.64, 0.7, 0.82];
        const colorA = temperature < 0.5 ? cool : white;
        const colorB = temperature < 0.5 ? white : warm;
        const t = temperature < 0.5 ? temperature * 2 : (temperature - 0.5) * 2;
        const offset = written * 3;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        colors[offset] = mix(colorA[0], colorB[0], t) * brightness;
        colors[offset + 1] = mix(colorA[1], colorB[1], t) * brightness;
        colors[offset + 2] = mix(colorA[2], colorB[2], t) * brightness;
        written += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createGalaxySparkField(count, radius) {
    const geometry = createGalaxyField(count, radius);
    const colors = geometry.getAttribute("color");
    for (let i = 0; i < colors.count; i += 1) {
        const boost = 0.82 + Math.pow(hashNoise(i, 89), 2.2) * 0.52;
        colors.setXYZ(
            i,
            Math.min(colors.getX(i) * boost, 1.8),
            Math.min(colors.getY(i) * boost, 1.8),
            Math.min(colors.getZ(i) * boost, 1.8)
        );
    }
    colors.needsUpdate = true;
    return geometry;
}

function createCosmicMistField(count, radius) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 173891;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const palette = [
        [0.24, 0.32, 0.62],
        [0.3, 0.44, 0.78],
        [0.42, 0.34, 0.62],
        [0.5, 0.4, 0.32],
        [0.22, 0.52, 0.58]
    ];

    for (let i = 0; i < count; i += 1) {
        const offset = i * 3;
        const bandBias = random() < 0.58;
        let x;
        let y;
        let z;

        if (bandBias) {
            const along = (random() - 0.5) * radius * 2.2;
            const wave = Math.sin(along * 0.00011 + 0.7) * radius * 0.025 + Math.sin(along * 0.00029) * radius * 0.014;
            x = (random() - 0.5) * radius * (0.52 + random() * 0.42);
            y = wave + (random() - 0.5) * radius * (0.26 + Math.pow(random(), 1.8) * 0.5);
            z = along;
        } else {
            const theta = random() * TAU;
            const phi = Math.acos(2 * random() - 1);
            const r = radius * (0.38 + random() * 0.62);
            x = Math.sin(phi) * Math.cos(theta) * r;
            y = Math.cos(phi) * r;
            z = Math.sin(phi) * Math.sin(theta) * r;
        }

        const coreBias = 1 - clamp(Math.abs(z) / (radius * 1.12), 0, 1);
        const colorValue = palette[Math.floor(random() * palette.length)];
        const brightness = 0.012 + Math.pow(random(), 2.6) * 0.08 + coreBias * 0.018;
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
        colors[offset] = colorValue[0] * brightness;
        colors[offset + 1] = colorValue[1] * brightness;
        colors[offset + 2] = colorValue[2] * brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createGalaxyBackdrop() {
    galaxyBackdropLayers = [];

    const layers = [
        {
            map: makeGalaxyBackdropTexture(qualitySettings.backdropWidth, qualitySettings.backdropHeight, 0),
            opacity: 0.68,
            blend: THREE.NormalBlending,
            tint: 0x22304d,
            speed: [1, 1],
            scale: [1.72, 1.52],
            phase: 0,
            order: -30
        },
        {
            map: makeGalaxyBackdropTexture(qualitySettings.backdropDustWidth, qualitySettings.backdropDustHeight, 1),
            opacity: 0.16,
            blend: THREE.NormalBlending,
            tint: 0x536078,
            speed: [1.55, 0.82],
            scale: [1.9, 1.58],
            phase: 0.21,
            order: -29
        },
        {
            map: makeGalaxyBackdropTexture(qualitySettings.backdropHazeWidth, qualitySettings.backdropHazeHeight, 2),
            opacity: 0.1,
            blend: THREE.NormalBlending,
            tint: 0x5a4f49,
            speed: [0.62, 1.34],
            scale: [1.5, 1.42],
            phase: 0.47,
            order: -28
        }
    ];

    layers.forEach((layer, index) => {
        const material = new THREE.MeshBasicMaterial({
            map: layer.map,
            color: layer.tint,
            transparent: true,
            opacity: 0,
            blending: layer.blend,
            depthWrite: false,
            depthTest: false,
            fog: false,
            side: THREE.BackSide,
            toneMapped: false
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(90000 - index * 1400, 96, 48), material);
        mesh.renderOrder = layer.order;
        mesh.frustumCulled = false;
        scene.add(mesh);
        galaxyBackdropLayers.push({ mesh, material, texture: layer.map, ...layer });
    });
}

function updateGalaxyBackdrop(distance, dt, profile = LOD_SCENE_PROFILES.Cluster) {
    if (!galaxyBackdropLayers.length) {
        return;
    }

    const orbitYaw = cameraState.yaw;
    const orbitTilt = cameraState.pitch;
    const targetX = orbitYaw * 0.018 + Math.sin(orbitTilt * 1.7) * 0.006;
    const targetY = -orbitTilt * 0.024 + Math.sin(orbitYaw * 0.55) * 0.005;
    const damping = Math.min(1, dt * (dragging ? 3.2 : 1.65));
    galaxyBackdropOffset.x += (targetX - galaxyBackdropOffset.x) * damping;
    galaxyBackdropOffset.y += (targetY - galaxyBackdropOffset.y) * damping;

    const deepAlpha = smoothstep(850, 4200, distance);
    const surfaceCut = smoothstep(42, 190, distance);
    const backdropAlpha = mix(0.1, 0.46, deepAlpha) * surfaceCut * profile.backdrop;
    galaxyBackdropLayers.forEach((layer, index) => {
        const pulse = Math.sin(clock.elapsedTime * (0.018 + index * 0.007) + layer.phase * TAU) * 0.5 + 0.5;
        const x = ((galaxyBackdropOffset.x * layer.speed[0] + layer.phase) % 1 + 1) % 1;
        const y = ((galaxyBackdropOffset.y * layer.speed[1] + layer.phase * 0.37) % 1 + 1) % 1;
        layer.texture.offset.set(x, y);
        layer.mesh.position.copy(camera.position);
        layer.mesh.rotation.set(
            orbitTilt * 0.08 * layer.speed[1],
            -orbitYaw * 0.06 * layer.speed[0] + layer.phase * TAU,
            layer.phase * 0.4
        );
        layer.material.opacity = backdropAlpha * layer.opacity * (0.92 + pulse * 0.08);
        layer.mesh.visible = layer.material.opacity > 0.006;
    });
}

function createBrightStarSprites(count, radius) {
    brightStars = [];
    const textureObject = makePsfTexture(160);
    const heroPlacements = [
        [2400, 9400, -23000, 1700, 0.52, 0xbdd3ff],
        [1200, -8200, 17000, 1320, 0.4, 0xffd2a0],
        [-2600, 12600, 7600, 1120, 0.34, 0xffffff],
        [5200, -3800, -7200, 1280, 0.32, 0x9fc2ff],
        [-3400, 3300, 25000, 980, 0.3, 0xffc28a],
        [7200, -11200, -19000, 1080, 0.28, 0xdfeaff]
    ];
    let seed = 918271;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    for (let i = 0; i < count; i += 1) {
        const hero = heroPlacements[i];
        const theta = random() * TAU;
        const phi = Math.acos(2 * random() - 1);
        const r = radius * (0.38 + random() * 0.62);
        const temperature = random();
        const tint = hero ? hero[5] : temperature < 0.33 ? 0xaecbff : temperature > 0.72 ? 0xffc68f : 0xffffff;
        const material = new THREE.SpriteMaterial({
            map: textureObject,
            color: tint,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        if (hero) {
            sprite.position.set(hero[0], hero[1], hero[2]);
        } else {
            sprite.position.set(
                Math.sin(phi) * Math.cos(theta) * r,
                Math.cos(phi) * r,
                Math.sin(phi) * Math.sin(theta) * r
            );
        }
        const scale = hero ? hero[3] : 42 + Math.pow(random(), 2.8) * 260;
        sprite.scale.setScalar(scale);
        sprite.renderOrder = 8 + i * 0.001;
        scene.add(sprite);
        brightStars.push({
            sprite,
            material,
            baseOpacity: hero ? hero[4] : 0.04 + Math.pow(random(), 2.2) * 0.22,
            phase: random() * TAU
        });
    }
}

function createCatalogField(catalog) {
    const positions = new Float32Array(catalog.length * 3);
    const colors = new Float32Array(catalog.length * 3);

    catalog.forEach((target, index) => {
        const offset = index * 3;
        const [r, g, b] = hexToRgb(paletteColor(target));
        const brightness = (target.featured ? 1.25 : 0.72) * (target.brightness || 0.62);
        const baseColor = [
            (r / 255) * brightness,
            (g / 255) * brightness,
            (b / 255) * brightness
        ];
        positions[offset] = target.position[0];
        positions[offset + 1] = target.position[1];
        positions[offset + 2] = target.position[2];
        colors[offset] = 0;
        colors[offset + 1] = 0;
        colors[offset + 2] = 0;
        target.catalogIndex = index;
        target.catalogBaseColor = baseColor;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function createTargetSprites(textureObject) {
    targetSprites.clear();
    targetMaterials.clear();

    featuredTargets.forEach((target) => {
        const colorValue = new THREE.Color(target.palette[target.palette.length - 2]);
        const material = new THREE.SpriteMaterial({
            map: textureObject,
            color: colorValue,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(targetPosition(target));
        sprite.renderOrder = 10;
        scene.add(sprite);
        targetSprites.set(target.id, sprite);
        targetMaterials.set(target.id, material);
    });
}

function createTargetOpticSprites(textureObject) {
    targetOpticSprites.clear();
    targetOpticMaterials.clear();

    featuredTargets.forEach((target) => {
        const colorValue = new THREE.Color(target.palette[Math.max(0, target.palette.length - 2)]);
        const material = new THREE.SpriteMaterial({
            map: textureObject,
            color: colorValue,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(targetPosition(target));
        sprite.renderOrder = 9.5;
        scene.add(sprite);
        targetOpticSprites.set(target.id, sprite);
        targetOpticMaterials.set(target.id, material);
    });
}

function makeLabelSlot(width = 384, height = 72) {
    if (typeof OffscreenCanvas !== "function") {
        return null;
    }

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    const textureObject = new THREE.CanvasTexture(canvas);
    textureObject.colorSpace = THREE.SRGBColorSpace;
    textureObject.minFilter = THREE.LinearFilter;
    textureObject.magFilter = THREE.LinearFilter;
    textureObject.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
        map: textureObject,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.NormalBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0, 0.5);
    sprite.renderOrder = 35;
    sprite.visible = false;
    scene.add(sprite);

    return {
        canvas,
        context,
        texture: textureObject,
        material,
        sprite,
        width,
        height,
        signature: "",
        target: null
    };
}

function drawLabel(slot, target, active = false, hover = false) {
    const signature = `${target.id}:${active ? 1 : 0}:${hover ? 1 : 0}`;
    if (slot.signature === signature) {
        return;
    }

    const context = slot.context;
    const featured = Boolean(target.featured);
    const fontSize = active ? 30 : hover ? 26 : featured ? 21 : 17;
    const text = target.name;
    context.clearRect(0, 0, slot.width, slot.height);
    context.font = `${active || hover ? 600 : featured ? 500 : 450} ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
    context.textBaseline = "middle";
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(0, 0, 0, 0.58)";
    context.lineWidth = active ? 3.2 : hover ? 2.8 : 2.1;
    context.fillStyle = active ? "rgba(255, 247, 232, 0.94)" : hover ? "rgba(235, 243, 255, 0.88)" : featured ? "rgba(210, 224, 255, 0.68)" : "rgba(176, 194, 230, 0.5)";
    context.strokeText(text, 10, slot.height / 2);
    context.fillText(text, 10, slot.height / 2);

    slot.texture.needsUpdate = true;
    slot.signature = signature;
}

function createSceneLabels(count = 16) {
    sceneLabels = [];
    if (typeof THREE.CanvasTexture !== "function") {
        return;
    }

    for (let i = 0; i < count; i += 1) {
        const slot = makeLabelSlot();
        if (slot) {
            sceneLabels.push(slot);
        }
    }
}

function selectSceneLabelTargets(force = false) {
    const now = performance.now();
    if (!sceneLabels.length || cameraState.distance <= 42) {
        sceneLabelTargets = [];
        return sceneLabelTargets;
    }

    const maxLabels = Math.min(sceneLabels.length, getVisibleCatalogBudget().labels);
    if (maxLabels <= 0) {
        sceneLabelTargets = [];
        return sceneLabelTargets;
    }
    const signature = labelSelectionSignature(maxLabels);
    if (!force && signature === lastLabelSelectionSignature && now - lastLabelSelection < LABEL_SELECTION_INTERVAL) {
        return sceneLabelTargets;
    }

    lastLabelSelection = now;
    lastLabelSelectionSignature = signature;

    const candidates = [];
    const candidateMap = new Map();
    currentInteractiveTargets().forEach((target) => {
        setVectorFromTarget(labelVector, target);
        labelVector.project(camera);
        const x = (labelVector.x * 0.5 + 0.5) * canvasSize.width;
        const y = (-labelVector.y * 0.5 + 0.5) * canvasSize.height;
        const inView = labelVector.z > -1 && labelVector.z < 1 && x > 52 && x < canvasSize.width - 52 && y > 36 && y < canvasSize.height - 36;
        if (!inView) {
            return;
        }

        const active = target.id === activeTarget.id;
        const hover = target.id === hoverTargetId;
        const featured = Boolean(target.featured);
        if (active && cameraState.distance <= 520 && !hover) {
            return;
        }
        const targetDepth = camera.position.distanceTo(labelAnchor.set(target.position[0], target.position[1], target.position[2]));
        const distanceScore = 1 - clamp(targetDepth / 56000, 0, 1);
        const highScoringCatalog = !featured && (activeRegime === "Deep Field" || activeRegime === "Cluster");
        if (!active && !hover && !featured && !highScoringCatalog) {
            return;
        }

        const fontPx = active ? 30 : hover ? 26 : featured ? 21 : 17;
        const halfWidth = Math.min(170, Math.max(54, target.name.length * fontPx * 0.3 + 20));
        const halfHeight = fontPx * 0.78;

        const candidate = {
            target,
            active,
            hover,
            rect: {
                left: x - halfWidth,
                right: x + halfWidth,
                top: y - halfHeight,
                bottom: y + halfHeight
            },
            score: (active ? 100 : 0) +
                (hover ? 80 : 0) +
                (featured ? 34 : 0) +
                (target.brightness || 0.5) * 18 +
                distanceScore * 8
        };
        candidates.push(candidate);
        candidateMap.set(target.id, candidate);
    });

    const previousEntries = sceneLabelTargets;
    const occupied = [];
    sceneLabelTargets = [];

    const addCandidate = (candidate) => {
        if (!candidate || sceneLabelTargets.some((entry) => entry.target.id === candidate.target.id)) {
            return false;
        }
        const protectedLabel = candidate.active || candidate.hover;
        const blocked = !protectedLabel && occupied.some((rect) => {
            return candidate.rect.left < rect.right + 10 &&
                candidate.rect.right > rect.left - 10 &&
                candidate.rect.top < rect.bottom + 8 &&
                candidate.rect.bottom > rect.top - 8;
        });
        if (!blocked) {
            sceneLabelTargets.push(candidate);
            occupied.push(candidate.rect);
        }
        return sceneLabelTargets.length >= maxLabels;
    };

    addCandidate(candidateMap.get(activeTarget?.id));
    addCandidate(candidateMap.get(hoverTargetId));

    for (const previous of previousEntries) {
        if (addCandidate(candidateMap.get(previous.target.id))) {
            return sceneLabelTargets;
        }
    }

    candidates
        .sort((a, b) => b.score - a.score)
        .some((candidate) => addCandidate(candidate));
    return sceneLabelTargets;
}

function updateSceneLabels(force = false, budget = 1) {
    if (!sceneLabels.length) {
        visibleLabelCount = 0;
        labelHitTargets = [];
        return;
    }

    const selected = selectSceneLabelTargets(force)
        .slice(0, Math.max(1, Math.round(sceneLabels.length * budget)));
    const selectedById = new Map(selected.map((entry) => [entry.target.id, entry]));
    const slotEntries = new Array(sceneLabels.length).fill(null);
    sceneLabels.forEach((slot, index) => {
        if (slot.target && selectedById.has(slot.target.id)) {
            const entry = selectedById.get(slot.target.id);
            slotEntries[index] = entry;
            selectedById.delete(slot.target.id);
        }
    });
    selected.forEach((entry) => {
        if (!selectedById.has(entry.target.id)) {
            return;
        }
        const emptyIndex = slotEntries.findIndex((slotEntry) => !slotEntry);
        if (emptyIndex >= 0) {
            slotEntries[emptyIndex] = entry;
            selectedById.delete(entry.target.id);
        }
    });
    visibleLabelCount = selected.length;
    labelHitTargets = [];
    sceneLabels.forEach((slot, index) => {
        const entry = slotEntries[index];
        if (!entry) {
            slot.sprite.visible = false;
            slot.target = null;
            slot.material.opacity += (0 - slot.material.opacity) * 0.34;
            return;
        }

        const target = entry.target;
        const active = target.id === activeTarget.id;
        const hover = target.id === hoverTargetId;
        drawLabel(slot, target, active, hover);
        slot.target = target;
        labelAnchor.set(target.position[0], target.position[1], target.position[2]);
        labelVector.copy(labelAnchor).project(camera);
        const screenX = (labelVector.x * 0.5 + 0.5) * canvasSize.width;
        const screenY = (-labelVector.y * 0.5 + 0.5) * canvasSize.height;
        const side = screenX > canvasSize.width * 0.68 ? -1 : 1;
        const fontPx = active ? 30 : hover ? 26 : target.featured ? 21 : 17;
        const labelWidth = Math.min(300, Math.max(72, target.name.length * fontPx * 0.58 + 28));
        const labelHeight = fontPx * 1.38;
        const labelGap = target.featured ? 13 : 11;
        const labelLeft = side > 0 ? screenX + labelGap - 8 : screenX - labelGap - labelWidth - 8;
        const labelRight = side > 0 ? screenX + labelGap + labelWidth + 8 : screenX - labelGap + 8;
        labelHitTargets.push({
            target,
            priority: active ? 3 : hover ? 2 : target.featured ? 1 : 0,
            rect: {
                left: labelLeft,
                right: labelRight,
                top: screenY - labelHeight * 0.5 - 8,
                bottom: screenY + labelHeight * 0.5 + 8
            }
        });
        const depth = Math.max(1, camera.position.distanceTo(labelAnchor));
        const unitPerPixel = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * depth / Math.max(1, canvasSize.height);
        const offset = unitPerPixel * (target.featured ? 13 : 11);
        const lift = unitPerPixel * 2;
        slot.sprite.center.set(side > 0 ? 0 : 1, 0.5);
        slot.sprite.position.copy(labelAnchor)
            .addScaledVector(cameraRight, offset * side)
            .addScaledVector(cameraUpVector, lift);
        const sizeFactor = active ? 0.86 : hover ? 0.78 : target.featured ? 0.66 : 0.56;
        slot.sprite.scale.set(unitPerPixel * slot.width * sizeFactor, unitPerPixel * slot.height * sizeFactor, 1);
        slot.material.opacity += ((active ? 0.94 : hover ? 0.86 : target.featured ? 0.56 : 0.38) - slot.material.opacity) * 0.32;
        slot.sprite.visible = slot.material.opacity > 0.02;
    });
}

function createFocusedStar(surfaceTexture) {
    focusGroup = new THREE.Group();

    paletteTexture = makePaletteTexture(activeTarget.palette);
    surfaceMaterial = new THREE.MeshBasicNodeMaterial();
    surfaceMaterial.transparent = true;
    surfaceMaterial.opacity = 0;
    surfaceMaterial.depthTest = true;
    surfaceMaterial.depthWrite = true;
    surfaceMaterial.toneMapped = false;
    surfaceUniforms = {
        seed: uniform(0),
        flowSpeed: uniform(1),
        detailScale: uniform(1),
        microScale: uniform(1),
        contrast: uniform(1),
        bias: uniform(0.06),
        surfaceEmission: uniform(1.45)
    };

    const baseUv = uv();
    const seededUv = baseUv.add(vec2(surfaceUniforms.seed, surfaceUniforms.seed.mul(0.37)));
    const flowUvA = seededUv.add(vec2(time.mul(0.0033).mul(surfaceUniforms.flowSpeed), 0.0));
    const flowUvB = seededUv.add(vec2(time.mul(-0.0076).mul(surfaceUniforms.flowSpeed), time.mul(0.1).sin().mul(0.016)));
    const flowUvC = seededUv.add(vec2(baseUv.y.mul(8.4).sin().mul(0.016), time.mul(0.0044).mul(surfaceUniforms.flowSpeed)));
    const flowUvD = seededUv.add(vec2(time.mul(-0.0028).mul(surfaceUniforms.flowSpeed), time.mul(0.005)));
    const detailUv = seededUv
        .mul(vec2(surfaceUniforms.detailScale.mul(2.1), surfaceUniforms.detailScale.mul(1.45)))
        .add(vec2(time.mul(-0.014), time.mul(0.007)));
    const baseField = texture(surfaceTexture, flowUvA).r.mul(0.48);
    const secondaryField = texture(surfaceTexture, flowUvB).r.mul(0.32);
    const detailField = texture(surfaceTexture, flowUvC).r.mul(0.2);
    const convectionField = texture(
        surfaceTexture,
        flowUvD.add(vec2(baseUv.y.mul(22.0).sin().mul(0.008), baseUv.x.mul(15.0).cos().mul(0.008)))
    ).r.mul(0.22);
    const fineField = texture(surfaceTexture, detailUv).r.add(-0.5).mul(surfaceUniforms.microScale.mul(0.12));
    const surfaceField = tslClamp(
        baseField
            .add(secondaryField)
            .add(detailField)
            .add(convectionField)
            .add(fineField)
            .add(baseUv.x.mul(13.4).add(baseUv.y.mul(5.1)).add(time.mul(0.05)).sin().mul(0.032))
            .add(baseUv.y.mul(17.2).sub(baseUv.x.mul(3.6)).sub(time.mul(0.033)).sin().mul(0.026))
            .mul(surfaceUniforms.contrast),
        0,
        1
    );
    const hotField = texture(surfaceTexture, flowUvB.add(vec2(0.044, -0.03))).r;
    const patchField = texture(surfaceTexture, flowUvC.add(vec2(-0.036, 0.024))).r;
    const activityUv = seededUv.add(vec2(time.mul(0.0012).mul(surfaceUniforms.flowSpeed), time.mul(0.00045)));
    const activitySample = texture(activityTexture, activityUv);
    const activeDark = activitySample.r;
    const activeHot = activitySample.g;
    const magneticFlow = activitySample.b;
    const flowBand = baseUv.y.mul(24.0).add(time.mul(0.07).mul(surfaceUniforms.flowSpeed)).sin().mul(0.5).add(0.5);
    const paletteField = tslClamp(
        surfaceField.mul(0.68)
            .add(hotField.mul(0.17))
            .add(activeHot.mul(0.18))
            .add(magneticFlow.mul(0.08))
            .add(flowBand.mul(0.05))
            .add(surfaceUniforms.bias),
        0,
        1
    );
    const paletteBase = texture(paletteTexture, vec2(paletteField.mul(0.88).add(0.04), 0.5)).rgb;
    const paletteHot = texture(paletteTexture, vec2(tslClamp(paletteField.mul(0.74).add(0.24), 0, 1), 0.5)).rgb;
    const paletteShadow = texture(paletteTexture, vec2(paletteField.mul(0.36).add(0.04), 0.5)).rgb;
    const facing = dot(normalView, positionViewDirection).clamp();
    const rimHeat = facing.oneMinus().pow(3.45);
    const centerHeat = facing.pow(0.78);
    const bodyFalloff = centerHeat.mul(0.42).add(0.68);
    const hotMask = tslClamp(
        hotField.mul(0.62)
            .add(surfaceField.mul(surfaceField).mul(0.42))
            .add(detailField.mul(0.14))
            .add(activeHot.mul(0.55))
            .add(magneticFlow.mul(0.18))
            .sub(patchField.oneMinus().mul(0.06)),
        0,
        1
    );
    const darkPatchMask = tslClamp(
        patchField.oneMinus().mul(patchField.oneMinus()).mul(0.34)
            .add(baseField.oneMinus().mul(0.16))
            .add(activeDark.mul(0.94))
            .add(rimHeat.mul(0.06)),
        0,
        1
    );
    surfaceMaterial.colorNode = paletteBase
        .mul(bodyFalloff)
        .add(paletteHot.mul(hotMask.mul(1.22).add(centerHeat.mul(0.1))))
        .sub(paletteShadow.mul(darkPatchMask.mul(0.18)))
        .add(color(0xffd39a).mul(centerHeat.mul(0.14).add(rimHeat.mul(0.34))))
        .add(color(0xffffff).mul(hotMask.mul(centerHeat).mul(0.28).add(rimHeat.mul(0.13))))
        .add(paletteHot.mul(magneticFlow.mul(rimHeat.mul(0.28).add(0.1))))
        .sub(color(0x4a1608).mul(darkPatchMask.mul(0.28)))
        .mul(surfaceUniforms.surfaceEmission);

    const geometry = new THREE.SphereGeometry(1.24, qualitySettings.sphereWidth, qualitySettings.sphereHeight);
    surfaceMesh = new THREE.Mesh(geometry, surfaceMaterial);
    surfaceMesh.rotation.y = Math.PI / 2;
    surfaceMesh.renderOrder = 20;
    focusGroup.add(surfaceMesh);

    limbGlowMaterial = new THREE.MeshBasicNodeMaterial();
    limbGlowMaterial.transparent = true;
    limbGlowMaterial.blending = THREE.AdditiveBlending;
    limbGlowMaterial.side = THREE.BackSide;
    limbGlowMaterial.depthTest = true;
    limbGlowMaterial.depthWrite = false;
    limbGlowMaterial.toneMapped = false;

    const shellRim = dot(normalView, positionViewDirection).abs().oneMinus().pow(2.0);
    const shellBands = uv().y.mul(18.0).add(time.mul(0.12)).sin().mul(0.5).add(0.5);
    const shellSwirl = positionLocal.x.mul(6.1)
        .add(positionLocal.y.mul(4.9))
        .sub(positionLocal.z.mul(3.2))
        .add(time.mul(0.07))
        .sin()
        .mul(0.5)
        .add(0.5);
    const shellMask = tslClamp(shellBands.mul(0.54).add(shellSwirl.mul(0.46)), 0, 1);
    limbGlowMaterial.positionNode = positionLocal.add(normalLocal.mul(shellRim.mul(0.14).mul(shellMask.mul(0.32).add(0.72)).add(0.03)));
    limbGlowMaterial.colorNode = color(0xffd293).mul(shellRim.mul(0.6).add(shellMask.mul(0.13)).add(0.08));
    limbGlowMaterial.opacityNode = shellRim.mul(shellMask.mul(0.36).add(0.64)).pow(1.18).mul(0.24);

    limbGlowMesh = new THREE.Mesh(new THREE.SphereGeometry(1.29, qualitySettings.sphereWidth, qualitySettings.sphereHeight), limbGlowMaterial);
    limbGlowMesh.rotation.y = Math.PI / 2;
    limbGlowMesh.renderOrder = 21;
    focusGroup.add(limbGlowMesh);

    chromosphereMaterial = new THREE.MeshBasicNodeMaterial();
    chromosphereMaterial.transparent = true;
    chromosphereMaterial.blending = THREE.AdditiveBlending;
    chromosphereMaterial.side = THREE.BackSide;
    chromosphereMaterial.depthTest = true;
    chromosphereMaterial.depthWrite = false;
    chromosphereMaterial.toneMapped = false;

    const chromaRim = dot(normalView, positionViewDirection).abs().oneMinus().pow(2.55);
    const chromaActivity = texture(activityTexture, uv().add(vec2(time.mul(0.001), time.mul(0.0007)))).b;
    const chromaPulse = uv().x.mul(19.0).add(uv().y.mul(9.0)).add(time.mul(0.05)).sin().mul(0.5).add(0.5);
    chromosphereMaterial.positionNode = positionLocal.add(normalLocal.mul(chromaRim.mul(0.07).add(chromaActivity.mul(0.035))));
    chromosphereMaterial.colorNode = texture(paletteTexture, vec2(0.78, 0.5)).rgb
        .mul(chromaRim.mul(0.58).add(chromaActivity.mul(0.18)).add(chromaPulse.mul(0.035)));
    chromosphereMaterial.opacityNode = chromaRim.mul(chromaActivity.mul(0.18).add(0.18)).pow(1.12);

    chromosphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1.34, qualitySettings.sphereWidth, qualitySettings.sphereHeight), chromosphereMaterial);
    chromosphereMesh.rotation.y = Math.PI / 2;
    chromosphereMesh.renderOrder = 22;
    focusGroup.add(chromosphereMesh);

    outlineMaterial = new THREE.MeshBasicNodeMaterial();
    outlineMaterial.transparent = true;
    outlineMaterial.blending = THREE.AdditiveBlending;
    outlineMaterial.side = THREE.BackSide;
    outlineMaterial.depthTest = true;
    outlineMaterial.depthWrite = false;
    outlineMaterial.toneMapped = false;

    const outlineRim = dot(normalView, positionViewDirection).abs().oneMinus().pow(1.36);
    const outlineBreakup = uv().x.mul(34.0)
        .add(uv().y.mul(13.0))
        .add(time.mul(0.18))
        .sin()
        .mul(0.5)
        .add(0.5);
    const outlinePulse = uv().x.mul(9.0)
        .sub(time.mul(0.052))
        .sin()
        .mul(0.5)
        .add(0.5);
    outlineMaterial.positionNode = positionLocal.add(normalLocal.mul(outlineRim.mul(0.1).add(0.045)));
    outlineMaterial.colorNode = texture(paletteTexture, vec2(0.88, 0.5)).rgb
        .mul(outlineRim.mul(0.9).add(outlinePulse.mul(0.08)).add(0.06));
    outlineMaterial.opacityNode = outlineRim
        .mul(outlineBreakup.mul(0.2).add(0.86))
        .pow(1.05)
        .mul(0.52);

    outlineMesh = new THREE.Mesh(new THREE.SphereGeometry(1.41, qualitySettings.sphereWidth, qualitySettings.sphereHeight), outlineMaterial);
    outlineMesh.rotation.y = Math.PI / 2;
    outlineMesh.renderOrder = 22.5;
    focusGroup.add(outlineMesh);

    photosphereMaterial = new THREE.SpriteMaterial({
        map: makeRadialTexture(256, [255, 255, 244], [255, 188, 95], 1.45),
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
    });
    photosphereSprite = new THREE.Sprite(photosphereMaterial);
    photosphereSprite.scale.setScalar(8.8);
    photosphereSprite.renderOrder = 24;
    focusGroup.add(photosphereSprite);

    haloMaterial = new THREE.SpriteMaterial({
        map: makeRadialTexture(256, [255, 255, 240], [255, 178, 84], 2.0),
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
    });
    haloSprite = new THREE.Sprite(haloMaterial);
    haloSprite.scale.setScalar(7.2);
    haloSprite.renderOrder = 23;
    focusGroup.add(haloSprite);

    coronaMaterial = new THREE.SpriteMaterial({
        map: makeCoronaTexture(512),
        color: 0xffd59b,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        toneMapped: false
    });
    coronaSprite = new THREE.Sprite(coronaMaterial);
    coronaSprite.scale.setScalar(10.4);
    coronaSprite.renderOrder = 23;
    focusGroup.add(coronaSprite);

    flareSprites = [
        { scale: [14.0, 0.42], opacity: 0.045, rotation: 0 },
        { scale: [8.4, 0.34], opacity: 0.026, rotation: Math.PI / 10 }
    ].map((entry) => {
        const material = new THREE.SpriteMaterial({
            map: makeRadialTexture(128, [255, 255, 255], [255, 209, 132], 3.6),
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.material.rotation = entry.rotation;
        sprite.scale.set(entry.scale[0], entry.scale[1], 1);
        sprite.renderOrder = 25 + entry.rotation;
        focusGroup.add(sprite);
        return { sprite, material, entry };
    });

    scene.add(focusGroup);
}

function getRegime(distance) {
    if (activeRegime === "Surface" && distance <= 40 * (1 + LOD_HYSTERESIS)) {
        return "Surface";
    }
    if (activeRegime === "System Approach" && distance > 40 * (1 - LOD_HYSTERESIS) && distance <= 400 * (1 + LOD_HYSTERESIS)) {
        return "System Approach";
    }
    if (activeRegime === "Cluster" && distance > 400 * (1 - LOD_HYSTERESIS) && distance <= 2500 * (1 + LOD_HYSTERESIS)) {
        return "Cluster";
    }
    if (activeRegime === "Deep Field" && distance > 2500 * (1 - LOD_HYSTERESIS)) {
        return "Deep Field";
    }

    if (distance <= 40) {
        return "Surface";
    }
    if (distance <= 400) {
        return "System Approach";
    }
    if (distance <= 2500) {
        return "Cluster";
    }
    return "Deep Field";
}

const LOD_PROFILE_FIELDS = [
    "backdrop",
    "far",
    "galaxy",
    "cluster",
    "mist",
    "spark",
    "bright",
    "catalogTargets",
    "approachDust",
    "targetOptics",
    "targetSprites",
    "focusedStar",
    "optics"
];

function blendLodProfiles(distance) {
    const surface = 1 - smoothstep(34, 86, distance);
    const approach = smoothstep(32, 96, distance) * (1 - smoothstep(520, 1100, distance));
    const cluster = smoothstep(220, 900, distance) * (1 - smoothstep(2100, 5600, distance));
    const deep = smoothstep(1900, 5600, distance);
    const weights = [
        ["Surface", surface],
        ["System Approach", approach],
        ["Cluster", cluster],
        ["Deep Field", deep]
    ];
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0) || 1;
    const profile = {};

    LOD_PROFILE_FIELDS.forEach((field) => {
        profile[field] = weights.reduce((sum, [key, weight]) => {
            return sum + (LOD_SCENE_PROFILES[key][field] || 0) * weight;
        }, 0) / total;
    });

    return profile;
}

function updateCamera(dt) {
    cameraState.distance += (cameraState.targetDistance - cameraState.distance) * Math.min(1, dt * 7.5);
    cameraState.yaw += (cameraState.targetYaw - cameraState.yaw) * Math.min(1, dt * (dragging ? 16 : 7));
    cameraState.pitch += (cameraState.targetPitch - cameraState.pitch) * Math.min(1, dt * (dragging ? 16 : 7));
    if (Math.abs(cameraState.pitch) > TAU * 4) {
        const wraps = Math.trunc(cameraState.pitch / TAU);
        cameraState.pitch -= wraps * TAU;
        cameraState.targetPitch -= wraps * TAU;
    }

    if (flightState.active) {
        const t = clamp((performance.now() - flightState.startedAt) / TARGET_FLIGHT_MS, 0, 1);
        focusCurrent.copy(flightStart).lerp(flightEnd, easeOutCubic(t));
        if (t >= 1) {
            flightState.active = false;
            focusCurrent.copy(flightEnd);
        }
    } else {
        focusCurrent.lerp(focusTarget, Math.min(1, dt * 4));
    }

    const normalized = scaleFromDistance(cameraState.distance) / 100;
    camera.fov = clamp(18 + Math.sqrt(cameraState.distance) * 0.66, 18, 54);
    camera.near = Math.max(0.01, cameraState.distance * 0.00001);
    camera.far = 120000;

    cameraDirection.set(
        Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch),
        Math.sin(cameraState.pitch),
        Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch)
    ).normalize();

    cameraPosition.copy(focusCurrent).addScaledVector(cameraDirection, cameraState.distance);
    camera.position.copy(cameraPosition);
    cameraLookDirection.copy(focusCurrent).sub(camera.position).normalize();
    cameraRight.crossVectors(cameraLookDirection, worldUp);
    if (cameraRight.lengthSq() < 0.0001) {
        cameraRight.set(1, 0, 0);
    } else {
        cameraRight.normalize();
    }
    camera.up.copy(worldUp);
    cameraAimTarget.copy(focusCurrent);
    camera.lookAt(cameraAimTarget);
    cameraUpVector.copy(camera.up).normalize();
    camera.updateProjectionMatrix();

    activeRegime = getRegime(cameraState.distance);

    return normalized;
}

function updateLod(normalized, dt) {
    const distance = cameraState.distance;
    const profile = blendLodProfiles(distance);
    const optics = opticalProfile(activeTarget);
    const visualBudget = adaptiveLevel === 0 ? 1 : adaptiveLevel === 1 ? 0.72 : 0.48;
    const labelBudget = adaptiveLevel === 0 ? 1 : adaptiveLevel === 1 ? 0.72 : 0.45;
    const approachBand = smoothstep(42, 125, distance) * (1 - smoothstep(720, 1400, distance));
    const midFieldBand = smoothstep(260, 900, distance) * (1 - smoothstep(1800, 3600, distance));
    const approachStar = 1 - smoothstep(720, 1150, distance);
    const starAlpha = clamp(profile.focusedStar * approachStar, 0, 1);
    const surfaceAlpha = clamp(distance <= 42 ? 1 : starAlpha * 0.96, 0, 1);
    const farAlpha = clamp(profile.far * mix(0.26, 0.92, smoothstep(140, 2600, distance)), 0, 1);
    const galaxyAlpha = clamp(profile.galaxy * (0.35 + smoothstep(900, 3200, distance) * 0.65) * visualBudget, 0, 0.18);
    const mistAlpha = clamp(profile.mist * (0.22 + smoothstep(220, 2600, distance) * 0.78) * visualBudget, 0, 0.5);
    const starClusterAlpha = clamp(profile.cluster * smoothstep(160, 3000, distance), 0, 0.9);
    const clusterAlpha = smoothstep(42, 520, distance) * (1 - smoothstep(2500, 4200, distance));
    const brightAlpha = clamp(profile.bright * mix(0.08, 1, smoothstep(700, 5000, distance)) * visualBudget, 0, 1);
    const catalogAlpha = clamp(profile.catalogTargets * smoothstep(46, 360, distance), 0, 1);
    const opticBoost = clamp(1 - smoothstep(35, 440, distance) + approachBand * 0.18, 0, 1);
    const viewFov = THREE.MathUtils.degToRad(camera.fov);
    const desiredDiameter = mix(0.075, 0.36, 1 - smoothstep(90, 620, distance));
    const screenLockedScale = Math.tan(viewFov * desiredDiameter * 0.5) * distance;
    const baseSurfaceScale = optics.surfaceScale * mix(1.0, 1.04, 1 - normalized);
    const surfaceScale = clamp(
        Math.max(baseSurfaceScale, screenLockedScale),
        optics.surfaceScale * 0.95,
        optics.surfaceScale * 11.5
    );
    const opticsGain = profile.optics;

    updateCatalogVisibility(false);
    updateGalaxyBackdrop(distance, dt, { ...profile, backdrop: profile.backdrop * visualBudget });

    if (farFieldMaterial) {
        farField.position.copy(camera.position);
        farFieldMaterial.opacity = farAlpha;
        farFieldMaterial.size = mix(0.62, 1.26, smoothstep(2500, 40000, distance));
        farField.visible = farAlpha > 0.015;
    }

    if (galaxyMaterial) {
        galaxyField.position.copy(camera.position);
        galaxyMaterial.opacity = galaxyAlpha;
        galaxyMaterial.size = mix(0.32, 0.46, smoothstep(2200, 40000, distance));
        galaxyField.visible = galaxyAlpha > 0.01;
    }

    if (starClusterMaterial) {
        starClusterField.position.copy(camera.position);
        starClusterMaterial.opacity = starClusterAlpha;
        starClusterMaterial.size = mix(0.72, 1.72, smoothstep(2600, 40000, distance));
        starClusterField.visible = starClusterAlpha > 0.012;
        starClusterField.rotation.y += dt * 0.00085 + (dragging ? dt * 0.0007 : 0);
    }

    if (galaxySparkMaterial) {
        galaxySparkField.position.copy(camera.position);
        galaxySparkMaterial.opacity = galaxyAlpha * profile.spark;
        galaxySparkMaterial.size = mix(0.42, 0.58, smoothstep(2200, 40000, distance));
        galaxySparkField.visible = galaxySparkMaterial.opacity > 0.004;
    }

    if (cosmicMistMaterial) {
        cosmicMistField.position.copy(camera.position);
        cosmicMistMaterial.opacity = clamp(mistAlpha + midFieldBand * 0.055, 0, 0.56);
        cosmicMistMaterial.size = mix(0.78, 1.45, smoothstep(760, 40000, distance));
        cosmicMistField.visible = mistAlpha > 0.012;
        cosmicMistField.rotation.y += dt * 0.0012;
        cosmicMistField.rotation.z += dt * 0.00045;
    }

    if (catalogMaterial && catalogField) {
        const visibleDensity = visibleCatalogCount > 0 ? clamp(visibleCatalogCount / 180, 0.38, 1) : 0;
        catalogMaterial.opacity = clamp(catalogAlpha * mix(0.56, 0.96, smoothstep(260, 4200, distance)) * visibleDensity, 0, 0.95);
        catalogMaterial.size = mix(1.45, 3.25, smoothstep(600, 5200, distance));
        catalogField.visible = catalogMaterial.opacity > 0.012;
    }

    if (approachDustMaterial && approachDustField) {
        const dustAlpha = clamp(profile.approachDust * (approachBand * 0.92 + midFieldBand * 0.18), 0, 0.84);
        approachDustField.position.copy(focusCurrent);
        approachDustField.rotation.y += dt * 0.012;
        approachDustField.rotation.x += (wrapSignedRadians(cameraState.pitch) * 0.08 - approachDustField.rotation.x) * Math.min(1, dt * 1.8);
        approachDustField.rotation.z += (cameraState.yaw * 0.025 - approachDustField.rotation.z) * Math.min(1, dt * 1.4);
        approachDustMaterial.opacity = dustAlpha;
        approachDustMaterial.size = mix(1.08, 2.18, clamp(approachBand + midFieldBand * 0.35, 0, 1));
        approachDustField.visible = dustAlpha > 0.01;
    }

    brightStars.forEach(({ sprite, material, baseOpacity, phase }, index) => {
        const pulse = Math.sin(clock.elapsedTime * (0.6 + index * 0.004) + phase) * 0.5 + 0.5;
        sprite.visible = brightAlpha > 0.006;
        material.opacity = brightAlpha * baseOpacity * (0.72 + pulse * 0.28);
        sprite.material.rotation = Math.sin(clock.elapsedTime * 0.018 + phase) * 0.08;
    });

    if (focusGroup && surfaceMesh && surfaceMaterial) {
        focusGroup.position.copy(focusCurrent);
        focusGroup.scale.setScalar(surfaceScale);
        focusGroup.visible = starAlpha > 0.01;
        surfaceMesh.rotation.y = Math.PI / 2 + clock.elapsedTime * optics.rotationSpeed;
        surfaceMesh.rotation.x = Math.sin(clock.elapsedTime * 0.07) * optics.wobble;
        limbGlowMesh.rotation.y = Math.PI / 2 + clock.elapsedTime * optics.flowRotationSpeed * 0.42;
        limbGlowMesh.rotation.x = surfaceMesh.rotation.x * 0.65;
        chromosphereMesh.rotation.y = Math.PI / 2 + clock.elapsedTime * optics.flowRotationSpeed * 0.72;
        chromosphereMesh.rotation.x = surfaceMesh.rotation.x * 0.45;
        outlineMesh.rotation.y = Math.PI / 2 + clock.elapsedTime * optics.flowRotationSpeed * 0.58;
        outlineMesh.rotation.x = surfaceMesh.rotation.x * 0.5;
        surfaceMaterial.opacity = surfaceAlpha;
        limbGlowMaterial.opacity = clamp(starAlpha * opticsGain * mix(0.8, 1.15, opticBoost), 0, 1);
        chromosphereMaterial.opacity = clamp(starAlpha * opticsGain * mix(0.5, 0.95, opticBoost), 0, 1);
        outlineMaterial.opacity = clamp(starAlpha * opticsGain * mix(0.46, 0.82, opticBoost), 0, 0.9);
        photosphereMaterial.opacity = clamp(starAlpha * opticsGain * mix(optics.auraOpacity * 0.2, optics.auraOpacity * 0.5, opticBoost), 0, 0.62);
        haloMaterial.opacity = clamp(starAlpha * opticsGain * mix(optics.haloOpacity * 0.34, optics.haloOpacity * 0.72, opticBoost), 0, 0.86);
        coronaMaterial.opacity = clamp(starAlpha * opticsGain * mix(optics.coronaOpacity * 0.4, optics.coronaOpacity * 0.88, opticBoost), 0, 0.86);
        photosphereSprite.scale.setScalar(optics.auraScale * 0.5 + opticBoost * 0.55);
        haloSprite.scale.setScalar(optics.haloScale * 0.82 + opticBoost * 0.98);
        coronaSprite.scale.setScalar(optics.coronaScale * 0.96 + opticBoost * 0.6);
        coronaMaterial.rotation = clock.elapsedTime * 0.018;

        flareSprites.forEach(({ sprite, material, entry }, index) => {
            const pulse = Math.sin(clock.elapsedTime * (0.4 + index * 0.06)) * 0.5 + 0.5;
            material.opacity = clamp(
                starAlpha * opticBoost * opticsGain * entry.opacity * optics.flareStrength * visualBudget * (0.78 + pulse * 0.28),
                0,
                0.18
            );
            sprite.material.rotation = entry.rotation + Math.sin(clock.elapsedTime * 0.08 + index) * 0.03;
        });
    }

    featuredTargets.forEach((target) => {
        const sprite = targetSprites.get(target.id);
        const material = targetMaterials.get(target.id);
        const opticSprite = targetOpticSprites.get(target.id);
        const opticMaterial = targetOpticMaterials.get(target.id);
        if (!sprite || !material) {
            return;
        }
        const isActive = target.id === activeTarget.id;
        const isHover = target.id === hoverTargetId;
        const position = targetPosition(target);
        const baseOpacity = (isActive ? 1 - starAlpha : mix(0.35, 0.9, clusterAlpha)) * profile.targetSprites;
        const hoverBoost = isHover ? 0.24 : 0;
        sprite.position.copy(position);
        const depth = Math.max(1, camera.position.distanceTo(position));
        const angularScale = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * depth;
        const spriteScale = clamp(
            angularScale * (distance > 2500 ? 0.012 : 0.028) * Math.sqrt(target.radius),
            7,
            distance > 2500 ? 180 : 260
        );

        sprite.visible = !isActive || starAlpha < 0.96;
        sprite.scale.setScalar(spriteScale * (isHover ? 1.18 : 1));
        material.opacity = clamp(baseOpacity + hoverBoost, 0, 1);

        if (opticSprite && opticMaterial) {
            const opticDepth = Math.max(1, camera.position.distanceTo(position));
            const opticAngularScale = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * opticDepth;
            const activeOpticBoost = isActive ? mix(0.85, 1.55, approachBand) : 0.5;
            const surfaceCut = smoothstep(34, 62, distance);
            const opticOpacity = profile.targetOptics * (isActive ? 0.25 + approachBand * 0.38 : 0.07 + clusterAlpha * 0.08) * surfaceCut;
            opticSprite.position.copy(position);
            opticSprite.visible = opticOpacity > 0.006;
            opticSprite.scale.setScalar(clamp(
                opticAngularScale * 0.055 * Math.sqrt(target.radius) * activeOpticBoost,
                18,
                isActive ? 760 : 360
            ));
            opticMaterial.opacity = clamp(opticOpacity + (isHover ? 0.08 : 0), 0, 0.82);
            opticMaterial.rotation = Math.sin(clock.elapsedTime * 0.025 + target.spectralIndex) * 0.08;
        }
    });

    updateSceneLabels(false, labelBudget);
}

function shouldShowInspector() {
    return cameraState.targetDistance <= 400 || cameraState.distance <= 520 || activeRegime === "System Approach" || activeRegime === "Surface";
}

function postState(force = false) {
    const now = performance.now();
    if (!force && now - lastStatePost < STATE_INTERVAL) {
        return;
    }

    lastStatePost = now;
    self.postMessage({
        type: "state",
        state: {
            ready: true,
            activeId: activeTarget.id,
            activeTarget: serializeTarget(activeTarget),
            hoverId: hoverTargetId,
            distance: cameraState.distance,
            targetDistance: cameraState.targetDistance,
            regime: activeRegime,
            yaw: THREE.MathUtils.radToDeg(cameraState.yaw) % 360,
            pitch: THREE.MathUtils.radToDeg(wrapSignedRadians(cameraState.pitch)),
            cameraMode: "map",
            mapCenterTargetId: activeTarget.id,
            lodBlend: scaleFromDistance(cameraState.distance) / 100,
            fps: measuredFps,
            frameMs: measuredFrameMs,
            initPhase,
            catalogCount,
            visibleCatalogCount,
            qualityTier,
            visibleLabelCount,
            inspectorVisible: shouldShowInspector(),
            hintVisible: cameraState.targetDistance > 400,
            debugVisible,
            detail: `${activeRegime} · ${visibleCatalogCount}/${catalogCount || featuredTargets.length} visible · ${visibleLabelCount} labels · ${measuredFps || "--"} fps · ${qualityTier}`,
            labels: []
        }
    });
}

function pickTarget(x, y) {
    const labelHit = labelHitTargets
        .filter((entry) => x >= entry.rect.left && x <= entry.rect.right && y >= entry.rect.top && y <= entry.rect.bottom)
        .sort((a, b) => b.priority - a.priority)[0];
    if (labelHit) {
        return labelHit.target;
    }

    let best = null;
    let bestDistance = Infinity;
    currentInteractiveTargets().forEach((target) => {
        setVectorFromTarget(pickVector, target);
        pickVector.project(camera);
        if (pickVector.z < -1 || pickVector.z > 1) {
            return;
        }

        const sx = (pickVector.x * 0.5 + 0.5) * canvasSize.width;
        const sy = (-pickVector.y * 0.5 + 0.5) * canvasSize.height;
        const radius = target.id === activeTarget.id
            ? 76
            : target.featured
                ? (activeRegime === "Deep Field" || activeRegime === "Cluster" ? 54 : 46)
                : (activeRegime === "Deep Field" || activeRegime === "Cluster"
                    ? 26 + clamp((target.brightness || 0.5) * 22, 0, 24)
                    : 22 + clamp((target.brightness || 0.5) * 18, 0, 18));
        const distance = Math.hypot(x - sx, y - sy);
        if (distance < radius && distance < bestDistance) {
            best = target;
            bestDistance = distance;
        }
    });
    return best;
}

function focusTargetById(id, fly = true) {
    const nextTarget = getTarget(id);
    if (!nextTarget) {
        return;
    }

    activeTarget = nextTarget;
    updatePaletteTexture(nextTarget.palette);
    updateActivityTexture(nextTarget);
    updateSurfaceUniforms(nextTarget);
    updateOpticalColors(nextTarget);
    focusTarget.copy(targetPosition(nextTarget));
    rebuildNearCatalogTargets();
    lastLabelSelection = 0;
    if (fly) {
        flightState.active = true;
        flightState.startedAt = performance.now();
        flightState.targetId = nextTarget.id;
        flightStart.copy(focusCurrent);
        flightEnd.copy(focusTarget);
        cameraState.targetDistance = recommendedFocusDistance(cameraState.targetDistance);
    } else {
        focusCurrent.copy(focusTarget);
    }
    updateCatalogVisibility(true);

    self.postMessage({
        type: "focusChanged",
        id: nextTarget.id,
        activeTarget: serializeTarget(nextTarget),
        targetDistance: cameraState.targetDistance
    });
    postState(true);
}

function setSize(width, height, dpr) {
    canvasSize = { width, height, dpr };
    if (!renderer || !camera) {
        return;
    }

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function updateAdaptiveQuality() {
    if (!measuredFrameMs) {
        return;
    }

    if (measuredFrameMs > 18.5) {
        slowFrameWindows += 1;
        fastFrameWindows = 0;
    } else if (measuredFrameMs < 12.5) {
        fastFrameWindows += 1;
        slowFrameWindows = 0;
    } else {
        slowFrameWindows = 0;
        fastFrameWindows = 0;
    }

    if (slowFrameWindows >= 2 && adaptiveLevel < 2) {
        adaptiveLevel += 1;
        slowFrameWindows = 0;
    }

    if (fastFrameWindows >= 8 && adaptiveLevel > 0) {
        adaptiveLevel -= 1;
        fastFrameWindows = 0;
    }

    qualityTier = adaptiveLevel === 0
        ? qualitySettings.label
        : adaptiveLevel === 1
            ? `${qualitySettings.label}-balanced`
            : `${qualitySettings.label}-lean`;
}

function animate() {
    if (disposed) {
        return;
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    const frameStart = performance.now();
    const normalized = updateCamera(dt);
    updateLod(normalized, dt);
    renderer.render(scene, camera);
    const frameEnd = performance.now();
    fpsFrames += 1;
    fpsRenderMs += frameEnd - frameStart;
    if (frameEnd - fpsTime >= 1000) {
        measuredFps = Math.round(fpsFrames * 1000 / (frameEnd - fpsTime));
        measuredFrameMs = Math.round((fpsRenderMs / Math.max(1, fpsFrames)) * 10) / 10;
        fpsFrames = 0;
        fpsRenderMs = 0;
        fpsTime = frameEnd;
        updateAdaptiveQuality();
    }
    if (!firstFramePosted) {
        firstFramePosted = true;
        self.postMessage({
            type: "firstFrameReady",
            state: {
                ready: true,
                activeId: activeTarget.id,
                activeTarget: serializeTarget(activeTarget),
                distance: cameraState.distance,
                targetDistance: cameraState.targetDistance,
                regime: activeRegime,
                cameraMode: "map",
                mapCenterTargetId: activeTarget.id,
                lodBlend: scaleFromDistance(cameraState.distance) / 100,
                initPhase,
                catalogCount,
                visibleCatalogCount,
                qualityTier,
                frameMs: measuredFrameMs,
                visibleLabelCount,
                inspectorVisible: shouldShowInspector(),
                hintVisible: cameraState.targetDistance > 400,
                debugVisible,
                labels: []
            }
        });
    }
    postState();

    if (typeof self.requestAnimationFrame === "function") {
        self.requestAnimationFrame(animate);
    } else {
        setTimeout(() => animate(), 16);
    }
}

async function init(message) {
    if (!self.navigator?.gpu) {
        self.postMessage({ type: "unsupported", reason: "WebGPU is not available inside the render worker." });
        return;
    }

    postBootProgress("minimal", 0.06, "Starting WebGPU observatory");
    debugVisible = Boolean(message.debug);
    featuredTargets = normalizeFeaturedTargets(message.targets || []);
    catalogTargets = [];
    targets = featuredTargets;
    activeTarget = getTarget(message.initialTargetId);
    cameraState.distance = clamp(message.initialDistance || MAX_DISTANCE, MIN_DISTANCE, MAX_DISTANCE);
    cameraState.targetDistance = cameraState.distance;
    cameraState.yaw = Math.PI / 2;
    cameraState.targetYaw = cameraState.yaw;
    cameraState.pitch = 0.52;
    cameraState.targetPitch = cameraState.pitch;
    firstFramePosted = false;
    initialized = false;
    catalogCount = featuredTargets.length;
    visibleCatalogCount = 0;
    visibleLabelCount = 0;
    visibleCatalogTargets = [];
    deepCatalogTargets = [];
    nearCatalogTargets = [];
    lastCatalogVisibilityUpdate = 0;
    lastCatalogVisibilitySignature = "";
    adaptiveLevel = 0;
    slowFrameWindows = 0;
    fastFrameWindows = 0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01030a);
    scene.fog = new THREE.FogExp2(0x020510, 0.000012);

    camera = new THREE.PerspectiveCamera(28, message.width / message.height, 0.01, 120000);

    renderer = new THREE.WebGPURenderer({
        canvas: message.canvas,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.setClearColor(0x01030a, 1);
    setSize(message.width, message.height, message.dpr || 1);
    if (typeof renderer.init === "function") {
        await renderer.init();
    }

    const budgetCounts = {
        safe: {
            far: 42000,
            galaxy: 14000,
            spark: 900,
            mist: 6500,
            approachDust: 1400,
            cluster: 4200,
            bright: 10,
            catalog: 6000,
            pickable: 1400,
            labels: 10,
            prominence: 0,
            backdropWidth: 1280,
            backdropHeight: 640,
            backdropDustWidth: 1024,
            backdropDustHeight: 512,
            backdropHazeWidth: 768,
            backdropHazeHeight: 384,
            surfaceWidth: 1024,
            surfaceHeight: 512,
            activityWidth: 512,
            activityHeight: 256,
            sphereWidth: 128,
            sphereHeight: 64,
            label: "safe"
        },
        standard: {
            far: 76000,
            galaxy: 26000,
            spark: 2600,
            mist: 14000,
            approachDust: 2400,
            cluster: 9000,
            bright: 26,
            catalog: 10000,
            pickable: 3600,
            labels: 16,
            prominence: 0,
            backdropWidth: 1536,
            backdropHeight: 768,
            backdropDustWidth: 1280,
            backdropDustHeight: 640,
            backdropHazeWidth: 1024,
            backdropHazeHeight: 512,
            surfaceWidth: 2048,
            surfaceHeight: 1024,
            activityWidth: 1024,
            activityHeight: 512,
            sphereWidth: 224,
            sphereHeight: 112,
            label: "standard"
        },
        immersive: {
            far: 130000,
            galaxy: 52000,
            spark: 7800,
            mist: 36000,
            approachDust: 5200,
            cluster: 18000,
            bright: 44,
            catalog: 20000,
            pickable: 6200,
            labels: 20,
            prominence: 0,
            backdropWidth: 2048,
            backdropHeight: 1024,
            backdropDustWidth: 1536,
            backdropDustHeight: 768,
            backdropHazeWidth: 1280,
            backdropHazeHeight: 640,
            surfaceWidth: 2048,
            surfaceHeight: 1024,
            activityWidth: 1024,
            activityHeight: 512,
            sphereWidth: 256,
            sphereHeight: 128,
            label: "immersive"
        }
    };
    qualitySettings = budgetCounts[message.budget] || budgetCounts.standard;
    qualityTier = qualitySettings.label;

    postBootProgress("minimal", 0.18, "Building first star frame");
    activeRegime = getRegime(cameraState.distance);
    focusTarget.copy(targetPosition(activeTarget));
    focusCurrent.copy(focusTarget);

    farFieldMaterial = new THREE.PointsMaterial({
        size: 1.02,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    farField = new THREE.Points(createStarField(qualitySettings.far, 70000, false), farFieldMaterial);
    farField.renderOrder = 1;
    farField.frustumCulled = false;
    scene.add(farField);

    createTargetSprites(makeRadialTexture(96, [255, 255, 255], [255, 190, 110], 2.1));

    initialized = true;
    postBootProgress("minimal", 0.34, "First star frame ready");
    clock.start();
    fpsTime = performance.now();
    animate();
    await yieldToRender();

    postBootProgress("catalog", 0.44, "Distributing navigable stars");
    const requestedCatalogCount = Number.isFinite(message.catalogCount) ? clamp(Math.round(message.catalogCount), 64, 20000) : qualitySettings.catalog;
    catalogTargets = generateCatalogTargets(
        Math.max(0, requestedCatalogCount - featuredTargets.length),
        featuredTargets
    );
    targets = [...featuredTargets, ...catalogTargets];
    buildInteractiveTargets(qualitySettings.pickable);
    activeTarget = getTarget(message.initialTargetId);
    catalogCount = targets.length;
    rebuildNearCatalogTargets();

    catalogMaterial = new THREE.PointsMaterial({
        size: 1.55,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false
    });
    catalogField = new THREE.Points(createCatalogField(targets), catalogMaterial);
    catalogField.renderOrder = 7;
    catalogField.frustumCulled = false;
    scene.add(catalogField);

    createSceneLabels(qualitySettings.labels);
    updateCatalogVisibility(true);
    postBootProgress("catalog", 0.58, `${catalogCount} navigable stars ready`);
    postState(true);
    await yieldToRender();

    postBootProgress("enhance", 0.66, "Preparing deep-space structure");
    starClusterMaterial = new THREE.PointsMaterial({
        size: 1.55,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.64,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    starClusterField = new THREE.Points(createStarClusterField(qualitySettings.cluster, 68000), starClusterMaterial);
    starClusterField.rotation.set(0.18, -0.48, -0.18);
    starClusterField.renderOrder = 2;
    starClusterField.frustumCulled = false;
    scene.add(starClusterField);

    galaxyMaterial = new THREE.PointsMaterial({
        size: 1.0,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    galaxyField = new THREE.Points(createGalaxyField(qualitySettings.galaxy, 46000), galaxyMaterial);
    galaxyField.rotation.set(0.36, -0.62, -0.48);
    galaxyField.renderOrder = 3;
    galaxyField.frustumCulled = false;
    scene.add(galaxyField);

    galaxySparkMaterial = new THREE.PointsMaterial({
        size: 1.4,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    galaxySparkField = new THREE.Points(createGalaxySparkField(qualitySettings.spark, 43000), galaxySparkMaterial);
    galaxySparkField.rotation.copy(galaxyField.rotation);
    galaxySparkField.renderOrder = 5;
    galaxySparkField.frustumCulled = false;
    scene.add(galaxySparkField);

    cosmicMistMaterial = new THREE.PointsMaterial({
        size: 1.2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    cosmicMistField = new THREE.Points(createCosmicMistField(qualitySettings.mist, 76000), cosmicMistMaterial);
    cosmicMistField.rotation.set(0.18, -0.3, -0.18);
    cosmicMistField.renderOrder = 4;
    cosmicMistField.frustumCulled = false;
    scene.add(cosmicMistField);

    approachDustMaterial = new THREE.PointsMaterial({
        size: 1.15,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
    });
    approachDustField = new THREE.Points(createApproachDustField(qualitySettings.approachDust, 1500), approachDustMaterial);
    approachDustField.renderOrder = 6;
    approachDustField.visible = false;
    scene.add(approachDustField);

    createGalaxyBackdrop();
    createBrightStarSprites(qualitySettings.bright, 66000);
    postBootProgress("enhance", 0.82, "Preparing focused stellar surface");

    const loadedAssets = await Promise.allSettled([
        loadBitmapTexture("./academy-star/sun_surface.png", THREE.NoColorSpace),
        loadLuminanceAlphaTexture("./academy-star/sun_halo.png"),
        loadLuminanceAlphaTexture("./academy-star/corona.png"),
        loadLuminanceAlphaTexture("./academy-star/solarflare.png")
    ]);
    assetTextures = {
        surface: loadedAssets[0].status === "fulfilled" ? loadedAssets[0].value : null,
        halo: loadedAssets[1].status === "fulfilled" ? loadedAssets[1].value : null,
        corona: loadedAssets[2].status === "fulfilled" ? loadedAssets[2].value : null,
        flare: loadedAssets[3].status === "fulfilled" ? loadedAssets[3].value : null
    };

    surfaceTexture = assetTextures.surface || makeSurfaceTexture(qualitySettings.surfaceWidth, qualitySettings.surfaceHeight, {
        id: "shared-stellar-granulation",
        spectrum: "G",
        spectralIndex: 0.62,
        radius: 1,
        stability: "Calm"
    });
    activityTexture = makeActivityTexture(qualitySettings.activityWidth, qualitySettings.activityHeight, activeTarget);
    createFocusedStar(surfaceTexture);
    if (qualitySettings.prominence > 0) {
        createProminenceSprites(qualitySettings.prominence);
    }
    updateSurfaceUniforms(activeTarget);
    updateOpticalColors(activeTarget);
    createTargetOpticSprites(makePsfTexture(160));
    focusTarget.copy(targetPosition(activeTarget));
    focusCurrent.copy(focusTarget);

    activeRegime = getRegime(cameraState.distance);
    initPhase = "ready";
    postBootProgress("ready", 1, "Observatory ready");
    self.postMessage({
        type: "ready",
        state: {
            ready: true,
            activeId: activeTarget.id,
            activeTarget: serializeTarget(activeTarget),
            distance: cameraState.distance,
            targetDistance: cameraState.targetDistance,
            regime: activeRegime,
            yaw: THREE.MathUtils.radToDeg(cameraState.yaw),
            pitch: THREE.MathUtils.radToDeg(wrapSignedRadians(cameraState.pitch)),
            cameraMode: "map",
            mapCenterTargetId: activeTarget.id,
            lodBlend: scaleFromDistance(cameraState.distance) / 100,
            initPhase,
            catalogCount,
            visibleCatalogCount,
            qualityTier,
            frameMs: measuredFrameMs,
            visibleLabelCount,
            inspectorVisible: shouldShowInspector(),
            hintVisible: cameraState.targetDistance > 400,
            debugVisible,
            labels: []
        }
    });
}

self.addEventListener("message", async (event) => {
    const message = event.data || {};
    try {
        if (message.type === "init") {
            await init(message);
            return;
        }

        if (!initialized) {
            return;
        }

        if (message.type === "resize") {
            setSize(message.width, message.height, message.dpr || 1);
            postState(true);
            return;
        }

        if (message.type === "wheel") {
            const previousDistance = cameraState.targetDistance;
            cameraState.targetDistance = clamp(
                cameraState.targetDistance * Math.exp(-message.deltaY * 0.0012),
                MIN_DISTANCE,
                MAX_DISTANCE
            );
            if (Number.isFinite(message.x) && Number.isFinite(message.y) && previousDistance > 120) {
                const zoomDelta = clamp(Math.abs(Math.log(cameraState.targetDistance / previousDistance)), 0, 0.9);
                const edgeX = clamp(message.x, 0, 1) - 0.5;
                const edgeY = 0.5 - clamp(message.y, 0, 1);
                const anchorStrength = zoomDelta * smoothstep(160, 2600, previousDistance);
                cameraState.targetYaw -= edgeX * anchorStrength * 0.34;
                cameraState.targetPitch += edgeY * anchorStrength * 0.24;
            }
            lastCatalogVisibilityUpdate = 0;
            postState(true);
            return;
        }

        if (message.type === "setDistance") {
            cameraState.targetDistance = clamp(message.distance, MIN_DISTANCE, MAX_DISTANCE);
            lastCatalogVisibilityUpdate = 0;
            postState(true);
            return;
        }

        if (message.type === "orbitStart") {
            dragging = true;
            return;
        }

        if (message.type === "orbitMove") {
            cameraState.targetYaw -= message.dx * 0.0042;
            cameraState.targetPitch -= message.dy * 0.0028;
            lastCatalogVisibilityUpdate = 0;
            return;
        }

        if (message.type === "orbitEnd") {
            dragging = false;
            return;
        }

        if (message.type === "pick") {
            const target = pickTarget(message.x, message.y);
            if (message.mode === "commit" && target) {
                focusTargetById(target.id, true);
                return;
            }

            const nextHoverId = target ? target.id : null;
            if (nextHoverId !== hoverTargetId) {
                hoverTargetId = nextHoverId;
                lastLabelSelection = 0;
                updateSceneLabels(true);
                self.postMessage({ type: "hover", id: hoverTargetId });
            }
            return;
        }

        if (message.type === "focusTarget") {
            focusTargetById(message.id, true);
            return;
        }

        if (message.type === "dispose") {
            disposed = true;
            renderer?.dispose();
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            message: error.message || "Scale observatory worker error.",
            error: String(error?.stack || error)
        });
    }
});
