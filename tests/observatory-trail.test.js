import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORATION_TRAIL_LIMIT, rememberView, recalledView } from '../assets/observatory-trail.js';

const view = id => ({ id, target: `Body ${id}`, stage: 'Surface', distance: 0.001, yaw: id / 5, pitch: .5, roll: 0 });

test('session observations retain the latest pose per identity within a bounded revisitation list', () => {
  let trail = [];
  for (let id = 0; id < EXPLORATION_TRAIL_LIMIT + 3; id++) trail = rememberView(trail, view(id));
  assert.equal(trail.length, EXPLORATION_TRAIL_LIMIT);
  assert.equal(recalledView(trail, 0), null);
  const previous = trail;
  const changed = { ...view(4), distance: .002, yaw: -2, stage: 'LocalSystem', fov: 1, texture: 'unrelated' };
  trail = rememberView(trail, changed);
  assert.equal(trail[0].id, 4);
  assert.equal(new Set(trail.map(item => item.id)).size, trail.length);
  assert.equal(previous.find(item => item.id === 4).distance, .001);
  const recalled = recalledView(trail, 4);
  assert.deepEqual(recalled, { id: 4, target: 'Body 4', stage: 'LocalSystem', distance: .002, yaw: -2, pitch: .5, roll: 0 });
  recalled.distance = 99;
  assert.equal(recalledView(trail, 4).distance, .002);
  assert.deepEqual(rememberView([], view(0)).map(item => item.id), [0]);
  const region=rememberView([], {...view(2),region:'outer-tail'});
  assert.equal(recalledView(region,2).region,'outer-tail','a session revisit retains the region of the same body');
  assert.equal(recalledView(rememberView(region,view(2)),2).region,undefined,'a later whole-body observation replaces the region');
  assert.equal(recalledView(rememberView([], {...view(2),region:{point:[1,2,3]}}),2).region,undefined,'untrusted arbitrary anchors are not stored');
});

test('invalid or distant views cannot replace a remembered observation', () => {
  const trail = rememberView([], view(0));
  for (const invalid of [null, { ...view(1), distance: 0 }, { ...view(1), yaw: NaN }, { ...view(1), roll: Infinity }, { ...view(1), stage: 'Galactic' }, { ...view(1), id: -1 }]) {
    assert.equal(rememberView(trail, invalid), trail);
  }
});
