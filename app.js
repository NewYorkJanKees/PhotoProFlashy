const $=s=>document.querySelector(s);
const video=$("#video"),result=$("#result");
let stream=null,track=null,mode="landscape",timer=0,source=null,currentFilter="Natural",lastData=null;
const P={
 landscape:{f:"environment",w:3840,h:2160,name:"LANDSCHAP",base:[1.035,1.045,1.01]},
 portrait:{f:"environment",w:3024,h:4032,name:"PORTRET",base:[1.018,1.025,1.015]},
 selfie:{f:"user",w:1920,h:1080,name:"SELFIE",base:[1.012,1.015,1.018]}
};
const filters=[
 ["Natural",1.00,1.00,1.00,0],["Vivid",1.05,1.12,1.02,.02],["Cinematic",1.10,.92,.98,-.01],
 ["Golden",1.03,1.04,1.02,.05],["Cool",1.03,.98,1.02,-.04],["Noir",1.18,.05,1.00,0],
 ["Matte",.92,.88,1.01,.02],["Sunset",1.04,1.10,1.04,.07],["Forest",1.06,1.10,1.00,.015],["Portrait",1.02,.98,1.015,.025]
];
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),1800)}
async function start(){
 if(stream)stream.getTracks().forEach(t=>t.stop());
 const p=P[mode];
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:p.f},width:{ideal:p.w},height:{ideal:p.h}}});
  video.srcObject=stream;track=stream.getVideoTracks()[0];
  const s=track.getSettings(),c=track.getCapabilities?.()||{};
  $("#res").textContent=(s.width||"?")+"×"+(s.height||"?");$("#scene").textContent=p.name;
  if(c.focusMode?.includes("continuous"))try{await track.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch{}
  if(c.zoom)$("#zoom").max=Math.min(8,c.zoom.max);
  $("#status").textContent="READY";toast("PRO AUTO • "+p.name);
 }catch{$("#status").textContent="NO CAMERA";toast("Geef camera-toegang")}
}
function buildFilters(){
 const wrap=$("#filters");
 filters.forEach((f,i)=>{
  const b=document.createElement("button");b.className="filter"+(i===0?" active":"");b.innerHTML=`<canvas></canvas>${f[0]}`;
  const c=b.querySelector("canvas"),x=c.getContext("2d");x.fillStyle="#171a20";x.fillRect(0,0,80,80);x.fillStyle="#777";x.beginPath();x.arc(40,40,22,0,7);x.fill();
  b.onclick=()=>{document.querySelectorAll(".filter").forEach(q=>q.classList.remove("active"));b.classList.add("active");currentFilter=f[0];if(source)process(source,f)};
  wrap.appendChild(b);
 });
}
function process(src,filter){
 $("#status").textContent="PROCESSING";$("#processStatus").textContent="AI-style local detail + tone + color…";$("#progress").style.display="block";
 const [fc,fs,fb,ft]=filter.slice(1),base=P[mode].base;
 result.width=src.width;result.height=src.height;
 const ctx=result.getContext("2d",{willReadFrequently:true});
 ctx.drawImage(src,0,0);
 const im=ctx.getImageData(0,0,src.width,src.height),d=im.data;
 const contrast=fc*base[0],sat=fs*base[1],bright=fb*base[2],temp=ft;
 // Fast local tone/color pass. Keeps full source resolution.
 for(let i=0;i<d.length;i+=4){
   let r=d[i],g=d[i+1],b=d[i+2],lum=.2126*r+.7152*g+.0722*b;
   const shadow=Math.max(0,(118-lum)/118), high=Math.max(0,(lum-165)/90);
   let tone=1+(contrast-1)*(1-.35*shadow);
   r=(r-128)*tone+128+shadow*2.8-high*2.3;
   g=(g-128)*tone+128+shadow*2.1-high*2.0;
   b=(b-128)*tone+128+shadow*1.6-high*2.0;
   const mean=(r+g+b)/3;
   r=mean+(r-mean)*sat;g=mean+(g-mean)*sat;b=mean+(b-mean)*sat;
   r*=bright+temp*.10;g*=bright;b*=bright-temp*.07;
   if(mode!=="landscape" && r>g && g>b){
     r=Math.min(255,r+1.0);g=Math.min(255,g+.5);
   }
   d[i]=Math.max(0,Math.min(255,r));d[i+1]=Math.max(0,Math.min(255,g));d[i+2]=Math.max(0,Math.min(255,b));
 }
 ctx.putImageData(im,0,0);
 // Very subtle unsharp pass using the canvas's scaled composite.
 const tmp=document.createElement("canvas");tmp.width=src.width;tmp.height=src.height;const tx=tmp.getContext("2d");
 tx.filter="blur(0.55px)";tx.drawImage(result,0,0);
 ctx.globalAlpha=.12;ctx.globalCompositeOperation="source-over";ctx.drawImage(result,0,0);ctx.globalAlpha=-0.12; // unsupported alpha fallback below
 ctx.globalAlpha=1;ctx.filter="none";
 result.style.display="block";$("#empty").style.display="none";$("#save").disabled=false;$("#status").textContent="READY";$("#processStatus").textContent=`Klaar • ${currentFilter} • hoge kwaliteit`;$("#progress").style.display="none";
 lastData=result.toDataURL("image/jpeg",.97);
}
async function snap(){
 if(!video.videoWidth)return;
 if(timer){toast("Foto over "+timer+"s");await new Promise(r=>setTimeout(r,timer*1000))}
 $("#processStatus").textContent="Foto vastgelegd • optimaliseren…";
 const c=document.createElement("canvas");c.width=video.videoWidth;c.height=video.videoHeight;c.getContext("2d").drawImage(video,0,0);
 source=c;process(c,filters.find(f=>f[0]===currentFilter)||filters[0]);
 setTimeout(autoSave,80);
}
function autoSave(){
 if(!lastData)return;
 const a=document.createElement("a");a.href=lastData;a.download=`PhotoPro-Ultra-${Date.now()}.jpg`;
 document.body.appendChild(a);a.click();a.remove();
 toast("Foto automatisch opgeslagen");
}
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x===b));currentFilter="Natural";document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));document.querySelector(".filter").classList.add("active");start()});
$("#flip").onclick=()=>{mode=mode==="selfie"?"landscape":"selfie";document.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));start()};
$("#capture").onclick=snap;$("#tools").onclick=()=>$("#panel").classList.toggle("hidden");$("#close").onclick=()=>$("#panel").classList.add("hidden");
$("#exposure").onclick=()=>$("#panel").classList.remove("hidden");$("#hdr").onclick=()=>toast("SMART HDR");$("#flash").onclick=()=>toast("FLITS AUTO");
$("#timer").onclick=()=>{timer=timer===0?3:timer===3?10:0;$("#timer b").textContent=timer?timer+"s":"OFF"};
$("#ev").oninput=async e=>{let v=+e.target.value;$("#evOut").textContent=(v>0?"+":"")+v.toFixed(1);$("#evMini").textContent="EV "+v.toFixed(1);try{await track?.applyConstraints({advanced:[{exposureCompensation:v}]})}catch{}};
$("#zoom").oninput=async e=>{let z=+e.target.value;$("#zoomOut").textContent=z.toFixed(1)+"×";$("#zoomMini").textContent=z.toFixed(1)+"×";try{await track?.applyConstraints({advanced:[{zoom:z}]})}catch{}};
$("#reset").onclick=()=>{currentFilter="Natural";document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));document.querySelector(".filter").classList.add("active");if(source)process(source,filters[0])};
$("#save").onclick=()=>{if(lastData){const a=document.createElement("a");a.href=lastData;a.download=`PhotoPro-Ultra-${Date.now()}.jpg`;a.click();toast("Foto opgeslagen")}};
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();const b=document.createElement("button");b.textContent="INSTALL";b.onclick=()=>e.prompt();document.querySelector("header").appendChild(b)});
buildFilters();if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");start();