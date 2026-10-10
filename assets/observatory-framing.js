// Presentation fit uses the closest supported silhouette, so scrolling remains
// a distance change under one lens. Navigation and world pose stay independent.
import { isVolumeBody, localInspectionRange } from './observatory-bodies.js?v=cosmic-explore-20261010gu';

// Screen-relative discovery, never an astronomical direction or distance.
// Renderable centres and opaque occlusion come from the same target pass as
// picking. A point behind the lens cannot be classified from its clamped
// projected coordinates.
export function destinationDirection(point, width, height, panels = [], renderable = true, occluded = false) {
  if (![point?.x, point?.y, point?.depth, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return 'unresolved';
  if (point.depth <= 0) return 'behind';
  const horizontal = point.x < 12 ? 'left' : point.x > width - 12 ? 'right' : '';
  const vertical = point.y < 12 ? 'up' : point.y > height - 12 ? 'down' : '';
  if (horizontal || vertical) return [vertical, horizontal].filter(Boolean).join('-');
  if (occluded) return 'occluded';
  if (!renderable) return 'unresolved';
  if (!labelClearsPanels({ x: point.x - 6, y: point.y - 6, w: 12, h: 12 }, panels)) return 'covered';
  return 'visible';
}

// Controls can cover a resolvable target without moving it outside the lens.
export function destinationInView(direction) {
  return direction === 'visible' || direction === 'covered';
}

export function labelClearsPanels(rect, panels = []) {
  return !panels.some(panel => rect.x < panel.x + panel.width + 4 && rect.x + rect.w > panel.x - 4 &&
    rect.y < panel.y + panel.height + 4 && rect.y + rect.h > panel.y - 4);
}

// Annotation clearance is a presentation boundary, not opaque occlusion.
// Transparent discs, winds and clouds retain their background points/picking.
export function labelClearsSubject(rect, subject, extent) {
  if (!subject || extent <= 24) return true;
  const x = Math.max(rect.x, Math.min(subject.x, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(subject.y, rect.y + rect.h));
  return Math.hypot(subject.x - x, subject.y - y) >= extent + 12;
}

export function systemOverviewView(root, members, frame, width, height, area, { sweepYaw = false, sunlight } = {}) {
  const radius = Math.max(...members.map(body =>
    Math.hypot(...body.position.map((value, i) => value - root.position[i])) +
    body.radius * Math.max(1, body.rings?.outer || 1, ...(body.axes || []))));
  const available = area || { width, height };
  const focal = height / (2 * Math.tan(frame.fov / 2));
  const horizontal = focal / Math.max(20, available.width / 2 - 48);
  const vertical = focal / Math.max(20, available.height / 2 - 32);
  let yaw = -0.15, pitch = 1.13;
  if (sunlight?.length === 3 && sunlight.every(Number.isFinite) && Math.hypot(...sunlight) > 0) {
    // Choose a readable, oblique day-side view only at explicit local entry.
    // The ensuing fit covers motion; it never follows the light while idle.
    yaw = Math.atan2(sunlight[0], sunlight[2]) + 0.35;
    const lightPitch = Math.atan2(sunlight[1], Math.hypot(sunlight[0], sunlight[2]));
    pitch = Math.max(0.22, Math.min(0.70, 0.42 + lightPitch));
    if (root.rings?.outer > 1) {
      // Observe the ring plane from its open side, avoiding an edge-on entry.
      pitch = Math.cos(yaw) * Math.sin(root.tilt || 0) < 0 ? -0.55 : 0.55;
      const tilt = root.tilt || 0;
      const opening = (y,p) => Math.abs(Math.sin(p)*Math.cos(tilt) + Math.cos(p)*Math.cos(y)*Math.sin(tilt));
      // A sideways ice-giant axis can remain edge-on at either pitch. Adjust
      // only that explicit entry, retaining a lit hemisphere and a held lens.
      if (opening(yaw,pitch) < .35) {
        const length = Math.hypot(...sunlight), originalYaw = yaw;
        let best = opening(yaw,pitch);
        for (const y of [originalYaw-.5,originalYaw+.5]) for (const p of [-.55,.55]) {
          const daylight = (Math.sin(y)*Math.cos(p)*sunlight[0] + Math.sin(p)*sunlight[1] + Math.cos(y)*Math.cos(p)*sunlight[2])/length;
          const visible = opening(y,p);
          if (daylight > .5 && visible > best) { yaw=y;pitch=p;best=visible; }
        }
      }
    }
  }
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const right = [cy, 0, -sy], up = [-sp * sy, cp, -sp * cy], forward = [-cp * sy, -sp, -cp * cy];
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  let distance = root.radius * (root.nearLimit || 3.1);
  for (const body of members) {
    const position = body.position.map((value, i) => value - root.position[i]);
    const extent = body.radius * Math.max(1, body.rings?.outer || 1, ...(body.axes || []));
    if (sweepYaw) {
      // The support of a point swept around Y fits every galactic phase under
      // the same held lens and direction, without idle zoom or view rotation.
      const support = direction => Math.hypot(position[0], position[2]) * Math.hypot(direction[0], direction[2]) + position[1] * direction[1];
      distance = Math.max(distance, support(forward.map(value => -value)) + extent);
      for (const [axis, factor] of [[right, horizontal], [up, vertical]]) for (const sign of [-1, 1]) {
        const plane = axis.map((value, i) => sign * value * factor - forward[i]);
        distance = Math.max(distance, support(plane) + extent * Math.hypot(1, factor));
      }
      continue;
    }
    const depth = dot(position, forward);
    // Fit the actual members against the four perspective planes, keeping the
    // root centred. The extent term also contains their solid silhouettes.
    distance = Math.max(distance, extent - depth,
      Math.abs(dot(position, right)) * horizontal + extent * Math.hypot(1, horizontal) - depth,
      Math.abs(dot(position, up)) * vertical + extent * Math.hypot(1, vertical) - depth);
  }
  return { distance, yaw, pitch, roll: 0, radius };
}

export function readingLensScale(frame, body, minimumDistance, width, height, area) {
  if (!area || isVolumeBody(body) || (area.width >= width && area.height >= height)) return 1;
  // Preserve the established globe-reading lens. The new, explicit local
  // inspection extends closer under that same lens and may crop the globe.
  const inspection = localInspectionRange(body);
  if (inspection) minimumDistance=Math.max(minimumDistance,body.radius*inspection.reading);
  const radius = body.radius * Math.max(1, body.extent || 1, body.rings?.outer || 1, ...(body.axes || []));
  if (!(minimumDistance > radius) || !(area.width > 0 && area.height > 0)) return 1;
  const focal = height / (2 * Math.tan(frame.fov / 2));
  const closestSilhouette = focal * radius / Math.sqrt(minimumDistance ** 2 - radius ** 2);
  const availableRadius = Math.max(1, Math.min(area.width, area.height) / 2 - 8);
  return Math.min(1, availableRadius / closestSilhouette);
}

// A requested day-side view uses the current scene Sun, never a new light.
export function sunlitObservationView(body, sun, view) {
  if (!['planet', 'moon', 'dwarfplanet', 'asteroid'].includes(body?.kind) ||
      !body.position?.every(Number.isFinite) || !sun?.position?.every(Number.isFinite) ||
      ![view?.distance, view?.roll].every(Number.isFinite) || !(view.distance > 0)) return null;
  const light = sun.position.map((value, i) => value - body.position[i]);
  const length = Math.hypot(...light);
  if (!(length > 0)) return null;
  const yaw = Math.atan2(light[0], light[2]) + 0.35;
  const lightPitch = Math.atan2(light[1], Math.hypot(light[0], light[2]));
  let pitch = Math.max(-1.38, Math.min(1.38, lightPitch + 0.25));
  if (body.rings?.outer > 1) {
    const candidates = [pitch, -0.55, 0.55].filter(p =>
      (Math.cos(yaw)*Math.cos(p)*light[2] + Math.sin(yaw)*Math.cos(p)*light[0] + Math.sin(p)*light[1])/length > 0.75);
    const opening = p => Math.abs(Math.sin(p)*Math.cos(body.tilt || 0) + Math.cos(yaw)*Math.cos(p)*Math.sin(body.tilt || 0));
    pitch = candidates.reduce((best, p) => opening(p) > opening(best) ? p : best, pitch);
  }
  return { distance: view.distance, yaw, pitch, roll: view.roll };
}

// Locate without moving the camera: keep the temporary actions clear of their
// projected target, and retain a valid placement while the user orbits.
export function locatingPanelPlacement(width,height,panel,top,bottom,point,previous=null) {
  const margin=16,w=Math.min(panel.width,Math.max(1,width-margin*2)),h=panel.height;
  const left=margin,right=Math.max(left,width-w-margin),center=(left+right)/2;
  const low=Math.max(margin,Math.min(bottom-h,height-h-margin));
  const high=Math.max(margin,Math.min(top,low));
  const candidates=[{x:center,y:high},{x:left,y:high},{x:right,y:high},{x:center,y:low},{x:left,y:low},{x:right,y:low}];
  const within=p=>p && p.x>=left && p.x<=right && p.y>=high && p.y<=low;
  const distance=p=>!point || ![point.x,point.y].every(Number.isFinite)?Infinity:
    Math.hypot(point.x-Math.max(p.x,Math.min(point.x,p.x+w)),point.y-Math.max(p.y,Math.min(point.y,p.y+h)));
  const clearance=Math.max(24,(point?.radius||0)+12);
  if(within(previous) && distance(previous)>=clearance) return previous;
  return candidates.find(p=>distance(p)>=clearance) || candidates.reduce((best,p)=>distance(p)>distance(best)?p:best);
}
