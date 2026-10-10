// A compressed, artistically rotating structure, not a measured M31 catalogue.
// The oblate bound concentrates the finite ray samples around the disc.
import { GALAXY_CLUSTER_COUNT, GALAXY_STELLAR_COLOURS, galaxyClusterRecipe, galaxyWinding, GALAXY_PORTRAITS } from './observatory-galaxy-layout.js?v=cosmic-explore-20261010gu';
const clusterRecipe = loose => galaxyClusterRecipe(loose).map(recipe =>
  `vec4f(${recipe.map(value => value.toFixed(9)).join(',')})`).join(',');
export const GALAXY_FIELD_WGSL = /* wgsl */ `
fn galaxyPoint(p: vec3f) -> vec3f {
  return galaxyMotionPoint(p);
}
const GALAXY_COMPACT_CLUSTERS = array<vec4f,${GALAXY_CLUSTER_COUNT}>(${clusterRecipe(false)});
const GALAXY_LOOSE_CLUSTERS = array<vec4f,${GALAXY_CLUSTER_COUNT}>(${clusterRecipe(true)});
const GALAXY_PORTRAIT_HEIGHTS=array<f32,${Object.keys(GALAXY_PORTRAITS).length}>(${Object.values(GALAXY_PORTRAITS).map(p=>p.height.toFixed(2)).join(',')});
const GALAXY_PORTRAIT_PARAMETERS=array<vec4f,${Object.keys(GALAXY_PORTRAITS).length}>(${Object.values(GALAXY_PORTRAITS).map(p=>`vec4f(${[p.arms||2,p.winding||0,p.bar||0,p.asymmetry||0].map(v=>Number(v).toFixed(3)).join(',')})`).join(',')});
fn galaxyPortraitMaterial(material:f32) -> bool {
  return (material>105.5 && material<113.5) || (material>179.5 && material<195.5);
}
fn isGalaxyPortrait() -> bool { return galaxyPortraitMaterial(f.style.w); }
fn isGalaxyMaterial() -> bool {
  return isGalaxyPortrait() || abs(f.style.w-6.0)<.5 || abs(f.style.w-28.0)<.5;
}
fn galaxyMaterialIndex(material:f32) -> u32 {
  if(material>179.5) {return u32(round(material))-172u;}
  return u32(round(material))-106u;
}
fn galaxyPortraitIndex() -> u32 { return galaxyMaterialIndex(f.style.w); }
fn galaxyEllipsoid(p:vec3f,center:vec3f,inverse:vec3f) -> f32 {
  let q=(p-center)*inverse;return exp(-dot(q,q));
}
fn galaxyTidalCurve(t:f32,side:f32,single:bool) -> vec3f {
  if(single) {return vec3f(-1.1+3.0*t,.11*sin(t*3.14159265),.3*sin(t*3.14159265)-.18*t);}
  return vec3f(side*(.45+1.43*t),.14*sin(t*3.14159265),side*(.3+.9*sin(t*2.57610598)));
}
fn galaxyTidalField(p:vec3f,side:f32,single:bool) -> f32 {
  let t=clamp(select((side*p.x-.45)/1.43,(p.x+1.1)/3.0,single),0.0,1.0);
  let q=(p-galaxyTidalCurve(t,side,single))/vec3f(.09,.10,.105);
  return exp(-dot(q,q))*(1.0-smoothstep(.86,1.0,t));
}
fn galaxyExplorationField(p:vec3f,k:u32,texture:f32,granules:f32,coarse:f32,mid:f32) -> vec4f {
  let r=length(p.xz);let angle=atan2(p.z,p.x);
  let envelope=1.0-smoothstep(1.68,2.30,r);
  var stars=0.0;var old=0.0;var dust=0.0;var gas=0.0;
  if(k<=5u || k==11u) {
    let profile=GALAXY_PORTRAIT_PARAMETERS[k+8u];
    let base=max(.4,profile.z);let twist=log(max(r,.12)/base);
    var wave=max(0.0,.5+.5*cos((angle-twist*profile.y)*max(2.0,profile.x)+(coarse-.5)*.38));
    if(k==11u) {wave=max(pow(max(0.0,.5+.5*cos(angle-twist*1.1)),8.0),pow(max(0.0,.5+.5*cos(angle-3.14159265-twist*2.9)),8.0));}
    let arm=pow(wave,4.0)*select(1.0,smoothstep(profile.z*.68,profile.z*1.07,r),profile.z>.01);
    let skew=1.0+profile.w*cos(angle-.7)*r*.3;
    let warp=p.y-sin(angle*2.0)*r*.025-(coarse-.5)*.075;
    let disc=exp(-warp*warp*80.0)*exp(-r*.62)*envelope;
    let bar=select(0.0,exp(-p.y*p.y*100.0-p.z*p.z*65.0)*(1.0-smoothstep(profile.z*.72,max(.01,profile.z*1.08),abs(p.x))),profile.z>.01);
    let fragmented=select(1.0,.25+smoothstep(.35,.67,coarse*.4+mid*.6)*1.2,k==5u);
    stars=disc*(.075+arm*1.8)*skew*granules*fragmented+bar*.55;
    old=galaxyEllipsoid(p,vec3f(0.0),vec3f(4.1,5.0,4.1))*.95+bar*.75;
    let lane=pow(max(0.0,.5+.5*cos((angle-twist*max(1.1,profile.y))*max(2.0,profile.x)+.50)),12.0);
    dust=(disc*lane*(.2+texture)*skew+bar*.18)*select(1.0,2.1,k==4u);
    let starForming=pow(smoothstep(.37,.73,coarse*.4+mid*.6),2.0);
    gas=disc*arm*starForming*3.0*fragmented+bar*starForming*select(.4,2.1,k==3u);
    if(k==4u) {gas+=disc*starForming*1.7;}
  } else if(k<=8u) {
    let a=galaxyEllipsoid(p,vec3f(-.7,0.0,-.4),vec3f(2.4,5.0,2.2));
    let b=galaxyEllipsoid(p,vec3f(.45,.08,.35),vec3f(2.6,4.8,2.1));
    let c=galaxyEllipsoid(p,vec3f(.65,-.05,-.5),vec3f(3.0,5.2,2.6));
    var knots=a*.95+b*.9+c*.6;
    var bar=galaxyEllipsoid(p,vec3f(0.0),vec3f(1.2,6.0,4.2));
    if(k==7u) {
      bar=galaxyEllipsoid(p,vec3f(-.3,0.0,.15),vec3f(1.15,6.0,5.0));
      let open=exp(-pow((r-1.15)/.30,2.0))*exp(-p.y*p.y*55.0)*smoothstep(-.5,.8,sin(angle));
      knots=knots*.65+open*.55;
    }
    if(k==8u) {
      bar=galaxyEllipsoid(p,vec3f(-.2,0.0,-.12),vec3f(1.4,6.0,4.2));
      knots=galaxyEllipsoid(p,vec3f(1.05,.04,.38),vec3f(1.9,5.3,3.1))+a*.45;
    }
    stars=(knots*.8+bar*.32)*granules;old=bar*.45;
    dust=(knots*.9+bar*.35)*texture;
    gas=knots*(.20+smoothstep(.37,.70,mid)*1.5)*select(1.1,1.8,k==6u);
  } else if(k==9u || k==15u) {
    let single=k==15u;
    let coreA=select(vec3f(-.5,0.0,-.18),vec3f(-1.1,0.0,0.0),single);
    let coreB=vec3f(.45,.08,.3);
    let a=galaxyEllipsoid(p,coreA,vec3f(2.3,5.0,2.4));
    let b=select(galaxyEllipsoid(p,coreB,vec3f(2.4,5.0,2.2)),0.0,single);
    let tails=galaxyTidalField(p,1.0,single)+select(galaxyTidalField(p,-1.0,false),0.0,single);
    let overlap=select(galaxyEllipsoid(p,vec3f(0.0,0.0,.06),vec3f(3.0,6.0,3.0)),0.0,single);
    stars=((a+b)*.65+tails*1.3)*granules;
    old=(galaxyEllipsoid(p,coreA,vec3f(5.3,6.0,5.3))+select(galaxyEllipsoid(p,coreB,vec3f(5.3,6.0,5.3)),0.0,single))*1.25;
    dust=((a+b)*.8+overlap*1.2+tails*.25)*texture;
    gas=((a+b)*.6+overlap*2.0+tails*.75)*smoothstep(.34,.72,mid);
  } else if(k==10u) {
    let q=p-vec3f(-.25,0.0,-.05);let a=atan2(q.z,q.x);
    let arc=exp(-pow((length(q.xz)-.88)/.16,2.0))*exp(-p.y*p.y*75.0)*smoothstep(.25,.55,a+3.14159265)*(1.0-smoothstep(2.0,2.55,a));
    let head=galaxyEllipsoid(p,vec3f(-.8,0.0,-.5),vec3f(2.7,5.0,2.7));
    let egg=galaxyEllipsoid(p,vec3f(.96,.08,.75),vec3f(3.8,3.6,3.8));
    stars=(arc*1.6+head*.4)*granules;old=egg*1.7+head*.65;
    dust=(arc*.9+head*.55)*texture;gas=(arc*.9+head*.45)*smoothstep(.38,.72,mid);
  } else if(k==12u) {
    let q=p*vec3f(1.0,1.15,.95);let rho=length(q);
    let shell=exp(-pow((rho-.74)/.038,2.0))+exp(-pow((rho-1.14)/.042,2.0))*.65+exp(-pow((rho-1.63)/.044,2.0))*.45+exp(-pow((rho-2.06)/.047,2.0))*.30;
    let arc=.18+.82*smoothstep(-.4,.5,sin(atan2(p.z,p.x)*1.7+rho*2.3+p.y));
    old=galaxyEllipsoid(p,vec3f(0.0),vec3f(2.0,2.7,2.0))*1.7+shell*arc*.12;
  } else if(k==13u) {
    let ring=exp(-pow((r-1.55)/.13,2.0))*exp(-p.y*p.y*105.0);
    old=galaxyEllipsoid(p,vec3f(0.0),vec3f(4.5,5.5,4.5))*1.7;
    stars=ring*granules*1.65;dust=ring*texture*.55;gas=ring*(.15+smoothstep(.40,.72,mid)*.85);
  } else {
    let polarAngle=atan2(p.y,p.x);let polarR=length(p.xy);
    let ring=exp(-pow((polarR-1.48)/.14,2.0))*exp(-pow((p.z-.11*sin(polarAngle*3.0))*9.0,2.0));
    let inner=exp(-p.y*p.y*150.0)*exp(-r*r*3.8);
    old=inner*.85+galaxyEllipsoid(p,vec3f(0.0),vec3f(6.0,6.0,6.0))*.8;
    stars=ring*granules*1.7;dust=ring*texture*.65;gas=ring*(.16+smoothstep(.37,.71,mid)*1.3);
  }
  return vec4f(stars,old,dust,gas);
}

// Portrait families share a bounded volume, filtered two-tier structure and
// finite local lights. All shapes and internal coordinates are authored.
fn galaxyNoise(p:vec3f) -> f32 {
  return volumeNoise3(p);
}
fn galaxyCoreClearingFor(p:vec3f,field:vec4f,material:f32) -> vec4f {
  if(!galaxyPortraitMaterial(material)) {return field;}
  let k=galaxyMaterialIndex(material);
  if(k!=4u && k!=14u && k!=15u && k!=16u && k!=17u) {return field;}
  // Authored overlapping clearings give an internal observer a foreground
  // opening and actual cloud walls. They belong to the same density at both
  // LODs, and to the light's finite extinction column as well as emission.
  let a=galaxyEllipsoid(p,vec3f(.04,0.0,.11),vec3f(4.0,5.4,3.7));
  let b=galaxyEllipsoid(p,vec3f(-.20,.025,-.15),vec3f(5.0,7.0,4.0));
  let remaining=smoothstep(.08,.50,1.0-max(a,b));
  return vec4f(field.xy,field.z*remaining,field.w*remaining);
}

fn galaxyCloudBanksFor(p:vec3f,field:vec4f,coarse:f32,mid:f32,fine:f32,close:f32,footprint:f32,material:f32) -> vec4f {
  let shaped=galaxyCoreClearingFor(p,field,material);
  if(close<.001 || shaped.z+shaped.w<.00001) {return shaped;}
  // Curved, overlapping sheets break the macro cloud into banks, narrow
  // fronts and empty channels. The fine layer stays attached to that mass,
  // and vanishes when the ray footprint cannot resolve it.
  let resolved=close;
  let filtered=1.0-smoothstep(.045,.20,footprint);
  let flow=p+vec3f(sin(p.z*2.4)*.12,(coarse-.5)*.045,sin(p.x*2.1)*.12);
  let broad=galaxyNoise(flow*vec3f(6.0,9.0,6.0)+vec3f(14.3,7.8,2.4));
  let sheets=mix(.5,galaxyNoise(flow*vec3f(14.0,8.0,5.0)+vec3f(8.4,17.1,6.2)),filtered);
  let bank=smoothstep(.37,.65,broad*.55+coarse*.25+mid*.20);
  let channel=smoothstep(.27,.53,sheets*.72+broad*.28);
  let mass=bank*(.16+channel*.84);
  let front=4.0*bank*(1.0-bank)*smoothstep(.30,.62,sheets);
  // Warm old populations keep their own light; this adds no gas to an
  // ellipsoid, and far LOD retains exactly the original broad density.
  let dust=.018+mass*2.8;
  let gas=.004+mass*1.8+front*.32;
  return vec4f(shaped.xy,shaped.z*mix(1.0,dust,resolved),shaped.w*mix(1.0,gas,resolved));
}
fn galaxyPortraitFieldFor(p:vec3f,close:f32,footprint:f32,material:f32) -> vec4f {
  let k=galaxyMaterialIndex(material);
  let r=length(p.xz);let angle=atan2(p.z,p.x);
  let envelope=1.0-smoothstep(1.68,2.32,r);
  let coarse=galaxyNoise(p*vec3f(4.2,3.1,4.2)+vec3f(7.1,3.4,11.0));
  let mid=mix(.5,galaxyNoise(p*21.0+vec3f(17.0,6.0,1.0)),1.0-smoothstep(.04,.20,footprint));
  var fine=.5;
  let fineWeight=close*(1.0-smoothstep(.015,.065,footprint));
  if(fineWeight>.001) {fine=mix(.5,galaxyNoise(p*76.0+vec3f(1.0,19.0,3.0)),fineWeight);}
  let texture=.34+coarse*.42+mid*.24;
  let granules=.60+mid*.24+fine*.16;
  let height=p.y-sin(angle*2.0)*r*.018;
  let disc=exp(-height*height*72.0)*exp(-r*.70)*envelope;
  var stars=0.0;var bulge=0.0;var dust=0.0;var gas=0.0;
  if(k>=8u) {return galaxyCloudBanksFor(p,galaxyExplorationField(p,k-8u,texture,granules,coarse,mid),coarse,mid,fine,close,footprint,material);}
  if(k==0u || k==1u) {
    let barred=k==1u;
    let spiral=angle-log(max(r,select(.12,${GALAXY_PORTRAITS.barred.armBase.toFixed(2).replace(/^0/,'')},barred))/select(.4,${GALAXY_PORTRAITS.barred.armBase.toFixed(2).replace(/^0/,'')},barred))*select(1.6,1.8,barred);
    let wave=max(0.0,.5+.5*cos(spiral*2.0+(coarse-.5)*.45));
    let arm=wave*wave*wave*wave;
    let lane=pow(max(0.0,.5+.5*cos(spiral*2.0+.48)),12.0);
    let open=select(1.0,smoothstep(.66,1.0,r),barred);
    let bar=select(0.0,exp(-p.y*p.y*100.0-p.z*p.z*58.0)*(1.0-smoothstep(.67,1.0,abs(p.x))),barred);
    stars=disc*(.12+arm*1.9*open)*granules+bar*.92;
    bulge=exp(-dot(p*vec3f(3.8,5.0,3.8),p*vec3f(3.8,5.0,3.8)))*.95;
    dust=disc*lane*open*texture+bar*smoothstep(.10,.20,abs(p.z))*.15;
    gas=disc*arm*open*pow(smoothstep(.41,.74,coarse*.45+mid*.55),2.0)*3.4;
  } else if(k==2u) {
    let ring=exp(-pow((r-1.42)/.18,2.0))*exp(-p.y*p.y*185.0)*envelope;
    bulge=exp(-dot(p*vec3f(1.4,2.0,1.4),p*vec3f(1.4,2.0,1.4)))*1.8;
    stars=disc*.38*granules+ring*.22;
    dust=ring*texture*1.6;
    gas=ring*smoothstep(.57,.77,mid)*.45;
  } else if(k==3u || k==6u) {
    let ellipsoid=length(p*vec3f(1.0,1.47,1.22));
    bulge=exp(-ellipsoid*1.65)*(1.0-smoothstep(1.7,2.32,ellipsoid))*2.2;
    stars=bulge*mix(.12,.32,close)*granules;
    if(k==3u) {
      let warped=p.y-.15*sin(p.x*2.3)-.09*p.z;
      let belt=exp(-warped*warped*44.0)*exp(-dot(p.xz,p.xz)*.40)*envelope;
      dust=belt*(.18+coarse*coarse*.70+mid*.30)*2.3;
      gas=belt*pow(smoothstep(.46,.77,mid),2.0)*.8;
    }
  } else if(k==4u) {
    let core=exp(-dot(p*vec3f(.85,5.5,3.8),p*vec3f(.85,5.5,3.8)));
    let h=abs(p.y);let windR=length(p.xz*vec2f(.8,1.4));
    let cone=.11+h*.32+(coarse-.5)*.09;
    let filaments=pow(max(0.0,.5+.5*sin(atan2(p.z,p.x)*9.0+p.y*4.0+coarse*2.0)),2.0);
    // Fade inside the conservative volume instead of cutting the wind at
    // its intersection boundary; irregular stream walls retain an opening.
    let wind=exp(-pow((windR-cone)/(.065+h*.055),2.0))*exp(-h*.8)*smoothstep(.12,.38,h)*(1.0-smoothstep(.9,1.48,h))*(.14+filaments*.86);
    stars=core*(.7+mid*.45);bulge=core*.30;
    dust=core*(.30+coarse*coarse*.85)*1.8;
    gas=core*(.30+smoothstep(.48,.75,mid))*2.4+wind*texture*2.8;
  } else if(k==5u) {
    let thin=exp(-height*height*330.0)*exp(-r*.75)*envelope;
    stars=thin*(.35+mid*.32);
    bulge=exp(-dot(p*vec3f(3.8,4.4,3.8),p*vec3f(3.8,4.4,3.8)))*1.4;
    dust=thin*texture*1.4;
    gas=thin*smoothstep(.61,.80,mid)*.25;
  } else {
    let outerRadius=1.66+.035*sin(angle*5.0)+.025*sin(angle*9.0);
    let ring=exp(-pow((r-outerRadius)/.13,2.0))*exp(-p.y*p.y*125.0);
    let inner=exp(-pow((r-.34)/.09,2.0))*exp(-p.y*p.y*100.0);
    let spoke=pow(max(0.0,.5+.5*cos(angle*10.0-r*1.9)),12.0)*smoothstep(.38,.65,r)*(1.0-smoothstep(1.35,1.66,r));
    stars=(ring*1.5+inner*.8+disc*spoke*.35)*granules;
    bulge=exp(-dot(p*vec3f(6.0,7.0,6.0),p*vec3f(6.0,7.0,6.0)))*.7;
    dust=(ring*.45+inner*.7+disc*spoke*.35)*texture;
    gas=ring*(.30+smoothstep(.43,.68,mid)*1.6)+inner*mid*.8;
  }
  return galaxyCloudBanksFor(p,vec4f(stars,bulge,dust,gas),coarse,mid,fine,close,footprint,material);
}
fn galaxyBoundAxesFor(material:f32) -> vec3f {
  var height=.65;
  if(galaxyPortraitMaterial(material)) {height=GALAXY_PORTRAIT_HEIGHTS[galaxyMaterialIndex(material)];}
  return vec3f(1.0/2.35,1.0/height,1.0/2.35);
}
fn galaxyBoundAxes() -> vec3f { return galaxyBoundAxesFor(f.style.w); }

fn galaxyLightColourFor(field:vec4f,material:f32) -> vec3f {
  // Resolved lights and unresolved stellar populations share chromaticity.
  // Their energy remains separate from gas and its unchanged extinction.
  let young=vec3f(${GALAXY_STELLAR_COLOURS.young.join(',')})*.74;
  let old=vec3f(${GALAXY_STELLAR_COLOURS.old.join(',')})*.78;
  return young*field.x+old*field.y;
}
fn galaxyLightColour(field:vec4f) -> vec3f { return galaxyLightColourFor(field,f.style.w); }

fn galaxyGasColourFor(field:vec4f,material:f32) -> vec3f {
  if(material>109.5 && material<110.5) {return vec3f(1.4,.14,.24);}
  return mix(vec3f(1.10,.15,.35),vec3f(.20,.58,1.35),smoothstep(.25,1.65,field.w));
}

fn galaxyGasColour(field:vec4f) -> vec3f { return galaxyGasColourFor(field,f.style.w); }

// Ordinary galaxies read primarily as stellar populations, crossed by dark
// dust and local emission. The starburst wind keeps its existing gas strength.
// One policy is used at a distance and inside, without changing any density.
fn galaxyGasEmission(field:vec4f,material:f32,close:f32) -> vec3f {
  let wind=material>109.5 && material<110.5;
  let strength=select(mix(.14,.22,close),mix(.42,.65,close),wind);
  return galaxyGasColourFor(field,material)*field.w*strength;
}

fn galaxyRegionKernel(sigma:vec3f,blur:f32) -> vec4f {
  let variance=sigma*sigma;let filtered=variance+vec3f(blur);
  return vec4f(vec3f(1.0)/filtered,
    sqrt((variance.x*variance.y*variance.z)/(filtered.x*filtered.y*filtered.z)));
}
fn galaxyRegionKernelsFor(step:f32,material:f32) -> mat2x4f {
  let loose=material>27.5 && material<28.5;
  let blur=step*step/12.0;
  // Compute the two filtered kernels once per ray, shared by all regions/steps.
  return mat2x4f(galaxyRegionKernel(select(vec3f(.068,.052,.105),vec3f(.095,.065,.140),loose),blur),
    galaxyRegionKernel(select(vec3f(.082,.043,.070),vec3f(.115,.055,.095),loose),blur));
}
fn galaxyRegionKernels(step:f32) -> mat2x4f { return galaxyRegionKernelsFor(step,f.style.w); }

fn galaxyRegions(p:vec3f,kernels:mat2x4f,loose:bool) -> vec2f {
  var gas=0.0;var dust=0.0;
  for(var i=0u;i<${GALAXY_CLUSTER_COUNT}u;i++) {
    let recipe=select(GALAXY_COMPACT_CLUSTERS[i],GALAXY_LOOSE_CLUSTERS[i],loose);
    let delta=p.xz-recipe.xy;
    let radial=dot(delta,recipe.zw);
    let tangent=dot(delta,vec2f(-recipe.w,recipe.z));
    let height=p.y-select(-.025,.035,(i%2u)==0u);
    let local=vec3f(radial,height,tangent);
    let gasDistance=dot(local*local,kernels[0].xyz);
    let foreground=local-vec3f(.035,.028,.025);
    let dustDistance=dot(foreground*foreground,kernels[1].xyz);
    // An ionized cloud bank surrounds the lights instead of covering their centre.
    if(gasDistance<16.0) {
      gas+=exp(-gasDistance)*smoothstep(.12,1.10,gasDistance)*kernels[0].w*2.0;
    }
    if(dustDistance<16.0) { dust+=exp(-dustDistance)*kernels[1].w; }
  }
  return vec2f(gas,dust);
}
fn galaxyFieldFor(p: vec3f, close:f32, kernels:mat2x4f,footprint:f32,material:f32) -> vec4f {
  if(galaxyPortraitMaterial(material)) {return galaxyPortraitFieldFor(p,close,footprint,material);}
  let r = length(p.xz);
  let angle = atan2(p.z, p.x);
  let loose = material > 27.5 && material < 28.5;
  let spiral=angle-log(max(r,.12)/.4)*select(${galaxyWinding(false)},${galaxyWinding(true)},loose)+sin(r*8.0-angle*3.0)*select(.035,.085,loose);
  // Integer powers remain finite at an arm trough; a runtime pow exponent
  // can turn a zero/rounded-negative cosine base into NaN on Metal.
  let wave = max(0.0, 0.5 + 0.5 * cos(spiral * 2.0));
  let cube = wave * wave * wave;
  let arm = select(cube * wave * wave, cube, loose);
  let lane = pow(0.5 + 0.5 * cos(spiral * 2.0 + 0.5), 12.0);
  let envelope = (1.0 - smoothstep(1.75, 2.35, r));
  let height = p.y - sin(angle * 2.0) * r * 0.016;
  let disc = exp(-height * height * 52.0) * exp(-r * select(.8,.55,loose)) * envelope;
  let bulgeBound = select(exp(-dot(p * vec3f(2.8, 4.1, 3.1), p * vec3f(2.8, 4.1, 3.1))),0.0,loose);
  let dustBound = disc * lane * smoothstep(0.12, 0.48, r);
  // Positive noise factors stay at or below one. Empty disc samples need no
  // turbulence hashing; retain the same finite integration and moving field.
  if (disc * (0.32 + arm * 1.67) * 0.20 + bulgeBound * 0.84 + dustBound * 8.0 < 0.0001) { return vec4f(0.0); }
  let coarse = galaxyNoise(p * vec3f(5.0, 2.0, 5.0) + vec3f(3.1, 17.2, 8.0));
  let fine = mix(.5,galaxyNoise(p * vec3f(31.0,9.0,31.0) + vec3f(11.7, 5.4, 1.2)),close*(1.0-smoothstep(.025,.14,footprint)));
  let bulge = bulgeBound * (.22 + coarse * coarse * .78);
  let clusters=pow(smoothstep(.48,.77,fine),2.0)*arm;
  let stars=disc*(.32+arm*1.25+clusters*mix(.14,.72,close))*(.65+coarse*.35);
  var nuclearLane=0.0;
  if(bulgeBound>.0001) { nuclearLane=exp(-pow((p.y+sin(p.x*12.0+p.z*4.0)*.022)*15.0,2.0))*smoothstep(.36,.64,coarse); }
  let region=galaxyRegions(p,kernels,loose);
  let dust=disc*lane*smoothstep(.12,.48,r)*(.16+coarse*coarse*.60+fine*.24)+
    region.y*(.18+smoothstep(.32,.72,coarse*.65+fine*.35)*.82)*.38+
    bulgeBound*nuclearLane*.07;
  // Local nebular pockets belong to the same fixed star-cluster layout.
  // Their cloud banks survive the final approach instead of becoming generic fog.
  let nursery=region.x*select(2.4,3.6,loose)*(.12+smoothstep(.20,.78,coarse*.35+fine*.65)*.88);
  return galaxyCloudBanksFor(p,vec4f(stars,bulge,dust,nursery),coarse,coarse,fine,close,footprint,material);
}
fn galaxyField(p:vec3f,close:f32,kernels:mat2x4f,footprint:f32) -> vec4f {
  return galaxyFieldFor(p,close,kernels,footprint,f.style.w);
}
// An authored photographic response for limited angular resolution. The
// same function serves distant volumes, selected volumes and their lights.
// It changes neither geometry nor opacity/picking; tiny structures stay
// subordinate to the surrounding star field until actually resolved.
fn galaxyResolutionResponse(radiusPixels:f32) -> f32 {
  return mix(.24,1.0,smoothstep(7.0,34.0,radiusPixels));
}
fn galaxyResolvedLight(light:vec3f,response:f32) -> vec3f {
  let luminance=dot(light,vec3f(.2126,.7152,.0722));
  return mix(vec3f(luminance),light,mix(.42,1.0,response))*response;
}
fn galaxyViewResponse(center:vec3f) -> f32 {
  return galaxyResolutionResponse(f.viewport.w/(2.0*f.right.w*max(length(center),.000001)));
}
// Whole distant galaxies use the same world extent and material as arrival.
// Eight samples suffice for their small projected areas; near detail belongs
// to the single selected volume. No new catalogue or decorative galaxies.
fn galaxyDistantFragment(center:vec3f,ray:vec3f,material:f32,orientation:vec4f) -> vec4f {
  let c=galaxyMotionPointFor(center,orientation);let d=galaxyMotionPointFor(ray,orientation);
  let axes=galaxyBoundAxesFor(material);let e=c*axes;let v=d*axes;
  let a=dot(v,v);let b=dot(e,v);let discriminant=b*b-a*(dot(e,e)-1.0);
  if(discriminant<=0.0) {return vec4f(0.0);}
  let chord=sqrt(discriminant);let start=max(0.0,(b-chord)/a);let end=(b+chord)/a;
  if(end<=start) {return vec4f(0.0);}
  let step=(end-start)/8.0;
  let pixel=length(center)*2.0*f.right.w*max(f.up.w/f.viewport.z,1.0/f.viewport.w);
  let footprint=max(step,pixel);let kernels=galaxyRegionKernelsFor(footprint,material);
  var transmission=1.0;var light=vec3f(0.0);
  for(var i=0u;i<8u;i+=1u) {
    let p=d*(start+(f32(i)+.5)*step)-c;
    let field=galaxyFieldFor(p,0.0,kernels,footprint,material);
    let extinction=field.x*.20+field.y*.28+field.z*8.0+field.w*.18;
    let alpha=1.0-exp(-extinction*step);
    let emission=galaxyLightColourFor(field,material)+galaxyGasEmission(field,material,0.0);
    light+=transmission*alpha*emission/max(extinction,.001);
    transmission*=1.0-alpha;
  }
  return vec4f(galaxyResolvedLight(light,galaxyViewResponse(center)),1.0-transmission);
}
// The column ends at the light, not the far side of the galaxy. Nearby
// clusters therefore retain depth while distant lights sit behind dark lanes.
fn galaxyLightTransmissionFor(relative:vec3f,centerRelative:vec3f,worldRadius:f32,profileMaterial:f32,close:f32,orientation:vec4f) -> f32 {
  let pathLength=length(relative)/worldRadius;
  let ray=galaxyMotionPointFor(normalize(relative),orientation);
  let center=galaxyMotionPointFor(centerRelative/worldRadius,orientation);
  let axes=galaxyBoundAxesFor(profileMaterial);
  let e=center*axes;let v=ray*axes;let a=dot(v,v);let b=dot(e,v);
  let discriminant=b*b-a*(dot(e,e)-1.0);
  if(discriminant<=0.0) { return 1.0; }
  let chord=sqrt(discriminant);
  let start=max(0.0,(b-chord)/a);let end=min(pathLength,(b+chord)/a);
  if(end<=start) { return 1.0; }
  let count=select(6u,8u,f.quality.y>3.5);let step=(end-start)/f32(count);
  let kernels=galaxyRegionKernelsFor(step,profileMaterial);
  var column=0.0;
  for(var i=0u;i<8u;i++) {
    if(i>=count) { break; }
    let field=galaxyFieldFor(ray*(start+(f32(i)+.5)*step)-center,close,kernels,step,profileMaterial);
    column+=(field.x*.20+field.y*.28+field.z*8.0+field.w*.18)*step;
  }
  return exp(-column);
}
fn galaxyLightTransmission(relative:vec3f) -> f32 {
  return galaxyLightTransmissionFor(relative,f.localStar.xyz,f.focus.w,f.style.w,volumeNearDetail(),f.rings);
}
`;

export const GALAXY_MATERIAL_WGSL = GALAXY_FIELD_WGSL + /* wgsl */ `
// Illumination follows the existing authored stellar populations. It adds
// no light point or identity, and lives in the same intrinsic galaxy frame.
fn galaxyCloudLightCentre(p:vec3f) -> vec3f {
  if(!isGalaxyPortrait()) {
    let loose=f.style.w>27.5 && f.style.w<28.5;
    var source=vec3f(0.0);var total=0.0;
    for(var i=0u;i<${GALAXY_CLUSTER_COUNT}u;i++) {
      let recipe=select(GALAXY_COMPACT_CLUSTERS[i],GALAXY_LOOSE_CLUSTERS[i],loose);
      let centre=vec3f(recipe.x,select(-.025,.035,(i%2u)==0u),recipe.y);
      let delta=p-centre;let distance=dot(delta,delta);
      let weight=1.0/pow(.04+distance,2.0);source+=centre*weight;total+=weight;
    }
    return source/max(total,.000001);
  }
  let k=galaxyPortraitIndex();
  if(k==17u || k==18u) {
    let a=select(vec3f(-.5,0.0,-.18),vec3f(-.8,0.0,-.5),k==18u);
    let b=select(vec3f(.45,.08,.3),vec3f(.96,.08,.75),k==18u);
    let wa=1.0/pow(.04+dot(p-a,p-a),2.0);let wb=1.0/pow(.04+dot(p-b,p-b),2.0);
    return (a*wa+b*wb)/(wa+wb);
  }
  if(k==23u) {return vec3f(-1.1,0.0,0.0);}
  if(k==15u) {return vec3f(-.3,0.0,.15);}
  if(k==16u) {return vec3f(-.2,0.0,-.12);}
  return vec3f(0.0);
}

fn galaxyFragment(center: vec3f, ray: vec3f) -> vec4f {
  let c = galaxyPoint(center);
  let d = galaxyPoint(ray);
  let axes = galaxyBoundAxes();
  let e = c * axes;
  let v = d * axes;
  let a = dot(v, v);
  let b = dot(e, v);
  let discriminant = b * b - a * (dot(e, e) - 1.0);
  if (discriminant <= 0.0) { discard; }
  let halfChord = sqrt(discriminant);
  let start = max(0.0, (b - halfChord) / a);
  let end = (b + halfChord) / a;
  if (end <= start) { discard; }
  let close=volumeNearDetail();
  let samples=clamp(u32(mix(f.quality.x*.75,f.quality.x,close)),10u,32u);
  let total=end-start;
  // A bounded near segment resolves the cloud banks closest to an internal
  // observer. The remaining samples still cover the complete visible chord.
  let nearCount=samples/2u;let farCount=samples-nearCount;
  let frontDetail=close*(1.0-smoothstep(.10,.65,start));
  let nearLength=mix(total*f32(nearCount)/f32(samples),min(.30,total*.35),frontDetail);
  let nearStep=nearLength/f32(nearCount);let farStep=(total-nearLength)/f32(farCount);
  let nearKernels=galaxyRegionKernels(nearStep);let farKernels=galaxyRegionKernels(farStep);
  // Fixed screen-sample decorrelation removes integration contour bands without
  // more ray samples or animation noise; pause keeps this sampling stable.
  let offset=mix(.5,stellarNoise3(ray*37.0),.18);
  var transmission = 1.0;
  var radiance = vec3f(0.0);
  // Close views resolve the finite local star field instead of enlarging a
  // continuous photographic glow across the entire viewport.
  let nearContinuum=select(.22,.025,isGalaxyPortrait());
  let continuum=mix(nearContinuum,1.0,smoothstep(.8,3.2,f.eye.w/f.focus.w));
  for (var i = 0u; i < 32u; i++) {
    if (i >= samples) { break; }
    let first=i<nearCount;
    let step=select(farStep,nearStep,first);
    let distance=select(start+nearLength+(f32(max(i,nearCount)-nearCount)+offset)*farStep,start+(f32(i)+offset)*nearStep,first);
    let p=d*distance-c;
    let pixelWidth=2.0*f.right.w*distance/max(1.0,f.quality.w);
    var kernels=farKernels;if(first) {kernels=nearKernels;}
    let field = galaxyField(p,close,kernels,max(step,pixelWidth));
    let stars=galaxyLightColour(field);
    var illumination=1.0;
    let lightingDetail=close*(1.0-smoothstep(.20,.50,max(step,pixelWidth)));
    if(lightingDetail>.001 && field.w>.00001) {
      let delta=galaxyCloudLightCentre(p)-p;let direction=delta/max(length(delta),.000001);
      let neighbour=galaxyField(p+direction*.10,close,kernels,max(step,pixelWidth));
      illumination=mix(1.0,volumeCloudIllumination(field.w*.8+field.z*8.0,neighbour.w*.8+neighbour.z*8.0,.10),lightingDetail);
    }
    let emission=stars*continuum+galaxyGasEmission(field,f.style.w,close)*illumination;
    let extinction = field.x * 0.20 + field.y * 0.28 + field.z * 8.0 + field.w*.18;
    let alpha = 1.0 - exp(-extinction * step);
    radiance += transmission * alpha * emission / max(extinction, 0.001);
    transmission *= 1.0 - alpha;
  }
  let resolved = smoothstep(0.55, 3.5, f.presentation.x);
  return vec4f(galaxyResolvedLight(radiance,galaxyViewResponse(center)) * resolved, (1.0 - transmission) * resolved);
}
`;
