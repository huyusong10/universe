const WORLD_Z = [0, 0, 1];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TWO_PI = Math.PI * 2;
const MIN_SCALE = 1.18;
const MAX_SCALE = 24.5;
const INSTANCE_STRIDE_FLOATS = 12;

let sceneCanvas = null;
let labelCanvas = null;
let labelContext = null;
let gpu = null;
let catalog = null;
let dust = null;
let galacticModel = null;
let animationHandle = 0;
let initialized = false;
let readySent = false;
let firstFrameSent = false;

const config = {
  debug: false,
  budget: "standard",
  catalog: 0,
  seed: 136516,
  target: "",
  initialDistance: 22
};

const view = {
  width: 1,
  height: 1,
  dpr: 1,
  pixelWidth: 1,
  pixelHeight: 1,
  aspect: 1
};

const camera = {
  right: [0.92, -0.38, 0],
  up: [0.31, 0.75, 0.59],
  forward: [-0.22, -0.54, 0.81],
  target: [0, 0, 0],
  targetTarget: [0, 0, 0],
  scale: 22,
  scaleTarget: 22,
  yawVelocity: 0,
  pitchVelocity: 0,
  dragging: false,
  lastInteraction: 0
};

const interaction = {
  pointerX: -1000,
  pointerY: -1000,
  hoverIndex: -1,
  activeIndex: -1
};

const labels = {
  selected: [],
  rects: [],
  lastRankAt: 0,
  lastLod: "",
  count: 0
};

const metrics = {
  frameCount: 0,
  lastFpsAt: 0,
  fps: 0,
  lastStateAt: 0
};

function requestFrame(callback) {
  if (typeof self.requestAnimationFrame === "function") {
    return self.requestAnimationFrame(callback);
  }
  return self.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(handle) {
  if (typeof self.cancelAnimationFrame === "function") {
    self.cancelAnimationFrame(handle);
    return;
  }
  self.clearTimeout(handle);
}

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]) || 1;
}

function normalize(v) {
  const inv = 1 / length3(v);
  return [v[0] * inv, v[1] * inv, v[2] * inv];
}

function rotateVector(v, axis, angle) {
  const n = normalize(axis);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const d = dot(n, v);
  return [
    v[0] * cos + (n[1] * v[2] - n[2] * v[1]) * sin + n[0] * d * (1 - cos),
    v[1] * cos + (n[2] * v[0] - n[0] * v[2]) * sin + n[1] * d * (1 - cos),
    v[2] * cos + (n[0] * v[1] - n[1] * v[0]) * sin + n[2] * d * (1 - cos)
  ];
}

function rotateCamera(axis, angle) {
  camera.right = rotateVector(camera.right, axis, angle);
  camera.up = rotateVector(camera.up, axis, angle);
  camera.forward = rotateVector(camera.forward, axis, angle);
  orthonormalizeCamera();
}

function orthonormalizeCamera() {
  camera.right = normalize(camera.right);
  const upWithoutRight = [
    camera.up[0] - camera.right[0] * dot(camera.up, camera.right),
    camera.up[1] - camera.right[1] * dot(camera.up, camera.right),
    camera.up[2] - camera.right[2] * dot(camera.up, camera.right)
  ];
  camera.up = normalize(upWithoutRight);
  camera.forward = normalize(cross(camera.right, camera.up));
}

function createRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function gaussian(random) {
  const u = Math.max(1e-6, random());
  const v = Math.max(1e-6, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

function tempToRgb(kelvin) {
  const t = kelvin / 100;
  let red;
  let green;
  let blue;
  if (t <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(t) - 161.1195681661;
    blue = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    red = 329.698727446 * (t - 60) ** -0.1332047592;
    green = 288.1221695283 * (t - 60) ** -0.0755148492;
    blue = 255;
  }
  return [
    clamp(red / 255, 0, 1),
    clamp(green / 255, 0, 1),
    clamp(blue / 255, 0, 1)
  ];
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveBudgets() {
  const key = ["safe", "standard", "immersive"].includes(config.budget)
    ? config.budget
    : "standard";
  const defaults = {
    safe: { catalog: 6000, render: 6000, dust: 42000, labels: 36 },
    standard: { catalog: 10000, render: 10000, dust: 78000, labels: 48 },
    immersive: { catalog: 20000, render: 14000, dust: 120000, labels: 60 }
  };
  const budget = defaults[key];
  return {
    catalogCount: config.catalog > 0 ? config.catalog : budget.catalog,
    renderCount: budget.render,
    dustCount: budget.dust,
    labelLimit: budget.labels,
    key
  };
}

function createVoidFields(random) {
  const voids = [];
  for (let i = 0; i < 9; i += 1) {
    const radius = mix(3.1, 12.8, random() ** 0.72);
    const angle = random() * TWO_PI;
    voids.push({
      x: Math.cos(angle) * radius * mix(0.75, 1.08, random()),
      y: Math.sin(angle) * radius * mix(0.75, 1.08, random()),
      radius: mix(0.8, 2.2, random()),
      strength: mix(0.35, 0.74, random())
    });
  }
  return voids;
}

function voidInfluence(voids, x, y) {
  let influence = 0;
  for (const field of voids) {
    const dx = x - field.x;
    const dy = y - field.y;
    const falloff = Math.exp(-(dx * dx + dy * dy) / (field.radius * field.radius * 2));
    influence += falloff * field.strength;
  }
  return clamp(influence, 0, 0.92);
}

function spiralPoint(random, armCount) {
  const arm = Math.floor(random() * armCount);
  const radius = 0.55 + (random() ** 0.48) * 17.6;
  const armBase = (arm / armCount) * TWO_PI;
  const swirl = 0.58 * radius + 0.22 * Math.sin(radius * 0.9);
  const spread = mix(0.04, 0.32, radius / 18) * gaussian(random);
  const theta = armBase + swirl + spread;
  const flare = 1 + 0.045 * radius * gaussian(random);
  return {
    x: Math.cos(theta) * radius * flare,
    y: Math.sin(theta) * radius * flare,
    radius,
    arm
  };
}

function generateClusterCenters(random, voids) {
  const centers = [];
  for (let i = 0; i < 18; i += 1) {
    let point = spiralPoint(random, 5);
    for (let retry = 0; retry < 8 && voidInfluence(voids, point.x, point.y) > 0.45; retry += 1) {
      point = spiralPoint(random, 5);
    }
    centers.push({
      x: point.x,
      y: point.y,
      z: gaussian(random) * 0.16,
      radius: mix(0.18, 0.62, random()),
      temperature: mix(3900, 9200, random()),
      weight: mix(0.45, 1.0, random())
    });
  }
  return centers;
}

function sampleCatalogPosition(random, voids, clusters) {
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const component = random();
    let x;
    let y;
    let z;
    let radius;
    let componentWeight;
    let clusterBoost = 0;

    if (component < 0.2) {
      const bulgeRadius = Math.abs(gaussian(random)) ** 1.38 * 2.8;
      const theta = random() * TWO_PI;
      const elliptic = mix(0.62, 1.28, random());
      x = Math.cos(theta) * bulgeRadius * elliptic;
      y = Math.sin(theta) * bulgeRadius * mix(0.72, 1.18, random());
      z = gaussian(random) * mix(0.18, 0.72, random());
      radius = Math.hypot(x, y);
      componentWeight = 1.15;
    } else if (component < 0.86) {
      const point = spiralPoint(random, 5);
      x = point.x;
      y = point.y;
      radius = point.radius;
      z = gaussian(random) * (0.12 + 0.04 * radius);
      componentWeight = 1.04;
    } else if (component < 0.96) {
      const center = clusters[Math.floor(random() * clusters.length)];
      const spread = center.radius * Math.abs(gaussian(random));
      const theta = random() * TWO_PI;
      x = center.x + Math.cos(theta) * spread;
      y = center.y + Math.sin(theta) * spread;
      z = center.z + gaussian(random) * center.radius * 0.42;
      radius = Math.hypot(x, y);
      componentWeight = 0.98;
      clusterBoost = center.weight;
    } else {
      const theta = random() * TWO_PI;
      radius = mix(12, 20.5, random() ** 0.42);
      x = Math.cos(theta) * radius * mix(0.72, 1.22, random());
      y = Math.sin(theta) * radius * mix(0.72, 1.22, random());
      z = gaussian(random) * mix(0.2, 1.4, random());
      componentWeight = random() > 0.62 ? 1.28 : 0.45;
    }

    const voidCut = voidInfluence(voids, x, y);
    if (random() > voidCut * 0.94 || attempt > 6) {
      return { x, y, z, radius, componentWeight, clusterBoost, voidCut };
    }
  }
  return { x: 0, y: 0, z: 0, radius: 0, componentWeight: 1, clusterBoost: 0, voidCut: 0 };
}

function generatedName(index, x, y) {
  const sector = Math.floor(((Math.atan2(y, x) + Math.PI) / TWO_PI) * 24)
    .toString(36)
    .toUpperCase();
  return `GSM ${sector}-${index.toString(36).toUpperCase().padStart(4, "0")}`;
}

function assignNames(data, ranked) {
  const primaryNames = [
    "Helios",
    "Sirius",
    "Canopus",
    "Rigil Kentaurus",
    "Arcturus",
    "Vega",
    "Capella",
    "Rigel",
    "Procyon",
    "Achernar",
    "Betelgeuse",
    "Hadar",
    "Altair",
    "Acrux",
    "Aldebaran",
    "Spica",
    "Antares",
    "Pollux",
    "Fomalhaut",
    "Deneb",
    "Mimosa",
    "Regulus",
    "Adhara",
    "Shaula",
    "Castor",
    "Bellatrix",
    "Elnath",
    "Miaplacidus",
    "Alnilam",
    "Alnair",
    "Alioth",
    "Dubhe",
    "Mirfak",
    "Wezen",
    "Kaus Australis",
    "Alkaid",
    "Sargas",
    "Avior",
    "Menkalinan",
    "Atria",
    "Alhena",
    "Peacock",
    "Alsephina",
    "Mirzam",
    "Polaris",
    "Hamal",
    "Diphda",
    "Nunki",
    "Alpheratz",
    "Mirach",
    "Alcyone",
    "Maia",
    "Electra",
    "Merope",
    "Atlas",
    "Pleione",
    "Celaeno",
    "Taygeta",
    "Sterope",
    "Meridian Core",
    "Carina Gate",
    "Cygnus Fold",
    "Vela Ember",
    "Lyra Drift",
    "Orion Spur",
    "Aquila Reach",
    "Perseus Anchor",
    "Taurus Wake",
    "Cassiopeia Thread"
  ];

  for (let rank = 0; rank < ranked.length && rank < primaryNames.length; rank += 1) {
    data.names[ranked[rank]] = primaryNames[rank];
  }
}

function buildCatalog() {
  const budgets = resolveBudgets();
  const count = budgets.catalogCount;
  const random = createRandom(config.seed);
  const voids = createVoidFields(random);
  const clusters = generateClusterCenters(random, voids);
  galacticModel = { voids, clusters };
  const data = {
    count,
    budgets,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    r: new Float32Array(count),
    g: new Float32Array(count),
    b: new Float32Array(count),
    brightness: new Float32Array(count),
    size: new Float32Array(count),
    importance: new Float32Array(count),
    labelScore: new Float32Array(count),
    pickRadius: new Float32Array(count),
    names: new Array(count),
    renderIndices: [],
    screen: new Float32Array(Math.min(count, budgets.renderCount) * 4)
  };

  for (let i = 0; i < count; i += 1) {
    const position = sampleCatalogPosition(random, voids, clusters);
    const coreBias = Math.exp(-(position.radius * position.radius) / 19);
    const armBias = clamp(1 - position.radius / 22, 0, 1);
    const brightRoll = random() ** mix(2.3, 8.0, armBias);
    const anchorBoost = position.componentWeight > 1.2 ? mix(0.35, 0.8, random()) : 0;
    const brightness = clamp(
      0.1 +
        brightRoll * 1.4 +
        coreBias * mix(0.25, 0.82, random()) +
        position.clusterBoost * 0.34 +
        Math.max(0, position.componentWeight - 0.82) * 0.18 +
        anchorBoost -
        position.voidCut * 0.18,
      0.04,
      2.2
    );
    const hotBias = random() < 0.18 + coreBias * 0.25 + position.clusterBoost * 0.16;
    const temp = hotBias
      ? mix(7200, 14600, random() ** 0.55)
      : mix(3200, 7600, random() ** 1.4);
    const color = tempToRgb(temp);
    const importance = clamp(
      brightness * 0.42 +
        coreBias * 0.35 +
        position.clusterBoost * 0.28 +
        Math.max(0, position.componentWeight - 0.82) * 0.12 +
        anchorBoost * 0.62 +
        random() * 0.12,
      0,
      1
    );
    const labelScore = clamp(
      importance * 0.74 + brightness * 0.16 + coreBias * 0.16 + anchorBoost * 0.42,
      0,
      1
    );

    data.x[i] = position.x;
    data.y[i] = position.y;
    data.z[i] = position.z;
    data.r[i] = color[0];
    data.g[i] = color[1];
    data.b[i] = color[2];
    data.brightness[i] = brightness;
    data.size[i] =
      mix(2.3, 10.6, clamp(brightness / 2.2, 0, 1)) *
      mix(0.82, 1.26, random()) *
      (importance > 0.94 ? mix(1.08, 1.44, importance) : 1);
    data.importance[i] = importance;
    data.labelScore[i] = labelScore;
    data.pickRadius[i] = mix(10, 26, Math.sqrt(importance));
    data.names[i] = generatedName(i, position.x, position.y);
  }

  const ranked = Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const scoreA =
      data.importance[a] * 1.1 + data.labelScore[a] * 0.75 + data.brightness[a] * 0.24;
    const scoreB =
      data.importance[b] * 1.1 + data.labelScore[b] * 0.75 + data.brightness[b] * 0.24;
    return scoreB - scoreA;
  });
  assignNames(data, ranked);

  const renderCount = Math.min(count, budgets.renderCount);
  data.renderIndices = ranked.slice(0, renderCount);
  const targetName = normalizeName(config.target);
  let active = data.renderIndices[Math.floor((Math.random() * Math.min(24, renderCount)) || 0)];
  if (targetName) {
    const match = data.names.findIndex((name) => normalizeName(name) === targetName);
    if (match >= 0) active = match;
  }
  if (!data.renderIndices.includes(active)) {
    data.renderIndices[renderCount - 1] = active;
  }
  interaction.activeIndex = active;
  return data;
}

function buildDust() {
  const random = createRandom(config.seed + 99173);
  const count = catalog.budgets.dustCount;
  const data = new Float32Array(count * INSTANCE_STRIDE_FLOATS);
  const voids = galacticModel?.voids || [];
  for (let i = 0; i < count; i += 1) {
    const component = random();
    let x;
    let y;
    let z;
    let density;
    let size;
    let temp;

    if (component < 0.34) {
      const radius = Math.abs(gaussian(random)) ** 1.55 * 3.8;
      const theta = random() * TWO_PI;
      x = Math.cos(theta) * radius * mix(0.8, 1.22, random());
      y = Math.sin(theta) * radius * mix(0.72, 1.1, random());
      z = gaussian(random) * mix(0.08, 0.34, random());
      density = clamp(1.18 - radius / 4.8 + random() * 0.18, 0.32, 1.26);
      size = mix(18, 48, random() ** 0.55) * mix(1.0, 1.42, density);
      temp = random() < 0.44 ? mix(6200, 11800, random()) : mix(3600, 6200, random());
    } else if (component < 0.86) {
      const point = spiralPoint(random, 5);
      const loosen = mix(0.72, 1.42, random());
      x = point.x * loosen + gaussian(random) * mix(0.08, 0.42, point.radius / 16);
      y = point.y * loosen + gaussian(random) * mix(0.08, 0.42, point.radius / 16);
      z = gaussian(random) * (0.08 + point.radius * 0.026);
      density = clamp(0.68 + (1 - point.radius / 20) * 0.38 + random() * 0.24, 0.22, 1.0);
      size = mix(11, 34, random() ** 0.7) * mix(0.86, 1.26, density);
      temp = random() < 0.38 ? mix(7200, 13400, random() ** 0.75) : mix(3400, 7600, random());
    } else {
      const theta = random() * TWO_PI;
      const radius = mix(11.5, 23, random() ** 0.5);
      x = Math.cos(theta) * radius * mix(0.76, 1.24, random());
      y = Math.sin(theta) * radius * mix(0.76, 1.24, random());
      z = gaussian(random) * mix(0.18, 1.8, random());
      density = mix(0.12, 0.42, random());
      size = mix(5.5, 17, random());
      temp = mix(3800, 9800, random());
    }

    const radius = Math.hypot(x, y);
    const theta = Math.atan2(y, x);
    const lane =
      Math.exp(-Math.abs(Math.sin(theta * 2.25 + radius * 0.68 + Math.sin(radius * 0.27))) * 4.2) *
      smoothstep(1.8, 15.5, radius);
    const voidCut = voidInfluence(voids, x, y);
    const opacityGate = clamp(1 - lane * 0.72 - voidCut * 0.86, 0.08, 1);
    const color = tempToRgb(temp);
    const offset = i * INSTANCE_STRIDE_FLOATS;
    data[offset + 0] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = temp;
    data[offset + 4] = color[0] * mix(0.38, 0.7, density);
    data[offset + 5] = color[1] * mix(0.4, 0.72, density);
    data[offset + 6] = color[2] * mix(0.46, 0.82, density);
    data[offset + 7] = clamp((0.36 + density * 1.05 + random() * 0.26) * opacityGate, 0.05, 1.34);
    data[offset + 8] = size;
    data[offset + 9] = clamp(density * opacityGate, 0.02, 1.0);
    data[offset + 10] = 0;
    data[offset + 11] = -1;
  }
  return { count, data };
}

function buildCatalogInstanceData() {
  const indices = catalog.renderIndices;
  const data = new Float32Array(indices.length * INSTANCE_STRIDE_FLOATS);
  for (let row = 0; row < indices.length; row += 1) {
    const index = indices[row];
    const offset = row * INSTANCE_STRIDE_FLOATS;
    data[offset + 0] = catalog.x[index];
    data[offset + 1] = catalog.y[index];
    data[offset + 2] = catalog.z[index];
    data[offset + 3] = 0;
    data[offset + 4] = catalog.r[index];
    data[offset + 5] = catalog.g[index];
    data[offset + 6] = catalog.b[index];
    data[offset + 7] = catalog.brightness[index];
    data[offset + 8] = catalog.size[index];
    data[offset + 9] = catalog.importance[index];
    data[offset + 10] = catalog.labelScore[index];
    data[offset + 11] = index;
  }
  return data;
}

function lodInfo(zoomT) {
  if (zoomT < 0.34) return { name: "Galactic", labelTarget: 14 };
  if (zoomT < 0.72) {
    const t = smoothstep(0.34, 0.72, zoomT);
    return { name: "Regional", labelTarget: Math.round(mix(24, catalog.budgets.labelLimit, t)) };
  }
  return { name: "Local", labelTarget: 14 };
}

function zoomT() {
  const minLog = Math.log(MIN_SCALE);
  const maxLog = Math.log(MAX_SCALE);
  return clamp((maxLog - Math.log(camera.scale)) / (maxLog - minLog), 0, 1);
}

function visibilityFor(index, t) {
  const importance = catalog.importance[index];
  const brightness = catalog.brightness[index];
  const macro = Math.max(smoothstep(0.18, 0.92, importance), importance * 0.18);
  const regional = Math.max(smoothstep(0.06, 0.68, importance), importance * 0.3);
  const local = Math.max(smoothstep(0.01, 0.48, importance), importance * 0.38);
  const blendA = smoothstep(0.18, 0.62, t);
  const blendB = smoothstep(0.62, 1.0, t);
  let value = mix(macro, regional, blendA);
  value = mix(value, local, blendB);
  const catalogFloor =
    (0.032 + smoothstep(0.08, 1.6, brightness) * 0.062 + importance * 0.04) *
    (1 - smoothstep(0.58, 1.0, t) * 0.38);
  value = Math.max(value, catalogFloor);
  if (index === interaction.activeIndex || index === interaction.hoverIndex) {
    value = Math.max(value, 0.94);
  }
  return value;
}

function projectPosition(x, y, z) {
  const rel = [x - camera.target[0], y - camera.target[1], z - camera.target[2]];
  const halfHeight = camera.scale;
  const halfWidth = halfHeight * view.aspect;
  const ndcX = dot(rel, camera.right) / halfWidth;
  const ndcY = dot(rel, camera.up) / halfHeight;
  const depth = dot(rel, camera.forward);
  return {
    ndcX,
    ndcY,
    depth,
    x: (ndcX * 0.5 + 0.5) * view.width,
    y: (0.5 - ndcY * 0.5) * view.height
  };
}

function screenToWorld(x, y, scale = camera.scaleTarget) {
  const ndcX = (x / view.width) * 2 - 1;
  const ndcY = 1 - (y / view.height) * 2;
  const halfHeight = scale;
  const halfWidth = halfHeight * view.aspect;
  return [
    camera.targetTarget[0] + camera.right[0] * ndcX * halfWidth + camera.up[0] * ndcY * halfHeight,
    camera.targetTarget[1] + camera.right[1] * ndcX * halfWidth + camera.up[1] * ndcY * halfHeight,
    camera.targetTarget[2] + camera.right[2] * ndcX * halfWidth + camera.up[2] * ndcY * halfHeight
  ];
}

function updateScreenCache(t) {
  const indices = catalog.renderIndices;
  for (let row = 0; row < indices.length; row += 1) {
    const index = indices[row];
    const projected = projectPosition(catalog.x[index], catalog.y[index], catalog.z[index]);
    const visible = visibilityFor(index, t);
    const baseRadius = Math.max(7, catalog.pickRadius[index] * (0.72 + t * 0.62));
    const offset = row * 4;
    catalog.screen[offset + 0] = projected.x;
    catalog.screen[offset + 1] = projected.y;
    catalog.screen[offset + 2] = baseRadius;
    catalog.screen[offset + 3] =
      Math.abs(projected.ndcX) < 1.18 && Math.abs(projected.ndcY) < 1.18 ? visible : 0;
  }
}

function pickAt(x, y) {
  for (let i = labels.rects.length - 1; i >= 0; i -= 1) {
    const rect = labels.rects[i];
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return rect.index;
    }
  }

  let bestIndex = -1;
  let bestScore = Infinity;
  const indices = catalog.renderIndices;
  for (let row = 0; row < indices.length; row += 1) {
    const offset = row * 4;
    const visible = catalog.screen[offset + 3];
    if (visible < 0.05) continue;
    const radius = Math.max(12, catalog.screen[offset + 2] * (0.7 + visible * 0.65));
    const dx = x - catalog.screen[offset + 0];
    const dy = y - catalog.screen[offset + 1];
    const distance = Math.hypot(dx, dy);
    if (distance > radius) continue;
    const index = indices[row];
    const score = distance / radius - catalog.importance[index] * 0.22;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function focusStar(index, preferredScale = 4.2) {
  if (index < 0 || index >= catalog.count) return;
  interaction.activeIndex = index;
  camera.targetTarget = [catalog.x[index], catalog.y[index], catalog.z[index] * 0.25];
  camera.scaleTarget = clamp(preferredScale, MIN_SCALE, MAX_SCALE);
  camera.lastInteraction = performance.now();
  labels.lastRankAt = 0;
}

function resize(width, height, dpr) {
  view.width = Math.max(1, width);
  view.height = Math.max(1, height);
  view.dpr = Math.max(1, dpr || 1);
  view.pixelWidth = Math.max(1, Math.floor(view.width * view.dpr));
  view.pixelHeight = Math.max(1, Math.floor(view.height * view.dpr));
  view.aspect = view.width / view.height;
  if (sceneCanvas) {
    sceneCanvas.width = view.pixelWidth;
    sceneCanvas.height = view.pixelHeight;
  }
  if (labelCanvas) {
    labelCanvas.width = view.pixelWidth;
    labelCanvas.height = view.pixelHeight;
  }
  if (gpu?.context && gpu?.device) {
    configureContext();
  }
}

function createBuffer(device, data, usage) {
  const buffer = device.createBuffer({
    size: Math.max(4, Math.ceil(data.byteLength / 4) * 4),
    usage,
    mappedAtCreation: true
  });
  const mapped = new Float32Array(buffer.getMappedRange());
  mapped.set(data);
  buffer.unmap();
  return buffer;
}

function shaderSource() {
  return `
struct Uniforms {
  right: vec4<f32>,
  up: vec4<f32>,
  forward: vec4<f32>,
  target: vec4<f32>,
  screen: vec4<f32>,
  render: vec4<f32>,
  activeHover: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uni: Uniforms;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) local: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) brightness: f32,
  @location(3) alpha: f32,
  @location(4) halo: f32,
};

fn softGate(edge0: f32, edge1: f32, value: f32) -> f32 {
  let t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

@vertex
fn vs(
  @location(0) corner: vec2<f32>,
  @location(1) posTemp: vec4<f32>,
  @location(2) colorBright: vec4<f32>,
  @location(3) sizeMeta: vec4<f32>
) -> VertexOut {
  var out: VertexOut;
  let rel = posTemp.xyz - uni.target.xyz;
  let halfHeight = uni.screen.z;
  let halfWidth = halfHeight * uni.screen.w;
  let ndc = vec2<f32>(
    dot(rel, uni.right.xyz) / halfWidth,
    dot(rel, uni.up.xyz) / halfHeight
  );
  let depth = clamp(0.5 + dot(rel, uni.forward.xyz) / (halfHeight * 9.0), 0.0, 1.0);
  let zoom = uni.render.x;
  let importance = sizeMeta.y;
  let labelWeight = sizeMeta.z;
  let id = sizeMeta.w;
  let isDust = select(0.0, 1.0, id < -0.5);
  let macroGate = max(softGate(0.18, 0.92, importance), importance * 0.18);
  let regionalGate = max(softGate(0.06, 0.68, importance), importance * 0.30);
  let localGate = max(softGate(0.01, 0.48, importance), importance * 0.38);
  var visible = mix(macroGate, regionalGate, softGate(0.18, 0.62, zoom));
  visible = mix(visible, localGate, softGate(0.62, 1.0, zoom));
  let catalogFloor =
    (0.026 + softGate(0.08, 1.6, colorBright.a) * 0.082 + importance * 0.052) *
    (1.0 - softGate(0.58, 1.0, zoom) * 0.38);
  visible = max(visible, catalogFloor * (1.0 - isDust));
  let active = select(0.0, 1.0, abs(id - uni.activeHover.x) < 0.5);
  let hover = select(0.0, 1.0, abs(id - uni.activeHover.y) < 0.5);
  visible = max(visible, max(active, hover) * 0.96);
  visible = mix(visible, 0.42 + 0.1 * softGate(0.0, 0.7, zoom), isDust);
  let centerFalloff = clamp(1.18 - length(ndc) * 0.18, 0.56, 1.2);
  let depthFade = mix(1.04, 0.72, depth);
  let highlight = 1.0 + active * 1.9 + hover * 1.15;
  let pxSize = sizeMeta.x *
    (1.08 + zoom * 1.5) *
    (0.82 + importance * 1.95 + labelWeight * 0.36) *
    centerFalloff *
    depthFade *
    highlight;
  let finalSize = mix(pxSize, sizeMeta.x * (0.62 + zoom * 0.18), isDust);
  let pixel = corner * finalSize * vec2<f32>(2.0 / uni.screen.x, 2.0 / uni.screen.y);
  out.position = vec4<f32>(ndc + pixel, depth, 1.0);
  out.local = corner;
  out.color = colorBright.rgb;
  out.brightness = colorBright.a * mix(1.08, 0.54, isDust);
  out.alpha = visible * mix(1.0, 0.54, isDust);
  out.halo = (0.52 + importance * 1.42 + active * 1.95 + hover * 1.05) * mix(1.0, 0.24, isDust);
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  let r = length(in.local);
  if (r > 1.0) {
    discard;
  }
  let core = exp(-r * r * 34.0);
  let halo = exp(-r * r * 4.2) * in.halo;
  let psf = exp(-abs(r - 0.34) * 11.0) * 0.055 * in.halo;
  let alpha = clamp((core * 1.36 + halo * 0.62 + psf) * in.alpha * in.brightness * uni.render.z, 0.0, 1.0);
  let whiteCore = clamp(core * 0.58, 0.0, 0.46);
  let color = mix(in.color, vec3<f32>(1.0, 0.98, 0.92), whiteCore);
  return vec4<f32>(color * alpha, alpha);
}
`;
}

async function initGpu() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not available in this worker.");
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
  if (!adapter) {
    throw new Error("No WebGPU adapter was found.");
  }
  const device = await adapter.requestDevice();
  const context = sceneCanvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  const shader = device.createShaderModule({ code: shaderSource() });
  const uniformBuffer = device.createBuffer({
    size: 7 * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" }
      }
    ]
  });
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  });
  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shader,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }]
        },
        {
          arrayStride: INSTANCE_STRIDE_FLOATS * 4,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x4" },
            { shaderLocation: 2, offset: 16, format: "float32x4" },
            { shaderLocation: 3, offset: 32, format: "float32x4" }
          ]
        }
      ]
    },
    fragment: {
      module: shader,
      entryPoint: "fs",
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
          }
        }
      ]
    },
    primitive: { topology: "triangle-list" }
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });
  const quadData = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1
  ]);
  const quadBuffer = createBuffer(device, quadData, GPUBufferUsage.VERTEX);
  const dustBuffer = createBuffer(
    device,
    dust.data,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );
  const catalogBuffer = createBuffer(
    device,
    buildCatalogInstanceData(),
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );

  gpu = {
    device,
    context,
    format,
    pipeline,
    uniformBuffer,
    bindGroup,
    quadBuffer,
    dustBuffer,
    catalogBuffer
  };
  configureContext();
}

function configureContext() {
  if (!gpu?.context || !gpu?.device) return;
  gpu.context.configure({
    device: gpu.device,
    format: gpu.format,
    alphaMode: "opaque"
  });
}

function writeUniforms(t) {
  const uniforms = new Float32Array(28);
  uniforms.set([...camera.right, 0], 0);
  uniforms.set([...camera.up, 0], 4);
  uniforms.set([...camera.forward, 0], 8);
  uniforms.set([...camera.target, 0], 12);
  uniforms.set([view.pixelWidth, view.pixelHeight, camera.scale, view.aspect], 16);
  uniforms.set([t, performance.now() * 0.001, config.debug ? 1.9 : 1.75, view.dpr], 20);
  uniforms.set([interaction.activeIndex, interaction.hoverIndex, 0, 0], 24);
  gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniforms);
}

function renderGpu(t) {
  writeUniforms(t);
  const encoder = gpu.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: gpu.context.getCurrentTexture().createView(),
        clearValue: { r: 0.003, g: 0.005, b: 0.012, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  pass.setPipeline(gpu.pipeline);
  pass.setBindGroup(0, gpu.bindGroup);
  pass.setVertexBuffer(0, gpu.quadBuffer);
  pass.setVertexBuffer(1, gpu.dustBuffer);
  pass.draw(6, dust.count);
  pass.setVertexBuffer(1, gpu.catalogBuffer);
  pass.draw(6, catalog.renderIndices.length);
  pass.end();
  gpu.device.queue.submit([encoder.finish()]);
}

function projectedVector(radius, axis) {
  const center = projectPosition(camera.target[0], camera.target[1], camera.target[2]);
  const point = projectPosition(
    camera.target[0] + axis[0] * radius,
    camera.target[1] + axis[1] * radius,
    camera.target[2] + axis[2] * radius
  );
  return {
    x: point.x - center.x,
    y: point.y - center.y,
    length: Math.hypot(point.x - center.x, point.y - center.y)
  };
}

function drawGalacticVeil(ctx, t) {
  const alpha = (1 - smoothstep(0.58, 0.92, t)) * 0.52;
  if (alpha <= 0.01) return;
  const center = projectPosition(0, 0, 0);
  if (Math.abs(center.ndcX) > 1.35 || Math.abs(center.ndcY) > 1.35) return;

  const xAxis = projectedVector(16, [1, 0, 0]);
  const yAxis = projectedVector(16, [0, 1, 0]);
  const major = xAxis.length > yAxis.length ? xAxis : yAxis;
  const radius = clamp(
    Math.max(xAxis.length, yAxis.length) * 1.04,
    view.width * 0.26,
    view.width * 0.68
  );
  const angle = Math.atan2(major.y, major.x);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  const diskGradient = ctx.createRadialGradient(0, 0, radius * 0.03, 0, 0, radius);
  diskGradient.addColorStop(0, `rgba(255, 238, 205, ${0.18 * alpha})`);
  diskGradient.addColorStop(0.16, `rgba(214, 224, 246, ${0.09 * alpha})`);
  diskGradient.addColorStop(0.42, `rgba(132, 164, 214, ${0.038 * alpha})`);
  diskGradient.addColorStop(0.72, `rgba(72, 92, 132, ${0.016 * alpha})`);
  diskGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = diskGradient;
  ctx.scale(1, 0.34);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius, 0, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.translate(center.x, center.y);
  ctx.rotate(angle + 0.05);
  ctx.scale(1, 0.22);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.7, radius * 0.17, 0, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawReferenceLines(ctx, t) {
  const referenceAlpha = smoothstep(0.22, 0.48, t) * (1 - smoothstep(0.88, 1.0, t));
  const localAlpha = smoothstep(0.68, 0.92, t);
  if (referenceAlpha <= 0.01 && localAlpha <= 0.01) return;
  ctx.save();
  if (referenceAlpha > 0.01) {
    ctx.globalAlpha = referenceAlpha;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 12]);
    ctx.strokeStyle = "rgba(158, 190, 232, 0.18)";

    for (const radius of [2.8, 5.6, 9.2]) {
      ctx.beginPath();
      let started = false;
      const steps = 160;
      for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * TWO_PI;
        const projected = projectPosition(
          camera.target[0] + Math.cos(a) * radius,
          camera.target[1] + Math.sin(a) * radius,
          camera.target[2]
        );
        if (Math.abs(projected.ndcX) > 1.4 || Math.abs(projected.ndcY) > 1.4) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(projected.x, projected.y);
          started = true;
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();
    }

    ctx.globalAlpha = referenceAlpha * 0.58;
    ctx.setLineDash([1, 18]);
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const a = (spoke / 8) * TWO_PI + 0.08;
      const inner = projectPosition(
        camera.target[0] + Math.cos(a) * 1.3,
        camera.target[1] + Math.sin(a) * 1.3,
        camera.target[2]
      );
      const outer = projectPosition(
        camera.target[0] + Math.cos(a) * 9.6,
        camera.target[1] + Math.sin(a) * 9.6,
        camera.target[2]
      );
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
    }
  }

  if (localAlpha > 0.01) {
    ctx.globalAlpha = localAlpha * 0.34;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 16]);
    ctx.strokeStyle = "rgba(204, 224, 255, 0.2)";
    for (const radius of [0.42, 0.9, 1.8, 3.4]) {
      ctx.beginPath();
      let started = false;
      const steps = 144;
      for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * TWO_PI;
        const projected = projectPosition(
          camera.target[0] + Math.cos(a) * radius,
          camera.target[1] + Math.sin(a) * radius,
          camera.target[2]
        );
        if (Math.abs(projected.ndcX) > 1.55 || Math.abs(projected.ndcY) > 1.55) {
          started = false;
          continue;
        }
        if (!started) {
          ctx.moveTo(projected.x, projected.y);
          started = true;
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function rgbaForStar(index, alpha, whiteMix = 0) {
  const r = Math.round(mix(catalog.r[index], 1, whiteMix) * 255);
  const g = Math.round(mix(catalog.g[index], 0.98, whiteMix) * 255);
  const b = Math.round(mix(catalog.b[index], 0.9, whiteMix) * 255);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function drawCatalogSafetyGlow(ctx, t) {
  const indices = catalog.renderIndices;
  let haloBudget = 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let row = 0; row < indices.length; row += 1) {
    const index = indices[row];
    const offset = row * 4;
    const visible = catalog.screen[offset + 3];
    if (visible < 0.025) continue;
    const x = catalog.screen[offset + 0];
    const y = catalog.screen[offset + 1];
    if (x < -40 || y < -40 || x > view.width + 40 || y > view.height + 40) continue;

    const importance = catalog.importance[index];
    const brightness = catalog.brightness[index];
    const isActive = index === interaction.activeIndex;
    const isHover = index === interaction.hoverIndex;
    const coreRadius =
      catalog.size[index] *
      (0.16 + t * 0.15) *
      (0.58 + importance * 0.96) *
      (isActive ? 1.85 : isHover ? 1.45 : 1);
    const alpha = clamp(visible * brightness * 0.072 + importance * 0.022, 0.007, 0.36);

    if ((importance > 0.68 || isActive || isHover) && haloBudget < 220) {
      haloBudget += 1;
      const haloRadius = coreRadius * (2.7 + importance * 2.1);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      gradient.addColorStop(0, rgbaForStar(index, alpha * 0.34, 0.18));
      gradient.addColorStop(0.34, rgbaForStar(index, alpha * 0.1, 0.04));
      gradient.addColorStop(1, rgbaForStar(index, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, haloRadius, 0, TWO_PI);
      ctx.fill();
    }

    const radius = Math.max(0.55, coreRadius);
    ctx.fillStyle = rgbaForStar(index, alpha, 0.28);
    if (radius < 1.15) {
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TWO_PI);
      ctx.fill();
    }
  }
  ctx.restore();
}

function labelFontSize(index, t) {
  const emphasis =
    index === interaction.activeIndex ? 3.2 : index === interaction.hoverIndex ? 2.4 : 0;
  return clamp(10.8 + t * 2.6 + catalog.labelScore[index] * 2.2 + emphasis, 10.8, 18.5);
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function chooseLabels(now, t, lod) {
  const targetCount = lod.labelTarget;
  const idle = now - camera.lastInteraction > 520;
  const needsRank =
    labels.selected.length === 0 ||
    (idle && now - labels.lastRankAt > 1150) ||
    lod.name !== labels.lastLod;
  if (!needsRank) return;

  const selected = [];
  const must = [interaction.activeIndex, interaction.hoverIndex].filter((index) => index >= 0);
  for (const index of must) {
    if (!selected.includes(index)) selected.push(index);
  }
  const selectedScreen = selected.map((index) =>
    projectPosition(catalog.x[index], catalog.y[index], catalog.z[index])
  );

  const centerBias = (index) => {
    const projected = projectPosition(catalog.x[index], catalog.y[index], catalog.z[index]);
    const distance = Math.hypot(projected.ndcX, projected.ndcY);
    return clamp(1.2 - distance * 0.55, 0, 1.2);
  };

  const candidateCount = Math.min(catalog.renderIndices.length, lod.name === "Galactic" ? 720 : 2200);
  const spatialKeys = new Set();
  const candidates = catalog.renderIndices.slice(0, candidateCount).sort((a, b) => {
    const activeA = labels.selected.includes(a) ? 0.08 : 0;
    const activeB = labels.selected.includes(b) ? 0.08 : 0;
    let localA = 0;
    let localB = 0;
    if (lod.name === "Local" && interaction.activeIndex >= 0) {
      const ax = catalog.x[interaction.activeIndex];
      const ay = catalog.y[interaction.activeIndex];
      localA = 1 / (1 + Math.hypot(catalog.x[a] - ax, catalog.y[a] - ay));
      localB = 1 / (1 + Math.hypot(catalog.x[b] - ax, catalog.y[b] - ay));
    }
    const namedA = catalog.names[a].startsWith("GSM ") ? 0 : 1;
    const namedB = catalog.names[b].startsWith("GSM ") ? 0 : 1;
    const nameBiasA = lod.name === "Galactic" ? namedA * 0.48 - (1 - namedA) * 0.42 : namedA * 0.12;
    const nameBiasB = lod.name === "Galactic" ? namedB * 0.48 - (1 - namedB) * 0.42 : namedB * 0.12;
    const scoreA =
      catalog.labelScore[a] * 1.25 +
      centerBias(a) * 0.5 +
      visibilityFor(a, t) * 0.25 +
      localA +
      activeA +
      nameBiasA;
    const scoreB =
      catalog.labelScore[b] * 1.25 +
      centerBias(b) * 0.5 +
      visibilityFor(b, t) * 0.25 +
      localB +
      activeB +
      nameBiasB;
    return scoreB - scoreA;
  });

  for (const index of candidates) {
    if (selected.length >= targetCount) break;
    if (selected.includes(index)) continue;
    const projected = projectPosition(catalog.x[index], catalog.y[index], catalog.z[index]);
    if (Math.abs(projected.ndcX) > 1.04 || Math.abs(projected.ndcY) > 1.04) continue;
    if (lod.name === "Galactic") {
      const tooClose = selectedScreen.some(
        (item) => Math.hypot(projected.x - item.x, projected.y - item.y) < 118
      );
      if (tooClose) continue;
      const angle = Math.atan2(catalog.y[index], catalog.x[index]) + Math.PI;
      const radius = Math.hypot(catalog.x[index], catalog.y[index]);
      const key = `${Math.floor((angle / TWO_PI) * 12)}:${Math.min(2, Math.floor(radius / 4.8))}`;
      if (spatialKeys.has(key)) continue;
      spatialKeys.add(key);
      selectedScreen.push(projected);
    } else {
      const spacing = lod.name === "Regional" ? 58 : 82;
      const tooClose = selectedScreen.some(
        (item) => Math.hypot(projected.x - item.x, projected.y - item.y) < spacing
      );
      if (tooClose) continue;
      selectedScreen.push(projected);
    }
    selected.push(index);
  }

  labels.selected = selected;
  labels.lastRankAt = now;
  labels.lastLod = lod.name;
}

function drawLabel(ctx, index, t, forced, occupied) {
  const projected = projectPosition(catalog.x[index], catalog.y[index], catalog.z[index]);
  const visible = visibilityFor(index, t);
  if (!forced && visible < 0.08) return false;
  if (!forced && (Math.abs(projected.ndcX) > 1.04 || Math.abs(projected.ndcY) > 1.04)) {
    return false;
  }

  const name = catalog.names[index];
  const size = labelFontSize(index, t);
  ctx.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const measured = ctx.measureText(name);
  const xBias = projected.x < view.width * 0.74 ? 1 : -1;
  const labelX = projected.x + xBias * (12 + catalog.labelScore[index] * 9);
  const labelY = projected.y - 7 - catalog.labelScore[index] * 3;
  const rect = {
    x: xBias > 0 ? labelX - 4 : labelX - measured.width - 4,
    y: labelY - size - 4,
    w: measured.width + 8,
    h: size + 9,
    index
  };

  if (!forced) {
    for (const item of occupied) {
      if (rectsOverlap(rect, item)) return false;
    }
  }

  const alpha = forced ? 0.94 : clamp(visible * 0.78 + catalog.labelScore[index] * 0.28, 0.18, 0.78);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(205, 226, 255, 0.22)";
  ctx.beginPath();
  ctx.moveTo(projected.x, projected.y);
  ctx.lineTo(xBias > 0 ? rect.x : rect.x + rect.w, rect.y + rect.h * 0.62);
  ctx.stroke();
  ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
  ctx.shadowBlur = 8;
  ctx.fillStyle =
    index === interaction.activeIndex
      ? "rgba(242, 248, 255, 0.92)"
      : index === interaction.hoverIndex
        ? "rgba(225, 240, 255, 0.88)"
        : "rgba(203, 219, 240, 0.72)";
  ctx.fillText(name, xBias > 0 ? labelX : labelX - measured.width, labelY);
  ctx.restore();

  occupied.push(rect);
  labels.rects.push(rect);
  return true;
}

function drawOverlay(t, lod, now) {
  if (!labelContext) return;
  const ctx = labelContext;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  drawGalacticVeil(ctx, t);
  drawCatalogSafetyGlow(ctx, t);
  drawReferenceLines(ctx, t);

  chooseLabels(now, t, lod);
  labels.rects = [];
  const occupied = [];

  if (interaction.activeIndex >= 0) {
    drawLabel(ctx, interaction.activeIndex, t, true, occupied);
  }
  if (interaction.hoverIndex >= 0 && interaction.hoverIndex !== interaction.activeIndex) {
    drawLabel(ctx, interaction.hoverIndex, t, true, occupied);
  }
  for (const index of labels.selected) {
    if (index === interaction.activeIndex || index === interaction.hoverIndex) continue;
    drawLabel(ctx, index, t, false, occupied);
  }
  labels.count = labels.rects.length;
}

function updateCamera(now, deltaSeconds) {
  const idleSeconds = Math.max(0, (now - camera.lastInteraction) / 1000);
  const autoStrength = clamp((idleSeconds - 0.8) / 2.4, 0, 1);
  if (!camera.dragging) {
    rotateCamera(WORLD_Z, deltaSeconds * 0.018 * autoStrength);
  }

  if (Math.abs(camera.yawVelocity) > 0.00001) {
    rotateCamera(WORLD_Z, camera.yawVelocity * deltaSeconds * 60);
  }
  if (Math.abs(camera.pitchVelocity) > 0.00001) {
    rotateCamera(camera.right, camera.pitchVelocity * deltaSeconds * 60);
  }

  const damping = Math.exp(-deltaSeconds * (camera.dragging ? 10 : 3.2));
  camera.yawVelocity *= damping;
  camera.pitchVelocity *= damping;

  const scaleEase = 1 - Math.exp(-deltaSeconds * 7.4);
  camera.scale += (camera.scaleTarget - camera.scale) * scaleEase;
  camera.target[0] += (camera.targetTarget[0] - camera.target[0]) * scaleEase;
  camera.target[1] += (camera.targetTarget[1] - camera.target[1]) * scaleEase;
  camera.target[2] += (camera.targetTarget[2] - camera.target[2]) * scaleEase;
}

function frame(now) {
  if (!initialized || !gpu) return;
  const last = frame.lastNow || now;
  const deltaSeconds = clamp((now - last) / 1000, 0.001, 0.05);
  frame.lastNow = now;
  updateCamera(now, deltaSeconds);
  const t = zoomT();
  const lod = lodInfo(t);
  updateScreenCache(t);
  renderGpu(t);
  drawOverlay(t, lod, now);

  if (!firstFrameSent) {
    firstFrameSent = true;
    post("firstFrameReady");
  }
  if (!readySent && now - metrics.lastFpsAt > 300) {
    readySent = true;
    post("ready");
  }

  metrics.frameCount += 1;
  if (now - metrics.lastFpsAt > 1000) {
    metrics.fps = (metrics.frameCount * 1000) / Math.max(1, now - metrics.lastFpsAt);
    metrics.frameCount = 0;
    metrics.lastFpsAt = now;
  }
  if (now - metrics.lastStateAt > 240) {
    metrics.lastStateAt = now;
    post("state", {
      state: {
        lod: lod.name,
        zoomT: t,
        scale: camera.scale,
        catalogCount: catalog.count,
        visibleCatalogCount: catalog.renderIndices.length,
        labelCount: labels.count,
        activeName: catalog.names[interaction.activeIndex] || "none",
        fps: metrics.fps || 0
      }
    });
  }
  animationHandle = requestFrame(frame);
}

async function init(message) {
  Object.assign(config, message.config || {});
  sceneCanvas = message.canvas;
  labelCanvas = message.labels;
  labelContext = labelCanvas.getContext("2d", { alpha: true });
  resize(1, 1, 1);

  post("bootProgress", { label: "Building catalog typed arrays" });
  catalog = buildCatalog();
  dust = buildDust();
  focusStar(interaction.activeIndex, MAX_SCALE);
  camera.scale = clamp(Number(config.initialDistance) || 22, MIN_SCALE, MAX_SCALE);
  camera.scaleTarget = camera.scale;
  camera.target = [0, 0, 0];
  camera.targetTarget = [0, 0, 0];
  camera.lastInteraction = performance.now() - 4000;
  orthonormalizeCamera();

  post("bootProgress", { label: "Preparing WebGPU impostors" });
  try {
    await initGpu();
  } catch (error) {
    post("error", { message: error?.message || "WebGPU initialization failed." });
    return;
  }
  initialized = true;
  metrics.lastFpsAt = performance.now();
  cancelFrame(animationHandle);
  animationHandle = requestFrame(frame);
}

function handlePointerMove(message) {
  interaction.pointerX = message.x;
  interaction.pointerY = message.y;
  const picked = pickAt(message.x, message.y);
  if (picked !== interaction.hoverIndex) {
    interaction.hoverIndex = picked;
  }
}

function handleDrag(message) {
  camera.dragging = true;
  camera.lastInteraction = performance.now();
  const yawDelta = message.dx * 0.0018;
  const pitchDelta = message.dy * 0.00155;
  rotateCamera(WORLD_Z, yawDelta);
  rotateCamera(camera.right, pitchDelta);
  camera.yawVelocity = yawDelta * 0.82;
  camera.pitchVelocity = pitchDelta * 0.82;
  handlePointerMove(message);
}

function handleWheel(message) {
  camera.lastInteraction = performance.now();
  const before = screenToWorld(message.x, message.y, camera.scaleTarget);
  const speed = message.ctrlKey ? 0.0022 : 0.00115;
  const nextScale = clamp(camera.scaleTarget * Math.exp(message.deltaY * speed), MIN_SCALE, MAX_SCALE);
  camera.scaleTarget = nextScale;
  const after = screenToWorld(message.x, message.y, camera.scaleTarget);
  const anchor = 0.18;
  camera.targetTarget[0] += (before[0] - after[0]) * anchor;
  camera.targetTarget[1] += (before[1] - after[1]) * anchor;
  camera.targetTarget[2] += (before[2] - after[2]) * anchor;
  labels.lastRankAt = 0;
}

function handleTap(message) {
  handlePointerMove(message);
  const picked = interaction.hoverIndex >= 0 ? interaction.hoverIndex : pickAt(message.x, message.y);
  if (picked >= 0) {
    const t = zoomT();
    const preferred = t < 0.52 ? 4.6 : 1.7;
    focusStar(picked, preferred);
  }
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "init") {
    init(message);
    return;
  }
  if (message.type === "resize") {
    resize(message.width, message.height, message.dpr);
    return;
  }
  if (!initialized) return;
  if (message.type === "pointerdown") {
    camera.dragging = true;
    camera.lastInteraction = performance.now();
    handlePointerMove(message);
    return;
  }
  if (message.type === "pointerup") {
    camera.dragging = false;
    camera.lastInteraction = performance.now();
    handlePointerMove(message);
    return;
  }
  if (message.type === "pointerleave") {
    interaction.hoverIndex = -1;
    return;
  }
  if (message.type === "pointermove") {
    handlePointerMove(message);
    return;
  }
  if (message.type === "drag") {
    handleDrag(message);
    return;
  }
  if (message.type === "wheel") {
    handleWheel(message);
    return;
  }
  if (message.type === "tap") {
    handleTap(message);
  }
};
