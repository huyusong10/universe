// Follow finite ancestry so planets and their moons share their own host light.
// Legacy worlds without another stellar ancestor retain the Sun.
export function illuminatingStar(body, lookup) {
  const seen = new Set();
  let current = body;
  while (current?.parentId !== undefined && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = lookup(current.parentId);
    if (current?.kind === 'star') return current;
  }
  return lookup(0);
}
export function incidentStarColor(star) {
  if (!star || star.id === 0) return [1, 1, 1];
  const peak = Math.max(...star.color, 0.001);
  // Authored illumination tint, not a measured spectrum or photometry.
  return star.color.map(value => 0.38 + 0.62 * value / peak);
}

// Local inspection is a presentation capability, not a change to source data.
// Local views stop outside the solid envelope. Ring systems retain their old
// whole-body framing but no longer hold the globe-local camera at the outer ring.
const CLOUD_WORLDS = new Set(['venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan',
  'hotjupiter', 'exoblue', 'exohaze', 'exoultrahot', 'exomini', 'younggiant', 'forminggiant', 'superpuff']);
export function localInspectionRange(body) {
  if (!['planet', 'moon', 'dwarfplanet', 'asteroid', 'comet'].includes(body?.kind)) return null;
  const envelope = Math.max(1, ...(body.axes || []));
  const whole = body.rings ? 8.5 : 6;
  const minimum = Math.max(body.rings ? 1.65 : body.nearLimit || 1.65, envelope * 1.12);
  return { minimum, reading: body.rings ? whole : Math.max(3.1, minimum, body.nearLimit || 3.1),
    whole, kind: body.kind === 'comet' ? 'nucleus' : CLOUD_WORLDS.has(body.material) ? 'cloud' : 'terrain' };
}

// A thin ring immediately at the lens fades rather than flashing across the
// view. CPU picking and both GPU body paths share the same empty near interval.
export const RING_CAMERA_FADE = Object.freeze([0.08, 0.32]);

export function bodyNearLimit(body) {
  return localInspectionRange(body)?.minimum || body?.nearLimit || 3.1;
}

// Transparent extended bodies share navigation, projection and picking semantics.
export function isVolumeBody(body) {
  return body?.kind === 'nebula' || body?.kind === 'galaxy';
}

// Diffuse light and reflected worlds lose covered area when unresolved.
// This is an authored display response, not measured source photometry.
const AREA_POINT_KINDS = new Set(['planet', 'moon', 'dwarfplanet', 'asteroid', 'nebula']);
const POINT_AREA_GAIN = 4;
export function pointSourceCoverage(body, projectedRadius) {
  return AREA_POINT_KINDS.has(body?.kind) ? Math.min(1, Math.max(0, projectedRadius) ** 2 * POINT_AREA_GAIN) : 1;
}
export const POINT_COVERAGE_WGSL = /* wgsl */ `
fn surfacePointCoverage(radius:f32)->f32 {
  return min(1.0,max(0.0,radius)*max(0.0,radius)*${POINT_AREA_GAIN.toFixed(1)});
}
`;

// Some bodies combine an opaque core with transparent surrounding structure.
export function hasVolumeBody(body) {
  return isVolumeBody(body) || body?.kind === 'comet' || body?.kind === 'pulsar' || body?.kind === 'blackhole' || body?.material === 'enceladus';
}

// A finite authored selection of narrow ice-giant rings, not all measured rings.
// Picking and rendering share these same opaque bands and transparent gaps.
export const URANUS_RING_BANDS = Object.freeze([
  [1.58,1.60], [1.84,1.865], [1.98,2.02]
].map(band => Object.freeze(band)));

// Approximate NASA published diameter proportions, oriented for this scene.
// These ellipsoids bound the finite source-derived convex approximations.
export const MARS_MOON_PHASE = Math.PI;
export const PHOBOS_AXES = Object.freeze([27/22,18/22,1]);
export const DEIMOS_AXES = Object.freeze([15/12,11/12,1]);

// Vesta's published approximate semi-axes, normalised to the map reference radius.
// This bounds the source-derived approximation; it is not a Dawn terrain model.
export const VESTA_AXES = Object.freeze([289/255,229/255,280/255]);

// Shared procedural nucleus geometry, in ellipsoid coordinates. The same finite
// convex cuts feed CPU picking and GPU intersections, never astronomical data.
export const COMET_NUCLEUS_PLANES = Object.freeze([
  [0.8,0.4,0.447,0.83], [-0.7,0.2,0.685,0.81], [0.1,-0.85,0.517,0.88],
  [-0.1,0.92,-0.38,0.85], [0.45,-0.25,-0.857,0.84], [-0.82,-0.48,-0.311,0.82],
  [0.55,0.79,-0.27,0.85], [-0.45,0.7,0.555,0.86],
  [0.94,-0.24,0.12,0.91], [-0.93,0.28,-0.22,0.89], [0.16,0.48,0.86,0.90],
  [-0.3,-0.65,-0.70,0.88], [0.70,-0.63,0.32,0.89], [-0.54,-0.67,0.50,0.88]
].map(([x,y,z,height]) => {
  const length = Math.hypot(x,y,z);
  return Object.freeze([x/length,y/length,z/length,height]);
}));

// The scene compresses orbital space. Where a family already has outer room,
// spread its cramped inner paths without enlarging the complete family view.
export function spaceSatelliteFamily(parent, members) {
  if (members.length < 2) return members;
  const offsets = members.map(body => body.position.map((value, i) => value - parent.position[i]));
  const radii = offsets.map(offset => Math.hypot(...offset));
  const inner = Math.min(...radii), outer = Math.max(...radii);
  const minimum = parent.radius * Math.max(1, parent.rings?.outer || 1, ...(parent.axes || [])) * 3;
  if (!(inner > 0) || inner >= minimum || outer <= minimum) return members;
  return members.map((body, index) => {
    const radius = minimum + (radii[index] - inner) * (outer - minimum) / (outer - inner);
    if (radii[index] === outer) return body;
    return { ...body, position: parent.position.map((value, i) => value + offsets[index][i] * radius / radii[index]) };
  });
}
