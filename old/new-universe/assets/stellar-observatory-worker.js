const TWO_PI = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_SCALE = 0.16;
const MAX_SCALE = 34;
const WORLD_UP = [0, 0, 1];

let canvas = null;
let ctx = null;
let catalog = null;
let dust = null;
let backdrop = null;
let backdropLayer = null;
let backdropContext = null;
let animationHandle = 0;
let initialized = false;
let firstLightSent = false;
let readySent = false;

const config = {
  debug: false,
  budget: "standard",
  catalog: 0,
  seed: 481516,
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
  yaw: -0.28,
  yawVelocity: 0,
  tiltRaw: 0.18,
  tiltVelocity: 0,
  scale: 20,
  scaleTarget: 20,
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
  lastStateAt: 0
};

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
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

function rgba(r, g, b, a) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp(a, 0, 1)})`;
}

function richRgb(r, g, b, saturation = 1.25, lift = 0) {
  const gray = r * 0.3 + g * 0.52 + b * 0.18;
  return [
    clamp(mix(gray, r, saturation) + lift, 0, 255),
    clamp(mix(gray, g, saturation) + lift, 0, 255),
    clamp(mix(gray, b, saturation) + lift, 0, 255)
  ];
}

function catalogColor(index, saturation = 1.28, lift = 0) {
  return richRgb(catalog.r[index], catalog.g[index], catalog.b[index], saturation, lift);
}

function resolveBudget() {
  const budgets = {
    safe: { catalog: 6000, draw: 12000, dust: 7600, backdrop: 6200, labels: 42, halos: 220 },
    standard: { catalog: 10000, draw: 16000, dust: 10400, backdrop: 8200, labels: 56, halos: 320 },
    immersive: { catalog: 20000, draw: 22000, dust: 13600, backdrop: 11000, labels: 68, halos: 420 }
  };
  const key = Object.hasOwn(budgets, config.budget) ? config.budget : "standard";
  const chosen = budgets[key];
  return {
    key,
    catalog: config.catalog > 0 ? config.catalog : chosen.catalog,
    draw: chosen.draw,
    dust: chosen.dust,
    backdrop: chosen.backdrop,
    labels: chosen.labels,
    halos: chosen.halos
  };
}

function makeVoids(random) {
  const fields = [];
  for (let i = 0; i < 14; i += 1) {
    const arm = i % 5;
    const radius = mix(2.4, 15.8, random() ** 0.72);
    const theta = arm * (TWO_PI / 5) + radius * 0.46 + gaussian(random) * 0.24;
    fields.push({
      x: Math.cos(theta) * radius + gaussian(random) * 0.5,
      y: Math.sin(theta) * radius + gaussian(random) * 0.5,
      radius: mix(0.55, 1.9, random()),
      strength: mix(0.34, 0.76, random())
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
      Math.exp(-(dx * dx + dy * dy) / (field.radius * field.radius * 2.2)) *
      field.strength;
  }
  return clamp(amount, 0, 0.94);
}

function spiralSample(random, arms) {
  const arm = Math.floor(random() * arms);
  const radius = 0.32 + random() ** 0.64 * 19.2;
  const theta =
    arm * (TWO_PI / arms) +
    radius * 0.43 +
    Math.sin(radius * 0.64) * 0.22 +
    gaussian(random) * mix(0.045, 0.34, radius / 20);
  const width = mix(0.1, 0.72, radius / 20) * gaussian(random);
  return {
    x: Math.cos(theta) * radius - Math.sin(theta) * width,
    y: Math.sin(theta) * radius + Math.cos(theta) * width,
    radius,
    arm
  };
}

function makeClusters(random, voids) {
  const clusters = [];
  for (let i = 0; i < 22; i += 1) {
    let sample = spiralSample(random, 5);
    for (let retry = 0; retry < 8 && voidAt(voids, sample.x, sample.y) > 0.48; retry += 1) {
      sample = spiralSample(random, 5);
    }
    clusters.push({
      x: sample.x,
      y: sample.y,
      z: gaussian(random) * 0.16,
      radius: mix(0.18, 0.68, random()),
      hot: random() > 0.54,
      weight: mix(0.42, 1.0, random())
    });
  }
  return clusters;
}

function generatedName(index, x, y) {
  const arm = Math.floor(((Math.atan2(y, x) + Math.PI) / TWO_PI) * 24)
    .toString(36)
    .toUpperCase();
  return `NV ${arm}-${index.toString(36).toUpperCase().padStart(4, "0")}`;
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

    if (type < 0.36) {
      const barAngle = 0.34;
      const along = gaussian(random) * 2.95;
      const across = gaussian(random) * mix(0.28, 0.92, random());
      x = Math.cos(barAngle) * along - Math.sin(barAngle) * across;
      y = Math.sin(barAngle) * along + Math.cos(barAngle) * across;
      z = gaussian(random) * mix(0.08, 0.42, random());
      radius = Math.hypot(x, y);
      core = Math.exp(-(radius * radius) / 12);
    } else if (type < 0.78) {
      const sample = spiralSample(random, 5);
      x = sample.x;
      y = sample.y;
      radius = sample.radius;
      z = gaussian(random) * (0.08 + radius * 0.032);
    } else if (type < 0.93) {
      const c = clusters[Math.floor(random() * clusters.length)];
      const r = Math.abs(gaussian(random)) * c.radius;
      const theta = random() * TWO_PI;
      x = c.x + Math.cos(theta) * r;
      y = c.y + Math.sin(theta) * r;
      z = c.z + gaussian(random) * c.radius * 0.36;
      radius = Math.hypot(x, y);
      cluster = c.weight;
    } else {
      radius = mix(12.5, 23.5, random() ** 0.48);
      const theta = random() * TWO_PI;
      x = Math.cos(theta) * radius * mix(0.82, 1.2, random());
      y = Math.sin(theta) * radius * mix(0.82, 1.2, random());
      z = gaussian(random) * mix(0.18, 1.25, random());
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
    "Meridian Core",
    "Cygnus Fold",
    "Vela Ember",
    "Orion Spur",
    "Perseus Arm",
    "Aquila Reach",
    "Carina Gate"
  ];
  for (let i = 0; i < names.length && i < ranked.length; i += 1) {
    data.name[ranked[i]] = names[i];
  }
}

function selectDrawIndices(ranked, drawCount) {
  const selected = [];
  const used = new Uint8Array(ranked.length);
  const add = (index) => {
    if (index < 0 || index >= ranked.length || used[index]) return false;
    selected.push(index);
    used[index] = 1;
    return true;
  };
  const topCount = Math.min(ranked.length, Math.max(1, Math.floor(drawCount * 0.42)));
  for (let i = 0; i < topCount && selected.length < drawCount; i += 1) {
    add(ranked[i]);
  }
  const pool = Math.max(1, ranked.length - topCount);
  let probe = 0;
  while (selected.length < drawCount && probe < pool * 3) {
    const pick = topCount + Math.floor(((probe * 0.61803398875) % 1) * pool);
    add(ranked[pick]);
    probe += 1;
  }
  for (let i = topCount; selected.length < drawCount && i < ranked.length; i += 1) {
    add(ranked[i]);
  }
  return selected;
}

function buildCatalog() {
  const budget = resolveBudget();
  const random = createRandom(config.seed);
  const voids = makeVoids(random);
  const clusters = makeClusters(random, voids);
  const count = budget.catalog;
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
    screenX: new Float32Array(Math.min(count, budget.draw)),
    screenY: new Float32Array(Math.min(count, budget.draw)),
    screenR: new Float32Array(Math.min(count, budget.draw)),
    screenA: new Float32Array(Math.min(count, budget.draw)),
    indexAtDraw: [],
    name: new Array(count)
  };

  for (let i = 0; i < count; i += 1) {
    const star = sampleStar(random, voids, clusters);
    const coreGlow = Math.exp(-(star.radius * star.radius) / 17);
    const armGlow = clamp(1 - star.radius / 24, 0, 1);
    const brightRoll = random() ** mix(7.8, 2.2, coreGlow + star.anchor * 0.4);
    const lum = clamp(
      0.035 +
        brightRoll * 2.15 +
        coreGlow * mix(0.08, 0.34, random()) +
        star.cluster * 0.32 +
        star.anchor * 0.9 -
        star.dark * 0.12,
      0.015,
      2.05
    );
    const hot = random() < 0.2 + coreGlow * 0.24 + star.cluster * 0.16;
    const temperature = hot
      ? mix(7200, 14800, random() ** 0.62)
      : mix(3300, 7600, random() ** 1.35);
    const color = tempToRgb(temperature);
    const importance = clamp(
      lum * 0.26 +
        coreGlow * 0.36 +
        star.cluster * 0.24 +
        star.anchor * 0.54 +
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
    data.size[i] = mix(0.72, 3.55, clamp(Math.sqrt(lum / 2.05), 0, 1)) * mix(0.78, 1.14, random());
    data.importance[i] = importance;
    data.label[i] = clamp(importance * 0.78 + coreGlow * 0.12 + star.anchor * 0.34, 0, 1);
    data.pick[i] = mix(10, 26, Math.sqrt(importance));
    data.name[i] = generatedName(i, star.x, star.y);
  }

  const ranked = Array.from({ length: count }, (_, index) => index).sort((a, b) => {
    const scoreA = data.importance[a] * 1.2 + data.label[a] * 0.6 + data.lum[a] * 0.18;
    const scoreB = data.importance[b] * 1.2 + data.label[b] * 0.6 + data.lum[b] * 0.18;
    return scoreB - scoreA;
  });
  nameBrightStars(data, ranked);

  const drawCount = Math.min(count, budget.draw);
  data.indexAtDraw = selectDrawIndices(ranked, drawCount);
  const wanted = normalizeName(config.target);
  let active = ranked[Math.floor(random() * Math.min(30, ranked.length))];
  if (wanted) {
    const match = data.name.findIndex((name) => normalizeName(name) === wanted);
    if (match >= 0) active = match;
  }
  pointer.active = active;
  if (!data.indexAtDraw.includes(active)) data.indexAtDraw[drawCount - 1] = active;
  return data;
}

function buildDust() {
  const random = createRandom(config.seed + 9137);
  const count = catalog.budget.dust;
  const data = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    r: new Float32Array(count),
    g: new Float32Array(count),
    b: new Float32Array(count),
    alpha: new Float32Array(count),
    size: new Float32Array(count)
  };
  for (let i = 0; i < count; i += 1) {
    const sample = spiralSample(random, 5);
    const loosen = mix(0.68, 1.42, random());
    const color = tempToRgb(mix(3600, 9400, random()));
    data.x[i] = sample.x * loosen + gaussian(random) * 0.16;
    data.y[i] = sample.y * loosen + gaussian(random) * 0.16;
    data.z[i] = gaussian(random) * mix(0.08, 0.82, random());
    data.r[i] = color[0];
    data.g[i] = color[1];
    data.b[i] = color[2];
    data.alpha[i] = mix(0.03, 0.13, random());
    data.size[i] = mix(0.48, 1.82, random());
  }
  return data;
}

function buildBackdrop() {
  const random = createRandom(config.seed + 424242);
  const count = catalog.budget.backdrop;
  const data = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    r: new Float32Array(count),
    g: new Float32Array(count),
    b: new Float32Array(count),
    alpha: new Float32Array(count),
    size: new Float32Array(count),
    drift: new Float32Array(count)
  };
  for (let i = 0; i < count; i += 1) {
    const inBand = random() < 0.58;
    const x = inBand ? clamp(0.5 + gaussian(random) * 0.26, 0.01, 0.99) : random();
    const y = inBand ? clamp(0.5 + gaussian(random) * 0.09, 0.01, 0.99) : random();
    const color = tempToRgb(mix(3200, 12400, random() ** 0.82));
    const rich = richRgb(color[0], color[1], color[2], inBand ? 1.58 : 1.42, 0);
    data.x[i] = x;
    data.y[i] = y;
    data.r[i] = rich[0];
    data.g[i] = rich[1];
    data.b[i] = rich[2];
    data.alpha[i] = inBand ? mix(0.036, 0.15, random()) : mix(0.022, 0.08, random());
    data.size[i] = inBand ? mix(0.52, 1.48, random()) : mix(0.44, 1.18, random());
    data.drift[i] = mix(-0.8, 0.8, random());
  }
  return data;
}

function renderBackdropLayer() {
  if (!backdrop || view.pixelWidth < 1 || view.pixelHeight < 1) return;
  backdropLayer = new OffscreenCanvas(view.pixelWidth, view.pixelHeight);
  backdropContext = backdropLayer.getContext("2d", { alpha: true });
  if (!backdropContext) return;
  const layer = backdropContext;
  layer.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  layer.clearRect(0, 0, view.width, view.height);
  layer.globalCompositeOperation = "lighter";
  for (let i = 0; i < backdrop.count; i += 1) {
    const x = backdrop.x[i] * view.width;
    const y = backdrop.y[i] * view.height;
    const vignette = clamp(1.2 - Math.hypot(x / view.width - 0.5, y / view.height - 0.5) * 0.72, 0.5, 1.18);
    const alpha = backdrop.alpha[i] * vignette;
    const size = backdrop.size[i];
    layer.fillStyle = rgba(backdrop.r[i], backdrop.g[i], backdrop.b[i], alpha);
    if (size < 0.9) {
      layer.fillRect(x, y, 1, 1);
    } else {
      layer.beginPath();
      layer.arc(x, y, size, 0, TWO_PI);
      layer.fill();
    }
  }
}

function cameraBasis() {
  const yaw = camera.yaw;
  const tilt = Math.tanh(camera.tiltRaw) * 1.45;
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

function lodFor(t) {
  if (t < 0.34) return { name: "Galactic", labels: 16 };
  if (t < 0.76) return { name: "Regional", labels: Math.round(mix(28, catalog.budget.labels, smoothstep(0.34, 0.76, t))) };
  return { name: "Local", labels: 10 };
}

function starVisibility(index, t) {
  const importance = catalog.importance[index];
  const galactic = Math.max(smoothstep(0.03, 0.72, importance), 0.045 + importance * 0.42);
  const regional = Math.max(smoothstep(0.018, 0.58, importance), 0.035 + importance * 0.46);
  const local = Math.max(smoothstep(0.004, 0.38, importance), 0.025 + importance * 0.4);
  let value = mix(galactic, regional, smoothstep(0.2, 0.62, t));
  value = mix(value, local, smoothstep(0.62, 1, t));
  if (index === pointer.active || index === pointer.hover) value = Math.max(value, 0.96);
  return value;
}

function project(x, y, z, basis = cameraBasis()) {
  const rel = [x - camera.targetX, y - camera.targetY, z - camera.targetZ];
  const halfHeight = camera.scale;
  const halfWidth = halfHeight * view.aspect;
  const ndcX = dot(rel, basis.right) / halfWidth;
  const ndcY = dot(rel, basis.up) / halfHeight;
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
  const halfHeight = scale;
  const halfWidth = halfHeight * view.aspect;
  return {
    x: camera.targetToX + basis.right[0] * ndcX * halfWidth + basis.up[0] * ndcY * halfHeight,
    y: camera.targetToY + basis.right[1] * ndcX * halfWidth + basis.up[1] * ndcY * halfHeight,
    z: camera.targetToZ + basis.right[2] * ndcX * halfWidth + basis.up[2] * ndcY * halfHeight
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
    catalog.screenR[row] = Math.max(7, catalog.pick[index] * (0.72 + t * 0.55));
    catalog.screenA[row] =
      Math.abs(p.ndcX) < 1.2 && Math.abs(p.ndcY) < 1.2 ? alpha : 0;
  }
}

function clearFrame() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  const gradient = ctx.createRadialGradient(
    view.width * 0.5,
    view.height * 0.5,
    0,
    view.width * 0.5,
    view.height * 0.55,
    Math.max(view.width, view.height) * 0.7
  );
  gradient.addColorStop(0, "rgb(7, 11, 22)");
  gradient.addColorStop(0.46, "rgb(4, 9, 19)");
  gradient.addColorStop(1, "rgb(2, 6, 16)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
}

function drawBackdrop(t) {
  if (!backdropLayer) return;
  const fade = 1 - smoothstep(0.68, 0.98, t) * 0.62;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(backdropLayer, 0, 0, view.width, view.height);
  ctx.restore();
}

function drawDust(t) {
  const basis = cameraBasis();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < dust.count; i += 1) {
    const p = project(dust.x[i], dust.y[i], dust.z[i], basis);
    if (Math.abs(p.ndcX) > 1.08 || Math.abs(p.ndcY) > 1.08) continue;
    const alpha = dust.alpha[i] * (1.72 - t * 0.68);
    const size = dust.size[i] * (0.8 + t * 0.2);
    ctx.fillStyle = rgba(dust.r[i], dust.g[i], dust.b[i], alpha);
    ctx.fillRect(p.x - size * 0.5, p.y - size * 0.5, size, size);
  }
  ctx.restore();
}

function drawDustLanes(t) {
  if (t > 0.68) return;
  const basis = cameraBasis();
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let arm = 0; arm < 5; arm += 1) {
    ctx.beginPath();
    let started = false;
    for (let step = 0; step < 76; step += 1) {
      const radius = 1.8 + step * 0.22;
      const theta = arm * (TWO_PI / 5) + radius * 0.43 + Math.sin(radius * 0.64) * 0.22 + 0.11;
      const p = project(Math.cos(theta) * radius, Math.sin(theta) * radius, 0.02, basis);
      if (Math.abs(p.ndcX) > 1.16 || Math.abs(p.ndcY) > 1.16) {
        started = false;
        continue;
      }
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.strokeStyle = `rgba(0, 2, 9, ${0.035 * (1 - t * 0.6)})`;
    ctx.lineWidth = mix(4, 9, arm / 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReference(t) {
  const alpha = smoothstep(0.3, 0.58, t) * (1 - smoothstep(0.9, 1, t));
  if (alpha < 0.01) return;
  const basis = cameraBasis();
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 13]);
  ctx.strokeStyle = `rgba(164, 196, 234, ${0.16 * alpha})`;
  for (const radius of [2.4, 5.2, 9.4]) {
    ctx.beginPath();
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
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawStars(t) {
  const indices = catalog.indexAtDraw;
  const haloRows = [];
  for (let row = 0; row < indices.length; row += 1) {
    const index = indices[row];
    const alpha = catalog.screenA[row];
    if (alpha < 0.018) continue;
    const galacticRadius = Math.hypot(catalog.x[index], catalog.y[index]);
    if (
      haloRows.length < catalog.budget.halos &&
      ((catalog.importance[index] > 0.55 && galacticRadius > 2.25) ||
        index === pointer.active ||
        index === pointer.hover)
    ) {
      haloRows.push(row);
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const row of haloRows) {
    const index = indices[row];
    const x = catalog.screenX[row];
    const y = catalog.screenY[row];
    const alpha = catalog.screenA[row];
    const importance = catalog.importance[index];
    const activeBoost = index === pointer.active ? 1.8 : index === pointer.hover ? 1.36 : 1;
    const radius = catalog.size[index] * (4.5 + importance * 7.4) * activeBoost;
    const coreAlpha = clamp(alpha * catalog.lum[index] * 0.095 + importance * 0.036, 0.018, 0.32);
    const color = catalogColor(index, 1.72, 2);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(mix(color[0], 255, 0.18), mix(color[1], 246, 0.16), mix(color[2], 230, 0.12), coreAlpha));
    gradient.addColorStop(0.34, rgba(color[0], color[1], color[2], coreAlpha * 0.46));
    gradient.addColorStop(1, rgba(color[0], color[1], color[2], 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  for (let row = indices.length - 1; row >= 0; row -= 1) {
    const index = indices[row];
    const x = catalog.screenX[row];
    const y = catalog.screenY[row];
    const alpha = catalog.screenA[row];
    if (alpha < 0.012 || x < -24 || y < -24 || x > view.width + 24 || y > view.height + 24) continue;
    const importance = catalog.importance[index];
    const activeBoost = index === pointer.active ? 2.2 : index === pointer.hover ? 1.6 : 1;
    const galacticRadius = Math.hypot(catalog.x[index], catalog.y[index]);
    const coreDamping = galacticRadius < 2.2 ? 0.52 : 1;
    const radius =
      catalog.size[index] *
      (0.28 + t * 0.34) *
      (0.72 + importance * 1.18) *
      activeBoost *
      coreDamping;
    const coreAlpha = clamp(
      (alpha * catalog.lum[index] * 0.072 + importance * 0.018) * coreDamping,
      0.012,
      0.36
    );
    const color = catalogColor(index, 1.68, 1);
    ctx.fillStyle = rgba(
      mix(color[0], 255, 0.14),
      mix(color[1], 246, 0.12),
      mix(color[2], 224, 0.1),
      coreAlpha
    );
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

function activeSurfaceRadius(t) {
  if (pointer.active < 0) return 0;
  const close = smoothstep(0.62, 0.95, t);
  if (close <= 0) return 0;
  const luminosity = clamp(Math.sqrt(catalog.lum[pointer.active] / 2.05), 0.2, 1.2);
  return Math.min(view.width, view.height) * mix(0.08, 0.38, close) * mix(0.82, 1.08, luminosity);
}

function activeScreenPoint(t) {
  if (pointer.active < 0) return null;
  const p = project(catalog.x[pointer.active], catalog.y[pointer.active], catalog.z[pointer.active]);
  const pull = smoothstep(0.64, 0.9, t);
  return {
    x: mix(p.x, view.width * 0.5, pull),
    y: mix(p.y, view.height * 0.5, pull),
    ndcX: p.ndcX,
    ndcY: p.ndcY
  };
}

function drawLocalDimming(t) {
  const close = smoothstep(0.62, 0.96, t);
  if (close <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(1, 3, 9, ${0.5 * close})`;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.restore();
}

function drawActiveStarCloseup(t) {
  const close = smoothstep(0.62, 0.95, t);
  const index = pointer.active;
  if (index < 0 || close <= 0.01) return;
  const p = activeScreenPoint(t);
  if (!p || p.x < -view.width || p.y < -view.height || p.x > view.width * 2 || p.y > view.height * 2) return;
  const radius = activeSurfaceRadius(t);
  const [r, g, b] = catalogColor(index, 1.62, 4);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.2);
  halo.addColorStop(0, rgba(mix(r, 255, 0.34), mix(g, 248, 0.28), mix(b, 232, 0.18), 0.42 * close));
  halo.addColorStop(0.24, rgba(r, g, b, 0.22 * close));
  halo.addColorStop(1, rgba(r, g, b, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 3.2, 0, TWO_PI);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  const disc = ctx.createRadialGradient(
    p.x - radius * 0.22,
    p.y - radius * 0.24,
    radius * 0.1,
    p.x,
    p.y,
    radius
  );
  disc.addColorStop(0, rgba(255, 252, 230, 0.98 * close));
  disc.addColorStop(0.38, rgba(mix(r, 255, 0.52), mix(g, 242, 0.42), mix(b, 218, 0.26), 0.96 * close));
  disc.addColorStop(0.72, rgba(mix(r, 255, 0.2), mix(g, 228, 0.12), mix(b, 208, 0.08), 0.9 * close));
  disc.addColorStop(1, rgba(r * 0.58, g * 0.58, b * 0.66, 0.86 * close));
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, TWO_PI);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius * 0.98, 0, TWO_PI);
  ctx.clip();
  ctx.globalAlpha = 0.22 * close;
  ctx.lineWidth = Math.max(1, radius * 0.018);
  ctx.strokeStyle = rgba(r * 0.7, g * 0.6, b * 0.54, 0.78);
  for (let band = -3; band <= 3; band += 1) {
    ctx.beginPath();
    const y = p.y + band * radius * 0.18;
    ctx.moveTo(p.x - radius * 1.1, y);
    for (let step = 0; step <= 42; step += 1) {
      const x = p.x - radius * 1.1 + (step / 42) * radius * 2.2;
      const wave = Math.sin(step * 0.7 + band * 1.4 + config.seed * 0.001) * radius * 0.025;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function pickAt(x, y) {
  for (let i = labels.rects.length - 1; i >= 0; i -= 1) {
    const rect = labels.rects[i];
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return rect.index;
    }
  }
  const surfaceRadius = activeSurfaceRadius(zoomT());
  if (surfaceRadius > 10 && pointer.active >= 0) {
    const activePoint = activeScreenPoint(zoomT());
    if (Math.hypot(x - activePoint.x, y - activePoint.y) <= surfaceRadius * 1.08) {
      return pointer.active;
    }
  }
  let best = -1;
  let bestScore = Infinity;
  for (let row = 0; row < catalog.indexAtDraw.length; row += 1) {
    const alpha = catalog.screenA[row];
    if (alpha < 0.04) continue;
    const dx = x - catalog.screenX[row];
    const dy = y - catalog.screenY[row];
    const radius = Math.max(13, catalog.screenR[row] * (0.75 + alpha * 0.7));
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

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

function chooseLabels(now, t, lod) {
  const idle = now - camera.lastInteraction > 540;
  const needsUpdate =
    labels.selected.length === 0 ||
    lod.name !== labels.lastLod ||
    (idle && now - labels.lastSelectAt > 1200);
  if (!needsUpdate) return;

  const chosen = [];
  const must = [pointer.active, pointer.hover].filter((index) => index >= 0);
  for (const index of must) {
    if (!chosen.includes(index)) chosen.push(index);
  }

  const basis = cameraBasis();
  const chosenScreens = chosen.map((index) => project(catalog.x[index], catalog.y[index], catalog.z[index], basis));
  const candidateLimit =
    lod.name === "Galactic" ? 950 : lod.name === "Regional" ? 4200 : 1800;
  const candidates = catalog.indexAtDraw.slice(0, Math.min(candidateLimit, catalog.indexAtDraw.length)).sort((a, b) => {
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
    return (
      catalog.label[b] * 1.1 +
      centerB * 0.46 +
      starVisibility(b, t) * 0.24 +
      nearB -
      (catalog.label[a] * 1.1 + centerA * 0.46 + starVisibility(a, t) * 0.24 + nearA)
    );
  });

  const sectors = new Map();
  for (const index of candidates) {
    if (chosen.length >= lod.labels) break;
    if (chosen.includes(index)) continue;
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    if (Math.abs(p.ndcX) > 1.04 || Math.abs(p.ndcY) > 1.04) continue;
    if (lod.name === "Galactic") {
      if (chosenScreens.some((item) => Math.hypot(item.x - p.x, item.y - p.y) < 112)) continue;
      const angle = Math.atan2(catalog.y[index], catalog.x[index]) + Math.PI;
      const radius = Math.hypot(catalog.x[index], catalog.y[index]);
      const key = `${Math.floor((angle / TWO_PI) * 12)}:${Math.min(2, Math.floor(radius / 5.2))}`;
      if (sectors.has(key)) continue;
      sectors.set(key, 1);
      chosenScreens.push(p);
    } else if (lod.name === "Regional") {
      if (chosenScreens.some((item) => Math.hypot(item.x - p.x, item.y - p.y) < 62)) continue;
      const key = `${Math.floor(clamp(p.x / view.width, 0, 0.999) * 8)}:${Math.floor(clamp(p.y / view.height, 0, 0.999) * 5)}`;
      const used = sectors.get(key) || 0;
      if (used >= 2) continue;
      sectors.set(key, used + 1);
      chosenScreens.push(p);
    }
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
  const size = clamp(10.5 + t * 2.4 + catalog.label[index] * 2 + (active ? 3 : hover ? 2 : 0), 10.5, 17.5);
  ctx.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const text = ctx.measureText(name);
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
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(205, 224, 255, 0.2)";
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(side > 0 ? rect.x : rect.x + rect.w, rect.y + rect.h * 0.62);
  ctx.stroke();
  ctx.shadowColor = "rgba(0, 0, 0, 0.76)";
  ctx.shadowBlur = 8;
  ctx.fillStyle = active
    ? "rgba(244, 249, 255, 0.92)"
    : hover
      ? "rgba(224, 240, 255, 0.88)"
      : "rgba(202, 218, 239, 0.7)";
  ctx.fillText(name, side > 0 ? x : x - text.width, y);
  ctx.restore();
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
  const ease = 1 - Math.exp(-dt * 7.2);
  if (zoomT() > 0.62 && pointer.active >= 0 && !camera.dragging) {
    const localEase = 1 - Math.exp(-dt * 5.2);
    camera.targetToX += (catalog.x[pointer.active] - camera.targetToX) * localEase;
    camera.targetToY += (catalog.y[pointer.active] - camera.targetToY) * localEase;
    camera.targetToZ += (catalog.z[pointer.active] - camera.targetToZ) * localEase;
  }
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
  clearFrame();
  drawBackdrop(t);
  drawDust(t);
  drawDustLanes(t);
  drawStars(t);
  drawLocalDimming(t);
  drawActiveStarCloseup(t);
  drawReference(t);
  drawLabels(t, lod, now);

  if (!firstLightSent) {
    firstLightSent = true;
    post("firstLight");
  }
  if (!readySent && now - metrics.lastFpsAt > 400) {
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
  if (canvas) {
    canvas.width = view.pixelWidth;
    canvas.height = view.pixelHeight;
  }
  renderBackdropLayer();
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
  labels.lastSelectAt = 0;
}

async function init(message) {
  Object.assign(config, message.config || {});
  canvas = message.canvas;
  ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) {
    post("error", { message: "The worker could not create an OffscreenCanvas 2D context." });
    return;
  }
  resize(1, 1, 1);
  post("boot", { label: "Generating galactic density field" });
  catalog = buildCatalog();
  dust = buildDust();
  backdrop = buildBackdrop();
  renderBackdropLayer();
  const start = pointer.active >= 0 ? pointer.active : catalog.indexAtDraw[0];
  pointer.active = start;
  camera.lastInteraction = performance.now() - 4000;
  metrics.lastFpsAt = performance.now();
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
      focusStar(picked, zoomT() < 0.5 ? 0.48 : 0.34);
    }
  }
};
