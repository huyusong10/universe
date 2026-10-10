// One artistically compressed cluster layout for lights, gas and foreground dust.
// Intrinsic disc coordinates precede the shared tilt and observation-clock motion.
import { GALAXY_EXPLORATIONS } from './observatory-galaxies.js?v=cosmic-explore-20261010gu';
export const GALAXY_CLUSTER_COUNT = 6;
// Shared authored stellar chromaticities, not spectral measurements. Pink
// emission belongs to the separate gas field, rather than random star lights.
export const GALAXY_STELLAR_COLOURS = Object.freeze({
  young: Object.freeze([.67,.81,1]),
  old: Object.freeze([1,.84,.65])
});
// Authored world attitudes, not measured sky inclinations or position angles.
// A galaxy keeps this one frame through distant volume, lights and navigation.
const GALAXY_ATTITUDES = {
  galaxy:[-30,15,-25], triangulum:[55,-20,35], whirlpool:[-48,35,-15], barred:[32,-30,65],
  sombrero:[18,25,-48], centaurusa:[-36,-40,28], cigar:[38,18,72], needle:[-22,-35,-65],
  elliptical:[42,25,30], cartwheel:[-58,20,45], pinwheel:[36,-15,-35], phantom:[-42,60,24],
  greatbar:[62,30,-18], southernpinwheel:[-28,-45,-42], sculptor:[45,12,36], patchyspiral:[-64,22,-26],
  irregularburst:[24,-30,58], lmc:[-38,20,-55], smc:[48,-40,16], antennae:[30,55,-38],
  penguinegg:[-54,-20,40], meathook:[40,45,52], shellgalaxy:[-32,-60,20], hoag:[58,-25,-40],
  polarring:[-46,30,55], tadpole:[28,-55,-30]
};
const LEGACY_ORIENTATION = [0,0,Math.sin(.11),Math.cos(.11)];
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rotateQuaternion(point,q) {
  const t=cross(q,point).map(v=>v*2),u=cross(q,t);
  return point.map((v,i)=>v+q[3]*t[i]+u[i]);
}
export function galaxyOrientation(body) {
  const angles=GALAXY_ATTITUDES[body.material];
  if(!angles) return LEGACY_ORIENTATION.slice();
  const [x,y,z]=angles.map(v=>v*Math.PI/360);
  const [cx,cy,cz]=[x,y,z].map(Math.cos),[sx,sy,sz]=[x,y,z].map(Math.sin);
  return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
}
export function galaxyWorldVector(body,point,time=0) {
  const angle=(Number.isFinite(time)?time:0)*.018,[x,y,z]=point;
  return rotateQuaternion([x*Math.cos(angle)+z*Math.sin(angle),y,-x*Math.sin(angle)+z*Math.cos(angle)],body.orientation||LEGACY_ORIENTATION);
}
export function galaxyLocalVector(body,point,time=0) {
  const q=body.orientation||LEGACY_ORIENTATION;
  const [x,y,z]=rotateQuaternion(point,[-q[0],-q[1],-q[2],q[3]]),angle=(Number.isFinite(time)?time:0)*.018;
  return [x*Math.cos(angle)-z*Math.sin(angle),y,x*Math.sin(angle)+z*Math.cos(angle)];
}
export function galaxyArrivalView(body,view={yaw:-.36,pitch:.18}) {
  const {yaw,pitch}=view,roll=view.roll||0;
  const right=[Math.cos(yaw),0,-Math.sin(yaw)],up=[-Math.sin(pitch)*Math.sin(yaw),Math.cos(pitch),-Math.sin(pitch)*Math.cos(yaw)];
  const fromLegacy=point=>galaxyWorldVector(body,galaxyLocalVector({},point));
  const direction=fromLegacy([Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)]);
  const screenUp=fromLegacy(up.map((v,i)=>v*Math.cos(roll)-right[i]*Math.sin(roll)));
  const nextYaw=Math.atan2(direction[0],direction[2]),nextPitch=Math.asin(Math.max(-1,Math.min(1,direction[1])));
  const nextRight=[Math.cos(nextYaw),0,-Math.sin(nextYaw)],nextUp=[-Math.sin(nextPitch)*Math.sin(nextYaw),Math.cos(nextPitch),-Math.sin(nextPitch)*Math.cos(nextYaw)];
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
  return {yaw:nextYaw,pitch:nextPitch,roll:Math.atan2(-dot(screenUp,nextRight),dot(screenUp,nextUp))};
}
export const galaxyClusterRadius = index => .16 + index * .27;
export const galaxyWinding = loose => loose ? 1.65 : 2.4;
export function galaxyClusterAngle(index, loose) {
  return (index % 2) * Math.PI + Math.log(galaxyClusterRadius(index) / .4) * galaxyWinding(loose);
}
export function galaxyClusterRecipe(loose) {
  return Array.from({length: GALAXY_CLUSTER_COUNT}, (_, index) => {
    const radius = galaxyClusterRadius(index), angle = galaxyClusterAngle(index, loose);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius, Math.cos(angle), Math.sin(angle)];
  });
}

// These authored profiles describe shape, not measured stellar positions.
// The volume and its finite local lights consume the same intrinsic layout.
export const GALAXY_PORTRAITS = Object.freeze({
  whirlpool: { code:106, form:'spiral', winding:1.6, height:.65 },
  barred: { code:107, form:'bar', winding:1.8, armBase:.88, height:.65 },
  sombrero: { code:108, form:'dust-ring', winding:2.4, height:1.45 },
  centaurusa: { code:109, form:'dust-ellipsoid', winding:2.4, height:1.7 },
  cigar: { code:110, form:'starburst', winding:2.4, height:1.85 },
  needle: { code:111, form:'thin-disc', winding:2.8, height:.65 },
  elliptical: { code:112, form:'ellipsoid', winding:2.4, height:1.7 },
  cartwheel: { code:113, form:'ring', winding:1.2, height:.65 },
  ...Object.fromEntries(GALAXY_EXPLORATIONS.map(body=>[body.material,{code:body.code,...body.profile}]))
});

// One spiral phase for finite stars and region anchors; legacy barred gas
// consumes the same authored root scale in the generated shader.
export function galaxySpiralAngle(profile,r,branch=0) {
  const base=profile?.armBase||profile?.bar||.4;
  const winding=profile?.code===191?(branch===0?1.1:2.9):profile?.winding||2.4;
  return branch+Math.log(r/base)*winding;
}

// Observation regions refer to this existing authored structure. They are
// camera anchors inside one galaxy, never additional catalogue bodies.
export function galaxyObservationRegions(body) {
  if(body?.kind!=='galaxy') return [];
  const profile=GALAXY_PORTRAITS[body.material];
  const region=(key,point,distance=1.15)=>({key,point,distance});
  const pair=(key,a,b)=>[region(key,a),region('outer-'+key,b)];
  switch(profile?.code>=180?body.material:profile?.form) {
    case 'dust-ring': return [region('ring',[1.42,0,0],1.8),region('outer-ring',[-1.42,0,0],1.8),region('old-stars',[.15,.52,0])];
    case 'thin-disc': return [region('arm',[.9,0,0],1.8),region('outer-arm',[-1.45,0,0],1.8),region('inner-arm',[.3,.06,0],1.5)];
    case 'dust-ellipsoid': return [region('dust',[.8,.04,.15],2.2),region('old-stars',[.4,.6,0]),region('outer-stars',[-.9,-.4,.2])];
    case 'ellipsoid': return [region('old-stars',[.45,.25,.2]),region('outer-stars',[-1,.3,.4]),region('halo',[.3,.7,-.6])];
    case 'starburst': return [region('starburst',[.7,.02,0]),region('wind',[.25,.6,.04]),region('outer-wind',[-.25,-.6,.04])];
    case 'ring': return [...pair('ring',[1.66,0,0],[-1.66,0,0]),region('spoke',[.9,0,0])];
    case 'irregularburst': return [region('starburst',[-.7,0,-.4]),region('cloud',[.45,.08,.35]),region('outer-cloud',[.65,-.05,-.5])];
    case 'lmc': return [region('bar',[-.3,0,.15]),region('cloud',[.45,.08,.35]),region('outer-cloud',[-.7,0,-.4])];
    case 'smc': return [region('bar',[-.4,0,0]),region('wing',[1.2,.04,.38]),region('cloud',[.45,0,.2])];
    case 'antennae': return [region('nucleus',[-.5,0,-.18]),region('companion',[.45,.08,.3]),region('tail',galaxyTidalPoint(.72)),region('outer-tail',galaxyTidalPoint(.82,-1))];
    case 'penguinegg': return [region('nucleus',[-.8,0,-.5]),region('companion',[.96,.08,.75]),region('curved-arm',[-.25+Math.cos(-1.7)*.88,0,-.05+Math.sin(-1.7)*.88])];
    case 'shellgalaxy': return [region('shell',[1.14,0,0]),region('outer-shell',[-1.63,0,0]),region('old-stars',[.25,.3,0])];
    case 'hoag': return [...pair('ring',[1.55,0,0],[-1.55,0,0]),region('old-stars',[.2,.1,0])];
    case 'polarring': return [region('ring',[1.48,0,0]),region('polar-ring',[0,1.48,-.11]),region('inner-disc',[.3,0,.35])];
    case 'tadpole': return [region('nucleus',[-1.1,0,0]),region('tail',galaxyTidalPoint(.55,1,true)),region('outer-tail',galaxyTidalPoint(.95,1,true))];
    default: {
      const shape=profile||{winding:galaxyWinding(body.material==='triangulum')};
      const arm=(r,branch)=>{const a=galaxySpiralAngle(shape,r,branch);return [Math.cos(a)*r,0,Math.sin(a)*r];};
      const outerBranch=body.material==='meathook'?Math.PI:Math.PI*2/(profile?.arms||2);
      return [region('arm',arm(1.22,0)),region('outer-arm',arm(1.8,outerBranch)),
        profile?.bar?region('bar',[profile.bar*.65,0,0]):region('inner-arm',arm(profile?.armBase?1:.7,0)),
        ...(profile?.armBase?[region('bar',[profile.armBase*.65,0,0],1.5)]:[])];
    }
  }
}

export function galaxyRegionPosition(body,region,time=0) {
  const world=galaxyWorldVector(body,region.point,time);
  return body.position.map((v,i)=>v+world[i]*body.radius);
}

export function galaxyPortraitPoint(profile, random, gaussian) {
  if(profile.code>=180) return explorationPoint(profile,random,gaussian);
  const a=random()*Math.PI*2, population=random();
  let r=Math.sqrt(random())*2.08, y=gaussian(random)*.055, angle=a, old=false;
  switch(profile.form) {
    case 'ellipsoid': case 'dust-ellipsoid': {
      // A central population keeps the bounded light budget useful inside
      // the ellipsoid as well as across its diffuse outskirts.
      r=population<.30 ? Math.pow(random(),.65)*.42 : Math.pow(random(),.62)*2.12;
      const h=random()*2-1, radial=Math.sqrt(1-h*h)*r;
      return {point:[Math.cos(a)*radial, h*r*.68, Math.sin(a)*radial*.82],old:true};
    }
    case 'dust-ring':
      old=population<.65;
      if(old) {r=Math.pow(random(),.7)*1.1;y=Math.max(-.9,Math.min(.9,gaussian(random)*.34));}
      else {r=1.42+gaussian(random)*.16;}
      break;
    case 'ring':
      r=population<.18 ? Math.pow(random(),.6)*.4 : 1.66+gaussian(random)*.10;
      break;
    case 'starburst':
      return {point:[Math.max(-2,Math.min(2,gaussian(random)*.65)),Math.max(-.3,Math.min(.3,gaussian(random)*.075)),Math.max(-.45,Math.min(.45,gaussian(random)*.15))],old:population<.24};
    case 'thin-disc':
      y=gaussian(random)*.025;old=population<.24;
      if(old) {r=Math.pow(random(),1.4)*.48;y=gaussian(random)*.13;}
      break;
    case 'bar':
      if(population<.40) return {point:[(random()*2-1)*profile.armBase,gaussian(random)*.055,gaussian(random)*.12],old:true};
      r=profile.armBase+Math.sqrt(random())*1.18;
      angle=galaxySpiralAngle(profile,r,random()<.5?0:Math.PI)+gaussian(random)*.10;
      break;
    default:
      old=population<.18;
      if(old) {r=Math.pow(random(),1.4)*.42;y=gaussian(random)*.15;}
      else angle=galaxySpiralAngle(profile,Math.max(r,.12),random()<.5?0:Math.PI)+gaussian(random)*.12;
  }
  return {point:[Math.cos(angle)*r,y,Math.sin(angle)*r],old};
}

export function galaxyTidalPoint(t,side=1,single=false) {
  return single ? [-1.1+3*t,.11*Math.sin(t*Math.PI),.3*Math.sin(t*Math.PI)-.18*t] :
    [side*(.45+1.43*t),.14*Math.sin(t*Math.PI),side*(.3+.9*Math.sin(t*Math.PI*.82))];
}

function explorationPoint(profile,random,gaussian) {
  const k=profile.code-180, a=random()*Math.PI*2, population=random();
  const scatter=(center,sigma)=>center.map((v,i)=>v+gaussian(random)*sigma[i]);
  const core=()=>scatter([0,0,0],[.17,.11,.17]);
  let point,old=false;
  if(k<=5 || k===11) {
    old=population<.22;
    if(old) point=profile.bar && random()<.65 ? scatter([(random()*2-1)*profile.bar,0,0],[.04,.045,.07]) : core();
    else {
      const r=(profile.bar||.12)+Math.sqrt(random())*(2.05-(profile.bar||.12));
      const branch=Math.floor(random()*(profile.arms||2));
      const angle=galaxySpiralAngle(profile,r,branch*Math.PI*2/(profile.arms||2))+gaussian(random)*(k===5?.23:.10);
      point=[Math.cos(angle)*r,gaussian(random)*.055,Math.sin(angle)*r];
    }
  } else if(k<=8) {
    old=population<.25;
    if(old) point=scatter([k===7?-.3:0,0,k===7?.15:0],[(k===6?.55: .63),.09,.13]);
    else if(k===8) point=scatter([.7+random()*.9,.04,.38],[.15,.10,.22]);
    else {
      const centers=[[-.7,0,-.4],[.45,.08,.35],[.65,-.05,-.5]];
      point=scatter(centers[Math.floor(random()*3)],[.26,.12,.28]);
    }
  } else if(k===9 || k===15) {
    const single=k===15;
    if(population<.56) {
      point=scatter(single?[-1.1,0,0]:(random()<.5?[-.5,0,-.18]:[.45,.08,.3]),[.20,.10,.21]);old=population<.24;
    } else point=scatter(galaxyTidalPoint(random(),random()<.5?-1:1,single),[.035,.04,.055]);
  } else if(k===10) {
    old=population<.44;
    if(old) point=scatter(random()<.6?[.96,.08,.75]:[-.8,0,-.5],[.18,.15,.18]);
    else {
      const angle=-2.7+random()*4.9,r=.88+gaussian(random)*.07;
      point=[-.25+Math.cos(angle)*r,gaussian(random)*.07,-.05+Math.sin(angle)*r];
    }
  } else if(k===12) {
    old=true;
    const r=population<.45?Math.pow(random(),.7)*.55:[.74,1.14,1.63,2.06][Math.floor(random()*4)]+gaussian(random)*.028;
    const h=random()*2-1,radial=Math.sqrt(1-h*h)*r;
    point=[Math.cos(a)*radial,h*r/1.15,Math.sin(a)*radial/.95];
  } else if(k===13) {
    old=population<.24;const r=1.55+gaussian(random)*.09;
    point=old?core():[Math.cos(a)*r,gaussian(random)*.055,Math.sin(a)*r];
  } else {
    old=population<.30;const r=old?Math.sqrt(random())*.65:1.48+gaussian(random)*.07;
    point=old?[Math.cos(a)*r,gaussian(random)*.04,Math.sin(a)*r]:[Math.cos(a)*r,Math.sin(a)*r,.11*Math.sin(a*3)+gaussian(random)*.05];
  }
  // All finite lights remain inside the same conservative volume as the gas.
  const bound=Math.hypot(point[0]/2.35,point[1]/profile.height,point[2]/2.35);
  if(bound>.96) point=point.map(v=>v*.96/bound);
  return {point,old};
}
