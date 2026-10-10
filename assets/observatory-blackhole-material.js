// Bounded light-path illustration, not a relativistic solver or an observed
// image. Only the dark shadow occludes; disk activity uses the observation clock.
export const BLACKHOLE_MATERIAL_WGSL = /* wgsl */ `
fn blackHoleIsOutburst() -> bool { return abs(f.style.x-50130.0)<.5; }
fn blackHoleIsCygnus() -> bool { return abs(f.style.x-50129.0)<.5; }
fn blackHoleHasJet() -> bool { return (f.style.w>29.5 && f.style.w<30.5) || blackHoleIsOutburst(); }
fn blackHoleNearDetail() -> f32 {
  // Navigation stops outside the extended disk at 8.5 shadow radii; a solid
  // surface's 3.6–6.5 radius transition can never activate at this endpoint.
  let proximity=1.0-smoothstep(8.5,18.0,f.eye.w/f.focus.w);
  let pixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  return proximity*smoothstep(24.0,72.0,pixels);
}
fn blackHoleLocal(p: vec3f) -> vec3f {
  let c=cos(f.light.w); let s=sin(f.light.w);
  return vec3f(p.x,c*p.y+s*p.z,-s*p.y+c*p.z);
}
fn blackHoleShadowFragment(center: vec3f, ray: vec3f) -> vec4f {
  let along=dot(center,ray);
  let impact=length(center-ray*along);
  let edge=compactCoreCoverage(impact);
  if (along<0.0 || edge<=0.0) { discard; }
  return vec4f(0,0,0,edge*smoothstep(0.55,3.5,f.presentation.x));
}
fn blackHoleFlowResolution(footprint: vec2f) -> vec2f {
  let pixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let angularPixels=max(1.0,pixels*footprint.x);
  let radialPixels=max(1.0,pixels*footprint.y);
  let near=blackHoleNearDetail();
  // A bent image compresses radius much more than azimuth. Do not erase
  // resolvable knots around the arc just because radial threads are too thin.
  return near*vec2f(exp(-pow(28.0/angularPixels,2.0)-pow(6.0/radialPixels,2.0)),
    exp(-pow(28.0/angularPixels,2.0)-pow(52.0/radialPixels,2.0)));
}
fn blackHoleDirectFootprint(p: vec3f, view: vec3f, ray: vec3f, sampleWidth: f32) -> vec2f {
  let r=max(length(p.xz),1.0);
  let radial=vec3f(p.x,0,p.z)/r;let tangent=vec3f(-p.z,0,p.x)/r;
  let projected=vec2f(dot(tangent,view),dot(radial,view));
  var footprint=r*sqrt(max(vec2f(0.0),vec2f(1.0)-projected*projected));
  if(sampleWidth>0.0) {
    // A grazing segment averages a finite length of the stream. Its sampling
    // interval can be coarser than a display pixel, so both limits matter.
    let pixels=max(1.0,f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y));
    let change=abs(vec2f(p.x*ray.z-p.z*ray.x,dot(p.xz,ray.xz)))*sampleWidth/(r*r);
    footprint=min(footprint,vec2f(1.0)/max(change*pixels,vec2f(.000001)));
  }
  return footprint;
}
fn blackHoleDisk(p: vec3f, view: vec3f, footprint: vec2f) -> vec4f {
  let r=length(p.xz);
  let inner=smoothstep(1.045,1.16,r)*(1.0-smoothstep(1.34,1.58,r));
  let outer=smoothstep(1.32,1.55,r)*(1.0-smoothstep(3.25,3.8,r));
  if (max(inner,outer)<0.0001) { return vec4f(0); }
  let jet=blackHoleHasJet();
  // A bounded periodic flow keeps broad luminous packets legible; closer
  // filaments unfold within those packets, rather than filling every radius
  // with equally thin scratches. The three disk images share this field.
  let angle=atan2(p.z,p.x);
  // Differential rotation is bounded in time: no ever-growing winding
  // or unresolved scratch density after a long observation.
  let speed=select(.28,.19,jet);
  let shear=sin(f.forward.w*.16)*(pow(1.8/max(r,1.08),1.5)-1.0)*1.2;
  let rotation=atan2(sin(f.forward.w*speed),cos(f.forward.w*speed));
  let phase=angle-rotation-shear;
  let pixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let directionalPixels=max(vec2f(1.0),pixels*footprint);
  let diskPixels=min(directionalPixels.x,directionalPixels.y);
  // Spiral lanes, broad packets and bent images sample one periodic field.
  // Every angular frequency is integral, so the disk closes at its seam.
  let spiralPhase=phase*3.0+log(max(r,1.0))*5.4;
  // Cartesian periodic coordinates retain the same stream around the seam.
  // The broad packets and their fine edges share this advected field; the
  // cached three-dimensional noise is reused, with no per-object texture.
  let diskSpace=vec3f(cos(phase)*r,sin(phase)*r,log(max(r,1.0))*1.6);
  let seed=vec3f(3.7,f.star.w*17.0,8.1);
  let folded=mix(.5,nebulaNoise3(diskSpace*1.15+seed),exp(-pow(5.5/max(diskPixels,1.0),2.0)));
  let bend=phase+log(max(r,1.0))*2.2+(folded-.5)*.45;
  let warped=vec3f(cos(bend)*3.1,sin(bend)*3.1,log(max(r,1.0))*14.0);
  let lane=mix(.5,nebulaNoise3(warped+seed),exp(-pow(12.0/directionalPixels.x,2.0)-pow(20.0/directionalPixels.y,2.0)));
  let resolution=blackHoleFlowResolution(footprint);
  var angular=.5;var radial=.5;
  if(resolution.x>.001) {
    let knotBend=phase+log(max(r,1.0))*.45+(folded-.5)*.12;
    angular=nebulaNoise3(vec3f(cos(knotBend)*9.0,sin(knotBend)*9.0,log(max(r,1.0))*2.0)+seed+vec3f(.37,.11,4.1));
  }
  if(resolution.y>.001) {
    radial=nebulaNoise3(vec3f(cos(bend)*9.0,sin(bend)*9.0,log(max(r,1.0))*45.0)+seed+vec3f(.37,.11,4.1));
  }
  let wave=mix(.5,.5+.5*sin(spiralPhase+(folded-.5)*2.8+sin(phase*2.0)*.55),
    exp(-pow(3.0/directionalPixels.x,2.0)-pow(5.4/directionalPixels.y,2.0)));
  let packet=smoothstep(.18,.76,folded)*(.24+smoothstep(.25,.84,wave)*.76);
  let channel=(1.0-smoothstep(.10,.38,wave))*(.40+smoothstep(.24,.65,lane)*.60);
  let stream=pow(smoothstep(.26,.80,lane),1.5)*(.20+smoothstep(.16,.72,wave)*.80);
  let knot=pow(smoothstep(.30,.84,angular),1.6)*resolution.x*(.25+packet*.75);
  let braid=pow(smoothstep(.34,.84,radial),2.0)*resolution.y*(.25+stream*.75);
  let strands=stream*.24+knot*.55+braid*.45;
  let fineChannel=(1.0-smoothstep(.25,.50,radial))*resolution.y;
  let infall=inner*pow(wave,2.0)*(.25+lane*.75);
  let heat=pow(clamp((3.8-r)/2.3,0.0,1.0),1.3);
  let tangent=normalize(vec3f(-p.z,0,p.x));
  let approaching=dot(tangent,view);
  let beaming=mix(.23,1.85,approaching*.5+.5);
  let temperature=clamp(heat*.56+packet*.12+strands*.22+approaching*.06,0.0,1.0);
  var cool=select(vec3f(.58,.10,.017),vec3f(.55,.065,.012),jet);
  var hot=select(vec3f(2.05,1.20,.48),vec3f(2.15,.89,.25),jet);
  if(blackHoleIsCygnus()) {cool=vec3f(.13,.23,.42);hot=vec3f(1.6,1.95,2.35);}
  if(blackHoleIsOutburst()) {cool=vec3f(.40,.12,.055);hot=vec3f(2.05,1.63,1.10);}
  let color=mix(cool,hot,temperature);
  let textureLight=(.12+packet*.62+stream*.70+knot*.85+braid*.75)*
    (1.0-channel*.74)*(.55+lane*.65)*(1.0-fineChannel*.40);
  let redshift=mix(.32,1.0,smoothstep(1.06,1.58,r));
  let shifted=color*beaming*textureLight*(.30+heat*1.30)*redshift;
  let density=outer*(.14+packet*.36+stream*.24+knot*.18+braid*.18)*
    (1.0-channel*.62)*(.50+heat*.80)+infall*.32;
  return vec4f(shifted,density);

}
fn blackHolePlane(center: vec3f, ray: vec3f, view: vec3f, limit: f32) -> vec4f {
  let t=center.y/ray.y;
  if (t<=0.0 || t>=limit) { return vec4f(0); }
  let p=ray*t-center;
  let disk=blackHoleDisk(p,view,blackHoleDirectFootprint(p,view,ray,0.0));
  let density=disk.a*0.20/abs(ray.y);
  return vec4f(disk.rgb*density,density);
}
// A finite compressed jet shares the disk axis and shadow clipping. The
// observed kiloparsec jet and horizon scale cannot be shown at real ratios.
fn blackHoleJet(center: vec3f, ray: vec3f, limit: f32) -> vec4f {
  let axis=vec3f(0,1,0); let side=vec3f(1,0,0);
  var density=0.0; var spine=0.0; var samplePosition=vec3f(0);
  for (var i=0u;i<12u;i++) {
    let reach=select(18.0,13.0,blackHoleIsOutburst());
    let d=1.6+(f32(i)+.5)*reach/12.0;
    let wave=.5+.5*cos(d*1.15-f.forward.w*.85);
    let knot=wave*wave*wave*wave;
    let width=.12+d*.045;
    let bend=vec3f(sin(d*.27-f.forward.w*.11),0,cos(d*.31-f.forward.w*.11))*d*.018;
    let envelope=(1.0-smoothstep(15.0,20.0,d))*(.065+knot*.22);
    for (var sign=0u;sign<2u;sign++) {
      let direction=select(1.0,-1.0,sign==1u);
      let node=center+(axis*d+bend)*direction;
      let counter=select(.22,.68,blackHoleIsOutburst());
      let weight=select(1.0,counter,sign==1u)*envelope;
      let broad=pulsarClippedDensity(node,ray,axis,side,vec3f(1.1,width,width),limit,28.0)*weight;
      let fine=pulsarClippedDensity(node,ray,axis,side,vec3f(1.1,width*.25,width*.25),limit,28.0)*weight*.85;
      density+=broad; spine+=fine;
      samplePosition+=(ray*clamp(dot(node,ray),0.0,limit)-center)*broad;
    }
  }
  if (density<.0001) { return vec4f(0); }
  let p=samplePosition/density;
  let uv=vec2f(atan2(p.z,p.x)*.4,p.y*.65-f.forward.w*.45);
  let pixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let mip=max(0.0,log2(f32(textureDimensions(surfaceNoise).x)*.12/max(pixels,1.0)));
  let structure=textureSampleLevel(surfaceNoise,surfaceSampler,uv,mip).r;
  let detail=mix(1.0,.45+structure*1.1,blackHoleNearDetail());
  return vec4f(vec3f(.18,.38,.82)*density*detail+vec3f(.70,1.22,1.75)*spine,density*detail+spine);
}
fn blackHoleVolumeFragment(center: vec3f, ray: vec3f, clipCore:bool) -> vec4f {
  let along=dot(center,ray);
  let closest=center-ray*along;
  let impact2=dot(closest,closest);
  let jet=blackHoleHasJet();
  if (along<0.0 || impact2>select(16.0,484.0,jet)) { return vec4f(0); }
  let near=along-sqrt(max(0.0,1.0-impact2));
  let limit=select(100000.0,near,clipCore && near>0.0);
  let localCenter=blackHoleLocal(center);
  let localRay=blackHoleLocal(ray);
  let view=normalize(localCenter);
  var density=0.0; var radiance=vec3f(0);
  if (jet) {
    let light=blackHoleJet(localCenter,localRay,limit);
    density=light.a; radiance=light.rgb;
  }
  // Jet pixels outside the disk skip its grazing ray march and light images.
  if (impact2<=16.0) {
  var diskDensity=0.0; var diskRadiance=vec3f(0);
  if (abs(localRay.y)>0.25) {
    let plane=blackHolePlane(localCenter,localRay,view,limit);
    diskDensity=plane.a; diskRadiance=plane.rgb;
  } else {
    // Finite thickness keeps the disk observable through an edge-on orbit.
    let reach=sqrt(max(0.0,16.0-impact2));
    let start=max(0.0,along-reach); let end=min(limit,along+reach);
    let count=u32(clamp(f.quality.x*0.5,12.0,24.0));
    let step=max(0.0,end-start)/f32(count);
    for (var i=0u;i<count;i++) {
      let lo=start+f32(i)*step; let hi=lo+step;
      let middle=(lo+hi)*0.5;
      var sampleDistance=middle;
      var weight=exp(-pow((localRay.y*middle-localCenter.y)/0.109545,2.0))*step;
      if (abs(localRay.y)>0.006) {
        // Integrate each segment's thickness instead of point-sampling a thin
        // slab. This removes popping and comb-like bands through a grazing orbit.
        let a=(localRay.y*lo-localCenter.y)/0.07746;
        let b=(localRay.y*hi-localCenter.y)/0.07746;
        weight=abs(smoothstep(-1.8,1.8,b)-smoothstep(-1.8,1.8,a))*0.194162/abs(localRay.y);
        sampleDistance=mix(middle,clamp(localCenter.y/localRay.y,lo,hi),smoothstep(0.025,0.12,abs(localRay.y)));
      }
      if (weight>0.00001) {
        let p=localRay*sampleDistance-localCenter;
        let footprint=blackHoleDirectFootprint(p,view,localRay,min(step,.12/max(abs(localRay.y),.006)));
        let disk=blackHoleDisk(p,view,footprint);
        diskDensity+=disk.a*weight; diskRadiance+=disk.rgb*disk.a*weight;
      }
    }
    if (abs(localRay.y)>0.13) {
      let plane=blackHolePlane(localCenter,localRay,view,limit);
      let blend=smoothstep(0.13,0.25,abs(localRay.y));
      diskDensity=mix(diskDensity,plane.a,blend); diskRadiance=mix(diskRadiance,plane.rgb,blend);
    }
  }
  density+=diskDensity; radiance+=diskRadiance;
  let impact=sqrt(impact2);
  let normal=vec3f(0,cos(f.light.w),sin(f.light.w));
  let projected=normal-ray*dot(normal,ray);
  let inclination=length(projected);
  let up=projected/max(inclination,0.0001);
  let side=cross(up,ray);
  let vertical=dot(-closest,up); let horizontal=dot(-closest,side);
  // Secondary images remap the far disk into curved paths. Their material,
  // temperature and asymmetric beaming come from the same disk as the direct
  // view; only the bounded artistic path mapping is observer dependent.
  let arcRadius=length(vec2f(horizontal,vertical/mix(1.0,1.12,inclination)));
  let compression=mix(0.10,0.40,inclination*inclination);
  let sourceRadius=1.40+(arcRadius-1.055)/compression;
  let farDirection=normalize(vec2f(localCenter.x,localCenter.z)+vec2f(0.00001));
  let across=vec2f(farDirection.y,-farDirection.x);
  let azimuth=atan2(abs(vertical),horizontal);
  let sourceDirection=across*cos(azimuth)-farDirection*sin(azimuth);
  let arcVisibility=inclination*inclination*smoothstep(0.04,0.32,abs(vertical))*
    smoothstep(1.015,1.07,impact)*(0.20+0.80*smoothstep(-0.08,0.28,vertical));
  if (arcVisibility>0.0001 && sourceRadius>1.32 && sourceRadius<3.8) {
    let lensed=blackHoleDisk(vec3f(sourceDirection.x*sourceRadius,0,sourceDirection.y*sourceRadius),view,
      vec2f(arcRadius,sourceRadius*compression));
    let arcDensity=lensed.a*arcVisibility*0.46;
    density+=arcDensity; radiance+=lensed.rgb*arcDensity;
  }
  // Resolve the inner image as a fine boundary with disk-coloured structure,
  // instead of drawing an equally bright independent hoop from every angle.
  let ringPixels=f.presentation.x*min(f.quality.z/f.viewport.x,f.quality.w/f.viewport.y);
  let ringWidth=clamp(0.85/max(ringPixels,1.0),0.010,0.075);
  let ringProfile=exp(-pow((impact-1.045)/ringWidth,2.0));
  if (ringProfile>0.0002) {
    let ringSource=blackHoleDisk(vec3f(sourceDirection.x*1.75,0,sourceDirection.y*1.75),view,vec2f(1.045,10.0));
    let ringDensity=ringProfile*(0.24+ringSource.a*0.28);
    density+=ringDensity; radiance+=ringSource.rgb*ringDensity*1.20;
  }
  }
  if (density<0.0002) { return vec4f(0); }
  let alpha=(1.0-exp(-density))*smoothstep(0.55,3.5,f.presentation.x);
  return vec4f(radiance/max(density,0.0001)*alpha,alpha);
}
`;
