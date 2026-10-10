// Reflected sunlight, object-space geography, and a single geometric ring plane.
// The unresolved approximation uses the same Sun/view angle as the sphere.
// Lambert phase reference: Seager, Whitney & Sasselov (2000), Eq. 3:
// https://lweb.cfa.harvard.edu/~sasselov/exopl/p2.pdf
// Exposure, albedo and spatial scales here remain artistic, not photometry.
export const REFLECTED_LIGHT_WGSL = /* wgsl */ `
fn reflectedPhase(sunlight:vec3f,view:vec3f)->f32 {
  let cosine=clamp(dot(sunlight,view),-1.0,1.0);
  let angle=acos(cosine);
  return max(0.0,(sqrt(max(0.0,1.0-cosine*cosine))+(3.14159265-angle)*cosine)/3.14159265);
}
// Central map differences are converted to a spherical footprint. Bounded
// slopes prevent polar amplification and baked mosaic contrast from becoming
// deep invented relief. Strength is an artistic shading scale, not altitude.
fn mappedReliefNormal(p:vec3f,difference:vec2f,footprint:vec2f,strength:f32)->vec3f {
  let latitude=max(length(p.xz),.08);
  let east=vec3f(-p.z,0,p.x)/latitude;
  let south=cross(p,east);
  let slope=difference*strength/max(footprint*vec2f(12.5663706*latitude,6.2831853),vec2f(.00001));
  let bounded=slope/max(1.0,length(slope)/.22);
  let polar=smoothstep(.03,.12,length(p.xz));
  return normalize(p-(east*bounded.x+south*bounded.y)*polar);
}
fn mappedTerrainNormal(map:texture_2d<f32>,p:vec3f,uv:vec2f,level:f32,weights:vec3f,strength:vec2f,near:f32)->vec3f {
  // Wide relief remains present while a separately filtered local slope joins
  // nearby. Albedo-derived slopes remain shading cues, never height data.
  let broadLevel=max(level,2.2);
  let broadStep=exp2(broadLevel)/vec2f(textureDimensions(map));
  let broadU=dot(textureSampleLevel(map,surfaceSampler,uv+vec2f(broadStep.x,0),broadLevel).rgb-textureSampleLevel(map,surfaceSampler,uv-vec2f(broadStep.x,0),broadLevel).rgb,weights);
  let broadV=dot(textureSampleLevel(map,surfaceSampler,uv+vec2f(0,broadStep.y),broadLevel).rgb-textureSampleLevel(map,surfaceSampler,uv-vec2f(0,broadStep.y),broadLevel).rgb,weights);
  var result=mappedReliefNormal(p,vec2f(broadU,broadV),broadStep,strength.x);
  if(near>0.0) {
    let fineLevel=max(level,.6);
    let step=exp2(fineLevel)/vec2f(textureDimensions(map));
    let du=dot(textureSampleLevel(map,surfaceSampler,uv+vec2f(step.x,0),fineLevel).rgb-textureSampleLevel(map,surfaceSampler,uv-vec2f(step.x,0),fineLevel).rgb,weights);
    let dv=dot(textureSampleLevel(map,surfaceSampler,uv+vec2f(0,step.y),fineLevel).rgb-textureSampleLevel(map,surfaceSampler,uv-vec2f(0,step.y),fineLevel).rgb,weights);
    result=normalize(result+mappedReliefNormal(p,vec2f(du,dv),step,strength.y*near)-p);
  }
  return result;
}
fn reflectedSurfaceLight(normal:vec3f,detailNormal:vec3f,sunlight:vec3f)->f32 {
  // Relief modulates the lit hemisphere; it cannot illuminate the far night side.
  let horizon=smoothstep(0.0,0.035,dot(normal,sunlight));
  return max(dot(detailNormal,sunlight),0.0)*horizon;
}
`;

import { URANUS_RING_BANDS, RING_CAMERA_FADE } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
const iceRingBands = URANUS_RING_BANDS.map(band => `vec2f(${band.join(',')})`).join(',');

// One material context for the selected world and every finite visible neighbour.
// Pixel footprints and each body's own pose/light choose detail; selection is irrelevant.
export const BODY_MATERIAL_WGSL = /* wgsl */ `
struct BodyMaterial {
  material:f32,
  tilt:f32,
  spin:f32,
  seed:f32,
  light:vec3f,
  pixels:f32,
  rings:vec4f,
  raster:f32,
  near:f32,
  inspection:f32,
  sunVisibility:f32,
  lightColor:vec3f,
  albedo:vec3f,
};
fn bodyMaterial(material:f32,tilt:f32,seed:f32,light:vec3f,rings:vec4f,pixels:f32,distance:f32,albedo:vec3f)->BodyMaterial {
  let raster=pixels*min(f.viewport.z/f.viewport.x,f.viewport.w/f.viewport.y);
  let near=(1.0-smoothstep(3.6,6.5,distance))*smoothstep(42.0,135.0,raster);
  let inspection=(1.0-smoothstep(1.9,2.8,distance))*smoothstep(120.0,260.0,raster);
  return BodyMaterial(material,tilt,f.presentation.z,seed,light,pixels,rings,raster,near,inspection,1.0,vec3f(1.0),albedo);
}
fn observedBodyMaterial()->BodyMaterial {
  var b=bodyMaterial(f.style.w,f.light.w,f.star.w,f.light.xyz,f.rings,f.presentation.x,f.eye.w/f.focus.w,f.star.rgb);
  b.lightColor=f.illuminant.rgb;
  return b;
}
`;

export const PLANET_MATERIAL_WGSL = /* wgsl */ `
fn planetRotateX(p:vec3f, angle:f32)->vec3f {
  let c=cos(angle); let s=sin(angle);
  return vec3f(p.x,c*p.y-s*p.z,s*p.y+c*p.z);
}
fn planetRingNormal(b:BodyMaterial)->vec3f { return vec3f(0.0,cos(b.tilt),sin(b.tilt)); }
const ICE_RING_BANDS = array<vec2f, ${URANUS_RING_BANDS.length}>(${iceRingBands});
fn planetRingCoverage(radius:f32,b:BodyMaterial)->f32 {
  if(b.material>12.5 && b.material<14.5) {
    // Pixel-wide feather stays inside the shared physical band, never fills gaps.
    let width=min(0.006,0.7/max(b.raster,1.0));
    var coverage=0.0;
    for(var i=0u;i<${URANUS_RING_BANDS.length}u;i++) {
      let band=ICE_RING_BANDS[i];
      coverage+=smoothstep(band.x,band.x+width,radius)*(1.0-smoothstep(band.y-width,band.y,radius));
    }
    return min(1.0,coverage);
  }
  if(b.material>64.5) {
    let width=min(0.008,0.7/max(b.raster,1.0));
    let edge=smoothstep(b.rings.x,b.rings.x+width,radius)*(1.0-smoothstep(b.rings.y-width,b.rings.y,radius));
    let gap=smoothstep(b.rings.z-width,b.rings.z,radius)*(1.0-smoothstep(b.rings.w,b.rings.w+width,radius));
    return edge*(1.0-gap);
  }
  let edge=smoothstep(b.rings.x,b.rings.x+0.025,radius)*(1.0-smoothstep(b.rings.y-0.025,b.rings.y,radius));
  let division=smoothstep(b.rings.z-0.012,b.rings.z+0.006,radius)*(1.0-smoothstep(b.rings.w-0.006,b.rings.w+0.012,radius));
  return edge*(1.0-division);
}
fn planetRingShadow(point:vec3f,b:BodyMaterial)->f32 {
  let normal=planetRingNormal(b);
  let denominator=dot(b.light,normal);
  if (abs(denominator)<0.0001) { return 1.0; }
  let distance=-dot(point,normal)/denominator;
  if (distance<=0.0) { return 1.0; }
  return 1.0-planetRingCoverage(length(point+b.light*distance),b)*0.72;
}
fn earthCloudOpacity(normal:vec3f,b:BodyMaterial)->f32 {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin+f.forward.w*0.0016);
  let uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.0005,0.9995));
  let level=max(0.0,log2(f32(textureDimensions(earthClouds).x)/max(b.raster*5.0,1.0)));
  let coverage=textureSampleLevel(earthClouds,surfaceSampler,uv,level).r;
  return pow(coverage,1.25)*0.84;
}
fn earthCloudNormal(normal:vec3f,b:BodyMaterial)->vec3f {
  if(b.near<=0.0) {return normal;}
  let phase=b.spin+f.forward.w*.0016;
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),phase);
  let uv=vec2f(atan2(p.z,p.x)/6.2831853+.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,.0005,.9995));
  let level=max(1.2,log2(f32(textureDimensions(earthClouds).x)/max(b.raster*4.0,1.0)));
  let step=exp2(level)/vec2f(textureDimensions(earthClouds));
  // Historical opacity supplies a bounded cloud-edge shading cue. It does not
  // define measured cloud altitude or introduce a second weather map.
  let du=textureSampleLevel(earthClouds,surfaceSampler,uv+vec2f(step.x,0),level).r-textureSampleLevel(earthClouds,surfaceSampler,uv-vec2f(step.x,0),level).r;
  let dv=textureSampleLevel(earthClouds,surfaceSampler,uv+vec2f(0,step.y),level).r-textureSampleLevel(earthClouds,surfaceSampler,uv-vec2f(0,step.y),level).r;
  let relief=mappedReliefNormal(p,vec2f(du,dv),step,.004*b.near);
  return planetRotateX(stellarRotateY(relief,-phase),b.tilt);
}
// Unmeasured exoplanet worlds use authored object-space fields, never a Solar map.
// Wide geology survives at both LODs; only resolvable slopes join close inspection.
fn extremeRockSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let footprint=b.raster*sqrt(max(dot(normal,-ray),.025));
  let geology=authoredGeology(p,b.seed,footprint,b.near,0.0,b.inspection);
  let broad=stellarNoiseGradient(p*3.4+vec3f(b.seed*19.0,8.3,2.1));
  let middle=stellarNoiseGradient(p*15.0+vec3f(3.8,b.seed*17.0,9.4));
  var grain=vec4f(0.0);
  let detailPresence=b.near*smoothstep(75.0,160.0,footprint);
  if(detailPresence>0.0) {grain=stellarNoiseGradient(p*62.0+vec3f(4.3,11.7,b.seed*23.0));}
  let slope=geology.slope+broad.xyz*.035+middle.xyz*.025+grain.xyz*.015*detailPresence;
  let tangent=slope-p*dot(p,slope);
  let localNormal=normalize(p-tangent/max(1.0,length(tangent)/.23));
  let detail=planetRotateX(stellarRotateY(localNormal,-b.spin),b.tilt);
  let plain=smoothstep(.36,.64,broad.w+.11*sin(p.x*5.0+p.z*3.0));
  var albedo=b.albedo*mix(.32,1.0,geology.region)*(1.0+geology.tone*.65);
  if(b.material>129.5) {
    // Broad lava plains are dark cooled rock, not luminous oceans.
    albedo=mix(albedo,b.albedo*.32,plain*.77);
    albedo*=1.0+(middle.w-.5)*.16+(grain.w-.5)*.06*detailPresence;
    return regolithRadiance(albedo,normal,detail,ray,b.light,1.0,.87);
  }
  let heated=smoothstep(-.45,.75,dot(normal,b.light));
  let edge=broad.w+.13*sin(p.x*4.0+p.z*3.1)+(middle.w-.5)*.15+heated*.07;
  let melt=smoothstep(.595,.645,edge);
  let cooling=smoothstep(.555,.595,edge)*(1.0-smoothstep(.605,.655,edge));
  let reflected=regolithRadiance(albedo*(1.0-melt*.82)*.54,normal,detail,ray,b.light,1.0,.83);
  let hot=mix(vec3f(.18,.009,.001),vec3f(.82,.18,.012),smoothstep(.58,.83,edge));
  let folds=sin(p.x*31.0+middle.w*7.0)*sin(p.z*27.0-broad.w*5.0);
  let texture=1.0+(middle.w-.5)*.34+folds*.10*detailPresence+(grain.w-.5)*.14*detailPresence;
  let emission=hot*melt*mix(.22,1.0,heated)*texture+vec3f(.14,.012,.001)*cooling;
  // The outer reflection tint must not recolour intrinsic thermal artwork.
  return reflected+emission/max(b.lightColor,vec3f(.38));
}
// Exoplanet cloud layers share the existing periodic volume cache. A close
// field adds billows within banks, rather than a second latitude map.
fn exoCloudTops(p:vec3f,stretch:vec3f,normal:vec3f,ray:vec3f,b:BodyMaterial)->CloudTops {
  return solarCloudTops(p,stretch,b.near,b,normal,ray);
}
fn exoCloudNormal(p:vec3f,flow:vec3f,tops:CloudTops,strength:f32,b:BodyMaterial)->vec3f {
  return planetRotateX(stellarRotateY(solarCloudNormal(p,flow,tops,strength),-b.spin),b.tilt);
}
fn extremeAtmosphereSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let time=f.forward.w*.006;
  let rotation=time*(.65+.5*cos(p.y*3.2));
  var flow=stellarRotateY(p,rotation);
  let small=b.material>133.5;
  let blue=b.material<131.5;
  let ultra=b.material>132.5 && !small;
  if(blue || ultra) {
    flow=solarCloudVortex(flow,vec2f(b.seed*5.0-2.5,.22),vec2f(.50,.28),1.5);
    flow=solarCloudVortex(flow,vec2f(1.7-b.seed*3.0,-.37),vec2f(.37,.22),-1.0);
  }
  if(small) {flow=solarCloudVortex(flow,vec2f(b.seed*3.0-1.5,.16),vec2f(.72,.42),1.1);}
  let tops=exoCloudTops(flow,vec3f(1.0,select(2.3,1.3,small),1.0),normal,ray,b);
  let frequency=select(select(8.0,11.0,blue),5.0,ultra);
  let wave=sin(flow.y*select(frequency,7.0,small)+(tops.broad-.5)*4.2+flow.x*1.7+(tops.billow-.5)*.30);
  let band=smoothstep(-.82,.84,wave);
  let bank=smoothstep(.22,.80,tops.billow);
  let fine=(tops.fine-.5)*(.045+.18*b.near);
  var dark=b.albedo*.30;var pale=mix(b.albedo,vec3f(.93,.86,.71),.25);
  if(blue) {dark=vec3f(.008,.025,.08);pale=vec3f(.18,.42,.68);}
  if(ultra) {dark=vec3f(.025,.008,.006);pale=vec3f(.46,.18,.07);}
  var albedo=mix(dark,pale,clamp(.12+band*.36+bank*.25+fine*(.35+bank*.65),0.0,1.0));
  if(small) {
    // Broad, soft veils provide visible atmospheric structure. Their local
    // billows belong to the same flow, with no invented ground below them.
    let veil=.48+.20*sin(flow.y*7.0+(tops.broad-.5)*4.5+flow.x*.7)+(tops.billow-.5)*(.15+.08*b.near);
    albedo=mix(b.albedo*vec3f(.60,.59,.57),mix(b.albedo,vec3f(.93,.91,.83),.55),clamp(veil,0.0,1.0));
    albedo*=1.0+(tops.fine-.5)*(.06+.24*b.near)*(.35+tops.crest*.65);
  }
  let detail=exoCloudNormal(p,flow,tops,select(1.0,.32,small),b);
  let light=solarCloudLight(normal,detail,b.light);
  let facing=max(dot(normal,-ray),0.0);
  var result=albedo*(.025+light*1.60);
  if(ultra) {
    let heated=smoothstep(-.30,.85,dot(normal,b.light));
    let emission=mix(vec3f(.035,.003,.001),vec3f(.63,.10,.012),heated)*(.22+bank*.18+band*.35);
    result+=emission/max(b.lightColor,vec3f(.38));
  }
  let haze=select(mix(b.albedo,vec3f(.77,.85,1),.25),vec3f(.14,.37,.83),blue);
  return result+haze*pow(1.0-facing,3.5)*smoothstep(-.1,.5,dot(normal,b.light))*.13;
}
// Infrared-inspired colour is explicitly artistic. These clouds have no
// measured geography, ground layer, new texture or additional volume pass.
fn youngAtmosphereSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let puff=b.material>136.5;
  let forming=b.material>135.5 && !puff;
  let rotation=f.forward.w*.004*(.7+.4*cos(p.y*3.0));
  var flow=stellarRotateY(p,rotation+sin(p.y*7.0)*.09);
  flow=solarCloudVortex(flow,vec2f(b.seed*4.0-2.0,.25),vec2f(.63,.39),select(1.5,.65,puff));
  flow=solarCloudVortex(flow,vec2f(1.3-b.seed*3.0,-.38),vec2f(.45,.27),-1.2);
  let tops=exoCloudTops(flow,vec3f(.8,select(1.8,.95,forming),.8),normal,ray,b);
  let broad=stellarNoiseGradient(flow*3.4+vec3f(b.seed*19.0,5.7,2.4));
  let banks=sin(flow.y*7.0+(broad.w-.5)*5.0+flow.x*.9)*.17+tops.broad*.55+tops.billow*.28;
  let edgeWidth=.035+1.2/max(b.raster,1.0);
  let cloud=smoothstep(.32-edgeWidth,.72+edgeWidth,banks+(tops.fine-.5)*.12*b.near);
  let facing=max(dot(normal,-ray),0.0);
  let detail=exoCloudNormal(p,flow,tops,select(.80,.24,puff),b);
  let light=solarCloudLight(normal,detail,b.light);
  if(puff) {
    // Lower contrast broad veils remain continuous at both scales. The close
    // folds are filtered by CloudTops; there is no invented solid surface.
    let veil=.44+(banks-.5)*.68+(tops.billow-.5)*.13+(tops.fine-.5)*(.05+.17*b.near);
    let albedo=mix(b.albedo*.54,mix(b.albedo,vec3f(.96,.93,.84),.58),clamp(veil,0.0,1.0));
    return albedo*(.036+light*1.24)+mix(b.albedo,vec3f(.9,.9,.92),.45)*pow(1.0-facing,2.5)*smoothstep(-.18,.6,dot(normal,b.light))*.18;
  }
  let fine=(tops.fine-.5)*(.06+.24*b.near)*sqrt(max(0.0,4.0*cloud*(1.0-cloud)));
  let lower=mix(b.albedo*.19,vec3f(.20,.15,.12),.28);
  let upper=mix(b.albedo,vec3f(.72,.67,.60),.46);
  let albedo=mix(lower,upper,clamp(cloud*.74+tops.billow*.14+fine,0.0,1.0));
  let reflection=albedo*(.025+light*1.18);
  // Thermal windows remain visible around the night side and share exactly
  // the cloud field. A cloud window is neither a hole in the opaque planet
  // nor an observed lava surface. No exposure or identity change at near LOD.
  let opening=1.0-smoothstep(.32,.59,banks);
  let heat=mix(vec3f(.085,.009,.002),vec3f(.49,.115,.019),clamp(broad.w+fine,0.0,1.0));
  let emission=heat*(.12+opening*select(.65,.88,forming))*(1.0-cloud*.30)*(.88+.12*facing);
  let rim=b.albedo*pow(1.0-facing,3.6)*smoothstep(-.1,.5,dot(normal,b.light))*.10;
  return reflection+emission/max(b.lightColor,vec3f(.38))+rim;
}
fn exoworldSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  if(b.material>134.5) {return youngAtmosphereSurface(normal,ray,b);}
  if(b.material>130.5) {return extremeAtmosphereSurface(normal,ray,b);}
  if(b.material>128.5) {return extremeRockSurface(normal,ray,b);}
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let offset=vec3f(b.seed*31.7,7.4,13.2);
  if(b.material>127.5) {
    let flow=stellarRotateY(p,f.forward.w*.006*(.7+.3*cos(p.y*4.0)));
    let tops=exoCloudTops(flow,vec3f(1.0,2.3,1.0),normal,ray,b);
    let wave=sin(flow.y*19.0+(tops.broad-.5)*3.6+flow.x*1.4);
    let bands=smoothstep(-.55,.65,wave);
    let filament=(tops.fine-.5)*(.10+b.near*.22);
    let albedo=mix(vec3f(.19,.095,.055),vec3f(.85,.53,.28),clamp(.20+bands*.43+tops.billow*.24+filament,0.0,1.0));
    let detail=exoCloudNormal(p,flow,tops,1.0,b);
    let light=reflectedSurfaceLight(normal,detail,b.light);
    let facing=max(dot(normal,-ray),0.0);
    return albedo*(.022+light*1.58)+vec3f(.46,.18,.055)*pow(1.0-facing,3.8)*smoothstep(-.06,.5,dot(normal,b.light))*.13;
  }
  let pale=b.material>126.5;
  let footprint=b.raster*sqrt(max(dot(normal,-ray),.025));
  let geology=authoredGeology(p,b.seed,footprint,b.near,select(0.0,1.0,pale),b.inspection);
  var slope=geology.slope;var basinTone=0.0;
  // Five wide, weathered basins and nineteen smaller impacts. Analytic floor,
  // wall and rim derivatives shade the same field at both detail levels.
  let erosion=stellarNoiseGradient(p*12.0+offset+vec3f(3.2,1.7,8.6));
  for(var i=0u;i<24u;i++) {
    let site=FRONTIER_CRATERS[i];let center=stellarRotateY(site.xyz,b.seed*9.7);
    let age=fract(f32(i)*.754877+b.seed);
    let radius=select(.030+age*.075,.22+age*.16,i<5u);
    let delta=p-center;let chord=max(length(delta),.0001);
    if(chord>radius*1.6) {continue;}
    // Weathering breaks perfect rings without evaluating noise per crater.
    let distance=max(.0001,chord+(erosion.w-.5)*radius*.20);
    let direction=delta/chord+erosion.xyz*(12.0*radius*.20);
    let resolved=smoothstep(2.0,5.0,radius*footprint);
    let wall=clamp((distance/radius-.32)/.57,0.0,1.0);
    let floor=1.0-wall*wall*(3.0-2.0*wall);
    let rimWidth=max(radius*mix(.10,.19,age),1.4/max(footprint,1.0));
    let q=(distance-radius)/rimWidth;let rim=exp(-q*q);
    let depth=select(.0045,.020,i<5u)*mix(.65,1.0,age);
    let derivative=depth*6.0*wall*(1.0-wall)/(.57*radius)-2.0*q*rim*depth*.32/rimWidth;
    slope+=direction*derivative*resolved;
    // Weathered rim rock and darker basin deposits remain legible under
    // front lighting, when a slope alone produces little contrast.
    basinTone+=(rim*.16-floor*.28+wall*(1.0-wall)*.13)*resolved*mix(.65,1.0,age);
  }
  let warm=mix(b.albedo*.39,b.albedo*1.06,geology.region);
  let ice=mix(b.albedo*vec3f(.36,.44,.51),mix(b.albedo,vec3f(.83,.87,.84),.40),geology.region);
  var albedo=select(warm,ice,pale);
  albedo*=clamp(1.0+geology.tone+basinTone,.65,1.20);
  let tangent=slope-p*dot(p,slope);
  let localNormal=normalize(p-tangent/max(1.0,length(tangent)/.30));
  let detail=planetRotateX(stellarRotateY(localNormal,-b.spin),b.tilt);
  return regolithRadiance(albedo,normal,detail,ray,b.light,1.0,select(.79,.64,pale));
}
fn planetSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  let sunlight=reflectedSurfaceLight(normal,normal,b.light);
  let facing=max(dot(normal,-ray),0.0);
  if (b.material>125.5 && b.material<137.5) {return exoworldSurface(normal,ray,b);}
  if (b.material>14.5) { return satelliteSurface(normal,ray,b); }
  if (b.material>10.5) { return solarSurface(normal,ray,b); }
  if (b.material>7.5 && b.material<8.5) { return jupiterSurface(normal,ray,b); }
  if (b.material>4.5) {
    let uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.0005,0.9995));
    let level=max(0.0,log2(f32(textureDimensions(marsMap).x)/max(b.raster*4.0,1.0)));
    let albedo=textureSampleLevel(marsMap,surfaceSampler,uv,level).rgb;
    var terrainNormal=normal;
    let near=b.near;
    let micro=rockMicroDetail(p,b);
    if(near>0.0) {
      // Map-derived relief is a shading illustration, not measured topography.
      let weights=vec3f(.2126,.7152,.0722);
      let relief=normalize(mappedTerrainNormal(marsMap,p,uv,level,weights,vec2f(.006,.006)*near,near)+micro.xyz*.28);
      terrainNormal=planetRotateX(stellarRotateY(relief,-b.spin),b.tilt);
    }
    let haze=pow(1.0-facing,3.8)*smoothstep(-0.10,0.60,dot(normal,b.light));
    return regolithRadiance(albedo*(1.0+micro.w*.045),normal,terrainNormal,ray,b.light,1.0,.68)+vec3f(0.26,0.12,0.045)*haze*0.24;
  }
  if (b.material>3.5) {
    let uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.002,0.998));
    let level=max(0.0,log2(f32(textureDimensions(moonMap).x)/max(b.raster*4.0,1.0)));
    let albedo=textureSampleLevel(moonMap,surfaceSampler,uv,level).rgb;
    let near=b.near;
    // The existing LOLA height field keeps its terrain across both LODs;
    // filtered broad slopes survive low resolution, finer slopes join nearby.
    let heightLevel=max(0.0,log2(f32(textureDimensions(moonHeight).x)/max(b.raster*4.0,1.0)));
    let micro=rockMicroDetail(p,b);
    let relief=normalize(mappedTerrainNormal(moonHeight,p,uv,heightLevel,vec3f(1,0,0),vec2f(.016,.012),near)+micro.xyz*.18);
    let worldNormal=planetRotateX(stellarRotateY(relief,-b.spin),b.tilt);
    return regolithRadiance(albedo*(1.0+micro.w*.025),normal,worldNormal,ray,b.light,1.0,.78);
  }
  if (b.material<1.5) {
    let uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.0005,0.9995));
    let level=max(0.0,log2(f32(textureDimensions(earthMap).x)/max(b.raster*4.0,1.0)));
    let ground=textureSampleLevel(earthMap,surfaceSampler,uv,level).rgb;
    let water=smoothstep(ground.r*1.6,ground.r*1.6+0.07,ground.b);
    let albedo=ground+vec3f(0.004,0.022,0.055)*water;
    let shadow=1.0-earthCloudOpacity(normalize(normal+b.light*0.025),b)*0.24*sunlight;
    let near=b.near;
    var seaNormal=normal;
    if(near>0.0 && water>0.01) {
      let waves=vec3f(sin(p.z*170.0+f.forward.w*0.33),sin(p.x*141.0-f.forward.w*0.21),sin(p.y*188.0+f.forward.w*0.26));
      seaNormal=normalize(normal+(waves-normal*dot(waves,normal))*0.012*near);
    }
    let specular=pow(max(dot(reflect(-b.light,seaNormal),-ray),0.0),mix(55.0,92.0,near))*water*sunlight;
    let rim=pow(1.0-facing,3.2)*smoothstep(-0.15,0.65,dot(normal,b.light));
    return albedo*(0.018+sunlight*1.65)*shadow+vec3f(0.48,0.67,0.85)*specular*0.55+vec3f(0.035,0.15,0.42)*rim*0.65;
  }

  let near=b.near;
  let shear=stellarRotateY(p,sin(p.y*12.0)*0.19+sin(f.forward.w*0.035)*0.020);
  var flow=solarCloudVortex(shear,vec2f(1.1,0.24),vec2f(0.45,0.16),3.3);
  flow=solarCloudVortex(flow,vec2f(-1.7,-.34),vec2f(.34,.13),-2.4);
  flow=stellarRotateY(flow,.64*exp(-dot(p.xz,p.xz)*13.0));
  let tops=solarCloudTops(flow,vec3f(.65,3.0,.65),near,b,normal,ray);
  let latitude=flow.y+(tops.broad-.5)*.043;
  let belts=.5+.5*sin(latitude*34.0+sin(latitude*15.0)*1.1+(tops.broad-.5)*1.8);
  let billows=smoothstep(.22,.78,tops.billow*.65+tops.fine*.35);
  var albedo=mix(vec3f(.43,.31,.17),vec3f(.82,.74,.55),belts*.39+tops.broad*.19+billows*.12+.12);
  albedo+=vec3f(.14,.13,.10)*(tops.fine-.5)*near;
  // A finite, enlarged six-sided polar jet and central vortex. Position,
  // colour and flow are authored cues, not a Cassini map or current weather.
  let polar=smoothstep(.86,.96,p.y);
  let radius=length(p.xz);let angle=atan2(p.z,p.x+.00000001);
  let sector=(fract((angle+.523598776)/1.047197552)-.5)*1.047197552;
  let hexRadius=radius*cos(sector)+(tops.billow-.5)*.012+(tops.broad-.5)*.008;
  let width=.013+1.0/max(b.raster,1.0);
  let hexDelta=(hexRadius-.245)/width;
  let jet=exp(-hexDelta*hexDelta)*polar;
  let inner=(1.0-smoothstep(.21,.27,hexRadius))*polar;
  let eye=exp(-radius*radius/.0020)*polar;
  let hood=vec3f(.51,.53,.39)*(.93+billows*.14+(tops.fine-.5)*.04);
  albedo=mix(albedo,hood,inner*.32);
  albedo*=1.0-jet*.10;
  albedo+=vec3f(.035,.039,.029)*jet*(.2+.8*tops.crest);
  albedo+=vec3f(.027,.029,.023)*(tops.billow-.5)*inner*near;
  albedo*=1.0-eye*.24;
  let detail=planetRotateX(stellarRotateY(solarCloudNormal(p,flow,tops,.70),-b.spin),b.tilt);
  let cloudLight=solarCloudLight(normal,detail,b.light);
  return albedo*(.032+cloudLight*1.35*planetRingShadow(normal,b))*(.88+.12*sqrt(facing));
}
fn planetRingRadiance(point:vec3f, radius:f32,b:BodyMaterial,footprint:f32)->vec3f {
  let along=dot(point,b.light);
  let closest=point-b.light*along;
  let shadow=select(1.0,smoothstep(0.94,1.04,length(closest)),along<0.0);
  if(b.material>135.5 && b.material<136.5) {
    let p=planetRotateX(point,-b.tilt);
    let theta=atan2(p.z,p.x)+f.forward.w*.016/pow(max(radius,1.0),1.5);
    let space=vec3f(cos(theta)*radius*4.0,sin(theta)*radius*4.0,radius*18.0);
    let seed=vec3f(b.seed*17.0,3.7,9.3);
    let lane=mix(.5,textureSampleLevel(nebulaNoise,surfaceSampler,(space+seed+vec3f(.5))/128.0,0.0).r,exp(-pow(18.0/max(footprint,1.0),2.0)));
    let broad=mix(.5,.5+.5*sin(radius*9.0+(lane-.5)*2.2),exp(-pow(9.0/max(footprint,1.0),2.0)));
    let resolved=b.near*exp(-pow(55.0/max(footprint,1.0),2.0));
    var fine=.5;
    if(resolved>.001) {fine=textureSampleLevel(nebulaNoise,surfaceSampler,(space*3.0+seed+vec3f(.5))/128.0,0.0).r;}
    let albedo=mix(vec3f(.10,.055,.03),vec3f(.49,.32,.18),clamp(.14+broad*.38+lane*.30+(fine-.5)*.25*resolved,0.0,1.0));
    // Cold circumplanetary dust is reflected in an authored warm palette;
    // the disk does not glow as molten material or a black-hole disk.
    return albedo*(.20+abs(dot(planetRingNormal(b),b.light))*.95)*(.08+shadow*.92);
  }
  if(b.material>12.5 && b.material<14.5) { return vec3f(0.19,0.24,0.23)*(0.20+abs(dot(planetRingNormal(b),b.light))*0.72)*(0.04+shadow*0.96); }
  if(b.material>64.5) { return vec3f(.46,.43,.38)*(.22+abs(dot(planetRingNormal(b),b.light))*.82)*(.035+shadow*.965); }
  let filtered=exp(-pow(240.0/max(footprint,1.0),2.0));
  let grain=0.5+0.5*sin(radius*240.0+sin(radius*69.0)*1.4)*filtered;
  let closeBands=(0.5+0.5*sin(radius*560.0)*exp(-pow(560.0/max(footprint,1.0),2.0)))*b.near*0.10;
  let zones=0.5+0.5*sin(radius*24.0);
  let albedo=mix(vec3f(0.34,0.29,0.21),vec3f(0.84,0.75,0.58),grain*0.24+zones*0.43+0.20+closeBands);
  let exposure=0.22+abs(dot(planetRingNormal(b),b.light))*0.80;
  return albedo*exposure*(0.045+shadow*0.955);
}
// Compound opaque worlds compose their ring plane against the actual surface
// depth, preserving empty gaps and foreground/background occlusion.
fn planetWithRings(surface:vec4f,center:vec3f,ray:vec3f,b:BodyMaterial,surfaceDistance:f32)->vec4f {
  if(b.rings.y<=0.0) {return surface;}
  let normal=planetRingNormal(b);let denominator=dot(ray,normal);
  if(abs(denominator)<=0.0001) {return surface;}
  let distance=dot(center,normal)/denominator;
  if(distance<=0.0 || distance>=surfaceDistance) {return surface;}
  let point=ray*distance-center;let radius=length(point);let coverage=planetRingCoverage(radius,b);
  if(coverage<=0.001) {return surface;}
  // A ray cone widens along the plane and contracts for nearby ring sections.
  // Filter radial bands with this footprint before the camera crosses the plane.
  let footprint=max(b.raster*length(center)*abs(denominator)/max(distance,${RING_CAMERA_FADE[0]}),1.0);
  let density=select(.81+.15*sin(radius*143.0)*exp(-pow(143.0/footprint,2.0)),.78,b.material>135.5 && b.material<136.5);
  let visibility=smoothstep(${RING_CAMERA_FADE.join(',')},distance);
  let alpha=coverage*density*smoothstep(0.55,3.5,b.pixels)*visibility;let ring=planetRingRadiance(point,radius,b,footprint);
  return vec4f(ring*alpha+surface.rgb*(1.0-alpha),alpha+surface.a*(1.0-alpha));
}
fn planetFragmentRadiance(center:vec3f,ray:vec3f,impact2:f32,alongRay:f32,b:BodyMaterial)->vec4f {
  let resolved=smoothstep(0.55,3.5,b.pixels);
  let axes=satelliteAxes(b.material);
  let shape=solidRange(b.material,b.seed);
  if(shape.y>shape.x) {
    let phase=satellitePhase(b.material,b.spin);
    let localCenter=stellarRotateY(planetRotateX(center,-b.tilt),phase)/axes;
    let localRay=stellarRotateY(planetRotateX(ray,-b.tilt),phase)/axes;
    let hit=solidHit(localCenter,localRay,shape);
    if(hit.distance<0.0) {return planetWithRings(vec4f(0),center,ray,b,1e20);}
    let point=localRay*hit.distance-localCenter;
    let normal=planetRotateX(stellarRotateY(normalize(hit.normal/axes),-phase),b.tilt);
    let surfacePoint=select(normalize(point),point,b.material>41.5);
    var surfaceMaterial=b;
    if(dot(normal,b.light)>0.0) {
      let localLight=stellarRotateY(planetRotateX(b.light,-b.tilt),phase)/axes;
      surfaceMaterial.sunVisibility=solidSunVisibility(hit.lightPoint,localLight,shape,b.raster);
    }
    return planetWithRings(vec4f(satelliteSurfaceAt(normal,surfacePoint,ray,surfaceMaterial)*resolved,resolved),center,ray,b,hit.distance);
  }
  if(any(axes!=vec3f(1.0))) {
    let phase=satellitePhase(b.material,b.spin);
    let localCenter=stellarRotateY(planetRotateX(center,-b.tilt),phase)/axes;
    let localRay=stellarRotateY(planetRotateX(ray,-b.tilt),phase)/axes;
    if(hasContactWorld(b.material)) {
      let hit=contactWorldHit(localCenter,localRay,b.material);
      if(hit.distance<0.0) {return vec4f(0.0);}
      let point=localRay*hit.distance-localCenter;
      let normal=planetRotateX(stellarRotateY(normalize(hit.normal/axes),-phase),b.tilt);
      let alpha=smoothstep(0.0,.9/max(b.raster,1.0),hit.chord)*resolved;
      return vec4f(satelliteSurfaceAt(normal,point,ray,b)*alpha,alpha);
    }
    let magnitude=dot(localRay,localRay);
    let closest=dot(localCenter,localRay)/magnitude;
    let miss=localCenter-localRay*closest;let miss2=dot(miss,miss);
    if(closest<=0.0 || miss2>1.0) { return vec4f(0.0); }
    let span=sqrt(max(0.0,(1.0-miss2)/magnitude));
    var distance=closest-span;var exit=closest+span;var face=-1;
    let offset=smallWorldOffset(b.material);
    // The finite envelope is shared with CPU rays and neighbour draws.
    // Source-derived legacy shapes and authored new shapes stay distinguished.
    // The ellipsoid remains its outer bound at both levels of detail.
    for(var i=0u;i<24u;i++) {
      if(offset==4294967295u) { break; }
      let cap=SMALL_WORLD_CAPS[offset+i];
      let capCenter=localCenter+cap.xyz;
      let capAlong=dot(capCenter,localRay)/magnitude;
      let capMiss=capCenter-localRay*capAlong;
      let squaredSpan=(cap.w-dot(capMiss,capMiss))/magnitude;
      if(squaredSpan<0.0) { return vec4f(0.0); }
      let capSpan=sqrt(squaredSpan);
      exit=min(exit,capAlong+capSpan);
      if(capAlong-capSpan>distance) { distance=capAlong-capSpan;face=i32(i); }
      if(distance>exit) { return vec4f(0.0); }
    }
    let pits=smallWorldPitRange(b.material);
    for(var pitPass=0u;pitPass<pits.y;pitPass++) {
      for(var i=pits.x;i<pits.x+pits.y;i++) {
        let pit=SMALL_WORLD_PITS[i];let q=localCenter+pit.xyz;let a=dot(q,localRay)/magnitude;
        let delta=q-localRay*a;let squaredSpan=(pit.w-dot(delta,delta))/magnitude;
        if(squaredSpan<0.0) {continue;}
        let span=sqrt(squaredSpan);
        if(distance>a-span && distance<a+span) {distance=a+span;face=-2-i32(i);}
      }
    }
    if(distance>exit || distance<0.0) { return vec4f(0.0); }
    let point=localRay*distance-localCenter;
    var localNormal=normalize(point/axes);
    if(face>=0) {
      let faceNormal=normalize((point-SMALL_WORLD_CAPS[offset+u32(face)].xyz)/axes);
      localNormal=normalize(mix(localNormal,faceNormal,.70));
    }
    if(face<=-2) {localNormal=-normalize((point-SMALL_WORLD_PITS[u32(-face-2)].xyz)/axes);}
    let normal=planetRotateX(stellarRotateY(localNormal,-phase),b.tilt);
    let edge=smoothstep(0.0,min(.18,1.35/max(b.raster,1.0)),1.0-sqrt(miss2));
    let cutEdge=smoothstep(0.0,.9/max(b.raster,1.0),max(0.0,exit-distance));
    let alpha=edge*cutEdge*resolved;
    // Procedural terrain uses the actual hit position, including cut faces and
    // cavity floors. Attributed spherical maps retain their angular coordinates.
    let surfacePoint=select(normalize(point),point,b.material>41.5);
    return vec4f(satelliteSurfaceAt(normal,surfacePoint,ray,b)*alpha,alpha);
  }
  var result=vec4f(0.0);
  var sphereDistance=1e20;
  if (impact2<=1.0) {
    sphereDistance=alongRay-sqrt(max(1.0-impact2,0.0));
    let normal=normalize(ray*sphereDistance-center);
    let edge=smoothstep(0.0,min(0.18,1.35/max(b.raster,1.0)),1.0-sqrt(impact2));
    let alpha=edge*resolved;
    result=vec4f(planetSurface(normal,ray,b)*alpha,alpha);
  } else if(((b.material>127.5 && b.material<128.5)||(b.material>130.5 && b.material<134.5)) && impact2<1.06) {
    let normal=normalize(ray*alongRay-center);
    let halo=exp(-(sqrt(impact2)-1.0)*90.0)*.12*smoothstep(-.1,.6,dot(normal,b.light))*resolved;
    let tint=select(vec3f(.61,.28,.09),mix(b.albedo,vec3f(.72,.80,1),.28),b.material>130.5);
    result=vec4f(tint*halo,halo*.25);
  } else if (b.material<1.5 && impact2<1.06) {
    let normal=normalize(ray*alongRay-center);
    let light=smoothstep(-0.15,0.65,dot(normal,b.light));
    let halo=exp(-(sqrt(impact2)-1.0)*92.0)*0.28*light*resolved;
    result=vec4f(vec3f(0.04,0.22,0.65)*halo,halo*0.30);
  } else if (b.material>7.5 && b.material<8.5 && impact2<1.04) {
    let normal=normalize(ray*alongRay-center);
    let light=smoothstep(-0.10,0.60,dot(normal,b.light));
    let halo=exp(-(sqrt(impact2)-1.0)*100.0)*0.13*light*resolved;
    result=vec4f(vec3f(0.32,0.25,0.16)*halo,halo*0.25);
  } else if (b.material>4.5 && b.material<5.5 && impact2<1.025) {
    let normal=normalize(ray*alongRay-center);
    let light=smoothstep(-0.10,0.60,dot(normal,b.light));
    let halo=exp(-(sqrt(impact2)-1.0)*130.0)*0.10*light*resolved;
    result=vec4f(vec3f(0.28,0.13,0.05)*halo,halo*0.24);
  } else if (b.material>17.5 && b.material<18.5 && impact2<1.13) {
    let normal=normalize(ray*alongRay-center);
    let light=smoothstep(-.17,.6,dot(normal,b.light));
    let height=sqrt(impact2)-1.0;
    let main=exp(-height*72.0)*.16;
    let detachedDelta=(height-.038)/.006;
    let detached=exp(-detachedDelta*detachedDelta)*.052*smoothstep(22.0,100.0,b.raster);
    let halo=(main+detached)*light*resolved;
    let polar=smoothstep(.55,.95,satellitePoint(normal,b).y);
    let colour=mix(mix(vec3f(.55,.30,.065),vec3f(.15,.29,.51),polar),vec3f(.16,.31,.53),detached/max(main+detached,.000001));
    result=vec4f(colour*halo,halo*.3);
  }
  if (b.material<1.5 && impact2<1.0161) {
    // A finite shell gives the observed cloud field limb depth and parallax.
    let cloudRadius=1.008;
    let cloudDistance=alongRay-sqrt(max(cloudRadius*cloudRadius-impact2,0.0));
    let normal=normalize(ray*cloudDistance-center);
    let edge=smoothstep(0.0,min(0.06,min(0.18,1.35/max(b.raster,1.0))),cloudRadius-sqrt(impact2));
    let alpha=earthCloudOpacity(normal,b)*edge*resolved;
    let sunlight=reflectedSurfaceLight(normal,earthCloudNormal(normal,b),b.light);
    let radiance=vec3f(0.87,0.93,1.0)*(0.020+sunlight*1.42);
    result=vec4f(radiance*alpha+result.rgb*(1.0-alpha),alpha+result.a*(1.0-alpha));
  }
  return planetWithRings(result,center,ray,b,sphereDistance);
}
fn planetFragment(center:vec3f,ray:vec3f,impact2:f32,alongRay:f32,b:BodyMaterial)->vec4f {
  let result=planetFragmentRadiance(center,ray,impact2,alongRay,b);
  return vec4f(result.rgb*b.lightColor,result.a);
}

`;
