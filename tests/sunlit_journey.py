#!/usr/bin/env python3
"""Opt-in combined observation-angle journey; behaviour plus continuous review evidence.

The automated paths exercise one shared capability across all reflective forms.
Images and continuous recordings require visual review; no image threshold claims
naturalness, physical illumination or presentation FPS.
"""
import argparse,hashlib,json,math,time
from pathlib import Path
import lod_visual_smoke as j
ROOT=Path(__file__).resolve().parents[1]
TARGETS=['Mercury','Venus','Saturn','Moon','Ceres','Vesta']
PARTIAL=['Pluto','Charon','Ceres','Vesta','Miranda','Ariel','Umbriel','Titania','Oberon']

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--url',default='http://127.0.0.1:9021/')
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--qualities',nargs='+',choices=['safe','immersive'],default=['safe','immersive']);parser.add_argument('--targets',nargs='+',choices=list(dict.fromkeys(TARGETS+PARTIAL)));parser.add_argument('--mapped-terrain',action='store_true',help='Batch all partial maps plus representative existing sunlit worlds');args=parser.parse_args()
    args.targets=args.targets or (['Mercury','Saturn']+PARTIAL if args.mapped_terrain else TARGETS)
    from PIL import Image,ImageStat
    from playwright.sync_api import sync_playwright
    args.output.mkdir(parents=True,exist_ok=False)
    inputs=[ROOT/'index.html',*sorted((ROOT/'assets').glob('*.js'))]
    report={'status':'running','qualities':[],'errors':[],'sourceHashes':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in inputs}}
    def save():(args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    def exact(page):
        j.settled(page)
        page.wait_for_function('''()=>{const s=window.__universeObservatoryState;return s&&!s.flight&&s.distance===s.distanceTarget;}''')
        return j.state(page)
    def held(before,after):
        for k in ('activeId','observedId','distance','fov','animationTime','cameraRoll'):
            assert after[k]==before[k],{'field':k,'before':before[k],'after':after[k]}
    save()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(channel='chromium',headless=True,args=['--enable-unsafe-webgpu'])
            try:
                for quality in args.qualities:
                    lang='en' if quality=='safe' else 'zh'
                    context=browser.new_context(viewport={'width':1280,'height':720},reduced_motion='no-preference',record_video_dir=str(args.output/quality/'video'),record_video_size={'width':1280,'height':720})
                    page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
                    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
                    group={'quality':quality,'language':lang,'cases':[],'video':str(page.video.path())};report['qualities'].append(group)
                    try:
                        page.goto(j.configured_url(args.url,debug=1,lang=lang,budget=quality,catalog=50000,target='Sol'),wait_until='networkidle');j.wait_ready(page,report['errors'])
                        report.setdefault('sourceVersion',j.state(page)['version']);assert not page.get_by_test_id('observe-sunlit').is_visible()
                        page.get_by_test_id('open-dynamics').click();page.get_by_test_id('motion-paused').check();page.keyboard.press('Escape')
                        for name in args.targets:
                            page.emulate_media(reduced_motion='reduce');page.set_viewport_size({'width':1280,'height':720})
                            if page.get_by_test_id('restore-guide').is_visible():page.get_by_test_id('restore-guide').click()
                            page.get_by_test_id('open-destinations').click();page.get_by_test_id('star-search').fill(name)
                            page.get_by_test_id('destinations').locator('button[data-target="'+name+'"]:visible').press('Enter');exact(page)
                            page.get_by_test_id('hide-guide').click();page.get_by_test_id('scale-slider').press('End');exact(page);j.full_observation(page)
                            case={'target':name,'status':'running','captures':[],'events':[],'timelineOrigin':time.monotonic()};group['cases'].append(case)
                            slug=quality+'-'+name.lower();scene=page.get_by_test_id('star-map')
                            terrain=args.mapped_terrain and name in PARTIAL
                            action='terrain' if terrain else 'sunlit';turn=action+'Turn';available=action+'Available'
                            case['action']=action
                            assert page.get_by_test_id('observe-terrain').is_visible()==(name in PARTIAL)
                            if terrain:
                                page.get_by_test_id('restore-guide').click();assert j.guide_control(page, 'guide-observe-terrain').is_visible();page.get_by_test_id('hide-guide').click()
                            # Public keyboard exploration reaches another hemisphere without replacing the focal body.
                            for _ in range(37):scene.press('ArrowRight')
                            dark=exact(page);j.capture(page,slug+'-turned-away',args.output,case)
                            page.emulate_media(reduced_motion='no-preference');before=exact(page)
                            page.get_by_test_id('observe-'+action).press('Enter')
                            page.wait_for_function('(turn)=>window.__universeObservatoryState?.[turn]===true',arg=turn)
                            for i in range(3):
                                page.wait_for_timeout(180);s=j.capture(page,slug+'-turn-'+str(i),args.output,case);held(before,s)
                            lit=exact(page);held(before,lit);assert lit['cameraYaw']!=before['cameraYaw'];assert not lit[turn]
                            j.capture(page,slug+'-lit',args.output,case)
                            page.wait_for_timeout(450);idle=j.state(page)
                            for k in ('distance','cameraYaw','cameraPitch','cameraRoll','animationTime'):assert idle[k]==lit[k]
                            scene.press('ArrowRight');manual=exact(page);held(lit,manual);assert manual['cameraYaw']!=lit['cameraYaw']
                            if name=='Ceres':
                                for _ in range(25):scene.press('ArrowRight')
                                before=exact(page);page.get_by_test_id('observe-'+action).press('Enter')
                                page.wait_for_function('(turn)=>window.__universeObservatoryState?.[turn]===true',arg=turn);page.get_by_test_id('stop-flight').press('Enter')
                                stopped=exact(page);held(before,stopped);assert stopped['navigationState']=='paused';j.capture(page,slug+'-stopped',args.output,case)
                                # A stopped centred turn can be retried; keyboard orbit can take it over.
                                page.get_by_test_id('observe-'+action).press('Enter');page.wait_for_function('(turn)=>window.__universeObservatoryState?.[turn]===true',arg=turn)
                                scene.press('ArrowRight');taken=exact(page);assert not taken[turn];held(stopped,taken)
                                scene.press('+');exact(page)
                                page.get_by_test_id('observe-'+action).press('Enter');page.wait_for_function('(turn)=>window.__universeObservatoryState?.[turn]===true',arg=turn)
                                page.emulate_media(reduced_motion='reduce');reduced=exact(page);assert not reduced[turn];assert reduced['sceneMotion']['reduced']
                                j.capture(page,slug+'-reduce',args.output,case)
                            page.emulate_media(reduced_motion='reduce');before=exact(page);page.get_by_test_id('observe-'+action).press('Enter');direct=exact(page);held(before,direct)
                            assert not direct['flight'] and not direct[turn];assert direct[available]
                            if name in ['Vesta','Ariel']:
                                page.set_viewport_size({'width':390,'height':844});page.get_by_test_id('restore-guide').click();exact(page)
                                button=page.get_by_test_id('observe-'+action);button.press('Enter');exact(page)
                                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');j.capture(page,slug+'-narrow',args.output,case)
                                j.save_observation(page,slug+'-observation',args.output,case,Image,ImageStat,pause_ms=200)
                            case.update(status='passed',heldView=True,manualControl=True,reducedMotion=True);print(quality,name,action+' journey passed',flush=True);save()
                        page.get_by_test_id('open-destinations').click();page.get_by_test_id('navigation-system').click();page.get_by_test_id('system-overview').click();group['returnInitialState']=j.state(page);save()
                        page.wait_for_function("()=>window.__universeObservatoryState?.systemView?.scope==='family'")
                        family=exact(page)
                        assert family['systemView']['scope']=='family' and not page.get_by_test_id('observe-sunlit').is_visible() and not page.get_by_test_id('observe-terrain').is_visible()
                        page.get_by_test_id('return-overview').press('Enter');returned=exact(page);assert returned['scaleStage']=='Galactic'
                        group['solarAndGlobalReturn']=True
                    finally:context.close()
            finally:browser.close()
        assert not report['errors'],report['errors']
        assert all(hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h for f,h in report['sourceHashes'].items())
        report['status']='behaviour-passed-awaiting-visual-review'
    except Exception as e:report.update(status='failed',failure=str(e));raise
    finally:save()
if __name__=='__main__':main()
