import { solidShape } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
import { createCatalog, setCatalogBudget, catalogBody, resolveCatalogTarget, bodyRayIntersection, bodyRayCaster, bodyScreenBounds, bodyRelations, bodySystem, namedDestinations, setObservedGalaxy } from './observatory-model.js?v=cosmic-explore-20261010gu';
import { createCamera, updateCamera, updateCameraAnchors, orbitCamera, zoomCamera, focusCamera, turnCamera, resetCamera, cancelCameraFlight, setReducedMotion, cameraFrame, projectPoint, screenRay, scaleState, environmentState, setCameraScale, scaleStops, inspectCameraPoint, enterNebula } from './observatory-camera.js?v=cosmic-explore-20261010gu';
import { galaxyObservationRegions, galaxyRegionPosition } from './observatory-galaxy-layout.js?v=cosmic-explore-20261010gu';
import { smoothstep } from './observatory-math.js?v=cosmic-explore-20261010gu';
import { readingLensScale, systemOverviewView, sunlitObservationView, labelClearsSubject, labelClearsPanels, destinationDirection } from './observatory-framing.js?v=cosmic-explore-20261010gu';
import { isVolumeBody, hasVolumeBody, illuminatingStar, localInspectionRange, pointSourceCoverage } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
import { rememberView, recalledView } from './observatory-trail.js?v=cosmic-explore-20261010gu';
import { advanceSceneTime, sceneMotionMode, sceneMotionRate, createBodyMotion, galacticFrame } from './observatory-motion.js?v=cosmic-explore-20261010gu';
import { createRenderer } from './observatory-renderer.js?v=cosmic-explore-20261010gu';

import { hasMappedTerrain, mappedTerrainObservationView } from './observatory-map-coverage.js?v=cosmic-explore-20261010gu';

const VERSION = 'cosmic-explore-20261010gu';
let config, catalog, camera, renderer, sceneCanvas, labelsCanvas, ink;
let active, width = 1, height = 1, dpr = 1, labelDpr = 1;
let qualityChanging = false;
let running = false, failed = false, frameRequest = 0, lastFrame = 0, lastReport = 0;
let elapsed = 0, spin = 0, frameMs = 16.7, hover = -1;
let activityMode = 'flow';
let motion = 0;
let captureRequest = null, suspended = false, suspendedAt = 0, suspendedId = null;
let targets = [], labelRects = [], labelCount = 0, pointer = null;
let currentFrame = null, currentObserved = null;
let composition = [0.5, 0.5], compositionTarget = [0.5, 0.5], observationArea = null;
let readingPanels = [];
let galaxyRegionPreview = null;
let discoveryOpen = false, discoveryBodies = [], destinationPreviewId = null;
let currentDestinationPreview = null;
let compositionScale = 1;
let explorationTrail = [], revisitView = null;
let systemView = null, observationTurn = null;
let bodyMotion, bodyLocalPoses = new Map(), bodyPoses = new Map();
let galaxyFrame = galacticFrame(0);
const sceneBody = id => bodyPoses.get(id) || galaxyFrame.body(catalogBody(catalog, id));
const sceneIlluminant = body => illuminatingStar(body, sceneBody);
const parentBody = body => body?.parentId === undefined ? null : sceneBody(body.parentId);
function focusObservation(body, view = null) {
  focusCamera(camera, body, performance.now(), view, { departureParent: parentBody(sceneBody(camera.observedId)), arrivalParent: parentBody(body) });
}
function inspectGalaxyRegion(key, distance) {
  const region=key && galaxyObservationRegions(active).find(item=>item.key===key);
  if(key && !region) return false;
  return inspectCameraPoint(camera,active,region?{key:region.key,position:galaxyRegionPosition(active,region,elapsed),distance:distance||active.radius*region.distance}:null,performance.now());
}
function projectedGalaxyRegionPreview() {
  if(!galaxyRegionPreview || galaxyRegionPreview.id!==active?.id || camera.observedId!==active.id || camera.flight || camera.observationPoint || !currentFrame) return null;
  const region=galaxyObservationRegions(active).find(item=>item.key===galaxyRegionPreview.key);
  if(!region) return null;
  const position=galaxyRegionPosition(active,region,elapsed),p=projectPoint(position,currentFrame,width,height);
  const rect={x:p.x-19,y:p.y-19,w:38,h:38},area=observationArea||{x:0,y:0,width,height};
  const visible=p.depth>currentFrame.near && rect.x>=area.x && rect.y>=area.y && rect.x+rect.w<=area.x+area.width && rect.y+rect.h<=area.y+area.height && labelClearsPanels(rect,readingPanels);
  return {key:region.key,position,x:p.x,y:p.y,visible};
}
function drawGalaxyRegionPreview() {
  const p=projectedGalaxyRegionPreview();
  if(!p?.visible) return;
  ink.save();ink.lineWidth=1;ink.strokeStyle='rgba(229,216,184,.9)';
  ink.shadowColor='rgba(0,0,0,.95)';ink.shadowBlur=4;ink.beginPath();
  for(const x of [-1,1]) for(const y of [-1,1]) {
    ink.moveTo(p.x+x*9,p.y+y*16);ink.lineTo(p.x+x*16,p.y+y*16);ink.lineTo(p.x+x*16,p.y+y*9);
  }
  ink.stroke();ink.restore();
}
function destinationView(id, frame=currentFrame, visible=null, occluders=targets) {
  const body=sceneBody(id),point=projectPoint(body.position,frame,width,height),target=visible?visible.get(id):targets.find(target=>target.id===id);
  let occluded=Boolean(target?.occluded);
  if(target?.centerVisible && !occluded) {
    const delta=body.position.map((value,i)=>value-frame.eye[i]),distance=Math.hypot(...delta);
    const ray=delta.map(value=>value/Math.max(distance,1e-12));
    const hit=target.cast?.(ray),depth=Number.isFinite(hit)?hit:distance;
    occluded=occluders.some(other=>other.id!==id && other.cast && other.cast(ray)<depth-1e-12);
  }
  return {id,x:point.x,y:point.y,direction:destinationDirection(point,width,height,readingPanels,Boolean(target?.centerVisible),occluded)};
}
function destinationPreview() {
  if(!discoveryOpen || destinationPreviewId===null || !currentFrame) return null;
  const view=destinationView(destinationPreviewId);
  const radius=Math.max(10,Math.min(28,(targets.find(target=>target.id===view.id)?.radius||0)+5));
  return {...view,radius,visible:view.direction==='visible' && labelClearsPanels({x:view.x-radius,y:view.y-radius,w:radius*2,h:radius*2},readingPanels)};
}
function drawDestinationPreview() {
  const p=currentDestinationPreview;
  if(!p?.visible) return;
  ink.save();ink.lineWidth=1;ink.strokeStyle='rgba(238,218,174,.95)';
  ink.shadowColor='rgba(0,0,0,.95)';ink.shadowBlur=5;ink.beginPath();
  for(const x of [-1,1]) for(const y of [-1,1]) {
    ink.moveTo(p.x+x*p.radius*.58,p.y+y*p.radius);
    ink.lineTo(p.x+x*p.radius,p.y+y*p.radius);
    ink.lineTo(p.x+x*p.radius,p.y+y*p.radius*.58);
  }
  ink.stroke();ink.restore();
}
function galaxyInspectionState() {
  const options=galaxyObservationRegions(active);
  const key=camera.observationPoint?.key||null;
  return {supported:options.length>0,available:options.length>0 && camera.observedId===active.id && (!camera.flight||camera.flight.point),region:key,
    options:options.map(({key})=>({key})),position:camera.observationPoint?.position.slice()||null,pending:camera.pointNavigation,preview:projectedGalaxyRegionPreview(),
    settled:Boolean(key)&&!camera.flight && Math.hypot(...camera.focus.map((v,i)=>v-camera.observationPoint.position[i]))<active.radius*.0001};
}
function settledObservation() {
  if (systemView || camera.flight || camera.scaleNavigation || active.id !== camera.observedId ||
      camera.distance > active.radius * 12 || Math.abs(Math.log(camera.distance / camera.distanceTarget)) > 0.0001 ||
      Math.hypot(...camera.focus.map((value, i) => value - active.position[i])) > active.radius * 0.0001) return false;
  return true;
}
function sunlitView() {
  if (!settledObservation()) return null;
  return sunlitObservationView(active, sceneIlluminant(active), { distance: camera.distance, roll: camera.roll });
}
function returnObservation(body, wide = false) {
  resetCamera(camera, body, performance.now(), { wide, departureParent: parentBody(sceneBody(camera.observedId)) });
}
const schedule = callback => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(() => callback(performance.now()), 16);
const cancel = handle => typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(handle) : clearTimeout(handle);

function fail(message) {
  if (failed) return;
  failed = true;
  running = false;
  cancel(frameRequest);
  self.postMessage({ type: 'error', message: String(message) });
}

function resize() {
  if (!renderer || !labelsCanvas) return;
  renderer.resize(width, height, dpr);
  labelDpr = Math.min(dpr || 1, 2, Math.sqrt(3_000_000 / (width * height)));
  labelsCanvas.width = Math.max(1, Math.round(width * labelDpr));
  labelsCanvas.height = Math.max(1, Math.round(height * labelDpr));
  ink.setTransform(labelDpr, 0, 0, labelDpr, 0, 0);
}

function projectedTargets(frame, radius, observed) {
  const restFrame = galaxyFrame.camera(frame);
  const focal = height / (2 * Math.tan(frame.fov / 2));
  const output = [];
  const fixed = catalog.bodies;
  const hintedIds = new Set(systemReferenceAlpha(observed) > .05 ? systemView.members.map(body => body.id) : []);
  const solidRay = radius > 2 ? bodyRayCaster(observed,frame.eye) : null;
  for (let index = 0; index < catalog.drawIndices.length + fixed.length; index++) {
    const fixedIndex = index - catalog.drawIndices.length;
    const source = fixedIndex < 0 ? catalog.stars[catalog.drawIndices[index]] : fixed[fixedIndex];
    // Generated catalog points use the inverse galaxy camera. Authored bodies
    // (including stellar companions) use their current finite motion pose.
    const finiteStar = source.id !== 0 && bodyPoses.has(source.id);
    const restStar = fixedIndex < 0 && !finiteStar && source.id !== observed.id;
    const star = source.id === observed.id ? observed : restStar ? source : sceneBody(source.id);
    const lens = restStar ? restFrame : frame;
    const id = star.id;
    const dx = star.position[0] - lens.eye[0], dy = star.position[1] - lens.eye[1], dz = star.position[2] - lens.eye[2];
    const { x, y, depth } = projectPoint(star.position, lens, width, height);
    if (depth <= frame.near) continue;
    const centerVisible=x>=12&&y>=12&&x<=width-12&&y<=height-12;
    const opaque=!isVolumeBody(star)&&(fixedIndex>=0||finiteStar||id===observed.id);
    const bounds=opaque?bodyScreenBounds(star,frame,width,height):null;
    if (!centerVisible && !bounds?.visible) continue;
    if (id !== observed.id && radius > 2 && fixedIndex < 0 && !finiteStar) {
      const distance = Math.hypot(dx, dy, dz);
      const ray = [dx / distance, dy / distance, dz / distance];
      if (solidRay(restStar ? galaxyFrame.toWorld(ray) : ray) < distance) continue;
    }
    const projectedRadius = fixedIndex >= 0 || finiteStar ? star.radius * focal / depth : 0;
    if (id !== observed.id && id !== active.id && !hintedIds.has(id) && pointSourceCoverage(star, projectedRadius) < .004) continue;
    const resolved = !isVolumeBody(star) ? projectedRadius : 0;
    const size = id === observed.id ? Math.max(7, radius * (star.extent || 1)) : Math.max(id === active.id ? 7 : 5, star.kind === 'galaxy' ? 9 : star.size * 3, resolved);
    output.push({ id, name: star.name, x, y, depth, radius: size, surfaceRadius: id === observed.id ? radius : projectedRadius, star, bounds, centerVisible });
  }
  // Keep partially hidden finite targets for exact nearest-surface picking;
  // only their centre labels disappear behind another opaque body.
  const finite=output.filter(target=>target.bounds?.visible);
  for(const target of finite) target.cast=bodyRayCaster(target.star,frame.eye);
  for(const target of finite) {
    const delta=target.star.position.map((value,i)=>value-frame.eye[i]),length=Math.hypot(...delta),ray=delta.map(value=>value/length);
    const hit=target.cast(ray),own=Number.isFinite(hit)?hit:length;
    target.occluded=finite.some(other=>other.id!==target.id&&other.cast(ray)<own-1e-12);
  }
  return output;
}

function pixelRay(x, y) {
  return screenRay(x, y, currentFrame, width, height);
}

function pick(x, y) {
  // Labels are part of the same target; they never invent a separate identity.
  for (const label of labelRects) {
    if (x < label.x || x > label.x + label.w || y < label.y || y > label.y + label.h) continue;
    const target=targets.find(target=>target.id===label.id);
    if(!target||!currentFrame) continue;
    const ray=pixelRay(x,y),depth=target.depth/currentFrame.forward.reduce((sum,value,i)=>sum+value*ray[i],0);
    if(!targets.some(other=>other.id!==target.id&&other.cast&&other.cast(ray)<depth-1e-12)) return label.id;
  }
  if (currentFrame) {
    const ray = pixelRay(x, y);
    let nearest = Infinity, identity = -1;
    for (const target of targets) {
      if (!target.cast || (target.bounds.radius<=9&&target.centerVisible)) continue;
      const hit = target.cast(ray);
      if (hit < nearest) { nearest = hit; identity = target.id; }
    }
    if (identity >= 0) return identity;
  }
  let best = -1, bestScore = Infinity;
  for (const target of targets) {
    if (target.cast && (target.bounds.radius>9||!target.centerVisible)) continue;
    if (target.id === currentObserved?.id && isVolumeBody(currentObserved)) continue;
    if (target.id === currentObserved?.id && currentObserved.rings && target.radius > 9) continue;
    if ((target.star.axes || solidShape(target.star.material,target.star.seed)) && target.radius > 9) continue;
    if (hasVolumeBody(target.star) && target.radius > 9) continue;
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance > Math.max(9, target.radius)) continue;
    const score = distance / Math.min(12, target.radius);
    if (score < bestScore) { bestScore = score; best = target.id; }
  }
  if (best < 0 && isVolumeBody(currentObserved)) {
    const cloud = targets.find(target => target.id === currentObserved.id);
    if (cloud && Math.hypot(cloud.x - x, cloud.y - y) < cloud.radius) return cloud.id;
  }
  return best;
}

function labelClearsForeground(rect,target) {
  const plane=target.depth;
  for(const other of targets) {
    if(!other.cast||other.id===target.id) continue;
    const b=other.bounds;
    if(rect.x+rect.w<b.left||rect.x>b.right||rect.y+rect.h<b.top||rect.y>b.bottom) continue;
    const points=[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h],
      [rect.x+rect.w/2,rect.y+rect.h/2],
      [Math.max(rect.x,Math.min(other.x,rect.x+rect.w)),Math.max(rect.y,Math.min(other.y,rect.y+rect.h))]];
    for(const [x,y] of points) {
      const ray=pixelRay(x,y),depth=plane/currentFrame.forward.reduce((sum,value,i)=>sum+value*ray[i],0);
      if(other.cast(ray)<depth-1e-12) return false;
    }
  }
  return true;
}

function drawLabels(scale, radius, observed) {
  ink.clearRect(0, 0, width, height);
  labelRects = [];
  const maximum = Math.min(catalog.budget.labels, scale.scaleStage === 'Galactic' ? (camera.distance > 28 ? Math.min(4, Math.max(2, Math.floor(width / 360))) : 2) : scale.scaleStage === 'Regional' ? 7 : 11);
  const relations = bodyRelations(catalog, observed.id);
  const related = new Set([relations.parent?.id, ...relations.children.map(body => body.id)]);
  const systemAlpha = systemReferenceAlpha(observed);
  const systemIds = new Set(systemAlpha > 0.05 ? systemView.members.map(body => body.id) : []);
  const systemMarkers = systemIds.size ? targets.filter(target => systemIds.has(target.id) && (target.star.kind !== 'moon' ||
    !targets.some(parent => parent.id === target.star.parentId && Math.hypot(target.x - parent.x, target.y - parent.y) < 24))) : [];
  if (systemAlpha > 0.05) drawSystemReferences(systemIds, systemAlpha);
  const preview=currentDestinationPreview;
  const candidates = targets.filter(target => target.centerVisible && !target.occluded && (systemIds.size ? systemIds.has(target.id) :
    target.id === preview?.id || target.id === active.id || target.id === observed.id || target.id === hover || (camera.distance <= 28 && related.has(target.id)) || (camera.distance > 28 && target.star.kind === 'galaxy') || ((target.id < 24 || target.star.kind !== 'star') && camera.distance < 12 && radius < 24)));
  const subject = targets.find(target => target.id === observed.id) || projectPoint(observed.position, currentFrame, width, height);
  const extent = radius * Math.max(observed.extent || 1, observed.rings?.outer || 1, ...(observed.axes || []));
  candidates.sort((a, b) => {
    const priority = target => target.id === preview?.id ? 120 : target.id === active.id ? 110 : target.id === observed.id ? 100 : target.id === hover ? 90 : camera.distance > 28 && target.star.kind === 'galaxy' ? Math.min(50,target.surfaceRadius) : target.star.luminosity;
    return priority(b) - priority(a);
  });
  ink.textBaseline = 'middle';
  ink.font = '11px ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif';
  for (const target of candidates) {
    if (labelRects.length >= maximum) break;
    const selected = target.id === active.id;
    const currentSubject = target.id === observed.id;
    const parent = systemIds.has(target.id) && targets.find(other => other.id === target.star.parentId);
    if (target.star.kind === 'moon' && parent && Math.hypot(target.x - parent.x, target.y - parent.y) < 24) continue;
    const labelName = config.displayNames?.get(target.name) ||
      (systemIds.has(target.id) && target.star.kind === 'comet' ? target.star.aliases?.[0] || target.name : target.name);
    const labelWidth = ink.measureText(labelName).width;
    const gap = currentSubject ? Math.max(15, extent + 20) : Math.max(13, target.radius + 12);
    let x = target.x + gap, y = target.y - 3;
    if (x + labelWidth > width - 65) x = target.x - gap - labelWidth;
    if (x < 15 || y < 28 || y > height - 55) continue;
    let rect = { id: target.id, x: x - 6, y: y - 12, w: labelWidth + 12, h: 24 };
    if (!currentSubject && !systemIds.size && !labelClearsSubject(rect, subject, extent)) continue;
    const overlaps = candidate => labelRects.some(other => candidate.x < other.x + other.w + 12 && candidate.x + candidate.w + 12 > other.x && candidate.y < other.y + other.h + 8 && candidate.y + candidate.h + 8 > other.y);
    if (systemIds.has(target.id)) {
      const alternatives = [[x, y], [target.x - labelWidth - 14, target.y - 3],
        ...[28, -28, 56, -56].flatMap(offset => [[target.x + 14, target.y + offset], [target.x - labelWidth - 14, target.y + offset]])];
      const place = alternatives.find(([px, py]) => {
        const candidate = { x: px - 6, y: py - 12, w: labelWidth + 12, h: 24 };
        const area = observationArea || { x: 0, y: 0, width, height };
        const coversMarker = systemMarkers.some(other => other.id !== target.id &&
          Math.hypot(other.x - Math.max(candidate.x, Math.min(other.x, candidate.x + candidate.w)),
            other.y - Math.max(candidate.y, Math.min(other.y, candidate.y + candidate.h))) < Math.max(10, other.radius + 2));
        return candidate.x >= area.x && candidate.y >= area.y && candidate.x + candidate.w <= area.x + area.width && candidate.y + candidate.h <= area.y + area.height && !overlaps(candidate) && !coversMarker && labelClearsPanels(candidate, readingPanels);
      });
      if (!place) continue;
      [x, y] = place;
      rect = { id: target.id, x: x - 6, y: y - 12, w: labelWidth + 12, h: 24 };
    } else if (overlaps(rect)) continue;
    // A label is attached to its body's depth. It must not create a clickable
    // island on another opaque foreground limb, including offscreen centres.
    if (!labelClearsForeground(rect,target) || !labelClearsPanels(rect,readingPanels)) {
      const alternatives=[[target.x-gap-labelWidth,target.y-3],[target.x+gap,target.y-3],
        [target.x-labelWidth/2,target.y-Math.max(22,target.radius+16)],
        [target.x-labelWidth/2,target.y+Math.max(22,target.radius+16)]];
      const place=alternatives.find(([px,py])=>{
        const candidate={id:target.id,x:px-6,y:py-12,w:labelWidth+12,h:24};
        return candidate.x>=15&&candidate.x+candidate.w<=width-15&&candidate.y>=28&&candidate.y+candidate.h<=height-55&&
          !overlaps(candidate)&&labelClearsForeground(candidate,target)&&labelClearsPanels(candidate,readingPanels)&&
          (currentSubject||systemIds.size||labelClearsSubject(candidate,subject,extent));
      });
      if(!place) continue;
      [x,y]=place;rect={id:target.id,x:x-6,y:y-12,w:labelWidth+12,h:24};
    }
    if (!labelClearsPanels(rect, readingPanels)) continue;
    if(systemIds.has(target.id)&&Math.abs(y-target.y)>14) {
      ink.strokeStyle='rgba(188,203,219,0.35)';ink.lineWidth=.7;
      ink.beginPath();ink.moveTo(target.x,target.y);ink.lineTo(x<target.x?x+labelWidth+4:x-4,y);ink.stroke();
    }
    const opacity = selected || currentSubject || target.id === hover || target.id === preview?.id ? 0.86 : systemIds.has(target.id) ? 0.78 : 0.42;
    ink.fillStyle = `rgba(224,229,237,${opacity})`;
    ink.fillText(labelName, x, y);
    const highlightRadius = currentSubject ? radius : target.radius;
    if (selected && highlightRadius < 15) {
      ink.strokeStyle = 'rgba(221,210,184,0.34)';
      ink.lineWidth = 0.7;
      ink.beginPath();
      ink.arc(target.x, target.y, Math.max(6.5, highlightRadius + 4), -0.8, 0.8);
      ink.stroke();
    }
    labelRects.push(rect);
  }
  labelCount = labelRects.length;
  drawGalaxyRegionPreview();
  drawDestinationPreview();
}

function systemReferenceAlpha(observed = currentObserved) {
  if (!systemView || observed?.id !== systemView.root.id || active.id !== systemView.root.id) return 0;
  const distance = systemView.view.distance;
  return smoothstep(distance * 0.2, distance * 0.65, camera.distance) * (1 - smoothstep(distance * 3, distance * 6, camera.distance));
}

function drawSystemReferences(ids, alpha) {
  ink.save();
  ink.globalAlpha = alpha;
  ink.lineWidth = 0.8;
  for (const target of targets) {
    if (!ids.has(target.id)) continue;
    const parent = targets.find(other => ids.has(other.id) && other.id === target.star.parentId);
    if (parent && Math.hypot(target.x - parent.x, target.y - parent.y) >= 28) {
      ink.strokeStyle = 'rgba(188,203,219,0.18)';
      ink.setLineDash([]);
      ink.beginPath();
      let started = false;
      for (const point of bodyMotion.path(target.id, bodyLocalPoses)) {
        const projection = projectPoint(galaxyFrame.toWorld(point), currentFrame, width, height);
        if (projection.depth <= currentFrame.near) { started = false; continue; }
        if (started) ink.lineTo(projection.x, projection.y);
        else { ink.moveTo(projection.x, projection.y); started = true; }
      }
      ink.stroke();
    }
    if (target.star.kind === 'moon' && parent && Math.hypot(target.x - parent.x, target.y - parent.y) < 24) continue;
    if (target.radius >= 10) continue;
    ink.setLineDash([]);
    ink.strokeStyle = target.id === hover ? 'rgba(241,226,190,0.9)' : 'rgba(209,222,236,0.6)';
    ink.beginPath(); ink.arc(target.x, target.y, 6, 0, Math.PI * 2); ink.stroke();
  }
  ink.restore();
}

function systemViewState() {
  return systemView ? { rootId: systemView.root.id, root: systemView.root.name,
    scope: systemView.scope, memberIds: systemView.members.map(body => body.id), pending: systemView.pending, visible: systemReferenceAlpha() > 0.05 } : null;
}

function rememberObservation() {
  if (systemView || camera.flight || active.id !== camera.observedId || (revisitView && camera.focusHold) ||
      camera.distance > active.radius * 80 || Math.abs(Math.log(camera.distance / camera.distanceTarget)) > 0.0001 ||
      Math.hypot(...camera.focus.map((value, i) => value - (camera.observationPoint?.position||active.position)[i])) > active.radius * 0.0001) return;
  const stage = scaleState(camera, active).scaleStage;
  explorationTrail = rememberView(explorationTrail, {
    id: active.id, target: active.name, stage, distance: camera.distance,
    yaw: camera.yaw, pitch: camera.pitch, roll: camera.roll, region:camera.observationPoint?.key
  });
}

function report(scale, frame, radius, projection, observed, observedProjection, now) {
  if (now - lastReport < 180 && captureRequest === null) return;
  lastReport = now;
  rememberObservation();
  const advice = sunlitView();
  const inspection = localInspectionRange(observed);
  const state = {
    ...renderer.diagnostics(), version: VERSION, renderer: 'webgpu', gpu: 'webgpu', ...scale,
    activeId: active.id, active: active.name, catalog: catalog.count,
    observedId: observed.id, observed: observed.name, activeKind: active.kind, observedKind: observed.kind,
    draw: catalog.drawIndices.length, planetDraw: catalog.planets.length, dwarfplanetDraw: catalog.dwarfplanets.length, asteroidDraw: catalog.asteroids.length, nebulaDraw: catalog.nebulae.length, moonDraw: catalog.moons.length, labels: labelCount, budget: catalog.budget,
    galaxyDraw: catalog.galaxies.length, galaxyStarsDraw: catalog.galaxyLights.length, cometDraw: catalog.comets.length, pulsarDraw: catalog.pulsars.length, blackholeDraw: catalog.blackholes.length,
    finiteStarDraw: catalog.bodies.filter(body => body.kind === 'star').length,
    fps: 1000 / Math.max(1, frameMs), frameMs,
    distance: camera.distance, distanceTarget: camera.distanceTarget,
    cameraYaw: frame.yaw, cameraPitch: frame.pitch, cameraRoll: frame.roll, fov: frame.fov,
    recentViews: explorationTrail.map(({ id, target, stage }) => ({ id, target, stage })),
    revisiting: Boolean(revisitView),
    systemView: systemViewState(),
    galaxyInspection:galaxyInspectionState(),
    observationArea: observationArea || { x: 0, y: 0, width, height },
    activeX: projection.x, activeY: projection.y,
    observedX: observedProjection.x, observedY: observedProjection.y,
    starRadiusPx: radius, bodyExtentPx: radius * Math.max(observed.extent || 1, observed.rings?.outer || 1, ...(observed.axes || [])), starVisibility: smoothstep(0.55, 3.5, radius), rotationPhase: spin,
    insideNebula: observed.kind === 'nebula' && camera.distance < observed.radius * observed.extent,
    sunlitAvailable: Boolean(advice), sunlitTurn: observationTurn === 'sunlit' && Boolean(camera.flight),
    terrainAvailable: Boolean(advice) && hasMappedTerrain(active), terrainTurn: observationTurn === 'terrain' && Boolean(camera.flight),
    surfaceInspection: {
      supported: Boolean(inspection) && active.id === observed.id && !systemView,
      available: Boolean(inspection) && settledObservation(),
      close: Boolean(inspection) && camera.distance < observed.radius * Math.min(inspection.minimum * 1.55, (inspection.minimum + inspection.whole) / 2),
      kind: inspection?.kind || null
    },
    flight: Boolean(camera.flight), animationTime: elapsed, motionEnergy: Math.abs(motion),
    observedPosition: observed.position.slice(), activePosition: active.position.slice(),
    sceneMotion: { mode: activityMode, rate: sceneMotionRate(activityMode, config.reducedMotion), reduced: config.reducedMotion },
    flightPhase: camera.flight?.phase || null,
    navigationState: camera.flight ? (camera.flight.overview ? 'returning' : 'flying') : camera.focusHold ? 'paused' : Math.abs(Math.log(camera.distance / camera.distanceTarget)) > 0.01 ? 'zooming' : 'observing',
    environment: environmentState(camera, observed),
    environmentDraw: { sky: catalog.environment.sky.length, transit: catalog.environment.transit.length, galaxyReferences: catalog.galaxyReferences.length }
  };
  state.scaleStops = scaleStops(camera);
  if (discoveryOpen) {
    const visible = new Map(targets.map(target => [target.id, target]));
    const occluders = targets.filter(target => target.cast);
    state.destinationViews = discoveryBodies.map(({id})=>{const {direction}=destinationView(id,frame,visible,occluders);return {id,direction};});
    state.destinationPreview = currentDestinationPreview;
  }
  if (config.debug) state.annotations = labelRects.map(rect => ({ id: rect.id, x: rect.x, y: rect.y, width: rect.w, height: rect.h }));
  const relation = bodyRelations(catalog, active.id);
  state.relations = {
    parent: relation.parent ? { id: relation.parent.id, target: relation.parent.name, kind: relation.parent.kind } : null,
    children: relation.children.map(body => ({ id: body.id, target: body.name, kind: body.kind }))
  };
  if (config.debug) {
    state.hoveredId = hover;
    if (observed.rings) state.ringPoint = projectPoint([observed.position[0] + observed.radius * 2.1, ...observed.position.slice(1)], frame, width, height);
    const visible = targets.filter(target => target.id < 24 || target.id >= catalog.count || target.star.kind !== 'star' || target.id === active.id || target.id === observed.id);
    state.visibleTargets = visible.slice(0, 24).map(({ id, name, x, y, radius: r }) => ({ id, name, x, y, radius: r }));
  }
  self.postMessage({ type: 'state', state });
}

function render(now) {
  if (!running || suspended) return;
  try {
    const cpuStarted = performance.now();
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
    const measured = lastFrame ? now - lastFrame : 16.7;
    frameMs += (measured - frameMs) * 0.08;
    lastFrame = now;
    elapsed = advanceSceneTime(elapsed, dt, activityMode, config.reducedMotion);
    spin = elapsed * 0.041;
    galaxyFrame = galacticFrame(elapsed);
    bodyLocalPoses = bodyMotion.snapshot(elapsed);
    bodyPoses = new Map([...bodyLocalPoses].map(([id, body]) => [id, galaxyFrame.body(body)]));
    active = sceneBody(active.id);
    const region=galaxyObservationRegions(active).find(item=>item.key===camera.observationPoint?.key);
    updateCameraAnchors(camera, { active, observed: sceneBody(camera.observedId), departure: sceneBody(camera.flight?.fromId),
      observationPoint:region?{key:region.key,position:galaxyRegionPosition(active,region,elapsed)}:null,
      departureParent: sceneBody(camera.flight?.navigation?.from?.id), arrivalParent: sceneBody(camera.flight?.navigation?.to?.id) });
    const previousDistance = camera.distance;
    updateCamera(camera, dt, now);
    if (observationTurn && !camera.flight) observationTurn = null;
    if (revisitView && !camera.flight && !camera.focusHold) {
      if(revisitView.region && !revisitView.regionStarted) {
        inspectGalaxyRegion(revisitView.region,revisitView.distance);
        revisitView.regionStarted=true;
      } else revisitView=null;
    }
    if (systemView?.pending && !camera.flight && !camera.focusHold) systemView.pending = false;
    const speed = Math.max(-1, Math.min(1, Math.log(previousDistance / camera.distance) / Math.max(dt, 0.001) / 12));
    motion += (speed - motion) * (1 - Math.exp(-9 * dt));
    if (config.reducedMotion || camera.focusHold) motion = 0;
    const framingStep = config.reducedMotion ? 1 : 1 - Math.exp(-12 * dt);
    composition = composition.map((value, i) => Math.abs(value - compositionTarget[i]) < 0.00001 ? compositionTarget[i] : value + (compositionTarget[i] - value) * framingStep);
    const frame = cameraFrame(camera, width / height, composition);
    const observed = sceneBody(frame.observedId);
    if (setObservedGalaxy(catalog, observed.id)) renderer.setGalaxyLights(catalog.galaxyLights);
    const scaleTarget = readingLensScale(frame, observed, camera.minDistance, width, height, observationArea);
    compositionScale = Math.abs(compositionScale - scaleTarget) < 0.00001 ? scaleTarget : compositionScale + (scaleTarget - compositionScale) * framingStep;
    frame.fov = 2 * Math.atan(Math.tan(frame.fov / 2) / compositionScale);
    currentFrame = frame; currentObserved = observed;
    const scale = scaleState(camera, observed);
    const distance = Math.hypot(...observed.position.map((value, index) => value - frame.eye[index]));
    const observedProjection = projectPoint(observed.position, frame, width, height);
    const projection = projectPoint(active.position, frame, width, height);
    let radius = observedProjection.depth > frame.near ? height * 0.5 / Math.tan(frame.fov / 2) * observed.radius / Math.sqrt(Math.max(observed.radius ** 2, distance ** 2 - observed.radius ** 2)) : 0;
    // A region can face away from the galaxy's centre while still surrounded
    // by its volume. Keep that same bounded volume resolved in such a view.
    if(camera.observationPoint && observed.kind==='galaxy') radius=Math.max(radius,height*.5/Math.tan(frame.fov/2)*observed.radius/camera.distance);
    targets = projectedTargets(frame, radius, observed);
    currentDestinationPreview=destinationPreview();
    hover = pointer ? pick(pointer.x, pointer.y) : -1;
    renderer.render({ frame, star: observed, sun: sceneBody(0), illuminant: sceneIlluminant(observed), bodies: catalog.bodies.map(body => sceneBody(body.id)), bodyPoses, time: elapsed, galacticAngle: galaxyFrame.angle, spin, progress: scale.scaleAxisProgress, hover, starRadiusPx: radius,
      environment: environmentState(camera, observed), referenceFocus: systemReferenceAlpha(observed), motion, reducedMotion: config.reducedMotion, seed: config.seed });
    drawLabels(scale, radius, observed);
    report(scale, frame, radius, projection, observed, observedProjection, now);
    renderer.recordCpu(performance.now() - cpuStarted);
    if (captureRequest !== null) {
      const id = captureRequest;
      captureRequest = null;
      let bitmap;
      try {
        // Snapshot scene and labels together, before advancing another frame.
        const copy = new OffscreenCanvas(sceneCanvas.width, sceneCanvas.height);
        const pixels = copy.getContext('2d');
        pixels.drawImage(sceneCanvas, 0, 0);
        pixels.drawImage(labelsCanvas, 0, 0, copy.width, copy.height);
        bitmap = copy.transferToImageBitmap();
        suspended = true;
        suspendedAt = now;
        suspendedId = id;
        self.postMessage({ type: 'capture', id, bitmap,
          view: { observedId: observed.id, observed: observed.name, activeKind: active.kind, observedKind: observed.kind, activeId: active.id, active: active.name, scaleStage: scale.scaleStage, systemView: systemViewState(), galaxyRegion:galaxyInspectionState().settled?camera.observationPoint.key:null, insideNebula: observed.kind === 'nebula' && camera.distance < observed.radius * observed.extent,
            shapeTargets: targets.filter(target => target.surfaceRadius > 1 && solidShape(target.star.material,target.star.seed)).map(target => target.star.name),
            mapBodies: targets.filter(target => target.surfaceRadius > 1 && ['earth', 'moon', 'mars', 'jupiter', 'mercury', 'io', 'europa', 'enceladus', 'ganymede', 'callisto', 'triton', 'mimas', 'pluto', 'charon', 'ceres', 'vesta', 'phobos', 'deimos', 'miranda', 'iapetus', 'ariel', 'umbriel', 'titania', 'oberon', 'rhea', 'dione', 'tethys'].includes(target.star.material)).map(target => target.star.material) }
        }, [bitmap]);
      } catch (error) {
        bitmap?.close();
        suspended = false;
        suspendedId = null;
        self.postMessage({ type: 'capture-error', id, message: String(error.message) });
      }
    }
    if (!suspended) frameRequest = schedule(render);
  } catch (error) { fail(error.stack || error.message); }
}

async function init(message) {
  self.postMessage({ type: 'boot' });
  config = message.config;
  catalog = createCatalog(config);
  bodyMotion = createBodyMotion(catalog, { compactStellarFamilies: true });
  bodyLocalPoses = bodyMotion.snapshot(0);
  bodyPoses = new Map([...bodyLocalPoses].map(([id, body]) => [id, galaxyFrame.body(body)]));
  active = sceneBody(catalog.activeId);
  camera = createCamera(active, { reducedMotion: config.reducedMotion });
  labelsCanvas = message.labels;
  sceneCanvas = message.scene;
  ink = labelsCanvas.getContext('2d');
  renderer = await createRenderer(sceneCanvas, fail, config);
  if (failed) return;
  renderer.setCatalog(catalog);
  resize();
  self.postMessage({ type: 'firstLight' });
  running = true;
  render(performance.now());
  const system = bodySystem(catalog, 0);
  const innerSystem = bodySystem(catalog, 0, { region: 'inner' });
  const otherRoots = new Set(catalog.bodies.map(body => bodySystem(catalog, body.id)?.root.id).filter(id => id !== undefined && id !== 0));
  const localFamilies = [...otherRoots].map(id => {
    const family = bodySystem(catalog, id);
    return { rootId: id, members: family.members.map(body => ({ id: body.id, target: body.name, kind: body.kind, parentId: body.parentId })) };
  });
  discoveryBodies = namedDestinations(catalog);
  self.postMessage({ type: 'ready', destinations: discoveryBodies,
    localFamilies,
    system: system ? { rootId: system.root.id, innerMemberIds: innerSystem?.members.map(body => body.id) || [], members: system.members.map(body => ({ id: body.id, target: body.name, kind: body.kind, parentId: body.parentId })) } : null });
}

self.onmessage = ({ data: message }) => {
  if (message.type === 'init') { init(message).catch(error => fail(error.stack || error.message)); return; }
  if(message.type==='galaxy-region-preview') {
    galaxyRegionPreview=message.key && message.id===active?.id && galaxyObservationRegions(active).some(item=>item.key===message.key)?{id:active.id,key:message.key}:null;
    lastReport=0;return;
  }
  if (message.type === 'discovery') { discoveryOpen = Boolean(message.open); if(!discoveryOpen) destinationPreviewId=null; lastReport = 0; return; }
  if (message.type === 'destination-preview') { destinationPreviewId=discoveryOpen && discoveryBodies.some(body=>body.id===message.id)?message.id:null; lastReport=0;return; }
  if (message.type === 'resize') {
    width = Math.max(1, message.width); height = Math.max(1, message.height); dpr = Math.max(0.5, message.dpr || 1);
    resize(); return;
  }
  if (message.type === 'framing') {
    if ([message.centerX, message.centerY].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      compositionTarget = [message.centerX, message.centerY];
      observationArea = message.area;
      readingPanels = message.panels || [];
    }
    return;
  }
  if (message.type === 'destroy') {
    running = false; cancel(frameRequest); renderer?.destroy(); self.close(); return;
  }
  if (message.type === 'preferences') {
    if (config) config.reducedMotion = Boolean(message.reducedMotion);
    if (camera) setReducedMotion(camera, message.reducedMotion);
    return;
  }
  if (!camera || !running) return;
  if (message.type === 'scene-motion') {
    activityMode = sceneMotionMode(message.mode);
    lastReport = 0;
    return;
  }
  if (message.type === 'capture') {
    if (!suspended && captureRequest === null) captureRequest = message.id;
    else self.postMessage({ type: 'capture-error', id: message.id, message: 'A capture is already open.' });
    return;
  }
  if (message.type === 'resume') {
    if (captureRequest === message.id) captureRequest = null;
    if (suspended && suspendedId === message.id) {
      const now = performance.now();
      if (camera.flight) camera.flight.startedAt += now - suspendedAt;
      camera.lastInteractionTime = now;
      lastFrame = 0;
      suspended = false;
      suspendedId = null;
      frameRequest = schedule(render);
    }
    return;
  }
  if (message.type === 'quality') {
    if (qualityChanging || suspended || captureRequest !== null) return;
    qualityChanging = true;
    (async () => {
      try {
        await renderer.setQuality(message.key);
        setCatalogBudget(catalog, message.key, active.id, camera.observedId);
        renderer.setCatalog(catalog);
        config.budget = catalog.budget.key;
        resize();
        lastReport = 0;
        self.postMessage({ type: 'quality-ready', key: catalog.budget.key });
      } catch (error) { self.postMessage({ type: 'quality-error', message: String(error.message) }); }
      finally { qualityChanging = false; }
    })();
    return;
  }
  if (suspended || captureRequest !== null) return;
  if (['drag', 'wheel', 'scale', 'focus', 'revisit', 'overview', 'space-overview', 'system-overview', 'reset', 'cancelFlight','galaxy-region','nebula-entry'].includes(message.type)) { observationTurn = null; galaxyRegionPreview = null; }
  if (message.type === 'pointermove') pointer = { x: message.x, y: message.y };
  else if (message.type === 'pointerleave') { pointer = null; hover = -1; }
  else if (message.type === 'pointerdown') { camera.dragging = true; camera.lastInteractionTime = performance.now(); }
  else if (message.type === 'pointerup') camera.dragging = false;
  else if (message.type === 'drag') orbitCamera(camera, message.dx, message.dy);
  else if (message.type === 'wheel') zoomCamera(camera, message.deltaY);
  else if (message.type === 'scale') setCameraScale(camera, message.progress);
  else if(message.type==='nebula-entry' && enterNebula(camera,sceneBody(camera.observedId))) lastReport=0;
  else if(message.type==='galaxy-region') {
    if(galaxyInspectionState().available && (message.key===null || galaxyObservationRegions(active).some(item=>item.key===message.key))) {
      revisitView=null;systemView=null;inspectGalaxyRegion(message.key);lastReport=0;
    }
  }
  else if (message.type === 'sunlit') {
    const view = sunlitView();
    if (view && turnCamera(camera, active, view, performance.now())) {
      revisitView = null;
      observationTurn = camera.flight ? 'sunlit' : null;
      lastReport = 0;
    }
  }
  else if (message.type === 'terrain') {
    const view = sunlitView() && mappedTerrainObservationView(active, sceneIlluminant(active), {
      distance: camera.distance, yaw: camera.yaw, pitch: camera.pitch, roll: camera.roll
    }, spin);
    if (view && turnCamera(camera, active, view, performance.now())) {
      revisitView = null;
      observationTurn = camera.flight ? 'terrain' : null;
      lastReport = 0;
    }
  }
  else if (message.type === 'system-overview') {
    const local = message.local === true;
    const region = message.region;
    const system = bodySystem(catalog, message.id, { local, region });
    if (system) {
      rememberObservation();
      revisitView = null;
      system.root = sceneBody(system.root.id);
      system.members = system.members.map(body => sceneBody(body.id));
      const frame = cameraFrame(camera, width / height, compositionTarget);
      const lensScale = readingLensScale(frame, system.root, system.root.radius * (system.root.nearLimit || 3.1), width, height, observationArea);
      frame.fov = 2 * Math.atan(Math.tan(frame.fov / 2) / lensScale);
      // Fit the complete finite orbital envelopes, so waiting never crops a member.
      // The camera follows the root: its orbit around a wider family is not part of this envelope.
      const envelope = system.members.flatMap(body => body.id === system.root.id ? [body] :
        [body, ...bodyMotion.path(body.id, bodyLocalPoses).map(position => ({ ...body, position: galaxyFrame.toWorld(position) }))]);
      const sunlight = local && system.root.id !== 0 && system.root.kind !== 'star' ?
        sceneIlluminant(system.root).position.map((value, i) => value - system.root.position[i]) : undefined;
      const view = systemOverviewView(system.root, envelope, frame, width, height, observationArea, { sweepYaw: true, sunlight });
      systemView = { ...system, scope: region === 'inner' ? 'inner' : local ? 'local' : 'family', view, pending: true };
      active = system.root;
      focusObservation(active, view);
    }
  }
  else if (message.type === 'revisit') {
    rememberObservation();
    const view = recalledView(explorationTrail, message.id);
    const star = view && sceneBody(view.id);
    if (star) {
      if (star.id < catalog.count && !catalog.drawIndices.includes(star.id)) {
        setCatalogBudget(catalog, catalog.budget.key, star.id, camera.observedId);
        renderer.setCatalog(catalog);
      }
      active = sceneBody(star.id);
      systemView = null;
      revisitView = view;
      focusObservation(active, view);
    }
  }
  else if (message.type === 'focus') {
    if(message.resume && message.target===active.name && (camera.observationPoint || camera.pointNavigation)) {
      inspectGalaxyRegion(camera.observationPoint?.key||null,camera.observationPoint?.distance);
      return;
    }
    const star = resolveCatalogTarget(catalog, message.target);
    if (star && (catalog.bodies.some(body => body.id === star.id) || catalog.drawIndices.includes(star.id))) {
      rememberObservation();
      if (!message.resume || revisitView?.id !== star.id) revisitView = null;
      if (!message.resume || systemView?.root.id !== star.id || !systemView.pending) systemView = null;
      active = sceneBody(star.id);
      focusObservation(active, revisitView || systemView?.view);
    }
  } else if ((message.type === 'overview' || message.type === 'space-overview')) {
    rememberObservation();
    revisitView = null;
    systemView = null;
    returnObservation(active, message.type === 'space-overview');
  }
  else if (message.type === 'tap') {
    const id = pick(message.x, message.y);
    if (id >= 0 && id !== active.id) {
      observationTurn = null;
      rememberObservation();
      revisitView = null;
      systemView = null;
      active = sceneBody(id);
      focusObservation(active);
    } else if (id === active.id && camera.distance > active.radius * 12) {
      observationTurn = null;
      rememberObservation();
      revisitView = null;
      systemView = null;
      focusObservation(active);
    }
  } else if (message.type === 'reset') {
    rememberObservation();
    revisitView = null;
    systemView = null;
    active = sceneBody(catalog.activeId);
    returnObservation(active);
  } else if (message.type === 'cancelFlight') {
    cancelCameraFlight(camera);
  }
};
