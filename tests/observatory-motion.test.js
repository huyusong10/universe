import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSceneTime, sceneMotionMode, sceneMotionRate, observingBody, createBodyMotion, galacticFrame } from '../assets/observatory-motion.js';
import { systemOverviewView, readingLensScale } from '../assets/observatory-framing.js';
import { createCatalog, resolveCatalogTarget, bodyRayIntersection, createCamera, updateCameraAnchors, updateCamera,
  cameraFrame, projectPoint, focusCamera, resetCamera, cancelCameraFlight, setReducedMotion, zoomCamera, setCameraScale, setCatalogBudget, bodySystem } from '../assets/observatory-model.js';

test('initial named focus shares the current arrival orientation without changing its overview scale', () => {
  const world=createCatalog({budget:'safe',catalog:64}), original=structuredClone(world.bodies);
  const motion=createBodyMotion(world,{compactStellarFamilies:true});
  const named=[...world.bodies,...world.stars.filter(body=>!body.name.startsWith('UO '))];
  for (const time of [0,73,264]) {
    const poses=motion.snapshot(time), space=galacticFrame(time), sun=space.body(poses.get(0));
    const later=motion.snapshot(time+23);
    for (const source of named) for (const reducedMotion of [false,true]) {
      const body=space.body(poses.get(source.id)||source);
      const initial=createCamera(body,{reducedMotion}), plain=createCamera({...body,arrivalView:null});
      const arrived=createCamera(sun,{reducedMotion:true});focusCamera(arrived,body);
      const frame=cameraFrame(initial,1.6), arrivalFrame=cameraFrame(arrived,1.6);
      assert.equal(initial.activeId,body.id);assert.equal(initial.observedId,body.id);
      assert.deepEqual(frame.focus,body.position);assert.equal(initial.flight,null);
      assert.equal(initial.distance,plain.distance);assert.equal(initial.distanceTarget,plain.distanceTarget);
      for (const key of ['yaw','pitch','roll','fov']) assert.equal(frame[key],arrivalFrame[key],source.name+' starts with its arrival orientation');
      setCameraScale(initial,1);
      for (let i=1;i<=600;i++) updateCamera(initial,1/60,i*1000/60);
      assert.equal(initial.distance,initial.distanceTarget);
      const moved=space.body(later.get(source.id)||source);
      updateCameraAnchors(initial,{active:moved,observed:moved});updateCamera(initial,1/60,10100);
      for (const key of ['yaw','pitch','roll','fov']) assert.equal(cameraFrame(initial,1.6)[key],frame[key],source.name+' keeps user orientation during scale travel and motion');
    }
  }
  assert.deepEqual(world.bodies,original);
});

test('authored binaries follow their own central stars and retain finite common-space envelopes', () => {
  for(const [name,parent] of [['Sirius B','Sirius'],['Procyon B','Procyon']]) {
  const world=createCatalog({budget:'safe'}), dwarf=resolveCatalogTarget(world,name), main=resolveCatalogTarget(world,parent);
  const originals=structuredClone([main,dwarf]), motion=createBodyMotion(world);
  const initial=motion.snapshot(0), path=motion.path(dwarf.id,initial);
  assert.ok(path.length>2); assert.deepEqual(initial.get(main.id),main);
  assert.ok(Math.hypot(...initial.get(dwarf.id).position.map((v,i)=>v-dwarf.position[i]))<1e-12);
  const extent=Math.max(...path.map(p=>Math.hypot(...p.map((v,i)=>v-main.position[i]))));
  let moved=false;
  for (const time of [0,20,80,160,240]) {
    const poses=motion.snapshot(time), current=poses.get(dwarf.id), frame=galacticFrame(time);
    assert.deepEqual(poses.get(main.id),main);
    const distance=Math.hypot(...current.position.map((v,i)=>v-main.position[i]));
    assert.ok(distance>main.radius+dwarf.radius && distance<=extent+1e-12);
    assert.deepEqual(frame.body(current).position,frame.toWorld(current.position));
    moved ||= Math.hypot(...current.position.map((v,i)=>v-dwarf.position[i]))>dwarf.radius;
  }
  assert.ok(moved); assert.deepEqual([main,dwarf],originals);
  assert.ok(!bodySystem(world,0).members.includes(dwarf));
  }
});

test('a compact stellar observing layout keeps both identities readable inside held common-space views', () => {
  for (const budget of ['safe','immersive']) for(const [name,parent] of [['Sirius B','Sirius'],['Procyon B','Procyon']]) {
    const world=createCatalog({catalog:1000,budget}), original=structuredClone(world.bodies);
    const source=resolveCatalogTarget(world,parent), dwarf=resolveCatalogTarget(world,name);
    const legacy=createBodyMotion(world), motion=createBodyMotion(world,{compactStellarFamilies:true});
    const initial=motion.snapshot(0), envelope=motion.path(dwarf.id,initial);
    const separation=(a,b)=>Math.hypot(...a.position.map((v,i)=>v-b.position[i]));
    assert.ok(separation(initial.get(dwarf.id),source)<separation(dwarf,source));
    const layouts=[[1280,720,{x:390,y:128,width:820,height:516}],
      [390,844,{x:16,y:128,width:358,height:260}],
      [844,390,{x:330,y:120,width:450,height:194}]];
    for (const [width,height,area] of layouts) {
      const center=[(area.x+area.width/2)/width,(area.y+area.height/2)/height];
      const camera=createCamera(source,{reducedMotion:true});
      const lens=cameraFrame(camera,width/height,center);
      const fit=readingLensScale(lens,source,source.radius*3.1,width,height,area);
      lens.fov=2*Math.atan(Math.tan(lens.fov/2)/fit);
      const members=[source,...envelope.map(position=>({...dwarf,position}))];
      const view=systemOverviewView(source,members,lens,width,height,area,{sweepYaw:true});
      focusCamera(camera,source,0,view);
      const held=[camera.distance,camera.yaw,camera.pitch,camera.roll];
      for (const time of [0,20,60,100,160,240]) {
        const poses=motion.snapshot(time), current=poses.get(dwarf.id), prior=legacy.snapshot(time);
        assert.equal(current.id,dwarf.id);
        assert.ok(separation(current,source)>source.radius+dwarf.radius);
        for (const body of world.bodies.filter(body=>!(body.material==='whitedwarf' && world.stars[body.parentId]))) {
          assert.deepEqual(poses.get(body.id),prior.get(body.id));
        }
        updateCameraAnchors(camera,{active:source,observed:source});updateCamera(camera,.1,time*1000);
        assert.deepEqual([camera.distance,camera.yaw,camera.pitch,camera.roll],held);
        const frame=cameraFrame(camera,width/height,center);frame.fov=lens.fov;
        for (const body of [source,current]) {
          const point=projectPoint(body.position,frame,width,height);
          const radius=height/(2*Math.tan(frame.fov/2))*body.radius/point.depth;
          assert.ok(point.x-radius>=area.x && point.x+radius<=area.x+area.width);
          assert.ok(point.y-radius>=area.y && point.y+radius<=area.y+area.height);
          assert.ok(radius>.55,'the common view retains a resolvable stellar reference');
        }
      }
    }
    assert.deepEqual(world.bodies,original);
    assert.equal(bodySystem(world,dwarf.id).root,source);
    assert.ok(!bodySystem(world,0).members.includes(dwarf));
  }
});

test('an external compact remnant stays outside Milky Way rotation while local remnants share it', () => {
  const world = createCatalog({ budget: 'safe' }), motion = createBodyMotion(world);
  const external = resolveCatalogTarget(world, 'M87*'), local = resolveCatalogTarget(world, 'Vela Pulsar');
  const originals = structuredClone([external, local]);
  for (const time of [0, 16, 264]) {
    const poses = motion.snapshot(time), frame = galacticFrame(time);
    assert.deepEqual(frame.body(poses.get(external.id)), external);
    const observed = frame.body(poses.get(local.id));
    assert.deepEqual(observed.position, frame.toWorld(local.position));
    assert.equal(observed.arrivalView.yaw, local.arrivalView.yaw + frame.angle);
  }
  assert.deepEqual([external, local], originals);
});

test('authored satellite paths keep parent observation clearance and ordered Saturn orbits throughout activity', () => {
  for (const budget of ['safe', 'immersive']) {
    const world = createCatalog({ budget }), original = structuredClone(world.moons);
    const motion = createBodyMotion(world);
    for (const time of [0, 16, 264]) {
      const poses = motion.snapshot(time), bounds = new Map();
      for (const moon of world.moons) {
        const parent = poses.get(moon.parentId);
        const radii = motion.path(moon.id, poses).map(point => Math.hypot(...point.map((value, i) => value - parent.position[i])));
        const extent = parent.radius * Math.max(1, parent.rings?.outer || 1, ...(parent.axes || []));
        assert.ok(Math.min(...radii) - moon.radius > extent + parent.radius, moon.name + ' leaves room outside its parent');
        bounds.set(moon.name, [Math.min(...radii), Math.max(...radii)]);
      }
      assert.ok(bounds.get('Mimas')[1] < bounds.get('Enceladus')[0]);
      assert.ok(bounds.get('Enceladus')[1] < bounds.get('Titan')[0]);
    }
    assert.deepEqual(world.moons, original);
  }
});

test('outer moons share their moving parent frame without changing catalog geometry or paused poses', () => {
  const world=createCatalog({budget:'safe'}), original=structuredClone(world.moons);
  const motion=createBodyMotion(world), atStart=motion.snapshot(0), atTime=motion.snapshot(16);
  for (const name of ['Io','Europa','Enceladus','Titan','Ganymede','Callisto','Triton','Mimas','Charon','Miranda','Iapetus','Ariel','Umbriel','Titania','Oberon']) {
    const body=resolveCatalogTarget(world,name);
    const offset=poses=>poses.get(body.id).position.map((v,i)=>v-poses.get(body.parentId).position[i]);
    assert.ok(offset(atTime).some((v,i)=>Math.abs(v-offset(atStart)[i])>body.radius));
    assert.ok(motion.path(body.id,atTime).every(point=>point.every(Number.isFinite)));
    assert.deepEqual(atTime.get(body.id),motion.snapshot(advanceSceneTime(16,.1,'paused')).get(body.id));
    const camera=createCamera(atTime.get(body.id),{reducedMotion:true});focusCamera(camera,atTime.get(body.id));
    updateCameraAnchors(camera,{active:atTime.get(body.id),observed:atTime.get(body.id)});updateCamera(camera,1000,.1);
    const projected=projectPoint(atTime.get(body.id).position,cameraFrame(camera,16/9),1280,720);
    assert.ok(Math.abs(projected.x-640)<1e-5 && Math.abs(projected.y-360)<1e-5);
    for(const time of [0,16,73,264,1121]) {
      const poses=motion.snapshot(time),moon=poses.get(body.id),sun=poses.get(0);
      const light=sun.position.map((v,i)=>v-moon.position[i]),length=Math.hypot(...light);
      const view=moon.arrivalView;
      const eye=[Math.sin(view.yaw)*Math.cos(view.pitch),Math.sin(view.pitch),Math.cos(view.yaw)*Math.cos(view.pitch)];
      assert.ok(eye.reduce((sum,v,i)=>sum+v*light[i]/length,0)>.5,'first arrival reveals the sunlit terrain');
    }
  }
  assert.deepEqual(world.moons,original);
  const triton=resolveCatalogTarget(world,'Triton'), neptune=resolveCatalogTarget(world,'Neptune');
  const next=motion.snapshot(.1);
  const angular=(body,parent)=> {
    const a=atStart.get(body.id).position.map((v,i)=>v-atStart.get(parent).position[i]);
    const b=next.get(body.id).position.map((v,i)=>v-next.get(parent).position[i]);
    return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  };
  const satelliteTurn=angular(triton,neptune.id), planetTurn=angular(neptune,0);
  assert.ok(satelliteTurn.reduce((sum,v,i)=>sum+v*planetTurn[i],0)<0,'Triton retains retrograde orbital sense');
});

test('artistic activity can pause, continue and accelerate without resetting its phase', () => {
  let time = advanceSceneTime(12, 0.1);
  assert.equal(time, 12.1);
  time = advanceSceneTime(time, 0.1, 'paused');
  assert.equal(time, 12.1);
  time = advanceSceneTime(time, 0.1, 'flow');
  assert.equal(time, 12.2);
  assert.equal(advanceSceneTime(time, 0.1, 'accelerated'), 12.6);
  assert.equal(sceneMotionRate('accelerated'), 4);
});

test('live reduced motion always freezes activity while retaining the selected pace', () => {
  for (const mode of ['flow', 'paused', 'accelerated']) {
    assert.equal(advanceSceneTime(12, 0.1, mode, true), 12);
    assert.equal(sceneMotionRate(mode, true), 0);
    assert.equal(sceneMotionMode(mode), mode);
  }
  assert.equal(advanceSceneTime(12, 0.1, 'accelerated', false), 12.4);
});

test('invalid activity input and background scheduling cannot produce a phase jump', () => {
  assert.equal(sceneMotionMode('realtime'), 'flow');
  for (const dt of [NaN, Infinity, -1]) assert.equal(advanceSceneTime(12, dt), 12);
  assert.equal(advanceSceneTime(12, 3600), 12.1);
  assert.equal(advanceSceneTime(NaN, 0.1), 0.1);
});

test('a rotating comet keeps its identity and centre while its current solid pose remains pickable', () => {
  const world = createCatalog({ budget: 'safe' });
  const comet = resolveCatalogTarget(world, 'Halley');
  const original = structuredClone(comet);
  const origin = comet.position.map((v,i) => v+(i===2 ? comet.radius*8 : 0));
  for (const time of [0, 10, 25, 100000]) {
    const pose = observingBody(comet, time);
    assert.equal(pose.id, comet.id);
    assert.equal(pose.position, comet.position);
    assert.equal(pose.axes, comet.axes);
    assert.equal(pose.radius, comet.radius);
    assert.ok(Number.isFinite(bodyRayIntersection(pose, origin, [0,0,-1])));
    const miss = origin.map((v,i) => v+(i===0 ? comet.radius*2 : 0));
    assert.equal(bodyRayIntersection(pose, miss, [0,0,-1]), Infinity);
    assert.deepEqual(observingBody(comet, time), pose);
  }
  assert.notEqual(observingBody(comet, 10).tilt, comet.tilt);
  assert.deepEqual(comet, original);
  assert.equal(observingBody(world.stars[0], 10), world.stars[0]);
});

test('finite orbital poses preserve catalog data, shared identity, nested motion and periodic paths', () => {
  const world = createCatalog({ catalog: 1000, budget: 'safe' });
  const original = structuredClone(world), motion = createBodyMotion(world);
  const start = motion.snapshot(0), later = motion.snapshot(14);
  for (const body of [world.stars[0], ...world.bodies]) assert.ok(start.has(body.id));
  const finiteParents = new Set(world.bodies.map(body => body.parentId).filter(id => id < world.count));
  assert.ok(start.size <= world.bodies.length + finiteParents.size + 1);
  for (const body of world.bodies) {
    const pose = later.get(body.id);
    assert.equal(pose.id, body.id); assert.equal(pose.radius, body.radius);
    assert.equal(pose.parentId, body.parentId);
    assert.ok(pose.position.every(Number.isFinite));
    for (let i=0; i<3; i++) assert.ok(Math.abs(start.get(body.id).position[i]-body.position[i])<1e-12);
    if (body.parentId!==undefined) {
      assert.notDeepEqual(pose.position, body.position);
      const path = motion.path(body.id, later);
      assert.ok(path.length > 2 && path.length <= 128);
      assert.ok(Math.hypot(...path[0].map((v,i)=>v-path.at(-1)[i]))<1e-12);
      const origin = pose.position.map((v,i)=>v+(i===2 ? body.radius*8 : 0));
      assert.ok(Number.isFinite(bodyRayIntersection(pose,origin,[0,0,-1])));
    } else assert.deepEqual(pose, body);
  }
  const earth=resolveCatalogTarget(world,'Earth'), moon=resolveCatalogTarget(world,'Moon');
  const relative=(poses,body)=>poses.get(body.id).position.map((v,i)=>v-poses.get(body.parentId).position[i]);
  assert.notDeepEqual(relative(start,moon),relative(later,moon));
  assert.notDeepEqual(later.get(earth.id).position,earth.position);
  const translatedPath=motion.path(moon.id,later)[0];
  for (let i=0;i<3;i++) assert.ok(Math.abs(translatedPath[i]-later.get(earth.id).position[i]-relative(start,moon)[i])<1e-12);
  for(const time of [1.3,250.7,100000]) {
    const poses=motion.snapshot(time);
    for(const body of [earth,moon]) {
      const parent=poses.get(body.parentId);
      const envelope=Math.max(...motion.path(body.id,poses).map(p=>Math.hypot(...p.map((v,i)=>v-parent.position[i]))));
      assert.ok(Math.hypot(...relative(poses,body))<=envelope+1e-12);
    }
  }
  const direction=body=>{
    const a=relative(start,body),b=relative(motion.snapshot(.1),body);
    return a[2]*b[0]-a[0]*b[2];
  };
  assert.ok(direction(earth)*direction(resolveCatalogTarget(world,'Halley'))<0);
  assert.deepEqual(motion.snapshot(14),later);
  for (const quality of ['standard','immersive','safe']) {
    setCatalogBudget(world,quality);
    assert.deepEqual(motion.snapshot(14),later);
  }
  assert.deepEqual(world.bodies,original.bodies); assert.deepEqual(world.stars,original.stars);
});

test('moving observation anchors preserve centred zoom and held navigation while tracking separate flight endpoints', () => {
  const world=createCatalog({ catalog:1000,budget:'safe' }), motion=createBodyMotion(world);
  const earth=resolveCatalogTarget(world,'Earth'), moon=resolveCatalogTarget(world,'Moon');
  const camera=createCamera(earth);
  const step=(time)=>{
    const poses=motion.snapshot(time);
    updateCameraAnchors(camera,{active:poses.get(camera.activeId),observed:poses.get(camera.observedId),departure:poses.get(camera.flight?.fromId)});
    updateCamera(camera,.1,time*1000);
    return poses;
  };
  for (const scale of [0,.25,.5,.75,1]) {
    setCameraScale(camera,scale);
    for(let i=0;i<250;i++) step(2+i*.1);
    const frame=cameraFrame(camera,16/9), pose=[frame.yaw,frame.pitch,frame.roll,frame.fov,camera.distance];
    for(let i=0;i<20;i++) {
      const poses=step(27+i*.1),next=cameraFrame(camera,16/9),point=projectPoint(poses.get(earth.id).position,next,1280,720);
      assert.deepEqual([next.yaw,next.pitch,next.roll,next.fov,camera.distance],pose);
      assert.ok(Math.abs(point.x-640)<1e-5 && Math.abs(point.y-360)<1e-5);
    }
  }
  focusCamera(camera,motion.snapshot(30).get(moon.id),30000);
  step(30.2); cancelCameraFlight(camera);
  const offset=camera.focus.map((v,i)=>v-camera.observedPosition[i]);
  const held=[camera.yaw,camera.pitch,camera.distance,camera.distanceTarget];
  for(let i=0;i<10;i++) {
    step(30.3+i*.1);
    assert.deepEqual([camera.yaw,camera.pitch,camera.distance,camera.distanceTarget],held);
    for(let j=0;j<3;j++)assert.ok(Math.abs(camera.focus[j]-camera.observedPosition[j]-offset[j])<1e-12);
  }
  focusCamera(camera,motion.snapshot(32).get(moon.id),32000);
  for(let i=0;i<50;i++)step(32+i*.1);
  assert.equal(camera.observedId,moon.id);assert.equal(camera.activeId,moon.id);
  const point=projectPoint(motion.snapshot(36.9).get(moon.id).position,cameraFrame(camera,16/9),1280,720);
  assert.ok(Math.abs(point.x-640)<1e-5 && Math.abs(point.y-360)<1e-5);
});

test('explicit moving lunar arrivals retain the parent reference and recalled camera directions', () => {
  const world=createCatalog({catalog:1000,budget:'safe'}), motion=createBodyMotion(world);
  const snapshot=time=>new Map([...motion.snapshot(time)].map(([id,body])=>[id,galacticFrame(time).body(body)]));
  const moon=resolveCatalogTarget(world,'Moon'), earth=resolveCatalogTarget(world,'Earth');
  for(const phase of [0,7.3,15.9,46.2,123.5,981.7]) {
    const poses=snapshot(phase),camera=createCamera(poses.get(earth.id));
    camera.distance=camera.distanceTarget=earth.radius*6;
    focusCamera(camera,poses.get(moon.id),0);
    let current=poses;
    for(let i=1;i<=150 && camera.flight;i++) {
      current=snapshot(phase+i*.1);
      updateCameraAnchors(camera,{active:current.get(camera.activeId),observed:current.get(camera.observedId),departure:current.get(camera.flight?.fromId)});
      updateCamera(camera,.1,i*100);
    }
    assert.equal(camera.observedId,moon.id);assert.equal(camera.flight,null);
    for(const [width,height] of [[1280,720],[390,844]]) {
      const parent=projectPoint(current.get(earth.id).position,cameraFrame(camera,width/height),width,height);
      assert.ok(parent.visible,'Moving lunar arrival lost Earth');
      const ray=current.get(earth.id).position.map((v,i)=>v-cameraFrame(camera).eye[i]);
      const length=Math.hypot(...ray),direction=ray.map(v=>v/length);
      assert.ok(bodyRayIntersection(current.get(moon.id),cameraFrame(camera).eye,direction)>=length,'Earth reference is hidden by the Moon');
    }
    const recalled={distance:moon.radius*6,yaw:7.4,pitch:.22,roll:.1};
    focusCamera(camera,current.get(moon.id),5000,recalled);
    for(let i=1;i<=35;i++) {
      current=snapshot(phase+5+i*.1);
      updateCameraAnchors(camera,{active:current.get(moon.id),observed:current.get(moon.id),departure:current.get(camera.flight?.fromId)});
      updateCamera(camera,.1,5000+i*100);
    }
    assert.equal(camera.yaw,recalled.yaw);assert.equal(camera.pitch,recalled.pitch);assert.equal(camera.roll,recalled.roll);
  }
});

test('galactic world and inverse camera projections agree while catalog and outside galaxies stay unchanged', () => {
  const world=createCatalog({catalog:1000,budget:'safe'}), original=structuredClone(world);
  const camera=createCamera(world.stars[4]), lens=cameraFrame(camera,16/9);
  const motion=createBodyMotion(world);
  for(const time of [0,2.3,61,9953,1e12]) {
    const space=galacticFrame(time), inverse=space.camera(lens), poses=motion.snapshot(time);
    assert.ok(space.angle>=0 && space.angle<Math.PI*2);
    for(const source of [...world.stars.slice(0,40),world.stars[512]]) {
      const body=space.body(source), roundtrip=space.toRest(body.position);
      assert.equal(body.id,source.id);assert.equal(body.radius,source.radius);assert.equal(body.seed,source.seed);
      assert.equal(body.position[1],source.position[1]);
      for(let i=0;i<3;i++)assert.ok(Math.abs(roundtrip[i]-source.position[i])<1e-10);
      const a=projectPoint(body.position,lens,1280,720),b=projectPoint(source.position,inverse,1280,720);
      for(const field of ['x','y','depth'])assert.ok(Math.abs(a[field]-b[field])<1e-6);
    }
    for(const body of world.bodies) {
      const local=poses.get(body.id),derived=space.body(local);
      if(body.kind==='galaxy' || body.spaceRegion==='outside-milky-way') { assert.equal(derived,local);continue; }
      if(body.parentId!==undefined) {
        const parent=space.body(poses.get(body.parentId));
        const expected=space.toWorld(local.position.map((v,i)=>v-poses.get(body.parentId).position[i]));
        for(let i=0;i<3;i++)assert.ok(Math.abs(derived.position[i]-parent.position[i]-expected[i])<1e-12);
      }
      if(local.arrivalView) {
        const eye=view=>[Math.sin(view.yaw)*Math.cos(view.pitch),Math.sin(view.pitch),Math.cos(view.yaw)*Math.cos(view.pitch)];
        const expected=space.toWorld(eye(local.arrivalView)),actual=eye(derived.arrivalView);
        for(let i=0;i<3;i++)assert.ok(Math.abs(expected[i]-actual[i])<1e-12);
      }
    }
  }
  assert.notDeepEqual(galacticFrame(2.3).body(world.stars[4]).position,world.stars[4].position);
  assert.deepEqual(world,original);
});

test('named and generated galactic stars keep centred zoom, a held lens and exact paused views', () => {
  const world=createCatalog({catalog:1000,budget:'safe'});
  for(const source of [world.stars[4],world.stars[512]]) for(const scale of [0,.25,.5,.75,1]) {
    const camera=createCamera(galacticFrame(1).body(source));
    setCameraScale(camera,scale);
    const step=time=>{
      const body=galacticFrame(time).body(source);
      updateCameraAnchors(camera,{active:body,observed:body});updateCamera(camera,.1,time*1000);
      return body;
    };
    for(let i=0;i<250;i++)step(1+i*.1);
    const frame=cameraFrame(camera,16/9), held=[frame.yaw,frame.pitch,frame.roll,frame.fov,camera.distance];
    for(let i=0;i<30;i++) {
      const body=step(26+i*.1),next=cameraFrame(camera,16/9),point=projectPoint(body.position,next,1280,720);
      assert.deepEqual([next.yaw,next.pitch,next.roll,next.fov,camera.distance],held);
      assert.ok(Math.abs(point.x-640)<1e-5 && Math.abs(point.y-360)<1e-5);
      assert.ok(Number.isFinite(bodyRayIntersection(body,next.eye,next.forward)));
    }
    const pausedTime=advanceSceneTime(28.9,.1,'paused'), before=cameraFrame(camera,16/9);
    for(let i=0;i<10;i++)step(pausedTime);
    assert.deepEqual(cameraFrame(camera,16/9),before);
  }
});

test('local family entries reveal sunlit worlds and contain whole orbits without idle refitting', () => {
  const world = createCatalog({ catalog: 1000, budget: 'safe' }), motion = createBodyMotion(world);
  const snapshot = time => { const space = galacticFrame(time); return new Map([...motion.snapshot(time)].map(([id, body]) => [id, space.body(body)])); };
  for (const name of ['Earth', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
    const source = resolveCatalogTarget(world, name), family = bodySystem(world, source.id, { local: true });
    for (const time of [0, 73, 264, 1121]) for (const [width, height, area] of [
      [1280, 720, { x: 390, y: 128, width: 820, height: 516 }],
      [390, 844, { x: 16, y: 128, width: 358, height: 260 }],
      [844, 390, { x: 330, y: 120, width: 450, height: 194 }]]) {
      const poses = snapshot(time), root = poses.get(source.id), space = galacticFrame(time);
      const camera = createCamera(root, { reducedMotion: true });
      const center = [(area.x + area.width / 2) / width, (area.y + area.height / 2) / height];
      const lens = cameraFrame(camera, width / height, center), local = motion.snapshot(time);
      const envelope = family.members.flatMap(body => body.id === root.id ? [root] :
        [poses.get(body.id), ...motion.path(body.id, local).map(point => ({ ...poses.get(body.id), position: space.toWorld(point) }))]);
      const sunlight = poses.get(0).position.map((value, i) => value - root.position[i]);
      const view = systemOverviewView(root, envelope, lens, width, height, area, { sweepYaw: true, sunlight });
      focusCamera(camera, root, 0, view);
      const entry = cameraFrame(camera, width / height, center), lightLength = Math.hypot(...sunlight);
      assert.ok(entry.forward.reduce((sum, value, i) => sum - value * sunlight[i] / lightLength, 0) > .5,
        `${name} entry reveals its day side`);
      if (root.rings) {
        const normal = [0, Math.cos(root.tilt), Math.sin(root.tilt)];
        assert.ok(Math.abs(entry.forward.reduce((sum, value, i) => sum + value * normal[i], 0)) > .35,
          'the shared view reveals the ring plane');
      }
      const held = [entry.yaw, entry.pitch, entry.roll, entry.fov, camera.distance];
      for (const phase of [0, 7, 14, 21, 28, 91, 230, 599, 1490]) {
        const current = snapshot(phase);
        updateCameraAnchors(camera, { active: current.get(root.id), observed: current.get(root.id) });
        updateCamera(camera, .1, phase * 1000);
        const frame = cameraFrame(camera, width / height, center);
        assert.deepEqual([frame.yaw, frame.pitch, frame.roll, frame.fov, camera.distance], held);
        for (const member of family.members) {
          const body = current.get(member.id), point = projectPoint(body.position, frame, width, height);
          const distance = Math.hypot(...body.position.map((value, i) => value - frame.eye[i]));
          const extent = body.radius * Math.max(1, body.rings?.outer || 1, ...(body.axes || []));
          const radius = height / (2 * Math.tan(frame.fov / 2)) * extent / Math.sqrt(distance ** 2 - extent ** 2);
          assert.ok(point.x - radius >= area.x && point.x + radius <= area.x + area.width, `${name} member fits horizontally`);
          assert.ok(point.y - radius >= area.y && point.y + radius <= area.y + area.height, `${name} member fits vertically`);
          if (member.id === root.id) {
            assert.ok(Math.abs(point.x - center[0] * width) < 1e-6);
            assert.ok(Math.abs(point.y - center[1] * height) < 1e-6);
          }
        }
      }
      assert.equal(camera.activeId, root.id);
    }
  }
});

test('explicit transfers keep parent clearance through departure, shared space and arrival', () => {
  const world = createCatalog({ catalog: 1000, budget: 'safe' }), motion = createBodyMotion(world);
  const snapshot = time => { const space = galacticFrame(time); return new Map([...motion.snapshot(time)].map(([id, body]) => [id, space.body(body)])); };
  const extent = body => body.radius * Math.max(1, body.rings?.outer || 1, ...(body.axes || []));
  const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
  const familyView = (root, poses) => {
    const members = bodySystem(world, root.id, { local: true }).members.map(body => poses.get(body.id));
    return systemOverviewView(root, members, cameraFrame(createCamera(root), 16/9), 1280, 720, null,
      { sunlight: poses.get(0).position.map((value, i) => value - root.position[i]) });
  };
  for (const [fromName, toName, shared] of [['Earth','Moon'], ['Moon','Earth',true], ['Jupiter','Europa'], ['Europa','Jupiter',true],
    ['Uranus','Miranda'], ['Miranda','Uranus',true], ['Saturn','Iapetus'], ['Iapetus','Saturn',true], ['Europa','Io'], ['Saturn','Mimas'], ['Mimas','Saturn',true], ['Mimas','Enceladus'], ['Neptune','Triton'], ['Triton','Neptune',true],
    ['Mercury','Venus'], ['Europa','Mimas'], ['Halley','Sol'], ['Pluto','Charon'], ['Charon','Pluto',true]]) {
    for (const start of [0, 7.3, 46.2, 264]) for (const rate of [0, 1, 4]) {
      let poses = snapshot(start);
      const fromId = resolveCatalogTarget(world, fromName).id, toId = resolveCatalogTarget(world, toName).id;
      const source = poses.get(fromId), target = poses.get(toId);
      const camera = createCamera(source, { reducedMotion: true });
      focusCamera(camera, source, 0, ['Earth','Jupiter','Saturn','Uranus','Neptune','Pluto'].includes(fromName) ? familyView(source, poses) : null);
      setReducedMotion(camera, false);
      const held = { yaw: camera.yaw, pitch: camera.pitch, distance: camera.distance };
      const recalled = shared ? familyView(target, poses) : null;
      focusCamera(camera, target, 0, recalled, { departureParent: poses.get(source.parentId), arrivalParent: poses.get(target.parentId) });
      let lastDirection = cameraFrame(camera).forward, steps = 0;
      while (camera.flight) {
        const seconds = ++steps / 30; assert.ok(steps < 1200, 'navigation must finish');
        poses = snapshot(start + seconds * rate);
        const from = poses.get(fromId), to = poses.get(toId);
        updateCameraAnchors(camera, { active: to, observed: poses.get(camera.observedId), departure: from,
          departureParent: poses.get(from.parentId), arrivalParent: poses.get(to.parentId) });
        updateCamera(camera, 1/30, seconds * 1000);
        const frame = cameraFrame(camera, 16/9);
        assert.ok([...frame.eye, ...frame.forward, camera.distance].every(Number.isFinite));
        assert.ok(frame.forward.reduce((sum, value, i) => sum + value * lastDirection[i], 0) > .98, `${fromName} to ${toName}, phase ${start}, rate ${rate}, step ${steps}: heading stays continuous (${frame.forward.reduce((sum, value, i) => sum + value * lastDirection[i], 0)})`);
        lastDirection = frame.forward;
        const destination = createCamera(to, { reducedMotion: true }); focusCamera(destination, to, 0, recalled);
        const sourceEye = from.position.map((value, i) => value + held.distance *
          [Math.sin(held.yaw)*Math.cos(held.pitch), Math.sin(held.pitch), Math.cos(held.yaw)*Math.cos(held.pitch)][i]);
        for (const parentId of new Set([from.parentId, to.parentId].filter(id => id !== undefined))) {
          const parent = poses.get(parentId), clearance = distance(frame.eye, parent.position);
          assert.ok(clearance > extent(parent), `${fromName} to ${toName} must stay outside parent ${parentId}`);
          const endpointClearance = Math.min(distance(sourceEye, parent.position), distance(cameraFrame(destination).eye, parent.position));
          const bearing = parent.position.reduce((sum, value, i) => sum + (value-frame.eye[i])*frame.forward[i]/clearance, 0);
          const diagonalHalfAngle = Math.atan(Math.tan(frame.fov/2)*Math.hypot(1,frame.aspect));
          assert.ok(bearing < Math.cos(diagonalHalfAngle) || clearance >= Math.min(endpointClearance * .85, extent(parent) * 20),
            `${fromName} to ${toName}, parent ${parentId}, phase ${start}, rate ${rate}, step ${steps}: a close parent crosses the view`);
        }
      }
      assert.equal(camera.observedId, toId); assert.equal(camera.activeId, toId);
      assert.deepEqual(camera.focus, poses.get(toId).position);
      const view = recalled || poses.get(toId).arrivalView;
      if (view) { assert.equal(camera.yaw, view.yaw); assert.equal(camera.pitch, view.pitch); }
      const returnedDirection = [camera.yaw, camera.pitch, camera.roll], parentId = poses.get(toId).parentId;
      const arrivalTime = steps / 30;
      resetCamera(camera, poses.get(toId), camera.now, { departureParent: poses.get(parentId) });
      for (let returnStep = 1; camera.flight; returnStep++) {
        assert.ok(returnStep < 1200);
        const seconds = arrivalTime + returnStep / 30; poses = snapshot(start + seconds * rate);
        updateCameraAnchors(camera, { active: poses.get(toId), observed: poses.get(toId), departure: poses.get(toId), departureParent: poses.get(parentId) });
        updateCamera(camera, 1/30, seconds * 1000);
        const parent = poses.get(parentId);
        if (parent) assert.ok(distance(cameraFrame(camera).eye, parent.position) > extent(parent), 'direct return stays outside the moving parent');
      }
      assert.equal(camera.distance, createCamera(poses.get(toId)).distance);
      assert.deepEqual([camera.yaw,camera.pitch,camera.roll], returnedDirection);
    }
  }
});

test('parent-aware navigation preserves stopped views, direct zoom, reduced motion and full return', () => {
  const world = createCatalog({ catalog: 1000, budget: 'safe' }), poses = createBodyMotion(world).snapshot(0);
  const moon = resolveCatalogTarget(world, 'Mimas'), parent = poses.get(moon.parentId), target = poses.get(moon.id);
  const camera = createCamera(target, { reducedMotion: true }); focusCamera(camera, target); setReducedMotion(camera, false);
  // A close observation can face directly toward its parent. Retreat must turn first.
  const offset = parent.position.map((value, i) => value - target.position[i]);
  camera.yaw = Math.atan2(offset[0], offset[2]); camera.pitch = Math.asin(offset[1]/Math.hypot(...offset));
  const original = [camera.yaw, camera.pitch, camera.roll, cameraFrame(camera).fov];
  resetCamera(camera, target, 0, { departureParent: parent });
  for (let step = 0; camera.flight; step++) {
    assert.ok(step < 1200); updateCamera(camera, 1/30, step*1000/30);
    assert.ok(Math.hypot(...cameraFrame(camera).eye.map((value, i) => value - parent.position[i])) > parent.radius*parent.rings.outer);
  }
  assert.equal(camera.distance, createCamera(target).distance); assert.deepEqual([camera.yaw,camera.pitch,camera.roll,cameraFrame(camera).fov], original);
  focusCamera(camera, target, camera.now, null, { departureParent: parent, arrivalParent: parent });
  updateCamera(camera, .1, camera.now + 1800); cancelCameraFlight(camera);
  const stopped = structuredClone(cameraFrame(camera)), intended = camera.activeId;
  for (let step = 0; step < 10; step++) updateCamera(camera, .1, camera.now + 100);
  assert.deepEqual(cameraFrame(camera), stopped); assert.equal(camera.activeId, intended);
  zoomCamera(camera, -100); updateCamera(camera, .1, camera.now + 100);
  assert.deepEqual([camera.yaw,camera.pitch,camera.roll,cameraFrame(camera).fov], [stopped.yaw,stopped.pitch,stopped.roll,stopped.fov]);
  focusCamera(camera, target, camera.now, null, { departureParent: parent, arrivalParent: parent });
  setReducedMotion(camera, true); updateCamera(camera, .1, camera.now + 100);
  assert.equal(camera.flight, null); assert.equal(camera.observedId, target.id); assert.deepEqual(camera.focus, target.position);
  const arrived = [camera.yaw,camera.pitch,camera.roll,camera.distance];
  updateCameraAnchors(camera,{active:target,observed:target,departureParent:parent,arrivalParent:parent}); updateCamera(camera,.1,camera.now+100);
  assert.deepEqual([camera.yaw,camera.pitch,camera.roll,camera.distance],arrived);
  setReducedMotion(camera, false); camera.yaw = .8; camera.pitch = .7;
  const returnView = [camera.yaw, camera.pitch, camera.roll];
  resetCamera(camera, target, camera.now, { departureParent: parent }); updateCamera(camera,.1,camera.now+200);
  setReducedMotion(camera, true); updateCamera(camera,.1,camera.now+100);
  assert.equal(camera.flight,null); assert.equal(camera.distance,createCamera(target).distance);
  assert.deepEqual([camera.yaw,camera.pitch,camera.roll],returnView);
});

test('family overview contains orbital motion at every galactic angle without idle refitting', () => {
  const world=createCatalog({catalog:1000,budget:'safe'}),motion=createBodyMotion(world);
  const snapshot=time=>{const space=galacticFrame(time);return new Map([...motion.snapshot(time)].map(([id,body])=>[id,space.body(body)]));};
  for (const options of [{}, { region: 'inner' }]) {
  const memberIds=bodySystem(world,0,options).members.map(body=>body.id);
  for(const [width,height,area] of [[1280,720,{x:390,y:128,width:820,height:516}],[390,844,{x:16,y:128,width:358,height:260}],[844,390,{x:330,y:120,width:450,height:194}]]) {
    const start=13,poses=snapshot(start),root=poses.get(0),space=galacticFrame(start);
    const camera=createCamera(root,{reducedMotion:true});
    const center=[(area.x+area.width/2)/width,(area.y+area.height/2)/height];
    const lens=cameraFrame(camera,width/height,center),local=motion.snapshot(start);
    const envelope=memberIds.flatMap(id=>[poses.get(id),...motion.path(id,local).map(point=>({...poses.get(id),position:space.toWorld(point)}))]);
    const view=systemOverviewView(root,envelope,lens,width,height,area,{sweepYaw:true});
    focusCamera(camera,root,0,view);
    for(const time of [0,7.3,30,90,230,599,1490]) {
      const current=snapshot(time);
      updateCameraAnchors(camera,{active:current.get(0),observed:current.get(0)});updateCamera(camera,.1,time*1000);
      const frame=cameraFrame(camera,width/height,center);
      assert.equal(frame.yaw,view.yaw);assert.equal(frame.pitch,view.pitch);assert.equal(camera.distance,view.distance);
      for(const id of memberIds) {
        const body=current.get(id),point=projectPoint(body.position,frame,width,height);
        const extent=body.radius*Math.max(1,body.rings?.outer||1,...(body.axes||[]));
        const distance=Math.hypot(...body.position.map((v,i)=>v-frame.eye[i]));
        const radius=height/(2*Math.tan(frame.fov/2))*extent/Math.sqrt(distance**2-extent**2);
        assert.ok(point.x-radius>=area.x && point.x+radius<=area.x+area.width,`Family ${id} lost horizontally`);
        assert.ok(point.y-radius>=area.y && point.y+radius<=area.y+area.height,`Family ${id} lost vertically`);
      }
    }
  }
  }
});


test('mapped small-world activity retains immutable data and the same paused solid pose', () => {
  const world=createCatalog(),original=structuredClone(world.bodies),motion=createBodyMotion(world);
  for(const name of ['Ceres','Vesta','Phobos','Deimos','Miranda','Iapetus']) {
    const body=resolveCatalogTarget(world,name);
    for(const time of [0,24,91,336]) {
      const pose=motion.snapshot(time).get(body.id);
      assert.deepEqual(pose,motion.snapshot(advanceSceneTime(time,.1,'paused')).get(body.id));
      assert.ok(motion.path(body.id,motion.snapshot(time)).every(p=>p.every(Number.isFinite)));
      if(name==='Vesta')assert.equal(pose.spin,time*.041);
      else if(body.axes)assert.ok(Number.isFinite(pose.spin));
    }
    assert.notDeepEqual(motion.snapshot(24).get(body.id).position,body.position);
  }
  assert.deepEqual(world.bodies,original);
});

test('explicit sunlit recovery preserves the held lens and distance for every reflective world', async () => {
  const { sunlitObservationView } = await import('../assets/observatory-framing.js');
  const { turnCamera } = await import('../assets/observatory-camera.js');
  const world = createCatalog({budget:'safe'}), original=structuredClone(world.bodies), motion=createBodyMotion(world);
  const reflective=world.bodies.filter(body=>['planet','moon','dwarfplanet','asteroid'].includes(body.kind));
  for (const time of [0,73,264,1121]) for (const source of reflective) {
    const galaxy=galacticFrame(time), poses=motion.snapshot(time), body=galaxy.body(poses.get(source.id)), sun=galaxy.body(poses.get(0));
    const light=sun.position.map((v,i)=>v-body.position[i]), length=Math.hypot(...light);
    const camera=createCamera(body,{reducedMotion:true});
    focusCamera(camera,body,0,{distance:body.radius*6.8,yaw:Math.atan2(light[0],light[2])+Math.PI,pitch:0,roll:.31});
    if(time===0){setCameraScale(camera,1);updateCamera(camera,1/60,20);}
    const held=cameraFrame(camera,16/9), distance=camera.distance;
    const view=sunlitObservationView(body,sun,{distance,roll:camera.roll});
    for (const reduced of [false,true]) {
      setReducedMotion(camera,reduced);assert.equal(turnCamera(camera,body,view,100),true);
      for (let i=1;i<=180;i++) {
        updateCamera(camera,1/60,100+i*1000/60);
        assert.equal(camera.distance,distance);assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
        assert.equal(cameraFrame(camera,16/9).fov,held.fov);assert.equal(camera.roll,held.roll);
      }
      const frame=cameraFrame(camera,16/9), eye=frame.eye.map((v,i)=>(v-body.position[i])/distance);
      assert.ok(eye.reduce((sum,v,i)=>sum+v*light[i]/length,0)>.75,source.name+' reveals its current day side');
      const yaw=camera.yaw,pitch=camera.pitch;
      const later=galaxy.body(motion.snapshot(time+50).get(source.id));
      updateCameraAnchors(camera,{active:later,observed:later});updateCamera(camera,1/60,4200);
      assert.equal(camera.yaw,yaw);assert.equal(camera.pitch,pitch);assert.equal(camera.distance,distance);
      // Reset the fixed case pose for the second mode, without recording a new identity.
      updateCameraAnchors(camera,{active:body,observed:body});updateCamera(camera,1/60,4300);
    }
  }
  assert.deepEqual(world.bodies,original);
  for(const body of world.bodies.filter(body=>!reflective.includes(body)))
    assert.equal(sunlitObservationView(body,world.stars[0],{distance:1,roll:0}),null);
});

test('sunlit turns can be stopped, manually taken over or reduced without a navigation reset', async () => {
  const { sunlitObservationView } = await import('../assets/observatory-framing.js');
  const { turnCamera, orbitCamera } = await import('../assets/observatory-camera.js');
  const world=createCatalog({budget:'safe'}), poses=createBodyMotion(world).snapshot(73), body=poses.get(resolveCatalogTarget(world,'Ceres').id);
  const sun=poses.get(0), view=sunlitObservationView(body,sun,{distance:body.radius*5,roll:.2});
  for (const action of ['stop','orbit','reduce']) {
    const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body,0,{...view,yaw:view.yaw+Math.PI});setReducedMotion(camera,false);
    assert.ok(turnCamera(camera,body,view,100));updateCamera(camera,.3,500);
    const distance=camera.distance,yaw=camera.yaw,pitch=camera.pitch;
    if(action==='stop')cancelCameraFlight(camera);
    if(action==='orbit')orbitCamera(camera,22,0);
    if(action==='reduce')setReducedMotion(camera,true);
    updateCamera(camera,1/60,520);
    assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);assert.equal(camera.distance,distance);
    if(action==='stop'){assert.equal(camera.yaw,yaw);assert.equal(camera.pitch,pitch);}
    if(action==='orbit')assert.notEqual(camera.yaw,yaw);
    if(action==='reduce'){assert.equal(camera.flight,null);assert.equal(camera.yaw,view.yaw);assert.equal(camera.pitch,view.pitch);}
  }
});

test('the asteroid moon follows its moving parent without mutating source identities', () => {
  const world=createCatalog(),ida=resolveCatalogTarget(world,'Ida'),dactyl=resolveCatalogTarget(world,'Dactyl');
  const source=structuredClone([ida,dactyl]),motion=createBodyMotion(world);
  const first=motion.snapshot(0),path=motion.path(dactyl.id,first);
  const span=Math.max(...path.map(p=>Math.hypot(...p.map((v,i)=>v-ida.position[i]))));
  let moved=false;
  for(const time of [0,8,30,80,240]) {
    const poses=motion.snapshot(time),parent=poses.get(ida.id),child=poses.get(dactyl.id);
    const separation=Math.hypot(...child.position.map((v,i)=>v-parent.position[i]));
    assert.ok(separation>ida.radius*Math.max(...ida.axes)+dactyl.radius*Math.max(...dactyl.axes));
    assert.ok(separation<=span+1e-12);
    assert.equal(child.parentId,parent.id);
    assert.deepEqual(motion.snapshot(time).get(dactyl.id),child);
    moved ||= Math.hypot(...parent.position.map((v,i)=>v-ida.position[i]))>ida.radius;
  }
  assert.ok(moved);assert.deepEqual([ida,dactyl],source);
});

test('exoplanet families orbit their own hosts without changing the Solar family or source catalog', () => {
  const world=createCatalog({budget:'safe'}), original=structuredClone(world.bodies);
  const solarIds=bodySystem(world,0).members.map(body=>body.id);
  assert.equal(world.planets.length,8);assert.equal(world.exoplanets.filter(body=>body.id<=50143).length,9);
  const motion=createBodyMotion(world,{compactStellarFamilies:true});
  for(const [name,count] of [['Proxima Centauri',2],['TRAPPIST-1',8],['51 Pegasi',2],...world.planetaryHosts.filter(host=>host.id>=50144 && host.id<50160).map(host=>[host.name,2]),['HR 8799',5],['Beta Pictoris',4],['PDS 70',3],['Kepler-51',5]]) {
    const host=resolveCatalogTarget(world,name),family=bodySystem(world,host.id);
    assert.equal(family.root.id,host.id);assert.equal(family.members.length,count);
    assert.ok(family.members.every(body=>!solarIds.includes(body.id)));
    const members=family.members.filter(body=>body.id!==host.id);
    let moved=false;
    for(const body of members) {
      assert.equal(body.kind,'planet');assert.equal(bodySystem(world,body.id).root.id,host.id);
      const initialRadius=Math.hypot(...body.position.map((v,i)=>v-host.position[i]));
      assert.ok(motion.path(body.id,motion.snapshot(0)).length>2);
      for(const time of [0,23,89,301]) {
        const poses=motion.snapshot(time),current=poses.get(body.id),parent=poses.get(host.id);
        assert.deepEqual(parent.position,host.position);
        const radius=Math.hypot(...current.position.map((v,i)=>v-parent.position[i]));
        assert.ok(radius>host.radius+body.radius);
        assert.ok(Math.abs(radius-initialRadius)<1e-11);
        moved ||= Math.hypot(...current.position.map((v,i)=>v-body.position[i]))>body.radius;
      }
    }
    assert.ok(moved);
  }
  assert.deepEqual(world.bodies,original);
});
