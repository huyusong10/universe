const TWO_PI = Math.PI * 2;
const MIN_SCALE = 0.16;
const MAX_SCALE = 24;

let sceneCanvas = null;
let labelCanvas = null;
let labelContext = null;
let gpu = null;
let catalog = null;
let dust = null;
let animationHandle = 0;
let initialized = false;
let firstLightSent = false;
let readySent = false;

const config = {
  debug: false,
  budget: "standard",
  catalog: 0,
  seed: 728281,
  target: "",
  language: "en"
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
  yaw: -0.34,
  yawVelocity: 0,
  tiltRaw: 0.22,
  tiltVelocity: 0,
  scale: 18.4,
  scaleTarget: 18.4,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  targetToX: 0,
  targetToY: 0,
  targetToZ: 0,
  dragging: false,
  lastInteraction: 0
};

const pointer = {
  x: -1000,
  y: -1000,
  hover: -1,
  active: -1
};

const labels = {
  selected: [],
  rects: [],
  lastSelectAt: 0,
  lastLod: "",
  count: 0
};

const metrics = {
  frames: 0,
  fps: 0,
  lastFpsAt: 0,
  lastStateAt: 0,
  startedAt: 0
};

const STAR_SHADER = `
struct Uniforms {
  right: vec4f,
  up: vec4f,
  forward: vec4f,
  targetScale: vec4f,
  view: vec4f,
  interaction: vec4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

fn smoother(edge0: f32, edge1: f32, value: f32) -> f32 {
  let t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

fn starVisibility(importance: f32, zoomT: f32) -> f32 {
  let galactic = max(smoother(0.14, 0.90, importance), importance * 0.20);
  let regional = max(smoother(0.045, 0.62, importance), importance * 0.34);
  let local = max(smoother(0.006, 0.42, importance), importance * 0.40);
  let mid = mix(galactic, regional, smoother(0.18, 0.62, zoomT));
  return mix(mid, local, smoother(0.62, 1.0, zoomT));
}

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) params: vec4f,
  @location(3) extra: vec2f,
  @location(4) alpha: f32,
};

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) position: vec3f,
  @location(1) color: vec3f,
  @location(2) params: vec4f,
  @location(3) extra: vec2f
) -> VertexOut {
  let corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(1.0, 1.0)
  );
  let corner = corners[vertexIndex];
  let rel = position - u.targetScale.xyz;
  let center = vec2f(
    dot(rel, u.right.xyz) / (u.targetScale.w * u.view.x),
    dot(rel, u.up.xyz) / u.targetScale.w
  );
  let isStar = extra.y > 0.5;
  let isActive = abs(extra.x - u.interaction.x) < 0.5;
  let hover = abs(extra.x - u.interaction.y) < 0.5;
  let activeBoost = select(select(1.0, 1.55, hover), 2.25, isActive);
  let visibility = select(params.x * (0.88 - u.view.y * 0.42), starVisibility(params.z, u.view.y), isStar);
  let forcedVisibility = select(visibility, max(visibility, 0.98), isActive || hover);
  let starRadius = params.y * (1.05 + u.view.y * 2.2) * (0.65 + params.z * 1.7) * activeBoost;
  let dustRadius = params.y * (0.54 + u.view.y * 0.12);
  let radiusPx = max(0.55, select(dustRadius, starRadius, isStar));
  let ndcRadius = vec2f(radiusPx * 2.0 / max(u.view.z, 1.0), radiusPx * 2.0 / max(u.view.w, 1.0));

  var out: VertexOut;
  out.position = vec4f(center + corner * ndcRadius, 0.0, 1.0);
  out.uv = corner;
  out.color = color;
  out.params = params;
  out.extra = extra;
  out.alpha = forcedVisibility;
  return out;
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let d = length(in.uv);
  if (d > 1.0) {
    discard;
  }
  let isStar = in.extra.y > 0.5;
  let core = exp(-d * d * 82.0);
  let psf = exp(-d * d * 18.0);
  let halo = exp(-d * d * 4.2);
  let outer = exp(-d * d * 1.35);
  let starEnergy =
    in.alpha *
    (core * (0.92 + in.params.x * 0.22) +
      psf * (0.20 + in.params.z * 0.15) +
      halo * (0.050 + in.params.z * 0.050) +
      outer * (0.010 + in.params.z * 0.016));
  let dustAlpha = in.alpha * exp(-d * d * 5.4) * 0.052;
  let alpha = clamp(select(dustAlpha, starEnergy, isStar), 0.0, 0.82);
  let starColor = mix(in.color, vec3f(1.0, 0.96, 0.86), clamp(core * 0.58, 0.0, 0.66));
  let dustColor = in.color * vec3f(0.48, 0.55, 0.70);
  let rgb = select(dustColor * alpha, starColor * alpha, isStar);
  return vec4f(rgb, alpha);
}
`;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function requestFrame(callback) {
  if (typeof self.requestAnimationFrame === "function") {
    return self.requestAnimationFrame(callback);
  }
  return self.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(handle) {
  if (typeof self.cancelAnimationFrame === "function") {
    self.cancelAnimationFrame(handle);
  } else {
    self.clearTimeout(handle);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
  const u = Math.max(1e-7, random());
  const v = Math.max(1e-7, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function tempToRgb(kelvin) {
  const t = kelvin / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  return [clamp(r / 255, 0, 1), clamp(g / 255, 0, 1), clamp(b / 255, 0, 1)];
}

function cssRgba(r, g, b, a) {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${clamp(a, 0, 1)})`;
}

function resolveBudget() {
  const budgets = {
    safe: { catalog: 6000, draw: 6000, dust: 26000, labels: 36 },
    standard: { catalog: 10000, draw: 10000, dust: 52000, labels: 48 },
    immersive: { catalog: 20000, draw: 14000, dust: 76000, labels: 60 }
  };
  const key = Object.hasOwn(budgets, config.budget) ? config.budget : "standard";
  const chosen = budgets[key];
  return {
    key,
    catalog: config.catalog > 0 ? config.catalog : chosen.catalog,
    draw: chosen.draw,
    dust: chosen.dust,
    labels: chosen.labels
  };
}

function makeVoids(random) {
  const fields = [];
  for (let i = 0; i < 15; i += 1) {
    const arm = i % 5;
    const radius = mix(2.3, 17.4, random() ** 0.7);
    const theta = arm * (TWO_PI / 5) + radius * 0.45 + gaussian(random) * 0.24;
    fields.push({
      x: Math.cos(theta) * radius + gaussian(random) * 0.6,
      y: Math.sin(theta) * radius + gaussian(random) * 0.6,
      radius: mix(0.55, 2.05, random()),
      strength: mix(0.32, 0.78, random())
    });
  }
  return fields;
}

function voidAt(voids, x, y) {
  let amount = 0;
  for (const field of voids) {
    const dx = x - field.x;
    const dy = y - field.y;
    amount +=
      Math.exp(-(dx * dx + dy * dy) / (field.radius * field.radius * 2.15)) *
      field.strength;
  }
  return clamp(amount, 0, 0.94);
}

function spiralSample(random, arms) {
  const arm = Math.floor(random() * arms);
  const radius = 0.32 + random() ** 0.62 * 22.8;
  const theta =
    arm * (TWO_PI / arms) +
    radius * 0.41 +
    Math.sin(radius * 0.62) * 0.24 +
    gaussian(random) * mix(0.042, 0.36, radius / 23);
  const width = mix(0.1, 0.82, radius / 23) * gaussian(random);
  return {
    x: Math.cos(theta) * radius - Math.sin(theta) * width,
    y: Math.sin(theta) * radius + Math.cos(theta) * width,
    radius,
    arm
  };
}

function makeClusters(random, voids) {
  const clusters = [];
  for (let i = 0; i < 24; i += 1) {
    let sample = spiralSample(random, 5);
    for (let retry = 0; retry < 8 && voidAt(voids, sample.x, sample.y) > 0.48; retry += 1) {
      sample = spiralSample(random, 5);
    }
    clusters.push({
      x: sample.x,
      y: sample.y,
      z: gaussian(random) * 0.14,
      radius: mix(0.16, 0.72, random()),
      weight: mix(0.42, 1.0, random())
    });
  }
  return clusters;
}

function generatedName(index, x, y) {
  const arm = Math.floor(((Math.atan2(y, x) + Math.PI) / TWO_PI) * 24)
    .toString(36)
    .toUpperCase();
  return `NS ${arm}-${index.toString(36).toUpperCase().padStart(4, "0")}`;
}

function sampleStar(random, voids, clusters) {
  for (let tries = 0; tries < 10; tries += 1) {
    const type = random();
    let x;
    let y;
    let z;
    let radius;
    let cluster = 0;
    let anchor = 0;
    let core = 0;

    if (type < 0.38) {
      const barAngle = 0.32;
      const along = gaussian(random) * 3.18;
      const across = gaussian(random) * mix(0.25, 0.88, random());
      x = Math.cos(barAngle) * along - Math.sin(barAngle) * across;
      y = Math.sin(barAngle) * along + Math.cos(barAngle) * across;
      z = gaussian(random) * mix(0.06, 0.34, random());
      radius = Math.hypot(x, y);
      core = Math.exp(-(radius * radius) / 12.5);
    } else if (type < 0.80) {
      const sample = spiralSample(random, 5);
      x = sample.x;
      y = sample.y;
      radius = sample.radius;
      z = gaussian(random) * (0.07 + radius * 0.032);
    } else if (type < 0.94) {
      const c = clusters[Math.floor(random() * clusters.length)];
      const r = Math.abs(gaussian(random)) * c.radius;
      const theta = random() * TWO_PI;
      x = c.x + Math.cos(theta) * r;
      y = c.y + Math.sin(theta) * r;
      z = c.z + gaussian(random) * c.radius * 0.34;
      radius = Math.hypot(x, y);
      cluster = c.weight;
    } else {
      radius = mix(13.2, 26.5, random() ** 0.48);
      const theta = random() * TWO_PI;
      x = Math.cos(theta) * radius * mix(0.78, 1.24, random());
      y = Math.sin(theta) * radius * mix(0.78, 1.24, random());
      z = gaussian(random) * mix(0.16, 1.28, random());
      anchor = random() > 0.56 ? mix(0.45, 1.0, random()) : 0;
    }

    const dark = voidAt(voids, x, y);
    if (random() > dark * 0.92 || tries > 7) {
      return { x, y, z, radius, cluster, anchor, core, dark };
    }
  }
  return { x: 0, y: 0, z: 0, radius: 0, cluster: 0, anchor: 0, core: 1, dark: 0 };
}

function nameBrightStars(data, ranked) {
  const names = [
    "Sol",
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
    "Regulus",
    "Adhara",
    "Bellatrix",
    "Elnath",
    "Alnilam",
    "Dubhe",
    "Mirfak",
    "Wezen",
    "Polaris",
    "Alcyone",
    "Orion Spur",
    "Perseus Arm",
    "Aquila Reach",
    "Carina Gate",
    "Cygnus Fold",
    "Vela Ember",
    "Norma Rift"
  ];
  for (let i = 0; i < names.length && i < ranked.length; i += 1) {
    data.name[ranked[i]] = names[i];
  }
}

function buildCatalog() {
  const budget = resolveBudget();
  const random = createRandom(config.seed);
  const voids = makeVoids(random);
  const clusters = makeClusters(random, voids);
  const count = budget.catalog;
  const drawCount = Math.min(count, budget.draw);
  const data = {
    budget,
    voids,
    clusters,
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    r: new Float32Array(count),
    g: new Float32Array(count),
    b: new Float32Array(count),
    lum: new Float32Array(count),
    size: new Float32Array(count),
    importance: new Float32Array(count),
    label: new Float32Array(count),
    pick: new Float32Array(count),
    radius: new Float32Array(count),
    screenX: new Float32Array(drawCount),
    screenY: new Float32Array(drawCount),
    screenR: new Float32Array(drawCount),
    screenA: new Float32Array(drawCount),
    indexAtDraw: [],
    name: new Array(count)
  };

  for (let i = 0; i < count; i += 1) {
    const star = sampleStar(random, voids, clusters);
    const coreGlow = Math.exp(-(star.radius * star.radius) / 17);
    const brightRoll = random() ** mix(7.4, 2.15, coreGlow + star.anchor * 0.4);
    const lum = clamp(
      0.035 +
        brightRoll * 2.22 +
        coreGlow * mix(0.08, 0.36, random()) +
        star.cluster * 0.34 +
        star.anchor * 0.95 -
        star.dark * 0.12,
      0.015,
      2.15
    );
    const hot = random() < 0.2 + coreGlow * 0.24 + star.cluster * 0.15;
    const temperature = hot
      ? mix(7200, 14800, random() ** 0.62)
      : mix(3300, 7600, random() ** 1.35);
    const color = tempToRgb(temperature);
    const importance = clamp(
      lum * 0.25 +
        coreGlow * 0.36 +
        star.cluster * 0.24 +
        star.anchor * 0.56 +
        random() * 0.1,
      0,
      1
    );

    data.x[i] = star.x;
    data.y[i] = star.y;
    data.z[i] = star.z;
    data.r[i] = color[0];
    data.g[i] = color[1];
    data.b[i] = color[2];
    data.lum[i] = lum;
    data.size[i] = mix(0.72, 3.55, clamp(Math.sqrt(lum / 2.15), 0, 1)) * mix(0.78, 1.14, random());
    data.importance[i] = importance;
    data.label[i] = clamp(importance * 0.78 + coreGlow * 0.12 + star.anchor * 0.34, 0, 1);
    data.pick[i] = mix(10, 27, Math.sqrt(importance));
    data.radius[i] = star.radius;
    data.name[i] = generatedName(i, star.x, star.y);
  }

  const ranked = Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const scoreA = data.importance[a] * 1.2 + data.label[a] * 0.6 + data.lum[a] * 0.18;
    const scoreB = data.importance[b] * 1.2 + data.label[b] * 0.6 + data.lum[b] * 0.18;
    return scoreB - scoreA;
  });
  nameBrightStars(data, ranked);

  data.indexAtDraw = ranked.slice(0, drawCount);
  const wanted = normalizeName(config.target);
  let active = ranked[0];
  if (wanted) {
    const match = data.name.findIndex((name) => normalizeName(name) === wanted);
    if (match >= 0) active = match;
  }
  pointer.active = active;
  if (!data.indexAtDraw.includes(active)) data.indexAtDraw[drawCount - 1] = active;
  return data;
}

function buildDust() {
  const random = createRandom(config.seed + 9199);
  const count = catalog.budget.dust;
  const data = {
    count,
    instances: new Float32Array(count * 12)
  };
  for (let i = 0; i < count; i += 1) {
    const sample = spiralSample(random, 5);
    const loosen = mix(0.62, 1.48, random());
    const core = random() < 0.22;
    const color = tempToRgb(core ? mix(3600, 6400, random()) : mix(3800, 9800, random()));
    const x = core ? gaussian(random) * 4.8 : sample.x * loosen + gaussian(random) * 0.16;
    const y = core ? gaussian(random) * 3.2 : sample.y * loosen + gaussian(random) * 0.16;
    const z = gaussian(random) * mix(0.06, core ? 0.36 : 0.84, random());
    const alpha = core ? mix(0.010, 0.032, random()) : mix(0.007, 0.026, random());
    const size = core ? mix(0.58, 1.55, random()) : mix(0.42, 1.32, random());
    const offset = i * 12;
    data.instances[offset] = x;
    data.instances[offset + 1] = y;
    data.instances[offset + 2] = z;
    data.instances[offset + 3] = color[0];
    data.instances[offset + 4] = color[1];
    data.instances[offset + 5] = color[2];
    data.instances[offset + 6] = alpha;
    data.instances[offset + 7] = size;
    data.instances[offset + 8] = 0;
    data.instances[offset + 9] = 0;
    data.instances[offset + 10] = -1;
    data.instances[offset + 11] = 0;
  }
  return data;
}

function buildStarInstances() {
  const instances = new Float32Array(catalog.indexAtDraw.length * 12);
  for (let row = 0; row < catalog.indexAtDraw.length; row += 1) {
    const index = catalog.indexAtDraw[row];
    const offset = row * 12;
    instances[offset] = catalog.x[index];
    instances[offset + 1] = catalog.y[index];
    instances[offset + 2] = catalog.z[index];
    instances[offset + 3] = catalog.r[index];
    instances[offset + 4] = catalog.g[index];
    instances[offset + 5] = catalog.b[index];
    instances[offset + 6] = catalog.lum[index];
    instances[offset + 7] = catalog.size[index];
    instances[offset + 8] = catalog.importance[index];
    instances[offset + 9] = catalog.label[index];
    instances[offset + 10] = index;
    instances[offset + 11] = 1;
  }
  return instances;
}

function cameraBasis() {
  const yaw = camera.yaw;
  const tilt = Math.tanh(camera.tiltRaw) * 1.46;
  const right = [Math.cos(yaw), Math.sin(yaw), 0];
  const planarForward = [-Math.sin(yaw), Math.cos(yaw), 0];
  const up = [
    -planarForward[0] * Math.sin(tilt),
    -planarForward[1] * Math.sin(tilt),
    Math.cos(tilt)
  ];
  const forward = [
    planarForward[0] * Math.cos(tilt),
    planarForward[1] * Math.cos(tilt),
    Math.sin(tilt)
  ];
  return { right, up, forward };
}

function zoomT() {
  const minLog = Math.log(MIN_SCALE);
  const maxLog = Math.log(MAX_SCALE);
  return clamp((maxLog - Math.log(camera.scale)) / (maxLog - minLog), 0, 1);
}

function zoomTForScale(scale) {
  const minLog = Math.log(MIN_SCALE);
  const maxLog = Math.log(MAX_SCALE);
  return clamp((maxLog - Math.log(scale)) / (maxLog - minLog), 0, 1);
}

function lodFor(t) {
  if (t < 0.3) return { name: "Galactic", labels: 16 };
  if (t < 0.62) {
    return {
      name: "Regional",
      labels: Math.round(mix(30, catalog.budget.labels, smoothstep(0.3, 0.62, t)))
    };
  }
  return {
    name: "Local",
    labels: Math.round(mix(18, 8, smoothstep(0.76, 0.96, t)))
  };
}

function starVisibility(index, t) {
  const importance = catalog.importance[index];
  const galactic = Math.max(smoothstep(0.14, 0.9, importance), importance * 0.2);
  const regional = Math.max(smoothstep(0.045, 0.62, importance), importance * 0.34);
  const local = Math.max(smoothstep(0.006, 0.42, importance), importance * 0.4);
  let value = mix(galactic, regional, smoothstep(0.18, 0.62, t));
  value = mix(value, local, smoothstep(0.62, 1, t));
  if (index === pointer.active || index === pointer.hover) value = Math.max(value, 0.98);
  return value;
}

function activeStarPosition() {
  if (!catalog || pointer.active < 0) return null;
  return {
    x: catalog.x[pointer.active],
    y: catalog.y[pointer.active],
    z: catalog.z[pointer.active]
  };
}

function localFocusStrength(scale) {
  return smoothstep(0.62, 0.92, zoomTForScale(scale));
}

function pullTargetTowardActive(strength) {
  const active = activeStarPosition();
  if (!active || strength <= 0) return;
  camera.targetToX = mix(camera.targetToX, active.x, strength);
  camera.targetToY = mix(camera.targetToY, active.y, strength);
  camera.targetToZ = mix(camera.targetToZ, active.z, strength);
}

function project(x, y, z, basis = cameraBasis()) {
  const rel = [x - camera.targetX, y - camera.targetY, z - camera.targetZ];
  const ndcX = dot(rel, basis.right) / (camera.scale * view.aspect);
  const ndcY = dot(rel, basis.up) / camera.scale;
  const depth = dot(rel, basis.forward);
  return {
    x: (ndcX * 0.5 + 0.5) * view.width,
    y: (0.5 - ndcY * 0.5) * view.height,
    ndcX,
    ndcY,
    depth
  };
}

function screenToWorld(x, y, scale = camera.scaleTarget) {
  const basis = cameraBasis();
  const ndcX = (x / view.width) * 2 - 1;
  const ndcY = 1 - (y / view.height) * 2;
  return {
    x: camera.targetToX + basis.right[0] * ndcX * scale * view.aspect + basis.up[0] * ndcY * scale,
    y: camera.targetToY + basis.right[1] * ndcX * scale * view.aspect + basis.up[1] * ndcY * scale,
    z: camera.targetToZ + basis.right[2] * ndcX * scale * view.aspect + basis.up[2] * ndcY * scale
  };
}

function updateScreenCache(t) {
  const basis = cameraBasis();
  for (let row = 0; row < catalog.indexAtDraw.length; row += 1) {
    const index = catalog.indexAtDraw[row];
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    const alpha = starVisibility(index, t);
    catalog.screenX[row] = p.x;
    catalog.screenY[row] = p.y;
    catalog.screenR[row] = Math.max(8, catalog.pick[index] * (0.72 + t * 0.58));
    catalog.screenA[row] =
      Math.abs(p.ndcX) < 1.2 && Math.abs(p.ndcY) < 1.2 ? alpha : 0;
  }
}

function createGpuBuffer(data, usage) {
  const buffer = gpu.device.createBuffer({
    size: Math.max(4, data.byteLength),
    usage,
    mappedAtCreation: true
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

function configureGpuContext() {
  if (!gpu) return;
  gpu.context.configure({
    device: gpu.device,
    format: gpu.format,
    alphaMode: "opaque"
  });
}

async function initGpu() {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is not available in this worker.");
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    throw new Error("No WebGPU adapter is available.");
  }
  const device = await adapter.requestDevice();
  const context = sceneCanvas.getContext("webgpu");
  if (!context) {
    throw new Error("The worker could not create a WebGPU OffscreenCanvas context.");
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  device.pushErrorScope("validation");
  const module = device.createShaderModule({ code: STAR_SHADER });
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 48,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            { shaderLocation: 2, offset: 24, format: "float32x4" },
            { shaderLocation: 3, offset: 40, format: "float32x2" }
          ]
        }
      ]
    },
    fragment: {
      module,
      entryPoint: "fragmentMain",
      targets: [
        {
          format,
          blend: {
            color: {
              operation: "add",
              srcFactor: "one",
              dstFactor: "one"
            },
            alpha: {
              operation: "add",
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha"
            }
          }
        }
      ]
    },
    primitive: {
      topology: "triangle-list"
    }
  });
  const pipelineError = await device.popErrorScope();
  if (pipelineError) {
    throw new Error(`WebGPU pipeline error: ${pipelineError.message}`);
  }
  const uniformBuffer = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });

  gpu = {
    adapter,
    device,
    context,
    format,
    pipeline,
    uniformBuffer,
    bindGroup,
    starBuffer: null,
    dustBuffer: null,
    starCount: 0,
    dustCount: 0,
    checkedFrame: false,
    status: "webgpu"
  };
  configureGpuContext();

  device.lost.then((info) => {
    gpu.status = "lost";
    post("error", { message: `WebGPU device lost: ${info.message || info.reason}` });
  });
}

function uploadGpuData() {
  const starInstances = buildStarInstances();
  gpu.starBuffer = createGpuBuffer(starInstances, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
  gpu.dustBuffer = createGpuBuffer(dust.instances, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
  gpu.starCount = catalog.indexAtDraw.length;
  gpu.dustCount = dust.count;
}

function uniformData(t, now) {
  const basis = cameraBasis();
  return new Float32Array([
    basis.right[0],
    basis.right[1],
    basis.right[2],
    0,
    basis.up[0],
    basis.up[1],
    basis.up[2],
    0,
    basis.forward[0],
    basis.forward[1],
    basis.forward[2],
    0,
    camera.targetX,
    camera.targetY,
    camera.targetZ,
    camera.scale,
    view.aspect,
    t,
    view.pixelWidth,
    view.pixelHeight,
    pointer.active,
    pointer.hover,
    now * 0.001,
    0
  ]);
}

function renderScene(t, now) {
  if (!gpu || gpu.status === "lost") return;
  if (!gpu.checkedFrame) {
    gpu.device.pushErrorScope("validation");
  }
  gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniformData(t, now));
  const encoder = gpu.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: gpu.context.getCurrentTexture().createView(),
        clearValue: { r: 0.003, g: 0.009, b: 0.021, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }
    ]
  });
  pass.setPipeline(gpu.pipeline);
  pass.setBindGroup(0, gpu.bindGroup);
  pass.setVertexBuffer(0, gpu.dustBuffer);
  pass.draw(6, gpu.dustCount);
  pass.setVertexBuffer(0, gpu.starBuffer);
  pass.draw(6, gpu.starCount);
  pass.end();
  gpu.device.queue.submit([encoder.finish()]);
  if (!gpu.checkedFrame) {
    gpu.checkedFrame = true;
    gpu.device.popErrorScope().then((error) => {
      if (error) {
        post("error", { message: `WebGPU validation error: ${error.message}` });
      }
    });
  }
}

function clearOverlay() {
  labelContext.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  labelContext.clearRect(0, 0, view.width, view.height);
}

function drawDarkLanes(t) {
  if (t > 0.66) return;
  const basis = cameraBasis();
  const alpha = 1 - smoothstep(0.42, 0.66, t);
  labelContext.save();
  labelContext.globalCompositeOperation = "source-over";
  labelContext.lineCap = "round";
  labelContext.lineJoin = "round";
  for (let arm = 0; arm < 5; arm += 1) {
    labelContext.beginPath();
    let started = false;
    for (let step = 0; step < 90; step += 1) {
      const radius = 1.8 + step * 0.24;
      const theta = arm * (TWO_PI / 5) + radius * 0.41 + Math.sin(radius * 0.62) * 0.24 + 0.11;
      const p = project(Math.cos(theta) * radius, Math.sin(theta) * radius, 0.02, basis);
      if (Math.abs(p.ndcX) > 1.16 || Math.abs(p.ndcY) > 1.16) {
        started = false;
        continue;
      }
      if (!started) {
        labelContext.moveTo(p.x, p.y);
        started = true;
      } else {
        labelContext.lineTo(p.x, p.y);
      }
    }
    labelContext.strokeStyle = `rgba(0, 2, 9, ${0.048 * alpha * (1 - t * 0.42)})`;
    labelContext.lineWidth = mix(5, 11, arm / 4);
    labelContext.stroke();
  }
  labelContext.restore();
}

function drawCatalogDensity(t) {
  const alpha = (1 - smoothstep(0.22, 0.52, t)) * 0.58;
  if (alpha < 0.01) return;

  const basis = cameraBasis();
  const limit = Math.min(catalog.indexAtDraw.length, catalog.budget.key === "safe" ? 1400 : 2200);
  const stride = Math.max(1, Math.floor(catalog.indexAtDraw.length / limit));
  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  for (let row = 0; row < catalog.indexAtDraw.length; row += stride) {
    const index = catalog.indexAtDraw[row];
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    if (Math.abs(p.ndcX) > 1.08 || Math.abs(p.ndcY) > 1.08) continue;

    const importance = catalog.importance[index];
    const core = Math.exp(-(catalog.radius[index] * catalog.radius[index]) / 20);
    const radius = mix(1.1, 4.8, clamp(core * 0.6 + importance * 0.55, 0, 1)) * (1 - t * 0.36);
    const glow = clamp(0.02 + core * 0.074 + importance * 0.044, 0.014, 0.13) * alpha;
    const gradient = labelContext.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.2);
    gradient.addColorStop(
      0,
      cssRgba(
        mix(catalog.r[index], 1, 0.18),
        mix(catalog.g[index], 0.96, 0.16),
        mix(catalog.b[index], 0.86, 0.14),
        glow
      )
    );
    gradient.addColorStop(1, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], 0));
    labelContext.fillStyle = gradient;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, radius * 3.2, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawGalacticVeil(t) {
  const alpha = (1 - smoothstep(0.2, 0.5, t)) * 0.9;
  if (alpha < 0.01) return;

  const basis = cameraBasis();
  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  labelContext.lineCap = "round";
  labelContext.lineJoin = "round";
  labelContext.filter = "blur(8px)";
  for (let arm = 0; arm < 5; arm += 1) {
    labelContext.beginPath();
    let started = false;
    for (let step = 0; step < 110; step += 1) {
      const radius = 0.9 + step * 0.22;
      const theta =
        arm * (TWO_PI / 5) +
        radius * 0.41 +
        Math.sin(radius * 0.62) * 0.24 +
        Math.sin(radius * 0.18 + arm) * 0.07;
      const width = Math.sin(radius * 0.7 + arm) * 0.18;
      const p = project(
        Math.cos(theta) * (radius + width),
        Math.sin(theta) * (radius + width),
        0.02,
        basis
      );
      if (Math.abs(p.ndcX) > 1.22 || Math.abs(p.ndcY) > 1.22) {
        started = false;
        continue;
      }
      if (!started) {
        labelContext.moveTo(p.x, p.y);
        started = true;
      } else {
        labelContext.lineTo(p.x, p.y);
      }
    }
    const warm = arm % 2 === 0;
    labelContext.strokeStyle = warm
      ? `rgba(255, 214, 168, ${0.033 * alpha})`
      : `rgba(178, 209, 255, ${0.026 * alpha})`;
    labelContext.lineWidth = mix(24, 42, arm / 4) * (1 - t * 0.34);
    labelContext.stroke();
  }

  const core = project(0, 0, 0, basis);
  if (Math.abs(core.ndcX) < 1.2 && Math.abs(core.ndcY) < 1.2) {
    const coreRadius = Math.min(view.width, view.height) * 0.18 * (1 - t * 0.24);
    const glow = labelContext.createRadialGradient(
      core.x,
      core.y,
      0,
      core.x,
      core.y,
      coreRadius
    );
    glow.addColorStop(0, `rgba(255, 236, 205, ${0.09 * alpha})`);
    glow.addColorStop(0.48, `rgba(196, 218, 255, ${0.032 * alpha})`);
    glow.addColorStop(1, "rgba(196, 218, 255, 0)");
    labelContext.fillStyle = glow;
    labelContext.beginPath();
    labelContext.arc(core.x, core.y, coreRadius, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawReference(t) {
  const alpha = smoothstep(0.28, 0.5, t) * (1 - smoothstep(0.68, 0.86, t));
  if (alpha < 0.01) return;
  const basis = cameraBasis();
  labelContext.save();
  labelContext.lineWidth = 1;
  labelContext.setLineDash([2, 13]);
  labelContext.strokeStyle = `rgba(164, 196, 234, ${0.15 * alpha})`;
  for (const radius of [1.2, 2.4, 5.2, 9.4]) {
    labelContext.beginPath();
    let started = false;
    for (let i = 0; i <= 180; i += 1) {
      const angle = (i / 180) * TWO_PI;
      const p = project(
        camera.targetX + Math.cos(angle) * radius,
        camera.targetY + Math.sin(angle) * radius,
        camera.targetZ,
        basis
      );
      if (Math.abs(p.ndcX) > 1.32 || Math.abs(p.ndcY) > 1.32) {
        started = false;
        continue;
      }
      if (!started) {
        labelContext.moveTo(p.x, p.y);
        started = true;
      } else {
        labelContext.lineTo(p.x, p.y);
      }
    }
    labelContext.stroke();
  }
  labelContext.restore();
}

function pickAt(x, y) {
  for (let i = labels.rects.length - 1; i >= 0; i -= 1) {
    const rect = labels.rects[i];
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return rect.index;
    }
  }
  let best = -1;
  let bestScore = Infinity;
  for (let row = 0; row < catalog.indexAtDraw.length; row += 1) {
    const alpha = catalog.screenA[row];
    if (alpha < 0.04) continue;
    const dx = x - catalog.screenX[row];
    const dy = y - catalog.screenY[row];
    const radius = Math.max(13, catalog.screenR[row] * (0.75 + alpha * 0.72));
    const distance = Math.hypot(dx, dy);
    if (distance > radius) continue;
    const index = catalog.indexAtDraw[row];
    const score = distance / radius - catalog.importance[index] * 0.22;
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return best;
}

function focusStar(index, scale = 4.2) {
  if (index < 0 || index >= catalog.count) return;
  pointer.active = index;
  camera.targetToX = catalog.x[index];
  camera.targetToY = catalog.y[index];
  camera.targetToZ = catalog.z[index];
  camera.scaleTarget = clamp(scale, MIN_SCALE, MAX_SCALE);
  camera.lastInteraction = performance.now();
  labels.lastSelectAt = 0;
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawLocalStar(t, now) {
  const surface = smoothstep(0.72, 0.96, t);
  if (surface < 0.01 || pointer.active < 0) return;

  const index = pointer.active;
  const p = project(catalog.x[index], catalog.y[index], catalog.z[index]);
  const visible = surface * clamp(1.18 - Math.hypot(p.ndcX, p.ndcY) * 0.48, 0, 1);
  if (visible < 0.01) return;

  const maxRadius = Math.min(view.width, view.height) * 0.46;
  const radius = clamp((0.58 / Math.max(camera.scale, MIN_SCALE)) ** 0.9 * 64, 22, maxRadius);
  if (
    p.x < -radius * 2 ||
    p.x > view.width + radius * 2 ||
    p.y < -radius * 2 ||
    p.y > view.height + radius * 2
  ) {
    return;
  }

  const r = catalog.r[index];
  const g = catalog.g[index];
  const b = catalog.b[index];
  const pulse = 0.96 + Math.sin(now * 0.0016 + index * 0.37) * 0.04;

  labelContext.save();
  labelContext.fillStyle = `rgba(0, 2, 8, ${0.48 * visible})`;
  labelContext.fillRect(0, 0, view.width, view.height);

  labelContext.globalCompositeOperation = "lighter";
  const outer = labelContext.createRadialGradient(p.x, p.y, radius * 0.2, p.x, p.y, radius * 3.3);
  outer.addColorStop(0, cssRgba(mix(r, 1, 0.48), mix(g, 0.96, 0.42), mix(b, 0.86, 0.38), 0.34 * visible));
  outer.addColorStop(0.28, cssRgba(r, g, b, 0.18 * visible));
  outer.addColorStop(1, cssRgba(r, g, b, 0));
  labelContext.fillStyle = outer;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, radius * 3.3, 0, TWO_PI);
  labelContext.fill();

  for (let i = 0; i < 18; i += 1) {
    const start = seededUnit(index * 1.7 + i * 9.1) * TWO_PI;
    const span = mix(0.16, 0.72, seededUnit(index * 2.3 + i * 4.7));
    const orbit = radius * mix(1.08, 1.42, seededUnit(index * 3.1 + i * 5.9));
    labelContext.strokeStyle = cssRgba(
      mix(r, 1, 0.52),
      mix(g, 0.92, 0.36),
      mix(b, 0.72, 0.18),
      visible * mix(0.035, 0.11, seededUnit(index * 4.1 + i * 6.3))
    );
    labelContext.lineWidth = mix(0.8, 2.4, seededUnit(index * 5.1 + i * 7.1)) * pulse;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, orbit, start + now * 0.00005, start + span + now * 0.00005);
    labelContext.stroke();
  }

  labelContext.globalCompositeOperation = "source-over";
  const disk = labelContext.createRadialGradient(
    p.x - radius * 0.24,
    p.y - radius * 0.28,
    radius * 0.08,
    p.x,
    p.y,
    radius
  );
  disk.addColorStop(0, cssRgba(1, 0.98, 0.88, 0.98 * visible));
  disk.addColorStop(0.42, cssRgba(mix(r, 1, 0.35), mix(g, 0.92, 0.28), mix(b, 0.76, 0.18), 0.94 * visible));
  disk.addColorStop(0.78, cssRgba(r * 0.92, g * 0.82, b * 0.76, 0.9 * visible));
  disk.addColorStop(1, cssRgba(r * 0.34, g * 0.28, b * 0.28, 0.92 * visible));
  labelContext.fillStyle = disk;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, radius * pulse, 0, TWO_PI);
  labelContext.fill();

  labelContext.globalCompositeOperation = "lighter";
  for (let i = 0; i < 42; i += 1) {
    const angle = seededUnit(index * 6.7 + i * 1.91) * TWO_PI;
    const distance = Math.sqrt(seededUnit(index * 8.3 + i * 2.17)) * radius * 0.82;
    const spot = mix(1.1, 4.2, seededUnit(index * 9.7 + i * 2.71)) * (radius / 140);
    const x = p.x + Math.cos(angle) * distance;
    const y = p.y + Math.sin(angle) * distance;
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.62),
      mix(g, 0.9, 0.38),
      mix(b, 0.68, 0.18),
      visible * 0.07
    );
    labelContext.beginPath();
    labelContext.arc(x, y, spot, 0, TWO_PI);
    labelContext.fill();
  }

  labelContext.restore();
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
  const idle = now - camera.lastInteraction > 560;
  const needsUpdate =
    labels.selected.length === 0 ||
    (idle && (lod.name !== labels.lastLod || now - labels.lastSelectAt > 1250));
  if (!needsUpdate) return;

  const chosen = [];
  const must = [pointer.active, pointer.hover].filter((index) => index >= 0);
  for (const index of must) {
    if (!chosen.includes(index)) chosen.push(index);
  }

  const basis = cameraBasis();
  const chosenScreens = chosen.map((index) => project(catalog.x[index], catalog.y[index], catalog.z[index], basis));
  const candidateLimit = lod.name === "Galactic" ? 900 : lod.name === "Regional" ? 2400 : 1500;
  const candidates = catalog.indexAtDraw.slice(0, candidateLimit).sort((a, b) => {
    const pa = project(catalog.x[a], catalog.y[a], catalog.z[a], basis);
    const pb = project(catalog.x[b], catalog.y[b], catalog.z[b], basis);
    const centerA = clamp(1.15 - Math.hypot(pa.ndcX, pa.ndcY) * 0.52, 0, 1.1);
    const centerB = clamp(1.15 - Math.hypot(pb.ndcX, pb.ndcY) * 0.52, 0, 1.1);
    let nearA = 0;
    let nearB = 0;
    if (lod.name === "Local" && pointer.active >= 0) {
      nearA = 1 / (1 + Math.hypot(catalog.x[a] - catalog.x[pointer.active], catalog.y[a] - catalog.y[pointer.active]));
      nearB = 1 / (1 + Math.hypot(catalog.x[b] - catalog.x[pointer.active], catalog.y[b] - catalog.y[pointer.active]));
    }
    const scoreA = catalog.label[a] * 1.12 + centerA * 0.46 + starVisibility(a, t) * 0.24 + nearA;
    const scoreB = catalog.label[b] * 1.12 + centerB * 0.46 + starVisibility(b, t) * 0.24 + nearB;
    return scoreB - scoreA;
  });

  const sectors = new Set();
  for (const index of candidates) {
    if (chosen.length >= lod.labels) break;
    if (chosen.includes(index)) continue;
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    if (Math.abs(p.ndcX) > 1.04 || Math.abs(p.ndcY) > 1.04) continue;
    const spacing = lod.name === "Galactic" ? 112 : lod.name === "Regional" ? 54 : 82;
    if (chosenScreens.some((item) => Math.hypot(item.x - p.x, item.y - p.y) < spacing)) {
      continue;
    }
    if (lod.name === "Galactic") {
      const angle = Math.atan2(catalog.y[index], catalog.x[index]) + Math.PI;
      const radius = Math.hypot(catalog.x[index], catalog.y[index]);
      const key = `${Math.floor((angle / TWO_PI) * 12)}:${Math.min(2, Math.floor(radius / 5.2))}`;
      if (sectors.has(key)) continue;
      sectors.add(key);
    }
    chosenScreens.push(p);
    chosen.push(index);
  }
  labels.selected = chosen;
  labels.lastSelectAt = now;
  labels.lastLod = lod.name;
}

function drawLabel(index, t, forced, occupied) {
  const p = project(catalog.x[index], catalog.y[index], catalog.z[index]);
  const visible = starVisibility(index, t);
  if (!forced && (visible < 0.08 || Math.abs(p.ndcX) > 1.04 || Math.abs(p.ndcY) > 1.04)) {
    return false;
  }
  const active = index === pointer.active;
  const hover = index === pointer.hover;
  const name = catalog.name[index];
  const surface = smoothstep(0.78, 0.96, t);
  const size = clamp(10.3 + t * 1.7 + catalog.label[index] * 1.5 + (active ? 3 : hover ? 2 : 0) - surface * 1.2, 10.3, 16.8);
  labelContext.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const text = labelContext.measureText(name);
  const side = p.x < view.width * 0.72 ? 1 : -1;
  const x = p.x + side * (12 + catalog.label[index] * 9);
  const y = p.y - 7 - catalog.label[index] * 3;
  const rect = {
    x: side > 0 ? x - 4 : x - text.width - 4,
    y: y - size - 4,
    w: text.width + 8,
    h: size + 9,
    index
  };
  if (!forced && occupied.some((item) => rectsOverlap(rect, item))) return false;

  const alpha = forced ? 0.92 : clamp(visible * 0.7 + catalog.label[index] * 0.24, 0.2, 0.72);
  labelContext.save();
  labelContext.globalAlpha = alpha;
  labelContext.lineWidth = 1;
  labelContext.strokeStyle = "rgba(205, 224, 255, 0.2)";
  labelContext.beginPath();
  labelContext.moveTo(p.x, p.y);
  labelContext.lineTo(side > 0 ? rect.x : rect.x + rect.w, rect.y + rect.h * 0.62);
  labelContext.stroke();
  labelContext.shadowColor = "rgba(0, 0, 0, 0.76)";
  labelContext.shadowBlur = 8;
  labelContext.fillStyle = active
    ? "rgba(244, 249, 255, 0.92)"
    : hover
      ? "rgba(224, 240, 255, 0.88)"
      : "rgba(202, 218, 239, 0.7)";
  labelContext.fillText(name, side > 0 ? x : x - text.width, y);
  labelContext.restore();
  occupied.push(rect);
  labels.rects.push(rect);
  return true;
}

function drawLabels(t, lod, now) {
  chooseLabels(now, t, lod);
  labels.rects = [];
  const occupied = [];
  if (pointer.active >= 0) drawLabel(pointer.active, t, true, occupied);
  if (pointer.hover >= 0 && pointer.hover !== pointer.active) drawLabel(pointer.hover, t, true, occupied);
  for (const index of labels.selected) {
    if (index === pointer.active || index === pointer.hover) continue;
    drawLabel(index, t, false, occupied);
  }
  labels.count = labels.rects.length;
}

function drawOverlay(t, lod, now) {
  clearOverlay();
  drawGalacticVeil(t);
  drawCatalogDensity(t);
  drawDarkLanes(t);
  drawLocalStar(t, now);
  drawReference(t);
  drawLabels(t, lod, now);
}

function updateCamera(now, dt) {
  const idle = clamp((now - camera.lastInteraction - 800) / 2400, 0, 1);
  if (!camera.dragging) {
    camera.yaw += dt * 0.018 * idle;
  }
  camera.yaw += camera.yawVelocity * dt * 60;
  camera.tiltRaw += camera.tiltVelocity * dt * 60;
  const dragDamping = Math.exp(-dt * (camera.dragging ? 10 : 3.4));
  camera.yawVelocity *= dragDamping;
  camera.tiltVelocity *= dragDamping;
  pullTargetTowardActive(localFocusStrength(camera.scaleTarget) * (camera.dragging ? 0.08 : 0.34));
  const ease = 1 - Math.exp(-dt * 7.2);
  camera.scale += (camera.scaleTarget - camera.scale) * ease;
  camera.targetX += (camera.targetToX - camera.targetX) * ease;
  camera.targetY += (camera.targetToY - camera.targetY) * ease;
  camera.targetZ += (camera.targetToZ - camera.targetZ) * ease;
}

function frame(now) {
  if (!initialized) return;
  const last = frame.last || now;
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  frame.last = now;
  updateCamera(now, dt);
  const t = zoomT();
  const lod = lodFor(t);
  updateScreenCache(t);
  renderScene(t, now);
  drawOverlay(t, lod, now);

  if (!firstLightSent) {
    firstLightSent = true;
    post("firstLight");
  }
  if (!readySent && now - metrics.startedAt > 700) {
    readySent = true;
    post("ready");
  }

  metrics.frames += 1;
  if (now - metrics.lastFpsAt > 1000) {
    metrics.fps = (metrics.frames * 1000) / Math.max(1, now - metrics.lastFpsAt);
    metrics.frames = 0;
    metrics.lastFpsAt = now;
  }
  if (now - metrics.lastStateAt > 240) {
    metrics.lastStateAt = now;
    post("state", {
      state: {
        lod: lod.name,
        zoomT: t,
        scale: camera.scale,
        catalog: catalog.count,
        draw: catalog.indexAtDraw.length,
        labels: labels.count,
        gpu: gpu?.status || "none",
        fps: metrics.fps,
        active: catalog.name[pointer.active] || "none"
      }
    });
  }
  animationHandle = requestFrame(frame);
}

function resize(width, height, dpr) {
  view.width = Math.max(1, width);
  view.height = Math.max(1, height);
  view.dpr = Math.max(1, dpr || 1);
  view.pixelWidth = Math.floor(view.width * view.dpr);
  view.pixelHeight = Math.floor(view.height * view.dpr);
  view.aspect = view.width / view.height;
  if (sceneCanvas) {
    sceneCanvas.width = view.pixelWidth;
    sceneCanvas.height = view.pixelHeight;
  }
  if (labelCanvas) {
    labelCanvas.width = view.pixelWidth;
    labelCanvas.height = view.pixelHeight;
  }
  configureGpuContext();
}

function handlePointerMove(message) {
  pointer.x = message.x;
  pointer.y = message.y;
  const picked = pickAt(message.x, message.y);
  if (picked !== pointer.hover) {
    pointer.hover = picked;
    labels.lastSelectAt = 0;
  }
}

function handleDrag(message) {
  camera.dragging = true;
  camera.lastInteraction = performance.now();
  const yawDelta = message.dx * 0.0018;
  const tiltDelta = message.dy * 0.0017;
  camera.yaw += yawDelta;
  camera.tiltRaw += tiltDelta;
  camera.yawVelocity = yawDelta * 0.8;
  camera.tiltVelocity = tiltDelta * 0.8;
  handlePointerMove(message);
}

function handleWheel(message) {
  camera.lastInteraction = performance.now();
  const before = screenToWorld(message.x, message.y, camera.scaleTarget);
  const speed = message.ctrlKey ? 0.0022 : 0.00112;
  const next = clamp(camera.scaleTarget * Math.exp(message.deltaY * speed), MIN_SCALE, MAX_SCALE);
  camera.scaleTarget = next;
  const after = screenToWorld(message.x, message.y, camera.scaleTarget);
  camera.targetToX += (before.x - after.x) * 0.18;
  camera.targetToY += (before.y - after.y) * 0.18;
  camera.targetToZ += (before.z - after.z) * 0.18;
  pullTargetTowardActive(localFocusStrength(camera.scaleTarget));
  labels.lastSelectAt = 0;
}

async function init(message) {
  Object.assign(config, message.config || {});
  sceneCanvas = message.scene;
  labelCanvas = message.labels;
  labelContext = labelCanvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!labelContext) {
    post("error", { message: "The worker could not create a label canvas context." });
    return;
  }
  resize(1, 1, 1);
  post("boot", { label: "Generating galactic density field" });
  catalog = buildCatalog();
  dust = buildDust();
  try {
    post("boot", { label: "Starting WebGPU renderer" });
    await initGpu();
    uploadGpuData();
  } catch (error) {
    post("error", { message: error?.message || "The WebGPU renderer could not start." });
    return;
  }
  pointer.active = pointer.active >= 0 ? pointer.active : catalog.indexAtDraw[0];
  camera.lastInteraction = performance.now() - 4000;
  metrics.lastFpsAt = performance.now();
  metrics.startedAt = metrics.lastFpsAt;
  initialized = true;
  cancelFrame(animationHandle);
  animationHandle = requestFrame(frame);
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
    pointer.hover = -1;
    labels.lastSelectAt = 0;
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
    handlePointerMove(message);
    const picked = pointer.hover >= 0 ? pointer.hover : pickAt(message.x, message.y);
    if (picked >= 0) {
      const t = zoomT();
      focusStar(picked, t < 0.34 ? 0.78 : t < 0.68 ? 0.38 : 0.18);
    }
  }
};
