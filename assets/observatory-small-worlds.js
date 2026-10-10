// Finite curved convex envelopes shared by drawing and CPU solid rays.
// Vesta/Phobos/Deimos are derived from NASA visualization GLBs; the new
// Eros/Bennu/Proteus envelopes below are authored procedural illustrations.
// For the source-derived shapes, each sphere contains the normalized source
// vertices. For convex envelopes the existing
// ellipsoid remains the outer bound. Contact lobes below add authored concavity;
// none of these new shapes is a measured terrain/map registration.
// Each tuple contains local sphere centre and squared radius. Scale/orientation
// are illustrative. Provenance/derivation: assets/planets/README.md, round-68.
function authoredCap(normal, distance) {
  const length=Math.hypot(...normal), curvature=4;
  return Object.freeze([...normal.map(v=>Number((-v/length*curvature).toFixed(7))),Number(((curvature+distance)**2).toFixed(7))]);
}
function authoredEnvelope(kind) {
  if(kind==='bennu') {
    const caps=Array.from({length:20},(_,i)=>{
      const angle=(i%10)*Math.PI/5+(i>=10 ? .14 : 0);
      return authoredCap([Math.cos(angle)*.66,i<10 ? .751 : -.751,Math.sin(angle)*.66],.75+Math.sin(i*1.7)*.012);
    });
    caps.push(authoredCap([0,1,0],.88),authoredCap([0,-1,0],.91),authoredCap([1,0,0],.97),authoredCap([-1,0,0],.99));
    return Object.freeze(caps);
  }
  return Object.freeze(Array.from({length:24},(_,i)=>{
    const y=1-2*(i+.5)/24,angle=i*2.39996323,r=Math.sqrt(1-y*y);
    const normal=[Math.cos(angle)*r,y,Math.sin(angle)*r];
    const distance=kind==='proteus' ? .79+(Math.sin(i*7.3)*.5+.5)*.16 : .84+(Math.sin(i*5.1)*.5+.5)*.13;
    return authoredCap(normal,distance);
  }));
}

// Shared finite descriptors keep CPU solids, GPU axes and material identities
// together. These mission-informed forms are artwork, not spacecraft meshes.
export const NEW_SMALL_WORLDS = Object.freeze({
  ryugu: {code:55,axes:[1.07,.97,1.07]},
  itokawa: {code:56,axes:[1.65,.78,.76]},
  lutetia: {code:57,axes:[1.25,.87,1.04]},
  ida: {code:58,axes:[1.67,.65,.81]},
  mathilde: {code:59,axes:[1.05,.92,1.16]},
  psyche: {code:60,axes:[1.34,.89,1.02]},
  gaspra: {code:61,axes:[1.35,.86,.79]},
  steins: {code:62,axes:[1.04,1.19,.90]},
  dactyl: {code:63,axes:[1.10,.94,.88]},
  rosettacomet: {code:64,axes:[1.48,.87,.82]},
  hyperion: {code:65,axes:[1.46,.94,.79]},
  pan: {code:66,axes:[1.22,.78,1.12]},
  atlas: {code:67,axes:[1.30,.65,1.17]},
  phoebe: {code:68,axes:[1.07,.96,1]},
  nereid: {code:69,axes:[1.04,.98,1]},
  arrokoth: {code:70,axes:[1.72,.61,.92]},
  chariklo: {code:71,axes:[1.11,.90,1]},
  sedna: {code:72,axes:[1.02,.98,1]},
  quaoar: {code:73,axes:[1.02,.99,1]},
  amalthea: {"code":74,"axes":[1.6,0.7,0.84],"profile":{"craters":34,"depth":0.15,"roughness":0.009,"grooves":0.009,"low":[0.15,0.043,0.018],"high":[0.55,0.24,0.09],"ice":0,"basins":[[0.8,0.25,0.5,0.44,0.1],[-0.3,-0.1,-0.9,0.32,0.065]]}},
  thebe: {"code":75,"axes":[1.35,0.91,0.77],"profile":{"craters":40,"depth":0.17,"roughness":0.012,"grooves":0.018,"low":[0.12,0.075,0.045],"high":[0.39,0.28,0.18],"ice":0,"basins":[[0.6,0.4,0.7,0.46,0.13]]}},
  himalia: {"code":76,"axes":[1.18,0.87,0.96],"profile":{"craters":20,"depth":0.06,"roughness":0.006,"grooves":0.01,"low":[0.026,0.028,0.028],"high":[0.11,0.115,0.11],"ice":0}},
  janus: {"code":77,"axes":[1.17,1.06,0.85],"profile":{"craters":56,"depth":0.18,"roughness":0.01,"grooves":0.016,"low":[0.2,0.18,0.14],"high":[0.55,0.51,0.42],"ice":1}},
  epimetheus: {"code":78,"axes":[1.3,0.97,0.9],"profile":{"craters":40,"depth":0.17,"roughness":0.01,"grooves":0.009,"low":[0.18,0.17,0.14],"high":[0.52,0.49,0.4],"ice":1,"basins":[[0.15,-0.93,0.3,0.46,0.075]]}},
  helene: {"code":79,"axes":[1.24,0.98,0.9],"profile":{"craters":14,"depth":0.07,"roughness":0.004,"grooves":0.018,"low":[0.3,0.29,0.25],"high":[0.65,0.63,0.55],"ice":1}},
  telesto: {"code":80,"axes":[1.3,0.82,0.94],"profile":{"craters":8,"depth":0.025,"roughness":0.003,"grooves":0.004,"low":[0.37,0.37,0.34],"high":[0.73,0.74,0.68],"ice":1}},
  calypso: {"code":81,"axes":[1.48,0.8,0.75],"profile":{"craters":20,"depth":0.07,"roughness":0.004,"grooves":0.008,"low":[0.32,0.35,0.34],"high":[0.69,0.73,0.69],"ice":1}},
  prometheus: {"code":82,"axes":[1.9,0.68,0.78],"profile":{"craters":28,"depth":0.09,"roughness":0.007,"grooves":0.012,"low":[0.24,0.21,0.16],"high":[0.63,0.57,0.45],"ice":1}},
  pandora: {"code":83,"axes":[1.62,0.78,0.92],"profile":{"craters":40,"depth":0.075,"roughness":0.004,"grooves":0.02,"low":[0.25,0.23,0.19],"high":[0.57,0.55,0.46],"ice":1}},
  galatea: {"code":84,"axes":[1.24,0.87,0.97],"profile":{"craters":24,"depth":0.08,"roughness":0.007,"grooves":0.01,"low":[0.04,0.046,0.053],"high":[0.15,0.17,0.19],"ice":0}},
  despina: {"code":85,"axes":[1.15,0.89,1.03],"profile":{"craters":18,"depth":0.06,"roughness":0.006,"grooves":0.006,"low":[0.036,0.032,0.028],"high":[0.15,0.14,0.12],"ice":0}},
  kleopatra: {"code":86,"axes":[2.12,0.61,0.7],"profile":{"craters":28,"depth":0.08,"roughness":0.009,"grooves":0.012,"low":[0.095,0.092,0.085],"high":[0.29,0.28,0.25],"ice":0}},
  alexhelios: {"code":87,"axes":[1.07,0.94,0.98],"profile":{"craters":12,"depth":0.045,"roughness":0.005,"grooves":0.006,"low":[0.082,0.077,0.065],"high":[0.27,0.25,0.22],"ice":0}},
  cleoselene: {"code":88,"axes":[1.14,0.9,0.99],"profile":{"craters":16,"depth":0.05,"roughness":0.005,"grooves":0.004,"low":[0.071,0.081,0.089],"high":[0.24,0.27,0.29],"ice":0}},
  hygiea: {"code":89,"axes":[1.04,0.98,1],"profile":{"craters":6,"depth":0.025,"roughness":0.003,"grooves":0,"low":[0.049,0.052,0.058],"high":[0.17,0.18,0.2],"ice":0}},
  styx: {"code":90,"axes":[1.54,0.66,0.94],"profile":{"craters":12,"depth":0.035,"roughness":0.003,"grooves":0.003,"low":[0.2,0.22,0.23],"high":[0.55,0.59,0.59],"ice":1}},
  nix: {"code":91,"axes":[1.44,0.82,0.83],"profile":{"craters":24,"depth":0.055,"roughness":0.004,"grooves":0.004,"low":[0.27,0.28,0.26],"high":[0.68,0.69,0.63],"ice":1}},
  kerberos: {"code":92,"axes":[1.56,0.81,0.89],"profile":{"craters":16,"depth":0.04,"roughness":0.003,"grooves":0,"low":[0.28,0.28,0.24],"high":[0.64,0.65,0.57],"ice":1}},
  hydra: {"code":93,"axes":[1.57,0.73,0.9],"profile":{"craters":20,"depth":0.05,"roughness":0.0035,"grooves":0.003,"low":[0.3,0.32,0.29],"high":[0.71,0.75,0.67],"ice":1}},
  dysnomia: {"code":94,"axes":[1.05,0.96,1.01],"profile":{"craters":18,"depth":0.045,"roughness":0.004,"grooves":0.004,"low":[0.035,0.041,0.049],"high":[0.15,0.18,0.2],"ice":0}},
  hiiaka: {"code":95,"axes":[1.12,0.92,1.01],"profile":{"craters":14,"depth":0.035,"roughness":0.0025,"grooves":0.009,"low":[0.22,0.29,0.31],"high":[0.59,0.72,0.75],"ice":1}},
  namaka: {"code":96,"axes":[1.22,0.87,0.95],"profile":{"craters":26,"depth":0.07,"roughness":0.004,"grooves":0.002,"low":[0.27,0.29,0.25],"high":[0.63,0.69,0.58],"ice":1}},
  mk2: {"code":97,"axes":[1.08,0.96,0.99],"profile":{"craters":16,"depth":0.04,"roughness":0.003,"grooves":0.005,"low":[0.028,0.023,0.02],"high":[0.12,0.1,0.077],"ice":0}},
  orcus: {"code":114,"axes":[1.02,0.98,1],"profile":{"craters":10,"depth":0.0396,"roughness":0.0013,"grooves":0.004,"low":[0.18,0.23,0.27],"high":[0.59,0.67,0.7],"ice":1,"roundness":0.004,"basins":[[-0.9662286,0.2,0.0283261,0.64,0.027]],"patches":[[-0.9662286,0.2,0.0283261,0.7,0.7,0.78,0.81]]}},
  vanth: {"code":115,"axes":[1.12,0.91,1],"profile":{"craters":26,"depth":0.117,"roughness":0.0026,"grooves":0.008,"low":[0.09,0.055,0.035],"high":[0.36,0.24,0.16],"ice":0,"roundness":0.014,"basins":[[-0.5404273,-0.3,0.7003131,0.48,0.0975]],"patches":[[-0.5404273,-0.3,0.7003131,0.55,0.17,0.105,0.066]]}},
  gonggong: {"code":116,"axes":[1.025,0.975,1],"profile":{"craters":12,"depth":0.0486,"roughness":0.00182,"grooves":0.006,"low":[0.2,0.06,0.037],"high":[0.55,0.23,0.13],"ice":0,"roundness":0.004,"basins":[[-0.8048563,0.35,0.3036551,0.56,0.0345]],"patches":[[-0.2446207,0.9,0.1419885,0.5,0.51,0.38,0.29],[0.5226177,-0.2,0.7595201,0.6,0.3,0.085,0.047]]}},
  xiangliu: {"code":117,"axes":[1.25,0.86,0.94],"profile":{"craters":30,"depth":0.153,"roughness":0.00325,"grooves":0.007,"low":[0.032,0.03,0.032],"high":[0.17,0.16,0.17],"ice":0,"roundness":0.022,"basins":[[-0.6917964,0.25,-0.6620557,0.48,0.1275]],"patches":[[-0.6917964,0.25,-0.6620557,0.54,0.07,0.062,0.067]]}},
  salacia: {"code":118,"axes":[1.045,0.965,1],"profile":{"craters":8,"depth":0.0324,"roughness":0.001625,"grooves":0.01,"low":[0.065,0.085,0.1],"high":[0.27,0.33,0.37],"ice":1,"roundness":0.005,"basins":[[0.1135345,0.2,0.9599531,0.78,0.0375]],"patches":[[0.1135345,0.2,0.9599531,0.84,0.33,0.4,0.43]]}},
  actaea: {"code":119,"axes":[1.18,0.92,0.92],"profile":{"craters":20,"depth":0.081,"roughness":0.002275,"grooves":0.019,"low":[0.08,0.1,0.11],"high":[0.34,0.4,0.42],"ice":1,"roundness":0.014,"basins":[[0.8242808,0.1,0.5390372,0.52,0.06]],"patches":[[0.8242808,0.1,0.5390372,0.58,0.16,0.21,0.24]]}},
  varda: {"code":120,"axes":[1.07,0.9,1.07],"profile":{"craters":6,"depth":0.0288,"roughness":0.0013,"grooves":0.003,"low":[0.15,0.16,0.145],"high":[0.47,0.49,0.43],"ice":1,"roundness":0.004,"basins":[[0.4773964,-0.4,-0.7645866,0.64,0.0225]],"patches":[[0.4773964,-0.4,-0.7645866,0.7,0.59,0.59,0.51]]}},
  ilmare: {"code":121,"axes":[1.1,0.94,1.01],"profile":{"craters":16,"depth":0.0576,"roughness":0.001625,"grooves":0.009,"low":[0.13,0.145,0.15],"high":[0.44,0.48,0.47],"ice":1,"roundness":0.009,"basins":[[-0.5189448,0.35,-0.7804462,0.55,0.0525]],"patches":[[-0.5189448,0.35,-0.7804462,0.6,0.57,0.61,0.57]]}},
  varuna: {"code":122,"axes":[1.45,0.82,0.92],"profile":{"craters":10,"depth":0.045,"roughness":0.001625,"grooves":0.01,"low":[0.16,0.075,0.045],"high":[0.44,0.255,0.15],"ice":0,"roundness":0.004,"basins":[[0.9244832,0.3,0.2129102,0.65,0.0345]],"patches":[[0.9244832,0.3,0.2129102,0.7,0.3,0.15,0.085],[-0.7444427,-0.4,-0.4310511,0.65,0.53,0.33,0.21]]}},
  ixion: {"code":123,"axes":[1.04,0.97,1],"profile":{"craters":18,"depth":0.063,"roughness":0.00195,"grooves":0.005,"low":[0.18,0.085,0.05],"high":[0.48,0.3,0.19],"ice":0,"roundness":0.005,"basins":[[-0.9314788,0.2,0.2735822,0.58,0.0375]],"patches":[[-0.9314788,0.2,0.2735822,0.64,0.54,0.36,0.24],[0.8730275,-0.3,0.1944813,0.55,0.25,0.1,0.054]]}},
  weywot: {"code":124,"axes":[1.15,0.9,1.02],"profile":{"craters":24,"depth":0.117,"roughness":0.0026,"grooves":0.004,"low":[0.05,0.043,0.036],"high":[0.23,0.2,0.16],"ice":0,"roundness":0.019,"basins":[[0.6333517,0.1,-0.7542318,0.52,0.09]],"patches":[[0.6333517,0.1,-0.7542318,0.58,0.1,0.084,0.067]]}},
  ms4: {"code":125,"axes":[1.09,0.96,1],"profile":{"craters":6,"depth":0.036,"roughness":0.00182,"grooves":0.005,"low":[0.095,0.105,0.12],"high":[0.35,0.38,0.4],"ice":0,"roundness":0.004,"basins":[[0.9288642,0.2,-0.2676029,0.78,0.12]],"patches":[[0.9288642,0.2,-0.2676029,0.84,0.16,0.18,0.2]]}}
});
function missionEnvelope(kind, seed) {
  return Object.freeze(Array.from({length:24},(_,i)=>{
    const y=1-2*(i+.5)/24,angle=i*2.39996323,r=Math.sqrt(1-y*y);
    let distance=.82+(Math.sin(i*5.1+seed)*.5+.5)*.14;
    if(kind==='ryugu') distance=.99-Math.abs(y)*.29;
    if(kind==='steins') distance=.96-Math.max(0,-y)*.26-Math.max(0,y)*.06;
    if(kind==='gaspra') distance=.79+(Math.sin(i*3.7+seed)*.5+.5)*.19;
    return authoredCap([Math.cos(angle)*r,y,Math.sin(angle)*r],distance);
  }));
}
function lobe(centre,axes,seed) {
  // Twelve curved cuts soften the ellipsoid into worn, irregular shoulders.
  const caps=Array.from({length:12},(_,i)=>{
    const y=1-2*(i+.5)/12,a=i*2.39996323,r=Math.sqrt(1-y*y);
    return authoredCap([Math.cos(a)*r,y,Math.sin(a)*r],.90+Math.sin(i*3.7+seed)*.045);
  });
  return Object.freeze({centre:Object.freeze(centre),axes:Object.freeze(axes),caps:Object.freeze(caps)});
}
export const CONTACT_WORLD_SHAPES = Object.freeze({
  itokawa:Object.freeze([lobe([-.30,0,0],[.67,.66,.65],.3),lobe([.46,.02,0],[.48,.48,.50],2.1)]),
  rosettacomet:Object.freeze([lobe([-.27,-.10,0],[.65,.62,.59],1.4),lobe([.44,.28,.12],[.40,.36,.35],3.5)])
});

export const SMALL_WORLD_SHAPES = Object.freeze({
  ...Object.fromEntries(['ryugu','lutetia','ida','mathilde','psyche','gaspra','steins','dactyl'].map((key,i)=>[key,missionEnvelope(key,i*.73)])),
  eros: authoredEnvelope('eros'),
  bennu: authoredEnvelope('bennu'),
  proteus: authoredEnvelope('proteus'),
  vesta: Object.freeze([
    [0.6000000,-0.0000000,-0.0000000,2.3398205],
    [-0.6000000,-0.0000000,-0.0000000,2.4195646],
    [-0.0000000,0.6000000,-0.0000000,2.4370097],
    [-0.0000000,-0.6000000,-0.0000000,2.4468696],
    [-0.0000000,-0.0000000,0.6000000,2.3890644],
    [-0.0000000,-0.0000000,-0.6000000,2.4143730],
    [0.3464102,0.3464102,0.3464102,2.4559704],
    [0.3464102,0.3464102,-0.3464102,2.5098653],
    [0.3464102,-0.3464102,0.3464102,2.4261466],
    [0.3464102,-0.3464102,-0.3464102,2.3991969],
    [-0.3464102,0.3464102,0.3464102,2.5011813],
    [-0.3464102,0.3464102,-0.3464102,2.3612445],
    [-0.3464102,-0.3464102,0.3464102,2.4164251],
    [-0.3464102,-0.3464102,-0.3464102,2.3951377],
    [-0.2615339,-0.5400000,-0.0000000,2.3849954],
    [0.3159520,-0.4200000,-0.2894379,2.4442451],
    [-0.0454277,-0.3000000,0.5176257,2.4256037],
    [-0.3482482,-0.1800000,-0.4542281,2.3835881],
    [0.5878665,-0.0600000,0.1039853,2.3440583],
    [-0.5037156,0.0600000,0.3204226,2.4485329],
    [0.1485880,0.1800000,-0.5527401,2.4328425],
    [0.2394943,0.3000000,0.4611317,2.4756175],
    [-0.4024857,0.4200000,-0.1469871,2.4151041],
    [0.2417477,0.5400000,-0.0997899,2.5180875],
  ].map(cap => Object.freeze(cap))),
  phobos: Object.freeze([
    [0.6000000,-0.0000000,-0.0000000,2.1960307],
    [-0.6000000,-0.0000000,-0.0000000,2.0721933],
    [-0.0000000,0.6000000,-0.0000000,2.4373074],
    [-0.0000000,-0.6000000,-0.0000000,2.4692982],
    [-0.0000000,-0.0000000,0.6000000,2.2736069],
    [-0.0000000,-0.0000000,-0.6000000,2.3535512],
    [0.3464102,0.3464102,0.3464102,2.4012712],
    [0.3464102,0.3464102,-0.3464102,2.5388631],
    [0.3464102,-0.3464102,0.3464102,2.2205226],
    [0.3464102,-0.3464102,-0.3464102,2.3440583],
    [-0.3464102,0.3464102,0.3464102,2.1586476],
    [-0.3464102,0.3464102,-0.3464102,2.3999600],
    [-0.3464102,-0.3464102,0.3464102,2.2367668],
    [-0.3464102,-0.3464102,-0.3464102,2.3706867],
    [-0.2615339,-0.5400000,-0.0000000,2.3008491],
    [0.3159520,-0.4200000,-0.2894379,2.3772953],
    [-0.0454277,-0.3000000,0.5176257,2.3333890],
    [-0.3482482,-0.1800000,-0.4542281,2.3720131],
    [0.5878665,-0.0600000,0.1039853,2.1510325],
    [-0.5037156,0.0600000,0.3204226,1.9856031],
    [0.1485880,0.1800000,-0.5527401,2.3603481],
    [0.2394943,0.3000000,0.4611317,2.3002452],
    [-0.4024857,0.4200000,-0.1469871,2.3750974],
    [0.2417477,0.5400000,-0.0997899,2.5263692],
  ].map(cap => Object.freeze(cap))),
  deimos: Object.freeze([
    [0.6000000,-0.0000000,-0.0000000,2.2424641],
    [-0.6000000,-0.0000000,-0.0000000,2.4740670],
    [-0.0000000,0.6000000,-0.0000000,2.3831668],
    [-0.0000000,-0.6000000,-0.0000000,2.3402905],
    [-0.0000000,-0.0000000,0.6000000,2.2173745],
    [-0.0000000,-0.0000000,-0.6000000,2.4597560],
    [0.3464102,0.3464102,0.3464102,2.3623760],
    [0.3464102,0.3464102,-0.3464102,2.3016340],
    [0.3464102,-0.3464102,0.3464102,2.4653197],
    [0.3464102,-0.3464102,-0.3464102,2.1672933],
    [-0.3464102,0.3464102,0.3464102,2.3455419],
    [-0.3464102,0.3464102,-0.3464102,2.3475058],
    [-0.3464102,-0.3464102,0.3464102,2.4031645],
    [-0.3464102,-0.3464102,-0.3464102,2.2224612],
    [-0.2615339,-0.5400000,-0.0000000,2.2861248],
    [0.3159520,-0.4200000,-0.2894379,2.2615684],
    [-0.0454277,-0.3000000,0.5176257,2.1965167],
    [-0.3482482,-0.1800000,-0.4542281,2.2837843],
    [0.5878665,-0.0600000,0.1039853,2.1994064],
    [-0.5037156,0.0600000,0.3204226,2.3986496],
    [0.1485880,0.1800000,-0.5527401,2.3742057],
    [0.2394943,0.3000000,0.4611317,2.2700945],
    [-0.4024857,0.4200000,-0.1469871,2.2473800],
    [0.2417477,0.5400000,-0.0997899,2.4742034],
  ].map(cap => Object.freeze(cap))),
});

// Authored negative spherical pits. Their placement/depth is illustrative,
// not a measured crater catalogue. Solid rays subtract these same cavities.
export const SMALL_WORLD_CAVITIES = Object.freeze({
  mathilde:Object.freeze([[1.00,.12,.20,.30],[-.30,.15,1.00,.28],[-.68,-.18,-.71,.25]].map(p=>Object.freeze(p))),
  steins:Object.freeze([[.08,.99,.12,.16]].map(p=>Object.freeze(p)))
});
