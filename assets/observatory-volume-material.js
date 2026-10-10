// Analytic finite Gaussian volumes share a ray integral, rather than another
// particle catalogue or ray-march target. Geometry remains in body-radius units.
export const VOLUME_NOISE_PERIOD = 32;
export const VOLUME_NOISE_WGSL = /* wgsl */ `
// The cached field is already smooth in space. Reapplying a cell fade here
// would flatten every cell boundary and expose a lattice in thresholded clouds.
fn volumeNoise3(p:vec3f) -> f32 {
  return textureSampleLevel(nebulaNoise,surfaceSampler,
    (p+vec3f(${VOLUME_NOISE_PERIOD / 2}.0))/${VOLUME_NOISE_PERIOD}.0,0.0).r;
}
`;
export const VOLUME_LIGHT_WGSL = /* wgsl */ `
// A finite emitter sees only the portion of a ray segment in front of it.
// Depths behind the observer contribute zero, including unused light slots.
// A bounded local illumination cue, not a new emitter or a shadow ray.
// A cloud face opening toward an existing light is brighter than matter with
// a denser lightward neighbour. Neither density nor camera extinction changes.
fn volumeCloudIllumination(mass:f32,lightwardMass:f32,probeLength:f32) -> f32 {
  let current=max(0.0,mass);let neighbour=max(0.0,lightwardMass);
  if(current<.000001 || probeLength<=0.0) {return 1.0;}
  let exposed=clamp((current-neighbour)/max(.0001,current+neighbour),0.0,1.0);
  return .28+exp(-neighbour*probeLength*2.0)*(.60+exposed*1.60);
}
fn volumeLightColumn(depth:vec4f,start:f32,end:f32,extinction:f32) -> vec4f {
  return clamp(depth-vec4f(start),vec4f(0.0),vec4f(max(0.0,end-start)))*extinction;
}
`;
export const GAUSSIAN_VOLUME_WGSL = /* wgsl */ `
fn gaussianRayDensity(center: vec3f, ray: vec3f, axis: vec3f, side: vec3f, sigma: vec3f, limit: f32) -> f32 {
  let up = cross(axis,side);
  let source = vec3f(dot(center,axis),dot(center,side),dot(center,up))/sigma;
  let direction = vec3f(dot(ray,axis),dot(ray,side),dot(ray,up))/sigma;
  let magnitude = dot(direction,direction);
  let along = dot(source,direction)/magnitude;
  let closest = source-direction*along;
  let inverseWidth = sqrt(magnitude);
  let clip = smoothstep(-1.8,1.8,(limit-along)*inverseWidth)-smoothstep(-1.8,1.8,-along*inverseWidth);
  return exp(-dot(closest,closest)*0.5)*2.5066/inverseWidth*clip;
}
`;
