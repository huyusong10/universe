// Authored planetary structure, not mapped terrain or current weather.
// Whole and close views share coordinates, sunlight and the observation clock.
export const SOLAR_MATERIAL_WGSL = /* wgsl */ `
fn bodyRasterRadius() -> f32 {
  return f.presentation.x*min(f.viewport.z/f.viewport.x,f.viewport.w/f.viewport.y);
}
fn bodyEdgeWidth() -> f32 { return min(0.18,1.35/max(bodyRasterRadius(),1.0)); }
fn bodyNearDetail() -> f32 {
  let pixels=f.presentation.x*min(f.viewport.z/f.viewport.x,f.viewport.w/f.viewport.y);
  let proximity=1.0-smoothstep(3.6,6.5,f.eye.w/f.focus.w);
  return proximity*smoothstep(42.0,135.0,pixels);
}
fn volumeNearDetail() -> f32 {
  let pixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  return (1.0-smoothstep(3.0,10.0,f.eye.w/f.focus.w))*smoothstep(30.0,90.0,pixels);
}
fn rockMicroDetail(p:vec3f,b:BodyMaterial)->vec4f {
  let resolved=b.near*(1.0-smoothstep(.5,1.5,73.0/max(b.raster,1.0)));
  var grain=.5;
  if(resolved>0.0) { grain=stellarNoise3(p*73.0+vec3f(8.2,2.4,6.1)); }
  let ripple=vec3f(sin(p.z*63.0+grain*2.0),sin(p.x*71.0),sin(p.y*57.0+grain*3.0));
  return vec4f((ripple-p*dot(ripple,p))*.014*resolved,(grain-.5)*resolved);
}
// The value and its analytic gradient share the same eight lattice corners.
// Cloud-top illumination is an illustration, not measured cloud altitude.
fn solarCloudNoise(p:vec3f)->vec4f {
  let cell=floor(p);let part=fract(p);
  let w=part*part*(vec3f(3.0)-2.0*part);let dw=6.0*part*(vec3f(1.0)-part);
  let a=stellarHash3(cell);let b=stellarHash3(cell+vec3f(1,0,0));
  let c=stellarHash3(cell+vec3f(0,1,0));let d=stellarHash3(cell+vec3f(1,1,0));
  let e=stellarHash3(cell+vec3f(0,0,1));let g=stellarHash3(cell+vec3f(1,0,1));
  let h=stellarHash3(cell+vec3f(0,1,1));let i=stellarHash3(cell+vec3f(1,1,1));
  let ab=mix(a,b,w.x);let cd=mix(c,d,w.x);let eg=mix(e,g,w.x);let hi=mix(h,i,w.x);
  let lower=mix(ab,cd,w.y);let upper=mix(eg,hi,w.y);
  let gradient=vec3f(mix(mix(b-a,d-c,w.y),mix(g-e,i-h,w.y),w.z),mix(cd-ab,hi-eg,w.z),upper-lower)*dw;
  return vec4f(mix(lower,upper,w.z),gradient);
}
struct CloudTops { broad:f32,billow:f32,fine:f32,crest:f32,slope:vec3f };
fn solarCloudTops(p:vec3f,stretch:vec3f,near:f32,b:BodyMaterial,normal:vec3f,ray:vec3f)->CloudTops {
  let footprint=max(1.0,b.raster*sqrt(max(dot(normal,-ray),.015)));
  let scale=max(stretch.y,max(stretch.x,stretch.z));
  let q=p*stretch;let offset=vec3f(b.seed*7.1,3.7,9.3);
  let low=solarCloudNoise(q*4.0+offset);
  let turn=solarCloudNoise(q*7.0+offset+vec3f(5.4,11.7,2.3));
  let first=vec3f(.17,.0221,.119);let second=vec3f(-.12,.035,.15);
  let warp=q+first*(low.x-.5)+second*(turn.x-.5);
  let middle=solarCloudNoise(warp*18.0+offset);
  let middlePresence=exp(-pow(18.0*scale/footprint,2.0));
  let bankPresence=near*exp(-pow(42.0*scale/footprint,2.0));
  var bank=middle.x;
  if(bankPresence>.001) {
    let fringe=warp*vec3f(42.0,56.0,42.0)+offset+vec3f(turn.x*.7,middle.x*1.6,low.x*.8);
    let cloud=textureSampleLevel(nebulaNoise,surfaceSampler,(fringe+.5)/128.0,0.0).r;
    bank=mix(bank,cloud,.36*bankPresence);
  }
  let edge=clamp((bank-.08)/.84,0.0,1.0);
  let billow=mix(.5,edge*edge*(3.0-2.0*edge),middlePresence);
  var gradient=middle.yzw*(18.0*6.0*edge*(1.0-edge)/.84)*(1.0-.36*bankPresence)*middlePresence;
  let resolved=near*exp(-pow(92.0*scale/footprint,2.0));
  var fine=.5;
  if(resolved>.001) {
    let strand=warp*vec3f(78.0,92.0,78.0)+offset+vec3f(middle.x*1.4,turn.x*.6,low.x*1.2);
    let cloud=textureSampleLevel(nebulaNoise,surfaceSampler,(strand+.5)/128.0,0.0).r;
    let ribbon=sin(warp.y*95.0+middle.x*12.0+cloud*3.0+low.x*4.0);
    fine+=((cloud-.5)*.78+ribbon*.12)*resolved*(.55+.45*billow);
  }
  let local=near*b.inspection*exp(-pow(168.0*scale/footprint,2.0));
  if(local>.001) {
    let strand=warp*vec3f(143.0,168.0,143.0)+vec3f(fine*.8,turn.x*.5,middle.x*.9)+offset;
    let cloud=textureSampleLevel(nebulaNoise,surfaceSampler,(strand+vec3f(3.2,8.6,4.8))/128.0,0.0).r;
    fine+=(cloud-.5)*.32*local*(.35+.65*billow);
  }
  gradient+=low.yzw*4.0*dot(first,gradient)+turn.yzw*7.0*dot(second,gradient);
  gradient*=stretch;
  let crest=smoothstep(.36,.74,billow)*smoothstep(.30,.69,fine);
  let slope=gradient*mix(.00065,.00135,near);
  return CloudTops(low.x,billow,clamp(fine,0.0,1.0),crest,slope/max(1.0,length(slope)/.065));
}
fn solarCloudNormal(p:vec3f,flow:vec3f,tops:CloudTops,strength:f32)->vec3f {
  let source=tops.slope-flow*dot(tops.slope,flow);
  let axis=cross(flow,p);
  // Material flow never replaces the spherical normal. Transport only its
  // small cloud-bank slope back to the original, unwarped sphere.
  let tangent=source+cross(axis,source)+cross(axis,cross(axis,source))/max(.1,1.0+dot(flow,p));
  return normalize(p-tangent*strength);
}
fn solarCloudLight(normal:vec3f,detail:vec3f,sunlight:vec3f)->f32 {
  // Scattering softens small cloud-bank shadows at the geometric horizon.
  // The unperturbed sphere still determines which hemisphere is lit.
  let bank=smoothstep(.04,.28,dot(normal,sunlight));
  return reflectedSurfaceLight(normal,normalize(mix(normal,detail,bank)),sunlight);
}
fn solarCloudVortex(p:vec3f,center:vec2f,size:vec2f,turn:f32)->vec3f {
  // A local spherical flow, tapered before the longitude seam or poles.
  let longitude=atan2(p.z,p.x);
  let delta=vec2f(atan2(sin(longitude-center.x),cos(longitude-center.x)),p.y-center.y);
  let local=delta/size;
  let r=length(local);
  let angle=turn*exp(-r*r*0.75)*(1.0-smoothstep(1.8,2.6,r));
  let c=cos(angle);let s=sin(angle);
  let rotated=vec2f(c*local.x-s*local.y,s*local.x+c*local.y)*size;
  let latitude=clamp(p.y+rotated.y-delta.y,-0.9999,0.9999);
  let lon=longitude+rotated.x-delta.x;
  let ring=sqrt(max(0.0,1.0-latitude*latitude));
  return vec3f(cos(lon)*ring,latitude,sin(lon)*ring);
}
fn mercurySurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.002,0.998));
  let near=b.near;
  let level=max(0.0,log2(f32(textureDimensions(mercuryMap).x)/max(b.raster*4.0,1.0)));
  let albedo=textureSampleLevel(mercuryMap,surfaceSampler,uv,level).rgb;
  var terrain=normal;
  if(near>0.0) {
    // Albedo-derived shading relief is artistic, not a height measurement.
    let weights=vec3f(.2126,.7152,.0722);
    let relief=normalize(mappedTerrainNormal(mercuryMap,p,uv,level,weights,vec2f(.007,.008)*near,near)+rockMicroDetail(p,b).xyz*.28);
    terrain=planetRotateX(stellarRotateY(relief,-b.spin),b.tilt);
  }
  return regolithRadiance(albedo,normal,terrain,ray,b.light,1.0,.78);
}
fn venusSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),-b.spin);
  let near=b.near;
  let drift=f.forward.w*0.004;
  let shear=stellarRotateY(p,drift+sin(p.y*5.0)*0.42);
  var flow=solarCloudVortex(shear,vec2f(-0.9,0.38),vec2f(0.64,0.24),2.8);
  flow=solarCloudVortex(flow,vec2f(1.42,-.34),vec2f(.73,.27),-2.1);
  let tops=solarCloudTops(flow,vec3f(.8,1.8,.8),near,b,normal,ray);
  let wave=.5+.5*sin(flow.y*17.0+tops.broad*5.5);
  let depth=smoothstep(.25,.80,tops.broad*.39+tops.billow*.34+wave*.27);
  let polar=smoothstep(.62,.95,abs(p.y));
  let albedo=mix(vec3f(.43,.31,.17),vec3f(.83,.75,.54),depth)+vec3f(.18,.16,.11)*(tops.fine-.5)*near+vec3f(.035,.032,.023)*polar;
  let detail=planetRotateX(stellarRotateY(solarCloudNormal(p,flow,tops,.55),b.spin),b.tilt);
  let light=solarCloudLight(normal,detail,b.light);
  let facing=max(dot(normal,-ray),0.0);
  return albedo*(0.020+light*1.55)+vec3f(0.25,0.18,0.08)*pow(1.0-facing,4.0)*light*0.20;
}
fn iceGiantSurface(normal:vec3f,ray:vec3f,neptune:bool,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let near=b.near;
  let longitude=atan2(p.z,p.x);
  let shear=stellarRotateY(p,sin(p.y*9.0)*0.16+sin(f.forward.w*0.04)*0.025);
  let flow=solarCloudVortex(shear,select(vec2f(-0.7,0.35),vec2f(0.48,-0.28),neptune),select(vec2f(0.45,0.15),vec2f(0.40,0.16),neptune),select(1.1,3.8,neptune));
  let tops=solarCloudTops(flow,vec3f(.75,2.6,.75),near,b,normal,ray);
  let latitude=flow.y+(tops.broad-.5)*.055;
  let belts=0.5+0.5*sin(latitude*30.0+sin(latitude*9.0)*1.3);
  var albedo=mix(vec3f(.25,.49,.52),vec3f(.40,.64,.65),belts*.18+tops.broad*.30);
  let pole=smoothstep(.60,.87,p.y+(tops.broad-.5)*.045);
  let feather=smoothstep(.48,.79,tops.fine)*near;
  albedo=mix(albedo,vec3f(.52,.70,.69),pole*.47)+vec3f(.042,.052,.054)*feather;
  if(!neptune) {
    let dx=atan2(sin(longitude+.70),cos(longitude+.70));
    let cloud=exp(-pow(dx/.52,2.0)-pow((flow.y-.38)/.055,2.0));
    albedo+=vec3f(.11,.14,.14)*cloud*(.35+.65*tops.crest);
    albedo+=vec3f(.025,.034,.035)*(tops.billow-.5)*near;
  }
  if(neptune) {
    let dx=atan2(sin(longitude-0.48),cos(longitude-0.48));
    let stormRadius=length(vec2f(dx/.34,(p.y+.28)/.13));
    let storm=1.0-smoothstep(.42,1.24,stormRadius+(tops.billow-.5)*.24);
    let stream=smoothstep(.32,.78,tops.billow*.42+tops.fine*.58)*exp(-pow((flow.y-.25)/.14,2.0));
    let wake=exp(-pow((dx-.48)/.73,2.0));
    let curl=flow.y+.11+.035*sin(dx*5.0+tops.broad*3.0);
    let upper=exp(-pow(curl/.037,2.0))*smoothstep(.30,.74,tops.fine)*wake;
    let collar=exp(-pow((stormRadius-1.05)/.24,2.0))*smoothstep(-.05,.40,p.y+.28);
    albedo=mix(vec3f(.035,.11,.27),vec3f(.085,.27,.49),belts*.28+tops.broad*.47+tops.billow*near*.12);
    albedo*=1.0-storm*0.48;
    albedo+=vec3f(.30,.40,.49)*(upper*.42+stream*mix(.13,.31,near)+collar*tops.crest*.17);
    albedo+=vec3f(.04,.065,.09)*(tops.fine-.5)*near;
  }
  let detail=planetRotateX(stellarRotateY(solarCloudNormal(p,flow,tops,select(.20,.60,neptune)),-b.spin),b.tilt);
  let light=solarCloudLight(normal,detail,b.light);
  let facing=max(dot(normal,-ray),0.0);
  let haze=pow(1.0-facing,3.8)*smoothstep(-0.10,0.60,dot(normal,b.light));
  return albedo*(0.018+light*1.65)+select(vec3f(0.10,0.24,0.26),vec3f(0.035,0.14,0.34),neptune)*haze*0.34;
}
fn solarSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  if(b.material<11.5) { return mercurySurface(normal,ray,b); }
  if(b.material<12.5) { return venusSurface(normal,ray,b); }
  return iceGiantSurface(normal,ray,b.material>13.5,b);
}
`;
