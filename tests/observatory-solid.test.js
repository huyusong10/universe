import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCatalog,prepareBodyGeometry,bodyRayIntersection} from '../assets/observatory-model.js';
import {createBodyMotion,observingBody} from '../assets/observatory-motion.js';
import {SOLID_DATA} from '../assets/observatory-solid-data.js';
const unit=a=>{let n=Math.hypot(...a);return a.map(v=>v/n);};
const fetchGeometry=async url=>{
  const bytes=await fs.readFile(url);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
};
const atlas=await prepareBodyGeometry(fetchGeometry);
const catalog=createCatalog();
const rotate=(point,body)=>{
 const spin=body.spin||0,c=Math.cos(spin),s=Math.sin(spin),t=body.tilt||0,ct=Math.cos(t),st=Math.sin(t);
 const x=c*point[0]-s*point[2],y=point[1],z=s*point[0]+c*point[2];
 return [x,ct*y-st*z,st*y+ct*z];
};
// Independent reference uses all asset faces, without traversing the BVH.
function triangleDistance(origin,ray,offset) {
 const t=atlas.triangles;let best=Infinity;
 for(let face=offset[0];face<offset[1];face++) {
  const i=face*24,a=[t[i],t[i+1],t[i+2]],b=[t[i+4],t[i+5],t[i+6]],c=[t[i+8],t[i+9],t[i+10]];
  const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const dot=(u,v)=>u.reduce((n,x,j)=>n+x*v[j],0),sub=(u,v)=>u.map((x,j)=>x-v[j]);
  const ab=sub(b,a),ac=sub(c,a),h=cross(ray,ac),d=dot(ab,h);if(Math.abs(d)<1e-10)continue;
  const delta=sub(origin,a),u=dot(delta,h)/d,q=cross(delta,ab),v=dot(ray,q)/d,depth=dot(ac,q)/d;
  if(u>=0&&v>=0&&u+v<=1&&depth>0)best=Math.min(best,depth);
 }
 return best;
}
function faceRange(record) {
 let lo=Infinity,hi=-1;for(let n=record.root;n<record.end;n++){let start=atlas.nodes[n*8+7];if(start>=0){lo=Math.min(lo,start);hi=Math.max(hi,start+4);}}
 return [lo,hi];
}
test('initialized finite solids share actual asset geometry and preserve pose under rotation',()=>{
 for(const record of Object.values(SOLID_DATA.records)) {
  const original=catalog.bodies.find(b=>b.material===record.material&&(record.seed===null||b.seed===record.seed));assert.ok(original);
  const axes=original.axes||[1,1,1],range=faceRange(record);
  for(const [x,y] of [[0,0],[.31,.24],[-.47,.11],[.71,-.23],[1.05,.02]]) {
   const origin=[x,y,4.1],ray=unit([-x*.06,-y*.06,-1]);const expected=triangleDistance(origin,ray,range);
   for(const time of [0,17]) {
    // The independent face reference excludes any compound ring plane.
    const body={...observingBody(original,time),rings:undefined,position:[0,0,0],radius:1};
    const physical=origin.map((v,i)=>v*axes[i]),physicalRay=ray.map((v,i)=>v*axes[i]);const rayLength=Math.hypot(...physicalRay);
    const actual=bodyRayIntersection(body,rotate(physical,body),rotate(unit(physicalRay),body));
    if(expected===Infinity)assert.equal(actual,Infinity,`${original.name} retains empty silhouette rays`);
    else assert.ok(Math.abs(actual-expected*rayLength)<2e-6,`${original.name} shares its actual solid at time ${time}`);
   }
  }
 }
});
test('source concavity and authored terrain are actual depth, within navigation envelope',()=>{
 for(const [key,record] of Object.entries(SOLID_DATA.records)) {
  const body=catalog.bodies.find(b=>b.material===record.material&&(record.seed===null||b.seed===record.seed));const axes=body.axes||[1,1,1];let depths=[];
  const range=faceRange(record);let maximumRadius=0;
  for(let face=range[0];face<range[1];face++)for(const offset of [0,4,8]) {
    const i=face*24+offset,t=atlas.triangles;
    maximumRadius=Math.max(maximumRadius,Math.hypot(t[i],t[i+1],t[i+2]));
  }
  assert.ok(maximumRadius<=1.00001,`${key} keeps every actual vertex inside its navigation envelope`);
  for(const d of [[1,.2,.1],[-.8,.3,.5],[.1,.8,.5],[.1,-1,.1],[.3,.2,-1]]) {
   const q=unit(d),origin=q.map(v=>v*4);const distance=triangleDistance(origin,q.map(v=>-v),faceRange(record));
   assert.ok(Number.isFinite(distance),`${key} has a joined central solid`);
   const radial=4-distance;assert.ok(radial<=1.00001&&radial>.1,`${key} fits the existing outer boundary`);depths.push(radial);
  }
  assert.ok(Math.max(...depths)-Math.min(...depths)>.0001,`${key} has nonuniform actual relief`);
  const initial=createBodyMotion(catalog).snapshot(0).get(body.id).position;
  assert.ok(initial.every((value,i)=>Math.abs(value-body.position[i])<1e-12),`${key} starts at the same position within numeric precision`);
 }
});
test('geometry loading failure is recoverable without accepting a partial atlas',async()=>{
 const instance=await import('../assets/observatory-solid-geometry.js?failure-review');
 await assert.rejects(instance.loadSolidGeometry(async()=>({ok:false,status:404})),/unavailable/);
 assert.equal(instance.solidGeometryReady(),false);
 await assert.rejects(instance.loadSolidGeometry(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(16)})),/incomplete/);
 assert.equal(instance.solidGeometryReady(),false);
 await assert.rejects(instance.loadSolidGeometry(async url=>{
  const response=await fetchGeometry(url),bytes=await response.arrayBuffer();new Uint8Array(bytes)[0]^=1;
  return {ok:true,arrayBuffer:async()=>bytes};
 }),/modified/);
 assert.equal(instance.solidGeometryReady(),false);
 await instance.loadSolidGeometry(fetchGeometry);assert.equal(instance.solidGeometryReady(),true);
});
test('authored joined-lobe surfaces remain closed with consistent face orientation',()=>{
 for(const key of ['kleopatra','kerberos']) {
  const range=faceRange(SOLID_DATA.records[key]),faces=new Set(),edges=new Map(),vertices=new Set();
  for(let face=range[0];face<range[1];face++) {
   const points=[0,4,8].map(offset=>{
    const i=face*24+offset;return [atlas.triangles[i],atlas.triangles[i+1],atlas.triangles[i+2]].join(',');
   });
   const identity=points.toSorted().join('|');if(faces.has(identity))continue;faces.add(identity);
   points.forEach(point=>vertices.add(point));
   for(let i=0;i<3;i++) {
    const a=points[i],b=points[(i+1)%3],key=a<b?a+'|'+b:b+'|'+a;
    const edge=edges.get(key)||{uses:0,orientation:0};edge.uses++;edge.orientation+=a<b?1:-1;edges.set(key,edge);
   }
  }
  assert.equal(vertices.size-edges.size+faces.size,2,`${key} retains one joined closed surface`);
  for(const edge of edges.values()) {
   assert.equal(edge.uses,2,`${key} has no open or overlapping edge`);
   assert.equal(edge.orientation,0,`${key} shades adjacent faces with a consistent outside`);
  }
 }
});
test('compressed solids decode to the exact raw atlas and retain raw loading without decompression support',async()=>{
 const instance=await import('../assets/observatory-solid-geometry.js?raw-transfer-review');
 const decompression=globalThis.DecompressionStream,requests=[];
 let raw;
 try {
  globalThis.DecompressionStream=undefined;
  raw=await instance.loadSolidGeometry(async url=>{requests.push(url.pathname);return fetchGeometry(url);});
 } finally {globalThis.DecompressionStream=decompression;}
 assert.equal(requests.length,SOLID_DATA.files.length);
 assert.ok(requests.every(path=>path.endsWith('.bin')));
 const hash=data=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
 assert.equal(hash(raw.nodes),hash(atlas.nodes));assert.equal(hash(raw.surfaceData),hash(atlas.surfaceData));
 const rawBytes=SOLID_DATA.files.reduce((sum,file)=>sum+file.bytes,0);
 const transferBytes=SOLID_DATA.files.reduce((sum,file)=>sum+file.packed.bytes,0);
 assert.ok(transferBytes<rawBytes,'lossless transfer reduces bytes without removing geometry');
});
