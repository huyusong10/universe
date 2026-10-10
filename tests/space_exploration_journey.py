"""Opt-in actual WebGPU review of space-scoped discovery and the observing shell."""
from pathlib import Path
import argparse, json, time, hashlib, subprocess
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat
import lod_visual_smoke as j


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:9031/')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--map-only',action='store_true',help='Focused map symbol selection and layout review; reuse unchanged near-view evidence.')
    parser.add_argument('--coherence',action='store_true',help='Also review the shared space from the map through bodies, galaxy regions and quality changes.')
    parser.add_argument('--responsive-only',action='store_true',help='Run only map and source reading at narrow sizes; reuse an already reviewed space journey.')
    parser.add_argument('--desktop-only',action='store_true',help='Complete the main journey without reloading for unchanged localized UI checks.')
    parser.add_argument('--guide',action='store_true',help='Review observing sections, scoped relationship search, keyboard travel and responsive source reading.')
    parser.add_argument('--sources',action='store_true',help='Review unresolved bodies, visible-source picking, cloud approach and family navigation together.')
    args=parser.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=False)
    if args.responsive_only and not (args.map_only and args.coherence):parser.error('--responsive-only requires --map-only --coherence')
    if args.desktop_only and (not args.map_only or args.responsive_only):parser.error('--desktop-only requires --map-only and excludes --responsive-only')
    q={'status':'running','captures':[],'events':[],'errors':[],'timelineOrigin':time.monotonic(),
       'sourceHashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path('index.html'),*sorted(Path('assets').glob('*.js'))]}}
    def save(): (out/'report.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n')
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
        poseKeys=['activeId','observedId','distance','distanceTarget','cameraYaw','cameraPitch','cameraRoll','fov']
        def reachable(control,rounded=False):
            if rounded:
                assert control.evaluate('e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return r.width>0&&r.height>0&&[[x,y],[r.left+3,y],[r.right-3,y],[x,r.top+3],[x,r.bottom-3]].every(([x,y])=>e.contains(document.elementFromPoint(x,y)));}')
                return
            assert control.evaluate('''e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&[[r.left+2,r.top+2],[r.right-2,r.top+2],[r.left+2,r.bottom-2],[r.right-2,r.bottom-2]].every(([x,y])=>e.contains(document.elementFromPoint(x,y)));}'''),'The full control must remain reachable without scrolling the collapsed map card'
        def media(reduced):
            p.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
            p.wait_for_function('v=>window.__universeObservatoryState.sceneMotion.reduced===v',arg=reduced)
        def browse(region='all',kind='featured',query=''):
            if not p.get_by_test_id('destinations').is_visible():p.get_by_test_id('open-destinations').click()
            p.get_by_test_id('scope-'+region).click();p.get_by_test_id('browse-'+kind).click();p.get_by_test_id('star-search').fill(query)
        def visit(name,region='all',kind='featured'):
            browse(region,kind,name)
            p.get_by_test_id('destinations').locator('button[data-target='+json.dumps(name)+']:visible').click()
            return exact(name)
        def projected_bodies():
            return p.evaluate('''async()=>{
              const s=window.__universeObservatoryState, suffix='?v='+s.version;
              const [{createCatalog},cam,motion,{pointSourceCoverage}]=await Promise.all([
                import('./assets/observatory-model.js'+suffix),import('./assets/observatory-camera.js'+suffix),
                import('./assets/observatory-motion.js'+suffix),import('./assets/observatory-bodies.js'+suffix)]);
              const catalog=createCatalog({catalog:50000,budget:'safe'}),poses=motion.createBodyMotion(catalog,{compactStellarFamilies:true}).snapshot(s.animationTime);
              const c=cam.createCamera({id:s.observedId,position:s.observedPosition,radius:.00012});
              c.distance=s.distance;c.focus=s.observedPosition;c.yaw=s.cameraYaw;c.pitch=s.cameraPitch;c.roll=s.cameraRoll;
              const a=s.observationArea,frame=cam.cameraFrame(c,innerWidth/innerHeight,[(a.x+a.width/2)/innerWidth,(a.y+a.height/2)/innerHeight]);frame.fov=s.fov;
              return catalog.bodies.map(original=>{
                const body=motion.galacticFrame(s.animationTime).body(poses.get(original.id)||original),point=cam.projectPoint(body.position,frame,innerWidth,innerHeight);
                const radius=body.radius*innerHeight/(2*Math.tan(frame.fov/2)*point.depth);
                return {id:body.id,name:body.name,kind:body.kind,...point,radius,coverage:pointSourceCoverage(body,radius)};
              });}''')
        def continuous(label,action):
            action();samples=[];start=time.monotonic();n=0
            while time.monotonic()-start<60:
                p.wait_for_timeout(350);s=j.state(p)
                samples.append({k:s.get(k) for k in ['distance','distanceTarget','flight','flightPhase','cameraYaw','cameraPitch','activeId','observedId','fov']})
                if n in [0,3,8,16,28]:frame(label+'-'+str(n))
                n+=1
                if not s['flight'] and s['distance']==s['distanceTarget']:break
            final=exact();q['events'].append({'action':label,'samples':samples});frame(label+'-settled');return final
        try:
            p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='standard',lang='zh'),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
            q['adapter']=j.state(p)['adapter']
            if not args.responsive_only:
                frame('entry');media(False)
                wide=continuous('wide',lambda:p.get_by_test_id('space-overview').click());assert wide['distance']==wide['maxDistance']
                details=p.get_by_test_id('map-details');assert details.is_visible() and details.get_attribute('aria-expanded')=='false'
                before=exact();details.press('Enter');p.wait_for_timeout(300)
                assert details.get_attribute('aria-expanded')=='true'
                assert p.get_by_test_id('target-details').is_visible() and p.get_by_test_id('space-source').is_visible()
                assert all(j.state(p)[k]==before[k] for k in poseKeys)
                frame('map-reading-open');p.get_by_test_id('guide-observe').press('Enter');p.wait_for_timeout(300)
                assert details.get_attribute('aria-expanded')=='false' and p.get_by_test_id('guide-observe').evaluate('e=>document.activeElement===e')
                assert all(j.state(p)[k]==before[k] for k in poseKeys)
                q['mapReading']={'explicitExpandAndClose':True,'sourceReachable':True,'worldPosePreserved':True,'keyboardFocusPreserved':True}
                frame('map-reading-closed')
                galaxies=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{createCatalog}from'./assets/observatory-model.js';console.log(JSON.stringify(createCatalog({budget:'safe'}).galaxies));"]))
                positions=p.evaluate("""async galaxies=>{
                  const s=window.__universeObservatoryState;
                  const {createCamera,cameraFrame,projectPoint}=await import('./assets/observatory-camera.js?v='+s.version);
                  const c=createCamera({id:s.observedId,position:s.observedPosition,radius:.001});
                  c.distance=s.distance;c.yaw=s.cameraYaw;c.pitch=s.cameraPitch;c.roll=s.cameraRoll;c.focus=s.observedPosition;
                  const a=s.observationArea,w=innerWidth,h=innerHeight;
                  const f=cameraFrame(c,w/h,[(a.x+a.width/2)/w,(a.y+a.height/2)/h]);
                  return galaxies.map(g=>({...projectPoint(g.position,f,w,h),name:g.name,id:g.id}));
                }""",galaxies)
                q['projectedMapTargets']=positions;save()
                candidates=[g for g in positions if g['visible'] and 440<g['x']<1320 and 140<g['y']<730]
                assert candidates,'No galaxy discovery centre is reachable outside the reading panel'
                destination=next((g for g in candidates if g['name']=='Sombrero Galaxy'),candidates[0])
                p.mouse.move(destination['x'],destination['y']);p.wait_for_function('id=>window.__universeObservatoryState.hoveredId===id',arg=destination['id'])
                selected=continuous('map-pick-arrival',lambda:p.mouse.click(destination['x'],destination['y']))
                assert selected['observedId']==destination['id'];q['mapSymbolPicking']={'target':destination['name'],'projection':destination,'sameIdentity':True}
                oldName=p.get_by_test_id('target-guide').locator('h1').inner_text()
                media(True);visit('Sol','all','star');p.get_by_test_id('space-overview').click();exact()
                assert oldName not in p.get_by_test_id('operation-feedback').inner_text()
                q['feedbackFollowsCurrentTarget']=True
                frame('wide-before-orbit');p.get_by_test_id('hide-guide').click();media(False)
                initial=j.state(p);x=850;y=390;p.mouse.move(x,y);p.mouse.down()
                for n in range(1,25):
                    p.mouse.move(x+n*7,y+n*3);p.wait_for_timeout(45)
                    if n in [8,16,24]:frame('wide-orbit-'+str(n))
                p.mouse.up();p.wait_for_timeout(500);rotated=exact()
                for k in ['activeId','observedId','fov','distance']:assert rotated[k]==initial[k],k
                assert abs(rotated['cameraYaw']-initial['cameraYaw'])>.2
                assert abs(rotated['cameraPitch']-initial['cameraPitch'])>.1
                q['wideOrbit']={'sameTargetAndLens':True,'before':{k:initial[k] for k in ['cameraYaw','cameraPitch','distance']},'after':{k:rotated[k] for k in ['cameraYaw','cameraPitch','distance']}}
                frame('wide-orbit-settled');media(True);p.get_by_test_id('restore-guide').click()
                if args.guide:
                    fixedKeys=poseKeys+['observationArea','observedX','observedY','animationTime']
                    def fixed(before):
                        after=exact()
                        assert all(after[k]==before[k] for k in fixedKeys),{k:[before[k],after[k]] for k in fixedKeys if after[k]!=before[k]}
                        assert p.evaluate('!document.activeElement.closest("[hidden]")'),'Keyboard focus entered hidden content'
                    def source_reading(label):
                        j.guide_section(p,'read');exact();p.wait_for_timeout(400)
                        source=p.get_by_test_id('target-source');source.focus();reachable(source)
                        assert source.get_attribute('href').startswith('https://')
                        reachable(p.get_by_test_id('hide-guide'),rounded=True);reachable(p.get_by_test_id('map-details'));frame(label)
                    visit('Sol','all','star');p.wait_for_timeout(500);frame('guide-sun-observe')
                    assert p.get_by_test_id('guide-observe').get_attribute('aria-selected')=='true'
                    assert not p.get_by_test_id('body-relations').is_visible();reachable(p.get_by_test_id('zoom-in'))
                    before=exact();p.get_by_test_id('guide-observe').press('ArrowRight');source_reading('guide-sun-read');fixed(before)
                    p.get_by_test_id('map-details').press('ArrowRight');exact();frame('guide-sun-related');fixed(before)
                    related=p.get_by_test_id('body-relations').get_by_test_id('related-body')
                    assert related.count()>30
                    search=p.get_by_test_id('related-search')
                    for query in ['土星','Saturn']:
                        search.fill(query);assert p.get_by_test_id('body-relations').locator('[data-testid=related-body]:visible').count()==1
                        assert p.get_by_test_id('body-relations').locator('button[data-target="Saturn"]:visible').count()==1;fixed(before)
                    search.fill('Crab Pulsar');assert p.get_by_test_id('related-empty').is_visible();assert p.get_by_test_id('body-relations').locator('[data-testid=related-body]:visible').count()==0;fixed(before);frame('guide-no-results')
                    search.fill('Saturn');search.press('ArrowDown')
                    target=p.get_by_test_id('body-relations').locator('button[data-target="Saturn"]');assert target.evaluate('e=>e===document.activeElement')
                    media(False);arrived=continuous('guide-saturn-arrival',lambda:target.press('Enter'));assert arrived['observed']=='Saturn';media(True)
                    assert p.get_by_test_id('guide-observe').get_attribute('aria-selected')=='true'
                    assert search.input_value()=='';assert p.get_by_test_id('star-map').evaluate('e=>document.activeElement===e')
                    frame('guide-saturn-observe');before=exact();source_reading('guide-saturn-read');fixed(before)
                    p.get_by_test_id('hide-guide').press('Enter');p.get_by_test_id('restore-guide').press('Enter');exact()
                    assert p.get_by_test_id('map-details').get_attribute('aria-selected')=='true';fixed(before)
                    j.guide_section(p,'related');exact();fixed(before)
                    search.fill('Titan');assert p.get_by_test_id('body-relations').locator('button[data-target="Titan"]:visible').count()==1
                    media(False);arrived=continuous('guide-titan-arrival',lambda:search.press('Enter'));assert arrived['observed']=='Titan';media(True)
                    j.guide_section(p,'related');search.fill('Saturn');search.press('Enter');exact('Saturn')
                    j.guide_control(p,'guide-local-system').click();family=exact();assert family['systemView']['rootId']==50001 and family['systemView']['visible'];frame('guide-saturn-family')
                    j.guide_section(p,'related');search.fill('Titan');search.press('Enter');exact('Titan');frame('guide-family-member')
                    visit('Miranda','all','moon');j.guide_section(p,'read');exact()
                    terrain=p.get_by_test_id('guide-observe-terrain');assert terrain.is_visible();terrain.focus();reachable(terrain);frame('guide-mapped-terrain')
                    before=exact();terrain.press('Enter');after=exact('Miranda')
                    assert all(before[k]==after[k] for k in ['activeId','observedId','distance','fov','animationTime']);assert not after['terrainTurn']
                    visit('Phantom Galaxy','all','galaxy');assert not p.get_by_test_id('guide-related').is_visible();frame('guide-galaxy-observe')
                    media(False);region=continuous('guide-galaxy-region',lambda:j.guide_control(p,'galaxy-region-arm').click());assert region['galaxyInspection']['region']=='arm';media(True)
                    before=exact();source_reading('guide-galaxy-read');fixed(before)
                    assert j.state(p)['galaxyInspection']['region']=='arm'
                    p.get_by_test_id('map-details').press('Home');exact();fixed(before)
                    j.save_observation(p,'guide-capture-zh',out,q,Image,ImageStat,pause_ms=200)
                    media(False);continuous('guide-return',lambda:p.get_by_test_id('return-overview').click());media(True)
                    before=exact();source_reading('guide-map-read');fixed(before);j.guide_section(p,'observe');exact();fixed(before)
                    for language,viewport in [('zh',{'width':390,'height':844}),('en',{'width':844,'height':390})]:
                        p.set_viewport_size(viewport);p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='standard',lang=language),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
                        visit('Saturn','all','planet');p.wait_for_timeout(500);suffix=language+'-'+str(viewport['width'])
                        reachable(p.get_by_test_id('zoom-in'));reachable(p.get_by_test_id('guide-observe'));frame('guide-observe-'+suffix)
                        before=exact();source_reading('guide-source-'+suffix);fixed(before)
                        p.get_by_test_id('map-details').press('ArrowRight');exact();fixed(before);search.fill('土卫六')
                        assert p.get_by_test_id('body-relations').locator('button[data-target="Titan"]:visible').count()==1
                        search.press('ArrowDown');reachable(p.get_by_test_id('body-relations').locator('button[data-target="Titan"]'));frame('guide-related-'+suffix)
                        p.get_by_test_id('guide-related').press('Home');exact();fixed(before);reachable(p.get_by_test_id('zoom-in'))
                        p.get_by_test_id('return-overview').click();exact();p.get_by_test_id('space-overview').click();exact()
                        reachable(p.get_by_test_id('approach-target'));before=exact();source_reading('guide-map-source-'+suffix);fixed(before)
                        j.guide_section(p,'observe');exact();fixed(before);reachable(p.get_by_test_id('approach-target'))
                    p.set_viewport_size({'width':1440,'height':900});exact()
                    q['guideSections']={'observeReadAndRelated':True,'sameProjectionAndClock':True,'sourceAndExitReachable':True,'scopedBilingualSearch':True,'emptyFeedback':True,'keyboardTravelAndReset':True,'familyNavigation':True,'galaxyRegionAndReturn':True,'savedImage':True,'portraitAndShortBilingualReading':True}
                if args.sources:
                    visit('Sol','all','star');p.get_by_test_id('space-overview').click();exact();p.wait_for_timeout(600)
                    projected=projected_bodies();hidden=[t for t in projected if t['kind']=='nebula' and t['coverage']<.004 and t['visible'] and 450<t['x']<1200 and 140<t['y']<700]
                    assert hidden,'The broad view must exercise unresolved diffuse sources'
                    for target in hidden[:3]:
                        p.mouse.move(target['x'],target['y']);p.wait_for_timeout(300);assert j.state(p)['hoveredId']!=target['id']
                    q['unresolvedSourcePicking']={'checked':[t['name']for t in hidden[:3]],'noInvisibleCloudTargets':True};frame('sources-wide')
                    p.get_by_test_id('scale-Regional').click();exact();p.get_by_test_id('hide-guide').click();exact();p.wait_for_timeout(600)
                    visible=[]
                    # Search through real orbit gestures; the preceding journey
                    # deliberately leaves the observer looking in another direction.
                    for attempt in range(5):
                        projected=projected_bodies();visible=[t for t in projected if t['kind']=='nebula' and t['coverage']>.02 and t['visible'] and 180<t['x']<1200 and 140<t['y']<700 and ((t['x']-720)**2+(t['y']-466.5)**2)**.5>30]
                        if visible:break
                        p.mouse.move(450,500);p.mouse.down();p.mouse.move(650,350,steps=16);p.mouse.up();exact();p.wait_for_timeout(300)
                    assert visible,'A nearer star region must retain resolvable cloud discovery'
                    target=next((t for t in visible if t['name']=='Orion Nebula'),visible[0])
                    p.mouse.move(target['x'],target['y']);p.wait_for_function('id=>window.__universeObservatoryState.hoveredId===id',arg=target['id']);frame('sources-regional-pick')
                    media(False);arrived=continuous('sources-cloud-arrival',lambda:p.mouse.click(target['x'],target['y']))
                    assert arrived['activeId']==target['id'] and arrived['observedId']==target['id']
                    p.get_by_test_id('restore-guide').click();whole=exact(target['name']);closer=continuous('sources-cloud-near',lambda:p.get_by_test_id('lens-in').click())
                    assert closer['distance']<whole['distance'] and closer['observedId']==whole['observedId']
                    p.get_by_test_id('hide-guide').click();p.mouse.move(850,390);p.mouse.down();p.mouse.move(930,435,steps=20);p.mouse.up();p.wait_for_timeout(500);frame('sources-cloud-orbit')
                    p.get_by_test_id('restore-guide').click();media(True)
                    j.guide_section(p,'read')
                    assert p.get_by_test_id('target-source').get_attribute('href').startswith('https://')
                    j.save_observation(p,'sources-capture-zh',out,q,Image,ImageStat,pause_ms=200)
                    media(False);continuous('sources-cloud-return',lambda:p.get_by_test_id('return-overview').click());media(True)
                    for name in ['Ring Nebula','Horsehead Nebula']:
                        visit(name,'all','nebula');frame('sources-whole-'+str(j.state(p)['activeId']))
                    visit('Saturn','all','planet');frame('sources-saturn')
                    j.guide_control(p,'guide-local-system').click();family=exact();assert family['systemView']['rootId']==50001 and family['systemView']['visible'];frame('sources-saturn-family')
                    visit('Earth','all','planet');j.guide_control(p,'guide-local-system').click();family=exact();assert family['systemView']['rootId']==50000 and family['systemView']['visible']
                    assert {50000,50003}.issubset({t['id']for t in family['visibleTargets']});frame('sources-earth-moon-family')
                    moon=next(t for t in family['visibleTargets']if t['id']==50003);p.mouse.click(moon['x'],moon['y']);exact('Moon');frame('sources-picked-moon')
                    visit('Sol','all','star');p.get_by_test_id('open-destinations').click();p.get_by_test_id('navigation-system').click();p.get_by_test_id('system-overview').click();family=exact()
                    assert family['systemView']['rootId']==0 and family['systemView']['visible']
                    # Diagnostics intentionally expose at most 24 targets, while
                    # the full Solar family now includes many more real bodies.
                    assert 50007 in family['systemView']['memberIds'];frame('sources-solar-family')
                    jupiter=next(t for t in projected_bodies()if t['id']==50007)
                    p.mouse.move(jupiter['x'],jupiter['y']);p.wait_for_function('()=>window.__universeObservatoryState.hoveredId===50007')
                    p.mouse.click(jupiter['x'],jupiter['y']);exact('Jupiter');frame('sources-picked-jupiter')
                    p.get_by_test_id('return-overview').click();exact();media(False);continuous('sources-wide-return',lambda:p.get_by_test_id('space-overview').click());media(True)
                    for quality in ['safe','immersive','standard']:
                        before=exact();p.get_by_test_id('open-quality').click();p.get_by_test_id('quality-'+quality).check();p.wait_for_function('key=>window.__universeObservatoryState.budget.key===key',arg=quality);p.keyboard.press('Escape');exact()
                        assert all(j.state(p)[k]==before[k]for k in poseKeys);frame('sources-wide-'+quality)
                    for viewport in [{'width':390,'height':844},{'width':844,'height':390},{'width':1440,'height':900}]:
                        p.set_viewport_size(viewport);exact();p.wait_for_timeout(500);frame('sources-map-'+str(viewport['width']))
                    q['sourceContext']={'unresolvedPicking':True,'resolvedCloudPickingAndArrival':True,'nearOrbitAndReturn':True,'sourcesAndSavedImage':True,'threeFamilies':True,'threeQualities':True,'narrowRendering':True}
                if args.coherence:
                    for name,kind in [('Earth','planet'),('Crab Pulsar','pulsar'),('Sagittarius A*','blackhole'),('Orion Nebula','nebula'),('Andromeda Galaxy','galaxy'),('Phantom Galaxy','galaxy'),('Large Magellanic Cloud','galaxy')]:
                        visit(name,'all',kind);frame('coherence-'+kind+'-'+str(j.state(p)['activeId']))
                        if kind=='galaxy':
                            p.get_by_test_id('scale-LocalSystem').click();exact(name);frame('coherence-whole-'+str(j.state(p)['activeId']))
                            p.get_by_test_id('scale-Surface').click();exact(name)
                    for name,region in [('Andromeda Galaxy','arm'),('Large Magellanic Cloud','cloud')]:
                        visit(name,'all','galaxy');media(False)
                        reached=continuous('coherence-region-'+region,lambda:p.get_by_test_id('galaxy-region-'+region).click())
                        assert reached['galaxyInspection']['region']==region
                        media(True);j.guide_control(p,'galaxy-whole').click();exact(name)
                    visit('Tarantula Nebula','outside-milky-way','nebula');frame('coherence-external-nursery')
                    visit('Sol','all','star');p.get_by_test_id('space-overview').click();exact()
                    for quality in ['safe','immersive','standard']:
                        before=exact();p.get_by_test_id('open-quality').click();p.get_by_test_id('quality-'+quality).check()
                        p.wait_for_function('key=>window.__universeObservatoryState.budget.key===key',arg=quality);p.keyboard.press('Escape');exact()
                        assert all(j.state(p)[k]==before[k] for k in poseKeys);frame('coherence-wide-'+quality)
                    q['coherence']={'nearKinds':True,'regions':True,'externalNursery':True,'threeQualities':True,'identityAndPosePreserved':True}
            if args.map_only:
                if not args.responsive_only:
                    browse('outside-milky-way');frame('scoped-final')
                    p.get_by_test_id('close-destinations').click()
                if args.desktop_only:
                    assert all(hashlib.sha256(Path(n).read_bytes()).hexdigest()==h for n,h in q['sourceHashes'].items())
                    q['status']='passed';save();return
                for language,viewport in [('zh',{'width':390,'height':844}),('en',{'width':844,'height':390})]:
                    p.set_viewport_size(viewport);p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='safe',lang=language),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
                    p.get_by_test_id('space-overview').click();exact();p.wait_for_timeout(500);frame('map-final-'+language)
                    if args.coherence:
                        details=p.get_by_test_id('map-details');reachable(details);reachable(p.get_by_test_id('approach-target'))
                        before=exact();details.press('Enter');p.wait_for_timeout(300)
                        summary=p.get_by_test_id('target-details').locator('summary');summary.focus();summary.press('Tab')
                        source=p.get_by_test_id('target-source');assert source.evaluate('e=>document.activeElement===e');reachable(source)
                        assert all(j.state(p)[k]==before[k] for k in poseKeys);frame('map-source-'+language)
                        p.get_by_test_id('guide-observe').press('Enter');p.wait_for_timeout(300);assert details.get_attribute('aria-expanded')=='false'
                        reachable(details);reachable(p.get_by_test_id('approach-target'));frame('map-closed-'+language)
                    browse('outside-milky-way');frame('scope-final-'+language);p.get_by_test_id('close-destinations').click()
                    if language=='en':
                        visit('Large Magellanic Cloud','outside-milky-way','galaxy');frame('title-final-en-short')
                        if args.coherence:
                            j.guide_section(p,'read')
                            summary=p.get_by_test_id('target-details').locator('summary');summary.focus();summary.press('Tab')
                            source=p.get_by_test_id('target-source');assert source.evaluate('e=>document.activeElement===e');reachable(source);frame('near-source-en-short')
                if args.coherence:q.setdefault('coherence',{})['responsiveReadingAndSources']=True
            else:
                browse('outside-milky-way');assert p.get_by_test_id('destinations').locator('button[data-target]:visible').count()==30;frame('outside-directory')
                p.get_by_test_id('browse-galaxy').click();assert p.get_by_test_id('destinations').locator('button[data-target]:visible').count()==26;frame('galaxy-directory')
                p.get_by_test_id('star-search').fill('Andromeda Galaxy')
                whole=continuous('arrival',lambda:p.get_by_test_id('destinations').locator('button[data-target="Andromeda Galaxy"]:visible').click())
                assert whole['observed']=='Andromeda Galaxy'
                key=whole['galaxyInspection']['options'][0]['key']
                region=continuous('region',lambda:p.get_by_test_id('galaxy-region-'+key).press('Enter'))
                assert region['galaxyInspection']['region']==key
                frame('region-guide');p.get_by_test_id('hide-guide').click();frame('region-open')
                box=p.locator('#scene').bounding_box();x=box['width']*.62;y=box['height']*.42
                p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+90,y+35,steps=24);p.mouse.up();p.wait_for_timeout(1000);frame('region-orbit')
                p.get_by_test_id('restore-guide').click();media(True)
                j.guide_control(p,'galaxy-whole').press('Enter');exact('Andromeda Galaxy');frame('whole-restored')
                p.get_by_test_id('return-overview').click();back=exact();assert back['scaleStage']=='Galactic' and back['distance']<back['maxDistance']
                p.get_by_test_id('space-overview').click();wide=exact();assert wide['distance']==wide['maxDistance'];frame('external-return-wide')
                visit('Tarantula Nebula','outside-milky-way','nebula');frame('external-nursery')
                j.guide_section(p,'read');assert p.get_by_test_id('space-path').inner_text().strip()
                visit('Altair','milky-way','star');j.guide_section(p,'read')
                assert 'simbad.cds.unistra.fr' in p.get_by_test_id('target-source').get_attribute('href');frame('named-star-source')
                visit('Earth','milky-way','planet');frame('earth-regression')
                p.get_by_test_id('open-destinations').click();p.get_by_test_id('navigation-system').click();p.get_by_test_id('system-overview').click();exact();frame('solar-family-regression')
                for language,viewport in [('zh',{'width':390,'height':844}),('en',{'width':390,'height':844}),('en',{'width':844,'height':390})]:
                    p.set_viewport_size(viewport)
                    # A new page navigation intentionally tests real startup/language preference.
                    p.goto(j.configured_url(args.url,debug=1,catalog=50000,budget='safe',lang=language),wait_until='domcontentloaded');j.wait_ready(p,q['errors']);p.add_style_tag(content='#debug{display:none!important}')
                    suffix=f'{language}-{viewport["width"]}x{viewport["height"]}'
                    frame('entry-'+suffix);browse('outside-milky-way');frame('directory-'+suffix)
                    p.get_by_test_id('close-destinations').click();assert p.get_by_test_id('open-destinations').evaluate('e=>e===document.activeElement')
                    visit('Large Magellanic Cloud','outside-milky-way','galaxy');frame('guide-'+suffix)
                    j.guide_section(p,'read');p.get_by_test_id('target-source').scroll_into_view_if_needed();frame('source-'+suffix)
                    if viewport['height']>500:
                        j.save_observation(p,'capture-'+suffix,out,q,Image,ImageStat,pause_ms=200)
                    p.get_by_test_id('return-overview').click();exact();p.get_by_test_id('space-overview').click();exact();frame('wide-'+suffix)
            assert all(hashlib.sha256(Path(n).read_bytes()).hexdigest()==h for n,h in q['sourceHashes'].items())
            q['status']='passed'
        except BaseException as e:
            q['status']='failed';q['failure']=repr(e);q['failureState']=p.evaluate('window.__universeObservatoryState || null');p.screenshot(path=str(out/'failure.png'));save();raise
        finally:
            save();ctx.close();browser.close()
    print(json.dumps({'status':q['status'],'captures':len(q['captures']),'errors':q['errors']},ensure_ascii=False))
if __name__=='__main__':main()
