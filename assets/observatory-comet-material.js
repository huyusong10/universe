// Source-derived or authored nuclei with illustrative rock, gas and activity.
// One nucleus owns both tails. Gaussian segments keep the volume smooth at every
// quality level without another texture, particle catalog or ray-march target.
import { COMET_NUCLEUS_PLANES } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
const nucleusPlanes = COMET_NUCLEUS_PLANES.map(plane => `vec4f(${plane.map(v => v.toFixed(7)).join(',')})`).join(',');
// Legacy analytic fallback sites; shared solids supply derived surface roots.
// Their widths/activity remain illustrative, not measured vents.
const jetRoots = [[.45,.40,.48],[-.60,.23,-.42],[.58,-.35,-.37]].map(site => {
  const length = Math.hypot(...site), direction = site.map(v => v / length);
  const radius = COMET_NUCLEUS_PLANES.reduce((radius, plane) => {
    const facing = direction.reduce((sum, v, i) => sum + v * plane[i], 0);
    return facing > 0 ? Math.min(radius, plane[3] / facing) : radius;
  }, 1);
  return `vec3f(${direction.map(v => (v * radius).toFixed(7)).join(',')})`;
}).join(',');
export const COMET_MATERIAL_WGSL = /* wgsl */ `
const COMET_PLANES = array<vec4f, ${COMET_NUCLEUS_PLANES.length}>(${nucleusPlanes});
fn isCometMaterial()->bool {return (f.style.w>6.5 && f.style.w<7.5) || abs(f.style.w-64.0)<.5;}
fn cometAxes() -> vec3f { return vec3f(f.composition.zw, f.sun.w); }
fn cometLocal(p: vec3f) -> vec3f { return planetRotateX(p, -f.light.w); }
struct CometIntersection { distance:f32, impact:f32, along:f32, face:f32, chord:f32, normal:vec3f, lightPoint:vec3f };
fn cometHit(center: vec3f, ray: vec3f) -> CometIntersection {
  let source = cometLocal(center) / cometAxes();
  let direction = cometLocal(ray) / cometAxes();
  let shape=solidRange(f.style.w,f.star.w);
  if(shape.y>shape.x) {
    let hit=solidHit(source,direction,shape);
    return CometIntersection(hit.distance,select(2.0,0.0,hit.distance>=0.0),dot(source,direction),-1.0,1.0,hit.normal/cometAxes(),hit.lightPoint);
  }
  if(hasContactWorld(f.style.w)) {
    let hit=contactWorldHit(source,direction,f.style.w);
    return CometIntersection(hit.distance,select(2.0,0.0,hit.distance>=0.0),dot(source,direction),-1.0,hit.chord,hit.normal/cometAxes(),direction*hit.distance-source);
  }
  let magnitude = dot(direction, direction);
  let along = dot(source, direction) / magnitude;
  let closest = source - direction * along;
  var miss = dot(closest, closest);
  let span = sqrt(max(0.0,(1.0-miss)/magnitude));
  var enter = along-span;
  var exit = along+span;
  var face = -1.0;
  for (var i=0u;i<${COMET_NUCLEUS_PLANES.length}u;i++) {
    let plane=COMET_PLANES[i];
    let denominator=dot(plane.xyz,direction);
    let bound=plane.w+dot(plane.xyz,source);
    if (abs(denominator)<0.0000001) { if (bound<0.0) { miss=2.0; } }
    else if (denominator>0.0) { exit=min(exit,bound/denominator); }
    else if (bound/denominator>enter) { enter=bound/denominator; face=f32(i); }
  }
  if (enter>exit) { miss=2.0; }
  return CometIntersection(enter,miss,along,face,max(0.0,exit-enter),vec3f(0),direction*enter-source);
}
// Value and analytic derivative share one field evaluation; roughness does not
// require four independently sampled noisy surfaces at every fragment.
struct CometTerrain { slope:vec3f, tone:f32, deposit:f32, layer:f32 };
// Cartesian fields stay fixed on the actual hit surface, including concave
// walls and contact necks. No angular crater decal crosses the source mesh.
fn cometTerrain(p:vec3f,normal:vec3f,viewRay:vec3f)->CometTerrain {
  let seed=f.star.w*vec3f(7.1,3.9,5.3);
  let variation=fract(f.star.w*23.713);
  let near=bodyNearDetail();let raster=max(bodyRasterRadius(),1.0);
  let local=(1.0-smoothstep(1.9,2.8,f.eye.w/f.focus.w))*smoothstep(120.0,260.0,raster);
  let broad=stellarNoiseGradient(p*3.7+vec3f(.7,2.3,.4)+seed);
  let broken=stellarNoiseGradient(p*13.0+vec3f(2.1,.4,1.9)+seed);
  // Patchy crust and smooth dust occupy the same regions at both LODs.
  // Surface orientation modifies only the material, never the true normal.
  let dust=smoothstep(.47,.73,broad.w)*(.45+.55*abs(normal.y));
  let crust=(1.0-dust)*(.55+.45*variation);
  var gradient=broad.xyz*(3.7*.018)+broken.xyz*(13.0*.008)*(1.0-dust*.78);
  let joint=broken.w-.47;
  let width=.034+min(.10,13.0/raster*.25);
  let crack=exp(-joint*joint/(width*width))*crust;
  gradient+=broken.xyz*(13.0*.0012)*(-2.0*joint/(width*width))*crack*near;
  var layer=(broken.w-.5)*.48-crack*.22*near;
  var deposit=dust;
  // Curved, interrupted shelves cross exposed cliffs in fixed nucleus space.
  // Dust buries them on smoother regions; both LODs retain the same strata.
  // These layers and chips are authored, not mapped Rosetta stratigraphy.
  let layerAxis=normalize(vec3f(.16,1.0,.21));
  let level=dot(p,layerAxis)+(broad.w-.5)*.23+(broken.w-.5)*.045;
  let levelSlope=layerAxis+broad.xyz*(3.7*.23)+broken.xyz*(13.0*.045);
  let frequency=22.0+variation*12.0;
  let phase=level*frequency+sin(level*7.1)*.85+variation*6.2831853;
  let phaseSlope=levelSlope*(frequency+6.035*cos(level*7.1));
  let footprint=raster*sqrt(max(dot(normal,-viewRay),.025));
  let shelvesResolved=1.0-smoothstep(.30,.85,frequency/max(footprint,1.0));
  let cliff=(1.0-smoothstep(.25,.78,abs(dot(normal,layerAxis))))*crust;
  let shelves=sin(phase);let strength=cliff*shelvesResolved;
  gradient+=phaseSlope*cos(phase)*.0024*strength;
  layer+=shelves*.23*strength;

  let gravelWeight=near*(1.0-smoothstep(.28,.85,47.0/raster));
  if(gravelWeight>0.0) {
    let gravel=stellarNoiseGradient(p*47.0+seed+vec3f(1.7,3.4,6.1));
    gradient+=gravel.xyz*(47.0*.0011)*gravelWeight*(1.0-dust*.65);
    layer+=(gravel.w-.5)*(.42+.36*variation)*gravelWeight;
    let chips=regolithStones(p+seed,31.0+variation*11.0,footprint);
    gradient+=chips.xyz*.38*gravelWeight*crust;
    layer+=chips.w*.65*gravelWeight*crust;
  }
  let gritWeight=local*(1.0-smoothstep(.28,.72,113.0/raster));
  if(gritWeight>0.0) {
    let grit=stellarNoiseGradient(p*113.0+seed+vec3f(8.4,2.8,4.7));
    gradient+=grit.xyz*(113.0*.00024)*gritWeight*(1.0-dust*.55);
    layer+=(grit.w-.5)*.74*gritWeight;
    // These finite activity roots are derived from the shared solid. The dark
    // surroundings are authored context, not a claim of measured active vents.
    for(var i=0u;i<3u;i++) {
      let site=solidJet(f.style.w,f.star.w,i);
      let offset=p-site.point*cometAxes();
      let surround=exp(-dot(offset,offset)/(.004+.003*variation));
      layer-=surround*.48*local;deposit=max(deposit,surround*.35*local);
    }
  }
  return CometTerrain(gradient,broad.w+(broken.w-.5)*.36,deposit,layer);
}
fn cometNucleusFragment(center: vec3f, ray: vec3f) -> vec4f {
  let hit = cometHit(center, ray);
  // Derivatives precede any nonuniform discard; coverage includes cut silhouettes.
  let cutEdge=smoothstep(0.0,max(fwidth(hit.chord)*1.1,0.00001),hit.chord);
  if (hit.along < 0.0 || hit.impact > 1.0 || hit.distance < 0.0) { discard; }
  let p = cometLocal(ray*hit.distance-center);
  let q=p/cometAxes();
  let shape=solidRange(f.style.w,f.star.w);
  var normal=normalize(p/(cometAxes()*cometAxes()));
  if(shape.y>0u || hasContactWorld(f.style.w)) {normal=normalize(hit.normal);}
  if(hit.face>=0.0) {
    let cutNormal=normalize(COMET_PLANES[u32(hit.face)].xyz/cometAxes());
    let cutWeight=.16+smoothstep(0.0,.16,max(0.0,1.0-length(q)))*.54;
    normal=normalize(mix(normal,cutNormal,cutWeight));
  }
  let terrain=cometTerrain(p,normal,cometLocal(ray));
  let tangent=terrain.slope-normal*dot(terrain.slope,normal);
  let bounded=tangent/max(1.0,length(tangent)/.34);
  let roughNormal=normalize(normal-bounded);
  let light=cometLocal(f.light.xyz);
  var visibility=1.0;
  if(dot(normal,light)>0.0) {visibility=solidSunVisibility(hit.lightPoint,light/cometAxes(),shape,bodyRasterRadius());}
  
  // Seeded mineral tint is illustrative; all four nuclei remain very dark.
  let tint=fract(f.star.w*23.713);
  let dark=mix(vec3f(.027,.026,.024),vec3f(.037,.029,.022),tint);
  let lightCrust=mix(vec3f(.124,.121,.111),vec3f(.148,.116,.082),tint);
  let albedo=mix(dark,lightCrust,smoothstep(.22,.78,terrain.tone))*
    (1.0-terrain.deposit*.13)*(1.0+terrain.layer*.64);
  let radiance=regolithRadiance(albedo,normal,roughNormal,cometLocal(ray),light,visibility,.78);
  let edge = smoothstep(0.0,bodyEdgeWidth(),1.0-sqrt(hit.impact));
  let alpha = edge*cutEdge*smoothstep(0.55,3.5,f.presentation.x);
  return vec4f(radiance*alpha,alpha);
}
// Tail Gaussians have a broad longitudinal support. Clip that support to the
// downwind half-space so it cannot leak through the upstream head or surface.
fn cometTailDensity(center:vec3f,ray:vec3f,away:vec3f,side:vec3f,sigma:vec3f,start:f32,end:f32)->f32 {
  if(end<=start) { return 0.0; }
  let total=gaussianRayDensity(center,ray,away,side,sigma,end);
  if(start<=0.0) { return total; }
  return max(0.0,total-gaussianRayDensity(center,ray,away,side,sigma,start));
}
fn cometVolumeFragment(center: vec3f, ray: vec3f) -> vec4f {
  let away = -f.light.xyz;
  let reference = select(vec3f(0,1,0),vec3f(1,0,0),abs(away.y)>0.92);
  let side = normalize(cross(away,reference));
  let hit = cometHit(center,ray);
  let limit = select(100000.0,hit.distance,hit.along>0.0 && hit.impact<1.0 && hit.distance>0.0);
  let count = u32(clamp(f.quality.x*0.5,6.0,16.0));
  var tailStart=0.0;var tailEnd=limit;
  let axial=dot(ray,away);let boundary=dot(center,away)+.45;
  if(abs(axial)>.000001) {
    let crossing=boundary/axial;
    if(axial>0.0) { tailStart=max(0.0,crossing); } else { tailEnd=min(limit,crossing); }
  } else if(boundary>0.0) { tailEnd=0.0; }
  let time = f.forward.w;
  let activity = 1.0+sin(time*0.7)*0.18;
  var dust = 0.0;
  var ions = 0.0;
  for (var i=0u;i<count;i++) {
    let fraction = (f32(i)+0.5)/f32(count);
    let d = fraction*22.0;
    let wave = sin(d*0.7-time*1.15);
    let dustCenter = center+away*d+side*(d*d*0.024+wave*d*0.025);
    let width = 0.10+d*0.092;
    dust += cometTailDensity(dustCenter,ray,away,side,vec3f(22.0/f32(count)*0.85,width,width*0.62),tailStart,tailEnd)*
      (0.085*mix(.28,1.0,smoothstep(.3,3.0,d))*exp(-d*0.072)*(1.0-smoothstep(17.0,22.0,d))*(1.0+wave*0.30));
    let ionDistance = fraction*28.0;
    let ionWidth = 0.07+ionDistance*0.025;
    let ionWave = sin(ionDistance*0.85-time*1.8);
    let ionCenter = center+away*ionDistance+side*ionWave*ionDistance*0.018;
    ions += cometTailDensity(ionCenter,ray,away,side,vec3f(28.0/f32(count)*0.82,ionWidth,ionWidth),tailStart,tailEnd)*
      (0.14*mix(.35,1.0,smoothstep(.3,2.5,ionDistance))*exp(-ionDistance*0.067)*(1.0-smoothstep(21.0,28.0,ionDistance))*(1.0+ionWave*0.48));
  }
  // A faint extended coma surrounds a denser, compact head. Approaching should
  // reveal the surface and active sites rather than a viewport-sized white veil.
  let coma = gaussianRayDensity(center+away*.7,ray,away,side,vec3f(2.2,1.5,1.5),limit)*.0035+
    gaussianRayDensity(center+away*.35,ray,away,side,vec3f(1.0,.72,.72),limit)*.018;
  var jet=0.0;
  // Local fans attach to rotating nucleus faces; outward ripples reveal gas flow.
  let roots=array<vec3f,3>(${jetRoots});
  for(var i=0u;i<3u;i++) {
    let site=solidJet(f.style.w,f.star.w,i);
    let axis=planetRotateX(site.normal,f.light.w);
    let jetSide=normalize(cross(axis,vec3f(.13,.91,.39)));
    let root=planetRotateX(site.point*.999,f.light.w);
    let lit=.15+max(dot(axis,f.light.xyz),0.0)*.85;
    for(var j=0u;j<3u;j++) {
      let d=.20+f32(j)*.38;
      let width=.042+d*.11;
      let wave=.70+.30*sin(d*8.0-time*1.8+f32(i)*2.1);
      jet+=gaussianRayDensity(center+root+axis*d,ray,axis,jetSide,vec3f(.23,width,width*.74),limit)*.13*wave*exp(-d*.9)*lit;
    }
  }
  jet*=activity;
  let density = dust+ions+coma+jet;
  if (density<0.0002) { discard; }
  let alpha = (1.0-exp(-density))*smoothstep(0.55,3.5,f.presentation.x);
  let color = (vec3f(1.02,0.85,0.59)*dust+vec3f(0.22,0.57,1.0)*ions+vec3f(0.56,0.77,0.84)*(coma+jet))/max(density,0.0001);
  return vec4f(color*alpha*1.12,alpha);
}
`;
