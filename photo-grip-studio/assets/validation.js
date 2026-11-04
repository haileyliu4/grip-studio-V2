/* Diagnostic viewer. Probes never modify the user's inputs or exported build. */
(function () {
'use strict';
const canvas=document.getElementById('validationCanvas'),ctx=canvas.getContext('2d');
const gpu=window.createGripRenderer(document.getElementById('validationSurface'));
const status=document.getElementById('probeStatus');
const parsedMeshes=new WeakMap();
function parse(buffer){if(parsedMeshes.has(buffer))return parsedMeshes.get(buffer);const dv=new DataView(buffer),n=dv.getUint32(80,true),out=[];for(let i=0;i<n;i++){const tri=[];for(let j=0;j<3;j++)tri.push([0,1,2].map(k=>dv.getFloat32(84+i*50+12+j*12+k*4,true)));out.push(tri);}parsedMeshes.set(buffer,out);return out;}
let base=null,current=null,latest=null,yaw=.6,pitch=-.2,pending=0,activeSide="right",skeleton=null,drag=null,frame=null;
const center=[0,0,0],size=[0,0,0],regionCentroids=new WeakMap();
function setBaseline(side){
activeSide=side==='left'?'left':'right';
const result=GEN.generate(GRIP_BASELINE,activeSide);if(result.error)throw Error(result.error);
base=parse(result.stl);
for(let k=0;k<3;k++){let lo=Infinity,hi=-Infinity;for(const t of base)for(const v of t){lo=Math.min(lo,v[k]);hi=Math.max(hi,v[k]);}center[k]=(lo+hi)/2;size[k]=hi-lo;}
}
function compare(mesh){let max=0,sum=0,count=0;for(let i=0;i<base.length;i++)for(let j=0;j<3;j++){const d=Math.hypot(...mesh[i][j].map((v,k)=>v-base[i][j][k]));max=Math.max(max,d);sum+=d*d;count++;}return {max,rms:Math.sqrt(sum/count)};}
function scheduleDraw(){if(frame!==null)return;frame=window.requestAnimationFrame(function(){frame=null;draw();});}
function draw(){if(!base||!current)return;const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,1.5);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
const viewSize=size.slice();
const scale=Math.min(width,height)*.72/Math.max(...viewSize),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
function project(v){const x=v[0]-center[0],y=v[1]-center[1],z=v[2]-center[2],a=x*cy+z*sy,b=-x*sy+z*cy;const split=false;return [width/2+a*scale*(split?.55:1)+(split?width*.23:0),height/2-(y*cp-b*sp)*scale*(split?.55:1)];}
if(gpu)gpu.draw(base,current,yaw,pitch,center,viewSize,document.getElementById('showBaseline').checked,document.getElementById('showRegions').checked,false,activeSide);
else {ctx.fillStyle='#235c50';ctx.font='14px system-ui';ctx.fillText('3D graphics unavailable. Enable hardware acceleration in your browser.',20,40);}

// Nominal regions from the inherited template, transformed back to source axes.
if(document.getElementById('showRegions').checked){
const names=['Index','Middle','Ring','Pinky','Thumb'],colors=['#337bf2','#bf4dd1','#ce920e','#293744','#f25a40'];
let sums=regionCentroids.get(current);
if(!sums){sums=names.map(()=>[0,0,0,0]);
// Region centroids follow corresponding current vertices, rather than floating on the axis.
for(let i=0;i<base.length;i++){const t=base[i],v=t[0],x=-(v[1]-center[1]),y=v[2]-center[2],z=-(v[0]-center[0]);const r=GEN.sourceRegionAt?GEN.sourceRegionAt(activeSide==='left'?[v[0],v[1],2*center[2]-v[2]]:v):GEN.regionAt(x,Math.atan2(z,y)*180/Math.PI);if(r>=0){for(let k=0;k<3;k++)sums[r][k]+=current[i][0][k];sums[r][3]++;}}
regionCentroids.set(current,sums);}
ctx.font='bold 13px system-ui';
for(let i=0;i<5;i++){if(!sums[i][3])continue;const point=project(sums[i].slice(0,3).map(v=>v/sums[i][3]));const bx=i===4?width-124:12,by=32+i*38;ctx.strokeStyle=colors[i];ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bx+(i===4?0:98),by+13);ctx.lineTo(point[0],point[1]);ctx.stroke();ctx.fillStyle=colors[i];ctx.beginPath();ctx.arc(point[0],point[1],4,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(bx,by,110,27);ctx.fillStyle=colors[i];ctx.fillText(names[i],bx+9,by+18);}
}


}
function show(result,message,hand,side){const targetSide=side||result.handedness||'right';if(!base||activeSide!==targetSide)setBaseline(targetSide);current=parse(result.stl);const contactSurface=window.createGripSurface(current,center);const checked=GEN.validateHand(hand||result.measurements||GRIP_BASELINE);skeleton=checked.error?null:window.buildGripSkeleton(checked.val,center,side||result.handedness||"right",typeof GRIP_CALIBRATION!=="undefined"?GRIP_CALIBRATION.regions:null,contactSurface);current=parse(result.stl);const metrics=compare(current);status.textContent=message+' · maximum vertex movement '+metrics.max.toFixed(4)+' mm · RMS '+metrics.rms.toFixed(4)+' mm'+(metrics.max<.00001?' · Identical geometry: the orange baseline coincides exactly with the surface.':'');scheduleDraw();}
for(const id of ['showBaseline','showRegions'])document.getElementById(id).addEventListener('change',scheduleDraw);
canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.01;pitch+=(e.clientY-drag[1])*.01;drag=[e.clientX,e.clientY];scheduleDraw();});for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{drag=null;scheduleDraw();});
document.getElementById('resetValidationView').addEventListener('click',()=>{yaw=.6;pitch=-.2;scheduleDraw();});window.addEventListener('resize',scheduleDraw);
window.addEventListener('grip-invalidated',()=>{document.getElementById('previewStale').hidden=!latest;});
window.addEventListener('grip-generated',event=>{document.getElementById('previewStale').hidden=true;latest=event.detail;pending++;show(latest,'Latest generated output · '+(latest.handedness||'right')+' hand');});
})();
