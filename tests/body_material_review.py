#!/usr/bin/env python3
"""Opt-in GPU review of selection-independent world and stellar appearance.

Collect whole/close views in both quality extremes. A guarded, isolated renderer
fixture then suppresses the selected surface and renders that same catalog body
as a neighbour, preserving its actual camera, clock, texture and light. This is
boundary evidence, not a substitute for a real family-navigation visual review.
Continuous stellar comparisons use an isolated initial paused clock so both
ownership passes share exactly the same phase; real motion needs separate review.
No product files, catalog identities, or saved user state are modified.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import time

import lod_visual_smoke as journey

ROOT = Path(__file__).resolve().parents[1]
WORLD_TARGETS = ['Earth', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
           'Uranus', 'Neptune', 'Io', 'Europa', 'Enceladus', 'Titan',
           'Ganymede', 'Callisto', 'Triton', 'Mimas', 'Pluto', 'Charon', 'Ceres', 'Vesta', 'Phobos', 'Deimos', 'Miranda', 'Iapetus', 'Ariel', 'Umbriel', 'Titania', 'Oberon', 'Halley']
THERMAL_STARS = ['Sol', 'Proxima Centauri', 'Rigil Kentaurus', "Barnard's Star", 'Epsilon Eridani', 'Procyon', '61 Cygni', 'Tau Ceti', 'Arcturus', 'Aldebaran', 'Betelgeuse', 'Antares']
QUIET_STARS = ['Rigel', 'Sirius', 'Vega', 'Sirius B']
FRONTIER_TARGETS = ['Eris','Haumea','Makemake','Rhea','Dione','Tethys','Proteus','Eros','Bennu','Wild 2','Tempel 1','Eagle Nebula','Horsehead Nebula','Carina Nebula','Crab Nebula','Crab Pulsar','Vela Pulsar','Sagittarius A*','M87*']
SMALL_WORLD_TARGETS = ['Ryugu','Itokawa','Lutetia','Ida','Dactyl','Mathilde','Psyche','Gaspra','Steins','67P']
REMOTE_TARGETS = ['Hyperion','Pan','Atlas','Phoebe','Nereid','Arrokoth','Chariklo','Sedna','Quaoar']
SMALL_SATELLITE_TARGETS = ['Amalthea', 'Thebe', 'Himalia', 'Janus', 'Epimetheus', 'Helene', 'Telesto', 'Calypso', 'Prometheus', 'Pandora', 'Galatea', 'Despina', 'Kleopatra', 'AlexHelios', 'CleoSelene', 'Hygiea']
OUTER_MOON_TARGETS = ['Styx','Nix','Kerberos','Hydra','Dysnomia','Hiʻiaka','Namaka','MK 2']
FRONTIER_BINARY_TARGETS = ['Orcus','Vanth','Gonggong','Xiangliu','Salacia','Actaea','Varda','Ilmarë','Varuna','Ixion','Weywot','2002 MS4']
COMPACT_TARGETS = ['PSR B1509-58','Geminga','Cygnus X-1','MAXI J1820+070','Procyon B',"van Maanen's Star"]
EXOPLANET_TARGETS = ['Proxima Centauri b', 'TRAPPIST-1', 'TRAPPIST-1 b', 'TRAPPIST-1 c', 'TRAPPIST-1 d', 'TRAPPIST-1 e', 'TRAPPIST-1 f', 'TRAPPIST-1 g', 'TRAPPIST-1 h', '51 Pegasi', '51 Pegasi b']
EXTREME_TARGETS = ['55 Cancri e','LHS 3844 b','Kepler-10 b','HD 189733 b','HD 209458 b','WASP-39 b','WASP-121 b','GJ 1214 b','55 Cancri','LHS 3844','Kepler-10','HD 189733','HD 209458','WASP-39','WASP-121','GJ 1214']
YOUNG_TARGETS = ['HR 8799 b','HR 8799 c','HR 8799 d','HR 8799 e','Beta Pictoris b','Beta Pictoris c','Beta Pictoris d','PDS 70 b','PDS 70 c','Kepler-51 b','Kepler-51 c','Kepler-51 d','Kepler-51 e','HR 8799','Beta Pictoris','PDS 70','Kepler-51']
TARGETS = YOUNG_TARGETS + EXTREME_TARGETS + EXOPLANET_TARGETS + COMPACT_TARGETS + WORLD_TARGETS + THERMAL_STARS + QUIET_STARS + FRONTIER_TARGETS + SMALL_WORLD_TARGETS + REMOTE_TARGETS + SMALL_SATELLITE_TARGETS + OUTER_MOON_TARGETS + FRONTIER_BINARY_TARGETS
POSE = ['activeId', 'observedId', 'distance', 'distanceTarget', 'cameraYaw',
        'cameraPitch', 'cameraRoll', 'fov', 'animationTime']


def neighbour_fixture(source):
    identity = 'spin, progress, star.id, hover ?? -1,'
    surface = 'pass.setPipeline(surface);pass.draw(4);'
    if source.count(identity) != 1 or source.count(surface) != 1:
        raise RuntimeError('Renderer ownership changed; review the isolated material fixture.')
    return source.replace(identity, 'spin, progress, -99, hover ?? -1,').replace(
        surface, '/* Isolated selected material omitted; foreground layers remain. */')


def exact(page):
    journey.settled(page)
    page.wait_for_function('''() => {
      const s=window.__universeObservatoryState;
      return s && !s.flight && s.distance===s.distanceTarget && s.activeId===s.observedId;
    }''', timeout=30000)
    return journey.state(page)


def wind_depth_probe(page):
    """Real GPU evidence for a transparent foreground opening.

    This explicitly probes the private WGSL adapter. A rename needs review;
    the assertions protect nonnegative finite-depth integration, not a recipe.
    """
    result = page.evaluate('''async(version)=>{
      const sources=await import('/assets/observatory-shaders.js?v='+version);
      const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
      const rows=[];
      for(const x of [0,.12,.8])for(const z of [-4,0,2,6,12])
        for(const limit of [0,1,2,4,16])for(const start of [0,1,2,6])rows.push([limit,start,x,z]);
      const code=sources.SURFACE_SHADER+`
        @group(0) @binding(16) var<storage,read> depthInput:array<vec4f>;
        @group(0) @binding(17) var<storage,read_write> depthOutput:array<vec4f>;
        @compute @workgroup_size(64) fn probeWindDepth(@builtin(global_invocation_id) id:vec3u) {
          if(id.x>=arrayLength(&depthInput)){return;}
          let p=depthInput[id.x];let centre=vec3f(p.z,0,p.w);
          let ray=vec3f(0,0,1);let side=vec3f(1,0,0);let sigma=vec3f(1.0,.25,.18);
          let full=pulsarClippedDensity(centre,ray,ray,side,sigma,p.x,28.0);
          let clipped=pulsarClippedInterval(centre,ray,ray,side,sigma,p.x,28.0,p.y);
          depthOutput[id.x]=vec4f(full,clipped,0,0);
        }`;
      const module=device.createShaderModule({code});
      const messages=[...(await module.getCompilationInfo()).messages].map(m=>({type:m.type,message:m.message,line:m.lineNum}));
      if(messages.some(m=>m.type==='error'))throw Error(JSON.stringify(messages));
      const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probeWindDepth'}});
      const size=rows.length*16,src=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
      const dst=device.createBuffer({size,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
      const read=device.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
      device.queue.writeBuffer(src,0,new Float32Array(rows.flat()));
      const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:16,resource:{buffer:src}},{binding:17,resource:{buffer:dst}}]});
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(rows.length/64));pass.end();encoder.copyBufferToBuffer(dst,0,read,0,size);device.queue.submit([encoder.finish()]);
      await read.mapAsync(GPUMapMode.READ);const output=Array.from(new Float32Array(read.getMappedRange()));read.unmap();
      src.destroy();dst.destroy();read.destroy();device.destroy();return {rows,output,messages};
    }''', journey.state(page)['version'])
    for i, (limit, start, _, _) in enumerate(result['rows']):
        full, clipped = result['output'][i*4:i*4+2]
        assert math.isfinite(full) and math.isfinite(clipped)
        assert 0 <= clipped <= full + 1e-6
        if start == 0:
            assert clipped == full, 'Existing zero-start beam/jet integration changed'
        if limit <= start:
            assert clipped == 0, 'A reversed or empty interval emitted wind light'
    return {'status':'passed', 'samples':len(result['rows']),
            'nonnegative':True, 'foregroundNeverAddsLight':True,
            'emptyIntervalDark':True, 'zeroStartPreserved':True,
            'limits':'Private WGSL adapter probe, not visual quality or physical transfer accuracy.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:9021/')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--targets', nargs='+', choices=TARGETS, default=WORLD_TARGETS[:-1])
    parser.add_argument('--qualities', nargs='+', choices=['immersive','standard','safe'], default=['immersive','safe'])
    parser.add_argument('--selected-only', action='store_true', help='Reuse unaffected neighbour ownership evidence')
    parser.add_argument('--continuous', action='store_true', help='Record the scale/orbit/retreat process in one batch')
    parser.add_argument('--fixed-clock', action='store_true', help='Use a declared isolated zero-phase clock for material comparisons; review real activity separately')
    parser.add_argument('--resume', action='store_true', help='Reuse completed cases only when runtime source hashes still match')
    args = parser.parse_args()
    from PIL import Image, ImageChops, ImageStat
    from playwright.sync_api import sync_playwright
    args.output.mkdir(parents=True, exist_ok=args.resume)
    source = (ROOT / 'assets/observatory-renderer.js').read_text()
    fixture = neighbour_fixture(source)
    clock_fixture = None
    if args.fixed_clock or (args.continuous and any(name in QUIET_STARS + THERMAL_STARS for name in args.targets)):
        worker = (ROOT / 'assets/stars-observatory-worker.js').read_text()
        initial_mode = "let activityMode = 'flow';"
        if worker.count(initial_mode) != 1:
            raise RuntimeError('Worker initial clock changed; review the fixed-phase material fixture.')
        clock_fixture = worker.replace(initial_mode, "let activityMode = 'paused';")
    report = {'status': 'running', 'scope': __doc__, 'cases': [], 'errors': [],
              'sourceHashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in [ROOT/'index.html', *sorted((ROOT/'assets').glob('*.js'))]},
              'fixtureHash': hashlib.sha256(fixture.encode()).hexdigest()}
    if clock_fixture:
        report['clockFixture'] = {'initialMode':'paused', 'initialPhase':0,
                                 'hash':hashlib.sha256(clock_fixture.encode()).hexdigest()}
    if args.resume:
        previous = json.loads((args.output/'report.json').read_text())
        if previous['sourceHashes'] != report['sourceHashes'] or previous.get('clockFixture') != report.get('clockFixture'):
            raise RuntimeError('Runtime or clock fixture changed; collect new material evidence instead of resuming.')
        attempt = f"attempt-before-resume-{len(previous.get('resumes', []))+1}.json"
        (args.output/attempt).write_text(json.dumps(previous, ensure_ascii=False, indent=2)+'\n')
        completed = [case for case in previous['cases'] if
                     (case['role']=='selected' and len(case['captures'])==(4 if args.continuous else 2)
                      and (not args.continuous or case.get('returnToMap'))) or
                     (case['role']=='neighbour' and len(case['captures'])==2
                      and len(case.get('comparisons',[]))==2
                      and all(item['meanAbsRGB']<4 for item in case.get('comparisons',[])))]
        previous.update(status='running', cases=completed)
        previous.setdefault('resumes',[]).append({'retainedAttempt':attempt, 'reusedCases':len(completed)})
        previous.pop('failure',None)
        report = previous

    def save():
        (args.output/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

    def record(page, quality, name, role):
        if any(case['target']==name and case['quality']==quality and case['role']==role for case in report['cases']):
            print(quality, name, role, 'reused source-matched complete evidence', flush=True)
            return
        page.goto(journey.configured_url(args.url, debug=1, lang='en' if quality=='safe' else 'zh', target=name,
                                        catalog=50000, budget=quality), wait_until='networkidle')
        journey.wait_ready(page, report['errors'])
        if name in ['Crab Pulsar','Vela Pulsar','PSR B1509-58','Geminga'] and 'windDepthProbe' not in report:
            report['windDepthProbe'] = wind_depth_probe(page)
        report.setdefault('sourceVersion', journey.state(page)['version'])
        assert journey.state(page)['version'] == report['sourceVersion']
        page.get_by_test_id('approach-target').click()
        exact(page)
        if args.continuous:
            page.emulate_media(reduced_motion='no-preference')
            page.wait_for_function('()=>window.__universeObservatoryState?.sceneMotion?.reduced===false')
            page.get_by_test_id('open-dynamics').click();page.get_by_test_id('motion-paused').check();page.keyboard.press('Escape')
            page.emulate_media(reduced_motion='reduce')
        page.get_by_test_id('hide-guide').click()
        journey.full_observation(page)
        case = {'target': name, 'quality': quality, 'role': role, 'captures': [],
                'events': [], 'timelineOrigin': time.monotonic()}
        report['cases'].append(case)
        stages=['whole','close','orbit','retreat'] if args.continuous and role=='selected' else ['whole','close']
        for stage in stages:
            if stage == 'close':
                from_distance = journey.state(page)['distance']
                if args.continuous:
                    page.emulate_media(reduced_motion='no-preference')
                    # Worker preferences arrive asynchronously. Establish the
                    # actual navigation mode before collecting scale motion.
                    page.wait_for_function('window.__universeObservatoryState?.sceneMotion?.reduced === false')
                page.get_by_test_id('scale-slider').press('End')
                if args.continuous:
                    page.wait_for_function('''start => {
                      const s=window.__universeObservatoryState;
                      return !s.sceneMotion.reduced && s.distance<start &&
                        s.distance>s.distanceTarget*(1+1e-4);
                    }''', arg=from_distance)
                    case['continuousScaleMotion'] = True
                exact(page)
                close=journey.state(page)
                assert math.isclose(close['distance'],close['minDistance'],rel_tol=1e-9), (close['distance'],close['minDistance'])
            if stage == 'orbit':
                for _ in range(9): page.get_by_test_id('star-map').press('ArrowRight')
                page.get_by_test_id('star-map').press('Escape');exact(page)
            if stage == 'retreat':
                page.get_by_test_id('scale-LocalSystem').click();exact(page)
                page.emulate_media(reduced_motion='reduce')
            snap = journey.capture(page, f'{quality}-{name.lower()}-{stage}-{role}', args.output, case)
            if role == 'neighbour':
                base = next(c for c in report['cases'] if c['target']==name and
                            c['quality']==quality and c['role']=='selected')['captures'][stage=='close']
                assert all(base['state'][field] == snap[field] for field in POSE), (name, stage)
                assert base['state']['observedPosition'] == snap['observedPosition'], (name, stage)
                a = Image.open(base['file']).convert('RGB')
                b = Image.open(case['captures'][-1]['file']).convert('RGB')
                # Compare a body interior rather than the field, UI or ring edge.
                radius = min(snap['starRadiusPx']*.50, a.height*.24)
                x,y = snap['observedX'],snap['observedY']
                box = tuple(round(v) for v in (x-radius,y-radius,x+radius,y+radius))
                difference = ImageChops.difference(a.crop(box),b.crop(box))
                mean = sum(ImageStat.Stat(difference).mean)/3
                case.setdefault('comparisons', []).append({'stage':stage, 'meanAbsRGB':mean,'box':box})
                # A coarse failure gate for a different/missing material, not a beauty score.
                assert mean < 4.0, (name, stage, 'selection changes visible surface', mean)
        if args.continuous:
            page.get_by_test_id('return-overview').click();exact(page)
            assert journey.state(page)['scaleStage']=='Galactic'
            case['returnToMap']=True
        save()
        print(quality, name, role, 'captured', flush=True)

    save()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel='chromium', headless=True,
                                         args=['--enable-unsafe-webgpu'])
            try:
                for quality in args.qualities:
                    context = browser.new_context(viewport={'width':1280,'height':720},
                                                  reduced_motion='reduce', device_scale_factor=1,
                                                  **({'record_video_dir':str(args.output/quality/'video'), 'record_video_size':{'width':1280,'height':720}} if args.continuous else {}))
                    page = context.new_page()
                    if clock_fixture:
                        page.route('**/stars-observatory-worker.js*', lambda route: route.fulfill(
                            status=200, content_type='application/javascript', body=clock_fixture))
                    page.on('pageerror', lambda e: report['errors'].append(str(e)))
                    page.on('console', lambda m: report['errors'].append(m.text) if m.type=='error' else None)
                    if args.continuous: report.setdefault('videos',[]).append(str(page.video.path()))
                    for name in args.targets:
                        record(page,quality,name,'selected')
                    # Arbitrary generated stars remain points outside active views.
                    # Finite white dwarfs and authored stellar parents use the
                    # reference-sphere fixture; actual family navigation is separate.
                    # Resolve actual body semantics so newly added opaque worlds
                    # receive the same ownership evidence as legacy destinations.
                    neighbours = []
                    if quality == 'immersive' and not args.selected_only and not args.continuous:
                        if page.url == 'about:blank':
                            page.goto(args.url, wait_until='domcontentloaded')
                        neighbours = page.evaluate("""async names => {
                          const {createCatalog,resolveCatalogTarget}=await import('/assets/observatory-model.js');
                          const catalog=createCatalog();
                          return names.filter(name=>['planet','dwarfplanet','asteroid','moon'].includes(resolveCatalogTarget(catalog,name)?.kind));
                        }""", args.targets)
                    neighbours.extend(name for name in args.targets if name in ['Sirius B','Procyon B',"van Maanen's Star",'Procyon','Sirius','Proxima Centauri','TRAPPIST-1','51 Pegasi'])
                    if quality == 'immersive' and not args.selected_only and neighbours:
                        page.route('**/observatory-renderer.js*', lambda route: route.fulfill(
                            status=200, content_type='application/javascript', body=fixture))
                        for name in neighbours:
                            record(page,quality,name,'neighbour')
                    context.close()
            finally:
                browser.close()
        assert not report['errors'], report['errors']
        assert all(hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==h
                   for n,h in report['sourceHashes'].items())
        report['status'] = 'captured'
    except journey.EnvironmentUnavailable as error:
        report.update(status='environment-unavailable',failure=str(error))
        raise
    except BaseException as error:
        report.update(status='failed',failure=str(error))
        raise
    finally:
        save()


if __name__ == '__main__':
    main()
