(function(root){
  'use strict';
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function format(ms){const seconds=Math.floor(ms/1000);return (seconds>=3600?Math.floor(seconds/3600)+'时':'')+Math.floor(seconds/60)%60+'分'+seconds%60+'秒';}
  // Independent presentation pixels: never uses or mutates the player's mask.
  class Renderer {
    constructor(painting){
      this.model=painting.model;const m=this.model;
      this.finalMask=painting.mask.slice();this.complete=painting.progress()===1;
      const trace=painting.replayData;this.events=trace&&trace.events||[];this.real=!!(trace&&(trace.scope==='full'||trace.scope==='recent'||this.events.length));
      this.description=this.real?(trace.scope==='full'?'玩家真实填色回放':trace.scope==='recent'?'最近操作回放（较早记录已压缩为起始画面）':'从继续绘画起的真实回放（早期操作未记录）'):'自动上色演示（无历史操作记录）';
      this.base=this.real?OilEngine.unrle(trace.base,Uint8Array,m.width*m.height):new Uint8Array(m.width*m.height);this.traceMask=this.base.slice();this.applied=0;

      this.order=m.regions.map(r=>({id:r.id,key:r.y/m.height+Math.sin(r.id*12.9898)*.045+r.x/m.width*.025})).sort((a,b)=>a.key-b.key).map(r=>r.id);
      this.rank=new Uint32Array(m.regions.length);this.order.forEach((id,i)=>{this.rank[id]=i;});
      this.surface=canvas(m.width,m.height);this.ctx=this.surface.getContext('2d');this.image=this.ctx.createImageData(m.width,m.height);
      this.lines=OilPaint.exportCanvas(new OilPaint.Painting(m),'numbers',1);
      this.color=OilPaint.raster(painting,'color');
    }
    draw(target,progress){
      const m=this.model,ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);
      if(progress>=1&&this.complete){ctx.drawImage(this.color,0,0,target.width,target.height);return;}
      ctx.drawImage(this.lines,0,0,target.width,target.height);if(progress<=0&&!this.real)return;
      const d=this.image.data,n=this.order.length,cursor=progress*(n+3);
      if(this.real){
        const position=Math.max(0,Math.min(1,progress))*this.events.length,count=Math.floor(position);
        if(count<this.applied){this.traceMask.set(this.base);this.applied=0;}
        while(this.applied<count){const e=this.events[this.applied++];for(let i=0;i<e.runs.length;i+=2)this.traceMask.fill(e.value,e.runs[i],e.runs[i]+e.runs[i+1]);}
        for(let p=0;p<m.ids.length;p++){const rgb=m.palette[m.regions[m.ids[p]].color].rgb,q=p*4;d[q]=rgb[0];d[q+1]=rgb[1];d[q+2]=rgb[2];d[q+3]=this.traceMask[p]*255;}
        const event=this.events[count],fade=position-count;if(event)for(let i=0;i<event.runs.length;i+=2)for(let p=event.runs[i],end=p+event.runs[i+1];p<end;p++)d[p*4+3]=Math.round((this.traceMask[p]+(event.value-this.traceMask[p])*fade)*255);
        this.ctx.putImageData(this.image,0,0);ctx.drawImage(this.surface,0,0,target.width,target.height);return;
      }
      for(let p=0;p<m.ids.length;p++){const id=m.ids[p],rgb=m.palette[m.regions[id].color].rgb,q=p*4,a=Math.max(0,Math.min(1,(cursor-this.rank[id])/3));d[q]=rgb[0];d[q+1]=rgb[1];d[q+2]=rgb[2];d[q+3]=this.finalMask[p]?Math.round((progress>=1?1:a)*255):0;}
      this.ctx.putImageData(this.image,0,0);ctx.drawImage(this.surface,0,0,target.width,target.height);
    }
    videoFrame(target,seconds,time){
      const ctx=target.getContext('2d'),m=this.model,p=Math.max(0,Math.min(1,(seconds-2)/13));
      this.draw(this.surfaceFrame||(this.surfaceFrame=canvas(m.width,m.height)),p);
      ctx.fillStyle='#F8F6F3';ctx.fillRect(0,0,720,1280);
      const scale=Math.min(656/m.width,960/m.height),w=m.width*scale,h=m.height*scale;
      ctx.drawImage(this.surfaceFrame,(720-w)/2,70+(960-h)/2,w,h);
      if(!this.real||this.description.indexOf('玩家真实')!==0){ctx.fillStyle='#987b70';ctx.textAlign='center';ctx.font='18px sans-serif';ctx.fillText(this.description,360,1060);}
      if(seconds>=15){ctx.fillStyle='#61362D';ctx.textAlign='center';ctx.font='26px sans-serif';ctx.fillText(time&&time.known?'这幅画，我花了'+format(time.ms)+'完成 ♡':'这幅画，终于完成啦 ♡',360,1110);ctx.font='22px sans-serif';ctx.fillText('电子数字油画',360,1162);}
    }
  }
  class Clock {
    constructor(work,now){this.work=work;this.now=now||(()=>performance.now());this.start=null;this.last=null;}
    activity(){if(document.hidden||this.work.paintTime&&this.work.paintTime.final)return;const t=this.now();this.flush(t);if(!this.work.paintTime)this.work.paintTime={known:this.knownStart!==false,ms:0,final:false};this.start=t;this.last=t;}
    flush(t){t=t===undefined?this.now():t;if(this.start!==null){this.work.paintTime.ms+=Math.max(0,Math.min(t,this.last+90000)-this.start);this.start=t;if(t>=this.last+90000)this.start=null;}}
    pause(){this.flush();this.start=null;this.last=null;}
    finish(){this.pause();if(this.work.paintTime)this.work.paintTime.final=true;}
  }
  function mp4Type(){if(!root.MediaRecorder||!MediaRecorder.isTypeSupported)return '';return ['video/mp4;codecs=avc1.42E01E','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';}
  function read(blob){return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(new Error('视频文件读取失败'));f.readAsArrayBuffer(blob);});}
  async function verifyMP4(blob){const bytes=new Uint8Array(await read(blob));if(blob.size<100||String.fromCharCode.apply(null,bytes.slice(4,8))!=='ftyp')throw new Error('编码器未输出有效 MP4，已停止发布');let h264=false;for(let i=4;i<bytes.length-4;i++)if(bytes[i]===97&&bytes[i+1]===118&&bytes[i+2]===99&&(bytes[i+3]===49||bytes[i+3]===51)){h264=true;break;}if(!h264)throw new Error('编码器未输出 H.264 视频，无法确认小红书兼容性，已停止发布');}
  function dataURL(blob){return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(new Error('视频转换失败'));f.readAsDataURL(blob);});}
  async function record(renderer,time,onProgress,signal){
    const type=mp4Type(),c=canvas(720,1280);if(!type||typeof c.captureStream!=='function')throw new Error('当前容器不支持原生 MP4 编码。可继续观看回放；发布视频需要支持 H.264/MP4 的客户端或平台提供原生视频合成 API。');
    const stream=c.captureStream(30);let recorder;
    try{recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4000000});}catch(e){stream.getTracks().forEach(t=>t.stop());throw new Error('无法启动 MP4 编码器：'+(e.message||''));}
    let raf=0,watch=0;const parts=[];
    try{return await new Promise((resolve,reject)=>{
      let failure=null,start=0;
      const stop=error=>{failure=error||failure;if(recorder.state!=='inactive')recorder.stop();};
      recorder.ondataavailable=e=>{if(e.data.size)parts.push(e.data);};recorder.onerror=e=>stop(new Error('视频编码失败：'+(e.error&&e.error.message||'编码器错误')));
      recorder.onstop=()=>{if(failure)reject(failure);else resolve(new Blob(parts,{type:'video/mp4'}));};
      renderer.videoFrame(c,0,time);recorder.start(1000);start=performance.now();
      watch=setInterval(()=>{if(signal.cancelled||document.hidden)stop(new Error(document.hidden?'已切换后台，视频生成中止，请回到前台重试':'已取消视频生成'));},100);
      function frame(now){if(recorder.state==='inactive')return;try{const seconds=Math.min(18,(now-start)/1000);renderer.videoFrame(c,seconds,time);onProgress(seconds/18);if(seconds>=18){stop();return;}raf=requestAnimationFrame(frame);}catch(error){stop(new Error('视频绘制失败：'+error.message));}}raf=requestAnimationFrame(frame);
    });}finally{cancelAnimationFrame(raf);clearInterval(watch);stream.getTracks().forEach(t=>t.stop());}
  }
  function noteTitle(time){return (time&&time.known?'耗时'+format(time.ms)+'，':'')+'我的电子油画完成啦';}
  async function publish(blob,cover,signal,time){const mini=root.xhs&&root.xhs.miniTool;if(!mini||typeof mini.postNote!=='function'||typeof mini.writeTempFile!=='function')throw new Error('请在支持视频笔记和临时文件接口的小红书客户端内发布');await verifyMP4(blob);
    const video=await mini.writeTempFile({data:await dataURL(blob)}),image=await mini.writeTempFile({data:cover});if(!video.filePath||!image.filePath)throw new Error('平台未返回有效的临时文件路径');
    if(signal&&signal.cancelled)throw new Error('已取消发布');
    return mini.postNote({title:noteTitle(time),content:'一点一点填满喜欢的颜色！\n这是我的数字油画上色过程～\n你也来试试吧 ♡',pageType:'video_publish',mediaInfo:{video_resources:{video_url:video.filePath,cover_url:image.filePath}}});
  }
  root.OilReplay={Renderer,Clock,format,noteTitle,record,publish,verifyMP4,mp4Type};
})(window);
