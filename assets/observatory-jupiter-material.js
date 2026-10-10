// A sourced cloud-top map; bounded wind and reflected lighting are artistic.
export const JUPITER_MATERIAL_WGSL = /* wgsl */ `
fn jupiterSurface(normal:vec3f,ray:vec3f,b:BodyMaterial)->vec3f {
  let p=stellarRotateY(planetRotateX(normal,-b.tilt),b.spin);
  var uv=vec2f(atan2(p.z,p.x)/6.2831853+0.5,clamp(acos(clamp(p.y,-1.0,1.0))/3.14159265,0.0005,0.9995));
  // The displacement stays bounded, preserving the storms during long visits.
  uv.x+=0.0028*sin(p.y*36.0+f.forward.w*0.09)*(1.0-smoothstep(0.85,1.0,abs(p.y)));
  let level=max(0.0,log2(f32(textureDimensions(jupiterMap).x)/max(b.raster*4.0,1.0)));
  var albedo=textureSampleLevel(jupiterMap,surfaceSampler,uv,level).rgb;
  let near=b.near;
  var detail=p;
  if(near>0.0) {
    let wind=stellarRotateY(p,sin(p.y*36.0)*0.04+sin(f.forward.w*0.09)*0.008);
    let tops=solarCloudTops(wind,vec3f(.28,2.4,.28),near,b,normal,ray);
    let pale=smoothstep(.25,.72,dot(albedo,vec3f(.2126,.7152,.0722)));
    albedo*=1.0+((tops.fine-.5)*.22+(tops.billow-.5)*.07)*near;
    albedo+=vec3f(.024,.023,.020)*tops.crest*pale*near;
    // Historical map brightness only guides illustrative cloud-bank lighting;
    // it is not a cloud-height measurement or a replacement for mapped storms.
    let reliefLevel=max(level,mix(2.6,1.0,near));
    let texel=exp2(reliefLevel)/vec2f(textureDimensions(jupiterMap));
    let weights=vec3f(.2126,.7152,.0722);
    let du=dot(textureSampleLevel(jupiterMap,surfaceSampler,uv+vec2f(texel.x,0),reliefLevel).rgb-textureSampleLevel(jupiterMap,surfaceSampler,uv-vec2f(texel.x,0),reliefLevel).rgb,weights);
    let dv=dot(textureSampleLevel(jupiterMap,surfaceSampler,uv+vec2f(0,texel.y),reliefLevel).rgb-textureSampleLevel(jupiterMap,surfaceSampler,uv-vec2f(0,texel.y),reliefLevel).rgb,weights);
    let mapped=mappedReliefNormal(p,vec2f(du,dv),texel,.0038*near);
    detail=normalize(mapped-(p-solarCloudNormal(p,wind,tops,.55))*near);
  }
  let worldDetail=planetRotateX(stellarRotateY(detail,-b.spin),b.tilt);
  let sunlight=solarCloudLight(normal,worldDetail,b.light);
  let facing=max(dot(normal,-ray),0.0);
  let haze=pow(1.0-facing,3.8)*smoothstep(-0.10,0.60,dot(normal,b.light));
  return albedo*(0.024+sunlight*1.52)+vec3f(0.32,0.25,0.16)*haze*0.18;
}
`;
