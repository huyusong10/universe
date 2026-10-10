// Shared, object-anchored stellar radiance for the active catalog body.
// Inputs remain linear HDR; the renderer owns coverage and display conversion.
export const STELLAR_MATERIAL_WGSL = /* wgsl */ `
fn stellarRotateY(p: vec3f, angle: f32) -> vec3f {
  let c = cos(angle); let s = sin(angle);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

fn stellarRotateZ(p: vec3f, angle: f32) -> vec3f {
  let c = cos(angle); let s = sin(angle);
  return vec3f(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

fn stellarBodyDirection(p: vec3f, seed: f32, spin: f32) -> vec3f {
  return stellarRotateY(stellarRotateZ(p, seed * 0.85 - 0.4), spin);
}

fn stellarObjectDirection(p: vec3f) -> vec3f {
  return stellarBodyDirection(p, f.star.w, f.presentation.z);
}

fn stellarBlueFor(color:vec3f)->f32 {return smoothstep(.92,1.30,color.b/max(color.r,.01));}
fn stellarRedFor(color:vec3f)->f32 {return 1.0-smoothstep(.47,.83,color.g/max(color.r,.01));}
fn stellarGiantFor(color:vec3f,radius:f32)->f32 {
  // Catalog size and colour are presentation cues, not a spectral measurement.
  return stellarRedFor(color)*smoothstep(2.2,4.4,radius/.00012);
}
fn stellarBlueFraction()->f32 {return stellarBlueFor(f.star.rgb);}
fn stellarRedFraction()->f32 {return stellarRedFor(f.star.rgb);}
fn stellarGiantFraction()->f32 {return stellarGiantFor(f.star.rgb,f.focus.w);}
fn stellarDwarfFraction()->f32 {return stellarRedFraction()*(1.0-stellarGiantFraction());}
fn stellarMagneticWeight()->f32 {
  return (1.0-stellarBlueFraction()*.96)*(1.0-stellarGiantFraction()*.82);
}
fn stellarWarmFor(color:vec3f)->vec3f {
  let warm=mix(vec3f(3.65,1.26,.17),vec3f(3.2,.24,.025),stellarRedFor(color));
  return mix(warm,vec3f(.72,1.72,3.85),stellarBlueFor(color));
}
fn stellarHotFor(color:vec3f)->vec3f {
  let warm=mix(vec3f(3.6,2.45,.94),vec3f(3.8,.62,.08),stellarRedFor(color));
  return mix(warm,vec3f(2.0,2.85,4.7),stellarBlueFor(color));
}
fn stellarWarmRadiance()->vec3f {return stellarWarmFor(f.star.rgb);}
fn stellarHotRadiance()->vec3f {return stellarHotFor(f.star.rgb);}

// Quiet blue-white photospheres and compact pale envelopes share their field
// with resolved stellar references. Selecting a member adds detail, not a new
// colour, clock, sphere or set of surface coordinates.
fn stellarNoiseGradient(p:vec3f)->vec4f {
  let cell=floor(p);let t=fract(p);let w=t*t*(vec3f(3.0)-2.0*t);let dw=6.0*t*(1.0-t);
  let a=stellarHash3(cell);let b=stellarHash3(cell+vec3f(1,0,0));
  let c=stellarHash3(cell+vec3f(0,1,0));let d=stellarHash3(cell+vec3f(1,1,0));
  let e=stellarHash3(cell+vec3f(0,0,1));let g=stellarHash3(cell+vec3f(1,0,1));
  let h=stellarHash3(cell+vec3f(0,1,1));let j=stellarHash3(cell+vec3f(1,1,1));
  let low=mix(mix(a,b,w.x),mix(c,d,w.x),w.y);
  let high=mix(mix(e,g,w.x),mix(h,j,w.x),w.y);
  let dx=mix(mix(b-a,d-c,w.y),mix(g-e,j-h,w.y),w.z)*dw.x;
  let dy=mix(mix(c-a,d-b,w.x),mix(h-e,j-g,w.x),w.z)*dw.y;
  return vec4f(dx,dy,(high-low)*dw.z,mix(low,high,w.z));
}
fn stellarQuietRadiance(p:vec3f,normal:vec3f,ray:vec3f,color:vec3f,
    seed:f32,rasterRadius:f32,nearDetail:f32,whiteDwarf:bool)->vec3f {
  let time=f.forward.w;let mu=max(dot(normal,-ray),0.0);
  let offset=vec3f(seed*17.0,7.1,11.4);
  let broad=stellarNoiseGradient(p*2.3+offset);
  let tangent=cross(p,broad.xyz);
  let drift=vec3f(sin(p.y*3.7+seed*6.0+time*.11),sin(p.z*2.9-seed*3.0-time*.08),cos(p.x*3.1+seed*7.0+time*.09));
  let flow=normalize(p+(drift-p*dot(p,drift))*.025+tangent*.045);
  // Broad thermal fronts stay anchored across LODs. Small curved strands are
  // emission within those fronts, not a cloud albedo or corrugated surface.
  let phase=dot(flow,vec3f(2.7,1.9,3.4))+(broad.w-.5)*2.5;
  let front=.5+.5*sin(phase);
  let detailWeight=nearDetail*smoothstep(2.5,7.0,rasterRadius*sqrt(mu)/32.0);
  let middle=stellarNoiseGradient(flow*9.0+tangent*.32+offset);
  var fine=.5;
  if(detailWeight>0.0) {fine=stellarNoise3(flow*42.0+cross(flow,middle.xyz)*.48+offset);}
  let threadPhase=phase*6.3+(middle.w-.5)*5.0;
  let thread=pow(.5+.5*sin(threadPhase),8.0)*detailWeight;
  let pale=smoothstep(.20,.80,front);
  if(whiteDwarf) {
    let warm=smoothstep(1.02,1.75,color.r/max(color.b,.01));
    let cool=mix(vec3f(.22,.34,.53),vec3f(.49,.30,.15),warm);
    let hot=mix(vec3f(.95,1.17,1.43),vec3f(1.33,1.08,.75),warm);
    let temperature=clamp(.30+pale*.48+(broad.w-.5)*.10+(middle.w-.5)*detailWeight*.14-thread*.07,0.0,1.0);
    return (mix(cool,hot,temperature)+hot*(thread*.055+(fine-.5)*detailWeight*.075))*(.22+.78*pow(mu,.58));
  }
  let blue=stellarBlueFor(color);
  let emission=mix(color*2.05,vec3f(.60,1.35,2.85),blue);
  let thermal=.43+pale*.13+(broad.w-.5)*.13+(middle.w-.5)*detailWeight*.15-thread*.065;
  return (emission*(thermal+(fine-.5)*detailWeight*.070)+vec3f(.12,.20,.32)*thread*.23)*(.23+.77*pow(mu,.55));
}

// A continuous hierarchy of hot upwellings and cool lanes replaces discrete
// nearest-cell borders and isolated bright kernels. Each octave is filtered at
// its actual projected footprint; the same broad flow remains at both LODs.
fn stellarConvectionField(p:vec3f,scale:f32,warp:vec3f,seed:f32,footprint:f32)->vec3f {
  let q=p*scale+warp;let offset=vec3f(seed*17.0,4.2,9.1);
  let large=stellarNoise3(q+offset);
  let middleWeight=1.0-smoothstep(.35,.90,footprint*2.17);
  let fineWeight=1.0-smoothstep(.30,.85,footprint*4.61);
  var middle=.5;var fine=.5;
  if(middleWeight>0.0) {middle=stellarNoise3(stellarRotateZ(q*2.17,.71)+offset+vec3f(3,17,9));}
  if(fineWeight>0.0) {fine=stellarNoise3(stellarRotateY(q*4.61,-.53)+offset+vec3f(19,5,13));}
  let thermal=large*.64+mix(.5,middle,middleWeight)*.25+mix(.5,fine,fineWeight)*.11;
  let upwelling=smoothstep(.18,.82,thermal);
  return vec3f(.30+upwelling*.52,1.0-smoothstep(.25,.48,thermal),upwelling);
}

fn stellarGiantRadiance(p:vec3f,normal:vec3f,ray:vec3f,color:vec3f,seed:f32,raster:f32,near:f32)->vec3f {
  let time=f.forward.w;let offset=vec3f(seed*13.7,4.3,9.7);
  let broad=stellarNoiseGradient(p*2.7+offset);
  let bend=cross(p,broad.xyz);
  let drift=vec3f(sin(p.z*2.8+seed+time*.09),cos(p.x*3.3-seed-time*.07),sin(p.y*3.1+time*.08));
  let flow=normalize(p+bend*.10+(drift-p*dot(p,drift))*.055);
  let middle=stellarNoiseGradient(flow*7.0+bend*.62+offset);
  let roll=cross(flow,middle.xyz);
  let mu=max(dot(normal,-ray),0.0);
  let fineWeight=near*smoothstep(2.0,6.0,raster*sqrt(mu)/34.0);
  var fine=.5;
  if(fineWeight>0.0) {fine=stellarNoise3(flow*34.0+roll*.95+offset);}
  let temperature=clamp(.44+(broad.w-.5)*.87+(middle.w-.5)*.31,0.0,1.0);
  let upwelling=smoothstep(.15,.86,temperature);
  let cooled=(1.0-smoothstep(.28,.59,middle.w))*smoothstep(.25,.70,broad.w);
  let front=exp(-pow((temperature-.42)/.075,2.0));
  let folds=(fine-.5)*fineWeight*(.035+front*.12);
  let cool=stellarWarmFor(color)*vec3f(.16,.12,.09);
  let warm=stellarWarmFor(color)*.82;
  let hot=stellarHotFor(color)*.42;
  let layer=mix(cool,warm,upwelling)*(1.0-cooled*.13)+hot*(pow(upwelling,3.0)*.18+folds);
  return max(layer,vec3f(0))*(.23+.77*pow(mu,.55));
}

fn stellarActivityLifeFor(index:f32,seed:f32,dwarf:f32)->f32 {
  let phase=f.forward.w*(.48+index*.075)*(1.0+dwarf*.24)+seed*19.0+index*2.7;
  let wave=.5+.5*sin(phase);return wave*wave*wave;
}
fn stellarActivityLife(index:f32)->f32 {return stellarActivityLifeFor(index,f.star.w,stellarDwarfFraction());}
struct StellarActivitySite {anchor:vec3f,tangent:vec3f,normal:vec3f,span:f32};
fn stellarActivitySiteFor(index:f32,seed:f32,dwarf:f32)->StellarActivitySite {
  let longitude=seed*6.2831853+index*1.91;
  let latitude=sin(index*2.37+seed*3.0)*.36;
  let anchor=normalize(vec3f(cos(longitude),latitude,sin(longitude)));
  let east=normalize(cross(anchor,vec3f(0,1,0)));let north=cross(anchor,east);
  let tilt=sin(index*2.19+seed*7.0)*.72;let tangent=east*cos(tilt)+north*sin(tilt);
  return StellarActivitySite(anchor,tangent,cross(anchor,tangent),(.19+.055*(.5+.5*sin(index*3.1+seed*9.0)))*(1.0-dwarf*.28));
}
fn stellarActivityDirection(index:f32)->vec3f {return stellarActivitySiteFor(index,f.star.w,stellarDwarfFraction()).anchor;}
fn stellarActivitySite(index:f32)->StellarActivitySite {return stellarActivitySiteFor(index,f.star.w,stellarDwarfFraction());}
fn stellarSurfaceActivityFor(p:vec3f,seed:f32,red:f32,blue:f32,giant:f32)->vec2f {
  var spots=0.0;var surroundings=0.0;let dwarf=red*(1.0-giant);
  for(var i=0u;i<4u;i+=1u) {
    let index=f32(i);let site=stellarActivitySiteFor(index,seed,dwarf);
    let a=normalize(site.anchor-site.tangent*site.span);let b=normalize(site.anchor+site.tangent*site.span);
    let da=max(1.0-dot(p,a),0.0);let db=max(1.0-dot(p,b),0.0);
    let strength=(.38+stellarActivityLifeFor(index,seed,dwarf)*.62)*(1.0-blue*.96)*(1.0-giant*.82);
    let breadth=1.0-dwarf*.38;
    spots+=(exp(-da*520.0*breadth)+exp(-db*670.0*breadth))*strength;
    surroundings+=(exp(-da*88.0)+exp(-db*72.0))*strength;
  }
  return vec2f(min(spots,1.0),min(surroundings,1.5));
}

struct StellarCurveShape {
  site: StellarActivitySite,
  shear: f32,
  lean: f32,
  ripple: f32,
  height: f32,
};

// The same shape is queried many times per ray. Clock, root and branch terms
// stay outside that search; only the curve parameter varies during refinement.
fn stellarCurveShape(site: StellarActivitySite, index: f32, life: f32, branch: f32) -> StellarCurveShape {
  return StellarCurveShape(site,
    0.036 * sin(f.forward.w * 0.22 + index * 1.7) + branch * 0.022,
    0.036 * sin(index * 2.6 + f.star.w * 5.0),
    f.forward.w * 0.35 + index * 7.0 + branch * 1.8,
    (0.105 + life * 0.32 + branch * 0.045 * (0.35 + life * 0.65)) * (1.0 + stellarDwarfFraction() * 0.32));
}

fn stellarActivityCurve(shape: StellarCurveShape, u: f32) -> vec3f {
  let arch = sin(u * 3.14159265);
  let across = (u * 2.0 - 1.0) * shape.site.span;
  let lean = shape.lean + sin(u * 12.0 + shape.ripple) * 0.008;
  let direction = shape.site.anchor + shape.site.tangent * (across + arch * lean)
    + shape.site.normal * (arch * (shape.shear + across * 0.20));
  return normalize(direction) * (1.0 + arch * shape.height);
}

fn stellarActivityDistance(point: vec3f, direction: vec3f, front: f32) -> f32 {
  let axial = dot(point, direction);
  let miss = point - direction * axial;
  let behind = max(axial - front, 0.0);
  return dot(miss, miss) + behind * behind * 64.0;
}

// Selected and finite-reference photospheres query the same body-owned
// parameters. Family membership never substitutes a cloud-like quiet sphere.
fn stellarFamilyRadiance(p:vec3f,normal:vec3f,ray:vec3f,color:vec3f,seed:f32,
    radius:f32,raster:f32,near:f32,whiteDwarf:bool)->vec3f {
  let blue=stellarBlueFor(color);let red=stellarRedFor(color);
  if(whiteDwarf || blue>.995) {return stellarQuietRadiance(p,normal,ray,color,seed,raster,near,whiteDwarf);}
  let giant=stellarGiantFor(color,radius);
  if(giant>.8) {return stellarGiantRadiance(p,normal,ray,color,seed,raster,near);}
  let time=f.forward.w;let offset=vec3f(seed*13.7,7.4,9.1);
  let slow=vec3f(sin(p.y*7.0+seed+time*.19),sin(p.z*6.0-seed-time*.15),cos(p.x*8.0+seed+time*.17));
  let fast=vec3f(cos(p.z*12.0+seed-time*.38),sin(p.x*11.0+seed+time*.32),sin(p.y*10.0-seed-time*.35));
  let slowFlow=normalize(p+(slow-p*dot(p,slow))*.045);
  let fastFlow=normalize(p-(slow-p*dot(p,slow))*.016+(fast-p*dot(p,fast))*.024);
  let broad=stellarNoiseGradient(slowFlow*4.2+offset);
  let rolling=stellarNoiseGradient(fastFlow*12.0+offset*.73);
  let mu=max(dot(normal,-ray),0.0);let rasterAtAngle=raster*sqrt(mu);
  let cellScale=mix(32.0,22.0,red*(1.0-giant));
  let cellWeight=(1.0-blue)*smoothstep(2.3,5.5,rasterAtAngle/cellScale)*(.45+near*.55);
  var cell=vec3f(.57,0,.5);
  if(cellWeight>0.0) {
    let bend=vec3f(stellarNoise3(fastFlow*6.0+offset),stellarNoise3(fastFlow*6.0+offset+vec3f(17,3,8)),stellarNoise3(fastFlow*6.0+offset+vec3f(5,23,2)))-vec3f(.5);
    cell=stellarConvectionField(fastFlow,cellScale,bend*.55,seed,cellScale/max(rasterAtAngle,1.0));
  }
  let fineWeight=near*smoothstep(2.0,5.0,rasterAtAngle/90.0);
  var fine=.5;
  if(fineWeight>0.0) {fine=stellarNoise3(fastFlow*90.0+cross(fastFlow,rolling.xyz)*.7+offset);}
  let thermal=.48+(broad.w-.5)*.30+(rolling.w-.5)*.15;
  let temperature=clamp(mix(thermal,cell.x+(broad.w-.5)*.13,cellWeight),0.0,1.0);
  let activity=stellarSurfaceActivityFor(p,seed,red,blue,giant)*smoothstep(8.0,110.0,raster);
  let cool=stellarWarmFor(color)*.26;
  let warm=stellarWarmFor(color)*.77;
  let hot=stellarHotFor(color)*.78;
  let heating=smoothstep(.18,.86,temperature);
  let layer=mix(cool,warm,heating)+hot*(pow(heating,3.0)*.17+activity.y*.065);
  let granules=layer*(1.0-activity.x*.89)+(fine-.5)*fineWeight*stellarHotFor(color)*.035;
  let base=max(granules,vec3f(0))*(.23+.77*pow(mu,.57));
  if(giant>.02) {return mix(base,stellarGiantRadiance(p,normal,ray,color,seed,raster,near),smoothstep(.02,.8,giant));}
  return base;
}
fn stellarSurfaceRadiance(normal:vec3f,ray:vec3f)->vec3f {
  return stellarFamilyRadiance(stellarObjectDirection(normal),normal,ray,f.star.rgb,f.star.w,f.focus.w,bodyRasterRadius(),bodyNearDetail(),false);
}

fn stellarHash3(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += vec3f(dot(q, q.yzx + vec3f(33.33)));
  return fract((q.x + q.y) * q.z);
}

fn stellarNoise3(p: vec3f) -> f32 {
  let cell = floor(p);
  let part = fract(p);
  let w = part * part * (vec3f(3.0) - 2.0 * part);
  let a = mix(stellarHash3(cell), stellarHash3(cell + vec3f(1, 0, 0)), w.x);
  let b = mix(stellarHash3(cell + vec3f(0, 1, 0)), stellarHash3(cell + vec3f(1, 1, 0)), w.x);
  let c = mix(stellarHash3(cell + vec3f(0, 0, 1)), stellarHash3(cell + vec3f(1, 0, 1)), w.x);
  let d = mix(stellarHash3(cell + vec3f(0, 1, 1)), stellarHash3(cell + vec3f(1, 1, 1)), w.x);
  return mix(mix(a, b, w.y), mix(c, d, w.y), w.z);
}

// A bounded set of non-planar strands connects fixed paired footpoints.
// Local projected intervals retain overlapping emission when viewed edge-on.
// The front photosphere clips emission behind it; foreground plasma can remain
// visible over a surface region. No additional mesh or per-body resource is used.
fn stellarCoronalArcs(closest: vec3f, ray: vec3f) -> vec2f {
  if (stellarMagneticWeight() < 0.10) { return vec2f(0.0); }
  let detail = smoothstep(10.0, 30.0, f.presentation.x);
  let impact2 = dot(closest, closest);
  if (detail <= 0.0 || impact2 > 2.4) { return vec2f(0.0); }
  let q = stellarObjectDirection(-closest);
  let direction = stellarObjectDirection(ray);
  let front = select(1000.0, -sqrt(max(1.0 - impact2, 0.0)), impact2 < 1.0);
  // Spend curve work at the actual raster density. The two outer strands keep
  // depth at small coverage; a middle strand joins continuously as it resolves.
  let rasterRadius = max(1.0, f.presentation.x * f.viewport.z / f.viewport.x);
  let middlePresence = smoothstep(210.0, 260.0, rasterRadius);
  let filamentCount = select(2u, 3u, middlePresence > 0.0);
  let refinements = select(8u, 10u, rasterRadius >= 260.0);
  let segments = select(6u, 8u, rasterRadius >= 260.0);
  let step = 1.0 / f32(segments);
  var emission = 0.0;
  var density = 0.0;
  for (var i = 0u; i < 4u; i += 1u) {
    let index = f32(i);
    let site = stellarActivitySite(index);
    let bound = site.anchor * 1.18 - q;
    let projected = bound - direction * dot(bound, direction);
    // The complete curve fits within this sphere, including every branch and
    // lifetime. Keep a wider pixel query at small coverage. Entirely hidden
    // regions cannot contribute through the opaque front photosphere.
    let siteRadius = min(0.547723, 0.34 + max(0.06, 4.0 / max(f.presentation.x, 1.0)));
    if (dot(projected, projected) < siteRadius * siteRadius
        && dot(bound, direction) - siteRadius < front) {
      let life = stellarActivityLife(index);
      let centreShape = stellarCurveShape(site, index, life, 0.0);
      var nearestDistance = 1000.0;
      var a = stellarActivityCurve(centreShape, 0.0);
      for (var segment = 0u; segment < segments; segment += 1u) {
        let u0 = f32(segment) * step;
        let b = stellarActivityCurve(centreShape, u0 + step);
        let delta = b - a;
        let transverse = delta - direction * dot(delta, direction);
        let origin = a - q;
        let weight = clamp(-dot(origin, transverse) / max(dot(transverse, transverse), 0.000001), 0.0, 1.0);
        let point = a + delta * weight - q;
        let axial = dot(point, direction);
        let miss = point - direction * axial;
        let distance2 = dot(miss, miss);
        nearestDistance = min(nearestDistance, distance2);
        a = b;
      }
      // Coarse segments bound the work region; only continuous curves contribute
      // to the image. No segment polygon is rendered.
      let queryRadius = max(0.11, 4.0 / max(f.presentation.x, 1.0));
      if (nearestDistance < queryRadius * queryRadius) {
        // The centre strand only bounds the narrow query region. Each branch
        // finds its own closest visible segment, including at projected folds.
        for (var filament = 0u; filament < filamentCount; filament += 1u) {
          let branch = select(f32(filament) * 2.0 - 1.0, 0.0, filament == 2u);
          let shape = stellarCurveShape(site, index, life, branch);
          var branchA = stellarActivityCurve(shape, 0.0);
          let phase = 0.5 + 0.5 * sin(f.forward.w * 0.48 + index * 2.7 + branch * 0.8 + f.star.w * 19.0);
          let strength = (0.025 + life * 0.975) * (0.3 + phase * phase * 0.7)
            * select(1.0, middlePresence, filament == 2u);
          for (var segment = 0u; segment < segments; segment += 1u) {
            let u0 = f32(segment) * step;
            let u1 = u0 + step;
            let branchB = stellarActivityCurve(shape, u1);
            let delta = branchB - branchA;
            let transverse = delta - direction * dot(delta, direction);
            let origin = branchA - q;
            let weight = clamp(-dot(origin, transverse) / max(dot(transverse, transverse), 0.000001), 0.0, 1.0);
            let coarse = origin + delta * weight;
            let coarseMiss = coarse - direction * dot(coarse, direction);
            let segmentRadius = max(0.050, 4.0 / max(f.presentation.x, 1.0));
            branchA = branchB;
            if (dot(coarseMiss, coarseMiss) >= segmentRadius * segmentRadius) { continue; }
            // Local intervals retain both luminous sides when the same filament
            // folds in projection. Smooth overlap weights avoid doubling seams.
            var low = max(u0 - 0.015, 0.0);
            var high = min(u1 + 0.015, 1.0);
            var left = high - (high - low) * 0.61803399;
            var right = low + (high - low) * 0.61803399;
            var dl = stellarActivityDistance(stellarActivityCurve(shape, left) - q, direction, front);
            var dr = stellarActivityDistance(stellarActivityCurve(shape, right) - q, direction, front);
            for (var refinement = 0u; refinement < refinements; refinement += 1u) {
              if (dl < dr) {
                high = right; right = left; dr = dl;
                left = high - (high - low) * 0.61803399;
                dl = stellarActivityDistance(stellarActivityCurve(shape, left) - q, direction, front);
              } else {
                low = left; left = right; dl = dr;
                right = low + (high - low) * 0.61803399;
                dr = stellarActivityDistance(stellarActivityCurve(shape, right) - q, direction, front);
              }
            }
            let u = select(right, left, dl < dr);
            let interval = smoothstep(u0 - 0.015, u0 + 0.015, u) - smoothstep(u1 - 0.015, u1 + 0.015, u);
            let point = stellarActivityCurve(shape, u) - q;
            let axial = dot(point, direction);
            let miss = point - direction * axial;
            let visible = smoothstep(0.0, 0.012, front - axial) * interval;
            let distance2 = dot(miss, miss);
            let packet = 0.5 + 0.5 * sin(u * 24.0 - f.forward.w * (1.8 + index * 0.17) + index * 3.1 + branch * 2.2);
            let flow = 0.10 + 0.90 * packet * packet;
            let width = max((0.0045 + life * 0.0045) * (0.68 + sin(u * 3.14159265) * 0.32), 0.72 / rasterRadius);
            let strand = exp(-distance2 / (width * width));
            let sheath = exp(-distance2 / (width * width * 12.0));
            emission += (strand * flow + sheath * 0.035) * strength * visible * 0.24;
            density += (strand * (0.35 + flow * 0.65) + sheath * 0.14) * strength * visible;
          }
        }
      }
    }
  }
  return vec2f(emission, min(density * 0.60, 0.72)) * detail * stellarMagneticWeight();
}

fn stellarCoronaRadiance(closest: vec3f, ray: vec3f, impact: f32) -> vec3f {
  let h = max(impact - 1.0, 0.0);
  let outerTail = exp(-h * 2.6) * 0.0018;
  // The wide optical tail needs no turbulence work. The detailed component
  // reaches zero with a smooth derivative before this early exit.
  if (h >= 1.15) { return stellarWarmRadiance() * outerTail; }
  let nearWeight = 1.0 - smoothstep(0.55, 1.15, h);
  // closest points toward the stellar center from the viewing ray.
  // Its opposite supplies the limb direction in the sphere's own coordinates.
  let radial = -closest / max(impact, 0.0001);
  let p = stellarObjectDirection(radial);
  let view = stellarObjectDirection(-ray);
  let seedOffset = vec3f(f.star.w * 5.13, f.star.w * 11.7, f.star.w * 2.91);
  let time = f.forward.w;
  let giant = stellarGiantFraction();
  let blue = stellarBlueFraction();
  let broad = stellarNoise3(p * 3.2 + seedOffset);
  let flow = vec3f(sin(time * 0.14), cos(time * 0.12), sin(time * 0.11 + 1.0)) * 0.13;
  let fine = stellarNoise3(p * 12.0 + seedOffset + flow - p * h * 2.3);
  let strand = pow(smoothstep(0.37, 0.80, fine), 2.0);
  let reach = 0.085 + giant * 0.16 + pow(smoothstep(0.27, 0.82, broad), 2.0) * 0.30;
  let chromosphere = exp(-h * mix(54.0, 18.0, giant)) * (0.040 + fine * 0.040);
  let outflow=0.68+0.32*sin(h*22.0-time*1.5+broad*6.2831853);
  let lowCorona = exp(-h / reach) * (0.006 + strand * 0.026)*outflow;
  let outerCorona = outerTail * (1.0 + (broad - 0.5) * 0.7 * nearWeight);
  var prominence = 0.0;
  for (var i = 0u; i < 2u; i += 1u) {
    let index = f32(i);
    let anchor = stellarActivityDirection(index);
    let life = stellarActivityLife(index);
    // Anchored eruptions become visible only as their surface region reaches
    // the limb; their roots and broadening tails remain continuously attached.
    let limbVisibility = exp(-pow(dot(anchor, view) * 4.5, 2.0));
    let alignment = exp((dot(p, anchor) - 1.0) * (135.0 / (1.0 + h * 2.5)));
    let heightDecay = exp(-h / (0.070 + life * 0.14));
    prominence += alignment * heightDecay * life * limbVisibility * 0.12 * stellarMagneticWeight();
    // A broad attached plume, with a travelling shell and finite lifetime.
    let phase = fract(time * 0.065 + f.star.w + index * 0.47);
    let shell = exp(-pow((h-phase*0.86)/(0.12+h*0.10), 2.0));
    let plume = exp((dot(p,anchor)-1.0)*(24.0/(1.0+h)));
    let lifetime = smoothstep(0.0,0.15,phase)*(1.0-smoothstep(0.60,1.0,phase));
    prominence += plume * shell * lifetime * limbVisibility * giant * 0.055;
  }
  let radiance = stellarWarmRadiance() * ((chromosphere + lowCorona*(1.0-blue*0.82)) * nearWeight + outerCorona) * (1.0-blue*0.66)
    + stellarHotRadiance() * prominence * nearWeight;
  return max(radiance, vec3f(0.0));
}

fn whiteDwarfFragment(center: vec3f, ray: vec3f, impact2: f32, along: f32) -> vec4f {
  if (along <= 0.0 || impact2 > 4.0) { discard; }
  let impact = sqrt(impact2);
  let resolved = smoothstep(0.55,3.5,f.presentation.x);
  let edge = smoothstep(0.0,bodyEdgeWidth(),1.0-impact);
  let halo = vec3f(0.65,1.02,1.70)*exp(-max(impact-1.0,0.0)*22.0)*0.012;
  if (impact2 > 1.0) { return vec4f(halo*resolved,0.0); }
  let t = along-sqrt(max(1.0-impact2,0.0));
  let normal = normalize(ray*t-center);
  let p = stellarObjectDirection(normal);
  let light=stellarQuietRadiance(p,normal,ray,f.star.rgb,f.star.w,bodyRasterRadius(),bodyNearDetail(),true);
  let alpha = edge*resolved;
  return vec4f(light*alpha+halo*(1.0-alpha)*resolved,alpha);
}
`;
