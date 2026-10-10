"""Opt-in real WebGPU journey for observation regions inside existing galaxies."""
from pathlib import Path
import argparse, hashlib, json, math, subprocess, time
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
import lod_visual_smoke as j

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:9031/')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--quality',choices=['safe','standard','immersive'],default='standard')
    parser.add_argument('--all-regions',action='store_true')
    parser.add_argument('--preview',action='store_true',help='Check camera-preserving pointer and keyboard region locators')
    parser.add_argument('--context',action='store_true')
    parser.add_argument('--context-only',action='store_true')
    parser.add_argument('--targets',nargs='+',default=['Andromeda Galaxy','Cigar Galaxy','Arp 142',"Hoag's Object",'NGC 4650A','Tadpole Galaxy'])
    args=parser.parse_args()
    if args.context_only: args.context=True
    out=args.output;out.mkdir(parents=True,exist_ok=False)
    q={'status':'running','cases':[],'captures':[],'events':[],'timelineOrigin':time.monotonic(),'errors':[],
       'sourceHashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path('index.html'),*sorted(Path('assets').glob('*.js'))]},'geometryRequests':[]}
    def save(): (out/'report.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chromium',headless=True,args=['--enable-unsafe-webgpu'])
        ctx=browser.new_context(viewport={'width':1280,'height':720},reduced_motion='reduce',record_video_dir=str(out/'video'),record_video_size={'width':1280,'height':720})
        p=ctx.new_page();p.on('pageerror',lambda e:q['errors'].append(str(e)))
        p.on('console',lambda m:q['errors'].append(m.text) if m.type=='error' else None)
        p.on('request',lambda req:q['geometryRequests'].append(req.url) if '/assets/geometry/' in req.url else None)
        def exact(name=None):
            assert not q['errors'],q['errors']
            j.settled(p)
            p.wait_for_function('name=>{const s=window.__universeObservatoryState;return !s.flight&&!s.revisiting&&s.distance===s.distanceTarget&&(!name||(s.observed===name&&s.active===name));}',arg=name)
            s=j.state(p)
            if name: assert s['observed']==s['active']==name
            return s
        def media(reduced):
            p.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
            p.wait_for_function('v=>window.__universeObservatoryState.sceneMotion.reduced===v',arg=reduced)
        def visit(name):
            if p.get_by_test_id('restore-guide').is_visible(): p.get_by_test_id('restore-guide').click()
            p.get_by_test_id('open-destinations').click();p.get_by_test_id('browse-galaxy').click();p.get_by_test_id('star-search').fill(name)
            p.get_by_test_id('destinations').locator('button[data-target='+json.dumps(name)+']:visible').click()
            return exact(name)
        def choose(key,name):
            p.get_by_test_id('galaxy-region-'+key).press('Enter')
            s=exact(name);assert s['galaxyInspection']['region']==key and s['galaxyInspection']['settled']
            return s
        def held(a,b):
            for key in ['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov']: assert a[key]==b[key],key
        try:
            p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget=args.quality,lang='zh'),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
            if args.all_regions:
                names=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{createCatalog}from'./assets/observatory-model.js';console.log(JSON.stringify(createCatalog({budget:'safe'}).galaxies.map(b=>b.name)))"]))
                q['allRegionReachability']=[]
                for i,name in enumerate(names):
                    whole=visit(name);keys=[x['key'] for x in whole['galaxyInspection']['options']];assert 2<=len(keys)<=4
                    reached=[]
                    for n,key in enumerate(keys):
                        assert p.get_by_test_id('galaxy-region-'+key).inner_text().strip()
                        s=choose(key,name);held(whole,s);reached.append(key)
                        if n==0: j.capture(p,f'catalogue-{i:02d}-{name}',out,q)
                    p.get_by_test_id('galaxy-whole').press('Enter');back=exact(name);assert back['galaxyInspection']['region'] is None;held(whole,back)
                    q['allRegionReachability'].append({'target':name,'reached':reached,'wholeRestored':True});save()
                assert len(q['allRegionReachability'])==26
            for name in ([] if args.context_only else args.targets):
                media(True);whole=visit(name)
                c={'target':name,'captures':[],'events':[],'timelineOrigin':time.monotonic()};q['cases'].append(c)
                j.capture(p,name+'-whole',out,c)
                if args.preview:
                    p.wait_for_timeout(1600);before=exact(name);keys=[item['key'] for item in before['galaxyInspection']['options']]
                    def preview(key):
                        p.wait_for_function('key=>{const v=window.__universeObservatoryState.galaxyInspection.preview;return key?v?.key===key&&v.visible:!v;}',arg=key)
                        current=exact(name);held(before,current);assert current['distance']==before['distance']
                        assert current['observedPosition']==before['observedPosition']
                        return current['galaxyInspection']['preview']
                    first=p.get_by_test_id('galaxy-region-'+keys[0]);first.focus();a=preview(keys[0]);j.capture(p,name+'-keyboard-locator',out,c)
                    last=p.get_by_test_id('galaxy-region-'+keys[-1]);last.hover();b=preview(keys[-1]);assert a['position']!=b['position'];j.capture(p,name+'-pointer-locator',out,c)
                    p.mouse.move(15,15);preview(keys[0]);p.get_by_test_id('star-map').focus();preview(None)
                    first.focus();preview(keys[0]);p.get_by_test_id('map-details').click();preview(None)
                    p.get_by_test_id('guide-observe').click();first.focus();preview(keys[0]);p.get_by_test_id('hide-guide').click();preview(None)
                    p.get_by_test_id('restore-guide').click();preview(None)
                    c['preview']={'keyboard':a,'pointer':b,'cameraHeld':True,'clearedOnBlurReadHide':True}
                media(False)
                for option in whole['galaxyInspection']['options']:
                    key=option['key'];start=j.state(p);p.get_by_test_id('galaxy-region-'+key).press('Enter')
                    path=[];deadline=time.monotonic()+30
                    p.wait_for_timeout(100)
                    while time.monotonic()<deadline:
                        assert not q['errors'],q['errors']
                        sample=j.state(p);path.append({'distance':sample['distance'],'flight':sample['flight'],'phase':sample['flightPhase']})
                        if sample['galaxyInspection']['region']==key and not sample['flight'] and sample['distance']==sample['distanceTarget']: break
                        p.wait_for_timeout(160)
                    end=exact(name);held(start,end)
                    assert end['galaxyInspection']['preview'] is None
                    assert any(x['flight'] for x in path) and any(x['distance']!=start['distance'] and x['distance']!=end['distance'] for x in path)
                    c.setdefault('transitions',[]).append({'region':key,'path':path})
                    j.capture(p,name+'-region-'+key,out,c)
                p.get_by_test_id('hide-guide').click()
                p.wait_for_function('()=>{const a=window.__universeObservatoryState.observationArea;return a.x===0&&a.y===0&&a.width===innerWidth&&a.height===innerHeight;}')
                # The galaxy centre moves around a rotating region anchor. Its
                # projected coordinates are not a settling invariant here.
                p.wait_for_timeout(700)
                p.wait_for_function("!document.querySelector('[data-testid=galaxy-whole-control]').hidden")
                p.get_by_test_id('star-map').press('ArrowRight');p.get_by_test_id('star-map').press('Escape');orbit=exact(name)
                assert orbit['cameraYaw']!=end['cameraYaw'] and orbit['galaxyInspection']['region']==end['galaxyInspection']['region']
                j.capture(p,name+'-region-orbit',out,c)
                p.get_by_test_id('galaxy-whole-control').press('Enter');back=exact(name)
                assert back['galaxyInspection']['region'] is None and back['distance']>end['distance'];held(orbit,back)
                j.capture(p,name+'-whole-restored',out,c)
                p.get_by_test_id('return-overview').press('Enter');assert exact(name)['scaleStage']=='Galactic'
                c.update(status='captured',manualOrbit=True,wholeRestored=True,returnToMap=True);save();print(name,'continuous regions, orbit, whole and map captured',flush=True)
            if args.context:
                q['context']={};context=q['context'];media(True);visit("Hoag's Object");media(False)
                p.get_by_test_id('galaxy-region-ring').press('Enter');p.wait_for_function('()=>window.__universeObservatoryState.flight');p.wait_for_timeout(550)
                p.get_by_test_id('star-map').press('Escape');stopped=exact();assert stopped['navigationState']=='paused'
                j.capture(p,'region-stopped',out,q);p.get_by_test_id('resume-flight').press('Enter');s=exact();assert s['galaxyInspection']['settled'];context['stopAndResume']=True
                start=j.capture(p,'region-flow-start',out,q);p.wait_for_timeout(3200);end=j.capture(p,'region-flow-end',out,q);held(start,end)
                assert end['animationTime']>start['animationTime']+3 and start['galaxyInspection']['position']!=end['galaxyInspection']['position'];context['sharedClockAndHeldLens']=True
                p.get_by_test_id('open-dynamics').click();p.get_by_test_id('motion-paused').check();p.keyboard.press('Escape');paused=exact();p.wait_for_timeout(350)
                assert j.state(p)['animationTime']==paused['animationTime'];context['pauseStopsClock']=True
                for quality in ['safe','standard','immersive']:
                    p.get_by_test_id('open-quality').click();p.get_by_test_id('quality-'+quality).check()
                    p.wait_for_function('key=>window.__universeObservatoryState.quality.key===key',arg=quality)
                    p.wait_for_function("!document.querySelector('[data-testid=quality-options]').disabled");p.keyboard.press('Escape');current=exact()
                    held(paused,current);assert current['galaxyInspection']==paused['galaxyInspection'];assert current['distance']==paused['distance'];j.capture(p,'region-quality-'+quality,out,q)
                context['qualityPosePreserved']=True
                media(True);before=exact()
                for _ in range(6): p.get_by_test_id('star-map').press('-')
                retreated=exact();held(before,retreated)
                assert retreated['distance']>before['distance']*8 and retreated['galaxyInspection']['region']==before['galaxyInspection']['region']
                assert retreated['galaxyInspection']['position']==before['galaxyInspection']['position'];context['zoomKeepsRegion']=True
                for _ in range(6): p.get_by_test_id('star-map').press('=')
                restored=exact();assert math.isclose(restored['distance'],before['distance'],rel_tol=1e-10)
                saved=exact();p.get_by_test_id('next-observation').press('Enter')
                p.wait_for_function('id=>window.__universeObservatoryState.activeId!==id',arg=saved['activeId'])
                compared=exact();assert compared['observed']!=saved['observed']
                p.get_by_test_id('open-destinations').click();p.get_by_test_id('browse-featured').click();p.get_by_test_id('revisit-'+str(saved['observedId'])).press('Enter');recalled=exact(saved['observed'])
                held(saved,recalled);assert recalled['distance']==saved['distance'] and recalled['galaxyInspection']['region']==saved['galaxyInspection']['region'];context['regionRevisit']=True;j.capture(p,'region-revisited',out,q)
                for lang,name,key in [('en',"Hoag's Object",'ring'),('zh','NGC 4650A','polar-ring')]:
                    p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget=args.quality,lang=lang),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}');visit(name);choose(key,name)
                    p.set_viewport_size({'width':390,'height':844});exact();p.get_by_test_id('galaxy-region-'+key).focus();j.capture(p,'region-narrow-'+lang,out,q)
                    j.save_observation(p,'region-'+lang,out,q,Image,ImageStat,pause_ms=180)
                    assert p.get_by_test_id('observation-image').get_attribute('data-galaxy-region')==key
                    assert p.get_by_test_id('observation-image').get_attribute('src') is None
                    p.set_viewport_size({'width':1280,'height':720});exact()
                context['bilingualRegionExports']=True
            assert not q['errors'];assert all(hashlib.sha256(Path(n).read_bytes()).hexdigest()==h for n,h in q['sourceHashes'].items())
            q['status']='captured'
        except BaseException as e:
            q.update(status='failed',failure=f'{type(e).__name__}: {e}',failureState=p.evaluate('window.__universeObservatoryState || null'))
            p.screenshot(path=str(out/'failure.png'));raise
        finally:p.close();ctx.close();q['video']=str(p.video.path());save();browser.close()

if __name__=='__main__': main()
