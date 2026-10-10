// Explicit, finite camera advice from partial-map alpha; never runs per frame.
import { MAP_COVERAGE, MAP_COVERAGE_SIZE, MAP_MERIDIANS } from './observatory-map-coverage-data.js?v=cosmic-explore-20261010gu';
import { sunlitObservationView } from './observatory-framing.js?v=cosmic-explore-20261010gu';

const TAU = Math.PI * 2;
const [width, height] = MAP_COVERAGE_SIZE;
const unit = p => { const length = Math.hypot(...p); return p.map(v => v / length); };
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const rotateY = ([x,y,z], angle) => [Math.cos(angle)*x+Math.sin(angle)*z, y, -Math.sin(angle)*x+Math.cos(angle)*z];
const rotateX = ([x,y,z], angle) => [x, Math.cos(angle)*y-Math.sin(angle)*z, Math.sin(angle)*y+Math.cos(angle)*z];
const direction = view => [Math.sin(view.yaw)*Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw)*Math.cos(view.pitch)];
const maps = new Map(Object.entries(MAP_COVERAGE).map(([key, profile]) => [key,
  Array.from({length: width*height}, (_, i) => {
    const latitude = Math.PI * ((Math.floor(i/width)+.5)/height);
    const longitude = TAU * ((i%width+.5)/width-.5);
    return { p: [Math.cos(longitude)*Math.sin(latitude), Math.cos(latitude), Math.sin(longitude)*Math.sin(latitude)],
      area: Math.sin(latitude), alpha: parseInt(profile.alpha.slice(i*2,i*2+2),16)/255 };
  })]));

export function hasMappedTerrain(body) {
  return ['moon','dwarfplanet','asteroid'].includes(body?.kind) && maps.has(body.material);
}

// Uses the same map meridian, artistic tilt and scene spin as the surface shader.
// Vesta's convex silhouette is approximated by its outer ellipsoid for advice;
// neither this direction nor its source-alpha grid is measured geographic data.
export function mappedTerrainObservationView(body, sun, view, spin) {
  if (!hasMappedTerrain(body) || !sunlitObservationView(body,sun,view) ||
      ![view.yaw,view.pitch,spin,body.radius,body.tilt || 0].every(Number.isFinite) ||
      !(body.radius > 0)) return null;
  const light = unit(sun.position.map((v,i)=>v-body.position[i]));
  const phase = spin + (MAP_MERIDIANS[body.material] || 0), tilt = body.tilt || 0;
  const axes = body.axes || [1,1,1], distance = view.distance/body.radius;
  if (!axes.every(v=>Number.isFinite(v)&&v>0) || distance <= Math.max(...axes)) return null;
  const world = p => rotateX(rotateY(p,-phase),tilt);
  const cells = maps.get(body.material).map(cell => ({...cell,
    point: world(cell.p.map((v,i)=>v*axes[i])), normal: unit(world(cell.p.map((v,i)=>v/axes[i]))) }));
  const coverageAt = eye => {
    const local = unit(rotateY(rotateX(eye,-tilt),phase).map((v,i)=>v/axes[i]));
    const u = (Math.atan2(local[2],local[0])/TAU+.5)*width;
    const v = Math.acos(Math.max(-1,Math.min(1,local[1])))/Math.PI*height;
    return maps.get(body.material)[Math.min(height-1,Math.floor(v))*width+(Math.floor(u)%width)].alpha;
  };
  const candidates = [direction(view), direction(sunlitObservationView(body,sun,view))];
  // A bounded spherical sweep avoids privileging a longitude or a polar cap.
  for (let i=0; i<80; i++) {
    const y = 1-2*(i+.5)/80, r = Math.sqrt(1-y*y), angle = i*Math.PI*(3-Math.sqrt(5));
    candidates.push(unit(world([r*Math.cos(angle)*axes[0],y*axes[1],r*Math.sin(angle)*axes[2]])));
  }
  let best = null, bestScore = -Infinity;
  for (const proposed of candidates) {
    const yaw = Math.atan2(proposed[0],proposed[2]);
    const pitch = Math.max(-1.38,Math.min(1.38,Math.asin(proposed[1])));
    const eyeDirection = direction({yaw,pitch}), center = coverageAt(eyeDirection);
    if (center < .7) continue;
    const eye = eyeDirection.map(v=>v*distance);
    let total = 0, covered = 0, lit = 0;
    for (const cell of cells) {
      const toEye = eye.map((v,i)=>v-cell.point[i]), length = Math.hypot(...toEye);
      const weight = Math.max(0,dot(cell.normal,toEye)/length)*cell.area/(length*length);
      total += weight; covered += weight*cell.alpha;
      lit += weight*cell.alpha*Math.max(0,dot(cell.normal,light));
    }
    // Prioritise mapped terrain with usable current light. No lamp, clock jump
    // or fabricated fill can make a wholly unlit mapped hemisphere bright.
    const score = (covered*.65+lit*1.1)/total + center*.15;
    if (score > bestScore) { bestScore = score; best = {distance:view.distance,yaw,pitch,roll:view.roll}; }
  }
  return best;
}
