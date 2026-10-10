import { SOLID_GEOMETRY_WGSL } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
import { SOLAR_MATERIAL_WGSL } from './observatory-solar-material.js?v=cosmic-explore-20261010gu';
import { SATELLITE_MAP_WGSL, SATELLITE_MATERIAL_WGSL } from './observatory-satellite-material.js?v=cosmic-explore-20261010gu';
import { STELLAR_MATERIAL_WGSL } from './observatory-stellar-material.js?v=cosmic-explore-20261010gu';
import { BODY_MATERIAL_WGSL, PLANET_MATERIAL_WGSL, REFLECTED_LIGHT_WGSL } from './observatory-planet-material.js?v=cosmic-explore-20261010gu';
import { JUPITER_MATERIAL_WGSL } from './observatory-jupiter-material.js?v=cosmic-explore-20261010gu';
import { NEBULA_MATERIAL_WGSL } from './observatory-nebula-material.js?v=cosmic-explore-20261010gu';
import { GALAXY_FIELD_WGSL, GALAXY_MATERIAL_WGSL } from './observatory-galaxy-material.js?v=cosmic-explore-20261010gu';
import { COMET_MATERIAL_WGSL } from './observatory-comet-material.js?v=cosmic-explore-20261010gu';
import { GAUSSIAN_VOLUME_WGSL, VOLUME_NOISE_WGSL, VOLUME_LIGHT_WGSL } from './observatory-volume-material.js?v=cosmic-explore-20261010gu';
import { PULSAR_MATERIAL_WGSL } from './observatory-pulsar-material.js?v=cosmic-explore-20261010gu';
import { BLACKHOLE_MATERIAL_WGSL } from './observatory-blackhole-material.js?v=cosmic-explore-20261010gu';
import { SCENE_MOTION_WGSL } from './observatory-motion.js?v=cosmic-explore-20261010gu';
import { GALACTIC_MATERIAL_WGSL } from './observatory-galactic-material.js?v=cosmic-explore-20261010gu';
import { POINT_COVERAGE_WGSL } from './observatory-bodies.js?v=cosmic-explore-20261010gu';

// Scene radiance stays linear and unclipped until the final display transform.
const frame = /* wgsl */ `
struct Frame {
  right: vec4f,
  up: vec4f,
  forward: vec4f,
  eye: vec4f,
  viewport: vec4f,
  focus: vec4f,
  star: vec4f,
  presentation: vec4f,
  style: vec4f,
  localStar: vec4f,
  journey: vec4f,
  motion: vec4f,
  light: vec4f,
  rings: vec4f,
  sun: vec4f,
  composition: vec4f,
  quality: vec4f,
  illuminant: vec4f,
};
@group(0) @binding(0) var<uniform> f: Frame;
@group(0) @binding(1) var surfaceNoise: texture_2d<f32>;
@group(0) @binding(2) var surfaceSampler: sampler;
@group(0) @binding(3) var deepSky: texture_cube<f32>;
@group(0) @binding(4) var skySampler: sampler;
@group(0) @binding(5) var earthMap: texture_2d<f32>;
@group(0) @binding(6) var moonMap: texture_2d<f32>;
@group(0) @binding(7) var moonHeight: texture_2d<f32>;
@group(0) @binding(8) var earthClouds: texture_2d<f32>;
@group(0) @binding(9) var marsMap: texture_2d<f32>;
@group(0) @binding(10) var jupiterMap: texture_2d<f32>;
@group(0) @binding(11) var mercuryMap: texture_2d<f32>;
@group(0) @binding(12) var satelliteMaps: texture_2d_array<f32>;
@group(0) @binding(15) var nebulaNoise: texture_3d<f32>;
const CORNERS = array<vec2f, 4>(
  vec2f(-1,-1), vec2f(1,-1), vec2f(-1,1), vec2f(1,1)
);
fn sceneRay(pixel: vec2f) -> vec3f {
  let ndc = pixel / f.viewport.zw * 2.0 - 1.0 - f.composition.xy;
  return normalize(f.forward.xyz + f.right.xyz * ndc.x * f.right.w * f.up.w - f.up.xyz * ndc.y * f.right.w);
}
`;

export const POINT_SHADER = frame + VOLUME_NOISE_WGSL + POINT_COVERAGE_WGSL + SOLID_GEOMETRY_WGSL + SATELLITE_MAP_WGSL + SCENE_MOTION_WGSL + GALACTIC_MATERIAL_WGSL + REFLECTED_LIGHT_WGSL + BODY_MATERIAL_WGSL + SOLAR_MATERIAL_WGSL + STELLAR_MATERIAL_WGSL + PLANET_MATERIAL_WGSL + JUPITER_MATERIAL_WGSL + GAUSSIAN_VOLUME_WGSL + SATELLITE_MATERIAL_WGSL + GALAXY_FIELD_WGSL + /* wgsl */ `
struct BodyLighting { direction:vec4f, color:vec4f };
@group(0) @binding(16) var<storage,read> bodyLighting:array<BodyLighting>;
struct Out {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec3f,
  @location(2) energy: f32,
  @location(3) kind: f32,
  @location(4) geometry: vec4f,
  @location(5) material: f32,
  @location(6) diskRadius: f32,
  @location(7) sunlight: vec3f,
  @location(8) footprint: f32,
  @location(9) appearance: vec4f,
  @location(10) rings: vec4f,
  @location(11) lightColor: vec3f,
};
@vertex fn vs(
  @builtin(vertex_index) v: u32,
  @builtin(instance_index) instance: u32,
  @location(0) positionSize: vec4f,
  @location(1) colorEnergy: vec4f,
  @location(2) identity: vec4f,
  @location(3) appearance: vec4f,
  @location(4) rings: vec4f
) -> Out {
  let kind = identity.y;
  let isSky = kind > 1.5 && kind < 2.5;
  let isTransit = kind > 2.5 && kind < 3.5;
  let isGalaxyLight = kind > 7.5 && kind < 8.5;
  let isGalaxyReference = kind > 8.1 && kind < 8.5;
  let isGalaxy = kind > 6.5 && kind < 7.5;
  let isStellarReference = kind > 12.5 && kind < 13.5;
  let isOutskirts = kind > 1.1 && kind < 1.5;
  let isGalacticStar = kind < .5 || isOutskirts;
  let isBody = kind < 0.5 || (kind > 3.5 && kind < 7.5) || kind > 8.5;
  let isActive = abs(identity.x - f.style.x) < 0.25 && isBody;
  let isReflective = (kind > 3.5 && kind < 4.5) || (kind > 5.5 && kind < 6.5);
  let isAreaSource = isReflective || (kind > 4.5 && kind < 5.5);
  var relative = positionSize.xyz - f.eye.xyz;
  if (kind > 3.5 && !isGalaxyLight) { relative = positionSize.xyz; }
  var flowFade=1.0;
  if (kind < 1.5) { relative = galacticMotionWorld(positionSize.xyz) - f.eye.xyz; }
  if (isActive) { relative = f.localStar.xyz; }
  if (isGalaxyReference) {
    relative = galaxyMotionWorldFor(positionSize.xyz-appearance.xyz,rings)+appearance.xyz-f.eye.xyz;
  } else if (isGalaxyLight && abs(identity.x-f.style.x)<0.25) {
    relative = galaxyMotionWorld(positionSize.xyz-f.focus.xyz)+f.localStar.xyz;
  }
  if (isSky) { relative = positionSize.xyz * 500.0; }
  if (isTransit) {
    let flow=localFlowPoint(positionSize.xyz,identity.z);
    relative = flow.xyz * f.focus.w + f.localStar.xyz;
    flowFade=flow.w;
  }
  let depth = dot(relative, f.forward.xyz);
  let safeDepth = max(depth, 0.0000001);
  let lens = f.right.w;
  let center = vec2f(dot(relative, f.right.xyz) / (safeDepth * lens * f.up.w),
    dot(relative, f.up.xyz) / (safeDepth * lens));
  let isWorld = isReflective || kind > 11.5;
  let diskRadius = select(0.0, identity.w * f.viewport.y / (2.0 * f.right.w * safeDepth), isWorld && !isActive);
  let hover = abs(identity.x - f.style.y) < 0.25 && isBody;
  let proximity = clamp(sqrt(30.0 / max(safeDepth, 0.20)), 0.7, 2.8);
  let coreRadius = clamp(positionSize.w * (0.48 + proximity * 0.32), 0.48, 3.0);
  let sourceRadius = identity.w * f.viewport.y / (2.0 * lens * safeDepth);
  let unresolved = smoothstep(24.0,84.0,length(relative));
  var radius = coreRadius * 6.0;
  // A small reflected source has no stellar halo or selection-driven emission.
  if (isReflective) { radius = coreRadius * 2.6; }
  if (isAreaSource) { radius = clamp(sourceRadius * 3.0, 1.5, 18.0); }
  if (isGalaxy) {
    let worldRadius=identity.w*f.viewport.y/(2.0*f.right.w*safeDepth);
    let tangent=1.0/sqrt(max(.04,1.0-pow(identity.w*2.35/safeDepth,2.0)));
    radius=max(14.0,worldRadius*2.5*tangent);
  }
  if ((kind<0.5 || isStellarReference) && !isActive) { radius*=1.0-f.journey.x*0.40; }
  if (kind > 0.5 && kind < 1.5) { radius = positionSize.w * 13.0; }
  if (isOutskirts) { radius = coreRadius * 5.0; }
  if (isSky) { radius = max(0.42, positionSize.w) * 5.0; }
  if (isTransit) { radius = max(0.8, positionSize.w * 3.8); }
  if (isGalaxyLight) { radius = positionSize.w * mix(4.0, 8.0, 1.0-smoothstep(1.0, 4.0, f.eye.w / f.focus.w)); }
  if (isGalaxyReference) { radius = positionSize.w * mix(4.0, 8.0, 1.0-smoothstep(1.0, 4.0, length(appearance.xyz-f.eye.xyz)/appearance.w)); }
  if (isGalacticStar && !isActive) { radius *= mix(1.0,.62,unresolved); }
  if (isBody && !isActive && !isGalaxy) { radius *= 1.0 - f.journey.y * 0.45; }
  if (diskRadius > 0.55) {
    // A ring's conservative spherical envelope also covers perspective expansion
    // near its front edge. The surface shader still intersects the true plane.
    let axes=satelliteAxes(identity.z);
    let extent=max(max(1.0,rings.y),max(axes.x,max(axes.y,axes.z)));
    let tangent=1.0/sqrt(max(0.04,1.0-pow(extent*identity.w/safeDepth,2.0)));
    radius=max(radius,diskRadius*max(1.35,extent*tangent*1.08));
  }
  let diskHandoff = smoothstep(0.55, 3.5, f.presentation.x);
  var opacity = 1.0 - smoothstep(30.0, 260.0, f.presentation.x) * 0.62;
  if (isBody) { opacity *= 1.0 - f.journey.y * 0.70; }
  // The catalog recedes into the distant field during close observation.
  // Keep the Sun and finite parent bodies on their existing reference path.
  if ((kind < 0.5 || isStellarReference) && !isActive && identity.x > 0.5) {
    opacity *= mix(1.0, 0.20, f.journey.y);
  }
  if (isActive) { opacity = 1.0 - diskHandoff; }
  if (kind<.5 && !isActive) { opacity*=galacticOuterFade(positionSize.xyz); }
  if (kind > 0.5 && kind < 1.5) {
    let stream=0.78+sin(length(positionSize.xz)*0.75-f.forward.w*0.32+identity.z*4.0)*0.22;
    opacity = f.journey.x*select(stream,1.0,isOutskirts);
  }
  if (isSky) { opacity = mix(0.86, 0.40, f.journey.y)*mix(1.35,1.0,f.motion.z); }
  if (isTransit) { opacity = f.journey.z * (1.1 + abs(f.motion.x) * 2.8)*flowFade; }
  if (isGalaxyLight) {
    // The same prefix transfers to the selected, foreground-column pass.
    // Only additional interior samples fade in as the owner is approached.
    opacity = select(0.0, diskHandoff, abs(identity.x-f.style.x)<0.25) * mix(smoothstep(12.0,120.0,f.presentation.x),smoothstep(4.0,20.0,f.presentation.x),appearance.x);
  }
  if (isGalaxyReference) {
    let ownerDepth=dot(appearance.xyz-f.eye.xyz,f.forward.xyz);
    let ownerRadius=appearance.w*f.viewport.y/(2.0*lens*max(ownerDepth,0.0000001));
    opacity=select(smoothstep(4.0,20.0,ownerRadius),0.0,abs(identity.x-f.style.x)<.25);
  }
  // Distant unresolved stars contribute to the shared continuous stellar
  // field, rather than retaining a full-strength screen-sized grain.
  if (isGalacticStar && !isActive) { opacity *= mix(1.0,.25,unresolved); }
  if (isAreaSource) { opacity *= surfacePointCoverage(sourceRadius); }
  if (isSky || isTransit || (kind > 0.5 && kind < 1.5) || ((kind < 0.5 || isStellarReference) && !isActive)) {
    opacity *= mix(1.0, 0.24, f.motion.w);
  }
  var highlight = select(select(1.0, 1.5, hover), 2.3, isActive);
  var reflection = 1.0;
  var sunlight = normalize(f.sun.xyz - relative);
  var lightColor = vec3f(1.0);
  if (isReflective) {
    let lighting=bodyLighting[instance-u32(f.illuminant.w)];
    sunlight=lighting.direction.xyz; lightColor=lighting.color.rgb;
    if (isActive) { sunlight = f.light.xyz; lightColor=f.illuminant.rgb; }
    highlight = 1.0;
    reflection = 0.026 + reflectedPhase(sunlight, normalize(-relative)) * 0.974;
  }
  var out: Out;
  let corner = CORNERS[v];
  // Trim only the low quality dust wings; the Gaussian centre keeps its scale.
  let footprint = select(1.0, 0.53, f.quality.y < 3.5 && kind > 0.5 && kind < 1.5);
  var offset = corner * radius * footprint;
  if (isTransit) {
    let axis = normalize(center * vec2f(f.up.w, 1.0) + vec2f(0.0001));
    let tangent = vec2f(-axis.y, axis.x);
    let length = radius*1.15 + abs(f.motion.x) * (3.0 + identity.z * 7.0);
    offset = axis * corner.x * length + tangent * corner.y * radius;
  }
  out.position = vec4f(center + vec2f(f.composition.x, -f.composition.y) + offset * vec2f(2.0 / f.viewport.x, 2.0 / f.viewport.y), 0.0, 1.0);
  out.uv = corner * footprint;
  out.footprint = footprint;
  out.color = select(colorEnergy.rgb,vec3f(1.0),isGalaxy);
  // Fully clipped billboards contribute no light or extinction. Keep their
  // conservative footprint so the visible edge uses the same space field.
  let screenCenter = center + vec2f(f.composition.x, -f.composition.y);
  let visible = depth > 0.0000001 && all(abs(screenCenter) < vec2f(1.0) + radius * 2.0 / f.viewport.xy);
  if (visible && opacity > 0.00001 && f.journey.x > 0.001 &&
      ((!isActive && (kind < 1.5 || isSky || (kind > 3.5 && !isGalaxyLight) || isGalaxyReference)) || isAreaSource)) {
    let eye = galacticMotionPoint(f.eye.xyz);
    let world = select(positionSize.xyz, eye + galacticMotionPoint(relative), isSky || (kind > 3.5 && !isGalaxyLight) || isGalaxyReference);
    let path = world - eye;
    let distance = length(path);
    let transmission = mix(vec3f(1.0), galacticTransmission(galacticColumn(eye, path / max(distance, 0.000001), distance)), f.journey.x);
    if (isReflective) { lightColor *= transmission; } else { out.color *= transmission; }
    if (kind > 0.5 && kind < 1.1) { opacity *= galacticScatter(positionSize.xyz)*galacticOuterFade(positionSize.xyz); }
  }
  if (isGalaxyReference && visible && opacity>.00001) {
    out.color *= galaxyLightTransmissionFor(relative,appearance.xyz-f.eye.xyz,appearance.w,identity.z,0.0,rings);
  } else if (isGalaxyLight && !isGalaxyReference && visible && opacity>.00001 && abs(identity.x-f.style.x)<.25) {
    out.color *= galaxyLightTransmission(relative);
  }
  if (isGalaxyLight) {
    let owner=select(f.localStar.xyz,appearance.xyz-f.eye.xyz,isGalaxyReference);
    let ownerRadius=select(f.focus.w,appearance.w,isGalaxyReference);
    let response=galaxyResolutionResponse(ownerRadius*f.viewport.w/(2.0*lens*max(length(owner),.000001)));
    out.color=galaxyResolvedLight(out.color,response);
  }
  if (isTransit) { out.color = mix(colorEnergy.rgb, vec3f(1.0, 0.64, 0.30), f.journey.w * 0.6); }
  out.energy = colorEnergy.w * highlight * reflection * opacity * select(0.0, 1.0, depth > 0.0000001);
  if (isGalaxy) {
    let inside=length(relative)<identity.w*2.5;
    if(inside) {out.position=vec4f(corner,0.0,1.0);}
    out.energy=select(1.0,1.0-diskHandoff,isActive)*select(0.0,1.0,depth>0.0000001 || inside);
  }
  if (kind > 0.5 && kind < 1.5) { out.energy *= f.presentation.y; }
  out.kind = kind;
  out.geometry = vec4f(relative, max(identity.w, 0.0000001));
  out.material = identity.z;
  out.diskRadius = diskRadius;
  out.sunlight = sunlight;
  out.lightColor = lightColor;
  out.appearance = appearance;
  out.rings = rings;
  return out;
}
// Gaussian reconstruction integrates the actual drawing-pixel footprint.
// Its normalisation preserves analytic Gaussian energy instead of brightening
// low-resolution stars or increasing the point/bloom budget. The existing
// finite quad still clips the negligible outer tails; no exact finite-flux claim.
fn pointGaussian(radius2:f32,sharpness:f32,variance:f32) -> f32 {
  let width=1.0+2.0*sharpness*variance;
  return exp(-radius2*sharpness/width)/width;
}
@fragment fn fs(in: Out) -> @location(0) vec4f {
  let pixel=fwidth(in.uv);
  let pixelVariance=max(pixel.x*pixel.x,pixel.y*pixel.y)/12.0;
  if (in.kind>6.5 && in.kind<7.5) {
    if(in.energy<.00001) {discard;}
    let volume=galaxyDistantFragment(in.geometry.xyz/in.geometry.w,sceneRay(in.position.xy),in.material,in.rings);
    if(volume.a<.00001) {discard;}
    return vec4f(volume.rgb*in.color,volume.a)*in.energy;
  }
  if (in.diskRadius > 0.55) {
    let ray = sceneRay(in.position.xy);
    let center = in.geometry.xyz / in.geometry.w;
    let along = dot(center, ray);
    let impact2 = dot(center - ray * along, center - ray * along);
    if (in.kind > 11.5 && along > 0.0 && impact2 < 1.0) {
      // Finite stellar references use their own field and the shared clock.
      // Retain the unresolved point during the small disk handoff; replacing
      // it with a nearly transparent sphere alone made the companion vanish.
      let t = along-sqrt(max(1.0-impact2,0.0));
      let normal = normalize(ray*t-center);
      let rasterRadius=in.diskRadius*min(f.viewport.z/f.viewport.x,f.viewport.w/f.viewport.y);
      let nearDetail=(1.0-smoothstep(3.6,6.5,length(center)))*smoothstep(42.0,135.0,rasterRadius);
      let p=stellarBodyDirection(normal,in.appearance.y,f.presentation.z);
      let whiteDwarf=in.material>30.5;
      let field=stellarFamilyRadiance(p,normal,ray,in.color,in.appearance.y,in.geometry.w,rasterRadius,nearDetail,whiteDwarf);
      let light=select(mix(in.color*3.8,field,smoothstep(2.0,18.0,in.diskRadius)),field,whiteDwarf);
      let edge = smoothstep(0.0,min(.18,1.35/max(rasterRadius,1.0)),1.0-sqrt(impact2));
      let alpha = edge*smoothstep(0.55,3.5,in.diskRadius);
      let r2=dot(in.uv,in.uv);
      let point=select(pointGaussian(r2,38.0,pixelVariance)*.56+pointGaussian(r2,7.0,pixelVariance)*.035,
        pointGaussian(r2,66.0,pixelVariance)*1.28+pointGaussian(r2,13.0,pixelVariance)*.034+pointGaussian(r2,4.5,pixelVariance)*.004,in.kind>12.5);
      let unresolved=in.color*point*in.energy*(1.0-smoothstep(.55,3.5,in.diskRadius));
      return vec4f(light*alpha+unresolved,alpha);
    }
    if (along > 0.0 && in.kind < 11.5) {
      var material=bodyMaterial(in.material,in.appearance.x,in.appearance.y,in.sunlight,in.rings,in.diskRadius,length(center),in.color);
      material.lightColor=in.lightColor;
      let world=planetFragment(center,ray,impact2,along,material);
      if (world.a>0.0) { return world; }
    }
    if (in.diskRadius >= 3.5) { discard; }
  }
  let r2 = dot(in.uv, in.uv);
  if (r2 > in.footprint * in.footprint || in.energy < 0.00001) { discard; }
  var profile = pointGaussian(r2,66.0,pixelVariance) * 1.28 + pointGaussian(r2,13.0,pixelVariance) * 0.034 + pointGaussian(r2,4.5,pixelVariance) * 0.004;
  if (in.kind > 0.5 && in.kind < 1.5) { profile = pointGaussian(r2,5.5,pixelVariance) * 0.10; }
  if (in.kind > 1.1 && in.kind < 1.5) { profile=pointGaussian(r2,55.0,pixelVariance)*.90+pointGaussian(r2,9.0,pixelVariance)*.018; }
  if (in.kind > 2.5 && in.kind < 3.5) { profile = pointGaussian(r2,5.5,pixelVariance) * 0.42; }
  if (in.kind > 3.5) { profile = pointGaussian(r2,38.0,pixelVariance) * 0.75; }
  if ((in.kind > 3.5 && in.kind < 4.5) || (in.kind > 5.5 && in.kind < 6.5)) {
    profile = pointGaussian(r2,10.0,pixelVariance) * 0.75;
  }
  if (in.kind > 4.5 && in.kind < 5.5) { profile = pointGaussian(r2,7.0,pixelVariance) * (0.20 + sin(in.uv.x * 8.0 + in.uv.y * 6.0) * 0.04); }

  if (in.kind > 7.5 && in.kind < 8.5) { profile = pointGaussian(r2,35.0,pixelVariance) * 1.8 + pointGaussian(r2,7.0,pixelVariance) * 0.025; }
  if (in.kind > 8.5) { profile = pointGaussian(r2,38.0,pixelVariance) * 0.56 + pointGaussian(r2,7.0,pixelVariance) * 0.035; }
  if (in.kind > 12.5) { profile = pointGaussian(r2,66.0,pixelVariance)*1.28+pointGaussian(r2,13.0,pixelVariance)*.034+pointGaussian(r2,4.5,pixelVariance)*.004; }
  if (in.footprint < 1.0) {
    let support2 = in.footprint * in.footprint;
    profile *= 1.0 - smoothstep(support2 * 0.74, support2, r2);
  }
  return vec4f(in.color * in.lightColor * profile * in.energy * (1.0-smoothstep(0.55,3.5,in.diskRadius)), 0.0);
}
`;

export const SURFACE_SHADER = frame + VOLUME_NOISE_WGSL + VOLUME_LIGHT_WGSL + SOLID_GEOMETRY_WGSL + SATELLITE_MAP_WGSL + SCENE_MOTION_WGSL + /* wgsl */ `
struct Out { @builtin(position) position: vec4f };
@vertex fn vs(@builtin(vertex_index) v: u32) -> Out {
  let relative = f.localStar.xyz;
  let depth = max(dot(relative, f.forward.xyz), 0.0000001);
  let center = vec2f(dot(relative, f.right.xyz) / (depth * f.right.w * f.up.w),
    dot(relative, f.up.xyz) / (depth * f.right.w));
  var bodyExtent=4.0;
  let ringTangent=1.0/sqrt(max(.04,1.0-pow(f.rings.y*f.focus.w/depth,2.0)));
  bodyExtent=max(bodyExtent,f.rings.y*ringTangent*1.08);
  if (isCometMaterial()) { bodyExtent=44.0; }
  if ((f.style.w>8.5 && f.style.w<9.5) || (f.style.w>28.5 && f.style.w<29.5)) { bodyExtent=24.0; }
  if (f.style.w>9.5 && f.style.w<10.5) { bodyExtent=5.0; }
  if (blackHoleHasJet()) { bodyExtent=24.0; }
  let extent = min(max(f.presentation.x * bodyExtent, 12.0), max(f.viewport.x, f.viewport.y) * 1.5);
  var out: Out;
  out.position = vec4f(center + vec2f(f.composition.x, -f.composition.y) + CORNERS[v] * vec2f(2.0 * extent / f.viewport.x, 2.0 * extent / f.viewport.y), 0, 1);
  return out;
}
fn compactCoreCoverage(impact: f32) -> f32 {
  // Coverage straddles the geometric silhouette. Derivatives follow the
  // actual display raster and off-axis perspective, rather than shrinking it.
  let pixel=max(length(vec2f(dpdx(impact),dpdy(impact))),0.000001);
  return 1.0-smoothstep(-pixel*.65,pixel*.65,impact-1.0);
}
` + REFLECTED_LIGHT_WGSL + BODY_MATERIAL_WGSL + SOLAR_MATERIAL_WGSL + STELLAR_MATERIAL_WGSL + PLANET_MATERIAL_WGSL + JUPITER_MATERIAL_WGSL + NEBULA_MATERIAL_WGSL + GALAXY_MATERIAL_WGSL + GAUSSIAN_VOLUME_WGSL + SATELLITE_MATERIAL_WGSL + COMET_MATERIAL_WGSL + PULSAR_MATERIAL_WGSL + BLACKHOLE_MATERIAL_WGSL + /* wgsl */ `
fn bodyFragment(ray: vec3f) -> vec4f {
  // The active body is intersected in star-radius units to preserve precision.
  let center = f.localStar.xyz / f.focus.w;
  let alongRay = dot(center, ray);
  let closest = center - ray * alongRay;
  let impact2 = dot(closest, closest);
  // Local gas/remnant axes follow their catalog frame and authored arrival.
  // Rotate both inputs; lengths and intersections stay in the same lens.
  if (isNebulaMaterial()) { return nebulaFragment(galacticMotionPoint(center), galacticMotionPoint(ray), impact2, alongRay); }
  if (isGalaxyMaterial()) { return galaxyFragment(center, ray); }
  if (isCometMaterial()) { return cometNucleusFragment(center,ray); }
  if ((f.style.w > 8.5 && f.style.w < 9.5) || (f.style.w > 28.5 && f.style.w < 29.5)) { return pulsarCoreFragment(galacticMotionPoint(center),galacticMotionPoint(ray)); }
  if ((f.style.w > 9.5 && f.style.w < 10.5) || (f.style.w > 29.5 && f.style.w < 30.5)) { return blackHoleShadowFragment(center,ray); }
  if (f.style.w > 30.5 && f.style.w < 31.5) { return whiteDwarfFragment(center,ray,impact2,alongRay); }
  if (alongRay < 0.0 || impact2 > max(16.0,f.rings.y*f.rings.y)) { discard; }
  if (f.style.w > 0.5) { return planetFragment(center, ray, impact2, alongRay, observedBodyMaterial()); }
  let impact = sqrt(impact2);
  let resolved = smoothstep(0.55, 3.5, f.presentation.x);
  let edge = smoothstep(0.0, bodyEdgeWidth(), 1.0-impact);
  let alpha = edge * resolved;
  // The opaque photosphere completely covers the low corona. Only the limb
  // and uncovered rays need that shading; foreground strands stay independent.
  var corona = vec3f(0.0);
  if (alpha < 1.0) {
    corona = stellarCoronaRadiance(closest, ray, impact) * (1.0 - smoothstep(2.7, 4.0, impact));
  }
  let arcs = stellarCoronalArcs(closest, ray) * resolved;
  let activity = stellarWarmRadiance() * arcs.x;
  if (impact2 > 1.0) {
    return vec4f(corona * resolved + activity, 0.0);
  }
  let t = alongRay - sqrt(max(1.0 - impact2, 0.0));
  let normal = normalize(ray*t - center);
  let radiance = mix(f.star.rgb * 3.8, stellarSurfaceRadiance(normal, ray), smoothstep(2.0, 18.0, f.presentation.x));
  // Cooler foreground filaments retain contrast against the photosphere;
  // the same geometric strands emit against space at the limb.
  return vec4f(radiance * alpha * (1.0-arcs.y) + corona * (1.0-alpha) * resolved + activity, alpha);
}
@fragment fn fs(in: Out) -> @location(0) vec4f {
  return bodyFragment(sceneRay(in.position.xy));
}
@fragment fn fsVolume(in: Out) -> @location(0) vec4f {
  let ray = sceneRay(in.position.xy*f.viewport.zw/f.quality.zw);
  let center=f.localStar.xyz/f.focus.w;
  let closest=center-ray*dot(center,ray);let clipCore=dot(closest,closest)<1.0;
  if (f.style.w>16.5 && f.style.w<17.5) { return enceladusPlumes(f.localStar.xyz/f.focus.w,ray); }
  if (isCometMaterial()) { return cometVolumeFragment(f.localStar.xyz/f.focus.w,ray); }
  if ((f.style.w > 8.5 && f.style.w < 9.5) || (f.style.w > 28.5 && f.style.w < 29.5)) { return pulsarVolumeFragment(galacticMotionPoint(center),galacticMotionPoint(ray),clipCore); }
  if (f.style.w > 9.5 && f.style.w < 10.5) { return blackHoleVolumeFragment(galacticMotionPoint(center),galacticMotionPoint(ray),clipCore); }
  if (f.style.w > 29.5 && f.style.w < 30.5) { return blackHoleVolumeFragment(center,ray,clipCore); }
  return bodyFragment(ray);
}
@group(1) @binding(0) var compactVolume: texture_2d<f32>;
@group(1) @binding(1) var compactSampler: sampler;
@vertex fn vsVolumeResolve(@builtin(vertex_index) v:u32) -> Out {
  let positions=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var out:Out;out.position=vec4f(positions[v],0,1);return out;
}
fn compactVolumeAt(center:vec3f,ray:vec3f,clipCore:bool)->vec4f {
  if ((f.style.w>8.5 && f.style.w<9.5) || (f.style.w>28.5 && f.style.w<29.5)) {
    return pulsarVolumeFragment(galacticMotionPoint(center),galacticMotionPoint(ray),clipCore);
  }
  if (f.style.w>9.5 && f.style.w<10.5) {
    return blackHoleVolumeFragment(galacticMotionPoint(center),galacticMotionPoint(ray),clipCore);
  }
  return blackHoleVolumeFragment(center,ray,clipCore);
}
@fragment fn fsVolumeResolve(in:Out)->@location(0) vec4f {
  let sampled=textureSampleLevel(compactVolume,compactSampler,in.position.xy/f.viewport.zw,0.0);
  let ray=sceneRay(in.position.xy);let center=f.localStar.xyz/f.focus.w;
  let along=dot(center,ray);let impact=length(center-ray*along);
  let pixel=max(length(vec2f(dpdx(impact),dpdy(impact))),0.000001);
  let coverage=compactCoreCoverage(impact);
  // Re-evaluate only a narrow display-pixel rim. Everywhere else retains the
  // bounded volume target and its original reconstruction. The two limits
  // distinguish foreground plasma from light behind a partly covered pixel.
  let support=pixel*max(2.0,1.5*f.viewport.w/f.quality.w);
  if (f.presentation.x<12.0 || along<=0.0 || abs(impact-1.0)>=support) {return sampled;}
  var foreground=vec4f(0);var complete=vec4f(0);
  if(coverage>0.0) {foreground=compactVolumeAt(center,ray,true);}
  if(coverage<1.0) {complete=compactVolumeAt(center,ray,false);}
  let resolved=mix(complete,foreground,coverage);
  let weight=1.0-smoothstep(support*.5,support,abs(impact-1.0));
  return mix(sampled,resolved,weight);
}
`;

const quad = /* wgsl */ `
struct Out { @builtin(position) position: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) v:u32) -> Out {
  let positions = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  var out:Out;
  out.position=vec4f(positions[v],0,1);
  out.uv=vec2f(positions[v].x*0.5+0.5,0.5-positions[v].y*0.5);
  return out;
}
`;

export const ENVIRONMENT_SHADER = frame + quad + SCENE_MOTION_WGSL + GALACTIC_MATERIAL_WGSL + /* wgsl */ `
@fragment fn fs(in:Out)->@location(0) vec4f {
  let ray=sceneRay(in.uv*f.viewport.zw);
  let galacticDirection=galacticMotionPoint(ray);
  let skyDirection=galacticSkyDirection(galacticDirection);
  // The panorama contributes continuous distant structure. Suppress its
  // isolated star peaks against the existing coarse mip so they do not form
  // enlarged, blurry replicas behind the separately reconstructed light field.
  // Keep original dark lanes, angular registration and the bounded mip chain.
  let detailed=textureSample(deepSky,skySampler,skyDirection).rgb;
  let broad=textureSampleLevel(deepSky,skySampler,skyDirection,3.0).rgb;
  let detailedLuminance=dot(detailed,vec3f(.2126,.7152,.0722));
  let broadLuminance=dot(broad,vec3f(.2126,.7152,.0722));
  let photograph=detailed*min(1.0,(broadLuminance*1.4+.0015)/max(detailedLuminance,.000001));
  let luminance=dot(photograph,vec3f(0.2126,0.7152,0.0722));
  let skyLight=mix(vec3f(luminance),photograph,0.36)*vec3f(0.92,0.98,1.08);
  let nearExposure=1.0-smoothstep(50.0,290.0,f.presentation.x)*0.45;
  var radiance=vec3f(0.0012,0.0017,0.0030)+skyLight*f.motion.z*mix(0.18,0.055,f.journey.y)*nearExposure*mix(1.0,0.24,f.motion.w);
  if (f.journey.x>0.001) {
    let eye=galacticMotionPoint(f.eye.xyz);
    let direction=galacticDirection;
    let aggregate=smoothstep(22.0,68.0,length(eye));
    let halo=galacticHaloField(eye,direction);
    let interval=galacticInterval(eye,direction,GALACTIC_HEIGHT);
    if (interval.y>interval.x) {
      let samples=clamp(u32(f.quality.y),3u,6u);
      let step=(interval.y-interval.x)/f32(samples);
      var transmission=vec3f(1.0);
      var galactic=vec3f(0.0);
      for (var i=0u;i<6u;i+=1u) {
        if (i>=samples) { break; }
        let field=galacticRadiance(eye+direction*(interval.x+(f32(i)+0.5)*step),direction*step);
        let attenuation=galacticTransmission(field.a*step);
        galactic+=transmission*field.rgb*step*(vec3f(1.0)+attenuation)*0.5;
        transmission*=attenuation;
      }
      radiance=mix(radiance,radiance*transmission+galactic*mix(1.0,2.2,aggregate),f.journey.x);
    }
    // Combined outer gas/extinction is an artistic world-space column.
    radiance=mix(radiance,radiance*galacticTransmission(halo.a)+halo.rgb*(1.0-f.journey.y*.75),f.journey.x);
    radiance+=galacticStellarField(eye,direction)*mix(1.0,5.0,aggregate)*f.journey.x*(1.0-f.journey.y*.75);
  }
  return vec4f(radiance,1.0);
}
`;

export const ENVIRONMENT_COPY_SHADER = quad + /* wgsl */ `
@group(0) @binding(0) var source:texture_2d<f32>;
@group(0) @binding(1) var linearSampler:sampler;
@fragment fn fs(in:Out)->@location(0) vec4f {
  return textureSampleLevel(source,linearSampler,in.uv,0);
}
`;

export const BLOOM_SHADER = quad + /* wgsl */ `
@group(0) @binding(0) var scene:texture_2d<f32>;
@group(0) @binding(1) var linearSampler:sampler;
@group(0) @binding(2) var<uniform> direction:vec4f;
@fragment fn fs(in:Out) -> @location(0) vec4f {
  let texel=1.0/vec2f(textureDimensions(scene));
  if (direction.z > 0.5) {
    let color=(textureSampleLevel(scene,linearSampler,in.uv+texel*vec2f(-1,-1),0).rgb+
      textureSampleLevel(scene,linearSampler,in.uv+texel*vec2f(1,-1),0).rgb+
      textureSampleLevel(scene,linearSampler,in.uv+texel*vec2f(-1,1),0).rgb+
      textureSampleLevel(scene,linearSampler,in.uv+texel*vec2f(1,1),0).rgb)*0.25;
    let peak=max(max(color.r,color.g),color.b);
    return vec4f(color * smoothstep(0.7,2.0,peak),1);
  }
  let step=direction.xy*texel;
  var color=textureSampleLevel(scene,linearSampler,in.uv,0).rgb*0.227027;
  color+=(textureSampleLevel(scene,linearSampler,in.uv+step*1.384615,0).rgb+
    textureSampleLevel(scene,linearSampler,in.uv-step*1.384615,0).rgb)*0.316216;
  color+=(textureSampleLevel(scene,linearSampler,in.uv+step*3.230769,0).rgb+
    textureSampleLevel(scene,linearSampler,in.uv-step*3.230769,0).rgb)*0.070270;
  return vec4f(color,1);
}
`;

export const COMPOSITE_SHADER = quad + /* wgsl */ `
@group(0) @binding(0) var scene:texture_2d<f32>;
@group(0) @binding(1) var glow:texture_2d<f32>;
@group(0) @binding(2) var linearSampler:sampler;
fn aces(x:vec3f)->vec3f {
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),vec3f(0),vec3f(1));
}
@fragment fn fs(in:Out)->@location(0) vec4f {
  let light=textureSampleLevel(scene,linearSampler,in.uv,0).rgb;
  let bloom=textureSampleLevel(glow,linearSampler,in.uv,0).rgb;
  let vignette=1.0-0.16*pow(length((in.uv-0.5)*vec2f(1.1,1)),2.0);
  let color=aces((light+bloom*0.20)*vignette);
  let encoded=pow(color,vec3f(1.0/2.2));
  return vec4f(encoded,1);
}
`;
