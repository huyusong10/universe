import test from 'node:test';
import assert from 'node:assert/strict';
import { readingLensScale, systemOverviewView, labelClearsSubject, labelClearsPanels, destinationDirection, destinationInView, locatingPanelPlacement } from '../assets/observatory-framing.js';
import { isVolumeBody, hasVolumeBody, spaceSatelliteFamily, localInspectionRange, pointSourceCoverage } from '../assets/observatory-bodies.js';

import { galacticInteriorPresence } from '../assets/observatory-galactic-material.js';
import { GALAXY_EXPLORATIONS } from '../assets/observatory-galaxies.js';
import {galaxyObservationRegions,galaxyRegionPosition,galaxyWorldVector,galaxyLocalVector} from '../assets/observatory-galaxy-layout.js';
import {inspectCameraPoint,updateCameraAnchors,enterNebula} from '../assets/observatory-camera.js';
import {
  createCatalog, setCatalogBudget, setObservedGalaxy, createCamera, updateCamera, orbitCamera, zoomCamera,
  focusCamera, resetCamera, cancelCameraFlight, setReducedMotion, cameraFrame, projectPoint, screenRay, scaleState, environmentState,
  findCatalogTarget, catalogBody, resolveCatalogTarget, bodyRayIntersection, bodyRayCaster, bodyRelations, bodySystem, namedDestinations,
  setCameraScale, scaleStops, bodyDrawLayers, bodyScreenBounds,
} from '../assets/observatory-model.js';

test('screen discovery distinguishes visible, hidden, unresolved and offscreen destinations without inventing sky coordinates', () => {
  const w=900,h=600,point={x:450,y:300,depth:20},panels=[{x:700,y:0,width:200,height:600}];
  assert.equal(destinationDirection(point,w,h,panels),'visible');
  for (const direction of ['visible','covered']) assert.equal(destinationInView(direction),true);
  for (const direction of ['behind','left','right','up-left','occluded','unresolved',undefined]) assert.equal(destinationInView(direction),false);
  assert.equal(destinationDirection({...point,x:800},w,h,panels),'covered');
  assert.equal(destinationDirection(point,w,h,panels,true,true),'occluded');
  assert.equal(destinationDirection(point,w,h,panels,false),'unresolved');
  for(const [x,y,direction]of[[-10,300,'left'],[910,300,'right'],[450,-10,'up'],[450,610,'down'],[-10,-10,'up-left'],[910,610,'down-right']]) {
    assert.equal(destinationDirection({x,y,depth:20},w,h,panels),direction);
    assert.equal(destinationDirection({x,y,depth:-20},w,h,panels),'behind');
  }
  assert.equal(destinationDirection({...point,depth:NaN},w,h),'unresolved');
  assert.equal(labelClearsPanels({x:680,y:30,w:80,h:20},panels),false);
  assert.equal(labelClearsPanels({x:600,y:30,w:80,h:20},panels),true);
  assert.equal(labelClearsPanels({x:680,y:30,w:80,h:20},[]),true);
});

test('temporary location controls preserve available space and clear the located scene point without moving a valid panel',()=>{
  for(const [width,height,panel,top,bottom]of[[1440,900,{width:620,height:76},130,770],[320,568,{width:288,height:122},210,420]]) {
    for(const point of [{x:width/2,y:height*.69,radius:14},{x:width/2,y:top+20,radius:14},null]) {
      const place=locatingPanelPlacement(width,height,panel,top,bottom,point);
      assert.ok(place.x>=16 && place.x+panel.width<=width-16);
      assert.ok(place.y>=16 && place.y+panel.height<=bottom);
      if(point) {
        const distance=Math.hypot(point.x-Math.max(place.x,Math.min(point.x,place.x+panel.width)),point.y-Math.max(place.y,Math.min(point.y,place.y+panel.height)));
        assert.ok(distance>=point.radius+12,'available placement keeps the target and locator clear');
      }
      assert.deepEqual(locatingPanelPlacement(width,height,panel,top,bottom,point,place),place,'a valid placement remains stable');
    }
  }
});

test('unresolved reflected worlds and diffuse clouds lose area without dimming stellar source points', () => {
  for (const kind of ['planet', 'moon', 'dwarfplanet', 'asteroid', 'nebula']) {
    const samples = [0, .01, .03, .1, .3, 1, 4].map(radius => pointSourceCoverage({ kind }, radius));
    assert.equal(samples[0], 0);
    assert.ok(samples[2] < samples[3] && samples[3] < samples[4]);
    assert.ok(samples.every((value, i) => value >= 0 && value <= 1 && (!i || value >= samples[i - 1])));
    assert.equal(samples.at(-1), 1);
  }
  for (const kind of ['star', 'pulsar', 'blackhole', 'galaxy', 'comet']) {
    assert.equal(pointSourceCoverage({ kind }, .001), 1);
  }
});

const catalog = createCatalog({ seed: 728281, budget: 'safe' });
const sol = catalog.stars.find((star) => star.name === 'Sol');
const stages = ['Galactic', 'Regional', 'LocalMap', 'LocalSystem', 'Surface'];

test('each galaxy has one reciprocal spatial frame for samples, regions and readable arrival',()=>{
  const original=structuredClone(catalog.galaxies),normals=[];
  const near=(a,b)=>assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-10);
  for(const body of catalog.galaxies) {
    assert.equal(body.orientation.length,4);assert.ok(Math.abs(Math.hypot(...body.orientation)-1)<1e-12);
    normals.push(galaxyWorldVector(body,[0,1,0]));
    for(const time of [0,37,200]) for(const point of [[0,1,0],[1.4,.25,-.8],[-.5,-.9,.6]]) {
      const world=galaxyWorldVector(body,point,time);
      near(galaxyLocalVector(body,world,time),point);
      assert.ok(Math.abs(Math.hypot(...world)-Math.hypot(...point))<1e-12);
      near(galaxyRegionPosition(body,{point},time),world.map((v,i)=>body.position[i]+v*body.radius));
    }
    const camera=createCamera(sol,{reducedMotion:true});focusCamera(camera,body);
    const frame=cameraFrame(camera);
    assert.ok(Math.abs(frame.pitch-body.arrivalView.pitch)<1e-12,'recommended pose remains within user orbit limits');
    assert.ok(frame.up.every(Number.isFinite) && frame.right.every(Number.isFinite));
    assert.equal(camera.observedId,body.id);
  }
  assert.ok(normals.some(n=>Math.abs(n.reduce((sum,v,i)=>sum+v*normals[0][i],0))<1-1e-9),'galaxies do not all share a parallel disk frame');
  assert.deepEqual(catalog.galaxies,original);
});

test('recommended arrival takes a short roll across the angular seam',()=>{
  const body={...sol,id:50005,kind:'galaxy',radius:.1,arrivalView:{yaw:0,pitch:.1,roll:-3}};
  const camera=createCamera(sol);camera.yaw=0;camera.pitch=.1;camera.roll=3;
  const up=cameraFrame(camera).up;focusCamera(camera,body,0);
  for(let now=16;now<10000;now+=16) {
    updateCamera(camera,.016,now);
    assert.ok(cameraFrame(camera).up.reduce((sum,v,i)=>sum+v*up[i],0)>.9,'the camera does not make a full turn');
    if(!camera.flight)break;
  }
  assert.equal(camera.observedId,body.id);assert.equal(camera.roll,body.arrivalView.roll);
});

test('galaxy regions are reachable within the same identity, lens and bounded structure',()=>{
  for(const body of catalog.galaxies) {
    const original=structuredClone(body), regions=galaxyObservationRegions(body);
    assert.ok(regions.length>=2 && regions.length<=4);
    assert.equal(new Set(regions.map(r=>r.key)).size,regions.length);
    if(body.material==='barred') for(const key of ['arm','outer-arm','inner-arm','bar']) assert.ok(regions.some(region=>region.key===key),'barred navigation retains existing region identities and exposes the stellar bar');
    if(body.material==='needle') assert.deepEqual(regions.map(region=>region.key),['arm','outer-arm','inner-arm'],'disc labels preserve existing saved region keys');
    for(const region of regions) {
      const position=galaxyRegionPosition(body,region,37);
      assert.ok(position.every(Number.isFinite));
      assert.ok(Math.hypot(...position.map((v,i)=>v-body.position[i]))<=body.radius*body.extent);
      const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);
      const whole=cameraFrame(camera);
      assert.ok(inspectCameraPoint(camera,body,{key:region.key,position,distance:body.radius*region.distance}));
      const frame=cameraFrame(camera), projected=projectPoint(position,frame,1280,720);
      assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
      assert.ok(Math.abs(projected.x-640)<1e-6 && Math.abs(projected.y-360)<1e-6);
      for(const k of ['yaw','pitch','roll','fov']) assert.equal(frame[k],whole[k]);
      const moved=galaxyRegionPosition(body,region,49);
      updateCameraAnchors(camera,{active:body,observed:body,observationPoint:{key:region.key,position:moved}});
      assert.ok(Math.hypot(...cameraFrame(camera).focus.map((v,i)=>v-moved[i]))<1e-12);
      assert.ok(inspectCameraPoint(camera,body,null));
      assert.deepEqual(cameraFrame(camera).focus,body.position);assert.equal(camera.observationPoint,null);
    }
    assert.deepEqual(body,original);
  }
  assert.deepEqual(galaxyObservationRegions(sol),[]);
});

test('region travel exposes intermediate space, can stop and orbit, and returns to the same galaxy',()=>{
  const body=catalog.galaxies.find(b=>b.material==='hoag');const region=galaxyObservationRegions(body)[0];
  const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);setReducedMotion(camera,false);
  const position=galaxyRegionPosition(body,region,0), start=cameraFrame(camera);
  inspectCameraPoint(camera,body,{key:region.key,position,distance:body.radius*region.distance},0);
  for(let now=16;now<650;now+=16) updateCamera(camera,.016,now);
  const moving=cameraFrame(camera);assert.notDeepEqual(moving.focus,start.focus);assert.notDeepEqual(moving.focus,position);
  assert.equal(moving.yaw,start.yaw);assert.equal(moving.fov,start.fov);
  cancelCameraFlight(camera);const stopped=cameraFrame(camera);updateCamera(camera,.016,1800);
  assert.deepEqual(cameraFrame(camera).focus,stopped.focus);assert.equal(camera.distance,stopped.distance);
  orbitCamera(camera,30,0);assert.notEqual(cameraFrame(camera).yaw,stopped.yaw);assert.equal(camera.observedId,body.id);
  setReducedMotion(camera,true);inspectCameraPoint(camera,body,{key:region.key,position,distance:body.radius*region.distance});
  zoomCamera(camera,-100);updateCamera(camera,.016,1900);assert.deepEqual(cameraFrame(camera).focus,position);
  zoomCamera(camera,1500);updateCamera(camera,.016,1950);
  assert.ok(camera.distance>body.radius*8);assert.deepEqual(cameraFrame(camera).focus,position);
  assert.equal(camera.observationPoint.key,region.key,'ordinary retreat preserves the chosen observation centre');
  setCameraScale(camera,0);updateCamera(camera,.016,2000);assert.equal(camera.observationPoint,null);
  resetCamera(camera,body);assert.equal(camera.observedId,body.id);assert.deepEqual(cameraFrame(camera).focus,body.position);
  assert.equal(inspectCameraPoint(camera,sol,{key:'invalid',position,distance:1}),false);
});

test('selected exoplanets retain discoverable host families and two reachable observation scales across quality budgets', async () => {
  const names=['55 Cancri e','LHS 3844 b','Kepler-10 b','HD 189733 b','HD 209458 b','WASP-39 b','WASP-121 b','GJ 1214 b','HR 8799 b','HR 8799 c','HR 8799 d','HR 8799 e','Beta Pictoris b','Beta Pictoris c','Beta Pictoris d','PDS 70 b','PDS 70 c','Kepler-51 b','Kepler-51 c','Kepler-51 d','Kepler-51 e'];
  const {illuminatingStar}=await import('../assets/observatory-bodies.js');
  const worlds=['safe','standard','immersive'].map(budget=>createCatalog({budget}));
  for(const name of names) {
    const body=resolveCatalogTarget(worlds[0],name);
    assert.equal(body.kind,'planet');
    for(const world of worlds) {
      assert.deepEqual(resolveCatalogTarget(world,name),body);
      const host=illuminatingStar(body,id=>catalogBody(world,id));
      assert.equal(host.id,body.parentId);assert.equal(host.kind,'star');assert.notEqual(host.id,0);
      const family=bodySystem(world,body.id);
      assert.equal(family.root.id,host.id);assert.ok(family.members.some(b=>b.id===body.id));
      assert.ok(namedDestinations(world).some(b=>b.id===body.id));
      const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
      const whole=camera.distance;setCameraScale(camera,1);advance(camera,5);
      assert.ok(camera.distance<whole && camera.distance>body.radius);assert.equal(camera.observedId,body.id);
      resetCamera(camera,body);arrive(camera);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
      assert.ok(world.bodies.length+world.drawIndices.length<=world.budget.draw);
    }
  }
  assert.equal(new Set(names.map(n=>resolveCatalogTarget(worlds[0],n).id)).size,names.length);
});

test('young planetary families remain coherent, discoverable and cloud-observable', async () => {
  const {describeTarget,searchDestinations,TARGET_NOTES}=await import('../assets/observatory-guide.js');
  const world=createCatalog({budget:'safe'});
  for(const [hostName,members] of [['HR 8799',['HR 8799 b','HR 8799 c','HR 8799 d','HR 8799 e']],['Beta Pictoris',['Beta Pictoris b','Beta Pictoris c','Beta Pictoris d']],['PDS 70',['PDS 70 b','PDS 70 c']],['Kepler-51',['Kepler-51 b','Kepler-51 c','Kepler-51 d','Kepler-51 e']]]) {
    const host=resolveCatalogTarget(world,hostName),system=bodySystem(world,host.id);
    assert.equal(host.kind,'star');
    for(const name of members) {
      const body=resolveCatalogTarget(world,name),range=localInspectionRange(body);
      assert.equal(body.parentId,host.id);assert.ok(system.members.some(member=>member.id===body.id));
      assert.equal(range.kind,'cloud');assert.ok(range.minimum<range.whole);
      for(const alias of body.aliases)assert.equal(resolveCatalogTarget(world,alias).id,body.id);
      const note=TARGET_NOTES.find(note=>note.target===name);
      assert.ok(members.includes(note.nextTarget));assert.ok(new URL(note.sourceUrl).protocol==='https:');
      for(const language of ['en','zh']) {
        const description=describeTarget(name,language);
        for(const field of ['name','story','observation','representationNote'])assert.ok(description[field]?.length>0);
        assert.ok(searchDestinations(TARGET_NOTES,body.aliases[0]).some(note=>note.target===name));
      }
    }
  }
});

test('compact transit families preserve member identity, local inspection and sibling discovery', async () => {
  const {describeTarget,searchDestinations,TARGET_NOTES}=await import('../assets/observatory-guide.js');
  for(const budget of ['safe','immersive']) {
    const world=createCatalog({budget});
    for(const [hostName,letters] of [['Kepler-90',['b','c','i','d','e','f','g','h']],['Kepler-11',['b','c','d','e','f','g']]]) {
      const host=resolveCatalogTarget(world,hostName),system=bodySystem(world,host.id);
      assert.equal(host.kind,'star');
      assert.deepEqual(new Set(system.members.map(body=>body.name)),new Set([hostName,...letters.map(letter=>hostName+' '+letter)]));
      for(const letter of letters) {
        const name=hostName+' '+letter,body=resolveCatalogTarget(world,name),range=localInspectionRange(body);
        assert.equal(body.parentId,host.id);assert.ok(range.minimum<range.whole);
        for(const alias of body.aliases)assert.equal(resolveCatalogTarget(world,alias).id,body.id);
        const note=TARGET_NOTES.find(note=>note.target===name);
        assert.ok(letters.some(next=>hostName+' '+next===note.nextTarget));
        for(const language of ['en','zh']) {
          const info=describeTarget(name,language);
          for(const field of ['name','story','observation','representationNote'])assert.ok(info[field]?.length>0);
          assert.ok(searchDestinations(TARGET_NOTES,body.aliases[0]).some(candidate=>candidate.target===name));
        }
      }
    }
    assert.equal(resolveCatalogTarget(world,'KOI-351 h').id,resolveCatalogTarget(world,'Kepler-90 h').id);
    assert.ok(world.bodies.length+world.drawIndices.length<=world.budget.draw);
  }
});

test('finite celestial overlap layers follow actual opaque rays independently of selected identity and catalogue order', () => {
  const star={id:90,kind:'star',radius:10,position:[0,0,20]},planet={id:91,kind:'planet',radius:1,position:[0,0,0]};
  const camera=createCamera(planet);Object.assign(camera,{yaw:0,pitch:0,distance:50});
  const frame=cameraFrame(camera,16/9),original=structuredClone([star,planet]);
  assert.ok(bodyRayIntersection(star,frame.eye,frame.forward)<bodyRayIntersection(planet,frame.eye,frame.forward));
  for(const list of [[star,planet],[planet,star]])for(const selected of [star,planet])assert.deepEqual(bodyDrawLayers(list,selected,frame,1280,720),[planet.id,star.id]);
  assert.deepEqual([star,planet],original);
  const foreground={...planet,id:92,position:[0,0,40]};
  for(const selected of [star,foreground])assert.deepEqual(bodyDrawLayers([star,foreground],selected,frame,1280,720),[star.id,foreground.id]);
});

test('a large opaque foreground limb can precede an object with a nearer centre', () => {
  const big={id:90,kind:'star',radius:90,position:[0,0,100]},small={id:91,kind:'planet',radius:1,position:[80,0,50]};
  const camera=createCamera({id:0,radius:1,position:[0,0,1]});Object.assign(camera,{yaw:Math.PI,pitch:0,distance:1});
  const frame=cameraFrame(camera,1);frame.eye=[0,0,0];frame.forward=[0,0,1];frame.right=[1,0,0];frame.up=[0,1,0];frame.fov=2.4;
  const ray=small.position.map(v=>v/Math.hypot(...small.position));
  assert.ok(Math.hypot(...big.position.map((v,i)=>v-small.position[i]))>big.radius+small.radius);
  assert.ok(bodyRayIntersection(big,frame.eye,ray)<bodyRayIntersection(small,frame.eye,ray));
  assert.deepEqual(bodyDrawLayers([big,small],small,frame,1000,1000),[small.id,big.id]);
});

test('opaque perspective bounds retain visible limbs when centres leave the viewport', () => {
  const camera=createCamera({id:0,radius:1,position:[0,0,1]});
  const frame=cameraFrame(camera,16/9);
  Object.assign(frame,{eye:[0,0,0],forward:[0,0,1],right:[1,0,0],up:[0,1,0],fov:52*Math.PI/180});
  const worlds=[{id:90,kind:'star',radius:10,position:[15,0,12]},
    {id:91,kind:'planet',radius:3,position:[12,0,18],rings:{inner:1.3,outer:2.7}},
    {id:92,kind:'asteroid',radius:3,position:[-13,0,18],axes:[3,1,1]},
    {id:93,kind:'star',radius:10,position:[15,0,8]}];
  for(const [width,height,center] of [[1280,720,[.5,.5]],[390,844,[.5,.22]],[844,390,[.75,.5]]]) {
    frame.center=center;
    for(const body of worlds) {
      const original=structuredClone(body),bounds=bodyScreenBounds(body,frame,width,height);
      const extent=body.radius*Math.max(1,body.rings?.outer||1,...(body.axes||[]));let visible=0;
      for(let lat=-90;lat<=90;lat+=10) for(let lng=0;lng<360;lng+=10) {
        const p=lat*Math.PI/180,y=lng*Math.PI/180;
        const point=projectPoint(body.position.map((v,i)=>v+extent*[Math.cos(p)*Math.cos(y),Math.sin(p),Math.cos(p)*Math.sin(y)][i]),frame,width,height);
        if(!point.visible) continue;
        visible++;assert.ok(bounds.visible);
        assert.ok(point.x>=bounds.left-1e-8&&point.x<=bounds.right+1e-8&&point.y>=bounds.top-1e-8&&point.y<=bounds.bottom+1e-8);
      }
      if(width===1280)assert.ok(visible>0);
      assert.deepEqual(body,original);
    }
  }
  frame.center=[.5,.5];const host=worlds[0],bounds=bodyScreenBounds(host,frame,1280,720);
  assert.ok(bounds.x>1280&&bounds.visible);
  assert.ok(Number.isFinite(bodyRayIntersection(host,frame.eye,screenRay(1100,360,frame,1280,720))));
  for(const kind of ['nebula','galaxy'])assert.equal(bodyScreenBounds({...host,kind,extent:500},frame,1280,720),null);
  assert.equal(bodyScreenBounds({...host,position:[0,0,-30]},frame,1280,720),null);
  assert.equal(bodyScreenBounds({...host,position:[100,0,20]},frame,1280,720).visible,false);
});

test('near annotations clear an extended subject even when its core is small in a reading layout', () => {
  const subject={x:580,y:235};
  const coreRadius=18,discExtent=coreRadius*4;
  assert.equal(labelClearsSubject({x:550,y:220,w:96,h:24},subject,discExtent),false);
  assert.equal(labelClearsSubject({x:610,y:220,w:100,h:24},subject,discExtent),false);
  assert.equal(labelClearsSubject({x:680,y:220,w:100,h:24},subject,discExtent),true);
  // Clearance is about the displayed structure, independent of selection,
  // language, or whether that structure supplies opaque picking geometry.
  for(const [dx,dy] of [[0,0],[-490,10],[45,-110]]) {
    assert.equal(labelClearsSubject({x:550+dx,y:220+dy,w:96,h:24},
      {x:subject.x+dx,y:subject.y+dy},discExtent),false);
  }
  assert.equal(labelClearsSubject({x:550,y:220,w:96,h:24},subject,6),true);
  // A cropped subject can still cover the canvas even with its centre outside.
  assert.equal(labelClearsSubject({x:0,y:180,w:90,h:24},{x:-20,y:190},80),false);
});

test('mapped inner worlds permit local inspection and explicit whole-globe recovery under one lens', () => {
  for(const quality of ['safe','immersive']) {
    const world=createCatalog({budget:quality});
    for(const name of ['Earth','Moon','Mars','Mercury']) {
      const body=resolveCatalogTarget(world,name);
      assert.ok(body.surfaceInspection);
      const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
      const whole=cameraFrame(camera,16/9),initial=camera.distance;
      setCameraScale(camera,1);advance(camera,4);
      const detailed=cameraFrame(camera,16/9);
      assert.ok(camera.distance>body.radius && camera.distance<body.radius*2);
      assert.ok(camera.distance<initial);
      for(const key of ['yaw','pitch','roll','fov']) assert.equal(detailed[key],whole[key]);
      assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
      const ray=screenRay(640,360,detailed,1280,720);
      assert.ok(Number.isFinite(bodyRayIntersection(body,detailed.eye,ray)));
      const stop=scaleStops(camera).find(stop=>stop.stage==='Surface');
      setCameraScale(camera,stop.progress);advance(camera,4);
      assert.ok(camera.distance>body.radius*3 && camera.distance<initial*1.001);
      for(const key of ['yaw','pitch','roll','fov']) assert.equal(cameraFrame(camera,16/9)[key],whole[key]);
      resetCamera(camera,body);arrive(camera);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
    }
  }
});

test('every finite reflective world and comet nucleus supports bounded local inspection and whole-body recovery without changing catalog data', () => {
  const world=createCatalog({budget:'safe'}),original=structuredClone(world.bodies);
  const worlds=world.bodies.filter(body=>['planet','moon','dwarfplanet','asteroid','comet'].includes(body.kind));
  for(const body of worlds) {
    const range=localInspectionRange(body);assert.ok(range);
    const envelope=body.radius*Math.max(1,...(body.axes||[]));
    for(const reducedMotion of [false,true]) {
      const camera=createCamera(body,{reducedMotion});focusCamera(camera,body);arrive(camera);
      const start=cameraFrame(camera,16/9);setCameraScale(camera,1);arrive(camera);
      assert.ok(camera.distance>envelope,body.name+' stays outside the solid envelope');
      assert.ok(camera.distance<body.radius*range.whole,body.name+' can approach beyond its whole-body stop');
      if(body.rings) {
        assert.ok(camera.distance<body.radius*body.rings.outer,body.name+' can inspect the globe within its ring system');
        assert.ok(start.distance/camera.distance>3,body.name+' local inspection substantially enlarges the globe');
      }
      for(const key of ['yaw','pitch','roll','fov'])assert.equal(cameraFrame(camera,16/9)[key],start[key]);
      assert.equal(camera.observedId,body.id);
      setCameraScale(camera,scaleStops(camera).find(stop=>stop.stage==='Surface').progress);arrive(camera);
      close(camera.distance,body.radius*range.whole,body.radius*.00001);
      resetCamera(camera,body);arrive(camera);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
      assert.equal(camera.observedId,body.id);
    }
  }
  assert.equal(localInspectionRange(resolveCatalogTarget(world,'GJ 1214 b')).kind,'cloud');
  assert.equal(localInspectionRange(resolveCatalogTarget(world,'55 Cancri e')).kind,'terrain');
  for(const name of ["Halley's Comet",'Wild 2','Tempel 1','67P'])
    assert.equal(localInspectionRange(resolveCatalogTarget(world,name)).kind,'nucleus');
  for(const name of ['Sol','Crab Pulsar','Sagittarius A*','Orion Nebula','Andromeda Galaxy'])
    assert.equal(localInspectionRange(resolveCatalogTarget(world,name)),null);
  assert.deepEqual(world.bodies,original);
});

test('the expanded finite destinations preserve categories, families, bounded budgets and solid rays', () => {
  const expected=[['Eris','dwarfplanet',0],['Haumea','dwarfplanet',0],['Makemake','dwarfplanet',0],
    ['Rhea','moon',50001],['Dione','moon',50001],['Tethys','moon',50001],['Proteus','moon',50013],
    ['Eros','asteroid',0],['Bennu','asteroid',0],['Wild 2','comet',0],['Tempel 1','comet',0],
    ['Eagle Nebula','nebula'],['Horsehead Nebula','nebula'],['Carina Nebula','nebula'],['Crab Nebula','nebula']];
  let reference;
  for(const budget of ['safe','standard','immersive']) {
    const catalog=createCatalog({budget,catalog:50000});
    assert.ok(catalog.drawIndices.length+catalog.bodies.length<=catalog.budget.draw);
    const bodies=expected.map(([name,kind,parent])=>{
      const body=resolveCatalogTarget(catalog,name);
      assert.equal(body.kind,kind);assert.equal(body.parentId,parent);
      assert.ok(body.id>=50041 && body.id<=50055);
      if(kind==='nebula') {
        const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
        setCameraScale(camera,1);advance(camera,3);
        assert.ok(camera.distance<body.radius*body.extent,'closest observation must enter the cloud range');
      }
      if(parent!==undefined) assert.ok(bodySystem(catalog,body.id).members.some(member=>member.id===body.id));
      if(!isVolumeBody(body)) {
        const origin=body.position.map((v,i)=>v+(i===2 ? body.radius*6 : 0));
        assert.ok(Number.isFinite(bodyRayIntersection(body,origin,[0,0,-1])));
      }
      return body;
    });
    if(reference) assert.deepEqual(bodies,reference);else reference=bodies;
    assert.equal(new Set(catalog.bodies.map(body=>body.id)).size,catalog.bodies.length);
    assert.ok(catalog.dust.length<=catalog.budget.dust);
    assert.ok(catalog.dust.some(point=>Math.hypot(point.position[0],point.position[2])>24));
    assert.ok(catalog.dust.every(point=>point.position.every(Number.isFinite) && point.id===undefined));
  }
});

test('outer dwarf-planet moons share their own immutable family through approach, close observation and return', () => {
  const families=[['Pluto',['Charon','Styx','Nix','Kerberos','Hydra']],['Eris',['Dysnomia']],['Haumea',['Hiʻiaka','Namaka']],['Makemake',['MK 2']],
    ['Orcus',['Vanth']],['Gonggong',['Xiangliu']],['Salacia',['Actaea']],['Varda',['Ilmarë']],['Quaoar',['Weywot']]];
  let reference;
  for(const budget of ['safe','standard','immersive']) {
    const world=createCatalog({catalog:50000,budget}),selected=[];
    for(const [name,names] of families) {
      const parent=resolveCatalogTarget(world,name),members=names.map(name=>resolveCatalogTarget(world,name));
      const family=bodySystem(world,parent.id,{local:true});
      assert.equal(family.root,parent);assert.deepEqual(family.members,[parent,...members]);
      for(const moon of members) {
        assert.equal(moon.kind,'moon');assert.equal(bodyRelations(world,moon.id).parent,parent);
        for(const alias of moon.aliases||[]) assert.equal(resolveCatalogTarget(world,alias),moon);
        const camera=createCamera(parent,{reducedMotion:true});focusCamera(camera,moon);arrive(camera);
        const first=camera.distance;setCameraScale(camera,1);advance(camera,3);
        assert.ok(camera.distance<first);assert.equal(camera.observedId,moon.id);
        const frame=cameraFrame(camera),ray=screenRay(640,360,frame,1280,720);
        assert.ok(Number.isFinite(bodyRayIntersection(moon,frame.eye,ray)));
        focusCamera(camera,parent);arrive(camera);assert.equal(camera.observedId,parent.id);
        selected.push(moon);
      }
    }
    if(reference)assert.deepEqual(selected,reference);else reference=selected;
    assert.ok(world.drawIndices.length+world.bodies.length<=world.budget.draw);
    assert.equal(new Set([...world.stars,...world.bodies].map(body=>body.id)).size,world.count+world.bodies.length);
  }
});

test('auxiliary Galactic extensions and distant references preserve space through quality changes without becoming catalog bodies', () => {
  const world=createCatalog({catalog:50000,budget:'immersive'});
  const stars=structuredClone(world.stars), bodies=structuredClone(world.bodies);
  const dust=structuredClone(world.dust), sky=structuredClone(world.environment.sky);
  const transit=structuredClone(world.environment.transit);
  for(const quality of ['safe','standard','immersive']) {
    setCatalogBudget(world,quality,0);
    assert.deepEqual(world.stars,stars);assert.deepEqual(world.bodies,bodies);
    assert.deepEqual(world.dust,dust.slice(0,world.budget.dust));
    assert.deepEqual(world.environment.sky,sky.slice(0,world.budget.sky));
    assert.deepEqual(world.environment.transit,transit.slice(0,world.budget.transit));
    for(const point of [...world.dust,...world.environment.sky]) {
      assert.equal(point.id,undefined);assert.ok(point.position.every(Number.isFinite));
      assert.ok(point.color.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
      assert.ok(Number.isFinite(point.luminosity)&&point.luminosity>=0);
    }
    assert.ok(world.dust.some(point=>Math.hypot(point.position[0],point.position[2])>40));
    assert.ok(world.dust.some(point=>Math.abs(point.position[1])>5));
    // A luminous bulge must have references above and below the thin arms;
    // a sparse halo also remains outside the disc in all quality budgets.
    // These are spatial presence assertions, not artistic density ratios.
    for(const side of [-1,1]) {
      assert.ok(world.dust.some(point=>point.halo && Math.hypot(point.position[0],point.position[2])<6 && side*point.position[1]>1));
      assert.ok(world.dust.some(point=>point.halo && Math.hypot(point.position[0],point.position[2])>10 && side*point.position[1]>10));
    }
    // Spatial references must survive between the core and the sparse outer
    // field at every quality, rather than only appearing in detached groups.
    for(const [inner,outer] of [[0,8],[8,16],[16,32],[32,64]]) {
      assert.ok(world.dust.filter(point=>{
        const radius=Math.hypot(point.position[0],point.position[2]);
        return point.halo && radius>=inner && radius<outer;
      }).length>10,'An intermediate Galactic region has no auxiliary references');
    }
    assert.ok(world.environment.sky.every(point=>Math.abs(Math.hypot(...point.position)-1)<1e-12));
  }
});

test('finite white dwarfs are selectable stars in their own binaries without changing the Solar or generated catalog', () => {
  for (const budget of ['safe', 'immersive']) for (const [name,parent,alias] of [['Sirius B','Sirius','SiriusB'],['Procyon B','Procyon','南河三B']]) {
    const world = createCatalog({ budget, catalog: 50000, target: alias });
    const dwarf = resolveCatalogTarget(world, name), main = resolveCatalogTarget(world, parent);
    assert.equal(world.activeId, dwarf.id); assert.equal(dwarf.kind, 'star');
    assert.equal(world.count, 50000); assert.equal(world.stars.length, world.count);
    assert.equal(world.stars[24].name, 'UO 01024');
    assert.equal(bodyRelations(world, dwarf.id).parent, main);
    assert.deepEqual(bodyRelations(world, main.id).children, [dwarf]);
    assert.deepEqual(bodySystem(world, dwarf.id).members, [main, dwarf]);
    assert.equal(bodySystem(world, dwarf.id).root, main);
    assert.ok(!bodySystem(world, 0).members.includes(dwarf));
    assert.ok(namedDestinations(world).some(body => body.id === dwarf.id && body.bodyKind === 'star'));
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.equal(isVolumeBody(dwarf), false); assert.equal(hasVolumeBody(dwarf), false);
    const camera = createCamera(main, { reducedMotion: true }); focusCamera(camera, dwarf); arrive(camera);
    const distance = camera.distance, lens = cameraFrame(camera).fov, angles = [camera.yaw,camera.pitch,camera.roll];
    setCameraScale(camera, 1); advance(camera, 3);
    assert.ok(camera.distance < distance); assert.deepEqual([camera.yaw,camera.pitch,camera.roll], angles);
    assert.equal(cameraFrame(camera).fov, lens);
    const frame = cameraFrame(camera), ray = screenRay(640,360,frame,1280,720);
    assert.ok(Number.isFinite(bodyRayIntersection(dwarf, frame.eye, ray)));
    resetCamera(camera,dwarf); arrive(camera);
    assert.equal(camera.observedId,dwarf.id); assert.equal(scaleState(camera,dwarf).scaleStage,'Galactic');
    assert.equal(new Set([...world.stars,...world.bodies].map(body=>body.id)).size,world.count+world.bodies.length);
  }
});

test('compact remnants retain finite identities, opaque cores and complete scale journeys inside shared budgets', () => {
  for (const budget of ['safe','standard','immersive']) {
    const world=createCatalog({budget,catalog:50000});
    for(const body of world.bodies.filter(body=>body.id>=50127 && body.id<=50132)) {
      assert.ok(['star','pulsar','blackhole'].includes(body.kind));
      const original=structuredClone(body);
      for(const alias of [body.name,...body.aliases]) assert.equal(resolveCatalogTarget(world,alias),body);
      assert.equal(isVolumeBody(body),false);
      assert.equal(hasVolumeBody(body),body.kind!=='star');
      const camera=createCamera(sol,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
      const first=camera.distance, fov=cameraFrame(camera).fov, angles=[camera.yaw,camera.pitch,camera.roll];
      setCameraScale(camera,1);advance(camera,8);
      assert.ok(camera.distance<first && camera.distance>body.radius);
      assert.deepEqual([camera.yaw,camera.pitch,camera.roll],angles);assert.equal(cameraFrame(camera).fov,fov);
      const frame=cameraFrame(camera),ray=screenRay(640,360,frame,1280,720);
      assert.ok(Number.isFinite(bodyRayIntersection(body,frame.eye,ray)));
      resetCamera(camera,body);arrive(camera);
      assert.equal(camera.observedId,body.id);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
      assert.deepEqual(body,original);
    }
    assert.ok(world.drawIndices.length+world.bodies.length<=world.budget.draw);
    assert.equal(world.stars.length,50000);assert.equal(new Set([...world.stars,...world.bodies].map(body=>body.id)).size,50000+world.bodies.length);
  }
});

test('new deep-sky worlds remain distinct transparent identities through approach, entry and return', () => {
  const world = createCatalog({ budget: 'safe' });
  for (const [target, aliases, kind] of [
    ['Ring Nebula', ['M 57', 'NGC-6720', 'Messier 57'], 'nebula'],
    ['Helix Nebula', ['NGC-7293', 'Caldwell 63', 'C63'], 'nebula'],
    ['Lagoon Nebula', ['M 8', 'NGC-6523', 'Messier 8'], 'nebula'],
    ["Dumbbell Nebula", ["M27", "Messier 27"], "nebula"],
    ["Cat's Eye Nebula", ["NGC6543", "C6"], "nebula"],
    ["Butterfly Nebula", ["NGC6302", "C69"], "nebula"],
    ["Bubble Nebula", ["NGC7635", "C11"], "nebula"],
    ["Rosette Nebula", ["NGC2237", "Rosette"], "nebula"],
    ["Veil Nebula", ["Cygnus Loop", "天鹅座环状星云"], "nebula"],
    ["Flame Nebula", ["NGC2024", "Flame"], "nebula"],
    ["Swan Nebula", ["M17", "Messier 17"], "nebula"],
    ['Trifid Nebula', ['M20','NGC6514','三裂星云'], 'nebula'],
    ['Crescent Nebula', ['NGC6888','C27','眉月星云'], 'nebula'],
    ['Tarantula Nebula', ['30 Doradus','NGC2070','蜘蛛星云'], 'nebula'],
    ['NGC 3603', ['NGC3603'], 'nebula'],
    ['NGC 602', ['NGC602','N90'], 'nebula'],
    ['NGC 604', ['NGC604'], 'nebula'],
    ['Iris Nebula', ['NGC7023','C4','鸢尾花星云'], 'nebula'],
    ['NGC 1333', ['NGC1333'], 'nebula'],
    ['Ghost Nebula', ['IC63','仙后座幽灵'], 'nebula'],
    ['Cone Nebula', ['NGC2264 Cone','锥状星云'], 'nebula'],
    ['Red Rectangle', ['HD44179','红矩形星云'], 'nebula'],
    ['Boomerang Nebula', ['Boomerang','回力棒星云'], 'nebula'],
    ["Whirlpool Galaxy", ["M51", "NGC5194"], "galaxy"],
    ["NGC 1300", ["NGC1300", "Barred Spiral NGC 1300"], "galaxy"],
    ["Sombrero Galaxy", ["M104", "NGC4594"], "galaxy"],
    ["Centaurus A", ["NGC5128", "C77"], "galaxy"],
    ["Cigar Galaxy", ["M82", "NGC3034"], "galaxy"],
    ["Needle Galaxy", ["NGC4565", "C38"], "galaxy"],
    ["Messier 49", ["M49", "NGC4472"], "galaxy"],
    ["Cartwheel Galaxy", ["Cartwheel", "ESO350-40"], "galaxy"],
    ['Triangulum Galaxy', ['M 33', 'NGC-598', 'Triangulum'], 'galaxy'],
    ...GALAXY_EXPLORATIONS.map(body=>[body.name,body.aliases,'galaxy']),
  ]) {
    const body = resolveCatalogTarget(world, target), original = structuredClone(body);
    assert.equal(body.kind, kind); assert.ok(isVolumeBody(body));
    for (const alias of aliases) assert.equal(resolveCatalogTarget(world, alias), body);
    assert.ok(namedDestinations(world).some(item => item.id === body.id && item.bodyKind === kind));
    for (const reducedMotion of [false, true]) {
      const camera = createCamera(sol, { reducedMotion }); focusCamera(camera, body); arrive(camera);
      const first = camera.distance, lens = cameraFrame(camera).fov;
      const direction = [camera.yaw, camera.pitch, camera.roll];
      setCameraScale(camera, 1); advance(camera, 8);
      assert.ok(camera.distance < first && camera.distance < body.radius);
      assert.deepEqual([camera.yaw, camera.pitch, camera.roll], direction);
      assert.equal(cameraFrame(camera).fov, lens); assert.equal(camera.observedId, body.id);
      assert.equal(bodyRayIntersection(body, cameraFrame(camera).eye, screenRay(640, 360, cameraFrame(camera), 1280, 720)), Infinity);
      resetCamera(camera, body); arrive(camera);
      assert.equal(scaleState(camera, body).scaleStage, 'Galactic');
    }
    assert.deepEqual(body, original);
  }
  assert.equal(new Set([...world.stars, ...world.bodies].map(body => body.id)).size, world.count + world.bodies.length);
});

test('observed galaxies reuse a full stable light budget without replacing a departing field or diluting legacy views', () => {
  const world = createCatalog({ budget: 'immersive', target: 'M31' });
  const m31 = resolveCatalogTarget(world, 'M31'), m33 = resolveCatalogTarget(world, 'M33');
  const original = structuredClone(world.galaxyLights), bodies = structuredClone(world.galaxies);
  const references = structuredClone(world.galaxyReferences);
  const byOwner = (lights, id) => lights.filter(light => light.ownerId === id);
  assert.equal(references.length, world.budget.galaxyReferences);
  assert.ok(references.every(light => light.id === undefined && bodies.some(body => body.id === light.ownerId)));
  assert.deepEqual(byOwner(references,m31.id), original.slice(0,byOwner(references,m31.id).length));
  assert.equal(setObservedGalaxy(world, m31.id), false);
  assert.equal(setObservedGalaxy(world, m33.id), true);
  const field = structuredClone(world.galaxyLights), reference = world.galaxyLights;
  assert.deepEqual(world.galaxyReferences,references);
  assert.deepEqual(byOwner(references,m33.id),field.slice(0,byOwner(references,m33.id).length));
  assert.equal(field.length, world.budget.galaxyStars);
  assert.ok(field.every(light => light.ownerId === m33.id && light.id === undefined));
  assert.equal(setObservedGalaxy(world, sol.id), false);
  assert.equal(world.galaxyLights, reference);
  for (const quality of ['safe', 'standard', 'immersive']) {
    setCatalogBudget(world, quality, m31.id, m33.id);
    assert.equal(world.galaxyLights.length, world.budget.galaxyStars);
    assert.deepEqual(world.galaxyLights, field.slice(0, world.budget.galaxyStars));
    assert.equal(world.galaxyReferences.length,world.budget.galaxyReferences);
    for(const body of bodies) {
      const lights=byOwner(world.galaxyReferences,body.id);
      assert.ok(lights.length>0);
      assert.deepEqual(lights,byOwner(references,body.id).slice(0,lights.length));
    }
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
  }
  assert.equal(setObservedGalaxy(world, m31.id), true);
  assert.deepEqual(world.galaxyLights, original);
  for (const galaxy of world.galaxies.slice(2)) {
    assert.equal(setObservedGalaxy(world, galaxy.id), true);
    const full = structuredClone(world.galaxyLights);
    const distant=byOwner(world.galaxyReferences,galaxy.id);
    assert.deepEqual(distant,full.slice(0,distant.length));
    assert.equal(full.length, world.budget.galaxyStars);
    assert.ok(full.every(light => light.ownerId === galaxy.id && light.id === undefined &&
      [...light.position, ...light.color, light.size, light.luminosity].every(Number.isFinite)));
    assert.ok(full.every(light => Math.hypot(...light.position.map((value,axis)=>value-galaxy.position[axis])) <= galaxy.radius*galaxy.extent));
    for (const quality of ['safe', 'standard', 'immersive']) {
      setCatalogBudget(world, quality, galaxy.id, galaxy.id);
      assert.deepEqual(world.galaxyLights, full.slice(0, world.budget.galaxyStars));
      assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    }
  }
  setObservedGalaxy(world, m31.id);
  assert.deepEqual(world.galaxyLights, original);
  assert.deepEqual(world.galaxies, bodies);
});

test('compressed satellite families gain inner observation room while retaining their outer envelope and identity', () => {
  const parent = { position: [2, 3, 4], radius: .1, rings: { outer: 2.3 } };
  const members = [[.25, 0, 0], [0, .45, 0], [0, 0, 1.2]].map((offset, id) => ({
    id, parentId: 9, kind: 'moon', radius: .01, material: 'ice',
    position: parent.position.map((value, i) => value + offset[i]),
  }));
  const original = structuredClone(members), spaced = spaceSatelliteFamily(parent, members);
  assert.deepEqual(members, original);
  assert.equal(spaced.at(-1), members.at(-1));
  let previous = 0;
  for (let i = 0; i < members.length; i++) {
    const offset = body => body.position.map((value, axis) => value - parent.position[axis]);
    const old = offset(members[i]), next = offset(spaced[i]);
    const radius = Math.hypot(...next), oldRadius = Math.hypot(...old);
    assert.ok(radius > previous && radius <= Math.hypot(...offset(members.at(-1))));
    assert.ok(radius - spaced[i].radius > parent.radius * parent.rings.outer + parent.radius);
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(old[axis] / oldRadius - next[axis] / radius) < 1e-12);
    assert.deepEqual({ ...spaced[i], position: original[i].position }, original[i]);
    previous = radius;
  }
  assert.deepEqual(spaceSatelliteFamily(parent, spaced), spaced);
});

test('Pluto and Charon retain distinct classification and a discoverable solid local family', () => {
  for (const budget of ['safe', 'immersive']) {
    const world = createCatalog({ budget, catalog: 50000, target: 'Pluto' });
    const pluto = resolveCatalogTarget(world, 'Pluto'), charon = resolveCatalogTarget(world, 'Charon');
    assert.equal(pluto.kind, 'dwarfplanet'); assert.equal(charon.kind, 'moon');
    assert.equal(world.planets.length, 8); assert.ok(!world.planets.includes(pluto));
    assert.equal(world.activeId, pluto.id); assert.equal(bodyRelations(world, charon.id).parent, pluto);
    const members = bodySystem(world, pluto.id, { local: true }).members;
    assert.ok(members.includes(pluto) && members.includes(charon));
    assert.equal(bodySystem(world, charon.id).root, world.stars[0]);
    assert.ok(namedDestinations(world).some(body => body.id === pluto.id && body.bodyKind === 'dwarfplanet'));
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    for (const body of [pluto, charon]) {
      const camera = createCamera(body, { reducedMotion: true }); focusCamera(camera, body); arrive(camera);
      const frame = cameraFrame(camera), ray = screenRay(640, 360, frame, 1280, 720);
      assert.ok(Number.isFinite(bodyRayIntersection(body, frame.eye, ray)));
      resetCamera(camera, body); arrive(camera);
      assert.equal(camera.observedId, body.id); assert.equal(scaleState(camera, body).scaleStage, 'Galactic');
    }
  }
});

test('compact-remnant profiles keep distinct identities, opaque cores and fixed-lens round trips', () => {
  for (const budget of ['safe', 'immersive']) {
    const world = createCatalog({ budget, catalog: 50000 });
    for (const [name, alias, kind] of [['Vela Pulsar', 'PSR J0835-4510', 'pulsar'], ['M87*', 'Powehi', 'blackhole']]) {
      const body = resolveCatalogTarget(world, alias);
      assert.equal(body.name, name); assert.equal(body.kind, kind);
      assert.equal(resolveCatalogTarget(world, String(body.id)), body);
      assert.equal(isVolumeBody(body), false); assert.equal(hasVolumeBody(body), true);
      const camera = createCamera(sol, { reducedMotion: true }); focusCamera(camera, body); arrive(camera);
      const whole = camera.distance, view = [camera.yaw, camera.pitch, camera.roll], lens = cameraFrame(camera).fov;
      setCameraScale(camera, 1); advance(camera, 3);
      assert.ok(camera.distance < whole && camera.distance >= camera.minDistance * (1 - 1e-12));
      assert.deepEqual([camera.yaw, camera.pitch, camera.roll], view); assert.equal(cameraFrame(camera).fov, lens);
      const frame = cameraFrame(camera, 16 / 9), towards = point => {
        const offset = body.position.map((v, i) => v + body.radius * point[i] - frame.eye[i]);
        return offset.map(v => v / Math.hypot(...offset));
      };
      assert.ok(Number.isFinite(bodyRayIntersection(body, frame.eye, towards([0, 0, 0]))));
      const up = frame.up.map(v => v * 2);
      assert.equal(bodyRayIntersection(body, frame.eye, towards(up)), Infinity);
      resetCamera(camera, body); arrive(camera); assert.equal(scaleState(camera, body).scaleStage, 'Galactic');
      assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    }
  }
});

test('black holes share bounded catalog identity while the transparent disk never occludes', () => {
  const world = createCatalog({ catalog: 50000, budget: 'safe', target: 'Sgr A*' });
  const body = resolveCatalogTarget(world, 'Sagittarius A*');
  assert.equal(body.kind, 'blackhole');
  assert.equal(world.activeId, body.id);
  assert.equal(catalogBody(world, body.id), body);
  assert.equal(resolveCatalogTarget(world, String(body.id)), body);
  assert.equal(resolveCatalogTarget(world, 'sgr a'), body);
  assert.equal(new Set([...world.stars, ...world.bodies].map(item => item.id)).size, world.count + world.bodies.length);
  assert.equal(isVolumeBody(body), false);
  assert.equal(hasVolumeBody(body), true);
  assert.equal(bodySystem(world, body.id), null);
  const original = structuredClone(body);
  for (const quality of ['safe', 'standard', 'immersive']) {
    setCatalogBudget(world, quality, body.id);
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.deepEqual(catalogBody(world, body.id), original);
  }
  const origin = body.position.map((v, i) => v + (i === 2 ? body.radius * 20 : 0));
  const towards = offset => {
    const direction = body.position.map((v, i) => v + offset[i] * body.radius - origin[i]);
    return direction.map(v => v / Math.hypot(...direction));
  };
  assert.ok(Number.isFinite(bodyRayIntersection(body, origin, towards([0, 0, 0]))));
  for (const offset of [[1.3, 0, 0], [0, 2, 0], [3, 0, 0]]) {
    assert.equal(bodyRayIntersection(body, origin, towards(offset)), Infinity);
  }
});

test('black-hole approach stays centred under one lens and reading contains the extended disk', () => {
  const body = resolveCatalogTarget(catalog, 'Sagittarius A*');
  for (const reducedMotion of [false, true]) {
    const camera = createCamera(sol, { reducedMotion });
    focusCamera(camera, body); arrive(camera);
    assert.equal(camera.observedId, body.id);
    assert.equal(scaleState(camera, body).scaleStage, 'LocalSystem');
    const arrival = camera.distance, pose = [camera.yaw, camera.pitch, camera.roll];
    const lens = cameraFrame(camera, 16 / 9).fov;
    setCameraScale(camera, 1); advance(camera, 3);
    assert.ok(camera.distance < arrival && camera.distance >= camera.minDistance);
    assert.equal(scaleState(camera, body).scaleStage, 'Surface');
    assert.deepEqual([camera.yaw, camera.pitch, camera.roll], pose);
    assert.equal(cameraFrame(camera, 16 / 9).fov, lens);
    for (const [width, height, area] of [[1280, 720, { width: 780, height: 650 }], [390, 844, { width: 340, height: 280 }]]) {
      const frame = cameraFrame(camera, width / height);
      const fit = readingLensScale(frame, body, camera.minDistance, width, height, area);
      const radius = body.radius * body.extent;
      const projected = height / (2 * Math.tan(frame.fov / 2)) * fit * radius / Math.sqrt(camera.minDistance ** 2 - radius ** 2);
      assert.ok(projected <= Math.min(area.width, area.height) / 2 - 8 + 1e-8);
      const point = projectPoint(body.position, frame, width, height);
      close(point.x, width / 2); close(point.y, height / 2);
    }
    resetCamera(camera, body); arrive(camera);
    assert.equal(camera.activeId, body.id);
    assert.equal(scaleState(camera, body).scaleStage, 'Galactic');
  }
});

test('pulsars retain a distinct bounded identity while only their solid core occludes', () => {
  const world = createCatalog({ catalog: 50000, budget: 'immersive', target: 'PSR B0531+21' });
  const pulsar = resolveCatalogTarget(world, 'Crab Pulsar');
  assert.equal(pulsar.kind, 'pulsar');
  assert.equal(world.activeId, pulsar.id);
  assert.equal(catalogBody(world, pulsar.id), pulsar);
  assert.equal(resolveCatalogTarget(world, 'PSR B0531+21'), pulsar);
  assert.equal(new Set([...world.stars, ...world.bodies].map(body => body.id)).size, world.count + world.bodies.length);
  assert.equal(isVolumeBody(pulsar), false);
  assert.equal(hasVolumeBody(pulsar), true);
  assert.equal(bodySystem(world, pulsar.id), null);
  const geometry = structuredClone(pulsar);
  for (const quality of ['safe', 'standard', 'immersive']) {
    setCatalogBudget(world, quality, pulsar.id);
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.deepEqual(catalogBody(world, pulsar.id), geometry);
  }
  const origin=pulsar.position.map((v,i)=>v+(i===2 ? pulsar.radius*40 : 0));
  const rayTo=offset=>{
    const direction=pulsar.position.map((v,i)=>v+offset[i]*pulsar.radius-origin[i]);
    return direction.map(v=>v/Math.hypot(...direction));
  };
  assert.ok(Number.isFinite(bodyRayIntersection(pulsar,origin,rayTo([0,0,0]))));
  for (const point of [[1.2,0,0],[0,8,0],[0,-8,0]]) assert.equal(bodyRayIntersection(pulsar,origin,rayTo(point)),Infinity);
});

test('pulsar observation proceeds from its extended illustration to the core under one centred lens', () => {
  const pulsar = resolveCatalogTarget(catalog, 'Crab Pulsar');
  for (const reducedMotion of [false,true]) {
    const camera=createCamera(sol,{reducedMotion});
    focusCamera(camera,pulsar); arrive(camera);
    assert.equal(camera.observedId,pulsar.id);
    assert.equal(scaleState(camera,pulsar).scaleStage,'LocalSystem');
    const arrival=camera.distance,orientation=[camera.yaw,camera.pitch,camera.roll];
    const lens=cameraFrame(camera,16/9).fov;
    setCameraScale(camera,1);advance(camera,3);
    assert.equal(scaleState(camera,pulsar).scaleStage,'Surface');
    assert.ok(camera.distance<arrival && camera.distance>=camera.minDistance);
    const frame=cameraFrame(camera,16/9),projection=projectPoint(pulsar.position,frame,1280,720);
    assert.equal(frame.fov,lens);
    assert.deepEqual([camera.yaw,camera.pitch,camera.roll],orientation);
    close(projection.x,640);close(projection.y,360);
    cancelCameraFlight(camera);const held=cameraFrame(camera);advance(camera);
    assert.deepEqual(cameraFrame(camera),held);
    resetCamera(camera,pulsar);arrive(camera);
    assert.equal(camera.activeId,pulsar.id);
    assert.equal(scaleState(camera,pulsar).scaleStage,'Galactic');
  }
});

test('inner worlds expand a finite part of the same Solar family without changing identities or relationships', () => {
  for (const count of [1000, 50000]) {
    const world = createCatalog({ catalog: count, budget: 'safe' });
    const before = structuredClone(world.bodies);
    const inner = bodySystem(world, 0, { region: 'inner' });
    const expected = ['Sol', 'Mercury', 'Venus', 'Earth', 'Moon', 'Mars', 'Phobos', 'Deimos'].map(name => resolveCatalogTarget(world, name));
    assert.equal(inner.root, catalogBody(world, 0));
    assert.deepEqual(new Set(inner.members), new Set(expected));
    assert.equal(bodySystem(world, resolveCatalogTarget(world, 'Earth').id, { region: 'inner' }).root, inner.root);
    for (const body of inner.members) {
      assert.equal(catalogBody(world, body.id), body);
      if (body !== inner.root) assert.ok(inner.members.some(parent => parent.id === body.parentId));
    }
    for (const key of ['immersive', 'standard', 'safe']) {
      setCatalogBudget(world, key, inner.root.id);
      assert.deepEqual(bodySystem(world, 0, { region: 'inner' }).members, inner.members);
      assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    }
    assert.deepEqual(world.bodies, before);
    assert.equal(bodySystem(world, 0, { region: 'unknown' }), null);
    assert.equal(bodySystem(world, resolveCatalogTarget(world, 'Jupiter').id, { local: true, region: 'inner' }), null);
    assert.equal(bodySystem(world, resolveCatalogTarget(world, 'Vega').id, { region: 'inner' }), null);
    assert.ok(bodySystem(world, 0).members.length > inner.members.length);
  }
});

test('the available Solar family shares existing identities and finite parent relationships across catalog budgets', () => {
  for (const count of [1000, 50000]) {
    const world = createCatalog({ catalog: count, budget: 'safe' });
    const family = bodySystem(world, resolveCatalogTarget(world, 'Moon').id);
    assert.equal(family.root, catalogBody(world, 0));
    assert.equal(new Set(family.members.map(body => body.id)).size, family.members.length);
    for (const name of ['Sol', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon', 'Halley', 'Io', 'Europa', 'Enceladus', 'Titan', 'Ganymede', 'Callisto', 'Triton', 'Mimas']) {
      const body = resolveCatalogTarget(world, name);
      assert.ok(family.members.includes(body));
      assert.equal(bodySystem(world, body.id).root, family.root);
      if (body !== family.root) assert.ok(family.members.some(parent => parent.id === body.parentId));
    }
    for (const name of ['M42', 'M31', 'Vega']) assert.equal(bodySystem(world, resolveCatalogTarget(world, name).id), null);
    assert.equal(bodySystem(world, -1), null);
    const original = structuredClone(family.members);
    for (const key of ['standard', 'immersive', 'safe']) {
      setCatalogBudget(world, key, family.root.id);
      assert.deepEqual(bodySystem(world, family.root.id).members, original);
      assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    }
  }
  const cyclic = { stars: [], bodies: [{ id: 80, parentId: 81 }, { id: 81, parentId: 80 }] };
  assert.equal(bodySystem(cyclic, 80), null);
  assert.equal(bodySystem({ stars: [], bodies: [{ id: 80, parentId: 99 }] }, 80), null);
});

test('outer planet moons are discoverable, lit solid bodies with stable local family navigation', () => {
  for (const count of [1000,50000]) {
    const world=createCatalog({catalog:count,budget:'safe'});
    const originalStars=structuredClone(world.stars.slice(0,16));
    for (const [parentName,names] of [['Mars',['Phobos','Deimos']],['Jupiter',['Io','Europa','Ganymede','Callisto']],['Saturn',['Enceladus','Titan','Mimas','Iapetus']],['Uranus',['Miranda','Ariel','Umbriel','Titania','Oberon']],['Neptune',['Triton']]]) {
      const parent=resolveCatalogTarget(world,parentName);
      const family=bodySystem(world,parent.id,{local:true});
      assert.equal(family.root,parent);
      for (const name of names) {
        const body=resolveCatalogTarget(world,name);
        assert.equal(body.kind,'moon');assert.equal(bodyRelations(world,body.id).parent,parent);
        assert.ok(family.members.includes(body));
        assert.ok(namedDestinations(world).some(target=>target.id===body.id));
        const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
        const orientation=[camera.yaw,camera.pitch,camera.roll];
        setCameraScale(camera,1);arrive(camera);
        assert.deepEqual([camera.yaw,camera.pitch,camera.roll],orientation);
        assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
        const frame=cameraFrame(camera);
        assert.ok(Number.isFinite(bodyRayIntersection(body,frame.eye,frame.forward)));
        resetCamera(camera,body);arrive(camera);
        assert.equal(scaleState(camera,body).scaleStage,'Galactic');assert.equal(camera.activeId,body.id);
      }
      assert.ok(!family.members.some(body=>body.kind==='star'));
    }
    for (const quality of ['immersive','standard','safe']) {
      setCatalogBudget(world,quality,resolveCatalogTarget(world,'Europa').id);
      assert.deepEqual(world.stars.slice(0,16),originalStars);
      assert.ok(world.drawIndices.length+world.bodies.length<=world.budget.draw);
    }
  }
});

test('a local family contains only the chosen root and its descendants without changing wider relationships', () => {
  for (const count of [1000, 50000]) {
    const world = createCatalog({ catalog: count, budget: 'safe' });
    const earth = resolveCatalogTarget(world, 'Earth'), moon = resolveCatalogTarget(world, 'Moon');
    const before = structuredClone(world.bodies);
    const local = bodySystem(world, earth.id, { local: true });
    assert.equal(local.root, earth);
    assert.deepEqual(local.members, [earth, moon]);
    assert.equal(bodySystem(world, moon.id).root, catalogBody(world, 0));
    assert.equal(bodySystem(world, moon.id, { local: true }), null);
    assert.equal(bodySystem(world, -1, { local: true }), null);
    assert.deepEqual(bodySystem(world, 0, { local: true }).members, bodySystem(world, 0).members);
    for (const quality of ['immersive', 'standard', 'safe']) {
      setCatalogBudget(world, quality, earth.id);
      assert.deepEqual(bodySystem(world, earth.id, { local: true }).members, [earth, moon]);
      assert.deepEqual(world.bodies, before);
    }
  }
  for (const bodies of [[{ id: 80, parentId: 81 }, { id: 81, parentId: 80 }],
    [{ id: 80, parentId: 99 }, { id: 81, parentId: 80 }]]) {
    assert.equal(bodySystem({ stars: [], bodies }, 80, { local: true }), null);
  }
});

test('an explicit system overview fits existing members outside reading, then supports stop, continue and centred fixed-lens zoom', () => {
  const family = bodySystem(catalog, 0);
  const source = resolveCatalogTarget(catalog, 'Jupiter');
  const layouts = [
    [1280, 720, { x: 390, y: 128, width: 820, height: 516 }],
    [390, 844, { x: 16, y: 128, width: 358, height: 260 }],
    [844, 390, { x: 330, y: 120, width: 450, height: 194 }],
    [320, 640, { x: 16, y: 120, width: 288, height: 150 }]
  ];
  for (const [width, height, area] of layouts) for (const reducedMotion of [false, true]) {
    const camera = createCamera(source, { reducedMotion });
    focusCamera(camera, source); arrive(camera);
    const center = [(area.x + area.width / 2) / width, (area.y + area.height / 2) / height];
    const lens = cameraFrame(camera, width / height, center);
    const factor = readingLensScale(lens, family.root, family.root.radius * (family.root.nearLimit || 3.1), width, height, area);
    lens.fov = 2 * Math.atan(Math.tan(lens.fov / 2) / factor);
    const view = systemOverviewView(family.root, family.members, lens, width, height, area);
    focusCamera(camera, family.root, camera.now, view);
    if (!reducedMotion) {
      advance(camera, 0.3);
      cancelCameraFlight(camera);
      const held = cameraFrame(camera, width / height, center);
      advance(camera, 1);
      assert.deepEqual(cameraFrame(camera, width / height, center), held);
      focusCamera(camera, family.root, camera.now, view);
    }
    advance(camera, 5);
    assert.equal(camera.activeId, family.root.id);
    assert.equal(camera.observedId, family.root.id);
    assert.deepEqual(camera.focus, family.root.position);
    close(camera.distance, view.distance);
    const frame = cameraFrame(camera, width / height, center);
    frame.fov = lens.fov;
    for (const body of family.members) {
      const point = projectPoint(body.position, frame, width, height);
      assert.ok(point.visible);
      assert.ok(point.x >= area.x + 24 && point.x <= area.x + area.width - 24);
      assert.ok(point.y >= area.y + 24 && point.y <= area.y + area.height - 24);
    }
    const pose = [camera.yaw, camera.pitch, camera.roll];
    zoomCamera(camera, -300); advance(camera, 3);
    assert.deepEqual([camera.yaw, camera.pitch, camera.roll], pose);
    assert.deepEqual(camera.focus, family.root.position);
    const point = projectPoint(family.root.position, cameraFrame(camera, width / height, center), width, height);
    close(point.x, area.x + area.width / 2); close(point.y, area.y + area.height / 2);
  }
});

test('comets share catalog identity and solar relationships while only their solid nucleus occludes', () => {
  const world = createCatalog({ catalog: 50000, budget: 'immersive', target: 'Halley' });
  const comet = resolveCatalogTarget(world, '1P/Halley');
  assert.equal(comet.kind, 'comet');
  assert.equal(world.activeId, comet.id);
  assert.equal(catalogBody(world, comet.id), comet);
  assert.equal(bodyRelations(world, comet.id).parent.name, 'Sol');
  assert.ok(bodyRelations(world, 0).children.includes(comet));
  assert.equal(new Set([...world.stars, ...world.bodies].map(body => body.id)).size, world.count+world.bodies.length);
  const geometry = structuredClone(comet);
  for (const quality of ['safe', 'standard', 'immersive']) {
    setCatalogBudget(world, quality, comet.id);
    assert.ok(world.drawIndices.length+world.bodies.length <= world.budget.draw);
    assert.deepEqual(catalogBody(world, comet.id), geometry);
  }
  const origin = comet.position.map((v,i) => v+(i===2 ? comet.radius*8 : 0));
  const rayTo = offset => {
    const vector = comet.position.map((v,i) => v+offset[i]*comet.radius-origin[i]);
    return vector.map(v => v/Math.hypot(...vector));
  };
  assert.ok(Number.isFinite(bodyRayIntersection(comet,origin,rayTo([0,0,0]))));
  // The elongated solid can be hit outside a unit sphere; surrounding gas cannot.
  assert.ok(Number.isFinite(bodyRayIntersection(comet,origin,rayTo([comet.axes[0]*0.9,0,0]))));
  assert.equal(bodyRayIntersection(comet,origin,rayTo([comet.axes[0]*1.2,0,0])),Infinity);
  assert.equal(bodyRayIntersection(comet,origin,rayTo([0,Math.max(...comet.axes)*1.2,0])),Infinity);
});

test('a comet arrives with room for its tails and can continue to its nucleus through the existing centred scales', () => {
  const comet = resolveCatalogTarget(catalog,'Halley');
  for (const reducedMotion of [false,true]) {
    const camera = createCamera(comet,{reducedMotion});
    focusCamera(camera,comet); arrive(camera);
    assert.equal(scaleState(camera,comet).scaleStage,'LocalSystem');
    const arrival = camera.distance;
    assert.ok(arrival > comet.radius*30);
    const orientation = [camera.yaw,camera.pitch,camera.roll];
    const stops = scaleStops(camera);
    assert.ok(stops.every((stop,i) => !i || stop.progress>stops[i-1].progress));
    for (const stop of [...stops,...stops.toReversed()]) {
      setCameraScale(camera,stop.progress); arrive(camera);
      assert.equal(scaleState(camera,comet).scaleStage,stop.stage);
      assert.deepEqual([camera.yaw,camera.pitch,camera.roll],orientation);
      assert.deepEqual(camera.focus,comet.position);
      const projection = projectPoint(comet.position,cameraFrame(camera,16/9),1280,720);
      close(projection.x,640); close(projection.y,360);
      if (stop.stage==='Surface') assert.ok(camera.distance<arrival);
    }
    focusCamera(camera,comet); arrive(camera);
    zoomCamera(camera,-3000); advance(camera,3);
    assert.ok(camera.distance<arrival && camera.distance>=camera.minDistance);
    cancelCameraFlight(camera);
    const held = cameraFrame(camera);
    advance(camera);
    assert.deepEqual(cameraFrame(camera),held);
    assert.equal(camera.observedId,comet.id);
  }
});

test('galaxies share bounded identities, transparent picking and deterministic auxiliary light budgets', () => {
  const world = createCatalog({ catalog: 50000, budget: 'immersive', target: 'M31' });
  const galaxy = resolveCatalogTarget(world, 'NGC224');
  assert.equal(world.activeId, galaxy.id);
  assert.equal(galaxy.kind, 'galaxy');
  for (const alias of ['M 31', 'NGC-224', 'Andromeda', 'Messier 31']) assert.equal(resolveCatalogTarget(world, alias), galaxy);
  assert.equal(catalogBody(world, galaxy.id), galaxy);
  assert.equal(new Set([...world.stars, ...world.bodies].map(body => body.id)).size, world.count + world.bodies.length);
  const source = world.galaxyLights.slice();
  for (const key of ['safe', 'standard', 'immersive']) {
    setCatalogBudget(world, key, galaxy.id);
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.ok(world.galaxyLights.length <= world.budget.galaxyStars);
    assert.deepEqual(world.galaxyLights, source.slice(0, world.galaxyLights.length));
    assert.equal(catalogBody(world, galaxy.id), galaxy);
    assert.ok(world.galaxyLights.every(light => light.ownerId === galaxy.id && light.id === undefined));
    assert.ok(world.galaxyLights.every(light => light.position.every(Number.isFinite) && light.color.every(value => value >= 0 && value <= 1) && light.luminosity > 0));
  }
  assert.equal(bodyRayIntersection(galaxy, galaxy.position.map((v, i) => v + (i === 2 ? galaxy.radius * 5 : 0)), [0, 0, -1]), Infinity);
});

test('extended galaxies traverse every scale with one centre and preserve orbit throughout zoom', () => {
  for (const galaxy of catalog.galaxies) for (const reducedMotion of [false, true]) {
    const camera = createCamera(galaxy, { reducedMotion });
    const orientation = [camera.yaw, camera.pitch, camera.roll];
    const stops = scaleStops(camera);
    assert.ok(stops.every((stop, i) => !i || stop.progress > stops[i-1].progress));
    for (const stop of [...stops, ...stops.toReversed()]) {
      setCameraScale(camera, stop.progress); arrive(camera);
      assert.equal(scaleState(camera, galaxy).scaleStage, stop.stage);
      assert.deepEqual([camera.yaw, camera.pitch, camera.roll], orientation);
      assert.deepEqual(camera.focus, galaxy.position);
      const projection = projectPoint(galaxy.position, cameraFrame(camera, 16/9), 1280, 720);
      close(projection.x, 640); close(projection.y, 360);
    }
    focusCamera(camera, galaxy); arrive(camera);
    zoomCamera(camera, -1500); advance(camera);
    assert.ok(camera.distance < galaxy.radius * galaxy.extent);
    resetCamera(camera, galaxy); arrive(camera);
    assert.equal(camera.observedId, galaxy.id);
    assert.equal(scaleState(camera, galaxy).scaleStage, 'Galactic');
  }
});

test('natural satellites preserve identities, deterministic stars and bounded family relationships', () => {
  for (const count of [96, 24000, 50000]) {
    const world = createCatalog({ catalog: count, budget: 'safe', target: 'Luna' });
    const moon = resolveCatalogTarget(world, 'Moon');
    assert.equal(world.activeId, moon.id);
    assert.equal(moon.kind, 'moon');
    assert.equal(catalogBody(world, moon.id), moon);
    assert.ok(![...world.stars, ...world.planets, ...world.nebulae].some(body => body.id === moon.id));
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.deepEqual(world.stars, createCatalog({ catalog: count, budget: 'safe' }).stars);
    const earth = bodyRelations(world, moon.id).parent;
    assert.equal(earth.name, 'Earth');
    assert.ok(bodyRelations(world, earth.id).children.some(body => body.id === moon.id));
    assert.equal(bodyRelations(world, earth.id).parent.name, 'Sol');
    assert.deepEqual(bodyRelations(world, -1), { parent: null, children: [] });
  }
});

test('a lunar arrival frames its parent world across aspect ratios and stays interruptible', () => {
  const moon = resolveCatalogTarget(catalog, 'Moon');
  const earth = bodyRelations(catalog, moon.id).parent;
  for (const reducedMotion of [false, true]) {
    const camera = createCamera(earth, { reducedMotion });
    focusCamera(camera, earth); arrive(camera);
    focusCamera(camera, moon); arrive(camera);
    assert.equal(camera.activeId, moon.id);
    assert.equal(camera.observedId, moon.id);
    for (const [width, height] of [[1280, 720], [390, 844]]) {
      const frame = cameraFrame(camera, width / height);
      assert.ok(projectPoint(earth.position, frame, width, height).visible);
      assert.ok(projectPoint(moon.position, frame, width, height).visible);
      const distance = Math.hypot(...earth.position.map((value, i) => value - frame.eye[i]));
      const ray = earth.position.map((value, i) => (value - frame.eye[i]) / distance);
      assert.ok(Number.isFinite(bodyRayIntersection(earth, frame.eye, ray)));
    }
    const before = cameraFrame(camera).yaw;
    orbitCamera(camera, 45, -10); advance(camera, 0.2);
    assert.notEqual(cameraFrame(camera).yaw, before);
    resetCamera(camera, moon); arrive(camera);
    assert.equal(camera.activeId, moon.id);
    assert.equal(scaleState(camera, moon).scaleStage, 'Galactic');
  }
  const camera = createCamera(earth);
  focusCamera(camera, earth); arrive(camera);
  focusCamera(camera, moon); advance(camera, 0.3);
  cancelCameraFlight(camera);
  const held = cameraFrame(camera);
  advance(camera);
  assert.deepEqual(cameraFrame(camera), held);
  assert.equal(camera.activeId, moon.id);
  assert.equal(camera.observedId, earth.id);
});

function advance(camera, seconds = 4) {
  let now = camera.now || 0;
  for (let step = 0; step < Math.ceil(seconds * 60); step++) {
    now += 1000 / 60;
    updateCamera(camera, 1 / 60, now);
  }
  return camera;
}

function arrive(camera) {
  for (let step = 0; step < 1200; step++) {
    updateCamera(camera, 1 / 60, camera.now + 1000 / 60);
    if (!camera.flight && camera.distance === camera.distanceTarget) return camera;
  }
  assert.fail('Navigation did not reach its requested view within the bounded journey.');
}

test('revisiting a body restores its distance and orientation through the existing interruptible flight', () => {
  const earth = resolveCatalogTarget(catalog, 'Earth');
  const moon = resolveCatalogTarget(catalog, 'Moon');
  const saved = { distance: moon.radius * 4.3, yaw: 7.2, pitch: .1707351658126385, roll: .17 };
  for (const reducedMotion of [false, true]) {
    const camera = createCamera(earth, { reducedMotion });
    focusCamera(camera, earth); arrive(camera);
    const departure = cameraFrame(camera);
    focusCamera(camera, moon, camera.now, saved);
    if (!reducedMotion) {
      advance(camera, .3);
      assert.equal(camera.observedId, earth.id);
      assert.equal(camera.activeId, moon.id);
      assert.equal(camera.yaw, departure.yaw);
      cancelCameraFlight(camera);
      const held = cameraFrame(camera);
      advance(camera, 1);
      assert.deepEqual(cameraFrame(camera), held);
      focusCamera(camera, moon, camera.now, saved);
    }
    advance(camera, 5);
    assert.equal(camera.activeId, moon.id);
    assert.equal(camera.observedId, moon.id);
    close(camera.distance, saved.distance, 1e-12);
    close(camera.yaw, saved.yaw, 1e-12);
    assert.equal(camera.pitch, saved.pitch);
    close(camera.roll, saved.roll, 1e-12);
    assert.deepEqual(camera.focus, moon.position);
    for (const aspect of [390 / 844, 1280 / 720]) {
      const frame = cameraFrame(camera, aspect);
      const center = projectPoint(moon.position, frame, 390, 844);
      close(center.x, 195);
      close(center.y, 422);
    }
    orbitCamera(camera, 30, 20); advance(camera, .5);
    assert.notEqual(camera.yaw, saved.yaw);
    focusCamera(camera, moon, camera.now); arrive(camera);
    close(camera.distance, moon.radius * 6, 1e-12);
    close(camera.yaw, moon.arrivalView.yaw, 1e-12);
    close(camera.pitch, moon.arrivalView.pitch, 1e-12);
    focusCamera(camera, moon, camera.now, { ...saved, distance: 1000 }); arrive(camera);
    assert.equal(camera.distance, camera.maxDistance);
    focusCamera(camera, moon, camera.now, { ...saved, distance: 1e-15 }); arrive(camera);
    assert.equal(camera.distance, camera.minDistance);
  }
});

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} should be within ${tolerance} of ${expected}`);
}

function offset(origin, direction, distance) {
  return origin.map((value, index) => value + direction[index] * distance);
}

function validVector(vector) {
  assert.equal(vector.length, 3);
  assert.ok(vector.every(Number.isFinite));
}

test('catalog generation is deterministic, including auxiliary dust', () => {
  const options = { seed: 439, catalog: 96, budget: 'safe' };
  const first = createCatalog(options);
  const second = createCatalog(options);
  assert.deepEqual(first.stars, second.stars);
  assert.deepEqual(first.dust, second.dust);
  assert.deepEqual(first.environment, second.environment);
  assert.deepEqual(first.drawIndices, second.drawIndices);
  assert.notDeepEqual(first.stars.map((star) => star.position),
    createCatalog({ ...options, seed: 440 }).stars.map((star) => star.position));
});

test('catalog identity and geometry are valid; explicit and invalid targets resolve safely', () => {
  assert.ok(sol, 'the default catalog contains Sol');
  assert.equal(catalog.activeId, sol.id);
  assert.equal(new Set(catalog.stars.map((star) => star.id)).size, catalog.count);
  for (const star of catalog.stars) {
    validVector(star.position);
    validVector(star.color);
    assert.ok(star.color.every((value) => value >= 0));
    assert.ok(Number.isFinite(star.radius) && star.radius > 0);
    assert.ok(Number.isFinite(star.luminosity) && star.luminosity > 0);
  }
  const target = catalog.stars.find((star) => star.name && star.id !== sol.id);
  assert.ok(target, 'named alternatives are available for explicit selection');
  assert.equal(createCatalog({ target: target.name.toLowerCase() }).activeId, target.id);
  assert.equal(createCatalog({ target: String(target.id) }).activeId, target.id);
  assert.equal(createCatalog({ target: 'missing-target' }).activeId, sol.id);
});

test('catalog growth does not increase rendering or label budgets', () => {
  for (const budget of ['safe', 'standard', 'immersive']) {
    const small = createCatalog({ budget, catalog: 256 });
    const large = createCatalog({ budget, catalog: 50000 });
    assert.equal(small.count, 256);
    assert.equal(large.count, 50000);
    assert.deepEqual(small.budget, large.budget);
    for (const generated of [small, large]) {
      assert.equal(generated.stars.length, generated.count);
      assert.ok(generated.drawIndices.length + generated.bodies.length <= generated.budget.draw);
      assert.ok(generated.dust.length <= generated.budget.dust);
      assert.equal(generated.galaxyReferences.length,generated.budget.galaxyReferences);
      for (const kind of ['sky', 'transit']) {
        assert.ok(generated.environment[kind].length > 0);
        assert.ok(generated.environment[kind].length <= generated.budget[kind]);
      }
      assert.ok(generated.budget.labels > 0 && generated.budget.labels < generated.count);
      assert.equal(new Set(generated.drawIndices).size, generated.drawIndices.length);
      assert.ok(generated.drawIndices.every((index) =>
        Number.isInteger(index) && index >= 0 && index < generated.count));
      assert.ok(generated.drawIndices.some((index) =>
        generated.stars[index].id === generated.activeId));
    }
  }
});

test('an explicit target remains drawn even outside the default representative sample', () => {
  const selected = createCatalog({ catalog: 50000, budget: 'safe', target: '49999' });
  assert.equal(selected.activeId, 49999);
  assert.ok(selected.drawIndices.some((index) => selected.stars[index].id === selected.activeId));
  assert.ok(selected.drawIndices.length <= selected.budget.draw);
});

test('projection is perspective, aspect-correct, and excludes points behind the camera', () => {
  const camera = createCamera(sol);
  const frame = cameraFrame(camera, 2);
  const center = offset(frame.eye, frame.forward, 10);
  const near = projectPoint(offset(center, frame.right, 1), frame, 1000, 500);
  const far = projectPoint(offset(offset(frame.eye, frame.forward, 20), frame.right, 1), frame, 1000, 500);
  const vertical = projectPoint(offset(center, frame.up, 1), frame, 1000, 500);
  const centered = projectPoint(center, frame, 1000, 500);
  close(centered.x, 500);
  close(centered.y, 250);
  assert.ok(near.visible && far.visible && vertical.visible);
  close(near.x - 500, (far.x - 500) * 2);
  close(near.x - 500, 250 - vertical.y);
  assert.equal(projectPoint(offset(frame.eye, frame.forward, -1), frame, 1000, 500).visible, false);
});

test('reading composition preserves the world pose and uses reciprocal projection and picking rays', () => {
  for (const body of [sol, ...catalog.planets, ...catalog.dwarfplanets, ...catalog.asteroids, ...catalog.moons]) {
    const camera = createCamera(body, { reducedMotion: true });
    focusCamera(camera, body); arrive(camera);
    for (const [width, height, center] of [[1280, 720, [0.5, 0.5]], [390, 844, [0.5, 0.29]], [844, 390, [0.7, 0.5]]]) {
      const full = cameraFrame(camera, width / height);
      const reading = cameraFrame(camera, width / height, center);
      for (const key of ['eye', 'focus', 'forward', 'right', 'up', 'yaw', 'pitch', 'fov', 'distance', 'observedId']) {
        assert.deepEqual(reading[key], full[key]);
      }
      const projected = projectPoint(body.position, reading, width, height);
      close(projected.x, width * center[0]);
      close(projected.y, height * center[1]);
      assert.ok(Number.isFinite(bodyRayIntersection(body, reading.eye, screenRay(projected.x, projected.y, reading, width, height))));
      for (const [x, y] of [[width * 0.3, height * 0.2], [width * 0.8, height * 0.7]]) {
        const ray = screenRay(x, y, reading, width, height);
        close(Math.hypot(...ray), 1);
        const point = offset(reading.eye, ray, body.radius * 20);
        const back = projectPoint(point, reading, width, height);
        close(back.x, x);
        close(back.y, y);
        assert.ok(back.visible);
      }
    }
  }
});

test('wheel zoom preserves focus and traverses ordered scale stages', () => {
  const camera = createCamera(sol);
  const seen = new Set();
  let previousDistance = cameraFrame(camera, 1).distance;
  let previousProgress = scaleState(camera, sol).scaleAxisProgress;
  let previousStage = -1;
  for (let step = 0; step < 240; step++) {
    zoomCamera(camera, -120);
    advance(camera, 0.25);
    const frame = cameraFrame(camera, 1);
    const state = scaleState(camera, sol);
    assert.equal(camera.activeId, sol.id);
    assert.ok(frame.distance <= previousDistance + 1e-9);
    assert.ok(state.scaleAxisProgress >= previousProgress - 1e-9);
    assert.ok(state.scaleAxisProgress >= 0 && state.scaleAxisProgress <= 1);
    const stage = stages.indexOf(state.scaleStage);
    assert.ok(stage >= previousStage, `scale stage reversed: ${state.scaleStage}`);
    seen.add(state.scaleStage);
    previousDistance = frame.distance;
    previousProgress = state.scaleAxisProgress;
    previousStage = stage;
  }
  assert.deepEqual([...seen], stages);
  advance(camera);
  const atSurface = scaleState(camera, sol);
  close(cameraFrame(camera, 1).distance, atSurface.minDistance, 1e-8);
  close(atSurface.scaleAxisProgress, 1);
  assert.ok(atSurface.minDistance > sol.radius, 'the camera remains outside the photosphere');
});

test('zoom limits are finite and both endpoints are reachable without changing identity', () => {
  const camera = createCamera(sol);
  for (const direction of [-1, 1]) {
    for (let step = 0; step < 80; step++) zoomCamera(camera, direction * 10000);
    advance(camera, 8);
    const frame = cameraFrame(camera, 1);
    const state = scaleState(camera, sol);
    assert.ok(Number.isFinite(frame.distance));
    assert.equal(camera.activeId, sol.id);
    close(frame.distance, direction < 0 ? state.minDistance : state.maxDistance, 1e-7);
    close(state.scaleAxisProgress, direction < 0 ? 1 : 0);
  }
});

test('Galactic entry and return share a composition while manual retreat retains the wider range', () => {
  for(const reducedMotion of [false,true]) {
    const camera=createCamera(sol,{reducedMotion}), entry=camera.distance;
    assert.equal(scaleState(camera,sol).scaleStage,'Galactic');
    assert.ok(entry<camera.maxDistance);
    zoomCamera(camera,10000);advance(camera,8);
    close(camera.distance,camera.maxDistance,1e-7);
    orbitCamera(camera,24,-12);advance(camera,.5);
    const pose=[camera.yaw,camera.pitch,camera.roll];
    resetCamera(camera,sol,camera.now);arrive(camera);
    close(camera.distance,entry,1e-9);
    assert.deepEqual([camera.yaw,camera.pitch,camera.roll],pose);
    assert.equal(camera.observedId,sol.id);assert.equal(camera.activeId,sol.id);
  }
});

test('explicit focus arrives at the selected star and allows further inward travel', () => {
  const other = catalog.stars.find((star) => star.id !== sol.id && star.name);
  const camera = createCamera(sol);
  focusCamera(camera, other, 0);
  arrive(camera);
  assert.equal(camera.activeId, other.id);
  const arrival = cameraFrame(camera, 1);
  const projected = projectPoint(other.position, arrival, 800, 800);
  close(projected.x, 400, 0.01);
  close(projected.y, 400, 0.01);
  assert.equal(scaleState(camera, other).scaleStage, 'Surface');
  assert.ok(arrival.distance > scaleState(camera, other).minDistance);
  zoomCamera(camera, -1000);
  advance(camera);
  assert.ok(cameraFrame(camera, 1).distance < arrival.distance);
  assert.equal(camera.activeId, other.id);
  resetCamera(camera, sol, camera.now || 10000);
  arrive(camera);
  assert.equal(camera.activeId, sol.id);
  assert.equal(scaleState(camera, sol).scaleStage, 'Galactic');
});

test('a close target switch preserves the departure view and hands over the surface only at starlight scale', () => {
  const sirius = findCatalogTarget(catalog.stars, 'Sirius');
  const giant = findCatalogTarget(catalog.stars, 'Betelgeuse');
  for (const [origin, destination] of [[sol, sirius], [sirius, giant], [giant, sol]]) {
    const camera = createCamera(origin);
    focusCamera(camera, origin, 0);
    arrive(camera);
    zoomCamera(camera, -220);
    advance(camera, 1);
    const before = cameraFrame(camera, 1);
    focusCamera(camera, destination, camera.now);
    const selected = cameraFrame(camera, 1);
    assert.equal(camera.activeId, destination.id, 'selection records the intended destination');
    assert.equal(selected.observedId, origin.id, 'the departure body remains the visible reference');
    for (const key of ['eye', 'focus', 'forward', 'right', 'up']) assert.deepEqual(selected[key], before[key]);
    close(selected.distance, before.distance);
    close(selected.fov, before.fov);
    let previous = selected;
    let handedOver = false;
    for (let step = 0; step < 900 && camera.flight; step++) {
      updateCamera(camera, 1 / 60, camera.now + 1000 / 60);
      const frame = cameraFrame(camera, 1);
      const subject = catalog.stars[frame.observedId];
      const distance = Math.hypot(...subject.position.map((value, i) => value - frame.eye[i]));
      assert.ok(distance > subject.radius, 'the camera stays outside the visible photosphere');
      validVector(frame.eye);
      if (frame.observedId !== previous.observedId) {
        assert.equal(frame.observedId, destination.id);
        assert.equal(handedOver, false, 'there is one surface handover');
        handedOver = true;
        for (const [body, view] of [[origin, previous], [destination, frame]]) {
          const separation = Math.hypot(...body.position.map((value, i) => value - view.eye[i]));
          const pixels = 450 / Math.tan(view.fov / 2) * body.radius / separation;
          assert.ok(pixels < 2, 'the handover happens when both bodies are unresolved starlight');
        }
      }
      previous = frame;
    }
    assert.ok(handedOver);
    assert.equal(previous.observedId, destination.id);
    const arrived = projectPoint(destination.position, previous, 900, 900);
    close(arrived.x, 450, 0.01);
    close(arrived.y, 450, 0.01);
    assert.equal(scaleState(camera).scaleStage, 'Surface');
  }
});

test('stopping or steering during departure retains the observed star and permits navigation or return', () => {
  const destination = findCatalogTarget(catalog.stars, 'Sirius');
  for (const action of ['cancel', 'orbit']) {
    const camera = createCamera(sol);
    focusCamera(camera, sol, 0);
    arrive(camera);
    focusCamera(camera, destination, camera.now);
    advance(camera, 0.25);
    if (action === 'cancel') cancelCameraFlight(camera);
    else orbitCamera(camera, 30, 12);
    const directed = cameraFrame(camera, 1);
    assert.equal(camera.activeId, destination.id);
    assert.equal(directed.observedId, sol.id);
    if (action === 'cancel') {
      advance(camera, 6);
      const held = cameraFrame(camera, 1);
      for (const key of ['eye', 'focus', 'forward']) assert.deepEqual(held[key], directed[key]);
    }
    zoomCamera(camera, -200);
    advance(camera, 1);
    assert.equal(cameraFrame(camera).observedId, sol.id);
    assert.ok(cameraFrame(camera).distance < directed.distance);
    focusCamera(camera, destination, camera.now);
    arrive(camera);
    assert.equal(cameraFrame(camera).observedId, destination.id);
    resetCamera(camera, destination, camera.now);
    arrive(camera);
    assert.equal(camera.activeId, destination.id);
    assert.equal(scaleState(camera).scaleStage, 'Galactic');
  }
});

test('reduced motion bypasses a close transfer and resolves the selected destination', () => {
  const destination = findCatalogTarget(catalog.stars, 'Betelgeuse');
  const camera = createCamera(sol);
  focusCamera(camera, sol, 0);
  arrive(camera);
  focusCamera(camera, destination, camera.now);
  advance(camera, 0.15);
  assert.equal(cameraFrame(camera).observedId, sol.id);
  setReducedMotion(camera, true);
  advance(camera, 0.1);
  assert.equal(camera.activeId, destination.id);
  assert.equal(cameraFrame(camera).observedId, destination.id);
  assert.equal(scaleState(camera).scaleStage, 'Surface');
});

test('orbit changes the viewing direction while retaining target and safe finite geometry', () => {
  const camera = createCamera(sol);
  focusCamera(camera, sol, 0);
  arrive(camera);
  const before = cameraFrame(camera, 1);
  orbitCamera(camera, 250, 80);
  advance(camera, 0.2);
  const after = cameraFrame(camera, 1);
  assert.notDeepEqual(after.forward, before.forward);
  assert.equal(camera.activeId, sol.id);
  close(after.distance, before.distance, 1e-6);
  for (let step = 0; step < 100; step++) orbitCamera(camera, 1000, 1000);
  advance(camera);
  const extreme = cameraFrame(camera, 0.5);
  for (const vector of [extreme.eye, extreme.forward, extreme.right, extreme.up]) validVector(vector);
  const projected = projectPoint(sol.position, extreme, 500, 1000);
  assert.ok(projected.visible);
});

test('reduced motion removes automatic movement while preserving direct navigation and endpoints', () => {
  const camera = createCamera(sol, { reducedMotion: true });
  const initial = cameraFrame(camera, 1);
  advance(camera, 10);
  assert.deepEqual(cameraFrame(camera, 1).forward, initial.forward);
  orbitCamera(camera, 120, 30);
  const directed = cameraFrame(camera, 1);
  assert.notDeepEqual(directed.forward, initial.forward);
  advance(camera, 3);
  assert.deepEqual(cameraFrame(camera, 1).forward, directed.forward);
  const other = catalog.stars.find((star) => star.id !== sol.id && star.name);
  focusCamera(camera, other, camera.now);
  assert.equal(camera.activeId, other.id);
  assert.equal(scaleState(camera, other).scaleStage, 'Surface');
  const arrival = cameraFrame(camera, 1);
  const projected = projectPoint(other.position, arrival, 800, 800);
  close(projected.x, 400);
  close(projected.y, 400);
  assert.ok(arrival.distance > scaleState(camera, other).minDistance);
  zoomCamera(camera, -800);
  advance(camera);
  assert.ok(cameraFrame(camera, 1).distance < arrival.distance);
  resetCamera(camera, sol, camera.now);
  assert.equal(camera.activeId, sol.id);
  assert.equal(scaleState(camera, sol).scaleStage, 'Galactic');
  close(cameraFrame(camera, 1).distance, initial.distance);
});

test('holding a drag does not integrate extra movement between pointer updates', () => {
  const camera = createCamera(sol);
  camera.dragging = true;
  orbitCamera(camera, 120, 40);
  const directed = cameraFrame(camera, 1);
  advance(camera, 1);
  assert.deepEqual(cameraFrame(camera, 1).forward, directed.forward);
  orbitCamera(camera, 30, 10);
  const beforeRelease = cameraFrame(camera, 1);
  camera.dragging = false;
  advance(camera, 0.1);
  assert.notDeepEqual(cameraFrame(camera, 1).forward, beforeRelease.forward,
    'releasing the pointer preserves the intended inertial continuation');
});


test('cancelling a flight holds its current pose until explicit navigation resumes', () => {
  const camera = createCamera(sol);
  const other = catalog.stars.find((star) => star.id !== sol.id && star.name);
  focusCamera(camera, other, 0);
  advance(camera, 0.9);
  const inTransit = cameraFrame(camera, 1);
  cancelCameraFlight(camera);
  advance(camera, 10);
  assert.deepEqual(cameraFrame(camera, 1), inTransit);
  assert.equal(camera.activeId, other.id);
  zoomCamera(camera, -240);
  advance(camera, 1);
  assert.ok(cameraFrame(camera, 1).distance < inTransit.distance);
  resetCamera(camera, sol, camera.now);
  arrive(camera);
  assert.equal(camera.activeId, sol.id);
  assert.equal(scaleState(camera, sol).scaleStage, 'Galactic');
});


test('auxiliary environments have deterministic bounded geometry independent of catalog size', () => {
  const small = createCatalog({ seed: 928, catalog: 128, budget: 'safe' });
  const large = createCatalog({ seed: 928, catalog: 50000, budget: 'safe' });
  assert.deepEqual(small.environment, large.environment);
  for (const kind of ['sky', 'transit']) {
    for (const particle of small.environment[kind]) {
      validVector(particle.position);
      validVector(particle.color);
      assert.ok(particle.color.every((value) => value >= 0 && value <= 1));
      assert.ok(Number.isFinite(particle.size) && particle.size > 0);
      assert.ok(Number.isFinite(particle.luminosity) && particle.luminosity >= 0);
      const radius = Math.hypot(...particle.position);
      if (kind === 'sky') close(radius, 1);
      else assert.ok(radius > 1, 'local particles remain outside the photosphere');
    }
  }
});

test('the internal galactic panorama follows observer space continuously and reversibly', () => {
  assert.equal(galacticInteriorPresence([7.4, 0.12, 1.8]), 1);
  assert.equal(galacticInteriorPresence([40, 8, 0]), 0);
  const camera = createCamera(sol);
  const weights = [];
  for (let step = 0; step <= 400; step++) {
    camera.distance = Math.exp(Math.log(camera.maxDistance) * (1 - step / 400) + Math.log(camera.minDistance) * step / 400);
    const eye = cameraFrame(camera, 16 / 9).eye;
    const weight = galacticInteriorPresence(eye);
    assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1);
    const angle = step * 0.13;
    const rotated = [Math.cos(angle) * eye[0] + Math.sin(angle) * eye[2], eye[1], -Math.sin(angle) * eye[0] + Math.cos(angle) * eye[2]];
    close(galacticInteriorPresence(rotated), weight);
    const adjacent = eye.map(value => value * (1 + 1e-6));
    assert.ok(Math.abs(galacticInteriorPresence(adjacent) - weight) < 0.001);
    weights.push({ eye, weight });
  }
  assert.equal(weights[0].weight, 0);
  assert.equal(weights.at(-1).weight, 1);
  for (const { eye, weight } of weights.reverse()) assert.equal(galacticInteriorPresence(eye), weight);
});

test('environment transitions remain finite, bounded, and locally continuous through the complete distance range', () => {
  const camera = createCamera(sol);
  const { minDistance, maxDistance } = scaleState(camera, sol);
  const keys = ['galaxyPresence', 'skyPresence', 'transitPresence', 'immersion'];
  const samples = [];
  for (let step = 0; step <= 1000; step++) {
    const distance = Math.exp(Math.log(maxDistance) * (1 - step / 1000) + Math.log(minDistance) * step / 1000);
    camera.distance = distance;
    const current = environmentState(camera, sol);
    camera.distance = distance * (1 + 1e-6);
    const adjacent = environmentState(camera, sol);
    for (const key of keys) {
      assert.ok(Number.isFinite(current[key]) && current[key] >= 0 && current[key] <= 1);
      assert.ok(Math.abs(current[key] - adjacent[key]) < 0.001, `${key} jumped for an infinitesimal distance change`);
    }
    samples.push(current);
  }
  assert.ok(samples[0].galaxyPresence > samples.at(-1).galaxyPresence);
  assert.ok(samples[0].skyPresence < samples.at(-1).skyPresence);
  assert.ok(samples[0].immersion < samples.at(-1).immersion);
});

test('the fixed orbit lens keeps projection centered and orthonormal across aspect ratios', () => {
  const camera = createCamera(sol);
  const { minDistance, maxDistance } = scaleState(camera, sol);
  camera.focus = sol.position.slice();
  const baseline = cameraFrame(camera, 1.6);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  for (let step = 0; step <= 120; step++) {
    camera.distance = Math.exp(Math.log(maxDistance) * (1 - step / 120) + Math.log(minDistance) * step / 120);
    for (const aspect of [0.6, 1, 1.6]) {
      const frame = cameraFrame(camera, aspect);
      assert.ok(Number.isFinite(frame.fov) && frame.fov > 0 && frame.fov < Math.PI);
      for (const vector of [frame.forward, frame.right, frame.up]) close(Math.hypot(...vector), 1);
      close(dot(frame.forward, frame.right), 0);
      close(dot(frame.forward, frame.up), 0);
      close(dot(frame.right, frame.up), 0);
      const projected = projectPoint(sol.position, frame, 800 * aspect, 800);
      assert.ok(projected.visible);
      close(projected.x, 400 * aspect, 1e-5);
      close(projected.y, 400, 1e-5);
    }
    const directed = cameraFrame(camera, 1.6);
    for (const key of ['yaw', 'pitch', 'roll', 'fov']) close(directed[key], baseline[key]);
    camera.reducedMotion = true;
    const reduced = cameraFrame(camera, 1.6);
    close(reduced.yaw, camera.yaw);
    close(reduced.pitch, camera.pitch);
    camera.reducedMotion = false;
  }
});


test('live reduced-motion toggles preserve the effective pose at either pitch limit after cancellation', () => {
  for (const direction of [-1, 1]) {
    for (const reducedMotion of [false, true]) {
      const camera = createCamera(sol, { reducedMotion });
      focusCamera(camera, sol, 0);
      arrive(camera);
      orbitCamera(camera, 0, direction * 10000);
      cancelCameraFlight(camera);
      const before = cameraFrame(camera, 1.4);
      for (let toggle = 0; toggle < 4; toggle++) {
        setReducedMotion(camera, !camera.reducedMotion);
        advance(camera, 2);
        const after = cameraFrame(camera, 1.4);
        for (const key of ['yaw', 'pitch', 'roll', 'fov', 'distance']) close(after[key], before[key], 1e-9);
        for (let axis = 0; axis < 3; axis++) close(after.eye[axis], before.eye[axis], 1e-9);
      }
      orbitCamera(camera, 40, -direction * 50);
      const dragged = cameraFrame(camera, 1.4);
      assert.ok(Math.abs(dragged.pitch) < Math.abs(before.pitch));
      assert.notEqual(dragged.yaw, before.yaw);
    }
  }
});

test('destination lookup resolves existing catalog identities and rejects unknown targets', () => {
  const sirius = catalog.stars.find(star => star.name === 'Sirius');
  assert.equal(findCatalogTarget(catalog.stars, 'Sirius'), sirius);
  assert.equal(findCatalogTarget(catalog.stars, ' sirius '), sirius);
  assert.equal(findCatalogTarget(catalog.stars, sirius.id), sirius);
  for (const invalid of ['', null, undefined, 'missing star', -1, 50001]) assert.equal(findCatalogTarget(catalog.stars, invalid), null);
});

test('returning to the map retains the observed target and permits another approach', () => {
  for (const reducedMotion of [false, true]) {
    const star = findCatalogTarget(catalog.stars, 'Sirius');
    const camera = createCamera(sol, { reducedMotion });
    focusCamera(camera, star, camera.now);
    arrive(camera);
    resetCamera(camera, star, camera.now);
    arrive(camera);
    assert.equal(camera.activeId, star.id);
    assert.equal(scaleState(camera, star).scaleStage, 'Galactic');
    zoomCamera(camera, -900);
    advance(camera);
    assert.equal(camera.activeId, star.id);
    focusCamera(camera, star, camera.now);
    arrive(camera);
    assert.equal(scaleState(camera, star).scaleStage, 'Surface');
    assert.equal(camera.activeId, star.id);
  }
});

test('a return flight keeps the departure star in view through the nearby scales', () => {
  for (const name of ['Sol', 'Sirius', 'Betelgeuse']) {
    const star = findCatalogTarget(catalog.stars, name);
    const camera = createCamera(star);
    focusCamera(camera, star, camera.now);
    arrive(camera);
    resetCamera(camera, star, camera.now);
    for (let step = 0; step < 900 && camera.flight; step++) {
      updateCamera(camera, 1 / 60, camera.now + 1000 / 60);
      if (['Surface', 'LocalSystem', 'LocalMap'].includes(scaleState(camera, star).scaleStage)) {
        for (const aspect of [0.6, 1.6]) {
          const projected = projectPoint(star.position, cameraFrame(camera, aspect), 800 * aspect, 800);
          assert.ok(projected.visible, `${name} disappeared before leaving the nearby scales`);
        }
      }
    }
    assert.equal(scaleState(camera, star).scaleStage, 'Galactic');
    assert.equal(camera.activeId, star.id);
  }
});

test('reading fits the whole body under one lens, with explicit local terrain, cloud and nucleus inspection allowed to crop', () => {
  for (const name of ['Sol', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Chariklo', 'Quaoar', 'PDS 70 c', 'Moon', "Halley's Comet", 'Wild 2', 'Tempel 1', '67P']) {
    const body = resolveCatalogTarget(catalog, name);
    const camera = createCamera(body, { reducedMotion: true });
    for (const [width, height, area] of [
      [390,844,{x:16,y:127,width:358,height:240}],
      [320,568,{x:16,y:110,width:288,height:150}],
      [844,390,{x:400,y:80,width:374,height:234}],
      [701,844,{x:392,y:112,width:239,height:656}],
      [1143,853,{x:392,y:112,width:681,height:665}],
      [1920,1080,{x:392,y:112,width:1458,height:892}],
    ]) {
      let lens;
      const inspection=localInspectionRange(body);
      const wholeProgress=inspection ? Math.log(camera.maxDistance/(body.radius*inspection.reading))/Math.log(camera.maxDistance/camera.minDistance) : 1;
      for (const progress of [1,wholeProgress,0.90,0.70,0.40,0]) {
        setCameraScale(camera, progress); arrive(camera);
        const center = [(area.x+area.width/2)/width,(area.y+area.height/2)/height];
        const frame = cameraFrame(camera, width/height, center);
        const pose = structuredClone(frame);
        const scale = readingLensScale(frame, body, camera.minDistance, width, height, area);
        frame.fov = 2*Math.atan(Math.tan(frame.fov/2)/scale);
        if (lens !== undefined) close(frame.fov,lens,1e-9);
        lens = frame.fov;
        for (const key of ['eye','focus','forward','right','up','yaw','pitch','distance','observedId']) assert.deepEqual(frame[key],pose[key]);
        const projected = projectPoint(body.position,frame,width,height);
        close(projected.x,area.x+area.width/2,1e-3); close(projected.y,area.y+area.height/2,1e-3);
        assert.ok(Number.isFinite(bodyRayIntersection(body,frame.eye,screenRay(projected.x,projected.y,frame,width,height))));
        if (progress === wholeProgress) {
          // Sample the body's bounding sphere, including the full ring extent,
          // under several directions rather than mirroring the fit formula.
          const radius=body.radius*(body.rings?.outer || 1);
          for (let latitude=-90;latitude<=90;latitude+=10) for(let longitude=0;longitude<360;longitude+=10) {
            const p=latitude*Math.PI/180,y=longitude*Math.PI/180;
            const location=body.position.map((v,i)=>v+[Math.cos(p)*Math.cos(y),Math.sin(p),Math.cos(p)*Math.sin(y)][i]*radius);
            const point=projectPoint(location,frame,width,height);
            assert.ok(point.x>=area.x && point.x<=area.x+area.width && point.y>=area.y && point.y<=area.y+area.height,name);
          }
        }
        if(inspection && progress===1) {
          const radius=body.radius;
          let cropped=false;
          for(let latitude=-90;latitude<=90;latitude+=10) for(let longitude=0;longitude<360;longitude+=10) {
            const p=latitude*Math.PI/180,y=longitude*Math.PI/180;
            const location=body.position.map((v,i)=>v+[Math.cos(p)*Math.cos(y),Math.sin(p),Math.cos(p)*Math.sin(y)][i]*radius);
            const point=projectPoint(location,frame,width,height);
            cropped ||= point.x<area.x || point.x>area.x+area.width || point.y<area.y || point.y>area.y+area.height;
          }
          assert.ok(cropped,'Local inspection keeps the globe-reading lens rather than shrinking the body');
        }
        assert.equal(readingLensScale(pose,body,camera.minDistance,width,height,{x:0,y:0,width,height}),1);
      }
    }
  }
  const cloud=resolveCatalogTarget(catalog,'Orion Nebula'), camera=createCamera(cloud);
  assert.equal(readingLensScale(cameraFrame(camera),cloud,camera.minDistance,390,844,{width:358,height:240}),1);
});

test('scale navigation reaches meaningful stages for different bodies while retaining identity', () => {
  for (const name of ['Sol', 'Sirius', 'Betelgeuse', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Orion Nebula']) {
    const star = resolveCatalogTarget(catalog, name);
    for (const reducedMotion of [false, true]) {
      const camera = createCamera(star, { reducedMotion });
      const stops = scaleStops(camera);
      assert.deepEqual(stops.map(stop => stop.stage), stages);
      assert.ok(stops.every(stop => Number.isFinite(stop.progress) && stop.progress >= 0 && stop.progress <= 1));
      assert.ok(stops.every((stop, index) => !index || stop.progress > stops[index - 1].progress));
      for (const stop of [...stops, ...stops.toReversed()]) {
        setCameraScale(camera, stop.progress);
        arrive(camera);
        assert.equal(scaleState(camera, star).scaleStage, stop.stage);
        assert.equal(camera.activeId, star.id);
      }
      for (const endpoint of [0, 1]) {
        setCameraScale(camera, endpoint);
        arrive(camera);
        close(scaleState(camera, star).scaleAxisProgress, endpoint, 1e-7);
      }
    }
  }
});

test('scale navigation can stop, resume, and interrupt flight without changing the target', () => {
  const star = findCatalogTarget(catalog.stars, 'Sirius');
  const camera = createCamera(sol);
  focusCamera(camera, star, camera.now);
  advance(camera, 0.6);
  const local = scaleStops(camera).find(stop => stop.stage === 'LocalMap');
  setCameraScale(camera, local.progress);
  assert.equal(camera.flight, null);
  advance(camera, 0.1);
  cancelCameraFlight(camera);
  const held = cameraFrame(camera, 1);
  advance(camera);
  assert.deepEqual(cameraFrame(camera, 1), held);
  setCameraScale(camera, local.progress);
  arrive(camera);
  assert.equal(scaleState(camera, star).scaleStage, 'LocalMap');
  assert.equal(camera.activeId, star.id);
  const valid = camera.distanceTarget;
  for (const invalid of [NaN, Infinity, undefined]) setCameraScale(camera, invalid);
  assert.equal(camera.distanceTarget, valid);
});

test('long radial travel exposes the ordered intermediate scales under one held lens', () => {
  for (const fps of [30, 60, 120]) {
    for (const intent of ['approach', 'scale', 'return']) {
      const camera = createCamera(sol);
      if (intent === 'return') {
        setCameraScale(camera, 1);
        arrive(camera);
        resetCamera(camera, sol);
      } else if (intent === 'approach') focusCamera(camera, sol);
      else setCameraScale(camera, 1);
      const before = cameraFrame(camera, 16 / 9);
      const seen = new Set([scaleState(camera, sol).scaleStage]);
      for (let step = 0; step < fps * 20; step++) {
        updateCamera(camera, 1 / fps, camera.now + 1000 / fps);
        const frame = cameraFrame(camera, 16 / 9);
        const projected = projectPoint(sol.position, frame, 1280, 720);
        close(projected.x, 640, 1e-5); close(projected.y, 360, 1e-5);
        for (const key of ['yaw', 'pitch', 'roll', 'fov']) close(frame[key], before[key], 1e-12);
        seen.add(scaleState(camera, sol).scaleStage);
        if (!camera.flight && camera.distance === camera.distanceTarget) break;
      }
      assert.equal(camera.flight, null);
      assert.equal(camera.distance, camera.distanceTarget);
      assert.deepEqual([...seen], intent === 'return' ? [...stages].reverse() : stages);
      assert.equal(camera.activeId, sol.id);
      assert.equal(camera.observedId, sol.id);
    }
  }
  const small = createCamera(sol);
  zoomCamera(small, -40);
  const requested = Math.abs(Math.log(small.distanceTarget / small.distance));
  const start = small.distance;
  advance(small, 0.3);
  assert.ok(Math.abs(Math.log(small.distance / start)) > requested * 0.8, 'short wheel input remains responsive');
  const reduced = createCamera(sol, { reducedMotion: true });
  setCameraScale(reduced, 1);
  updateCamera(reduced, 1 / 60, 1000 / 60);
  assert.equal(reduced.distance, reduced.distanceTarget, 'reduced motion resolves the requested scale directly');
});

test('wheel and orbit take over an ongoing scale request from the currently observed view', () => {
  for (const outward of [true, false]) {
    const camera = createCamera(sol);
    if (!outward) { focusCamera(camera, sol); arrive(camera); }
    setCameraScale(camera, outward ? 1 : 0);
    advance(camera, 0.5);
    const before = cameraFrame(camera);
    zoomCamera(camera, outward ? 120 : -120);
    assert.ok(outward ? camera.distanceTarget > before.distance : camera.distanceTarget < before.distance);
    advance(camera, 0.3);
    assert.ok(outward ? camera.distance > before.distance : camera.distance < before.distance);
    const after = cameraFrame(camera);
    for (const key of ['observedId', 'yaw', 'pitch', 'roll', 'fov']) assert.equal(after[key], before[key]);
  }
  const camera = createCamera(sol);
  setCameraScale(camera, 1);
  advance(camera, 0.5);
  const distance = camera.distance;
  orbitCamera(camera, 25, 10);
  assert.equal(camera.distanceTarget, distance);
  advance(camera, 2);
  assert.equal(camera.distance, distance);
  assert.equal(camera.observedId, sol.id);
});


test('solar planets have stable distinct identities without growing the shared draw budget', () => {
  for (const count of [64, 50000]) {
    const world = createCatalog({ catalog: count, target: 'Earth', budget: 'safe' });
    const earth = resolveCatalogTarget(world, 'EARTH');
    const saturn = resolveCatalogTarget(world, 'Saturn');
    const mars = resolveCatalogTarget(world, 'Mars');
    const jupiter = resolveCatalogTarget(world, 'Jupiter');
    assert.equal(world.activeId, earth.id);
    assert.notEqual(earth.id, saturn.id);
    assert.equal(new Set([earth.id, saturn.id, mars.id, jupiter.id]).size, 4);
    assert.equal(mars.kind, 'planet');
    assert.equal(mars.parentId, 0);
    assert.equal(catalogBody(world, mars.id), mars);
    assert.equal(createCatalog({ catalog: count, target: 'mars' }).activeId, mars.id);
    assert.equal(jupiter.kind, 'planet');
    assert.equal(catalogBody(world, jupiter.id), jupiter);
    assert.equal(createCatalog({ catalog: count, target: 'jUpItEr' }).activeId, jupiter.id);
    assert.equal(createCatalog({ catalog: count, target: String(jupiter.id) }).activeId, jupiter.id);
    assert.equal(bodyRelations(world, jupiter.id).parent.name, 'Sol');
    assert.ok(bodyRelations(world, 0).children.includes(jupiter));
    assert.ok(earth.id >= world.stars.length && saturn.id >= world.stars.length);
    assert.equal(catalogBody(world, earth.id), earth);
    assert.equal(catalogBody(world, 0).name, 'Sol');
    assert.equal(catalogBody(world, -1), null);
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.equal(createCatalog({ catalog: count, target: String(saturn.id) }).activeId, saturn.id);
    assert.deepEqual(world.stars, createCatalog({ catalog: count, target: 'Sol', budget: 'safe' }).stars);
  }
});

test('star-to-planet and planet-to-planet navigation retain departure, cancellation and return semantics', () => {
  const earth = catalog.planets.find(body => body.name === 'Earth');
  const saturn = catalog.planets.find(body => body.name === 'Saturn');
  const mars = resolveCatalogTarget(catalog, 'Mars');
  const camera = createCamera(sol);
  focusCamera(camera, sol); arrive(camera);
  focusCamera(camera, earth); advance(camera, 0.25);
  assert.equal(camera.activeId, earth.id);
  assert.equal(camera.observedId, sol.id);
  cancelCameraFlight(camera); const pose = cameraFrame(camera, 1);
  advance(camera, 2); assert.deepEqual(cameraFrame(camera, 1).eye, pose.eye);
  focusCamera(camera, earth); arrive(camera);
  assert.equal(camera.observedId, earth.id);
  assert.equal(scaleState(camera, earth).scaleStage, 'Surface');
  focusCamera(camera, mars); advance(camera, 0.25);
  assert.equal(camera.activeId, mars.id);
  assert.equal(camera.observedId, earth.id);
  cancelCameraFlight(camera); const held = cameraFrame(camera, 1);
  advance(camera, 2); assert.deepEqual(cameraFrame(camera, 1), held);
  focusCamera(camera, mars); arrive(camera);
  assert.equal(camera.observedId, mars.id);
  assert.equal(scaleState(camera, mars).scaleStage, 'Surface');
  focusCamera(camera, earth); arrive(camera);
  assert.equal(camera.observedId, earth.id);
  focusCamera(camera, saturn); arrive(camera);
  assert.equal(camera.observedId, saturn.id);
  assert.equal(scaleState(camera, saturn).scaleStage, 'Surface');
  assert.ok(camera.distance > saturn.radius * saturn.rings.outer);
  for (const aspect of [0.46, 1.78]) validVector(cameraFrame(camera, aspect).eye);
  resetCamera(camera, saturn); arrive(camera);
  assert.equal(camera.activeId, saturn.id);
  assert.equal(camera.observedId, saturn.id);
  assert.equal(scaleState(camera, saturn).scaleStage, 'Galactic');
  setReducedMotion(camera, true); focusCamera(camera, earth);
  assert.equal(camera.flight, null);
  assert.equal(camera.observedId, earth.id);
});

test('ring and globe intersections share one body identity and leave empty space and gaps unpicked', () => {
  const saturn = catalog.planets.find(body => body.name === 'Saturn');
  const origin = saturn.position.map((v, i) => v + [0, 4, 4][i] * saturn.radius);
  const directionTo = p => {
    const ray = p.map((v, i) => saturn.position[i] + v * saturn.radius - origin[i]);
    const length = Math.hypot(...ray); return ray.map(v => v / length);
  };
  assert.ok(Number.isFinite(bodyRayIntersection(saturn, origin, directionTo([0, 0, 0]))));
  assert.ok(Number.isFinite(bodyRayIntersection(saturn, origin, directionTo([1.6, 0, 0]))));
  assert.ok(Number.isFinite(bodyRayIntersection(saturn, origin, directionTo([-2.1, 0, 0]))));
  assert.equal(bodyRayIntersection(saturn, origin, directionTo([1.86, 0, 0])), Infinity);
  assert.equal(bodyRayIntersection(saturn, origin, directionTo([2.7, 0, 0])), Infinity);
  const away = directionTo([0, 0, 0]).map(v => -v);
  assert.equal(bodyRayIntersection(saturn, origin, away), Infinity);
  const withoutRings = { ...saturn, rings: undefined };
  assert.equal(bodyRayIntersection(withoutRings, origin, directionTo([1.6, 0, 0])), Infinity);
});

test('narrow planetary rings share the globe identity while their clear intervals remain unpicked', () => {
  const body=resolveCatalogTarget(catalog,'Uranus');
  const origin=body.position.map((v,i)=>v+[0,0,5][i]*body.radius);
  const towards=x=>{
    const ray=body.position.map((v,i)=>v+[x,0,0][i]*body.radius-origin[i]);
    return ray.map(v=>v/Math.hypot(...ray));
  };
  assert.ok(Number.isFinite(bodyRayIntersection(body,origin,towards(0))));
  for(const x of [1.59,1.85,2.0]) assert.ok(Number.isFinite(bodyRayIntersection(body,origin,towards(x))));
  for(const x of [1.3,1.7,1.92,2.1]) assert.equal(bodyRayIntersection(body,origin,towards(x)),Infinity);
});

test('ring crossings release invisible near-camera bands while retaining the globe and distant ring identity', () => {
  for(const body of catalog.bodies.filter(body=>body.rings)) {
    const normal=[0,Math.cos(body.tilt||0),Math.sin(body.tilt||0)];
    const rings=body.rings;
    const band=rings.bands?.[0] || [rings.inner,rings.gapInner>rings.inner?Math.min(rings.outer,rings.gapInner):rings.outer];
    const radius=(band[0]+band[1])/2;
    const point=body.position.map((v,i)=>v+(i===0?radius*body.radius:0));
    const ray=normal.map(v=>-v);
    const near=point.map((v,i)=>v+normal[i]*body.radius*.02);
    const distant=point.map((v,i)=>v+normal[i]*body.radius);
    assert.equal(bodyRayIntersection(body,near,ray),Infinity,body.name+' has no invisible click surface at the lens');
    assert.ok(Number.isFinite(bodyRayIntersection(body,distant,ray)),body.name+' retains its visible ring');
    const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);setCameraScale(camera,1);arrive(camera);
    const frame=cameraFrame(camera,16/9);
    assert.ok(Number.isFinite(bodyRayIntersection(body,frame.eye,frame.forward)),body.name+' retains its globe');
  }
});

test('extended nebula identities and aliases remain bounded and distinct from stars and planets', () => {
  for (const count of [96, 50000]) {
    const world = createCatalog({ catalog: count, budget: 'safe' });
    const nebula = resolveCatalogTarget(world, 'M 42');
    assert.equal(nebula.kind, 'nebula');
    for (const alias of ['Orion Nebula', 'NGC-1976', String(nebula.id)]) {
      assert.equal(resolveCatalogTarget(world, alias).id, nebula.id);
      assert.equal(createCatalog({ catalog: count, target: alias }).activeId, nebula.id);
    }
    assert.equal(catalogBody(world, nebula.id), nebula);
    assert.ok(!world.stars.some(body => body.id === nebula.id));
    assert.ok(!world.planets.some(body => body.id === nebula.id));
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    validVector(nebula.position);
    assert.ok(nebula.nearLimit > 0 && nebula.nearLimit < 1 && nebula.extent > 1);
  }
});

test('first entry reaches every current nebula interior within its existing near range and preserves the observing frame',()=>{
  for(const body of catalog.nebulae) for(const reducedMotion of [true,false]) {
    const camera=createCamera(body,{reducedMotion});focusCamera(camera,body);arrive(camera);
    const before=cameraFrame(camera);assert.ok(camera.distance>body.radius*body.extent);
    assert.equal(enterNebula(camera,body),true);advance(camera,5);
    assert.ok(camera.distance<body.radius*body.extent,body.name);
    assert.ok(camera.distance>=camera.minDistance*(1-1e-12),body.name);
    assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
    const after=cameraFrame(camera);assert.deepEqual(after.forward,before.forward);assert.deepEqual(after.up,before.up);
    assert.equal(after.fov,before.fov);
    zoomCamera(camera,400);advance(camera,5);assert.ok(camera.distance>body.radius*body.extent,body.name);
  }
  const camera=createCamera(sol),before=structuredClone(camera);
  assert.equal(enterNebula(camera,sol),false);assert.equal(enterNebula(camera,catalog.nebulae[0]),false);
  assert.deepEqual(camera,before);
});

test('a nebula can be entered, orbited and withdrawn from without an opaque sphere boundary', () => {
  const nebula = resolveCatalogTarget(catalog, 'Orion Nebula');
  for (const reducedMotion of [false, true]) {
    const camera = createCamera(nebula, { reducedMotion });
    focusCamera(camera, nebula, 0);
    arrive(camera);
    assert.ok(camera.distance > nebula.radius * nebula.extent);
    setCameraScale(camera, 1);
    advance(camera, 5);
    assert.ok(camera.distance < nebula.radius);
    assert.equal(scaleState(camera, nebula).scaleAxisProgress, 1);
    const before = cameraFrame(camera);
    orbitCamera(camera, 90, -15, 1400);
    const inside = cameraFrame(camera);
    assert.notDeepEqual(inside.forward, before.forward);
    validVector(inside.eye);
    assert.equal(bodyRayIntersection(nebula, inside.eye, inside.forward), Infinity);
    cancelCameraFlight(camera);
    advance(camera, 1);
    close(camera.distance, nebula.radius * nebula.nearLimit);
    resetCamera(camera, nebula, camera.now, { retainTarget: true });
    arrive(camera);
    assert.equal(camera.activeId, nebula.id);
    assert.equal(scaleState(camera, nebula).scaleStage, 'Galactic');
  }
});

test('leaving a nebula preserves its observation until the star takes over and restores the solid-body limit', () => {
  const nebula = resolveCatalogTarget(catalog, 'M42');
  const camera = createCamera(nebula);
  focusCamera(camera, nebula, 0);
  arrive(camera);
  setCameraScale(camera, 1);
  advance(camera, 5);
  focusCamera(camera, sol, camera.now);
  advance(camera, 0.3);
  assert.equal(camera.observedId, nebula.id);
  assert.equal(camera.activeId, sol.id);
  cancelCameraFlight(camera);
  const stopped = camera.distance;
  advance(camera, 1);
  close(camera.distance, stopped);
  focusCamera(camera, sol, camera.now);
  arrive(camera);
  assert.equal(camera.observedId, sol.id);
  setCameraScale(camera, 1);
  advance(camera, 5);
  assert.ok(camera.distance > sol.radius);
  close(camera.distance, sol.radius * 3.1);
});


test('all-scale orbit and zoom stay anchored without idle drift or implicit lens and pose changes', () => {
  for (const name of ['Sol', 'Sirius', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Moon', 'Orion Nebula']) {
    const body = resolveCatalogTarget(catalog, name);
    const camera = createCamera(body);
    const initial = cameraFrame(camera, 1.6);
    advance(camera, 20);
    assert.deepEqual(cameraFrame(camera, 1.6), initial, 'no input must leave the observation pose fixed');
    focusCamera(camera, body); arrive(camera);
    orbitCamera(camera, 65, -20); advance(camera, 2);
    zoomCamera(camera, 1);
    const directed = cameraFrame(camera, 1.6);
    for (const progress of [0, 0.15, 0.35, 0.70, 1, 0]) {
      setCameraScale(camera, progress);
      for (let step = 0; step < 900 && camera.distance !== camera.distanceTarget; step++) {
        updateCamera(camera, 1 / 60, camera.now + 1000 / 60);
        for (const [width, height] of [[1280,720],[390,844]]) {
          const frame = cameraFrame(camera, width / height);
          const target = projectPoint(body.position, frame, width, height);
          close(target.x, width / 2, 1e-3); close(target.y, height / 2, 1e-3);
          for (const key of ['yaw','pitch','roll']) close(frame[key], directed[key], 1e-9);
        }
      }
    }
    close(camera.distance, camera.maxDistance, 1e-5);
    resetCamera(camera, body); arrive(camera);
    close(camera.distance, initial.distance, 1e-5);
    const before = cameraFrame(camera, 1.6); advance(camera, 20);
    assert.deepEqual(cameraFrame(camera, 1.6), before);
  }
});


test('live quality budgets preserve world identity, geometry and both observation and destination', () => {
  const world = createCatalog({ catalog: 50000, seed: 83, target: '49999', budget: 'immersive' });
  const stars = world.stars, planets = world.planets, moons = world.moons, nebulae = world.nebulae;
  const observed = 49877, selected = 49999;
  const body = world.stars[observed], camera = createCamera(body);
  focusCamera(camera, body); arrive(camera);
  cancelCameraFlight(camera);
  const pose = cameraFrame(camera);
  for (const key of ['safe', 'standard', 'immersive', 'safe', 'unknown']) {
    setCatalogBudget(world, key, selected, observed);
    assert.equal(world.stars, stars); assert.equal(world.planets, planets);
    assert.equal(world.moons, moons); assert.equal(world.nebulae, nebulae);
    assert.ok(world.drawIndices.includes(selected) && world.drawIndices.includes(observed));
    assert.ok(world.drawIndices.length + world.bodies.length <= world.budget.draw);
    assert.ok(world.dust.length <= world.budget.dust);
    assert.ok(world.environment.sky.length <= world.budget.sky && world.environment.transit.length <= world.budget.transit);
    assert.deepEqual(cameraFrame(camera), pose);
    const regenerated = createCatalog({ catalog: world.count, seed: world.seed, budget: key });
    assert.deepEqual(world.stars, regenerated.stars);
    assert.deepEqual(world.dust, regenerated.dust);
    assert.deepEqual(world.environment, regenerated.environment);
  }
});


test('main-belt worlds keep solid identity, classification and bounded Solar membership', () => {
  for(const budget of ['safe','immersive']) {
    const world=createCatalog({budget,catalog:50000,target:'Ceres'});
    const ceres=resolveCatalogTarget(world,'Ceres'),vesta=resolveCatalogTarget(world,'Vesta');
    assert.equal(ceres.kind,'dwarfplanet');assert.equal(vesta.kind,'asteroid');
    assert.equal(world.planets.length,8);assert.equal(world.activeId,ceres.id);
    assert.ok(ceres.id!==vesta.id && !world.planets.includes(ceres) && !world.planets.includes(vesta));
    for(const body of [ceres,vesta]) {
      assert.equal(bodyRelations(world,body.id).parent,world.stars[0]);
      assert.ok(bodySystem(world,body.id).members.includes(body));
      assert.ok(!bodySystem(world,0,{region:'inner'}).members.includes(body));
      const before=structuredClone(body);setCatalogBudget(world,budget==='safe'?'immersive':'safe',body.id);
      assert.deepEqual(catalogBody(world,body.id),before);
      const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
      assert.ok(Number.isFinite(bodyRayIntersection(body,cameraFrame(camera).eye,screenRay(640,360,cameraFrame(camera),1280,720))));
      resetCamera(camera,body);arrive(camera);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
    }
    assert.ok(world.drawIndices.length+world.bodies.length<=world.budget.draw);
  }
});

test('small-world silhouettes reject empty envelope rays and follow rotated solid poses', () => {
  const world=createCatalog();
  for (const name of ['Vesta','Phobos','Deimos','Eros','Bennu','Proteus']) {
    const body={...resolveCatalogTarget(world,name),position:[0,0,0],radius:1,tilt:0,spin:0};
    assert.ok(Number.isFinite(bodyRayIntersection(body,[0,0,5],[0,0,-1])));
    assert.equal(bodyRayIntersection(body,[0,body.axes[1]*1.02,5],[0,0,-1]),Infinity);
    // At least one originally occupied ellipsoid ray is now outside the solid.
    let empty=0;
    for(let i=0;i<36;i++) {
      const angle=i*Math.PI/18,x=Math.cos(angle)*body.axes[0]*.98,y=Math.sin(angle)*body.axes[1]*.98;
      if(!Number.isFinite(bodyRayIntersection(body,[x,y,5],[0,0,-1]))) empty++;
    }
    assert.ok(empty>0,`${name} retains an asymmetric silhouette`);
    // Rotating body and ray together preserves the same physical hit depth.
    const point=[.22,.19,5],ray=[0,0,-1],spin=.73,tilt=.41;
    const rotate=p=>{
      const x=Math.cos(spin)*p[0]-Math.sin(spin)*p[2],z=Math.sin(spin)*p[0]+Math.cos(spin)*p[2];
      return [x,Math.cos(tilt)*p[1]-Math.sin(tilt)*z,Math.sin(tilt)*p[1]+Math.cos(tilt)*z];
    };
    const depth=bodyRayIntersection(body,point,ray);
    const moved=bodyRayIntersection({...body,spin,tilt},rotate(point),rotate(ray));
    assert.ok(Number.isFinite(depth)&&Math.abs(depth-moved)<1e-9);
  }
});

test('prepared solid rays keep hit depth, empty space and separate observing poses', () => {
  const world=createCatalog();
  const body={...resolveCatalogTarget(world,'Earth'),position:[0,0,0],radius:1};
  const cast=bodyRayCaster(body,[0,0,5]);
  assert.equal(cast([0,0,-1]),4);
  assert.equal(cast([.6,0,-.8]),Infinity);
  const moved=bodyRayCaster({...body,position:[0,0,1]},[0,0,5]);
  assert.equal(moved([0,0,-1]),3);
  assert.equal(cast([0,0,-1]),4);
  assert.equal(bodyRayCaster(body,[0,0,7])([0,0,-1]),6);
  const cloud={...resolveCatalogTarget(world,'Orion Nebula'),position:[0,0,0],radius:1};
  assert.equal(bodyRayCaster(cloud,[0,0,5])([0,0,-1]),Infinity);
});

test('mission-informed small worlds keep distinct identities, discoverable categories and an asteroid moon family', () => {
  const names=['Ryugu','Itokawa','Lutetia','Ida','Dactyl','Mathilde','Psyche','Gaspra','Steins','67P'];
  const reference=createCatalog({budget:'safe',catalog:50000});
  const bodies=names.map(name=>resolveCatalogTarget(reference,name));
  assert.equal(new Set(bodies.map(body=>body.id)).size,names.length);
  const ida=resolveCatalogTarget(reference,'Ida'),dactyl=resolveCatalogTarget(reference,'Dactyl');
  assert.equal(bodyRelations(reference,dactyl.id).parent.id,ida.id);
  assert.deepEqual(bodySystem(reference,ida.id,{local:true}).members.map(body=>body.id),[ida.id,dactyl.id]);
  for(const budget of ['safe','standard','immersive']) {
    const world=createCatalog({budget,catalog:50000});
    for(const body of bodies) assert.deepEqual(resolveCatalogTarget(world,body.name),body);
    assert.ok(world.drawIndices.length+world.bodies.length<=world.budget.draw);
    assert.equal(resolveCatalogTarget(world,'67P').kind,'comet');
  }
});

test('contact worlds preserve lobes and genuinely empty neck rays through rotation', () => {
  const world=createCatalog();
  for(const [name,points,empty] of [
    ['Itokawa',[[-.30,0],[.46,.02]],[.20,.56]],
    ['67P',[[-.27,-.10],[.44,.28]],[.22,-.60]]
  ]) {
    const body={...resolveCatalogTarget(world,name),position:[0,0,0],radius:1,tilt:0,spin:0};
    const ray=[0,0,-1];
    for(const [x,y] of points) assert.ok(Number.isFinite(bodyRayIntersection(body,[x*body.axes[0],y*body.axes[1],5],ray)));
    for(let i=0;i<=20;i++) {
      const t=i/20,x=points[0][0]*(1-t)+points[1][0]*t,y=points[0][1]*(1-t)+points[1][1]*t;
      assert.ok(Number.isFinite(bodyRayIntersection(body,[x*body.axes[0],y*body.axes[1],5],ray)),`${name} retains a joined core between its lobes`);
    }
    assert.ok(Math.hypot(...empty)<1,'the empty ray lies inside the outer ellipsoid');
    const gap=[empty[0]*body.axes[0],empty[1]*body.axes[1],5];
    assert.equal(bodyRayIntersection(body,gap,ray),Infinity,'the outer ellipsoid cannot fill the concave neck');
    const spin=.73,tilt=.41,rotate=p=>{
      const x=Math.cos(spin)*p[0]-Math.sin(spin)*p[2],z=Math.sin(spin)*p[0]+Math.cos(spin)*p[2];
      return [x,Math.cos(tilt)*p[1]-Math.sin(tilt)*z,Math.sin(tilt)*p[1]+Math.cos(tilt)*z];
    };
    const moved={...body,spin,tilt};
    assert.equal(bodyRayIntersection(moved,rotate(gap),rotate(ray)),Infinity);
    for(const [x,y] of points) {
      const origin=[x*body.axes[0],y*body.axes[1],5];
      assert.ok(Math.abs(bodyRayIntersection(body,origin,ray)-bodyRayIntersection(moved,rotate(origin),rotate(ray)))<1e-9);
    }
  }
});

test('authored crater cavities expose deeper solid hits without replacing world identity', () => {
  const world=createCatalog();
  for(const [name,origin,ray,minimumDepth] of [
    ['Mathilde',[5,0,0],[-1,0,0],4.4],
    ['Steins',[0,5,0],[0,-1,0],4.1]
  ]) {
    const body={...resolveCatalogTarget(world,name),position:[0,0,0],radius:1,tilt:0,spin:0};
    const depth=bodyRayIntersection(body,origin,ray);
    assert.ok(Number.isFinite(depth)&&depth>minimumDepth,`${name} exposes a recessed floor instead of filling its pit`);
  }
});

test('additional small worlds are discoverable, keep distinct identities, and join reachable observing families', () => {
  const names=['Hyperion','Pan','Atlas','Phoebe','Nereid','Arrokoth','Chariklo','Sedna','Quaoar',
    'Amalthea','Thebe','Himalia','Janus','Epimetheus','Helene','Telesto','Calypso',
    'Prometheus','Pandora','Galatea','Despina','Kleopatra','AlexHelios','CleoSelene','Hygiea'];
  const standard=createCatalog({catalog:50000,budget:'standard'}),low=createCatalog({catalog:50000,budget:'safe'});
  const destinations=namedDestinations(standard);
  for(const name of names) {
    const body=resolveCatalogTarget(standard,name),other=resolveCatalogTarget(low,name);
    assert.ok(body && destinations.some(d=>d.id===body.id));assert.deepEqual(body,other);
    for(const alias of body.aliases)assert.equal(resolveCatalogTarget(standard,alias)?.id,body.id);
    if(body.kind==='moon')assert.ok(bodyRelations(standard,body.id).parent);
    const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body);arrive(camera);
    assert.equal(camera.observedId,body.id);setCameraScale(camera,1);advance(camera,5);
    assert.ok(camera.distance>body.radius*Math.max(...body.axes));
    resetCamera(camera,body);arrive(camera);assert.equal(scaleState(camera,body).scaleStage,'Galactic');
    assert.equal(camera.activeId,body.id);
  }
  assert.equal(new Set(names.map(n=>resolveCatalogTarget(standard,n).id)).size,names.length);
  assert.ok(standard.bodies.length+standard.drawIndices.length<=standard.budget.draw);
});

test('a three-body asteroid family and Trojan moons retain their actual parent relationships', () => {
  const world=createCatalog({budget:'safe'});
  const primary=resolveCatalogTarget(world,'Kleopatra');
  for(const name of ['AlexHelios','CleoSelene']) {
    const moon=resolveCatalogTarget(world,name),relation=bodyRelations(world,moon.id);
    assert.equal(relation.parent.id,primary.id);
    assert.ok(bodyRelations(world,primary.id).children.some(body=>body.id===moon.id));
  }
  for(const name of ['Helene','Telesto','Calypso']) {
    const moon=resolveCatalogTarget(world,name);
    assert.equal(bodyRelations(world,moon.id).parent.id,resolveCatalogTarget(world,'Saturn').id);
  }
});

test('world annuli have pickable bands and genuinely empty specified gaps', () => {
  for(const name of ['Chariklo','Quaoar','PDS 70 c']) {
    const body={...resolveCatalogTarget(createCatalog(),name),position:[0,0,0],radius:1,tilt:0,spin:0};
    const origin=[0,4,4];const to=x=>{const d=[x,-4,-4],l=Math.hypot(...d);return d.map(v=>v/l);};
    const rings=body.rings;
    assert.ok(Number.isFinite(bodyRayIntersection(body,origin,to((rings.inner+(rings.gapInner>rings.inner?Math.min(rings.outer,rings.gapInner):rings.outer))/2))));
    assert.equal(bodyRayIntersection(body,origin,to(rings.outer+.2)),Infinity);
    if(rings.gapInner>rings.inner && rings.gapInner<rings.outer && rings.gapOuter>rings.gapInner) {
      assert.equal(bodyRayIntersection(body,origin,to((rings.gapInner+rings.gapOuter)/2)),Infinity);
      assert.ok(Number.isFinite(bodyRayIntersection(body,origin,to((rings.gapOuter+rings.outer)/2))));
    }
  }
});

test('reflected worlds resolve stellar ancestry, with legacy sunlight and finite cyclic fallback', async () => {
  const {illuminatingStar,incidentStarColor}=await import('../assets/observatory-bodies.js');
  const world=createCatalog({budget:'safe'}),lookup=id=>catalogBody(world,id);
  for(const body of world.planets.concat(world.moons)) assert.equal(illuminatingStar(body,lookup).id,0);
  for(const body of world.exoplanets) {
    const host=illuminatingStar(body,lookup);
    assert.equal(host.id,body.parentId);assert.equal(host.kind,'star');assert.notEqual(host.id,0);
    const moon={id:60000,parentId:body.id,kind:'moon'};
    assert.equal(illuminatingStar(moon,lookup).id,host.id);
    const color=incidentStarColor(host);
    assert.ok(color.every(c=>c>=.38 && c<=1));assert.equal(Math.max(...color),1);
  }
  assert.deepEqual(incidentStarColor(lookup(0)),[1,1,1]);
  const loop={id:60001,parentId:60001};
  assert.equal(illuminatingStar(loop,id=>id===loop.id?loop:lookup(id)).id,0);
  for(const budget of ['safe','standard','immersive']) {
    const catalog=createCatalog({budget});
    assert.ok(catalog.drawIndices.length+catalog.bodies.length<=catalog.budget.draw);
    assert.equal(new Set(catalog.bodies.map(body=>body.id)).size,catalog.bodies.length);
    for(const name of ['Proxima b','TRAPPIST1e','Dimidium','飞马座51']) assert.ok(resolveCatalogTarget(catalog,name));
  }
});

test('external destinations occupy a three-dimensional map while real host membership and local families remain coherent', () => {
  const c=createCatalog({budget:'safe'}),other=createCatalog({budget:'standard'});
  const innerExtent=Math.max(...c.stars.map(star=>Math.hypot(...star.position)));
  const sol=resolveCatalogTarget(c,'Sol'),overview=createCamera(sol);
  const depths=c.galaxies.map(g=>Math.hypot(...g.position.map((v,i)=>v-sol.position[i])));
  assert.ok(Math.max(...depths)-Math.min(...depths)>overview.maxDistance,'external targets occupy several depth layers');
  for (const g of c.galaxies) {
    assert.deepEqual(g.position,resolveCatalogTarget(other,g.name).position);
    assert.equal(g.spaceRegion,'outside-milky-way');
    assert.ok(Math.hypot(...g.position)-g.radius*g.extent>innerExtent);
    assert.ok(Math.hypot(...g.position.map((v,i)=>v-sol.position[i]))-g.radius*g.extent>overview.maxDistance,'the Galactic overview stays inside the external destination field');
    assert.equal(g.radius,resolveCatalogTarget(other,g.name).radius);
  }
  for (const axis of [0,1,2]) {
    assert.ok(Math.max(...c.galaxies.map(g=>g.position[axis]))>Math.max(...c.stars.map(star=>star.position[axis])));
    assert.ok(Math.min(...c.galaxies.map(g=>g.position[axis]))<Math.min(...c.stars.map(star=>star.position[axis])));
  }
  for (const [cloud,host] of [['Tarantula Nebula','Large Magellanic Cloud'],['NGC 602','Small Magellanic Cloud'],['NGC 604','Triangulum Galaxy']]) {
    const a=resolveCatalogTarget(c,cloud),b=resolveCatalogTarget(c,host);
    assert.equal(a.spaceRegion,b.spaceRegion);
    const nearest=c.galaxies.slice().sort((one,two)=>Math.hypot(...a.position.map((v,i)=>v-one.position[i]))-Math.hypot(...a.position.map((v,i)=>v-two.position[i])))[0];
    assert.equal(nearest.id,b.id);
    assert.ok(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))<b.radius*b.extent);
  }
  assert.equal(bodyRelations(c,resolveCatalogTarget(c,'Earth').id).parent.name,'Sol');
});

test('wide overview and ordinary return retain the target and fixed lens through continuous navigation', () => {
  const body=resolveCatalogTarget(catalog,'Andromeda Galaxy'),camera=createCamera(body,{reducedMotion:false});
  focusCamera(camera,body,0);updateCamera(camera,1,1e6);
  const ordinaryDistance=createCamera(body).distance,near=cameraFrame(camera);resetCamera(camera,body,1e6,{wide:true});
  const start=camera.distance,end=camera.distanceTarget;
  assert.equal(end,camera.maxDistance);assert.ok(end>ordinaryDistance);
  updateCamera(camera,.1,1e6+camera.flight.duration*.5);
  assert.ok(camera.distance>start && camera.distance<end);
  updateCamera(camera,1,2e6);
  assert.equal(camera.distance,end);assert.equal(camera.observedId,body.id);
  for (const k of ['yaw','pitch','roll','fov']) assert.equal(cameraFrame(camera)[k],near[k]);
  resetCamera(camera,body,2e6);updateCamera(camera,1,3e6);
  assert.equal(camera.distance,ordinaryDistance);assert.equal(camera.activeId,body.id);
});
