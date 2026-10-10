// Attributed visualisation maps and artistic light/relief, not measured height.
// Haze and polar fans retain the same body coordinates and observation clock.
import { VESTA_AXES, PHOBOS_AXES, DEIMOS_AXES, MARS_MOON_PHASE } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
import { SMALL_WORLD_SHAPES, CONTACT_WORLD_SHAPES, NEW_SMALL_WORLDS, SMALL_WORLD_CAVITIES } from './observatory-small-worlds.js?v=cosmic-explore-20261010gu';
import { MAP_MERIDIANS } from './observatory-map-coverage-data.js?v=cosmic-explore-20261010gu';
const shapeKeys = ['vesta','phobos','deimos','eros','bennu','proteus',...Object.keys(NEW_SMALL_WORLDS).filter(key=>SMALL_WORLD_SHAPES[key])];
const shapeCodes = {vesta:26,phobos:32,deimos:33,eros:49,bennu:50,proteus:48,...Object.fromEntries(Object.entries(NEW_SMALL_WORLDS).map(([key,value])=>[key,value.code]))};
const shapeCaps = shapeKeys.flatMap(key => SMALL_WORLD_SHAPES[key]).map(plane => `vec4f(${plane.map(v => v.toFixed(7)).join(',')})`).join(',');
const axesCases=Object.values(NEW_SMALL_WORLDS).map(v=>`if(abs(material-${v.code}.0)<.5) {return vec3f(${v.axes.join(',')});}`).join('\n');
const capCases=shapeKeys.map((key,i)=>`if(abs(material-${shapeCodes[key]}.0)<.5) {return ${i*24}u;}`).join('\n');
const lobes=Object.values(CONTACT_WORLD_SHAPES).flat();
const contactCentres=lobes.map(l=>`vec3f(${l.centre.join(',')})`).join(',');
const contactAxes=lobes.map(l=>`vec3f(${l.axes.join(',')})`).join(',');
const contactCaps=lobes.flatMap(l=>l.caps).map(c=>`vec4f(${c.map(v=>v.toFixed(7)).join(',')})`).join(',');
const cavities=Object.values(SMALL_WORLD_CAVITIES).flat().map(p=>`vec4f(${p.map(v=>v.toFixed(7)).join(',')})`).join(',');
export const SATELLITE_MAP_WGSL = /* wgsl */ `
const VESTA_AXES = vec3f(${VESTA_AXES.join(',')});
const PHOBOS_AXES = vec3f(${PHOBOS_AXES.join(',')});
const DEIMOS_AXES = vec3f(${DEIMOS_AXES.join(',')});
fn satelliteAxes(material:f32)->vec3f {
  ${axesCases}
  if(material>42.5 && material<43.5) { return vec3f(1.48,.64,.86); }
  if(material>47.5 && material<48.5) { return vec3f(1.12,.91,1.0); }
  if(material>48.5 && material<49.5) { return vec3f(1.85,.53,.65); }
  if(material>49.5 && material<50.5) { return vec3f(1.08,.86,1.08); }
  if (material>25.5 && material<26.5) { return VESTA_AXES; }
  if (material>31.5 && material<32.5) { return PHOBOS_AXES; }
  if (material>32.5 && material<33.5) { return DEIMOS_AXES; }
  return vec3f(1.0);
}
const SMALL_WORLD_CAPS = array<vec4f,${shapeKeys.length*24}>(${shapeCaps});
fn smallWorldOffset(material:f32)->u32 {
  ${capCases}
  return 4294967295u;
}
const SMALL_WORLD_PITS=array<vec4f,4>(${cavities});
fn smallWorldPitRange(material:f32)->vec2u {
  if(abs(material-59.0)<.5) {return vec2u(0u,3u);}
  if(abs(material-62.0)<.5) {return vec2u(3u,1u);}
  return vec2u(0u);
}
fn hasContactWorld(material:f32)->bool { return abs(material-56.0)<.5 || abs(material-64.0)<.5; }
const CONTACT_CENTRES=array<vec3f,4>(${contactCentres});
const CONTACT_AXES=array<vec3f,4>(${contactAxes});
const CONTACT_CAPS=array<vec4f,48>(${contactCaps});
struct ContactIntersection {distance:f32,chord:f32,normal:vec3f};
// Union of two worn lobes. No enclosing ellipsoid fills the concave neck.
// The same finite primitive rays drive opaque coverage and CPU picking.
fn contactWorldHit(source:vec3f,direction:vec3f,material:f32)->ContactIntersection {
  var result=ContactIntersection(-1.0,0.0,vec3f(0));
  let first=select(0u,2u,material>63.5);
  for(var l=first;l<first+2u;l++) {
    let axes=CONTACT_AXES[l];let q=(source+CONTACT_CENTRES[l])/axes;let d=direction/axes;
    let m=dot(d,d);let along=dot(q,d)/m;let miss=q-d*along;
    let squaredSpan=(1.0-dot(miss,miss))/m;
    if(along<=0.0 || squaredSpan<0.0) {continue;}
    let span=sqrt(squaredSpan);var entry=along-span;var exit=along+span;var face=-1;
    for(var i=0u;i<12u;i++) {
      let cap=CONTACT_CAPS[l*12u+i];let c=q+cap.xyz;let a=dot(c,d)/m;let delta=c-d*a;
      let t=(cap.w-dot(delta,delta))/m;
      if(t<0.0) {entry=1e20;break;}
      let r=sqrt(t);exit=min(exit,a+r);
      if(a-r>entry) {entry=a-r;face=i32(i);}
      if(entry>exit) {entry=1e20;break;}
    }
    if(entry<0.0 || entry>exit || (result.distance>=0.0 && entry>=result.distance)) {continue;}
    let p=d*entry-q;var normal=normalize(p/axes);
    if(face>=0) { normal=normalize(mix(normal,normalize((p-CONTACT_CAPS[l*12u+u32(face)].xyz)/axes),.70)); }
    result=ContactIntersection(entry,max(0.0,exit-entry),normal);
  }
  return result;
}
fn satelliteLayer(material:f32)->i32 {
  if(material>44.5 && material<47.5) { return i32(material-26.0); }
  if(material>37.5 && material<41.5) { return i32(material-23.0); }
  if(material>33.5 && material<35.5) { return i32(material-21.0); }
  if(material>31.5 && material<33.5) { return i32(material-21.0); }
  return i32(select(material-15.0,material-16.0,material>18.5));
}
fn satellitePhase(material:f32,spin:f32)->f32 {
  // Authored starting meridian brings Herschel into Mimas' first lit view.
  let offset=select(select(0.0,2.55,material>21.5 && material<22.5),${MAP_MERIDIANS.pluto},material>22.5 && material<24.5);
  if(material>31.5 && material<33.5) { return spin+${MARS_MOON_PHASE}; }
  // Authored meridian reveals Iapetus' bright/dark boundary in the first view.
  if(material>34.5 && material<35.5) { return spin+2.25; }
  return spin+select(offset,${String(MAP_MERIDIANS.ceres).replace('-0.', '-.')},material>24.5 && material<25.5);
}
fn satelliteUV(p:vec3f)->vec2f {
  return vec2f(atan2(p.z,p.x)/6.2831853+.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,.001,.999));
}
`;
let craterSeed=0x5f3759df;
const craterRandom=()=>{craterSeed^=craterSeed<<13;craterSeed^=craterSeed>>>17;craterSeed^=craterSeed<<5;return (craterSeed>>>0)/4294967296;};
const frontierCraters = Array.from({length:96},(_,i)=>{
  // Deterministic, irregular sites and sizes avoid a repeated spiral lattice.
  // These are authored terrain cues, never a measured crater catalogue.
  const y=1-2*craterRandom(),angle=craterRandom()*Math.PI*2,r=Math.sqrt(1-y*y);
  const radius=i<24 ? .095+craterRandom()*.14 : i<64 ? .037+craterRandom()*.047 : .014+craterRandom()*.032;
  return `vec4f(${[Math.cos(angle)*r,y,Math.sin(angle)*r,radius].map(v=>v.toFixed(7)).join(',')})`;
}).join(',');
const smallSatelliteCases=Object.values(NEW_SMALL_WORLDS).filter(world=>world.profile).map(world=>{
  const p=world.profile;
  return `if(abs(material-${world.code}.0)<.5) {return SmallSatelliteStyle(vec3f(${p.low.join(',')}),vec3f(${p.high.join(',')}),${p.craters}u,${p.depth},${p.grooves},${p.ice}.0);}`;
}).join('\n');
// Large body-fixed authored patches give each new world readable geography.
// The same coordinates survive both detail levels; no acquired map is implied.
const frontierPatches=Object.values(NEW_SMALL_WORLDS).filter(world=>world.profile?.patches).map(world=>
  `if(abs(material-${world.code}.0)<.5) {`+world.profile.patches.map(p=>
    `{let w=1.0-smoothstep(${p[3]*.60},${p[3]},length(point-normalize(vec3f(${p.slice(0,3).join(',')})))); result=mix(result,vec4f(${p.slice(4).join(',')},1.0),w);}`).join('')+'}').join('\n');
const frontierBasins=Object.values(NEW_SMALL_WORLDS).filter(world=>world.profile?.roundness!==undefined).map(world=>
  `if(abs(material-${world.code}.0)<.5) {`+world.profile.basins.map(p=>
    `{let site=normalize(vec3f(${p.slice(0,3).join(',')})); let delta=point-site; let distance=max(length(delta),.0001); let radius=distance/${p[3]}; let wall=clamp((radius-.28)/.68,0.0,1.0); let tangent=delta/distance-point*dot(point,delta/distance); result+=vec4f(tangent*(6.0*wall*(1.0-wall)*${p[4]}/(.68*${p[3]})),-(1.0-smoothstep(.28,.96,radius))*.12);}`).join('')+'}').join('\n');
export const SATELLITE_MATERIAL_WGSL = /* wgsl */ `
// Rough diffuse reflection keeps broad phase and resolved terrain together.
// Oren-Nayar angular response is used as a restrained artistic material cue;
// colour/exposure and the small ambient fill are not measured photometry.
// The geometric horizon and direct mesh visibility still own the night side.
fn regolithRadiance(albedo:vec3f,normal:vec3f,detail:vec3f,ray:vec3f,sun:vec3f,visibility:f32,roughness:f32)->vec3f {
  let view=-ray;let muL=clamp(dot(detail,sun),0.0,1.0);let muV=clamp(dot(detail,view),0.0,1.0);
  let sinL=sqrt(max(0.0,1.0-muL*muL));let sinV=sqrt(max(0.0,1.0-muV*muV));
  let alignment=max(0.0,(dot(sun,view)-muL*muV)/max(sinL*sinV,.0001));
  let sigma=roughness*roughness;
  let a=1.0-.5*sigma/(sigma+.33);let b=.45*sigma/(sigma+.09);
  let sinAlpha=max(sinL,sinV);let tanBeta=min(sinL,sinV)/max(max(muL,muV),.08);
  let response=a+b*min(alignment,1.0)*sinAlpha*tanBeta;
  let direct=reflectedSurfaceLight(normal,detail,sun)*visibility;
  return albedo*(.042+direct*min(response,1.25)*1.52);
}
// Low and high materials form weathered regions, not a uniformly mixed skin.
// Mid-scale variation interrupts boundaries; both fields stay in body space.
fn regolithRegion(broad:f32,mid:f32)->f32 {
  return smoothstep(.24,.77,broad+(mid-.5)*.26);
}
const FRONTIER_CRATERS=array<vec4f,96>(${frontierCraters});
fn frontierPatch(material:f32,point:vec3f)->vec4f {
  var result=vec4f(0);
  ${frontierPatches}
  return result;
}
fn frontierBasin(material:f32,point:vec3f)->vec4f {
  var result=vec4f(0);
  ${frontierBasins}
  return result;
}
// Authored geology for worlds without an observation map. A continuous
// height derivative gives broad ridges and smaller broken flanks; colour is
// a material region, not a painted noise contour. No measured height implied.
// Derivatives and values of existing macro fields bend one finite stress
// network. No extra gradient-noise triplet or duplicate fine geology is needed.
fn terrainBreaks(p:vec3f,seed:f32,raster:f32,presence:f32,ice:f32,x:vec4f,y:vec4f,z:vec4f)->vec4f {
  let resolved=presence*smoothstep(18.0,96.0,raster);
  if(resolved<=0.0) {return vec4f(0);}
  let amplitude=vec3f(.24,.13,.065);
  let warped=p+(vec3f(x.w,y.w,z.w)-.5)*amplitude;
  let platePoint=normalize(warped);
  var first=-2.0;var second=-2.0;var a=vec3f(0,1,0);var b=vec3f(1,0,0);
  for(var i=0u;i<12u;i++) {
    let site=stellarRotateY(FRONTIER_CRATERS[i].xyz,seed*4.3);
    let score=dot(platePoint,site);
    if(score>first) {second=first;b=a;first=score;a=site;}
    else if(score>second) {second=score;b=site;}
  }
  let separation=max(length(a-b),.001);let gap=(first-second)/separation;
  let localDirection=(a-b)/separation;
  let projected=(localDirection-platePoint*dot(platePoint,localDirection))/max(length(warped),.01);
  let direction=projected+x.xyz*(amplitude.x*projected.x)+y.xyz*(amplitude.y*projected.y)+z.xyz*(amplitude.z*projected.z);
  let width=max(mix(.0045,.011,ice),1.4/max(raster,1.0));let q=gap/width;
  // Both derivatives vanish at the nearest-site swap, including shoulders.
  let trench=exp(-q*q);let shoulderQ=(q*q-4.84)/3.6;
  let shoulder=exp(-shoulderQ*shoulderQ);let depth=mix(.00085,.0024,ice);
  let damage=.18+.82*smoothstep(.24,.65,x.w*.55+y.w*.45);let strength=resolved*damage;
  let derivative=(2.0*q*trench*depth-4.0*q*shoulderQ*shoulder*(depth*.27)/3.6)/width;
  return vec4f(direction*derivative,shoulder*.075-trench*mix(.29,.17,ice))*strength;
}
struct AuthoredGeology {slope:vec3f,region:f32,tone:f32};
fn geologyRidge(p:vec3f,frequency:f32,offset:vec3f,raster:f32)->vec4f {
  let n=stellarNoiseGradient(p*frequency+offset);
  let delta=n.w-.5;let width=.027+min(.12,frequency/max(raster,1.0)*.18);
  let rounded=sqrt(delta*delta+width*width);
  return vec4f(n.xyz*(-2.0*frequency*delta/rounded),1.0-2.0*rounded);
}
fn authoredGeology(p:vec3f,seed:f32,raster:f32,near:f32,ice:f32,inspection:f32)->AuthoredGeology {
  let offset=vec3f(seed*31.7,7.4,13.2);
  let continent=stellarNoiseGradient(p*2.1+offset);
  let broad=geologyRidge(p,5.3,offset+vec3f(2.7,6.2,1.9),raster);
  let middle=geologyRidge(p,13.7,offset+vec3f(4.1,1.7,3.6),raster);
  let mask=clamp((continent.w-.28)/.43,0.0,1.0);
  let mountains=mask*mask*(3.0-2.0*mask);
  let maskSlope=continent.xyz*(2.1*6.0*mask*(1.0-mask)/.43);
  // Wide relief exists before the near LOD. The smaller flanks join smoothly
  // only while resolved, rather than replacing the broad geological field.
  let height=broad.w*.024+middle.w*.007;
  var slope=continent.xyz*(2.1*.035)+(broad.xyz*.024+middle.xyz*.007)*mountains+maskSlope*height;
  var tone=(broad.w-.5)*.26+(middle.w-.5)*.16;
  let fineWeight=near*(1.0-smoothstep(.30,.85,38.0/max(raster,1.0)));
  if(fineWeight>0.0) {
    let fine=geologyRidge(p,38.0,offset+vec3f(9.3,5.1,2.4),raster);
    slope+=fine.xyz*.0022*fineWeight*(.3+.7*mountains);
    tone+=(fine.w-.5)*.32*fineWeight;
  }
  let grainWeight=near*(1.0-smoothstep(.28,.70,104.0/max(raster,1.0)));
  if(grainWeight>0.0) {
    let grain=stellarNoiseGradient(p*104.0+offset+vec3f(1.7,5.1,8.2));
    slope+=grain.xyz*(104.0*.00026)*grainWeight;
    tone+=(grain.w-.5)*.12*grainWeight;
  }
  let fractures=terrainBreaks(p,seed,raster,select(.22+.78*inspection,.70+.30*near,ice>0.0),ice,
    vec4f(continent.xyz*2.1,continent.w),broad,middle);
  slope+=fractures.xyz;tone+=fractures.w;
  let regional=smoothstep(.20,.80,continent.w+(broad.w-.5)*.15);
  return AuthoredGeology(slope,regional,tone);
}
struct SmallSatelliteStyle {low:vec3f,high:vec3f,craters:u32,depth:f32,grooves:f32,ice:f32};
fn smallSatelliteStyle(material:f32)->SmallSatelliteStyle {
  ${smallSatelliteCases}
  return SmallSatelliteStyle(vec3f(.06),vec3f(.22),0u,0.0,0.0,0.0);
}
// The new satellite/asteroid cohort has distinct authored geography. Geometry
// supplies broad depth and direct shadows; resolved regolith adds material
// cues without changing the body, pose, clock or either LOD's silhouette.
fn smallSatelliteSurface(normal:vec3f,point:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let style=smallSatelliteStyle(b.material);
  let remote=b.material>113.5;
  // Solid hits already supply normalized ellipsoid coordinates. A second
  // axis division stretches regolith and its gradient on elongated worlds.
  let local=point;
  let rotated=stellarRotateY(local,b.seed*6.2831853);
  let loft=abs(b.material-86.0)<.5 || abs(b.material-92.0)<.5;
  let p=select(normalize(rotated),rotated,loft);let offset=vec3f(b.seed*13.1,7.2,3.8);
  var broad=vec4f(0,0,0,.5);var mid=vec4f(0,0,0,.5);
  if(!remote) {broad=stellarNoiseGradient(rotated*3.6+offset);mid=stellarNoiseGradient(rotated*15.0+offset);}
  let footprint=max(1.0,b.raster*sqrt(max(dot(normal,-ray),.025)));
  let near=b.near*smoothstep(1.2,3.6,footprint/48.0);
  let fineWeight=near*(1.0-smoothstep(.35,.9,46.0/footprint));
  var fine=vec4f(0,0,0,.5);var grains=vec4f(0,0,0,.5);
  if(fineWeight>0.0 && !remote) {fine=stellarNoiseGradient(rotated*46.0+offset);}
  let grain=near*smoothstep(100.0,320.0,footprint)*(1.0-smoothstep(.35,.9,126.0/footprint));
  if(grain>0.0 && !remote) {grains=stellarNoiseGradient(rotated*126.0+offset+vec3f(1.7,5.1,8.2));}
  let radial=satelliteWorld(point,b);let outward=smoothstep(.08,.60,dot(normal,radial));
  var slope=vec3f(0);var tone=0.0;
  for(var i=0u;i<64u;i++) {
    if(i>=style.craters) {break;}
    let crater=FRONTIER_CRATERS[i];let delta=p-crater.xyz;let d2=dot(delta,delta);
    if(d2>crater.w*crater.w*1.7) {continue;}
    let d=max(sqrt(d2),.0001);let r=d/crater.w;
    let age=fract(sin(f32(i)*127.1+23.7)*43758.5453);
    let floor=mix(.22,.44,age);let wall=clamp((r-floor)/(.88-floor),0.0,1.0);
    let rimWidth=mix(.10,.19,age);let rim=exp(-pow((r-.98)/rimWidth,2.0));
    let derivative=6.0*wall*(1.0-wall)/(.88-floor)-.4*(r-.98)/(rimWidth*rimWidth)*rim;
    let tangent=select(delta/d-p*dot(p,delta/d),delta/d,loft);let weight=select(select(.20,.06+near*.25,i>=24u),.45+near*.35,remote)*outward;
    slope+=tangent*derivative*style.depth*weight;
    tone+=(rim*.12-(1.0-smoothstep(floor,.88,r))*.25)*weight;
  }
  let line=p.y+.18*sin(p.x*4.2)+p.z*.14;
  let groove=exp(-line*line*140.0)*smoothstep(-.75,.65,p.x);
  slope+=vec3f(.756*cos(p.x*4.2),1,.14)*(-280.0*line*groove)*style.grooves*select(.12,.50,remote)*outward;
  tone-=groove*style.grooves*3.0*outward;
  slope+=broad.xyz*select(.026,.006,remote)+mid.xyz*select(.045,.018,remote)+fine.xyz*select(.080,.025,remote)*fineWeight+grains.xyz*select(.065,.020,remote)*grain;
  var geology=AuthoredGeology(vec3f(0),.5,0.0);
  if(remote) {
    let footprint=b.raster*sqrt(max(dot(normal,-ray),.025));
    geology=authoredGeology(p,b.seed,footprint,near,style.ice,b.inspection);
    // Inward mesh walls retain their own normal and direct shadow. Added
    // body-wide relief is attenuated there, never a fake radial bowl normal.
    slope+=geology.slope*.72*outward;tone+=geology.tone*.65;
  }
  let basin=frontierBasin(b.material,p);slope+=basin.xyz;tone+=basin.w;
  let unseeded=stellarRotateY(slope,-b.seed*6.2831853)/satelliteAxes(b.material);
  let world=planetRotateX(stellarRotateY(unseeded,-satellitePhase(b.material,b.spin)),b.tilt);
  let tangent=world-normal*dot(world,normal);let bounded=tangent/max(1.0,length(tangent)/(.24+near*.12));
  let shading=normalize(normal-bounded);
  // Authored terrain uses a softer grazing shadow handoff.
  // The same geometry casts it; deep, front-lit bowls and contact lobes keep
  // their occlusion, while near-horizon tiny facets avoid hard dark shards.
  let visibility=mix(1.0,b.sunVisibility,smoothstep(.08,.32,max(dot(normal,b.light),0.0)));
  let light=reflectedSurfaceLight(normal,shading,b.light)*visibility;
  
  let regional=select(regolithRegion(broad.w,mid.w),.32+geology.region*.60,remote);
  var albedo=mix(style.low,style.high,regional)*max(.35,1.0+tone+(fine.w-.5)*select(.38,.12,remote)*fineWeight+(grains.w-.5)*select(.72,.10,remote)*grain);
  let regionPatch=frontierPatch(b.material,p);
  albedo=mix(albedo,regionPatch.xyz*max(.35,1.0+tone+(fine.w-.5)*.30*near),regionPatch.w*.80);
  // Nix's observed reddish mark inspires this authored, unregistered region.
  // Both LODs retain its body-fixed position; no image is claimed as a map.
  if(abs(b.material-91.0)<.5) {
    let mark=1.0-smoothstep(.27,.52,length(p-normalize(vec3f(.42,.20,-.88))));
    albedo=mix(albedo,albedo*vec3f(1.24,.54,.35),mark*.88);
  }
  let frost=pow(max(dot(shading,normalize(b.light-ray)),0.0),22.0)*style.ice*.035*grain*light;
  return regolithRadiance(albedo,normal,shading,ray,b.light,visibility,mix(.73,.48,style.ice))+vec3f(.72,.78,.81)*frost;
}
// Bounded Cartesian stone patches follow the actual mesh, including shoulders
// and concave walls. Eight corners suffice: support plus jitter stays below
// one cell, so discarded corners are already zero at every cell boundary.
// Rounded plane joins retain angular rock without screen-sized polygon decals.
fn regolithStones(point:vec3f,frequency:f32,raster:f32)->vec4f {
  let resolved=1.0-smoothstep(.35,.85,frequency/max(raster,1.0));
  if(resolved<=0.0) {return vec4f(0);}
  let scaled=point*frequency;let cell=floor(scaled);
  var slope=vec3f(0);var tone=0.0;
  for(var i=0u;i<8u;i++) {
    let corner=cell+vec3f(f32(i&1u),f32((i>>1u)&1u),f32((i>>2u)&1u));
    let h=vec3f(stellarHash3(corner+vec3f(7.3,2.7,9.1)),
      stellarHash3(corner+vec3f(13.1,5.2,3.6)),stellarHash3(corner+vec3f(2.8,17.4,6.2)));
    let centre=corner+(h-.5)*.20;let delta=scaled-centre;
    let axis=normalize(h+vec3f(-.43,.13,-.31));
    let side=normalize(cross(axis,select(vec3f(0,1,0),vec3f(1,0,0),abs(axis.y)>.85)));
    let up=cross(axis,side);let aspect=.80+h.z*.40;
    let axes=vec3f(dot(delta,axis)*aspect,dot(delta,side)/aspect,dot(delta,up));
    let planes=sqrt(axes*axes+vec3f(.0025));
    let directions=mat3x3f(axis*aspect,side/aspect,up);
    let bevel=.075;let ab=sqrt((planes.x-planes.y)*(planes.x-planes.y)+bevel*bevel);
    let first=(planes.x+planes.y+ab)*.5;let wa=.5+.5*(planes.x-planes.y)/ab;
    let bc=sqrt((first-planes.z)*(first-planes.z)+bevel*bevel);
    let poly=(first+planes.z+bc)*.5;let wb=.5+.5*(first-planes.z)/bc;
    let planeGradient=directions*(axes/planes*vec3f(wa*wb,(1.0-wa)*wb,1.0-wb));
    // Radial support is below .86 cells even at a box corner. This bound,
    // including the .10 jitter, proves the eight-corner coverage at seams.
    let radial=max(length(delta),.0001);let gap=poly-radial*.70;
    let rounded=sqrt(gap*gap+.0036);let blend=.5+.5*gap/rounded;
    let distance=(poly+radial*.70+rounded)*.5;
    let gradient=mix(delta/radial*.70,planeGradient,blend);
    let radius=.38+h.x*.22;let inner=radius*.30;
    let t=clamp((distance-inner)/(radius-inner),0.0,1.0);
    let cover=1.0-t*t*(3.0-2.0*t);let flank=6.0*t*(1.0-t)/(radius-inner);
    slope-=gradient*flank*.080;
    tone+=cover*(.17+h.y*.45)-cover*(1.0-cover)*.55;
  }
  return vec4f(slope,tone)*resolved;
}
fn frontierRubble(point:vec3f,raster:f32,near:f32)->vec4f {
  let broad=regolithStones(point,12.0,raster);
  var gravel=vec4f(0);
  if(near>0.0) {gravel=regolithStones(point+vec3f(1.71,3.43,2.19),48.0,raster)*near;}
  return broad+gravel*.42;
}
// Each remote world has authored material cues; no resolved mission map is
// implied. Broad geometry remains at both LODs, grains resolve only nearby.
fn remoteWorldSurface(normal:vec3f,point:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let offset=vec3f(b.seed*11.3,4.2,7.1);let broad=stellarNoiseGradient(point*4.1+offset);
  let mid=stellarNoiseGradient(point*14.0+offset);let near=b.near*smoothstep(1.2,3.6,b.raster/48.0);
  var fine=vec4f(0,0,0,.5);if(near>0.0) {fine=stellarNoiseGradient(point*48.0+offset);}
  var low=vec3f(.14,.12,.09);var high=vec3f(.43,.36,.25);var tone=.88+(broad.w-.5)*.24;
  if(abs(b.material-65.0)<.5) {
    low=vec3f(.17,.095,.039);high=vec3f(.67,.50,.30);
    // Depth-dependent dark floors belong to the displaced sponge mesh.
    tone*=mix(.32,1.15,smoothstep(.56,.89,length(point)));
  }
  if(b.material>65.5 && b.material<67.5) {
    low=vec3f(.33,.28,.20);high=vec3f(.66,.60,.47);
    tone+=.12*exp(-point.y*point.y/.012);
  }
  if(abs(b.material-68.0)<.5) {low=vec3f(.027,.028,.029);high=vec3f(.15,.14,.12);tone+=.25*smoothstep(.63,.88,mid.w);}
  if(abs(b.material-69.0)<.5) {low=vec3f(.16,.18,.21);high=vec3f(.42,.44,.47);}
  if(abs(b.material-70.0)<.5) {
    low=vec3f(.19,.050,.025);high=vec3f(.48,.20,.10);
    tone+=.17*exp(-pow((point.x-.045)/.11,2.0));
  }
  if(abs(b.material-71.0)<.5) {low=vec3f(.075,.059,.041);high=vec3f(.28,.24,.19);}
  if(abs(b.material-72.0)<.5) {low=vec3f(.23,.07,.035);high=vec3f(.62,.29,.14);}
  if(abs(b.material-73.0)<.5) {low=vec3f(.18,.13,.087);high=vec3f(.47,.34,.22);}
  var fractures=vec4f(0);let remoteTerrain=b.material>71.5;
  if(remoteTerrain) {
    let footprint=b.raster*sqrt(max(dot(normal,-ray),.025));
    let x=vec4f(broad.xyz*4.1,broad.w);let y=vec4f(mid.xyz*14.0,mid.w);
    fractures=terrainBreaks(normalize(point),b.seed,footprint,.70+.30*b.near,select(.35,1.0,b.material>72.5),x,y,x);
  }
  let slope=(mid.xyz*.052+fine.xyz*.075*near+fractures.xyz)/satelliteAxes(b.material);
  let worldSlope=planetRotateX(stellarRotateY(slope,-satellitePhase(b.material,b.spin)),b.tilt);
  let tangent=worldSlope-normal*dot(worldSlope,normal);let shading=normalize(normal-tangent);
  
  let albedo=mix(low,high,regolithRegion(broad.w,mid.w))*tone*max(.40,1.0+(mid.w-.5)*.22+(fine.w-.5)*.38*near+fractures.w);
  let surface=planetRotateX(stellarRotateY(point*satelliteAxes(b.material),-satellitePhase(b.material,b.spin)),b.tilt);
  return regolithRadiance(albedo,normal,shading,ray,b.light,b.sunVisibility*planetRingShadow(surface,b),.64);
}
fn frontierSurface(normal:vec3f,point:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  if(b.material>73.5) {return smallSatelliteSurface(normal,point,ray,b);}
  if(b.material>64.5) {return remoteWorldSurface(normal,point,ray,b);}
  let position=stellarRotateY(point,b.seed*6.2831853);
  let p=normalize(position);
  let offset=vec3f(b.seed*17.0,3.7,8.4);
  let broad=stellarNoiseGradient(position*3.4+offset);
  let fineWeight=b.near*smoothstep(1.2,3.5,b.raster/38.0);
  var fine=vec4f(0,0,0,.5);
  if(fineWeight>0.0) { fine=stellarNoiseGradient(position*38.0+offset); }
  let icy=b.material<47.5;
  let medium=stellarNoiseGradient(position*12.0+offset+vec3f(3.2,7.1,1.8));
  let dark=b.material>47.5;
  let red=b.material>43.5 && b.material<44.5;
  let youngIce=b.material<44.5;
  let rubble=abs(b.material-50.0)<.5 || abs(b.material-55.0)<.5 || abs(b.material-56.0)<.5;
  let mathilde=abs(b.material-59.0)<.5;
  let lutetia=abs(b.material-57.0)<.5;
  let psyche=abs(b.material-60.0)<.5;
  // Inside a real negative pit the geometric normal points away from the
  // radial shell. Its walls must not inherit projected spherical crater rings.
  let radialNormal=satelliteWorld(point,b);
  let outward=smoothstep(.05,.55,dot(normal,radialNormal));
  var craterSlope=vec3f(0);var craterTone=0.0;
  let newRock=b.material>54.5;
  for(var i=0u;i<96u;i++) {
    if(rubble || (i>=64u && fineWeight<=0.0)) { break; }
    let original=FRONTIER_CRATERS[i];
    let scale=select(select(1.0,1.35,lutetia),1.40,mathilde && i<8u);
    let crater=vec4f(original.xyz,original.w*scale);
    let weight=select(.22,fineWeight,i>=64u)*select(1.0,.32,youngIce);
    let delta=p-crater.xyz;
    let d2=dot(delta,delta);
    if(d2>crater.w*crater.w*1.7) { continue; }
    let d=max(sqrt(d2),.0001);let r=d/crater.w;
    let age=fract(sin(f32(i)*127.1+23.7)*43758.5453);
    let floorRadius=mix(.22,.44,age);
    let wall=clamp((r-floorRadius)/(.88-floorRadius),0.0,1.0);
    let bowl=1.0-smoothstep(floorRadius,.88,r);
    let rimWidth=mix(.10,.19,age);
    let rim=exp(-pow((r-.98)/rimWidth,2.0));
    // Derivative of a broad flat floor, worn wall and low raised rim. Depth
    // scales with radius so small craters do not all become deep punched holes.
    let derivative=.12*6.0*wall*(1.0-wall)/(.88-floorRadius)-.025*2.0*(r-.98)/(rimWidth*rimWidth)*rim;
    let tangent=delta/d-p*dot(p,delta/d);
    craterSlope+=tangent*derivative*weight*outward;
    craterTone+=(rim*.07-bowl*mix(.11,.22,age))*weight*outward;
  }
  if(rubble) {
    let rocks=frontierRubble(position,b.raster*sqrt(max(dot(normal,-ray),.01)),b.near);
    craterSlope=rocks.xyz*outward*.65;craterTone=rocks.w*outward;
  }
  // Long, eroded shoulders are authored for the elongated asteroid, sharing
  // the same surface position through approach rather than a moving overlay.
  let eros=b.material>48.5 && b.material<49.5;
  if(eros) {
    let line=p.y+.12*sin(p.x*4.0)+p.z*.11;
    let ridge=exp(-line*line*75.0)*smoothstep(-.82,.55,p.x);
    let gradient=vec3f(.48*cos(p.x*4.0),1.0,.11);
    craterSlope+=gradient*line*ridge*.32;
    craterTone+=ridge*.21;
  }
  if(b.material>54.5) {
    // Persistent broad fractures and shoulders precede fine regolith in both
    // LODs. They are authored observations to look for, not measured features.
    let line=p.y+.18*sin(p.x*4.2)+p.z*.14;
    let fracture=exp(-line*line*145.0)*smoothstep(-.72,.65,p.x);
    if(abs(b.material-58.0)<.5 || lutetia || abs(b.material-61.0)<.5) {
      craterSlope+=vec3f(.76*cos(p.x*4.2),1,.14)*line*fracture*2.8;
      craterTone-=fracture*.23;
    }
    if(abs(b.material-56.0)<.5) {
      let pond=exp(-pow((p.x-.10)/.38,2.0)-pow((p.y+.5)/.26,2.0));
      craterSlope*=1.0-pond*.85;craterTone=mix(craterTone,.05,pond);
    }
    if(abs(b.material-62.0)<.5) {
      let delta=p-normalize(vec3f(.12,.84,.42));let d=length(delta);
      let bowl=exp(-d*d/.10);let rim=exp(-pow((d-.40)/.045,2.0));
      craterTone+=rim*.26-bowl*.30;craterSlope+=normalize(delta+.0001)*(rim*.35-bowl*.19);
    }
  }
  if(icy) {
    let footprint=b.raster*sqrt(max(dot(normal,-ray),.025));
    let x=vec4f(broad.xyz*3.4,broad.w);let y=vec4f(medium.xyz*12.0,medium.w);
    let fractures=terrainBreaks(p,b.seed,footprint,.70+.30*b.near,select(1.0,.40,red),x,y,x);
    craterSlope+=fractures.xyz*.65;craterTone+=fractures.w*.70;
  }
  craterSlope*=outward;
  craterTone*=outward;
  let ridge=1.0-abs(medium.w*2.0-1.0);
  var slope=craterSlope/max(length(position),.35)+broad.xyz*.055+medium.xyz*select(select(.11,.20,dark),.10,rubble)+fine.xyz*.12*fineWeight*select(select(.55,1.0,dark),.45,rubble);
  var grains=vec4f(0,0,0,.5);
  let grainWeight=select(0.0,b.near*smoothstep(95.0,300.0,select(b.raster,b.raster*sqrt(max(dot(normal,-ray),.01)),rubble)),newRock||rubble);
  if(grainWeight>0.0) {grains=stellarNoiseGradient(position*112.0+offset+vec3f(5.2,8.7,1.3));}
  slope+=grains.xyz*.11*grainWeight;
  // Transform the local height gradient as a covector and project it onto
  // the actual surface. Convex cuts and recessed walls keep their own normals.
  let unseeded=stellarRotateY(slope,-b.seed*6.2831853)/satelliteAxes(b.material);
  let worldSlope=planetRotateX(stellarRotateY(unseeded,-satellitePhase(b.material,b.spin)),b.tilt);
  let tangentSlope=worldSlope-normal*dot(worldSlope,normal);
  let bounded=tangentSlope/max(1.0,length(tangentSlope)/(.30+b.near*.20));
  let shading=normalize(normal-bounded);
  let light=reflectedSurfaceLight(normal,shading,b.light)*b.sunVisibility;
  let facing=max(dot(normal,-ray),0.0);
  var low=vec3f(.055,.061,.071);var high=vec3f(.20,.22,.25);
  if(icy) {low=vec3f(.32,.36,.41);high=vec3f(.65,.71,.77);}
  if(red) {low=vec3f(.18,.069,.034);high=vec3f(.52,.27,.13);}
  if(b.material>48.5 && b.material<49.5) {low=vec3f(.12,.067,.036);high=vec3f(.37,.24,.14);}
  if(abs(b.material-50.0)<.5 || abs(b.material-55.0)<.5) {low=vec3f(.025,.029,.035);high=vec3f(.105,.12,.14);}
  if(abs(b.material-56.0)<.5) {low=vec3f(.11,.082,.052);high=vec3f(.36,.29,.20);}
  if(lutetia) {low=vec3f(.105,.11,.12);high=vec3f(.35,.37,.39);}
  if(abs(b.material-58.0)<.5 || abs(b.material-63.0)<.5) {low=vec3f(.13,.09,.056);high=vec3f(.37,.29,.21);}
  if(mathilde) {low=vec3f(.024,.022,.020);high=vec3f(.095,.087,.078);}
  if(psyche) {low=vec3f(.105,.10,.091);high=vec3f(.33,.31,.26);}
  if(abs(b.material-61.0)<.5) {low=vec3f(.15,.073,.039);high=vec3f(.44,.25,.13);}
  if(abs(b.material-62.0)<.5) {low=vec3f(.22,.20,.16);high=vec3f(.51,.48,.39);}
  let region=regolithRegion(broad.w,medium.w);
  let regional=select(region,.44+(region-.5)*.36,rubble);
  let exposed=smoothstep(.65,.90,ridge)*select(.05,.10,dark);
  let albedo=mix(low,high,regional)*max(.16,1.0+craterTone+(fine.w-.5)*select(.38,.16,rubble)*fineWeight+exposed)*(1.0+(grains.w-.5)*.72*grainWeight);
  let halfDirection=normalize(b.light-ray);
  let frost=pow(max(dot(shading,halfDirection),0.0),26.0)*select(0.0,.08,icy)*fineWeight*light;
  // Psyche's surface is still unknown: restrained rough metallic glints are
  // explicitly an illustrative hypothesis, never polished chrome or a map.
  let glint=select(0.0,pow(max(dot(shading,halfDirection),0.0),12.0)*.10*light*(.45+medium.w),psyche);
  return regolithRadiance(albedo,normal,shading,ray,b.light,b.sunVisibility,select(.76,.49,icy))+vec3f(.70,.80,.91)*frost+vec3f(.48,.44,.36)*glint;
}

fn satellitePoint(normal:vec3f,b:BodyMaterial)->vec3f {
  let local=stellarRotateY(planetRotateX(normal,-b.tilt),satellitePhase(b.material,b.spin));
  return normalize(local*satelliteAxes(b.material));
}
fn satelliteWorld(point:vec3f,b:BodyMaterial)->vec3f {
  let local=normalize(point/satelliteAxes(b.material));
  return planetRotateX(stellarRotateY(local,-satellitePhase(b.material,b.spin)),b.tilt);
}
fn satelliteSurfaceAt(normal:vec3f,position:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  if(b.material>41.5 && !(b.material>44.5 && b.material<47.5)) { return frontierSurface(normal,position,ray,b); }
  // Historical maps use angular coordinates even on an authored concave solid.
  let p=normalize(position);
  let near=b.near;
  let facing=max(dot(normal,-ray),0.0);
  if(b.material>17.5 && b.material<18.5) {
    // Visible-light opaque haze never exposes invented lake geography.
    let flow=stellarRotateY(p,sin(p.y*6.0)*.11+f.forward.w*.0015);
    let tops=solarCloudTops(flow,vec3f(.50,1.5,.50),near,b,normal,ray);
    let latitude=p.y+sin(p.x*3.0+p.z*2.0)*.05;
    let veil=.5+.5*sin(latitude*17.0+tops.broad*.75+f.forward.w*.008);
    let pole=smoothstep(.52,.94,p.y);
    var albedo=mix(vec3f(.53,.28,.08),vec3f(.78,.51,.21),veil*.22+tops.broad*.20);
    albedo=mix(albedo,vec3f(.31,.36,.42),pole*.40);
    albedo+=((tops.fine-.5)*vec3f(.024,.018,.009)+(tops.crest-.5)*vec3f(.009,.008,.006))*near;
    let detail=satelliteWorld(solarCloudNormal(p,flow,tops,.18),b);
    let light=solarCloudLight(normal,detail,b.light)*b.sunVisibility;
    let scatter=light/(light+facing+.18);
    let haze=pow(1.0-facing,2.5)*smoothstep(-.12,.6,dot(normal,b.light));
    return albedo*(.022+light*1.2+scatter*.55)+mix(vec3f(.18,.10,.027),vec3f(.09,.16,.25),smoothstep(.55,.96,p.y))*haze;
  }
  let uv=satelliteUV(p);let layer=satelliteLayer(b.material);
  let size=f32(textureDimensions(satelliteMaps).x);
  // The Viking and Uranian Voyager maps are only 1440px wide; resizing does not
  // create extra measured detail at the highest quality.
  let nativeLevel=select(0.0,max(0.0,log2(size/1440.0)),(b.material>31.5 && b.material<34.5) || (b.material>37.5 && b.material<41.5));
  let level=max(nativeLevel,log2(size/max(b.raster*4.0,1.0)));
  let mapped=textureSampleLevel(satelliteMaps,surfaceSampler,uv,layer,level);
  // Missing observed map coverage is a plain neutral area, never invented
  // geography or a black cut-out interpreted as a physical surface feature.
  let coverage=mapped.a;
  var albedo=mix(vec3f(.24,.245,.25),mapped.rgb,coverage);
  // A dark artistic tint distinguishes Umbriel; unknown coverage stays neutral.
  if(b.material>38.5 && b.material<39.5) { albedo*=mix(1.0,.66,coverage); }
  // Historical grayscale is visualization contrast, not measured reflectance.
  // A bounded charcoal tint keeps the two small rocky worlds from reading as ice.
  if(b.material>31.5 && b.material<33.5) { albedo*=vec3f(.62,.56,.49); }
  var localNormal=p;
  if(near>0.0) {
    // An albedo-derived shading illustration, never a measured height map.
    let luminance=vec3f(.2126,.7152,.0722);
    let reliefLevel=max(level,mix(2.4,.8,near));
    let step=exp2(reliefLevel)/vec2f(textureDimensions(satelliteMaps));
    let eastMap=textureSampleLevel(satelliteMaps,surfaceSampler,uv+vec2f(step.x,0),layer,reliefLevel);
    let westMap=textureSampleLevel(satelliteMaps,surfaceSampler,uv-vec2f(step.x,0),layer,reliefLevel);
    let southMap=textureSampleLevel(satelliteMaps,surfaceSampler,uv+vec2f(0,step.y),layer,reliefLevel);
    let northMap=textureSampleLevel(satelliteMaps,surfaceSampler,uv-vec2f(0,step.y),layer,reliefLevel);
    let valid=coverage*min(min(eastMap.a,westMap.a),min(southMap.a,northMap.a));
    let difference=vec2f(dot(eastMap.rgb-westMap.rgb,luminance),dot(southMap.rgb-northMap.rgb,luminance))*valid;
    let rocky=select(.008,.011,b.material>24.5 && b.material<33.5);
    localNormal=mappedReliefNormal(p,difference,step,near*rocky);
    // Mapped cracks and craters lead the close view; no unrelated tiled grain.

  }
  // Map relief perturbs the geometric normal; facet lighting never chooses UVs.
  let shadingNormal=normalize(normal+satelliteWorld(localNormal,b)-satelliteWorld(p,b));
  let light=reflectedSurfaceLight(normal,shadingNormal,b.light)*b.sunVisibility;
  let ice=select(0.0,1.0,(b.material>15.5 && b.material<24.5) || (b.material>33.5 && b.material<35.5) || (b.material>37.5 && b.material<41.5) || (b.material>44.5 && b.material<47.5));
  let bright=smoothstep(.24,.65,dot(albedo,vec3f(.2126,.7152,.0722)))*coverage;
  let halfVector=b.light-ray;
  let halfDirection=halfVector/max(length(halfVector),.0001);
  let frost=pow(max(dot(shadingNormal,halfDirection),0.0),18.0)*ice*bright*near*light*.065;
  return regolithRadiance(albedo,normal,shadingNormal,ray,b.light,b.sunVisibility,mix(.70,.46,ice))+vec3f(.72,.79,.85)*frost;
}
fn satelliteSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  return satelliteSurfaceAt(normal,satellitePoint(normal,b),ray,b);
}
fn enceladusPlumes(center:vec3f,ray:vec3f)->vec4f {
  let b=observedBodyMaterial();
  let axis=satelliteWorld(vec3f(0,-1,0),b);let side=satelliteWorld(vec3f(1,0,0),b);
  let along=dot(center,ray);let miss=dot(center-ray*along,center-ray*along);
  let surface=along-sqrt(max(0.0,1.0-miss));
  let limit=select(100000.0,surface,along>0.0 && miss<1.0 && surface>0.0);
  var density=0.0;
  // Four finite expanding fans, rooted on the same rotating south polar ice.
  for(var i=0u;i<4u;i++) {
    let offset=(f32(i)-1.5)*.13;
    for(var j=0u;j<3u;j++) {
      let d=.18+f32(j)*.27;
      let root=normalize(vec3f(offset,-1,.10*sin(f32(i)*2.3)));
      let source=center+satelliteWorld(root,b)+axis*d+side*offset*d*.6;
      let width=.026+d*.10;
      let pulse=.84+.16*sin(d*12.0-f.forward.w*1.6+f32(i)*1.7);
      density+=gaussianRayDensity(source,ray,axis,side,vec3f(.19,width,width*.72),limit)*.55*exp(-d*1.5)*pulse;
    }
  }
  let light=.48+max(dot(axis,b.light),0.0)*.52;
  let alpha=(1.0-exp(-density))*smoothstep(.55,3.5,b.pixels);
  return vec4f(vec3f(.63,.86,1.0)*alpha*light*1.4,alpha*.74);
}
`;
