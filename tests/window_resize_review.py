#!/usr/bin/env python3
"""Opt-in review of proportional frames through window changes.

Collect early and settled screenshots from one continuous recording per quality.
Pose, identity, clock, continued controls, scrollable reading and export are machine evidence. Shape
and transition quality require inspection; canvas dimensions are diagnostic only.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time
import lod_visual_smoke as journey

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ['Sol', 'Betelgeuse', 'Earth', 'Saturn', 'Pluto', 'Vesta', 'Moon',
           "Halley's Comet", 'Crab Pulsar', 'Sagittarius A*', 'Orion Nebula', 'Andromeda Galaxy', 'Vela Pulsar', 'M87*', 'Sirius B']
POSE = ('activeId', 'observedId', 'distance', 'cameraYaw', 'cameraPitch', 'cameraRoll', 'animationTime')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:9021/')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--targets', nargs='+', choices=TARGETS, default=TARGETS)
    parser.add_argument('--quality', choices=['safe','immersive'], help='Collect only one quality when supplementing unchanged evidence.')
    args = parser.parse_args()
    from PIL import Image, ImageStat
    from playwright.sync_api import sync_playwright
    args.output.mkdir(parents=True, exist_ok=False)
    inputs = [ROOT/'index.html', *sorted((ROOT/'assets').glob('*.js'))]
    report = {'status': 'running', 'scope': __doc__, 'qualities': [], 'errors': [],
              'sourceHashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}}

    def save():
        (args.output/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')

    def exact(page):
        journey.settled(page)
        page.wait_for_function('''() => {const s=window.__universeObservatoryState;
          return s && !s.flight && s.activeId===s.observedId && s.distance===s.distanceTarget;}''', timeout=30000)
        return journey.state(page)

    def fitted(page):
        exact(page)
        previous=journey.state(page)
        for _ in range(20):
            page.wait_for_timeout(200)
            current=journey.state(page)
            if all(current[k]==previous[k] for k in ('fov','observedX','observedY')):
                return current
            previous=current
        raise AssertionError('Reading projection did not settle')

    save()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(channel='chromium', headless=True, args=['--enable-unsafe-webgpu'])
            try:
                for q, lang in [('safe', 'en'), ('immersive', 'zh')]:
                    if args.quality and q!=args.quality:continue
                    context = browser.new_context(viewport={'width':1280,'height':720}, reduced_motion='no-preference',
                       record_video_dir=str(args.output/q/'video'), record_video_size={'width':1280,'height':720})
                    page = context.new_page()
                    page.on('pageerror', lambda e: report['errors'].append(str(e)))
                    page.on('console', lambda m: report['errors'].append(m.text) if m.type=='error' else None)
                    group={'quality':q,'language':lang,'cases':[],'video':str(page.video.path())}
                    report['qualities'].append(group)
                    try:
                        page.goto(journey.configured_url(args.url,debug=1,lang=lang,budget=q,catalog=50000,target='Sol'),wait_until='networkidle')
                        journey.wait_ready(page,report['errors'])
                        page.get_by_test_id('open-dynamics').click();page.get_by_test_id('motion-paused').check();page.keyboard.press('Escape')
                        report.setdefault('sourceVersion',journey.state(page)['version'])
                        for name in args.targets:
                            page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':1280,'height':720})
                            if page.get_by_test_id('restore-guide').is_visible():page.get_by_test_id('restore-guide').click()
                            page.get_by_test_id('open-destinations').click();page.get_by_test_id('star-search').fill(name)
                            page.get_by_test_id('destinations').locator('button[data-target="'+name+'"]:visible').press('Enter')
                            exact(page);page.get_by_test_id('hide-guide').click();page.get_by_test_id('scale-slider').press('End')
                            nearest=exact(page)
                            assert abs(nearest['distance']/nearest['minDistance']-1)<1e-9, {'target':name,'nearRatio':nearest['distance']/nearest['minDistance']}
                            journey.full_observation(page)
                            page.emulate_media(reduced_motion='no-preference');held=exact(page)
                            assert held['version']==report['sourceVersion']
                            case={'target':name,'kind':held['observedKind'],'status':'running','captures':[], 'events':[], 'timelineOrigin':time.monotonic()}
                            group['cases'].append(case)
                            slug=name.lower().replace(' ','-').replace("'",'').replace('*','')
                            for size,tag in [({'width':390,'height':844},'narrow'),({'width':1280,'height':720},'wide')]:
                                start=time.monotonic();page.set_viewport_size(size)
                                for suffix,delay in [('early',0),('settled',500)]:
                                    if delay:page.wait_for_timeout(delay);journey.full_observation(page)
                                    snap=journey.capture(page,q+'-'+slug+'-'+tag+'-'+suffix,args.output,case)
                                    case['captures'][-1]['afterResizeMs']=round((time.monotonic()-start)*1000)
                                    case['captures'][-1]['canvases']=page.locator('canvas').evaluate_all('''es=>es.map(e=>({id:e.id,width:e.width,height:e.height,css:[e.clientWidth,e.clientHeight]}))''')
                                    if suffix=='settled':
                                        for k in POSE:assert snap[k]==held[k], {'target':name,'field':k,'before':held[k],'after':snap[k]}
                                        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                            current=exact(page)
                            if current['observedKind'] not in ('nebula','galaxy'):
                                page.mouse.move(current['observedX'],current['observedY'])
                                page.wait_for_function('id=>window.__universeObservatoryState?.hoveredId===id',arg=current['observedId'])
                            page.get_by_test_id('star-map').press('ArrowRight');page.get_by_test_id('star-map').press('Escape');orbited=exact(page)
                            assert orbited['activeId']==held['activeId'] and orbited['distance']==held['distance']
                            assert orbited['cameraYaw']!=held['cameraYaw']
                            assert orbited['animationTime']==held['animationTime']
                            page.set_viewport_size({'width':390,'height':844})
                            page.get_by_test_id('restore-guide').click();reading=fitted(page)
                            journey.capture(page,q+'-'+slug+'-reading',args.output,case)
                            for k in POSE:assert reading[k]==orbited[k], {'target':name,'field':k}
                            area=reading['observationArea'];card=page.get_by_test_id('target-guide').bounding_box()
                            assert area['x']<=reading['observedX']<=area['x']+area['width']
                            assert area['y']<=reading['observedY']<=area['y']+area['height']
                            assert reading['observedY']<card['y']
                            page.get_by_test_id('body-reading').press('End');scrolled=exact(page)
                            for k in (*POSE,'observationArea','fov'):assert scrolled[k]==reading[k], {'target':name,'scrollChanged':k}
                            title=page.get_by_test_id('target-guide').get_by_role('heading', level=1).bounding_box()
                            assert card['y']<=title['y'] and title['y']+title['height']<=card['y']+card['height']
                            journey.guide_section(page, 'read')
                            source=page.get_by_test_id('target-source');source.focus();after_source=exact(page)
                            box=source.bounding_box();card=page.get_by_test_id('target-guide').bounding_box()
                            case['sourceBounds']={'source':box,'guide':card};save()
                            assert card['y']<=box['y'] and box['y']+box['height']<=card['y']+card['height']+1
                            for k in (*POSE,'observationArea','fov'):assert after_source[k]==reading[k], {'target':name,'sourceChanged':k}
                            journey.capture(page,q+'-'+slug+'-sources',args.output,case)
                            if name in ('M87*','Vela Pulsar','Saturn','Earth'):
                                journey.save_observation(page,q+'-'+slug+'-window',args.output,case,Image,ImageStat,pause_ms=200)
                            if name in ('M87*','Vela Pulsar','Saturn'):
                                source.focus();exact(page)
                                for size,tag in [({'width':320,'height':568},'small-reading'),({'width':844,'height':390},'landscape-reading')]:
                                    page.set_viewport_size(size);small=exact(page)
                                    for k in POSE:assert small[k]==reading[k], {'target':name,'resizeChanged':k}
                                    exact(page);box=source.bounding_box();card=page.get_by_test_id('target-guide').bounding_box()
                                    case.setdefault('focusedSourceResize',[]).append({'viewport':size,'source':box,'guide':card});save()
                                    assert source.evaluate('e=>document.activeElement===e')
                                    assert card['y']<=box['y'] and box['y']+box['height']<=card['y']+card['height']+1
                                    journey.capture(page,q+'-'+slug+'-'+tag,args.output,case)
                            page.get_by_test_id('hide-guide').press('Enter');journey.full_observation(page)
                            case.update(readingPoseHeld=True,scrollPoseHeld=True,titleRemainsVisible=True,sourceKeyboardReachable=True)
                            case.update(status='passed',poseHeld=True,continuedOrbit=True,solidCentrePicking=current['observedKind'] not in ('nebula','galaxy'))
                            print(q,name,'window path passed',flush=True);save()
                        page.emulate_media(reduced_motion='reduce');page.get_by_test_id('return-overview').press('Enter');exact(page)
                        assert page.get_by_test_id('return-overview').is_disabled()
                        group['globalReturn']=True
                    finally:context.close()
            finally:browser.close()
        assert not report['errors'], report['errors']
        assert all(hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==h for rel,h in report['sourceHashes'].items())
        report['status']='behaviour-passed-awaiting-visual-review'
    except Exception as error:
        report.update(status='failed',failure=str(error));raise
    finally:save()


if __name__=='__main__':main()
