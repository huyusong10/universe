#!/usr/bin/env python3
"""Opt-in GPU workload review, using an isolated Worker import override.

Replay counts are work counts, not performance ratios. Calibrate measured GPU
slowdown against 1x before interpreting a weaker-device envelope. The probe
never modifies product files or OS settings, and does not certify Intel
hardware or operating-system presentation FPS.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import time

import lod_visual_smoke as journey

ROOT = Path(__file__).resolve().parents[1]
SCENES = {
    'haumea-core': ('Haumea',50042,True),
    'mini-exo-core': ('GJ 1214 b',50159,True),
    'lava-core': ('55 Cancri e',50145,True),
    'basalt-core': ('LHS 3844 b',50147,True),
    'blue-exo-core': ('HD 189733 b',50151,True),
    'ultrahot-core': ('WASP-121 b',50157,True),
    'exorock-core': ('Proxima Centauri b',50133,True),
    'exoice-core': ('TRAPPIST-1 h',50141,True),
    'hotjupiter-core': ('51 Pegasi b',50143,True),
    'opening': None,
    'galactic-edge': None,
    'galactic-regional': None,
    'solar-family': ('Sol', 0, False),
    'earth-system': ('Earth', 50000, False),
    'pluto-core': ('Pluto', 50022, True),
    'charon-core': ('Charon', 50023, True),
    'ceres-core': ('Ceres', 50024, True),
    'vesta-core': ('Vesta', 50025, True),
    'phobos-core': ('Phobos', 50031, True),
    'deimos-core': ('Deimos', 50032, True),
    'miranda-core': ('Miranda', 50033, True),
    'iapetus-core': ('Iapetus', 50034, True),
    'ariel-core': ('Ariel', 50037, True),
    'umbriel-core': ('Umbriel', 50038, True),
    'titania-core': ('Titania', 50039, True),
    'oberon-core': ('Oberon', 50040, True),
    'kerberos-core': ('Kerberos', 50093, True),
    'orcus-core': ('Orcus', 50115, True),
    'varuna-core': ('Varuna', 50123, True),
    'ms4-core': ('2002 MS4', 50126, True),
    'hydra-core': ('Hydra', 50094, True),
    'mk2-core': ('MK 2', 50098, True),
    'rhea-core': ('Rhea', 50044, True),
    'dione-core': ('Dione', 50045, True),
    'tethys-core': ('Tethys', 50046, True),
    'eros-core': ('Eros', 50048, True),
    'bennu-core': ('Bennu', 50049, True),
    'itokawa-core': ('Itokawa', 50057, True),
    'mathilde-core': ('Mathilde', 50061, True),
    '67p-core': ('67P/Churyumov-Gerasimenko', 50065, True),
    'psyche-core': ('Psyche', 50062, True),
    'hyperion-core': ('Hyperion', 50066, True),
    'amalthea-core': ('Amalthea', 50075, True),
    'telesto-core': ('Telesto', 50081, True),
    'kleopatra-core': ('Kleopatra', 50087, True),
    'chariklo-core': ('Chariklo', 50072, True),
    'proteus-core': ('Proteus', 50047, True),
    'dumbbell-clouds': ('Dumbbell Nebula', 50099, True),
    'butterfly-clouds': ('Butterfly Nebula', 50101, True),
    'rosette-clouds': ('Rosette Nebula', 50103, True),
    'veil-clouds': ('Veil Nebula', 50104, True),
    'eagle-clouds': ('Eagle Nebula', 50052, True),
    'crab-nebula-deep': ('Crab Nebula', 50055, True),
    'b1509-core': ('PSR B1509-58', 50127, True),
    'geminga-core': ('Geminga', 50128, True),
    'cygnus-disk': ('Cygnus X-1', 50129, True),
    'maxi-core': ('MAXI J1820+070', 50130, True),
    'procyon-b-core': ('Procyon B', 50131, True),
    'pulsar-beams': ('Crab Pulsar', 50008, False),
    'pulsar-core': ('Crab Pulsar', 50008, True),
    'blackhole-disk': ('Sagittarius A*', 50009, False),
    'blackhole-close': ('Sagittarius A*', 50009, True),
    'blackhole-edge': ('Sagittarius A*', 50009, True),
    'blackhole-face': ('Sagittarius A*', 50009, True),
    'comet-tails': ("Halley's Comet", 50006, False),
    'comet-core': ("Halley's Comet", 50006, True),
    'nebula-deep': ('Orion Nebula', 50002, True),
    'ring-nebula-whole': ('Ring Nebula', 50026, False),
    'ring-nebula-deep': ('Ring Nebula', 50026, True),
    'helix-nebula-deep': ('Helix Nebula', 50035, True),
    'lagoon-nebula-deep': ('Lagoon Nebula', 50036, True),
    'triangulum-disc': ('Triangulum Galaxy', 50027, False),
    'triangulum-deep': ('Triangulum Galaxy', 50027, True),
    'vela-whole': ('Vela Pulsar', 50028, False),
    'vela-core': ('Vela Pulsar', 50028, True),
    'm87-whole': ('M87*', 50029, False),
    'm87-close': ('M87*', 50029, True),
    'galaxy-disc': ('Andromeda Galaxy', 50005, False),
    'galaxy-deep': ('Andromeda Galaxy', 50005, True),
    'whirlpool-deep': ('Whirlpool Galaxy', 50107, True),
    'barred-deep': ('NGC 1300', 50108, True),
    'sombrero-deep': ('Sombrero Galaxy', 50109, True),
    'centaurusa-deep': ('Centaurus A', 50110, True),
    'cigar-deep': ('Cigar Galaxy', 50111, True),
    'needle-deep': ('Needle Galaxy', 50112, True),
    'elliptical-deep': ('Messier 49', 50113, True),
    'cartwheel-deep': ('Cartwheel Galaxy', 50114, True),
    'mercury-core': ('Mercury', 50010, True),
    'venus-clouds': ('Venus', 50011, True),
    'uranus-rings': ('Uranus', 50012, True),
    'neptune-clouds': ('Neptune', 50013, True),
    'io-core': ('Io', 50014, True),
    'europa-core': ('Europa', 50015, True),
    'enceladus-core': ('Enceladus', 50016, True),
    'titan-haze': ('Titan', 50017, True),
    'ganymede-core': ('Ganymede', 50018, True),
    'callisto-core': ('Callisto', 50019, True),
    'triton-core': ('Triton', 50020, True),
    'mimas-core': ('Mimas', 50021, True),
    'mars-core': ('Mars', 50004, True),
    'earth-core': ('Earth', 50000, True),
    'moon-core': ('Moon', 50003, True),
    'saturn-rings': ('Saturn', 50001, True),
    'jupiter-clouds': ('Jupiter', 50007, True),
    'sun-core': ('Sol', 0, True),
    'orange-giant-core': ('Arcturus', 13, True),
    'red-star-core': ('Betelgeuse', 18, True),
    'blue-star-core': ('Rigel', 20, True),
    'sirius-core': ('Sirius', 4, True),
    'sirius-system': ('Sirius', 4, False),
    'red-dwarf-core': ('Proxima Centauri', 1, True),
    'white-dwarf-core': ('Sirius B', 50030, True),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def replay_source(source, count):
    # Instrumentation is deliberately guarded: a renderer change requires review.
    begin = '    const encoder = device.createCommandEncoder();\n'
    end = '    sample?.resolve(encoder);'
    if source.count(begin) != 1 or source.count(end) != 1:
        raise RuntimeError('Renderer instrumentation boundary changed; review this probe.')
    head, tail = source.split(begin)
    passes, foot = tail.split(end)
    if (passes.count('timestampWrites: sample?.start') != 1 or
            passes.count('timestampWrites: sample?.end') != 1 or
            'device.queue.submit' in passes or 'queue.writeBuffer' in passes):
        raise RuntimeError('Render pass ownership changed; review this probe.')
    passes = passes.replace('timestampWrites: sample?.start',
                            'timestampWrites: replayIndex === 0 ? sample?.start : undefined')
    passes = passes.replace('timestampWrites: sample?.end',
                            f'timestampWrites: replayIndex === {count - 1} ? sample?.end : undefined')
    result = (head + begin + f'    for (let replayIndex = 0; replayIndex < {count}; replayIndex++) {{\n'
              + passes + '    }\n' + end + foot)
    header = re.search(r'  function render\([^\n]+\) \{', result)
    submitted = '    device.queue.submit([encoder.finish()]);'
    if not header or result.count(submitted) != 1:
        raise RuntimeError('Submission boundary changed; review this probe.')
    result = result.replace(header.group(0), '  let replayPending = false;\n' +
                            header.group(0) + '\n    if (replayPending) return;')
    result = result.replace(submitted, submitted + '\n    replayPending = true;\n' +
                            '    device.queue.onSubmittedWorkDone().then(() => { replayPending = false; }, '
                            '() => { replayPending = false; });')
    return result


def percentile95(values):
    return sorted(values)[min(len(values) - 1, math.floor(len(values) * .95))]


def observe(page, scene):
    if SCENES[scene] is None:
        page.get_by_test_id('star-map').press('Home')
        journey.settled(page)
        page.wait_for_function("""() => {
          const s = window.__universeObservatoryState;
          return s?.activeId === 0 && s.observedId === 0 && s.scaleStage === 'Galactic' && !s.flight;
        }""")
        if scene != 'opening':
            if page.get_by_test_id('hide-guide').is_visible():
                page.get_by_test_id('hide-guide').click()
            journey.full_observation(page)
        if scene == 'galactic-edge':
            # Establish a shallow disc view using public inputs without inertia.
            # Restore the requested clock preference before collecting costs.
            reduced = page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
            page.emulate_media(reduced_motion='reduce')
            page.wait_for_function('window.__universeObservatoryState?.sceneMotion?.rate === 0')
            for _ in range(6):
                page.get_by_test_id('star-map').press('ArrowUp')
            journey.settled(page)
            if not reduced:
                page.emulate_media(reduced_motion='no-preference')
        elif scene == 'galactic-regional':
            page.get_by_test_id('scale-Regional').click()
            journey.settled(page)
        return
    if scene in ('solar-family', 'earth-system'):
        page.get_by_test_id('open-destinations').click()
        page.get_by_test_id('navigation-system').click()
        page.get_by_test_id('system-overview' if scene == 'solar-family' else 'local-system-50000').click()
        page.wait_for_function("""id => {
          const s = window.__universeObservatoryState;
          return s?.systemView?.rootId === id && s.systemView.visible && !s.flight;
        }""", arg=0 if scene == 'solar-family' else 50000, timeout=45000)
        journey.settled(page)
        if page.get_by_test_id('hide-guide').is_visible():
            page.get_by_test_id('hide-guide').click()
        journey.full_observation(page)
        return
    name, identity, closest = SCENES[scene]
    page.get_by_test_id('open-destinations').click()
    page.get_by_test_id('browse-featured').click()
    page.get_by_test_id('star-search').fill(name)
    page.get_by_test_id('destinations').locator(f'button[data-target="{name}"]:visible').click()
    page.wait_for_function("""id => {
      const s = window.__universeObservatoryState;
      return s?.activeId === id && s.observedId === id && !s.flight && s.navigationState !== 'flying';
    }""", arg=identity, timeout=45000)
    journey.settled(page)
    if scene == 'sirius-system':
        page.get_by_test_id('guide-local-system').click()
        page.wait_for_function("""() => {
          const s=window.__universeObservatoryState;
          return s?.systemView?.rootId===4 && s.systemView.visible && !s.flight;
        }""",timeout=45000)
        journey.settled(page)
    if page.get_by_test_id('hide-guide').is_visible():
        page.get_by_test_id('hide-guide').click()
    journey.full_observation(page)
    if closest:
        page.get_by_test_id('scale-slider').press('End')
        journey.settled(page)
    if scene in ('blackhole-edge', 'blackhole-face'):
        # Public orbit input, covering the finite-thickness and full-disc views.
        key, count = ('ArrowUp', 5) if scene.endswith('edge') else ('ArrowDown', 13)
        for _ in range(count):
            page.get_by_test_id('star-map').press(key)
        page.get_by_test_id('star-map').press('Escape')
        journey.settled(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='Existing local server; otherwise start an isolated one')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--quality', choices=('safe', 'standard', 'immersive'), default='safe')
    parser.add_argument('--repeats', type=int, nargs='+', default=[1],
                        help='Actual pass sequence counts; these are not GPU slowdown ratios')
    parser.add_argument('--scenes', choices=list(SCENES), nargs='+', default=list(SCENES))
    parser.add_argument('--samples', type=int, default=45)
    parser.add_argument('--reduced-motion', action='store_true', help='Freeze phase for image comparisons')
    args = parser.parse_args()
    if not all(1 <= n <= 256 for n in args.repeats) or not 15 <= args.samples <= 90:
        parser.error('Use replay counts 1..256 and 15..90 samples.')
    from playwright.sync_api import sync_playwright
    args.output.mkdir(parents=True, exist_ok=True)
    inputs = [ROOT / 'index.html', *sorted((ROOT / 'assets').glob('*.js'))]
    hashes = {str(p.relative_to(ROOT)): digest(p.read_bytes()) for p in inputs}
    source = (ROOT / 'assets/observatory-renderer.js').read_text()
    version = re.search(r'BUILD_VERSION\s*=\s*"([^"]+)"', (ROOT / 'index.html').read_text()).group(1)
    report = {'status': 'running', 'sourceVersion': version, 'sourceHashes': hashes,
              'quality': args.quality, 'replayCounts': args.repeats, 'cases': [], 'errors': [],
              'conditions': {'cssViewport': [1920, 1080], 'deviceScaleFactor': 2, 'catalog': 50000,
                             'reducedMotion': args.reduced_motion, 'singleSubmissionInFlight': True},
              'method': 'Owned automation context replays the original passes with identical uniforms, '
                        'resources, pose and scene time. Timestamps span all passes; one submission '
                        'and presentation remain. The test queue is bounded to one submission.',
              'limits': ['Replay count is not measured slowdown; calibrate against 1x.',
                         'CPU encoding overhead is measured, not an Intel CPU model.',
                         'Caches, driver, bandwidth and architecture are not emulated.',
                         'Not Intel hardware evidence or OS presentation FPS.']}

    def save():
        (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    save()
    try:
        with journey.server_url(args.url) as url, sync_playwright() as p:
            browser = p.chromium.launch(channel='chromium', headless=True, args=['--enable-unsafe-webgpu'])
            try:
                for count in args.repeats:
                    modified = replay_source(source, count)
                    interception = {'replayCount': count, 'urls': [], 'sha256': digest(modified.encode())}
                    (args.output / f'renderer-replay-{count}.js').write_text(modified)
                    context = browser.new_context(viewport={'width': 1920, 'height': 1080},
                                                  device_scale_factor=2,
                                                  reduced_motion='reduce' if args.reduced_motion else 'no-preference')

                    def intercept(route):
                        interception['urls'].append(route.request.url)
                        route.fulfill(status=200, content_type='text/javascript', body=modified)

                    context.route('**/assets/observatory-renderer.js?*', intercept)
                    page = context.new_page()
                    page.on('pageerror', lambda e: report['errors'].append(str(e)))
                    page.on('console', lambda m: report['errors'].append(m.text) if m.type == 'error' else None)
                    page.goto(journey.configured_url(url, debug=1, lang='en', catalog=50000,
                                                    budget=args.quality), wait_until='domcontentloaded')
                    journey.wait_ready(page, report['errors'])
                    journey.settled(page)
                    if not interception['urls']:
                        raise RuntimeError('Worker interception failed; workload is unverified.')
                    for scene in args.scenes:
                        observe(page, scene)
                        page.wait_for_timeout(2200)
                        snapshot = journey.state(page)
                        journey.validate_state(snapshot)
                        assert snapshot['version'] == version, {'entryVersion': version, 'workerVersion': snapshot['version']}
                        assert not snapshot['adapter']['fallback'], snapshot['adapter']
                        if not snapshot['performance']['timestampQuery']:
                            raise journey.EnvironmentUnavailable('GPU timestamp evidence is unavailable.')
                        last = snapshot['performance']['completedThroughFrame']
                        gpu, cpu, latency, samples = [], [], [], []
                        start = time.monotonic()
                        while len(gpu) < args.samples and time.monotonic() - start < 120:
                            page.wait_for_timeout(200)
                            snapshot = journey.state(page)
                            timing = snapshot['performance']
                            if timing['cpuMsP95'] is not None:
                                cpu.append(timing['cpuMsP95'])
                            if timing['completedThroughFrame'] > last and timing['gpuMsLatest'] is not None:
                                gpu.append(timing['gpuMsLatest'])
                                latency.append(timing['completionLatencyMsLatest'])
                                samples.append(timing)
                                last = timing['completedThroughFrame']
                        assert len(gpu) == args.samples, (count, scene, len(gpu))
                        metrics = {'gpuMsP95': percentile95(gpu), 'gpuMsMedian': sorted(gpu)[len(gpu) // 2],
                                   'cpuMsP95UpperBound': max(cpu), 'completionLatencyMsP95': percentile95(latency),
                                   'gpuSamples': len(gpu)}
                        total = metrics['gpuMsP95'] + metrics['cpuMsP95UpperBound']
                        report['cases'].append({'repeat': count, 'scene': scene, 'state': snapshot,
                                                'timing': metrics, 'gpuPlusCpuMs': total,
                                                'gpuAndCpuWithin60HzBudget': total <= 1000 / 60,
                                                'samples': samples, 'interception': dict(interception)})
                        page.screenshot(path=str(args.output / f'{count}x-{scene}.png'))
                        save()
                        print(json.dumps({'repeat': count, 'scene': scene, 'timing': metrics,
                                          'gpuPlusCpuMs': total}), flush=True)
                    context.close()
            finally:
                browser.close()
        assert not report['errors'], report['errors']
        assert all(digest((ROOT / name).read_bytes()) == h for name, h in hashes.items()), 'Inputs changed during review.'
        baseline = {c['scene']: c for c in report['cases'] if c['repeat'] == 1}
        for case in report['cases']:
            if case['scene'] in baseline:
                case['observedGpuMedianSlowdown'] = (case['timing']['gpuMsMedian'] /
                                                    baseline[case['scene']]['timing']['gpuMsMedian'])
        report['status'] = 'reviewed'
        save()
    except BaseException as error:
        report['status'] = 'unavailable' if isinstance(error, journey.EnvironmentUnavailable) else 'failed'
        report['failure'] = str(error)
        save()
        raise


if __name__ == '__main__':
    main()
