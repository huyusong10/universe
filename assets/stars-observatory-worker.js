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
const SURFACE_EMERGE_DISTANCE = 1250;
const SURFACE_FULL_DISTANCE = 30;
const SURFACE_STAGE_READINESS = 0.68;
const SURFACE_RADIUS_FULL = 0.86;
const SURFACE_READINESS_FULL = 0.86;
const ACTIVE_HANDOFF_START = 0.015;
const ACTIVE_HANDOFF_PRIMARY = 0.18;
const GALACTIC_REGIONAL_BLEND_START = 17000;
const GALACTIC_REGIONAL_BLEND_END = 26000;
const REGIONAL_LOCAL_BLEND_END = 6500;
const CATALOG_PROJECTION_FLOOR_DISTANCE = LOCAL_SYSTEM_DISTANCE;
const WHEEL_ZOOM_SPEED = 0.00078;
const WHEEL_ZOOM_SPEED_PRECISE = 0.00108;
const WHEEL_FRAME_DELTA_CAP = 900;
const WHEEL_ACTIVE_DECAY_MS = 220;
const CAMERA_DISTANCE_FOLLOW = 0.125;
const FOCUS_FLIGHT_MS = 1700;
const FOCUS_APPROACH_DISTANCE = 108;
const SPHERE_LAT_SEGMENTS = 48;
const SPHERE_LON_SEGMENTS = 96;

let sceneCanvas = null;
let labelCanvas = null;
let labelContext = null;
let gpu = null;
let catalog = null;
let dust = null;
let localSkyDome = null;
let stellarSurfaceSprite = null;
let stellarGlowSprite = null;
let photosphereMicrograinSprite = null;
let stellar02Assets = null;
let stellar02AssetsPromise = null;
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

const wheelInput = {
  deltaY: 0,
  ctrlKey: false,
  activeUntil: 0
};

const opticalSmoothing = {
  initialized: false,
  values: Object.create(null)
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
  let activeHandoff = smoother(0.015, 0.18, surfacePresence);
  let metricOpacity = clamp(u.layerOptics.z, 0.0, 1.0);
  let metricCoreVisibility = clamp(u.layerOptics.w, 0.0, 1.0);
  let surfaceContextFade = max(0.015, metricOpacity * (1.0 - backgroundRetreat * 0.54));
  let coreRetreat = smoother(0.08, 0.92, 1.0 - metricCoreVisibility);
  let starCoreContextFade = max(0.018, metricCoreVisibility * (1.0 - coreRetreat * 0.18));
  let mapContinuityCompensation = clamp(u.layerOptics.x, 0.0, 1.0);
  let dustVisibility = params.x * (0.48 + u.optics.z * 0.42 + u.optics.y * 0.20) * surfaceContextFade;
  var visibility = select(dustVisibility, starVisibilityValue, isStar);
  visibility = select(visibility, visibility * starCoreContextFade, isStar && !(isActive || hover));
  let activeForcedVisibility = max(visibility, 0.50 * (1.0 - activeHandoff) + 0.018);
  let hoverForcedVisibility = max(visibility, 0.86 * (1.0 - backgroundRetreat * 0.28));
  let forcedVisibility = select(select(visibility, hoverForcedVisibility, hover), activeForcedVisibility, isActive);
  var starRadius =
    params.y *
    max(0.88 + u.view.y * 1.72, 1.10 + mapContinuityCompensation * 0.50) *
    (0.65 + params.z * 1.7) *
    activeBoost *
    (1.0 + bridgePresence * 0.72);
  let nearScale = smoother(0.56, 1.0, u.view.y);
  let scaleMagnification = min(7.5, 0.42 / max(u.targetScale.w, 0.035));
  let localSizeLift = 1.0 + nearScale * (scaleMagnification - 1.0) * (0.22 + params.z * 0.78);
  let activeNearLift = select(1.0, 1.0 + nearScale * min(3.8, 0.30 / max(u.targetScale.w, 0.035)), isActive);
  starRadius = starRadius * localSizeLift * activeNearLift;
  let mapOpticalApproach =
    smoother(0.06, 0.30, u.view.y) *
    (1.0 - smoother(0.58, 0.78, u.view.y)) *
    metricCoreVisibility *
    (1.0 - backgroundRetreat) *
    mapContinuityCompensation;
  starRadius = starRadius * (1.0 + mapOpticalApproach * 0.42);
  let backgroundRadiusScale = max(0.055, 1.0 - backgroundRetreat * 0.945);
  let coreRadiusScale = max(0.16, 1.0 - coreRetreat * 0.84);
  let hoverRadiusScale = max(coreRadiusScale, 0.70);
  let activeCoreHandoff = smoother(0.045, 0.24, surfacePresence);
  let activeRadiusScale = max(0.035, 1.0 - activeCoreHandoff * 0.965);
  let radiusContextScale = select(select(coreRadiusScale, hoverRadiusScale, hover), activeRadiusScale, isActive);
  starRadius = starRadius * radiusContextScale;
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
  let core = exp(-d * d * 96.0);
  let psf = exp(-d * d * 22.0);
  let halo = exp(-d * d * 5.8);
  let outer = exp(-d * d * 2.1);
  let bridge = in.params.z * in.params.z * in.extra.y * 0.040 * u.optics.y;
  let activeHandoff = smoother(0.015, 0.18, clamp(u.interaction.w, 0.0, 1.0));
  let activeCoreHandoff = smoother(0.045, 0.24, clamp(u.interaction.w, 0.0, 1.0));
  let activeStar = isStar && abs(in.extra.x - u.interaction.x) < 0.5;
  let metricHaloScale = select(clamp(u.layerOptics.y, 0.0, 1.0), 1.0, activeStar);
  let metricCoreVisibility = select(clamp(u.layerOptics.w, 0.0, 1.0), 1.0, activeStar);
  let catalogExit = clamp(u.optics.w, 0.0, 1.0);
  let backgroundRetreat = smoother(0.08, 0.92, catalogExit);
  let mapContinuityCompensation = clamp(u.layerOptics.x, 0.0, 1.0);
  let mapOpticalApproach =
    smoother(0.06, 0.30, u.view.y) *
    (1.0 - smoother(0.58, 0.78, u.view.y)) *
    metricCoreVisibility *
    (1.0 - backgroundRetreat) *
    mapContinuityCompensation;
  let psfContinuity = max(metricHaloScale, metricCoreVisibility * 0.72);
  let activeCoreFade = select(1.0, max(0.08, 1.0 - activeCoreHandoff * 0.92), activeStar);
  let activeHaloFade = select(1.0, max(0.003, 1.0 - activeHandoff * 0.997), activeStar);
  let crowdEnergy = 0.76 - u.optics.y * 0.14 - u.optics.z * 0.05;
  let mapEnergyLift = 1.0 + mapOpticalApproach * 0.72;
  let starEnergy =
    in.alpha *
    (core * (1.08 + in.params.x * 0.28) * activeCoreFade +
      psf * (0.16 + in.params.z * 0.11) * mix(1.0, activeHaloFade, 0.64) * psfContinuity +
      halo * (0.026 + in.params.z * 0.030 + bridge) * activeHaloFade * metricHaloScale +
      outer * (0.004 + in.params.z * 0.007 + bridge * 0.22) * activeHaloFade * metricHaloScale) *
    u.optics.x *
    crowdEnergy *
    mapEnergyLift;
  let dustAlpha = in.alpha * exp(-d * d * 7.2) * (0.024 + u.optics.z * 0.016 + u.optics.y * 0.008);
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
  @location(4) worldNormal: vec3f,
};

@vertex
fn vertexMain(
  @location(0) unitPosition: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f
) -> VertexOut {
  let spin = u.params.x * 6.2831853;
  let spinC = cos(spin);
  let spinS = sin(spin);
  let spunUnit = vec3f(
    unitPosition.x * spinC - unitPosition.z * spinS,
    unitPosition.y,
    unitPosition.x * spinS + unitPosition.z * spinC
  );
  let worldNormal = normalize(
    spunUnit.x * u.modelX.xyz +
    spunUnit.y * u.modelY.xyz +
    spunUnit.z * u.modelZ.xyz
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
  out.uv = vec2f(fract(uv.x + u.params.x), uv.y);
  out.color = u.color.rgb;
  out.params = vec4f(u.color.a, u.params.x, u.params.y, u.params.z);
  out.worldNormal = worldNormal;
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

fn triplanarFbm(n: vec3f, scale: f32, offset: vec2f) -> f32 {
  let p = normalize(n);
  let rawWeights = pow(abs(p) + vec3f(0.0001), vec3f(4.0));
  let weights = rawWeights / max(dot(rawWeights, vec3f(1.0)), 0.0001);
  let yz = fbm(p.yz * scale + offset);
  let zx = fbm(p.zx * scale + offset * vec2f(1.43, 0.87) + vec2f(19.1, 3.7));
  let xy = fbm(p.xy * scale + offset * vec2f(0.79, 1.61) + vec2f(4.2, 23.9));
  return yz * weights.x + zx * weights.y + xy * weights.z;
}

fn plasmaSurface(uv: vec2f, normal: vec3f, phase: f32, seed: f32, activity: f32) -> vec4f {
  let spin = phase * 6.2831853;
  let c = cos(spin);
  let s = sin(spin);
  let spun = normalize(vec3f(
    normal.x * c - normal.z * s,
    normal.y,
    normal.x * s + normal.z * c
  ));
  let latitude = clamp(spun.y, -1.0, 1.0);
  let shear = sin(latitude * 3.14159265) * (0.030 + activity * 0.016);
  let sheared = normalize(vec3f(
    spun.x * cos(shear) - spun.z * sin(shear),
    spun.y,
    spun.x * sin(shear) + spun.z * cos(shear)
  ));
  let slowFlow = triplanarFbm(sheared, 12.0, vec2f(seed * 17.0, phase * 4.3));
  let convectiveNormal = normalize(sheared + vec3f(slowFlow * 0.003, -slowFlow * 0.002, slowFlow * 0.002));
  let superCells = triplanarFbm(convectiveNormal, 22.0, vec2f(seed * 13.0, phase * 3.2));
  let cells = triplanarFbm(convectiveNormal, 42.0, vec2f(seed * 29.0, phase * 7.4));
  let fineCells = triplanarFbm(convectiveNormal, 112.0, vec2f(seed * 53.0, phase * 12.5));
  let uvShear = sin((uv.y - 0.5) * 3.14159265) * (0.042 + activity * 0.018);
  let uvFlowA = vec2f(fract(uv.x + uvShear + phase * 0.18), uv.y + phase * 0.012);
  let uvFlowB = vec2f(fract(uv.x - phase * 0.11), uv.y + sin(phase * 6.2831853 + uv.x * 8.0) * 0.010);
  let uvCells = fbm(uvFlowA * vec2f(38.0, 20.0) + vec2f(seed * 21.0, phase * 5.2));
  let uvFine = fbm(uvFlowB * vec2f(104.0, 58.0) + vec2f(seed * 47.0, -phase * 9.5));
  let uvNetwork = pow(clamp(1.0 - abs(uvCells - 0.52) * 4.0, 0.0, 1.0), 1.18);
  let uvFilament = pow(clamp(1.0 - abs(uvFine - uvCells) * 3.2, 0.0, 1.0), 1.22);
  let convection = pow(clamp(1.0 - abs(superCells - 0.55) * 4.2, 0.0, 1.0), 1.35);
  let network = pow(clamp(1.0 - abs(cells - 0.52) * 4.2, 0.0, 1.0), 1.12);
  let filament = pow(clamp(1.0 - abs(fineCells - cells) * 3.1, 0.0, 1.0), 1.26);
  let band = sin((sheared.x + slowFlow * 0.05) * 42.0 + sheared.y * 18.0 + sheared.z * 31.0 + seed * 6.2) * 0.5 + 0.5;
  let magneticNet = pow(triplanarFbm(convectiveNormal, 24.0, vec2f(seed * 77.0, phase * 4.8)), 2.4);
  let activeRegions = clamp((magneticNet * 0.10 + filament * 0.12 + network * 0.06 + uvFilament * 0.10) * (0.14 + activity * 0.34), 0.0, 1.0);
  let spotField = triplanarFbm(convectiveNormal, 34.0, vec2f(seed * 101.0, -phase * 3.5));
  let darkSpots = smoothstep(0.997, 0.9997, spotField + magneticNet * 0.012) * (0.001 + activity * 0.003);
  let granulation = clamp(convection * 0.022 + cells * 0.045 + fineCells * 0.150 + network * 0.095 + filament * 0.250 + uvNetwork * 0.150 + uvFilament * 0.245 + band * 0.004, 0.0, 1.0);
  let faculae = clamp(network * 0.155 + filament * 0.275 + uvNetwork * 0.245 + uvFilament * 0.240 + magneticNet * 0.026 + convection * 0.014 + band * 0.004, 0.0, 1.0);
  return vec4f(granulation, faculae, activeRegions, darkSpots);
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
  let facing = clamp(abs(n.z), 0.0, 1.0);
  let limb = pow(facing, 0.34);
  let rim = pow(1.0 - facing, 1.12);
  let rimBroad = pow(1.0 - facing, 0.46);
  let rimBurn = pow(1.0 - facing, 5.4);
  let plasma = plasmaSurface(in.uv, normalize(in.worldNormal), phase, seed, activity);
  let hotTint = vec3f(1.0, 0.97, 0.78);
  let emberTint = vec3f(1.0, 0.66, 0.34);
  let whiteHeat = vec3f(1.0, 0.965, 0.76);
  let coolTint = vec3f(0.50, 0.64, 1.0);
  let colorTemperature = clamp((in.color.b - in.color.r) * 0.85 + 0.5, 0.0, 1.0);
  let thermalTint = mix(vec3f(1.0, 0.72, 0.34), coolTint, colorTemperature);
  let solarBias = 1.0 - smoothstep(1.14, 1.72, lum);
  let base = mix(mix(thermalTint, in.color, 0.12), vec3f(1.0, 0.86, 0.58), solarBias * 0.46);
  let limbEmissionBalance = mix(1.17, 1.10, limb);
  let faculae = pow(plasma.y, 1.45) * (0.16 + activity * 0.10);
  let granulation = (plasma.x - 0.50) * (0.006 + activity * 0.004);
  let darkLanes = pow(clamp((0.53 - plasma.x) * 1.20, 0.0, 1.0), 2.65) * (0.0008 + activity * 0.0007);
  let activeGlow = plasma.z * (0.060 + activity * 0.080 + lum * 0.006);
  let darkening = plasma.w * (0.0008 + activity * 0.0015) + darkLanes;
  let photosphere =
    mix(base, whiteHeat, 0.54) * (1.14 + plasma.x * 0.030 + faculae * 0.10 + granulation) +
    hotTint * (0.22 + faculae * 0.18 + activeGlow * 0.10 + rimBroad * 0.22) +
    emberTint * (plasma.x * 0.010 + activeGlow * 0.008);
  let body = photosphere * limbEmissionBalance * (1.16 + lum * 0.018) - mix(emberTint, base, 0.42) * darkening * 0.012;
  let edgeTint = mix(hotTint, vec3f(1.0, 0.88, 0.68), colorTemperature * 0.24);
  let chromosphereEmission = hotTint * pow(1.0 - facing, 5.8) * (0.86 + activity * 0.28);
  let edgeEmission =
    edgeTint * rim * (1.14 + activity * 0.30) +
    hotTint * rimBroad * (0.34 + activity * 0.08) +
    chromosphereEmission +
    whiteHeat * rimBurn * (0.68 + activity * 0.14) +
    vec3f(1.0, 0.62, 0.28) * pow(1.0 - facing, 10.4) * (0.32 + activity * 0.08);
  let grainEmission = mix(emberTint, hotTint, 0.78 + colorTemperature * 0.12) * pow(plasma.x, 2.12) * (0.20 + activity * 0.11);
  let basalEmission = mix(base, whiteHeat, 0.48) * (0.78 + lum * 0.018);
  let radiusAreaCompensation = mix(1.0, 0.84, smoothstep(180.0, 350.0, max(u.params.w, 0.0)));
  let presenceGain = mix(1.10, 1.34, smoothstep(0.02, 0.65, presence));
  let stellarFloor =
    mix(vec3f(1.0, 0.70, 0.28), vec3f(0.58, 0.72, 1.0), colorTemperature * 0.45) *
    (0.86 + limb * 0.18 + rimBroad * 0.74) *
    smoothstep(0.015, 0.24, presence);
  let photosphereFloor = mix(base, whiteHeat, 0.72) * (0.92 + rimBroad * 0.56) * smoothstep(0.02, 0.20, presence);
  let emitted = max((body + edgeEmission + basalEmission + grainEmission) * presenceGain * radiusAreaCompensation, max(stellarFloor, photosphereFloor));
  let cellularHeat = clamp(
    (plasma.y - 0.42) * 0.10 +
    (plasma.x - 0.50) * 0.030 +
    plasma.z * 0.060 -
    darkLanes * 0.02,
    -0.02,
    0.36
  );
  let convectiveHeat = smoothstep(0.06, 0.38, cellularHeat);
  let convectiveShadow = smoothstep(0.03, 0.08, -cellularHeat);
  let toneMapped = emitted / (vec3f(0.72) + emitted * 0.38);
  let warmGrade = mix(vec3f(1.10, 1.00, 0.86), vec3f(0.86, 0.94, 1.12), colorTemperature * 0.50);
  let tonalDetail = toneMapped * (1.0 + cellularHeat * 0.012 + faculae * 0.006);
  let spectralDetail =
    hotTint * (convectiveHeat * 0.008 + faculae * 0.006 + activeGlow * 0.006) +
    emberTint * (convectiveHeat * 0.003) +
    mix(emberTint, hotTint, 0.64) * (convectiveShadow * 0.002);
  let heatLift = whiteHeat * (0.84 + faculae * 0.012 + convectiveHeat * 0.010 + rimBroad * 0.58) * smoothstep(0.02, 0.36, presence);
  let photosphereBurn = mix(vec3f(1.0, 0.76, 0.36), vec3f(0.74, 0.86, 1.0), colorTemperature * 0.42);
  let photosphereBase = mix(photosphereBurn, whiteHeat, 0.66 + rimBroad * 0.16) *
    (1.05 + faculae * 0.010 + convectiveHeat * 0.006 + granulation * 0.050);
  let movingTexture =
    hotTint * (pow(plasma.y, 1.55) * 0.024 + pow(plasma.x, 2.0) * 0.010) +
    whiteHeat * (pow(plasma.z, 1.12) * 0.020 + faculae * 0.012);
  let color = clamp(
    photosphereBase +
      (tonalDetail * warmGrade + spectralDetail + stellarFloor * 0.16 + edgeEmission * 0.18) * 1.42 +
      heatLift +
      movingTexture,
    vec3f(0.88, 0.70, 0.44),
    vec3f(1.0)
  );
  let emissiveColor = max(
    color * (1.88 + rimBroad * 0.22) +
      whiteHeat * (0.28 + rimBroad * 0.20) +
      hotTint * (faculae * 0.052 + convectiveHeat * 0.030),
    vec3f(1.04, 0.84, 0.58)
  );
  let alpha = clamp(smoothstep(0.008, 0.20, presence) * (0.992 + rim * 0.008), 0.0, 1.0);
  return vec4f(emissiveColor, alpha);
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
  const solColor = tempToRgb(5778);
  data.r[solIndex] = solColor[0];
  data.g[solIndex] = solColor[1];
  data.b[solIndex] = solColor[2];
  data.lum[solIndex] = 1.0;
  data.size[solIndex] = 1.82;
  data.importance[solIndex] = 1;
  data.label[solIndex] = 1;
  data.pick[solIndex] = Math.max(data.pick[solIndex], 28);

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

function updateDerivedScale() {
  camera.scale = projectionScaleForDistance(camera.distance);
  camera.scaleTarget = projectionScaleForDistance(camera.distanceTarget);
}

function logDepthForDistance(distance, nearDistance, farDistance) {
  const minLog = Math.log(nearDistance);
  const maxLog = Math.log(farDistance);
  return clamp((maxLog - Math.log(clamp(distance, nearDistance, farDistance))) / (maxLog - minLog), 0, 1);
}

function semanticScaleAxisProgress(distance, surfaceReadiness) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  if (value < LOCAL_MAP_DISTANCE && surfaceReadiness >= SURFACE_STAGE_READINESS) {
    return mix(0.78, 1, surfaceReadiness);
  }
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
  return mix(0.78, 1, surfaceReadiness);
}

function activeStarClosenessForDistance(distance) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  return 1 - smoothstep(FOCUS_APPROACH_DISTANCE, LOCAL_MAP_DISTANCE, value);
}

function activeStarViewRadiusStarR(closeness, surfaceDepth = 0) {
  const localRadius = mix(
    Math.log(8.1),
    Math.log(5.15),
    smoothstep(0.04, 0.54, closeness)
  );
  const surfaceRadius = mix(
    Math.log(5.15),
    Math.log(3.02),
    smoothstep(0.54, 0.96, closeness)
  );
  const joinedRadius = mix(localRadius, surfaceRadius, smoothstep(0.50, 0.62, closeness));
  return Math.exp(mix(joinedRadius, Math.log(2.72), smoothstep(0.76, 1, closeness) * surfaceDepth * 0.82));
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

function haloSuppressionForOverlap(...overlaps) {
  const overlap = Math.max(0, ...overlaps);
  return mix(1, 0.54, smoothstep(0.05, 0.32, overlap));
}

function applyHaloSuppression(layer, ...overlaps) {
  layer.haloScale = clamp(layer.haloScale * haloSuppressionForOverlap(...overlaps), 0, 1);
  return layer;
}

function scaleStageForDistance(distance, surfaceReadiness = 0, localSystemPresence = 1, surfacePresence = 0, activeStarCloseness = 0) {
  if (distance >= GALACTIC_DISTANCE) return "Galactic";
  if (distance >= REGIONAL_DISTANCE) return "Regional";
  if (distance >= LOCAL_MAP_DISTANCE) return "LocalMap";
  if (localSystemPresence < 0.12 && surfacePresence < 0.18 && activeStarCloseness < 0.10) return "LocalMap";
  return surfaceReadiness >= SURFACE_STAGE_READINESS ? "Surface" : "LocalSystem";
}

function scaleModelForDistance(distance) {
  const value = clamp(distance, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const activeStarCloseness = activeStarClosenessForDistance(value);
  const surfacePresence = smoothstep(0.18, 0.98, activeStarCloseness);
  const surfaceReadiness = smoothstep(0.64, 0.88, activeStarCloseness);
  const surfacePrimaryPresence = smoothstep(0.72, 0.92, activeStarCloseness);
  const surfaceDepth =
    smoothstep(0.74, 1, activeStarCloseness) *
    logDepthForDistance(value, MIN_CAMERA_DISTANCE, LOCAL_SYSTEM_DISTANCE);
  const metricCatalogPresence = smoothstep(520, 1500, value);
  const celestialBackdropPresence = 1 - smoothstep(760, 1900, value);
  const localSystemPresence =
    smoothstep(0.05, 0.36, activeStarCloseness) *
    (1 - smoothstep(0.92, 1, activeStarCloseness) * 0.58);
  const scaleDepth = logDepthForDistance(value, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const mapDepth = logDepthForDistance(
    Math.max(value, LOCAL_MAP_DISTANCE),
    LOCAL_MAP_DISTANCE,
    MAX_CAMERA_DISTANCE
  );
  const regionalDepth = smoothstep(GALACTIC_DISTANCE, REGIONAL_DISTANCE, value);
  const surfaceViewRadiusStarR = activeStarViewRadiusStarR(activeStarCloseness, surfaceDepth);
  const scaleAxisProgress = semanticScaleAxisProgress(value, surfaceReadiness);
  const galacticLayerPresence = smoothstep(
    GALACTIC_REGIONAL_BLEND_START,
    GALACTIC_REGIONAL_BLEND_END,
    value
  );
  const galacticLayerPointCore = smoothstep(14000, 50000, value);
  const galacticLayerHaloCore = mix(
    0.68,
    1,
    smoothstep(GALACTIC_REGIONAL_BLEND_END, 52000, value)
  );
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
    smoothstep(1500, REGIONAL_LOCAL_BLEND_END, value);
  const regionalPointCore = smoothstep(2200, 9000, value);
  const regionalHaloCore =
    (1 - smoothstep(11000, 17000, value)) *
    smoothstep(2800, 9000, value);
  const regionalLayer = makeLayer(
    regionalLayerPresence,
    regionalLayerPresence * mix(0.14, 1, regionalPointCore),
    regionalLayerPresence * regionalHaloCore * 0.74,
    regionalLayerPresence,
    regionalLayerPresence,
    regionalLayerPresence
  );
  const localMapLayerPresence =
    (1 - smoothstep(REGIONAL_DISTANCE, REGIONAL_LOCAL_BLEND_END, value)) *
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
  const surfacePreviewRetreat = Math.max(
    surfacePrimaryPresence,
    smoothstep(0.72, 0.96, activeStarCloseness) * 0.72
  );
  const localSystemLayerPresence =
    localSystemPresence *
    (1 - smoothstep(0.58, 0.82, activeStarCloseness) * 0.94) *
    (1 - smoothstep(0.20, 0.82, surfacePreviewRetreat) * 0.18);
  const localSystemLayer = makeLayer(
    localSystemLayerPresence,
    localSystemLayerPresence,
    localSystemLayerPresence,
    localSystemLayerPresence * 0.18,
    0,
    localSystemLayerPresence
  );
  const surfaceLayer = makeLayer(
    surfacePrimaryPresence,
    surfacePrimaryPresence,
    surfacePrimaryPresence,
    surfacePrimaryPresence,
    0,
    surfacePrimaryPresence
  );
  const galacticRegionalOverlap = Math.min(galacticLayer.presence, regionalLayer.presence);
  const regionalLocalMapOverlap = Math.min(regionalLayer.presence, localMapLayer.presence);
  const localMapSystemOverlap = Math.min(localMapLayer.presence, localSystemLayer.presence);
  const localSystemSurfaceOverlap = Math.min(localSystemLayer.presence, surfaceLayer.presence);
  applyHaloSuppression(galacticLayer, galacticRegionalOverlap);
  applyHaloSuppression(regionalLayer, galacticRegionalOverlap, regionalLocalMapOverlap);
  applyHaloSuppression(localMapLayer, regionalLocalMapOverlap, localMapSystemOverlap);
  applyHaloSuppression(localSystemLayer, localMapSystemOverlap, localSystemSurfaceOverlap);
  applyHaloSuppression(surfaceLayer, localSystemSurfaceOverlap);
  const haloOverlapStrength = smoothstep(
    0.05,
    0.32,
    Math.max(
      galacticRegionalOverlap,
      regionalLocalMapOverlap,
      localMapSystemOverlap,
      localSystemSurfaceOverlap
    )
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
  const rawMetricLayerHaloScale = Math.max(
    galacticLayer.haloScale,
    regionalLayer.haloScale,
    localMapLayer.haloScale
  );
  const metricPsfContinuity =
    metricCatalogPresence *
    smoothstep(1600, 3200, value) *
    0.62;
  const metricLayerHaloScale = Math.max(rawMetricLayerHaloScale, metricPsfContinuity);
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
  const metricCoreVisibility = metricCatalogPresence;
  const metricCoreRadiusScale = mix(0.16, 1, smoothstep(0.08, 0.88, metricCoreVisibility));
  const localApproach = clamp((1 - metricLayerOpacity) * 0.54 + localSystemLayer.presence * 0.24 + surfacePrimaryPresence * 0.22, 0, 1);
  return {
    distance: value,
    scaleStage: scaleStageForDistance(value, surfaceReadiness, localSystemPresence, surfacePresence, activeStarCloseness),
    scaleDepth,
    scaleAxisProgress,
    mapDepth,
    regionalDepth,
    metricCatalogPresence,
    celestialBackdropPresence,
    activeStarCloseness,
    localSystemPresence,
    surfacePresence,
    surfaceReadiness,
    surfaceDepth,
    surfaceViewRadiusStarR,
    localApproach,
    galacticLayer,
    regionalLayer,
    localMapLayer,
    localSystemLayer,
    surfaceLayer,
    haloOverlapStrength,
    metricLayerPresence,
    metricLayerPointScale,
    metricLayerHaloScale,
    metricPsfContinuity,
    metricLayerLabelWeight,
    metricLayerPickWeight,
    metricLayerOpacity,
    metricCoreVisibility,
    metricCoreRadiusScale
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
  const regionalBridgePresence = model.regionalLayer.presence * (1 - model.surfacePresence);
  const localMapBridgeExit =
    model.localMapLayer.presence *
    smoothstep(620, 2600, model.distance) *
    (1 - smoothstep(0.18, 0.62, model.localSystemPresence));
  const preSystemAnchorPresence =
    (1 - smoothstep(1800, 3000, model.distance)) *
    smoothstep(420, 760, model.distance) *
    (1 - smoothstep(0.42, 0.88, model.localSystemPresence)) *
    0.68;
  const localMapBridgePresence =
    Math.max(localMapBridgeExit, preSystemAnchorPresence) *
    (1 - model.surfacePresence);
  const regionalBridge = regionalBridgePresence * 0.68;
  const localMapBridge = localMapBridgePresence * 0.46;
  const activeBridgeRetreat =
    (1 - smoothstep(0.56, 0.84, model.localSystemPresence)) *
    (1 - smoothstep(0.04, 0.18, model.surfacePresence));
  const activeBridgePresence = clamp(regionalBridge + localMapBridge, 0, 0.82) * activeBridgeRetreat;
  const galacticRetreat = 1 - model.galacticLayer.presence;
  const regionalTakeover = model.regionalLayer.presence;
  const preRegionalContinuity =
    model.galacticLayer.presence *
    (1 - smoothstep(0.03, 0.28, regionalTakeover)) *
    mix(0.32, 0.96, smoothstep(0.70, 0.80, model.galacticLayer.haloScale));
  const mapContinuityCompensation =
    clamp(
      preRegionalContinuity +
        smoothstep(0.08, 0.54, galacticRetreat) *
          (1 - smoothstep(0.76, 1.0, regionalTakeover)) *
          0.92,
      0,
      1
    ) * model.metricCatalogPresence;
  const regionalGlobalBridgeWindow = smoothstep(0.28, 0.88, galacticRetreat);
  const mapBridgeOpticalBudget = clamp(
    regionalBridge * mix(0.08, 0.18, regionalGlobalBridgeWindow) +
      localMapBridge * 0.56,
    0,
    0.34
  );
  const localSystemBridge = model.localSystemPresence * (1 - model.surfaceReadiness * 0.58);
  const localSurface = model.surfacePresence;
  const galacticBase = model.galacticLayer.opacity;
  const galacticResidual = clamp(galacticBase + regionalBridge * 0.28, 0, 1);
  const globalVeilPresence =
    model.distance >= REGIONAL_DISTANCE
      ? clamp(galacticResidual * 0.14 + regionalBridge * 0.060, 0, 1)
      : 0;
  const overlayHazeBudget = clamp(
    globalVeilPresence * 0.34 +
      galacticResidual * model.metricLayerOpacity * 0.035 +
      regionalBridge * 0.035 +
      localMapBridge * 0.018 +
      localSystemBridge * 0.055 * (1 - model.surfaceReadiness) +
      model.surfaceReadiness * 0.10,
    0,
    1
  );
  const starCoreExposure = clamp(
    0.945 - model.surfaceDepth * 0.018,
    0.91,
    0.955
  );
  const metricOverlayEnergy = clamp(
    0.86 +
      model.metricLayerOpacity * 0.08 -
      model.haloOverlapStrength * 0.045 -
      model.localApproach * 0.035,
    0.74,
    0.96
  );
  const backdropEnergy = clamp(
    0.92 +
      model.celestialBackdropPresence * 0.12 -
      model.surfaceDepth * 0.020,
    0.88,
    1.08
  );
  const localStructureEnergy = clamp(
    0.82 +
      model.localSystemLayer.presence * 0.10 +
      model.surfaceReadiness * 0.035 -
      model.surfaceDepth * 0.045,
    0.76,
    0.94
  );
  const surfaceOpticalEnergy = clamp(
    0.76 +
      model.surfaceReadiness * 0.09 +
      model.surfaceDepth * 0.035 -
      model.haloOverlapStrength * 0.035,
    0.72,
    0.88
  );
  const referenceStrength =
    smoothstep(0.22, 0.48, t) *
    (1 - smoothstep(0.78, 0.94, t)) *
    model.metricLayerOpacity *
    (0.34 + regionalBridge * 0.62);
  const exposure = starCoreExposure;
  return {
    ...model,
    galacticResidual,
    regionalBridge,
    regionalBridgePresence,
    localMapBridge,
    localMapBridgePresence,
    activeBridgePresence,
    mapContinuityCompensation,
    mapBridgeOpticalBudget,
    localSystemBridge,
    globalVeilPresence,
    overlayHazeBudget,
    starCoreExposure,
    metricOverlayEnergy,
    backdropEnergy,
    localStructureEnergy,
    surfaceOpticalEnergy,
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
  const metricExit = 1 - (model.metricLayerOpacity ?? model.metricCatalogPresence ?? 1);
  const systemPresence = model.localSystemLayer?.presence ?? model.localSystemPresence ?? 0;
  const surfaceReadiness = model.surfaceReadiness ?? model.surfacePresence ?? 0;
  return clamp(
    metricExit * 0.54 +
      systemPresence * 0.24 +
      surfaceReadiness * 0.22,
    0,
    1
  );
}

function backgroundContextScale(model) {
  return clamp(model.metricLayerOpacity, 0.04, 1);
}

function layerTransitionSpeedScale(model) {
  const strongestOverlap = Math.max(
    Math.min(model.galacticLayer.presence, model.regionalLayer.presence),
    Math.min(model.regionalLayer.presence, model.localMapLayer.presence),
    Math.min(model.localMapLayer.presence, model.localSystemLayer.presence),
    Math.min(model.localSystemLayer.presence, model.surfaceLayer.presence)
  );
  return mix(1, 0.85, smoothstep(0.05, 0.28, strongestOverlap));
}

function smoothTemporalValue(key, target, dt, halfLife) {
  const value = Number.isFinite(target) ? target : 0;
  if (!opticalSmoothing.initialized || !Number.isFinite(opticalSmoothing.values[key])) {
    opticalSmoothing.values[key] = value;
    return value;
  }
  const alpha = 1 - Math.pow(0.5, dt / Math.max(0.001, halfLife));
  const smoothed = opticalSmoothing.values[key] + (value - opticalSmoothing.values[key]) * alpha;
  opticalSmoothing.values[key] = smoothed;
  return smoothed;
}

function smoothOpticalResponse(response, dt, now) {
  const wheelActivity = clamp((wheelInput.activeUntil - now) / WHEEL_ACTIVE_DECAY_MS, 0, 1);
  const halfLife = mix(0.040, 0.105, wheelActivity);
  const dampOverlay = 1 - wheelActivity * 0.08;
  const dampBridge = 1 - wheelActivity * 0.10;
  const dampEnergy = 1 - wheelActivity * 0.025;

  for (const key of [
    "galacticResidual",
    "globalVeilPresence",
    "overlayHazeBudget",
    "metricOverlayEnergy",
    "backdropEnergy",
    "localStructureEnergy",
    "surfaceOpticalEnergy",
    "referenceStrength",
    "mapContinuityCompensation",
    "mapBridgeOpticalBudget",
    "regionalBridge",
    "localMapBridge",
    "activeBridgePresence",
    "metricLayerHaloScale"
  ]) {
    response[key] = smoothTemporalValue(key, response[key] ?? 0, dt, halfLife);
  }

  for (const [name, layer] of [
    ["galactic", response.galacticLayer],
    ["regional", response.regionalLayer],
    ["localMap", response.localMapLayer],
    ["localSystem", response.localSystemLayer],
    ["surface", response.surfaceLayer]
  ]) {
    layer.haloScale = smoothTemporalValue(`${name}LayerHaloScale`, layer.haloScale, dt, halfLife);
  }

  response.overlayHazeBudget *= dampOverlay;
  response.metricOverlayEnergy *= dampEnergy;
  response.mapBridgeOpticalBudget *= dampBridge;
  const activeBridgeRetreat =
    (1 - smoothstep(0.56, 0.84, response.localSystemPresence || 0)) *
    (1 - smoothstep(0.04, 0.18, response.surfacePresence || 0));
  response.activeBridgePresence *= activeBridgeRetreat;
  response.mapBridgeOpticalBudget *= activeBridgeRetreat;
  response.localMapBridge *= activeBridgeRetreat;
  if (response.scaleStage === "Surface" && (response.surfaceReadiness || 0) >= SURFACE_STAGE_READINESS) {
    response.globalVeilPresence = 0;
  }
  opticalSmoothing.initialized = true;
  return response;
}

function activeImpostorScale(surfacePresence, sphereScreenRadius = 0, localSystemPresence = 0, localSystemHandoff = 0) {
  const surfaceExit = smoothstep(ACTIVE_HANDOFF_START, ACTIVE_HANDOFF_PRIMARY, surfacePresence);
  const radiusExit =
    smoothstep(62, 104, sphereScreenRadius) *
    smoothstep(0.02, 0.18, surfacePresence);
  const localOpticalExit =
    Math.max(
      smoothstep(0.10, 0.52, localSystemPresence) *
        smoothstep(34, 72, sphereScreenRadius) *
        0.72,
      smoothstep(0.16, 0.58, localSystemHandoff) *
        smoothstep(36, 64, sphereScreenRadius) *
        0.96
    );
  const exit = Math.max(surfaceExit, radiusExit, localOpticalExit);
  return clamp(1 - exit * 0.975, 0.025, 1);
}

function starModelWorldRadius(index) {
  if (!catalog || index < 0 || index >= catalog.count) return 0.018;
  const size = clamp(catalog.size[index] / 1.7, 0.42, 2.8);
  const luminosity = clamp(Math.sqrt(catalog.lum[index] / 1.2), 0.72, 1.35);
  return 0.018 * Math.sqrt(size) * luminosity;
}

function surfaceScreenRadiusForScaleModel(model) {
  const minDimension = Math.min(view.width, view.height);
  const maxRadius = minDimension * mix(0.165, 0.195, smoothstep(0.10, 0.92, model.surfaceDepth || 0));
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
      surfaceReadiness: 0,
      surfaceDepth: 0,
      localMapContext: 1,
      activeHaloRatio: 0,
      activeGlowStrength: 0,
      activeGlowRadius: 0,
      stellarOpticalLeadIn: 0,
      activeStarCloseness: 0,
      activeStarPresentation: {
        closeness: 0,
        primaryAlpha: 0,
        localSystemAlpha: 0,
        surfaceDetailAlpha: 0,
        photosphereAlpha: 0,
        flowAlpha: 0,
        coronaAlpha: 0,
        bloomAlpha: 0,
        radiusPx: 0
      },
      surfaceViewRadiusStarR: 7.5
    };
  }

  const index = pointer.active;
  const p = project(catalog.x[index], catalog.y[index], catalog.z[index]);
  const physicalSphereRadius = starModelWorldRadius(index);
  const bridgePresence =
    (response.activeBridgePresence ?? response.regionalBridge) *
    smoothstep(0.16, 0.86, catalog.importance[index]);
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
  const activeStarCloseness = clamp(response.activeStarCloseness || 0, 0, 1);
  const localSystemHandoff =
    response.scaleStage === "LocalSystem"
      ? Math.max(response.localSystemPresence || 0, (response.localMapBridgePresence || 0) * 0.92)
      : response.localSystemPresence || 0;
  const impostorScaleByLayers = activeImpostorScale(
    response.surfacePresence,
    sphereScreenRadius,
    response.localSystemPresence || 0,
    localSystemHandoff
  );
  const impostorScaleByPresentation = clamp(
    1 - smoothstep(0.10, 0.42, activeStarCloseness) * 0.975,
    0.025,
    1
  );
  const impostorScale = Math.min(impostorScaleByLayers, impostorScaleByPresentation);
  const impostorRadiusPx =
    baseImpostorRadiusPx *
    (1 + (localMagnification - 1) * (0.22 + catalog.importance[index] * 0.78)) *
    impostorScale;
  const surfaceAlpha =
    response.surfacePresence *
    centerVisibility;
  const primaryAlpha =
    smoothstep(0.04, 0.30, activeStarCloseness) *
    smoothstep(42, 66, sphereScreenRadius) *
    centerVisibility;
  const sphereVisibility =
    primaryAlpha *
    smoothstep(46, 72, sphereScreenRadius) *
    centerVisibility;
  const localSystemAlpha =
    smoothstep(0.06, 0.34, activeStarCloseness) *
    (1 - smoothstep(0.88, 1, activeStarCloseness) * 0.22) *
    centerVisibility;
  const earlySurfaceTextureAlpha =
    smoothstep(0.10, 0.32, activeStarCloseness) *
    smoothstep(50, 72, sphereScreenRadius) *
    0.46;
  const matureSurfaceDetailAlpha =
    smoothstep(0.48, 0.88, activeStarCloseness) *
    smoothstep(58, 108, sphereScreenRadius);
  const surfaceDetailAlpha =
    clamp(earlySurfaceTextureAlpha + matureSurfaceDetailAlpha * (1 - earlySurfaceTextureAlpha * 0.28), 0, 1) *
    centerVisibility;
  const photosphereAlpha =
    primaryAlpha *
    mix(0.36, 0.68, surfaceDetailAlpha) *
    (0.90 + smoothstep(0.62, 1, activeStarCloseness) * 0.08);
  const flowAlpha =
    primaryAlpha *
    (0.16 + surfaceDetailAlpha * 0.72) *
    smoothstep(54, 118, sphereScreenRadius);
  const coronaAlpha =
    primaryAlpha *
    (0.46 + smoothstep(0.12, 0.72, activeStarCloseness) * 0.48) *
    (0.88 + surfaceDetailAlpha * 0.10);
  const bloomAlpha =
    primaryAlpha *
    (0.52 + smoothstep(0.22, 0.82, activeStarCloseness) * 0.58);
  const localMapContext = clamp(response.metricLayerOpacity ?? response.metricCatalogPresence, 0, 1);
  const primaryRadius = Math.max(sphereScreenRadius, impostorRadiusPx, 1);
  const activeHaloRatio =
    response.surfaceReadiness > 0.05
      ? Math.min(2.05, Math.max(1.15, (sphereScreenRadius * 2.05) / primaryRadius))
      : Math.min(2.2, Math.max(1.1, (impostorRadiusPx * 1.65) / primaryRadius));
  const localLeadPresence = Math.max(
    response.localSystemPresence || 0,
    response.localSystemLayer?.presence || 0,
    response.localMapBridgePresence || 0
  );
  const previewReadability = smoothstep(42, 135, Math.max(sphereScreenRadius, impostorRadiusPx));
  const leadRetreat = 1 - smoothstep(0.72, 0.98, response.surfaceReadiness || 0);
  const approachLead =
    smoothstep(0.18, 0.72, localApproach) *
    (0.38 + previewReadability * 0.24) *
    leadRetreat;
  const stellarOpticalLeadIn = clamp(
    Math.max(
      localLeadPresence *
        (0.42 + previewReadability * 0.44) *
        leadRetreat,
      approachLead
    ),
    0,
    0.82
  );
  const localApproachGlow =
    smoothstep(0.10, 0.62, localApproach) *
    leadRetreat *
    0.34;
  const activeGlowStrength = clamp(
    photosphereAlpha * 0.76 +
      sphereVisibility * 0.28 +
      stellarOpticalLeadIn * 1.06 +
      localSystemAlpha * 0.22 +
      localApproachGlow,
    0,
    1.16
  ) * centerVisibility;
  const leadGlowRadius = impostorRadiusPx * mix(
    1.45,
    2.20,
    clamp((response.localSystemPresence || 0) * 0.72 + stellarOpticalLeadIn * 0.42, 0, 1)
  );
  const leadGlowCap = Math.max(96, sphereScreenRadius * mix(1.68, 2.55, previewReadability));
  const localSystemGlowFloor =
    (92 + (response.localSystemPresence || 0) * 78) *
    (1 - smoothstep(0.46, 0.92, response.surfaceReadiness || 0) * 0.72);
  const activeGlowRadius = Math.max(
    sphereScreenRadius * mix(1.04, 1.15, smoothstep(0.18, 0.74, response.surfaceReadiness || 0)),
    Math.min(leadGlowRadius, leadGlowCap),
    localSystemGlowFloor,
    42
  );
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
    surfaceReadiness: response.surfaceReadiness || 0,
    surfaceDepth: response.surfaceDepth || 0,
    localMapContext,
    activeHaloRatio,
    activeGlowStrength,
    activeGlowRadius,
    stellarOpticalLeadIn,
    activeStarCloseness,
    activeStarPresentation: {
      closeness: activeStarCloseness,
      primaryAlpha,
      localSystemAlpha,
      surfaceDetailAlpha,
      photosphereAlpha,
      flowAlpha,
      coronaAlpha,
      bloomAlpha,
      radiusPx: sphereScreenRadius
    },
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
  const localSystemActivePointRetreat =
    response.scaleStage === "LocalSystem"
      ? (response.localMapBridgePresence || 0) * 0.52
      : (response.localMapBridgePresence || 0) * 0.12;
  const activePointRetreat = Math.max(
    response.surfacePresence || 0,
    (response.localSystemPresence || 0) * 0.75,
    localSystemActivePointRetreat
  );
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
    activePointRetreat,
    response.exposure,
    response.mapBridgeOpticalBudget ?? response.activeBridgePresence ?? response.regionalBridge,
    response.galacticResidual,
    1 - (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1),
    response.mapContinuityCompensation ?? 1,
    response.metricLayerHaloScale ?? 1,
    response.metricLayerOpacity ?? 1,
    response.metricCoreVisibility ?? 1
  ]);
}

function sphereUniformData(t, now, visual) {
  const basis = cameraBasis();
  const index = visual?.index === pointer.active ? pointer.active : -1;
  const valid = catalog && index >= 0 && index < catalog.count;
  const opticalLeadPresence = valid
    ? (visual?.stellarOpticalLeadIn || 0) *
      (1 - smoothstep(0.58, 0.96, visual?.surfaceReadiness || 0)) *
      0.36
    : 0;
  const presence = valid
    ? clamp(
        (visual.surfaceAlpha || 0) * 0.92 +
          (visual.sphereVisibility || 0) * 0.42 +
          (visual.surfaceReadiness || 0) * 0.28 +
          opticalLeadPresence,
        0,
        1
      )
    : 0;
  const phase = valid ? stellarPhase(index, now) : 0;
  const activity = valid ? clamp(stellarActivity(index) + (visual?.surfaceDepth || 0) * 0.18, 0, 1) : 0;
  const seed = valid ? seededUnit(index * 19.91 + 0.73) : 0;
  const displayColor = valid ? stellarDisplayColor(index) : { r: 1, g: 1, b: 1 };
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
    displayColor.r,
    displayColor.g,
    displayColor.b,
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
    (1 - (response.surfacePresence || 0) * 0.86) *
    (1 - (response.haloOverlapStrength || 0) * 0.32);
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
    labelContext.strokeStyle = `rgba(0, 2, 9, ${0.028 * alpha * (1 - t * 0.28)})`;
    labelContext.lineWidth = mix(3, 7, arm / 4);
    labelContext.stroke();
  }
  labelContext.restore();
}

function drawCatalogDensity(t, response) {
  const contextScale = response.contextScale || 1;
  const mapOpticalApproach =
    smoothstep(0.06, 0.30, t) *
    (1 - smoothstep(0.58, 0.78, t)) *
    (response.metricCoreVisibility ?? response.metricCatalogPresence ?? 1) *
    (1 - smoothstep(0.08, 0.92, 1 - (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1))) *
    (response.mapContinuityCompensation ?? 1);
  const alpha =
    (response.galacticResidual * 0.28 + response.regionalBridge * 0.12) *
    (response.metricLayerOpacity ?? response.metricCatalogPresence ?? 1) *
    (1 - response.localSurface * 0.38) *
    (1 - (response.localApproach || response.surfacePresence || 0) * 0.74);
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
      mix(0.72, 2.65, clamp(core * 0.72 + importance * 0.48, 0, 1)) *
      (1 - t * 0.10 + response.regionalBridge * 0.08 + mapOpticalApproach * 0.24) *
      contextScale;
    const glow =
      clamp(0.018 + core * 0.058 + importance * 0.032, 0.012, 0.086) *
      alpha *
      mix(0.56, 1, contextScale) *
      (response.metricOverlayEnergy || 0.86) *
      (1 + mapOpticalApproach * 2.25);
    const gradient = labelContext.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 1.85);
    gradient.addColorStop(
      0,
      cssRgba(
        mix(catalog.r[index], 1, 0.18),
        mix(catalog.g[index], 0.96, 0.16),
        mix(catalog.b[index], 0.86, 0.14),
        glow
      )
    );
    gradient.addColorStop(0.28, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], glow * 0.18));
    gradient.addColorStop(1, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], 0));
    labelContext.fillStyle = gradient;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, radius * 1.85, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawGalacticVeil(t, response) {
  const alpha = response.globalVeilPresence ?? 0;
  if (alpha < 0.01) return;

  const basis = cameraBasis();
  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  labelContext.lineCap = "round";
  labelContext.lineJoin = "round";
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
      ? `rgba(255, 214, 168, ${0.012 * alpha})`
      : `rgba(178, 209, 255, ${0.009 * alpha})`;
    labelContext.lineWidth = mix(6, 16, arm / 4) * (1 - t * 0.18 + response.regionalBridge * 0.08);
    labelContext.stroke();
  }

  const core = project(0, 0, 0, basis);
  if (Math.abs(core.ndcX) < 1.2 && Math.abs(core.ndcY) < 1.2) {
    const coreRadius = Math.min(view.width, view.height) * 0.10 * (1 - t * 0.18);
    const glow = labelContext.createRadialGradient(
      core.x,
      core.y,
      0,
      core.x,
      core.y,
      coreRadius
    );
    glow.addColorStop(0, `rgba(255, 236, 205, ${0.020 * alpha})`);
    glow.addColorStop(0.48, `rgba(196, 218, 255, ${0.009 * alpha})`);
    glow.addColorStop(1, "rgba(196, 218, 255, 0)");
    labelContext.fillStyle = glow;
    labelContext.beginPath();
    labelContext.arc(core.x, core.y, coreRadius, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();
}

function drawReference(t, response) {
  const nearFieldFade =
    (1 - smoothstep(0.30, 0.62, response.localMapBridgePresence || 0)) *
    (1 - smoothstep(0.10, 0.32, response.localSystemPresence || 0)) *
    (1 - smoothstep(0.12, 0.34, response.localApproach || 0)) *
    (1 - smoothstep(0.04, 0.16, response.surfacePresence || 0));
  const alpha = response.referenceStrength * nearFieldFade;
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

function seededRandom(seed) {
  let state = (Math.floor(seed * 1000000) ^ 0x9e3779b9) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function stellarActivity(index) {
  if (!catalog || index < 0 || index >= catalog.count) return 0;
  const luminosity = clamp(Math.log2(1 + catalog.lum[index]) / 3.2, 0, 1);
  const colorHeat = clamp((catalog.b[index] - catalog.r[index] + 0.68) / 1.42, 0, 1);
  const seed = seededUnit(index * 17.13 + 4.7);
  return clamp(0.30 + luminosity * 0.36 + colorHeat * 0.18 + seed * 0.24, 0.22, 1);
}

function stellarDisplayColor(index) {
  if (!catalog || index < 0 || index >= catalog.count) return { r: 1, g: 0.86, b: 0.58 };
  if (catalog.name[index] === "Sol") {
    return { r: 1.0, g: 0.88, b: 0.62 };
  }
  return {
    r: catalog.r[index],
    g: catalog.g[index],
    b: catalog.b[index]
  };
}

function stellarSpinSpeed(index) {
  if (index < 0) return 0;
  const seed = seededUnit(index * 23.7 + 1.11);
  return mix(0.026, 0.036, seed);
}

function stellarSpinCycle(index, now) {
  if (index < 0) return 0;
  const seed = seededUnit(index * 23.7 + 1.11);
  return seed + now * 0.001 * stellarSpinSpeed(index);
}

function stellarPhase(index, now) {
  return wrapUnit(stellarSpinCycle(index, now));
}

function stellarAxisTiltAngle(index) {
  if (index < 0) return 0;
  const seed = seededUnit(index * 29.17 + 0.37);
  return mix(-0.14, 0.14, seed);
}

function stellarProjectedPose(index) {
  if (index < 0) return { axisTilt: 0, longitudePhase: 0 };
  const basis = cameraBasis();
  const modelBasis = starModelBasis(index);
  const poleX = dot(modelBasis.yAxis, basis.right);
  const poleY = -dot(modelBasis.yAxis, basis.up);
  const poleLength = Math.hypot(poleX, poleY);
  const viewX = dot(basis.forward, modelBasis.xAxis);
  const viewZ = dot(basis.forward, modelBasis.zAxis);
  const projectedLongitude = Math.atan2(viewX, viewZ) / TWO_PI;
  return {
    axisTilt: poleLength > 0.08 ? Math.atan2(poleX, -poleY) : stellarAxisTiltAngle(index),
    longitudePhase: wrapUnit(projectedLongitude)
  };
}

function stellarGlowKey(index) {
  if (!catalog || index < 0 || index >= catalog.count) return "none";
  const display = stellarDisplayColor(index);
  return [
    index,
    Math.round(display.r * 255),
    Math.round(display.g * 255),
    Math.round(display.b * 255),
    Math.round(stellarActivity(index) * 100)
  ].join(":");
}

function loadStellar02ImageData(path) {
  const url = new URL(path, self.location.href);
  return fetch(url.href, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load stellar asset ${url.href}`);
      }
      return response.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then((bitmap) => {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        bitmap.close?.();
        throw new Error(`Unable to read stellar asset ${url.href}`);
      }
      ctx.drawImage(bitmap, 0, 0);
      const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close?.();
      return {
        width: image.width,
        height: image.height,
        data: image.data,
        canvas
      };
    });
}

function ensureStellar02Assets() {
  if (stellar02Assets) return stellar02Assets;
  if (
    !stellar02AssetsPromise &&
    typeof fetch === "function" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas !== "undefined"
  ) {
    stellar02AssetsPromise = Promise.all([
      loadStellar02ImageData("./stellar-02/sun_surface.png"),
      loadStellar02ImageData("./stellar-02/star_colorshift.png")
    ])
      .then(([surface, palette]) => {
        stellar02Assets = { surface, palette };
        stellarSurfaceSprite = null;
        return stellar02Assets;
      })
      .catch(() => {
        stellar02AssetsPromise = null;
        return null;
      });
  }
  return null;
}

function waitForStellar02Assets(timeoutMs = 900) {
  ensureStellar02Assets();
  if (stellar02Assets) return Promise.resolve(stellar02Assets);
  if (!stellar02AssetsPromise) return Promise.resolve(null);
  return Promise.race([
    stellar02AssetsPromise,
    new Promise((resolve) => self.setTimeout(() => resolve(stellar02Assets || null), timeoutMs))
  ]);
}

function wrapUnit(value) {
  return value - Math.floor(value);
}

function sampleStellarChannel(image, u, v, channel = 0) {
  if (!image) return 0;
  const x = Math.floor(wrapUnit(u) * image.width);
  const y = Math.floor(wrapUnit(v) * image.height);
  const offset = ((y % image.height) * image.width + (x % image.width)) * 4;
  return image.data[offset + channel] / 255;
}

function sampleStellarPalette(palette, value) {
  if (!palette) return { r: 1, g: 0.84, b: 0.52 };
  const x = clamp(Math.round(clamp(value, 0, 1) * (palette.width - 1)), 0, palette.width - 1);
  const offset = x * 4;
  return {
    r: palette.data[offset] / 255,
    g: palette.data[offset + 1] / 255,
    b: palette.data[offset + 2] / 255
  };
}

function proceduralNoise2d(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothProceduralNoise2d(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = proceduralNoise2d(ix, iy, seed);
  const b = proceduralNoise2d(ix + 1, iy, seed);
  const c = proceduralNoise2d(ix, iy + 1, seed);
  const d = proceduralNoise2d(ix + 1, iy + 1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
}

function proceduralFbm2d(x, y, seed) {
  let value = 0;
  let amplitude = 0.56;
  let total = 0;
  let sx = x;
  let sy = y;
  for (let octave = 0; octave < 4; octave += 1) {
    value += smoothProceduralNoise2d(sx, sy, seed + octave * 19.17) * amplitude;
    total += amplitude;
    sx = sx * 2.08 + 13.7;
    sy = sy * 2.08 + 5.3;
    amplitude *= 0.52;
  }
  return total > 0 ? value / total : 0;
}

function ensureStellarSurfaceSprite(index) {
  if (typeof OffscreenCanvas === "undefined" || !catalog || index < 0 || index >= catalog.count) {
    return null;
  }
  const assets = ensureStellar02Assets();
  if (!assets) {
    return ensureProceduralStellarSurfaceSprite(index);
  }

  const key = `surface02:${stellarGlowKey(index)}:continuous`;
  if (stellarSurfaceSprite?.key === key) return stellarSurfaceSprite;

  const size = config.budget === "safe" ? 448 : 512;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  const data = image.data;
  const detailCanvas = new OffscreenCanvas(size, size);
  const detailCtx = detailCanvas.getContext("2d", { alpha: true });
  const detailImage = detailCtx ? detailCtx.createImageData(size, size) : null;
  const detailData = detailImage?.data || null;
  const shadowCanvas = new OffscreenCanvas(size, size);
  const shadowCtx = shadowCanvas.getContext("2d", { alpha: true });
  const shadowImage = shadowCtx ? shadowCtx.createImageData(size, size) : null;
  const shadowData = shadowImage?.data || null;
  const flowCanvas = new OffscreenCanvas(size, size);
  const flowCtx = flowCanvas.getContext("2d", { alpha: true });
  const flowImage = flowCtx ? flowCtx.createImageData(size, size) : null;
  const flowData = flowImage?.data || null;
  const center = size * 0.5;
  const radius = size * 0.462;
  let bodyLumaTotal = 0;
  let bodyLumaCount = 0;
  const displayColor = stellarDisplayColor(index);
  const activity = stellarActivity(index);
  const seed = seededUnit(index * 19.37 + config.seed * 0.00019);
  const rotationPhase = seededUnit(index * 23.7 + 1.11);
  const time = seed * 41 + rotationPhase * 76;
  const surface = assets.surface;
  const palette = assets.palette;
  const baseTint = {
    r: mix(displayColor.r, 1, 0.34),
    g: mix(displayColor.g, 0.96, 0.22),
    b: mix(displayColor.b, 0.72, 0.12)
  };
  const hotTint = {
    r: mix(displayColor.r, 1, 0.88),
    g: mix(displayColor.g, 1, 0.68),
    b: mix(displayColor.b, 0.92, 0.42)
  };
  const warmthTint = {
    r: mix(displayColor.r, 1, 0.68),
    g: mix(displayColor.g, 0.82, 0.34),
    b: mix(displayColor.b, 0.42, 0.12)
  };
  const emberTint = {
    r: mix(displayColor.r, 1, 0.52),
    g: mix(displayColor.g, 0.62, 0.24),
    b: mix(displayColor.b, 0.28, 0.08)
  };
  const shadowTint = {
    r: mix(displayColor.r, 0.70, 0.36),
    g: mix(displayColor.g, 0.42, 0.30),
    b: mix(displayColor.b, 0.22, 0.22)
  };

  for (let y = 0; y < size; y += 1) {
    const ny = (y + 0.5 - center) / radius;
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - center) / radius;
      const r2 = nx * nx + ny * ny;
      const offset = (y * size + x) * 4;
      if (r2 > 1.030) {
        data[offset + 3] = 0;
        continue;
      }
      const radial = Math.sqrt(r2);
      const edgeMask = 1 - smoothstep(1.000, 1.030, radial);
      if (edgeMask <= 0) {
        data[offset + 3] = 0;
        continue;
      }

      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const baseU = wrapUnit(0.5 + Math.atan2(nx, nz) / TWO_PI + seed * 0.17 + rotationPhase);
      const baseV = wrapUnit(0.5 - Math.asin(clamp(ny, -1, 1)) / Math.PI + seed * 0.11);
      const flowUvA = [baseU + time * 0.0033, baseV];
      const flowUvB = [baseU + time * -0.0076, baseV + Math.sin(time * 0.1) * 0.016];
      const flowUvC = [baseU + Math.sin(baseV * 8.4) * 0.016, baseV + time * 0.0044];
      const flowUvD = [
        baseU + time * -0.0028 + Math.sin(baseV * 22.0) * 0.008,
        baseV + time * 0.005 + Math.cos(baseU * 15.0) * 0.008
      ];
      const microUvA = [baseU * 2.70 + time * 0.0061, baseV * 1.92 - time * 0.0037];
      const microUvB = [
        baseU * 3.44 - time * 0.0048 + Math.sin(baseV * 17.0) * 0.013,
        baseV * 2.86 + time * 0.0054 + Math.cos(baseU * 19.0) * 0.010
      ];
      const baseRaw = sampleStellarChannel(surface, flowUvA[0], flowUvA[1]);
      const secondaryRaw = sampleStellarChannel(surface, flowUvB[0], flowUvB[1]);
      const detailRaw = sampleStellarChannel(surface, flowUvC[0], flowUvC[1]);
      const convectionRaw = sampleStellarChannel(surface, flowUvD[0], flowUvD[1]);
      const baseField = baseRaw * 0.48;
      const secondaryField = secondaryRaw * 0.32;
      const detailField = detailRaw * 0.20;
      const convectionField = convectionRaw * 0.22;
      const microField = sampleStellarChannel(surface, microUvA[0], microUvA[1]);
      const microFieldB = sampleStellarChannel(surface, microUvB[0], microUvB[1]);
      const broadField = clamp(baseRaw * 0.45 + secondaryRaw * 0.35 + convectionRaw * 0.20, 0, 1);
      const cellularField = clamp(
        0.50 +
          (microField - broadField) * 0.52 +
          (microFieldB - broadField) * 0.36 +
          (detailRaw - baseRaw) * 0.16 +
          (convectionRaw - secondaryRaw) * 0.12,
        0,
        1
      );
      const surfaceField = clamp(
        baseField +
          secondaryField +
          detailField +
          convectionField +
          (microField - 0.50) * 0.145 +
          (microFieldB - 0.50) * 0.105 +
          Math.sin(baseU * 13.4 + baseV * 5.1 + time * 0.05) * 0.014 +
          Math.sin(baseV * 17.2 - baseU * 3.6 - time * 0.033) * 0.012,
        0,
        1
      );
      const hotField = sampleStellarChannel(surface, flowUvB[0] + 0.044, flowUvB[1] - 0.03);
      const patchField = sampleStellarChannel(surface, flowUvC[0] - 0.036, flowUvC[1] + 0.024);
      const flowBand = Math.sin(baseV * 24.0 + time * 0.07) * 0.5 + 0.5;
      const rotationLongitude = wrapUnit(baseU + seed * 0.09);
      const rotationVeinA = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin((rotationLongitude * 3.8 + baseV * 0.72 + seed * 2.6) * Math.PI)) * 1.42),
        2.20
      );
      const rotationVeinB = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin((rotationLongitude * 5.6 - baseV * 0.44 + seed * 4.1) * Math.PI)) * 1.68),
        2.35
      );
      const rotationVeinC = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin((rotationLongitude * 7.2 + baseV * 1.10 - seed * 1.7) * Math.PI)) * 1.92),
        2.55
      );
      const fineSurfaceField = clamp(
        0.50 +
          (surfaceField - 0.50) * 0.035 +
          (cellularField - 0.50) * 0.58 +
          (detailRaw - 0.50) * 0.10 +
          (convectionRaw - 0.50) * 0.08 +
          (microField - 0.50) * 0.34 +
          (microFieldB - 0.50) * 0.22 +
          (hotField - 0.50) * 0.08 +
          (flowBand - 0.50) * 0.025,
        0,
        1
      );
      const paletteField = clamp(
        0.56 +
          (fineSurfaceField - 0.50) * 0.72 +
          (cellularField - 0.50) * 0.20 +
          (microField - 0.50) * 0.18 +
          (hotField - broadField) * 0.06 +
          (flowBand - 0.50) * 0.025,
        0,
        1
      );
      const paletteBase = sampleStellarPalette(palette, paletteField * 0.88 + 0.04);
      const paletteHot = sampleStellarPalette(palette, clamp(paletteField * 0.74 + 0.24, 0, 1));
      const paletteShadow = sampleStellarPalette(palette, paletteField * 0.36 + 0.04);
      const facing = nz;
      const rimHeat = Math.pow(1 - facing, 3.5);
      const centerHeat = Math.pow(facing, 0.82) * 0.035;
      const grainSpark =
        ((detailField - 0.5) * 0.080 +
          (convectionField - 0.5) * 0.060 +
          (microField - 0.5) * 0.145 +
          (microFieldB - 0.5) * 0.110 +
          (proceduralNoise2d(x * 2.90, y * 3.10, seed + rotationPhase * 70.0) - 0.5) * 0.115) *
        edgeMask;
      const hotMask = clamp(
        clamp(0.50 + (hotField - broadField) * 0.60, 0, 1) * 0.30 +
          fineSurfaceField * fineSurfaceField * 0.22 +
          cellularField * 0.28 +
          microField * 0.26 +
          detailField * 0.16 -
          (1 - patchField) * 0.018,
        0,
        1
      );
      const darkPatchMask = clamp((1 - patchField) * (1 - patchField) * 0.0022 + (1 - baseField) * 0.0012 + rimHeat * 0.0008, 0, 0.012);
      const whiteHeat = clamp(0.84 + centerHeat * 0.008 + rimHeat * 0.38 + hotMask * 0.28 + (microField - 0.5) * 0.026 + activity * 0.075, 0, 1.0);
      const microSpark = clamp(
        (fineSurfaceField - 0.42) * 0.100 +
          (hotField - 0.5) * 0.055 +
          (microField - 0.5) * 0.150 +
          (microFieldB - 0.5) * 0.110 +
          flowBand * 0.024 +
          grainSpark,
        -0.035,
        0.26
      );
      const edgeEmission = rimHeat * (0.48 + activity * 0.12);
      const filamentLift = clamp(hotMask * 0.082 + fineSurfaceField * 0.036 + microField * 0.070 + microSpark * 0.44, 0, 0.26);
      const rotationalFlow = clamp(
        (rotationVeinA * 0.52 + rotationVeinB * 0.36 + rotationVeinC * 0.24) *
          (0.24 + surfaceField * 0.30 + hotField * 0.22 + cellularField * 0.20 + flowBand * 0.08) *
          (0.58 + facing * 0.42) *
          edgeMask,
        0,
        1
      );
      const rotationHeat = rotationalFlow * (0.055 + hotMask * 0.120 + activity * 0.022);
      if (flowData) {
        const flowAlpha = clamp(
          rotationalFlow *
            (0.13 + hotMask * 0.24 + Math.max(0, microSpark) * 0.72 + fineSurfaceField * 0.06) *
            (0.62 + facing * 0.38),
          0,
          0.52
        );
        flowData[offset] = 255;
        flowData[offset + 1] = Math.round(clamp(202 + rotationalFlow * 42 + hotMask * 26, 0, 255));
        flowData[offset + 2] = Math.round(clamp(96 + rotationalFlow * 56 + hotMask * 28, 0, 255));
        flowData[offset + 3] = Math.round(flowAlpha * 255);
      }
      if (detailData || shadowData) {
        const streamU = baseU + time * 0.0025;
        const streamWarp = Math.sin(baseV * 17.0 + seed * 5.7) * 0.55 + Math.sin(baseU * 11.0 - seed * 3.1) * 0.24;
        const streamA = smoothProceduralNoise2d(streamU * 118, baseV * 54 + streamWarp, seed + 207.0);
        const streamB = smoothProceduralNoise2d((baseU - time * 0.0017) * 166, baseV * 72 - streamWarp * 0.62, seed + 239.0);
        const streamRidge = clamp(
          Math.pow(Math.max(0, 1 - Math.abs(streamA - 0.58) * 5.8), 1.72) * 0.48 +
            Math.pow(Math.max(0, 1 - Math.abs(streamB - 0.52) * 6.4), 1.88) * 0.38,
          0,
          1
        );
        const granuleA = proceduralNoise2d(baseU * 760 + time * 0.41, baseV * 680 - time * 0.33, seed + 55.0);
        const granuleB = proceduralNoise2d(baseU * 980 - time * 0.53, baseV * 870 + time * 0.47, seed + 89.0);
        const granuleC = proceduralNoise2d(baseU * 1240 + baseV * 29.0 + time * 0.37, baseV * 1090 - time * 0.43, seed + 131.0);
        const detailSignal = clamp(
          Math.max(0, granuleA - 0.56) * 0.84 +
            Math.max(0, granuleB - 0.62) * 0.74 +
            Math.max(0, granuleC - 0.68) * 0.60 +
            Math.max(0, fineSurfaceField - 0.50) * 0.40 +
            Math.max(0, cellularField - 0.52) * 0.32 +
            Math.max(0, microField - 0.54) * 0.22 +
            streamRidge * (0.42 + activity * 0.08),
          0,
          1
        );
        if (detailData) {
          const grainAlpha = clamp(
            edgeMask *
              (detailSignal * 0.86 + Math.max(0, fineSurfaceField - 0.52) * 0.22 + Math.max(0, microField - 0.56) * 0.16) *
              (0.92 + Math.pow(1 - facing, 2.8) * 0.20),
            0,
            0.96
          );
          detailData[offset] = Math.round(clamp(0.96 + detailSignal * 0.08, 0, 1) * 255);
          detailData[offset + 1] = Math.round(clamp(0.78 + detailSignal * 0.18, 0, 1) * 255);
          detailData[offset + 2] = Math.round(clamp(0.42 + detailSignal * 0.12, 0, 1) * 255);
          detailData[offset + 3] = Math.round(grainAlpha * 255);
        }
        if (shadowData) {
          const shadowSignal = clamp(
            Math.max(0, 0.44 - granuleA) * 0.62 +
              Math.max(0, 0.38 - granuleB) * 0.54 +
              Math.max(0, 0.34 - granuleC) * 0.44,
            0,
            1
          );
          const shadowAlpha = clamp(edgeMask * shadowSignal * (0.24 + Math.pow(1 - facing, 2.6) * 0.05), 0, 0.28);
          shadowData[offset] = 242;
          shadowData[offset + 1] = 190;
          shadowData[offset + 2] = 116;
          shadowData[offset + 3] = Math.round(shadowAlpha * 255);
        }
      }

      let red =
        paletteBase.r * baseTint.r * 0.88 +
        paletteHot.r * hotTint.r * (hotMask * 0.58 + centerHeat * 0.055) -
        paletteShadow.r * shadowTint.r * darkPatchMask * 0.020 +
        warmthTint.r * (centerHeat * 0.055 + edgeEmission * 0.28) +
        emberTint.r * (fineSurfaceField * 0.04 + hotMask * 0.16) +
        whiteHeat * 0.34 +
        rotationHeat * 1.36 +
        microSpark +
        filamentLift;
      let green =
        paletteBase.g * baseTint.g * 0.86 +
        paletteHot.g * hotTint.g * (hotMask * 0.54 + centerHeat * 0.055) -
        paletteShadow.g * shadowTint.g * darkPatchMask * 0.018 +
        warmthTint.g * (centerHeat * 0.050 + edgeEmission * 0.22) +
        emberTint.g * (fineSurfaceField * 0.03 + hotMask * 0.11) +
        whiteHeat * 0.32 +
        rotationHeat * 1.06 +
        microSpark * 0.86 +
        filamentLift * 0.84;
      let blue =
        paletteBase.b * baseTint.b * 0.78 +
        paletteHot.b * hotTint.b * (hotMask * 0.48 + centerHeat * 0.045) -
        paletteShadow.b * shadowTint.b * darkPatchMask * 0.014 +
        warmthTint.b * (centerHeat * 0.036 + edgeEmission * 0.13) +
        emberTint.b * (fineSurfaceField * 0.02 + hotMask * 0.07) +
        whiteHeat * 0.25 +
        rotationHeat * 0.36 +
        microSpark * 0.70 +
        filamentLift * 0.58;
      const wash = clamp(0.62 + centerHeat * 0.003 + edgeEmission * 0.26 + hotMask * 0.150, 0, 0.84);
      red = mix(red, 1.0, wash);
      green = mix(green, 0.94, wash * 0.96);
      blue = mix(blue, 0.58, wash * 0.66);
      red += grainSpark * 0.10 + filamentLift * 0.08;
      green += grainSpark * 0.13 + filamentLift * 0.06;
      blue += grainSpark * 0.10 + filamentLift * 0.03;
      const alpha = clamp(edgeMask * (0.95 + edgeEmission * 0.24), 0, 1);
      data[offset] = Math.round(clamp(red, 0, 1) * 255);
      data[offset + 1] = Math.round(clamp(green, 0, 1) * 255);
      data[offset + 2] = Math.round(clamp(blue, 0, 1) * 255);
      data[offset + 3] = Math.round(alpha * 255);
      if (radial < 0.74) {
        bodyLumaTotal += (clamp(red, 0, 1) * 0.2126 + clamp(green, 0, 1) * 0.7152 + clamp(blue, 0, 1) * 0.0722) * 255;
        bodyLumaCount += 1;
      }
    }
  }

  if (bodyLumaCount > 0) {
  const targetBodyLuma = 238 + activity * 6;
    const lumaGain = clamp(targetBodyLuma / Math.max(1, bodyLumaTotal / bodyLumaCount), 0.80, 1.24);
    if (Math.abs(lumaGain - 1) > 0.012) {
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] === 0) continue;
        data[offset] = Math.round(clamp(data[offset] * lumaGain, 0, 255));
        data[offset + 1] = Math.round(clamp(data[offset + 1] * lumaGain, 0, 255));
        data[offset + 2] = Math.round(clamp(data[offset + 2] * lumaGain, 0, 255));
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  if (detailCtx && detailImage) {
    detailCtx.putImageData(detailImage, 0, 0);
  }
  if (shadowCtx && shadowImage) {
    shadowCtx.putImageData(shadowImage, 0, 0);
  }
  if (flowCtx && flowImage) {
    flowCtx.putImageData(flowImage, 0, 0);
  }
  stellarSurfaceSprite = { key, canvas, detailCanvas, shadowCanvas, flowCanvas, tileCanvas: surface.canvas, size };
  return stellarSurfaceSprite;
}

function ensureProceduralStellarSurfaceSprite(index) {
  if (typeof OffscreenCanvas === "undefined" || !catalog || index < 0 || index >= catalog.count) {
    return null;
  }
  const key = `surface-fallback:${stellarGlowKey(index)}:continuous`;
  if (stellarSurfaceSprite?.key === key) return stellarSurfaceSprite;

  const size = 640;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  const data = image.data;
  const detailCanvas = new OffscreenCanvas(size, size);
  const detailCtx = detailCanvas.getContext("2d", { alpha: true });
  const detailImage = detailCtx ? detailCtx.createImageData(size, size) : null;
  const detailData = detailImage?.data || null;
  const flowCanvas = new OffscreenCanvas(size, size);
  const flowCtx = flowCanvas.getContext("2d", { alpha: true });
  const flowImage = flowCtx ? flowCtx.createImageData(size, size) : null;
  const flowData = flowImage?.data || null;
  const center = size * 0.5;
  const radius = size * 0.455;
  const displayColor = stellarDisplayColor(index);
  const activity = stellarActivity(index);
  const seed = (index + 1) * 11.913 + config.seed * 0.00037;
  const spinPhase = seededUnit(index * 23.7 + 1.11);
  const hot = {
    r: mix(displayColor.r, 1, 0.86),
    g: mix(displayColor.g, 0.99, 0.66),
    b: mix(displayColor.b, 0.86, 0.38)
  };
  const warm = {
    r: mix(displayColor.r, 1, 0.60),
    g: mix(displayColor.g, 0.92, 0.40),
    b: mix(displayColor.b, 0.62, 0.24)
  };

  for (let y = 0; y < size; y += 1) {
    const ny = (y + 0.5 - center) / radius;
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5 - center) / radius;
      const r2 = nx * nx + ny * ny;
      const offset = (y * size + x) * 4;
      if (r2 > 1.035) {
        data[offset + 3] = 0;
        continue;
      }

      const radial = Math.sqrt(r2);
      const edgeMask = 1 - smoothstep(1.000, 1.035, radial);
      if (edgeMask <= 0) {
        data[offset + 3] = 0;
        continue;
      }

      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const longitude = wrapUnit(0.5 + Math.atan2(nx, nz) / TWO_PI + spinPhase + seed * 0.013);
      const latitude = wrapUnit(0.5 - Math.asin(clamp(ny, -1, 1)) / Math.PI + seed * 0.017);
      const angle = Math.atan2(ny, nx);
      const facing = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const swirl = Math.sin(angle * 3.0 + radial * 7.5 + seed) * (0.018 + activity * 0.006) * (1 - radial * 0.42);
      const px = Math.cos(longitude * TWO_PI) * (0.74 + facing * 0.26) + Math.cos(angle + 1.2) * swirl;
      const py = (latitude - 0.5) * 2.0 + Math.sin(angle - 0.7) * swirl;
      const low = proceduralFbm2d(px * 4.8 + seed, py * 4.8 - seed * 0.31, seed);
      const cells = proceduralFbm2d(px * 19.0 + low * 1.15, py * 19.0 - low * 0.72, seed + 41.0);
      const fine = proceduralFbm2d(px * 57.0 + cells * 1.7, py * 57.0 - cells * 1.2, seed + 83.0);
      const micro = proceduralFbm2d(px * 118.0, py * 118.0, seed + 131.0);
      const cellularWeb = Math.max(0, 1 - Math.abs(cells - 0.52) * 3.9);
      const fineWeb = Math.max(0, 1 - Math.abs(fine - cells) * 3.3);
      const faculae = smoothstep(0.48, 0.92, cellularWeb * 0.52 + fineWeb * 0.34 + micro * 0.14);
      const rotationVeinA = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin((longitude * 4.2 + latitude * 0.82 + seed * 0.17) * Math.PI)) * 1.54),
        2.18
      );
      const rotationVeinB = Math.pow(
        Math.max(0, 1 - Math.abs(Math.sin((longitude * 6.4 - latitude * 0.55 + seed * 0.31) * Math.PI)) * 1.82),
        2.42
      );
      const rotationalFlow = clamp(
        (rotationVeinA * 0.54 + rotationVeinB * 0.38) *
          (0.28 + cells * 0.26 + fineWeb * 0.20 + faculae * 0.22) *
          (0.58 + facing * 0.42) *
          edgeMask,
        0,
        1
      );
      const grainSpark =
        ((fine - 0.5) * 0.120 +
          (micro - 0.5) * 0.160 +
          (proceduralNoise2d(x, y, seed + 193.0) - 0.5) * 0.110) *
        edgeMask;
      const granulation =
        (cells - 0.5) * 0.052 +
        (fine - 0.5) * 0.135 +
        (micro - 0.5) * 0.105 +
        faculae * (0.135 + activity * 0.034) +
        grainSpark * 0.92;
      const lowLift = (low - 0.5) * 0.018;
      const centerBurn = Math.pow(Math.max(0, 1 - radial), 0.34) * 0.08;
      const rimBurn = Math.pow(Math.max(0, 1 - facing), 2.55) * (0.18 + activity * 0.035);
      const heat = clamp(0.88 + centerBurn + rimBurn + granulation + lowLift, 0.68, 1.28);
      const whiteMix = clamp(0.58 + heat * 0.18 + rimBurn * 0.62 + faculae * 0.08, 0.55, 0.92);
      const ember = Math.max(0, 1 - faculae) * Math.max(0, 0.18 - fineWeb * 0.15) * 0.045;
      const alpha = clamp(edgeMask * (0.94 + rimBurn * 0.22), 0, 1);
      if (detailData) {
        const detailSignal = clamp(faculae * 0.42 + fineWeb * 0.34 + Math.max(0, micro - 0.46) * 0.42 + Math.max(0, grainSpark) * 1.60, 0, 1);
        detailData[offset] = 255;
        detailData[offset + 1] = Math.round(clamp(198 + detailSignal * 48, 0, 255));
        detailData[offset + 2] = Math.round(clamp(102 + detailSignal * 40, 0, 255));
        detailData[offset + 3] = Math.round(clamp(edgeMask * detailSignal * (0.58 + facing * 0.42), 0, 0.92) * 255);
      }
      if (flowData) {
        const flowAlpha = clamp(rotationalFlow * (0.18 + faculae * 0.20 + Math.max(0, grainSpark) * 0.62), 0, 0.44);
        flowData[offset] = 255;
        flowData[offset + 1] = Math.round(clamp(206 + rotationalFlow * 34, 0, 255));
        flowData[offset + 2] = Math.round(clamp(104 + rotationalFlow * 50, 0, 255));
        flowData[offset + 3] = Math.round(flowAlpha * 255);
      }

      const textureSignal = clamp(granulation * 0.85 + grainSpark * 2.1, -0.18, 0.22);
      const red = clamp(mix(warm.r, hot.r, whiteMix) * (0.92 + heat * 0.066) + ember * 0.16 + textureSignal * 0.08 + rotationalFlow * 0.030, 0, 1);
      const green = clamp(mix(warm.g, hot.g, whiteMix) * (0.87 + heat * 0.082) + textureSignal * 0.19 + rotationalFlow * 0.026, 0, 1);
      const blue = clamp(mix(warm.b, hot.b, whiteMix) * (0.79 + heat * 0.088) - ember * 0.020 + textureSignal * 0.20 + rotationalFlow * 0.010, 0, 1);
      data[offset] = Math.round(red * 255);
      data[offset + 1] = Math.round(green * 255);
      data[offset + 2] = Math.round(blue * 255);
      data[offset + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
  if (detailCtx && detailImage) {
    detailCtx.putImageData(detailImage, 0, 0);
  }
  if (flowCtx && flowImage) {
    flowCtx.putImageData(flowImage, 0, 0);
  }
  stellarSurfaceSprite = { key, canvas, detailCanvas, flowCanvas, tileCanvas: canvas, size };
  return stellarSurfaceSprite;
}

function ensureStellarGlowSprite(index) {
  if (typeof OffscreenCanvas === "undefined" || !catalog || index < 0 || index >= catalog.count) {
    return null;
  }
  const key = `glow02:${stellarGlowKey(index)}`;
  if (stellarGlowSprite?.key === key) return stellarGlowSprite;

  const size = config.budget === "safe" ? 640 : 768;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const cx = size * 0.5;
  const cy = size * 0.5;
  const half = size * 0.5;
  const displayColor = stellarDisplayColor(index);
  const r = displayColor.r;
  const g = displayColor.g;
  const b = displayColor.b;
  const hot = [
    mix(r, 1, 0.78),
    mix(g, 0.98, 0.52),
    mix(b, 0.78, 0.30)
  ];
  const warm = [
    mix(r, 1, 0.58),
    mix(g, 0.92, 0.34),
    mix(b, 0.70, 0.22)
  ];
  const corona = [
    mix(r, 1, 0.42),
    mix(g, 0.88, 0.24),
    mix(b, 0.76, 0.22)
  ];

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";

  const broad = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * 1.0);
  broad.addColorStop(0.00, cssRgba(...hot, 0.300));
  broad.addColorStop(0.12, cssRgba(...hot, 0.240));
  broad.addColorStop(0.30, cssRgba(...warm, 0.120));
  broad.addColorStop(0.55, cssRgba(...corona, 0.042));
  broad.addColorStop(0.82, cssRgba(r, g, b, 0.013));
  broad.addColorStop(1.00, cssRgba(r, g, b, 0));
  ctx.fillStyle = broad;
  ctx.fillRect(0, 0, size, size);

  const innerBurn = ctx.createRadialGradient(cx, cy, half * 0.08, cx, cy, half * 0.56);
  innerBurn.addColorStop(0.00, cssRgba(1, 0.98, 0.82, 0.030));
  innerBurn.addColorStop(0.34, cssRgba(...hot, 0.034));
  innerBurn.addColorStop(0.76, cssRgba(...warm, 0.018));
  innerBurn.addColorStop(1.00, cssRgba(r, g, b, 0));
  ctx.fillStyle = innerBurn;
  ctx.fillRect(0, 0, size, size);

  const whiteCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * 0.23);
  whiteCore.addColorStop(0.00, "rgba(255,252,224,0.025)");
  whiteCore.addColorStop(0.42, "rgba(255,238,198,0.015)");
  whiteCore.addColorStop(1.00, "rgba(255,230,180,0)");
  ctx.fillStyle = whiteCore;
  ctx.fillRect(0, 0, size, size);

  stellarGlowSprite = { key, canvas, size };
  return stellarGlowSprite;
}

function localReferenceStrength(response, visual) {
  return 0;
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

function drawBridgeHalo(index, p, bridge, active = false, radiusCeiling = Infinity) {
  const importance = catalog.importance[index];
  let radius = active
    ? mix(30, 66, bridge) * (0.76 + importance * 0.40)
    : mix(8, 22, clamp(importance * 1.1, 0, 1)) * (0.70 + bridge * 0.30);
  if (Number.isFinite(radiusCeiling)) radius = Math.min(radius, radiusCeiling);
  const alpha = bridge * (active ? 0.078 : 0.020 + importance * 0.030);
  if (alpha < 0.006) return;
  const displayColor = stellarDisplayColor(index);
  const r = displayColor.r;
  const g = displayColor.g;
  const b = displayColor.b;
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
    (response.activeBridgePresence ?? response.regionalBridge) *
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
      visual && visual.index === active ? Math.max(34, visual.apparentRadiusPx * 2.2) : Infinity;
    drawBridgeHalo(active, activeP, bridge * pulse, true, radiusCeiling);
  }

  for (const candidate of candidates) {
    drawBridgeHalo(candidate.index, candidate.p, bridge, false);
  }
  labelContext.restore();
}

function localSkyBudget() {
  if (!catalog) return 520;
  if (catalog.budget.key === "safe") return 720;
  if (catalog.budget.key === "immersive") return 1800;
  return 1280;
}

function localSkyCloudBudget() {
  if (!catalog) return 12;
  if (catalog.budget.key === "safe") return 10;
  if (catalog.budget.key === "immersive") return 28;
  return 18;
}

function ensureLocalSkyDome(active) {
  const budget = localSkyBudget();
  const cloudBudget = localSkyCloudBudget();
  const key = `${config.seed}:${catalog?.budget.key || "standard"}:${active}:${budget}:${cloudBudget}`;
  if (localSkyDome?.key === key) return localSkyDome;

  const random = createRandom((config.seed + (active + 1) * 1009 + budget * 37) % 2147483647);
  const bandTilt = mix(-0.46, 0.46, random());
  const bandSpin = random() * TWO_PI;
  const stars = [];
  for (let i = 0; i < budget; i += 1) {
    const inBand = random() < 0.42;
    let dir;
    if (inBand) {
      const longitude = random() * TWO_PI;
      const latitude = gaussian(random) * mix(0.035, 0.16, random());
      const cosLat = Math.cos(latitude);
      dir = [Math.cos(longitude) * cosLat, Math.sin(longitude) * cosLat, Math.sin(latitude)];
      dir = rotateAroundAxis(dir, [1, 0, 0], bandTilt);
      dir = rotateAroundAxis(dir, [0, 0, 1], bandSpin);
    } else {
      const z = random() * 2 - 1;
      const radius = Math.sqrt(Math.max(0, 1 - z * z));
      const theta = random() * TWO_PI;
      dir = [Math.cos(theta) * radius, Math.sin(theta) * radius, z];
    }
    const brightSeed = random();
    const weight = clamp(1 - brightSeed ** 2.8, 0, 1);
    const color = tempToRgb(mix(3300, 9400, random() ** 1.35));
    stars.push({
      x: dir[0],
      y: dir[1],
      z: dir[2],
      r: mix(color[0], 1, inBand ? 0.20 : 0.10),
      g: mix(color[1], 0.96, inBand ? 0.16 : 0.08),
      b: mix(color[2], 0.90, inBand ? 0.08 : 0.04),
      weight,
      size: mix(0.66, 2.45, weight) * (inBand ? 1.12 : 1),
      alpha: mix(0.038, 0.205, weight) * (inBand ? 1.24 : 1),
      twinkle: random() * TWO_PI
    });
  }

  const clouds = [];
  for (let i = 0; i < cloudBudget; i += 1) {
    const longitude = random() * TWO_PI;
    const latitude = gaussian(random) * mix(0.035, 0.145, random());
    const cosLat = Math.cos(latitude);
    let dir = [Math.cos(longitude) * cosLat, Math.sin(longitude) * cosLat, Math.sin(latitude)];
    dir = rotateAroundAxis(dir, [1, 0, 0], bandTilt);
    dir = rotateAroundAxis(dir, [0, 0, 1], bandSpin + gaussian(random) * 0.10);
    const color = tempToRgb(mix(3600, 8200, random() ** 1.55));
    const weight = mix(0.34, 1.0, random() ** 0.78);
    clouds.push({
      x: dir[0],
      y: dir[1],
      z: dir[2],
      r: mix(color[0], 0.78, 0.16),
      g: mix(color[1], 0.78, 0.12),
      b: mix(color[2], 0.92, 0.22),
      weight,
      radius: mix(0.030, 0.090, random() ** 0.82),
      stretch: mix(1.55, 3.70, random()),
      alpha: mix(0.010, 0.032, weight) * (catalog.budget.key === "safe" ? 0.80 : 1),
      twinkle: random() * TWO_PI
    });
  }

  localSkyDome = { key, stars, clouds, bandTilt, bandSpin };
  return localSkyDome;
}

function drawLocalSkyDome(response, now, visual, presence, backdropEnergy) {
  if (presence < 0.01 || pointer.active < 0) return;
  const sky = ensureLocalSkyDome(pointer.active);
  const basis = cameraBasis();
  const surfaceReadiness = response.surfaceReadiness || 0;
  const energy =
    presence *
    backdropEnergy *
    (1.42 +
      smoothstep(0.18, 0.72, surfaceReadiness) * 0.46 +
      smoothstep(0.08, 0.34, response.surfaceDepth || 0) * 0.10);
  const occlusionRadius =
    visual && (visual.sphereVisibility || visual.surfaceAlpha || 0) > 0.05
      ? (visual.sphereScreenRadius || 0) * 1.04
      : 0;
  const activeScreen = visual?.p || { x: -1000, y: -1000 };

  for (const cloud of sky.clouds || []) {
    const dir = [cloud.x, cloud.y, cloud.z];
    const viewX = dot(dir, basis.right);
    const viewY = dot(dir, basis.up);
    const viewZ = dot(dir, basis.forward);
    if (viewZ < -0.18) continue;
    const edge = 1 - smoothstep(0.88, 1.14, Math.hypot(viewX, viewY));
    if (edge <= 0) continue;
    const x = (0.5 + viewX * 0.50) * view.width;
    const y = (0.5 - viewY * 0.50) * view.height;
    if (x < -180 || x > view.width + 180 || y < -160 || y > view.height + 160) continue;
    if (occlusionRadius > 0 && Math.hypot(x - activeScreen.x, y - activeScreen.y) < occlusionRadius * 1.12) continue;
    const radius = Math.min(view.width, view.height) * cloud.radius * (0.92 + smoothstep(0.18, 0.70, surfaceReadiness) * 0.10);
    const alpha =
      cloud.alpha *
      energy *
      edge *
      (0.90 + Math.sin(now * 0.00033 + cloud.twinkle) * 0.055);
    if (alpha < 0.002) continue;
    labelContext.save();
    labelContext.translate(x, y);
    labelContext.rotate(camera.yaw * 0.12 + cloud.twinkle);
    labelContext.scale(radius * cloud.stretch, radius);
    const glow = labelContext.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0.00, cssRgba(mix(cloud.r, 1, 0.16), mix(cloud.g, 0.96, 0.10), mix(cloud.b, 0.94, 0.12), alpha * 0.52));
    glow.addColorStop(0.38, cssRgba(cloud.r, cloud.g, cloud.b, alpha * 0.22));
    glow.addColorStop(1.00, cssRgba(cloud.r, cloud.g, cloud.b, 0));
    labelContext.fillStyle = glow;
    labelContext.beginPath();
    labelContext.arc(0, 0, 1, 0, TWO_PI);
    labelContext.fill();
    labelContext.restore();
  }

  for (const star of sky.stars) {
    const dir = [star.x, star.y, star.z];
    const viewX = dot(dir, basis.right);
    const viewY = dot(dir, basis.up);
    const viewZ = dot(dir, basis.forward);
    if (viewZ < -0.24) continue;
    const edge = 1 - smoothstep(0.94, 1.14, Math.hypot(viewX, viewY));
    if (edge <= 0) continue;
    const x = (0.5 + viewX * 0.50) * view.width;
    const y = (0.5 - viewY * 0.50) * view.height;
    if (x < -8 || x > view.width + 8 || y < -8 || y > view.height + 8) continue;
    if (occlusionRadius > 0 && Math.hypot(x - activeScreen.x, y - activeScreen.y) < occlusionRadius) continue;

    const twinkle = 0.96 + Math.sin(now * 0.0011 + star.twinkle) * 0.035;
    const alpha = star.alpha * energy * edge * twinkle;
    if (alpha < 0.004) continue;
    const radius = star.size * (1 + smoothstep(0.82, 1, star.weight) * 0.20);
    if (radius < 1.05) {
      labelContext.fillStyle = cssRgba(star.r, star.g, star.b, alpha * 1.35);
      labelContext.fillRect(x - 0.62, y - 0.62, 1.24, 1.24);
    } else {
      const gradient = labelContext.createRadialGradient(x, y, 0, x, y, radius * 2.30);
      gradient.addColorStop(0, cssRgba(mix(star.r, 1, 0.22), mix(star.g, 0.96, 0.14), mix(star.b, 0.92, 0.10), alpha));
      gradient.addColorStop(0.28, cssRgba(star.r, star.g, star.b, alpha * 0.30));
      gradient.addColorStop(1, cssRgba(star.r, star.g, star.b, 0));
      labelContext.fillStyle = gradient;
      labelContext.beginPath();
      labelContext.arc(x, y, radius * 2.30, 0, TWO_PI);
      labelContext.fill();
    }
  }
}

function drawCelestialBackdrop(response, now, visual) {
  const presence = response.celestialBackdropPresence || 0;
  if (presence < 0.01 || pointer.active < 0) return;

  const basis = cameraBasis();
  const active = pointer.active;
  const origin = [catalog.x[active], catalog.y[active], catalog.z[active]];
  const limit = Math.min(
    catalog.indexAtDraw.length,
    catalog.budget.key === "safe" ? 620 : catalog.budget.key === "immersive" ? 1180 : 960
  );
  const stride = Math.max(1, Math.floor(catalog.indexAtDraw.length / limit));
  const twinkle = 0.96 + Math.sin(now * 0.0014 + active * 0.11) * 0.014;
  const localBridge = response.localSystemBridge || 0;
  const backdropEnergy = response.backdropEnergy || 0.84;
  const surfaceReadiness = response.surfaceReadiness || 0;
  const occlusionRadius =
    visual && (visual.sphereVisibility || visual.surfaceAlpha || 0) > 0.08
      ? (visual.sphereScreenRadius || 0) * 1.06
      : 0;
  const activeScreen = visual?.p || { x: -1000, y: -1000 };

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  const r = catalog.r[active];
  const g = catalog.g[active];
  const b = catalog.b[active];
  const bandAlpha =
    presence *
    backdropEnergy *
    (0.016 +
      localBridge * 0.006 +
      (1 - smoothstep(0.55, 1, surfaceReadiness)) * 0.010 +
      smoothstep(0.70, 1, surfaceReadiness) * 0.012 +
      (response.surfaceDepth || 0) * 0.004);
  if (bandAlpha > 0.002) {
    const bandRadius = Math.max(view.width, view.height) * 0.82;
    const bandAngle = camera.yaw * 0.18 + seededUnit(active * 5.37 + 0.18) * TWO_PI;
    labelContext.save();
    labelContext.translate(view.width * 0.5, view.height * 0.52);
    labelContext.rotate(bandAngle);
    labelContext.scale(1, 0.22 + seededUnit(active * 6.31 + 0.4) * 0.08);
    const band = labelContext.createRadialGradient(0, 0, bandRadius * 0.10, 0, 0, bandRadius);
    band.addColorStop(
      0,
      cssRgba(mix(r, 0.55, 0.42), mix(g, 0.64, 0.34), mix(b, 0.92, 0.44), bandAlpha * 0.48)
    );
    band.addColorStop(
      0.42,
      cssRgba(mix(r, 0.34, 0.28), mix(g, 0.44, 0.24), mix(b, 0.72, 0.32), bandAlpha)
    );
    band.addColorStop(1, cssRgba(r, g, b, 0));
    labelContext.fillStyle = band;
    labelContext.beginPath();
    labelContext.arc(0, 0, bandRadius, 0, TWO_PI);
    labelContext.fill();
    labelContext.restore();
  }

  drawLocalSkyDome(response, now, visual, presence, backdropEnergy);

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
    if (occlusionRadius > 0 && Math.hypot(x - activeScreen.x, y - activeScreen.y) < occlusionRadius) continue;
    const importance = catalog.importance[index];
    const lumT = clamp(catalog.lum[index] / 2.15, 0, 1);
    const weight = clamp(Math.max(Math.sqrt(lumT), importance * 1.08), 0, 1);
    const radius = mix(0.52, 1.72, weight) * (1 + localBridge * 0.08);
    const alpha =
      presence *
      edge *
      twinkle *
      mix(0.020, 0.082, weight) *
      backdropEnergy *
      (0.94 + localBridge * 0.06) *
      (1 - smoothstep(0.86, 1, surfaceReadiness) * 0.18);
    if (alpha < 0.004) continue;
    if (radius < 0.92 && alpha < 0.020) {
      labelContext.fillStyle = cssRgba(
        mix(catalog.r[index], 1, 0.18),
        mix(catalog.g[index], 0.96, 0.14),
        mix(catalog.b[index], 0.90, 0.12),
        alpha * 1.2
      );
      labelContext.fillRect(x - 0.55, y - 0.55, 1.1, 1.1);
    } else {
      const gradient = labelContext.createRadialGradient(x, y, 0, x, y, radius * 2.45);
      gradient.addColorStop(
        0,
        cssRgba(
          mix(catalog.r[index], 1, 0.24),
          mix(catalog.g[index], 0.96, 0.18),
          mix(catalog.b[index], 0.90, 0.16),
          alpha
        )
      );
      gradient.addColorStop(0.24, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], alpha * 0.24));
      gradient.addColorStop(1, cssRgba(catalog.r[index], catalog.g[index], catalog.b[index], 0));
      labelContext.fillStyle = gradient;
      labelContext.beginPath();
      labelContext.arc(x, y, radius * 2.45, 0, TWO_PI);
      labelContext.fill();
    }
  }
  labelContext.restore();
}

function drawLocalSystemShell(response, visual) {
  const presence = response.localSystemLayer?.presence ?? response.localSystemPresence ?? 0;
  if (presence < 0.01 || pointer.active < 0 || visual?.index !== pointer.active) return;
  const p = visual.p;
  if (Math.abs(p.ndcX) > 1.35 || Math.abs(p.ndcY) > 1.35) return;

  const sphereRadius = visual?.sphereScreenRadius || 0;
  const surfacePreview = Math.max(response.surfacePresence || 0, visual?.surfaceAlpha || 0);
  const surfaceTakeover = Math.max(
    response.surfaceLayer?.presence ?? response.surfaceReadiness ?? response.surfacePresence ?? 0,
    surfacePreview,
    smoothstep(42, 84, sphereRadius)
  );
  const surfaceFade =
    1 -
    smoothstep(0.025, 0.16, surfaceTakeover);
  const activeLeadFade = 1 - smoothstep(0.10, 0.44, visual?.stellarOpticalLeadIn || 0) * 0.68;
  const visible = presence * surfaceFade * activeLeadFade * (response.localStructureEnergy || 0.82) * 0.045;
  if (visible < 0.01) return;

  const baseRadius = Math.min(view.width, view.height) * mix(0.20, 0.42, presence);
  const index = pointer.active;
  const displayColor = stellarDisplayColor(index);
  const r = displayColor.r;
  const g = displayColor.g;
  const b = displayColor.b;

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  const shellRadius = baseRadius * 1.26;
  const glow = labelContext.createRadialGradient(p.x, p.y, 0, p.x, p.y, shellRadius);
  glow.addColorStop(0, cssRgba(mix(r, 1, 0.36), mix(g, 0.94, 0.25), mix(b, 0.86, 0.20), 0.010 * visible));
  glow.addColorStop(0.56, cssRgba(r, g, b, 0.005 * visible));
  glow.addColorStop(1, cssRgba(r, g, b, 0));
  labelContext.fillStyle = glow;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, shellRadius, 0, TWO_PI);
  labelContext.fill();
  labelContext.restore();
}

function drawContinuousStellarSurfaceLayer(canvas, bodySize, spinOffsetPx, horizontalScale = 1.08, clipScale = 0.492) {
  if (!canvas || bodySize <= 0) return;
  const drawWidth = bodySize * horizontalScale;
  const drawHeight = bodySize;
  const drift = ((spinOffsetPx % drawWidth) + drawWidth) % drawWidth;

  labelContext.save();
  labelContext.beginPath();
  labelContext.arc(0, 0, bodySize * clipScale, 0, TWO_PI);
  labelContext.clip("nonzero");
  for (let tile = -2; tile <= 1; tile += 1) {
    labelContext.drawImage(canvas, -drawWidth * 0.5 + drift + tile * drawWidth, -drawHeight * 0.5, drawWidth, drawHeight);
  }
  labelContext.restore();
}

function longitudinalSpinOffsetPx(bodySize, spinPhase, travel = 0.64) {
  return spinPhase * bodySize * travel;
}

function ensurePhotosphereMicrograinSprite(index) {
  if (typeof OffscreenCanvas === "undefined" || !catalog || index < 0 || index >= catalog.count) {
    return null;
  }
  const key = `micrograin:${stellarGlowKey(index)}`;
  if (photosphereMicrograinSprite?.key === key) return photosphereMicrograinSprite;
  const size = config.budget === "safe" ? 160 : 224;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  const random = createRandom((config.seed + (index + 1) * 65537 + 811) % 2147483647);
  const displayColor = stellarDisplayColor(index);
  const count =
    catalog.budget.key === "safe"
      ? 1050
      : catalog.budget.key === "immersive"
        ? 2200
        : 1600;
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < count; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const hot = random() > 0.34;
    const alpha = hot ? mix(0.065, 0.155, random()) : mix(0.020, 0.065, random());
    const dot = mix(0.45, 1.36, random() ** 0.55);
    ctx.fillStyle = hot
      ? cssRgba(mix(displayColor.r, 1, 0.92), mix(displayColor.g, 1, 0.70), mix(displayColor.b, 0.86, 0.34), alpha)
      : cssRgba(mix(displayColor.r, 0.82, 0.22), mix(displayColor.g, 0.64, 0.20), mix(displayColor.b, 0.38, 0.14), alpha);
    ctx.fillRect(x, y, dot, dot);
  }
  photosphereMicrograinSprite = { key, canvas, size };
  return photosphereMicrograinSprite;
}

function drawPhotosphereMicrograin(index, now, p, bodyRadius, alpha, surfaceAxisTilt, renderSpinCycle = stellarSpinCycle(index, now)) {
  if (alpha < 0.006 || bodyRadius < 48) return;
  const sprite = ensurePhotosphereMicrograinSprite(index);
  if (!sprite) return;
  const tileSize = bodyRadius * 0.82;
  const spinOffset = longitudinalSpinOffsetPx(tileSize, renderSpinCycle, 0.86);
  const offset = ((spinOffset % tileSize) + tileSize) % tileSize;

  labelContext.save();
  labelContext.translate(p.x, p.y);
  labelContext.rotate(surfaceAxisTilt);
  labelContext.beginPath();
  labelContext.arc(0, 0, bodyRadius * 0.955, 0, TWO_PI);
  labelContext.clip("nonzero");
  labelContext.globalCompositeOperation = "screen";
  labelContext.globalAlpha = Math.min(0.72, alpha);
  for (let x = -tileSize * 2 + offset; x < tileSize * 1.5; x += tileSize) {
    for (let y = -tileSize * 2; y < tileSize * 1.5; y += tileSize) {
      labelContext.drawImage(sprite.canvas, x, y, tileSize, tileSize);
    }
  }
  labelContext.restore();
  labelContext.globalAlpha = 1;
}

function drawWhiteHotActivityGrain(index, now, p, bodyRadius, r, g, b, alpha, surfaceAxisTilt, renderSpinCycle = stellarSpinCycle(index, now)) {
  if (alpha < 0.006 || bodyRadius < 48) return;
  const count =
    catalog.budget.key === "safe"
      ? 180
      : catalog.budget.key === "immersive"
        ? 380
        : 300;
  const random = createRandom((config.seed + (index + 1) * 13007 + 1543) % 2147483647);
  const phase = renderSpinCycle * TWO_PI;

  labelContext.save();
  labelContext.translate(p.x, p.y);
  labelContext.rotate(surfaceAxisTilt);
  labelContext.beginPath();
  labelContext.arc(0, 0, bodyRadius * 0.965, 0, TWO_PI);
  labelContext.clip("nonzero");
  labelContext.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i += 1) {
    const longitude = random() * TWO_PI + phase * (0.54 + random() * 0.12);
    const latitude = Math.asin(clamp(gaussian(random) * 0.46, -0.96, 0.96));
    const cosLat = Math.cos(latitude);
    const x = Math.sin(longitude) * cosLat * bodyRadius * 0.82;
    const y = Math.sin(latitude) * bodyRadius * 0.76;
    const normalizedRadius = Math.hypot(x / bodyRadius, y / bodyRadius);
    if (normalizedRadius > 0.96) continue;
    const limb = Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
    const size = mix(0.65, 3.25, random() ** 0.58) * mix(0.72, 1.20, limb);
    const sparkle = alpha * mix(0.040, 0.145, random() ** 1.32) * (0.58 + limb * 0.42);
    if (sparkle < 0.004) continue;
    labelContext.globalAlpha = Math.min(0.22, sparkle);
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.98),
      mix(g, 0.98, 0.86),
      mix(b, 0.48, 0.24),
      1
    );
    labelContext.beginPath();
    if (random() > 0.72) {
      labelContext.ellipse(x, y, size * mix(1.15, 2.25, random()), size * mix(0.42, 0.78, random()), phase + longitude * 0.32, 0, TWO_PI);
    } else {
      labelContext.arc(x, y, size, 0, TWO_PI);
    }
    labelContext.fill();
  }

  labelContext.restore();
  labelContext.globalAlpha = 1;
}

function drawPhotosphereGranulation(index, now, p, bodyRadius, r, g, b, alpha, surfaceAxisTilt, renderSpinCycle = stellarSpinCycle(index, now)) {
  if (alpha < 0.006 || bodyRadius < 42) return;
  const count =
    catalog.budget.key === "safe"
      ? 520
      : catalog.budget.key === "immersive"
        ? 1050
        : 760;
  const random = createRandom((config.seed + (index + 1) * 7919 + 173) % 2147483647);
  const phase = renderSpinCycle * TWO_PI;

  labelContext.save();
  labelContext.translate(p.x, p.y);
  labelContext.rotate(surfaceAxisTilt);
  labelContext.beginPath();
  labelContext.arc(0, 0, bodyRadius * 0.965, 0, TWO_PI);
  labelContext.clip("nonzero");

  for (let i = 0; i < count; i += 1) {
    const longitude = random() * TWO_PI + phase * (0.56 + random() * 0.08);
    const latitude = Math.asin(clamp(gaussian(random) * 0.42, -0.96, 0.96));
    const cosLat = Math.cos(latitude);
    const x = Math.sin(longitude) * cosLat * bodyRadius * 0.86;
    const y = Math.sin(latitude) * bodyRadius * 0.78;
    const normalizedRadius = Math.hypot(x / bodyRadius, y / bodyRadius);
    if (normalizedRadius > 0.965) continue;
    const limb = Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
    const size = mix(0.46, 2.20, random() ** 0.58) * mix(0.78, 1.16, limb);
    const hot = random() > 0.18;
    labelContext.globalCompositeOperation = hot ? "screen" : "source-over";
    labelContext.globalAlpha = alpha * (hot ? mix(0.145, 0.360, random()) : mix(0.040, 0.115, random())) * (0.54 + limb * 0.46);
    labelContext.fillStyle = hot
      ? cssRgba(mix(r, 1, 0.90), mix(g, 1, 0.72), mix(b, 0.88, 0.36), 1)
      : cssRgba(mix(r, 0.82, 0.22), mix(g, 0.64, 0.18), mix(b, 0.38, 0.12), 1);
    labelContext.beginPath();
    labelContext.arc(x, y, size, 0, TWO_PI);
    labelContext.fill();
  }

  labelContext.restore();
  labelContext.globalAlpha = 1;
}

function drawPhotosphereFilamentRidges(index, now, p, bodyRadius, r, g, b, alpha, surfaceAxisTilt, renderSpinCycle = stellarSpinCycle(index, now)) {
  if (alpha < 0.006 || bodyRadius < 48) return;
  const count =
    catalog.budget.key === "safe"
      ? 42
      : catalog.budget.key === "immersive"
        ? 86
        : 64;
  const random = createRandom((config.seed + (index + 1) * 104729 + 509) % 2147483647);
  const phase = renderSpinCycle * TWO_PI;

  labelContext.save();
  labelContext.translate(p.x, p.y);
  labelContext.rotate(surfaceAxisTilt);
  labelContext.beginPath();
  labelContext.arc(0, 0, bodyRadius * 0.955, 0, TWO_PI);
  labelContext.clip("nonzero");
  labelContext.lineCap = "round";
  labelContext.lineJoin = "round";

  for (let i = 0; i < count; i += 1) {
    const seed = random();
    const longitude = seed * TWO_PI + phase * (0.58 + random() * 0.12);
    const latitude = Math.asin(clamp(gaussian(random) * 0.44, -0.92, 0.92));
    const cosLat = Math.cos(latitude);
    const x = Math.sin(longitude) * cosLat * bodyRadius * 0.82;
    const y = Math.sin(latitude) * bodyRadius * 0.76;
    const normalizedRadius = Math.hypot(x / bodyRadius, y / bodyRadius);
    if (normalizedRadius > 0.94) continue;
    const limb = Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
    const tangentAngle =
      Math.atan2(Math.sin(latitude) * 0.30 + Math.cos(longitude + phase * 0.08) * 0.16, Math.cos(longitude) * cosLat + 0.06);
    const length = bodyRadius * mix(0.060, 0.165, random()) * (0.70 + limb * 0.52);
    const bend = bodyRadius * mix(-0.022, 0.022, random()) * (0.50 + limb * 0.50);
    const dx = Math.cos(tangentAngle) * length;
    const dy = Math.sin(tangentAngle) * length;
    const nx = -Math.sin(tangentAngle);
    const ny = Math.cos(tangentAngle);
    const width = Math.max(0.8, bodyRadius * mix(0.0056, 0.0130, random()) * (0.70 + limb * 0.44));
    const strength = alpha * (0.42 + limb * 0.58) * mix(0.64, 1.0, random());
    const hot = random() > 0.18;

    labelContext.globalCompositeOperation = hot ? "screen" : "source-over";
    labelContext.globalAlpha = Math.min(hot ? 0.300 : 0.120, strength * (hot ? 0.275 : 0.100));
    labelContext.strokeStyle = hot
      ? cssRgba(mix(r, 1, 0.96), mix(g, 1, 0.78), mix(b, 0.86, 0.40), 1)
      : cssRgba(mix(r, 0.82, 0.20), mix(g, 0.62, 0.16), mix(b, 0.38, 0.10), 1);
    labelContext.lineWidth = width;
    labelContext.beginPath();
    labelContext.moveTo(x - dx * 0.48, y - dy * 0.48);
    labelContext.quadraticCurveTo(x + nx * bend, y + ny * bend, x + dx * 0.48, y + dy * 0.48);
    labelContext.stroke();

    if (hot && random() > 0.42) {
      labelContext.globalCompositeOperation = "lighter";
      labelContext.globalAlpha = Math.min(0.125, strength * 0.110);
      labelContext.lineWidth = Math.max(0.45, width * 0.45);
      labelContext.strokeStyle = cssRgba(1, mix(g, 1, 0.90), mix(b, 0.86, 0.46), 1);
      labelContext.beginPath();
      labelContext.moveTo(x - dx * 0.34, y - dy * 0.34);
      labelContext.quadraticCurveTo(x + nx * bend * 0.45, y + ny * bend * 0.45, x + dx * 0.34, y + dy * 0.34);
      labelContext.stroke();
    }
  }

  labelContext.restore();
  labelContext.globalAlpha = 1;
}

function drawLocalAtmosphere(t, now, response, visual) {
  const presentation = visual?.activeStarPresentation || {};
  const bodyPresence = clamp(presentation.primaryAlpha ?? visual?.surfaceAlpha ?? 0, 0, 1);
  const surface = clamp(presentation.surfaceDetailAlpha ?? visual?.surfaceAlpha ?? 0, 0, 1);
  const bakedGlowStrength = Math.max(visual?.activeGlowStrength || 0, presentation.coronaAlpha || 0, presentation.bloomAlpha || 0);
  const opticalLead = Math.max(visual?.stellarOpticalLeadIn || 0, presentation.localSystemAlpha || 0);
  if (Math.max(bodyPresence, surface, bakedGlowStrength, opticalLead) < 0.006 || pointer.active < 0 || visual?.index !== pointer.active) return;

  const index = pointer.active;
  const p = visual.p;
  const visible = Math.max(bodyPresence, surface, bakedGlowStrength * 0.76, opticalLead);
  if (visible < 0.006) return;

  const displayColor = stellarDisplayColor(index);
  const r = displayColor.r;
  const g = displayColor.g;
  const b = displayColor.b;
  const activity = stellarActivity(index);
  const viewportRadius = Math.hypot(view.width, view.height);
  const minDimension = Math.min(view.width, view.height);
  const surfaceDepth = response?.surfaceDepth || visual?.surfaceDepth || 0;
  const localSystemPresence = response?.localSystemPresence || 0;
  const localSystemLeadPresence = clamp(
    Math.max(
      localSystemPresence,
      (response?.localMapBridgePresence || 0) * (response?.scaleStage === "LocalSystem" ? 0.58 : 0.12),
      (response?.surfacePresence || 0) * 0.42
    ),
    0,
    1
  );
  const localSystemStageGate =
    response?.scaleStage === "LocalSystem" || response?.scaleStage === "Surface"
      ? 1
      : smoothstep(0.06, 0.18, localSystemPresence) * 0.28;
  const localSystemPreviewStrength =
    smoothstep(0.10, 0.42, opticalLead) *
    smoothstep(0.08, 0.36, localSystemLeadPresence) *
    localSystemStageGate *
    (1 - smoothstep(0.62, 0.92, response?.surfaceReadiness || 0) * 0.35);
  const localSystemPreviewRadius =
    minDimension *
    mix(0.060, 0.098, localSystemPreviewStrength) *
    smoothstep(0.10, 0.34, Math.max(opticalLead, localSystemLeadPresence));
  const sphereBodyRadiusScale = 1;
  const apparentBodyRadius = (visual.apparentRadiusPx || 0) * sphereBodyRadiusScale;
  const sphereBodyRadius = (visual.sphereScreenRadius || 0) * sphereBodyRadiusScale;
  const maxBodyRadius = minDimension * mix(0.18, 0.205, smoothstep(0.12, 0.92, surfaceDepth));
  const maxOpticalRadius = minDimension * 0.46;
  const bodyRadius = clamp(
    Math.max(
      presentation.radiusPx || 0,
      apparentBodyRadius,
      sphereBodyRadius,
      localSystemPreviewRadius,
      42 * smoothstep(0.18, 0.72, localSystemPresence)
    ),
    0,
    maxBodyRadius
  );
  const opticalRadius = clamp(Math.max(bodyRadius, visual.activeGlowRadius || 0), 0, maxOpticalRadius);
  if (opticalRadius < 2) return;
  if (
    p.x < -opticalRadius * 2 ||
    p.x > view.width + opticalRadius * 2 ||
    p.y < -opticalRadius * 2 ||
    p.y > view.height + opticalRadius * 2
  ) {
    return;
  }

  const detailFade =
    smoothstep(28, 180, bodyRadius) *
    (1 - smoothstep(minDimension * 0.82, minDimension * 1.08, bodyRadius));
  const detailEnergy = clamp(detailFade * (1 + surfaceDepth * 0.26), 0, 1.12);
  const closeFocusTrim =
    1 -
    smoothstep(420, 720, bodyRadius) *
      smoothstep(0.52, 1, surface) *
      0.12;
  const surfaceSpriteFade =
    1 -
    smoothstep(180, 420, bodyRadius) *
      smoothstep(0.16, 0.58, surface);
  const coronaSpriteFade =
    1 -
    smoothstep(240, 620, bodyRadius) *
      smoothstep(0.26, 0.76, surface);
  const broadCoronaFade =
    1 -
    smoothstep(320, 760, opticalRadius) *
      smoothstep(0.38, 0.86, surface);
  const surfaceOpticalEnergy = response?.surfaceOpticalEnergy || 0.76;
  const surfaceReadiness = response?.surfaceReadiness || surface;
  const radiusEnergy = mix(1.18, 0.72, smoothstep(260, 620, bodyRadius));
  const haloAreaEnergy = mix(1.12, 0.58, smoothstep(280, 700, opticalRadius));
  const closeSurfaceShellFade =
    1 -
    smoothstep(0.58, 0.92, surfaceReadiness) *
      smoothstep(82, 132, bodyRadius) *
      0.88;
  const environmentDim =
    smoothstep(0.72, 0.98, response?.surfaceReadiness || 0) *
    smoothstep(minDimension * 0.42, minDimension * 0.82, bodyRadius) *
    visible *
    (0.82 + surfaceDepth * 0.04);
  const surfacePose = stellarProjectedPose(index);
  const surfaceAxisTilt = surfacePose.axisTilt;
  const surfaceSpinPhase = stellarPhase(index, now);
  const surfaceSpinCycle = stellarSpinCycle(index, now);
  const surfaceViewSpinCycle = surfaceSpinCycle + surfacePose.longitudePhase * 1.05;

  labelContext.save();
  labelContext.globalAlpha = 1;
  labelContext.shadowBlur = 0;
  labelContext.shadowColor = "rgba(0, 0, 0, 0)";
  labelContext.globalCompositeOperation = "source-over";
  if (environmentDim > 0.006) {
    labelContext.fillStyle = `rgba(0, 2, 8, ${0.018 * environmentDim})`;
    labelContext.fillRect(0, 0, view.width, view.height);
  }

  const surfaceSprite = ensureStellarSurfaceSprite(index, now);
  const preSurfaceOpticalStage = response?.scaleStage === "LocalMap" || response?.scaleStage === "LocalSystem";
  const localOpticalStage = preSurfaceOpticalStage || response?.scaleStage === "Surface";
  const localMapLeadGate = response?.scaleStage === "LocalSystem" ? 1 : 0.24;
  const stageLeadBody =
    preSurfaceOpticalStage
      ? smoothstep(0.04, 0.34, opticalLead) *
        (0.20 + opticalLead * 0.16 + surface * 0.24 + (visual?.localApproach || 0) * 0.10) *
        (1 - smoothstep(0.30, 0.58, surfaceReadiness) * 0.65) *
        (1 - smoothstep(0.24, 0.48, surface) * 0.40) *
        localMapLeadGate
      : 0;
  const leadBody = Math.max(
    stageLeadBody,
    smoothstep(0.18, 0.56, opticalLead) *
      (0.16 + opticalLead * 0.22) *
      (response?.scaleStage === "LocalSystem" ? 1 : 0.18) *
      (1 - smoothstep(0.52, 0.90, response?.surfaceReadiness || 0)),
    smoothstep(0.18, 0.55, localSystemPresence) *
      (0.36 + opticalLead * 0.45) *
      (1 - smoothstep(0.20, 0.46, surfaceReadiness)) *
      (1 - smoothstep(0.42, 0.62, surface))
  );
  const localSystemTextureLead =
    localSystemPreviewStrength *
    smoothstep(50, 96, bodyRadius) *
    (1 - smoothstep(0.50, 0.82, surfaceReadiness)) *
    closeFocusTrim;
  const leadPreviewAlpha = clamp(
    (localOpticalStage ? 1 : 0) *
      smoothstep(0.08, 0.34, opticalLead) *
      (1 - smoothstep(0.14, 0.34, surfaceReadiness)) *
      (1 - smoothstep(0.16, 0.34, surface)) *
      (1 - smoothstep(110, 158, bodyRadius)) *
      (0.46 + surface * 1.14 + (visual?.localApproach || 0) * 0.24) *
      closeFocusTrim,
    0,
    0.52
  );
  if (leadPreviewAlpha > 0.006 && bodyRadius > 18) {
    const preview = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.08, p.x, p.y, bodyRadius * 1.03);
    preview.addColorStop(
      0,
      cssRgba(mix(r, 1, 0.94), mix(g, 1, 0.76), mix(b, 0.88, 0.42), leadPreviewAlpha)
    );
    preview.addColorStop(
      0.54,
      cssRgba(mix(r, 1, 0.76), mix(g, 0.96, 0.50), mix(b, 0.70, 0.26), leadPreviewAlpha * 0.58)
    );
    preview.addColorStop(
      0.86,
      cssRgba(mix(r, 1, 0.55), mix(g, 0.86, 0.32), mix(b, 0.42, 0.12), leadPreviewAlpha * 0.20)
    );
    preview.addColorStop(1, cssRgba(r, g, b, 0));
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = preview;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 1.03, 0, TWO_PI);
    labelContext.fill();
  }
  const broadSurfaceAtlasFade = 1;
  const localSystemWhiteHotLead =
    surface *
      smoothstep(0.24, 0.64, localSystemPresence) *
      (1 - smoothstep(0.22, 0.58, surfaceReadiness)) *
      (0.82 + opticalLead * 0.42) *
      closeFocusTrim +
    localSystemTextureLead * 0.72 +
    (response?.scaleStage === "LocalSystem"
      ? smoothstep(0.40, 0.92, localSystemPresence) *
        smoothstep(54, 88, bodyRadius) *
        (1 - smoothstep(0.12, 0.38, surfaceReadiness)) *
        (0.30 + opticalLead * 0.22)
      : 0);
  const earlyPhotosphereAnchor =
    clamp(
      (smoothstep(0.16, 0.54, surface) +
        opticalLead * 0.44 +
        localSystemPresence * 0.24 +
        localSystemTextureLead * 0.58) *
        smoothstep(54, 92, bodyRadius) *
        (1 - smoothstep(0.22, 0.54, surfaceReadiness)) *
        closeFocusTrim,
      0,
      1
    );
  const localSystemAtlasDeemphasis =
    1 -
    smoothstep(0.20, 0.60, localSystemPresence) *
      (1 - smoothstep(0.18, 0.50, surfaceReadiness)) *
      0.18;
  const settledMeanAnchor = 1 - smoothstep(0.62, 0.90, surfaceReadiness) * 0.18;
  const surfaceOverlayAlpha = Math.max(
    presentation.photosphereAlpha || 0,
    surface *
      mix(0.54, 0.78, smoothstep(0.22, 0.76, surfaceReadiness)) *
      (0.80 + smoothstep(0.70, 0.94, surfaceReadiness) * 0.20) *
      (0.82 + smoothstep(0.70, 0.94, surfaceReadiness) * 0.18) *
      (1 -
        smoothstep(0.72, 0.96, surfaceReadiness) *
          smoothstep(82, 145, visual?.sphereScreenRadius || 0) *
          0.18) *
      settledMeanAnchor *
      broadSurfaceAtlasFade
  );
  const photosphereAlpha = clamp(
    surfaceOverlayAlpha +
      leadBody +
      localSystemTextureLead * 0.52 +
      smoothstep(0.08, 0.28, response?.surfacePresence || 0) * 0.018 * broadSurfaceAtlasFade,
    0,
    0.72
  ) * closeFocusTrim * localSystemAtlasDeemphasis;
  if (surfaceSprite && photosphereAlpha > 0.015 && bodyRadius > 18) {
    const bodySize = bodyRadius * mix(2.02, 2.12, detailEnergy);
    const bodyClipRadius = bodyRadius * 1.006;
    const bodyClipScale = bodyClipRadius / bodySize;
    const baseSurfaceSpinOffsetPx = longitudinalSpinOffsetPx(bodySize, surfaceViewSpinCycle, 0.62);
    labelContext.save();
    labelContext.translate(p.x, p.y);
    labelContext.rotate(surfaceAxisTilt);
    labelContext.beginPath();
    labelContext.arc(0, 0, bodyClipRadius, 0, TWO_PI);
    labelContext.clip("nonzero");
    labelContext.globalCompositeOperation = surfaceReadiness > 0.34 ? "source-over" : "screen";
    labelContext.globalAlpha = Math.min(0.34, photosphereAlpha * mix(0.34, 0.46, surfaceReadiness));
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.98),
      mix(g, 1, 0.78),
      mix(b, 0.58, 0.22),
      1
    );
    labelContext.beginPath();
    labelContext.arc(0, 0, bodyClipRadius, 0, TWO_PI);
    labelContext.fill();
    labelContext.globalCompositeOperation = "screen";
    labelContext.globalAlpha = Math.min(0.36, photosphereAlpha * mix(0.42, 0.56, surfaceReadiness));
    drawContinuousStellarSurfaceLayer(surfaceSprite.tileCanvas || surfaceSprite.canvas, bodySize, baseSurfaceSpinOffsetPx, 1.10, bodyClipScale);
    labelContext.restore();
    labelContext.globalAlpha = 1;
  }
  if (earlyPhotosphereAnchor > 0.006 && bodyRadius > 18) {
    const hotCore = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.05, p.x, p.y, bodyRadius * 1.02);
    hotCore.addColorStop(
      0.00,
      cssRgba(mix(r, 1, 0.98), mix(g, 1, 0.86), mix(b, 0.92, 0.50), Math.min(0.22, earlyPhotosphereAnchor * 0.26))
    );
    hotCore.addColorStop(
      0.46,
      cssRgba(mix(r, 1, 0.94), mix(g, 1, 0.76), mix(b, 0.84, 0.38), Math.min(0.16, earlyPhotosphereAnchor * 0.19))
    );
    hotCore.addColorStop(
      0.84,
      cssRgba(mix(r, 1, 0.76), mix(g, 0.96, 0.52), mix(b, 0.70, 0.24), Math.min(0.070, earlyPhotosphereAnchor * 0.080))
    );
    hotCore.addColorStop(1, cssRgba(r, g, b, 0));
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = hotCore;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 1.02, 0, TWO_PI);
    labelContext.fill();
  }
  const rotationalFlowAlpha =
    surfaceSprite?.flowCanvas && bodyRadius > 18
      ? (Math.max(surface, presentation.flowAlpha || 0) *
          (0.18 + smoothstep(0.26, 0.82, surfaceReadiness) * 0.28) +
          leadBody * 0.34 +
          opticalLead * smoothstep(36, 118, bodyRadius) * (1 - smoothstep(0.42, 0.72, surfaceReadiness)) * 0.10) *
        closeFocusTrim *
        (0.86 + detailEnergy * 0.18) *
        (0.94 + settledMeanAnchor * 0.06)
      : 0;
  if (surfaceSprite?.flowCanvas && rotationalFlowAlpha > 0.006) {
    const bodySize = bodyRadius * mix(2.02, 2.12, detailEnergy);
    const surfaceSpinOffsetPx = longitudinalSpinOffsetPx(bodySize, surfaceViewSpinCycle, 0.64);
    labelContext.globalCompositeOperation = surfaceReadiness > 0.42 ? "screen" : "lighter";
    labelContext.globalAlpha = Math.min(0.045, rotationalFlowAlpha * 0.12);
    labelContext.save();
    labelContext.translate(p.x, p.y);
    labelContext.rotate(surfaceAxisTilt);
    drawContinuousStellarSurfaceLayer(surfaceSprite.flowCanvas, bodySize, surfaceSpinOffsetPx, 1.12, 0.430);
    labelContext.restore();
    labelContext.globalAlpha = 1;
  }
  const leadEmissionAlpha =
    (leadBody * 0.135 + localSystemTextureLead * 0.070) *
    (1 - smoothstep(0.18, 0.58, surfaceReadiness));
  const settledSurfaceRetreat = smoothstep(0.84, 1.0, surfaceReadiness);
  const photosphereEmissionAlpha =
    (leadEmissionAlpha +
        surface *
          smoothstep(0.14, 0.76, surfaceReadiness) *
          (0.145 + detailEnergy * 0.034 + surfaceDepth * 0.012) *
        (1 - settledSurfaceRetreat * 0.45) *
        settledMeanAnchor) *
    closeFocusTrim;
  if (photosphereEmissionAlpha > 0.003 && bodyRadius > 18) {
    labelContext.globalCompositeOperation = "lighter";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.88),
      mix(g, 1, 0.70),
      mix(b, 0.86, 0.38),
      photosphereEmissionAlpha
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.990, 0, TWO_PI);
    labelContext.fill();
  }
  const leadPhotosphereWash =
    response?.scaleStage === "LocalSystem"
      ? opticalLead *
        smoothstep(0.08, 0.46, opticalLead) *
        (1 - smoothstep(0.08, 0.38, surface)) *
        0.24
      : 0;
  const photosphereWashAlpha =
    clamp(
      (leadPhotosphereWash * 0.42 +
        localSystemTextureLead * 0.025 +
        surface * 0.026 +
        surface *
          smoothstep(0.16, 0.72, surfaceReadiness) *
          0.044) *
        (1 - smoothstep(0.66, 0.92, surfaceReadiness) * 0.38) *
        settledMeanAnchor *
        closeFocusTrim,
      0,
      mix(0.16, 0.24, smoothstep(0.82, 1, surfaceReadiness))
    );
  if (photosphereWashAlpha > 0.01 && bodyRadius > 18) {
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.92),
      mix(g, 0.99, 0.78),
      mix(b, 0.82, 0.46),
      photosphereWashAlpha
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.995, 0, TWO_PI);
    labelContext.fill();
  }
  if (localSystemWhiteHotLead > 0.012 && bodyRadius > 18) {
    labelContext.globalCompositeOperation = "source-over";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.96),
      mix(g, 1, 0.80),
      mix(b, 0.86, 0.44),
      Math.min(0.22, localSystemWhiteHotLead * 0.46)
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.990, 0, TWO_PI);
    labelContext.fill();
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.98),
      mix(g, 1, 0.84),
      mix(b, 0.90, 0.52),
      Math.min(0.12, localSystemWhiteHotLead * 0.24)
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.998, 0, TWO_PI);
    labelContext.fill();
  }
  const photosphereEqualizeAlpha =
    (surface *
      smoothstep(0.36, 0.60, surfaceReadiness) *
      (0.105 + detailEnergy * 0.026) *
      (1 - smoothstep(0.66, 0.94, surfaceReadiness) * 0.64) +
      localSystemWhiteHotLead * 0.08) *
    closeFocusTrim;
  if (photosphereEqualizeAlpha > 0.01 && bodyRadius > 18) {
    labelContext.globalCompositeOperation = "source-over";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.94),
      mix(g, 1, 0.78),
      mix(b, 0.82, 0.42),
      Math.min(0.08, photosphereEqualizeAlpha)
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.990, 0, TWO_PI);
    labelContext.fill();
  }
  const localSystemPhotosphereFloorAlpha =
    (localSystemWhiteHotLead * 0.32 +
      localSystemTextureLead * 0.28 +
      opticalLead *
        smoothstep(0.18, 0.62, localSystemPresence) *
        (1 - smoothstep(0.20, 0.52, surfaceReadiness)) *
        0.10) *
    smoothstep(48, 112, bodyRadius) *
    closeFocusTrim;
  if (localSystemPhotosphereFloorAlpha > 0.012 && bodyRadius > 18) {
    const previewFloor = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.04, p.x, p.y, bodyRadius * 0.995);
    previewFloor.addColorStop(
      0.00,
      cssRgba(mix(r, 1, 0.98), mix(g, 1, 0.88), mix(b, 0.92, 0.54), Math.min(0.42, localSystemPhotosphereFloorAlpha * 0.62))
    );
    previewFloor.addColorStop(
      0.48,
      cssRgba(mix(r, 1, 0.94), mix(g, 1, 0.78), mix(b, 0.86, 0.42), Math.min(0.31, localSystemPhotosphereFloorAlpha * 0.44))
    );
    previewFloor.addColorStop(
      0.86,
      cssRgba(mix(r, 1, 0.84), mix(g, 0.98, 0.60), mix(b, 0.78, 0.32), Math.min(0.16, localSystemPhotosphereFloorAlpha * 0.22))
    );
    previewFloor.addColorStop(1, cssRgba(r, g, b, 0));
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = previewFloor;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.995, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.globalCompositeOperation = "lighter";
  const sprite = ensureStellarGlowSprite(index);
  const glowStrength =
    clamp(
      bakedGlowStrength * surfaceOpticalEnergy * (0.92 + detailEnergy * 0.26) + opticalLead * 0.42,
      0,
      1.16
    ) *
    (1 - smoothstep(minDimension * 0.96, minDimension * 1.38, opticalRadius)) *
    closeFocusTrim;
  const closeCoreGlowFade = 1 - smoothstep(0.50, 0.94, surfaceReadiness) * smoothstep(0.40, 0.86, surface) * 0.62;
  const localSystemBroadHazeTrim =
    response?.scaleStage === "LocalSystem"
      ? mix(1, 0.10, smoothstep(0.20, 0.88, Math.max(localSystemTextureLead, localSystemPresence)))
      : 1;
  const radialCoronaAlpha =
    glowStrength *
    Math.max(surfaceSpriteFade, coronaSpriteFade) *
    broadCoronaFade *
    closeCoreGlowFade *
    localSystemBroadHazeTrim *
    closeSurfaceShellFade *
    smoothstep(24, 92, bodyRadius) *
    (0.26 + detailEnergy * 0.12 + activity * 0.04);
  if (radialCoronaAlpha > 0.004 && bodyRadius > 18) {
    drawRadialStellarCorona(p, bodyRadius, opticalRadius, r, g, b, radialCoronaAlpha, detailEnergy, activity, surfaceReadiness);
  }
  if (sprite && glowStrength * Math.max(surfaceSpriteFade, coronaSpriteFade) > 0.008) {
    const coronaBaseRadius = Math.max(opticalRadius, bodyRadius * 1.18);
    const coronaSize =
      coronaBaseRadius *
      mix(2.45, 3.05, smoothstep(48, 156, bodyRadius)) *
      (1 + activity * 0.05);
    const spriteAlpha =
      Math.min(0.24, glowStrength * 0.26) *
      coronaSpriteFade *
      broadCoronaFade *
      closeCoreGlowFade *
      localSystemBroadHazeTrim *
      closeSurfaceShellFade;
    if (spriteAlpha > 0.004) {
      labelContext.save();
      labelContext.globalCompositeOperation = "lighter";
      labelContext.globalAlpha = spriteAlpha;
      if (surface > 0.08 && bodyRadius > 28) {
        labelContext.beginPath();
        labelContext.rect(0, 0, view.width, view.height);
        labelContext.arc(p.x, p.y, bodyRadius * 1.180, 0, TWO_PI);
        labelContext.clip("evenodd");
      }
      labelContext.translate(p.x, p.y);
      labelContext.drawImage(sprite.canvas, -coronaSize * 0.5, -coronaSize * 0.5, coronaSize, coronaSize);
      labelContext.restore();
    }
    if (surfaceSpriteFade > 0.015) {
      const coreSize = bodyRadius * mix(1.10, 1.18, detailEnergy) * 2;
      labelContext.globalAlpha =
        Math.min(0.040, glowStrength * 0.038) *
        surfaceSpriteFade *
        (1 - photosphereAlpha * 0.72) *
        (1 - smoothstep(0.36, 0.66, surfaceReadiness) * 0.94);
      labelContext.save();
      labelContext.translate(p.x, p.y);
      labelContext.drawImage(sprite.canvas, -coreSize * 0.5, -coreSize * 0.5, coreSize, coreSize);
      labelContext.restore();
    }
    const leadCoreDriver = Math.max(
      opticalLead,
      (response?.localSystemPresence || 0) * 0.72 * (1 - smoothstep(0.22, 0.58, surface))
    );
    const bodyReadabilityRetreat =
      (1 - smoothstep(44, 74, bodyRadius)) *
      (1 - smoothstep(0.10, 0.30, surface)) *
      (1 - smoothstep(0.10, 0.32, surfaceReadiness));
    const leadCoreFade =
      smoothstep(0.10, 0.62, leadCoreDriver) *
      bodyReadabilityRetreat;
    if (leadCoreFade > 0.01) {
      const systemLeadBoost =
        response?.scaleStage === "LocalSystem"
          ? mix(1.22, 1.32, smoothstep(0.02, 0.44, response?.localSystemPresence || 0))
          : 0.76;
      const leadCoreSize = Math.max(
        54,
        Math.min(bodyRadius * mix(1.18, 1.72, smoothstep(0.10, 0.58, leadCoreDriver)) * systemLeadBoost, minDimension * 0.22)
      );
      labelContext.globalAlpha = Math.min(0.48, (0.20 + leadCoreDriver * 0.30) * systemLeadBoost) * leadCoreFade;
      labelContext.save();
      labelContext.translate(p.x, p.y);
      labelContext.drawImage(sprite.canvas, -leadCoreSize * 0.5, -leadCoreSize * 0.5, leadCoreSize, leadCoreSize);
      labelContext.restore();
      labelContext.globalAlpha = 1;
    }
    labelContext.globalAlpha = 1;
  }

  const detailRestoreAlpha =
    surfaceSprite && bodyRadius > 18
      ? (Math.max(surface, presentation.surfaceDetailAlpha || 0) *
          smoothstep(0.30, 0.78, surfaceReadiness) *
          smoothstep(0.28, 0.48, surfaceReadiness) *
      (0.500 + detailEnergy * 0.140) *
          (1 - smoothstep(0.70, 0.96, surfaceReadiness) * 0.20) +
          localSystemTextureLead * (0.38 + detailEnergy * 0.24)) *
        closeFocusTrim
      : 0;
  if (surfaceSprite && detailRestoreAlpha > 0.006) {
    const bodySize = bodyRadius * mix(2.02, 2.12, detailEnergy);
    const surfaceSpinOffsetPx = longitudinalSpinOffsetPx(bodySize, surfaceViewSpinCycle, 0.64);
    const detailSurfaceCanvas = surfaceSprite.detailTileCanvas || surfaceSprite.tileCanvas || surfaceSprite.detailCanvas || surfaceSprite.canvas;
    const shadowSurfaceCanvas = surfaceSprite.shadowTileCanvas || null;
    const rectangularDetailSurface = detailSurfaceCanvas === surfaceSprite.tileCanvas;
    if (shadowSurfaceCanvas) {
      labelContext.globalCompositeOperation = "multiply";
      labelContext.globalAlpha = Math.min(0.015, detailRestoreAlpha * 0.046);
      labelContext.save();
      labelContext.translate(p.x, p.y);
      labelContext.rotate(surfaceAxisTilt);
      drawContinuousStellarSurfaceLayer(shadowSurfaceCanvas, bodySize, surfaceSpinOffsetPx, 1.08, 0.430);
      labelContext.restore();
    }
    labelContext.globalCompositeOperation = "screen";
    labelContext.globalAlpha = rectangularDetailSurface
      ? Math.min(0.340, detailRestoreAlpha * 0.50)
      : Math.min(0.980, detailRestoreAlpha * 4.20);
    labelContext.save();
    labelContext.translate(p.x, p.y);
    labelContext.rotate(surfaceAxisTilt);
    drawContinuousStellarSurfaceLayer(detailSurfaceCanvas, bodySize, surfaceSpinOffsetPx, rectangularDetailSurface ? 1.10 : 1.08, 0.470);
    labelContext.restore();

    const microEmissionAlpha =
      surface *
      (0.42 + smoothstep(0.72, 1, surfaceReadiness) * 0.58) *
      (0.105 + detailEnergy * 0.040) *
      closeFocusTrim;
    if (microEmissionAlpha > 0.004) {
      labelContext.globalCompositeOperation = "lighter";
      labelContext.globalAlpha = rectangularDetailSurface
        ? Math.min(0.210, microEmissionAlpha * 0.78)
        : Math.min(0.620, microEmissionAlpha * 2.60);
      labelContext.save();
      labelContext.translate(p.x, p.y);
      labelContext.rotate(surfaceAxisTilt);
      drawContinuousStellarSurfaceLayer(detailSurfaceCanvas, bodySize, surfaceSpinOffsetPx + bodySize * 0.035, 1.10, 0.462);
      labelContext.restore();
    }
    if (shadowSurfaceCanvas && surfaceReadiness < 0.74) {
      labelContext.globalCompositeOperation = "multiply";
      labelContext.globalAlpha =
        Math.min(0.008, detailRestoreAlpha * 0.016) *
        (1 - smoothstep(0.64, 0.74, surfaceReadiness) * 0.55);
      labelContext.save();
      labelContext.translate(p.x, p.y);
      labelContext.rotate(surfaceAxisTilt);
      drawContinuousStellarSurfaceLayer(shadowSurfaceCanvas, bodySize, surfaceSpinOffsetPx, 1.08, 0.428);
      labelContext.restore();
    }
    labelContext.globalAlpha = 1;
  }

  const surfaceLumaAnchorAlpha =
    (response?.scaleStage === "Surface" ? 1 : 0) *
    surface *
    smoothstep(0.58, 0.74, surfaceReadiness) *
      (0.44 + detailEnergy * 0.08 + smoothstep(0.68, 0.92, surfaceReadiness) * 0.06) *
    closeFocusTrim;
  if (surfaceLumaAnchorAlpha > 0.01 && bodyRadius > 18) {
    labelContext.globalCompositeOperation = "screen";
    labelContext.fillStyle = cssRgba(
      mix(r, 1, 0.96),
      mix(g, 0.98, 0.70),
      mix(b, 0.56, 0.24),
      Math.min(0.22, surfaceLumaAnchorAlpha * 0.66)
    );
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, bodyRadius * 0.990, 0, TWO_PI);
    labelContext.fill();
  }

  const granulationAlpha =
    (localSystemTextureLead * 1.70 +
      surface *
        smoothstep(0.08, 0.72, surfaceReadiness) *
        (0.46 + detailEnergy * 0.18)) *
    smoothstep(46, 108, bodyRadius) *
    (1 - smoothstep(0.82, 1.0, surfaceReadiness) * 0.24) *
    closeFocusTrim;
  drawPhotosphereGranulation(index, now, p, bodyRadius, r, g, b, granulationAlpha, surfaceAxisTilt, surfaceViewSpinCycle);
  const filamentAlpha =
    (localSystemTextureLead * 1.62 +
      surface *
        smoothstep(0.10, 0.68, surfaceReadiness) *
        (0.32 + detailEnergy * 0.14)) *
    smoothstep(48, 118, bodyRadius) *
    (1 - smoothstep(0.76, 1.0, surfaceReadiness) * 0.34) *
    closeFocusTrim;
  drawPhotosphereFilamentRidges(index, now, p, bodyRadius, r, g, b, filamentAlpha, surfaceAxisTilt, surfaceViewSpinCycle);
  const micrograinAlpha =
    (localSystemTextureLead * 1.25 +
      surface *
        smoothstep(0.08, 0.72, surfaceReadiness) *
        (0.18 + detailEnergy * 0.08)) *
    smoothstep(50, 112, bodyRadius) *
    (1 - smoothstep(0.86, 1.0, surfaceReadiness) * 0.22) *
    closeFocusTrim;
  drawPhotosphereMicrograin(index, now, p, bodyRadius, micrograinAlpha, surfaceAxisTilt, surfaceViewSpinCycle);

  const opticalPhotosphereAlpha =
    clamp(
      (surface *
          smoothstep(0.28, 0.82, surfaceReadiness) *
          (0.92 + detailEnergy * 0.20 + surfaceDepth * 0.06) +
        photosphereAlpha * 0.56 +
        localSystemTextureLead * 0.34 +
        earlyPhotosphereAnchor * 0.18) *
        closeFocusTrim,
      0,
      1
    );
  if (opticalPhotosphereAlpha > 0.006) {
    drawOpticalPhotosphereBody(
      index,
      now,
      p,
      bodyRadius,
      r,
      g,
      b,
      opticalPhotosphereAlpha,
      surfaceReadiness,
      surfaceDepth,
      activity,
      surfaceAxisTilt,
      surfaceViewSpinCycle
    );
  }
  const whiteHotActivityAlpha =
    (surface *
      smoothstep(0.44, 0.92, surfaceReadiness) *
      (0.58 + detailEnergy * 0.16 + activity * 0.08) +
      localSystemTextureLead * 0.24) *
    smoothstep(56, 132, bodyRadius) *
    closeFocusTrim;
  drawWhiteHotActivityGrain(index, now, p, bodyRadius, r, g, b, whiteHotActivityAlpha, surfaceAxisTilt, surfaceViewSpinCycle);

  const sparkleAlpha =
    visible *
    surfaceOpticalEnergy *
    smoothstep(50, 142, bodyRadius) *
    (1 - smoothstep(minDimension * 0.90, minDimension * 1.25, bodyRadius)) *
    (0.13 + detailEnergy * 0.055 + activity * 0.026) *
    closeFocusTrim;
  if (sparkleAlpha > 0.004) {
    drawLimbSparkleGlints(index, now, p, bodyRadius, r, g, b, sparkleAlpha, surfaceReadiness);
  }
  const softBloomAlpha =
    visible *
    surfaceOpticalEnergy *
    smoothstep(58, 126, bodyRadius) *
    (1.12 + detailEnergy * 0.22 + activity * 0.10 + smoothstep(0.56, 0.92, surfaceReadiness) * 0.10) *
    closeFocusTrim;
  if (softBloomAlpha > 0.004) {
    drawSoftPhotosphereBloom(p, bodyRadius, r, g, b, softBloomAlpha, surfaceReadiness);
  }

  const haloRadius = Math.min(
    Math.max(bodyRadius * mix(1.22, 1.42, detailEnergy), opticalRadius * 1.08),
    viewportRadius * 0.48
  );
  const haloAlpha =
    visible *
    surfaceOpticalEnergy *
    mix(haloAreaEnergy, 0.54, 0.34) *
    closeFocusTrim *
    closeSurfaceShellFade *
    (0.80 - (1 - coronaSpriteFade) * 0.30) *
    broadCoronaFade *
    localSystemBroadHazeTrim;
  if (haloAlpha > 0.002) {
    labelContext.save();
    labelContext.beginPath();
    labelContext.rect(0, 0, view.width, view.height);
    labelContext.arc(p.x, p.y, bodyRadius * 1.060, 0, TWO_PI);
    labelContext.clip("evenodd");
    const outer = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 1.015, p.x, p.y, haloRadius * 1.20);
    outer.addColorStop(
      0,
      cssRgba(mix(r, 1, 0.78), mix(g, 0.92, 0.46), mix(b, 0.42, 0.14), 0.0034 * haloAlpha)
    );
    outer.addColorStop(0.28, cssRgba(mix(r, 1, 0.56), mix(g, 0.82, 0.28), mix(b, 0.34, 0.10), 0.0019 * haloAlpha));
    outer.addColorStop(0.66, cssRgba(r, g, b, 0.0007 * haloAlpha));
    outer.addColorStop(1, cssRgba(r, g, b, 0));
    labelContext.fillStyle = outer;
    labelContext.beginPath();
    labelContext.arc(p.x, p.y, haloRadius * 1.12, 0, TWO_PI);
    labelContext.fill();
    labelContext.restore();
  }

  labelContext.restore();
}

function drawSoftPhotosphereBloom(p, bodyRadius, r, g, b, alpha, surfaceReadiness) {
  if (alpha < 0.004 || bodyRadius < 28) return;
  const retreat = smoothstep(0.82, 1.0, surfaceReadiness) * 0.08;
  const outerRadius = bodyRadius * mix(1.72, 2.08, surfaceReadiness);
  const warm = {
    r: mix(r, 1, 0.96),
    g: mix(g, 0.98, 0.72),
    b: mix(b, 0.58, 0.24)
  };
  labelContext.save();
  labelContext.beginPath();
  labelContext.rect(0, 0, view.width, view.height);
  labelContext.arc(p.x, p.y, bodyRadius * 0.985, 0, TWO_PI);
  labelContext.clip("evenodd");
  labelContext.globalCompositeOperation = "screen";
  const glow = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.940, p.x, p.y, outerRadius);
  const bloomNoLimbPeak = alpha * (1 - retreat);
  glow.addColorStop(0.00, cssRgba(1, 0.96, 0.58, bloomNoLimbPeak * 0.116));
  glow.addColorStop(0.16, cssRgba(warm.r, warm.g, warm.b, bloomNoLimbPeak * 0.074));
  glow.addColorStop(0.42, cssRgba(mix(r, 1, 0.72), mix(g, 0.90, 0.40), mix(b, 0.46, 0.16), bloomNoLimbPeak * 0.032));
  glow.addColorStop(0.72, cssRgba(mix(r, 1, 0.48), mix(g, 0.78, 0.22), mix(b, 0.30, 0.08), bloomNoLimbPeak * 0.010));
  glow.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.fillStyle = glow;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, outerRadius, 0, TWO_PI);
  labelContext.fill();
  labelContext.restore();
}

function drawOpticalPhotosphereBody(
  index,
  now,
  p,
  bodyRadius,
  r,
  g,
  b,
  alpha,
  surfaceReadiness,
  surfaceDepth,
  activity,
  surfaceAxisTilt,
  renderSpinCycle
) {
  if (alpha < 0.006 || bodyRadius < 34) return;
  const hot = {
    r: mix(r, 1, 0.98),
    g: mix(g, 0.99, 0.82),
    b: mix(b, 0.58, 0.24)
  };
  const warm = {
    r: mix(r, 1, 0.86),
    g: mix(g, 0.92, 0.56),
    b: mix(b, 0.34, 0.14)
  };
  const spin = renderSpinCycle * TWO_PI;
  const heatOffsetX = Math.cos(spin * 0.82 + index * 0.37) * bodyRadius * 0.055;
  const heatOffsetY = Math.sin(spin * 0.54 + index * 0.29) * bodyRadius * 0.035;
  const diskAlpha = alpha * (0.78 + smoothstep(0.42, 0.92, surfaceReadiness) * 0.36);
  const bloomAlpha = alpha * (0.72 + smoothstep(0.50, 1.0, surfaceReadiness) * 0.34);

  labelContext.save();
  const thermalVeil = labelContext.createRadialGradient(
    p.x + heatOffsetX * 0.45,
    p.y + heatOffsetY * 0.35,
    bodyRadius * 0.06,
    p.x,
    p.y,
    bodyRadius * 1.00
  );
  thermalVeil.addColorStop(0.00, cssRgba(1, 0.965, 0.62, Math.min(0.22, diskAlpha * 0.18)));
  thermalVeil.addColorStop(0.48, cssRgba(1, 0.925, 0.50, Math.min(0.18, diskAlpha * 0.15)));
  thermalVeil.addColorStop(0.84, cssRgba(1, 0.820, 0.34, Math.min(0.08, diskAlpha * 0.065)));
  thermalVeil.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.globalCompositeOperation = "source-over";
  labelContext.fillStyle = thermalVeil;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, bodyRadius * 1.000, 0, TWO_PI);
  labelContext.fill();

  labelContext.globalCompositeOperation = "screen";
  const bodyWash = labelContext.createRadialGradient(
    p.x + heatOffsetX,
    p.y + heatOffsetY,
    bodyRadius * 0.05,
    p.x,
    p.y,
    bodyRadius * 1.02
  );
  bodyWash.addColorStop(0.00, cssRgba(1, 0.985, 0.64, Math.min(0.48, diskAlpha * 0.45)));
  bodyWash.addColorStop(0.42, cssRgba(hot.r, hot.g, hot.b, Math.min(0.38, diskAlpha * 0.36)));
  bodyWash.addColorStop(0.72, cssRgba(warm.r, warm.g, warm.b, Math.min(0.24, diskAlpha * 0.25)));
  bodyWash.addColorStop(0.96, cssRgba(warm.r, warm.g, warm.b, Math.min(0.13, diskAlpha * 0.14)));
  bodyWash.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.fillStyle = bodyWash;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, bodyRadius * 1.004, 0, TWO_PI);
  labelContext.fill();

  labelContext.translate(p.x, p.y);
  labelContext.rotate(surfaceAxisTilt);
  labelContext.beginPath();
  labelContext.arc(0, 0, bodyRadius * 0.985, 0, TWO_PI);
  labelContext.clip("nonzero");
  const random = createRandom((config.seed + (index + 1) * 65537 + 907) % 2147483647);
  const hotSpotCount =
    catalog.budget.key === "safe"
      ? 5
      : catalog.budget.key === "immersive"
        ? 10
        : 7;
  for (let i = 0; i < hotSpotCount; i += 1) {
    const longitude = random() * TWO_PI + spin * (0.38 + random() * 0.18);
    const latitude = Math.asin(clamp(gaussian(random) * 0.38, -0.86, 0.86));
    const cosLat = Math.cos(latitude);
    const x = Math.sin(longitude) * cosLat * bodyRadius * 0.68;
    const y = Math.sin(latitude) * bodyRadius * 0.62;
    const normalizedRadius = Math.hypot(x / bodyRadius, y / bodyRadius);
    if (normalizedRadius > 0.94) continue;
    const limb = Math.sqrt(Math.max(0, 1 - normalizedRadius * normalizedRadius));
    const spotRadius = bodyRadius * mix(0.055, 0.145, random()) * (0.76 + limb * 0.46);
    const spotAlpha = Math.min(
      0.30,
      alpha *
        mix(0.080, 0.190, random()) *
        (0.56 + limb * 0.44) *
        (0.88 + activity * 0.20 + surfaceDepth * 0.08)
    );
    if (spotAlpha < 0.006) continue;
    const spot = labelContext.createRadialGradient(x, y, 0, x, y, spotRadius);
    spot.addColorStop(0.00, cssRgba(1, 0.985, 0.62, spotAlpha));
    spot.addColorStop(0.38, cssRgba(hot.r, hot.g, hot.b, spotAlpha * 0.50));
    spot.addColorStop(0.78, cssRgba(warm.r, warm.g, warm.b, spotAlpha * 0.16));
    spot.addColorStop(1.00, cssRgba(r, g, b, 0));
    labelContext.fillStyle = spot;
    labelContext.beginPath();
    labelContext.arc(x, y, spotRadius, 0, TWO_PI);
    labelContext.fill();
  }
  labelContext.restore();

  labelContext.save();
  labelContext.beginPath();
  labelContext.rect(0, 0, view.width, view.height);
  labelContext.arc(p.x, p.y, bodyRadius * 0.990, 0, TWO_PI);
  labelContext.clip("evenodd");
  labelContext.globalCompositeOperation = "screen";
  const limbGlow = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.965, p.x, p.y, bodyRadius * 1.34);
  limbGlow.addColorStop(0.00, cssRgba(1, 0.96, 0.58, bloomAlpha * 0.108));
  limbGlow.addColorStop(0.18, cssRgba(hot.r, hot.g, hot.b, bloomAlpha * 0.070));
  limbGlow.addColorStop(0.48, cssRgba(warm.r, warm.g, warm.b, bloomAlpha * 0.026));
  limbGlow.addColorStop(0.78, cssRgba(mix(r, 1, 0.58), mix(g, 0.82, 0.28), mix(b, 0.34, 0.10), bloomAlpha * 0.006));
  limbGlow.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.fillStyle = limbGlow;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, bodyRadius * 1.30, 0, TWO_PI);
  labelContext.fill();
  labelContext.restore();
}

function drawRadialStellarCorona(p, bodyRadius, opticalRadius, r, g, b, alpha, detailEnergy, activity, surfaceReadiness) {
  const coronaRadius = Math.max(
    bodyRadius * mix(1.42, 1.72, smoothstep(48, 170, bodyRadius)),
    opticalRadius * mix(1.20, 1.36, detailEnergy)
  );
  const outerRadius = Math.min(coronaRadius * (1.10 + activity * 0.08), Math.hypot(view.width, view.height) * 0.44);
  const innerAlpha = Math.min(0.28, alpha * (0.34 + detailEnergy * 0.08));
  const outerAlpha = Math.min(0.13, alpha * (0.13 + activity * 0.03));

  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  labelContext.beginPath();
  labelContext.rect(0, 0, view.width, view.height);
  labelContext.arc(p.x, p.y, bodyRadius * 1.060, 0, TWO_PI);
  labelContext.clip("evenodd");

  const near = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 0.980, p.x, p.y, outerRadius);
  near.addColorStop(0.00, cssRgba(mix(r, 1, 0.96), mix(g, 0.98, 0.72), mix(b, 0.58, 0.24), innerAlpha * 0.095));
  near.addColorStop(0.18, cssRgba(mix(r, 1, 0.80), mix(g, 0.92, 0.50), mix(b, 0.46, 0.16), innerAlpha * 0.056));
  near.addColorStop(0.48, cssRgba(mix(r, 1, 0.48), mix(g, 0.84, 0.28), mix(b, 0.38, 0.12), outerAlpha * 0.033));
  near.addColorStop(0.78, cssRgba(mix(r, 1, 0.30), mix(g, 0.72, 0.16), mix(b, 0.28, 0.08), outerAlpha * 0.010));
  near.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.fillStyle = near;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, outerRadius, 0, TWO_PI);
  labelContext.fill();

  const farRadius = Math.min(outerRadius * 1.85, Math.hypot(view.width, view.height) * 0.54);
  const far = labelContext.createRadialGradient(p.x, p.y, bodyRadius * 1.02, p.x, p.y, farRadius);
  far.addColorStop(0.00, cssRgba(mix(r, 1, 0.82), mix(g, 0.92, 0.48), mix(b, 0.48, 0.18), outerAlpha * 0.040));
  far.addColorStop(0.34, cssRgba(mix(r, 1, 0.44), mix(g, 0.82, 0.24), mix(b, 0.34, 0.10), outerAlpha * 0.018));
  far.addColorStop(0.72, cssRgba(r, g, b, outerAlpha * 0.004));
  far.addColorStop(1.00, cssRgba(r, g, b, 0));
  labelContext.fillStyle = far;
  labelContext.beginPath();
  labelContext.arc(p.x, p.y, farRadius, 0, TWO_PI);
  labelContext.fill();
  labelContext.restore();
}

function drawLimbSparkleGlints(index, now, p, bodyRadius, r, g, b, alpha, surfaceReadiness) {
  const seed = seededUnit(index * 47.13 + 0.67);
  const count = bodyRadius > 92 ? 2 : 1;
  labelContext.save();
  labelContext.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i += 1) {
    const angle =
      seed * TWO_PI +
      i * (TWO_PI / count) +
      Math.sin(now * 0.00018 + seed * 9.2 + i * 1.7) * 0.045;
    const pulse = 0.70 + Math.sin(now * (0.0016 + i * 0.00021) + seed * 12.0 + i) * 0.30;
    const limb = bodyRadius * (1.006 + i * 0.007);
    const length =
      bodyRadius *
      mix(0.040, 0.075, seededUnit(index * 11.4 + i * 3.1)) *
      (1 - smoothstep(0.74, 1, surfaceReadiness) * 0.16);
    const width = bodyRadius * mix(0.010, 0.018, seededUnit(index * 17.6 + i * 2.4));
    const glintAlpha = Math.min(0.11, alpha * (0.22 + pulse * 0.28));
    if (glintAlpha < 0.006) continue;
    labelContext.save();
    labelContext.translate(p.x + Math.cos(angle) * limb, p.y + Math.sin(angle) * limb);
    labelContext.rotate(angle);
    labelContext.scale(length, width);
    const glint = labelContext.createRadialGradient(0, 0, 0, 0, 0, 1);
    glint.addColorStop(0.00, cssRgba(1, 0.98, 0.82, glintAlpha));
    glint.addColorStop(0.28, cssRgba(mix(r, 1, 0.94), mix(g, 1, 0.80), mix(b, 0.92, 0.50), glintAlpha * 0.40));
    glint.addColorStop(1.00, cssRgba(r, g, b, 0));
    labelContext.fillStyle = glint;
    labelContext.beginPath();
    labelContext.ellipse(0, 0, 1, 0.85, 0, 0, TWO_PI);
    labelContext.fill();
    labelContext.restore();
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
  if (active && visual?.index === index && (visual.sphereScreenRadius || 0) > 68) {
    const radius = visual.sphereScreenRadius;
    side = p.x < view.width * 0.56 ? 1 : -1;
    const gap = clamp(radius * 0.07, 28, 62);
    const viewportEdgeLimit = side > 0
      ? view.width - p.x - text.width - gap - 18
      : p.x - text.width - gap - 18;
    const edgeDistance = Math.max(
      radius * 0.76,
      Math.min(radius * 0.98, Math.max(80, viewportEdgeLimit))
    );
    leaderX = p.x + side * edgeDistance;
    leaderY = p.y - Math.min(radius * 0.12, 92);
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
  const labelLeaderAlpha =
    alpha *
    (active && visual?.index === index
      ? 1 - smoothstep(0.68, 0.92, response?.surfaceReadiness || surface)
      : 1);
  labelContext.save();
  labelContext.globalAlpha = alpha;
  if (labelLeaderAlpha > 0.035) {
    labelContext.save();
    labelContext.globalAlpha = labelLeaderAlpha;
    labelContext.lineWidth = 1;
    labelContext.strokeStyle = "rgba(205, 224, 255, 0.2)";
    labelContext.beginPath();
    labelContext.moveTo(leaderX, leaderY);
    labelContext.lineTo(side > 0 ? rect.x : rect.x + rect.w, rect.y + rect.h * 0.62);
    labelContext.stroke();
    labelContext.restore();
  }
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
  drawCelestialBackdrop(response, now, visual);
  drawLocalSystemShell(response, visual);
  drawLocalAtmosphere(t, now, response, visual);
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

function applyWheelDelta(deltaY, ctrlKey) {
  const targetModel = scaleModelForDistance(camera.distanceTarget);
  const transitionSpeedScale = ctrlKey ? 1 : layerTransitionSpeedScale(targetModel);
  const localSpeedScale = clamp(
    1 -
      (1 - targetModel.metricCatalogPresence) * 0.22 -
      targetModel.surfacePresence * 0.18,
    0.58,
    1
  );
  const speed = (ctrlKey ? WHEEL_ZOOM_SPEED_PRECISE : WHEEL_ZOOM_SPEED) * localSpeedScale * transitionSpeedScale;
  const rawFactor = Math.exp(deltaY * speed);
  const zoomInFloor = ctrlKey ? 0.58 : 1 - (1 - 0.72) * transitionSpeedScale;
  const zoomOutCeiling = ctrlKey ? 1.72 : 1 + (1.38 - 1) * transitionSpeedScale;
  const factor = clamp(rawFactor, zoomInFloor, zoomOutCeiling);
  const nextDistance = clamp(
    camera.distanceTarget * factor,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE
  );
  camera.distanceTarget = nextDistance;
  camera.scaleTarget = projectionScaleForDistance(camera.distanceTarget);
}

function applyPendingWheel(now) {
  if (Math.abs(wheelInput.deltaY) < 0.01) return;
  camera.lastInteraction = now;
  const delta = clamp(wheelInput.deltaY, -WHEEL_FRAME_DELTA_CAP, WHEEL_FRAME_DELTA_CAP);
  wheelInput.deltaY -= delta;
  if (Math.abs(wheelInput.deltaY) < 0.01) wheelInput.deltaY = 0;
  applyWheelDelta(delta, wheelInput.ctrlKey);
}

function layerDebugState(prefix, layer) {
  return {
    [`${prefix}LayerPresence`]: layer.presence,
    [`${prefix}LayerPointScale`]: layer.pointScale,
    [`${prefix}LayerHaloScale`]: layer.haloScale,
    [`${prefix}LayerLabelWeight`]: layer.labelWeight,
    [`${prefix}LayerPickWeight`]: layer.pickWeight
  };
}

function debugStatePayload(lod, model, response, visual, now) {
  const activeSurfaceSpinPhase = pointer.active >= 0 ? stellarPhase(pointer.active, now) : 0;
  return {
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
    rotationPhase: activeSurfaceSpinPhase,
    surfaceSpinPhase: activeSurfaceSpinPhase,
    cameraYaw: camera.yaw,
    cameraTilt: Math.tanh(camera.tiltRaw) * 1.46,
    activity: pointer.active >= 0 ? stellarActivity(pointer.active) : 0,
    bridge: response.activeBridgePresence,
    regionalBridgePresence: response.regionalBridgePresence,
    localMapBridgePresence: response.localMapBridgePresence,
    activeBridgePresence: response.activeBridgePresence,
    exposure: response.exposure,
    globalVeilPresence: response.globalVeilPresence,
    overlayHazeBudget: response.overlayHazeBudget,
    localReference: response.localReference,
    localApproach: response.localApproach,
    metricCatalogPresence: response.metricCatalogPresence,
    metricLayerPresence: response.metricLayerPresence,
    metricLayerPointScale: response.metricLayerPointScale,
    metricLayerHaloScale: response.metricLayerHaloScale,
    metricPsfContinuity: response.metricPsfContinuity,
    metricLayerLabelWeight: response.metricLayerLabelWeight,
    metricLayerPickWeight: response.metricLayerPickWeight,
    metricLayerOpacity: response.metricLayerOpacity,
    metricCoreVisibility: response.metricCoreVisibility,
    metricCoreRadiusScale: response.metricCoreRadiusScale,
    ...layerDebugState("galactic", response.galacticLayer),
    ...layerDebugState("regional", response.regionalLayer),
    ...layerDebugState("localMap", response.localMapLayer),
    ...layerDebugState("localSystem", response.localSystemLayer),
    ...layerDebugState("surface", response.surfaceLayer),
    celestialBackdropPresence: response.celestialBackdropPresence,
    localSystemPresence: response.localSystemPresence,
    activeStarCloseness: visual.activeStarCloseness || response.activeStarCloseness || 0,
    surfaceReadiness: response.surfaceReadiness,
    surfaceDepth: response.surfaceDepth,
    surfaceViewRadiusStarR: visual.surfaceViewRadiusStarR,
    contextScale: response.contextScale,
    activeImpostorScale: visual.activeImpostorScale,
    activeHaloRatio: visual.activeHaloRatio,
    activeGlowStrength: visual.activeGlowStrength || 0,
    activeGlowRadius: visual.activeGlowRadius || 0,
    stellarOpticalLeadIn: visual.stellarOpticalLeadIn || 0,
    activePrimaryAlpha: visual.activeStarPresentation?.primaryAlpha || 0,
    activeSurfaceDetailAlpha: visual.activeStarPresentation?.surfaceDetailAlpha || 0,
    activePhotosphereAlpha: visual.activeStarPresentation?.photosphereAlpha || 0,
    activeCoronaAlpha: visual.activeStarPresentation?.coronaAlpha || 0,
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
  };
}

function frame(now) {
  if (!initialized) return;
  const last = frame.last || now;
  const dt = clamp((now - last) / 1000, 0.001, 0.14);
  frame.last = now;
  applyPendingWheel(now);
  updateCamera(now, dt);
  const model = scaleModelForDistance(camera.distance);
  const t = model.mapDepth;
  const lod = lodForScaleModel(model);
  const response = smoothOpticalResponse(scaleResponse(model), dt, now);
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
    post("state", { state: debugStatePayload(lod, model, response, visual, now) });
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
  const now = performance.now();
  camera.lastInteraction = now;
  cancelFocusFlight();
  wheelInput.deltaY = clamp(wheelInput.deltaY + clamp(message.deltaY, -2400, 2400), -3600, 3600);
  wheelInput.ctrlKey = Boolean(message.ctrlKey);
  wheelInput.activeUntil = now + WHEEL_ACTIVE_DECAY_MS;
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
  pointer.active = pointer.active >= 0 ? pointer.active : catalog.indexAtDraw[0];
  approach.index = pointer.active;
  post("boot", { label: "Warming active stellar atlas" });
  await waitForStellar02Assets();
  ensureStellarSurfaceSprite(pointer.active, performance.now());
  ensureStellarGlowSprite(pointer.active);
  try {
    post("boot", { label: "Starting WebGPU renderer" });
    await initGpu();
    uploadGpuData();
  } catch (error) {
    post("error", { message: error?.message || "The WebGPU renderer could not start." });
    return;
  }
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
  if (message.type === "init") return init(message);
  if (message.type === "resize") return resize(message.width, message.height, message.dpr);
  if (!initialized) return;
  switch (message.type) {
    case "pointerdown":
      camera.dragging = true;
      camera.lastInteraction = performance.now();
      handlePointerMove(message);
      break;
    case "pointerup":
      camera.dragging = false;
      camera.lastInteraction = performance.now();
      handlePointerMove(message);
      break;
    case "pointerleave":
      pointer.hover = -1;
      labels.lastSelectAt = 0;
      break;
    case "pointermove":
      handlePointerMove(message);
      break;
    case "drag":
      handleDrag(message);
      break;
    case "wheel":
      handleWheel(message);
      break;
    case "tap": {
      handlePointerMove(message);
      const picked = pointer.hover >= 0 ? pointer.hover : pickAt(message.x, message.y);
      if (picked >= 0) {
        focusStar(picked, approachDistanceForStar(picked), true);
      }
      break;
    }
  }
};
