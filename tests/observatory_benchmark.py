#!/usr/bin/env python3
"""Repeatable, opt-in model benchmark; no product or OS throttling."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

import gpu_workload_review as probe

ROOT = Path(__file__).resolve().parents[1]
MODEL_SCENES = ('opening', 'sun-core', 'earth-core', 'moon-core', 'saturn-rings',
                'jupiter-clouds', 'mercury-core', 'venus-clouds', 'uranus-rings', 'neptune-clouds', 'mars-core', 'comet-tails', 'comet-core', 'pulsar-beams',
                'pulsar-core', 'blackhole-disk', 'blackhole-edge', 'blackhole-face',
                'nebula-deep', 'galaxy-disc', 'galaxy-deep',
                'io-core', 'europa-core', 'enceladus-core', 'titan-haze', 'ganymede-core', 'callisto-core', 'pluto-core', 'charon-core')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='Existing preview; otherwise use isolated local servers')
    parser.add_argument('--output', type=Path, help='New report directory; never overwrite a run')
    parser.add_argument('--scenes', choices=list(probe.SCENES), nargs='+', default=MODEL_SCENES)
    parser.add_argument('--samples', type=int, default=45)
    parser.add_argument('--proxy-ratio', type=float, default=10.6,
                        help='Measured GPU slowdown target, not a pass count or hardware claim')
    parser.add_argument('--max-attempts', type=int, default=5)
    args = parser.parse_args()
    if not 15 <= args.samples <= 90 or not 1 < args.proxy_ratio <= 100 or not 1 <= args.max_attempts <= 8:
        parser.error('Use 15..90 samples, proxy ratio >1..100 and 1..8 calibration attempts.')
    out = args.output or ROOT / 'artifacts/performance' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    out.mkdir(parents=True, exist_ok=False)
    report = {'status': 'running', 'scenes': list(args.scenes), 'samplesPerCase': args.samples,
              'budgetMs': 1000 / 60, 'proxyRatio': args.proxy_ratio, 'sourceVersion': None,
              'sourceHashes': None, 'highestQuality': [], 'weakGpuProxy': [], 'runs': [],
              'collectorHashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in (Path(__file__), ROOT / 'tests/gpu_workload_review.py')},
              'limits': ['Normal-flow scripted visits measure actual GPU timestamps plus conservative Worker CPU cost.',
                         'Every proxy attempt uses its own scene and 1x baseline; replay count is not slowdown.',
                         'All unsuccessful and over-budget attempts remain in the report.',
                         'Finite calibration can fail; a result is not silently rounded into the target.',
                         'This does not emulate Intel driver, bandwidth or CPU, or certify OS presented FPS.']}

    def save():
        (out / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')

    def run(name, quality, scenes, counts):
        command = [sys.executable, str(ROOT / 'tests/gpu_workload_review.py'), '--output', str(out / name),
                   '--quality', quality, '--samples', str(args.samples), '--scenes', *scenes,
                   '--repeats', *map(str, counts)]
        if args.url:
            command.extend(['--url', args.url])
        print(f'{name}: {quality}, {", ".join(scenes)}, work {counts}', flush=True)
        with (out / (name + '.log')).open('w') as log:
            result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
        path = out / name / 'report.json'
        data = json.loads(path.read_text()) if path.is_file() else {'status': 'failed'}
        report['runs'].append({'report': name + '/report.json', 'log': name + '.log',
                               'exitCode': result.returncode, 'status': data['status']})
        if result.returncode or data['status'] != 'reviewed':
            report['status'] = 'unavailable' if data['status'] == 'unavailable' else 'failed'
            save()
            raise RuntimeError('GPU collection did not complete; see ' + str(out / (name + '.log')))
        if report['sourceHashes'] is None:
            report['sourceHashes'], report['sourceVersion'] = data['sourceHashes'], data['sourceVersion']
        elif (report['sourceHashes'] != data['sourceHashes'] or report['sourceVersion'] != data['sourceVersion']):
            raise RuntimeError('Source changed between benchmark scenes; the run cannot be compared.')
        save()
        return data

    save()
    try:
        high = run('highest', 'immersive', args.scenes, [1])
        for case in high['cases']:
            report['highestQuality'].append({'scene': case['scene'], 'gpuPlusCpuMs': case['gpuPlusCpuMs'],
                                             'within60HzBudget': case['gpuAndCpuWithin60HzBudget']})
        save()
        for scene in args.scenes:
            row = {'scene': scene, 'status': 'calibrating', 'attempts': [], 'selected': None}
            report['weakGpuProxy'].append(row)
            count = min(256, math.ceil(args.proxy_ratio * 5))
            tried = set()
            for attempt in range(args.max_attempts):
                data = run(f'proxy-{scene}-{attempt + 1}', 'safe', [scene], [1, count])
                case = next(c for c in data['cases'] if c['repeat'] == count)
                ratio = case['observedGpuMedianSlowdown']
                trial = {'report': report['runs'][-1]['report'], 'workCount': count,
                         'measuredGpuSlowdown': ratio, 'gpuPlusCpuMs': case['gpuPlusCpuMs'],
                         'targetReached': ratio >= args.proxy_ratio,
                         'within60HzBudget': case['gpuAndCpuWithin60HzBudget']}
                row['attempts'].append(trial)
                tried.add(count)
                if trial['targetReached'] and trial['within60HzBudget']:
                    row.update(status='passed', selected=trial)
                    save()
                    break
                # Scale from measured work, with a small margin. When costs are
                # too high, seek the target instead of declaring heavier work valid.
                margin = 1.04 if not trial['targetReached'] else 1.01
                candidate = max(2, min(256, math.ceil(count * args.proxy_ratio / max(ratio, .001) * margin)))
                if candidate in tried:
                    step = 1 if not trial['targetReached'] else -1
                    while 2 <= candidate <= 256 and candidate in tried:
                        candidate += step
                if not 2 <= candidate <= 256:
                    break
                count = candidate
                save()
            if row['selected'] is None:
                row['status'] = 'not-qualified'
            save()
        passed = (all(c['within60HzBudget'] for c in report['highestQuality']) and
                  all(c['status'] == 'passed' for c in report['weakGpuProxy']))
        report['status'] = 'passed' if passed else 'budget-not-met'
        save()
        print(f'Benchmark {report["status"]}: {out / "report.json"}', flush=True)
        return 0 if passed else 2
    except BaseException as error:
        if report['status'] == 'running':
            report['status'] = 'failed'
        report['failure'] = str(error)
        save()
        raise


if __name__ == '__main__':
    sys.exit(main())
