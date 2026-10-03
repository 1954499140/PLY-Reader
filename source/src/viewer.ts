import * as THREE from 'three';
import {TrackballControls}from 'three/addons/controls/TrackballControls.js';
import type{PlyData}from './parse';
import{interpolateHoles}from './interpolate';
export type ViewName='iso'|'front'|'back'|'left'|'right'|'top'|'bottom';
export type ViewerSettings={size:number;color:string;mode:string;background:string;grid:boolean;axes:boolean;up:string};
export class PlyViewer{
 preview?:THREE.Points; detailUntil=0; lastPoseTime=0; travelStep=1;
 onDetail?:(shown:number,total:number,moving:boolean)=>void;
 markMoving=()=>{this.detailUntil=performance.now()+220;this.dirty=true;};
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.01,1000);controls:TrackballControls;
 group=new THREE.Group();helpers=new THREE.Group();points?:THREE.Points;mesh?:THREE.Mesh;data?:PlyData;
 settings:ViewerSettings={size:2,color:'rgb',mode:'points',background:'#101719',grid:true,axes:true,up:'z'};
 observer:ResizeObserver;frame=0;dirty=true;radius=1;disposed=false;exporting=false;colorKey='';
 grid?:THREE.GridHelper;axes?:THREE.AxesHelper;texture:THREE.CanvasTexture;lost:(event:Event)=>void;
 onPose?:(p:{position:number[];target:number[];up:number[];fov:number})=>void;
 constructor(public container:HTMLElement,onError:(text:string)=>void){
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(this.settings.background,1);
  const canvas=this.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D 点云：拖拽旋转，右键平移，滚轮缩放；方向键旋转，F 复位');
  this.lost=e=>{e.preventDefault();onError('显卡上下文已丢失，请重启程序后尝试较小的点云。');};canvas.addEventListener('webglcontextlost',this.lost);container.appendChild(canvas);
  this.camera.up.set(0,0,1);this.camera.position.set(6,-8,5);this.controls=new TrackballControls(this.camera,canvas);this.controls.rotateSpeed=3;this.controls.zoomSpeed=1.2;this.controls.panSpeed=.65;this.controls.staticMoving=true;this.controls.noZoom=true;this.controls.noRotate=false;this.controls.keys=['','',''];this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN};this.controls.addEventListener('start',this.markMoving);this.controls.addEventListener('change',this.changed);
  this.scene.add(this.group,this.helpers,new THREE.HemisphereLight(0xffffff,0x929d9c,2.4));const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(4,-6,8);this.scene.add(key);
  const dot=document.createElement('canvas');dot.width=dot.height=64;const ctx=dot.getContext('2d')!;ctx.fillStyle='white';ctx.beginPath();ctx.arc(32,32,30,0,Math.PI*2);ctx.fill();this.texture=new THREE.CanvasTexture(dot);
  this.observer=new ResizeObserver(this.resize);this.observer.observe(container);canvas.addEventListener('keydown',this.keydown);canvas.addEventListener('pointerdown',this.focus);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('dblclick',this.focusPoint);this.resize();this.tick();
 }
 focus=()=>this.renderer.domElement.focus({preventScroll:true});
 changed=()=>{this.markMoving();if(performance.now()-this.lastPoseTime>80){this.reportPose();this.lastPoseTime=performance.now();}};
 reportPose(){const offset=new THREE.Vector3(...(this.data?.center||[0,0,0]));this.onPose?.({position:this.camera.position.clone().add(offset).toArray(),target:this.controls.target.clone().add(offset).toArray(),up:this.camera.up.toArray(),fov:this.camera.fov});}
 resize=()=>{if(this.exporting||this.disposed)return;const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.controls.handleResize();this.dirty=true;};
 tick=()=>{if(this.disposed)return;this.frame=requestAnimationFrame(this.tick);this.controls.update();if(!this.exporting)this.updateDetail();if(this.dirty&&!this.exporting){this.renderer.render(this.scene,this.camera);this.dirty=false;}};
 setData(data:PlyData){
  this.disposeModel();this.data=data;this.colorKey='';const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));if(data.colors)geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));geometry.computeBoundingSphere();this.radius=Math.max(geometry.boundingSphere?.radius||1,.0001);
  this.points=new THREE.Points(geometry,new THREE.PointsMaterial({size:this.settings.size,sizeAttenuation:false,vertexColors:!!data.colors,color:data.colors?0xffffff:0xa3e6d0,map:this.texture,alphaTest:.4,toneMapped:false}));this.group.add(this.points);
  if(data.triangles>0){const g=geometry.clone();if(data.indices)g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeVertexNormals();this.mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:!!data.colors,color:data.colors?0xffffff:0xa3e6d0,roughness:.86,side:THREE.DoubleSide}));this.group.add(this.mesh);}
  if(data.positions.length/3>200000){const g=new THREE.BufferGeometry();g.setAttribute('position',geometry.getAttribute('position'));if(geometry.hasAttribute('color'))g.setAttribute('color',geometry.getAttribute('color'));const total=data.positions.length/3,index=new Uint32Array(200000);for(let i=0;i<index.length;i++)index[i]=Math.floor(i*total/index.length);g.setIndex(new THREE.BufferAttribute(index,1));g.boundingSphere=geometry.boundingSphere?.clone()||null;this.preview=new THREE.Points(g,this.points.material);this.preview.visible=false;this.group.add(this.preview);}
  this.travelStep=this.radius*.05;this.camera.near=this.radius/10000;this.camera.far=this.radius*1000;this.controls.minDistance=this.radius/100000;this.controls.maxDistance=this.radius*100;this.setSettings(this.settings);this.rebuildHelpers();this.setView('iso');
 }
 rebuildHelpers(){
  for(const child of [...this.helpers.children]){this.helpers.remove(child);if(child instanceof THREE.LineSegments){child.geometry.dispose();(Array.isArray(child.material)?child.material:[child.material]).forEach(m=>m.dispose());}}
  this.grid=new THREE.GridHelper(this.radius*2.5,20,0x3a4b50,0x263338);if(this.settings.up==='z'){this.grid.rotation.x=Math.PI/2;this.grid.position.z=-(this.data?.extent[2]||0)/2-this.radius*.003;}else this.grid.position.y=-(this.data?.extent[1]||0)/2-this.radius*.003;
  this.axes=new THREE.AxesHelper(this.radius*.36);this.grid.visible=this.settings.grid;this.axes.visible=this.settings.axes;this.helpers.add(this.grid,this.axes);this.dirty=true;
 }
 setSettings(next:ViewerSettings){
  const changedUp=this.settings.up!==next.up;this.settings={...next};this.renderer.setClearColor(next.background,1);
  if(this.points&&this.data){const geom=this.points.geometry,mat=this.points.material as THREE.PointsMaterial;mat.size=next.size;
   if(this.colorKey!==`${next.color}/${next.up}`){
    if(next.color==='height'){const axis=next.up==='z'?2:1,range=this.data.extent[axis]||1,color=new THREE.Color(),colors=new Float32Array(this.data.positions.length);for(let i=0;i<this.data.positions.length/3;i++){const value=this.data.positions[i*3+axis]/range+.5;color.setHSL(.65-value*.61,.76,.60);color.toArray(colors,i*3);}geom.setAttribute('color',new THREE.BufferAttribute(colors,3));}
    else if(next.color==='rgb'&&this.data.colors)geom.setAttribute('color',new THREE.BufferAttribute(this.data.colors,3));else geom.deleteAttribute('color');this.colorKey=`${next.color}/${next.up}`;
   }
   mat.vertexColors=geom.hasAttribute('color');mat.color.set(mat.vertexColors?0xffffff:0xa3e6d0);mat.needsUpdate=true;this.points.visible=next.mode!=='mesh'||!this.mesh;
   if(this.mesh){if(geom.hasAttribute('color'))this.mesh.geometry.setAttribute('color',geom.getAttribute('color'));else this.mesh.geometry.deleteAttribute('color');const mm=this.mesh.material as THREE.MeshStandardMaterial;mm.vertexColors=mat.vertexColors;mm.color.copy(mat.color);mm.wireframe=next.mode==='wire';mm.needsUpdate=true;this.mesh.visible=next.mode==='mesh'||next.mode==='wire';if(next.mode==='wire')this.points.visible=false;}
  }
  if(this.preview&&this.points){const g=this.points.geometry;if(g.hasAttribute('color'))this.preview.geometry.setAttribute('color',g.getAttribute('color'));else this.preview.geometry.deleteAttribute('color');this.preview.visible=false;}
  if(this.grid)this.grid.visible=next.grid;if(this.axes)this.axes.visible=next.axes;if(changedUp){this.rebuildHelpers();this.setView('iso');}this.dirty=true;
 }
 setView(view:ViewName){
  const isZ=this.settings.up==='z';const dirs=isZ?{iso:[1.25,-1.6,1.1],front:[0,-1,0],back:[0,1,0],left:[-1,0,0],right:[1,0,0],top:[0,0,1],bottom:[0,0,-1]}:{iso:[1.25,1.1,1.6],front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,0],bottom:[0,-1,0]};
  const fov=THREE.MathUtils.degToRad(this.camera.fov),horizontal=2*Math.atan(Math.tan(fov/2)*this.camera.aspect),distance=this.radius/Math.sin(Math.min(fov,horizontal)/2)*1.08;
  this.travelStep=this.radius*.05;this.controls.target.set(0,0,0);this.camera.up.set(0,isZ?0:1,isZ?1:0);if(view==='top'||view==='bottom')this.camera.up.set(0,isZ?1:0,isZ?0:-1);this.camera.position.copy(new THREE.Vector3(...dirs[view]).normalize().multiplyScalar(distance));this.camera.lookAt(this.controls.target);this.camera.updateProjectionMatrix();this.controls.update();this.changed();this.reportPose();
 }
 setInteraction(mode:string){this.controls.noRotate=false;this.controls.mouseButtons.LEFT=mode==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;}
 updateDetail(){
  const pointMode=this.settings.mode==='points'||!this.mesh;const low=!!this.preview&&pointMode&&performance.now()<this.detailUntil;
  if(this.preview&&this.preview.visible!==low){this.preview.visible=low;this.dirty=true;}
  if(this.points&&this.points.visible!==(pointMode&&!low)){this.points.visible=pointMode&&!low;this.dirty=true;}
  if(this.dirty){this.onDetail?.(low?200000:(this.data?.count||0),this.data?.count||0,low);if(!low)this.reportPose();}
 }
 moveForward(amount:number,ndc=new THREE.Vector2()){
  this.camera.updateMatrixWorld();const direction=new THREE.Vector3(ndc.x,ndc.y,.5).unproject(this.camera).sub(this.camera.position).normalize();
  const delta=direction.multiplyScalar(amount);this.camera.position.add(delta);this.controls.target.add(delta);this.controls.update();this.changed();this.reportPose();
 }
 wheel=(event:WheelEvent)=>{event.preventDefault();if(!this.data||this.exporting)return;const r=this.renderer.domElement.getBoundingClientRect();const ndc=new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?r.height:1);const amount=-Math.max(-4,Math.min(4,pixels/100))*this.travelStep*(event.shiftKey?.1:1);this.moveForward(amount,ndc);};
 zoom(factor:number){this.moveForward(-Math.log(factor)*5*this.travelStep);}
 focusPoint=(event:MouseEvent)=>{
  if(!this.data||!this.points)return;this.camera.updateMatrixWorld();const r=this.renderer.domElement.getBoundingClientRect(),ndc=new THREE.Vector2((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2),ray=new THREE.Raycaster();ray.params.Points={threshold:this.radius*.004};ray.setFromCamera(ndc,this.camera);const object=this.mesh?.visible?this.mesh:(this.preview||this.points);object.updateMatrixWorld();const hit=ray.intersectObject(object,false)[0];if(!hit)return;this.controls.target.copy(hit.point);this.travelStep=Math.max(this.radius*.0001,Math.min(this.radius*.05,hit.distance*.08));this.controls.update();this.changed();this.reportPose();
 };
 keydown=(e:KeyboardEvent)=>{
  if(e.key.toLowerCase()==='f'){e.preventDefault();this.setView('iso');}if(['+','=','-','_'].includes(e.key)){e.preventDefault();this.zoom(e.key==='+'||e.key==='='?.85:1.18);}
  if(e.key.startsWith('Arrow')){e.preventDefault();const d=this.camera.position.clone().sub(this.controls.target),side=e.key==='ArrowLeft'||e.key==='ArrowRight',axis=side?this.camera.up.clone().normalize():new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion),angle=e.key==='ArrowLeft'||e.key==='ArrowUp'?.08:-.08;d.applyAxisAngle(axis,angle);if(!side)this.camera.up.applyAxisAngle(axis,angle);this.camera.position.copy(this.controls.target).add(d);this.controls.update();this.changed();}
 };
 async capture(longEdge:number,interpolation:number,includeHelpers:boolean):Promise<{blob:Blob;width:number;height:number}>{
  if(!this.data)throw Error('请先打开一个 PLY 文件。');if(this.exporting)throw Error('正在生成图片，请稍候。');
  const old=this.renderer.getSize(new THREE.Vector2()),ratio=this.renderer.getPixelRatio(),scale=longEdge?longEdge/Math.max(old.x,old.y):1,width=Math.max(1,Math.round(old.x*scale)),height=Math.max(1,Math.round(old.y*scale));
  if(Math.max(width,height)>this.renderer.capabilities.maxTextureSize)throw Error('此显卡不支持该分辨率，请降低导出尺寸。');
  const mat=this.points?.material as THREE.PointsMaterial|undefined,size=mat?.size||1;let output:HTMLCanvasElement;this.exporting=true;
  try{if(this.preview)this.preview.visible=false;if(this.points)this.points.visible=this.settings.mode==='points'||!this.mesh;this.helpers.visible=includeHelpers;this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);this.renderer.setClearColor(0x000000,0);if(mat)mat.size=size*scale;this.renderer.render(this.scene,this.camera);
   const raw=document.createElement('canvas');raw.width=width;raw.height=height;const ctx=raw.getContext('2d',{willReadFrequently:interpolation>0})!;ctx.drawImage(this.renderer.domElement,0,0);
   if(interpolation){const pixels=ctx.getImageData(0,0,width,height);pixels.data.set(interpolateHoles(pixels.data,width,height,interpolation));ctx.putImageData(pixels,0,0);}
   output=document.createElement('canvas');output.width=width;output.height=height;const final=output.getContext('2d')!;final.fillStyle=this.settings.background;final.fillRect(0,0,width,height);final.drawImage(raw,0,0);
  }finally{if(mat)mat.size=size;this.helpers.visible=true;this.renderer.setPixelRatio(ratio);this.renderer.setSize(old.x,old.y,false);this.renderer.setClearColor(this.settings.background,1);this.exporting=false;this.dirty=true;this.updateDetail();this.renderer.render(this.scene,this.camera);}
  const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('图片生成失败，请降低分辨率。')),'image/png'));return{blob,width,height};
 }
 disposeModel(){if(this.preview){this.group.remove(this.preview);this.preview.geometry.dispose();this.preview=undefined;}for(const obj of[this.points,this.mesh])if(obj){this.group.remove(obj);obj.geometry.dispose();(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());}this.points=undefined;this.mesh=undefined;}
 dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.controls.dispose();const c=this.renderer.domElement;c.removeEventListener('keydown',this.keydown);c.removeEventListener('pointerdown',this.focus);c.removeEventListener('wheel',this.wheel);c.removeEventListener('dblclick',this.focusPoint);c.removeEventListener('webglcontextlost',this.lost);this.disposeModel();this.helpers.traverse(o=>{if(o instanceof THREE.LineSegments){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});this.texture.dispose();this.renderer.dispose();c.remove();}
}
