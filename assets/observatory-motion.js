import { solidShape } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
// The observation clock controls artistic activity and finite derived body poses.
// Catalog data stays immutable; navigation and accessibility have their own time.
export const SCENE_MOTION_MODES = Object.freeze(['flow', 'paused', 'accelerated']);
export function sceneMotionMode(value) {
  return SCENE_MOTION_MODES.includes(value) ? value : 'flow';
}
export function sceneMotionRate(mode, reducedMotion = false) {
  return reducedMotion ? 0 : ({ flow: 1, paused: 0, accelerated: 4 })[sceneMotionMode(mode)];
}
export function advanceSceneTime(time, delta, mode = 'flow', reducedMotion = false) {
  const previous = Number.isFinite(time) && time >= 0 ? time : 0;
  const step = Number.isFinite(delta) ? Math.max(0, Math.min(0.1, delta)) : 0;
  return previous + step * sceneMotionRate(mode, reducedMotion);
}
export function observingBody(body, time) {
  if ((body.axes || solidShape(body.material,body.seed)) && body.kind !== 'comet') return { ...body, spin: (Number.isFinite(time) && time >= 0 ? time : 0) * 0.041 + (body.surfacePhase || 0) };
  if (body.kind !== 'comet') return body;
  // The renderer and CPU solid intersection receive this same derived pose.
  // Keep the catalog immutable: orbit, target centre and recalled view stay put.
  const phase = Number.isFinite(time) && time >= 0 ? (time * 0.13) % (Math.PI * 2) : 0;
  return { ...body, tilt: (body.tilt || 0) + phase };
}

// Authored periods and ellipses support readable motion, not a live ephemeris.
// Only authored families participate; generated stars remain untouched.
const AUTHORED_ORBITS = Object.freeze({
  mercury: [58, 0.18], venus: [82, 0.02], uranus: [430, 0.05], neptune: [550, 0.02],
  earth: [100, 0.04], mars: [150, 0.12], jupiter: [230, 0.06],
  saturn: [320, 0.08], moon: [28, 0.08], comet: [-180, 0.55],
  io: [34, 0.01], europa: [54, 0.01], enceladus: [38, 0.01], titan: [76, 0.03],
  ganymede: [78, 0.01], callisto: [114, 0.01], triton: [-64, 0.02], mimas: [24, 0.03],
  pluto: [680, 0.20], charon: [64, 0.01], ceres: [185, 0.08], vesta: [170, 0.09],
  phobos: [20, 0.02], deimos: [56, 0.01],
  miranda: [42, 0.04], iapetus: [138, 0.06],
  ariel: [62, 0.02], umbriel: [86, 0.02], titania: [116, 0.03], oberon: [148, 0.03],
  whitedwarf: [160, 0.25],
  eris:[920,.24],haumea:[740,.14],makemake:[800,.13],
  rhea:[100,.02],dione:[60,.02],tethys:[46,.02],proteus:[38,.02],
  eros:[165,.18],bennu:[122,.16],
  ryugu:[134,.17],itokawa:[141,.20],lutetia:[220,.12],ida:[240,.08],dactyl:[30,.04],
  mathilde:[210,.20],psyche:[275,.12],gaspra:[205,.09],steins:[215,.13],rosettacomet:[195,.45],
  hyperion:[110,.12],pan:[16,.01],atlas:[20,.01],phoebe:[-680,.25],nereid:[450,.42],
  arrokoth:[1150,.08],chariklo:[620,.13],sedna:[1400,.50],quaoar:[980,.10],
  amalthea:[18,.01],thebe:[24,.01],himalia:[720,.22],janus:[22,.01],epimetheus:[22,.01],
  helene:[60,.01],telesto:[46,.01],calypso:[46,.01],prometheus:[19,.01],pandora:[20,.01],
  galatea:[24,.01],despina:[20,.01],kleopatra:[290,.14],alexhelios:[40,.03],cleoselene:[30,.03],hygiea:[270,.12],
  styx:[90,.01],nix:[112,.01],kerberos:[130,.02],hydra:[156,.01],
  dysnomia:[140,.03],hiiaka:[150,.06],namaka:[95,.12],mk2:[135,.06],
  orcus:[1000,.18],vanth:[80,.01],gonggong:[1220,.23],xiangliu:[135,.22],
  salacia:[1030,.10],actaea:[75,.02],varda:[1110,.08],ilmare:[65,.01],
  varuna:[1090,.09],ixion:[1050,.15],weywot:[105,.01],ms4:[1150,.13]
});
const TAU = Math.PI * 2;
const sceneTime = time => Number.isFinite(time) && time >= 0 ? time : 0;

// One bounded spatial phase for Milky Way stars, gas, dust and local families.
// Inverse camera projection avoids rebuilding a catalog-sized world pose array.
export function galacticFrame(time) {
  const rate = 0.013, angle = (sceneTime(time) % (TAU / rate)) * rate;
  const c = Math.cos(angle), s = Math.sin(angle);
  const toWorld = ([x,y,z]) => [c*x+s*z,y,-s*x+c*z];
  const toRest = ([x,y,z]) => [c*x-s*z,y,s*x+c*z];
  return {
    angle, toWorld, toRest,
    body(body) {
      if (!body || body.kind === 'galaxy' || body.spaceRegion === 'outside-milky-way') return body;
      const derived = { ...body, position: toWorld(body.position) };
      if (body.arrivalView) derived.arrivalView = { ...body.arrivalView, yaw: body.arrivalView.yaw + angle };
      return derived;
    },
    camera(frame) {
      return { ...frame, eye: toRest(frame.eye), forward: toRest(frame.forward),
        right: toRest(frame.right), up: toRest(frame.up) };
    }
  };
}

export function createBodyMotion(catalog, { compactStellarFamilies = false } = {}) {
  const parents = catalog.bodies.map(body => catalog.stars[body.parentId]).filter(Boolean);
  const sources = new Map([catalog.stars[0], ...parents, ...catalog.bodies].map(body => [body.id, body]));
  const orbits = new Map();
  for (const body of catalog.bodies) {
    const recipe = body.motionPeriod ? [body.motionPeriod, 0] : AUTHORED_ORBITS[body.material], parent = sources.get(body.parentId);
    if (!recipe || !parent) continue;
    const offset = body.position.map((value, i) => value - parent.position[i]);
    const sourceRadius = Math.hypot(...offset);
    if (!(sourceRadius > 0)) continue;
    // Derive an observing layout without writing back to the catalog. Small
    // stellar companions stay clear of their parent and readable together.
    // The legacy motion model remains available without this presentation fit.
    const radius = compactStellarFamilies && body.kind === 'star' && parent.kind === 'star' ?
      Math.min(sourceRadius, (parent.radius + body.radius) * 2.2) : sourceRadius;
    const radial = offset.map(value => value / sourceRadius);
    const tangent = [radial[2], body.kind === 'comet' ? 0.32 : 0, -radial[0]];
    const projection = tangent.reduce((sum, value, i) => sum + value * radial[i], 0);
    const perpendicular = tangent.map((value, i) => value - projection * radial[i]);
    const length = Math.hypot(...perpendicular);
    const side = perpendicular.map(value => value / length);
    const [period, eccentricity] = recipe;
    const semiMajor = radius / (1 - eccentricity);
    const relative = anomaly => radial.map((value, i) => semiMajor *
      ((Math.cos(anomaly) - eccentricity) * value + Math.sqrt(1 - eccentricity ** 2) * Math.sin(anomaly) * side[i]));
    const path = Array.from({ length: 65 }, (_, i) => relative(i / 64 * TAU));
    const normal = [radial[1]*side[2]-radial[2]*side[1], radial[2]*side[0]-radial[0]*side[2], radial[0]*side[1]-radial[1]*side[0]];
    const arrival = vector => {
      if (!body.arrivalView) return null;
      const dot = (a,b) => a.reduce((sum,value,i)=>sum+value*b[i],0);
      const angle = Math.atan2(dot(vector,side),dot(vector,radial));
      const view = body.arrivalView;
      const eye = [Math.sin(view.yaw)*Math.cos(view.pitch),Math.sin(view.pitch),Math.cos(view.yaw)*Math.cos(view.pitch)];
      const cross = [normal[1]*eye[2]-normal[2]*eye[1],normal[2]*eye[0]-normal[0]*eye[2],normal[0]*eye[1]-normal[1]*eye[0]];
      const axial = dot(normal,eye), c=Math.cos(angle), s=Math.sin(angle);
      const rotated = eye.map((value,i)=>value*c+cross[i]*s+normal[i]*axial*(1-c));
      return { ...view, yaw:Math.atan2(rotated[0],rotated[2]),pitch:Math.asin(Math.max(-1,Math.min(1,rotated[1]))) };
    };
    const sun=sources.get(0);
    const satellite=body.kind==='moon' && body.material!=='moon';
    const sunYaw=sun ? Math.atan2(sun.position[0]-body.position[0],sun.position[2]-body.position[2]) : 0;
    const phaseOffset=satellite && body.arrivalView ? Math.max(-.8,Math.min(.8,
      Math.atan2(Math.sin(body.arrivalView.yaw-sunYaw),Math.cos(body.arrivalView.yaw-sunYaw)))) : null;
    orbits.set(body.id, { period, eccentricity, relative, path, arrival, phaseOffset });
  }
  function snapshot(time) {
    const result = new Map();
    const phase = sceneTime(time);
    function pose(id) {
      if (result.has(id)) return result.get(id);
      const body = sources.get(id), orbit = orbits.get(id);
      if (!body) return null;
      let derived = body;
      if (orbit) {
        const parent = pose(body.parentId);
        const mean = (phase % Math.abs(orbit.period)) / orbit.period * TAU;
        let anomaly = mean;
        // Fixed iteration count; e <= .55 keeps this finite solve well behaved.
        for (let i = 0; i < 5; i++) anomaly -= (anomaly - orbit.eccentricity * Math.sin(anomaly) - mean) /
          (1 - orbit.eccentricity * Math.cos(anomaly));
        const relative = orbit.relative(anomaly);
        derived = { ...body, position: parent.position.map((value, i) => value + relative[i]) };
        if (body.arrivalView) derived.arrivalView = orbit.arrival(relative);
        if (orbit.phaseOffset!==null) {
          const sun=sources.get(0),light=sun.position.map((value,i)=>value-derived.position[i]);
          derived.arrivalView={...body.arrivalView,yaw:Math.atan2(light[0],light[2])+orbit.phaseOffset};
        }
      }
      derived = observingBody(derived, phase);
      result.set(id, derived);
      return derived;
    }
    for (const id of sources.keys()) pose(id);
    return result;
  }
  function path(id, poses) {
    const orbit = orbits.get(id), source = sources.get(id);
    const parent = source && poses.get(source.parentId);
    return orbit && parent ? orbit.path.map(point => parent.position.map((value, i) => value + point[i])) : [];
  }
  return { snapshot, path };
}

// Shared inverse/forward transforms keep the finite auxiliary star field on the
// rotating galaxy disc. These points have no selectable catalog identities.
export const SCENE_MOTION_WGSL = /* wgsl */ `
fn motionRotateY(p: vec3f, a: f32) -> vec3f {
  let c=cos(a); let s=sin(a);
  return vec3f(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
}
fn motionRotateZ(p: vec3f, a: f32) -> vec3f {
  let c=cos(a); let s=sin(a);
  return vec3f(c*p.x-s*p.y,s*p.x+c*p.y,p.z);
}
fn galaxyRotateQuaternion(p:vec3f,q:vec4f) -> vec3f {
  let t=2.0*cross(q.xyz,p);
  return p+q.w*t+cross(q.xyz,t);
}
fn galaxyMotionPointFor(p:vec3f,orientation:vec4f) -> vec3f {
  return motionRotateY(galaxyRotateQuaternion(p,vec4f(-orientation.xyz,orientation.w)),-f.forward.w*0.018);
}
fn galaxyMotionWorldFor(p:vec3f,orientation:vec4f) -> vec3f {
  let rest=galaxyRotateQuaternion(p,vec4f(-orientation.xyz,orientation.w));
  return galaxyRotateQuaternion(motionRotateY(rest,f.forward.w*0.018),orientation);
}
fn galaxyMotionPoint(p: vec3f) -> vec3f {
  return galaxyMotionPointFor(p,f.rings);
}
fn galaxyMotionWorld(p: vec3f) -> vec3f {
  return galaxyMotionWorldFor(p,f.rings);
}
fn galacticMotionPoint(p: vec3f) -> vec3f {
  return motionRotateY(p,-f.localStar.w);
}
fn galacticMotionWorld(p: vec3f) -> vec3f {
  return motionRotateY(p,f.localStar.w);
}
// Finite auxiliary paths share the observation clock. Their phase fades before
// recycling, so no particle teleports visibly or becomes a selectable body.
fn localFlowPoint(p: vec3f, seed: f32) -> vec4f {
  if (f.style.w < 0.5) {
    let cycle=fract(f.forward.w/(12.0+seed*9.0)+seed);
    let radius=exp(mix(log(1.7),log(850.0),cycle));
    let fade=smoothstep(0.0,0.12,cycle)*(1.0-smoothstep(0.80,1.0,cycle));
    return vec4f(normalize(p)*radius,fade);
  }
  // Quiet circulating foreground for non-emitting bodies, with depth intact.
  let angle=f.forward.w*0.035;
  return vec4f(motionRotateZ(motionRotateY(p,angle),angle*0.35),1.0);
}
`;
