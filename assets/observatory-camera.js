// Target-anchored navigation and reciprocal projection, independent of catalog and GPU.
import { clamp, mix, smoothstep } from './observatory-math.js?v=cosmic-explore-20261010gu';
import { bodyNearLimit } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
// Enter within the extended stellar field; the user can still pull back.
const OVERVIEW_DISTANCE = 14;
const MAX_DISTANCE = 80;
const MAX_PITCH = 1.38;
const SCALE_RATE = 3.6;
// Large external galaxies retain the same scale semantics as smaller subjects.
// Their map return must retreat outside their own complete volume.
const overviewDistanceFor = body => body?.kind === 'galaxy' ? Math.max(OVERVIEW_DISTANCE,body.radius*32) : OVERVIEW_DISTANCE;

function distanceTravelTime(from, to, minimum = 700) {
  // Smoothstep's peak slope is 1.5. Schedule by perceived scale change,
  // so a large jump cannot collapse the intermediate space into a flash.
  return Math.max(minimum, 1500 * Math.abs(Math.log(to / from)) / SCALE_RATE);
}

function setActive(camera, star) {
  camera.activeId = star.id;
  camera.activePosition = star.position.slice();
  camera.activeRadius = star.radius;
  camera.activeKind = star.kind;
  camera.activeSurfaceArrival = star.rings ? 8.5 : 6;
  camera.activeArrival = Number.isFinite(star.arrivalDistanceRatio) ? clamp(star.arrivalDistanceRatio, camera.activeSurfaceArrival, 1024) : camera.activeSurfaceArrival;
  camera.activeNearLimit = bodyNearLimit(star);
  camera.activeArrivalView = star.arrivalView || null;
  camera.activeParentId = star.parentId;
}

function setObserved(camera, star) {
  const id = star?.id ?? camera.activeId;
  if (camera.observedId === id) return;
  camera.observedId = id;
  camera.observedPosition = (star?.position || camera.activePosition).slice();
  camera.observedRadius = star?.radius || camera.activeRadius;
  camera.observedKind = star?.kind || camera.activeKind;
  camera.observedArrival = star ? (star.rings ? 8.5 : 6) : camera.activeSurfaceArrival;
  camera.observedParentId = star ? star.parentId : camera.activeParentId;
  camera.minDistance = camera.observedRadius * (star ? bodyNearLimit(star) : camera.activeNearLimit);
}

export function createCamera(activeStar, { reducedMotion = false } = {}) {
  const camera = {
    yaw: -0.36,
    pitch: 0.18,
    roll: 0,
    distance: overviewDistanceFor(activeStar),
    distanceTarget: overviewDistanceFor(activeStar),
    focus: activeStar.position.slice(),
    maxDistance: MAX_DISTANCE,
    yawVelocity: 0,
    pitchVelocity: 0,
    dragging: false,
    lastInteractionTime: 0,
    now: 0,
    flight: null,
    scaleNavigation: false,
    focusHold: null,
    observationPoint: null,
    pointNavigation:false,
    reducedMotion: Boolean(reducedMotion)
  };
  setActive(camera, activeStar);
  setObserved(camera, activeStar);
  // Initial focus uses the same authored pose as an explicit arrival. Apply it
  // once, keeping the overview distance and subsequent user orientation intact.
  applyArrivalView(camera, { fromYaw: camera.yaw, fromPitch: camera.pitch, fromRoll: camera.roll }, 1);
  return camera;
}

function framingTarget(camera) {
  return camera.focusHold || camera.observationPoint?.position || camera.observedPosition.slice();
}

// A moving observation anchor translates the camera, never its lens or orbit.
// Flight endpoints track independently so departure and arrival stay continuous.
export function updateCameraAnchors(camera, { active, observed, departure, departureParent, arrivalParent, observationPoint } = {}) {
  if (active?.id === camera.activeId) {
    camera.activePosition = active.position.slice();
    if (camera.flight && !camera.flight.overview && !camera.flight.fixedArrival) camera.activeArrivalView = active.arrivalView || null;
  }
  if (observed?.id === camera.observedId) {
    let delta = observed.position.map((value, i) => value - camera.observedPosition[i]);
    if(camera.observationPoint && observationPoint?.key===camera.observationPoint.key) {
      delta=observationPoint.position.map((v,i)=>v-camera.observationPoint.position[i]);
      camera.observationPoint.position=observationPoint.position.slice();
    }
    camera.observedPosition = observed.position.slice();
    camera.focus = camera.focus.map((value, i) => value + delta[i]);
    if (camera.focusHold) camera.focusHold = camera.focusHold.map((value, i) => value + delta[i]);
  }
  const flight = camera.flight;
  if (flight && departure?.id === flight.fromId) {
    const delta = departure.position.map((value, i) => value - flight.fromPosition[i]);
    flight.fromFocus = flight.fromFocus.map((value, i) => value + delta[i]);
    flight.fromPosition = departure.position.slice();
  }
  if (flight?.navigation) for (const [key, parent] of [['from', departureParent], ['to', arrivalParent]]) {
    if (parent && parent.id === flight.navigation[key]?.id) flight.navigation[key].position = parent.position.slice();
  }
}

function constrainPitch(camera, pitch) {
  return clamp(pitch, -MAX_PITCH, MAX_PITCH);
}

function applyArrivalView(camera, flight, amount) {
  const view = camera.activeArrivalView;
  if (!view) return;
  const desiredYaw = view.yaw;
  const previous = flight.arrivalYaw ?? flight.fromYaw;
  flight.arrivalYaw = previous + Math.atan2(Math.sin(desiredYaw - previous), Math.cos(desiredYaw - previous));
  camera.yaw = amount === 1 ? desiredYaw : mix(flight.fromYaw, flight.arrivalYaw, amount);
  camera.pitch = constrainPitch(camera, amount===1?view.pitch:mix(flight.fromPitch,view.pitch,amount));
  if (Number.isFinite(view.roll)) {
    const previousRoll=flight.arrivalRoll ?? flight.fromRoll;
    flight.arrivalRoll=previousRoll+Math.atan2(Math.sin(view.roll-previousRoll),Math.cos(view.roll-previousRoll));
    camera.roll=amount===1?view.roll:mix(flight.fromRoll,flight.arrivalRoll,amount);
  }
}

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };
const viewDirection = view => [Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch)];
function clearanceBody(body) {
  if (!body || !(body.radius > 0) || !body.position?.every(Number.isFinite)) return null;
  return { id: body.id, position: body.position.slice(), radius: body.radius * Math.max(1, body.rings?.outer || 1, ...(body.axes || [])) };
}
function crossingClearance(navigation, from, to) {
  return Math.max(0, ...[navigation.from, navigation.to].filter(Boolean).map(parent =>
    Math.max(Math.hypot(...from.map((value, i) => value - parent.position[i])),
      Math.hypot(...to.map((value, i) => value - parent.position[i]))) * 2 + parent.radius * 4));
}
function setDirection(camera, direction) {
  const yaw = Math.atan2(direction[0], direction[2]);
  camera.yaw += Math.atan2(Math.sin(yaw - camera.yaw), Math.cos(yaw - camera.yaw));
  camera.pitch = constrainPitch(camera, Math.asin(clamp(direction[1], -1, 1)));
}
function mixDirections(from, to, amount, navigation, key = 'cross') {
  const yaw = Math.atan2(from[0], from[2]), target = Math.atan2(to[0], to[2]);
  const fromKey = key + 'FromYaw', toKey = key + 'ToYaw';
  const fromYaw = navigation[fromKey] ?? yaw, toYaw = navigation[toKey] ??
    fromYaw + Math.atan2(Math.sin(target - fromYaw), Math.cos(target - fromYaw));
  navigation[fromKey] = fromYaw + Math.atan2(Math.sin(yaw - fromYaw), Math.cos(yaw - fromYaw));
  navigation[toKey] = toYaw + Math.atan2(Math.sin(target - toYaw), Math.cos(target - toYaw));
  if (amount === 1) navigation[fromKey] = navigation[toKey] +
    Math.atan2(Math.sin(yaw - navigation[toKey]), Math.cos(yaw - navigation[toKey]));
  return viewDirection({ yaw: mix(navigation[fromKey], navigation[toKey], amount),
    pitch: mix(Math.asin(clamp(from[1], -1, 1)), Math.asin(clamp(to[1], -1, 1)), amount) });
}
function safeDirection(center, parent, original, amount, navigation, key) {
  if (!parent || amount === 0) return original;
  const offset = parent.position.map((value, i) => value - center[i]), radius = Math.hypot(...offset);
  if (radius < parent.radius * .01) return original;
  const toward = offset.map(value => value / radius), cosine = clamp(dot(original, toward), -1, 1);
  // A corridor tangent to the parent's full extent keeps the closest pass to
  // the side of the lens. Its orientation follows the parent without flipping
  // when a moving moon crosses the original heading.
  let side = unit(Math.hypot(toward[0], toward[2]) > 1e-8 ? [toward[2], 0, -toward[0]] : [1, 0, 0]);
  const signKey = key + 'Side';
  navigation[signKey] ??= dot(original, side) < 0 ? -1 : 1;
  side = side.map(value => value * navigation[signKey]);
  const up = [toward[1]*side[2]-toward[2]*side[1], toward[2]*side[0]-toward[0]*side[2], toward[0]*side[1]-toward[1]*side[0]];
  const angleKey = key + 'Angle', angle = Math.atan2(dot(original, up), dot(original, side));
  const previous = navigation[angleKey] ?? angle;
  navigation[angleKey] = previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
  const azimuth = navigation[angleKey] * (1 - amount);
  const clearanceAngle = Math.min(Math.PI / 2, Math.max(Math.PI / 3, Math.asin(clamp(parent.radius / radius, 0, 1)) + .12));
  const theta = mix(Math.acos(cosine), clearanceAngle, amount);
  return toward.map((value, i) => value * Math.cos(theta) +
    (side[i] * Math.cos(azimuth) + up[i] * Math.sin(azimuth)) * Math.sin(theta));
}

function turnDirection(center, parent, original, amount, navigation, key, distance) {
  if (!parent || amount === 0) return original;
  const separation = Math.hypot(...parent.position.map((value, i) => value - center[i]));
  // At a distance safe for every heading, restore yaw/pitch without an arc
  // over the pitch pole. Close departure and final arrival use this same path.
  if (distance < separation - parent.radius || distance > separation + parent.radius) {
    return mixDirections(original, safeDirection(center, parent, original, 1, navigation, key), amount, navigation, key + 'Turn');
  }
  return safeDirection(center, parent, original, amount, navigation, key);
}

export function setReducedMotion(camera, value) {
  camera.reducedMotion = Boolean(value);
  if (camera.reducedMotion) {
    camera.yawVelocity = 0;
    camera.pitchVelocity = 0;
  }
}

export function updateCamera(camera, dt, now) {
  const elapsed = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  camera.now = now;
  if (camera.reducedMotion && camera.flight) {
    const flight = camera.flight;
    camera.flight = null;
    camera.pointNavigation=false;
    camera.distance = camera.distanceTarget;
    setObserved(camera);
    camera.focus = framingTarget(camera);
    if (flight.overview) {
      camera.yaw = flight.fromYaw;
      camera.pitch = constrainPitch(camera, flight.fromPitch);
      camera.roll = flight.fromRoll;
    } else if(!flight.point) applyArrivalView(camera, { fromYaw: camera.yaw, fromPitch: camera.pitch, fromRoll: camera.roll }, 1);
  }
  if (camera.flight) {
    const flight = camera.flight;
    const t = clamp((now - flight.startedAt) / flight.duration, 0, 1);
    if (flight.overview) {
      const milliseconds = Math.max(0, now - flight.startedAt);
      const amount = flight.navigation ? smoothstep(flight.departureTurn, flight.duration, milliseconds) : smoothstep(0, 1, t);
      camera.distance = Math.exp(mix(Math.log(flight.fromDistance), Math.log(camera.distanceTarget), amount));
      // A return keeps its observation anchor. An explicit reset to another
      // target translates only after backing away from the current subject.
      const translation = camera.observedId === camera.activeId ? amount
        : smoothstep(Math.log(camera.observedRadius * 160), Math.log(camera.distanceTarget), Math.log(camera.distance));
      camera.focus = flight.fromFocus.map((value, i) => mix(value, camera.activePosition[i], translation));
      if (flight.navigation) {
        const original = viewDirection({ yaw: flight.fromYaw, pitch: flight.fromPitch });
        const turn = flight.departureTurn ? smoothstep(0, flight.departureTurn, milliseconds) : amount;
        const restore = smoothstep(Math.log(flight.clearanceDistance), Math.log(camera.distanceTarget), Math.log(camera.distance));
        setDirection(camera, turnDirection(flight.fromFocus, flight.navigation.from, original, turn * (1 - restore), flight.navigation, 'from', camera.distance));
      }
    } else if(flight.point) {
      const milliseconds=Math.max(0,now-flight.startedAt);
      const retreat=smoothstep(0,flight.departureDuration,milliseconds);
      const crossing=smoothstep(flight.departureDuration,flight.crossingEnd,milliseconds);
      const approach=smoothstep(flight.crossingEnd,flight.duration,milliseconds);
      flight.phase=milliseconds<flight.departureDuration?'departing':milliseconds<flight.crossingEnd?'crossing':'approaching';
      camera.focus=flight.fromFocus.map((v,i)=>mix(v,framingTarget(camera)[i],crossing));
      const far=Math.exp(mix(Math.log(flight.fromDistance),Math.log(flight.travelDistance),retreat));
      camera.distance=Math.exp(mix(Math.log(far),Math.log(camera.distanceTarget),approach));
    } else if (flight.radial) {
      flight.phase = 'approaching';
      camera.focus = camera.activePosition.slice();
      camera.distance = flight.fromDistance === camera.distanceTarget ? flight.fromDistance :
        Math.exp(mix(Math.log(flight.fromDistance), Math.log(camera.distanceTarget), smoothstep(0, 1, t)));
    } else if (flight.navigation) {
      const navigation = flight.navigation, milliseconds = Math.max(0, now - flight.startedAt);
      flight.travelDistance = Math.min(camera.maxDistance, Math.max(flight.travelDistance,
        crossingClearance(navigation, flight.fromFocus, camera.activePosition)));
      const fromDirection = viewDirection({ yaw: flight.fromYaw, pitch: flight.fromPitch });
      const desired = camera.activeArrivalView || { yaw: flight.fromYaw, pitch: flight.fromPitch, roll: flight.fromRoll };
      const toDirection = viewDirection(desired);
      if (milliseconds < flight.departureDuration) {
        flight.phase = navigation.sameSubject ? 'approaching' : navigation.startUnresolved ? 'crossing' : 'departing';
        camera.focus = flight.fromFocus.slice();
        const retreat = smoothstep(flight.departureTurn, flight.departureDuration, milliseconds);
        camera.distance = Math.exp(mix(Math.log(flight.fromDistance), Math.log(flight.travelDistance), retreat));
        const turn = flight.departureTurn ? smoothstep(0, flight.departureTurn, milliseconds)
          : navigation.fromFar ? retreat : 1;
        setDirection(camera, turnDirection(camera.focus, navigation.from, fromDirection, turn, navigation, 'from', camera.distance));
      } else {
        setObserved(camera);
        if (milliseconds < flight.crossingEnd) {
          flight.phase = 'crossing';
          const amount = smoothstep(flight.departureDuration, flight.crossingEnd, milliseconds);
          camera.focus = flight.fromFocus.map((value, i) => mix(value, camera.activePosition[i], amount));
          camera.distance = flight.travelDistance;
          setDirection(camera, mixDirections(
            safeDirection(flight.fromFocus, navigation.from, fromDirection, 1, navigation, 'from'),
            safeDirection(camera.activePosition, navigation.to, toDirection, 1, navigation, 'to'), amount, navigation));
        } else {
          flight.phase = 'approaching';
          camera.focus = camera.activePosition.slice();
          const approach = smoothstep(flight.crossingEnd, flight.approachEnd, milliseconds);
          camera.distance = Math.exp(mix(Math.log(flight.travelDistance), Math.log(camera.distanceTarget), approach));
          const turn = flight.arrivalTurn ? smoothstep(flight.approachEnd, flight.duration, milliseconds) : approach;
          setDirection(camera, turnDirection(camera.focus, navigation.to, toDirection, 1 - turn, navigation, 'to', camera.distance));
          camera.roll = mix(flight.fromRoll, Number.isFinite(desired.roll) ? desired.roll : flight.fromRoll, turn);
        }
      }
    } else if (flight.departure) {
      const milliseconds = Math.max(0, now - flight.startedAt);
      if (milliseconds < flight.departureDuration) {
        flight.phase = 'departing';
        const amount = smoothstep(0, flight.departureDuration, milliseconds);
        camera.distance = Math.exp(mix(Math.log(flight.fromDistance), Math.log(flight.travelDistance), amount));
        camera.focus = flight.fromFocus.slice();
      } else {
        // Both subjects are starlight at this distance. Hand the one detailed
        // surface to the destination only after the departure has receded.
        setObserved(camera);
        if (milliseconds < flight.crossingEnd) {
          flight.phase = 'crossing';
          const amount = smoothstep(flight.departureDuration, flight.crossingEnd, milliseconds);
          camera.focus = flight.fromFocus.map((value, i) => mix(value, camera.activePosition[i], amount));
          camera.distance = flight.travelDistance;
        } else {
          flight.phase = 'approaching';
          camera.focus = camera.activePosition.slice();
          const amount = smoothstep(flight.crossingEnd, flight.duration, milliseconds);
          camera.distance = Math.exp(mix(Math.log(flight.travelDistance), Math.log(camera.distanceTarget), amount));
        }
      }
    } else {
      flight.phase = t < 0.67 ? 'crossing' : 'approaching';
      // Finish most of the translation before entering a stellar radius.
      const centerAmount = smoothstep(0.12, 0.67, t);
      camera.focus = flight.fromFocus.map((value, i) => mix(value, camera.activePosition[i], centerAmount));
      const retreat = smoothstep(0, 0.28, t);
      const approach = smoothstep(0.28, 1, t);
      const farDistance = Math.exp(mix(Math.log(flight.fromDistance), Math.log(flight.travelDistance), retreat));
      camera.distance = Math.exp(mix(Math.log(farDistance), Math.log(camera.distanceTarget), approach));
    }
    if (!flight.overview && !flight.point && !flight.navigation && flight.phase === 'approaching') {
      const arrival = flight.radial ? smoothstep(0, 1, t) : flight.departure ? smoothstep(flight.crossingEnd, flight.duration, now - flight.startedAt) : smoothstep(0.67, 1, t);
      applyArrivalView(camera, flight, arrival);
    }
    if (t === 1) {
      camera.pointNavigation=false;
      if (flight.navigation) {
        const desired = !flight.overview && camera.activeArrivalView || { yaw: flight.fromYaw, pitch: flight.fromPitch, roll: flight.fromRoll };
        camera.yaw = desired.yaw;
        camera.pitch = constrainPitch(camera, desired.pitch);
        camera.roll = Number.isFinite(desired.roll) ? desired.roll : flight.fromRoll;
      }
      camera.flight = null;
      camera.distance = camera.distanceTarget;
      setObserved(camera);
      camera.focus = framingTarget(camera);
    }
  } else {
    const response = 1 - Math.exp(-10.5 * elapsed);
    const scaleDelta = Math.log(camera.distanceTarget / camera.distance);
    const scaleStep = camera.reducedMotion ? scaleDelta : clamp(scaleDelta * response, -SCALE_RATE * elapsed, SCALE_RATE * elapsed);
    camera.distance *= Math.exp(scaleStep);
    if (Math.abs(Math.log(camera.distance / camera.distanceTarget)) < 1e-7) {
      camera.distance = camera.distanceTarget;
      camera.scaleNavigation = false;
    }
    const desired = framingTarget(camera);
    const centering = 1 - Math.exp(-12 * elapsed);
    camera.focus = camera.focus.map((value, i) => {
      const next = mix(value, desired[i], centering);
      return Math.abs(next - desired[i]) < camera.activeRadius * 1e-5 ? desired[i] : next;
    });
  }
  if (camera.reducedMotion) {
    camera.yawVelocity = 0;
    camera.pitchVelocity = 0;
  }
  if (!camera.dragging) {
    camera.yaw += camera.yawVelocity * elapsed;
    camera.pitch = constrainPitch(camera, camera.pitch + camera.pitchVelocity * elapsed);
  }
  const damping = Math.exp(-9 * elapsed);
  camera.yawVelocity *= damping;
  camera.pitchVelocity *= damping;
  return camera;
}

export function orbitCamera(camera, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  if (camera.flight || camera.scaleNavigation) cancelCameraFlight(camera);
  const horizontal = -dx * 0.0038;
  const vertical = dy * 0.0034;
  camera.yaw += horizontal;
  camera.pitch = constrainPitch(camera, camera.pitch + vertical);
  camera.yawVelocity = camera.reducedMotion ? 0 : horizontal * 7;
  camera.pitchVelocity = camera.reducedMotion ? 0 : vertical * 7;
  camera.lastInteractionTime = camera.now;
}

export function zoomCamera(camera, deltaY) {
  if (!Number.isFinite(deltaY)) return;
  camera.pointNavigation=false;
  camera.focusHold = null;
  camera.yawVelocity = 0;
  camera.pitchVelocity = 0;
  if (camera.flight || camera.scaleNavigation) {
    camera.flight = null;
    camera.scaleNavigation = false;
    camera.distanceTarget = camera.distance;
  }
  camera.distanceTarget = clamp(camera.distanceTarget * Math.exp(clamp(deltaY, -1500, 1500) * 0.0026), camera.minDistance, camera.maxDistance);
  camera.lastInteractionTime = camera.now;
}

export function setCameraScale(camera, progress) {
  if (!Number.isFinite(progress)) return;
  camera.focusHold = null;
  camera.observationPoint = null;
  camera.pointNavigation=false;
  camera.flight = null;
  camera.yawVelocity = 0;
  camera.pitchVelocity = 0;
  const amount = clamp(progress, 0, 1);
  camera.distanceTarget = Math.exp(mix(Math.log(camera.maxDistance), Math.log(camera.minDistance), amount));
  camera.scaleNavigation = !camera.reducedMotion && camera.distance !== camera.distanceTarget;
  camera.lastInteractionTime = camera.now;
}

// Enter the current transparent volume without assuming that twice its near
// limit is inside it. Large near limits still keep their existing safety range.
export function enterNebula(camera,body) {
  if(body?.kind!=='nebula' || body.id!==camera.observedId || body.id!==camera.activeId) return false;
  const outer=body.radius*body.extent;
  if(!Number.isFinite(outer) || outer<=camera.minDistance) return false;
  const distance=Math.max(camera.minDistance,Math.min(camera.minDistance*2,outer*.92));
  setCameraScale(camera,Math.log(camera.maxDistance/distance)/Math.log(camera.maxDistance/camera.minDistance));
  return true;
}

export function scaleStops(camera) {
  const localMap = Math.max(0.045, camera.observedRadius * 32);
  const choices = [
    ['Galactic', OVERVIEW_DISTANCE], ['Regional', Math.max(3, localMap * 6)], ['LocalMap', Math.max(0.25, localMap * 2)],
    ['LocalSystem', camera.observedRadius * 30], ['Surface', camera.observedRadius * camera.observedArrival]
  ];
  if(camera.observedKind==='galaxy') {
    for(let i=0;i<choices.length;i++) choices[i][1]=camera.observedRadius*[32,26,20,12,6][i];
  }
  const range = Math.log(camera.maxDistance / camera.minDistance);
  return choices.map(([stage, distance]) => ({ stage, progress: clamp(Math.log(camera.maxDistance / distance) / range, 0, 1) }));
}

export function focusCamera(camera, star, now = camera.now, recalled = null, { departureParent, arrivalParent } = {}) {
  camera.observationPoint = null;
  camera.pointNavigation=false;
  camera.focusHold = null;
  camera.scaleNavigation = false;
  const separation = Math.hypot(...camera.focus.map((value, i) => value - star.position[i]));
  let departure = camera.observedId !== star.id && camera.distance < camera.observedRadius * 160;
  const radial = camera.observedId === star.id && separation < Math.max(star.radius * 0.01, 1e-8);
  const related = star.parentId === camera.observedId || camera.observedParentId === star.id ||
    (departureParent && arrivalParent && departureParent.id === arrivalParent.id);
  const fromRadius = camera.observedRadius;
  const fromId = camera.observedId, fromPosition = camera.observedPosition.slice();
  setActive(camera, star);
  const view = recalled && [recalled.distance, recalled.yaw, recalled.pitch, recalled.roll].every(Number.isFinite) && recalled.distance > 0 ? recalled : null;
  camera.distanceTarget = view ? clamp(view.distance, star.radius * camera.activeNearLimit, camera.maxDistance) : star.radius * camera.activeArrival;
  if (view) camera.activeArrivalView = { yaw: view.yaw, pitch: constrainPitch(camera, view.pitch), roll: view.roll };
  let travelDistance = Math.min(camera.maxDistance, Math.max(camera.distance, separation * 1.65, departure ? Math.max(fromRadius, star.radius) * (related ? 80 : 1600) : star.radius * 16));
  const from = clearanceBody(departureParent), to = clearanceBody(arrivalParent);
  const relevant = (parent, center) => parent && Math.max(travelDistance, camera.distanceTarget) >=
    Math.hypot(...center.map((value, i) => value - parent.position[i])) - parent.radius;
  const navigation = { from: relevant(from, camera.focus) ? from : null, to: relevant(to, star.position) ? to : null,
    sameSubject: radial, startUnresolved: camera.distance >= camera.observedRadius * 160 };
  const planned = Boolean(navigation.from || navigation.to);
  let departureTurn = 0;
  if (planned) {
    departure = true;
    travelDistance = Math.min(camera.maxDistance, Math.max(travelDistance, crossingClearance(navigation, camera.focus, star.position)));
    if (navigation.from) {
      const offset = navigation.from.position.map((value, i) => value - camera.focus[i]), radius = Math.hypot(...offset);
      navigation.fromFar = camera.distance >= radius + navigation.from.radius * 4;
      if (!navigation.fromFar && radius > 0) {
        const direction = safeDirection(camera.focus, navigation.from, viewDirection(camera), 1, navigation, 'from');
        departureTurn = 350 + Math.acos(clamp(dot(viewDirection(camera), direction), -1, 1)) * 650;
      }
    }
  }
  if (!departure) setObserved(camera, star);
  const arrivalTurn = planned && navigation.to ? 1000 : 0;
  const departureDuration = departureTurn + distanceTravelTime(camera.distance, travelDistance, 900);
  const crossingEnd = departureDuration + 1400;
  const approachEnd = crossingEnd + distanceTravelTime(travelDistance, camera.distanceTarget, 900);
  const duration = planned ? approachEnd + arrivalTurn : radial ? distanceTravelTime(camera.distance, camera.distanceTarget)
    : departure ? crossingEnd + distanceTravelTime(travelDistance, camera.distanceTarget, 900)
    : Math.max(2350, distanceTravelTime(camera.distance, travelDistance, 0) / 0.28, distanceTravelTime(travelDistance, camera.distanceTarget, 0) / 0.72);
  camera.flight = {
    startedAt: now,
    duration,
    radial: radial && !planned,
    navigation: planned ? navigation : null,
    departureTurn, arrivalTurn, approachEnd,
    departureDuration,
    crossingEnd,
    departure,
    phase: radial ? 'approaching' : departure ? 'departing' : 'crossing',
    fromDistance: camera.distance,
    fromFocus: camera.focus.slice(),
    fromId, fromPosition,
    fixedArrival: Boolean(view),
    fromYaw: camera.yaw,
    fromPitch: camera.pitch,
    fromRoll: camera.roll,
    travelDistance
  };
  camera.lastInteractionTime = now;
  camera.yawVelocity = 0;
  camera.pitchVelocity = 0;
  if (camera.reducedMotion) {
    camera.flight = null;
    setObserved(camera, star);
    camera.distance = camera.distanceTarget;
    camera.focus = camera.activePosition.slice();
    applyArrivalView(camera, { fromYaw: camera.yaw, fromPitch: camera.pitch, fromRoll: camera.roll }, 1);
  }
}

export function resetCamera(camera, star, now = camera.now, { departureParent, wide = false } = {}) {
  const overviewDistance = wide ? MAX_DISTANCE : overviewDistanceFor(star);
  camera.observationPoint = null;
  camera.pointNavigation=false;
  camera.focusHold = null;
  camera.scaleNavigation = false;
  const parent = clearanceBody(departureParent);
  const navigation = parent ? { from: parent, to: null } : null;
  let departureTurn = 0;
  if (parent) {
    const offset = parent.position.map((value, i) => value - camera.focus[i]), radius = Math.hypot(...offset);
    if (camera.distance < radius + parent.radius * 4 && radius > 0) {
      const direction = safeDirection(camera.focus, parent, viewDirection(camera), 1, navigation, 'from');
      departureTurn = 350 + Math.acos(clamp(dot(viewDirection(camera), direction), -1, 1)) * 650;
    }
  }
  setActive(camera, star);
  camera.distanceTarget = overviewDistance;
  camera.flight = { overview: true, phase: 'returning', startedAt: now, duration: departureTurn + distanceTravelTime(camera.distance, overviewDistance, 1600), fromDistance: camera.distance, fromFocus: camera.focus.slice(), fromId: camera.observedId, fromPosition: camera.observedPosition.slice(),
    navigation, departureTurn, clearanceDistance: Math.min(overviewDistance * .5, navigation ? crossingClearance(navigation, camera.focus, camera.focus) : 1),
    fromYaw: camera.yaw, fromPitch: camera.pitch, fromRoll: camera.roll };
  camera.lastInteractionTime = now;
  camera.yawVelocity = 0;
  camera.pitchVelocity = 0;
  if (camera.reducedMotion) {
    camera.flight = null;
    setObserved(camera, star);
    camera.distance = camera.distanceTarget;
    camera.focus = camera.activePosition.slice();
  }
}

export function cancelCameraFlight(camera) {
  camera.flight = null;
  camera.scaleNavigation = false;
  camera.distanceTarget = camera.distance;
  camera.focusHold = camera.focus.slice();
  camera.yawVelocity = 0;
  camera.pitchVelocity = 0;
  camera.lastInteractionTime = camera.now;
}

export function inspectCameraPoint(camera,body,point,now=camera.now) {
  if(body?.id!==camera.activeId || body.id!==camera.observedId || body.kind!=='galaxy' ||
      (point && (!point.key || !point.position?.every(Number.isFinite) || point.position.length!==3 || !Number.isFinite(point.distance) || point.distance<=0 ||
        Math.hypot(...point.position.map((v,i)=>v-body.position[i]))>body.radius*(body.extent||1)))) return false;
  const target=point?.position || body.position;
  const distance=point?.distance || body.radius*camera.activeSurfaceArrival;
  const travelDistance=Math.max(camera.distance,body.radius*4.8);
  const departureDuration=distanceTravelTime(camera.distance,travelDistance,350);
  const crossingEnd=departureDuration+Math.max(450,Math.min(1000,Math.hypot(...target.map((v,i)=>v-camera.focus[i]))/body.radius*400));
  camera.observationPoint=point?{key:point.key,position:point.position.slice(),distance:point.distance}:null;
  camera.pointNavigation=true;
  camera.focusHold=null;camera.scaleNavigation=false;
  camera.distanceTarget=clamp(distance,camera.minDistance,camera.maxDistance);
  camera.yawVelocity=0;camera.pitchVelocity=0;camera.lastInteractionTime=now;
  camera.flight={point:true,phase:'departing',startedAt:now,fromFocus:camera.focus.slice(),fromDistance:camera.distance,
    fromId:body.id,fromPosition:body.position.slice(),fromYaw:camera.yaw,fromPitch:camera.pitch,fromRoll:camera.roll,
    travelDistance,departureDuration,crossingEnd,duration:crossingEnd+distanceTravelTime(travelDistance,camera.distanceTarget,700)};
  if(camera.reducedMotion) {camera.flight=null;camera.pointNavigation=false;camera.focus=target.slice();camera.distance=camera.distanceTarget;}
  return true;
}

export function cameraFrame(camera, aspect = 1, center = [0.5, 0.5]) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const pitch = constrainPitch(camera, camera.pitch);
  const yaw = camera.yaw;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const forward = [-cp * sy, -sp, -cp * cy];
  const baseRight = [cy, 0, -sy];
  const baseUp = [-sp * sy, cp, -sp * cy];
  const roll = camera.roll || 0;
  const right = baseRight.map((value, i) => value * Math.cos(roll) + baseUp[i] * Math.sin(roll));
  const up = baseUp.map((value, i) => value * Math.cos(roll) - baseRight[i] * Math.sin(roll));
  const degrees = 52;
  const aspectFit = 1 + Math.max(0, 1 / safeAspect - 1) * 0.60;
  const fov = Math.min(78 * Math.PI / 180, 2 * Math.atan(Math.tan(degrees * Math.PI / 360) * aspectFit));
  return {
    eye: camera.focus.map((value, i) => value - forward[i] * camera.distance),
    right,
    up,
    forward,
    focus: camera.focus.slice(),
    distance: camera.distance,
    fov,
    yaw,
    pitch,
    roll,
    aspect: safeAspect,
    center: center.map(value => Number.isFinite(value) ? clamp(value, 0, 1) : 0.5),
    near: Math.max(1e-8, camera.observedRadius * 0.02),
    observedId: camera.observedId
  };
}

export function environmentState(camera, star) {
  const radius = star?.radius || camera.observedRadius;
  const logDistance = Math.log(camera.distance);
  const close = smoothstep(Math.log(radius * 10), Math.log(camera.minDistance), logDistance);
  return {
    galaxyPresence: smoothstep(Math.log(0.18), Math.log(12), logDistance),
    skyPresence: smoothstep(Math.log(3), Math.log(0.035), logDistance),
    transitPresence: smoothstep(Math.log(radius * 42000), Math.log(radius * 14000), logDistance) * mix(1, 0.22, close),
    immersion: smoothstep(Math.log(0.5), Math.log(radius * 12), logDistance)
  };
}

export function projectPoint(position, frame, width, height) {
  const relative = position.map((value, i) => value - frame.eye[i]);
  const dot = vector => relative[0] * vector[0] + relative[1] * vector[1] + relative[2] * vector[2];
  const depth = dot(frame.forward);
  const safeDepth = Math.max(depth, frame.near || 1e-8);
  const focalLength = height / (2 * Math.tan(frame.fov / 2));
  const x = width * (frame.center?.[0] ?? 0.5) + dot(frame.right) / safeDepth * focalLength;
  const y = height * (frame.center?.[1] ?? 0.5) - dot(frame.up) / safeDepth * focalLength;
  return { x, y, depth, visible: depth > (frame.near || 1e-8) && x >= 0 && x <= width && y >= 0 && y <= height };
}

export function screenRay(x, y, frame, width, height) {
  const focal = height / (2 * Math.tan(frame.fov / 2));
  const horizontal = (x - width * (frame.center?.[0] ?? 0.5)) / focal;
  const vertical = (y - height * (frame.center?.[1] ?? 0.5)) / focal;
  const ray = frame.forward.map((value, i) => value + frame.right[i] * horizontal - frame.up[i] * vertical);
  const length = Math.hypot(...ray);
  return ray.map(value => value / length);
}

function axisProgress(distance,minimum,maximum) {
  if(distance<=minimum*(1+1e-12)) return 1;
  if(distance>=maximum*(1-1e-12)) return 0;
  return clamp(Math.log(maximum/distance)/Math.log(maximum/minimum),0,1);
}

export function scaleState(camera, star) {
  const radius = star?.radius || camera.observedRadius;
  const distance = camera.distance;
  const localMap = Math.max(0.045, radius * 32);
  const scaleStage = camera.observedKind==='galaxy' ? (distance>=radius*30?'Galactic':distance>=radius*24?'Regional':distance>=radius*16?'LocalMap':distance>=radius*8?'LocalSystem':'Surface') : distance >= 10 ? 'Galactic' : distance >= Math.max(1.2, localMap * 4) ? 'Regional' : distance >= localMap ? 'LocalMap' : distance >= radius * 10 ? 'LocalSystem' : 'Surface';
  const minimum = camera.minDistance;
  return {
    scaleStage,
    lod: scaleStage === 'Galactic' || scaleStage === 'Regional' ? scaleStage : 'Local',
    scaleAxisProgress: axisProgress(distance,minimum,camera.maxDistance),
    scaleAxisTargetProgress: axisProgress(camera.distanceTarget,minimum,camera.maxDistance),
    surfaceDepth: smoothstep(Math.log(radius * 10), Math.log(minimum), Math.log(distance)),
    spherePresence: smoothstep(Math.log(radius * 1600), Math.log(radius * 160), Math.log(distance)),
    localPresence: 1 - smoothstep(0.018, 0.12, distance),
    minDistance: minimum,
    maxDistance: camera.maxDistance
  };
}

// Explicit orientation recovery shares flight interruption and reduced-motion
// behaviour, but keeps the observed centre, distance and roll throughout.
export function turnCamera(camera, body, view, now = camera.now) {
  if (!body || camera.activeId !== body.id || camera.observedId !== body.id || camera.flight || camera.scaleNavigation ||
      Math.abs(Math.log(camera.distance / camera.distanceTarget)) > 0.0001 ||
      Math.hypot(...camera.focus.map((value, i) => value - body.position[i])) > body.radius * 0.0001 ||
      ![view?.yaw, view?.pitch].every(Number.isFinite)) return false;
  const original = viewDirection(camera), distance = camera.distance;
  focusCamera(camera, body, now, { distance, yaw: view.yaw, pitch: view.pitch, roll: camera.roll });
  camera.distanceTarget = distance;
  if (camera.reducedMotion) camera.distance = distance;
  if (camera.flight) {
    const angle = Math.acos(clamp(dot(original, viewDirection(view)), -1, 1));
    camera.flight.duration = Math.max(camera.flight.duration, 600 + angle * 550);
  }
  return true;
}
