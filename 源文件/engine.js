/* Offline paint-by-number engine. No network, dependencies, Worker or WASM. */
(function (root) {
  'use strict';
  const wait = () => new Promise(resolve => setTimeout(resolve, 0));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const linear = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const s = i / 255; linear[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
  function lab(r, g, b) {
    r = linear[clamp(Math.round(r), 0, 255)]; g = linear[clamp(Math.round(g), 0, 255)]; b = linear[clamp(Math.round(b), 0, 255)];
    const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
    const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
    const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
    return [100*(.2104542553*l+.793617785*m-.0040720468*s),100*(1.9779984951*l-2.428592205*m+.4505937099*s),100*(.0259040371*l+.7827717662*m-.808675766*s)];
  }
  function distance(a, b) { return (a[0]-b[0])**2 + 1.3*(a[1]-b[1])**2 + 1.3*(a[2]-b[2])**2; }
  function nearest(v, palette) { let best=0,d=Infinity; for(let k=0;k<palette.length;k++){const t=distance(v,palette[k]);if(t<d){d=t;best=k;}} return best; }

  async function smooth(rgb, w, h, passes, check) {
    const spatial=[]; for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++) spatial.push([dx,dy,Math.exp(-(dx*dx+dy*dy)/5)]);
    for(let pass=0;pass<passes;pass++) {
      const out=new Uint8ClampedArray(rgb.length);
      for(let y=0;y<h;y++) {
        for(let x=0;x<w;x++) {
          const p=(y*w+x)*3,r=rgb[p],g=rgb[p+1],b=rgb[p+2];let total=0,rr=0,gg=0,bb=0;
          for(let j=0;j<spatial.length;j++) {
            const s=spatial[j],xx=clamp(x+s[0],0,w-1),yy=clamp(y+s[1],0,h-1),q=(yy*w+xx)*3;
            const d=(r-rgb[q])**2+(g-rgb[q+1])**2+(b-rgb[q+2])**2;
            const v=s[2]*Math.exp(-d/1800); total+=v;rr+=rgb[q]*v;gg+=rgb[q+1]*v;bb+=rgb[q+2]*v;
          }
          out[p]=rr/total;out[p+1]=gg/total;out[p+2]=bb/total;
        }
        if(y%20===0){check();await wait();}
      }
      rgb=out;
    }
    return rgb;
  }

  // Four-connected flood fill creates independent, closed, uniquely hittable regions.
  function components(colors,w,h) {
    const n=w*h, ids=new Int32Array(n);ids.fill(-1); const queue=new Int32Array(n),regions=[];
    for(let start=0;start<n;start++) {
      if(ids[start]!==-1)continue;
      const id=regions.length,color=colors[start];let tail=1,head=0;queue[0]=start;ids[start]=id;
      while(head<tail) {
        const p=queue[head++],x=p%w;
        if(x>0&&ids[p-1]===-1&&colors[p-1]===color){ids[p-1]=id;queue[tail++]=p-1;}
        if(x<w-1&&ids[p+1]===-1&&colors[p+1]===color){ids[p+1]=id;queue[tail++]=p+1;}
        if(p>=w&&ids[p-w]===-1&&colors[p-w]===color){ids[p-w]=id;queue[tail++]=p-w;}
        if(p<n-w&&ids[p+w]===-1&&colors[p+w]===color){ids[p+w]=id;queue[tail++]=p+w;}
      }
      regions.push({id,color,area:tail});
    }
    return {ids,regions};
  }
  class Heap {
    constructor(){this.a=[];}
    push(v){const a=this.a;let i=a.length;a.push(v);while(i>0){const p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}
    pop(){const a=this.a,top=a[0],end=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=end[0])break;a[i]=a[c];i=c;}a[i]=end;}return top;}
  }
  async function merge(colors,w,h,palette,config,check) {
    const cc=components(colors,w,h),rs=cc.regions,ids=cc.ids,parent=new Int32Array(rs.length),maps=[],heap=new Heap();
    const averages=rs.map(r=>palette[r.color].slice());let count=rs.length;
    for(let i=0;i<rs.length;i++){parent[i]=i;maps[i]=new Map();heap.push([rs[i].area,i]);}
    function edge(a,b){if(a===b)return;maps[a].set(b,(maps[a].get(b)||0)+1);maps[b].set(a,(maps[b].get(a)||0)+1);}
    for(let p=0;p<ids.length;p++){if(p%w<w-1)edge(ids[p],ids[p+1]);if(p<ids.length-w)edge(ids[p],ids[p+w]);}
    function find(i){let a=i;while(parent[a]!==a)a=parent[a];while(i!==a){const b=parent[i];parent[i]=a;i=b;}return a;}
    let ops=0;
    while(heap.a.length) {
      const item=heap.pop(),a=item[1];if(parent[a]!==a||rs[a].area!==item[0])continue;
      let perimeter=0;maps[a].forEach(v=>{perimeter+=v;});
      // Long thin bands are unplayable even when their total area is large.
      // Merge them along an existing shared border, favouring perceptually close neighbours.
      const narrow=perimeter>0&&rs[a].area/perimeter<config.minHalfWidth;
      if(rs[a].area>=config.minArea&&count<=config.maxRegions&&!narrow)continue;
      let target=-1,best=Infinity;
      maps[a].forEach((shared,b0)=>{
        const b=find(b0);if(b===a)return;
        const score=(distance(averages[a],averages[b])+3)/Math.pow(shared,.32);
        if(score<best){best=score;target=b;}
      });
      if(target<0)continue;
      const jump=Math.sqrt(distance(averages[a],averages[target]));
      // Keep small, high-contrast landmarks (pupils, flower centres) instead of erasing them.
      if(count<=config.maxRegions&&rs[a].area>=Math.max(8,config.minArea*.25)&&jump>12)continue;
      const b=target,aa=rs[a].area,ba=rs[b].area;parent[a]=b;
      for(let c=0;c<3;c++)averages[b][c]=(averages[a][c]*aa+averages[b][c]*ba)/(aa+ba);
      rs[b].area+=aa;maps[b].delete(a);
      maps[a].forEach((v,c0)=>{const c=find(c0);if(c===b)return;maps[c].delete(a);maps[c].set(b,(maps[c].get(b)||0)+v);maps[b].set(c,(maps[b].get(c)||0)+v);});
      maps[a].clear();heap.push([rs[b].area,b]);count--;
      if(++ops%180===0){check();await wait();}
    }
    const rootColor=new Int16Array(rs.length);rootColor.fill(-1);
    for(let i=0;i<rs.length;i++)if(parent[i]===i)rootColor[i]=nearest(averages[i],palette);
    for(let p=0;p<ids.length;p++)colors[p]=rootColor[find(ids[p])];
    return components(colors,w,h);
  }
  function anchors(model) {
    const {width:w,height:h,ids,regions}=model,n=w*h,dist=new Float32Array(n);dist.fill(1e6);
    regions.forEach(r=>{r.radius=0;r.x=0;r.y=0;r.minX=w;r.minY=h;r.maxX=0;r.maxY=0;});
    for(let p=0;p<n;p++) {
      const x=p%w,y=(p/w)|0,id=ids[p],r=regions[id];r.minX=Math.min(r.minX,x);r.maxX=Math.max(r.maxX,x);r.minY=Math.min(r.minY,y);r.maxY=Math.max(r.maxY,y);
      if(x===0||y===0||x===w-1||y===h-1||ids[p-1]!==id||ids[p+1]!==id||ids[p-w]!==id||ids[p+w]!==id)dist[p]=.5;
    }
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const p=y*w+x,id=ids[p];let d=dist[p];
      if(x&&ids[p-1]===id)d=Math.min(d,dist[p-1]+1);
      if(y&&ids[p-w]===id)d=Math.min(d,dist[p-w]+1);
      if(x&&y&&ids[p-w-1]===id)d=Math.min(d,dist[p-w-1]+1.4142);
      if(x<w-1&&y&&ids[p-w+1]===id)d=Math.min(d,dist[p-w+1]+1.4142);dist[p]=d;
    }
    for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--) {
      const p=y*w+x,id=ids[p];let d=dist[p];
      if(x<w-1&&ids[p+1]===id)d=Math.min(d,dist[p+1]+1);
      if(y<h-1&&ids[p+w]===id)d=Math.min(d,dist[p+w]+1);
      if(x<w-1&&y<h-1&&ids[p+w+1]===id)d=Math.min(d,dist[p+w+1]+1.4142);
      if(x&&y<h-1&&ids[p+w-1]===id)d=Math.min(d,dist[p+w-1]+1.4142);dist[p]=d;
      const r=regions[id];if(d>r.radius){r.radius=d;r.x=x+.5;r.y=y+.5;}
    }
  }
  function refinementLevel(options){const o=options||{};return Number.isInteger(o.refinement)?clamp(o.refinement,0,4):({simple:1,standard:2,fine:3}[o.detail]||2);}
  async function generate(rgba,width,height,options,report) {
    options=options||{};report=report||function(){};const started=Date.now();
    const check=()=>{if(options.cancelled&&options.cancelled())throw new Error('已取消生成');if(Date.now()-started>90000)throw new Error('这张照片处理较久，请选择简单模式再试');};
    if(width*height>650000||width<16||height<16)throw new Error('图片尺寸不适合处理，请重新选择');
    const n=width*height,k=options.colors||24,detail=options.detail||'standard',illustration=options.style==='cute';
    const config={simple:{minArea:n*.0011,maxRegions:180,minHalfWidth:3.8},standard:{minArea:n*.00038,maxRegions:440,minHalfWidth:2.7},fine:{minArea:n*.00015,maxRegions:850,minHalfWidth:1.6}}[detail];
    const baseLevel=refinementLevel({detail}),level=refinementLevel(options);
    // The preset's starting position keeps its original geometry and palette.
    if(level!==baseLevel){
      const areas=[5,3,1.8,1,.55],targets=[260,400,600,850,1100],widths=[1.8,1.5,1.2,1,.8];
      config.minArea*=areas[level]/areas[baseLevel];config.maxRegions=Math.round(config.maxRegions*targets[level]/targets[baseLevel]);config.minHalfWidth*=widths[level]/widths[baseLevel];
    }
    // Only the illustration mode simplifies shapes; keep the reviewed oil settings.
    if(illustration){config.minArea*=2;config.maxRegions=Math.round(config.maxRegions*.65);config.minHalfWidth*=1.25;}
    let rgb=new Uint8ClampedArray(n*3);
    for(let p=0;p<n;p++){const a=rgba[p*4+3]/255;for(let c=0;c<3;c++)rgb[p*3+c]=rgba[p*4+c]*a+255*(1-a);}
    report(6,'轻轻抚平照片纹理');rgb=await smooth(rgb,width,height,(detail==='fine'?1:2)+(illustration?1:0),check);
    if(illustration){
      const paper=[255,245,233],warm=[2,1,-1];
      for(let p=0;p<n;p++){
        const q=p*3,gray=.299*rgb[q]+.587*rgb[q+1]+.114*rgb[q+2];
        for(let c=0;c<3;c++){
          const value=clamp(gray+(rgb[q+c]-gray)*1.08,0,255),lifted=255*Math.pow(value/255,.9);
          rgb[q+c]=clamp(lifted*.92+paper[c]*.08+warm[c],0,255);
        }
      }
    }
    report(27,'调配照片里的颜色');await wait();
    const labs=new Float32Array(n*3),samples=[];
    for(let p=0;p<n;p++){const q=p*3,v=lab(rgb[q],rgb[q+1],rgb[q+2]);labs[q]=v[0];labs[q+1]=v[1];labs[q+2]=v[2];if(p%Math.max(1,Math.floor(n/6500))===0)samples.push(v);if(p%24000===0){check();await wait();}}
    const centers=[samples[Math.floor(samples.length/2)].slice()],minD=new Float32Array(samples.length);minD.fill(Infinity);
    for(let c=1;c<k;c++){let best=-1,index=0;for(let i=0;i<samples.length;i++){minD[i]=Math.min(minD[i],distance(samples[i],centers[c-1]));if(minD[i]>best){best=minD[i];index=i;}}centers.push(samples[index].slice());}
    for(let iter=0;iter<11;iter++){
      const sums=centers.map(()=>[0,0,0,0]);for(let i=0;i<samples.length;i++){const v=samples[i],s=sums[nearest(v,centers)];for(let c=0;c<3;c++)s[c]+=v[c];s[3]++;}
      for(let j=0;j<k;j++)if(sums[j][3])for(let c=0;c<3;c++)centers[j][c]=sums[j][c]/sums[j][3];check();await wait();
    }
    const colors=new Uint8Array(n),sums=centers.map(()=>[0,0,0,0]);
    for(let p=0;p<n;p++){const q=p*3,c=nearest([labs[q],labs[q+1],labs[q+2]],centers);colors[p]=c;const s=sums[c];s[0]+=rgb[q];s[1]+=rgb[q+1];s[2]+=rgb[q+2];s[3]++;if(p%16000===0){check();await wait();}}
    // Modal cleanup removes isolated quantization speckles without blurring strong edges.
    for(let pass=0;pass<2;pass++) {
      const next=colors.slice(),counts=new Uint8Array(k);
      for(let y=1;y<height-1;y++){for(let x=1;x<width-1;x++) {
        const p=y*width+x;counts.fill(0);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)counts[colors[p+dy*width+dx]]++;
        let best=colors[p];for(let c=0;c<k;c++)if(counts[c]>counts[best])best=c;
        if(counts[best]>=5||counts[colors[p]]<=2)next[p]=best;
      }if(y%50===0){check();await wait();}}
      colors.set(next);
    }
    report(58,'合并碎色块，整理封闭区域');
    const cc=await merge(colors,width,height,centers,config,check);
    // Assign palette numbers from light to dark for a predictable, usable tray.
    const used=new Set(cc.regions.map(r=>r.color));
    const order=centers.map((v,i)=>i).filter(i=>used.has(i)).sort((a,b)=>centers[b][0]-centers[a][0]),remap=[];
    const palette=order.map((old,i)=>{remap[old]=i;const s=sums[old],fallback=[200,180,160];return {id:i,number:i+1,rgb:s[3]?[Math.round(s[0]/s[3]),Math.round(s[1]/s[3]),Math.round(s[2]/s[3])]:fallback};});
    cc.regions.forEach(r=>{r.color=remap[r.color];});
    report(85,'为每个色块安放编号');await wait();
    const model={version:1,width,height,palette,ids:cc.ids,regions:cc.regions,options:{colors:k,detail,style:options.style||'cute'}};anchors(model);
    if(Number.isInteger(options.refinement))model.options.refinement=level;
    model.stats={regions:model.regions.length,pixels:n,requestedColors:k,smallLabels:model.regions.filter(r=>r.radius<5).length,milliseconds:Date.now()-started};
    report(100,'你的数字油画准备好了');return model;
  }
  function rle(array){const out=[];if(!array.length)return out;let value=array[0],count=1;for(let i=1;i<array.length;i++){if(array[i]===value)count++;else{out.push(value,count);value=array[i];count=1;}}out.push(value,count);return out;}
  function unrle(data,Type,length){if(!Array.isArray(data)||data.length%2)throw new Error('存档数据不完整');const out=new Type(length);let p=0;for(let i=0;i<data.length;i+=2){const v=data[i],n=data[i+1];if(!Number.isInteger(n)||n<1||p+n>length)throw new Error('存档尺寸异常');out.fill(v,p,p+n);p+=n;}if(p!==length)throw new Error('存档长度异常');return out;}
  function pack(model){return {version:model.version,width:model.width,height:model.height,palette:model.palette,regions:model.regions,options:model.options,stats:model.stats,labels:rle(model.ids)};}
  function unpack(data){if(data.version!==1||data.width*data.height>650000)throw new Error('不支持的存档');const m=Object.assign({},data);m.ids=unrle(data.labels,Int32Array,data.width*data.height);delete m.labels;return m;}
  const api={generate,refinementLevel,components,anchors,lab,pack,unpack,rle,unrle,clamp};
  root.OilEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
