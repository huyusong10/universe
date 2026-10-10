#!/usr/bin/env python3
"""Opt-in actual WebGPU probe of same-geometry direct-light occlusion.

Compare GPU view intersections and sunlight visibility against an independent
all-triangle reference. Samples span every loaded solid, six light directions
and unresolved, transitional and resolved footprints. This is geometry evidence,
not visual acceptance or an OS frame-rate measurement.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def reference(origins, direction, faces):
    """Brute-force Moller-Trumbore intersections; no BVH or GPU traversal."""
    a = faces[:, 0:3].astype(np.float64)
    edge1 = faces[:, 4:7] - a
    edge2 = faces[:, 8:11] - a
    h = np.cross(direction, edge2)
    determinant = np.sum(edge1 * h, axis=1)
    valid = np.abs(determinant) > 1e-10
    divisor = np.where(valid, determinant, 1)
    delta = origins[:, None, :].astype(np.float64) - a[None, :, :]
    u = np.sum(delta * h, axis=2) / divisor
    q = np.cross(delta, edge1)
    v = np.sum(q * direction, axis=2) / divisor
    depth = np.sum(q * edge2, axis=2) / divisor
    hit = valid & (u >= 0) & (v >= 0) & (u + v <= 1) & (depth > 0)
    return np.min(np.where(hit, depth, np.inf), axis=1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:9031/')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    metadata = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {SOLID_DATA} from './assets/observatory-solid-data.js';console.log(JSON.stringify(SOLID_DATA));"
    ], cwd=ROOT))
    chunks = {}
    for kind in ['nodes']:
        values = []
        for file in metadata['files']:
            if file['kind'] != kind:
                continue
            path = ROOT / 'assets/geometry' / file['file']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == file['sha256']
            values.append(np.fromfile(path, dtype='<f4'))
        chunks[kind] = np.concatenate(values).reshape((-1, 8 if kind == 'nodes' else 24))
    # Decode the indexed assets independently of the JS loader and GPU casts.
    # The reference still examines every face, without BVH traversal.
    surface = np.zeros((metadata['triangleCount'] + 2*metadata['vertexCount'], 4), dtype='<u4')
    face_offset, vertex_offset = 0, metadata['triangleCount']
    for file in metadata['files']:
        if file['kind'] != 'triangles':
            continue
        path = ROOT / 'assets/geometry' / file['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == file['sha256']
        cells = np.fromfile(path, dtype='<u4').reshape((-1, 4))
        count, vertices = file['triangleCount'], file['vertexCount']
        assert len(cells) == count + 2*vertices
        surface[face_offset:face_offset+count] = cells[:count]
        surface[vertex_offset:vertex_offset+2*vertices] = cells[count:]
        face_offset += count; vertex_offset += 2*vertices
    assert face_offset == metadata['triangleCount'] and vertex_offset == len(surface)
    headers = surface[:face_offset, :3]
    faces = np.concatenate([surface[headers], surface[headers+1]], axis=1)
    chunks['triangles'] = faces.view('<f4').reshape((-1, 24))
    directions = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0],
                           [0, -1, 0], [0, 0, 1], [0, 0, -1]], dtype=np.float32)
    cases, expected = [], []
    for name, record in metadata['records'].items():
        leaves = chunks['nodes'][record['root']:record['end'], 7]
        starts = leaves[leaves >= 0].astype(int)
        first, end = min(starts), max(starts) + 4
        faces = chunks['triangles'][first:end]
        indices = np.linspace(0, len(faces) - 1, 48, dtype=int)
        selected = faces[indices]
        points = (selected[:, :3] * .23 + selected[:, 4:7] * .31 + selected[:, 8:11] * .46).astype(np.float32)
        # Independent double-precision vertex tangent-plane projection. Only
        # sunlight origins move; finite surface and view depths stay fixed.
        offset = np.zeros(points.shape, dtype=np.float64)
        smooth_normals = np.zeros_like(offset)
        for vertex, weight in enumerate([.23, .31, .46]):
            position = selected[:, vertex*4:vertex*4+3].astype(np.float64)
            normal = selected[:, 12+vertex*4:15+vertex*4].astype(np.float64)
            below = np.maximum(np.sum((position-points)*normal, axis=1), 0)
            offset += normal * below[:, None] * weight
            smooth_normals += normal * weight
        offset /= np.maximum(1, np.linalg.norm(offset, axis=1)/.006)[:, None]
        light_points = (points.astype(np.float64)+offset).astype(np.float32)
        normals = np.cross(selected[:, 4:7] - selected[:, :3],
                           selected[:, 8:11] - selected[:, :3])
        for light in directions:
            # Float32 source offset matches actual GPU coordinates. Reference
            # still uses all faces independently, without escape links.
            origins = (points + light * np.float32(.0015)).astype(np.float32)
            distances = reference(origins, light.astype(np.float64), faces)
            corrected_origins = (light_points + light * np.float32(.0015)).astype(np.float32)
            corrected_distances = reference(corrected_origins, light.astype(np.float64), faces)
            for i, point in enumerate(points):
                cases.append({'name': name, 'point': point.tolist(), 'light': light.tolist(),
                              'range': [record['root'], record['end'], int(first+indices[i]), 0]})
                expected.append({'distance': float(distances[i]),
                                 'correctedDistance': float(corrected_distances[i]),
                                 'lightPoint': light_points[i].tolist(),
                                 'frontFacing': bool(np.dot(normals[i], light) > 1e-6),
                                 'smoothFacing': bool(np.dot(smooth_normals[i], light) > 1e-6)})
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='chromium', headless=True,
                                     args=['--enable-unsafe-webgpu'])
        page = browser.new_page()
        page.route('**/solid-shadow-probe', lambda route: route.fulfill(
            status=200, content_type='text/html', body='<title>Solid light boundary probe</title>'))
        page.goto(args.url.rstrip('/') + '/solid-shadow-probe')
        result = page.evaluate("""async cases => {
          const geometry=await import('/assets/observatory-solid-geometry.js');
          const atlas=await geometry.loadSolidGeometry();
          const bytes=new ArrayBuffer(cases.length*48),floats=new Float32Array(bytes),uints=new Uint32Array(bytes);
          cases.forEach((c,i)=>{floats.set(c.point,i*12);floats.set(c.light,i*12+4);uints.set(c.range,i*12+8);});
          const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
          const errors=[];device.addEventListener('uncapturederror',e=>errors.push(e.error.message));
          const storage=data=>{const b=device.createBuffer({size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(b,0,data);return b;};
          const nodes=storage(atlas.nodes),triangles=storage(atlas.surfaceData),input=storage(bytes);
          const output=device.createBuffer({size:cases.length*48,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
          const read=device.createBuffer({size:cases.length*48,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
          const code=geometry.SOLID_GEOMETRY_WGSL+`
            struct Probe {point:vec4f,light:vec4f,range:vec4u};
            @group(0) @binding(0) var<storage,read> inputs:array<Probe>;
            @group(0) @binding(1) var<storage,read_write> outputs:array<vec4f>;
            @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3u) {
              if(id.x>=arrayLength(&inputs)){return;}let r=inputs[id.x];
              let cells=solidSurface[r.range.z].xyz;
              let a=bitcast<vec4f>(solidSurface[cells.x]).xyz;
              let b=bitcast<vec4f>(solidSurface[cells.y]).xyz;
              let c=bitcast<vec4f>(solidSurface[cells.z]).xyz;
              let na=bitcast<vec4f>(solidSurface[cells.x+1u]).xyz;
              let nb=bitcast<vec4f>(solidSurface[cells.y+1u]).xyz;
              let nc=bitcast<vec4f>(solidSurface[cells.z+1u]).xyz;
              let p=solidLightPoint(r.point.xyz,a,b,c,na,nb,nc,vec3f(.23,.31,.46));
              let h=solidHit(-(r.point.xyz+r.light.xyz*.0015),r.light.xyz,r.range.xy);
              outputs[id.x*3u]=vec4f(h.distance,
                solidSunVisibility(r.point.xyz,r.light.xyz,r.range.xy,8.0),
                solidSunVisibility(r.point.xyz,r.light.xyz,r.range.xy,28.0),
                solidSunVisibility(r.point.xyz,r.light.xyz,r.range.xy,160.0));
              let corrected=solidHit(-(p+r.light.xyz*.0015),r.light.xyz,r.range.xy);
              outputs[id.x*3u+1u]=vec4f(corrected.distance,
                solidSunVisibility(p,r.light.xyz,r.range.xy,8.0),
                solidSunVisibility(p,r.light.xyz,r.range.xy,28.0),
                solidSunVisibility(p,r.light.xyz,r.range.xy,160.0));
              outputs[id.x*3u+2u]=vec4f(p,length(p-r.point.xyz));
            }`;
          const module=device.createShaderModule({code}),info=await module.getCompilationInfo();
          const compilation=[...info.messages].map(m=>({type:m.type,message:m.message}));
          if(compilation.some(m=>m.type==='error'))throw Error(JSON.stringify(compilation));
          const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
          const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
            {binding:0,resource:{buffer:input}},{binding:1,resource:{buffer:output}},
            {binding:13,resource:{buffer:nodes}},{binding:14,resource:{buffer:triangles}}]});
          const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
          pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(cases.length/64));pass.end();
          encoder.copyBufferToBuffer(output,0,read,0,cases.length*48);device.queue.submit([encoder.finish()]);
          await read.mapAsync(GPUMapMode.READ);const values=Array.from(new Float32Array(read.getMappedRange()));
          read.unmap();for(const b of [nodes,triangles,input,output,read])b.destroy();device.destroy();
          return {values,errors,compilation,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,fallback:adapter.info.isFallbackAdapter}};
        }""", cases)
        browser.close()
    values = np.array(result.pop('values'), dtype=np.float64).reshape((-1, 12))
    mismatch, maximum, summary = [], 0.0, {}
    for i, (case, truth) in enumerate(zip(cases, expected)):
        blocked = np.isfinite(truth['distance'])
        gpu = values[i]
        difference = abs(gpu[0] - truth['distance']) if blocked else 0.0
        maximum = max(maximum, difference)
        corrected_blocked = np.isfinite(truth['correctedDistance'])
        corrected_difference = abs(gpu[4]-truth['correctedDistance']) if corrected_blocked else 0
        maximum = max(maximum, corrected_difference)
        if (blocked != (gpu[0] > 0) or difference > 5e-5 or
                not np.allclose(gpu[1:4], [1, .5 if blocked else 1, 0 if blocked else 1], atol=1e-6) or
                corrected_blocked != (gpu[4]>0) or corrected_difference>5e-5 or
                not np.allclose(gpu[5:8], [1, .5 if corrected_blocked else 1, 0 if corrected_blocked else 1], atol=1e-6) or
                not np.allclose(gpu[8:11], truth['lightPoint'], atol=3e-7) or gpu[11]>.006001):
            mismatch.append({'case': i, 'shape': case['name'], 'gpu': gpu.tolist(),
                             'blocked': bool(blocked), 'distanceError': difference})
        counts = summary.setdefault(case['name'], {'rays': 0, 'blocked': 0, 'frontFacingOccluded': 0,
            'correctedBlocked': 0, 'correctedFrontFacingOccluded': 0, 'releasedSmoothFacingShadow': 0})
        counts['rays'] += 1
        counts['blocked'] += int(blocked)
        counts['frontFacingOccluded'] += int(blocked and truth['frontFacing'])
        counts['correctedBlocked'] += int(corrected_blocked)
        counts['correctedFrontFacingOccluded'] += int(corrected_blocked and truth['frontFacing'])
        counts['releasedSmoothFacingShadow'] += int(blocked and not corrected_blocked and truth['smoothFacing'])
    report = {'status': 'passed' if not mismatch and not result['errors'] else 'failed',
              **result, 'shapes': len(summary), 'rays': len(cases)*2, 'surfaceSamples': len(cases), 'footprints': [8, 28, 160],
              'maxDistanceError': maximum, 'mismatches': mismatch, 'byShape': summary,
              'sourceHash': hashlib.sha256((ROOT/'assets/observatory-solid-geometry.js').read_bytes()).hexdigest(),
              'reference': 'All-triangle double precision reference, independent of the BVH, for both finite-face and bounded smooth-support origins; source positions and the direct-light bias use float32.',
              'limits': 'Sampling proves discrete geometry/light consistency, not all pixels, astronomy, soft penumbra or visual quality.'}
    (args.output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    assert report['status'] == 'passed', mismatch[:8]
    assert sum(c['frontFacingOccluded'] for c in summary.values()) > 0, 'No actual concavity occlusion witnessed'
    assert sum(c['correctedFrontFacingOccluded'] for c in summary.values()) > 0, 'Corrected origins erased every sampled concavity shadow'
    assert sum(c['releasedSmoothFacingShadow'] for c in summary.values()) > 0, 'No sampled smooth-facing shadow released'
    print('All', len(summary), 'solids;', len(cases)*2, 'independent rays at three footprints; max error', maximum)


if __name__ == '__main__':
    main()
