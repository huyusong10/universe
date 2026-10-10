import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextureStore } from '../assets/observatory-textures.js';

globalThis.GPUTextureUsage = { TEXTURE_BINDING: 1, COPY_DST: 2 };

function device(upload) {
  const textures = [];
  return {
    textures,
    createTexture(descriptor) {
      const texture = { descriptor, destroyed: false, destroy() { this.destroyed = true; } };
      textures.push(texture);
      return texture;
    },
    queue: { writeTexture: upload }
  };
}

test('cloud fields upload one bounded deterministic 3D resource independent of store lifetime', () => {
  const uploads = [];
  const gpu = device((target, bytes, layout, size) => uploads.push({ target, bytes, layout, size }));
  const first = createTextureStore(gpu).createVolumeNoise();
  const second = createTextureStore(gpu).createVolumeNoise();
  assert.equal(gpu.textures.length, 2);
  assert.notEqual(first, second);
  for (const upload of uploads) {
    const descriptor = upload.target.texture.descriptor;
    assert.equal(descriptor.dimension, '3d');
    assert.equal(descriptor.format, 'r8unorm');
    assert.deepEqual(upload.size, descriptor.size);
    assert.equal(upload.bytes.byteLength, upload.size.reduce((a, b) => a * b));
    assert.ok(upload.bytes.byteLength <= 2 ** 21);
    assert.equal(upload.layout.bytesPerRow, upload.size[0]);
    assert.equal(upload.layout.rowsPerImage, upload.size[1]);
  }
  assert.deepEqual(uploads[0].bytes, uploads[1].bytes);
  assert.ok(new Set(uploads[0].bytes).size > 1, 'The field must contain spatial variation');
  assert.equal(first.destroyed, false);
  assert.equal(second.destroyed, false);
});

test('failed cloud upload releases its texture and leaves a new store usable', () => {
  const failure = new Error('GPU upload failed');
  const gpu = device(() => { throw failure; });
  assert.throws(() => createTextureStore(gpu).createVolumeNoise(), error => error === failure);
  assert.equal(gpu.textures.length, 1);
  assert.equal(gpu.textures[0].destroyed, true);
  gpu.queue.writeTexture = () => {};
  assert.equal(createTextureStore(gpu).createVolumeNoise().destroyed, false);
});
