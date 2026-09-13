const video=document.getElementById("camera"), msg=document.getElementById("message"), status=document.getElementById("status");
let stream=null, mode="landscape", filter=0, facing="environment", timer=0, zoomLevel=1;
const modes={landscape:{width:3840,height:2160},portrait:{width:3024,height:4032},selfie:{width:1920,height:1080}};
const looks=[
 ["natural",1,1,1,0],["vivid",1.04,1.12,1.01,0],["cinematic",1.08,.91,.98,-.01],
 ["golden",1.02,1.04,1.01,.045],["cool",1.02,.98,1.01,-.045],["noir",1.12,0,1,0],
 ["matte",.92,.88,1,.01],["sunset",1.03,1.08,1.01,.055],["forest",1.04,1.08,1,.01],
 ["portrait",1.01,.98,1.01,.02]
];
function show(t){msg.textContent=t;msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),1500)}
async function start(){
 if(stream)stream.getTracks().forEach(t=>t.stop());
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:modes[mode].width},height:{ideal:modes[mode].height}},audio:false});
  video.srcObject=stream;
  const s=stream.getVideoTracks()[0].getSettings();
  status.textContent=(s.width||"AUTO")+"×"+(s.height||"AUTO");
 }catch(e){status.textContent="GEEN CAMERA";show("Camera-toegang toestaan")}
}
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;facing=mode==="selfie"?"user":"environment";document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x===b));start()});
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{
 filter=+b.dataset.filter;
 document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));
 const f=looks[filter]; video.style.filter=`contrast(${f[1]}) saturate(${Math.max(.05,f[2])}) brightness(${f[3]})`;
});
document.getElementById("flip").onclick=()=>{mode=mode==="selfie"?"landscape":"selfie";facing=mode==="selfie"?"user":"environment";document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));start()};
document.getElementById("timer").onclick=()=>{timer=timer===0?3:timer===3?10:0;document.querySelector("#timer").innerHTML=`TIMER<br><small>${timer?timer+"s":"OFF"}</small>`};
document.getElementById("zoom").onclick=async()=>{
 const caps=stream?.getVideoTracks()[0]?.getCapabilities?.(); if(!caps?.zoom){show("Zoom niet beschikbaar");return}
 zoomLevel=zoomLevel>=Math.min(4,caps.zoom.max)?1:zoomLevel+.5;
 try{await stream.getVideoTracks()[0].applyConstraints({advanced:[{zoom:zoomLevel}]});document.getElementById("zoom").textContent=zoomLevel+"×"}catch{}
};
document.getElementById("flash").onclick=()=>show("Smart flash: browser bepaalt beschikbaarheid");
function process(canvas){
 const ctx=canvas.getContext("2d",{willReadFrequently:true}), d=ctx.getImageData(0,0,canvas.width,canvas.height), p=d.data;
 const f=looks[filter];
 for(let i=0;i<p.length;i+=4){
  let r=p[i],g=p[i+1],b=p[i+2],l=.2126*r+.7152*g+.0722*b;
  let shadow=Math.max(0,(115-l)/115), high=Math.max(0,(l-170)/85);
  let c=f[1]*(1+.025*shadow), sat=f[2], br=f[3];
  r=(r-128)*c+128+shadow*2.5-high*2.5; g=(g-128)*c+128+shadow*2-high*2.2; b=(b-128)*c+128+shadow*1.5-high*2;
  let m=(r+g+b)/3;r=m+(r-m)*sat;g=m+(g-m)*sat;b=m+(b-m)*sat;
  r*=br*(1+f[4]);g*=br;b*=br*(1-f[4]);
  if(filter===5){r=g=b=.2126*r+.7152*g+.0722*b}
  p[i]=Math.max(0,Math.min(255,r));p[i+1]=Math.max(0,Math.min(255,g));p[i+2]=Math.max(0,Math.min(255,b));
 }
 ctx.putImageData(d,0,0);
}
document.getElementById("capture").onclick=async()=>{
 if(!video.videoWidth)return;
 if(timer){show("Foto over "+timer+"s");await new Promise(r=>setTimeout(r,timer*1000))}
 status.textContent="PROCESSING";
 const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;
 c.getContext("2d").drawImage(video,0,0,c.width,c.height);process(c);
 const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.97));
 const url=URL.createObjectURL(blob), a=document.createElement("a");a.href=url;a.download=`PhotoPro-${Date.now()}.jpg`;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),3000);status.textContent="SAVED";show("✓ Foto opgeslagen");setTimeout(()=>status.textContent="CAMERA",1200);
};
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");
start();