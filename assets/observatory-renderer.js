import { GALAXY_EXPLORATIONS } from './observatory-galaxies.js?v=cosmic-explore-20261010gu';
import { NEBULA_EXPLORATIONS } from './observatory-nebulae.js?v=cosmic-explore-20261010gu';
import { EXOWORLDS, YOUNG_WORLDS } from './observatory-exoworlds.js?v=cosmic-explore-20261010gu';
import { bodyDrawLayers } from './observatory-model.js?v=cosmic-explore-20261010gu';
import { loadSolidGeometry } from './observatory-solid-geometry.js?v=cosmic-explore-20261010gu';
import { NEW_SMALL_WORLDS } from './observatory-small-worlds.js?v=cosmic-explore-20261010gu';
import { qualityProfile } from './observatory-quality.js?v=cosmic-explore-20261010gu';
import { createTextureStore } from './observatory-textures.js?v=cosmic-explore-20261010gu';
import { createFrameProfiler } from './observatory-performance.js?v=cosmic-explore-20261010gu';
import { isVolumeBody, hasVolumeBody, illuminatingStar, incidentStarColor } from './observatory-bodies.js?v=cosmic-explore-20261010gu';
import { POINT_SHADER, SURFACE_SHADER, BLOOM_SHADER, COMPOSITE_SHADER, ENVIRONMENT_SHADER, ENVIRONMENT_COPY_SHADER } from './observatory-shaders.js?v=cosmic-explore-20261010gu';
import { galacticInteriorPresence } from './observatory-galactic-material.js?v=cosmic-explore-20261010gu';

const HDR = 'rgba16float';
const INSTANCE_FLOATS = 20, INSTANCE_BYTES = INSTANCE_FLOATS * 4;
const CLEAR = { r: 0.00012, g: 0.00019, b: 0.00038, a: 1 };
const POINT_KINDS = { star: 12, planet: 4, dwarfplanet: 4, asteroid: 4, nebula: 5, moon: 6, galaxy: 7, comet: 9, pulsar: 10, blackhole: 11 };
const MATERIALS = { ...Object.fromEntries(GALAXY_EXPLORATIONS.map(body=>[body.material,body.code])), ...Object.fromEntries(NEBULA_EXPLORATIONS.map(body=>[body.material,body.code])), ...Object.fromEntries([...EXOWORLDS,...YOUNG_WORLDS].map(w=>[w.material,w.code])), exorock:126, exoice:127, hotjupiter:128, earth: 1, saturn: 2, nebula: 3, moon: 4, mars: 5, galaxy: 6, comet: 7, jupiter: 8, pulsar: 9, blackhole: 10, mercury: 11, venus: 12, uranus: 13, neptune: 14, io: 15, europa: 16, enceladus: 17, titan: 18, ganymede: 19, callisto: 20, triton: 21, mimas: 22, pluto: 23, charon: 24, ceres: 25, vesta: 26, ringnebula: 27, triangulum: 28, vela: 29, m87: 30, whitedwarf: 31, phobos: 32, deimos: 33, miranda: 34, iapetus: 35, helixnebula: 36, lagoonnebula: 37, ariel: 38, umbriel: 39, titania: 40, oberon: 41, eris:42, haumea:43, makemake:44, rhea:45, dione:46, tethys:47, proteus:48, eros:49, bennu:50, eagle:51, horsehead:52, carina:53, crabnebula:54, dumbbell:98, catseye:99, butterfly:100, bubble:101, rosette:102, veil:103, flame:104, swan:105, whirlpool:106, barred:107, sombrero:108, centaurusa:109, cigar:110, needle:111, elliptical:112, cartwheel:113, ...Object.fromEntries(Object.entries(NEW_SMALL_WORLDS).map(([key,value])=>[key,value.code])) };

export async function createRenderer(canvas, onError, { budget = 'standard', debug = false } = {}) {
  // Geometry validation, GPU setup and image decoding are independent. Keep
  // a settled result so a device failure cannot leave a rejected load unhandled.
  const geometryTask = loadSolidGeometry().then(value => ({ value }), error => ({ error }));
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter is available.');
  const timestamps = debug && adapter.features.has('timestamp-query');
  const device = await adapter.requestDevice({ requiredFeatures: timestamps ? ['timestamp-query'] : [] });
  const profiler = createFrameProfiler(device, debug, timestamps);
  const imageStore = createTextureStore(device);
  let profile = qualityProfile(budget);
  let destroyed = false;
  device.lost.then(info => { if (!destroyed) onError(`GPU device lost: ${info.message}`); });
  device.addEventListener('uncapturederror', event => { if (!destroyed) onError(event.error.message); });
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const initialImages = Promise.allSettled([
    imageStore.load('./stellar-02/sun_surface.png', 1024, 1024, 'rgba8unorm'), imageStore.prepare(profile)
  ]);
  const pipelineTasks = [];
  function pipeline(descriptor) {
    const task = device.createRenderPipelineAsync(descriptor); pipelineTasks.push(task); return task;
  }
  try {
  context.configure({ device, format, alphaMode: 'opaque' });

  async function shader(code, label) {
    const module = device.createShaderModule({ code, label });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter(message => message.type === 'error');
    if (errors.length) throw new Error(`${label}: ${errors.map(error => `${error.lineNum}: ${error.message}`).join('\n')}`);
    return module;
  }
  const [pointModule, surfaceModule, bloomModule, compositeModule, environmentModule, copyModule] = await Promise.all([
    shader(POINT_SHADER, 'Catalog starlight'), shader(SURFACE_SHADER, 'Stellar photosphere'),
    shader(BLOOM_SHADER, 'Optical bloom'), shader(COMPOSITE_SHADER, 'Display transform'),
    shader(ENVIRONMENT_SHADER, 'Deep space and galactic extinction'), shader(ENVIRONMENT_COPY_SHADER, 'Environment reconstruction')
  ]);
  const uniforms = device.createBuffer({ size: 288, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const values = new Float32Array(72);
  const bodyLighting = device.createBuffer({size:20000*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const surfaceLayout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: 'cube' } },
    { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 9, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 10, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 11, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    { binding: 12, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    { binding: 13, visibility: GPUShaderStage.FRAGMENT, buffer: {type:'read-only-storage'} },
    { binding: 14, visibility: GPUShaderStage.FRAGMENT, buffer: {type:'read-only-storage'} },
    { binding: 15, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: {viewDimension:'3d'} },
    { binding: 16, visibility: GPUShaderStage.VERTEX, buffer: {type:'read-only-storage'} }
  ] });
  const sceneLayout = device.createPipelineLayout({ bindGroupLayouts: [surfaceLayout] });
  // Light points have zero alpha; resolved nearby worlds occlude that light.
  const additive = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } };
  const pointsTask = pipeline({
    label: 'Fixed-budget catalog', layout: sceneLayout,
    vertex: { module: pointModule, entryPoint: 'vs', buffers: [{ arrayStride: INSTANCE_BYTES, stepMode: 'instance', attributes: [
      { shaderLocation: 0, offset: 0, format: 'float32x4' },
      { shaderLocation: 1, offset: 16, format: 'float32x4' },
      { shaderLocation: 2, offset: 32, format: 'float32x4' },
      { shaderLocation: 3, offset: 48, format: 'float32x4' },
      { shaderLocation: 4, offset: 64, format: 'float32x4' }
    ] }] },
    fragment: { module: pointModule, entryPoint: 'fs', targets: [{ format: HDR, blend: additive }] },
    primitive: { topology: 'triangle-strip' }
  });
  const bodyPipeline = entryPoint => pipeline({
    label: entryPoint === 'fs' ? 'Opaque celestial surface' : 'Transparent celestial volume', layout: sceneLayout,
    vertex: { module: surfaceModule, entryPoint: 'vs' },
    fragment: { module: surfaceModule, entryPoint, targets: [{ format: HDR, blend: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    } }] }, primitive: { topology: 'triangle-strip' }
  });
  const surfaceTask = bodyPipeline('fs');
  const volumeSurfaceTask = bodyPipeline('fsVolume');
  const compactVolumeLayout=device.createBindGroupLayout({entries:[
    {binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},
    {binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}}
  ]});
  const compactVolumeTask=pipeline({
    label:'Compact core and plasma boundary',
    layout:device.createPipelineLayout({bindGroupLayouts:[surfaceLayout,compactVolumeLayout]}),
    vertex:{module:surfaceModule,entryPoint:'vsVolumeResolve'},
    fragment:{module:surfaceModule,entryPoint:'fsVolumeResolve',targets:[{format:HDR,blend:{
      color:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'},
      alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha',operation:'add'}
    }}]},primitive:{topology:'triangle-list'}
  });
  const bloomTask = pipeline({
    label: 'Radiance bloom', layout: 'auto', vertex: { module: bloomModule, entryPoint: 'vs' },
    fragment: { module: bloomModule, entryPoint: 'fs', targets: [{ format: HDR }] }, primitive: { topology: 'triangle-list' }
  });
  const compositeTask = pipeline({
    label: 'Linear HDR to display', layout: 'auto', vertex: { module: compositeModule, entryPoint: 'vs' },
    fragment: { module: compositeModule, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' }
  });
  const environmentTask = pipeline({
    label: 'Continuous galactic volume and distant sky', layout: sceneLayout,
    vertex: { module: environmentModule, entryPoint: 'vs' },
    fragment: { module: environmentModule, entryPoint: 'fs', targets: [{ format: HDR }] }, primitive: { topology: 'triangle-list' }
  });
  const copyEnvironmentTask = pipeline({
    label: 'Half-resolution environment reconstruction', layout: 'auto',
    vertex: { module: copyModule, entryPoint: 'vs' },
    fragment: { module: copyModule, entryPoint: 'fs', targets: [{ format: HDR }] }, primitive: { topology: 'triangle-list' }
  });
  const copyVolumeTask = pipeline({
    label: 'Premultiplied volume reconstruction', layout: 'auto',
    vertex: { module: copyModule, entryPoint: 'vs' },
    fragment: { module: copyModule, entryPoint: 'fs', targets: [{ format: HDR, blend: {
      color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
    } }] }, primitive: { topology: 'triangle-list' }
  });

  const pipelines = await Promise.allSettled([pointsTask, surfaceTask, volumeSurfaceTask, bloomTask, compositeTask, environmentTask, copyEnvironmentTask, copyVolumeTask,compactVolumeTask]);
  const failedPipeline = pipelines.find(result => result.status === 'rejected');
  if (failedPipeline) throw failedPipeline.reason;
  const [points, surface, volumeSurface, bloom, composite, environment, copyEnvironment, copyVolume,compactVolume] = pipelines.map(result => result.value);
  const loaded = await geometryTask;
  if (loaded.error) throw loaded.error;
  const geometry = loaded.value;
  const solidBuffers = [geometry.nodes, geometry.surfaceData].map(data => {
    const buffer=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(buffer,0,data);return buffer;
  });
  const images = await initialImages;
  const failedImage = images.find(result => result.status === 'rejected');
  if (failedImage) throw failedImage.reason;
  const noise = images[0].value;
  let maps = images[1].value;
  const volumeNoise = imageStore.createVolumeNoise();
  const noiseSampler = device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat', minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' });
  const skySampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' });
  const linearSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  function bindScene(images) {
    return device.createBindGroup({ layout: surfaceLayout, entries: [
      { binding: 0, resource: { buffer: uniforms } }, { binding: 1, resource: noise.createView() }, { binding: 2, resource: noiseSampler },
      { binding: 3, resource: images.sky.createView({ dimension: 'cube' }) }, { binding: 4, resource: skySampler },
      { binding: 5, resource: images.earth.createView() }, { binding: 6, resource: images.moon.createView() },
      { binding: 7, resource: images.height.createView() }, { binding: 8, resource: images.clouds.createView() },
      { binding: 9, resource: images.mars.createView() }, { binding: 10, resource: images.jupiter.createView() }, { binding: 11, resource: images.mercury.createView() },
      { binding: 12, resource: images.satellites.createView({ dimension: '2d-array' }) },
      { binding: 13, resource: {buffer:solidBuffers[0]} },
      { binding: 14, resource: {buffer:solidBuffers[1]} },
      { binding: 15, resource: volumeNoise.createView({dimension:'3d'}) },
      { binding: 16, resource: {buffer:bodyLighting} }
    ] });
  }
  let sceneGroup = bindScene(maps);
  const blurUniforms = [[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0]].map(direction => {
    const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buffer, 0, new Float32Array(direction));
    return buffer;
  });
  let instances, instanceCount = 0, textures = [], bloomGroups = [], compositeGroup, environmentGroup, volumeGroup,compactVolumeGroup;
  let width = 1, height = 1, pixelWidth = 1, pixelHeight = 1, density = 1;
  function dimensions(nextProfile) {
    const resolution = Math.min(density || 1, Math.sqrt(nextProfile.pixels / (width * height)), device.limits.maxTextureDimension2D / Math.max(width, height));
    return { resolution, pw: Math.max(1, Math.floor(width * resolution)), ph: Math.max(1, Math.floor(height * resolution)) };
  }
  function prepareTargets(pw, ph, nextProfile) {
    const created = [];
    try {
      const sizes = [[pw, ph],
        [Math.max(1, Math.ceil(pw * nextProfile.bloomScale)), Math.max(1, Math.ceil(ph * nextProfile.bloomScale))],
        [Math.max(1, Math.ceil(pw * nextProfile.bloomScale)), Math.max(1, Math.ceil(ph * nextProfile.bloomScale))],
        [Math.max(1, Math.ceil(pw * nextProfile.environmentScale)), Math.max(1, Math.ceil(ph * nextProfile.environmentScale))],
        [Math.max(1, Math.ceil(pw * nextProfile.volumeScale)), Math.max(1, Math.ceil(ph * nextProfile.volumeScale))]];
      for (const size of sizes) created.push(device.createTexture({ size, format: HDR, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
      const nextBloom = [created[0], created[1], created[2]].map((texture, i) => device.createBindGroup({ layout: bloom.getBindGroupLayout(0), entries: [
        { binding: 0, resource: texture.createView() }, { binding: 1, resource: linearSampler }, { binding: 2, resource: { buffer: blurUniforms[i] } }
      ] }));
      const nextComposite = device.createBindGroup({ layout: composite.getBindGroupLayout(0), entries: [
        { binding: 0, resource: created[0].createView() }, { binding: 1, resource: created[1].createView() }, { binding: 2, resource: linearSampler }
      ] });
      const nextEnvironment = device.createBindGroup({ layout: copyEnvironment.getBindGroupLayout(0), entries: [
        { binding: 0, resource: created[3].createView() }, { binding: 1, resource: linearSampler }
      ] });
      const nextVolume = device.createBindGroup({ layout: copyVolume.getBindGroupLayout(0), entries: [
        { binding: 0, resource: created[4].createView() }, { binding: 1, resource: linearSampler }
      ] });
      const nextCompactVolume=device.createBindGroup({layout:compactVolumeLayout,entries:[
        {binding:0,resource:created[4].createView()},{binding:1,resource:linearSampler}
      ]});
      return { textures: created, bloom: nextBloom, composite: nextComposite, environment: nextEnvironment, volume: nextVolume,compactVolume:nextCompactVolume };
    } catch (error) { for (const texture of created) texture.destroy(); throw error; }
  }
  function adoptTargets(next, pw, ph) {
    const previous = textures;
    pixelWidth = canvas.width = pw; pixelHeight = canvas.height = ph;
    textures = next.textures; bloomGroups = next.bloom; compositeGroup = next.composite; environmentGroup = next.environment; volumeGroup = next.volume;
    compactVolumeGroup=next.compactVolume;
    for (const texture of previous) texture.destroy();
  }
  function resize(w, h, dpr) {
    width = Math.max(1, w); height = Math.max(1, h); density = dpr;
    const { resolution, pw, ph } = dimensions(profile);
    if (textures.length && pw === pixelWidth && ph === pixelHeight) return resolution;
    adoptTargets(prepareTargets(pw, ph, profile), pw, ph);
    return resolution;
  }
  async function setQuality(key) {
    const nextProfile = qualityProfile(key);
    if (nextProfile === profile) return;
    const next = await imageStore.prepare(nextProfile);
    if (destroyed) { next.destroy(); return; }
    let nextGroup, nextTargets;
    const { pw, ph } = dimensions(nextProfile);
    try { nextGroup = bindScene(next); nextTargets = prepareTargets(pw, ph, nextProfile); }
    catch (error) { next.destroy(); throw error; }
    const previous = maps;
    adoptTargets(nextTargets, pw, ph);
    maps = next; sceneGroup = nextGroup; profile = nextProfile;
    previous.destroy();
    profiler.reset();
  }
  function diagnostics() {
    return { quality: { key: profile.key, width: pixelWidth, height: pixelHeight,
      volumeNoiseBytes: 128 ** 3, bodyLightingBytes: 20000*32, pixelLimit: profile.pixels, solidGeometryBytes: geometry.nodes.byteLength + geometry.surfaceData.byteLength, volumeWidth: textures[4]?.width || 0, volumeHeight: textures[4]?.height || 0, earthTextureWidth: maps.earth.width,
      moonTextureWidth: maps.moon.width, satelliteTextureWidth: maps.satellites.width, satelliteTextureLayers: maps.satellites.depthOrArrayLayers, marsTextureWidth: maps.mars.width, jupiterTextureWidth: maps.jupiter.width, mercuryTextureWidth: maps.mercury.width, cloudTextureWidth: maps.clouds.width, skyTextureWidth: maps.sky.width },
      performance: profiler.metrics(),
      adapter: debug ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture,
        description: adapter.info.description, fallback: adapter.info.isFallbackAdapter } : null };
  }
  let lightHosts = [], lightPoints = new Float32Array();
  let galaxyReferenceCounts = new Map();
  let galaxyOrientations = new Map();
  let galaxyReferenceOffset = 0, galaxyReferenceRanges = new Map();
  let bodyOffset = 0, galaxyLightOffset = 0, bodyPoints = new Float32Array(), bodyTemplates = new Float32Array(), stellarReferenceIds = [];
  function setCatalog(catalog) {
    // Move an existing finite stellar parent's point into the CPU-relative
    // tail. The tiny separation then retains precision without extra points.
    stellarReferenceIds = [...new Set(catalog.bodies.map(body => body.parentId))]
      .filter(id => id !== 0 && catalog.stars[id]?.kind === 'star' && catalog.drawIndices.includes(id));
    const referenceIds = new Set(stellarReferenceIds);
    const galaxies = new Map(catalog.galaxies.map(galaxy => [galaxy.id, galaxy]));
    galaxyOrientations = new Map(catalog.galaxies.map(galaxy => [galaxy.id, galaxy.orientation]));
    galaxyReferenceCounts = new Map();
    for (const light of catalog.galaxyReferences) {
      galaxyReferenceCounts.set(light.ownerId, (galaxyReferenceCounts.get(light.ownerId) || 0) + 1);
    }
    const entries = [...catalog.drawIndices.filter(i => !referenceIds.has(i)).map(i => ({ ...catalog.stars[i], kind: 0 })),
      ...catalog.dust.map(entry => ({ ...entry, kind: entry.halo ? 1.25 : 1 })),
      ...catalog.environment.sky.map(entry => ({ ...entry, kind: 2 })),
      ...catalog.environment.transit.map(entry => ({ ...entry, kind: 3 })),
      ...catalog.galaxyReferences.map(light => {
        const owner = galaxies.get(light.ownerId);
        return { ...light, id: light.ownerId, kind: 8.25, material: owner.material,
          radius: owner.radius, appearance: [...owner.position, owner.radius], orientation: owner.orientation };
      }),
      ...galaxyLightEntries(catalog.galaxyLights),
      ...catalog.bodies.map(body => ({ ...body, kind: POINT_KINDS[body.kind] })),
      ...stellarReferenceIds.map(id => ({ ...catalog.stars[id], kind: 13 }))];
    const data = packInstances(entries);
    const next = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    try { device.queue.writeBuffer(next, 0, data); }
    catch (error) { next.destroy(); throw error; }
    instances?.destroy(); instances = next;
    instanceCount = entries.length;
    bodyOffset = (entries.length - catalog.bodies.length - stellarReferenceIds.length) * INSTANCE_BYTES;
    galaxyLightOffset = bodyOffset - catalog.galaxyLights.length * INSTANCE_BYTES;
    galaxyReferenceOffset = galaxyLightOffset - catalog.galaxyReferences.length * INSTANCE_BYTES;
    galaxyReferenceRanges = new Map();
    let referenceStart = galaxyReferenceOffset / INSTANCE_BYTES;
    for (const [id, count] of galaxyReferenceCounts) {
      galaxyReferenceRanges.set(id, { first: referenceStart, count });
      referenceStart += count;
    }
    bodyTemplates = data.slice(bodyOffset / 4);
    bodyPoints = new Float32Array(bodyTemplates.length);
    const lookup = id => catalog.stars[id] || catalog.bodies.find(body=>body.id===id);
    lightHosts = catalog.bodies.map(body=>illuminatingStar(body,lookup).id);
    lightPoints = new Float32Array((catalog.bodies.length+stellarReferenceIds.length)*8);
  }
  function packInstances(entries) {
    const data = new Float32Array(entries.length * INSTANCE_FLOATS);
    entries.forEach((entry, i) => data.set([
      ...entry.position, entry.size, ...entry.color, entry.luminosity,
      entry.id ?? -10, entry.kind, entry.material ? MATERIALS[entry.material] : (entry.seed ?? 0) / 4294967295, entry.radius ?? 0,
      ...(entry.appearance || [entry.tilt || 0, (entry.seed ?? 0) / 4294967295, 0, 0]),
      ...(entry.orientation || [entry.rings?.inner || 0, entry.rings?.outer || 0, entry.rings?.gapInner || 0, entry.rings?.gapOuter || 0])
    ], i * INSTANCE_FLOATS));
    return data;
  }
  function galaxyLightEntries(lights) {
    const count = galaxyReferenceCounts.get(lights[0]?.ownerId) || 0;
    return lights.map((light, index) => ({ ...light, id: light.ownerId, kind: 8, tilt: index < count ? 1 : 0, orientation: galaxyOrientations.get(light.ownerId) }));
  }
  function setGalaxyLights(lights) {
    const data = packInstances(galaxyLightEntries(lights));
    device.queue.writeBuffer(instances, galaxyLightOffset, data);
  }
  function render({ frame, star, sun, illuminant = sun, bodies, bodyPoses, time, galacticAngle = 0, spin, progress, hover, starRadiusPx, environment: layers, referenceFocus = 0, motion, reducedMotion, seed }) {
    // Only the finite body tail is updated: subtract in CPU double precision
    // before storing tiny local offsets, including while the clock is paused.
    let surfaceSplit=instanceCount, galaxyLayers=[];
    if (bodies) {
      const tail=[...bodies,...stellarReferenceIds.map(id=>bodyPoses.get(id))];
      const byId=new Map(tail.map((body,index)=>[body.id,{body,index}]));
      const order=bodyDrawLayers(tail,star,frame,width,height);
      const selected=order.indexOf(star.id);
      const tailOrder=order.filter(id=>byId.has(id));
      galaxyLayers=tailOrder.flatMap((id,index)=>{
        const range=galaxyReferenceRanges.get(id);
        return range?[{ id,after:bodyOffset/INSTANCE_BYTES+index+1,...range }]:[];
      });
      surfaceSplit=bodyOffset/INSTANCE_BYTES+order.slice(0,selected+1).filter(id=>byId.has(id)).length;
      tailOrder.forEach((id,i)=>{
        const {body,index}=byId.get(id);
        bodyPoints.set(bodyTemplates.subarray(index*INSTANCE_FLOATS,(index+1)*INSTANCE_FLOATS),i*INSTANCE_FLOATS);
        bodyPoints.set(body.position.map((value,axis)=>value-frame.eye[axis]),i*INSTANCE_FLOATS);
        if(index<bodies.length) {
          const host=bodyPoses.get(lightHosts[index])||sun;
          const direction=host.position.map((value,axis)=>value-body.position[axis]);
          const length=Math.hypot(...direction)||1;
          lightPoints.set([...direction.map(value=>value/length),0,...incidentStarColor(host),0],i*8);
        }
      });
      device.queue.writeBuffer(instances,bodyOffset,bodyPoints);
      device.queue.writeBuffer(bodyLighting,0,lightPoints);
    }
    const light = illuminant.position.map((value, i) => value - star.position[i]);
    const lightLength = Math.hypot(...light) || 1;
    const rings = star.rings;
    values.set([...frame.right, Math.tan(frame.fov / 2), ...frame.up, frame.aspect, ...frame.forward, time,
      ...frame.eye, frame.distance, width, height, pixelWidth, pixelHeight, ...star.position, star.radius,
      ...star.color, star.seed / 4294967295, starRadiusPx, profile.dustEnergy || 1, spin, progress, star.id, hover ?? -1, (seed >>> 0) / 4294967295, MATERIALS[star.material] || 0,
      ...star.position.map((value, i) => value - frame.eye[i]), galacticAngle,
      layers.galaxyPresence, layers.skyPresence, layers.transitPresence, layers.immersion,
      motion, reducedMotion ? 1 : 0, galacticInteriorPresence(frame.eye), referenceFocus,
      ...light.map(value => value / lightLength), star.tilt || 0,
      ...(star.kind==='galaxy' ? star.orientation : [rings?.inner || 0, rings?.outer || 0, rings?.gapInner || 0, rings?.gapOuter || 0]),
      ...sun.position.map((value, axis) => value - frame.eye[axis]), star.axes?.[2] || 1, (frame.center[0] - 0.5) * 2, (frame.center[1] - 0.5) * 2, star.axes?.[0] || 1, star.axes?.[1] || 1, profile.nebulaSteps, profile.galaxyLayers, textures[4].width, textures[4].height, ...incidentStarColor(illuminant), bodyOffset / INSTANCE_BYTES]);
    device.queue.writeBuffer(uniforms, 0, values);
    const sample = profiler.sample();
    const encoder = device.createCommandEncoder();
    const skyPass = encoder.beginRenderPass({ timestampWrites: sample?.start, colorAttachments: [{ view: textures[3].createView(), clearValue: CLEAR, loadOp: 'clear', storeOp: 'store' }] });
    skyPass.setPipeline(environment); skyPass.setBindGroup(0, sceneGroup); skyPass.draw(3); skyPass.end();
    const resolved = starRadiusPx > 0.5, volume = resolved && hasVolumeBody(star);
    if (volume) {
      const cloud = encoder.beginRenderPass({ colorAttachments: [{ view: textures[4].createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      cloud.setPipeline(volumeSurface); cloud.setBindGroup(0, sceneGroup); cloud.draw(4); cloud.end();
    }
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: textures[0].createView(), clearValue: CLEAR, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(copyEnvironment); pass.setBindGroup(0, environmentGroup); pass.draw(3);
    pass.setBindGroup(0, sceneGroup);
    pass.setPipeline(points); pass.setVertexBuffer(0, instances);
    const galaxy = resolved && star.kind === 'galaxy';
    const lightStart = galaxyLightOffset / INSTANCE_BYTES, lightEnd = bodyOffset / INSTANCE_BYTES;
    const referenceStart = galaxyReferenceOffset / INSTANCE_BYTES;
    function drawPoints(first, end) {
      if (first < referenceStart) {
        const stop=Math.min(end,referenceStart);
        if(stop>first) pass.draw(4,stop-first,0,first);
        first=stop;
      }
      // Composite each owner's self-extinguished light just after its volume,
      // before nearer finite bodies. Skip the static reference pool otherwise.
      first=Math.max(first,lightStart);
      for(const layer of galaxyLayers) {
        if(layer.after<=first || layer.after>end) continue;
        pass.draw(4,layer.after-first,0,first);
        if(layer.id!==star.id) pass.draw(4,layer.count,0,layer.first);
        first=layer.after;
      }
      if(end>first) pass.draw(4,end-first,0,first);
    }
    if (galaxy) {
      // Catalog/background lights still lie behind the transparent body. Its
      // own bounded lights are composited after it with their foreground column.
      drawPoints(0,lightStart);
      drawPoints(lightEnd,instanceCount);
    } else if (resolved && !isVolumeBody(star)) {
      // The selected material occupies its spatial layer, rather than always
      // covering every finite foreground body. Its point keeps the handoff.
      drawPoints(0,surfaceSplit);
    } else { drawPoints(0,instanceCount); }
    if (resolved && !isVolumeBody(star)) {
      pass.setPipeline(surface);pass.draw(4);
      pass.setPipeline(points);drawPoints(surfaceSplit,instanceCount);
    }
    if (volume) {
      if (star.kind==='pulsar' || star.kind==='blackhole') {
        pass.setPipeline(compactVolume);pass.setBindGroup(0,sceneGroup);pass.setBindGroup(1,compactVolumeGroup);
      } else {pass.setPipeline(copyVolume);pass.setBindGroup(0,volumeGroup);}
      pass.draw(3);
    }
    if (galaxy) {
      pass.setPipeline(points); pass.setBindGroup(0, sceneGroup);
      pass.draw(4, lightEnd - lightStart, 0, lightStart);
    }
    pass.end();
    const destinations = [textures[1], textures[2], textures[1]];
    for (let i = 0; i < 3; i++) {
      const blur = encoder.beginRenderPass({ colorAttachments: [{ view: destinations[i].createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }] });
      blur.setPipeline(bloom); blur.setBindGroup(0, bloomGroups[i]); blur.draw(3); blur.end();
    }
    const finish = encoder.beginRenderPass({ timestampWrites: sample?.end, colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: 'clear', clearValue: CLEAR, storeOp: 'store' }] });
    finish.setPipeline(composite); finish.setBindGroup(0, compositeGroup); finish.draw(3); finish.end();
    sample?.resolve(encoder);
    device.queue.submit([encoder.finish()]);
    sample?.submitted();
  }
  function destroy() {
    destroyed = true;
    instances?.destroy(); bodyLighting.destroy(); uniforms.destroy(); noise.destroy(); volumeNoise.destroy(); maps.destroy(); imageStore.clear(); profiler.destroy();
    for (const texture of textures) texture.destroy();
    for (const buffer of [...blurUniforms,...solidBuffers]) buffer.destroy();
    context.unconfigure(); device.destroy();
  }
  return { resize, setCatalog, setGalaxyLights, setQuality, diagnostics, recordCpu: profiler.cpu, render, destroy };
  } catch (error) {
    // Drain concurrent creation before releasing the device; late image copies
    // must not target a destroyed GPU or turn a load failure into noisy errors.
    await Promise.allSettled(pipelineTasks);
    await initialImages; await geometryTask;
    destroyed = true; imageStore.clear(); profiler.destroy(); context.unconfigure(); device.destroy();
    throw error;
  }
}
