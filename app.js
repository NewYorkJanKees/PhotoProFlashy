const $=s=>document.querySelector(s);
const video=$("#video");let stream=null,track=null,mode="landscape",timer=0,selected=0,source=null;
const P={
 landscape:{f:"environment",w:3840,h:2160,name:"LANDSCHAP",base:[1.035,1.045,1.01]},
 portrait:{f:"environment",w:3024,h:4032,name:"PORTRET",base:[1.018,1.025,1.015]},
 selfie:{f:"user",w:1920,h:1080,name:"SELFIE",base:[1.012,1.015,1.018]}
};
// 10 deliberately subtle looks. The first is the automatic natural look.
const LOOKS=[
 ["Natural",1.00,1.00,1.00,0.00],
 ["Vivid",1.045,1.105,1.015,0.01],
 ["Cinematic",1.085,0.925,0.985,-0.01],
 ["Golden",1.025,1.035,1.015,0.055],
 ["Cool",1.025,0.985,1.015,-0.045],
 ["Noir",1.16,0.02,1.00,0.00],
 ["Matte",0.91,0.86,1.01,0.015],
 ["Sunset",1.035,1.085,1.02,0.065],
 ["Forest",1.045,1.085,1.00,0.012],
 ["Portrait",1.015,0.975,1.012,0.025]
];
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}
function step(n){document.querySelectorAll(".steps span").forEach((x,i)=>x.classList.toggle("on",i<n))}
async function start(){
 if(stream)stream.getTracks().forEach(t=>t.stop());
 const p=P[mode];
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:p.f},width:{ideal:p.w},height:{ideal:p.h}}});
  video.srcObject=stream;track=stream.getVideoTracks()[0];
  const s=track.getSettings(),c=track.getCapabilities?.()||{};
  $("#resolution").textContent=(s.width||"?")+"×"+(s.height||"?");
  $("#scene").textContent=p.name;$("#state").textContent="READY";
  if(c.focusMode?.includes("continuous"))try{await track.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch{}
  if(c.zoom)$("#zoom").max=Math.min(8,c.zoom.max);
 }catch{$("#state").textContent="NO CAMERA";toast("Geef PhotoPro camera-toegang")}
}
function makeFilterThumb(b,look){
 const c=b.querySelector("canvas"),x=c.getContext("2d");c.width=120;c.height=80;
 const g=x.createLinearGradient(0,0,120,80);g.addColorStop(0,"#68717d");g.addColorStop(.5,"#c4a77e");g.addColorStop(1,"#303844");x.fillStyle=g;x.fillRect(0,0,120,80);
 x.fillStyle="rgba(255,255,255,.55)";x.beginPath();x.arc(62,38,20,0,Math.PI*2);x.fill();
 const [_,co,sa,br,temp]=look;x.globalAlpha=.28;x.fillStyle=temp>0?"#ffb45c":temp<0?"#75a9d8":"#fff";x.fillRect(0,0,120,80);x.globalAlpha=1;
 x.fillStyle=`rgba(0,0,0,${Math.max(0,(co-1)*1.5)})`;x.fillRect(0,0,120,80);
}
function buildLooks(){
 const wrap=$("#filters");
 LOOKS.forEach((look,i)=>{
  const b=document.createElement("button");b.className="filter"+(i===0?" active":"");
  b.innerHTML=`<div class="filterThumb"><canvas></canvas></div>${look[0]}`;
  makeFilterThumb(b,look);
  b.onclick=()=>{selected=i;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#selectedLook").textContent=look[0].toUpperCase();toast(look[0]+" geselecteerd")};
  wrap.appendChild(b);
 });
}
function processImage(src,look){
 step(1);$("#engineText").textContent="TONE";
 const p=P[mode].base,[fc,fs,fb,ft]=look.slice(1);
 const contrast=fc*p[0],sat=fs*p[1],bright=fb*p[2],temp=ft;
 const out=document.createElement("canvas");out.width=src.width;out.height=src.height;
 const ctx=out.getContext("2d",{willReadFrequently:true});ctx.drawImage(src,0,0);
 let im=ctx.getImageData(0,0,out.width,out.height),d=im.data;
 // Tone mapping + color pass, full source resolution.
 for(let i=0;i<d.length;i+=4){
  let r=d[i],g=d[i+1],b=d[i+2],lum=.2126*r+.7152*g+.0722*b;
  const shadow=Math.max(0,(120-lum)/120),high=Math.max(0,(lum-165)/90);
  let tone=1+(contrast-1)*(1-.38*shadow);
  r=(r-128)*tone+128+shadow*2.7-high*2.3;
  g=(g-128)*tone+128+shadow*2.1-high*2.0;
  b=(b-128)*tone+128+shadow*1.6-high*2.0;
  const m=(r+g+b)/3;
  r=m+(r-m)*sat;g=m+(g-m)*sat;b=m+(b-m)*sat;
  r*=bright+temp*.10;g*=bright;b*=bright-temp*.07;
  // Gentle skin protection for portrait/selfie.
  if(mode!=="landscape" && r>g && g>b && r-g>8){r=Math.min(255,r+1.0);g=Math.min(255,g+.45)}
  d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,g));d[i+2]=Math.max(0,Math.min(255,b));
 }
 ctx.putImageData(im,0,0);
 step(2);$("#engineText").textContent="DETAIL";
 // Subtle unsharp mask: original minus a very small blur, blended lightly.
 const blur=document.createElement("canvas");blur.width=out.width;blur.height=out.height;
 const bx=blur.getContext("2d");bx.filter="blur(0.7px)";bx.drawImage(out,0,0);
 const a=ctx.getImageData(0,0,out.width,out.height),q=bx.getImageData(0,0,out.width,out.height);
 for(let i=0;i<a.data.length;i+=4){
   a.data[i]=Math.max(0,Math.min(255,a.data[i]+(a.data[i]-q.data[i])*.12));
   a.data[i+1]=Math.max(0,Math.min(255,a.data[i+1]+(a.data[i+1]-q.data[i+1])*.12));
   a.data[i+2]=Math.max(0,Math.min(255,a.data[i+2]+(a.data[i+2]-q.data[i+2])*.12));
 }
 ctx.putImageData(a,0,0);step(3);$("#engineText").textContent="SAVE";
 return out.toDataURL("image/jpeg",.97);
}
async function capture(){
 if(!video.videoWidth)return;
 if(timer){toast("Foto over "+timer+"s");await new Promise(r=>setTimeout(r,timer*1000))}
 $("#state").textContent="PROCESSING";$("#processStatus")?.remove?.();
 step(0);
 const src=document.createElement("canvas");src.width=video.videoWidth;src.height=video.videoHeight;
 src.getContext("2d").drawImage(video,0,0);
 source=src;
 const data=processImage(src,LOOKS[selected]);
 // Automatic browser save. Android/desktop normally downloads immediately.
 const a=document.createElement("a");a.href=data;a.download=`PhotoPro-${P[mode].name}-${Date.now()}.jpg`;
 document.body.appendChild(a);a.click();a.remove();
 step(4);$("#state").textContent="SAVED";$("#engineText").textContent="SAVED";toast("✓ Foto automatisch opgeslagen");
 setTimeout(()=>{$("#state").textContent="READY"},1800);
}
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x===b));start()});
$("#flip").onclick=()=>{mode=mode==="selfie"?"landscape":"selfie";document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));start()};
$("#capture").onclick=capture;
$("#settings").onclick=()=>$("#proPanel").classList.toggle("hidden");$("#close").onclick=()=>$("#proPanel").classList.add("hidden");
$("#hdr").onclick=()=>toast("SMART HDR actief");$("#exposure").onclick=()=>$("#proPanel").classList.remove("hidden");$("#flash").onclick=()=>toast("FLITS AUTO");
$("#timer").onclick=()=>{timer=timer===0?3:timer===3?10:0;$("#timer b").textContent=timer?timer+"s":"OFF"};
$("#ev").oninput=async e=>{let v=+e.target.value;$("#evOut").textContent=(v>0?"+":"")+v.toFixed(1);$("#evMini").textContent="EV "+v.toFixed(1);try{await track?.applyConstraints({advanced:[{exposureCompensation:v}]})}catch{}};
$("#zoom").oninput=async e=>{let z=+e.target.value;$("#zoomOut").textContent=z.toFixed(1)+"×";$("#zoomMini").textContent=z.toFixed(1)+"×";try{await track?.applyConstraints({advanced:[{zoom:z}]})}catch{}};
buildLooks();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");start();