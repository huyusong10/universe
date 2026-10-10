#!/usr/bin/env python3
"""Opt-in actual GPU probe of finite foreground Galactic extinction.

Zero path, nonnegative and monotonically growing columns protect the light-depth
boundary. Perpendicular ribbon rays and arbitrary rays through the overlapping tilted
connecting layers have independent Gaussian answers. Each connecting layer
is affine; the broader shared mixture has no ray-dependent tangent chart.
The private material entry points are an explicit probe adapter; a renamed
adapter requires review, rather than rewriting a stable contract assertion.
This is not an astronomical transfer model or a visual quality certification.
"""
from pathlib import Path
import argparse,hashlib,json,math
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DISTANCES=[0,2,4,8,16,32,48,96,100000]

def gaussian_column(eye,ray,distance,layer):
    # Integrate exp(-|A(p-c)|^2) along the world ray. This independent
    # double-precision reference neither imports the GPU helper nor samples
    # its approximation to erf.
    centre,axes,slope=layer['position'],layer['axes'],layer['slopes']
    delta=[e-c for e,c in zip(eye,centre)]
    q=[delta[0]/axes[0],(delta[1]-slope[0]*delta[0]-slope[1]*delta[2])/axes[1],delta[2]/axes[2]]
    d=[ray[0]/axes[0],(ray[1]-slope[0]*ray[0]-slope[1]*ray[2])/axes[1],ray[2]/axes[2]]
    magnitude=sum(v*v for v in d);t=-sum(a*b for a,b in zip(q,d))/magnitude
    miss=[a+b*t for a,b in zip(q,d)];root=math.sqrt(magnitude)
    return math.exp(-sum(v*v for v in miss))*math.sqrt(math.pi)/(2*root)*(math.erf((distance-t)*root)-math.erf(-t*root))*layer['weight']


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--url',default='http://127.0.0.1:9031/')
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args();args.output.mkdir(parents=True,exist_ok=False)
    report={'status':'running','errors':[],'distances':DISTANCES,'limits':__doc__}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(channel='chromium',headless=True,args=['--enable-unsafe-webgpu'])
            page=browser.new_page();page.route('**/galactic-probe',lambda route:route.fulfill(status=200,content_type='text/html',body='<title>Galactic foreground probe</title>'))
            page.goto(args.url.rstrip('/')+'/galactic-probe')
            result=page.evaluate('''async(distances)=>{
              const m=await import('/assets/observatory-galactic-material.js?probe='+Date.now());
              const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
              const rays=[],inputs=[];
              m.GALACTIC_SPURS.forEach((s,index)=>{
                for(const angle of [0,-.03,.03]) {
                  const normal=[-s.tangent[1],s.tangent[0]];
                  const eye=[s.position[0]+normal[0]*32,s.position[1],s.position[2]+normal[1]*32];
                  const c=Math.cos(angle),a=Math.sin(angle);
                  const ray=[-normal[0]*c-normal[1]*a,0,-normal[1]*c+normal[0]*a];
                  rays.push({index,angle,eye,ray,width:s.axes[2],type:'support'});
                  distances.forEach(d=>inputs.push(...eye,d,...ray,index));
                }
              });
              // Independent all-direction reference is computed in Python
              // from the declared populations, without the WGSL chart helper.
              m.GALACTIC_BRIDGE_LAYERS.forEach((layer,index)=>{
                for(let axis=0;axis<3;axis++) {
                  const eye=layer.position.map((v,i)=>v-(i===axis?32:0));
                  const ray=[0,0,0];ray[axis]=1;
                  rays.push({index:8,angle:null,eye,ray,type:'veil',layer:index});
                  distances.forEach(d=>inputs.push(...eye,d,...ray,8));
                }
              });
              for(const [x,z] of [[12,-9],[-18,22],[40,-28]]) {
                const layer=m.GALACTIC_BRIDGE_LAYERS[1];
                const centre=[layer.position[0]+x,layer.position[1],layer.position[2]+z];
                const eye=[centre[0],centre[1]-32,centre[2]],ray=[0,1,0];
                rays.push({index:8,angle:null,eye,ray,type:'veil'});
                distances.forEach(d=>inputs.push(...eye,d,...ray,8));
              }
              const model=await import('/assets/observatory-model.js?probe='+Date.now());
              const world=model.createCatalog({catalog:10000,budget:'immersive'});
              const view=model.cameraFrame(model.createCamera(world.stars[0]));
              for(let y=0;y<18;y++)for(let x=0;x<32;x++) {
                const eye=view.eye,ray=model.screenRay((x+.5)*40,(y+.5)*40,view,1280,720);
                rays.push({index:0,angle:null,eye,ray,type:'viewport',pixel:[(x+.5)*40,(y+.5)*40]});
                distances.forEach(d=>inputs.push(...eye,d,...ray,0));
              }
              const code=`struct ProbeFrame { style:vec4f,forward:vec4f,quality:vec4f,right:vec4f,viewport:vec4f };
              var<private> f:ProbeFrame;\n`+m.GALACTIC_MATERIAL_WGSL+`
              @group(0) @binding(0) var<storage,read> input:array<vec4f>;
              @group(0) @binding(1) var<storage,read_write> output:array<vec4f>;
              @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3u) {
                if(id.x>=arrayLength(&output)){return;}
                let e=input[id.x*2u];let r=input[id.x*2u+1u];
                f.style=vec4f(0,.0,.5,0);f.forward=vec4f(0.0);f.quality=vec4f(0,4,0,0);f.right=vec4f(0,0,0,.4142);f.viewport=vec4f(1280,720,1280,720);
                let halo=galacticHaloField(e.xyz,r.xyz);
                var column=galacticVeilColumn(e.xyz,r.xyz,e.w);
                if(r.w<8.0){column=galacticRibbonColumn(e.xyz,r.xyz,u32(r.w),e.w);}
                output[id.x]=vec4f(column,
                  galacticOuterColumn(e.xyz,r.xyz,e.w),halo.a,dot(halo.rgb,vec3f(1.0)));
              }
              @compute @workgroup_size(64) fn pointFields(@builtin(global_invocation_id) id:vec3u) {
                if(id.x>=arrayLength(&output)){return;}
                let p=input[id.x*2u];let r=input[id.x*2u+1u];
                f.style=vec4f(0,0,${world.seed/4294967295},0);f.forward=vec4f(0.0);f.quality=vec4f(0,4,0,0);f.right=vec4f(0,0,0,.4142);f.viewport=vec4f(1280,720,1280,720);
                let eye=vec3f(${view.eye.join(',')});
                output[id.x]=vec4f(galacticScatter(p.xyz),galacticOuterFade(p.xyz),galacticColumn(eye,r.xyz,p.w),dot(galacticStellarField(eye,r.xyz),vec3f(1.0)));
              }
              @compute @workgroup_size(64) fn gaussianSegments(@builtin(global_invocation_id) id:vec3u) {
                if(id.x>=arrayLength(&output)){return;}
                let p=input[id.x*2u];var results=vec4f(0.0);
                let counts=array<u32,4>(1u,3u,4u,6u);
                for(var k=0u;k<4u;k++) {
                  let n=counts[k];let width=p.y/f32(n);
                  var total=0.0;
                  for(var j=0u;j<6u;j++) {
                    if(j>=n){break;}
                    total+=galacticGaussian(p.x-p.y*.5+(f32(j)+.5)*width,width,p.z)/f32(n);
                  }
                  results[k]=total;
                }
                output[id.x]=results;
              }`;
              const module=device.createShaderModule({code});const compilation=[...(await module.getCompilationInfo()).messages].map(m=>({type:m.type,message:m.message,line:m.lineNum}));
              if(compilation.some(m=>m.type==='error'))throw Error(JSON.stringify(compilation));
              const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
              const n=inputs.length/8,src=device.createBuffer({size:inputs.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
              const dst=device.createBuffer({size:n*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
              const read=device.createBuffer({size:n*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
              device.queue.writeBuffer(src,0,new Float32Array(inputs));
              const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:src}},{binding:1,resource:{buffer:dst}}]});
              const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();encoder.copyBufferToBuffer(dst,0,read,0,n*16);device.queue.submit([encoder.finish()]);
              await read.mapAsync(GPUMapMode.READ);const values=Array.from(new Float32Array(read.getMappedRange()));read.unmap();
              src.destroy();dst.destroy();read.destroy();
              const pointInputs=[];
              for(const p of world.dust) {
                const delta=p.position.map((v,i)=>v-view.eye[i]),distance=Math.hypot(...delta);
                pointInputs.push(...p.position,distance,...delta.map(v=>v/distance),0);
              }
              const pointPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'pointFields'}});
              const pointSrc=device.createBuffer({size:pointInputs.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
              const pointDst=device.createBuffer({size:world.dust.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
              const pointRead=device.createBuffer({size:world.dust.length*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
              device.queue.writeBuffer(pointSrc,0,new Float32Array(pointInputs));
              const pointGroup=device.createBindGroup({layout:pointPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pointSrc}},{binding:1,resource:{buffer:pointDst}}]});
              const pointEncoder=device.createCommandEncoder(),pointPass=pointEncoder.beginComputePass();pointPass.setPipeline(pointPipeline);pointPass.setBindGroup(0,pointGroup);pointPass.dispatchWorkgroups(Math.ceil(world.dust.length/64));pointPass.end();pointEncoder.copyBufferToBuffer(pointDst,0,pointRead,0,world.dust.length*16);device.queue.submit([pointEncoder.finish()]);
              await pointRead.mapAsync(GPUMapMode.READ);const points=new Float32Array(pointRead.getMappedRange()),pointInvalid=[];
              for(let i=0;i<world.dust.length;i++)if([...points.slice(i*4,i*4+4)].some(v=>!Number.isFinite(v)||v<0))pointInvalid.push({index:i,position:world.dust[i].position,fields:[...points.slice(i*4,i*4+4)].map(v=>Number.isFinite(v)?v:String(v))});
              pointRead.unmap();pointSrc.destroy();pointDst.destroy();pointRead.destroy();
              const gaussianCases=[];
              for(const mean of [-3,-1,-.2,0,.2,1,3])for(const span of [.001,.03,.1,.5,2,8,40])for(const sharpness of [.85,3,22])gaussianCases.push({mean,span,sharpness});
              const gaussianInputs=gaussianCases.flatMap(p=>[p.mean,p.span,p.sharpness,0,0,0,0,0]);
              const gaussianPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'gaussianSegments'}});
              const gaussianSrc=device.createBuffer({size:gaussianInputs.length*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
              const gaussianDst=device.createBuffer({size:gaussianCases.length*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
              const gaussianRead=device.createBuffer({size:gaussianCases.length*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
              device.queue.writeBuffer(gaussianSrc,0,new Float32Array(gaussianInputs));
              const gaussianGroup=device.createBindGroup({layout:gaussianPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:gaussianSrc}},{binding:1,resource:{buffer:gaussianDst}}]});
              const gaussianEncoder=device.createCommandEncoder(),gaussianPass=gaussianEncoder.beginComputePass();gaussianPass.setPipeline(gaussianPipeline);gaussianPass.setBindGroup(0,gaussianGroup);gaussianPass.dispatchWorkgroups(Math.ceil(gaussianCases.length/64));gaussianPass.end();gaussianEncoder.copyBufferToBuffer(gaussianDst,0,gaussianRead,0,gaussianCases.length*16);device.queue.submit([gaussianEncoder.finish()]);
              await gaussianRead.mapAsync(GPUMapMode.READ);const gaussianValues=Array.from(new Float32Array(gaussianRead.getMappedRange()));gaussianRead.unmap();gaussianSrc.destroy();gaussianDst.destroy();gaussianRead.destroy();
              const info=adapter.info;device.destroy();
              return {bridgeLayers:m.GALACTIC_BRIDGE_LAYERS,rays,values:values.map(v=>Number.isFinite(v)?v:String(v)),pointSamples:world.dust.length,pointInvalid,compilation,gaussianCases,gaussianValues,adapter:{vendor:info.vendor,architecture:info.architecture,fallback:info.isFallbackAdapter}};
            }''',DISTANCES)
            browser.close()
        assert not result['adapter']['fallback'],'Fallback GPU is not a physical probe'
        assert not result['compilation'],result['compilation']
        report.update(adapter=result['adapter'],pointSamples=result['pointSamples'],pointInvalid=result['pointInvalid'],sourceHash=hashlib.sha256((ROOT/'assets/observatory-galactic-material.js').read_bytes()).hexdigest())
        assert not result['pointInvalid'],result['pointInvalid'][:4]
        gaussian_error=0;subdivision_error=0
        for i,case in enumerate(result['gaussianCases']):
            mean,span,sharpness=(case[k] for k in ['mean','span','sharpness']);root=math.sqrt(sharpness)
            expected=math.sqrt(math.pi)/(2*root*span)*(math.erf((mean+span/2)*root)-math.erf((mean-span/2)*root))
            values=result['gaussianValues'][i*4:i*4+4]
            assert all(math.isfinite(v) and v>=0 for v in values),(case,values)
            gaussian_error=max(gaussian_error,max(abs(v-expected) for v in values))
            subdivision_error=max(subdivision_error,max(values)-min(values))
        assert gaussian_error<1e-4,(gaussian_error,subdivision_error)
        assert subdivision_error<1e-4,subdivision_error
        report['finiteThinColumns']={'cases':len(result['gaussianCases']),'subdivisions':[1,3,4,6],'maxIndependentGaussianError':gaussian_error,'maxSubdivisionEnergyError':subdivision_error}
        reference_error=0;rows=[]
        for i,ray in enumerate(result['rays']):
            samples=[result['values'][(i*len(DISTANCES)+j)*4:(i*len(DISTANCES)+j+1)*4] for j in range(len(DISTANCES))]
            assert all(isinstance(x,(int,float)) and math.isfinite(x) and x>=0 for v in samples for x in v),(ray,samples)
            assert samples[0][:2]==[0,0],(ray,samples[0])
            for field in [0,1]:
                assert all(a[field]<=b[field]+1e-5 for a,b in zip(samples,samples[1:])),(ray,field,samples)
            assert abs(samples[-1][1]-samples[-1][2])<1e-5,(ray,samples[-1])
            if ray['type']=='support':assert samples[1][0]<samples[-1][0]*.15+1e-6,'Cloud behind a nearby light contributes a full column'
            if ray['angle']==0:
                w=ray['width']
                for distance,v in zip(DISTANCES,samples):
                    expected=ray.get('referenceAmplitude',1)*math.sqrt(math.pi)*w/2*(math.erf((distance-32)/w)-math.erf(-32/w))
                    reference_error=max(reference_error,abs(v[0]-expected))
            if ray['type']=='veil':
                for distance,v in zip(DISTANCES,samples):
                    expected=sum(gaussian_column(ray['eye'],ray['ray'],distance,layer) for layer in result['bridgeLayers'])
                    reference_error=max(reference_error,abs(v[0]-expected))
            rows.append({**ray,'samples':samples})
        assert reference_error<1e-4,reference_error
        report.update(status='passed',bridgeLayers=result['bridgeLayers'],adapter=result['adapter'],rays=len(rows),samples=len(rows)*len(DISTANCES),compilation=result['compilation'],maxStraightGaussianError=reference_error,rows=rows,sourceHash=hashlib.sha256((ROOT/'assets/observatory-galactic-material.js').read_bytes()).hexdigest())
    except BaseException as e:
        report.update(status='failed',failure=str(e));raise
    finally:(args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(report['rays'],'foreground rays;',report['samples'],'GPU samples; independent Gaussian error',reference_error)

if __name__=='__main__':main()
