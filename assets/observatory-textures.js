// Fixed source assets, bounded mip textures, and explicit resource ownership.
import { VOLUME_NOISE_PERIOD } from './observatory-volume-material.js?v=cosmic-explore-20261010gu';
export function createTextureStore(device) {
  const blobs = new Map();
  async function source(path) {
    if (!blobs.has(path)) blobs.set(path, (async () => {
      const response = await fetch(new URL(path, import.meta.url), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Scene image could not load (${path}: ${response.status}).`);
      return response.blob();
    })().catch(error => { blobs.delete(path); throw error; }));
    return blobs.get(path);
  }
  async function load(path, width, height, format = 'rgba8unorm-srgb') {
    const bitmap = await createImageBitmap(await source(path), {
      colorSpaceConversion: 'none', resizeWidth: width, resizeHeight: height, resizeQuality: 'high'
    });
    const levels = 1 + Math.floor(Math.log2(width));
    let texture;
    try {
      texture = device.createTexture({ size: [width, height], mipLevelCount: levels, format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      for (let level = 0; level < levels; level++) {
        const w = Math.max(1, width >> level), h = Math.max(1, height >> level);
        const mip = level ? await createImageBitmap(bitmap, { premultiplyAlpha: 'none', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }) : bitmap;
        try { device.queue.copyExternalImageToTexture({ source: mip }, { texture, mipLevel: level }, [w, h]); }
        finally { if (level) mip.close(); }
      }
      return texture;
    } catch (error) { texture?.destroy(); throw error; }
    finally { bitmap.close(); }
  }
  async function layers(paths, width, height) {
    const images = await Promise.allSettled(paths.map(async path =>
      createImageBitmap(await source(path), { colorSpaceConversion: 'none',
        premultiplyAlpha: 'none', resizeWidth: width, resizeHeight: height, resizeQuality: 'high' })));
    const failed = images.find(image => image.status === 'rejected');
    if (failed) { for (const image of images) if (image.status === 'fulfilled') image.value.close(); throw failed.reason; }
    const levels = 1 + Math.floor(Math.log2(width));
    let texture;
    try {
      texture = device.createTexture({ size: [width, height, paths.length], mipLevelCount: levels, format: 'rgba8unorm-srgb',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      for (let face = 0; face < images.length; face++) {
        const bitmap = images[face].value;
        for (let level = 0; level < levels; level++) {
          const w = Math.max(1, width >> level), h = Math.max(1, height >> level);
          const mip = level ? await createImageBitmap(bitmap, { premultiplyAlpha: 'none', resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }) : bitmap;
          try { device.queue.copyExternalImageToTexture({ source: mip }, { texture, mipLevel: level, origin: [0, 0, face] }, [w, h]); }
          finally { if (level) mip.close(); }
        }
      }
      return texture;
    } catch (error) { texture?.destroy(); throw error; }
    finally { for (const image of images) image.value.close(); }
  }
  // One shared periodic field replaces repeated per-ray turbulence. Oblique
  // integer wave vectors give continuous, non-axis-aligned cloud structure.
  // The GPU still reads one r8 texel footprint from the same finite texture.
  function createVolumeNoise() {
    const side = 128, data = new Uint8Array(side ** 3);
    const plane = new Float32Array(side ** 2);
    let seed = 0x5a17c9e3;
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
    const modes = Array.from({length:40}, () => {
      const height = random() * 2 - 1, angle = random() * Math.PI * 2;
      const radius = Math.sqrt(1 - height * height);
      const frequency = VOLUME_NOISE_PERIOD * (.25 + random() * .62);
      const k = [radius * Math.cos(angle), height, radius * Math.sin(angle)].map(v => Math.round(v * frequency));
      const weight = Math.pow(12 / frequency, .65), phase = random() * Math.PI * 2;
      const axes = k.map((frequency, axis) => {
        const sin = new Float32Array(side), cos = new Float32Array(side);
        for (let i = 0; i < side; i++) {
          const t = (i + .5) / side * Math.PI * 2 * frequency + (axis === 2 ? phase : 0);
          sin[i] = Math.sin(t);cos[i] = Math.cos(t);
        }
        return {sin,cos};
      });
      return {axes,weight};
    });
    const gain = .19 / Math.sqrt(modes.reduce((sum,m) => sum + m.weight * m.weight * .5, 0));
    for (let z = 0; z < side; z++) {
      plane.fill(0);
      for (const {axes:[xAxis,yAxis,zAxis],weight} of modes) {
        for (let y = 0; y < side; y++) {
          const cos = (yAxis.cos[y] * zAxis.cos[z] - yAxis.sin[y] * zAxis.sin[z]) * weight;
          const sin = (yAxis.sin[y] * zAxis.cos[z] + yAxis.cos[y] * zAxis.sin[z]) * weight;
          for (let x = 0; x < side; x++) plane[y * side + x] += xAxis.sin[x] * cos + xAxis.cos[x] * sin;
        }
      }
      for (let i = 0; i < plane.length; i++) data[z * plane.length + i] = Math.round(Math.max(0,Math.min(1,.5 + plane[i] * gain)) * 255);
    }
    const texture = device.createTexture({ label: 'Shared smooth cloud field',
      size: [side, side, side], dimension: '3d', format: 'r8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    try {
      device.queue.writeTexture({ texture }, data, { bytesPerRow: side, rowsPerImage: side }, [side, side, side]);
      return texture;
    } catch (error) { texture.destroy(); throw error; }
  }
  async function prepare(profile) {
    const size = value => Math.min(value, device.limits.maxTextureDimension2D);
    const entries = [
      ['earth', load('./planets/earth.jpg', size(profile.earth), size(profile.earth) / 2)],
      ['moon', load('./planets/moon.jpg', size(profile.moon), size(profile.moon) / 2)],
      ['mars', load('./planets/mars.jpg', size(profile.mars), size(profile.mars) / 2)],
      ['jupiter', load('./planets/jupiter.jpg', size(profile.jupiter), size(profile.jupiter) / 2)],
      ['mercury', load('./planets/mercury.jpg', size(profile.mercury), size(profile.mercury) / 2)],
      ['height', load('./planets/moon-height.jpg', size(profile.height), size(profile.height) / 2, 'rgba8unorm')],
      ['clouds', load('./planets/earth-clouds.jpg', size(profile.clouds), size(profile.clouds) / 2, 'rgba8unorm')],
      ['sky', layers(['px', 'nx', 'py', 'ny', 'pz', 'nz'].map(face => `./deep-sky/${face}.jpg`), size(profile.sky), size(profile.sky))],
      ['satellites', layers(['io.jpg', 'europa.jpg', 'enceladus.jpg', 'ganymede.jpg', 'callisto.jpg', 'triton.jpg', 'mimas.jpg', 'pluto.png', 'charon.png', 'ceres.png', 'vesta.png', 'phobos.jpg', 'deimos.jpg', 'miranda.png', 'iapetus.jpg', 'ariel.png', 'umbriel.png', 'titania.png', 'oberon.png', 'rhea.jpg', 'dione.jpg', 'tethys.jpg'].map(name => `./planets/${name}`), size(profile.moon), size(profile.moon) / 2)]
    ];
    const results = await Promise.allSettled(entries.map(([, promise]) => promise));
    const failed = results.find(result => result.status === 'rejected');
    if (failed) { for (const result of results) if (result.status === 'fulfilled') result.value.destroy(); throw failed.reason; }
    const maps = Object.fromEntries(results.map((result, i) => [entries[i][0], result.value]));
    return { ...maps, destroy() { for (const texture of Object.values(maps)) texture.destroy(); } };
  }
  return { load, prepare, createVolumeNoise, clear() { blobs.clear(); } };
}
