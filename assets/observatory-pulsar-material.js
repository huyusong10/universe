// A slow magnetic lighthouse and outward wind, inspired by observed Crab
// wisps. Thermal structure, colours and timing are artistic, not measured.
// The existing observation clock owns every moving feature.
const strandSamples = Array.from({ length: 12 }, (_, i) => {
  const theta = 0.68 + (i + 0.5) * (Math.PI - 1.36) / 12;
  const radius = 2.6 * Math.sin(theta) ** 2, derivative = 2.6 * Math.sin(theta * 2);
  const axial = derivative * Math.cos(theta) - radius * Math.sin(theta);
  const radial = derivative * Math.sin(theta) + radius * Math.cos(theta);
  const length = Math.hypot(axial, radial);
  return {
    shape: [radius * Math.cos(theta), radius * Math.sin(theta), axial / length, radial / length],
    profile: [length * (Math.PI - 1.36) / 12 * 0.62, 0.035 + Math.sin(theta) * 0.018, 0.75 + Math.abs(Math.cos(theta)) * 0.5, 0],
    wave: [Math.sin(theta * 8), Math.cos(theta * 8)]
  };
});
const windSamples = Array.from({ length: 12 }, (_, i) => {
  const angle = (i + 0.5) * Math.PI * 2 / 12 + Math.sin(i * 2.37) * 0.07;
  return { direction: [Math.cos(angle), Math.sin(angle), Math.sin(angle * 2), Math.cos(angle * 2)],
    wave: [Math.sin(angle * 3), Math.cos(angle * 3), Math.sin(angle * 5), Math.cos(angle * 5)] };
});
const table = (samples, key, type) => samples.map(sample => `${type}(${sample[key].map(value => value.toFixed(8)).join(',')})`).join(',');
export const PULSAR_MATERIAL_WGSL = /* wgsl */ `
// Fixed dipole geometry is baked once, rather than recomputed for every ray.
const PULSAR_FIELD_SHAPE = array<vec4f,12>(${table(strandSamples, 'shape', 'vec4f')});
const PULSAR_FIELD_PROFILE = array<vec4f,12>(${table(strandSamples, 'profile', 'vec4f')});
const PULSAR_FIELD_WAVE = array<vec2f,12>(${table(strandSamples, 'wave', 'vec2f')});
const PULSAR_WIND_DIRECTION = array<vec4f,12>(${table(windSamples, 'direction', 'vec4f')});
const PULSAR_WIND_WAVE = array<vec4f,12>(${table(windSamples, 'wave', 'vec4f')});
fn pulsarTilt(p: vec3f) -> vec3f {
  let c=cos(f.light.w); let s=sin(f.light.w);
  return vec3f(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
}
fn isVela() -> bool { return f.style.w>28.5 && f.style.w<29.5; }
fn isB1509() -> bool { return abs(f.style.x-50127.0)<.5; }
fn isGeminga() -> bool { return abs(f.style.x-50128.0)<.5; }
fn pulsarSpinJet() -> bool { return isVela() || isB1509() || isGeminga(); }
fn pulsarObliquity() -> f32 {
  if(isB1509()) {return .86;} if(isGeminga()) {return 1.02;}
  return select(.68,.38,isVela());
}
fn pulsarPhase() -> f32 {
  if(isB1509()) {return f.forward.w*.28;}
  if(isGeminga()) {return f.forward.w*.22;}
  return f.forward.w*select(.48,.34,isVela());
}
fn pulsarMagneticAxis() -> vec3f {
  let phase=pulsarPhase(); let oblique=pulsarObliquity();
  return pulsarTilt(vec3f(sin(oblique)*cos(phase),cos(oblique),sin(oblique)*sin(phase)));
}
fn pulsarRotatingDirection(normal: vec3f) -> vec3f {
  let phase=pulsarPhase();
  let east=pulsarTilt(vec3f(cos(phase),0,sin(phase)));
  let north=pulsarTilt(vec3f(0,1,0));
  return vec3f(dot(normal,east),dot(normal,north),dot(normal,cross(east,north)));
}
fn pulsarHotColor() -> vec3f {
  if(isB1509()) {return vec3f(1.06,1.85,1.66);}
  if(isGeminga()) {return vec3f(2.0,1.58,.91);}
  return vec3f(1.12,1.62,2.10);
}
fn pulsarCoreFragment(center: vec3f, ray: vec3f) -> vec4f {
  let along=dot(center,ray);
  let closest=center-ray*along;
  let impact2=dot(closest,closest);
  let edge=compactCoreCoverage(sqrt(impact2));
  if (along<0.0 || edge<=0.0) { discard; }
  let normal=normalize(ray*(along-sqrt(max(0.0,1.0-impact2)))-center);
  let p=pulsarRotatingDirection(normal);
  // The enlarged surface is an emissive temperature illustration, not a
  // rocky albedo map. Its hot caps share the beam's rotating magnetic axis.
  let oblique=pulsarObliquity();
  let magnetic=vec3f(dot(p,vec3f(cos(oblique),-sin(oblique),0)),
    dot(p,vec3f(sin(oblique),cos(oblique),0)),p.z);
  let polarDistance=1.0-abs(magnetic.y);
  // A continuous temperature field avoids cloud-shaped albedo patches on
  // the unresolved crust. Only restrained temperature variation resolves
  // near the poles; the opaque geometry and beam root remain the same.
  let near=bodyNearDetail();
  let offset=vec3f(f.star.w*11.0,3.7,8.1);
  let broad=stellarNoise3(magnetic*3.2+offset);
  let cap=exp(-polarDistance*select(29.0,42.0,isVela())*(.94+broad*.12));
  let warmRegion=exp(-polarDistance*select(4.2,6.0,isVela()));
  let thermal=magnetic*vec3f(9.0,2.2,9.0)+vec3f((broad-.5)*1.2,-f.forward.w*.09,(broad-.5)*.8);
  let stream=stellarNoise3(thermal+offset);
  let facing=max(dot(normal,-ray),0.0);
  let surfacePixels=bodyRasterRadius()*sqrt(facing);
  let resolved=near*smoothstep(45.0,115.0,surfacePixels);
  var fineHeat=0.0;
  if(resolved>0.0) {
    // Fine heat is a small signed perturbation of the same emissive field,
    // never a separate white texture. Filter it by actual projected detail.
    let fine=stellarNoise3(magnetic*vec3f(48.0,8.0,48.0)+offset+vec3f((stream-.5)*2.4));
    let filtered=exp(-pow(42.0/max(surfacePixels,1.0),2.0));
    fineHeat=(fine-.5)*resolved*filtered*warmRegion*.012;
  }
  let limb=.16+.84*pow(facing,.38);
  var cold=select(vec3f(.006,.018,.045),vec3f(.012,.010,.041),isVela());
  var warm=select(vec3f(.045,.32,.64),vec3f(.12,.19,.45),isVela());
  let hot=pulsarHotColor();
  if(isB1509()) {cold=vec3f(.006,.024,.034);warm=vec3f(.05,.31,.34);}
  if(isGeminga()) {cold=vec3f(.030,.018,.020);warm=vec3f(.42,.25,.12);}
  let heat=clamp(.065+(broad-.5)*.018+warmRegion*(.48+stream*.06)+fineHeat,0.0,1.0);
  let envelope=mix(cold,warm,heat);
  let polarLight=hot*cap*(.9+stream*.1);
  let radiance=(envelope+polarLight)*limb;
  let alpha=edge*smoothstep(0.55,3.5,f.presentation.x);
  return vec4f(radiance*alpha,alpha);
}
// Three faint dipole-shaped strands connect the same moving magnetic caps.
// This is a spatial illustration of the field, not a reconstruction of it.
// Curves reuse clipped Gaussian integration and the existing volume budget.
// These dim, narrow strands have finite visible support. Reject their
// negligible tails before the clipped integral. Broad wind and beam envelopes
// have a wider finite support; their visible core and occlusion are unchanged.
fn pulsarClippedInterval(center: vec3f, ray: vec3f, axis: vec3f, side: vec3f, sigma: vec3f, limit: f32, support: f32, start: f32) -> f32 {
  let up=cross(axis,side);
  let source=vec3f(dot(center,axis),dot(center,side),dot(center,up))/sigma;
  let direction=vec3f(dot(ray,axis),dot(ray,side),dot(ray,up))/sigma;
  let magnitude=dot(direction,direction);
  let along=dot(source,direction)/magnitude;
  let closest=source-direction*along;
  let separation=dot(closest,closest);
  if (separation>support) { return 0.0; }
  let inverseWidth=sqrt(magnitude);
  let clip=smoothstep(-1.8,1.8,(limit-along)*inverseWidth)-smoothstep(-1.8,1.8,(start-along)*inverseWidth);
  return exp(-separation*0.5)*2.5066/inverseWidth*max(0.0,clip);
}
fn pulsarClippedDensity(center: vec3f, ray: vec3f, axis: vec3f, side: vec3f, sigma: vec3f, limit: f32, support: f32) -> f32 {
  return pulsarClippedInterval(center,ray,axis,side,sigma,limit,support,0.0);
}
fn pulsarMagneticLight(center: vec3f, ray: vec3f, axis: vec3f, limit: f32) -> f32 {
  let impact=length(center-ray*dot(center,ray));
  let presence=smoothstep(7.0,22.0,f.presentation.x);
  if (impact>2.75 || presence<=0.0) { return 0.0; }
  let phase=pulsarPhase(); let oblique=pulsarObliquity();
  let east=pulsarTilt(vec3f(cos(oblique)*cos(phase),-sin(oblique),cos(oblique)*sin(phase)));
  let across=cross(axis,east);
  var light=0.0;
  let rasterRadius=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let nearDetail=smoothstep(85.0,140.0,rasterRadius);
  for (var curve=0u;curve<3u;curve++) {
    let curvePresence=select(1.0,nearDetail,curve==2u);
    if (curvePresence<=0.0) { continue; }
    let azimuth=f32(curve)*2.094395;
    let radial=east*cos(azimuth)+across*sin(azimuth);
    let flowPhase=azimuth-f.forward.w*1.1;
    let flowWave=vec2f(cos(flowPhase),sin(flowPhase));
    for (var segment=0u;segment<12u;segment++) {
      let shape=PULSAR_FIELD_SHAPE[segment];
      let profile=PULSAR_FIELD_PROFILE[segment];
      let tangent=axis*shape.z+radial*shape.w;
      let normal=-axis*shape.w+radial*shape.z;
      let scale=select(1.0,.71,curve==2u);
      let node=center+(axis*shape.x+radial*shape.y)*scale;
      let flow=0.55+0.45*dot(PULSAR_FIELD_WAVE[segment],flowWave);
      let width=profile.y*mix(1.0,.58,nearDetail);
      light+=pulsarClippedDensity(node,ray,tangent,normal,vec3f(profile.x*scale,width,width),limit,20.0)*
        (0.065+flow*0.07)*mix(1.0,1.45,nearDetail)*profile.z*curvePresence;
    }
  }
  return light*presence;
}
fn pulsarVolumeFragment(center: vec3f, ray: vec3f, clipCore:bool) -> vec4f {
  let along=dot(center,ray);
  let closest=center-ray*along;
  let impact2=dot(closest,closest);
  if (along<0.0 || impact2>484.0) { return vec4f(0); }
  let hit=along-sqrt(max(0.0,1.0-impact2));
  let limit=select(100000.0,hit,clipCore && hit>0.0);
  let axis=pulsarMagneticAxis();
  // Vela's wind jet follows the spin axis, rather than sweeping with the
  // magnetic beam. Its slow flexing is an illustration of observed changes.
  let jetAxis=select(axis,pulsarTilt(vec3f(0,1,0)),pulsarSpinJet());
  let reference=select(vec3f(0,1,0),vec3f(1,0,0),abs(jetAxis.y)>0.92);
  let side=normalize(cross(jetAxis,reference));
  let magneticReference=select(vec3f(0,1,0),vec3f(1,0,0),abs(axis.y)>0.92);
  let magneticSide=normalize(cross(axis,magneticReference));
  let count=select(u32(clamp(f.quality.x*0.25,3.0,8.0)),12u,pulsarSpinJet());
  var beams=0.0;
  var magneticBeams=0.0;
  var jetSpine=0.0;
  for (var i=0u;i<count;i++) {
    // Split the existing twelve sites between the steady wind jet and the
    // rotating magnetic sweep. Both roots keep their respective authored axes.
    // Crab already uses its magnetic axis and retains its quality budget.
    let sweeping=pulsarSpinJet() && (i%2u==1u);
    let sites=select(f32(count),6.0,pulsarSpinJet());
    let index=select(f32(i),floor(f32(i)*.5),pulsarSpinJet());
    let beamAxis=select(jetAxis,axis,sweeping);
    let beamSide=select(side,magneticSide,sweeping);
    let d=1.3+(index+0.5)*16.0/sites;
    let flow=0.5+0.5*sin(d*1.15-f.forward.w*1.8);
    let width=0.10+d*select(0.047+flow*0.012,.085,sweeping);
    let density=(0.13+flow*0.13)*exp(-d*0.07)*(1.0-smoothstep(13.0,18.0,d));
    let sigma=vec3f(16.0/sites*0.66,width,width*1.35);
    var bend=beamSide*sin(d*0.58-f.forward.w*0.65)*(0.025+d*0.012);
    if (pulsarSpinJet() && !sweeping) {
      let across=cross(beamAxis,beamSide);
      bend=(beamSide*sin(d*0.42-f.forward.w*0.31)+across*cos(d*0.36-f.forward.w*0.27))*d*d*0.0055;
    }
    let positive=center+beamAxis*d+bend;
    let negative=center-beamAxis*d-bend;
    let counter=select(1.0,0.35,(isVela() || isB1509()) && !sweeping);
    let opening=bodyNearDetail()*.8;
    let column=(pulsarClippedInterval(positive,ray,beamAxis,beamSide,sigma,limit,28.0,opening)+
      pulsarClippedInterval(negative,ray,beamAxis,beamSide,sigma,limit,28.0,opening)*counter)*density*0.7;
    if(sweeping || !pulsarSpinJet()) {magneticBeams+=column;} else {beams+=column;}
    if(!sweeping) {
      let spineSigma=vec3f(sigma.x,width*0.23,width*0.28);
      jetSpine+=(pulsarClippedDensity(positive,ray,beamAxis,beamSide,spineSigma,limit,28.0)+
        pulsarClippedDensity(negative,ray,beamAxis,beamSide,spineSigma,limit,28.0)*counter)*density*1.6;
    }
  }
  // Broad connected envelopes need the same finite angular budget at every
  // quality. Fine wind texture supplies close structure independently.
  let ringCount=12u;
  let windEast=pulsarTilt(vec3f(1,0,0));
  let windUp=pulsarTilt(vec3f(0,1,0));
  let windSouth=pulsarTilt(vec3f(0,0,1));
  let knotWave=vec2f(cos(f.forward.w*0.41),sin(f.forward.w*0.41));
  var wind=0.0;
  var windHeat=0.0;
  let rasterRadius=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let drift=vec3f(0.0,-f.forward.w*.065,0.0);
  for (var ring=0u;ring<2u;ring++) {
    let phase=fract(f.forward.w*0.075+f32(ring)*0.5);
    var radius=select(2.5+phase*8.5,3.6+f32(ring)*2.7+sin(f.forward.w*.18)*.14,isVela());
    if(isB1509()) {radius=3.2+f32(ring)*2.5;}
    let strength=select(pow(sin(phase*3.14159265),2.0)*0.14,0.17,pulsarSpinJet());
    let arcPhase=select(f32(ring)*1.9+f.forward.w*0.23,0.45+f32(ring)*.25,isVela());
    let arcWave=vec2f(cos(arcPhase),sin(arcPhase));
    let spreadWave=vec2f(cos(f32(ring)*2.7),sin(f32(ring)*2.7));
    let heightWave=vec2f(cos(phase*2.0),sin(phase*2.0));
    for (var i=0u;i<ringCount;i++) {
      let shape=PULSAR_WIND_DIRECTION[i];let wave=PULSAR_WIND_WAVE[i];
      let arcPresence=0.5+0.5*dot(wave.xy,arcWave);
      let knot=pow(0.5+0.5*(wave.z*knotWave.x-wave.w*knotWave.y),4.0);
      let spread=radius*(1.0+dot(shape.zw,spreadWave)*0.09);
      let radial=windEast*shape.x+windSouth*shape.y;
      let tangent=-windEast*shape.y+windSouth*shape.x;
      let height=windUp*select(dot(wave.xy,heightWave)*0.16*phase,0.8+f32(ring)*1.2,isVela());
      let sigma=vec3f(spread*6.2831853/f32(ringCount)*(0.34+arcPresence*0.17),
        0.10+phase*0.20+knot*0.08,0.09+phase*0.15);
      var node=center+radial*spread+height;
      var trailSigma=sigma;
      var trailTangent=tangent;var trailSide=radial;
      var profileWeight=1.0;
      if(isB1509()) {node=center+radial*spread*.72+height;profileWeight=.60;}
      if(isGeminga()) {
        // Two trailing structures replace the ring samples, retaining the
        // same 24-site budget. Their compressed shape is an illustration.
        let d=1.7+(f32(i)+.5)*14.0/f32(ringCount);
        let sign=select(-1.0,1.0,ring==1u);
        node=center-windUp*d+windEast*sign*(1.5+d*.24)+windSouth*(sin(d*.23-f.forward.w*.14)*d*.07);
        trailTangent=normalize(-windUp+windEast*sign*.24);trailSide=normalize(cross(trailTangent,windSouth));
        trailSigma=vec3f(.90,.14+d*.025,.12+d*.035);
        profileWeight=.68*(1.0-smoothstep(12.0,17.0,d));
      }
      // Leave a soft foreground opening when the observer crosses a wisp.
      // Otherwise a tangent Gaussian touching the eye lights the whole sky.
      // The finite integral still ends at the opaque core; only transparent
      // wind adjacent to the camera fades, without changing geometry/picking.
      var amount=pulsarClippedInterval(node,ray,trailTangent,trailSide,
        trailSigma,limit,28.0,2.0)*strength*profileWeight*(0.18+arcPresence*0.72+knot*1.1)*
        select(1.0,smoothstep(-.45,.45,shape.y),isVela());
      if(amount<.00005) {continue;}
      // Sample each contributing interval in its own position. Combining
      // foreground and background sites first invents a midpoint that slides
      // through unrelated texture as the eye moves. The anisotropic closest
      // point and the same core/near-eye bounds keep the field attached.
      let trailUp=cross(trailTangent,trailSide);
      let source=vec3f(dot(node,trailTangent),dot(node,trailSide),dot(node,trailUp))/trailSigma;
      let direction=vec3f(dot(ray,trailTangent),dot(ray,trailSide),dot(ray,trailUp))/trailSigma;
      let distance=clamp(dot(source,direction)/dot(direction,direction),2.0,max(2.0,limit));
      let position=ray*distance-center;
      let q=vec3f(dot(position,windEast),dot(position,windUp),dot(position,windSouth));
      let footprint=2.0*max(1.0,length(q))/max(rasterRadius,1.0);
      let broad=nebulaNoise3(q*.66+drift+vec3f(7.1,f.star.w*17.0,3.8));
      let detail=smoothstep(8.0,26.0,rasterRadius)*exp(-footprint*footprint*23.04);
      var fine=.5;
      if(detail>.001) {
        fine=nebulaNoise3(q*4.8+drift*2.0+vec3f(19.7,7.1,3.3)+vec3f(broad*.55));
      }
      let cloud=clamp(broad+(fine-.5)*detail*.48,0.0,1.0);
      amount*=.16+smoothstep(.23,.81,cloud)*1.35;
      wind+=amount;
      windHeat+=amount*knot;
    }
  }
  let magneticLight=pulsarMagneticLight(center,ray,axis,limit);
  var crown=0.0;
  if (impact2>0.81 && impact2<1.44) {
    let magneticRim=pow(abs(dot(normalize(-closest),axis)),6.0);
    crown=smoothstep(0.81,0.90,impact2)*exp(-pow((sqrt(impact2)-1.02)/0.08,2.0))*magneticRim*0.16*
      smoothstep(7.0,20.0,f.presentation.x);
  }
  let density=beams+magneticBeams+jetSpine+wind+magneticLight+crown;
  if (density<0.0002) { return vec4f(0); }
  // Luminous tenuous plasma has much less extinction than emission. Using
  // the emission column as alpha darkened the opaque core behind a wisp.
  // A bounded response retains foreground light without a screen-space hole.
  let presence=smoothstep(0.55,3.5,f.presentation.x);
  let alpha=(1.0-exp(-(beams*.20+magneticBeams*.16+jetSpine*.08+wind*.10+magneticLight*.05+crown*.08)))*presence;
  let response=(1.0-exp(-density*.75))/max(density*.75,.0001);
  let radiance=vec3f(0.20,0.43,0.78)*beams+pulsarHotColor()*.32*magneticBeams+vec3f(0.85,1.40,2.10)*jetSpine+
    vec3f(0.12,0.29,0.58)*(wind-windHeat)+vec3f(.48,.95,1.30)*windHeat+vec3f(.30,.75,1.35)*magneticLight+vec3f(1.2,2.8,4.0)*crown;
  return vec4f(radiance*response*presence,alpha);
}
`;
