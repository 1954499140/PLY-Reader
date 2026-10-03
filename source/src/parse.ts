import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
export interface PlyData {positions:Float32Array;colors?:Float32Array;indices?:Uint32Array;center:[number,number,number];extent:[number,number,number];count:number;triangles:number;format:string}
export function parsePly(buffer:ArrayBuffer):PlyData {
 const header=new TextDecoder().decode(buffer.slice(0,Math.min(buffer.byteLength,131072)));
 const end=header.match(/(?:^|\r?\n)end_header[^\S\r\n]*(?:\r?\n)/);
 if(!/^ply\r?\n/.test(header)||!end)throw Error('未找到有效的 PLY 文件头，请选择标准 .ply 文件。');
 const head=header.slice(0,end.index),format=head.match(/^format\s+(\S+)\s+1\.0/m)?.[1];
 if(!format||!['ascii','binary_little_endian','binary_big_endian'].includes(format))throw Error('支持 ASCII 和大小端二进制 PLY 1.0。');
 const count=Number(head.match(/^element vertex (\d+)/m)?.[1]);
 if(!Number.isSafeInteger(count)||count<1)throw Error('文件没有可显示的顶点。');
 if(count>8_000_000)throw Error('此版本最多读取 800 万个顶点，请先降采样。');
 const vertexSection=head.split(/^element vertex \d+\s*$/m)[1]?.split(/^element /m)[0]||'';
 for(const axis of ['x','y','z'])if(!new RegExp(`^property\\s+\\w+\\s+${axis}\\s*$`,'m').test(vertexSection))throw Error(`缺少顶点坐标 ${axis}。`);
 const loader=new PLYLoader();loader.setPropertyNameMapping({diffuse_red:'red',diffuse_green:'green',diffuse_blue:'blue',r:'red',g:'green',b:'blue',vertex_index:'vertex_indices'});
 const geometry=loader.parse(buffer);
 try {
  const position=geometry.getAttribute('position');if(!position||position.count<count)throw Error('顶点数据不完整。');
  const positions=new Float32Array(position.array),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++){const v=positions[i],a=i%3;if(!Number.isFinite(v))throw Error('点坐标含 NaN、Infinity 或缺失值。');lo[a]=Math.min(lo[a],v);hi[a]=Math.max(hi[a],v);}
  const center=lo.map((v,i)=>(v+hi[i])/2)as[number,number,number],extent=lo.map((v,i)=>hi[i]-v)as[number,number,number];
  for(let i=0;i<positions.length;i++)positions[i]-=center[i%3];
  const color=geometry.getAttribute('color');let colors:Float32Array|undefined;
  if(color){colors=new Float32Array(position.count*3);for(let i=0;i<position.count;i++)for(let c=0;c<3;c++){const v=color.array[i*color.itemSize+c];colors[i*3+c]=Number.isFinite(v)?Math.min(1,Math.max(0,v)):1;}}
  const indices=geometry.index?new Uint32Array(geometry.index.array):undefined;
  if(indices)for(const i of indices)if(i>=position.count)throw Error('面索引超出顶点范围。');
  const faces=Number(head.match(/^element face (\d+)/m)?.[1]||0);
  return{positions,colors,indices,center,extent,count,triangles:indices?indices.length/3:faces?position.count/3:0,format};
 }finally{geometry.dispose();}
}
