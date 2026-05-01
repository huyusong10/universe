const TWO_PI = Math.PI * 2;
const MIN_SCALE = 0.000001;
const MAX_SCALE = 24;
const MIN_CAMERA_DISTANCE = 0.8;
const MAX_CAMERA_DISTANCE = 80000;
const INITIAL_CAMERA_DISTANCE = MAX_CAMERA_DISTANCE;
const MAX_CAMERA_FOV = 40;
const INITIAL_SCALE = 18.4;
const GALACTIC_DISTANCE = 18000;
const REGIONAL_DISTANCE = 2400;
const LOCAL_MAP_DISTANCE = 1100;
const LOCAL_SYSTEM_DISTANCE = 220;
const SURFACE_FULL_DISTANCE = 58;
const GALACTIC_REGIONAL_BLEND_START = 17000;
const GALACTIC_REGIONAL_BLEND_END = 26000;
const CATALOG_PROJECTION_FLOOR_DISTANCE = LOCAL_SYSTEM_DISTANCE;
const WHEEL_ZOOM_SPEED = 0.00078;
const WHEEL_ZOOM_SPEED_PRECISE = 0.00108;
const CAMERA_DISTANCE_FOLLOW = 0.125;
const FOCUS_FLIGHT_MS = 1700;
const FOCUS_APPROACH_DISTANCE = 128;
const SPHERE_LAT_SEGMENTS = 48;
const SPHERE_LON_SEGMENTS = 96;

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
  distance: INITIAL_CAMERA_DISTANCE,
  distanceTarget: INITIAL_CAMERA_DISTANCE,
  scale: INITIAL_SCALE,
  scaleTarget: INITIAL_SCALE,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
  targetToX: 0,
  targetToY: 0,
  targetToZ: 0,
  dragging: false,
  lastInteraction: 0
};

const focusFlight = {
  active: false,
  startedAt: 0,
  duration: FOCUS_FLIGHT_MS,
  fromDistance: INITIAL_CAMERA_DISTANCE,
  toDistance: INITIAL_CAMERA_DISTANCE,
  fromX: 0,
  fromY: 0,
  fromZ: 0,
  toX: 0,
  toY: 0,
  toZ: 0,
  progress: 0
};

const pointer = {
  x: -1000,
  y: -1000,
  hover: -1,
  active: -1
};

const approach = {
  index: -1,
  progress: 0,
  target: 0
};

const labels = {
  selected: [],
  rects: [],
  lastSelectAt: 0,
  lastLod: "",
  count: 0,
  activeX: -1000,
  activeY: -1000
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
  optics: vec4f,
  layerOptics: vec4f,
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
  let bridgePresence = u.optics.y * smoother(0.16, 0.86, params.z);
  let starVisibilityValue = max(starVisibility(params.z, u.view.y), bridgePresence * 0.70);
  let catalogExit = clamp(u.optics.w, 0.0, 1.0);
  let backgroundRetreat = smoother(0.08, 0.92, catalogExit);
  let surfacePresence = clamp(u.interaction.w, 0.0, 1.0);
  let activeHandoff = smoother(0.18, 0.90, surfacePresence);
  let metricOpacity = clamp(u.layerOptics.z, 0.0, 1.0);
  let metricPointScale = clamp(u.layerOptics.x, 0.0, 1.0);
  let surfaceContextFade = max(0.015, metricOpacity * (1.0 - backgroundRetreat * 0.54));
  let dustVisibility = params.x * (0.48 + u.optics.z * 0.42 + u.optics.y * 0.20) * surfaceContextFade;
  var visibility = select(dustVisibility, starVisibilityValue, isStar);
  visibility = select(visibility, visibility * surfaceContextFade, isStar && !(isActive || hover));
  let activeForcedVisibility = max(visibility, 0.98 * (1.0 - activeHandoff * 0.82));
  let hoverForcedVisibility = max(visibility, 0.86 * (1.0 - backgroundRetreat * 0.28));
  let forcedVisibility = select(select(visibility, hoverForcedVisibility, hover), activeForcedVisibility, isActive);
  var starRadius =
    params.y *
    (0.88 + u.view.y * 1.72) *
    (0.65 + params.z * 1.7) *
    activeBoost *
    (1.0 + bridgePresence * 0.72);
  let nearScale = smoother(0.56, 1.0, u.view.y);
  let scaleMagnification = min(7.5, 0.42 / max(u.targetScale.w, 0.035));
  let localSizeLift = 1.0 + nearScale * (scaleMagnification - 1.0) * (0.22 + params.z * 0.78);
  let activeNearLift = select(1.0, 1.0 + nearScale * min(3.8, 0.30 / max(u.targetScale.w, 0.035)), isActive);
  starRadius = starRadius * localSizeLift * activeNearLift;
  let backgroundRadiusScale = max(0.055, 1.0 - backgroundRetreat * 0.945);
  let hoverRadiusScale = max(backgroundRadiusScale, 0.70);
  let activeRadiusScale = max(0.12, 1.0 - activeHandoff * 0.88);
  let radiusContextScale = select(select(backgroundRadiusScale, hoverRadiusScale, hover), activeRadiusScale, isActive);
  starRadius = starRadius * radiusContextScale;
  starRadius = select(starRadius * metricPointScale, starRadius, isActive || hover);
  let radiusCap = select(56.0 + params.z * 38.0, 220.0, isActive);
  starRadius = min(starRadius, radiusCap);
  let dustRadius = params.y * (0.50 + u.view.y * 0.10 + u.optics.y * 0.08);
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
  let bridge = in.params.z * in.params.z * in.extra.y * 0.08 * u.optics.y;
  let activeHandoff = smoother(0.18, 0.90, clamp(u.interaction.w, 0.0, 1.0));
  let activeStar = isStar && abs(in.extra.x - u.interaction.x) < 0.5;
  let metricOpacity = select(clamp(u.layerOptics.z, 0.0, 1.0), 1.0, activeStar);
  let metricHaloScale = select(clamp(u.layerOptics.y, 0.0, 1.0), 1.0, activeStar);
  let activeSurfaceFade = select(1.0, max(0.015, 1.0 - activeHandoff * 0.96), activeStar);
  let crowdEnergy = 0.70 - u.optics.y * 0.16 - u.optics.z * 0.06;
  let starEnergy =
    in.alpha *
    (core * (0.92 + in.params.x * 0.22) * activeSurfaceFade * metricOpacity +
      psf * (0.20 + in.params.z * 0.15) * mix(1.0, activeSurfaceFade, 0.82) * metricHaloScale +
      halo * (0.050 + in.params.z * 0.050 + bridge) * metricHaloScale +
      outer * (0.010 + in.params.z * 0.016 + bridge * 0.42) * metricHaloScale) *
    u.optics.x *
    crowdEnergy;
  let dustAlpha = in.alpha * exp(-d * d * 5.4) * (0.035 + u.optics.z * 0.026 + u.optics.y * 0.014);
  let alpha = clamp(select(dustAlpha, starEnergy, isStar), 0.0, 0.92);
  let bridgeWhite = clamp(core * 0.48 + u.optics.y * in.params.z * 0.10, 0.0, 0.68);
  let starColor = mix(in.color, vec3f(1.0, 0.96, 0.86), bridgeWhite);
  let dustColor = in.color * vec3f(0.48, 0.55, 0.70);
  let rgb = select(dustColor * alpha, starColor * alpha, isStar);
  return vec4f(rgb, alpha);
}
`;

const SPHERE_SHADER = `
struct SphereUniforms {
  right: vec4f,
  up: vec4f,
  forward: vec4f,
  targetScale: vec4f,
  activeStar: vec4f,
  color: vec4f,
  params: vec4f,
  view: vec4f,
  modelX: vec4f,
  modelY: vec4f,
  modelZ: vec4f,
};

@group(0) @binding(0) var<uniform> u: SphereUniforms;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) normalView: vec3f,
  @location(1) uv: vec2f,
  @location(2) color: vec3f,
  @location(3) params: vec4f,
};

@vertex
fn vertexMain(
  @location(0) unitPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f
) -> VertexOut {
  let worldNormal = normalize(
    unitPosition.x * u.modelX.xyz +
    unitPosition.y * u.modelY.xyz +
    unitPosition.z * u.modelZ.xyz
  );
  let worldPosition = u.activeStar.xyz + worldNormal * u.activeStar.w;
  let rel = worldPosition - u.targetScale.xyz;
  let center = vec2f(
    dot(rel, u.right.xyz) / (u.targetScale.w * u.view.x),
    dot(rel, u.up.xyz) / u.targetScale.w
  );
  let normalView = normalize(vec3f(
    dot(worldNormal, u.right.xyz),
    dot(worldNormal, u.up.xyz),
    dot(worldNormal, u.forward.xyz)
  ));
  let depth = clamp(0.5 - dot(rel, u.forward.xyz) * 0.00001 - normalView.z * 0.28, 0.001, 0.999);

  var out: VertexOut;
  out.position = vec4f(center, depth, 1.0);
  out.normalView = normalView;
  out.uv = uv;
  out.color = u.color.rgb;
  out.params = vec4f(u.color.a, u.params.x, u.params.y, u.params.z);
  return out;
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn valueNoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u2 = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u2.x), mix(c, d, u2.x), u2.y);
}

fn fbm(p: vec2f) -> f32 {
  var q = p;
  var amp = 0.54;
  var value = 0.0;
  for (var i = 0; i < 4; i = i + 1) {
    value = value + valueNoise(q) * amp;
    q = q * 2.07 + vec2f(11.7, 4.2);
    amp = amp * 0.52;
  }
  return clamp(value, 0.0, 1.0);
}

fn plasmaSurface(uv: vec2f, phase: f32, seed: f32, activity: f32) -> vec4f {
  let spinUv = vec2f(fract(uv.x + phase), uv.y);
  let latitude = (uv.y - 0.5) * 2.0;
  let shear = sin(latitude * 3.14159265) * 0.08;
  let flowUv = vec2f(fract(spinUv.x + shear + phase * 0.31), spinUv.y);
  let slowFlow = fbm(flowUv * vec2f(8.0, 5.0) + vec2f(seed * 17.0, phase * 4.3));
  let cells = fbm(flowUv * vec2f(52.0, 28.0) + vec2f(seed * 29.0, phase * 8.0));
  let fineCells = fbm(flowUv * vec2f(116.0, 72.0) + vec2f(seed * 53.0, phase * 14.0));
  let band = sin((flowUv.x + slowFlow * 0.08) * 38.0 + flowUv.y * 19.0 + seed * 6.2) * 0.5 + 0.5;
  let activeA = pow(max(0.0, 1.0 - length(vec2f(fract(spinUv.x + seed * 0.37) - 0.5, uv.y - (0.34 + seed * 0.18))) * 4.8), 3.0);
  let activeB = pow(max(0.0, 1.0 - length(vec2f(fract(spinUv.x + 0.47 + seed * 0.19) - 0.5, uv.y - (0.62 - seed * 0.14))) * 5.8), 3.0);
  let activeRegions = clamp((activeA + activeB * 0.7) * (0.35 + activity * 0.85), 0.0, 1.0);
  let spotField = fbm(flowUv * vec2f(18.0, 10.0) + vec2f(seed * 101.0, -phase * 3.5));
  let darkSpots = smoothstep(0.72, 0.94, spotField) * (0.10 + activity * 0.20);
  let granulation = clamp(cells * 0.62 + fineCells * 0.38 + band * 0.18, 0.0, 1.0);
  return vec4f(granulation, slowFlow, activeRegions, darkSpots);
}

@fragment
fn fragmentMain(in: VertexOut) -> @location(0) vec4f {
  let presence = clamp(in.params.x, 0.0, 1.0);
  if (presence < 0.003) {
    discard;
  }
  let phase = in.params.y;
  let lum = clamp(in.params.z, 0.0, 3.0);
  let activity = clamp(in.params.w, 0.0, 1.0);
  let seed = fract(u.view.w);
  let n = normalize(in.normalView);
  if (n.z < -0.02) {
    discard;
  }
  let facing = clamp(n.z, 0.0, 1.0);
  let limb = pow(facing, 0.62);
  let rim = pow(1.0 - facing, 1.9);
  let plasma = plasmaSurface(in.uv, phase, seed, activity);
  let hotTint = vec3f(1.0, 0.92, 0.68);
  let coolTint = vec3f(0.46, 0.58, 0.92);
  let colorTemperature = clamp((in.color.b - in.color.r) * 0.85 + 0.5, 0.0, 1.0);
  let starTint = max(in.color, vec3f(0.38, 0.43, 0.52));
  let base = mix(mix(starTint, hotTint, 0.30), mix(starTint, coolTint, 0.36), colorTemperature * 0.52);
  let limbDarkening = mix(0.34, 1.0, limb);
  let mottling = (plasma.x - 0.50) * (1.18 + activity * 0.42) + (plasma.y - 0.5) * 0.46;
  let activeGlow = hotTint * plasma.z * (0.48 + activity * 0.62 + lum * 0.06);
  let darkening = plasma.w * (0.26 + activity * 0.18);
  let edgeEmission = mix(base, vec3f(0.70, 0.86, 1.0), 0.38 + colorTemperature * 0.24) * rim * (0.48 + activity * 0.34);
  let surfaceEnergy = clamp(0.92 + lum * 0.06 + mottling - darkening, 0.38, 1.42);
  let grainEmission = mix(coolTint, hotTint, colorTemperature * 0.45 + 0.24) * pow(plasma.x, 2.0) * (0.18 + activity * 0.18);
  let body = base * surfaceEnergy * limbDarkening * (0.98 + activity * 0.16);
  let basalEmission = base * (0.30 + lum * 0.05);
  let color = clamp((body + activeGlow + edgeEmission + basalEmission + grainEmission) * (1.02 + presence * 0.28), vec3f(0.03), vec3f(1.16));
  let alpha = clamp(presence * (0.82 + rim * 0.16), 0.0, 0.98);
  return vec4f(color, alpha);
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

function easeInOutCubic(value) {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
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
  const solIndex = ranked[0];
  data.x[solIndex] = 0;
  data.y[solIndex] = 0;
  data.z[solIndex] = 0;
  data.radius[solIndex] = 0;

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

function spherePoint(lat, lon) {
  const theta = (lat / SPHERE_LAT_SEGMENTS) * Math.PI;
  const phi = (lon / SPHERE_LON_SEGMENTS) * TWO_PI;
  const sinTheta = Math.sin(theta);
  return {
    x: sinTheta * Math.cos(phi),
    y: sinTheta * Math.sin(phi),
    z: Math.cos(theta),
    u: lon / SPHERE_LON_SEGMENTS,
    v: lat / SPHERE_LAT_SEGMENTS
  };
}

function pushSphereVertex(vertices, point) {
  vertices.push(point.x, point.y, point.z, point.x, point.y, point.z, point.u, point.v);
}

function buildSphereMesh() {
  const vertices = [];
  for (let lat = 0; lat < SPHERE_LAT_SEGMENTS; lat += 1) {
    for (let lon = 0; lon < SPHERE_LON_SEGMENTS; lon += 1) {
      const p00 = spherePoint(lat, lon);
      const p01 = spherePoint(lat, lon + 1);
      const p10 = spherePoint(lat + 1, lon);
      const p11 = spherePoint(lat + 1, lon + 1);
      pushSphereVertex(vertices, p00);
      pushSphereVertex(vertices, p10);
      pushSphereVertex(vertices, p01);
      pushSphereVertex(vertices, p01);
      pushSphereVertex(vertices, p10);
      pushSphereVertex(vertices, p11);
    }
  }
  return {
    vertices: new Float32Array(vertices),
    vertexCount: vertices.length / 8,
    triangleCount: vertices.length / 24
  };
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

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function normalizeVector(value) {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function rotateAroundAxis(vector, axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = dot(axis, vector);
  const cr = cross(axis, vector);
  return [
    vector[0] * c + cr[0] * s + axis[0] * d * (1 - c),
    vector[1] * c + cr[1] * s + axis[1] * d * (1 - c),
    vector[2] * c + cr[2] * s + axis[2] * d * (1 - c)
  ];
}

function starModelBasis(index) {
  const tilt = mix(-0.58, 0.58, seededUnit(index * 6.41 + 0.2));
  const spin = seededUnit(index * 9.17 + 3.3) * TWO_PI;
  const zAxis = normalizeVector([
    Math.sin(tilt) * Math.cos(spin),
    Math.sin(tilt) * Math.sin(spin),
    Math.cos(tilt)
  ]);
  const seedRight = Math.abs(zAxis[2]) > 0.92 ? [1, 0, 0] : [0, 0, 1];
  let xAxis = normalizeVector(cross(seedRight, zAxis));
  xAxis = normalizeVector(rotateAroundAxis(xAxis, zAxis, spin * 0.37));
  const yAxis = normalizeVector(cross(zAxis, xAxis));
  return { xAxis, yAxis, zAxis };
}

function cameraFovForDistance(distance) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  if (value >= REGIONAL_DISTANCE) return MAX_CAMERA_FOV;
  return mix(24, MAX_CAMERA_FOV, smoothstep(LOCAL_SYSTEM_DISTANCE, REGIONAL_DISTANCE, value));
}

function projectionScaleForDistance(distance) {
  const projectedDistance = Math.max(distance, CATALOG_PROJECTION_FLOOR_DISTANCE);
  const fov = cameraFovForDistance(projectedDistance);
  const referenceHalfHeight =
    MAX_CAMERA_DISTANCE * Math.tan((MAX_CAMERA_FOV * Math.PI) / 360);
  const halfHeight = projectedDistance * Math.tan((fov * Math.PI) / 360);
  return clamp((INITIAL_SCALE * halfHeight) / referenceHalfHeight, MIN_SCALE, MAX_SCALE);
}

function distanceForProjectionScale(scale) {
  const target = clamp(scale, MIN_SCALE, MAX_SCALE);
  let lo = MIN_CAMERA_DISTANCE;
  let hi = MAX_CAMERA_DISTANCE;
  for (let i = 0; i < 44; i += 1) {
    const mid = Math.exp((Math.log(lo) + Math.log(hi)) * 0.5);
    if (projectionScaleForDistance(mid) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return clamp(hi, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
}

function updateDerivedScale() {
  camera.scale = projectionScaleForDistance(camera.distance);
  camera.scaleTarget = projectionScaleForDistance(camera.distanceTarget);
}

function logDepthForDistance(distance, nearDistance, farDistance) {
  const minLog = Math.log(nearDistance);
  const maxLog = Math.log(farDistance);
  return clamp((maxLog - Math.log(clamp(distance, nearDistance, farDistance))) / (maxLog - minLog), 0, 1);
}

function semanticScaleAxisProgress(distance, surfacePresence) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  if (value >= GALACTIC_DISTANCE) {
    return mix(0, 0.18, smoothstep(0, 1, logDepthForDistance(value, GALACTIC_DISTANCE, MAX_CAMERA_DISTANCE)));
  }
  if (value >= REGIONAL_DISTANCE) {
    return mix(0.18, 0.44, smoothstep(0, 1, logDepthForDistance(value, REGIONAL_DISTANCE, GALACTIC_DISTANCE)));
  }
  if (value >= LOCAL_MAP_DISTANCE) {
    return mix(0.44, 0.58, smoothstep(0, 1, logDepthForDistance(value, LOCAL_MAP_DISTANCE, REGIONAL_DISTANCE)));
  }
  if (value >= LOCAL_SYSTEM_DISTANCE) {
    return mix(0.58, 0.78, smoothstep(0, 1, logDepthForDistance(value, LOCAL_SYSTEM_DISTANCE, LOCAL_MAP_DISTANCE)));
  }
  return mix(0.78, 1, surfacePresence);
}

function makeLayer(presence, pointScale, haloScale, labelWeight, pickWeight, opacity) {
  return {
    presence: clamp(presence, 0, 1),
    pointScale: clamp(pointScale, 0, 1),
    haloScale: clamp(haloScale, 0, 1),
    labelWeight: clamp(labelWeight, 0, 1),
    pickWeight: clamp(pickWeight, 0, 1),
    opacity: clamp(opacity, 0, 1)
  };
}

function scaleStageForDistance(distance) {
  if (distance >= GALACTIC_DISTANCE) return "Galactic";
  if (distance >= REGIONAL_DISTANCE) return "Regional";
  if (distance >= LOCAL_MAP_DISTANCE) return "LocalMap";
  if (distance >= LOCAL_SYSTEM_DISTANCE) return "LocalSystem";
  return "Surface";
}

function scaleModelForDistance(distance) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const surfacePresence = 1 - smoothstep(SURFACE_FULL_DISTANCE, LOCAL_SYSTEM_DISTANCE, value);
  const metricCatalogPresence = smoothstep(520, 1500, value);
  const celestialBackdropPresence = 1 - smoothstep(620, 1600, value);
  const localSystemPresence =
    (1 - smoothstep(360, LOCAL_MAP_DISTANCE, value)) *
    smoothstep(42, 140, value);
  const scaleDepth = logDepthForDistance(value, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const mapDepth = logDepthForDistance(
    Math.max(value, LOCAL_MAP_DISTANCE),
    LOCAL_MAP_DISTANCE,
    MAX_CAMERA_DISTANCE
  );
  const regionalDepth = smoothstep(GALACTIC_DISTANCE, REGIONAL_DISTANCE, value);
  const surfaceViewRadiusStarR = Math.exp(
    mix(Math.log(7.5), Math.log(1.25), surfacePresence)
  );
  const scaleAxisProgress = semanticScaleAxisProgress(value, surfacePresence);
  const galacticLayerPresence = smoothstep(
    GALACTIC_REGIONAL_BLEND_START,
    GALACTIC_REGIONAL_BLEND_END,
    value
  );
  const galacticLayerPointCore = smoothstep(14000, 50000, value);
  const galacticLayerHaloCore = smoothstep(GALACTIC_DISTANCE, 52000, value);
  const galacticLayer = makeLayer(
    galacticLayerPresence,
    galacticLayerPresence * mix(0.12, 1, galacticLayerPointCore),
    galacticLayerPresence * galacticLayerHaloCore,
    galacticLayerPresence,
    galacticLayerPresence,
    galacticLayerPresence
  );
  const regionalLayerPresence =
    (1 - smoothstep(GALACTIC_REGIONAL_BLEND_START, GALACTIC_REGIONAL_BLEND_END, value)) *
    smoothstep(1500, 6500, value);
  const regionalPointCore = smoothstep(2200, 9000, value);
  const regionalLayer = makeLayer(
    regionalLayerPresence,
    regionalLayerPresence * mix(0.14, 1, regionalPointCore),
    regionalLayerPresence * smoothstep(2800, 11000, value),
    regionalLayerPresence,
    regionalLayerPresence,
    regionalLayerPresence
  );
  const localMapLayerPresence =
    (1 - smoothstep(REGIONAL_DISTANCE, 4200, value)) *
    metricCatalogPresence;
  const localMapInteractionExit = 1 - smoothstep(0.18, 0.45, localSystemPresence);
  const localMapLabelWeight = localMapLayerPresence * localMapInteractionExit;
  const localMapPickWeight = localMapLabelWeight <= 0.05 ? 0 : localMapLabelWeight;
  const localMapLayer = makeLayer(
    localMapLayerPresence,
    localMapLayerPresence * mix(0.08, 1, smoothstep(900, 1800, value)),
    localMapLayerPresence * mix(0.10, 0.46, smoothstep(900, 1800, value)),
    localMapLabelWeight,
    localMapPickWeight,
    localMapLayerPresence
  );
  const localSystemLayerPresence =
    localSystemPresence *
    (1 - smoothstep(0.28, 0.82, surfacePresence) * 0.78);
  const localSystemLayer = makeLayer(
    localSystemLayerPresence,
    localSystemLayerPresence,
    localSystemLayerPresence,
    localSystemLayerPresence * 0.18,
    0,
    localSystemLayerPresence
  );
  const surfaceLayer = makeLayer(
    surfacePresence,
    surfacePresence,
    surfacePresence,
    surfacePresence,
    0,
    surfacePresence
  );
  const metricLayerPresence = Math.max(
    galacticLayer.presence,
    regionalLayer.presence,
    localMapLayer.presence
  );
  const metricLayerPointScale = Math.max(
    galacticLayer.pointScale,
    regionalLayer.pointScale,
    localMapLayer.pointScale
  );
  const metricLayerHaloScale = Math.max(
    galacticLayer.haloScale,
    regionalLayer.haloScale,
    localMapLayer.haloScale
  );
  const metricLayerLabelWeight = Math.max(
    galacticLayer.labelWeight,
    regionalLayer.labelWeight,
    localMapLayer.labelWeight
  );
  const metricLayerPickWeight =
    metricLayerLabelWeight <= 0.05
      ? 0
      : Math.max(galacticLayer.pickWeight, regionalLayer.pickWeight, localMapLayer.pickWeight);
  const metricLayerOpacity = Math.max(
    galacticLayer.opacity,
    regionalLayer.opacity,
    localMapLayer.opacity
  );
  const localApproach = clamp((1 - metricLayerOpacity) * 0.58 + localSystemLayer.presence * 0.24 + surfacePresence * 0.18, 0, 1);
  return {
    distance: value,
    scaleStage: scaleStageForDistance(value),
    scaleDepth,
    scaleAxisProgress,
    mapDepth,
    regionalDepth,
    metricCatalogPresence,
    celestialBackdropPresence,
    localSystemPresence,
    surfacePresence,
    surfaceViewRadiusStarR,
    localApproach,
    galacticLayer,
    regionalLayer,
    localMapLayer,
    localSystemLayer,
    surfaceLayer,
    metricLayerPresence,
    metricLayerPointScale,
    metricLayerHaloScale,
    metricLayerLabelWeight,
    metricLayerPickWeight,
    metricLayerOpacity
  };
}

function zoomTForDistance(distance) {
  return scaleModelForDistance(distance).scaleDepth;
}

function zoomT() {
  return zoomTForDistance(camera.distance);
}

function lodForScaleModel(model) {
  if (model.distance >= GALACTIC_DISTANCE) return { name: "Galactic", labels: 16 };
  if (model.distance >= REGIONAL_DISTANCE) {
    return {
      name: "Regional",
      labels: Math.round(mix(24, Math.min(catalog.budget.labels, 38), model.regionalDepth) * model.metricLayerLabelWeight)
    };
  }
  return {
    name: "Local",
    labels: Math.max(1, Math.round(mix(12, 1, 1 - model.metricCatalogPresence) * model.metricLayerLabelWeight))
  };
}

function scaleResponse(model) {
  const t = model.mapDepth;
  const regionalBridge = model.regionalLayer.presence * (1 - model.surfacePresence);
  const localSurface = model.surfacePresence;
  const galacticBase = model.galacticLayer.opacity;
  const galacticResidual = clamp(galacticBase + regionalBridge * 0.28, 0, 1);
  const referenceStrength =
    smoothstep(0.22, 0.48, t) *
    (1 - smoothstep(0.78, 0.94, t)) *
    model.metricLayerOpacity *
    (0.34 + regionalBridge * 0.62);
  const exposure = clamp(
    0.86 +
      galacticResidual * 0.10 +
      regionalBridge * 0.16 +
      model.celestialBackdropPresence * 0.05 -
      localSurface * 0.08,
    0.76,
    1.12
  );
  return {
    ...model,
    galacticResidual,
    regionalBridge,
    referenceStrength,
    localSurface,
    exposure
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

function starPosition(index) {
  if (!catalog || index < 0 || index >= catalog.count) return null;
  return {
    x: catalog.x[index],
    y: catalog.y[index],
    z: catalog.z[index]
  };
}

function nearScaleMagnification(scale, t = zoomT()) {
  const near = smoothstep(0.56, 1, t);
  return 1 + near * (clamp(0.42 / Math.max(scale, MIN_SCALE), 1, 7.5) - 1);
}

function localApproachForScaleModel(model) {
  return clamp(
    (1 - model.metricCatalogPresence) * 0.58 +
      model.localSystemPresence * 0.24 +
      model.surfacePresence * 0.18,
    0,
    1
  );
}

function backgroundContextScale(model) {
  return clamp(model.metricLayerOpacity, 0.04, 1);
}

function activeImpostorScale(surfacePresence) {
  return clamp(1 - smoothstep(0.18, 0.90, surfacePresence) * 0.88, 0.12, 1);
}

function starModelWorldRadius(index) {
  if (!catalog || index < 0 || index >= catalog.count) return 0.018;
  const size = clamp(catalog.size[index] / 1.7, 0.42, 2.8);
  const luminosity = clamp(Math.sqrt(catalog.lum[index] / 1.2), 0.72, 1.35);
  return 0.018 * Math.sqrt(size) * luminosity;
}

function surfaceScreenRadiusForScaleModel(model) {
  const maxRadius = Math.hypot(view.width, view.height) * 1.18;
  const radius = (Math.min(view.width, view.height) * 0.5) / model.surfaceViewRadiusStarR;
  return clamp(radius, 0, maxRadius);
}

function localSurfaceWorldRadiusForScreenRadius(radiusPx) {
  return (radiusPx / Math.max(1, view.height * 0.5)) * Math.max(camera.scale, MIN_SCALE);
}

function approachDistanceForStar(index) {
  if (!catalog || index < 0 || index >= catalog.count) return FOCUS_APPROACH_DISTANCE;
  return FOCUS_APPROACH_DISTANCE;
}

function endApproach() {
  approach.target = 0;
}

function cancelFocusFlight() {
  focusFlight.active = false;
  focusFlight.progress = 0;
  approach.progress = 0;
}

function startFocusFlight(index, distance) {
  const position = starPosition(index);
  if (!position) return;
  focusFlight.active = true;
  focusFlight.startedAt = performance.now();
  focusFlight.duration = FOCUS_FLIGHT_MS;
  focusFlight.fromDistance = camera.distance;
  focusFlight.toDistance = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  focusFlight.fromX = camera.targetX;
  focusFlight.fromY = camera.targetY;
  focusFlight.fromZ = camera.targetZ;
  focusFlight.toX = position.x;
  focusFlight.toY = position.y;
  focusFlight.toZ = position.z;
  focusFlight.progress = 0;
  camera.distanceTarget = focusFlight.toDistance;
  camera.scaleTarget = projectionScaleForDistance(camera.distanceTarget);
  camera.targetToX = position.x;
  camera.targetToY = position.y;
  camera.targetToZ = position.z;
  approach.index = index;
  approach.progress = 0;
  approach.target = 1;
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

function updateScreenCache(t, response) {
  const basis = cameraBasis();
  for (let row = 0; row < catalog.indexAtDraw.length; row += 1) {
    const index = catalog.indexAtDraw[row];
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    const alpha = starVisibility(index, t);
    const metricAlpha =
      index === pointer.active || index === pointer.hover
        ? alpha
        : alpha * (response?.metricLayerPickWeight ?? response?.metricCatalogPresence ?? 1);
    catalog.screenX[row] = p.x;
    catalog.screenY[row] = p.y;
    catalog.screenR[row] = Math.max(
      index === pointer.active ? 8 : 0,
      catalog.pick[index] * (0.72 + t * 0.58) * (index === pointer.active ? 1 : (response?.metricLayerPickWeight ?? 1))
    );
    catalog.screenA[row] =
      Math.abs(p.ndcX) < 1.2 && Math.abs(p.ndcY) < 1.2 ? metricAlpha : 0;
  }
}

function activeStarVisualMetrics(t, response) {
  if (!catalog || pointer.active < 0) {
    return {
      index: -1,
      p: { x: -1000, y: -1000, ndcX: 9, ndcY: 9 },
      impostorRadiusPx: 0,
      apparentRadiusPx: 0,
      sphereWorldRadius: 0,
      physicalSphereRadius: 0,
      sphereScreenRadius: 0,
      surfaceAlpha: 0,
      centerVisibility: 0,
      sphereVisibility: 0,
      localMapContext: 1,
      surfaceViewRadiusStarR: 7.5
    };
  }

  const index = pointer.active;
  const p = project(catalog.x[index], catalog.y[index], catalog.z[index]);
  const physicalSphereRadius = starModelWorldRadius(index);
  const bridgePresence = response.regionalBridge * smoothstep(0.16, 0.86, catalog.importance[index]);
  const baseImpostorRadiusPx =
    catalog.size[index] *
    (1.05 + response.mapDepth * 2.2) *
    (0.65 + catalog.importance[index] * 1.7) *
    2.25 *
    (1 + bridgePresence * 0.72);
  const localMagnification = nearScaleMagnification(camera.scale, response.mapDepth);
  const centerVisibility = clamp(1.18 - Math.hypot(p.ndcX, p.ndcY) * 0.48, 0, 1);
  const sphereScreenRadius = surfaceScreenRadiusForScaleModel(response);
  const sphereWorldRadius = localSurfaceWorldRadiusForScreenRadius(sphereScreenRadius);
  const apparentRadiusPx = sphereScreenRadius;
  const localApproach = localApproachForScaleModel(response);
  const contextScale = backgroundContextScale(response);
  const impostorScale = activeImpostorScale(response.surfacePresence);
  const impostorRadiusPx =
    baseImpostorRadiusPx *
    (1 + (localMagnification - 1) * (0.22 + catalog.importance[index] * 0.78)) *
    impostorScale;
  const surfaceAlpha =
    response.surfacePresence *
    centerVisibility;
  const sphereVisibility =
    surfaceAlpha *
    smoothstep(54, 95, sphereScreenRadius) *
    centerVisibility;
  const localMapContext = clamp(response.metricLayerOpacity ?? response.metricCatalogPresence, 0, 1);
  return {
    index,
    p,
    impostorRadiusPx,
    apparentRadiusPx,
    sphereWorldRadius,
    physicalSphereRadius,
    sphereScreenRadius,
    localApproach,
    contextScale,
    activeImpostorScale: impostorScale,
    surfaceAlpha,
    centerVisibility,
    sphereVisibility,
    localMapContext,
    surfaceViewRadiusStarR: response.surfaceViewRadiusStarR
  };
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
  const sphereModule = device.createShaderModule({ code: SPHERE_SHADER });
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
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "always"
    }
  });
  const spherePipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: sphereModule,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 32,
          stepMode: "vertex",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 12, format: "float32x3" },
            { shaderLocation: 2, offset: 24, format: "float32x2" }
          ]
        }
      ]
    },
    fragment: {
      module: sphereModule,
      entryPoint: "fragmentMain",
      targets: [
        {
          format,
          blend: {
            color: {
              operation: "add",
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha"
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
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less"
    }
  });
  const pipelineError = await device.popErrorScope();
  if (pipelineError) {
    throw new Error(`WebGPU pipeline error: ${pipelineError.message}`);
  }
  const uniformBuffer = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const sphereUniformBuffer = device.createBuffer({
    size: 176,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });
  const sphereBindGroup = device.createBindGroup({
    layout: spherePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: sphereUniformBuffer } }]
  });

  gpu = {
    adapter,
    device,
    context,
    format,
    pipeline,
    spherePipeline,
    uniformBuffer,
    sphereUniformBuffer,
    bindGroup,
    sphereBindGroup,
    starBuffer: null,
    dustBuffer: null,
    sphereBuffer: null,
    starCount: 0,
    dustCount: 0,
    sphereVertexCount: 0,
    sphereTriangleCount: 0,
    depthTexture: null,
    depthWidth: 0,
    depthHeight: 0,
    lastSphereDraw: 0,
    lastSphereVisibility: 0,
    checkedFrame: false,
    checkedSphereFrame: false,
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
  const sphereMesh = buildSphereMesh();
  gpu.starBuffer = createGpuBuffer(starInstances, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
  gpu.dustBuffer = createGpuBuffer(dust.instances, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
  gpu.sphereBuffer = createGpuBuffer(sphereMesh.vertices, GPUBufferUsage.VERTEX);
  gpu.starCount = catalog.indexAtDraw.length;
  gpu.dustCount = dust.count;
  gpu.sphereVertexCount = sphereMesh.vertexCount;
  gpu.sphereTriangleCount = sphereMesh.triangleCount;
}

function ensureDepthTexture() {
  if (!gpu) return null;
  const width = Math.max(1, view.pixelWidth);
  const height = Math.max(1, view.pixelHeight);
  if (gpu.depthTexture && gpu.depthWidth === width && gpu.depthHeight === height) {
    return gpu.depthTexture;
  }
  if (gpu.depthTexture && typeof gpu.depthTexture.destroy === "function") {
    gpu.depthTexture.destroy();
  }
  gpu.depthTexture = gpu.device.createTexture({
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });
  gpu.depthWidth = width;
  gpu.depthHeight = height;
  return gpu.depthTexture;
}

function uniformData(t, now, response) {
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
    response.surfacePresence || 0,
    response.exposure,
    response.regionalBridge,
    response.galacticResidual,
    1 - (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1),
    response.metricLayerPointScale ?? 1,
    response.metricLayerHaloScale ?? 1,
    response.metricLayerOpacity ?? 1,
    response.metricLayerPickWeight ?? 1
  ]);
}

function sphereUniformData(t, now, visual) {
  const basis = cameraBasis();
  const index = visual?.index === pointer.active ? pointer.active : -1;
  const valid = catalog && index >= 0 && index < catalog.count;
  const presence = valid ? visual.surfaceAlpha || 0 : 0;
  const phase = valid ? stellarPhase(index, now) : 0;
  const activity = valid ? stellarActivity(index) : 0;
  const seed = valid ? seededUnit(index * 19.91 + 0.73) : 0;
  const modelBasis = valid
    ? starModelBasis(index)
    : { xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1] };
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
    valid ? catalog.x[index] : 0,
    valid ? catalog.y[index] : 0,
    valid ? catalog.z[index] : 0,
    valid ? visual.sphereWorldRadius || starModelWorldRadius(index) : 0,
    valid ? catalog.r[index] : 1,
    valid ? catalog.g[index] : 1,
    valid ? catalog.b[index] : 1,
    presence,
    phase,
    valid ? catalog.lum[index] : 0,
    activity,
    valid ? visual.sphereScreenRadius || 0 : 0,
    view.aspect,
    view.pixelWidth,
    view.pixelHeight,
    seed,
    modelBasis.xAxis[0],
    modelBasis.xAxis[1],
    modelBasis.xAxis[2],
    0,
    modelBasis.yAxis[0],
    modelBasis.yAxis[1],
    modelBasis.yAxis[2],
    0,
    modelBasis.zAxis[0],
    modelBasis.zAxis[1],
    modelBasis.zAxis[2],
    0
  ]);
}

function renderScene(t, now, response, visual) {
  if (!gpu || gpu.status === "lost") return;
  const spherePresence = visual?.surfaceAlpha || 0;
  const shouldCheckFrame = !gpu.checkedFrame || (!gpu.checkedSphereFrame && spherePresence > 0.003);
  if (shouldCheckFrame) {
    gpu.device.pushErrorScope("validation");
  }
  gpu.device.queue.writeBuffer(gpu.uniformBuffer, 0, uniformData(t, now, response));
  const shouldDrawSphere =
    gpu.sphereBuffer && gpu.sphereVertexCount > 0 && pointer.active >= 0 && spherePresence > 0.003;
  gpu.lastSphereDraw = shouldDrawSphere ? 1 : 0;
  gpu.lastSphereVisibility = visual?.sphereVisibility || 0;
  if (shouldDrawSphere) {
    gpu.device.queue.writeBuffer(gpu.sphereUniformBuffer, 0, sphereUniformData(t, now, visual));
  }
  const encoder = gpu.device.createCommandEncoder();
  const textureView = gpu.context.getCurrentTexture().createView();
  const depthTexture = ensureDepthTexture();
  const starPass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.003, g: 0.009, b: 0.021, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "discard"
    }
  });
  starPass.setPipeline(gpu.pipeline);
  starPass.setBindGroup(0, gpu.bindGroup);
  starPass.setVertexBuffer(0, gpu.dustBuffer);
  starPass.draw(6, gpu.dustCount);
  starPass.setVertexBuffer(0, gpu.starBuffer);
  starPass.draw(6, gpu.starCount);
  if (shouldDrawSphere) {
    starPass.setPipeline(gpu.spherePipeline);
    starPass.setBindGroup(0, gpu.sphereBindGroup);
    starPass.setVertexBuffer(0, gpu.sphereBuffer);
    starPass.draw(gpu.sphereVertexCount);
  }
  starPass.end();

  gpu.device.queue.submit([encoder.finish()]);
  if (shouldCheckFrame) {
    gpu.device.popErrorScope().then((error) => {
      if (error) {
        post("error", { message: `WebGPU validation error: ${error.message}` });
        return;
      }
      gpu.checkedFrame = true;
      if (spherePresence > 0.003) {
        gpu.checkedSphereFrame = true;
      }
    });
  }
}

function clearOverlay() {
  labelContext.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  labelContext.clearRect(0, 0, view.width, view.height);
}

function drawDarkLanes(t, response) {
  const alpha =
    response.galacticResidual *
    (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1) *
    (1 - response.localSurface * 0.78) *
    (1 - (response.surfacePresence || 0) * 0.86);
  if (alpha < 0.01) return;
  const basis = cameraBasis();
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
    labelContext.strokeStyle = `rgba(0, 2, 9, ${0.052 * alpha * (1 - t * 0.28)})`;
    labelContext.lineWidth = mix(5, 11, arm / 4);
    labelContext.stroke();
  }
  labelContext.restore();
}

function drawCatalogDensity(t, response) {
  const contextScale = response.contextScale || 1;
  const alpha =
    (response.galacticResidual * 0.46 + response.regionalBridge * 0.22) *
    (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1) *
    (1 - response.localSurface * 0.38) *
    (1 - (response.localApproach || response.surfacePresence || 0) * 0.58);
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
    const radius =
      mix(1.1, 4.8, clamp(core * 0.6 + importance * 0.55, 0, 1)) *
      (1 - t * 0.24 + response.regionalBridge * 0.14) *
      contextScale;
    const glow =
      clamp(0.02 + core * 0.074 + importance * 0.044, 0.014, 0.13) *
      alpha *
      mix(0.56, 1, contextScale) *
      response.exposure;
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

function drawGalacticVeil(t, response) {
  const alpha =
    (response.galacticResidual * 0.70 + response.regionalBridge * 0.20) *
    (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1) *
    (1 - response.localSurface * 0.44) *
    (1 - (response.surfacePresence || 0) * 0.62);
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
    labelContext.lineWidth = mix(24, 42, arm / 4) * (1 - t * 0.24 + response.regionalBridge * 0.12);
    labelContext.stroke();
  }

  const core = project(0, 0, 0, basis);
  if (Math.abs(core.ndcX) < 1.2 && Math.abs(core.ndcY) < 1.2) {
    const coreRadius = Math.min(view.width, view.height) * 0.18 * (1 - t * 0.18);
    const glow = labelContext.createRadialGradient(
      core.x,
      core.y,
      0,
      core.x,
      core.y,
      coreRadius
    );
    glow.addColorStop(0, `rgba(255, 236, 205, ${0.055 * alpha})`);
    glow.addColorStop(0.48, `rgba(196, 218, 255, ${0.024 * alpha})`);
    glow.addColorStop(1, "rgba(196, 218, 255, 0)");
    labelContext.fillStyle = glow;
    labelContext.beginPath();
    labelContext.arc(core.x, core.y, coreRadius, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawReference(t, response) {
  const alpha = response.referenceStrength * (1 - (response.surfacePresence || 0) * 0.92);
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

function focusStar(index, distance = 1450, startApproach = false) {
  if (index < 0 || index >= catalog.count) return;
  pointer.active = index;
  if (startApproach) {
    startFocusFlight(index, distance);
  } else {
    cancelFocusFlight();
    camera.targetX = catalog.x[index];
    camera.targetY = catalog.y[index];
    camera.targetZ = catalog.z[index];
    camera.targetToX = catalog.x[index];
    camera.targetToY = catalog.y[index];
    camera.targetToZ = catalog.z[index];
    camera.distance = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
    camera.distanceTarget = camera.distance;
    updateDerivedScale();
    approach.index = index;
    endApproach();
  }
  camera.lastInteraction = performance.now();
  labels.lastSelectAt = 0;
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function stellarActivity(index) {
  if (!catalog || index < 0 || index >= catalog.count) return 0;
  const luminosity = clamp(Math.log2(1 + catalog.lum[index]) / 3.2, 0, 1);
  const colorHeat = clamp((catalog.b[index] - catalog.r[index] + 0.68) / 1.42, 0, 1);
  const seed = seededUnit(index * 17.13 + 4.7);
  return clamp(0.30 + luminosity * 0.36 + colorHeat * 0.18 + seed * 0.24, 0.22, 1);
}

function stellarPhase(index, now) {
  if (index < 0) return 0;
  const seed = seededUnit(index * 23.7 + 1.11);
  const speed = mix(0.007, 0.018, seed);
  return (seed + now * 0.001 * speed) % 1;
}

function localReferenceStrength(response, visual) {
  const surface = visual?.surfaceAlpha || 0;
  const radius = visual?.sphereScreenRadius || 0;
  const surfaceReference =
    surface * smoothstep(0.18, 0.42, surface) * smoothstep(90, 260, radius);
  const systemReference =
    (response?.localSystemPresence || 0) *
    (1 - smoothstep(0.36, 0.86, response?.surfacePresence || 0));
  return clamp(Math.max(surfaceReference, systemReference * 0.72), 0, 1);
}

function isNamedStar(index) {
  return !String(catalog.name[index] || "").startsWith("NS ");
}

function bridgeCandidates(basis) {
  if (!catalog) return [];
  const active = pointer.active;
  const limit = Math.min(catalog.indexAtDraw.length, catalog.budget.key === "safe" ? 900 : 1400);
  const candidates = [];
  for (let row = 0; row < limit; row += 1) {
    const index = catalog.indexAtDraw[row];
    if (index === active) continue;
    const p = project(catalog.x[index], catalog.y[index], catalog.z[index], basis);
    if (Math.abs(p.ndcX) > 1.14 || Math.abs(p.ndcY) > 1.14) continue;

    const center = clamp(1.12 - Math.hypot(p.ndcX, p.ndcY) * 0.62, 0, 1);
    let nearActive = 0;
    if (active >= 0) {
      const distance = Math.hypot(
        catalog.x[index] - catalog.x[active],
        catalog.y[index] - catalog.y[active],
        catalog.z[index] - catalog.z[active]
      );
      nearActive = 1 / (1 + distance * 0.72);
    }
    const named = isNamedStar(index) ? 0.34 : 0;
    const score =
      catalog.label[index] * 0.88 +
      catalog.importance[index] * 0.54 +
      center * 0.26 +
      nearActive * 1.08 +
      named;
    if (score < 0.22) continue;
    candidates.push({ index, p, score, nearActive });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 28);
}

function drawBridgeRings(index, basis, bridge, t) {
  if (index < 0) return;
  const alpha = bridge * (1 - smoothstep(0.72, 0.88, t));
  if (alpha < 0.01) return;
  const origin = {
    x: catalog.x[index],
    y: catalog.y[index],
    z: catalog.z[index]
  };
  labelContext.save();
  labelContext.setLineDash([2, 10]);
  labelContext.lineWidth = 1;
  labelContext.strokeStyle = `rgba(150, 190, 236, ${0.11 * alpha})`;
  for (const baseRadius of [0.42, 0.92, 1.68]) {
    const radius = baseRadius * (0.9 + t * 0.8);
    labelContext.beginPath();
    let started = false;
    for (let i = 0; i <= 160; i += 1) {
      const angle = (i / 160) * TWO_PI;
      const p = project(
        origin.x + Math.cos(angle) * radius,
        origin.y + Math.sin(angle) * radius,
        origin.z,
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
    labelContext.stroke();
  }
  labelContext.restore();
}

function drawBridgeHalo(index, p, bridge, active = false, radiusCeiling = Infinity) {
  const importance = catalog.importance[index];
  let radius = active
    ? mix(46, 106, bridge) * (0.82 + importance * 0.58)
    : mix(15, 44, clamp(importance * 1.1, 0, 1)) * (0.75 + bridge * 0.52);
  if (Number.isFinite(radiusCeiling)) radius = Math.min(radius, radiusCeiling);
  const alpha = bridge * (active ? 0.24 : 0.06 + importance * 0.08);
  if (alpha < 0.006) return;
  const r = catalog.r[index];
  const g = catalog.g[index];
  const b = catalog.b[index];
  const halo = labelContext.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
  halo.addColorStop(
    0,
    cssRgba(mix(r, 1, 0.45), mix(g, 0.96, 0.32), mix(b, 0.88, 0.18), alpha)
  );
  halo.addColorStop(0.34, cssRgba(r, g, b, alpha * 0.32));
  halo.addColorStop(1, cssRgba(r, g, b, 0));
  labelContext.fillStyle = halo;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, radius, 0, TWO_PI);
  labelContext.fill();
}

function drawRegionalBridge(response, t, now, visual) {
  const bridge =
    response.regionalBridge *
    (1 - response.localSurface * 0.18) *
    (1 - (visual?.sphereVisibility || visual?.surfaceAlpha || 0) * 0.95);
  if (bridge < 0.01 || pointer.active < 0) return;

  const basis = cameraBasis();
  const active = pointer.active;
  const activeP = project(catalog.x[active], catalog.y[active], catalog.z[active], basis);
  const activeVisible = Math.abs(activeP.ndcX) < 1.18 && Math.abs(activeP.ndcY) < 1.18;
  const candidates = bridgeCandidates(basis);
  const pulse = 0.94 + Math.sin(now * 0.0018 + active * 0.19) * 0.06;

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  if (activeVisible) {
    const radiusCeiling =
      visual && visual.index === active ? Math.max(42, visual.apparentRadiusPx * 2.6) : Infinity;
    drawBridgeHalo(active, activeP, bridge * pulse, true, radiusCeiling);
  }

  let lineCount = 0;
  for (const candidate of candidates) {
    const screenDistance = Math.hypot(candidate.p.x - activeP.x, candidate.p.y - activeP.y);
    const distanceFade = 1 - smoothstep(280, 900, screenDistance);
    const lineAlpha = bridge * distanceFade * (0.014 + candidate.nearActive * 0.065);
    if (activeVisible && lineCount < 12 && lineAlpha > 0.008) {
      labelContext.strokeStyle = `rgba(130, 180, 238, ${lineAlpha})`;
      labelContext.lineWidth = 0.8 + candidate.nearActive * 0.9;
      labelContext.beginPath();
      labelContext.moveTo(activeP.x, activeP.y);
      labelContext.lineTo(candidate.p.x, candidate.p.y);
      labelContext.stroke();
      lineCount += 1;
    }
    drawBridgeHalo(candidate.index, candidate.p, bridge, false);
  }
  labelContext.restore();

  drawBridgeRings(active, basis, bridge, t);
}

function drawCelestialBackdrop(response, now) {
  const presence = response.celestialBackdropPresence || 0;
  if (presence < 0.01 || pointer.active < 0) return;

  const basis = cameraBasis();
  const active = pointer.active;
  const origin = [catalog.x[active], catalog.y[active], catalog.z[active]];
  const limit = Math.min(catalog.indexAtDraw.length, catalog.budget.key === "safe" ? 520 : 920);
  const stride = Math.max(1, Math.floor(catalog.indexAtDraw.length / limit));
  const twinkle = 0.88 + Math.sin(now * 0.0014 + active * 0.11) * 0.05;

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  for (let row = 0; row < catalog.indexAtDraw.length; row += stride) {
    const index = catalog.indexAtDraw[row];
    if (index === active) continue;
    const dir = normalizeVector([
      catalog.x[index] - origin[0],
      catalog.y[index] - origin[1],
      catalog.z[index] - origin[2]
    ]);
    const viewX = dot(dir, basis.right);
    const viewY = dot(dir, basis.up);
    const viewZ = dot(dir, basis.forward);
    if (viewZ < -0.18) continue;
    const edge = 1 - smoothstep(0.84, 1.08, Math.hypot(viewX, viewY));
    if (edge <= 0) continue;
    const x = (0.5 + viewX * 0.47) * view.width;
    const y = (0.5 - viewY * 0.47) * view.height;
    if (x < -8 || x > view.width + 8 || y < -8 || y > view.height + 8) continue;
    const importance = catalog.importance[index];
    const radius = mix(0.45, 1.55, clamp(importance * 1.18, 0, 1));
    const alpha =
      presence *
      edge *
      twinkle *
      mix(0.010, 0.046, clamp(catalog.lum[index] / 2.15, 0, 1)) *
      (0.72 + response.surfacePresence * 0.18);
    if (alpha < 0.003) continue;
    const gradient = labelContext.createRadialGradient(x, y, 0, x, y, radius * 4.6);
    gradient.addColorStop(
      0,
      cssRgba(
        mix(catalog.r[index], 1, 0.24),
        mix(catalog.g[index], 0.96, 0.18),
        mix(catalog.b[index], 0.90, 0.16),
        alpha
      )
    );
    gradient.addColorStop(1, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], 0));
    labelContext.fillStyle = gradient;
    labelContext.beginPath();
    labelContext.arc(x, y, radius * 4.6, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawLocalSystemShell(response, visual, now) {
  const presence = response.localSystemPresence || 0;
  if (presence < 0.01 || pointer.active < 0 || visual?.index !== pointer.active) return;
  const p = visual.p;
  if (Math.abs(p.ndcX) > 1.35 || Math.abs(p.ndcY) > 1.35) return;

  const index = pointer.active;
  const phase = stellarPhase(index, now) * TWO_PI;
  const surfaceFade = 1 - smoothstep(0.28, 0.86, response.surfacePresence || 0);
  const visible = presence * surfaceFade;
  if (visible < 0.01) return;

  const baseRadius = Math.min(view.width, view.height) * mix(0.18, 0.38, presence);
  const tilt = mix(-0.48, 0.48, seededUnit(index * 8.77 + 0.39));
  const r = catalog.r[index];
  const g = catalog.g[index];
  const b = catalog.b[index];

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  const shellRadius = baseRadius * 1.45;
  const glow = labelContext.createRadialGradient(p.x, p.y, baseRadius * 0.12, p.x, p.y, shellRadius);
  glow.addColorStop(0, cssRgba(mix(r, 1, 0.36), mix(g, 0.94, 0.25), mix(b, 0.86, 0.20), 0.030 * visible));
  glow.addColorStop(0.52, cssRgba(r, g, b, 0.018 * visible));
  glow.addColorStop(1, cssRgba(r, g, b, 0));
  labelContext.fillStyle = glow;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, shellRadius, 0, TWO_PI);
  labelContext.fill();

  labelContext.setLineDash([2, 15]);
  labelContext.lineCap = "round";
  for (const scale of [0.78, 1.18, 1.72]) {
    const ring = baseRadius * scale;
    labelContext.strokeStyle = `rgba(142, 183, 236, ${visible * mix(0.085, 0.030, (scale - 0.78) / 0.94)})`;
    labelContext.lineWidth = 0.9;
    labelContext.beginPath();
    labelContext.ellipse(p.x, p.y, ring, ring * 0.58, tilt, phase * 0.04, phase * 0.04 + TWO_PI);
    labelContext.stroke();
  }

  labelContext.setLineDash([]);
  labelContext.strokeStyle = `rgba(200, 225, 255, ${0.075 * visible})`;
  labelContext.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const angle = phase * 0.18 + (i / 8) * TWO_PI;
    const inner = baseRadius * 1.02;
    const outer = baseRadius * 1.12;
    labelContext.beginPath();
    labelContext.moveTo(p.x + Math.cos(angle) * inner, p.y + Math.sin(angle) * inner * 0.58);
    labelContext.lineTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer * 0.58);
    labelContext.stroke();
  }
  labelContext.restore();
}

function drawLocalAtmosphere(t, now, response, visual) {
  const surface = visual?.surfaceAlpha || 0;
  if (surface < 0.006 || pointer.active < 0 || visual?.index !== pointer.active) return;

  const index = pointer.active;
  const p = visual.p;
  const visible = surface;
  if (visible < 0.006) return;

  const maxRadius = Math.min(view.width, view.height) * 1.28;
  const radius = clamp(visual.apparentRadiusPx, 0, maxRadius);
  if (radius < 2) return;
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
  const phase = stellarPhase(index, now) * TWO_PI;
  const activity = stellarActivity(index);
  const pulse = 0.96 + Math.sin(phase * 1.7 + index * 0.37) * 0.04;
  const viewportRadius = Math.hypot(view.width, view.height);
  const minDimension = Math.min(view.width, view.height);
  const detailFade =
    smoothstep(28, 180, radius) *
    (1 - smoothstep(minDimension * 0.68, minDimension * 1.05, radius));
  const environmentDim = smoothstep(minDimension * 0.22, minDimension * 0.72, radius) * visible;

  labelContext.save();
  if (environmentDim > 0.006) {
    labelContext.fillStyle = `rgba(0, 2, 8, ${0.14 * environmentDim})`;
    labelContext.fillRect(0, 0, view.width, view.height);
  }

  const bodyAlpha = visible * smoothstep(64, 180, radius) * (0.48 + detailFade * 0.22);
  if (bodyAlpha > 0.01) {
    const highlightX = p.x - radius * 0.18;
    const highlightY = p.y - radius * 0.22;
    const body = labelContext.createRadialGradient(
      highlightX,
      highlightY,
      radius * 0.08,
      p.x,
      p.y,
      radius * 1.02
    );
    body.addColorStop(
      0,
      cssRgba(mix(r, 1, 0.72), mix(g, 0.98, 0.58), mix(b, 0.82, 0.36), 0.74 * bodyAlpha)
    );
    body.addColorStop(
      0.42,
      cssRgba(mix(r, 1, 0.34), mix(g, 0.94, 0.24), mix(b, 0.78, 0.16), 0.50 * bodyAlpha)
    );
    body.addColorStop(1, cssRgba(r * 0.54, g * 0.58, b * 0.72, 0.24 * bodyAlpha));

    labelContext.save();
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, radius, 0, TWO_PI);
    labelContext.clip();
    labelContext.globalCompositeOperation = "source-over";
    labelContext.fillStyle = body;
    labelContext.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);

    for (let i = 0; i < 24; i += 1) {
      const angle = seededUnit(index * 21.7 + i * 5.3) * TWO_PI + phase * mix(0.04, 0.18, seededUnit(index + i));
      const band = mix(0.08, 0.86, seededUnit(index * 22.7 + i * 7.3));
      const x = p.x + Math.cos(angle) * radius * band;
      const y = p.y + Math.sin(angle) * radius * band * 0.82;
      const spot = radius * mix(0.018, 0.085, seededUnit(index * 23.7 + i * 3.3));
      labelContext.fillStyle =
        i % 3 === 0
          ? `rgba(3, 7, 16, ${bodyAlpha * mix(0.045, 0.12, seededUnit(index * 24.7 + i))})`
          : cssRgba(
              mix(r, 1, 0.48),
              mix(g, 0.94, 0.32),
              mix(b, 0.78, 0.22),
              bodyAlpha * mix(0.028, 0.082, seededUnit(index * 25.7 + i))
            );
      labelContext.beginPath();
      labelContext.ellipse(x, y, spot * mix(1.4, 3.6, seededUnit(index * 26.7 + i)), spot, angle, 0, TWO_PI);
      labelContext.fill();
    }

    labelContext.globalCompositeOperation = "lighter";
    labelContext.strokeStyle = cssRgba(mix(r, 1, 0.54), mix(g, 0.94, 0.36), mix(b, 0.82, 0.24), 0.16 * bodyAlpha);
    labelContext.lineWidth = Math.max(1, radius * 0.008);
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, radius * 0.985, 0, TWO_PI);
    labelContext.stroke();
    labelContext.restore();
  }

  labelContext.globalCompositeOperation = "lighter";
  const haloRadius = Math.min(radius * mix(2.1, 3.3, detailFade), viewportRadius * 1.18);
  const outer = labelContext.createRadialGradient(p.x, p.y, radius * 0.2, p.x, p.y, haloRadius);
  outer.addColorStop(0, cssRgba(mix(r, 1, 0.48), mix(g, 0.96, 0.42), mix(b, 0.86, 0.38), 0.12 * visible));
  outer.addColorStop(0.28, cssRgba(r, g, b, 0.055 * visible));
  outer.addColorStop(1, cssRgba(r, g, b, 0));
  labelContext.fillStyle = outer;
  if (haloRadius > viewportRadius * 1.08) {
    labelContext.fillRect(0, 0, view.width, view.height);
  } else {
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, haloRadius, 0, TWO_PI);
    labelContext.fill();
  }

  const coronaCount = Math.round(mix(0, 18, detailFade));
  for (let i = 0; i < coronaCount; i += 1) {
    const start =
      seededUnit(index * 1.7 + i * 9.1) * TWO_PI +
      phase * mix(0.16, 0.48, seededUnit(index * 8.3 + i * 1.9));
    const span = mix(0.16, 0.72, seededUnit(index * 2.3 + i * 4.7));
    const orbit = radius * mix(1.08, 1.42, seededUnit(index * 3.1 + i * 5.9));
    labelContext.strokeStyle = cssRgba(
      mix(r, 1, 0.52),
      mix(g, 0.92, 0.36),
      mix(b, 0.72, 0.18),
      visible *
        detailFade *
        mix(0.035, 0.12 + activity * 0.035, seededUnit(index * 4.1 + i * 6.3))
    );
    labelContext.lineWidth = mix(0.8, 2.4, seededUnit(index * 5.1 + i * 7.1)) * pulse;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, orbit, start, start + span);
    labelContext.stroke();
  }

  const fieldArcCount = Math.round(mix(0, 7, detailFade) * (0.7 + activity * 0.5));
  labelContext.lineCap = "round";
  for (let i = 0; i < fieldArcCount; i += 1) {
    const base = seededUnit(index * 12.1 + i * 3.7) * TWO_PI + phase * 0.42;
    const span = mix(0.75, 1.65, seededUnit(index * 13.1 + i * 4.1));
    const a = base;
    const bAngle = base + span;
    const startR = radius * mix(0.78, 1.04, seededUnit(index * 14.1 + i));
    const endR = radius * mix(0.78, 1.04, seededUnit(index * 15.1 + i));
    const x1 = p.x + Math.cos(a) * startR;
    const y1 = p.y + Math.sin(a) * startR * 0.58;
    const x2 = p.x + Math.cos(bAngle) * endR;
    const y2 = p.y + Math.sin(bAngle) * endR * 0.58;
    const mid = (a + bAngle) * 0.5;
    const lift = radius * mix(1.26, 1.9, seededUnit(index * 16.1 + i));
    const cx = p.x + Math.cos(mid) * lift;
    const cy = p.y + Math.sin(mid) * lift * 0.52;
    labelContext.strokeStyle = cssRgba(
      mix(r, 1, 0.45),
      mix(g, 0.96, 0.32),
      mix(b, 0.84, 0.24),
      visible * detailFade * mix(0.025, 0.070, seededUnit(index * 17.1 + i)) * (0.65 + activity)
    );
    labelContext.lineWidth = mix(0.7, 1.6, seededUnit(index * 18.1 + i));
    labelContext.beginPath();
    labelContext.moveTo(x1, y1);
    labelContext.quadraticCurveTo(cx, cy, x2, y2);
    labelContext.stroke();
  }

  labelContext.restore();
}

function drawLocalReferenceFrame(response, visual, now) {
  const strength = localReferenceStrength(response, visual);
  if (strength < 0.01 || pointer.active < 0 || visual?.index !== pointer.active) return;

  const index = pointer.active;
  const p = visual.p;
  const radius = clamp(
    visual.sphereScreenRadius || 0,
    18,
    Math.hypot(view.width, view.height) * 1.16
  );
  if (radius < 18) return;

  const phase = stellarPhase(index, now) * TWO_PI;
  const tilt = mix(-0.52, 0.52, seededUnit(index * 6.41 + 0.2));
  const visible = strength * (1 - smoothstep(Math.min(view.width, view.height) * 0.94, Math.min(view.width, view.height) * 1.32, radius));
  if (visible < 0.01) return;

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  labelContext.lineCap = "round";
  labelContext.lineJoin = "round";

  const shellRadius = radius * 1.12;
  const shell = labelContext.createRadialGradient(p.x, p.y, radius * 0.72, p.x, p.y, shellRadius * 1.34);
  shell.addColorStop(0, "rgba(120, 170, 255, 0)");
  shell.addColorStop(0.52, `rgba(126, 174, 255, ${0.030 * visible})`);
  shell.addColorStop(1, "rgba(126, 174, 255, 0)");
  labelContext.fillStyle = shell;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, shellRadius * 1.34, 0, TWO_PI);
  labelContext.fill();

  labelContext.setLineDash([2, 16]);
  for (const scale of [1.18, 1.72, 2.45]) {
    const ring = radius * scale;
    labelContext.strokeStyle = `rgba(142, 178, 225, ${visible * mix(0.060, 0.022, (scale - 1.18) / 1.27)})`;
    labelContext.lineWidth = Math.max(0.7, Math.min(1.2, radius / 360));
    labelContext.beginPath();
    labelContext.ellipse(p.x, p.y, ring, ring * 0.62, tilt, 0, TWO_PI);
    labelContext.stroke();
  }

  labelContext.setLineDash([]);
  labelContext.strokeStyle = `rgba(190, 218, 255, ${0.092 * visible})`;
  labelContext.lineWidth = Math.max(0.8, Math.min(1.6, radius / 260));
  labelContext.beginPath();
  labelContext.ellipse(p.x, p.y, radius * 1.06, radius * 0.30, tilt, Math.PI * 0.04, Math.PI * 0.96);
  labelContext.stroke();
  labelContext.strokeStyle = `rgba(115, 152, 218, ${0.050 * visible})`;
  labelContext.beginPath();
  labelContext.ellipse(p.x, p.y, radius * 1.06, radius * 0.30, tilt, Math.PI * 1.04, Math.PI * 1.96);
  labelContext.stroke();

  const tickCount = 10;
  labelContext.strokeStyle = `rgba(190, 218, 255, ${0.065 * visible})`;
  labelContext.lineWidth = 0.8;
  for (let i = 0; i < tickCount; i += 1) {
    const a = phase + (i / tickCount) * TWO_PI;
    const inner = radius * 1.18;
    const outer = inner + Math.max(7, radius * 0.035);
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    labelContext.beginPath();
    labelContext.moveTo(p.x + cosA * inner, p.y + sinA * inner * 0.62);
    labelContext.lineTo(p.x + cosA * outer, p.y + sinA * outer * 0.62);
    labelContext.stroke();
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

function chooseLabels(now, t, lod, response) {
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
  if ((response?.metricLayerLabelWeight ?? response?.metricCatalogPresence ?? 1) <= 0.05) {
    labels.selected = chosen.filter((index) => index === pointer.active || index === pointer.hover);
    labels.lastSelectAt = now;
    labels.lastLod = lod.name;
    return;
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
    let namedA = 0;
    let namedB = 0;
    if ((lod.name === "Regional" || lod.name === "Local") && pointer.active >= 0) {
      nearA =
        1 /
        (1 +
          Math.hypot(
            catalog.x[a] - catalog.x[pointer.active],
            catalog.y[a] - catalog.y[pointer.active],
            catalog.z[a] - catalog.z[pointer.active]
          ) *
            (lod.name === "Regional" ? 0.72 : 1));
      nearB =
        1 /
        (1 +
          Math.hypot(
            catalog.x[b] - catalog.x[pointer.active],
            catalog.y[b] - catalog.y[pointer.active],
            catalog.z[b] - catalog.z[pointer.active]
          ) *
            (lod.name === "Regional" ? 0.72 : 1));
    }
    if (lod.name === "Regional") {
      namedA = isNamedStar(a) ? 0.36 : 0;
      namedB = isNamedStar(b) ? 0.36 : 0;
    }
    const scoreA =
      catalog.label[a] * 1.12 +
      centerA * 0.46 +
      starVisibility(a, t) * 0.24 +
      nearA * (lod.name === "Regional" ? 1.1 : 1) +
      namedA;
    const scoreB =
      catalog.label[b] * 1.12 +
      centerB * 0.46 +
      starVisibility(b, t) * 0.24 +
      nearB * (lod.name === "Regional" ? 1.1 : 1) +
      namedB;
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

function drawLabel(index, t, forced, occupied, visual, response) {
  const p = project(catalog.x[index], catalog.y[index], catalog.z[index]);
  const active = index === pointer.active;
  const hover = index === pointer.hover;
  const metricLabelWeight = response?.metricLayerLabelWeight ?? response?.metricCatalogPresence ?? 1;
  const metricPickWeight = response?.metricLayerPickWeight ?? response?.metricCatalogPresence ?? 1;
  if (!active && !hover && metricLabelWeight <= 0.05) return false;
  if (hover && !active && metricPickWeight <= 0.05) return false;
  const visible = starVisibility(index, t) * (active || hover ? 1 : metricLabelWeight);
  if (!forced && (visible < 0.08 || Math.abs(p.ndcX) > 1.04 || Math.abs(p.ndcY) > 1.04)) {
    return false;
  }
  const name = catalog.name[index];
  const surface = visual?.surfaceAlpha || 0;
  const localApproach = visual?.localApproach || surface;
  const size = clamp(10.3 + t * 1.7 + catalog.label[index] * 1.5 + (active ? 3 : hover ? 2 : 0) - surface * 1.2, 10.3, 16.8);
  labelContext.font = `${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const text = labelContext.measureText(name);
  let side = p.x < view.width * 0.72 ? 1 : -1;
  let textX = side > 0
    ? p.x + side * (12 + catalog.label[index] * 9)
    : p.x + side * (12 + catalog.label[index] * 9) - text.width;
  let textY = p.y - 7 - catalog.label[index] * 3;
  let leaderX = p.x;
  let leaderY = p.y;
  if (active && visual?.index === index && (visual.sphereScreenRadius || 0) > 120) {
    const radius = visual.sphereScreenRadius;
    side = p.x < view.width * 0.56 ? 1 : -1;
    const edgeDistance = Math.min(radius * 0.64, Math.max(80, radius * 0.48));
    const gap = clamp(radius * 0.16, 44, 120);
    leaderX = p.x + side * edgeDistance;
    leaderY = p.y - Math.min(radius * 0.10, 80);
    textX = side > 0
      ? Math.min(view.width - text.width - 16, leaderX + gap)
      : Math.max(16, leaderX - gap - text.width);
    textY = clamp(leaderY - clamp(radius * 0.10, 22, 64), size + 16, view.height - 18);
  }
  const rect = {
    x: textX - 4,
    y: textY - size - 4,
    w: text.width + 8,
    h: size + 9,
    index
  };
  if (!forced && occupied.some((item) => rectsOverlap(rect, item))) return false;

  const alpha = forced
    ? active
      ? 0.92
      : 0.82 * (1 - localApproach * 0.32)
    : clamp(visible * 0.7 + catalog.label[index] * 0.24, 0.2, 0.72) * (1 - localApproach * 0.74);
  labelContext.save();
  labelContext.globalAlpha = alpha;
  labelContext.lineWidth = 1;
  labelContext.strokeStyle = "rgba(205, 224, 255, 0.2)";
  labelContext.beginPath();
  labelContext.moveTo(leaderX, leaderY);
  labelContext.lineTo(side > 0 ? rect.x : rect.x + rect.w, rect.y + rect.h * 0.62);
  labelContext.stroke();
  labelContext.shadowColor = "rgba(0, 0, 0, 0.76)";
  labelContext.shadowBlur = 8;
  labelContext.fillStyle = active
    ? "rgba(244, 249, 255, 0.92)"
    : hover
      ? "rgba(224, 240, 255, 0.88)"
      : "rgba(202, 218, 239, 0.7)";
  labelContext.fillText(name, textX, textY);
  labelContext.restore();
  occupied.push(rect);
  labels.rects.push(rect);
  if (active) {
    labels.activeX = rect.x + rect.w * 0.5;
    labels.activeY = rect.y + rect.h * 0.5;
  }
  return true;
}

function drawLabels(t, lod, now, visual, response) {
  chooseLabels(now, t, lod, response);
  labels.rects = [];
  labels.activeX = -1000;
  labels.activeY = -1000;
  const occupied = [];
  if (pointer.active >= 0) drawLabel(pointer.active, t, true, occupied, visual, response);
  const allowMetricLabels = (response?.metricLayerLabelWeight ?? response?.metricCatalogPresence ?? 1) > 0.05;
  if (allowMetricLabels && pointer.hover >= 0 && pointer.hover !== pointer.active) {
    drawLabel(pointer.hover, t, true, occupied, visual, response);
  }
  if (allowMetricLabels) {
    for (const index of labels.selected) {
      if (index === pointer.active || index === pointer.hover) continue;
      drawLabel(index, t, false, occupied, visual, response);
    }
  }
  labels.count = labels.rects.length;
}

function drawOverlay(t, lod, now, response, visual) {
  clearOverlay();
  drawGalacticVeil(t, response);
  drawCatalogDensity(t, response);
  drawDarkLanes(t, response);
  drawRegionalBridge(response, t, now, visual);
  drawCelestialBackdrop(response, now);
  drawLocalSystemShell(response, visual, now);
  drawLocalAtmosphere(t, now, response, visual);
  drawLocalReferenceFrame(response, visual, now);
  drawReference(t, response);
  drawLabels(t, lod, now, visual, response);
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
  if (focusFlight.active) {
    const raw = clamp((now - focusFlight.startedAt) / focusFlight.duration, 0, 1);
    const eased = easeInOutCubic(raw);
    const fromLog = Math.log(Math.max(MIN_CAMERA_DISTANCE, focusFlight.fromDistance));
    const toLog = Math.log(Math.max(MIN_CAMERA_DISTANCE, focusFlight.toDistance));
    camera.distance = Math.exp(mix(fromLog, toLog, eased));
    camera.targetX = mix(focusFlight.fromX, focusFlight.toX, eased);
    camera.targetY = mix(focusFlight.fromY, focusFlight.toY, eased);
    camera.targetZ = mix(focusFlight.fromZ, focusFlight.toZ, eased);
    focusFlight.progress = eased;
    approach.progress = eased;
    if (raw >= 1) {
      focusFlight.active = false;
      focusFlight.progress = 1;
      camera.distance = focusFlight.toDistance;
      camera.targetX = focusFlight.toX;
      camera.targetY = focusFlight.toY;
      camera.targetZ = focusFlight.toZ;
      approach.progress = 0;
    }
  } else {
    const follow = 1 - (1 - CAMERA_DISTANCE_FOLLOW) ** (dt * 60);
    const distanceLog = Math.log(Math.max(MIN_CAMERA_DISTANCE, camera.distance));
    const targetDistanceLog = Math.log(Math.max(MIN_CAMERA_DISTANCE, camera.distanceTarget));
    camera.distance = Math.exp(distanceLog + (targetDistanceLog - distanceLog) * follow);
    if (Math.abs(targetDistanceLog - distanceLog) < 0.0008) {
      camera.distance = camera.distanceTarget;
    }
    camera.targetX += (camera.targetToX - camera.targetX) * follow;
    camera.targetY += (camera.targetToY - camera.targetY) * follow;
    camera.targetZ += (camera.targetToZ - camera.targetZ) * follow;
    focusFlight.progress = 0;
    approach.progress = 0;
  }
  updateDerivedScale();
}

function frame(now) {
  if (!initialized) return;
  const last = frame.last || now;
  const dt = clamp((now - last) / 1000, 0.001, 0.14);
  frame.last = now;
  updateCamera(now, dt);
  const model = scaleModelForDistance(camera.distance);
  const t = model.mapDepth;
  const lod = lodForScaleModel(model);
  const response = scaleResponse(model);
  updateScreenCache(t, response);
  const visual = activeStarVisualMetrics(t, response);
  response.surfacePresence = visual.surfaceAlpha;
  response.localApproach = visual.localApproach || 0;
  response.contextScale = visual.contextScale || 1;
  response.localReference = localReferenceStrength(response, visual);
  renderScene(t, now, response, visual);
  drawOverlay(t, lod, now, response, visual);

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
        zoomT: model.scaleDepth,
        scaleStage: model.scaleStage,
        scaleDepth: model.scaleDepth,
        scaleAxisProgress: model.scaleAxisProgress,
        scale: camera.scale,
        scaleTarget: camera.scaleTarget,
        cameraFov: cameraFovForDistance(camera.distance),
        distance: camera.distance,
        distanceTarget: camera.distanceTarget,
        catalog: catalog.count,
        draw: catalog.indexAtDraw.length,
        labels: labels.count,
        gpu: gpu?.status || "none",
        fps: metrics.fps,
        active: catalog.name[pointer.active] || "none",
        starModel: "sphere",
        stellarMaterial: "emissive",
        rotationPhase: pointer.active >= 0 ? stellarPhase(pointer.active, now) : 0,
        activity: pointer.active >= 0 ? stellarActivity(pointer.active) : 0,
        bridge: response.regionalBridge,
        exposure: response.exposure,
        localReference: response.localReference,
        localApproach: response.localApproach,
        metricCatalogPresence: response.metricCatalogPresence,
        metricLayerPresence: response.metricLayerPresence,
        metricLayerPointScale: response.metricLayerPointScale,
        metricLayerHaloScale: response.metricLayerHaloScale,
        metricLayerLabelWeight: response.metricLayerLabelWeight,
        metricLayerPickWeight: response.metricLayerPickWeight,
        metricLayerOpacity: response.metricLayerOpacity,
        galacticLayerPresence: response.galacticLayer.presence,
        galacticLayerPointScale: response.galacticLayer.pointScale,
        galacticLayerHaloScale: response.galacticLayer.haloScale,
        galacticLayerLabelWeight: response.galacticLayer.labelWeight,
        galacticLayerPickWeight: response.galacticLayer.pickWeight,
        regionalLayerPresence: response.regionalLayer.presence,
        regionalLayerPointScale: response.regionalLayer.pointScale,
        regionalLayerHaloScale: response.regionalLayer.haloScale,
        regionalLayerLabelWeight: response.regionalLayer.labelWeight,
        regionalLayerPickWeight: response.regionalLayer.pickWeight,
        localMapLayerPresence: response.localMapLayer.presence,
        localMapLayerPointScale: response.localMapLayer.pointScale,
        localMapLayerHaloScale: response.localMapLayer.haloScale,
        localMapLayerLabelWeight: response.localMapLayer.labelWeight,
        localMapLayerPickWeight: response.localMapLayer.pickWeight,
        localSystemLayerPresence: response.localSystemLayer.presence,
        localSystemLayerPointScale: response.localSystemLayer.pointScale,
        localSystemLayerHaloScale: response.localSystemLayer.haloScale,
        localSystemLayerLabelWeight: response.localSystemLayer.labelWeight,
        localSystemLayerPickWeight: response.localSystemLayer.pickWeight,
        surfaceLayerPresence: response.surfaceLayer.presence,
        surfaceLayerPointScale: response.surfaceLayer.pointScale,
        surfaceLayerHaloScale: response.surfaceLayer.haloScale,
        surfaceLayerLabelWeight: response.surfaceLayer.labelWeight,
        surfaceLayerPickWeight: response.surfaceLayer.pickWeight,
        celestialBackdropPresence: response.celestialBackdropPresence,
        localSystemPresence: response.localSystemPresence,
        surfaceViewRadiusStarR: visual.surfaceViewRadiusStarR,
        contextScale: response.contextScale,
        activeImpostorScale: visual.activeImpostorScale,
        approach: approach.progress,
        surface: visual.surfaceAlpha,
        surfacePresence: visual.surfaceAlpha,
        surfaceRadius: visual.apparentRadiusPx,
        sphereRadius: visual.physicalSphereRadius,
        sphereScreenRadius: visual.sphereScreenRadius,
        sphereTriangles: gpu?.sphereTriangleCount || 0,
        sphereDraw: gpu?.lastSphereDraw || 0,
        sphereVisibility: visual.sphereVisibility || 0,
        localMapContext: visual.localMapContext ?? 1,
        activeX: visual.p.x,
        activeY: visual.p.y,
        activeLabelX: labels.activeX,
        activeLabelY: labels.activeY
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
  if (gpu && gpu.depthTexture && (gpu.depthWidth !== view.pixelWidth || gpu.depthHeight !== view.pixelHeight)) {
    gpu.depthTexture.destroy();
    gpu.depthTexture = null;
    gpu.depthWidth = 0;
    gpu.depthHeight = 0;
  }
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
  cancelFocusFlight();
  const targetModel = scaleModelForDistance(camera.distanceTarget);
  const localSpeedScale = clamp(
    1 -
      (1 - targetModel.metricCatalogPresence) * 0.22 -
      targetModel.surfacePresence * 0.18,
    0.58,
    1
  );
  const speed = (message.ctrlKey ? WHEEL_ZOOM_SPEED_PRECISE : WHEEL_ZOOM_SPEED) * localSpeedScale;
  const delta = clamp(message.deltaY, -2400, 2400);
  const rawFactor = Math.exp(delta * speed);
  const factor = message.ctrlKey ? clamp(rawFactor, 0.58, 1.72) : clamp(rawFactor, 0.72, 1.38);
  const nextDistance = clamp(
    camera.distanceTarget * factor,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE
  );
  camera.distanceTarget = nextDistance;
  camera.scaleTarget = projectionScaleForDistance(camera.distanceTarget);
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
  approach.index = pointer.active;
  const focus = starPosition(pointer.active);
  if (focus) {
    camera.targetX = focus.x;
    camera.targetY = focus.y;
    camera.targetZ = focus.z;
    camera.targetToX = focus.x;
    camera.targetToY = focus.y;
    camera.targetToZ = focus.z;
  }
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
      focusStar(picked, approachDistanceForStar(picked), true);
    }
  }
};
