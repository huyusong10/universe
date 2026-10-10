// Finite shape atlas shared by selected surfaces, neighbours and CPU rays.
// Source-derived geometry and authored relief retain separate provenance.
import { SOLID_DATA } from './observatory-solid-data.js?v=cosmic-explore-20261010gu';
export { SOLID_DATA } from './observatory-solid-data.js?v=cosmic-explore-20261010gu';
const records=Object.values(SOLID_DATA.records);
let atlas=null,pending=null;
export function solidShape(material,seed) {
  return records.find(record=>record.material===material && (record.seed===null || record.seed===seed));
}
export async function loadSolidGeometry(fetcher=fetch,{compressed=typeof DecompressionStream==='function'}={}) {
  if(atlas) return atlas;
  if(pending) return pending;
  pending=(async()=>{
    const chunks=await Promise.all(SOLID_DATA.files.map(async file=>{
      const transfer=compressed&&file.packed?file.packed:file;
      const buffers=await Promise.all((transfer.parts||[transfer.file]).map(async name=>{
        const url=new URL(`./geometry/${name}?v=${transfer.sha256.slice(0,16)}`,import.meta.url);
        const response=await fetcher(url);
        if(!response.ok) throw new Error(`Celestial geometry unavailable (${response.status}).`);
        return response.arrayBuffer();
      }));
      let bytes=buffers[0];
      if(transfer.parts) {
        const joined=new Uint8Array(transfer.bytes);let offset=0;
        for(const buffer of buffers) {
          if(offset+buffer.byteLength>joined.length) throw new Error('Celestial geometry is incomplete.');
          joined.set(new Uint8Array(buffer),offset);offset+=buffer.byteLength;
        }
        if(offset!==joined.length) throw new Error('Celestial geometry is incomplete.');
        bytes=joined.buffer;
      }
      async function verify(data,expected) {
        if(data.byteLength!==expected.bytes) throw new Error('Celestial geometry is incomplete.');
        const digest=await crypto.subtle.digest('SHA-256',data);
        const actual=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
        if(actual!==expected.sha256) throw new Error('Celestial geometry was modified.');
      }
      await verify(bytes,transfer);
      if(transfer!==file) {
        if(transfer.encoding!=='gzip') throw new Error('Invalid celestial geometry encoding.');
        // A fixed-size destination prevents a malformed stream from growing
        // the CPU atlas. Both transfer and exact decoded geometry are verified.
        const decoded=new Uint8Array(file.bytes);
        const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
        let offset=0;
        try {
          while(true) {
            const {done,value}=await reader.read();if(done) break;
            if(offset+value.length>decoded.length) throw new Error('Celestial geometry is incomplete.');
            decoded.set(value,offset);offset+=value.length;
          }
          if(offset!==decoded.length) throw new Error('Celestial geometry is incomplete.');
        } finally {await reader.cancel();}
        bytes=decoded.buffer;await verify(bytes,file);
      }
      return {file,bytes};
    }));
    if(SOLID_DATA.encoding!=='indexed-f32-v1') throw new Error('Invalid celestial geometry encoding.');
    const nodes=new Float32Array(SOLID_DATA.nodeCount*8);
    const surfaceData=new Uint32Array(SOLID_DATA.triangleCount*4+SOLID_DATA.vertexCount*8);
    const surfaceFloats=new Float32Array(surfaceData.buffer);let nodeOffset=0,faceOffset=0,vertexOffset=SOLID_DATA.triangleCount*4;
    for(const {file,bytes} of chunks) {
      if(file.kind==='nodes') {const data=new Float32Array(bytes);nodes.set(data,nodeOffset);nodeOffset+=data.length;}
      else {
        const data=new Uint32Array(bytes),headerWords=file.triangleCount*4;
        if(data.length!==headerWords+file.vertexCount*8) throw new Error('Invalid celestial geometry.');
        surfaceData.set(data.subarray(0,headerWords),faceOffset);faceOffset+=headerWords;
        surfaceData.set(data.subarray(headerWords),vertexOffset);vertexOffset+=file.vertexCount*8;
      }
    }
    const cellCount=surfaceData.length/4;
    if(nodeOffset!==nodes.length || faceOffset!==SOLID_DATA.triangleCount*4 || vertexOffset!==surfaceData.length ||
       !nodes.every(Number.isFinite) || !surfaceFloats.subarray(faceOffset).every(Number.isFinite)) throw new Error('Invalid celestial geometry.');
    for(let i=0;i<faceOffset;i+=4) for(let corner=0;corner<3;corner++) {
      const cell=surfaceData[i+corner];
      if(cell<SOLID_DATA.triangleCount || cell+1>=cellCount || (cell-SOLID_DATA.triangleCount)%2) throw new Error('Invalid celestial geometry index.');
    }
    // Existing data readers can still request the expanded float32 faces.
    // Rendering and CPU picking use only shared indexed vertices; this view
    // is allocated lazily and never during normal scene initialization.
    let expanded=null;
    atlas={nodes,surfaceData,surfaceFloats,get triangles() {
      if(!expanded) {
        expanded=new Float32Array(SOLID_DATA.triangleCount*24);
        for(let face=0;face<SOLID_DATA.triangleCount;face++) for(let corner=0;corner<3;corner++) {
          const at=surfaceData[face*4+corner]*4;
          expanded.set(surfaceFloats.subarray(at,at+4),face*24+corner*4);
          expanded.set(surfaceFloats.subarray(at+4,at+8),face*24+(corner+3)*4);
        }
      }
      return expanded;
    }};return atlas;
  })();
  try{return await pending;}catch(error){pending=null;throw error;}
}
export function solidGeometryReady() {return atlas!==null;}
// Ray coordinates are normalized by the body's existing ellipsoid. Nearest
// positive intersections retain concave gaps; no enclosing sphere fills them.
export function solidRayIntersection(record,origin,ray) {
  if(!atlas || !record) return Infinity;
  const {nodes,surfaceData,surfaceFloats:t}=atlas;let best=Infinity,index=record.root;
  const inverse=ray.map(v=>Math.abs(v)>1e-14?1/v:0);
  for(let visit=0;visit<record.end-record.root && index<record.end;visit++) {
    const offset=index*8;let entry=0,exit=best;
    for(let axis=0;axis<3;axis++) {
      const lo=nodes[offset+axis],hi=nodes[offset+4+axis];
      if(inverse[axis]===0) {if(origin[axis]<lo||origin[axis]>hi) {exit=-1;break;}}
      else {const a=(lo-origin[axis])*inverse[axis],b=(hi-origin[axis])*inverse[axis];entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));}
    }
    if(exit<entry) {index=nodes[offset+3];continue;}
    const start=nodes[offset+7];index++;
    if(start<0) continue;
    for(let face=start;face<start+4;face++) {
      const ia=surfaceData[face*4]*4,ib=surfaceData[face*4+1]*4,ic=surfaceData[face*4+2]*4;
      const ax=t[ia],ay=t[ia+1],az=t[ia+2];
      const e1x=t[ib]-ax,e1y=t[ib+1]-ay,e1z=t[ib+2]-az;
      const e2x=t[ic]-ax,e2y=t[ic+1]-ay,e2z=t[ic+2]-az;
      const hx=ray[1]*e2z-ray[2]*e2y,hy=ray[2]*e2x-ray[0]*e2z,hz=ray[0]*e2y-ray[1]*e2x;
      const determinant=e1x*hx+e1y*hy+e1z*hz;if(Math.abs(determinant)<1e-10) continue;
      const dx=origin[0]-ax,dy=origin[1]-ay,dz=origin[2]-az;
      const u=(dx*hx+dy*hy+dz*hz)/determinant;if(u<0||u>1) continue;
      const qx=dy*e1z-dz*e1y,qy=dz*e1x-dx*e1z,qz=dx*e1y-dy*e1x;
      const v=(ray[0]*qx+ray[1]*qy+ray[2]*qz)/determinant;if(v<0||u+v>1) continue;
      const distance=(e2x*qx+e2y*qy+e2z*qz)/determinant;
      if(distance>0) best=Math.min(best,distance);
    }
  }
  return best;
}
const solidNodeBudget=Math.max(...records.map(record=>record.end-record.root));
const solidStackSize=Math.ceil(Math.log2(solidNodeBudget+1))+1;
const rangeCases=records.map(record=>{
 const condition=`abs(material-${record.code}.0)<.5`+(record.seed===null?'':` && abs(seed-${(record.seed/4294967295).toFixed(10)})<.000001`);
 return `if(${condition}) {return vec2u(${record.root}u,${record.end}u);}`;
}).join('\n');
const jetCases=records.filter(record=>record.jets.length).map(record=>{
 const condition=`abs(material-${record.code}.0)<.5`+(record.seed===null?'':` && abs(seed-${(record.seed/4294967295).toFixed(10)})<.000001`);
 const vec=value=>`vec3f(${value.map(v=>v.toFixed(8)).join(',')})`;
 return `if(${condition}) {let roots=array<vec3f,3>(${record.jets.map(j=>vec(j.point)).join(',')});let normals=array<vec3f,3>(${record.jets.map(j=>vec(j.normal)).join(',')});return SolidJet(roots[index],normals[index]);}`;
}).join('\n');
export const SOLID_GEOMETRY_WGSL=/* wgsl */`
struct SolidNode {lo:vec4f,hi:vec4f};
@group(0) @binding(13) var<storage,read> solidNodes:array<SolidNode>;
@group(0) @binding(14) var<storage,read> solidSurface:array<vec4u>;
fn solidRange(material:f32,seed:f32)->vec2u {${rangeCases} return vec2u(0u);}
struct SolidHit {distance:f32,normal:vec3f,lightPoint:vec3f};
// Smooth shading represents a curved surface above a finite convex face.
// Project only below the vertex tangent planes before casting sunlight.
// Concave support planes contribute zero; the small bounded correction never
// changes coverage, intersection depth, picking or a material coordinate.
fn solidLightPoint(point:vec3f,a:vec3f,b:vec3f,c:vec3f,na:vec3f,nb:vec3f,nc:vec3f,weights:vec3f)->vec3f {
  let offset=na*max(dot(a-point,na),0.0)*weights.x+
    nb*max(dot(b-point,nb),0.0)*weights.y+nc*max(dot(c-point,nc),0.0)*weights.z;
  return point+offset/max(1.0,length(offset)/.006);
}
fn solidBoundsEntry(node:SolidNode,origin:vec3f,inverse:vec3f,parallel:vec3<bool>,nearest:f32)->f32 {
  let a=(node.lo.xyz-origin)*inverse;let b=(node.hi.xyz-origin)*inverse;
  let lower=select(min(a,b),vec3f(-1e20),parallel);let upper=select(max(a,b),vec3f(1e20),parallel);
  let entry=max(0.0,max(lower.x,max(lower.y,lower.z)));let exit=min(nearest,min(upper.x,min(upper.y,upper.z)));
  let outside=(parallel.x && (origin.x<node.lo.x || origin.x>node.hi.x)) ||
    (parallel.y && (origin.y<node.lo.y || origin.y>node.hi.y)) ||
    (parallel.z && (origin.z<node.lo.z || origin.z>node.hi.z));
  return select(entry,1e20,exit<entry || outside);
}
fn solidTrace(source:vec3f,ray:vec3f,range:vec2u,firstBlocker:bool)->SolidHit {
  if(range.y<=range.x) {return SolidHit(-1.0,vec3f(0),vec3f(0));}
  let origin=-source;var index=range.x;var nearest=1e20;var nearestCells=vec3u(0);var weights=vec3f(0);
  let parallel=abs(ray)<vec3f(1e-10);let inverse=1.0/select(ray,vec3f(1),parallel);
  // A balanced finite tree bounds this small stack. Near children go first;
  // far branches are checked again against the newly found surface depth.
  var stack:array<u32,${solidStackSize}>;var pending=0u;
  var entry=solidBoundsEntry(solidNodes[index],origin,inverse,parallel,nearest);
  for(var visit=0u;visit<${solidNodeBudget}u;visit++) {
    if(entry<nearest) {
      let node=solidNodes[index];
      if(node.hi.w<0.0) {
        let left=index+1u;let right=u32(-node.hi.w-1.0);
        let a=solidBoundsEntry(solidNodes[left],origin,inverse,parallel,nearest);
        let b=solidBoundsEntry(solidNodes[right],origin,inverse,parallel,nearest);
        if(a<nearest || b<nearest) {
          if(b<a) {
            if(a<nearest) {stack[pending]=left;pending++;}
            index=right;entry=b;
          } else {
            if(b<nearest) {stack[pending]=right;pending++;}
            index=left;entry=a;
          }
          continue;
        }
      } else {
        let first=u32(node.hi.w);
    for(var i=first;i<first+4u;i++) {
      let cells=solidSurface[i].xyz;
      let a=bitcast<vec4f>(solidSurface[cells.x]).xyz;let b=bitcast<vec4f>(solidSurface[cells.y]).xyz;let c=bitcast<vec4f>(solidSurface[cells.z]).xyz;
      let edge1=b-a;let edge2=c-a;
      let h=cross(ray,edge2);let determinant=dot(edge1,h);
      if(abs(determinant)<1e-10) {continue;}
      // Numerators reject misses without three divisions. Both windings
      // remain valid; a visibility query returns before any normal loads.
      let sign=select(-1.0,1.0,determinant>0.0);let denominator=determinant*sign;
      let delta=origin-a;let u=dot(delta,h)*sign;
      if(u<0.0||u>denominator) {continue;}
      let q=cross(delta,edge1);let v=dot(ray,q)*sign;
      if(v<0.0||u+v>denominator) {continue;}
      let depth=dot(edge2,q)*sign;
      if(depth>0.0&&depth<nearest*denominator) {
        let distance=depth/denominator;
        if(firstBlocker) {return SolidHit(distance,vec3f(0),vec3f(0));}
        nearest=distance;nearestCells=cells;
        weights=vec3f(denominator-u-v,u,v)/denominator;
      }
    }
      }
    }
    if(pending==0u) {break;}
    pending--;index=stack[pending];
    entry=solidBoundsEntry(solidNodes[index],origin,inverse,parallel,nearest);
  }
  if(nearest>=1e19) {return SolidHit(-1.0,vec3f(0),vec3f(0));}
  // Only the final visible triangle needs interpolated normals. Candidate
  // intersections and sunlight blockers never read or normalize them.
  let na=bitcast<vec4f>(solidSurface[nearestCells.x+1u]).xyz;
  let nb=bitcast<vec4f>(solidSurface[nearestCells.y+1u]).xyz;
  let nc=bitcast<vec4f>(solidSurface[nearestCells.z+1u]).xyz;
  let a=bitcast<vec4f>(solidSurface[nearestCells.x]).xyz;
  let b=bitcast<vec4f>(solidSurface[nearestCells.y]).xyz;
  let c=bitcast<vec4f>(solidSurface[nearestCells.z]).xyz;
  let point=origin+ray*nearest;
  return SolidHit(nearest,normalize(na*weights.x+nb*weights.y+nc*weights.z),solidLightPoint(point,a,b,c,na,nb,nc,weights));
}
fn solidHit(source:vec3f,ray:vec3f,range:vec2u)->SolidHit {
  return solidTrace(source,ray,range,false);
}
// Direct sunlight uses the same finite geometry as coverage and CPU picking.
// A single bounded, early-out ray is enough for local crater/neck occlusion;
// ambient illumination remains in each material. This is not a shadow texture
// or an albedo-derived height field, and it never changes either LOD's shape.
fn solidSunVisibility(point:vec3f,light:vec3f,range:vec2u,raster:f32)->f32 {
  if(range.y<=range.x || raster<=12.0) {return 1.0;}
  let direction=normalize(light);
  // Move along the physical light ray to avoid hitting its own source face.
  // Interpolated vertex normals can lie inside a concave wall and are not bias.
  let origin=point+direction*.0015;
  let blocker=solidTrace(-origin,direction,range,true);
  return select(1.0,1.0-smoothstep(12.0,44.0,raster),blocker.distance>0.0);
}
struct SolidJet {point:vec3f,normal:vec3f};
fn solidJet(material:f32,seed:f32,index:u32)->SolidJet {${jetCases}return SolidJet(vec3f(0),vec3f(0,1,0));}
`;
