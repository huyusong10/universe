import { NEBULA_EXPLORATIONS } from './observatory-nebulae.js?v=cosmic-explore-20261010gu';
import { GALAXY_EXPLORATIONS } from './observatory-galaxies.js?v=cosmic-explore-20261010gu';
import { EXOWORLDS, EXOSYSTEMS, YOUNG_WORLDS } from './observatory-exoworlds.js?v=cosmic-explore-20261010gu';
import { projectPoint, screenRay } from './observatory-camera.js?v=cosmic-explore-20261010gu';
import { solidShape, solidGeometryReady, solidRayIntersection } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
import { GALACTIC_SPURS, galacticSpurPoint, GALACTIC_DIFFUSE_LAYERS, GALACTIC_BRIDGE_LAYERS, galacticBridgeLayer, galacticBridgePoint, galacticWideWeight, galacticFragmentWeight, galacticStellarPoint } from './observatory-galactic-material.js?v=cosmic-explore-20261010gu';
// Deterministic world data; no navigation state or GPU ownership.
// Optional finite asset preparation is shared with renderer initialization.
export { loadSolidGeometry as prepareBodyGeometry } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
import { qualityProfile } from './observatory-quality.js?v=cosmic-explore-20261010gu';
import { clamp, mix, smoothstep } from './observatory-math.js?v=cosmic-explore-20261010gu';
import { isVolumeBody, COMET_NUCLEUS_PLANES, URANUS_RING_BANDS, RING_CAMERA_FADE, VESTA_AXES, PHOBOS_AXES, DEIMOS_AXES, MARS_MOON_PHASE, spaceSatelliteFamily } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
import { SMALL_WORLD_SHAPES, CONTACT_WORLD_SHAPES, NEW_SMALL_WORLDS, SMALL_WORLD_CAVITIES } from './observatory-small-worlds.js?v=cosmic-explore-20261010gu';
import { GALAXY_CLUSTER_COUNT, GALAXY_STELLAR_COLOURS, galaxyClusterRadius, galaxyClusterAngle, galaxyWinding, GALAXY_PORTRAITS, galaxyPortraitPoint, galaxyOrientation, galaxyWorldVector, galaxyArrivalView } from './observatory-galaxy-layout.js?v=cosmic-explore-20261010gu';
export { clamp, mix, smoothstep } from './observatory-math.js?v=cosmic-explore-20261010gu';
// Compatibility for existing model consumers. Worker navigation uses the camera boundary.
export { createCamera, updateCamera, updateCameraAnchors, orbitCamera, zoomCamera, focusCamera, resetCamera, cancelCameraFlight, setReducedMotion, cameraFrame, projectPoint, screenRay, scaleState, environmentState, setCameraScale, scaleStops } from './observatory-camera.js?v=cosmic-explore-20261010gu';
const TAU = Math.PI * 2;
const SOL_POSITION = [7.4, 0.12, 1.8];


function hash(value) {
  let n = value >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return (n ^ (n >>> 15)) >>> 0;
}

export function seededRandom(seed = 728281) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(TAU * random());
}

function armAngle(radius, arm) {
  return arm * TAU / 4 + Math.log(Math.max(radius, 0.5) / 1.6) * 2.05 + Math.sin(radius * 0.48 + arm) * 0.13;
}

function makeStructure(random) {
  const clusters = Array.from({ length: 42 }, (_, index) => {
    const radius = mix(3, 16, random());
    const angle = armAngle(radius, index % 4) + gaussian(random) * 0.065;
    return {
      position: [Math.cos(angle) * radius, gaussian(random) * 0.1, Math.sin(angle) * radius],
      width: mix(0.12, 0.43, random())
    };
  });
  const voids = Array.from({ length: 22 }, (_, index) => {
    const radius = mix(2.7, 16.7, random());
    const angle = armAngle(radius, index % 4) - mix(0.035, 0.105, random());
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, radius: mix(0.35, 1.2, random()) };
  });
  return { clusters, voids };
}

function sampleGalaxy(random, structure) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const population = random();
    let x, y, z, radius;
    let young = 0;
    if (population < 0.16) {
      // A finite, softly concentrated bulge; no singular pile of white points.
      radius = Math.min(4.7, Math.abs(gaussian(random)) * 1.65 + random() * 0.22);
      const angle = random() * TAU;
      x = Math.cos(angle) * radius * 1.15;
      z = Math.sin(angle) * radius * 0.83;
      y = gaussian(random) * mix(0.54, 0.17, clamp(radius / 4.7, 0, 1));
    } else if (population < 0.24) {
      const cluster = structure.clusters[Math.floor(random() * structure.clusters.length)];
      x = cluster.position[0] + gaussian(random) * cluster.width;
      y = cluster.position[1] + gaussian(random) * cluster.width * 0.38;
      z = cluster.position[2] + gaussian(random) * cluster.width;
      radius = Math.hypot(x, z);
      young = 1;
    } else {
      radius = 0.9 + 16.6 * Math.pow(random(), 0.96);
      const armRoll = random();
      const arm = armRoll < 0.34 ? 0 : armRoll < 0.5 ? 1 : armRoll < 0.84 ? 2 : 3;
      const interarm = population > 0.84;
      const angle = interarm
        ? random() * TAU
        : armAngle(radius, arm) + gaussian(random) * (0.055 + 0.24 / radius) * 1.65;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      y = gaussian(random) * (0.105 + radius * 0.014) + Math.sin(angle * 2 + radius * 0.1) * radius * 0.009;
      young = interarm ? 0.1 : 0.65;
    }
    let obscured = 0;
    for (const field of structure.voids) {
      const d2 = (x - field.x) ** 2 + (z - field.z) ** 2;
      obscured = Math.max(obscured, Math.exp(-d2 / (field.radius * field.radius)) * 0.88);
    }
    if (random() > obscured || attempt === 7) return { position: [x, y, z], radius, young };
  }
}

function stellarColor(random, radius, young) {
  const outer = smoothstep(2, 10, radius);
  const hot = random() < 0.16 + outer * young * 0.58;
  if (hot) {
    const blue = random();
    return [mix(0.62, 0.88, blue), mix(0.77, 0.91, blue), 1];
  }
  const warm = random();
  return [1, mix(0.59, 0.91, warm), mix(0.35, 0.82, warm)];
}

const NAMED_STARS = [
  ['Sol', [0, 0, 0], [1, 0.82, 0.51], 1],
  ['Proxima Centauri', [-0.18, -0.055, 0.105], [1, 0.57, 0.35], 0.63],
  ['Rigil Kentaurus', [-0.22, -0.04, 0.14], [1, 0.88, 0.66], 1.18],
  ["Barnard's Star", [0.28, 0.13, -0.11], [1, 0.57, 0.39], 0.72],
  ['Sirius', [0.42, -0.19, 0.36], [0.75, 0.86, 1], 1.6],
  ['Epsilon Eridani', [-0.47, -0.07, -0.23], [1, 0.77, 0.49], 0.88],
  ['Procyon', [-0.39, 0.24, 0.6], [1, 0.94, 0.8], 1.75],
  ['61 Cygni', [0.61, 0.15, -0.59], [1, 0.7, 0.41], 0.88],
  ['Tau Ceti', [-0.69, -0.16, 0.45], [1, 0.82, 0.57], 0.92],
  ['Altair', [0.79, -0.36, 0.58], [0.82, 0.91, 1], 1.67],
  ['Fomalhaut', [-0.31, 0.38, -1.03], [0.78, 0.88, 1], 1.7],
  ['Vega', [0.68, 0.47, -1.12], [0.68, 0.82, 1], 1.92],
  ['Pollux', [-1.15, 0.32, 0.86], [1, 0.74, 0.45], 2.25],
  ['Arcturus', [1.12, -0.58, 1.02], [1, 0.65, 0.37], 2.8],
  ['Capella', [-1.52, -0.19, -0.82], [1, 0.84, 0.55], 2.3],
  ['Aldebaran', [1.72, 0.36, -0.71], [1, 0.61, 0.33], 3.5],
  ['Regulus', [-0.53, -0.43, 2.06], [0.69, 0.81, 1], 2.05],
  ['Spica', [1.85, -0.26, 1.23], [0.61, 0.77, 1], 2.5],
  ['Betelgeuse', [-2.17, 0.55, -0.69], [1, 0.49, 0.27], 5.5],
  ['Antares', [1.61, 0.66, -1.88], [1, 0.52, 0.28], 4.8],
  ['Rigel', [-2.45, -0.29, 1.24], [0.59, 0.77, 1], 3.7],
  ['Deneb', [2.18, 0.57, 1.64], [0.79, 0.88, 1], 3.3],
  ['Canopus', [-1.7, -0.45, -2.42], [1, 0.93, 0.76], 3.9],
  ['Polaris', [0.56, 1.05, 2.71], [1, 0.9, 0.68], 2.9]
];

function normalizedName(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
}

export function findCatalogTarget(stars, target) {
  if (target === null || target === undefined || !String(target).trim()) return null;
  if(/^\d+$/.test(String(target).trim())) return stars.find(star=>String(star.id)===String(target).trim()) || null;
  const wanted = normalizedName(target);
  return stars.find(star => [star.name, ...(star.aliases || [])].some(name => normalizedName(name) === wanted) || String(star.id) === String(target)) || null;
}

export function namedDestinations(catalog) {
  return [...catalog.stars.slice(0, NAMED_STARS.length), ...catalog.bodies].map(body => ({ id: body.id, target: body.name, bodyKind: body.kind }));
}

export function catalogBody(catalog, id) {
  return catalog.stars[id] || catalog.bodies.find(body => body.id === id) || null;
}

export function resolveCatalogTarget(catalog, target) {
  return findCatalogTarget(catalog.bodies, target) || findCatalogTarget(catalog.stars, target);
}

export function bodyRelations(catalog, id) {
  const body = catalogBody(catalog, id);
  const parent = body?.parentId === undefined ? null : catalogBody(catalog, body.parentId);
  const children = catalog.bodies.filter(candidate => candidate.parentId === id);
  return { parent, children };
}

// Systems follow the finite authored relationships, never the generated stars.
export function bodySystem(catalog, id, { local = false, region } = {}) {
  let root = catalogBody(catalog, id);
  if (!root) return null;
  const origin = root;
  const ancestors = new Set();
  while (root.parentId !== undefined) {
    if (ancestors.has(root.id)) return null;
    ancestors.add(root.id);
    const parent = catalogBody(catalog, root.parentId);
    if (!parent) return null;
    root = parent;
  }
  if (region && (region !== 'inner' || local || root.id !== 0)) return null;
  if (local) root = origin;
  const members = [root], seen = new Set([root.id]);
  for (let index = 0; index < members.length; index++) {
    for (const body of catalog.bodies) {
      if (body.parentId === members[index].id && !seen.has(body.id)) {
        if (region === 'inner' && members[index] === root && body.orbitalRegion !== 'inner') continue;
        seen.add(body.id);
        members.push(body);
      }
    }
  }
  return members.length > 1 ? { root, members } : null;
}

// Prepare one immutable observing pose for the many background occlusion rays.
// The same solid intersection is also used for exact pointer picking.
export function bodyRayCaster(body, origin) {
  if (isVolumeBody(body)) return () => Infinity;
  const center = body.position.map((value,i) => (value-origin[i])/body.radius);
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const c=Math.cos(body.tilt||0),s=Math.sin(body.tilt||0);
  const cy=Math.cos(body.spin||0),sy=Math.sin(body.spin||0);
  const shape=solidGeometryReady() ? solidShape(body.material,body.seed) : null;
  const axes=body.axes || (shape ? [1,1,1] : null);
  const local = value => {
    const y=c*value[1]+s*value[2],z=-s*value[1]+c*value[2];
    return [(cy*value[0]+sy*z)/axes[0],y/axes[1],(-sy*value[0]+cy*z)/axes[2]];
  };
  const source=axes ? local(center) : null;
  const planes=body.kind==='comet' ? COMET_NUCLEUS_PLANES : null;
  const caps=SMALL_WORLD_SHAPES[body.material];
  const lobes=CONTACT_WORLD_SHAPES[body.material];
  const cavities=SMALL_WORLD_CAVITIES[body.material];
  const ringNormal=body.rings ? [0,c,s] : null;
  return ray => {
    let hit=Infinity;
    if(shape) {
      hit=solidRayIntersection(shape,source.map(value=>-value),local(ray));
    } else if(axes) {
      const direction=local(ray),magnitude=dot(direction,direction);
      const closestDistance=dot(source,direction)/magnitude;
      const closest=source.map((value,i)=>value-direction[i]*closestDistance);
      const miss=dot(closest,closest);
      if(lobes) {
        for(const lobe of lobes) {
          const q=source.map((v,i)=>(v+lobe.centre[i])/lobe.axes[i]);
          const d=direction.map((v,i)=>v/lobe.axes[i]),m=dot(d,d);
          const along=dot(q,d)/m,miss=q.map((v,i)=>v-d[i]*along);
          const span2=(1-dot(miss,miss))/m;
          if(along<=0 || span2<0) continue;
          const span=Math.sqrt(span2);let entry=along-span,exit=along+span;
          for(const cap of lobe.caps) {
            const c=q.map((v,i)=>v+cap[i]),a=dot(c,d)/m,delta=c.map((v,i)=>v-d[i]*a);
            const t=(cap[3]-dot(delta,delta))/m;
            if(t<0) {entry=Infinity;break;}
            const r=Math.sqrt(t);entry=Math.max(entry,a-r);exit=Math.min(exit,a+r);
            if(entry>exit) {entry=Infinity;break;}
          }
          if(entry>=0 && entry<=exit) hit=Math.min(hit,entry);
        }
      } else if(closestDistance>0 && miss<=1) {
        const span=Math.sqrt((1-miss)/magnitude);hit=closestDistance-span;
        if(planes) {
          let exit=closestDistance+span;
          for(const plane of planes) {
            const denominator=plane[0]*direction[0]+plane[1]*direction[1]+plane[2]*direction[2];
            const bound=plane[3]+plane[0]*source[0]+plane[1]*source[1]+plane[2]*source[2];
            if(Math.abs(denominator)<1e-7) { if(bound<0) { hit=Infinity;break; } }
            else if(denominator>0) exit=Math.min(exit,bound/denominator);
            else hit=Math.max(hit,bound/denominator);
            if(hit>exit) { hit=Infinity;break; }
          }
        } else if(caps) {
          let exit=closestDistance+span;
          for(const cap of caps) {
            const cx=source[0]+cap[0],cy=source[1]+cap[1],cz=source[2]+cap[2];
            const along=(cx*direction[0]+cy*direction[1]+cz*direction[2])/magnitude;
            const dx=cx-direction[0]*along,dy=cy-direction[1]*along,dz=cz-direction[2]*along;
            const span2=(cap[3]-(dx*dx+dy*dy+dz*dz))/magnitude;
            if(span2<0) { hit=Infinity;break; }
            const capSpan=Math.sqrt(span2);exit=Math.min(exit,along+capSpan);hit=Math.max(hit,along-capSpan);
            if(hit>exit) { hit=Infinity;break; }
          }
          if(cavities && Number.isFinite(hit)) {
            // Advance through the union of negative pits, retaining the convex
            // exit as a bound. Fixed passes cover all overlapping pit intervals.
            for(let pass=0;pass<cavities.length;pass++) for(const pit of cavities) {
              const q=source.map((v,i)=>v+pit[i]),a=dot(q,direction)/magnitude;
              const delta=q.map((v,i)=>v-direction[i]*a),span2=(pit[3]-dot(delta,delta))/magnitude;
              if(span2<0) continue;
              const span=Math.sqrt(span2);
              if(hit>a-span && hit<a+span) hit=a+span;
            }
            if(hit>exit) hit=Infinity;
          }
        }
      }
    } else {
      const along=dot(center,ray);
      const impact=center.map((value,i)=>value-along*ray[i]);
      const miss=dot(impact,impact);
      if(along>0 && miss<=1) hit=along-Math.sqrt(1-miss);
    }
    if(body.rings) {
      const denominator=dot(ray,ringNormal);
      if(Math.abs(denominator)>1e-7) {
        const distance=dot(center,ringNormal)/denominator;
        const point=ray.map((value,i)=>value*distance-center[i]);
        const radius=Math.hypot(...point);
        const {inner,outer,gapInner,gapOuter,bands}=body.rings;
        if(distance>RING_CAMERA_FADE[0] && radius>=inner && radius<=outer && !(radius>gapInner && radius<gapOuter) && (!bands || bands.some(([start,end])=>radius>=start && radius<=end))) hit=Math.min(hit,distance);
      }
    }
    return hit*body.radius;
  };
}
export function bodyRayIntersection(body, origin, ray) {
  return bodyRayCaster(body,origin)(ray);
}

// Conservative perspective bounds of the opaque envelope. An off-axis sphere
// does not project as a circle around its projected centre. Transparent tails,
// clouds and discs never enlarge this boundary.
export function bodyScreenBounds(body, frame, width, height) {
  if (isVolumeBody(body)) return null;
  const p=projectPoint(body.position,frame,width,height);
  const extent=body.radius*Math.max(1,body.rings?.outer||1,...(body.axes||[]));
  if(p.depth<=(frame.near||1e-8)) return null;
  const focal=height/(2*Math.tan(frame.fov/2));
  let left=0,right=width,top=0,bottom=height;
  if(p.depth>extent) {
    const delta=body.position.map((value,i)=>value-frame.eye[i]);
    const axis=vector=>delta.reduce((sum,value,i)=>sum+value*vector[i],0);
    const denominator=p.depth*p.depth-extent*extent;
    const interval=value=>{
      const span=extent*Math.sqrt(value*value+denominator);
      return [(value*p.depth-span)/denominator*focal,(value*p.depth+span)/denominator*focal];
    };
    const horizontal=interval(axis(frame.right)),vertical=interval(axis(frame.up));
    const cx=width*(frame.center?.[0]??.5),cy=height*(frame.center?.[1]??.5);
    left=cx+horizontal[0];right=cx+horizontal[1];top=cy-vertical[1];bottom=cy-vertical[0];
  }
  const radius=Math.max(p.x-left,right-p.x,p.y-top,bottom-p.y);
  return {...p,left,right,top,bottom,radius,
    visible:right>0&&left<width&&bottom>0&&top<height&&radius>1};
}


// Finite celestial layers share the same actual rays as picking. Centre depth
// is only the fallback: a large foreground limb can have a farther centre.
// The catalog is never reordered. Transparent volumes retain their own pass.
export function bodyDrawLayers(bodies, observed, frame, width, height) {
  const entries=[...bodies];
  if(!entries.some(body=>body.id===observed.id)) entries.push(observed);
  const nodes=entries.map(body=>{
    const p=projectPoint(body.position,frame,width,height);
    const bounds=bodyScreenBounds(body,frame,width,height);
    return {body,p,bounds,cast:bounds?.visible?bodyRayCaster(body,frame.eye):null,after:new Set(),incoming:0};
  }).sort((a,b)=>b.p.depth-a.p.depth||a.body.id-b.body.id);
  const visible=nodes.filter(node=>node.cast);
  for(let a=0;a<visible.length;a++) for(let b=a+1;b<visible.length;b++) {
    const one=visible[a],two=visible[b];
    const left=Math.max(0,one.bounds.left,two.bounds.left),right=Math.min(width,one.bounds.right,two.bounds.right);
    const top=Math.max(0,one.bounds.top,two.bounds.top),bottom=Math.min(height,one.bounds.bottom,two.bounds.bottom);
    if(right<=left||bottom<=top) continue;
    const probes=[...([.2,.5,.8].flatMap(x=>[.2,.5,.8].map(y=>[left+(right-left)*x,top+(bottom-top)*y]))),
      ...[one.p,two.p].map(p=>[clamp(p.x,left,right),clamp(p.y,top,bottom)])];
    let relation=0,ambiguous=false;
    for(const [x,y] of probes) {
      const ray=screenRay(x,y,frame,width,height);
      const t1=one.cast(ray),t2=two.cast(ray);
      if(!Number.isFinite(t1)||!Number.isFinite(t2)||Math.abs(t1-t2)<1e-12) continue;
      const next=t1<t2?1:-1;
      if(relation&&next!==relation) {ambiguous=true;break;}
      relation=next;
    }
    if(!relation||ambiguous) continue;
    const near=relation===1?one:two,far=relation===1?two:one;
    if(!far.after.has(near)) {far.after.add(near);near.incoming++;}
  }
  const pending=new Set(nodes),ordered=[];
  while(pending.size) {
    // Stable centre order resolves unrelated layers and genuinely ambiguous
    // interpenetrating geometry without changing any object's identity.
    const next=nodes.find(node=>pending.has(node)&&node.incoming===0)||nodes.find(node=>pending.has(node));
    pending.delete(next);ordered.push(next.body.id);
    for(const near of next.after) near.incoming--;
  }
  return ordered;
}

function representativeIndices(stars, limit, activeId, observedId = activeId) {
  if (stars.length <= limit) return stars.map(star => star.id);
  const required = new Set(stars.slice(0, NAMED_STARS.length).map(star => star.id));
  required.add(activeId);
  required.add(observedId);
  const cells = new Map();
  for (const star of stars) {
    if (required.has(star.id)) continue;
    const [x, y, z] = star.position;
    const radial = Math.min(8, Math.floor(Math.hypot(x, z) / 2));
    const angular = Math.floor(((Math.atan2(z, x) + TAU) % TAU) / TAU * 24);
    const vertical = y < -0.15 ? 0 : y > 0.15 ? 2 : 1;
    const key = radial * 72 + angular * 3 + vertical;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(star.id);
  }
  const available = limit - required.size;
  const population = stars.length - required.size;
  const allocations = Array.from(cells.values(), ids => {
    ids.sort((a, b) => hash(a + 84937) - hash(b + 84937));
    const proportional = ids.length / population * available;
    return { ids, count: Math.floor(proportional), remainder: proportional % 1 };
  });
  let remainder = available - allocations.reduce((sum, cell) => sum + cell.count, 0);
  allocations.sort((a, b) => b.remainder - a.remainder);
  for (const cell of allocations) {
    if (remainder-- > 0) cell.count += 1;
    for (let i = 0; i < cell.count; i += 1) required.add(cell.ids[i]);
  }
  // Stable identity order makes GPU buffers and label candidates reproducible.
  return Array.from(required).sort((a, b) => a - b);
}

function unitDirection(random, flattening = 1) {
  const y = mix(-1, 1, random());
  const angle = random() * TAU;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const direction = [Math.cos(angle) * radial, y * flattening, Math.sin(angle) * radial];
  const length = Math.hypot(...direction);
  return direction.map(value => value / length);
}

function createEnvironment(seed, budget) {
  const skyRandom = seededRandom(seed ^ 0xadc19273);
  const cloudRandom = seededRandom(seed ^ 0x31ba4279);
  const clouds = Array.from({length: 12}, () => ({
    direction: unitDirection(cloudRandom), width: mix(.07, .26, cloudRandom())
  }));
  const sky = Array.from({ length: budget.sky }, (_, index) => {
    // Distant star associations break up a uniform wallpaper. Their directions
    // are fixed angular references, independent of camera travel and quality.
    const population = skyRandom();
    const band = population < .28;
    let direction;
    if (band) {
      const angle = skyRandom() * TAU;
      direction = [Math.cos(angle), gaussian(skyRandom) * mix(.07,.22,skyRandom()), Math.sin(angle)];
    } else if (population < .68) {
      const cloud = clouds[Math.floor(skyRandom() * clouds.length)];
      direction = cloud.direction.map(value => value + gaussian(skyRandom) * cloud.width);
    } else direction = unitDirection(skyRandom);
    const length = Math.hypot(...direction);
    direction = direction.map(value => value / length);
    const brightness = Math.pow(skyRandom(), 3.5);
    return {
      position: direction,
      color: stellarColor(skyRandom, band ? 8 : 5, band ? 0.65 : 0.2),
      size: mix(0.42, 1.6, Math.sqrt(brightness)),
      luminosity: mix(0.045, 0.42, brightness),
      seed: hash(seed ^ (index + 1) * 51787)
    };
  });
  const transitRandom = seededRandom(seed ^ 0x714ee92b);
  const transit = Array.from({ length: budget.transit }, (_, index) => {
    const direction = unitDirection(transitRandom, transitRandom() < 0.38 ? 0.38 : 1);
    const radius = Math.exp(mix(Math.log(8), Math.log(10000), transitRandom()));
    const warmth = transitRandom();
    return {
      position: direction.map(value => value * radius),
      color: [mix(0.55, 0.95, warmth), mix(0.69, 0.79, warmth), mix(0.86, 0.61, warmth)],
      size: mix(0.22, 0.82, Math.pow(transitRandom(), 1.8)),
      luminosity: mix(0.009, 0.075, Math.pow(transitRandom(), 2.1)),
      seed: hash(seed ^ (index + 1) * 90401)
    };
  });
  return { sky, transit };
}

export function createCatalog({ seed = 728281, budget = 'standard', catalog = 0, target = '' } = {}) {
  const profile = qualityProfile(budget);
  const limits = { key: profile.key, ...profile.budget };
  const count = Number.isFinite(Number(catalog)) && Number(catalog) > 0 ? clamp(Math.floor(Number(catalog)), 64, 50000) : 24000;
  const initialSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : 728281;
  const random = seededRandom(initialSeed);
  const structure = makeStructure(seededRandom(initialSeed ^ 0xa4625f19));
  const stars = Array.from({ length: count }, (_, id) => {
    const point = sampleGalaxy(random, structure);
    const brilliance = Math.pow(random(), 4.2);
    const luminosity = 0.18 + brilliance * 2.22;
    return {
      id, kind: 'star',
      name: `UO ${String(1000 + id).padStart(5, '0')}`,
      position: point.position,
      color: stellarColor(random, point.radius, point.young),
      luminosity,
      size: 0.58 + Math.sqrt(brilliance) * 1.32,
      radius: 0.00012 * mix(0.58, 2.6, Math.pow(random(), 1.8)),
      seed: hash(initialSeed + id * 7919)
    };
  });
  NAMED_STARS.forEach(([name, offset, color, radiusScale], id) => {
    const star = stars[id];
    star.name = name;
    star.position = SOL_POSITION.map((value, index) => value + offset[index]);
    star.color = color.slice();
    star.radius = 0.00012 * radiusScale;
    star.size = id === 0 ? 1.7 : 1.4 + Math.min(radiusScale, 3) * 0.36;
    star.luminosity = id === 0 ? 1.65 : 1.1 + Math.min(radiusScale, 3) * 0.36;
  });
  // Reserved identities do not renumber stars or consume their random stream.
  const planets = [
    { id: 50000, name: 'Earth', orbitalRegion: 'inner', material: 'earth', offset: [0.008, -0.001, -0.011], color: [0.25, 0.56, 1], radius: 0.000014, tilt: 23.4 * Math.PI / 180, nearLimit: 1.65, surfaceInspection: true },
    { id: 50001, name: 'Saturn', material: 'saturn', offset: [0.047, 0, -0.040], color: [0.91, 0.76, 0.50], radius: 0.00011, tilt: 27 * Math.PI / 180,
      rings: { inner: 1.25, outer: 2.30, gapInner: 1.82, gapOuter: 1.90 } },
    { id: 50004, name: 'Mars', orbitalRegion: 'inner', material: 'mars', offset: [0.013, 0.0003, -0.016], color: [0.94, 0.43, 0.23], radius: 0.0000074, tilt: 25.2 * Math.PI / 180, nearLimit: 1.65, surfaceInspection: true },
    { id: 50007, name: 'Jupiter', material: 'jupiter', offset: [-0.028, 0.0002, 0.022], color: [0.91, 0.72, 0.53], radius: 0.000154, tilt: 3.1 * Math.PI / 180,
      arrivalView: { yaw: 2.24, pitch: 0.16 } },
    { id: 50010, name: 'Mercury', orbitalRegion: 'inner', material: 'mercury', offset: [0.004, 0.0002, -0.0046], color: [0.58, 0.53, 0.46], radius: 0.0000054, tilt: 0.034,
      arrivalView: { yaw: 0.30, pitch: 0.18 }, nearLimit: 1.65, surfaceInspection: true },
    { id: 50011, name: 'Venus', orbitalRegion: 'inner', material: 'venus', offset: [-0.007, -0.0002, -0.0068], color: [0.90, 0.79, 0.53], radius: 0.0000133, tilt: 0.052,
      arrivalView: { yaw: -0.25, pitch: 0.16 } },
    { id: 50012, name: 'Uranus', material: 'uranus', offset: [0.082, 0.001, -0.076], color: [0.49, 0.78, 0.79], radius: 0.0000562, tilt: 97.77 * Math.PI / 180,
      rings: { inner: 1.58, outer: 2.02, gapInner: 0, gapOuter: 0, bands: URANUS_RING_BANDS }, arrivalView: { yaw: 0.73, pitch: 0.12 } },
    { id: 50013, name: 'Neptune', material: 'neptune', offset: [-0.128, -0.001, 0.104], color: [0.23, 0.50, 0.85], radius: 0.0000545, tilt: 28.3 * Math.PI / 180,
      arrivalView: { yaw: 0.96, pitch: 0.18 } }
  ].map(({ offset, ...body }) => ({ ...body, kind: 'planet', parentId: 0, position: SOL_POSITION.map((value, i) => value + offset[i]), size: 1.45, luminosity: 0.72, seed: hash(body.id) }));
  const dwarfplanets = [{
    id: 50022, name: 'Pluto', kind: 'dwarfplanet', material: 'pluto', parentId: 0,
    position: SOL_POSITION.map((value, i) => value + [0.165, 0.041, -0.135][i]),
    color: [0.77, 0.65, 0.54], radius: 0.0000026, tilt: 119.6 * Math.PI / 180,
    arrivalView: { yaw: -0.66, pitch: 0.40 }, size: 1.1, luminosity: 0.48, seed: hash(50022)
  }, {
    id: 50024, name: 'Ceres', kind: 'dwarfplanet', material: 'ceres', parentId: 0,
    position: SOL_POSITION.map((value,i) => value + [-0.022,0.002,-0.018][i]),
    color: [0.55,0.55,0.54], radius: 0.0000019, tilt: 0.07,
    arrivalView: { yaw: 0.88, pitch: 0.26 }, size: 1.1, luminosity: 0.48, seed: hash(50024)
  }];
  const asteroids = [{
    id: 50025, name: 'Vesta', kind: 'asteroid', material: 'vesta', parentId: 0,
    position: SOL_POSITION.map((value,i) => value + [0.019,0.001,0.016][i]),
    color: [0.63,0.62,0.60], radius: 0.00000135, axes: VESTA_AXES, tilt: 0.48,
    arrivalView: { yaw: -2.30, pitch: 0.22 }, size: 1.1, luminosity: 0.48, seed: hash(50025)
  }];
  const nebulae = [{
    id: 50002, name: 'Orion Nebula', aliases: ['M42', 'NGC1976'], kind: 'nebula', material: 'nebula',
    position: SOL_POSITION.map((value, i) => value + [-1.83, -0.36, -1.61][i]),
    color: [1, 0.39, 0.52], radius: 0.0012, extent: 2.35, nearLimit: 0.65,
    size: 2.5, luminosity: 0.85, seed: hash(50002)
  }, {
    id: 50026, name: 'Ring Nebula', aliases: ['M57', 'NGC6720', 'Messier 57'], kind: 'nebula', material: 'ringnebula',
    position: SOL_POSITION.map((value, i) => value + [0.84, 0.35, -0.92][i]),
    color: [0.38, 0.83, 0.91], radius: 0.00065, extent: 2.35, nearLimit: 0.65,
    arrivalView: { yaw: 0.25, pitch: 0.20 }, size: 2.5, luminosity: 0.85, seed: hash(50026)
  }, {
    id: 50035, name: 'Helix Nebula', aliases: ['NGC7293', 'Caldwell 63', 'C63'], kind: 'nebula', material: 'helixnebula',
    position: SOL_POSITION.map((value, i) => value + [-2.12, 0.22, 0.91][i]),
    color: [0.96, 0.58, 0.29], radius: 0.0015, extent: 2.35, nearLimit: 0.88,
    arrivalView: { yaw: 0.20, pitch: 0.14 }, size: 2.5, luminosity: 0.85, seed: hash(50035)
  }, {
    id: 50036, name: 'Lagoon Nebula', aliases: ['M8', 'Messier 8', 'NGC6523'], kind: 'nebula', material: 'lagoonnebula',
    position: SOL_POSITION.map((value, i) => value + [1.46, -0.18, 1.82][i]),
    color: [0.91, 0.47, 0.67], radius: 0.0017, extent: 2.35, nearLimit: 0.90,
    arrivalView: { yaw: -0.12, pitch: 0.08 }, size: 2.5, luminosity: 0.85, seed: hash(50036)
  }];
  const earth = planets[0];
  const moons = [{
    id: 50003, name: 'Moon', aliases: ['Luna'], kind: 'moon', material: 'moon', parentId: earth.id,
    position: earth.position.map((value, i) => value + [0.00016, 0.00003, 0.00022][i]),
    color: [0.72, 0.71, 0.69], radius: 0.0000039, tilt: 0.026, nearLimit: 1.65, surfaceInspection: true,
    arrivalView: { yaw: 0.41, pitch: 0.35 },
    size: 1.05, luminosity: 0.48, seed: hash(50003)
  }];
  const satelliteRecipes = [
    { id: 50014, name: 'Io', material: 'io', parentId: 50007,
      offset: [0.00048, 0.000025, -0.00031], radius: 0.0000040, color: [0.92,0.70,0.32], tilt: 0.04, arrivalView: { yaw: 2.2, pitch: 0.18 } },
    { id: 50015, name: 'Europa', material: 'europa', parentId: 50007,
      offset: [-0.00073, 0.00006, -0.00060], radius: 0.0000034, color: [0.81,0.77,0.64], tilt: 0.06, arrivalView: { yaw: 2.2, pitch: 0.24 } },
    { id: 50016, name: 'Enceladus', material: 'enceladus', parentId: 50001,
      offset: [-0.00034, -0.00004, 0.00024], radius: 0.0000027, color: [0.88,0.94,1.0], tilt: 0.12, arrivalView: { yaw: -0.78, pitch: -0.28 } },
    { id: 50017, name: 'Titan', material: 'titan', parentId: 50001,
      offset: [0.00094, 0.00012, 0.00062], radius: 0.0000057, color: [0.92,0.66,0.28], tilt: 0.10, arrivalView: { yaw: -0.78, pitch: 0.26 } },
    { id: 50018, name: 'Ganymede', material: 'ganymede', parentId: 50007,
      offset: [0.00091, -0.00003, 0.00077], radius: 0.0000056, color: [0.64,0.62,0.57], tilt: 0.07, arrivalView: { yaw: 2.2, pitch: 0.22 } },
    { id: 50019, name: 'Callisto', material: 'callisto', parentId: 50007,
      offset: [-0.00145, 0.00009, 0.00132], radius: 0.0000052, color: [0.46,0.43,0.38], tilt: 0.05, arrivalView: { yaw: 2.2, pitch: 0.30 } },
    { id: 50020, name: 'Triton', material: 'triton', parentId: 50013,
      offset: [0.00053, 0.00009, -0.00048], radius: 0.0000030, color: [0.73,0.75,0.77], tilt: 0.10, arrivalView: { yaw: 2.2, pitch: -0.24 } },
    { id: 50021, name: 'Mimas', material: 'mimas', parentId: 50001,
      offset: [0.00022, -0.00002, -0.00017], radius: 0.0000018, color: [0.74,0.74,0.69], tilt: 0.10, arrivalView: { yaw: -0.78, pitch: 0.34 } },
    { id: 50023, name: 'Charon', material: 'charon', parentId: 50022,
      offset: [0.000035, 0.000012, 0.000022], radius: 0.00000133, color: [0.64,0.64,0.65], tilt: 119.6 * Math.PI / 180,
      arrivalView: { yaw: -0.66, pitch: 0.40 } },
    { id: 50031, name: 'Phobos', material: 'phobos', parentId: 50004,
      axes: PHOBOS_AXES, surfacePhase: MARS_MOON_PHASE, offset: [0.000022,0.000009,0.000015], radius: 0.00000125,
      color: [0.46,0.43,0.40], tilt: 0.19, arrivalView: { yaw: -0.55,pitch: 0.28 } },
    { id: 50032, name: 'Deimos', material: 'deimos', parentId: 50004,
      axes: DEIMOS_AXES, surfacePhase: MARS_MOON_PHASE, offset: [-0.000047,0.000019,0.000042], radius: 0.00000085,
      color: [0.48,0.46,0.42], tilt: 0.09, arrivalView: { yaw: -0.55,pitch: 0.28 } }
  ];
  const addSatellite = ({ offset, ...body }) => {
    const parent = [...planets, ...dwarfplanets].find(planet => planet.id === body.parentId);
    moons.push({ ...body, kind: 'moon', position: parent.position.map((value,i) => value+offset[i]),
      size: 1.05, luminosity: 0.48, seed: hash(body.id) });
  };
  satelliteRecipes.forEach(addSatellite);
  for (const parent of [...planets, ...dwarfplanets]) {
    const members = moons.filter(body => body.parentId === parent.id);
    const spaced = spaceSatelliteFamily(parent, members);
    for (let i = 0; i < members.length; i++) if (spaced[i] !== members[i]) moons[moons.indexOf(members[i])] = spaced[i];
  }
  // New outer paths do not rescale the existing authored inner families.
  [
    { id: 50033, name: 'Miranda', material: 'miranda', parentId: 50012,
      offset: [0.00031, -0.00015, -0.00025], radius: 0.0000024,
      color: [0.68,0.69,0.70], tilt: 0.12, arrivalView: { yaw: -0.78, pitch: -0.92 } },
    { id: 50034, name: 'Iapetus', material: 'iapetus', parentId: 50001,
      offset: [-0.00118, 0.00045, -0.00079], radius: 0.0000035,
      color: [0.66,0.62,0.56], tilt: 0.26, arrivalView: { yaw: -0.78, pitch: 0.22 } },
    { id: 50037, name: 'Ariel', aliases: ['天卫一'], material: 'ariel', parentId: 50012,
      offset: [0.00044,-0.00018,0.00027], radius: 0.0000034,
      color: [0.70,0.71,0.72], tilt: -0.72, arrivalView: { yaw: -0.22, pitch: -0.82 } },
    { id: 50038, name: 'Umbriel', aliases: ['天卫二'], material: 'umbriel', parentId: 50012,
      offset: [-0.00055,-0.00014,0.00038], radius: 0.0000035,
      color: [0.43,0.45,0.46], tilt: -0.78, arrivalView: { yaw: -0.22, pitch: -0.82 } },
    { id: 50039, name: 'Titania', aliases: ['天卫三'], material: 'titania', parentId: 50012,
      offset: [-0.00077,0.00024,-0.00050], radius: 0.0000044,
      color: [0.64,0.65,0.66], tilt: -0.75, arrivalView: { yaw: -0.22, pitch: -0.82 } },
    { id: 50040, name: 'Oberon', aliases: ['天卫四'], material: 'oberon', parentId: 50012,
      offset: [0.00092,-0.00033,-0.00057], radius: 0.0000042,
      color: [0.61,0.62,0.63], tilt: -0.74, arrivalView: { yaw: -0.22, pitch: -0.82 } }
  ].forEach(addSatellite);
  const galaxies = [{
    id: 50005, name: 'Andromeda Galaxy', aliases: ['M31', 'NGC224', 'Andromeda', 'Messier 31'], kind: 'galaxy', material: 'galaxy',
    position: [-30, 10, -26], color: [1, 0.78, 0.49], radius: 0.008, extent: 2.35, nearLimit: 0.65,
    size: 2.4, luminosity: 1.0, seed: hash(50005)
  }, {
    id: 50027, name: 'Triangulum Galaxy', aliases: ['M33', 'NGC598', 'Triangulum', 'Messier 33'], kind: 'galaxy', material: 'triangulum',
    position: [-35, 6, -19], color: [0.55, 0.71, 1.0], radius: 0.0065, extent: 2.35, nearLimit: 0.18,
    arrivalView: { yaw: -0.45, pitch: 1.06 }, size: 2.4, luminosity: 1.0, seed: hash(50027)
  }];
  galaxies.push(...[
  {
    "id": 50107,
    "material": "whirlpool",
    "position": [16.8861780111569, -23.022822582854594, -36.098877822056586],
    "color": [
      0.55,
      0.74,
      1
    ],
    "name": "Whirlpool Galaxy",
    "aliases": [
      "M51",
      "NGC5194",
      "Messier 51",
      "涡状星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 1.1
    }
  },
  {
    "id": 50108,
    "material": "barred",
    "position": [15.001755146714933, -27.83344468774598, 47.80286264063495],
    "color": [
      0.64,
      0.75,
      1
    ],
    "name": "NGC 1300",
    "aliases": [
      "NGC1300",
      "Barred Spiral NGC 1300",
      "NGC 1300 星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 1.15
    }
  },
  {
    "id": 50109,
    "material": "sombrero",
    "position": [-39.849626064968646, 39.8351618021099, -23.085693060225346],
    "color": [
      1,
      0.82,
      0.6
    ],
    "name": "Sombrero Galaxy",
    "aliases": [
      "M104",
      "NGC4594",
      "Sombrero",
      "Messier 104",
      "草帽星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 0.13
    }
  },
  {
    "id": 50110,
    "material": "centaurusa",
    "position": [34.23843956682914, 10.154165169076148, -7.53260605700837],
    "color": [
      1,
      0.76,
      0.5
    ],
    "name": "Centaurus A",
    "aliases": [
      "NGC5128",
      "C77",
      "Caldwell 77",
      "Cen A",
      "半人马座 A"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 0.24
    }
  },
  {
    "id": 50111,
    "material": "cigar",
    "position": [-18.789223598724238, -36.21082884636948, 26.734254732092282],
    "color": [
      1,
      0.56,
      0.47
    ],
    "name": "Cigar Galaxy",
    "aliases": [
      "M82",
      "NGC3034",
      "Cigar",
      "Messier 82",
      "雪茄星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 0.08
    }
  },
  {
    "id": 50112,
    "material": "needle",
    "position": [-6.230620140668483, -2.075509426679589, -48.02477197753387],
    "color": [
      1,
      0.81,
      0.6
    ],
    "name": "Needle Galaxy",
    "aliases": [
      "NGC4565",
      "C38",
      "Caldwell 38",
      "Needle",
      "针状星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 0.035
    }
  },
  {
    "id": 50113,
    "material": "elliptical",
    "position": [26.66249848597428, 40.26508408014141, 22.464346446560935],
    "color": [
      1,
      0.82,
      0.6
    ],
    "name": "Messier 49",
    "aliases": [
      "M49",
      "NGC4472",
      "Messier49",
      "梅西耶 49"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 0.38
    }
  },
  {
    "id": 50114,
    "material": "cartwheel",
    "position": [-62.54121922975742, -12.569516562548829, 2.595667805658846],
    "color": [
      0.56,
      0.74,
      1
    ],
    "name": "Cartwheel Galaxy",
    "aliases": [
      "Cartwheel",
      "ESO350-40",
      "ESO 350-40",
      "车轮",
      "车轮星系"
    ],
    "arrivalView": {
      "yaw": 0,
      "pitch": 1.04
    }
  }
].map(body=>({...body,kind:'galaxy',radius:.007,extent:2.35,nearLimit:.18,size:2.4,luminosity:1.0,seed:hash(body.id)})));
  galaxies.push(...GALAXY_EXPLORATIONS.map(({id,name,aliases,material,position,color,arrivalView})=>({
    id,name,aliases,material,position:position.slice(),color,arrivalView,kind:'galaxy',
    radius:.007,extent:2.35,nearLimit:.18,size:2.4,luminosity:1.0,seed:hash(id)
  })));
  // Galaxy dimensions are authored exploration units, like their positions.
  // Their distant volumes and arrival now share this one physical extent.
  for (const [index,galaxy] of galaxies.entries()) {
    galaxy.spaceRegion = 'outside-milky-way';
    // Keep external subjects outside the Galactic overview's camera orbit.
    // Broad authored depth layers replace the former small shell around it;
    // these are exploration coordinates, not measured astronomical distances.
    const depth = ({galaxy:155,triangulum:205,lmc:125,smc:165})[galaxy.material]
      || 185 + ((index * .61803398875) % 1) * 210;
    const length = Math.hypot(...galaxy.position);
    galaxy.position = galaxy.position.map(value => value * depth / length);
    galaxy.radius *= 220;
    galaxy.orientation = galaxyOrientation(galaxy);
    galaxy.arrivalView = galaxyArrivalView(galaxy,galaxy.arrivalView);
  }
  const comets = [{
    id: 50006, name: "Halley's Comet", aliases: ['Halley', '1P/Halley', '1P Halley'], kind: 'comet', material: 'comet', parentId: 0,
    position: SOL_POSITION.map((value, i) => value + [0.032, 0.006, -0.023][i]),
    color: [0.58, 0.84, 0.92], radius: 0.000003, axes: [1.18, 0.56, 0.66], tilt: 0.27,
    arrivalDistanceRatio: 72, arrivalView: { yaw: 0.35, pitch: 0.28 },
    size: 1.3, luminosity: 0.65, seed: hash(50006)
  }];
  const pulsars = [{
    id: 50008, name: 'Crab Pulsar', aliases: ['Crab', 'PSR B0531+21'], kind: 'pulsar', material: 'pulsar',
    position: SOL_POSITION.map((value, i) => value + [-2.7, 0.48, -0.83][i]),
    color: [0.42, 0.77, 1], radius: 0.000021, tilt: 0.32,
    arrivalDistanceRatio: 42, arrivalView: { yaw: 0.52, pitch: 0.70 },
    size: 1.55, luminosity: 0.82, seed: hash(50008)
  }, {
    id: 50028, name: 'Vela Pulsar', aliases: ['Vela', 'PSR B0833-45', 'PSR J0835-4510'], kind: 'pulsar', material: 'vela',
    position: [SOL_POSITION[0] + 0.72, SOL_POSITION[1] - 0.36, SOL_POSITION[2] + 0.95],
    color: [0.38, 0.88, 1], radius: 0.000018, tilt: -0.38,
    arrivalDistanceRatio: 42, arrivalView: { yaw: -0.40, pitch: 0.48 },
    size: 1.55, luminosity: 0.80, seed: hash(50028)
  }];
  const blackholes = [{
    id: 50009, name: 'Sagittarius A*', aliases: ['Sgr A*', 'Sgr A', 'Sagittarius A'], kind: 'blackhole', material: 'blackhole',
    // A compressed Galactic-centre illustration, not astrometric coordinates.
    position: [0, 0, 0], color: [1, 0.65, 0.30], radius: 0.00024, tilt: 0.22,
    extent: 4, nearLimit: 8.5, arrivalDistanceRatio: 20, arrivalView: { yaw: 0.65, pitch: 0.16 },
    size: 1.8, luminosity: 0.7, seed: hash(50009)
  }, {
    id: 50029, name: 'M87*', aliases: ['M87', 'Messier 87', 'Powehi'], kind: 'blackhole', material: 'm87',
    spaceRegion: 'outside-milky-way', position: [28, 31, -37],
    color: [1, 0.66, 0.32], radius: 0.0016, tilt: 0.42,
    extent: 4, nearLimit: 8.5, arrivalDistanceRatio: 42, arrivalView: { yaw: -0.36, pitch: 0.30 },
    size: 1.9, luminosity: 0.82, seed: hash(50029)
  }];
  const stellarRemnants = [{
    id: 50030, name: 'Sirius B', aliases: ['SiriusB', 'Alpha Canis Majoris B'], kind: 'star', material: 'whitedwarf', parentId: 4,
    // Readable relative separation and size, not an astrometric binary orbit.
    position: stars[4].position.map((value,i) => value+[0.0048,0.0012,-0.0036][i]),
    color: [0.73,0.86,1], radius: 0.0000076, tilt: 0.08,
    arrivalView: { yaw: 0.85, pitch: 0.26 }, size: 1.05, luminosity: 0.65, seed: hash(50030)
  }];
  // Compact remnants share existing material families and finite resources.
  // Positions, relative scales and views are authored exploration coordinates.
  pulsars.push(...[
    {id:50127,name:'PSR B1509-58',aliases:['B1509','PSR J1513-5908','宇宙之手脉冲星'],offset:[-3.8,-.54,1.9],color:[.40,.92,.85],tilt:.48,view:[-.42,.64]},
    {id:50128,name:'Geminga',aliases:['PSR J0633+1746','PSR B0633+17','杰明加'],offset:[.45,.19,-.83],color:[1,.74,.45],tilt:-.23,view:[.28,.42]}
  ].map(({offset,view,...body})=>({...body,kind:'pulsar',material:'pulsar',position:SOL_POSITION.map((v,i)=>v+offset[i]),
    radius:.000019,arrivalDistanceRatio:42,arrivalView:{yaw:view[0],pitch:view[1]},size:1.55,luminosity:.80,seed:hash(body.id)})));
  blackholes.push(...[
    {id:50129,name:'Cygnus X-1',aliases:['Cyg X-1','天鹅座 X-1','天鹅座X1'],offset:[-1.8,.61,3.2],color:[.65,.83,1],tilt:-.34,arrivalDistanceRatio:20,view:[.48,.82]},
    {id:50130,name:'MAXI J1820+070',aliases:['MAXI J1820','ASASSN-18ey','MAXI黑洞'],offset:[2.7,-.42,-1.7],color:[.84,.90,1],tilt:.29,arrivalDistanceRatio:42,view:[-.32,.43]}
  ].map(({offset,view,...body})=>({...body,kind:'blackhole',material:'blackhole',position:SOL_POSITION.map((v,i)=>v+offset[i]),
    radius:.000036,extent:4,nearLimit:8.5,arrivalView:{yaw:view[0],pitch:view[1]},size:1.8,luminosity:.78,seed:hash(body.id)})));
  stellarRemnants.push({id:50131,name:'Procyon B',aliases:['Alpha Canis Minoris B','南河三 B','南河三B'],kind:'star',material:'whitedwarf',parentId:6,
    position:stars[6].position.map((v,i)=>v+[-.0037,.0014,.0041][i]),color:[1,.91,.74],radius:.0000085,tilt:-.12,
    arrivalView:{yaw:2.2,pitch:-.1},size:1.05,luminosity:.61,seed:hash(50131)},
    {id:50132,name:"van Maanen's Star",aliases:['van Maanen 2','vMa 2','范马南星'],kind:'star',material:'whitedwarf',
    position:SOL_POSITION.map((v,i)=>v+[.32,-.17,.71][i]),color:[1,.76,.50],radius:.0000082,tilt:.16,
    arrivalView:{yaw:.41,pitch:.37},size:1.05,luminosity:.57,seed:hash(50132)});
  // Additional finite destinations use their own seeds, never the generated
  // stellar stream. Coordinates, relative sizes and surface forms are artwork.
  const outerWorlds = [
    { id:50041, name:'Eris', aliases:['阋神星'], material:'eris', offset:[-.25,.09,.23], radius:.0000026, color:[.83,.85,.88] },
    { id:50042, name:'Haumea', aliases:['妊神星'], material:'haumea', offset:[.23,-.065,.19], radius:.0000022, axes:[1.48,.64,.86], color:[.79,.84,.87] },
    { id:50043, name:'Makemake', aliases:['鸟神星'], material:'makemake', offset:[-.21,.052,-.23], radius:.0000017, color:[.78,.43,.29] }
  ].map(({offset,...body})=>({...body,kind:'dwarfplanet',parentId:0,position:SOL_POSITION.map((v,i)=>v+offset[i]),
    tilt:.28,size:1.1,luminosity:.48,seed:hash(body.id),
    arrivalView:{yaw:Math.atan2(-offset[0],-offset[2])+.22,pitch:Math.atan2(-offset[1],Math.hypot(offset[0],offset[2]))+.15}}));
  dwarfplanets.push(...outerWorlds);
  [
    {id:50044,name:'Rhea',aliases:['土卫五'],material:'rhea',parentId:50001,offset:[.00072,.00010,.00063],radius:.0000035,color:[.74,.75,.76]},
    {id:50045,name:'Dione',aliases:['土卫四'],material:'dione',parentId:50001,offset:[-.00054,.00006,.00037],radius:.0000025,color:[.71,.74,.77]},
    {id:50046,name:'Tethys',aliases:['土卫三'],material:'tethys',parentId:50001,offset:[.00043,-.00006,-.00036],radius:.0000024,color:[.83,.85,.84]},
    {id:50047,name:'Proteus',aliases:['海卫八'],material:'proteus',parentId:50013,offset:[.00024,.00003,.00018],radius:.0000014,axes:[1.12,.91,1],color:[.28,.29,.31]}
  ].forEach(recipe=>addSatellite({...recipe,tilt:.12,arrivalView:{yaw:-.78,pitch:.22}}));
  asteroids.push(...[
    {id:50048,name:'Eros',aliases:['433 Eros','爱神星'],material:'eros',offset:[-.011,.002,.015],radius:.0000009,axes:[1.85,.53,.65],color:[.55,.40,.28]},
    {id:50049,name:'Bennu',aliases:['101955 Bennu','贝努'],material:'bennu',offset:[.008,.003,.012],radius:.0000007,axes:[1.08,.86,1.08],color:[.27,.28,.29]}
  ].map(({offset,...body})=>({...body,kind:'asteroid',parentId:0,position:SOL_POSITION.map((v,i)=>v+offset[i]),
    tilt:.38,size:1.1,luminosity:.48,seed:hash(body.id),
    arrivalView:{yaw:Math.atan2(-offset[0],-offset[2])+.25,pitch:Math.atan2(-offset[1],Math.hypot(offset[0],offset[2]))+.18}})));
  comets.push(...[
    {id:50050,name:'Wild 2',aliases:['81P/Wild','维尔特2号'],offset:[-.039,.012,-.027],axes:[.90,.77,1.16]},
    {id:50051,name:'Tempel 1',aliases:['9P/Tempel 1','坦普尔1号'],offset:[.027,-.009,.038],axes:[1.24,.82,.87]}
  ].map(({offset,...body})=>({...body,kind:'comet',material:'comet',parentId:0,position:SOL_POSITION.map((v,i)=>v+offset[i]),
    radius:.0000025,color:[.65,.78,.85],tilt:.22,size:1.3,luminosity:.65,seed:hash(body.id),
    arrivalDistanceRatio:72,arrivalView:{yaw:Math.atan2(-offset[0],-offset[2])+.32,pitch:.30}})));
  nebulae.push(...[
    {id:50052,name:'Eagle Nebula',aliases:['M16','IC4703','鹰状星云'],material:'eagle',offset:[1.95,.38,-2.40],color:[.74,.89,.62]},
    {id:50053,name:'Horsehead Nebula',aliases:['B33','Barnard 33','马头星云'],material:'horsehead',offset:[-1.95,-.26,-1.43],color:[.91,.33,.35]},
    {id:50054,name:'Carina Nebula',aliases:['NGC3372','船底座星云'],material:'carina',offset:[-.92,.24,2.75],color:[.98,.63,.31]},
    {id:50055,name:'Crab Nebula',aliases:['M1','NGC1952','蟹状星云'],material:'crabnebula',offset:[-2.7,.48,-.83],color:[.82,.57,.39]}
  ].map(({offset,...body})=>({...body,kind:'nebula',position:SOL_POSITION.map((v,i)=>v+offset[i]),
    radius:.0016,extent:2.35,nearLimit:body.material==='crabnebula' ? .75 : 2.15,size:2.5,luminosity:.85,seed:hash(body.id),arrivalView:{yaw:0,pitch:.12}})));
  // Named extended targets share the finite point and transparent volume budgets.
  nebulae.push(...[
  {
    "id": 50099,
    "name": "Dumbbell Nebula",
    "aliases": [
      "M27",
      "Messier 27",
      "NGC6853",
      "哑铃星云"
    ],
    "material": "dumbbell",
    "offset": [
      1.43,
      0.42,
      -2.67
    ],
    "color": [
      0.49,
      0.91,
      0.75
    ]
  },
  {
    "id": 50100,
    "name": "Cat's Eye Nebula",
    "aliases": [
      "NGC6543",
      "C6",
      "Caldwell 6",
      "Cat Eye Nebula",
      "猫眼星云"
    ],
    "material": "catseye",
    "offset": [
      -0.72,
      0.64,
      -2.86
    ],
    "color": [
      0.49,
      0.89,
      0.81
    ]
  },
  {
    "id": 50101,
    "name": "Butterfly Nebula",
    "aliases": [
      "NGC6302",
      "C69",
      "Caldwell 69",
      "Bug Nebula",
      "蝴蝶星云"
    ],
    "material": "butterfly",
    "offset": [
      1.96,
      -0.3,
      -1.96
    ],
    "color": [
      0.93,
      0.65,
      0.37
    ]
  },
  {
    "id": 50102,
    "name": "Bubble Nebula",
    "aliases": [
      "NGC7635",
      "C11",
      "Caldwell 11",
      "气泡星云"
    ],
    "material": "bubble",
    "offset": [
      -1.51,
      0.47,
      2.31
    ],
    "color": [
      0.47,
      0.79,
      0.94
    ]
  },
  {
    "id": 50103,
    "name": "Rosette Nebula",
    "aliases": [
      "NGC2237",
      "Rosette",
      "玫瑰星云"
    ],
    "material": "rosette",
    "offset": [
      -2.38,
      -0.19,
      0.52
    ],
    "color": [
      0.91,
      0.43,
      0.49
    ]
  },
  {
    "id": 50104,
    "name": "Veil Nebula",
    "aliases": [
      "Cygnus Loop",
      "天鹅座环状星云",
      "面纱",
      "面纱星云"
    ],
    "material": "veil",
    "offset": [
      0.39,
      0.51,
      2.72
    ],
    "color": [
      0.43,
      0.81,
      0.91
    ]
  },
  {
    "id": 50105,
    "name": "Flame Nebula",
    "aliases": [
      "NGC2024",
      "Flame",
      "火焰星云"
    ],
    "material": "flame",
    "offset": [
      -1.83,
      -0.12,
      -1.28
    ],
    "color": [
      0.96,
      0.63,
      0.29
    ]
  },
  {
    "id": 50106,
    "name": "Swan Nebula",
    "aliases": [
      "M17",
      "Messier 17",
      "NGC6618",
      "Omega Nebula",
      "欧米伽星云",
      "天鹅星云"
    ],
    "material": "swan",
    "offset": [
      2.29,
      0.16,
      -0.53
    ],
    "color": [
      0.96,
      0.75,
      0.51
    ]
  }
].map(({offset,...body})=>({...body,kind:'nebula',position:SOL_POSITION.map((v,i)=>v+offset[i]),
    radius:.0016,extent:2.35,nearLimit:.72,size:2.5,luminosity:.85,seed:hash(body.id),arrivalView:{yaw:0,pitch:.10}})));
  // Append after legacy family spacing: extending the roster never moves an
  // existing destination, source catalogue star or paused observing pose.
  asteroids.push(...[
    {id:50056,name:'Ryugu',aliases:['162173 Ryugu','龙宫'],material:'ryugu',offset:[-.008,.0018,.011],radius:.0000008,color:[.22,.23,.24]},
    {id:50057,name:'Itokawa',aliases:['25143 Itokawa','丝川'],material:'itokawa',offset:[.011,-.002,.008],radius:.0000006,color:[.56,.47,.35]},
    {id:50058,name:'Lutetia',aliases:['21 Lutetia','卢泰西亚'],material:'lutetia',offset:[-.021,.003,-.029],radius:.000002,color:[.48,.49,.51]},
    {id:50059,name:'Ida',aliases:['243 Ida','艾达'],material:'ida',offset:[.026,-.002,-.024],radius:.0000013,color:[.54,.45,.35]},
    {id:50061,name:'Mathilde',aliases:['253 Mathilde','玛蒂尔德'],material:'mathilde',offset:[-.028,-.003,.025],radius:.0000018,color:[.23,.22,.21]},
    {id:50062,name:'Psyche',aliases:['16 Psyche','灵神星'],material:'psyche',offset:[.037,.004,.019],radius:.0000032,color:[.52,.48,.43]},
    {id:50063,name:'Gaspra',aliases:['951 Gaspra','加斯普拉'],material:'gaspra',offset:[.018,.002,-.025],radius:.000001,color:[.61,.40,.28]},
    {id:50064,name:'Steins',aliases:['2867 Steins','Šteins','斯坦斯'],material:'steins',offset:[-.017,.004,.031],radius:.0000007,color:[.65,.62,.54]}
  ].map(({offset,...body})=>({...body,kind:'asteroid',parentId:0,axes:NEW_SMALL_WORLDS[body.material].axes,
    position:SOL_POSITION.map((v,i)=>v+offset[i]),tilt:.34,size:1.1,luminosity:.48,seed:hash(body.id),
    arrivalView:{yaw:body.material==='itokawa' ? Math.PI-.12 : Math.atan2(-offset[0],-offset[2])+.90,pitch:Math.atan2(-offset[1],Math.hypot(offset[0],offset[2]))+.26}})));
  const ida=asteroids.find(body=>body.id===50059),dactylOffset=[.000014,.000004,.000011];
  moons.push({id:50060,name:'Dactyl',aliases:['达克蒂尔'],kind:'moon',material:'dactyl',parentId:ida.id,
    position:ida.position.map((v,i)=>v+dactylOffset[i]),radius:.00000022,axes:NEW_SMALL_WORLDS.dactyl.axes,
    tilt:.15,size:1.1,luminosity:.48,seed:hash(50060),color:[.54,.49,.42],arrivalView:{yaw:ida.arrivalView.yaw,pitch:.22}});
  const rosettaOffset=[-.033,.009,.023];
  comets.push({id:50065,name:'67P/Churyumov-Gerasimenko',aliases:['67P','Churyumov-Gerasimenko','丘留莫夫-格拉西缅科','罗塞塔彗星'],
    kind:'comet',material:'rosettacomet',parentId:0,position:SOL_POSITION.map((v,i)=>v+rosettaOffset[i]),
    radius:.0000025,axes:NEW_SMALL_WORLDS.rosettacomet.axes,color:[.62,.73,.82],tilt:.22,size:1.3,luminosity:.65,seed:hash(50065),
    arrivalDistanceRatio:72,arrivalView:{yaw:Math.PI-.12,pitch:.30}});
  // Append new family members after legacy spacing so existing worlds stay put.
  [
    {id:50066,name:'Hyperion',aliases:['土卫七'],material:'hyperion',parentId:50001,offset:[.00136,.00018,-.00110],radius:.0000018,color:[.71,.53,.34]},
    {id:50067,name:'Pan',aliases:['潘','土卫十八'],material:'pan',parentId:50001,offset:[-.00033,.000025,.00021],radius:.00000065,color:[.79,.75,.65]},
    {id:50068,name:'Atlas',aliases:['阿特拉斯','土卫十五'],material:'atlas',parentId:50001,offset:[.00026,-.000025,-.00031],radius:.00000072,color:[.74,.68,.55]},
    {id:50069,name:'Phoebe',aliases:['土卫九'],material:'phoebe',parentId:50001,offset:[-.0042,.0009,.0037],radius:.0000015,color:[.25,.24,.23]},
    {id:50070,name:'Nereid',aliases:['海卫二'],material:'nereid',parentId:50013,offset:[-.0023,.0006,.0018],radius:.0000018,color:[.48,.51,.54]}
  ].forEach(recipe=>addSatellite({...recipe,axes:NEW_SMALL_WORLDS[recipe.material].axes,tilt:.18,arrivalView:{yaw:-.92,pitch:.28}}));
  const remoteRecipes=[
    {id:50071,name:'Arrokoth',aliases:['486958 Arrokoth','2014 MU69','阿罗科斯','天涯海角'],material:'arrokoth',kind:'asteroid',offset:[.33,.075,-.29],radius:.0000012,color:[.66,.26,.16]},
    {id:50072,name:'Chariklo',aliases:['10199 Chariklo','女凯龙星'],material:'chariklo',kind:'asteroid',offset:[-.10,.022,.12],radius:.0000016,color:[.40,.36,.31],tilt:.56,nearLimit:5.1,rings:{inner:3.08,outer:3.28,gapInner:3.145,gapOuter:3.20}},
    {id:50073,name:'Sedna',aliases:['90377 Sedna','塞德娜','赛德娜'],material:'sedna',kind:'dwarfplanet',offset:[-.46,.16,-.35],radius:.0000023,color:[.72,.32,.19]},
    {id:50074,name:'Quaoar',aliases:['50000 Quaoar','夸瓦尔'],material:'quaoar',kind:'dwarfplanet',offset:[.28,-.085,.31],radius:.0000027,color:[.56,.42,.30],tilt:.44,nearLimit:5.6,rings:{inner:3.90,outer:4.05,gapInner:5,gapOuter:6}}
  ];
  for(const {offset,...recipe} of remoteRecipes) {
    const body={tilt:.22,...recipe,parentId:0,axes:NEW_SMALL_WORLDS[recipe.material].axes,
      position:SOL_POSITION.map((v,i)=>v+offset[i]),size:1.1,luminosity:.48,seed:hash(recipe.id),
      arrivalView:{yaw:Math.atan2(-offset[0],-offset[2])+(recipe.material==='arrokoth' ? .75 : .32),pitch:recipe.rings ? 1.0 : .28}};
    (body.kind==='dwarfplanet' ? dwarfplanets : asteroids).push(body);
  }
  // Append authored small-world families without respacing existing members.
  const smallSatelliteRecipes = [
  {
    "id": 50075,
    "name": "Amalthea",
    "aliases": [
      "木卫五"
    ],
    "material": "amalthea",
    "kind": "moon",
    "parentId": 50007,
    "offset": [
      -0.00036,
      2.2e-05,
      0.00024
    ],
    "radius": 1.15e-06,
    "color": [
      0.64,
      0.24,
      0.1
    ]
  },
  {
    "id": 50076,
    "name": "Thebe",
    "aliases": [
      "木卫十四"
    ],
    "material": "thebe",
    "kind": "moon",
    "parentId": 50007,
    "offset": [
      0.00035,
      -2.8e-05,
      -0.0003
    ],
    "radius": 8.6e-07,
    "color": [
      0.52,
      0.34,
      0.23
    ]
  },
  {
    "id": 50077,
    "name": "Himalia",
    "aliases": [
      "木卫六"
    ],
    "material": "himalia",
    "kind": "moon",
    "parentId": 50007,
    "offset": [
      -0.0034,
      0.0011,
      0.0028
    ],
    "radius": 1.3e-06,
    "color": [
      0.27,
      0.26,
      0.24
    ]
  },
  {
    "id": 50078,
    "name": "Janus",
    "aliases": [
      "土卫十"
    ],
    "material": "janus",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      -0.00042,
      3.5e-05,
      -0.00027
    ],
    "radius": 1.15e-06,
    "color": [
      0.69,
      0.67,
      0.59
    ]
  },
  {
    "id": 50079,
    "name": "Epimetheus",
    "aliases": [
      "土卫十一"
    ],
    "material": "epimetheus",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      0.00039,
      -2.5e-05,
      0.00032
    ],
    "radius": 9.2e-07,
    "color": [
      0.66,
      0.64,
      0.57
    ]
  },
  {
    "id": 50080,
    "name": "Helene",
    "aliases": [
      "土卫十二"
    ],
    "material": "helene",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      0.0005,
      9e-05,
      -0.00046
    ],
    "radius": 7.2e-07,
    "color": [
      0.77,
      0.75,
      0.69
    ]
  },
  {
    "id": 50081,
    "name": "Telesto",
    "aliases": [
      "土卫十三"
    ],
    "material": "telesto",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      0.00017,
      -3.5e-05,
      -0.00057
    ],
    "radius": 6.5e-07,
    "color": [
      0.85,
      0.84,
      0.79
    ]
  },
  {
    "id": 50082,
    "name": "Calypso",
    "aliases": [
      "土卫十四"
    ],
    "material": "calypso",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      -0.00052,
      4e-05,
      0.00023
    ],
    "radius": 5.9e-07,
    "color": [
      0.81,
      0.83,
      0.8
    ]
  },
  {
    "id": 50083,
    "name": "Prometheus",
    "aliases": [
      "普罗米修斯",
      "土卫十六"
    ],
    "material": "prometheus",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      -0.00034,
      -4e-05,
      0.00037
    ],
    "radius": 8.8e-07,
    "color": [
      0.77,
      0.73,
      0.63
    ]
  },
  {
    "id": 50084,
    "name": "Pandora",
    "aliases": [
      "潘多拉",
      "土卫十七"
    ],
    "material": "pandora",
    "kind": "moon",
    "parentId": 50001,
    "offset": [
      0.00046,
      3.5e-05,
      -0.00025
    ],
    "radius": 8.6e-07,
    "color": [
      0.72,
      0.7,
      0.64
    ]
  },
  {
    "id": 50085,
    "name": "Galatea",
    "aliases": [
      "海卫六"
    ],
    "material": "galatea",
    "kind": "moon",
    "parentId": 50013,
    "offset": [
      -0.00012,
      1.2e-05,
      0.00016
    ],
    "radius": 8.7e-07,
    "color": [
      0.33,
      0.34,
      0.35
    ]
  },
  {
    "id": 50086,
    "name": "Despina",
    "aliases": [
      "海卫五"
    ],
    "material": "despina",
    "kind": "moon",
    "parentId": 50013,
    "offset": [
      0.00015,
      -1.5e-05,
      -0.0001
    ],
    "radius": 8.2e-07,
    "color": [
      0.32,
      0.31,
      0.29
    ]
  },
  {
    "id": 50087,
    "name": "Kleopatra",
    "aliases": [
      "克娄巴特拉",
      "216 Kleopatra",
      "Cleopatra",
      "克娄巴特拉星",
      "克莱奥帕特拉"
    ],
    "material": "kleopatra",
    "kind": "asteroid",
    "parentId": 0,
    "offset": [
      0.041,
      0.006,
      -0.034
    ],
    "radius": 2.2e-06,
    "color": [
      0.48,
      0.47,
      0.43
    ]
  },
  {
    "id": 50088,
    "name": "AlexHelios",
    "aliases": [
      "亚历克斯赫利俄斯"
    ],
    "material": "alexhelios",
    "kind": "moon",
    "parentId": 50087,
    "offset": [
      2.2e-05,
      5e-06,
      1.7e-05
    ],
    "radius": 3.5e-07,
    "color": [
      0.45,
      0.44,
      0.41
    ]
  },
  {
    "id": 50089,
    "name": "CleoSelene",
    "aliases": [
      "克莱奥塞勒涅"
    ],
    "material": "cleoselene",
    "kind": "moon",
    "parentId": 50087,
    "offset": [
      -1.7e-05,
      -4e-06,
      -1.4e-05
    ],
    "radius": 3e-07,
    "color": [
      0.43,
      0.45,
      0.46
    ]
  },
  {
    "id": 50090,
    "name": "Hygiea",
    "aliases": [
      "健神星",
      "10 Hygiea",
      "Hygieia"
    ],
    "material": "hygiea",
    "kind": "asteroid",
    "parentId": 0,
    "offset": [
      0.034,
      -0.004,
      0.045
    ],
    "radius": 3.1e-06,
    "color": [
      0.34,
      0.35,
      0.36
    ]
  }
];
  for (const {offset, ...recipe} of smallSatelliteRecipes) {
    const parent = [stars[0], ...planets, ...asteroids].find(body => body.id === recipe.parentId);
    const body = {...recipe, axes:NEW_SMALL_WORLDS[recipe.material].axes,
      position:parent.position.map((value,i)=>value+offset[i]), tilt:.18, size:1.1, luminosity:.48, seed:hash(recipe.id),
      arrivalView:{yaw:recipe.parentId===50007 || recipe.parentId===50013 ? 2.2 : recipe.parentId===50001 ? -.92 : Math.atan2(-offset[0],-offset[2])+.65, pitch:.28}};
    (body.kind==='asteroid' ? asteroids : moons).push(body);
  }
  // Outer moon families append after legacy layout; old observing poses stay put.
  const outerMoonRecipes = [
  {
    "id": 50091,
    "name": "Styx",
    "aliases": [
      "冥卫五",
      "S/2012 (134340) 1"
    ],
    "parentId": 50022,
    "offset": [
      -5.8e-05,
      1.2e-05,
      3.8e-05
    ],
    "radius": 1.5e-07,
    "color": [
      0.63,
      0.66,
      0.66
    ],
    "material": "styx"
  },
  {
    "id": 50092,
    "name": "Nix",
    "aliases": [
      "冥卫二",
      "S/2005 P 2"
    ],
    "parentId": 50022,
    "offset": [
      3.8e-05,
      -9e-06,
      -7.4e-05
    ],
    "radius": 4.2e-07,
    "color": [
      0.7,
      0.67,
      0.62
    ],
    "material": "nix"
  },
  {
    "id": 50093,
    "name": "Kerberos",
    "aliases": [
      "冥卫四",
      "S/2011 (134340) 1"
    ],
    "parentId": 50022,
    "offset": [
      -8.5e-05,
      6e-06,
      -3.7e-05
    ],
    "radius": 2.3e-07,
    "color": [
      0.68,
      0.68,
      0.63
    ],
    "material": "kerberos"
  },
  {
    "id": 50094,
    "name": "Hydra",
    "aliases": [
      "冥卫三",
      "S/2005 P 1"
    ],
    "parentId": 50022,
    "offset": [
      7.5e-05,
      1.8e-05,
      8.3e-05
    ],
    "radius": 4.8e-07,
    "color": [
      0.73,
      0.75,
      0.7
    ],
    "material": "hydra"
  },
  {
    "id": 50095,
    "name": "Dysnomia",
    "aliases": [
      "阋卫一",
      "S/2005 (2003 UB313) 1"
    ],
    "parentId": 50041,
    "offset": [
      2.1e-05,
      1e-05,
      -3.6e-05
    ],
    "radius": 7.2e-07,
    "color": [
      0.26,
      0.28,
      0.3
    ],
    "material": "dysnomia"
  },
  {
    "id": 50096,
    "name": "Hiʻiaka",
    "aliases": [
      "Hiiaka",
      "Hi'iaka",
      "Hi’iaka",
      "妊卫一"
    ],
    "parentId": 50042,
    "offset": [
      4.8e-05,
      1.5e-05,
      -3.4e-05
    ],
    "radius": 5.2e-07,
    "color": [
      0.69,
      0.76,
      0.79
    ],
    "material": "hiiaka"
  },
  {
    "id": 50097,
    "name": "Namaka",
    "aliases": [
      "妊卫二"
    ],
    "parentId": 50042,
    "offset": [
      -2.7e-05,
      -1.1e-05,
      2.5e-05
    ],
    "radius": 3.2e-07,
    "color": [
      0.7,
      0.73,
      0.67
    ],
    "material": "namaka"
  },
  {
    "id": 50098,
    "name": "MK 2",
    "aliases": [
      "MK2",
      "鸟卫一",
      "S/2015 (136472) 1",
      "S/2015(136472)1"
    ],
    "parentId": 50043,
    "offset": [
      -3.1e-05,
      1.2e-05,
      -3.8e-05
    ],
    "radius": 3.2e-07,
    "color": [
      0.22,
      0.19,
      0.17
    ],
    "material": "mk2"
  }
];
  // Append remote worlds without relocating any existing family member.
  const frontierRecipes = [{"id":50115,"name":"Orcus","aliases":["90482 Orcus","亡神星"],"parentId":0,"offset":[0.41,0.095,-0.33],"radius":2.5e-06,"color":[0.467,0.538,0.571],"material":"orcus","kind":"dwarfplanet","surfacePhase":0.21120319364432383,"arrivalView":{"yaw":-0.19308803423026888,"pitch":0.28}},{"id":50116,"name":"Vanth","aliases":["90482 Orcus I","Orcus I"],"parentId":50115,"offset":[2.9e-05,1e-05,-2.6e-05],"radius":9e-07,"color":[0.279,0.1845,0.1225],"material":"vanth","kind":"moon","surfacePhase":0.036233991556268615,"arrivalView":{"yaw":-0.03308803423026907,"pitch":0.28}},{"id":50117,"name":"Gonggong","aliases":["225088 Gonggong","2007 OR10","共工"],"parentId":0,"offset":[-0.53,-0.11,0.42],"radius":3e-06,"color":[0.445,0.179,0.1021],"material":"gonggong","kind":"dwarfplanet","surfacePhase":-2.948430714635409,"arrivalView":{"yaw":2.9409183642213925,"pitch":0.28}},{"id":50118,"name":"Xiangliu","aliases":["Gonggong I","225088 Gonggong I","相柳"],"parentId":50117,"offset":[-4.1e-05,1.5e-05,3.8e-05],"radius":3.1e-07,"color":[0.1286,0.121,0.1286],"material":"xiangliu","kind":"moon","surfacePhase":-3.102432317995758,"arrivalView":{"yaw":3.1009183642213927,"pitch":0.28}},{"id":50119,"name":"Salacia","aliases":["120347 Salacia"],"parentId":0,"offset":[0.36,-0.12,0.49],"radius":2.3e-06,"color":[0.2085,0.2565,0.289],"material":"salacia","kind":"dwarfplanet","surfacePhase":1.86266256911871,"arrivalView":{"yaw":-1.8079596455200484,"pitch":0.28}},{"id":50120,"name":"Actaea","aliases":["Salacia I","120347 Salacia I"],"parentId":50119,"offset":[2.3e-05,-8e-06,3.1e-05],"radius":7.2e-07,"color":[0.262,0.31,0.327],"material":"actaea","kind":"moon","surfacePhase":1.7083162619939893,"arrivalView":{"yaw":-1.6479596455200478,"pitch":0.28}},{"id":50121,"name":"Varda","aliases":["174567 Varda"],"parentId":0,"offset":[-0.38,0.14,-0.49],"radius":2e-06,"color":[0.374,0.391,0.3445],"material":"varda","kind":"dwarfplanet","surfacePhase":-1.426782086017918,"arrivalView":{"yaw":1.3596287426369207,"pitch":0.28}},{"id":50122,"name":"Ilmarë","aliases":["Ilmare","Varda I","174567 Varda I"],"parentId":50121,"offset":[-2.4e-05,1.4e-05,-2.9e-05],"radius":9e-07,"color":[0.347,0.3795,0.374],"material":"ilmare","kind":"moon","surfacePhase":-1.5836527889726768,"arrivalView":{"yaw":1.5196287426369204,"pitch":0.28}},{"id":50123,"name":"Varuna","aliases":["20000 Varuna"],"parentId":0,"offset":[0.48,-0.06,0.17],"radius":2.1e-06,"color":[0.356,0.201,0.1185],"material":"varuna","kind":"dwarfplanet","surfacePhase":1.2794646032190136,"arrivalView":{"yaw":-1.2111782654368035,"pitch":0.28}},{"id":50124,"name":"Ixion","aliases":["28978 Ixion"],"parentId":0,"offset":[-0.24,-0.12,0.44],"radius":1.8e-06,"color":[0.39,0.2355,0.148],"material":"ixion","kind":"dwarfplanet","surfacePhase":2.9484509298941477,"arrivalView":{"yaw":3.342245931909663,"pitch":0.28}},{"id":50125,"name":"Weywot","aliases":["Quaoar I","50000 Quaoar I"],"parentId":50074,"offset":[3.5e-05,1.1e-05,-3e-05],"radius":3.4e-07,"color":[0.176,0.1529,0.1228],"material":"weywot","kind":"moon","surfacePhase":1.6103174617855225,"arrivalView":{"yaw":-1.5469981942505657,"pitch":0.28}},{"id":50126,"name":"2002 MS4","aliases":["307261","307261 2002 MS4","2002 MS₄"],"parentId":0,"offset":[0.16,0.11,-0.54],"radius":2.15e-06,"color":[0.2735,0.2975,0.316],"material":"ms4","kind":"dwarfplanet","surfacePhase":-0.44876021358405416,"arrivalView":{"yaw":0.41194455294937415,"pitch":0.28}}];
  for (const {offset, ...recipe} of frontierRecipes.filter(body=>body.parentId===0)) {
    dwarfplanets.push({...recipe, axes:NEW_SMALL_WORLDS[recipe.material].axes,
      position:SOL_POSITION.map((value,i)=>value+offset[i]), tilt:.22, size:1.1, luminosity:.48, seed:hash(recipe.id),
      arrivalView:recipe.arrivalView});
  }
  outerMoonRecipes.push(...frontierRecipes.filter(body=>body.parentId!==0));
  for (const {offset, ...recipe} of outerMoonRecipes) {
    const parent = dwarfplanets.find(body => body.id === recipe.parentId);
    moons.push({...recipe, kind:'moon', axes:NEW_SMALL_WORLDS[recipe.material].axes,
      position:parent.position.map((value,i)=>value+offset[i]), tilt:.22, size:1.1, luminosity:.48, seed:hash(recipe.id),
      arrivalView:recipe.arrivalView || {yaw:Math.atan2(SOL_POSITION[0]-parent.position[0],SOL_POSITION[2]-parent.position[2])+.48,pitch:.28}});
  }
  const planetaryHosts = [
    {id:50134,name:'TRAPPIST-1',aliases:['2MASS J23062928-0502285','特拉比斯特1'],offset:[-1.3,-.12,1.7],radius:.000066,color:[1,.39,.19]},
    {id:50142,name:'51 Pegasi',aliases:['51 Peg','飞马座51'],offset:[.7,.1,.55],radius:.00012,color:[1,.82,.58]}
    ,...EXOSYSTEMS.map(w=>({id:w.hostId,name:w.host,aliases:w.hostAliases,offset:w.offset,radius:w.hostRadius,color:w.hostColor}))
    ,...EXOWORLDS.map(w=>({id:w.hostId,name:w.host,aliases:w.hostAliases,offset:w.offset,radius:w.hostRadius,color:w.hostColor}))
  ].map(({offset,...body})=>({...body,kind:'star',position:SOL_POSITION.map((value,i)=>value+offset[i]),size:1.7,luminosity:1,seed:hash(body.id)}));
  const exoplanetRecipes = [
    {id:50133,name:'Proxima Centauri b',aliases:['Proxima b','比邻星b'],parentId:1,orbit:.00072,phase:.76,radius:.000013,material:'exorock',color:[.50,.29,.18],motionPeriod:118},
    {"id":50135,"name":"TRAPPIST-1 b","aliases":["TRAPPIST1b","特拉比斯特1b"],"parentId":50134,"orbit":0.00038,"phase":0.3,"radius":1.5e-05,"material":"exorock","color":[0.53,0.26,0.13],"motionPeriod":64},
    {"id":50136,"name":"TRAPPIST-1 c","aliases":["TRAPPIST1c","特拉比斯特1c"],"parentId":50134,"orbit":0.00052,"phase":2.4299999999999997,"radius":1.4e-05,"material":"exorock","color":[0.39,0.3,0.25],"motionPeriod":82},
    {"id":50137,"name":"TRAPPIST-1 d","aliases":["TRAPPIST1d","特拉比斯特1d"],"parentId":50134,"orbit":0.00068,"phase":4.56,"radius":1e-05,"material":"exorock","color":[0.6,0.4,0.22],"motionPeriod":105},
    {"id":50138,"name":"TRAPPIST-1 e","aliases":["TRAPPIST1e","特拉比斯特1e"],"parentId":50134,"orbit":0.00087,"phase":6.6899999999999995,"radius":1.2e-05,"material":"exorock","color":[0.34,0.46,0.48],"motionPeriod":132},
    {"id":50139,"name":"TRAPPIST-1 f","aliases":["TRAPPIST1f","特拉比斯特1f"],"parentId":50134,"orbit":0.00109,"phase":8.82,"radius":1.4e-05,"material":"exoice","color":[0.48,0.6,0.62],"motionPeriod":165},
    {"id":50140,"name":"TRAPPIST-1 g","aliases":["TRAPPIST1g","特拉比斯特1g"],"parentId":50134,"orbit":0.00132,"phase":10.95,"radius":1.5e-05,"material":"exoice","color":[0.64,0.7,0.67],"motionPeriod":205},
    {"id":50141,"name":"TRAPPIST-1 h","aliases":["TRAPPIST1h","特拉比斯特1h"],"parentId":50134,"orbit":0.00158,"phase":13.08,"radius":1.1e-05,"material":"exoice","color":[0.4,0.51,0.62],"motionPeriod":250},
    {id:50143,name:'51 Pegasi b',aliases:['51 Peg b','Dimidium','飞马座51b'],parentId:50142,orbit:.0012,phase:2.15,radius:.000052,material:'hotjupiter',color:[.89,.55,.30],motionPeriod:92}
  ];
  exoplanetRecipes.push(...[...EXOWORLDS,...YOUNG_WORLDS].map(w=>({id:w.id,name:w.name,aliases:w.aliases,parentId:w.hostId,orbit:w.orbit,phase:w.phase,radius:w.radius,material:w.material,color:w.color,motionPeriod:w.period,...(w.rings?{rings:w.rings}:{}),...(w.tilt?{tilt:w.tilt}:{})})));
  const exoplanets = exoplanetRecipes.map(({orbit,phase,...body})=>{
    const parent=stars[body.parentId] || planetaryHosts.find(star=>star.id===body.parentId);
    const offset=[Math.sin(phase)*orbit,Math.sin(phase*.7)*orbit*.035,Math.cos(phase)*orbit];
    return {...body,kind:'planet',position:parent.position.map((value,i)=>value+offset[i]),tilt:body.tilt||.16,size:1.45,luminosity:.72,seed:hash(body.id),
      arrivalView:{yaw:Math.atan2(-offset[0],-offset[2])+.42,pitch:.24}};
  });
  nebulae.push(...NEBULA_EXPLORATIONS.map(({id,name,aliases,material,offset,color,region})=>({
    id,name,aliases,material,color,spaceRegion:region,kind:'nebula',position:SOL_POSITION.map((value,i)=>value+offset[i]),
    radius:.0016,extent:2.35,nearLimit:.82,size:2.5,luminosity:.85,seed:hash(id),arrivalView:{yaw:0,pitch:.10}
  })));
  const externalNurseries = {
    'Tarantula Nebula': ['Large Magellanic Cloud', [.7, .3, -.4]],
    'NGC 602': ['Small Magellanic Cloud', [-.6, .4, .5]],
    'NGC 604': ['Triangulum Galaxy', [.6, -.2, .5]]
  };
  for (const body of blackholes) {
    if(body.spaceRegion==='outside-milky-way') {
      const length=Math.hypot(...body.position);
      body.position=body.position.map(value=>value*285/length);
    }
  }
  for (const cloud of nebulae) {
    const host = externalNurseries[cloud.name];
    if (host) cloud.position = galaxies.find(g => g.name === host[0]).position.map((v,i) => v + host[1][i]);
  }
  const bodies = [...planets, ...dwarfplanets, ...asteroids, ...nebulae, ...moons, ...galaxies, ...comets, ...pulsars, ...blackholes, ...stellarRemnants, ...planetaryHosts, ...exoplanets];
  const activeId = (findCatalogTarget(bodies, target) || findCatalogTarget(stars, target))?.id ?? 0;
  const dust = createDust(initialSeed, limits, structure);
  return { stars, planets, exoplanets, planetaryHosts, dwarfplanets, asteroids, nebulae, moons, galaxies, comets, pulsars, blackholes, bodies, galaxyLights: createGalaxyLights(galaxies.find(body => body.id === activeId) || galaxies[0], limits.galaxyStars), galaxyReferences: createGalaxyReferences(galaxies, limits.galaxyReferences), dust, activeId, seed: initialSeed, budget: limits, count, drawIndices: representativeIndices(stars, limits.draw - bodies.length, activeId < count ? activeId : 0), environment: createEnvironment(initialSeed, limits) };
}

function createGalaxyReferences(galaxies, limit) {
  if (!galaxies.length) return [];
  const count = Math.floor(limit / galaxies.length), remainder = limit % galaxies.length;
  // A global envelope, with each owner's deterministic prefix shared by its
  // detailed field. More catalog entries cannot multiply this draw budget.
  return galaxies.flatMap((galaxy, index) => createGalaxyLights(galaxy, count + (index < remainder ? 1 : 0)));
}

function createGalaxyLights(galaxy, limit) {
  if (!galaxy) return [];
  const lights = [], random = seededRandom(galaxy.seed), loose = galaxy.material === 'triangulum';
  const portrait=GALAXY_PORTRAITS[galaxy.material];
  if(portrait) {
    for(let i=0;i<limit;i++) {
      const {point,old}=galaxyPortraitPoint(portrait,random,gaussian);
      const [x,y,z]=point;
      const position=galaxyWorldVector(galaxy,[x,y,z]);
      lights.push({ownerId:galaxy.id,position:position.map((v,axis)=>galaxy.position[axis]+v*galaxy.radius),
        color:[...(old?GALAXY_STELLAR_COLOURS.old:GALAXY_STELLAR_COLOURS.young)],size:mix(.16,.78,Math.pow(random(),1.8)),luminosity:mix(.035,.85,Math.pow(random(),3.0))});
    }
    return lights;
  }
  // One complete bounded field belongs to the observed galaxy. Navigation
  // replaces this same buffer, so adding galaxies does not dilute old views.
  for (let i = 0; i < limit; i++) {
    const central = random(), bulge = !loose && central < 0.24;
    // A loose galaxy still has a thin inner disc. Keep a finite dispersed
    // population there instead of leaving the nearest view between six clumps.
    const innerDisc = loose && central < .22;
    const clustered = !bulge && !innerDisc && i % 5 !== 0, cluster = i % GALAXY_CLUSTER_COUNT;
    const clusterRadius = galaxyClusterRadius(cluster);
    const radius = bulge ? Math.pow(random(), 1.8) * .5 : innerDisc ? Math.pow(random(), .65) * .48 : clustered ? clusterRadius + gaussian(random) * (loose ? .075 : .045) : .28 + Math.sqrt(random()) * 1.82;
    const winding = galaxyWinding(loose);
    const angle = bulge || innerDisc ? random() * TAU : clustered ? galaxyClusterAngle(cluster, loose) + gaussian(random) * (loose ? .10 : .055) : (i % 2) * Math.PI + Math.log(radius / .4) * winding + gaussian(random) * (loose ? .26 : .17);
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const y = gaussian(random) * (bulge ? .17 : innerDisc ? .035 : clustered ? .025 : .07);
    const position = galaxyWorldVector(galaxy,[x,y,z]);
    lights.push({ ownerId: galaxy.id, position: position.map((v, axis) => galaxy.position[axis] + v * galaxy.radius),
      color: [...(bulge ? GALAXY_STELLAR_COLOURS.old : GALAXY_STELLAR_COLOURS.young)],
      size: mix(.16,.78,Math.pow(random(),1.8)), luminosity: mix(.035,.85,Math.pow(random(),3.0)) });
  }
  return lights;
}

export function setObservedGalaxy(catalog, observedId) {
  const galaxy = catalog.galaxies.find(body => body.id === observedId);
  if (!galaxy || catalog.galaxyLights[0]?.ownerId === galaxy.id) return false;
  catalog.galaxyLights = createGalaxyLights(galaxy, catalog.budget.galaxyStars);
  return true;
}

function createDust(initialSeed, limits, structure = makeStructure(seededRandom(initialSeed ^ 0xa4625f19))) {
  const dustRandom = seededRandom(initialSeed ^ 0xd7653471);
  const outskirts = seededRandom(initialSeed ^ 0x68419af3);
  // Shared finite landmarks for auxiliary light only. A quality change reveals
  // more samples of the same space; no catalog position or identity is moved.
  return Array.from({ length: limits.dust }, (_,index) => {
    const point = sampleGalaxy(dustRandom, structure);
    const outer = smoothstep(1, 10, point.radius);
    const variation = mix(0.82, 1.12, dustRandom());
    const entry = {
      position: point.position,
      color: [Math.min(1, mix(1, 0.47, outer) * variation), Math.min(1, mix(0.7, 0.65, outer) * variation), mix(0.43, 0.96, outer)],
      size: mix(0.45, 1.55, Math.pow(dustRandom(), 1.5)),
      luminosity: mix(0.025, 0.13, Math.pow(dustRandom(), 1.6)) * mix(0.75, 1, outer)
    };
    if (index % 10 < 9) {
      const population=outskirts(),halo=population>.92,bulge=population<.16,wide=population>.74&&!halo,inner=population<.46;
      let position,armWarmth;
      if(halo || bulge) {
        const index=halo?2:Math.floor(outskirts()*2);
        position=galacticStellarPoint([gaussian(outskirts),gaussian(outskirts),gaussian(outskirts)].map(v=>v*Math.SQRT1_2),index);
        armWarmth=1;
      } else if(inner) {
        const layerIndex=galacticBridgeLayer(outskirts()),layer=GALACTIC_BRIDGE_LAYERS[layerIndex];
        for(let attempt=0;attempt<5;attempt++) {
          position=galacticBridgePoint(layer.position.map((v,i)=>v+gaussian(outskirts)*layer.axes[i]*Math.SQRT1_2),layerIndex);
          const weight=galacticFragmentWeight(position)*(.45+.55*galacticWideWeight(position));
          if(outskirts()<weight||attempt===4)break;
        }
        armWarmth=.25+.45*Math.exp(-(Math.hypot(position[0],position[2])**2)/625);
      } else if(wide) {
        const layer=GALACTIC_DIFFUSE_LAYERS[0];
        for(let attempt=0;attempt<5;attempt++) {
          position=layer.position.map((v,i)=>v+gaussian(outskirts)*layer.axes[i]);
          if(outskirts()<galacticWideWeight(position)||attempt===4)break;
        }
        armWarmth=.12;
      } else {
        const spur=GALACTIC_SPURS[Math.floor(outskirts()*GALACTIC_SPURS.length)];
        for(let attempt=0;attempt<5;attempt++) {
          const along=gaussian(outskirts)*spur.axes[0]*.78,cross=gaussian(outskirts)*spur.axes[2]*.82;
          position=galacticSpurPoint(spur,along,cross,gaussian(outskirts)*spur.axes[1]);
          if(outskirts()<galacticFragmentWeight(position)||attempt===4)break;
        }
        armWarmth=spur.warmth;
      }
      const radius=Math.hypot(position[0],position[2]),warmth=outskirts();
      entry.position=position;
      entry.color=halo||bulge?[1,.79,.57]:[mix(.50,.90,mix(warmth,armWarmth,.72)),mix(.70,.78,mix(warmth,armWarmth,.72)),mix(1,.80,armWarmth)];
      entry.halo=true;
      entry.size=mix(.40,1.13,Math.pow(outskirts(),2));
      entry.luminosity=mix(.16,1.12,Math.pow(outskirts(),2.5))*Math.exp(-Math.max(0,radius-28)/72)*(halo?.54:bulge?.85:inner?1.35:1);
    }

    return entry;
  });
}

export function setCatalogBudget(catalog, budget, activeId = catalog.activeId, observedId = activeId) {
  const profile = qualityProfile(budget);
  const limits = { key: profile.key, ...profile.budget };
  const fixed = catalog.bodies.length;
  const starId = id => Number.isInteger(id) && id >= 0 && id < catalog.count ? id : 0;
  catalog.drawIndices = representativeIndices(catalog.stars, limits.draw - fixed, starId(activeId), starId(observedId));
  catalog.dust = createDust(catalog.seed, limits);
  catalog.environment = createEnvironment(catalog.seed, limits);
  const galaxy = catalog.galaxies.find(body => body.id === observedId) ||
    catalog.galaxies.find(body => body.id === catalog.galaxyLights[0]?.ownerId) || catalog.galaxies[0];
  catalog.galaxyLights = createGalaxyLights(galaxy, limits.galaxyStars);
  catalog.galaxyReferences = createGalaxyReferences(catalog.galaxies, limits.galaxyReferences);
  catalog.budget = limits;
}
