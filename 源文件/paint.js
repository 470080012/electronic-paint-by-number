(function(root){
  'use strict';
  const clamp=OilEngine.clamp;
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  class Painting {
    constructor(model,saved,replay){
      this.model=model;const n=model.width*model.height;
      this.mask=saved?OilEngine.unrle(saved,Uint8Array,n):new Uint8Array(n);
      this.coverage=new Uint32Array(model.regions.length);this.completed=new Uint8Array(model.regions.length);
      this.pixels=model.regions.map(r=>new Uint32Array(r.area));const cursor=new Uint32Array(model.regions.length);
      this.painted=0;for(let p=0;p<n;p++){const id=model.ids[p];this.pixels[id][cursor[id]++]=p;if(this.mask[p]){this.coverage[id]++;this.painted++;}}
      this.recount();this.history=[];this.active=null;
      this.replayData=replay&&replay.version===1?JSON.parse(JSON.stringify(replay)):{version:1,scope:saved?'continued':'full',base:OilEngine.rle(this.mask),events:[]};
    }
    recount(){this.model.regions.forEach(r=>{this.completed[r.id]=this.coverage[r.id]===r.area?1:0;});}
    progress(){return this.painted/(this.model.width*this.model.height);}
    begin(){this.active={pixels:[],regions:new Set(),steps:[]};}
    recordStep(start){const pixels=this.active.pixels.slice(start);if(pixels.length)this.active.steps.push({value:1,runs:Painting.runs(pixels)});}
    static runs(pixels){const out=[];pixels.forEach(p=>{const n=out.length;if(n&&out[n-2]+out[n-1]===p)out[n-1]++;else out.push(p,1);});return out;}
    replaySnapshot(){const data=JSON.parse(JSON.stringify(this.replayData));if(this.active)data.events=data.events.concat(this.active.steps);return data;}
    recordEvents(events){const data=this.replayData;events.forEach(e=>data.events.push(e));let size=data.events.reduce((n,e)=>n+e.runs.length+12,0);if(size>500000){const base=OilEngine.unrle(data.base,Uint8Array,this.mask.length);while(size>400000&&data.events.length){const e=data.events.shift();for(let i=0;i<e.runs.length;i+=2)base.fill(e.value,e.runs[i],e.runs[i]+e.runs[i+1]);size-=e.runs.length+12;}data.base=OilEngine.rle(base);data.scope='recent';}}
    add(p){if(this.mask[p])return false;if(this.beforeActivity&&!this.beforeActivity())return false;if(this.onActivity&&!this.active.activityNotified){this.onActivity();this.active.activityNotified=true;}this.mask[p]=1;this.painted++;const id=this.model.ids[p];this.coverage[id]++;this.active.pixels.push(p);this.active.regions.add(id);return true;}
    fill(id,color){const r=this.model.regions[id];if(!r||r.color!==color||this.completed[id])return false;
      if(!this.active)this.begin();this.active.activityNotified=false;const start=this.active.pixels.length,ps=this.pixels[id];for(let j=0;j<ps.length;j++)this.add(ps[j]);this.completed[id]=this.coverage[id]===r.area?1:0;this.recordStep(start);return this.active.pixels.length>start;}
    stamp(x,y,radius,id,color){
      const m=this.model,r=m.regions[id];if(!r||r.color!==color||this.completed[id])return false;
      if(!this.active)this.begin();this.active.activityNotified=false;const start=this.active.pixels.length;let changed=false;
      for(let yy=Math.max(0,Math.floor(y-radius));yy<=Math.min(m.height-1,Math.ceil(y+radius));yy++)for(let xx=Math.max(0,Math.floor(x-radius));xx<=Math.min(m.width-1,Math.ceil(x+radius));xx++) {
        if((xx+.5-x)**2+(yy+.5-y)**2>radius*radius)continue;const p=yy*m.width+xx;if(m.ids[p]===id)changed=this.add(p)||changed;
      }this.recordStep(start);return changed;
    }
    finish(){if(!this.active)return false;this.active.regions.forEach(id=>{if(this.coverage[id]/this.model.regions[id].area>=.93)this.fill(id,this.model.regions[id].color);});const tx=this.active;this.active=null;this.recount();if(tx.pixels.length){this.recordEvents(tx.steps);this.history.push(tx);if(this.history.length>35)this.history.shift();return true;}return false;}
    rollback(){if(!this.active)return;this.reverse(this.active);this.active=null;}
    reverse(tx){tx.pixels.forEach(p=>{this.mask[p]=0;this.coverage[this.model.ids[p]]--;this.painted--;});this.recount();}
    undo(){if(this.active)this.rollback();const tx=this.history.pop();if(!tx)return false;this.reverse(tx);this.recordEvents([{value:0,runs:Painting.runs(tx.pixels)}]);return true;}
    hit(x,y){const m=this.model;if(x<0||y<0||x>=m.width||y>=m.height)return -1;return m.ids[Math.floor(y)*m.width+Math.floor(x)];}
  }
  function raster(painting,kind,selected){
    const m=painting.model,c=canvas(m.width,m.height),ctx=c.getContext('2d'),im=ctx.createImageData(m.width,m.height),d=im.data;
    for(let p=0;p<m.ids.length;p++) {
      const region=m.regions[m.ids[p]],q=p*4,filled=kind==='color'||(kind!=='numbers'&&painting.mask[p]);
      const rgb=filled?m.palette[region.color].rgb:(kind==='paint'&&selected===region.color?[216,217,215]:[255,254,252]);
      d[q]=rgb[0];d[q+1]=rgb[1];d[q+2]=rgb[2];d[q+3]=255;
    }ctx.putImageData(im,0,0);return c;
  }
  // Cache only the selected, unpainted pixels. The presentation never enters saved masks or exports.
  function pendingPath(painting,selected){
    const m=painting.model,path=new Path2D();let any=false;
    for(let y=0;y<m.height;y++){
      let start=-1;
      for(let x=0;x<=m.width;x++){
        const p=y*m.width+x,pending=x<m.width&&!painting.mask[p]&&m.regions[m.ids[p]].color===selected;
        if(pending&&start<0)start=x;
        if(!pending&&start>=0){path.rect(start,y,x-start,1);start=-1;any=true;}
      }
    }
    return any?path:null;
  }
  function shadowPattern(ctx){
    const tile=canvas(10,10),t=tile.getContext('2d'),im=t.createImageData(10,10);
    for(let y=0;y<10;y++)for(let x=0;x<10;x++)if((x+y)%10<2){const q=(y*10+x)*4;im.data[q]=174;im.data[q+1]=178;im.data[q+2]=175;im.data[q+3]=255;}
    t.putImageData(im,0,0);return ctx.createPattern(tile,'repeat');
  }
  function boundaryPath(m){
    const path=new Path2D(),w=m.width,h=m.height,ids=m.ids;
    // Consecutive grid edges are coalesced; displayed boundaries use the same ID map as hit testing.
    for(let y=0;y<h-1;y++){let start=-1;for(let x=0;x<=w;x++){const edge=x<w&&ids[y*w+x]!==ids[(y+1)*w+x];if(edge&&start<0)start=x;if(!edge&&start>=0){path.moveTo(start,y+1);path.lineTo(x,y+1);start=-1;}}}
    for(let x=0;x<w-1;x++){let start=-1;for(let y=0;y<=h;y++){const edge=y<h&&ids[y*w+x]!==ids[y*w+x+1];if(edge&&start<0)start=y;if(!edge&&start>=0){path.moveTo(x+1,start);path.lineTo(x+1,y);start=-1;}}}
    return path;
  }
  function drawNumbers(ctx,painting,effectiveScale,all,selected){
    const m=painting.model;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    m.regions.forEach(r=>{
      if(!all&&painting.completed[r.id])return;
      const text=String(r.color+1),font=Math.min(12/effectiveScale,r.radius*1.3/(text.length>2?2.2:text.length===2?1.45:1));
      if(font*effectiveScale<8)return;
      ctx.font='600 '+font+'px Arial, sans-serif';ctx.lineWidth=2.3/effectiveScale;ctx.strokeStyle='rgba(255,254,252,.94)';ctx.strokeText(text,r.x,r.y);ctx.fillStyle=r.color===selected?'#4a4f4c':'#4a342e';ctx.fillText(text,r.x,r.y);
    });
  }
  class Board {
    constructor(el,painting,options){
      this.el=el;this.painting=painting;this.options=options||{};this.canvas=canvas(1,1);this.canvas.setAttribute('aria-label','数字油画填色画布，单指填色，双指缩放移动');this.el.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');
      this.path=boundaryPath(painting.model);this.mode='tap';this.selected=0;this.zoom=1;this.pan={x:0,y:0};this.pointers=new Map();this.preview=false;this.hintId=-1;this.brushSize=20;this.kind=this.options.kind||'paint';this.dirty=true;this.destroyed=false;this.multi=false;this.strokeId=-1;this.moved=false;this.lastTap=null;this.frame=0;
      this.highlightPath=null;this.highlightPattern=shadowPattern(this.ctx);
      this.listeners=[];this.listen=this.listen.bind(this);this.bind();this.resize();
      this.resizeHandler=()=>this.resize();this.listen(window,'resize',this.resizeHandler);
      if(window.visualViewport)this.listen(window.visualViewport,'resize',this.resizeHandler);
      // A colour tray, browser toolbar or font can resize the canvas without a window resize.
      if(typeof window.ResizeObserver==='function'){this.observer=new window.ResizeObserver(()=>this.resize());this.observer.observe(this.canvas);}
      else this.sizePoll=window.setInterval(()=>{if(!document.hidden&&this.measure()){if(this.pointers.size)this.cancelGesture();this.render();}},200);
      this.requestRender();
    }
    listen(el,name,fn,options){el.addEventListener(name,fn,options);this.listeners.push([el,name,fn,options]);}
    measure(){
      if(this.destroyed)return false;
      const w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(window.devicePixelRatio||1,2);
      if(!w||!h)return false;if(w===this.w&&h===this.h&&dpr===this.dpr)return false;
      this.w=w;this.h=h;this.dpr=dpr;this.canvas.width=Math.max(1,Math.round(w*dpr));this.canvas.height=Math.max(1,Math.round(h*dpr));this.fit=Math.min(w/this.painting.model.width,h/this.painting.model.height);this.limit();return true;
    }
    resize(){if(this.destroyed)return;const changed=this.measure();if(changed&&this.pointers.size)this.cancelGesture();this.render();}
    requestRender(){if(!this.frame&&!this.destroyed)this.frame=window.requestAnimationFrame(()=>{this.frame=0;this.render();});}
    world(p){const m=this.painting.model,s=this.fit*this.zoom;return{x:(p.x-this.w/2-this.pan.x)/s+m.width/2,y:(p.y-this.h/2-this.pan.y)/s+m.height/2};}
    local(e){
      if(this.measure()){if(this.pointers.size)this.cancelGesture();this.render();}
      const r=this.canvas.getBoundingClientRect();
      // DOM client coordinates are visual pixels; painting uses the canvas's CSS layout pixels.
      // Normalising each axis also handles scaled containers, borders and Safari viewport changes.
      return{x:(e.clientX-r.left)*this.w/(r.width||1),y:(e.clientY-r.top)*this.h/(r.height||1)};
    }
    zoomAt(factor,p){this.lastTap=null;this.measure();const a=this.world(p);this.zoom=clamp(this.zoom*factor,1,8);const m=this.painting.model,s=this.fit*this.zoom;this.pan={x:p.x-this.w/2-(a.x-m.width/2)*s,y:p.y-this.h/2-(a.y-m.height/2)*s};this.limit();this.render();}
    limit(){const m=this.painting.model,s=this.fit*this.zoom;this.pan.x=clamp(this.pan.x,-Math.max(0,(m.width*s-this.w)/2),Math.max(0,(m.width*s-this.w)/2));this.pan.y=clamp(this.pan.y,-Math.max(0,(m.height*s-this.h)/2),Math.max(0,(m.height*s-this.h)/2));}
    reset(){this.lastTap=null;this.zoom=1;this.pan={x:0,y:0};this.render();}
    setColor(id){if(!this.painting.model.palette[id])return;this.lastTap=null;this.selected=id;this.hintId=-1;this.dirty=true;this.render();}
    setMode(mode){if(['tap','brush','move'].indexOf(mode)<0)return;this.cancelGesture();this.mode=mode;this.render();}
    changed(committed=!this.painting.active){this.dirty=true;this.requestRender();if(this.options.onChange)this.options.onChange(committed);}
    render(){
      if(this.destroyed)return;this.measure();if(!this.w||!this.h)return;const ctx=this.ctx,m=this.painting.model,s=this.fit*this.zoom;
      this.el.classList.toggle('can-pan',this.mode==='move'||(this.mode==='tap'&&this.zoom>1.01));
      if(this.dirty){this.image=raster(this.painting,this.kind,this.selected);this.highlightPath=this.kind==='paint'?pendingPath(this.painting,this.selected):null;this.dirty=false;}
      ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.fillStyle='#f0ece5';ctx.fillRect(0,0,this.w,this.h);
      ctx.translate(this.w/2+this.pan.x,this.h/2+this.pan.y);ctx.scale(s,s);ctx.translate(-m.width/2,-m.height/2);
      if(this.preview){if(!this.reference)this.reference=raster(this.painting,'color');ctx.drawImage(this.reference,0,0);}
      else{ctx.imageSmoothingEnabled=true;ctx.drawImage(this.image,0,0);if(this.kind!=='color'){
        ctx.lineWidth=.65;ctx.strokeStyle='rgba(107,92,82,.54)';ctx.stroke(this.path);
        if(this.highlightPath){
          ctx.save();ctx.clip(this.highlightPath);
          // Keep fine diagonal spacing in screen pixels while the artwork zooms and pans.
          if(this.highlightPattern){ctx.save();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle=this.highlightPattern;ctx.fillRect(0,0,this.w,this.h);ctx.restore();}
          ctx.lineWidth=.9/s;ctx.strokeStyle='#6c716d';ctx.stroke(this.path);ctx.restore();
        }
        drawNumbers(ctx,this.painting,s,this.kind==='numbers',this.selected);
      }}
      if(this.hintId>=0&&!this.preview){const r=m.regions[this.hintId];ctx.beginPath();ctx.arc(r.x,r.y,Math.max(r.radius,15/s),0,Math.PI*2);ctx.strokeStyle='#df737a';ctx.lineWidth=2/s;ctx.stroke();}
      if(this.options.onView)this.options.onView(this.zoom);
    }
    start(id,p){
      if(this.kind!=='paint'||this.preview)return;
      this.pointers.set(id,p);
      if(this.pointers.size===1){this.multi=false;this.moved=false;this.panning=false;this.down=p;this.last=p;this.strokeId=-1;
        if(this.mode==='brush'){const a=this.world(p),region=this.painting.hit(a.x,a.y);if(region>=0&&this.painting.model.regions[region].color===this.selected){this.strokeId=region;this.painting.begin();this.painting.stamp(a.x,a.y,this.brushSize/(this.fit*this.zoom),region,this.selected);this.changed();}}
      }else{
        // Roll back the entire tentative one-finger stroke when a second finger joins.
        this.multi=true;this.lastTap=null;this.strokeId=-1;this.painting.rollback();this.changed(false);this.gesture=this.gestureState();
      }
    }
    gestureState(){const ps=Array.from(this.pointers.values());if(ps.length<2)return null;return{mid:{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2},distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y))};}
    move(id,p){
      if(!this.pointers.has(id))return;this.pointers.set(id,p);
      if(this.pointers.size>=2){const next=this.gestureState(),prev=this.gesture;if(prev){const anchor=this.world(prev.mid),m=this.painting.model;this.zoom=clamp(this.zoom*next.distance/prev.distance,1,8);const s=this.fit*this.zoom;this.pan={x:next.mid.x-this.w/2-(anchor.x-m.width/2)*s,y:next.mid.y-this.h/2-(anchor.y-m.height/2)*s};this.limit();this.requestRender();}this.gesture=next;return;}
      if(this.multi)return;
      const travelled=Math.hypot(p.x-this.down.x,p.y-this.down.y);if(travelled>=8)this.moved=true;
      if(this.mode==='move'||(this.mode==='tap'&&this.moved&&this.zoom>1.01)){
        const from=this.panning?this.last:this.down;this.panning=true;this.lastTap=null;this.el.classList.add('is-panning');this.pan.x+=p.x-from.x;this.pan.y+=p.y-from.y;this.limit();this.requestRender();
      }
      if(this.mode==='brush'&&this.strokeId>=0){const a=this.world(this.last),b=this.world(p),radius=this.brushSize/(this.fit*this.zoom),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(radius*.4)));for(let j=1;j<=steps;j++)this.painting.stamp(a.x+(b.x-a.x)*j/steps,a.y+(b.y-a.y)*j/steps,radius,this.strokeId,this.selected);this.changed();}
      this.last=p;
    }
    end(id,p,cancel){
      if(!this.pointers.has(id))return;
      if(cancel){this.lastTap=null;this.painting.rollback();this.changed(false);this.multi=true;}
      else if(!this.multi&&this.pointers.size===1){
        if(this.mode==='tap'&&!this.moved&&Math.hypot(p.x-this.down.x,p.y-this.down.y)<8)this.tap(p);
        if(this.mode==='brush')this.changed(this.painting.finish());
      }
      this.pointers.delete(id);if(!this.pointers.size){this.gesture=null;this.multi=false;this.strokeId=-1;this.panning=false;this.el.classList.remove('is-panning');if(this.dragMode){this.mode=this.dragMode;this.dragMode=null;}}
    }
    tap(p){
      const a=this.world(p),hit=this.painting.hit(a.x,a.y),previous=this.lastTap,now=Date.now();
      // Double-tap zoom is handled by the app; undo only its own first tap, never another stroke.
      if(previous&&now-previous.time<300&&Math.hypot(p.x-previous.point.x,p.y-previous.point.y)<24&&previous.region===hit){
        this.lastTap=null;
        if(previous.transaction&&this.painting.history[this.painting.history.length-1]===previous.transaction){this.painting.undo();this.changed();}
        this.zoomAt((this.zoom<1.5?2.5:1)/this.zoom,p);return;
      }
      let transaction=null;
      if(hit>=0){const r=this.painting.model.regions[hit];if(r.color!==this.selected){if(this.options.onWrong)this.options.onWrong(r.color+1);}
        else if(!this.painting.completed[hit]){this.painting.begin();this.painting.fill(hit,this.selected);if(this.painting.finish())transaction=this.painting.history[this.painting.history.length-1];this.changed(!!transaction);}}
      this.lastTap={time:now,point:p,region:hit,transaction};
    }
    cancelGesture(){const active=!!this.painting.active;this.painting.rollback();this.pointers.clear();this.gesture=null;this.multi=false;this.moved=false;this.strokeId=-1;this.lastTap=null;this.panning=false;this.el.classList.remove('is-panning');if(this.dragMode){this.mode=this.dragMode;this.dragMode=null;}if(active)this.changed(false);}
    bind(){
      if(this.kind!=='paint')return;
      if(window.PointerEvent){
        this.listen(this.el,'pointerdown',e=>{if(e.button===2&&e.pointerType==='mouse')return;e.preventDefault();if(e.pointerType==='mouse'&&(e.shiftKey||e.button===1)){this.dragMode=this.mode;this.mode='move';}try{this.el.setPointerCapture(e.pointerId);}catch(err){}this.start(e.pointerId,this.local(e));});
        this.listen(this.el,'pointermove',e=>{if(this.pointers.has(e.pointerId)){e.preventDefault();this.move(e.pointerId,this.local(e));}});
        this.listen(this.el,'pointerup',e=>this.end(e.pointerId,this.local(e),false));
        this.listen(this.el,'pointercancel',e=>this.end(e.pointerId,this.local(e),true));
        this.listen(this.el,'lostpointercapture',e=>this.end(e.pointerId,this.local(e),true));
      }else{
        this.listen(this.el,'touchstart',e=>{e.preventDefault();Array.from(e.changedTouches).forEach(t=>this.start(t.identifier,this.local(t)));},{passive:false});
        this.listen(this.el,'touchmove',e=>{e.preventDefault();const touches=Array.from(e.changedTouches);if(this.pointers.size>=2){touches.forEach(t=>{if(this.pointers.has(t.identifier))this.pointers.set(t.identifier,this.local(t));});if(touches.length)this.move(touches[0].identifier,this.local(touches[0]));}else touches.forEach(t=>this.move(t.identifier,this.local(t)));},{passive:false});
        this.listen(this.el,'touchend',e=>{e.preventDefault();Array.from(e.changedTouches).forEach(t=>this.end(t.identifier,this.local(t),false));},{passive:false});
        this.listen(this.el,'touchcancel',e=>{Array.from(e.changedTouches).forEach(t=>this.end(t.identifier,this.local(t),true));},{passive:false});
      }
      this.listen(this.el,'wheel',e=>{e.preventDefault();this.zoomAt(e.deltaY<0?1.15:1/1.15,this.local(e));},{passive:false});
      this.listen(this.el,'dblclick',e=>e.preventDefault());
      this.listen(window,'blur',()=>this.cancelGesture());
    }
    hint(){
      const rs=this.painting.model.regions;let r=rs.find(r=>r.color===this.selected&&!this.painting.completed[r.id]);
      if(!r)r=rs.find(r=>!this.painting.completed[r.id]);if(!r)return false;
      this.lastTap=null;this.selected=r.color;this.hintId=r.id;const m=this.painting.model;
      this.zoom=clamp(24/Math.max(1,r.radius*this.fit),1.5,8);const s=this.fit*this.zoom;
      this.pan={x:(m.width/2-r.x)*s,y:(m.height/2-r.y)*s};this.limit();this.dirty=true;this.render();return r;
    }
    destroy(){this.cancelGesture();this.destroyed=true;if(this.frame)window.cancelAnimationFrame(this.frame);if(this.sizePoll)window.clearInterval(this.sizePoll);if(this.observer)this.observer.disconnect();this.listeners.forEach(l=>l[0].removeEventListener(l[1],l[2],l[3]));this.el.innerHTML='';}
  }
  function exportCanvas(painting,kind,scale){const m=painting.model,c=canvas(m.width*(scale||3),m.height*(scale||3)),ctx=c.getContext('2d');ctx.scale(scale||3,scale||3);ctx.drawImage(raster(painting,kind),0,0);if(kind==='numbers'||(kind==='paint'&&painting.progress()<1)){ctx.lineWidth=.6;ctx.strokeStyle='#b2aaa2';ctx.stroke(boundaryPath(m));drawNumbers(ctx,painting,scale||3,kind==='numbers');}return c;}
  root.OilPaint={Painting,Board,raster,exportCanvas};
})(window);
