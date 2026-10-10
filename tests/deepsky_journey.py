#!/usr/bin/env python3
"""Opt-in combined extended-body discovery, detail, comparison and return journey.

Machine assertions cover navigation and bounded resources. Whole recordings,
angle/scale keyframes and actual PNGs require a separate visual judgement.
"""
import argparse, hashlib, json, math, time
from pathlib import Path
import lod_visual_smoke as j
ROOT=Path(__file__).resolve().parents[1]
TARGETS={"Halley's Comet":('comet',50006,'Moon','哈雷彗星','1p-halley'),
         'Orion Nebula':('nebula',50002,'Lagoon Nebula','猎户座大星云','orion-nebula'),
         'Andromeda Galaxy':('galaxy',50005,'Orion Nebula','仙女座星系','messier-31'),
         'Ring Nebula':('nebula',50026,'Orion Nebula','环状星云','messier-57'),
         'Helix Nebula':('nebula',50035,'Ring Nebula','螺旋星云','comet-like-knots-around-a-dying-star-in-the-helix-nebula'),
         'Lagoon Nebula':('nebula',50036,'Orion Nebula','礁湖星云','heic1517'),
         'Triangulum Galaxy':('galaxy',50027,'Andromeda Galaxy','三角座星系','messier-33'),
         'Crab Pulsar':('pulsar',50008,'Sol','蟹状脉冲星','the-crab-nebula'),
         'Vela Pulsar':('pulsar',50028,'Crab Pulsar','船帆座脉冲星','vela'),
         'Sagittarius A*':('blackhole',50009,'Crab Pulsar','射手座 A*','anatomy'),
         'M87*':('blackhole',50029,'Sagittarius A*','M87*','famous-black-hole-has-jet-pushing-cosmic-speed-limit'),
         'Sirius B':('star',50030,'Sirius','天狼星 B','heic0516')}


def probe_embedded_light_depth(page):
    """Run the production light-column integral on the actual browser GPU.

    Analytic slabs distinguish foreground, embedded and background sources;
    partitioned slabs must preserve the same optical depth. This is numerical
    rendering evidence, not a pixel or visual-quality assertion.
    """
    result=page.evaluate('''async () => {
      const { VOLUME_LIGHT_WGSL } = await import('./assets/observatory-volume-material.js');
      const adapter = await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if (!adapter || adapter.info.isFallbackAdapter) throw new Error('A non-fallback GPU is required');
      const device = await adapter.requestDevice();
      let output,readback;
      try {
        const code = VOLUME_LIGHT_WGSL + `
          @group(0) @binding(0) var<storage,read_write> result:array<vec4f>;
          @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3u) {
            let index=id.x;
            if(index>=5u) {
              var mass=vec4f(1.0);var neighbour=vec4f(0.0,1.0,4.0,16.0);var span=vec4f(.1);
              if(index==6u) {mass=vec4f(0.0,1.0,-2.0,1.0);neighbour=vec4f(7.0,8.0,-8.0,8.0);span=vec4f(1.0,0.0,1.0,-1.0);}
              if(index==7u) {neighbour=vec4f(2.0);span=vec4f(0.0,.01,.1,2.0);}
              if(index==8u) {mass=vec4f(.001,1.0,10000.0,1.0);neighbour=vec4f(0.0,.00001,0.0,10000.0);span=vec4f(1.0,.0001,.1,10.0);}
              result[index*2u]=vec4f(volumeCloudIllumination(mass.x,neighbour.x,span.x),volumeCloudIllumination(mass.y,neighbour.y,span.y),
                volumeCloudIllumination(mass.z,neighbour.z,span.z),volumeCloudIllumination(mass.w,neighbour.w,span.w));
              result[index*2u+1u]=vec4f(0.0);return;
            }
            var depth=vec4f(1.0,2.5,3.0,5.0);
            var column=vec4f(0.0);
            if(index==0u) {column=volumeLightColumn(depth,2.0,4.0,2.0);}
            if(index==1u) {
              column=volumeLightColumn(depth,2.0,2.7,2.0)+volumeLightColumn(depth,2.7,4.0,2.0);
            }
            if(index==2u) {column=volumeLightColumn(vec4f(5.0,1.0,3.0,2.5),2.0,4.0,2.0);}
            if(index==3u) {column=volumeLightColumn(depth,2.0,4.0,0.0);}
            if(index==4u) {
              depth=vec4f(1.0,2.5,5.0,8.0);
              column=volumeLightColumn(depth,2.0,3.0,1.0)+volumeLightColumn(depth,4.0,6.0,2.0);
            }
            result[index*2u]=column;result[index*2u+1u]=exp(-column);
          }`;
        const module=device.createShaderModule({code});
        const info=await module.getCompilationInfo();
        const errors=info.messages.filter(m=>m.type==='error');
        if(errors.length) throw new Error(errors.map(m=>m.message).join('; '));
        const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
        output=device.createBuffer({size:288,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
        readback=device.createBuffer({size:288,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:output}}]});
        const encoder=device.createCommandEncoder();const pass=encoder.beginComputePass();
        pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(9);pass.end();
        encoder.copyBufferToBuffer(output,0,readback,0,288);device.queue.submit([encoder.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        const values=Array.from(new Float32Array(readback.getMappedRange()));readback.unmap();
        return {adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,fallback:adapter.info.isFallbackAdapter},values};
      } finally {output?.destroy();readback?.destroy();device.destroy();}
    }''')
    expected=[[0,1,2,4],[0,1,2,4],[4,0,2,1],[0,0,0,0],[0,.5,3,5]]
    for i,column in enumerate(expected):
        for actual,wanted in zip(result['values'][i*8:i*8+8],column+[math.exp(-v)for v in column]):
            assert math.isclose(actual,wanted,rel_tol=2e-5,abs_tol=2e-6),(i,actual,wanted)
    factors=[result['values'][i*8:i*8+4] for i in range(5,9)]
    assert all(math.isfinite(v) and 0 < v < 3 for row in factors for v in row), factors
    assert all(a > b for a,b in zip(factors[0],factors[0][1:])), "More lightward matter must not brighten a cloud"
    assert all(math.isclose(v,1,abs_tol=1e-6) for v in factors[1]), "Empty matter and zero-length queries stay inert"
    assert all(a > b for a,b in zip(factors[2],factors[2][1:])), "A longer blocked light path must not brighten a cloud"
    result['cloudIllumination']={'factors':factors,'finiteBounded':True,'lightwardDensityMonotone':True,'emptyAndZeroLengthInert':True,'blockedLengthMonotone':True}
    result['status']='passed';result['cases']=['foreground/embedded/background','partition invariance','source order','transparent segment','separated layers']
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:9021/')
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--qualities',nargs='+',choices=['safe','immersive'],default=['safe','immersive'])
    parser.add_argument('--targets',nargs='*',choices=list(TARGETS),default=['Ring Nebula','Triangulum Galaxy'])
    parser.add_argument('--detail-only',action='store_true',help='Capture repaired material states without repeating completed discovery/save/return contracts.')
    parser.add_argument('--light-depth',action='store_true',help='Probe foreground, embedded and background light extinction on the actual GPU.')
    parser.add_argument('--late-arrival-seconds',type=float,default=0,help='Advance the real observation clock with the public accelerated control before reviewing later arrivals; no clock fixture.')
    parser.add_argument('--revisit-only',action='store_true',help='Check an unfinished revisit and return without repeating completed material/save stages.')
    parser.add_argument('--stellar-profiles',action='store_true',help='Review the ordinary stellar visual families in the same recording, without repeating their unchanged export/revisit contracts.')
    parser.add_argument('--profile-targets',nargs='+',choices=['Sol','Proxima Centauri','Betelgeuse','Sirius','Rigel'],default=['Sol','Proxima Centauri','Betelgeuse','Sirius'],help='Limit a repaired profile capture to the affected stellar views.')
    args=parser.parse_args()
    from PIL import Image,ImageStat
    from playwright.sync_api import sync_playwright
    args.output.mkdir(parents=True,exist_ok=False)
    report={'status':'running','qualities':[],'errors':[],'sourceHashes':{str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in [ROOT/'index.html',*sorted((ROOT/'assets').glob('*.js'))]}}
    def save():(args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    def exact(page,target=None):
        if target:page.wait_for_function('name=>{const s=window.__universeObservatoryState;return s?.observed===name&&s.active===name&&!s.flight;}',arg=target,timeout=45000)
        j.settled(page)
        page.wait_for_function('()=>{const s=window.__universeObservatoryState;return s&&!s.flight&&s.distance===s.distanceTarget;}')
        return j.state(page)
    def motion(page,mode):
        page.get_by_test_id('open-dynamics').click();page.get_by_test_id('motion-'+mode).check();page.keyboard.press('Escape')
        page.wait_for_function('mode=>window.__universeObservatoryState?.sceneMotion?.mode===mode',arg=mode)
    def media(page,reduced):
        page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
        page.wait_for_function('value=>window.__universeObservatoryState?.sceneMotion?.reduced===value',arg=reduced)
    def held(before,after,fields):
        for field in fields:
            if field=='distance':equal=math.isclose(before[field],after[field],rel_tol=1e-12)
            elif field in ['cameraYaw','cameraPitch','cameraRoll']:equal=math.isclose(before[field],after[field],rel_tol=1e-12,abs_tol=1e-14)
            else:equal=before[field]==after[field]
            assert equal,(field,before[field],after[field])
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
                    group={'quality':quality,'language':lang,'video':str(page.video.path()),'cases':[]};report['qualities'].append(group)
                    try:
                        page.goto(j.configured_url(args.url,debug=1,lang=lang,budget=quality,catalog=50000,target='Sol'),wait_until='networkidle')
                        j.wait_ready(page,report['errors']);report.setdefault('sourceVersion',j.state(page)['version'])
                        if args.light_depth and 'lightDepthProbe' not in report:
                            report['lightDepthProbe']=probe_embedded_light_depth(page)
                        if args.late_arrival_seconds>0:
                            motion(page,'accelerated')
                            page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>=t',arg=args.late_arrival_seconds,timeout=int(args.late_arrival_seconds*1000+15000))
                        motion(page,'paused');group['arrivalClock']=j.state(page)['animationTime']
                        if args.stellar_profiles:
                            group['profiles']=[]
                            for stellar in args.profile_targets:
                                profile={'target':stellar,'captures':[],'events':[],'timelineOrigin':time.monotonic(),'status':'running'};group['profiles'].append(profile)
                                media(page,False)
                                page.get_by_test_id('open-destinations').click();page.get_by_test_id('browse-star').click()
                                page.get_by_test_id('star-search').fill(stellar)
                                page.get_by_test_id('destinations').locator('button[data-target="'+stellar+'"]:visible').click()
                                whole=exact(page,stellar)
                                page.get_by_test_id('hide-guide').click();j.full_observation(page);whole=exact(page)
                                prefix=quality+'-profile-'+stellar.lower().replace(' ','-')
                                j.capture(page,prefix+'-whole',args.output,profile)
                                page.get_by_test_id('scale-slider').press('End');close=exact(page,stellar)
                                held(whole,close,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                assert close['distance']<whole['distance'];j.capture(page,prefix+'-close',args.output,profile)
                                for _ in range(7):page.get_by_test_id('star-map').press('ArrowRight')
                                for _ in range(4):page.get_by_test_id('star-map').press('ArrowUp')
                                page.get_by_test_id('star-map').press('Escape');angle=exact(page,stellar)
                                j.capture(page,prefix+'-angle',args.output,profile);motion(page,'flow')
                                for tick in [1,2,3]:
                                    page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>t',arg=angle['animationTime']+tick*.8)
                                    live=exact(page,stellar);held(angle,live,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll','fov'])
                                    j.capture(page,prefix+'-flow-'+str(tick),args.output,profile)
                                motion(page,'paused');media(page,True);frozen=exact(page,stellar);page.wait_for_timeout(300)
                                held(frozen,j.state(page),['animationTime','observedId','distance'])
                                media(page,False)
                                page.get_by_test_id('scale-LocalSystem').click();retreated=exact(page,stellar)
                                assert retreated['distance']>frozen['distance']
                                held(frozen,retreated,['observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                j.capture(page,prefix+'-retreated',args.output,profile)
                                profile.update(status='captured',fixedLens=True,activityAndReduced=True);save()
                                page.get_by_test_id('restore-guide').click()
                            print(quality,'ordinary stellar batch captured',flush=True)
                        for name in args.targets:
                            media(page,False)
                            category,identity,comparison,translated,source=TARGETS[name]
                            case={'target':name,'status':'running','captures':[],'events':[],'timelineOrigin':time.monotonic(),'transfers':[]};group['cases'].append(case)
                            slug=quality+'-'+name.lower().replace(' ','-')
                            def shot(label):return j.capture(page,slug+'-'+label,args.output,case)
                            def transfer(label,target=None):
                                page.wait_for_function('()=>window.__universeObservatoryState?.flight',timeout=12000)
                                started=time.monotonic();seen=set();samples=[]
                                while True:
                                    s=j.state(page);samples.append({k:s.get(k) for k in ['activeId','observedId','flight','flightPhase','distance','cameraYaw','cameraPitch','animationTime']})
                                    if s['flight'] and s['flightPhase'] not in seen:seen.add(s['flightPhase']);shot(label+'-'+s['flightPhase'])
                                    if not s['flight']:break
                                    assert time.monotonic()-started<35
                                    page.wait_for_timeout(180)
                                end=exact(page,target);shot(label+'-arrived');case['transfers'].append({'label':label,'samples':samples,'endpoint':end});save();return end
                            if args.revisit_only:
                                media(page,True)
                                page.get_by_test_id('open-destinations').click();page.get_by_test_id('browse-'+category).click()
                                page.get_by_test_id('star-search').fill(name)
                                page.get_by_test_id('destinations').locator('button[data-target="'+name+'"]:visible').click();exact(page,name)
                                page.get_by_test_id('scale-slider').press('End');exact(page)
                                for _ in range(8):page.get_by_test_id('star-map').press('ArrowRight')
                                page.get_by_test_id('star-map').press('Escape');remembered=exact(page);shot('remembered')
                                j.guide_control(page, 'next-observation').press('Enter');exact(page,comparison)
                                if name=='Sirius B':
                                    media(page,False);page.set_viewport_size({'width':390,'height':844})
                                    j.guide_control(page, 'guide-local-system').press('Enter');transfer('binary-return','Sirius')
                                    shared=exact(page,'Sirius');assert shared['systemView']['visible']
                                    assert set(shared['systemView']['memberIds'])=={4,identity}
                                    shot('binary-narrow-return')
                                    j.save_observation(page,slug+'-shared-observation',args.output,case,Image,ImageStat,pause_ms=200)
                                    page.set_viewport_size({'width':1280,'height':720})
                                    j.guide_section(page,'related')
                                    page.locator('[data-testid="related-body"][data-target="Sirius"]').press('Enter');transfer('binary-main-again','Sirius')
                                    case['binaryReturnAndMainVisit']=True
                                page.get_by_test_id('open-destinations').click();page.get_by_test_id('browse-featured').click()
                                media(page,True)
                                page.get_by_test_id('revisit-'+str(identity)).press('Enter');recalled=exact(page,name)
                                held(remembered,recalled,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll']);shot('recalled')
                                media(page,False);page.get_by_test_id('return-overview').press('Enter');returned=transfer('global-return')
                                assert returned['scaleStage']=='Galactic' and page.get_by_test_id('return-overview').is_disabled()
                                case.update(status='passed',revisit=True,globalReturn=True)
                                print(quality,name,'focused revisit and return passed',flush=True);save();continue
                            if args.detail_only:
                                media(page,True)
                                page.get_by_test_id('open-destinations').click();page.get_by_test_id('browse-'+category).click()
                                page.get_by_test_id('star-search').fill(name)
                                page.get_by_test_id('destinations').locator('button[data-target="'+name+'"]:visible').click()
                                whole=exact(page,name)
                                if page.get_by_test_id('hide-guide').is_visible():page.get_by_test_id('hide-guide').click()
                                j.full_observation(page);whole=exact(page);shot('whole')
                                media(page,False);page.get_by_test_id('scale-slider').press('End');close=exact(page);shot('close')
                                held(whole,close,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                for _ in range(9):page.get_by_test_id('star-map').press('ArrowRight')
                                for _ in range(8):page.get_by_test_id('star-map').press('ArrowUp')
                                page.get_by_test_id('star-map').press('Escape');exact(page);shot('angle')
                                motion(page,'flow');page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>t+.8',arg=close['animationTime']);shot('flow');motion(page,'paused')
                                if category in ['comet','galaxy','nebula','pulsar','blackhole','star']:
                                    held_near=exact(page);page.get_by_test_id('scale-LocalSystem').click();retreated=exact(page);shot('retreated')
                                    assert retreated['distance']>held_near['distance']
                                    held(held_near,retreated,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                    page.get_by_test_id('scale-slider').press('End');current=exact(page);shot('close-again')
                                    assert math.isclose(current['distance'],current['minDistance'],rel_tol=1e-9)
                                    held(held_near,current,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                    if category=='galaxy':assert current['galaxyStarsDraw']==current['budget']['galaxyStars']
                                media(page,True);frozen=exact(page);page.wait_for_timeout(350)
                                held(frozen,j.state(page),['animationTime','observedId','distance'])
                                if name=='Sirius B' or category in ['comet','galaxy','nebula']:
                                    page.set_viewport_size({'width':390,'height':844});page.get_by_test_id('restore-guide').click();exact(page);shot('narrow-reading')
                                    j.save_observation(page,slug+'-observation',args.output,case,Image,ImageStat,pause_ms=200)
                                    page.set_viewport_size({'width':1280,'height':720})
                                page.get_by_test_id('return-overview').click();exact(page)
                                case['status']='captured';print(quality,name,'repaired detail captured',flush=True);save();continue
                            before=exact(page);page.get_by_test_id('open-destinations').press('Enter');page.get_by_test_id('browse-'+category).press('Enter')
                            page.get_by_test_id('star-search').fill(name if lang=='en' else translated)
                            held(before,j.state(page),['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll'])
                            page.get_by_test_id('destinations').locator('button[data-target="'+name+'"]:visible').press('Enter')
                            if name in ['Triangulum Galaxy','M87*','Sirius B'] and quality=='immersive':
                                page.wait_for_function('()=>window.__universeObservatoryState?.flight');page.get_by_test_id('stop-flight').press('Enter')
                                page.wait_for_function('()=>!window.__universeObservatoryState?.flight');stopped=exact(page);page.wait_for_timeout(350)
                                held(stopped,j.state(page),['observedId','distance','cameraYaw','cameraPitch','cameraRoll']);assert stopped['navigationState']=='paused'
                                shot('stopped');resume=page.get_by_test_id('resume-flight')
                                (resume if resume.is_visible() else page.get_by_test_id('approach-target')).press('Enter');case['stopResume']=True
                            whole=transfer('entry',name);assert whole['activeId']==identity
                            links=page.get_by_role('link').evaluate_all('links=>links.map(link=>link.href)')
                            if not any('/'+source+'/' in link for link in links):
                                j.guide_section(page,'read')
                                links=page.get_by_role('link').evaluate_all('links=>links.map(link=>link.href)')
                            assert any('/'+source+'/' in link for link in links)
                            if name=='Sirius B':
                                j.guide_control(page, 'guide-local-system').press('Enter');transfer('binary-unfold','Sirius')
                                shared=exact(page,'Sirius');assert shared['systemView']['scope']=='local'
                                assert shared['systemView']['visible'] and set(shared['systemView']['memberIds'])=={4,identity}
                                assert page.get_by_test_id('related-body').count()==2;shot('binary-shared')
                                motion(page,'flow');page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>t+1.2',arg=shared['animationTime'])
                                moved=exact(page,'Sirius');held(shared,moved,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll'])
                                shot('binary-flow');motion(page,'paused')
                                j.guide_section(page,'related')
                                page.locator('[data-testid="related-body"][data-target="Sirius B"]').press('Enter')
                                whole=transfer('binary-member',name);case['binarySharedView']=True
                            page.get_by_test_id('hide-guide').click();j.full_observation(page);whole=exact(page);shot('whole')
                            page.get_by_test_id('scale-slider').press('End');samples=[]
                            while True:
                                s=j.state(page);samples.append({'distance':s['distance'],'yaw':s['cameraYaw'],'pitch':s['cameraPitch']})
                                if not s['flight'] and s['distance']==s['distanceTarget'] and s['distance']<whole['distance']:break
                                assert len(samples)<100;page.wait_for_timeout(120)
                            close=exact(page);assert close['distance']<whole['distance']
                            assert math.isclose(close['distance'],close['minDistance'],rel_tol=1e-9)
                            held(whole,close,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime']);case['approachSamples']=samples;shot('close')
                            for _ in range(9):page.get_by_test_id('star-map').press('ArrowRight')
                            for _ in range(8):page.get_by_test_id('star-map').press('ArrowUp')
                            page.get_by_test_id('star-map').press('Escape')
                            angle=exact(page);assert angle['cameraYaw']!=close['cameraYaw'];shot('angle')
                            motion(page,'flow');page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>t+.8',arg=angle['animationTime']);live=exact(page);shot('flow')
                            held(angle,live,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll','fov']);motion(page,'paused')
                            if category in ['galaxy','nebula'] or name in ['M87*','Sirius B']:
                                if category=='galaxy':assert live['galaxyStarsDraw']==live['budget']['galaxyStars']
                                if quality=='immersive':
                                    before=exact(page);page.get_by_test_id('open-quality').click();page.get_by_test_id('quality-safe').check()
                                    page.wait_for_function('()=>window.__universeObservatoryState?.quality?.key==="safe"');low=exact(page)
                                    held(before,low,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll']);assert low['galaxyStarsDraw']<=low['budget']['galaxyStars']
                                    page.get_by_test_id('quality-immersive').check();page.wait_for_function('()=>window.__universeObservatoryState?.quality?.key==="immersive"');page.get_by_test_id('close-quality').click();exact(page);case['liveQualitySwitch']=True
                            if category in ['comet','galaxy','nebula']:
                                before=exact(page);page.get_by_test_id('scale-LocalSystem').click();retreated=exact(page);shot('retreated')
                                assert retreated['distance']>before['distance']
                                held(before,retreated,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                page.get_by_test_id('scale-slider').press('End');near_again=exact(page);shot('close-again')
                                assert math.isclose(near_again['distance'],near_again['minDistance'],rel_tol=1e-9)
                                held(before,near_again,['activeId','observedId','cameraYaw','cameraPitch','cameraRoll','fov','animationTime'])
                                case['retreatAndReapproach']=True
                            media(page,True);frozen=exact(page);page.wait_for_timeout(350)
                            held(frozen,j.state(page),['animationTime','observedId','distance'])
                            page.set_viewport_size({'width':390,'height':844});page.get_by_test_id('restore-guide').click();exact(page)
                            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');shot('narrow-reading')
                            j.save_observation(page,slug+'-observation',args.output,case,Image,ImageStat,pause_ms=200)
                            remembered=exact(page);page.set_viewport_size({'width':1280,'height':720});media(page,False)
                            j.guide_control(page, 'next-observation').press('Enter');legacy=transfer('compare',comparison)
                            if category=='galaxy':assert legacy['galaxyStarsDraw']==legacy['budget']['galaxyStars']
                            page.get_by_test_id('hide-guide').click();j.full_observation(page);shot('comparison-whole')
                            if category in ['pulsar','blackhole'] or name=='Sirius B':
                                page.get_by_test_id('scale-slider').press('End');old_close=exact(page);shot('comparison-close')
                                for _ in range(8):page.get_by_test_id('star-map').press('ArrowDown')
                                page.get_by_test_id('star-map').press('Escape');exact(page);shot('comparison-angle')
                                motion(page,'flow');legacy_live=exact(page)
                                for tick in [1,2,3]:
                                    page.wait_for_function('t=>window.__universeObservatoryState?.animationTime>t',arg=legacy_live['animationTime']+tick*.8)
                                    live=exact(page);held(legacy_live,live,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll','fov'])
                                    shot('comparison-flow-'+str(tick))
                                motion(page,'paused');media(page,True);page.wait_for_timeout(350);frozen=exact(page);page.wait_for_timeout(350)
                                held(frozen,j.state(page),['animationTime','distance','observedId']);case['legacyReducedMotion']=True
                            page.get_by_test_id('restore-guide').click()
                            if name=='Sirius B':
                                media(page,False)
                                page.set_viewport_size({'width':390,'height':844})
                                j.guide_control(page, 'guide-local-system').press('Enter');transfer('binary-return','Sirius')
                                shared_return=exact(page,'Sirius')
                                assert shared_return['systemView']['visible'] and set(shared_return['systemView']['memberIds'])=={4,identity}
                                assert page.get_by_test_id('related-body').count()==2;shot('binary-narrow-return')
                                j.save_observation(page,slug+'-shared-observation',args.output,case,Image,ImageStat,pause_ms=200)
                                page.set_viewport_size({'width':1280,'height':720})
                                j.guide_section(page,'related')
                                page.locator('[data-testid="related-body"][data-target="Sirius"]').press('Enter');transfer('binary-main-again','Sirius')
                                case['binaryReturnAndMainVisit']=True
                            page.get_by_test_id('open-destinations').click();page.get_by_test_id('browse-featured').click()
                            media(page,True);page.get_by_test_id('revisit-'+str(identity)).press('Enter');recalled=exact(page,name)
                            held(remembered,recalled,['activeId','observedId','distance','cameraYaw','cameraPitch','cameraRoll']);assert not recalled['flight'];shot('recalled')
                            media(page,False);page.get_by_test_id('return-overview').press('Enter');returned=transfer('global-return')
                            assert returned['scaleStage']=='Galactic' and page.get_by_test_id('return-overview').is_disabled()
                            case.update(status='passed',fixedLensApproach=True,manualOrbit=True,pausedAndFlowing=True,creditedLocalPng=True,comparison=True,revisit=True,reducedMotion=True,globalReturn=True)
                            print(quality,name,'deep-sky journey passed',flush=True);save()
                    finally:context.close()
            finally:browser.close()
        assert not report['errors'],report['errors']
        assert all(hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h for f,h in report['sourceHashes'].items())
        report['status']='detail-captured-awaiting-visual-review' if args.detail_only else 'behaviour-passed-awaiting-visual-review'
    except Exception as e:report.update(status='failed',failure=str(e));raise
    finally:save()


if __name__=='__main__':main()
