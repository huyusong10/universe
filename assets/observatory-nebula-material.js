// A bounded, object-anchored gas volume. Its clouds and embedded lights are
// artistic landmarks of one catalog body, not additional stars or measurements.
const knotRecipes = Array.from({length:48}, (_, i) => {
  const seed = k => { const value=Math.sin((i+1)*k)*43758.5453; return value-Math.floor(value); };
  return [seed(12.9898),seed(78.233),seed(37.719),seed(19.173)];
}).map(values => `vec4f(${values.map(value=>value.toFixed(8)).join(',')})`).join(',');
export const NEBULA_MATERIAL_WGSL = /* wgsl */ `
fn isNebulaMaterial() -> bool {
  return (f.style.w > 2.5 && f.style.w < 3.5) || (f.style.w > 26.5 && f.style.w < 27.5) ||
    (f.style.w > 35.5 && f.style.w < 37.5) || (f.style.w>50.5 && f.style.w<54.5) || (f.style.w>97.5 && f.style.w<105.5) ||
    (f.style.w>159.5 && f.style.w<171.5);
}
// Galaxy and nebula clouds use one continuous, periodic spatial field.
// Sampling never depends on LOD, the observation clock or entry time.
fn nebulaNoise3(p:vec3f)->f32 {
  return volumeNoise3(p);
}
fn nebulaFineNoise(p:vec3f,detail:vec2f)->f32 {
  var value=nebulaNoise3(p);
  let resolved=detail.x*pow(detail.y,6.0);
  if(resolved>.001) {
    value=clamp(value+(nebulaNoise3(p*2.03+vec3f(19.7,7.1,3.3))-.5)*resolved*.48,0.0,1.0);
  }
  return mix(.5,value,detail.y);
}
// Distinct bounded landscapes share the ray budget and scale filtering.
// Shells, knots, cavities and lights are artistic landmarks of one identity.
const NEBULA_KNOT_RECIPE = array<vec4f,48>(${knotRecipes});
fn nebulaFilteredKnot(offset:vec3f,sigma:vec3f,blur:f32)->f32 {
  let variance=sigma*sigma;
  let filtered=variance+vec3f(blur);
  // Preserve mass when a ray segment cannot resolve a small head or tail.
  let distance2=dot(offset*offset,vec3f(1.0)/filtered);
  // The filtered peak is at most one; omitted tails stay below one millionth.
  if(distance2>13.815511) {return 0.0;}
  return exp(-distance2)*
    sqrt((variance.x*variance.y*variance.z)/(filtered.x*filtered.y*filtered.z));
}
fn nebulaShellKnots(p:vec3f,radial:f32,angle:f32,bend:f32,blur:f32,helix:bool)->vec2f {
  let count=select(24,36,helix);
  let spacing=6.2831853/f32(count);
  let sector=i32(floor((angle+3.14159265)/spacing));
  var heads=0.0;var tails=0.0;
  // Neighbour cells avoid an angular seam. Every knot has its own depth,
  // size and curved short tail; there is no repeating iris/spoke field.
  for(var neighbour=-1;neighbour<=1;neighbour++) {
    let raw=sector+neighbour;
    let index=(raw%count+count)%count;
    let recipe=NEBULA_KNOT_RECIPE[u32(index)];
    let longitude=(f32(raw)+.5+(recipe.x-.5)*.28)*spacing-3.14159265;
    let radius=select(.84,.96,helix)+bend+(recipe.y-.5)*.16;
    let depth=(recipe.z-.5)*select(.64,.90,helix);
    let size=.80+recipe.w*.45;
    let along=radial-radius;
    let tangent=(angle-longitude)*radius;
    let axial=p.z-depth;
    heads+=nebulaFilteredKnot(vec3f(along,tangent,axial),vec3f(.052,.037,.074)*size,blur);
    let curve=sin(along*9.0+recipe.y*5.0)*.018;
    let tail=nebulaFilteredKnot(vec3f(along-.15,tangent+curve,axial-along*(recipe.z-.5)*.6),
      vec3f(.13,.022,.046)*size,blur);
    tails+=tail*smoothstep(-.025,.04,along);
  }
  return vec2f(heads,tails);
}
fn nebulaCloudVeins(p:vec3f,coarse:f32,fine:f32,detail:vec2f)->f32 {
  // Irregular folds break a uniform fog into cloud banks at different depths.
  // Existing noise supplies the bends; no extra hash/octave or ray step.
  let fold=.5+.5*sin(p.y*12.0+p.z*6.0+coarse*8.0+fine*2.8+sin(p.x*4.0));
  let vein=smoothstep(.46,.86,fold)*smoothstep(.28,.68,coarse);
  return mix(1.0,.34+vein*1.08,detail.x*detail.y);
}
fn helixNebulaField(point: vec3f, samplingKernel: vec4f, detail: vec2f) -> vec2f {
  let p = stellarRotateY(stellarRotateZ(point, .16), -.20);
  let envelope = 1.0 - smoothstep(1.92, 2.35, length(point));
  if (envelope <= 0.0) { return vec2f(0.0); }
  let radial = length(p.xy * vec2f(1.0, 1.09));
  let angle = atan2(p.y, p.x);
  let bend = sin(angle * 3.0 + sin(angle * 5.0) * .45) * .075;
  let rim = radial - 1.17 - bend - p.z * .09;
  let shell = exp(-rim * rim * samplingKernel.x) * samplingKernel.z * exp(-p.z * p.z * 1.9);
  let outer = stellarRotateY(p, .34) - vec3f(.06, .02, .15);
  let outerRim = length(outer.xy * vec2f(1.0, 1.07)) - 1.75;
  let halo = exp(-outerRim * outerRim * 13.0 - outer.z * outer.z * 2.5) *
    (.10 + .07 * sin(angle * 2.0 + .7));
  let inner = exp(-dot(p * vec3f(1.35, 1.46, .9), p * vec3f(1.35, 1.46, .9))) * .035;
  let bound = (shell * 1.7 + halo + inner) * envelope;
  if (bound < .0001) { return vec2f(0.0); }
  let drift = vec3f(.005, -.004, .002) * f.forward.w;
  let coarse = nebulaNoise3(p * 5.4 + drift + vec3f(7.1, 2.8, 11.3));
  let fine = nebulaFineNoise(p * 21.0 - drift + vec3f(13.7, 9.2, 3.1),detail);
  let blur=max(0.0,1.0/samplingKernel.x-1.0/28.0);
  let knots=nebulaShellKnots(p,radial,angle,bend,blur,true);
  let porous = smoothstep(.20, .76, coarse * .65 + fine * .35);
  let density = bound * mix(.45 + coarse * .45, .12 + porous * porous * .88, detail.x) +
    (knots.x*1.12+knots.y*.42)*(.50+coarse*.50)*envelope;
  let dust=(knots.x*.24+knots.y*.055)*envelope;
  return vec2f(density, dust);
}

fn lagoonNebulaField(point: vec3f, samplingKernel: vec4f, detail: vec2f) -> vec2f {
  let p = stellarRotateZ(point, -.28);
  let envelope = 1.0 - smoothstep(1.85, 2.35, length(point));
  if (envelope <= 0.0) { return vec2f(0.0); }
  let ridge = p.y - .34 * sin(p.x * 1.8 + p.z * .7) - p.z * .18;
  let sheet = exp(-ridge * ridge * samplingKernel.x) * samplingKernel.z *
    exp(-dot(p * vec3f(.60, .45, .83), p * vec3f(.60, .45, .83)));
  let upper = (p - vec3f(-.78, .48, -.12)) * vec3f(.9, 1.3, 1.3);
  let lower = (p - vec3f(.74, -.46, .26)) * vec3f(1.0, 1.4, 1.1);
  let lobes = exp(-dot(upper, upper) * 1.5) + exp(-dot(lower, lower) * 1.7);
  let cavity = length((p - vec3f(-.18, .10, .24)) / vec3f(.88, .74, 1.18));
  let cavityWall = exp(-pow(cavity - 1.0, 2.0) * samplingKernel.x) * samplingKernel.z;
  let gasBound = (sheet * 1.45 + lobes * .35 + cavityWall * .55) *
    smoothstep(.40, 1.06, cavity) * envelope;
  let lane = p.y + .10 + .23 * sin(p.x * 2.4 + p.z * .8);
  let laneDepth = exp(-lane * lane * samplingKernel.y) * samplingKernel.w *
    exp(-dot(p.xz * vec2f(.73, .83), p.xz * vec2f(.73, .83)));
  let pillar = p.x + .54 - .08 * sin(p.y * 3.7 + p.z);
  let pillarDust = exp(-pillar * pillar * 33.0 - pow((p.y + .28) * 1.45, 4.0) - p.z * p.z * 2.1);
  let dustBound = (laneDepth * .85 + pillarDust * .55) * envelope;
  if (gasBound * .8 + dustBound * 4.8 < .0001) { return vec2f(0.0); }
  let drift = vec3f(.006, -.007, .004) * f.forward.w;
  let coarse = nebulaNoise3(p * 4.5 + drift + vec3f(2.9, 14.2, 5.7));
  let fine = nebulaFineNoise(p * vec3f(20.0, 9.0, 17.0) - drift + vec3f(8.7, 3.1, 11.2),detail);
  let turbulence = smoothstep(.34, .73, coarse * mix(.78, .52, detail.x) + fine * mix(.22, .48, detail.x));
  let veins=nebulaCloudVeins(p,coarse,fine,detail);
  let density = gasBound * (.018 + turbulence * turbulence * .982)*veins;
  let dust=dustBound*(.10+coarse*.38+fine*.52)*.55;
  return vec2f(density,dust);
}

fn ringNebulaPoint(point: vec3f) -> vec3f {
  return stellarRotateY(stellarRotateZ(point, 0.24), -0.3);
}
fn ringNebulaField(point: vec3f, samplingKernel: vec4f, detail: vec2f) -> vec2f {
  let p = ringNebulaPoint(point);
  let envelope = 1.0 - smoothstep(1.85, 2.35, length(point));
  if (envelope <= 0.0) { return vec2f(0.0); }
  let radial = length(p.xy * vec2f(1.0, 1.17));
  let angle = atan2(p.y, p.x);
  let corrugation = sin(angle * 5.0 + sin(angle * 3.0)) * 0.035;
  let rim = radial - 1.02 - corrugation;
  let ring = exp(-rim * rim * samplingKernel.x) * samplingKernel.z * exp(-p.z * p.z * 1.15);
  let lobeRadius = length(p / vec3f(.72, .64, 1.65));
  let lobe = lobeRadius - 1.0;
  let innerGas = exp(-lobe * lobe * samplingKernel.x) * samplingKernel.z * .20 +
    exp(-dot(p * vec3f(1.9, 2.1, .68), p * vec3f(1.9, 2.1, .68))) * .065;
  let haloRim = radial - 1.55;
  let halo = exp(-haloRim * haloRim * 8.0 - p.z * p.z * 2.0) * .045;
  let gasBound = (ring * 1.35 + innerGas + halo) * envelope;
  if (gasBound < .0001) { return vec2f(0.0); }
  let drift = vec3f(.004, -.006, .003) * f.forward.w;
  let coarse = nebulaNoise3(p * 6.2 + drift + vec3f(4.1, 9.7, 13.2));
  let fine = nebulaFineNoise(p * vec3f(23.0, 23.0, 9.0) - drift + vec3f(8.2, 1.4, 3.9),detail);
  let threads=.5+.5*sin(p.z*15.0+coarse*9.0+fine*4.0+sin(angle*5.0)*2.0);
  let turbulence = smoothstep(.23, .74, coarse * mix(.75, .45, detail.x) + fine * mix(.25, .55, detail.x));
  let structure = .28 + turbulence * turbulence * .72;
  let blur=max(0.0,1.0/samplingKernel.x-1.0/28.0);
  let knots=nebulaShellKnots(p,radial,angle,corrugation,blur,false);
  let density = gasBound * mix(.48 + coarse * .42, structure, detail.x) *
    mix(1.0, .34 + fine * .40 + threads * .26, detail.x * detail.y)+
    (knots.x*.86+knots.y*.23)*(.55+coarse*.45)*envelope;
  let dust=(knots.x*.19+knots.y*.04)*envelope;
  return vec2f(density, dust);
}

fn nebulaField(point: vec3f, samplingKernel:vec4f, detail:vec2f) -> vec2f {
  let p = stellarRotateY(stellarRotateZ(point, 0.24), -0.3);
  let envelope = 1.0 - smoothstep(1.65, 2.35, length(point));
  if(envelope<=0.0) { return vec2f(0.0); }
  let ridge = abs(p.y - 0.30 * sin(p.x * 2.7) - 0.23 * p.z - sin(p.z*4.3+p.x)*.075);
  // Filter narrow layers over the ray segment, preserving their column mass.
  let sheet = exp(-ridge * ridge * samplingKernel.x)*samplingKernel.z * exp(-dot(p * vec3f(0.65, 0.38, 0.84), p * vec3f(0.65, 0.38, 0.84)));
  let lobeA = (p - vec3f(-0.78, 0.38, -0.36)) * vec3f(1.0, 1.6, 1.3);
  let lobeB = (p - vec3f(0.82, -0.25, 0.24)) * vec3f(1.2, 1.1, 1.4);
  let lobes = exp(-dot(lobeA, lobeA) * 1.8) + exp(-dot(lobeB, lobeB) * 1.9);
  let cavity = 1.0 - exp(-dot(p - vec3f(0.03, 0.04, 0.30), p - vec3f(0.03, 0.04, 0.30)) * 1.8) * 0.95;
  let pillarOffset=p.xz-vec2f(-.62,.05)-vec2f(sin(p.y*3.5)*.08,cos(p.y*2.7)*.10);
  let pillarRadius=length(pillarOffset);
  var pillar=0.0;var illuminatedEdge=0.0;
  // Outside this radius both contributions are below display precision.
  if(pillarRadius<.70) {
    let pillarCap=exp(-pow((p.y+.18)*1.6,4.0));
    pillar=exp(-pillarRadius*pillarRadius*48.0)*pillarCap;
    illuminatedEdge=exp(-pow((pillarRadius-.20)*10.0,2.0))*pillarCap;
  }
  let gasBound=(sheet*1.6+lobes*.30+illuminatedEdge*.36)*cavity*envelope;
  let lane = p.y + 0.18 + sin(p.x * 2.6 + p.z) * 0.16;
  let dustBound=(exp(-lane*lane*samplingKernel.y)*samplingKernel.w*exp(-dot(p.xz*vec2f(.68,.9),p.xz*vec2f(.68,.9)))+pillar*.38)*envelope;
  // Noise modulation cannot exceed one. Avoid hashing effectively empty gas;
  // the conservative extinction bound preserves the visible cloud and dust.
  if (gasBound * 0.8 + dustBound * 4.8 < 0.0001) { return vec2f(0.0); }
  let drift = vec3f(0.012, -0.009, 0.006) * f.forward.w;
  let coarse = nebulaNoise3(p * 3.7 + drift + vec3f(13.2, 4.1, 7.7));
  let fine = nebulaFineNoise(p * vec3f(15.0, 5.0, 19.0) - drift * 0.6 + vec3f(2.3, 8.4, 6.1),detail);
  let turbulence=smoothstep(.28,.74,coarse*mix(.77,.56,detail.x)+fine*mix(.23,.44,detail.x));
  let density = gasBound * turbulence * turbulence*nebulaCloudVeins(p,coarse,fine,detail);
  let dust=dustBound*smoothstep(.26,.70,fine*.52+coarse*.48);
  return vec2f(density, dust);
}

// Four additional forms use the existing transparent target and ray budget.
// Pillars, dust silhouettes, cliffs and filament networks are artistic fields.
fn frontierNebulaField(p:vec3f,kernel:vec4f,detail:vec2f)->vec2f {
  let envelope=1.0-smoothstep(1.85,2.35,length(p));
  if(envelope<=0.0) {return vec2f(0);}
  let blur=1.0/kernel.y-1.0/45.0;
  let broad=nebulaNoise3(p*3.2+vec3f(f.star.w*11.0,4.1,7.3));
  let fine=nebulaFineNoise(p*11.0+vec3f(7.2,1.9,3.4),detail);
  let filament=nebulaCloudVeins(p,broad,fine,detail);
  var dust=0.0;var gas=0.0;
  if(f.style.w<51.5) {
    // A small group of irregular towers, separated by transparent channels.
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let x=-.73+n*.67;let height=.90-n*.18;
      let bend=.08*sin(p.y*4.0+n*2.1)+.05*(broad-.5);
      let q=p-vec3f(x+bend,-.35+n*.08,.20-n*.18);
      let sigma=vec3f(.15+n*.035,height,.23);
      let stem=nebulaFilteredKnot(q,sigma,blur);
      let head=nebulaFilteredKnot(q-vec3f(-.08,height*.76,.06),vec3f(.26,.21,.28),blur);
      let wide=nebulaFilteredKnot(q,sigma+vec3f(.05,.02,.04),blur);
      let eroded=smoothstep(.18,.70,broad*.72+fine*.28);
      dust+=(stem+head*.9)*(.40+eroded*1.2);
      gas+=max(0.0,wide-stem)*2.4*(.30+eroded)+head*.16;
    }
    gas+=exp(-pow(p.z+.65,2.0)*kernel.x*.38)*(.10+smoothstep(.27,.70,broad)*.60)*(1.0-smoothstep(.85,1.7,abs(p.y)));
  } else if(f.style.w<52.5) {
    let neck=nebulaFilteredKnot(p-vec3f(-.30,-.22,.16),vec3f(.22,.68,.26),blur);
    let head=nebulaFilteredKnot(p-vec3f(-.02,.41,.16),vec3f(.43,.23,.28),blur);
    let jaw=nebulaFilteredKnot(p-vec3f(.27,.32,.19),vec3f(.24,.14,.22),blur);
    let bank=nebulaFilteredKnot(p-vec3f(-.46,-1.1,.02),vec3f(1.28,.48,.61),blur);
    dust=(neck+head+jaw+bank)*(.45+smoothstep(.20,.72,broad*.75+fine*.25)*1.1);
    gas=exp(-pow(p.z+.55,2.0)*kernel.x*.34)*(.18+smoothstep(.24,.72,broad)*.90)*
      (1.0-smoothstep(.9,1.9,length(p.xy)));
    gas+=max(0.0,nebulaFilteredKnot(p-vec3f(-.30,-.22,.16),vec3f(.28,.71,.32),blur)-neck)*.6;
  } else if(f.style.w<53.5) {
    let peak=.18+exp(-pow(p.x+.5,2.0)*4.0)*.61+exp(-pow(p.x-.58,2.0)*9.0)*.46;
    let coast=p.y-peak+(broad-.5)*.27;
    let wall=exp(-p.z*p.z*kernel.x*.45)*(1.0-smoothstep(-.05,.15,coast));
    dust=wall*(.30+smoothstep(.24,.74,broad)*1.2)*(1.0-smoothstep(.9,1.9,abs(p.x)));
    let rim=exp(-coast*coast*kernel.y*.75)*exp(-p.z*p.z*kernel.x*.55);
    gas=rim*(.65+fine*.85)*filament+exp(-pow(p.z+.68,2.0)*kernel.x*.27)*(.07+smoothstep(.25,.73,broad)*.56);
  } else {
    let q=p/vec3f(1.18,.87,.77);let radius=length(q);
    let shell=exp(-pow(radius-1.08+(broad-.5)*.16,2.0)*kernel.x*.90);
    let fold=dot(q,vec3f(8.4,-5.7,6.1))+broad*12.0+fine*3.0;
    let thread=smoothstep(.58,.95,.5+.5*sin(fold));
    gas=shell*(.15+thread*.88)*(.4+fine*.70)+exp(-dot(q,q)*2.2)*.21;
    dust=shell*smoothstep(.59,.82,broad)*.35;
  }
  return vec2f(gas,dust)*envelope;
}
// Eight finite sculpted volumes. All use the same shared noise lattice, filtered
// kernels and 22-step ceiling as legacy clouds; near detail never moves a shell.
fn sculptedNebulaField(p:vec3f,kernel:vec4f,detail:vec2f)->vec2f {
  let envelope=1.0-smoothstep(1.90,2.35,length(p));
  if(envelope<=0.0) {return vec2f(0);}
  let blur=max(0.0,1.0/kernel.y-1.0/45.0);
  let drift=vec3f(.009,-.006,.004)*f.forward.w;
  let broad=nebulaNoise3(p*3.1+drift+vec3f(f.star.w*13.0,7.3,2.1));
  let fine=nebulaFineNoise(p*12.5-drift*.6+vec3f(6.8,1.4,9.1),detail);
  let cloudBank=smoothstep(.27,.70,broad*.74+fine*.26);
  let clouds=.055+cloudBank*cloudBank*1.75;
  let seam=broad-.51+.07*sin(p.y*5.0+p.z*2.0);
  let wisps=exp(-seam*seam*90.0);
  let veins=nebulaCloudVeins(p,broad,fine,detail)*mix(1.0,.20+wisps*1.35,detail.x*detail.y);
  var gas=0.0;var dust=0.0;
  if(f.style.w<98.5) {
    // Open barrel along x, broadened lobes, porous collar and gas knots.
    let q=stellarRotateY(stellarRotateZ(p,-.28),.22);
    let axial=abs(q.x);let radial=length(q.yz*vec2f(1.0,1.12));
    let radius=.43+.28*smoothstep(.10,1.1,axial)+.07*(broad-.5);
    let d=radial-radius;let ends=1.0-smoothstep(1.17,1.63,axial);
    let wall=exp(-d*d*kernel.x*.75)*kernel.z*ends;
    let lobe=nebulaFilteredKnot(vec3f(axial-.93,q.y,q.z),vec3f(.39,.69,.53),blur);
    let a=atan2(q.z,q.y);
    let knots=nebulaShellKnots(vec3f(q.y,q.z,q.x),radial,a,(broad-.5)*.05,blur,false);
    gas=(wall*.95+lobe*.36+knots.x*.85+knots.y*.3)*clouds*veins;
    dust=knots.x*.11+wall*.025;
  } else if(f.style.w<99.5) {
    // Tilted inner ellipsoids cross inside much fainter concentric outer arcs.
    let q=stellarRotateZ(stellarRotateY(p,.34),-.36);
    let r=length(q*vec3f(.80,1.25,1.0));
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let d=r-(.97+n*.31)-.035*(broad-.5);
      gas+=exp(-d*d*kernel.x)*kernel.z*select(.48,.075,i>0u)*clouds;
    }
    let cross=stellarRotateY(stellarRotateZ(p,.65),-.42);
    let r2=length(cross*vec3f(1.35,.78,1.1));let d2=r2-.69;
    gas+=exp(-d2*d2*kernel.x*.9)*kernel.z*.62*clouds;
    gas*=veins;dust=gas*.027;
  } else if(f.style.w<100.5) {
    // Two hollow lobes separated by a dusty torus. The hidden star is omitted.
    let q=stellarRotateZ(stellarRotateY(p,-.25),-.29);
    let axial=abs(q.x);let radial=length(q.yz*vec2f(1.0,1.18));
    let radius=.12+.74*sin(clamp(axial/1.95,0.0,1.0)*2.35);
    let fold=.045*sin(axial*6.0+q.y*2.0)+.055*(broad-.5);
    let d=radial-radius-fold;let tips=1.0-smoothstep(1.35,2.08,axial);
    gas=exp(-d*d*kernel.x*.8)*kernel.z*tips*smoothstep(.06,.28,axial)*clouds*veins*1.8;
    let waist=radial-.28;
    dust=exp(-q.x*q.x*kernel.y*.6-waist*waist*kernel.y)*kernel.w*1.2;
  } else if(f.style.w<101.5) {
    let q=p-vec3f(.14,-.10,0);let radius=length(q);
    let d=radius-.96-.045*(broad-.5);
    gas=exp(-d*d*kernel.x*1.3)*kernel.z*clouds*veins*.92;
    let bank=nebulaFilteredKnot(p-vec3f(-1.02,.75,-.20),vec3f(.52,.77,.61),blur);
    gas+=bank*clouds*.70;dust=bank*(.15+broad*.45);
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let stem=nebulaFilteredKnot(p-vec3f(-.64+n*.24,.66-n*.22,-.46),vec3f(.10,.31,.15),blur);
      dust+=stem*.7;gas+=stem*.25;
    }
  } else if(f.style.w<102.5) {
    let q=stellarRotateY(stellarRotateZ(p,.13),.18);
    let a=atan2(q.y,q.x);let radial=length(q.xy*vec2f(.94,1.08));
    let radius=1.20+.12*sin(a*3.0)+.08*sin(a*5.0+1.2);
    let d=radial-radius;
    let gaps=.18+.82*smoothstep(.20,.64,broad);
    gas=exp(-d*d*kernel.x*.19-q.z*q.z*2.0)*kernel.z*gaps*clouds*veins*1.9;
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let angle=n*2.1+.5;
      let local=stellarRotateZ(q,-angle)-vec3f(.90,0,.20-n*.17);
      let finger=nebulaFilteredKnot(local,vec3f(.32,.085,.17),blur);
      dust+=finger*(.6+broad*.8);gas+=finger*.12;
    }
  } else if(f.style.w<103.5) {
    // Separate curved shock ribbons: no filled sphere and no central light.
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let q=stellarRotateY(stellarRotateZ(p,n*.20-.24),n*.34-.3)-vec3f(n*.13-.13,0,0);
      let a=atan2(q.y,q.x);let radial=length(q.xy*vec2f(.87,1.0));
      let radius=1.06+n*.27+.09*sin(a*3.0+n);
      let d=radial-radius+(broad-.5)*.10;
      let z=q.z-(.20*sin(a*2.0+n)+n*.19-.19);
      let gate=smoothstep(.58,.86,cos(a-n*2.0+.55));
      gas+=exp(-d*d*kernel.x*2.0-z*z*kernel.x*.45)*kernel.z*kernel.z*gate*clouds*veins*4.5;
    }
    dust=gas*.008;
  } else if(f.style.w<104.5) {
    let q=stellarRotateZ(p,.12);
    let behind=q.z+.38+.10*(broad-.5);
    gas=exp(-behind*behind*kernel.x*.16-q.x*q.x*.33-q.y*q.y*.28)*kernel.z*clouds*veins*1.2;
    let trunk=nebulaFilteredKnot(q-vec3f(.08*sin(q.y*2.5),-.08,.12),vec3f(.12,1.35,.23),blur);
    dust=trunk*1.3;
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let side=select(-1.0,1.0,i==1u);
      let local=stellarRotateZ(q-vec3f(side*(.30+n*.12),.18+n*.30,.10-n*.13),side*.75);
      dust+=nebulaFilteredKnot(local,vec3f(.095,.66,.19),blur)*1.25;
    }
    dust*=.45+clouds*.65;
  } else {
    let q=stellarRotateZ(p,-.23);let ridge=-.49+.34*cos(q.x*1.7);
    let d=q.y-ridge+(broad-.5)*.15;
    let front=q.z+.10-.22*sin(q.x*1.4);
    let scallop=exp(-d*d*kernel.x*.22-front*front*2.4)*kernel.z;
    let bank=nebulaFilteredKnot(q-vec3f(-.50,-.78,-.40),vec3f(1.25,.62,.55),blur);
    let cavity=nebulaFilteredKnot(q-vec3f(.38,.34,.05),vec3f(.85,.83,.74),blur);
    gas=(scallop*1.8+bank*.65)*(1.0-cavity*.62)*clouds*veins;
    dust=bank*(.15+clouds*.22)+scallop*.06;
    let spur=nebulaFilteredKnot(stellarRotateZ(q-vec3f(-.55,-.02,.16),-.46),vec3f(.13,.46,.18),blur);
    dust+=spur*.9;gas+=spur*.11;
  }
  return vec2f(gas,dust)*envelope;
}
fn sculptedNebulaColour(p:vec3f,core:f32)->vec3f {
  if(f.style.w<98.5) {return mix(vec3f(1.50,.24,.15),vec3f(.15,1.02,.93),exp(-p.x*p.x*.75));}
  if(f.style.w<99.5) {return mix(vec3f(1.48,.47,.15),vec3f(.12,.94,1.20),1.0-smoothstep(.65,1.3,length(p)));}
  if(f.style.w<100.5) {return mix(vec3f(1.57,.63,.20),vec3f(.20,.71,1.32),exp(-p.x*p.x*1.3));}
  if(f.style.w<101.5) {return mix(vec3f(1.51,.76,.26),vec3f(.18,.76,1.27),smoothstep(-.9,.5,p.x));}
  if(f.style.w<102.5) {return mix(vec3f(1.52,.25,.43),vec3f(.29,.79,1.17),core*.75);}
  if(f.style.w<103.5) {return mix(vec3f(1.62,.26,.16),vec3f(.12,.99,1.28),smoothstep(-.15,.25,p.z));}
  if(f.style.w<104.5) {return mix(vec3f(1.35,.32,.10),vec3f(1.61,.96,.49),smoothstep(-1.0,.7,p.y));}
  return mix(vec3f(1.63,.76,.39),vec3f(.24,.70,1.22),core*.75);
}

// A second group of authored cloud landscapes. Thin ridges, knots and dark
// columns integrate over the same ray footprint; no new volume or star budget.
fn explorationNebulaField(p:vec3f,kernel:vec4f,detail:vec2f)->vec2f {
  let envelope=1.0-smoothstep(1.88,2.35,length(p));
  if(envelope<=0.0) {return vec2f(0.0);}
  let profile=u32(round(f.style.w))-160u;
  let blur=max(0.0,1.0/kernel.y-1.0/45.0);
  let drift=vec3f(.004,-.003,.002)*f.forward.w;
  let broad=nebulaNoise3(p*3.6+vec3f(f.star.w*13.0,4.2,7.7)+drift);
  let fine=nebulaFineNoise(p*vec3f(13.0,9.0,12.0)+vec3f(9.3,2.7,5.1)-drift,detail);
  let cloud=smoothstep(.23,.76,broad*.66+fine*.34);
  let texture=(.08+cloud*cloud*.92)*nebulaCloudVeins(p,broad,fine,detail);
  var gas=0.0;var dust=0.0;
  if(profile==0u) {
    let q=stellarRotateZ(p,.19);
    let bank=nebulaFilteredKnot(q-vec3f(.12,-.20,-.20),vec3f(1.35,.98,.74),blur);
    let reflection=nebulaFilteredKnot(q-vec3f(-.64,.92,.05),vec3f(.73,.41,.50),blur);
    gas=(bank*1.45+reflection*.9)*texture;
    // Three outward branches, rather than three infinite crossing planes.
    for(var i=0u;i<3u;i++) {
      let a=f32(i)*2.094+.2;
      let r=stellarRotateZ(q-vec3f(.08,-.14,.13),a);
      let lane=r.y-.11*sin(r.x*2.2+f32(i));
      dust+=exp(-lane*lane*kernel.y)*kernel.w*
        smoothstep(-.18,.12,r.x)*exp(-r.x*r.x*.65-r.z*r.z*2.0)*1.3;
    }
    dust*=.42+broad*.58;
  } else if(profile==1u) {
    let q=stellarRotateY(stellarRotateZ(p,.31),-.28);
    let a=atan2(q.y,q.x);let radius=length(q.xy*vec2f(.85,1.08));
    let d=radius-1.21-.09*sin(a*3.0)-.06*(broad-.5);
    let gap=smoothstep(-.65,.08,q.x-q.y*.38);
    gas=exp(-d*d*kernel.x-q.z*q.z*1.7)*kernel.z*gap*texture*1.9;
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let r=stellarRotateY(q,n*.53-.48);
      let rib=r.y+.55-n*.5-.25*sin(r.x*1.8+n);
      gas+=exp(-rib*rib*kernel.x*.8-r.z*r.z*kernel.x*.3)*kernel.z*kernel.z*
        exp(-r.x*r.x*.55)*smoothstep(-1.5,-.5,r.x)*texture*.75;
    }
    dust=gas*.025;
  } else if(profile==2u) {
    // Curved layers cross at different depths around an uneven clearing.
    for(var i=0u;i<4u;i++) {
      let n=f32(i);let q=stellarRotateY(stellarRotateZ(p,n*.69-.9),n*.39-.5);
      let ridge=q.y-(.67+.28*sin(q.x*1.6+n)+n*.10)-q.z*.24;
      let wall=exp(-ridge*ridge*kernel.x*.35)*kernel.z*
        exp(-q.x*q.x*.27-q.z*q.z*.85);
      gas+=wall*texture*(1.15-n*.12);
      dust+=wall*(.12+broad*.28);
    }
    let clearing=nebulaFilteredKnot(p-vec3f(.06,.04,.25),vec3f(.72,.63,1.08),blur);
    gas*=1.0-clearing*.82;dust*=1.0-clearing*.95;
  } else if(profile==3u) {
    let q=stellarRotateZ(p,-.19);
    let ridge=q.y+.63-.22*cos(q.x*2.3)-.11*(broad-.5);
    let wall=exp(-ridge*ridge*kernel.x*.25-q.z*q.z*.9)*kernel.z;
    let bank=nebulaFilteredKnot(q-vec3f(.28,-1.02,-.25),vec3f(1.35,.46,.62),blur);
    gas=(wall*1.7+bank*.7)*texture;dust=bank*(.24+broad*.35);
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let r=q-vec3f(-.87+n*.71,-.45+n*.11,.28-n*.21);
      let bent=r-vec3f(.10*sin(r.y*3.0+n),0,0);
      let stem=nebulaFilteredKnot(bent,vec3f(.12,.46-n*.06,.19),blur);
      dust+=stem*.95;gas+=stem*texture*.34;
    }
  } else if(profile==4u) {
    let q=stellarRotateY(stellarRotateZ(p,-.18),.23);
    let radius=length(q.xy*vec2f(.86,1.08));
    let d=radius-1.15-.06*sin(q.x*3.0+q.y);
    let open=smoothstep(-.65,-.08,q.y+.18*q.x);
    let arch=exp(-d*d*kernel.x*.45-q.z*q.z*1.4)*kernel.z*open;
    gas=arch*texture*1.95;dust=arch*(.12+broad*.15);
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let r=stellarRotateZ(q-vec3f(-.86+n*.77,.61-n*.14,.24-n*.17),n*.19-.20);
      let finger=nebulaFilteredKnot(r,vec3f(.13,.37,.20),blur);
      dust+=finger*.8;gas+=finger*texture*.22;
    }
  } else if(profile==5u) {
    let bank=nebulaFilteredKnot(p-vec3f(-.12,.05,-.14),vec3f(1.55,1.18,.79),blur);
    var holes=0.0;var walls=0.0;
    let centres=array<vec3f,3>(vec3f(-.65,.36,.16),vec3f(.56,.18,-.18),vec3f(.12,-.71,.20));
    let scales=array<vec3f,3>(vec3f(.66,.61,.79),vec3f(.49,.74,.65),vec3f(.58,.45,.72));
    for(var i=0u;i<3u;i++) {
      let r=length((p-centres[i])/scales[i]);
      holes=max(holes,1.0-smoothstep(.62,1.05,r));
      let d=r-1.10-.05*(broad-.5);
      walls+=exp(-d*d*kernel.x*.25)*kernel.z*.27;
    }
    gas=(bank*1.4+walls)*(1.0-holes*.96)*texture;
    dust=bank*(1.0-holes)*(.16+broad*.30);
  } else if(profile==6u) {
    let q=stellarRotateY(stellarRotateZ(p,.24),-.31);
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let side=select(-1.0,1.0,i==1u);
      let fold=q.x-side*(.48+n*.12)-.22*sin(q.y*2.1+n)-q.z*.22;
      let bank=exp(-fold*fold*kernel.x*.28)*kernel.z*
        exp(-pow(q.y-(n-1.0)*.4,2.0)*.7-pow(q.z+n*.22-.2,2.0)*1.4);
      gas+=bank*texture*(1.4-n*.16);dust+=bank*(.08+broad*.17);
    }
    let gap=nebulaFilteredKnot(q,vec3f(.24,.62,.58),blur);
    dust+=gap*.75;gas*=1.0-gap*.6;
  } else if(profile==7u) {
    let centres=array<vec3f,3>(vec3f(-.52,.72,-.12),vec3f(.58,.03,.27),vec3f(-.20,-.73,-.26));
    let scales=array<vec3f,3>(vec3f(.72,.48,.64),vec3f(.47,.53,.49),vec3f(.91,.32,.57));
    for(var i=0u;i<3u;i++) {
      let r=p-centres[i];let window=nebulaFilteredKnot(r,scales[i],blur);
      gas+=window*texture*1.6;
      let shell=nebulaFilteredKnot(r,scales[i]*1.3,blur)-window;
      dust+=max(0.0,shell)*(.6+broad*.6);
    }
    let lane=p.x+.1+.19*sin(p.y*2.7+p.z);
    dust+=exp(-lane*lane*kernel.y)*kernel.w*exp(-p.y*p.y*.35-p.z*p.z*1.2)*.85;
  } else if(profile==8u) {
    let q=stellarRotateZ(p,-.40);
    let edge=q.x+.72-.32*cos(q.y*1.7)-q.z*.16;
    let front=exp(-edge*edge*kernel.x*.55)*kernel.z*exp(-q.y*q.y*.7-q.z*q.z*1.4);
    gas=front*texture*1.65;dust=front*(.12+broad*.25);
    for(var i=0u;i<3u;i++) {
      let n=f32(i);let r=q-vec3f(.25+n*.18,-.67+n*.67,.17-n*.16);
      let bend=r.y-.16*sin(r.x*2.0+n);
      let tail=nebulaFilteredKnot(vec3f(r.x,bend,r.z),vec3f(.91,.16+n*.03,.24),blur);
      gas+=tail*texture*.85;dust+=tail*(.08+broad*.14);
    }
  } else if(profile==9u) {
    let q=stellarRotateZ(p,.18);
    let behind=q.z+.43+.06*(broad-.5);
    gas=exp(-behind*behind*kernel.x*.18-q.x*q.x*.30-q.y*q.y*.29)*kernel.z*texture*1.6;
    let height=clamp((q.y+1.2)/2.0,0.0,1.0);
    let width=.30-.22*height;
    let r=q-vec3f(.10*sin(q.y*2.2),-.25,.17);
    let pillar=nebulaFilteredKnot(r,vec3f(width,1.1,.27),blur);
    let rim=nebulaFilteredKnot(r,vec3f(width+.055,1.14,.32),blur)-pillar;
    dust=pillar*(1.2+broad*.8);gas+=max(0.0,rim)*texture*.65;
  } else if(profile==10u) {
    let q=stellarRotateY(stellarRotateZ(p,-.10),.28);
    let axial=abs(q.y);let radial=length(q.xz*vec2f(1.0,1.3));
    let wall=radial-(.055+axial*.57)-.025*sin(axial*5.0);
    let tips=1.0-smoothstep(1.35,1.95,axial);
    gas=exp(-wall*wall*kernel.x)*kernel.z*tips*smoothstep(.04,.22,axial)*texture*1.5;
    for(var i=0u;i<4u;i++) {
      let n=f32(i);let d=axial-(.39+n*.35);
      let rung=exp(-d*d*kernel.x*1.5)*kernel.z;
      gas+=rung*exp(-wall*wall*kernel.x*.3)*kernel.z*tips*texture*.85;
    }
    dust=nebulaFilteredKnot(q,vec3f(.42,.11,.37),blur)*1.45;
  } else {
    let q=stellarRotateY(stellarRotateZ(p,.32),-.18);
    let axial=abs(q.y);let radial=length(q.xz*vec2f(1.0,1.12));
    let asymmetry=select(.86,1.14,q.y>0.0);
    let radius=(.06+.46*sin(clamp(axial/1.85,0.0,1.0)*2.0))*asymmetry;
    let d=radial-radius-.03*sin(q.y*5.0+q.z*2.0);
    let tips=1.0-smoothstep(1.3,1.97,axial);
    let outer=nebulaFilteredKnot(q,vec3f(1.07,1.85,1.04),blur);
    gas=(exp(-d*d*kernel.x*.7)*kernel.z*tips*smoothstep(.06,.26,axial)*1.45+outer*.09)*texture;
    dust=nebulaFilteredKnot(q,vec3f(.29,.13,.25),blur)*.8;
  }
  return vec2f(gas,dust)*envelope;
}
fn explorationNebulaColour(p:vec3f,core:f32)->vec3f {
  let profile=u32(round(f.style.w))-160u;
  if(profile==0u) {return mix(vec3f(1.60,.26,.46),vec3f(.19,.59,1.42),smoothstep(.35,.95,p.y-p.x*.25));}
  if(profile==1u) {return mix(vec3f(1.48,.34,.24),vec3f(.23,.98,1.27),smoothstep(-.30,.55,p.z));}
  if(profile==2u) {return mix(vec3f(1.56,.69,.26),vec3f(.24,.70,1.19),core*.8);}
  if(profile==3u) {return mix(vec3f(1.54,.75,.25),vec3f(.26,.75,1.26),smoothstep(-.4,.6,p.y));}
  if(profile==4u) {return mix(vec3f(1.36,.46,.93),vec3f(.28,.80,1.26),smoothstep(-.2,.7,p.z));}
  if(profile==5u) {return mix(vec3f(1.55,.34,.19),vec3f(1.61,.93,.41),smoothstep(-.65,.7,p.y+p.x*.25));}
  if(profile==6u) {return mix(vec3f(.21,.43,1.17),vec3f(.49,.87,1.65),core);}
  if(profile==7u) {
    let warm=mix(vec3f(1.49,.23,.19),vec3f(1.55,.84,.33),smoothstep(-.65,.12,p.y));
    return mix(warm,vec3f(.25,.61,1.51),smoothstep(.22,.62,p.y));
  }
  if(profile==8u) {return mix(vec3f(1.50,.29,.46),vec3f(.27,.62,1.31),smoothstep(-.15,.65,p.x));}
  if(profile==9u) {return mix(vec3f(1.46,.20,.15),vec3f(1.65,.64,.28),smoothstep(-.25,.70,p.y));}
  if(profile==10u) {return mix(vec3f(1.48,.33,.12),vec3f(1.68,.86,.37),core*.6);}
  return mix(vec3f(.19,.46,1.19),vec3f(.57,.98,1.56),core*.65);
}
fn explorationNebulaLight(index:u32)->vec4f {
  let profile=u32(round(f.style.w))-160u;
  // Externally lit clouds and dust-hidden central sources receive no invented
  // embedded star. Other lights are explicitly authored depth references.
  if(profile>=8u) {return vec4f(0.0);}
  if(profile==0u || profile==1u || profile==6u) {
    if(index>0u) {return vec4f(0.0);}
    return vec4f(.02,.02,.13,select(.8,1.0,profile==6u));
  }
  if(profile==7u) {
    if(index>1u) {return vec4f(0.0);}
    return select(vec4f(-.52,.72,-.07,.8),vec4f(.58,.03,.32,.35),index==1u);
  }
  let n=f32(index);
  let positions=array<vec3f,4>(vec3f(-.22,.16,.21),vec3f(.18,.04,.34),vec3f(.06,-.13,.11),vec3f(.30,.25,-.10));
  return vec4f(positions[index]*1.45,.85-n*.13);
}

// Finite authored landmarks keep the same positions and source exclusions at
// every scale. Their light is attenuated only by gas and dust in front of them.
fn nebulaEmbeddedLight(index:u32) -> vec4f {
  let ring=f.style.w>26.5 && f.style.w<27.5;
  let helix=f.style.w>35.5 && f.style.w<36.5;
  let sculpted=f.style.w>97.5 && f.style.w<105.5;
  if(f.style.w>159.5 && f.style.w<171.5) {return explorationNebulaLight(index);}
  // Dust-hidden Butterfly and the Veil's absent central remnant stay unlit.
  if(sculpted && ((f.style.w>99.5 && f.style.w<100.5) ||
    (f.style.w>102.5 && f.style.w<103.5))) {return vec4f(0.0);}
  if((ring || helix || (f.style.w>53.5 && f.style.w<54.5) ||
    (sculpted && f.style.w<101.5)) && index>0u) {return vec4f(0.0);}
  let positions=array<vec3f,4>(vec3f(-.12,.12,.18),vec3f(.11,.05,.29),vec3f(.03,-.11,.1),vec3f(.23,-.08,.04));
  var position=select(positions[index],vec3f(0.0),ring || helix);
  if(f.style.w>36.5 && f.style.w<37.5) {
    position=stellarRotateZ(positions[index]*2.2+vec3f(-.18,.10,.24),.28);
  }
  if(f.style.w>50.5 && f.style.w<53.5) {position=positions[index]*3.0+vec3f(.45,.85,-.65);}
  if(sculpted) {
    position=vec3f(0.0);
    if(f.style.w>100.5 && f.style.w<101.5) {position=vec3f(-.35,.35,.15);}
    else if(f.style.w>101.5) {position=positions[index]*2.4+vec3f(.20,.20,-.45);}
  }
  return vec4f(position,1.0);
}

// Both visible gas and its lightward neighbour query the same density,
// footprint and clock. This does not invent an opaque surface on a cloud.
fn nebulaDensityAt(p:vec3f,kernel:vec4f,detail:vec2f) -> vec2f {
  if(f.style.w>159.5 && f.style.w<171.5) {return explorationNebulaField(p,kernel,detail);}
  if(f.style.w>26.5 && f.style.w<27.5) {return ringNebulaField(p,kernel,detail);}
  if(f.style.w>35.5 && f.style.w<36.5) {return helixNebulaField(p,kernel,detail);}
  if(f.style.w>36.5 && f.style.w<37.5) {return lagoonNebulaField(p,kernel,detail);}
  if(f.style.w>97.5 && f.style.w<105.5) {return sculptedNebulaField(p,kernel,detail);}
  if(f.style.w>50.5 && f.style.w<54.5) {return frontierNebulaField(p,kernel,detail);}
  return nebulaField(p,kernel,detail);
}

// Evaluate the two existing positions through one bounded field loop. This
// keeps a single field body live rather than expanding the complex dispatcher
// twice in the ray marcher; density, lightward offset and filtering are equal.
fn nebulaLitDensity(p:vec3f,kernel:vec4f,detail:vec2f,source:vec3f,lightingDetail:f32) -> mat2x2f {
  var pair=mat2x2f(vec2f(0.0),vec2f(0.0));
  let count=select(1u,2u,lightingDetail>.001);
  for(var slot=0u;slot<count;slot++) {
    var point=p;
    if(slot>0u) {let delta=source-p;point+=delta/max(length(delta),.000001)*.10;}
    let field=nebulaDensityAt(point,kernel,detail);
    pair[slot]=field;
    if(slot==0u && field.x<=.00001) {break;}
  }
  return pair;
}

fn nebulaFragment(center: vec3f, ray: vec3f, impact2: f32, along: f32) -> vec4f {
  let bound = 2.35;
  if (impact2 >= bound * bound) { discard; }
  let halfChord = sqrt(bound * bound - impact2);
  let start = max(0.0, along - halfChord);
  let end = along + halfChord;
  if (end <= 0.0) { discard; }
  // Close observation uses the existing finite quality quota; distant views
  // retain the lower quota. The partition still covers the entire visible ray.
  let nearDetail=volumeNearDetail();
  let samples=clamp(u32(mix(f.quality.x*.75,f.quality.x,nearDetail)),10u,32u);
  let span=end-start;
  // A continuous quadratic partition spends more of the same finite work on
  // nearby walls, without skipping or moving the far side of the cloud.
  let frontWeight=mix(1.0,.16,nearDetail*(1.0-smoothstep(2.35,4.0,length(center))));
  let offset=mix(.5,stellarNoise3(ray*37.0),.18);
  let pixelCone=2.0*f.right.w/max(1.0,f.quality.w);
  let ringNebula = f.style.w > 26.5 && f.style.w < 27.5;
  let helixNebula = f.style.w > 35.5 && f.style.w < 36.5;
  let lagoonNebula = f.style.w > 36.5 && f.style.w < 37.5;
  let sculptedNebula=f.style.w>97.5 && f.style.w<105.5;
  let explorationNebula=f.style.w>159.5 && f.style.w<171.5;
  // Cache four finite sources once per pixel; integrate their foreground
  // optical columns with the same samples used for the visible cloud.
  var lightDepth=vec4f(-1.0);
  var lightColumns=vec4f(0.0);
  var lightRadiance:array<vec3f,4>;
  var cloudSource=vec3f(0.0);var cloudSourceWeight=0.0;
  for(var i=0u;i<4u;i++) {
    let landmark=nebulaEmbeddedLight(i);
    if(landmark.w<=0.0) {continue;}
    cloudSource+=landmark.xyz*landmark.w;cloudSourceWeight+=landmark.w;
    let relative=center+landmark.xyz;
    let depth=dot(relative,ray);
    if(depth<=0.0) {continue;}
    lightDepth[i]=depth;
    let offset=relative-ray*depth;
    // These are unresolved authored landmarks, not fixed-size glowing balls.
    // Filter their angular footprint and preserve energy at coarse resolution;
    // passing a source must not expand a world-space blur across the cloud.
    let angle2=dot(offset,offset)/max(depth*depth,.000000000001);
    let angularVariance=pixelCone*pixelCone*.35;
    let coreWidth=.000006+angularVariance;
    let haloWidth=.00018+angularVariance;
    let light=exp(-angle2/coreWidth)*7.0*.000006/coreWidth+
      exp(-angle2/haloWidth)*.10*.00018/haloWidth;
    lightRadiance[i]=vec3f(.82,1.13,1.85)*light*landmark.w;
  }
  // Source-free externally lit clouds keep a diffuse outside direction.
  // A hidden remnant or absent central source still draws no new light point.
  cloudSource=select(vec3f(-3.2,2.4,1.7),cloudSource/max(cloudSourceWeight,.000001),cloudSourceWeight>0.0);
  var transmittance = 1.0;
  var radiance = vec3f(0.0);
  for (var i = 0u; i < 32u; i++) {
    if (i>=samples) { break; }
    let u0=f32(i)/f32(samples);let u1=f32(i+1u)/f32(samples);
    let lo=u0*(frontWeight+(1.0-frontWeight)*u0);
    let hi=u1*(frontWeight+(1.0-frontWeight)*u1);
    let step=span*(hi-lo);let t=start+span*mix(lo,hi,offset);
    let blur=step*step/12.0+pow(t*pixelCone,2.0)/12.0;
    let sheetSharpness=1.0/(1.0/28.0+blur);
    let dustSharpness=1.0/(1.0/45.0+blur);
    let samplingKernel=vec4f(sheetSharpness,dustSharpness,sqrt(sheetSharpness/28.0),sqrt(dustSharpness/45.0));
    let detail=vec2f(nearDetail,exp(-step*step*16.0));
    let p = ray * t - center;
    let lightingDetail=nearDetail*(1.0-smoothstep(.20,.50,step));
    let fields=nebulaLitDensity(p,samplingKernel,detail,cloudSource,lightingDetail);
    let field=fields[0];
    // Empty gas and dust have no colour contribution.
    if(field.x+field.y<.000001) {continue;}
    var core = exp(-dot(p - vec3f(0.0, 0.05, 0.22), p - vec3f(0.0, 0.05, 0.22)) * 2.0);
    var colour = mix(vec3f(1.6, 0.16, 0.29), vec3f(0.20, 0.64, 1.5), core);
    if (ringNebula) {
      let radial = length(ringNebulaPoint(p).xy * vec2f(1.0, 1.17));
      core = 1.0 - smoothstep(.65, 1.15, radial);
      colour = mix(vec3f(1.60, .24, .12), vec3f(.12, .48, 1.60), core);
      let green = radial - .87;
      colour = mix(colour, vec3f(.25, 1.15, .75), exp(-green * green * 28.0) * .75);
    }
    if (helixNebula) {
      let q = stellarRotateY(stellarRotateZ(p, .16), -.20);
      let radial = length(q.xy * vec2f(1.0, 1.09));
      core = 1.0 - smoothstep(.68, 1.30, radial);
      colour = mix(vec3f(1.62, .37, .10), vec3f(.12, .66, 1.50), core);
      colour = mix(colour, vec3f(.30, 1.20, .77), exp(-pow(radial - .94, 2.0) * 20.0) * .60);
    }
    if (lagoonNebula) {
      let q = stellarRotateZ(p, -.28) - vec3f(-.18, .10, .24);
      core = exp(-dot(q, q) * 1.2);
      colour = mix(vec3f(.77, .20, 1.15), vec3f(1.65, .75, .32), core);
      colour = mix(colour, vec3f(.21, .64, 1.45), smoothstep(.3, 1.6, p.z) * .45);
    }
    if(f.style.w>50.5 && f.style.w<54.5) {
      core=exp(-dot(p,p)*1.3);
      if(f.style.w<51.5) {colour=mix(vec3f(.18,.71,1.23),vec3f(1.58,.89,.27),smoothstep(-.6,.6,p.z));}
      else if(f.style.w<52.5) {colour=mix(vec3f(.91,.12,.20),vec3f(1.58,.66,.37),smoothstep(-.2,.8,p.y));}
      else if(f.style.w<53.5) {colour=mix(vec3f(.15,.61,1.21),vec3f(1.64,.75,.22),smoothstep(-.65,.3,p.z));}
      else {colour=mix(vec3f(1.62,.43,.14),vec3f(.12,.57,1.26),core);}
    }
    if(sculptedNebula) {colour=sculptedNebulaColour(p,core);}
    if(explorationNebula) {colour=explorationNebulaColour(p,core);}
    let extinction = field.x * 0.8 + field.y * 4.8;
    lightColumns+=volumeLightColumn(lightDepth,start+span*lo,start+span*hi,extinction);
    let opacity = 1.0 - exp(-extinction * step);
    var illumination=1.0;
    if(lightingDetail>.001 && field.x>.00001) {
      let neighbour=fields[1];
      illumination=mix(1.0,volumeCloudIllumination(extinction,neighbour.x*.8+neighbour.y*4.8,.10),lightingDetail);
    }
    let emission = colour * field.x * (0.48 + core * 0.85) * illumination / max(extinction, 0.001);
    radiance += transmittance * opacity * emission;
    transmittance *= 1.0 - opacity;
  }
  var starlight=vec3f(0.0);
  let lightTransmission=exp(-lightColumns);
  for(var i=0u;i<4u;i++) {starlight+=lightRadiance[i]*lightTransmission[i];}
  let resolved = smoothstep(0.55, 3.5, f.presentation.x);
  return vec4f((radiance + starlight) * resolved, (1.0 - transmittance) * resolved);
}
`;
