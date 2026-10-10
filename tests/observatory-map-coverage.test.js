import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MAP_COVERAGE, MAP_COVERAGE_SIZE } from '../assets/observatory-map-coverage-data.js';
import { hasMappedTerrain, mappedTerrainObservationView } from '../assets/observatory-map-coverage.js';
import { createCatalog, resolveCatalogTarget } from '../assets/observatory-model.js';
import { createBodyMotion, galacticFrame } from '../assets/observatory-motion.js';
import { createCamera, focusCamera, turnCamera, updateCamera, cameraFrame, setReducedMotion, cancelCameraFlight, orbitCamera } from '../assets/observatory-camera.js';

test('advisory map coverage is derived from current partial-map assets', () => {
  for (const profile of Object.values(MAP_COVERAGE)) {
    const source = readFileSync(new URL('../'+profile.source,import.meta.url));
    assert.equal(createHash('sha256').update(source).digest('hex'),profile.sha256,'regenerate advisory coverage after changing its source');
    const alpha = Buffer.from(profile.alpha,'hex');
    assert.equal(alpha.length,MAP_COVERAGE_SIZE[0]*MAP_COVERAGE_SIZE[1]);
    assert.ok(alpha.some(v=>v<255) && alpha.some(v=>v>0));
  }
});

test('mapped-terrain recovery holds identity, lens, distance and roll across partial worlds and phases', () => {
  const catalog=createCatalog({budget:'safe'}), original=structuredClone(catalog.bodies), motion=createBodyMotion(catalog);
  const partial=catalog.bodies.filter(hasMappedTerrain);
  assert.deepEqual(new Set(partial.map(b=>b.material)),new Set(Object.keys(MAP_COVERAGE)));
  for (const time of [0,73,264,1121]) for (const source of partial) {
    const frame=galacticFrame(time), poses=motion.snapshot(time), body=frame.body(poses.get(source.id)), sun=frame.body(poses.get(0));
    for (const reduced of [false,true]) {
      const held={distance:body.radius*(time===0?3.1:6.8),yaw:1.8,pitch:.9,roll:.31};
      const recommendation=mappedTerrainObservationView(body,sun,held,time*.041);
      assert.ok(recommendation && Object.values(recommendation).every(Number.isFinite),source.name);
      const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body,0,held);
      const lens=cameraFrame(camera,16/9), distance=camera.distance;
      setReducedMotion(camera,reduced);assert.ok(turnCamera(camera,body,recommendation,100));
      for(let i=1;i<=150;i++) {
        updateCamera(camera,1/60,100+i*1000/60);
        assert.equal(camera.activeId,body.id);assert.equal(camera.observedId,body.id);
        assert.equal(camera.distance,distance);assert.equal(camera.roll,held.roll);
        assert.equal(cameraFrame(camera,16/9).fov,lens.fov);
      }
      assert.equal(camera.flight,null);assert.ok(Math.abs(camera.yaw-recommendation.yaw)<1e-12);assert.ok(Math.abs(camera.pitch-recommendation.pitch)<1e-12);
      const resting=[camera.yaw,camera.pitch,camera.distance];updateCamera(camera,1/60,5000);
      assert.deepEqual([camera.yaw,camera.pitch,camera.distance],resting);
    }
  }
  assert.deepEqual(catalog.bodies,original);
  for (const body of catalog.bodies.filter(b=>!hasMappedTerrain(b)))
    assert.equal(mappedTerrainObservationView(body,catalog.stars[0],{distance:body.radius*5,yaw:0,pitch:0,roll:0},0),null);
});

test('mapped-terrain turns share stopping, manual takeover and reduced-motion semantics', () => {
  const catalog=createCatalog({budget:'safe'}), body=resolveCatalogTarget(catalog,'Ariel'), sun=catalog.stars[0];
  const view=mappedTerrainObservationView(body,sun,{distance:body.radius*5,yaw:2,pitch:.5,roll:.2},3);
  for(const action of ['stop','orbit','reduce']) {
    const camera=createCamera(body,{reducedMotion:true});focusCamera(camera,body,0,{...view,yaw:view.yaw+Math.PI});setReducedMotion(camera,false);
    assert.ok(turnCamera(camera,body,view,100));updateCamera(camera,.3,500);
    const held=[camera.distance,camera.roll,camera.observedId], yaw=camera.yaw;
    if(action==='stop')cancelCameraFlight(camera);
    if(action==='orbit')orbitCamera(camera,22,0);
    if(action==='reduce')setReducedMotion(camera,true);
    updateCamera(camera,1/60,520);
    assert.equal(camera.flight,null);assert.deepEqual([camera.distance,camera.roll,camera.observedId],held);
    if(action==='stop')assert.equal(camera.yaw,yaw);
    if(action==='orbit')assert.notEqual(camera.yaw,yaw);
    if(action==='reduce'){assert.equal(camera.yaw,view.yaw);assert.equal(camera.pitch,view.pitch);}
  }
  for(const spin of [NaN,Infinity])assert.equal(mappedTerrainObservationView(body,sun,{distance:body.radius*5,yaw:0,pitch:0,roll:0},spin),null);
});
