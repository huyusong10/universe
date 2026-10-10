"""Opt-in continuous WebGPU review of the outer field, shared galaxy LOD and return."""
from pathlib import Path
import argparse, hashlib, json, math, time
from playwright.sync_api import sync_playwright
import lod_visual_smoke as j


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:9031/')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--continuation',action='store_true',help='Reuse unchanged outer/region evidence and review remaining shapes, quality and responsive returns.')
    parser.add_argument('--galaxy-field',action='store_true',help='Also review shared distant star fields and a continuous selected-prefix handoff.')
    args=parser.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=False)
    q={'status':'running','captures':[],'events':[],'errors':[],'timelineOrigin':time.monotonic(),
       'sourceHashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path('index.html'),*sorted(Path('assets').glob('*.js'))]}}
    def save():(out/'report.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n')
    with sync_playwright() as pw:
        browser=pw.chromium.launch(channel='chromium',headless=True,args=['--enable-unsafe-webgpu'])
        ctx=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',record_video_dir=str(out/'video'),record_video_size={'width':1440,'height':900})
        p=ctx.new_page();p.on('pageerror',lambda e:q['errors'].append(str(e)))
        p.on('console',lambda m:q['errors'].append(m.text) if m.type=='error' else None)
        def exact(name=None):
            p.wait_for_timeout(300)
            p.wait_for_function('name=>{const s=window.__universeObservatoryState;return s&&!s.flight&&!s.revisiting&&s.distance===s.distanceTarget&&(!name||s.observed===name&&s.active===name)}',arg=name,timeout=60000)
            assert not q['errors'],q['errors'];return j.state(p)
        def frame(name):j.capture(p,name,out,q);save()
        def media(reduced):
            p.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
            p.wait_for_function('v=>window.__universeObservatoryState.sceneMotion.reduced===v',arg=reduced)
        def slider(distance):
            s=j.state(p);value=round(1000*math.log(s['maxDistance']/distance)/math.log(s['maxDistance']/s['minDistance']))
            p.get_by_test_id('scale-slider').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))}',value)
        def continuous(label,action):
            action();samples=[];start=time.monotonic();n=0
            while time.monotonic()-start<65:
                p.wait_for_timeout(300);s=j.state(p)
                samples.append({k:s.get(k) for k in ['distance','distanceTarget','flight','flightPhase','cameraYaw','cameraPitch','activeId','observedId','fov','fps','frameMs']})
                if n in [0,3,8,16,28]:frame(label+'-'+str(n))
                n+=1
                if n>1 and not s['flight'] and s['distance']==s['distanceTarget']:break
            final=exact();q['events'].append({'action':label,'samples':samples});frame(label+'-settled');return final
        def visit(name):
            if not p.get_by_test_id('destinations').is_visible():p.get_by_test_id('open-destinations').click()
            p.get_by_test_id('scope-all').click();p.get_by_test_id('browse-featured').click();p.get_by_test_id('star-search').fill(name)
            p.get_by_test_id('destinations').locator('button[data-target='+json.dumps(name)+']:visible').click()
            return exact(name)
        def orbit(label):
            initial=j.state(p);p.mouse.move(900,400);p.mouse.down()
            for n in range(1,33):
                p.mouse.move(900+n*8,400+n*2);p.wait_for_timeout(55)
                if n in [8,16,24,32]:frame(label+'-'+str(n))
            p.mouse.up();s=exact()
            for key in ['activeId','observedId','fov','distance']:assert s[key]==initial[key],key
            q['events'].append({'action':label,'yawChange':s['cameraYaw']-initial['cameraYaw'],'targetAndLensHeld':True})
        try:
            p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='standard',lang='zh'));j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
            q['adapter']=j.state(p)['adapter'];assert not q['adapter']['fallback']
            if not args.continuation:
                p.get_by_test_id('hide-guide').click();frame('entry-14')
                for distance in [80,40,14,3,.5]:
                    slider(distance);exact();frame('distance-'+str(distance))
                media(False);base=j.state(p)
                continuous('retreat',lambda:p.get_by_test_id('space-overview').click())
                assert j.state(p)['distance']==j.state(p)['maxDistance']
                assert j.state(p)['observedId']==base['observedId']
                continuous('reenter',lambda:slider(.5));continuous('return-wide',lambda:p.get_by_test_id('space-overview').click())
                orbit('outer-orbit');media(True);p.get_by_test_id('restore-guide').click()
            q['wholeReviews']=[]
            for name in (['NGC 4650A'] if args.continuation else ['Andromeda Galaxy','Sombrero Galaxy','Centaurus A','Cigar Galaxy','Large Magellanic Cloud',"Hoag's Object",'Antennae Galaxies','NGC 4650A']):
                s=visit(name);assert s['scaleStage']=='Surface',name
                assert s['observedId']==s['activeId'];frame('whole-'+str(s['observedId']));q['wholeReviews'].append(name)
                if args.galaxy_field:
                    j.validate_state(s)
                    assert s['environmentDraw']['galaxyReferences']==s['budget']['galaxyReferences']
                    p.get_by_test_id('return-overview').click();far=exact(name)
                    assert far['scaleStage']=='Galactic';frame('field-map-'+str(s['observedId']))
                    if name=='Sombrero Galaxy':
                        media(False)
                        close=continuous('field-approach',lambda:slider(s['distance']))
                        assert close['observedId']==s['observedId'] and close['scaleStage']=='Surface'
                        orbit('field-whole-orbit');media(True)
                    else:
                        slider(s['distance']);exact(name)
                # Same named target and lens through one meaningful local region.
                if name in ['Andromeda Galaxy','Large Magellanic Cloud']:
                    key=s['galaxyInspection']['options'][0]['key'];media(False)
                    close=continuous('region-'+str(s['observedId']),lambda:p.get_by_test_id('galaxy-region-'+key).press('Enter'))
                    assert close['observedId']==s['observedId'] and close['galaxyInspection']['region']==key
                    orbit('region-orbit-'+str(s['observedId']));media(True)
                    p.get_by_test_id('galaxy-whole').press('Enter');exact(name)
                    p.get_by_test_id('return-overview').click();back=exact();assert back['scaleStage']=='Galactic' and back['observedId']==s['observedId'];frame('return-'+str(s['observedId']))
            # An external nursery retains its source identity inside its host's
            # surrounding volume; a local planet still has its old near journey.
            visit('Tarantula Nebula');frame('external-nursery');visit('Earth');frame('earth-near')
            visit('Sol');p.get_by_test_id('space-overview').click();exact();frame('wide-final')
            # Existing direct point selection/scope/mobile journey is separately
            # reusable; this run concentrates on the changed rendering boundary.
            for quality in ['safe','immersive','standard']:
                p.get_by_test_id('open-quality').click();p.get_by_test_id('quality-'+quality).check();p.wait_for_function('quality=>window.__universeObservatoryState.budget.key===quality',arg=quality);exact();p.get_by_test_id('close-quality').click();frame('wide-'+quality)
                if args.galaxy_field:j.validate_state(j.state(p))
            for lang,viewport in [('zh',{'width':390,'height':844}),('en',{'width':844,'height':390})]:
                p.set_viewport_size(viewport);p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='safe',lang=lang));j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
                p.get_by_test_id('space-overview').click();s=exact();assert s['distance']==s['maxDistance'];frame('outer-'+lang)
                visit('Sombrero Galaxy');s=exact();assert s['scaleStage']=='Surface';frame('galaxy-'+lang)
                p.get_by_test_id('return-overview').click();assert exact()['scaleStage']=='Galactic';frame('return-'+lang)
            assert all(hashlib.sha256(Path(n).read_bytes()).hexdigest()==h for n,h in q['sourceHashes'].items())
            assert not q['errors'];q['status']='passed'
        except BaseException as e:
            q['status']='failed';q['failure']=repr(e);q['failureState']=p.evaluate('window.__universeObservatoryState || null');p.screenshot(path=str(out/'failure.png'));save();raise
        finally:save();ctx.close();browser.close()
    print(json.dumps({'status':q['status'],'captures':len(q['captures']),'errors':q['errors']},ensure_ascii=False))
if __name__=='__main__':main()
