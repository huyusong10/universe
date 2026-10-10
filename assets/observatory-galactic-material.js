// The Milky Way's shared gas and extinction field, in its immutable rest space.
// This is bounded procedural artwork, not an observed map or live simulation.
import { smoothstep } from './observatory-math.js?v=cosmic-explore-20261010gu';

const GALACTIC_RADIUS = 20;
const GALACTIC_HEIGHT = 2.8;

// The historical panorama describes an internal view. Its presence follows the
// observer's space, rather than the selected body's size or a UI scale stage.
export function galacticInteriorPresence(eye) {
  const distance = Math.hypot(eye[0] / GALACTIC_RADIUS, eye[1] / GALACTIC_HEIGHT, eye[2] / GALACTIC_RADIUS);
  return 1 - smoothstep(0.78, 1.18, distance);
}

// Shared finite outskirts for auxiliary stars and analytically integrated gas.
// Gaussian populations have seeded finite samples, not a common clipping rim.
// Short inner branches retain the central spiral. The longer streams grow
// from those branches, with independent reach, thickness and bend direction.
// Their Gaussian tails remain finite samples with no shared outer radius.
const SPUR_ROOTS = [7.4,9.2,8.8,10.7];
const OUTER_STREAMS = [
  {length:62,height:3.2,width:2.8,curvature:.0011,strength:.42},
  {length:89,height:4.5,width:3.7,curvature:-.0007,strength:.31},
  {length:47,height:2.6,width:2.2,curvature:.0014,strength:.56},
  {length:76,height:3.8,width:3.2,curvature:-.0009,strength:.37}
];
export const GALACTIC_SPURS = Object.freeze(SPUR_ROOTS.flatMap((radius,arm)=>{
  const angle=arm*Math.PI/2+Math.log(radius/1.6)*2.05+Math.sin(arm*2.1)*.11;
  const tx=Math.cos(angle)-Math.sin(angle)*2.05,tz=Math.sin(angle)+Math.cos(angle)*2.05,n=Math.hypot(tx,tz);
  const tangent=Object.freeze([tx/n,tz/n]);
  const root=[Math.cos(angle)*radius,Math.sin(angle*2+radius*.07)*radius*.027,Math.sin(angle)*radius];
  const outer=OUTER_STREAMS[arm],offset=outer.length*.48,bend=outer.curvature*offset*offset;
  return [
    Object.freeze({position:Object.freeze(root),tangent,axes:Object.freeze([8.8,.95,1.25]),curvature:.22/radius,warmth:arm%2,strength:1}),
    Object.freeze({position:Object.freeze([root[0]+tangent[0]*offset+tangent[1]*bend,root[1],root[2]+tangent[1]*offset-tangent[0]*bend]),
      tangent,axes:Object.freeze([outer.length,outer.height,outer.width]),curvature:outer.curvature,warmth:arm%2,strength:outer.strength})
  ];
}));
// Lights and analytic gas share the same gently bent world-space support.
export function galacticSpurPoint(spur, along, cross, height) {
  const [tx,tz]=spur.tangent,bend=spur.curvature*along*along;
  return [spur.position[0]+tx*along-tz*(cross+bend),spur.position[1]+height,
    spur.position[2]+tz*along+tx*(cross+bend)];
}
// Overlapping tilted populations connect the catalogue to the extended
// streams. Their wider, thicker outskirts have no shared allocation rim.
// Every population is an affine Gaussian: finite foreground columns remain
// exact along grazing rays, avoiding a ray-dependent curved-sheet tangent.
export const GALACTIC_BRIDGE_LAYERS=Object.freeze([
  {position:[.8,-.08,-.4],axes:[12,1.2,15],slopes:[.012,-.015],weight:.36},
  {position:[-9,.8,12],axes:[23,3.1,32],slopes:[.045,-.055],weight:.38},
  {position:[20,-.7,-12],axes:[32,4.5,25],slopes:[-.035,-.025],weight:.26}
].map(s=>Object.freeze({...s,position:Object.freeze(s.position),axes:Object.freeze(s.axes),slopes:Object.freeze(s.slopes)})));
export const GALACTIC_DIFFUSE_LAYERS=Object.freeze([
  Object.freeze({position:Object.freeze([-7,.4,9]),axes:Object.freeze([40,3.8,50])}),
  Object.freeze({position:Object.freeze([3,-.6,-5]),axes:Object.freeze([30,12,33])}),
  GALACTIC_BRIDGE_LAYERS[0]
]);
// Overlapping warm lobes form a bar with a vertical bulge; a much fainter
// stellar halo surrounds the thin arms. These are authored spatial samples,
// not displaced catalogue stars or a visible dark-matter envelope.
export const GALACTIC_STELLAR_POPULATIONS=Object.freeze([
  {position:[-1.45,.14,-.61],axes:[3.1,1.65,1.55],angle:.4,light:[.014,.0092,.0054]},
  {position:[1.45,-.14,.61],axes:[3.1,1.65,1.55],angle:.4,light:[.014,.0092,.0054]},
  {position:[.7,.2,-.5],axes:[30,12,33],angle:0,light:[.000055,.000040,.000028]}
].map(s=>Object.freeze({...s,position:Object.freeze(s.position),axes:Object.freeze(s.axes),light:Object.freeze(s.light)})));
export function galacticStellarPoint(local,index) {
  const shape=GALACTIC_STELLAR_POPULATIONS[index],c=Math.cos(shape.angle),a=Math.sin(shape.angle);
  const p=local.map((v,i)=>v*shape.axes[i]);
  return [shape.position[0]+c*p[0]-a*p[2],shape.position[1]+p[1],shape.position[2]+a*p[0]+c*p[2]];
}
export function galacticBridgeLayer(value) {
  let total=0;
  for(let i=0;i<GALACTIC_BRIDGE_LAYERS.length;i++) {
    total+=GALACTIC_BRIDGE_LAYERS[i].weight;
    if(value<total)return i;
  }
  return GALACTIC_BRIDGE_LAYERS.length-1;
}
export function galacticBridgePoint(p,index=0) {
  const layer=GALACTIC_BRIDGE_LAYERS[index];
  return [p[0],p[1]+layer.slopes[0]*(p[0]-layer.position[0])+layer.slopes[1]*(p[2]-layer.position[2]),p[2]];
}
export function galacticWideWeight(p) {
  const radius=Math.hypot(p[0],p[2]),angle=Math.atan2(p[2],p[0]);
  const phase=angle-Math.log(Math.max(radius,.6)/1.6)*2.05+Math.sin(angle*3+radius*.15)*.16;
  return .18+.82*Math.pow(.5+.5*Math.cos(phase*4),2.8);
}
// One fixed fragmentation field for light placement and gas. Auxiliary lights
// sample extended ribbons, rather than detached Gaussian cluster centres.
function galacticNoise([x,y]) {
  const fract=v=>v-Math.floor(v);
  const hash=(x,y)=>{
    let a=fract(x*.1031),b=fract(y*.1030),c=fract(x*.0973);
    const d=a*(b+33.33)+b*(c+33.33)+c*(a+33.33);
    a+=d;b+=d;c+=d;return fract((a+b)*c);
  };
  const ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y);
  const wx=fx*fx*(3-2*fx),wy=fy*fy*(3-2*fy);
  const lower=hash(ix,iy)*(1-wx)+hash(ix+1,iy)*wx;
  const upper=hash(ix,iy+1)*(1-wx)+hash(ix+1,iy+1)*wx;
  return lower*(1-wy)+upper*wy;
}
export function galacticFragmentWeight(p) {
  const [x,y,z]=p;
  // Crossed sections vary in every world-space direction. Changing height
  // reveals different cloud groups, rather than sliding one projected sheet.
  const broad=galacticNoise([x*.13+9.7,z*.13+21.3])*.55+galacticNoise([y*.31+6.2,x*.13+4.8])*.45;
  const medium=galacticNoise([x*.47+17.2+(broad-.5)*.55,z*.47+6.4])*.60+galacticNoise([y*.80+12.1,z*.47+2.7])*.40;
  const fine=galacticNoise([x*1.61+3.8,z*1.61+29.1])*.55+galacticNoise([y*2.1+5.9,x*1.61+18.3])*.45;
  const cloud=broad*.52+medium*.32+fine*.16;
  return .14+.86*smoothstep(.22,.72,cloud);
}
const spurPositions=GALACTIC_SPURS.map(s=>`vec4f(${s.position.map(v=>v.toFixed(8)).join(',')},${s.warmth}.0)`).join(',\n');
const spurShapes=GALACTIC_SPURS.map(s=>`vec4f(${s.tangent.map(v=>v.toFixed(8)).join(',')},${s.axes[0].toFixed(2)},${s.axes[2].toFixed(2)})`).join(',\n');
const spurHeights=GALACTIC_SPURS.map(s=>s.axes[1].toFixed(2)).join(',');
const spurCurvatures=GALACTIC_SPURS.map(s=>s.curvature.toFixed(8)).join(',');
const spurStrengths=GALACTIC_SPURS.map(s=>s.strength.toFixed(4)).join(',');

const bridgePositions=GALACTIC_BRIDGE_LAYERS.map(s=>`vec3f(${s.position.join(',')})`).join(',');
const bridgeAxes=GALACTIC_BRIDGE_LAYERS.map(s=>`vec3f(${s.axes.join(',')})`).join(',');
const bridgeSlopes=GALACTIC_BRIDGE_LAYERS.map(s=>`vec2f(${s.slopes.join(',')})`).join(',');
const bridgeWeights=GALACTIC_BRIDGE_LAYERS.map(s=>s.weight).join(',');
const stellarPositions=GALACTIC_STELLAR_POPULATIONS.map(s=>`vec3f(${s.position.join(',')})`).join(',');
const stellarAxes=GALACTIC_STELLAR_POPULATIONS.map(s=>`vec3f(${s.axes.join(',')})`).join(',');
const stellarLight=GALACTIC_STELLAR_POPULATIONS.map(s=>`vec3f(${s.light.join(',')})`).join(',');
const stellarAngles=GALACTIC_STELLAR_POPULATIONS.map(s=>s.angle.toFixed(1)).join(',');
export const GALACTIC_MATERIAL_WGSL = /* wgsl */ `
const GALACTIC_STELLAR_POSITIONS=array<vec3f,3>(${stellarPositions});
const GALACTIC_STELLAR_AXES=array<vec3f,3>(${stellarAxes});
const GALACTIC_STELLAR_LIGHT=array<vec3f,3>(${stellarLight});
const GALACTIC_STELLAR_ANGLES=array<f32,3>(${stellarAngles});
const GALACTIC_HEIGHT: f32 = ${GALACTIC_HEIGHT.toFixed(1)};
const GALACTIC_BRIDGE_POSITIONS=array<vec3f,3>(${bridgePositions});
const GALACTIC_BRIDGE_AXES=array<vec3f,3>(${bridgeAxes});
const GALACTIC_BRIDGE_SLOPES=array<vec2f,3>(${bridgeSlopes});
const GALACTIC_BRIDGE_WEIGHTS=array<f32,3>(${bridgeWeights});
const GALACTIC_SPUR_POSITIONS=array<vec4f,8>(${spurPositions});
const GALACTIC_SPUR_SHAPES=array<vec4f,8>(${spurShapes});
const GALACTIC_SPUR_HEIGHTS=array<f32,8>(${spurHeights});
const GALACTIC_SPUR_CURVATURES=array<f32,8>(${spurCurvatures});
const GALACTIC_SPUR_STRENGTHS=array<f32,8>(${spurStrengths});
fn galacticSkyDirection(restDirection: vec3f) -> vec3f {
  // Align the existing panorama's luminous plane with the shared Galactic
  // plane. This artistic orientation is not a mapping of observed stars.
  let worldToCube = mat3x3f(
    vec3f(0.50286384, -0.69183331, -0.51816467),
    vec3f(0.80673823, 0.59087851, -0.00600187),
    vec3f(0.31032466, -0.41500513, 0.85525981)
  );
  return worldToCube * restDirection;
}
fn galacticHash(p: vec2f) -> f32 {
  var q = fract(vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973));
  q += vec3f(dot(q, q.yzx + vec3f(33.33)));
  return fract((q.x + q.y) * q.z);
}
fn galacticNoise(p: vec2f) -> f32 {
  let cell = floor(p);
  let part = fract(p);
  let w = part * part * (vec2f(3.0) - 2.0 * part);
  return mix(mix(galacticHash(cell), galacticHash(cell + vec2f(1, 0)), w.x),
    mix(galacticHash(cell + vec2f(0, 1)), galacticHash(cell + vec2f(1, 1)), w.x), w.y);
}
fn galacticInterval(eye: vec3f, direction: vec3f, height: f32) -> vec2f {
  let axes = vec3f(1.0 / ${GALACTIC_RADIUS.toFixed(1)}, 1.0 / height, 1.0 / ${GALACTIC_RADIUS.toFixed(1)});
  let e = eye * axes;
  let d = direction * axes;
  let a = dot(d, d);
  let b = dot(e, d);
  let discriminant = b * b - a * (dot(e, e) - 1.0);
  if (discriminant <= 0.0) { return vec2f(0.0); }
  let chord = sqrt(discriminant);
  return vec2f(max(0.0, (-b - chord) / a), max(0.0, (-b + chord) / a));
}
struct GalacticRegion {
  radius: f32,
  phase: f32,
  height: f32,
  edge: f32,
  cloud: f32,
};
// Average the actual vertical column over each finite segment. Splitting a
// column across quality levels must not change its emitted energy or replace
// a thin plane with a broader Gaussian. The short-span expansion avoids
// cancellation between nearly equal erf values.
fn galacticGaussian(mean: f32, span: f32, sharpness: f32) -> f32 {
  let root=sqrt(sharpness);let centre=mean*root;let width=abs(span)*root;
  if(width<.1) {
    return exp(-centre*centre)*max(0.0,1.0+(2.0*centre*centre-1.0)*width*width/12.0);
  }
  return max(0.0,.886226925*(galacticErf(centre+width*.5)-galacticErf(centre-width*.5))/width);
}
fn galacticBand(phase: f32, span: f32, power: f32, average: f32) -> f32 {
  // Keep fractional powers inside their positive domain on every GPU backend.
  let band=clamp(0.5+0.5*cos(phase*4.0),0.000001,1.0);
  return mix(average, pow(band, power), exp(-span * span * 4.0));
}
fn galacticDetail(span: f32, frequency: f32) -> f32 {
  let width = span * frequency;
  return inverseSqrt(1.0 + width * width);
}
// Three fixed bands describe cloud groups, internal knots and softer veils.
// The same rest-space field places auxiliary stars; only the fine gas slowly
// changes with the observation clock. No point gets a new selectable identity.
fn galacticCloud(p:vec3f,span:f32)->f32 {
  let broad=mix(.5,galacticNoise(p.xz*.13+vec2f(9.7,21.3)),galacticDetail(span,.13))*.55+
    mix(.5,galacticNoise(vec2f(p.y*.31,p.x*.13)+vec2f(6.2,4.8)),galacticDetail(span,.31))*.45;
  let medium=mix(.5,galacticNoise(p.xz*.47+vec2f(17.2+(broad-.5)*.55,6.4)),galacticDetail(span,.47))*.60+
    mix(.5,galacticNoise(vec2f(p.y*.80,p.z*.47)+vec2f(12.1,2.7)),galacticDetail(span,.80))*.40;
  let drift=sin(f.forward.w*.018)*.035;
  let fine=mix(.5,galacticNoise(p.xz*1.61+vec2f(3.8+drift,29.1)),galacticDetail(span,1.61))*.55+
    mix(.5,galacticNoise(vec2f(p.y*2.1,p.x*1.61)+vec2f(5.9,18.3+drift)),galacticDetail(span,2.1))*.45;
  return broad*.52+medium*.32+fine*.16;
}
fn galacticRegion(p: vec3f, segment: vec3f) -> GalacticRegion {
  let radius = length(p.xz);
  let theta = atan2(p.z, p.x);
  let seed = f.style.z;
  let drift = vec2f(sin(f.forward.w * 0.043), cos(f.forward.w * 0.037)) * 0.32;
  let cloud = galacticCloud(p,length(segment))*.72+
    mix(0.5,galacticNoise(p.xz*.38+vec2f(seed*19.1,seed*7.3)+drift),galacticDetail(length(segment.xz),.38))*.28;
  let warp = (cloud - 0.5) * 0.38 + sin(theta * 3.0 + radius * 0.24) * 0.045;
  let phase = theta - log(max(radius, 0.5) / 1.6) * 2.05 + warp;
  let height = p.y - sin(theta * 2.0 + seed * 6.0) * radius * 0.009;
  let outskirts=12.1+sin(theta*3.0+.9)*1.7+sin(theta*5.0-.2)*1.1;
  // This inner field dissolves before its sampling ellipsoid. The exterior
  // uses the same finite spur recipe as auxiliary stars, without a rim.
  let edge=(1.0-smoothstep(outskirts-4.0,min(19.0,outskirts+2.4),radius))*exp(-radius/24.0);
  return GalacticRegion(radius, phase, height, edge, cloud);
}
fn galacticRegionDust(region: GalacticRegion, segment: vec3f) -> f32 {
  let phaseSpan = length(segment.xz) * 2.3 / max(region.radius, 0.8);
  let lane = galacticBand(region.phase + 0.12, phaseSpan, 7.0, 0.20947265625);
  let clumps = 0.16 + smoothstep(0.28, 0.72, region.cloud) * 0.84;
  return lane * clumps * galacticGaussian(region.height, abs(segment.y) + length(segment.xz) * 0.009, 22.0)
    * region.edge * smoothstep(0.5, 2.0, region.radius) * 1.25;
}
fn galacticDust(p: vec3f, segment: vec3f) -> f32 {
  return galacticRegionDust(galacticRegion(p, segment), segment);
}
fn galacticColumn(eye: vec3f, direction: vec3f, distance: f32) -> f32 {
  let interval = galacticInterval(eye, direction, 1.5);
  let end = min(interval.y, distance);
  if (end <= interval.x) { return galacticOuterColumn(eye,direction,distance); }
  // Only the thin foreground column is queried; no per-star resources exist.
  let samples = u32(clamp(f.quality.y - 2.0, 1.0, 4.0));
  let step = (end - interval.x) / f32(samples);
  var column = 0.0;
  for (var i = 0u; i < 4u; i += 1u) {
    if (i >= samples) { break; }
    column += galacticDust(eye + direction * (interval.x + (f32(i) + 0.5) * step), direction * step) * step;
  }
  return min(column+galacticOuterColumn(eye,direction,distance), 2.4);
}
fn galacticTransmission(column: f32) -> vec3f {
  return exp(-column * vec3f(0.74, 1.02, 1.35));
}
fn galacticScatter(p: vec3f) -> f32 {
  let region = galacticRegion(p, vec3f(0.0));
  return (0.06 + pow(smoothstep(0.28, 0.78, region.cloud), 2.0) * 0.94)
    * exp(-region.height * region.height * 2.5) * 0.32;
}
// The named/star catalog retains its coordinates. Its outskirts blend with
// the auxiliary flared disc instead of exposing the original allocation rim.
fn galacticOuterFade(p:vec3f)->f32 {
  let angle=atan2(p.z,p.x);
  let end=12.1+sin(angle*2.0+.9)*1.7+sin(angle*5.0-.2)*1.1;
  let broken=.32+.68*smoothstep(.22,.72,galacticCloud(p,0.0));
  // Both the catalogue and its original dust population dissolve inside
  // their allocation; halo/arm references continue through the shared spurs.
  let radius=length(p.xz);
  let central=mix(.18,.52,smoothstep(.5,7.0,radius));
  return mix(1.0,.002,smoothstep(max(5.8,end-6.5),end,radius))*broken*central;
}
fn galacticHaloColumn(eye:vec3f,ray:vec3f,centre:vec3f,axes:vec3f)->f32 {
  let e=(eye-centre)/axes;let d=ray/axes;
  let magnitude=dot(d,d);let along=-dot(e,d)/magnitude;
  let miss=e+d*along;
  return exp(-dot(miss,miss))*1.77245385/sqrt(magnitude)*smoothstep(-1.5,1.5,along*sqrt(magnitude));
}
fn galacticErf(x:f32)->f32 {
  let t=1.0/(1.0+.3275911*abs(x));
  let polynomial=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t;
  return sign(x)*(1.0-polynomial*exp(-x*x));
}
// Shared fixed affine populations: no ray-dependent tangent or clipped
// sheet boundary. The overlap creates a broad non-planar connection.
struct GalacticVeilRay {q:vec3f,d:vec3f};
fn galacticVeilRay(eye:vec3f,ray:vec3f,index:u32)->GalacticVeilRay {
  let centre=GALACTIC_BRIDGE_POSITIONS[index];let axes=GALACTIC_BRIDGE_AXES[index];
  let slope=GALACTIC_BRIDGE_SLOPES[index];let e=eye-centre;
  return GalacticVeilRay(vec3f(e.x,e.y-dot(slope,e.xz),e.z)/axes,
    vec3f(ray.x,ray.y-dot(slope,ray.xz),ray.z)/axes);
}
// Integrate only the gas in front of the observed light. All three Gaussian
// tails dissolve in world space; no volume march, texture or buffer is added.
fn galacticVeilColumn(eye:vec3f,ray:vec3f,distance:f32)->f32 {
  var column=0.0;
  for(var index=0u;index<3u;index++) {
    let chart=galacticVeilRay(eye,ray,index);let q=chart.q;let d=chart.d;
    let magnitude=dot(d,d);let centreTime=-dot(q,d)/magnitude;
    let miss=q+d*centreTime;let root=sqrt(magnitude);
    let integral=.886226925/root*(galacticErf((distance-centreTime)*root)-galacticErf(-centreTime*root));
    column+=max(0.0,exp(-dot(miss,miss))*integral)*GALACTIC_BRIDGE_WEIGHTS[index];
  }
  return column;
}
fn galacticVeilCloud(eye:vec3f,ray:vec3f)->f32 {
  let chart=galacticVeilRay(eye,ray,1u);
  let magnitude=dot(chart.d,chart.d);
  let at=max(0.0,-dot(chart.q,chart.d)/magnitude);
  // A long integrated column averages many cloud cells. A pixel cone alone
  // leaves a single projected noise sample and produces grazing ribbons.
  let columnSpan=length(vec2f(ray.x+ray.y*.72,ray.z-ray.y*.45))/sqrt(magnitude);
  let footprint=max(columnSpan,max(.015,at*2.0*f.right.w/max(f.viewport.w,1.0)));
  return galacticCloud(eye+ray*at,footprint);
}
// Finite foreground integration stops at the observed light. A local tangent
// approximates the bent Gaussian without introducing another volume march.
fn galacticRibbonColumn(eye:vec3f,ray:vec3f,index:u32,distance:f32)->f32 {
  let centre=GALACTIC_SPUR_POSITIONS[index].xyz;
  let shape=GALACTIC_SPUR_SHAPES[index];let tangent=shape.xy;
  let e=eye-centre;
  var localEye=vec3f(dot(e.xz,tangent),e.y,dot(e.xz,vec2f(-tangent.y,tangent.x)));
  var localRay=vec3f(dot(ray.xz,tangent),ray.y,dot(ray.xz,vec2f(-tangent.y,tangent.x)));
  let axes=vec3f(shape.z,GALACTIC_SPUR_HEIGHTS[index],shape.w);
  let scaledEye=localEye/axes;let scaledRay=localRay/axes;
  let closest=max(0.0,-dot(scaledEye,scaledRay)/dot(scaledRay,scaledRay));
  let along=localEye.x+localRay.x*closest;
  let curvature=GALACTIC_SPUR_CURVATURES[index];let slope=2.0*curvature*along;
  localEye.z-=curvature*along*along+slope*(localEye.x-along);
  localRay.z-=slope*localRay.x;
  let q=localEye/axes;let d=localRay/axes;
  let magnitude=dot(d,d);let centreTime=-dot(q,d)/magnitude;
  let miss=q+d*centreTime;let root=sqrt(magnitude);
  let integral=.886226925/root*(galacticErf((distance-centreTime)*root)-galacticErf(-centreTime*root));
  return max(0.0,exp(-dot(miss,miss))*integral);
}
fn galacticRibbonFragments(eye:vec3f,ray:vec3f,index:u32)->f32 {
  let centre=GALACTIC_SPUR_POSITIONS[index].xyz;
  let along=max(0.0,dot(centre-eye,ray));let p=eye+ray*along;
  return galacticNoise(p.xz*.32+vec2f(f32(index)*7.1,11.0));
}
fn galacticOuterColumn(eye:vec3f,ray:vec3f,distance:f32)->f32 {
  let cloud=galacticVeilCloud(eye,ray);
  var column=galacticVeilColumn(eye,ray,distance)*pow(smoothstep(.38,.70,cloud),2.0)*.045;
  for(var index=0u;index<8u;index+=1u) {
    let clumps=pow(smoothstep(.24,.78,galacticRibbonFragments(eye,ray,index)),2.0);
    column+=galacticRibbonColumn(eye,ray,index,distance)*GALACTIC_SPUR_STRENGTHS[index]*clumps*.030;
  }
  return column;
}
fn galacticHaloField(eye:vec3f,ray:vec3f)->vec4f {
  // Continuous old stellar light already comes from galacticStellarField and
  // the shared disc. Do not add a second, unextinguished luminous Gaussian
  // across the entire outskirts; retain the actual fragmented gas below.
  var light=vec3f(0.0);
  let veil=galacticVeilColumn(eye,ray,100000.0);
  let veilCloud=galacticVeilCloud(eye,ray);
  let veilKnots=pow(smoothstep(.35,.64,veilCloud),2.0);
  let veilColor=mix(vec3f(.0030,.0051,.0087),vec3f(.0078,.0036,.0045),smoothstep(.54,.73,veilCloud));
  light+=veilColor*veil*(.015+veilKnots*.70);
  var dust=veil*pow(smoothstep(.38,.70,veilCloud),2.0)*.045;
  // Closed-form finite work; no additional volume march, texture or buffer.
  for(var index=0u;index<8u;index+=1u) {
    let warmth=GALACTIC_SPUR_POSITIONS[index].w;
    let column=galacticRibbonColumn(eye,ray,index,100000.0)*GALACTIC_SPUR_STRENGTHS[index];
    let cloud=galacticRibbonFragments(eye,ray,index);
    let fragments=.18+.82*smoothstep(.20,.82,cloud);
    light+=mix(vec3f(.0017,.00265,.0043),vec3f(.00245,.00155,.00195),warmth)*column*fragments*select(.58,1.0,index%2u==1u);
    // The same finite stellar ribbons continue beyond the inner disc. Young
    // cloud knots modulate the gas, not the older unresolved stellar light.
    // Reuse this column; a second volume or background image is unnecessary.
    light+=vec3f(.74,.69,.62)*column*select(.00085,.00010,index%2u==1u);
    dust+=column*pow(smoothstep(.24,.78,cloud),2.0)*.030;
  }
  return vec4f(light,dust);
}
// Closed-form luminous populations retain depth outside the thin gas slab.
// Their foreground column ends at the emitting population, just as it does
// for individual stars. The thin disc cannot cover the entire bulge by fiat.
fn galacticStellarField(eye:vec3f,ray:vec3f)->vec3f {
  var light=vec3f(0.0);
  for(var index=0u;index<3u;index++) {
    let angle=GALACTIC_STELLAR_ANGLES[index];let c=cos(angle);let a=sin(angle);
    let e=eye-GALACTIC_STELLAR_POSITIONS[index];
    let q=vec3f(c*e.x+a*e.z,e.y,-a*e.x+c*e.z)/GALACTIC_STELLAR_AXES[index];
    let d=vec3f(c*ray.x+a*ray.z,ray.y,-a*ray.x+c*ray.z)/GALACTIC_STELLAR_AXES[index];
    let magnitude=dot(d,d);let at=-dot(q,d)/magnitude;let miss=q+d*at;let root=sqrt(magnitude);
    let column=max(0.0,exp(-dot(miss,miss))*.886226925/root*(1.0-galacticErf(-at*root)));
    if(column>.002) {
      let transmission=galacticTransmission(galacticColumn(eye,ray,max(0.0,at)));
      light+=GALACTIC_STELLAR_LIGHT[index]*column*transmission;
    }
  }
  return light;
}
fn galacticRadiance(p: vec3f, segment: vec3f) -> vec4f {
  let region = galacticRegion(p, segment);
  if (region.edge < 0.0001) { return vec4f(0.0); }
  let span = length(segment.xz);
  let phaseSpan = span * 2.3 / max(region.radius, 0.8);
  let arm = galacticBand(region.phase, phaseSpan, 5.0, 0.24609375);
  let tangent = vec2f(-p.z, p.x) / max(region.radius, 0.5);
  let flow = p.xz + tangent * sin(f.forward.w * 0.10 + region.cloud * 6.0) * 0.38;
  let clump = mix(0.5, galacticNoise(flow * 1.12 + vec2f(f.style.z * 13.7, 9.1)), galacticDetail(span, 1.12));
  let fine = mix(0.5, galacticNoise(flow * 3.6 + vec2f(27.3, f.style.z * 31.0)), galacticDetail(span, 3.6));
  let fragments = smoothstep(0.30, 0.72, clump) * (0.34 + fine * 0.66);
  let spur = galacticBand(region.phase - region.radius * 0.115, phaseSpan + span * 0.115, 9.0, 0.185470581)
    * smoothstep(0.52, 0.78, region.cloud);
  let thin=galacticGaussian(region.height,abs(segment.y)+span*.009,3.0);
  let shoulder=galacticGaussian(region.height-(region.cloud-.5)*1.9,abs(segment.y)+span*.022,.85);
  let disc=(thin*.78+shoulder*.22)*region.edge;
  let density = (0.020 + arm * (0.08 + fragments * 0.65) + spur * fragments * 0.12) * disc;
  let knots = arm * pow(smoothstep(0.57, 0.80, clump), 3.0) * fine * disc;
  let activity = 0.74 + sin(f.forward.w * 0.22 + region.cloud * 17.0 + clump * 9.0) * 0.26;
  let color = mix(vec3f(0.16, 0.115, 0.068), vec3f(0.075, 0.105, 0.155), smoothstep(1.4, 7.0, region.radius));
  // Unresolved stars form a continuous disc beneath the young gas knots.
  // It follows the same arms and warped plane, with broader arms and a
  // thicker old population. Cloud fragmentation must not cut holes through
  // the underlying galaxy. Both contributions use the existing ray samples
  // and the same foreground dust, rather than a second image or exposure.
  let stellarArm=galacticBand(region.phase,phaseSpan,1.6,0.412987039);
  let stellarHeight=.38+region.radius*.014;
  let stellarThin=galacticGaussian(region.height,abs(segment.y)+span*.009,1.0/(stellarHeight*stellarHeight));
  let stellarThick=galacticGaussian(region.height,abs(segment.y)+span*.009,.85);
  let stellarDisc=(stellarThin*.82+stellarThick*.18)*region.edge*exp(-region.radius/10.0)*smoothstep(.6,2.7,region.radius);
  let stellarColor=mix(vec3f(.85,.64,.42),vec3f(.58,.67,.82),smoothstep(3.0,12.0,region.radius));
  let stellarLight=stellarColor*stellarDisc*(.22+.78*stellarArm)*.065;
  let radiance = stellarLight + color * density * 0.66 + vec3f(0.19, 0.082, 0.09) * knots * activity * 0.12;
  return vec4f(radiance, galacticRegionDust(region, segment));
}
`;
