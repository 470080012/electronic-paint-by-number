(function(root){
  'use strict';
  // Add a mat around an already rendered canvas; never resize or recolor the artwork.
  function compose(art,frame,title){
    if(frame!=='cream'&&frame!=='wood')return art;
    const short=Math.min(art.width,art.height),border=frame==='wood'?Math.max(8,Math.round(short*.018)):0;
    const mat=Math.max(12,Math.round(short*(frame==='wood' ? .065 : .09))),pad=border+mat;
    const text=String(title||'').trim().slice(0,48),caption=frame==='cream'&&text?Math.round(short*.1):0;
    const canvas=document.createElement('canvas');canvas.width=art.width+pad*2;canvas.height=art.height+pad*2+caption;
    const ctx=canvas.getContext('2d');ctx.fillStyle=frame==='wood'?'#bf9167':'#fffdf7';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(border){
      ctx.strokeStyle='#a77b53';ctx.lineWidth=Math.max(2,border*.09);ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
      ctx.fillStyle='#dfc19e';ctx.fillRect(border-2,border-2,canvas.width-border*2+4,canvas.height-border*2+4);
      ctx.fillStyle='#fbf5e9';ctx.fillRect(border,border,canvas.width-border*2,canvas.height-border*2);
    }else{ctx.strokeStyle='#e7ddcf';ctx.lineWidth=Math.max(1,Math.round(short*.001));ctx.strokeRect(.5,.5,canvas.width-1,canvas.height-1);}
    ctx.imageSmoothingEnabled=false;ctx.drawImage(art,pad,pad);
    if(caption){
      let size=Math.max(20,Math.round(short*.06));
      const font=()=>size+'px "Songti SC", SimSun, serif';ctx.font=font();
      while(size>12&&ctx.measureText(text).width>art.width){size--;ctx.font=font();}
      ctx.fillStyle='#61362d';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,pad+art.height+caption*.58,art.width);
    }
    return canvas;
  }
  root.OilFrame={compose};
})(window);
