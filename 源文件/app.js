(function(){
  'use strict';
  const $=s=>document.querySelector(s),icon=OilIcon,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const page=$('#page'),nav=$('#navigation'),overlay=$('#overlay'),input=$('#photo-input');
  const easyInfo={title:OilEasy.title,key:OilEasy.key||'house-v1',colors:OilEasy.colors||6,regions:OilEasy.regions||12,category:OilEasy.category||'风景'};
  const quickArt={easy:OilEasy,fruit:OilFruit,bakery:OilBakery};
  OilGallery.forEach(art=>{quickArt[art.id]=art;});
  (window.OilGiftArt||[]).forEach(art=>{quickArt[art.id]=art;});
  const galleryOrder=['peach-soda','sunny-cat','strawberry-pancakes','lemon-fizz','blueberry-cake','cherry-bowl','hydrangea-window','strawberry-toast','lemon-courtyard','citrus-picnic','twilight-cafe','matcha-sundae','caramel-pudding'];
  const formerGifts=[{id:'gift-rose-bakery',category:'风景'},{id:'gift-sunny-market',category:'水果'},{id:'gift-summer-cooler',category:'甜品'},{id:'gift-moonlit-noodles',category:'美食'}];
  const gallery=formerGifts.map(g=>{const art=quickArt[g.id];return{id:art.id,title:art.title,category:g.category,difficulty:art.difficulty,quick:art.id,caption:art.caption};}).concat([
    {id:'bakery',title:OilBakery.title,category:'甜品',difficulty:4,quick:'bakery',caption:'精细填色'},
  ],galleryOrder.map(id=>{const art=quickArt[id];return{id:art.id,title:art.title,category:art.category,difficulty:art.difficulty,quick:art.id,caption:art.caption};}),[
    {id:'fruit',title:OilFruit.title,category:'水果',difficulty:1,quick:'fruit'},
    {id:'easy',title:easyInfo.title,category:easyInfo.category,difficulty:1,easy:true},
  ]);
  const featuredOrder=['peach-soda','gift-summer-cooler','lemon-fizz','strawberry-pancakes','cherry-bowl','strawberry-toast','gift-sunny-market','matcha-sundae','citrus-picnic','blueberry-cake','lemon-courtyard','bakery','gift-rose-bakery','hydrangea-window','gift-moonlit-noodles','caramel-pudding','twilight-cafe','sunny-cat','fruit','easy'];
  function featuredRank(id){const index=featuredOrder.indexOf(id);return index<0?featuredOrder.length:index;}
  gallery.sort((a,b)=>featuredRank(a.id)-featuredRank(b.id));
  let view='home',category='精选',search='',albumTab='ongoing',originalImage=null,originalData='',cropData='',photoName='猫咪的午后',sample=true;
  let style='oil',colors=96,detail='fine',crop={ratio:'original',rotation:0,zoom:1,x:0,y:0},cropOpen=false;
  let board=null,painting=null,work=null,previews=null,previewTab='color',generation=0,busy=false,saveQueue=null,toastTimer=0,album=[],deleteId='',exportData='',testMode=/[?&]test=1/.test(location.search)||location.hash==='#test';
  let sourceBeforeGallery=null,hasChanged=false,paintRevision=0,palettePage=0,savedPainting=null;
  let paintClock=null,replayFrame=0,videoSignal=null,completionTimer=0,replayReturn='paint',hintTimer=0;
  const palettePageSize=12;
  const followGuide='点小工具右上角「···」，在作者旁点「关注」。';
  const followPending='暂时无法验证新关注。';
  const refinementNames=['大色块','简洁','适中','精细','更多细节'];
  let refinementInput=null,refinementRequest=null,refinementSerial=0,refinementRunning=false,refinementBusy=false;
  let exportSettings=null,exportTitleTimer=0,shareFrame='cream',shareSession=null,modalKind='',modalSerial=0,generationCommitting=false,giftBusy=false;
  let rewardPending=false,rewardUnavailable=false;
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
  function action(name,label,ico,cls,extra){return '<button class="'+(cls||'')+'" data-action="'+name+'" '+(extra||'')+'>'+ (ico?icon(ico):'')+label+'</button>';}
  function header(title,back,end){return '<header class="topbar">'+(back?action('back','', 'back','round-button','aria-label="返回"'):'')+'<h1 class="center-title">'+esc(title)+'</h1>'+(end||'')+'</header>';}
  function headerGift(){return action('gift','关注礼','gift','header-gift','aria-label="查看关注礼"');}
  function rewardButton(position){
    if(rewardUnavailable||!OilSocial.canReward())return '';
    const label=position==='album'?'♡ 喜欢这个小工具？ <span>赞赏作者 ›</span>':'♡ 赞赏作者';
    return action('reward-author',label,null,'reward-'+position,'aria-label="赞赏作者"'+(rewardPending?' disabled':''));
  }
  async function openReward(){
    if(rewardPending||rewardUnavailable||!OilSocial.canReward())return;
    const buttons='[data-action="reward-author"]';
    rewardPending=true;
    document.querySelectorAll(buttons).forEach(button=>{button.disabled=true;});
    const notice=setTimeout(()=>toast('赞赏响应较慢，请稍候'),8000);
    try{await OilSocial.openReward();}
    catch(error){
      const message=String(error&&(error.errMsg||error.message)||'');
      if((error&&error.code==='UNSUPPORTED')||/not supported|不支持/i.test(message)){
        rewardUnavailable=true;
        document.querySelectorAll(buttons).forEach(button=>button.remove());
        toast('当前环境暂不支持赞赏');
      }else if(!/cancel|取消/i.test(message))toast('暂时无法打开赞赏，请稍后再试');
    }finally{
      clearTimeout(notice);rewardPending=false;
      document.querySelectorAll(buttons).forEach(button=>{button.disabled=false;});
    }
  }
  function navigation(active){nav.style.display=view==='paint'?'none':'';nav.innerHTML=[['home','图库','gallery'],['maker','制作','palette'],['album','画册','book']].map(v=>action('nav',v[1],v[2],'nav-button '+(active===v[0]?'active':''),'data-view="'+v[0]+'" aria-label="'+v[1]+'"'+(active===v[0]?' aria-current="page"':''))).join('');}
  function dispose(){clearTimeout(hintTimer);paintClock=null;clearTimeout(completionTimer);if(board){board.destroy();board=null;}page.className='page';page.scrollTop=0;}
  async function go(next){if(next!=='preview')cancelPreviewRefinement();if(board){pauseDrawing();if(hasChanged)await saveCurrent(false);}dispose();view=next;
    if(next==='home')renderHome();else if(next==='maker')renderMaker();else if(next==='album'){try{album=await OilStore.list();renderAlbum();}catch(e){renderAlbum();toast('画册读取失败，请重试');}}
    else if(next==='paint')renderPaint();else if(next==='preview')renderPreview();else if(next==='debug')renderDebug();
  }
  function galleryItems(){
    if(!OilSocial.snapshot().giftClaimed||!giftReady())return gallery;
    return gallery.concat(OilGift.items.map(item=>{const art=quickArt[item.artId];return {id:art.id,title:art.title,category:'关注礼',difficulty:art.difficulty,quick:art.id,image:item.image,gift:true};}));
  }
  function galleryCategories(){return ['精选','甜品','动物','花卉','风景'].concat(OilSocial.snapshot().giftClaimed&&giftReady()?['关注礼']:[]);}
  function renderHome(){if(category==='关注礼'&&!OilSocial.snapshot().giftClaimed)category='精选';navigation('home');
    page.innerHTML='<header class="topbar"><h1 class="brand">'+icon('palette')+'数字油画工作室</h1>'+action('search','','search','round-button end','aria-label="搜索图库"')+'</header><div class="page-content"><h2 class="section-title">'+icon('gallery')+'发现图库'+action('gift','关注礼','gift','gift-entry','aria-label="查看关注礼"')+'</h2><div class="creation-quota gallery-quota"><span id="home-quota" aria-live="polite"></span><span class="quota-refresh-note">每日额度零点刷新 · 分享赠送次数用完为止</span>'+action('quota','次数说明',null,'quota-link')+'</div><div id="search-wrap"></div><div class="tabs gallery-tabs" role="tablist">'+galleryCategories().map(c=>action('category',c,null,c===category?'active':'','data-category="'+c+'" role="tab" aria-selected="'+(c===category)+'"')).join('')+'</div><div class="gallery" id="gallery"></div><p class="gallery-note">挑一幅喜欢的，慢慢涂出好心情</p></div>';
    drawGallery();updateSocialUI();
  }
  function drawGallery(){const filtered=galleryItems().filter(g=>(category==='精选'||g.category===category)&&(!search||g.title.indexOf(search)>=0)),cols=[[],[]];filtered.forEach((g,i)=>{const stars=Math.max(1,Math.min(5,g.difficulty||1)),art=g.quick?quickArt[g.quick]:easyInfo;cols[i%2].push('<button class="art-card" data-action="art" data-id="'+g.id+'"><img src="'+esc(g.image||'./resources/'+g.id+'.webp')+'" alt="'+g.title+'" draggable="false"><h3>'+g.title+'</h3>'+(g.gift?'<span class="gallery-gift-label">关注礼</span>':'')+'<p class="difficulty" aria-label="难度 '+stars+' 星，最高 5 星">难度 <b aria-hidden="true">'+'★'.repeat(stars)+'</b><span aria-hidden="true">'+'☆'.repeat(5-stars)+'</span></p><p class="art-meta">'+art.colors+' 色 · '+art.regions+' 块</p></button>');});$('#gallery').innerHTML=cols.map(c=>'<div class="gallery-column">'+c.join('')+'</div>').join('')||'<p>暂时没有找到，试试其他名字吧</p>';}
  function selectedPill(label,key,value,selected){return action('option',label,null,'pill '+(value===selected?'selected':''),'data-key="'+key+'" data-value="'+value+'" aria-pressed="'+(value===selected)+'"');}
  function renderMaker(){
    const previous=page.classList.contains('maker-page')?$('#maker-scroll'):null,scrollTop=previous?previous.scrollTop:0,hasPhoto=!!cropData,showCrop=hasPhoto&&cropOpen;
    navigation('maker');page.classList.add('maker-page');
    const photo=hasPhoto?'<div class="upload-box has-photo"><div class="photo-preview"><img id="uploaded-preview" src="'+cropData+'" alt="待转换的照片">'+action('remove-photo','×',null,'remove','aria-label="移除照片"')+'</div><div class="selected-photo-info"><h2>'+(sample?'示例照片':'已选照片')+'</h2><p class="selected-photo-name">'+esc(photoName)+'</p><p class="soft-copy">'+(sample?'可直接体验，也可以换成自己的照片':'调整下方选项，或直接开始生成')+'</p>'+action('upload','更换照片','upload','secondary replace-photo')+'</div></div>':'<div class="upload-box">'+icon('camera','large')+'<h2>上传一张照片</h2><p class="soft-copy">宠物、人物、风景都可以</p><div class="photo-preview empty-photo">'+icon('gallery','large')+'</div>'+action('upload','上传照片','upload','primary')+action('sample','试试内置猫咪照片',null,'sample-link')+'</div>';
    page.innerHTML=header('照片变油画',true,headerGift())+'<div id="maker-scroll" class="page-content maker-scroll">'+photo+
      '<h2 class="control-heading">'+icon('palette')+'选择绘画风格</h2><div class="style-choices">'+[['cute','柔和插画','style-cute-preview.webp','浅暖配色 · 简洁色块'],['oil','经典油画','style-oil-preview.webp','保留原色 · 更多层次']].map(s=>'<button class="style-choice '+(style===s[0]?'selected':'')+'" data-action="option" data-key="style" data-value="'+s[0]+'" aria-pressed="'+(style===s[0])+'"><img src="./resources/'+s[2]+'" alt="'+s[1]+'实际转换效果"><span>'+s[1]+'</span><small class="style-description">'+s[3]+'</small>'+(style===s[0]?'<span class="choice-dot">✓</span>':'')+'</button>').join('')+'</div>'+
      '<div class="option-row color-limit-row"><span class="option-label">'+icon('palette')+'颜色上限</span><div class="options">'+[12,24,36,64,96,128].map(v=>selectedPill(v+'色','colors',v,colors)).join('')+'</div></div><div class="option-row"><span class="option-label">'+icon('star')+'难度</span><div class="options">'+[['simple','简单'],['standard','标准'],['fine','精细']].map(v=>selectedPill(v[1],'detail',v[0],detail)).join('')+'</div></div>'+
      action('crop-toggle',showCrop?'收起裁剪':'裁剪与旋转','crop','crop-toggle','aria-controls="crop-controls" aria-expanded="'+showCrop+'"'+(!hasPhoto?' disabled':''))+'<div id="crop-controls">'+(showCrop?cropControls():'')+'</div><p class="maker-footer">上方为同一示例的实际转换效果，照片会转为数字填色色块</p>'+
      '<section class="maker-examples" aria-label="内置作品试玩"><h2>也可以直接试玩</h2><div id="maker-examples"></div></section>'+action('test-mode',testMode?'退出四图测试模式':'四图测试入口',null,'plain-button')+'</div>'+
      '<div class="maker-actions" aria-label="生成照片油画"><div class="creation-quota"><span id="creation-remaining" aria-live="polite"></span><span class="quota-refresh-note">每日额度零点刷新 · 分享赠送次数用完为止</span>'+action('quota','次数说明',null,'quota-link')+'</div><p class="quota-charge-note">成功生成扣 1 次，继续填色不再扣次</p>'+action('generate',testMode?'生成并查看四图':'生成数字油画','brush','primary wide',!hasPhoto?'disabled':'')+'<p class="maker-footer">照片仅在本地处理 · 不上传</p></div>';
    const fruit=document.createElement('div');fruit.className='easy-entry fruit-entry';fruit.innerHTML='<img src="./resources/fruit.webp" alt="盘中三桃实际分色效果"><div><h2>'+esc(OilFruit.title)+'</h2><p>馆藏原作 · '+OilFruit.colors+' 色 · '+OilFruit.regions+' 格</p>'+action('fruit-source','查看原画',null,'sample-link')+'</div>'+action('quick-art','直接试玩',null,'secondary','data-id="fruit"');$('#maker-examples').appendChild(fruit);
    const easy=document.createElement('div');easy.className='easy-entry';easy.innerHTML='<img src="./resources/easy.webp" alt="'+esc(easyInfo.title)+'简单填色图"><div><h2>'+esc(easyInfo.title)+'</h2><p>'+easyInfo.colors+' 种颜色，'+easyInfo.regions+' 个区域</p></div>'+action('easy','直接试玩',null,'secondary');$('#maker-examples').appendChild(easy);
    $('#maker-scroll').scrollTop=scrollTop;updateSocialUI();
  }
  function cropControls(){return '<div class="crop-panel"><div class="options">'+[['original','原图'],['3:4','3:4'],['1:1','1:1']].map(v=>selectedPill(v[1],'ratio',v[0],crop.ratio)).join('')+'</div><label class="crop-label">放大裁剪<input data-crop="zoom" type="range" min="1" max="3" step=".05" value="'+crop.zoom+'"></label><label class="crop-label">左右位置<input data-crop="x" type="range" min="-100" max="100" value="'+crop.x+'"></label><label class="crop-label">上下位置<input data-crop="y" type="range" min="-100" max="100" value="'+crop.y+'"></label><div class="crop-actions">'+action('rotate','旋转 90°','rotate')+action('reset-crop','重置','undo')+'</div></div>';}
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('无法读取这张图片，请选择 JPG、PNG 或 WebP'));img.src=src;});}
  function drawCrop(){
    if(!originalImage){cropData='';return;}
    const rotated=document.createElement('canvas'),odd=(crop.rotation/90)%2;
    rotated.width=odd?originalImage.height:originalImage.width;rotated.height=odd?originalImage.width:originalImage.height;
    const rc=rotated.getContext('2d');rc.fillStyle='#fffdf8';rc.fillRect(0,0,rotated.width,rotated.height);rc.translate(rotated.width/2,rotated.height/2);rc.rotate(crop.rotation*Math.PI/180);rc.drawImage(originalImage,-originalImage.width/2,-originalImage.height/2);
    const aspect=crop.ratio==='original'?rotated.width/rotated.height:(crop.ratio==='1:1'?1:.75);
    let sw=rotated.width,sh=sw/aspect;if(sh>rotated.height){sh=rotated.height;sw=sh*aspect;}sw/=crop.zoom;sh/=crop.zoom;
    const sx=(rotated.width-sw)*(crop.x+100)/200,sy=(rotated.height-sh)*(crop.y+100)/200,c=document.createElement('canvas');
    const size=900;c.width=Math.max(32,Math.round(aspect>=1?size:size*aspect));c.height=Math.max(32,Math.round(aspect>=1?size/aspect:size));
    c.getContext('2d').drawImage(rotated,sx,sy,sw,sh,0,0,c.width,c.height);cropData=c.toDataURL('image/jpeg',.9);if($('#uploaded-preview'))$('#uploaded-preview').src=cropData;
  }
  async function setPhoto(src,name,isSample){const img=await loadImage(src);if(img.width<32||img.height<32)throw new Error('图片太小，请选择至少 32 × 32 的照片');if(img.width*img.height>64000000)throw new Error('图片太大，请先缩小到 6400 万像素以内');
    const c=document.createElement('canvas'),factor=Math.min(1,1400/Math.max(img.width,img.height));c.width=Math.round(img.width*factor);c.height=Math.round(img.height*factor);const cx=c.getContext('2d');cx.fillStyle='#fffdf8';cx.fillRect(0,0,c.width,c.height);cx.drawImage(img,0,0,c.width,c.height);
    originalData=c.toDataURL('image/jpeg',.91);originalImage=await loadImage(originalData);photoName=name;sample=!!isSample;crop={ratio:'original',rotation:0,zoom:1,x:0,y:0};drawCrop();
  }
  async function upload(file){if(!file)return;if(file.size>40*1024*1024){toast('请使用 40 MB 以内的照片');return;}if(!/\.(jpe?g|png|webp)$/i.test(file.name)&&!/^image\/(jpeg|png|webp)$/.test(file.type)){toast('请选择 JPG、PNG 或 WebP 照片');return;}
    const url=URL.createObjectURL(file);sourceBeforeGallery=null;try{await setPhoto(url,file.name.replace(/\.[^.]+$/,''),false);await go('maker');}catch(e){toast(e.message);}finally{URL.revokeObjectURL(url);input.value='';}}
  function showModal(html,closable,label){if(paintClock)paintClock.pause();modalSerial++;modalKind='';overlay.hidden=false;const content='<div class="modal"'+(closable?'':' role="dialog" aria-modal="true"')+'>'+html+'</div>';overlay.innerHTML=closable?'<div class="export-modal-shell" role="dialog" aria-modal="true" aria-label="'+esc(label||'导出图片')+'">'+action('close-modal','×',null,'modal-close','type="button" aria-label="'+(label?'关闭预览':'关闭导出弹窗')+'"')+content+'</div>':content;}
  function closeModal(){cancelAnimationFrame(replayFrame);replayFrame=0;if(videoSignal)videoSignal.cancelled=true;videoSignal=null;clearTimeout(exportTitleTimer);modalSerial++;modalKind='';shareSession=null;exportSettings=null;exportData='';overlay.classList.remove('has-framed-export','has-social-modal','has-gift-modal','has-quota-modal');overlay.hidden=true;overlay.innerHTML='';}
  function updateSocialUI(){
    updateReplayEntry();
    const state=OilSocial.snapshot(),summary='还可以画 '+state.remaining+' 幅';
    ['creation-remaining','home-quota'].forEach(id=>{const el=$('#'+id);if(el)el.textContent=summary;});
    if(modalKind==='gift'&&$('#gift-content'))$('#gift-content').innerHTML=giftContent();
    if($('#quota-remaining'))$('#quota-remaining').textContent=summary;

  }
  function compactModal(html,kind,title){closeModal();showModal(html,true,title);modalKind=kind;overlay.classList.add('has-social-modal');if(kind!=='share')overlay.classList.add('has-'+kind+'-modal');$('.modal-close').setAttribute('aria-label','关闭'+title);$('.modal-close').focus();}
  function replayUnlocked(){return OilSocial.snapshot().followed;}
  function updateReplayEntry(){const button=$('#replay-entry');if(!button)return;const ready=replayUnlocked();button.classList.toggle('is-locked',!ready);button.setAttribute('aria-label',ready?'观看上色回放':'查看回放的关注条件');button.innerHTML=ready?'▷ 看回放':'<span class="replay-lock">看回放</span><span class="replay-unlock-copy">需确认关注</span>';if(ready){const hint=$('#replay-hint');if(hint)hint.remove();}}
  async function maybeReplayHint(){const id=work&&work.id;try{if(replayUnlocked()||await OilStore.getPreference('replay-hint-seen'))return;if(view!=='paint'||!work||work.id!==id||replayUnlocked())return;const parent=$('.paint-progress');if(!parent)return;const hint=document.createElement('div');hint.id='replay-hint';hint.className='replay-hint';hint.textContent='确认关注后可看回放';parent.appendChild(hint);hintTimer=setTimeout(()=>hint.remove(),4500);await OilStore.setPreference('replay-hint-seen',true);}catch(e){} }
  async function requestReplay(target){
    if(!painting||refinementBusy)return;
    if(target==='video'&&painting.progress()!==1){toast('画完这幅作品后才能发布上色视频');return;}
    if(target!=='video')replayReturn=modalKind==='share'?'share':modalKind==='completion'?'completion':'paint';
    if(!replayUnlocked()){toast(followGuide+followPending);return;}
    if(target==='video')return publishVideo();openReplay();
  }
  function openShare(tab){
    if(!painting||!work)return;if(board)board.cancelGesture();
    const progress=painting.progress(),complete=progress===1,kind=complete?'color':'paint',selected=complete&&tab!=='image'?'video':'image';
    const image=OilFrame.compose(OilPaint.exportCanvas(painting,kind,2),shareFrame,work.title).toDataURL('image/png');
    const preview=selected==='video'?OilPaint.exportCanvas(painting,'color',1).toDataURL('image/png'):image;
    const tabs='<div class="share-type-tabs" role="tablist" aria-label="选择晒画类型">'+action('share-tab','上色视频'+(!complete?'<small>画完后开启</small>':''),null,selected==='video'?'selected':'','data-tab="video" role="tab" aria-selected="'+(selected==='video')+'"'+(!complete?' disabled':''))+action('share-tab','晒图片',null,selected==='image'?'selected':'','data-tab="image" role="tab" aria-selected="'+(selected==='image')+'"')+'</div>';
    const video=selected==='video',controls=video?action('video-publish',replayUnlocked()?'生成并发布视频':'查看关注方式',null,'primary share-primary')+action('replay','先看回放',null,'plain-button share-secondary'):action('post-note','去小红书晒画','share','primary share-primary')+action('share-save','装框 / 保存图片',null,'plain-button share-secondary');
    compactModal('<div class="share-content share-redesigned"><h2>晒晒我的画</h2>'+tabs+'<div class="share-preview"><img src="'+preview+'" alt="'+esc(work.title)+(video?'完整作品视频封面':'实际填色进度')+'">'+(video?action('replay','▷',null,'share-preview-play','aria-label="预览上色回放"')+'<span class="share-duration">约 18 秒</span>':'')+'</div><div class="share-caption"><span>'+(video?(painting.replayData.scope==='full'?'真实填色过程':(painting.replayData.scope==='recent'||painting.replayData.events.length)?'已记录的真实填色过程':'自动上色演示（无历史操作记录）'):'当前填色进度')+'</span><span>'+Math.floor(progress*100)+'%</span></div>'+controls+'<p class="share-help">'+(video?'生成后进入小红书发布页，由你确认发布；提交确认后赠 1 次，可累计':complete?'晒画提交确认后赠 1 次，赠送次数用完为止 ♡':'晒当前进度也可获赠 1 次；画完后可分享视频 ♡')+'</p></div>','share','晒画弹窗');
    shareSession={image,work:Object.assign({},work),progress,kind,tab:selected};updateSocialUI();
  }
  function openQuota(exhausted){
    const guide=replayUnlocked()?'':'<p class="quota-simple-note">'+followGuide+followPending+'</p>';
    compactModal('<div class="quota-content"><h2 id="quota-title">'+(exhausted?'新画次数用完啦':'画画次数')+'</h2><p id="quota-remaining"></p><p class="quota-refresh-note">每日额度零点刷新 · 分享赠送次数用完为止</p><div class="quota-benefits"><p><span>每天免费</span><b>3 次</b></p><p><span>已确认关注</span><b>每天多 3 次</b></p><p><span>分享作品</span><b>分享送 1 次</b></p></div><p class="quota-simple-note">只计新画，画册旧画继续画不扣次。</p>'+guide+'<details class="quota-details"><summary>详细说明</summary><p>每日次数按北京时间零点刷新，优先使用。分享提交确认后赠送，不限每日领取次数，可累计；取消不送。</p><p>图库首次填色扣次；照片成功生成扣次，后续填色、同图调整不重复扣。失败、取消不扣，回放、装框、保存不扣。</p><p>次数和作品保存在当前设备，清理数据可能丢失，暂不支持跨设备同步。</p></details>'+action('quota-album',exhausted?'去画册继续画 / 晒画':'返回我的画册','book','primary')+'</div>','quota','次数说明');updateSocialUI();
  }
  function giftReady(){return OilGift.items.length>0&&OilGift.items.every(item=>item.artId&&quickArt[item.artId]&&/^\.\/resources\/[^<>]+\.(webp|png|jpe?g)$/i.test(item.image));}
  function giftContent(){
    const ready=giftReady(),state=OilSocial.snapshot(),claimed=ready&&state.giftClaimed;
    const cards=OilGift.items.map((item,i)=>{const art=quickArt[item.artId],stars=art?Math.max(1,Math.min(5,art.difficulty||1)):0;return '<button class="gift-card'+(ready?'':' pending')+'" data-action="gift-art" data-id="'+esc(item.artId)+'" '+(!claimed?'disabled':'')+' aria-label="'+esc(ready?item.title:'第 '+(i+1)+' 幅礼图待选')+'">'+(ready?'<img src="'+esc(item.image)+'" alt="'+esc(item.title)+'预览">':'<div class="gift-placeholder">'+icon('gallery')+'<span>'+(i+1)+'</span></div>')+'<span class="gift-name">'+esc(item.title)+'</span>'+(ready?'<span class="gift-rating" aria-label="难度 '+stars+' 星，最高 5 星">'+'★'.repeat(stars)+'☆'.repeat(5-stars)+'</span>':'')+(claimed?'<span class="gift-start">开始填色</span>':'')+'</button>';}).join('');
    const intro=ready?'确认关注后可领 '+OilGift.items.length+' 幅填色图':'礼图还在准备，选定后会在这里展示';
    let next='';
    if(claimed)next='<p>已加入图库，点一幅开始填色</p>';
    else if(ready&&state.followed)next=action('gift-claim','领取关注礼','gift','primary',giftBusy?'disabled':'');
    const guide=state.followed||claimed?'':'<div class="gift-copy"><p class="gift-follow-title">'+followGuide+'</p><p>'+followPending+'验证恢复后可领取关注礼。</p></div>';
    return '<p class="gift-intro">'+intro+'</p><div class="gift-grid'+(OilGift.items.length===5?' is-five':'')+'">'+cards+'</div>'+guide+next;
  }
  function openGift(){compactModal('<div class="gift-content"><h2>关注礼</h2><div id="gift-content">'+giftContent()+'</div></div>','gift','关注礼');}
  async function claimGift(){
    if(giftBusy)return;const serial=modalSerial;giftBusy=true;updateSocialUI();
    try{await OilSocial.claimGift(giftReady());if(serial===modalSerial){closeModal();category='关注礼';search='';await go('home');}toast('5 幅关注礼已加入图库 ♡');}
    catch(e){toast(e.message||e.errMsg||'领取未完成，请稍后重试');}finally{giftBusy=false;updateSocialUI();}
  }
  function noteResultMessage(result){return !result.confirmed?'未收到发布提交确认，次数未增加':result.recordFailed?'已收到发布提交确认，但奖励记录未保存，请稍后重试':result.rewarded?'分享提交已确认，画画次数 +1 ♡':'这次分享奖励已计入，请勿重复领取';}
  async function postNote(){
    const share=shareSession;if(!share||OilSocial.snapshot().publishing)return;
    const serial=modalSerial,button=$('[data-action="post-note"]');if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    try{
      const result=await OilSocial.postNote(share.image,OilSocial.noteCopy(share.work,share.progress,share.kind));
      if(result.confirmed&&serial===modalSerial)closeModal();
      toast(noteResultMessage(result));
    }catch(e){toast(e.message||e.errMsg||'晒画未完成，请稍后重试');}
    finally{if(serial===modalSerial&&button){button.disabled=false;button.removeAttribute('aria-busy');}updateSocialUI();}
  }
  async function generate(title){
    if(busy||!cropData)return;busy=true;const token=++generation,key=OilSocial.photoKey(originalData||cropData),settings={colors,style,detail},startingView=view,startingPhoto=cropData,trigger=$('[data-action="generate"]');
    if(trigger){trigger.disabled=true;trigger.setAttribute('aria-busy','true');}
    try{const allowed=await OilSocial.canGenerate(key);if(token!==generation||view!==startingView||cropData!==startingPhoto){busy=false;return;}if(!allowed){busy=false;openQuota(true);return;}}catch(e){busy=false;toast(e.message||'暂时无法读取制作次数');return;}
    finally{if(trigger){trigger.disabled=!cropData;trigger.removeAttribute('aria-busy');}}
    cancelPreviewRefinement();
    showModal(icon('brush','large busy-brush')+'<h2>调一盘属于你的颜色</h2><p id="generation-message">正在读取照片</p><div class="progress-track"><i id="generation-bar" style="width:2%"></i></div><p id="generation-percent">2%</p>'+action('cancel-generate','取消生成',null,'close-modal'));
    try{
      const img=await loadImage(cropData),long={simple:400,standard:520,fine:640}[settings.detail],f=Math.min(1,long/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*f);c.height=Math.round(img.height*f);const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);
      const rgba=ctx.getImageData(0,0,c.width,c.height).data,source=c.toDataURL('image/jpeg',.92),model=await OilEngine.generate(rgba,c.width,c.height,Object.assign({},settings,{cancelled:()=>generation!==token}),(p,msg)=>{if(token!==generation)return;if($('#generation-message'))$('#generation-message').textContent=msg;if($('#generation-bar'))$('#generation-bar').style.width=p+'%';if($('#generation-percent'))$('#generation-percent').textContent=p+'%';});
      if(token!==generation)return;
      const nextPainting=new OilPaint.Painting(model),nextPreviews={color:OilPaint.exportCanvas(nextPainting,'color',2).toDataURL('image/png'),numbers:OilPaint.exportCanvas(nextPainting,'numbers',2).toDataURL('image/png')};
      if(token!==generation)return;generationCommitting=true;const cancel=$('[data-action="cancel-generate"]');if(cancel)cancel.disabled=true;
      await OilSocial.charge(key);
      painting=nextPainting;work={id:'painting-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:title||photoName||'我的数字油画',source,created:Date.now(),origin:'photo',photoKey:key,quotaCharged:true,followPrompted:false,completionNotified:false};hasChanged=false;
      const initial=OilEngine.refinementLevel(model.options);refinementInput={rgba,width:c.width,height:c.height,settings,workId:work.id,base:initial,applied:initial,draft:initial,cache:new Map([[initial,model]]),message:''};
      previews=nextPreviews;previewTab='color';closeModal();await go(testMode?'debug':'preview');
    }catch(e){if(token===generation){showModal(icon('palette','large')+'<h2>换个方式，再试一次</h2><p class="error-text">'+esc(e.message||'图片处理失败，请选择简单模式再试')+'</p>'+action('retry','返回调整',null,'primary'));}}
    finally{if(token===generation){busy=false;generationCommitting=false;}updateSocialUI();}
  }
  function renderPreview(){navigation('maker');page.classList.add('preview-page','preview-refinable');
    page.innerHTML=header('数字油画预览',true,action('preview-export','导出','save','round-button preview-export-button end','aria-label="导出图片"'))+'<div class="page-content preview-scroll"><div class="preview-tabs">'+[['color','彩色效果'],['numbers','编号线稿'],['compare','原图对照']].map(v=>action('preview-tab',v[1],null,'pill '+(previewTab===v[0]?'selected':''),'data-tab="'+v[0]+'" aria-pressed="'+(previewTab===v[0])+'"')).join('')+'</div><div id="preview-picture" class="preview-picture"></div><div class="preview-summary" id="preview-summary" aria-live="polite"></div><section class="preview-refinement" aria-label="微调色块细节"><label for="preview-detail">色块细节<output id="preview-detail-label" for="preview-detail"></output></label><input id="preview-detail" type="range" min="0" max="4" step="1" aria-describedby="preview-refinement-status"><div class="refinement-ends"><span>更简洁</span><span>更多细节</span></div><p id="preview-refinement-status" role="status"></p></section></div><div class="preview-actions preview-dock">'+action('adjust','重新设置',null,'secondary')+action('start-paint','开始填色','brush','primary')+'</div>';
    updatePreviewPicture();updateRefinementControls();
  }
  function updatePreviewPicture(){
    if(view!=='preview'||!$('#preview-picture'))return;
    const m=painting.model,compare=previewTab==='compare';
    $('#preview-picture').innerHTML=compare?'<div class="preview-compare"><figure><img src="'+work.source+'" alt="同一构图的原始图片"><figcaption>原图</figcaption></figure><figure><img src="'+previews.color+'" alt="当前分色效果"><figcaption>分色效果</figcaption></figure></div>':'<img class="preview-image" src="'+previews[previewTab]+'" alt="'+(previewTab==='numbers'?'封闭区域编号线稿':'分色后的彩色效果图')+'">'+action('preview-enlarge','','fit','preview-enlarge','aria-label="放大查看预览"'+(refinementBusy?' disabled':''));
    $('#preview-summary').innerHTML='<span>'+m.palette.length+' 色 · '+m.regions.length+' 个区域</span><span>'+refinementNames[OilEngine.refinementLevel(m.options)]+'</span>';
  }
  function updateRefinementControls(){
    if(view!=='preview'||!$('#preview-detail'))return;
    const input=refinementInput,level=input?input.draft:OilEngine.refinementLevel(painting.model.options);
    $('#preview-detail').value=level;$('#preview-detail').disabled=!input;$('#preview-detail').setAttribute('aria-valuetext',refinementNames[level]);$('#preview-detail-label').textContent=refinementNames[level];
    $('#preview-refinement-status').textContent=refinementBusy?'正在整理色块，请稍候…':input?(input.message||'松开拉条，更新画面和编号线稿'):'返回制作页可重新生成并调整';
    document.querySelectorAll('.preview-refinable [data-action="start-paint"],.preview-refinable [data-action="preview-export"],.preview-refinable [data-action="preview-enlarge"]').forEach(el=>{el.disabled=refinementBusy;});
    $('#preview-picture').setAttribute('aria-busy',String(refinementBusy));
  }
  function cancelPreviewRefinement(){refinementSerial++;refinementRequest=null;refinementInput=null;refinementBusy=false;}
  function requestPreviewRefinement(level){
    const input=refinementInput;if(view!=='preview'||!input||input.workId!==work.id||painting.painted)return;
    level=Math.max(0,Math.min(4,Math.round(level)));input.draft=level;input.message='';const serial=++refinementSerial;
    if(level===input.applied){refinementRequest=null;refinementBusy=false;updateRefinementControls();return;}
    refinementRequest={input,level,serial};refinementBusy=true;updateRefinementControls();runPreviewRefinement();
  }
  async function runPreviewRefinement(){
    if(refinementRunning)return;refinementRunning=true;
    try{while(refinementRequest){
      const job=refinementRequest;refinementRequest=null;const input=job.input;
      const cancelled=()=>refinementInput!==input||job.serial!==refinementSerial||view!=='preview'||!work||work.id!==input.workId;
      if(cancelled())continue;
      try{
        let model=input.cache.get(job.level);
        if(!model)model=await OilEngine.generate(input.rgba,input.width,input.height,Object.assign({},input.settings,{refinement:job.level,cancelled}));
        if(cancelled())continue;
        const next=new OilPaint.Painting(model),images={color:OilPaint.exportCanvas(next,'color',2).toDataURL('image/png'),numbers:OilPaint.exportCanvas(next,'numbers',2).toDataURL('image/png')};
        if(cancelled())continue;
        input.cache.set(job.level,model);if(input.cache.size>3){const stale=Array.from(input.cache.keys()).find(k=>k!==input.base&&k!==job.level);if(stale!==undefined)input.cache.delete(stale);}
        painting=next;previews=images;input.applied=job.level;input.message='';updatePreviewPicture();
      }catch(error){if(!cancelled()){input.draft=input.applied;input.message='调整未完成，已保留原效果，请重试';toast(error.message||input.message);}}
    }}finally{refinementRunning=false;refinementBusy=false;updateRefinementControls();}
  }
  function enlargePreview(){
    if(refinementBusy)return;
    const kind=previewTab==='numbers'?'numbers':'color',width=Math.max(560,painting.model.width*2);
    showModal('<div class="preview-zoom-content"><h2>放大预览</h2><div class="preview-zoom-scroll"><img src="'+previews[kind]+'" style="width:'+width+'px" alt="可拖动查看的放大'+(kind==='numbers'?'编号线稿':'彩色效果')+'"></div><p>滑动查看画面各处</p>'+action('close-modal','返回预览',null,'secondary')+'</div>',true,'放大预览');
  }
  function swatches(){const m=painting.model,start=palettePage*palettePageSize,end=Math.min(start+palettePageSize,m.palette.length),pages=Math.ceil(m.palette.length/palettePageSize);
    const pager=pages>1?'<div class="palette-pager">'+action('palette-page','‹ 上一页',null,null,'data-page="'+(palettePage-1)+'"'+(palettePage===0?' disabled':''))+'<span aria-live="polite">共 '+m.palette.length+' 色 · '+(start+1)+'–'+end+' 号</span>'+action('palette-page','下一页 ›',null,null,'data-page="'+(palettePage+1)+'"'+(palettePage===pages-1?' disabled':''))+'</div>':'';
    return pager+'<div class="swatches'+(pages>1?' paged':'')+'" aria-label="选择填色色号">'+m.palette.slice(start,end).map(c=>{const rgb=c.rgb,light=.299*rgb[0]+.587*rgb[1]+.114*rgb[2],rs=m.regions.filter(r=>r.color===c.id),done=rs.length&&rs.every(r=>painting.completed[r.id]);return '<button class="swatch '+(board&&board.selected===c.id?'selected':'')+(done?' done':'')+'" data-action="color" data-color="'+c.id+'" style="background:rgb('+rgb.join(',')+');color:'+(light<140?'#fff8ef':'#59372b')+'" aria-label="色号 '+c.number+'，'+rs.filter(r=>!painting.completed[r.id]).length+' 个区域未完成" aria-pressed="'+!!(board&&board.selected===c.id)+'">'+c.number+'</button>';}).join('')+'</div>';
  }
  function showPalettePage(next){palettePage=Math.max(0,Math.min(Math.ceil(painting.model.palette.length/palettePageSize)-1,next));$('#palette-slot').innerHTML=swatches();updateSwatches();if(board)board.resize();}
  function revealPaletteColor(color){const next=Math.floor(color/palettePageSize);if(next!==palettePage)showPalettePage(next);}
  function attachBoard(selector,options){paintClock=new OilReplay.Clock(work);paintClock.knownStart=painting.painted===0;painting.beforeActivity=()=>{if(work.quotaCharged)return true;if(!overlay.hidden||(painting.active&&painting.active.quotaDenied))return false;try{const result=OilSocial.consume('work:'+work.id);work.quotaCharged=true;result.persisted.catch(e=>toast(e.message));updateSocialUI();return true;}catch(e){if(painting.active)painting.active.quotaDenied=true;if(e.code==='QUOTA')openQuota(true);else toast(e.message);return false;}};painting.onActivity=()=>{if(overlay.hidden&&!document.hidden)paintClock.activity();};board=new OilPaint.Board($(selector),painting,Object.assign({onChange:onPaintChange,onWrong:n=>toast('这一格是 '+n+' 号，换个颜色试试'),onView:z=>{if($('#zoom-label'))$('#zoom-label').textContent=z.toFixed(1)+'×';}},options||{}));board.setColor(firstUnfinishedColor());}
  function firstUnfinishedColor(){const r=painting.model.regions.find(r=>!painting.completed[r.id]);return r?r.color:0;}
  function renderPaint(){navigation('maker');page.classList.add('paint-page');const p=percent();
    page.innerHTML=header(work.title,true,action('export','晒画','share','round-button end share-open'+(p===100?' is-complete':''),'aria-label="晒画"'))+'<div class="paint-progress"><div class="progress-text"><span>完成进度 <span id="progress-copy">'+p+'%</span></span><button id="replay-entry" class="replay-entry" data-action="replay" type="button"></button><span class="percent" id="progress-percent">'+p+'%</span></div><div class="progress-track"><i id="paint-progress" style="width:'+p+'%"></i></div></div><div class="paint-stage"><div id="paint-board" class="canvas-board"></div><div class="zoom-controls">'+action('zoom-out','','minus',null,'aria-label="缩小画布"')+'<span id="zoom-label">1.0×</span>'+action('zoom-in','','plus',null,'aria-label="放大画布"')+'</div></div><div class="mode-switch">'+action('mode','点击填色','hand','selected','data-mode="tap" aria-pressed="true"')+action('mode','手指涂抹','brush',null,'data-mode="brush" aria-pressed="false"')+'</div><div id="palette-slot"></div><div id="paint-instruction" class="paint-instruction">选色号填一格 · 双指缩放和移动</div><div class="paint-tools">'+[['undo','撤销','undo'],['hint','提示','hint'],['reference','预览','gallery'],['fit','适应','fit'],['save','保存','save']].map(t=>action(t[0],t[1],t[2],'tool',t[0]==='undo'?'disabled':'')).join('')+'</div>';
    palettePage=Math.floor(firstUnfinishedColor()/palettePageSize);$('#palette-slot').innerHTML=swatches();attachBoard('#paint-board');updateSwatches();updateReplayEntry();maybeReplayHint();if(p===100)openCompletion();
  }
  function percent(){const p=painting.progress();return p===1?100:Math.floor(p*100);}
  function markDrawingChanged(){hasChanged=true;paintRevision++;}
  function onPaintChange(committed){
    if(committed)markDrawingChanged();
    if(committed&&painting.progress()===1&&paintClock){paintClock.finish();clearTimeout(completionTimer);completionTimer=setTimeout(()=>{if(view==='paint'&&painting.progress()===1&&overlay.hidden)openCompletion();},350);}
    const p=percent();if($('#progress-copy'))$('#progress-copy').textContent=p+'%';if($('#progress-percent'))$('#progress-percent').textContent=p+'%';if($('#paint-progress'))$('#paint-progress').style.width=p+'%';
    const undo=$('[data-action="undo"]');if(undo)undo.disabled=!painting.history.length;
    const share=$('[data-action="export"]');if(share)share.classList.toggle('is-complete',p===100);
    if(p===100&&committed&&work&&!work.completionNotified){work.completionNotified=true;toast('画好啦，给它装个框吧');if(share){share.classList.add('completion-pulse');setTimeout(()=>share.classList.remove('completion-pulse'),2200);}}
    if(hasChanged&&!painting.active)saveCurrent(false);
    updateSwatches();
  }
  function updateSwatches(){if(!board)return;document.querySelectorAll('.swatch').forEach(el=>{const c=Number(el.dataset.color),rs=painting.model.regions.filter(r=>r.color===c),done=rs.length&&rs.every(r=>painting.completed[r.id]);el.classList.toggle('selected',c===board.selected);el.classList.toggle('done',!!done);el.setAttribute('aria-pressed',String(c===board.selected));el.setAttribute('aria-label','色号 '+(c+1)+'，'+rs.filter(r=>!painting.completed[r.id]).length+' 个区域未完成');});
    const instruction=$('#paint-instruction');if(instruction)instruction.innerHTML='<span class="current-color">当前 <b>'+(board.selected+1)+'</b> 号 · 共 '+painting.model.palette.length+' 色</span>　'+(board.mode==='brush'?'单指涂抹 · 双指移动/缩放':'单指拖动 · 双指缩放');}
  function renderDebug(){navigation('maker');page.classList.add('preview-page');const m=painting.model;
    page.innerHTML=header('四图对照',true,action('preview-export','导出','save','round-button preview-export-button end','aria-label="导出图片"'))+'<div class="page-content"><h2 class="debug-title">先看看，画得像不像</h2><p class="debug-description">四张图使用同一幅构图。第 4 张可以直接填色，选色号后点击，也能切换涂抹。</p><div class="debug-grid"><figure><figcaption><span>1</span>原始照片</figcaption><img src="'+work.source+'" alt="原始上传照片"></figure><figure><figcaption><span>2</span>分色效果</figcaption><img src="'+previews.color+'" alt="分色后的彩色效果图"></figure><figure><figcaption><span>3</span>编号线稿</figcaption><img src="'+previews.numbers+'" alt="数字编号线稿图"></figure><figure><figcaption><span>4</span>真实填色画布</figcaption><div class="mini-board" id="debug-board" style="--board-ratio:'+(m.height/m.width*100)+'%"></div></figure></div><div class="debug-tools"><div id="palette-slot"></div><div class="debug-toolbar">'+action('debug-mode','切换手指涂抹')+action('undo','撤销',null,null,'disabled')+action('hint','提示')+action('fit','适应')+'</div></div><p class="debug-info">'+m.width+' × '+m.height+' 像素 / '+m.palette.length+' 色 / '+m.stats.regions+' 个区域 / '+(m.stats.milliseconds/1000).toFixed(1)+' 秒<br>编号过小的区域：'+m.stats.smallLabels+' 处，放大或使用提示定位。</p><div class="preview-actions">'+action('adjust','调整参数',null,'secondary')+action('start-paint','放大开始填色','brush','primary')+'</div></div>';
    palettePage=Math.floor(firstUnfinishedColor()/palettePageSize);$('#palette-slot').innerHTML=swatches();attachBoard('#debug-board');updateSwatches();
  }
  function savedMask(mask){
    const runs=OilEngine.rle(mask);
    if(runs.length<=12000)return {mask:runs};
    const bits=new Uint8Array(Math.ceil(mask.length/8));
    for(let i=0;i<mask.length;i++)if(mask[i])bits[i>>3]|=1<<(i&7);
    let binary='';
    for(let i=0;i<bits.length;i+=4096)binary+=String.fromCharCode.apply(null,bits.subarray(i,i+4096));
    return {maskBits:btoa(binary)};
  }
  function restoreMask(saved,model){
    if(!saved.maskBits)return saved.mask;
    const length=model.width*model.height,binary=atob(saved.maskBits),mask=new Uint8Array(length);
    if(binary.length!==Math.ceil(length/8))throw new Error('存档尺寸异常');
    for(let i=0;i<length;i++)mask[i]=(binary.charCodeAt(i>>3)>>(i&7))&1;
    return OilEngine.rle(mask);
  }
  async function drainSaves(current){
    let replaySaved=true;
    while(work===current&&hasChanged&&!painting.active){
      const p=painting,revision=paintRevision;
      if(paintClock&&paintClock.work===current)paintClock.flush();
      const thumb=document.createElement('canvas');thumb.width=200;thumb.height=Math.round(200*p.model.height/p.model.width);
      thumb.getContext('2d').drawImage(OilPaint.exportCanvas(p,'paint',1),0,0,thumb.width,thumb.height);
      const payload=Object.assign({},current,savedMask(p.mask),{replayData:p.replaySnapshot(),progress:p.progress(),thumbnail:thumb.toDataURL('image/jpeg',.82),updated:Date.now()});
      if(savedPainting===p){
        replaySaved=await OilStore.saveProgress(current.id,payload);
      }else{
        if(!current.galleryKey)payload.template=OilEngine.pack(p.model);
        else delete payload.source;
        replaySaved=await OilStore.save(payload);
        if(work===current)savedPainting=p;
      }
      if(work===current&&revision===paintRevision)hasChanged=false;
    }
    if(!replaySaved)toast('填色进度已保存，部分回放记录未保存');
    return {saved:work===current&&!hasChanged,replaySaved};
  }
  async function runSave(current){
    try{return await drainSaves(current);}
    catch(e){
      console.warn('画册保存失败',e);
      if(work===current)toast('进度暂未保存，请点「保存」重试');
      return {saved:false};
    }finally{saveQueue=null;}
  }
  async function saveCurrent(manual){
    if(!work||!painting||painting.active)return false;
    const current=work,saveButton=manual&&$('[data-action="save"]');
    if(manual){
      markDrawingChanged();
      if(saveButton){saveButton.disabled=true;saveButton.setAttribute('aria-busy','true');}
      toast('正在保存进度…');
    }
    if(!saveQueue&&hasChanged)saveQueue=runSave(current);
    try{
      const result=saveQueue?await saveQueue:{saved:savedPainting===painting,replaySaved:true};
      if(manual&&result.saved&&result.replaySaved&&work===current)toast('进度已保存到我的画册');
      return result.saved;
    }finally{if(saveButton){saveButton.disabled=false;saveButton.removeAttribute('aria-busy');}}
  }
  function pauseDrawing(){
    if(paintClock&&paintClock.start!==null){paintClock.pause();markDrawingChanged();}
    if(board)board.cancelGesture();
  }
  function openCompletion(){
    if(!painting||painting.progress()!==1)return;
    if(paintClock)paintClock.finish();
    const guide=replayUnlocked()?'':'<p class="share-help">'+followGuide+followPending+'</p>';
    showModal('<h2>🎨 绘画完成啦！</h2><img class="completion-art" src="'+OilPaint.exportCanvas(painting,'color',1).toDataURL('image/png')+'" alt="完整彩色作品"><p>⏱ 绘画用时：'+(work.paintTime&&work.paintTime.known?OilReplay.format(work.paintTime.ms):'暂无用时记录')+'</p><p>🎨 完成度：100%</p><div class="completion-actions">'+action('replay','观看回放',null,'primary')+action('share-save','装裱上框',null,'secondary')+'</div>'+rewardButton('completion')+guide,true,'欣赏作品');modalKind='completion';$('.modal-close').setAttribute('aria-label','关闭欣赏作品');
  }
  function openReplay(){
    if(!painting||!replayUnlocked())return;closeModal();
    showModal('<h2>上色回放</h2><canvas id="replay-canvas" class="completion-art" data-action="replay-again" role="button" tabindex="0" aria-label="重新播放上色回放"></canvas><p id="replay-status" role="status">正在准备回放…</p>'+(painting.progress()===1?'<p class="share-help">分享视频提交确认后赠 1 次，可累计，用完为止</p>':'')+'<div class="modal-actions replay-actions">'+action('video-publish','分享上色视频',null,'primary',painting.progress()===1?'':'disabled title="画完后才能分享上色视频"')+action('completion-album','回画册',null,'secondary')+'</div>');modalKind='replay';playReplay();
  }
  function playReplay(){
    cancelAnimationFrame(replayFrame);const c=$('#replay-canvas');if(!c)return;const r=new OilReplay.Renderer(painting),m=painting.model;$('#replay-status').textContent=r.description+' · 15 秒 · 点击画面重播';c.width=m.width;c.height=m.height;
    let elapsed=0,last=performance.now();
    function tick(now){if(!c.isConnected)return;if(!document.hidden)elapsed+=now-last;last=now;r.draw(c,Math.min(1,elapsed/15000));if(elapsed<15000)replayFrame=requestAnimationFrame(tick);else $('#replay-status').textContent=r.description+' · 回放完成，点击画面重播';}replayFrame=requestAnimationFrame(tick);
  }
  async function publishVideo(){
    if(videoSignal||!painting)return;if(painting.progress()!==1){toast('画完这幅作品后才能发布上色视频');return;}if(!replayUnlocked()){requestReplay('video');return;}
    if(paintClock)paintClock.finish();closeModal();
    showModal('<h2>生成我的上色视频</h2><p id="video-status" role="status">正在检查 MP4 编码能力…</p><progress id="video-progress" max="18" value="0"></progress><p>请保持页面在前台</p>'+action('close-modal','取消生成',null,'secondary'));modalKind='video';
    const signal={cancelled:false,noteToken:OilSocial.noteToken()};videoSignal=signal;
    try{
      const mini=window.xhs&&window.xhs.miniTool;if(!mini||typeof mini.postNote!=='function'||typeof mini.writeTempFile!=='function')throw new Error('请在小红书客户端内使用视频发布功能');
      const r=new OilReplay.Renderer(painting),time=work.paintTime?Object.assign({},work.paintTime):null;
      const blob=await OilReplay.record(r,time,p=>{if(signal.cancelled)return;$('#video-progress').value=p*18;$('#video-status').textContent='已绘制 '+(p*18).toFixed(1)+' / 18 秒，正在编码';},signal);
      if(signal.cancelled)return;
      await OilReplay.verifyMP4(blob);
      const cover=document.createElement('canvas');cover.width=720;cover.height=1280;r.videoFrame(cover,18,time);
      $('#video-status').textContent='MP4 已生成，正在写入临时文件并打开发布页…';
      const nativeResult=await OilReplay.publish(blob,cover.toDataURL('image/jpeg',.9),signal,time);
      const result=await OilSocial.confirmNote(nativeResult,signal.noteToken);
      if(!signal.cancelled){videoSignal=null;openCompletion();toast(noteResultMessage(result));updateSocialUI();}
    }catch(error){if(!signal.cancelled){videoSignal=null;showModal('<h2>视频未能发布</h2><p class="error-text">'+esc(error.message||error.errMsg||'平台接口失败，请重试')+'</p><div class="modal-actions">'+action('video-publish','重新尝试',null,'primary')+action('replay-back','返回作品',null,'secondary')+'</div>');modalKind='video-error';}}
    finally{if(videoSignal===signal)videoSignal=null;}
  }
  function renderEmptyAlbum(){
    const fresh=album.length===0,title=fresh?'你的第一幅画，从这里开始':albumTab==='done'?'把一幅喜欢慢慢涂满':'下一幅画，从这里开始';
    const copy=fresh?'从图库挑一幅喜欢的，或上传自己的照片':albumTab==='done'?'切到「进行中」继续填色，完成后会收藏在这里':'从图库挑一幅新画，或用自己的照片开始创作';
    return '<div class="empty-album with-choices">'+icon('book')+'<h2>'+title+'</h2><p>'+copy+'</p><div class="empty-album-actions">'+action('album-gallery','去图库挑图','gallery','primary')+action('upload','上传照片制作','upload','secondary')+'</div></div>';
  }
  function renderAlbum(){navigation('album');const finished=album.filter(w=>w.progress===1),filtered=album.filter(w=>albumTab==='done'?w.progress===1:w.progress<1);
    page.innerHTML='<header class="topbar"><h1 class="brand album-title">'+icon('book')+'我的画册</h1>'+headerGift()+'</header><div class="page-content"><div class="album-stats"><div>'+icon('gallery')+'<b>'+album.length+'</b>幅作品</div><div>'+icon('check')+'<b>'+finished.length+'</b>幅完成</div></div>'+rewardButton('album')+'<div class="tabs album-tabs">'+action('album-tab','进行中',null,albumTab==='ongoing'?'active':'','data-tab="ongoing"')+action('album-tab','已完成',null,albumTab==='done'?'active':'','data-tab="done"')+'</div>'+(filtered.length?'<div class="album-grid">'+filtered.map(w=>'<article class="album-card"><button data-action="continue" data-id="'+esc(w.id)+'" style="width:100%"><img class="album-thumb" src="'+w.thumbnail+'" alt="'+esc(w.title)+'当前填色进度"></button>'+action('delete','', 'trash','delete-work','data-id="'+esc(w.id)+'" aria-label="删除'+esc(w.title)+'"')+'<h3 class="album-name">'+esc(w.title)+'</h3><div class="progress-line"><div class="progress-track"><i style="width:'+Math.floor(w.progress*100)+'%"></i></div><span class="percent">'+Math.floor(w.progress*100)+'%</span></div>'+action('continue',w.progress===1?'欣赏作品':'继续画','brush','continue','data-id="'+esc(w.id)+'"')+'</article>').join('')+'</div>':renderEmptyAlbum())+'<p class="album-help">画册旧画继续画不扣次数。<br>进度保存在当前设备，请及时导出喜欢的作品。<br>清理应用或浏览器数据会清除本地画册。</p></div>';
  }
  async function resume(id){
    try{
      if(board){pauseDrawing();if(hasChanged)await saveCurrent(false);}
      const saved=await OilStore.load(id);
      if(!saved)throw new Error('这幅作品的存档没有找到');
      const art=saved.galleryKey&&quickArt[saved.galleryId];
      if(saved.galleryKey&&(!art||galleryTemplateKey(saved.galleryId)!==saved.galleryKey))throw new Error('当前版本缺少这幅画的图库模板');
      const model=art?art.create():OilEngine.unpack(saved.template);
      const restored=new OilPaint.Painting(model,restoreMask(saved,model),saved.replayData);
      dispose();
      painting=savedPainting=restored;
      previews={color:OilPaint.exportCanvas(painting,'color',2).toDataURL('image/png'),numbers:OilPaint.exportCanvas(painting,'numbers',2).toDataURL('image/png')};
      work={quotaCharged:saved.quotaCharged!==false,followPrompted:!!saved.followPrompted||saved.progress===1,paintTime:saved.paintTime?Object.assign({},saved.paintTime):undefined,id:saved.id,title:saved.title,source:art?previews.color:saved.source,created:saved.created,origin:saved.origin||(/^painting-(art-|easy-)/.test(saved.id)?'gallery':'unknown'),galleryId:saved.galleryId||'',galleryKey:saved.galleryKey,photoKey:saved.photoKey||'',completionNotified:!!saved.completionNotified||saved.progress===1};
      hasChanged=false;
      await go('paint');
    }catch(e){toast(e.message||'作品读取失败，请重试');}
  }
  async function exportWork(){
    openFramedExport('paint',painting.progress()===1?'color':'paint');
  }
  function exportPreview(kind){
    if(!painting||refinementBusy)return;openFramedExport('preview',kind==='numbers'?'numbers':'color');
  }
  function openFramedExport(context,kind){
    clearTimeout(exportTitleTimer);
    exportSettings={context,kind,defaultKind:context==='paint'&&painting.progress()<1?'paint':'color',frame:shareFrame,title:String(work.title||'我的油画').slice(0,24),painting,more:kind==='numbers',base:null,baseKind:''};
    showModal('<div class="framed-export-content"><h2 id="framed-export-title">导出作品</h2><img id="framed-export-preview" class="export-image" alt="当前导出效果"><div id="export-framing-controls"><div class="export-frame-options" role="group" aria-label="选择相框">'+[['none','无相框'],['cream','奶油留白'],['wood','浅木细框']].map(v=>action('export-frame',v[1],null,'pill','data-frame="'+v[0]+'"')).join('')+'</div><label class="export-name-label" for="export-work-title">作品名<input id="export-work-title" type="text" maxlength="24" value="'+esc(exportSettings.title)+'"></label></div><p id="export-description"></p>'+action('save-export','保存图片','save','primary')+action('framed-post','晒晒你的画','share','secondary framed-share-button')+'<p id="framed-reward-copy" class="share-help">晒画提交确认后赠 1 次，可累计，用完为止</p>'+action('export-more','更多导出',null,'export-more','aria-expanded="false" aria-controls="export-more-options"')+'<div id="export-more-options" class="export-more-options" hidden>'+action('export-variant','打印线稿',null,'secondary','data-kind="numbers"')+'<p class="print-export-note">白底轮廓和色号，适合打印后手工填色</p>'+(context==='paint'&&painting.progress()<1?action('export-variant','完整彩色参考图',null,'secondary','data-kind="color"'):'')+action('export-variant',exportSettings.defaultKind==='paint'?'返回当前进度':'返回彩色效果',null,'secondary','id="export-default-variant" data-kind="'+exportSettings.defaultKind+'"')+'</div>'+action('close-modal',context==='preview'?'返回预览':'返回画布',null,'secondary export-return-button')+'</div>',true);
    $('.export-modal-shell').classList.add('framed-export-shell');overlay.classList.add('has-framed-export');fitExportViewport();updateFramedExport();
  }
  function fitExportViewport(){if(exportSettings){const vp=window.visualViewport;overlay.style.setProperty('--export-viewport',(vp?vp.height:window.innerHeight)+'px');}}
  function updateFramedExport(){
    const settings=exportSettings;if(!settings||!$('#framed-export-preview'))return;
    clearTimeout(exportTitleTimer);
    if(!settings.base||settings.baseKind!==settings.kind){settings.base=OilPaint.exportCanvas(settings.painting,settings.kind,3);settings.baseKind=settings.kind;}
    const numbered=settings.kind==='numbers',frame=numbered?'none':settings.frame;
    exportData=OilFrame.compose(settings.base,frame,settings.title).toDataURL('image/png');
    $('#framed-export-preview').src=exportData;$('#framed-export-preview').alt=numbered?'白底打印线稿':settings.kind==='paint'?'当前实际填色状态的装裱图':'完整彩色效果装裱图';
    $('#framed-export-title').textContent=numbered?'导出打印线稿':settings.context==='preview'?'导出作品':settings.painting.progress()===1?'装裱你的作品':'保存此刻的进度';
    $('#export-framing-controls').hidden=numbered;
    const shareButton=$('[data-action="framed-post"]');if(shareButton)shareButton.hidden=numbered||(settings.kind==='color'&&settings.painting.progress()<1);const rewardCopy=$('#framed-reward-copy');if(rewardCopy)rewardCopy.hidden=shareButton.hidden;
    $('#export-description').textContent=numbered?'白底线稿，含区域边界与色号':settings.kind==='paint'?'按当前实际填色状态导出，未填部分留白':'完整彩色参考图 · 不含编号';
    document.querySelectorAll('[data-action="export-frame"]').forEach(el=>{const selected=el.dataset.frame===settings.frame;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});
    $('#export-more-options').hidden=!settings.more;const more=$('[data-action="export-more"]');more.textContent=settings.more?'收起更多':'更多导出';more.setAttribute('aria-expanded',String(settings.more));
    $('#export-default-variant').hidden=settings.kind===settings.defaultKind;
    document.querySelectorAll('[data-action="export-variant"]').forEach(el=>{el.classList.toggle('selected',el.dataset.kind===settings.kind);el.setAttribute('aria-pressed',String(el.dataset.kind===settings.kind));});
  }
  function framedExportFilename(){
    const s=exportSettings,title=String(s.title||'我的油画').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim()||'我的油画';
    const kind=s.kind==='numbers'?'编号线稿':s.kind==='paint'?'当前进度':'彩色效果',frame=s.kind==='numbers'||s.frame==='none'?'':s.frame==='cream'?'-奶油留白':'-浅木细框';
    return title+'-'+kind+frame+'.png';
  }
  async function saveExport(filename){try{if(exportSettings){updateFramedExport();filename=framedExportFilename();}if(await OilStore.saveImage(exportData)){toast('作品已保存到系统相册');return;}
    // Native container has no download fallback; ordinary browser receives a local PNG link.
    if(window.xhs){toast('当前小红书版本尚不支持相册保存，请更新客户端');return;}
    const a=document.createElement('a');a.href=exportData;a.download=filename||(work.title||'数字油画')+'.png';document.body.appendChild(a);a.click();a.remove();toast('PNG 已导出，请查看下载文件');
    }catch(e){toast('未能保存到相册，请检查相册权限后重试');}}
  async function startEasy(continueSaved){
    return startQuickArt('easy',continueSaved);
  }
  function galleryTemplateKey(id){return id==='easy'?easyInfo.key:quickArt[id].key;}
  async function startQuickArt(id,continueSaved){
    if(busy)return;
    const art=quickArt[id];if(!art)return;
    const galleryKey=galleryTemplateKey(id),prefix='painting-'+(id==='easy'?'easy-':'art-')+galleryKey+'-';
    busy=true;
    try{
      if(continueSaved){const saved=(await OilStore.list()).find(w=>w.id.indexOf(prefix)===0&&w.progress<1);if(saved){await resume(saved.id);return;}}
      if(OilGift.items.some(item=>item.artId===id)&&!OilSocial.snapshot().giftClaimed){if(!page.firstChild)await go('home');openGift();return;}
      closeModal();
      if(board){pauseDrawing();if(hasChanged)await saveCurrent(false);dispose();}
      const startingView=view;
      painting=new OilPaint.Painting(art.create());
      previews={color:OilPaint.exportCanvas(painting,'color',2).toDataURL('image/png'),numbers:OilPaint.exportCanvas(painting,'numbers',2).toDataURL('image/png')};
      const current={id:prefix+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:art.title,source:previews.color,created:Date.now(),origin:'gallery',galleryId:id,galleryKey,quotaCharged:false,followPrompted:false,completionNotified:false};
      work=current;
      markDrawingChanged();
      const saved=await saveCurrent(false);
      if(work!==current||view!==startingView)return;
      await go('paint');
      if(saved)toast(art.colors+' 个色号，'+art.regions+' 个区域 · 首次填色扣 1 次，继续画不再扣');
    }finally{busy=false;}
  }
  async function chooseArt(id){
    const g=galleryItems().find(g=>g.id===id);if(!g)return;
    if(g.quick){await startQuickArt(g.quick,false);return;}
    if(g.easy){await startEasy(false);return;}
    if(originalImage&&!sourceBeforeGallery)sourceBeforeGallery={originalData,cropData,name:photoName,sample,crop:Object.assign({},crop)};
    await setPhoto('./resources/'+id+'.webp',g.title,true);await generate(g.title);
  }
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action;if(board)board.lastTap=null;
    try{
      if(a==='nav'){if(el.dataset.view==='album-ongoing'){albumTab='ongoing';await go('album');}else await go(el.dataset.view);}
      else if(a==='album-gallery'){category='精选';search='';await go('home');}
      else if(a==='back'){await go(view==='paint'?'album':view==='maker'?'home':'maker');}
      else if(a==='category'){category=el.dataset.category;renderHome();}
      else if(a==='search'){const wrap=$('#search-wrap');wrap.innerHTML='<label class="search-box"><input id="gallery-search" placeholder="找一幅喜欢的画" value="'+esc(search)+'" aria-label="搜索作品名称"></label>';$('#gallery-search').focus();}
      else if(a==='art')await chooseArt(el.dataset.id);
      else if(a==='easy')await startEasy(false);
      else if(a==='quick-art')await startQuickArt(el.dataset.id,false);
      else if(a==='fruit-source')showModal('<h2>盘中三桃 · 馆藏原画</h2><img class="export-image" src="./resources/fruit-original.webp" alt="Henri Fantin-Latour 于 1868 年绘制的盘中三桃原画"><p>Henri Fantin-Latour，1868<br>Courtesy National Gallery of Art, Washington<br>公共领域 · CC0<br>试玩图已简化为 '+OilFruit.colors+' 色、'+OilFruit.regions+' 个可填区域</p>'+action('close-modal','返回制作',null,'secondary'));
      else if(a==='upload')input.click();
      else if(a==='sample'){await setPhoto('./resources/photo-tabby.jpg','猫咪的午后',true);renderMaker();}
      else if(a==='remove-photo'){originalImage=null;originalData='';cropData='';renderMaker();}
      else if(a==='option'){const k=el.dataset.key,v=el.dataset.value;if(k==='colors')colors=Number(v);else if(k==='style')style=v;else if(k==='detail')detail=v;else if(k==='ratio'){crop.ratio=v;drawCrop();}renderMaker();}
      else if(a==='crop-toggle'){cropOpen=!cropOpen;renderMaker();}
      else if(a==='rotate'){crop.rotation=(crop.rotation+90)%360;drawCrop();renderMaker();}
      else if(a==='reset-crop'){crop={ratio:'original',rotation:0,zoom:1,x:0,y:0};drawCrop();renderMaker();}
      else if(a==='generate')await generate();
      else if(a==='cancel-generate'){if(generationCommitting)return;generation++;busy=false;closeModal();toast('已取消，可继续调整照片');}
      else if(a==='retry'){closeModal();await go('maker');}
      else if(a==='test-mode'){testMode=!testMode;renderMaker();toast(testMode?'已开启四图测试模式':'已退出四图测试模式');}
      else if(a==='preview-tab'){if(el.dataset.tab==='debug')await go('debug');else{previewTab=el.dataset.tab;renderPreview();}}
      else if(a==='preview-enlarge')enlargePreview();
      else if(a==='adjust'){if(sourceBeforeGallery){const s=sourceBeforeGallery;originalData=s.originalData;originalImage=await loadImage(originalData);photoName=s.name;sample=s.sample;crop=s.crop;drawCrop();sourceBeforeGallery=null;}await go('maker');}
      else if(a==='start-paint'){
        if(refinementBusy||el.disabled)return;
        const current=work,startingView=view;
        el.disabled=true;
        try{
          if(board)pauseDrawing();
          if(savedPainting!==painting)markDrawingChanged();
          await saveCurrent(false);
          if(work===current&&view===startingView)await go('paint');
        }finally{el.disabled=false;}
      }
      else if(a==='color'){board.setColor(Number(el.dataset.color));updateSwatches();}
      else if(a==='palette-page')showPalettePage(Number(el.dataset.page));
      else if(a==='mode'){board.setMode(el.dataset.mode);document.querySelectorAll('[data-action="mode"]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===board.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===board.mode));});updateSwatches();}
      else if(a==='debug-mode'){board.setMode(board.mode==='tap'?'brush':'tap');el.textContent=board.mode==='brush'?'切换点击填色':'切换手指涂抹';}
      else if(a==='undo'){board.lastTap=null;if(painting.undo()){if(work.paintTime)work.paintTime.final=false;board.changed();toast('已撤销上一步');}else toast('还没有需要撤销的笔迹');}
      else if(a==='hint'){const r=board.hint();if(r)revealPaletteColor(r.color);updateSwatches();if(r)toast('找到 '+(r.color+1)+' 号了，圈圈里就是');else toast('每一格都画好啦');}
      else if(a==='fit')board.reset();
      else if(a==='zoom-in')board.zoomAt(1.4,{x:board.w/2,y:board.h/2});
      else if(a==='zoom-out')board.zoomAt(1/1.4,{x:board.w/2,y:board.h/2});
      else if(a==='reference'){board.preview=!board.preview;board.render();el.classList.toggle('selected',board.preview);toast(board.preview?'正在欣赏彩色参考图':'已回到真实填色进度');}
      else if(a==='save')await saveCurrent(true);
      else if(a==='album-tab'){albumTab=el.dataset.tab;renderAlbum();}
      else if(a==='continue')await resume(el.dataset.id);
      else if(a==='delete'){deleteId=el.dataset.id;showModal(icon('trash','large')+'<h2>删除这幅作品？</h2><p>照片和填色进度会一起移除，删除后无法恢复。</p><div class="modal-actions">'+action('close-modal','留下来',null,'secondary')+action('confirm-delete','确认删除',null,'secondary')+'</div>');}
      else if(a==='confirm-delete'){await OilStore.del(deleteId);closeModal();await go('album');toast('已删除这幅作品');}
      else if(a==='export')openShare();
      else if(a==='share-save'){closeModal();await exportWork();}
      else if(a==='replay')await requestReplay('replay');
      else if(a==='share-tab'){if(!OilSocial.snapshot().publishing)openShare(el.dataset.tab);}
      else if(a==='replay-again')playReplay();
      else if(a==='replay-back'){const destination=replayReturn;closeModal();if(destination==='share')openShare('video');else if(destination==='completion')openCompletion();}
      else if(a==='video-publish')await publishVideo();
      else if(a==='completion-album'){closeModal();await go('album');}
      else if(a==='post-note')await postNote();
      else if(a==='framed-post'){if(exportSettings&&!OilSocial.snapshot().publishing){updateFramedExport();shareSession={image:exportData,work:Object.assign({},work,{title:exportSettings.title}),progress:painting.progress(),kind:exportSettings.kind};el.disabled=true;try{await postNote();}finally{el.disabled=false;}}}
      else if(a==='reward-author')await openReward();
      else if(a==='gift')openGift();
      else if(a==='gift-claim')await claimGift();
      else if(a==='gift-art'){if(giftReady()&&OilSocial.snapshot().giftClaimed){closeModal();await startQuickArt(el.dataset.id,false);}}
      else if(a==='quota')openQuota(false);
      else if(a==='quota-album'){closeModal();await go('album');}
      else if(a==='quota-gallery'){closeModal();category='精选';search='';await go('home');}
      else if(a==='preview-export')exportPreview(el.dataset.kind);
      else if(a==='export-frame'){if(exportSettings){exportSettings.frame=el.dataset.frame;shareFrame=el.dataset.frame;updateFramedExport();}}
      else if(a==='export-more'){if(exportSettings){exportSettings.more=!exportSettings.more;updateFramedExport();}}
      else if(a==='export-variant'){if(exportSettings){exportSettings.kind=el.dataset.kind;updateFramedExport();}}
      else if(a==='save-export')await saveExport(el.dataset.filename);
      else if(a==='close-modal')closeModal();
    }catch(err){toast(err.message||'这一步没有完成，请重试');}
  });
  document.addEventListener('input',e=>{if(e.target.id==='gallery-search'){search=e.target.value.trim();drawGallery();}if(e.target.dataset.crop){crop[e.target.dataset.crop]=Number(e.target.value);drawCrop();}
    if(e.target.id==='preview-detail'&&refinementInput){refinementInput.draft=Number(e.target.value);$('#preview-detail-label').textContent=refinementNames[refinementInput.draft];e.target.setAttribute('aria-valuetext',refinementNames[refinementInput.draft]);}
    if(e.target.id==='export-work-title'&&exportSettings){exportSettings.title=e.target.value;clearTimeout(exportTitleTimer);exportTitleTimer=setTimeout(updateFramedExport,200);}
  });
  document.addEventListener('change',e=>{if(e.target.id==='preview-detail')requestPreviewRefinement(Number(e.target.value));});
  input.addEventListener('change',()=>upload(input.files[0]));
  window.addEventListener('resize',()=>document.documentElement.style.setProperty('--app-height',window.innerHeight+'px'));
  window.addEventListener('resize',fitExportViewport);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',fitExportViewport);
  document.addEventListener('keydown',e=>{if(e.target.id==='replay-canvas'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();playReplay();}});
  function suspendDrawing(){if(board){pauseDrawing();if(hasChanged)saveCurrent(false);}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendDrawing();else updateSocialUI();});
  overlay.addEventListener('click',e=>{if(e.target===overlay&&modalKind)closeModal();});
  window.setInterval(()=>{if(!document.hidden)updateSocialUI();},30000);
  window.setInterval(()=>{if(paintClock&&paintClock.start!==null){markDrawingChanged();saveCurrent(false);}},15000);
  window.addEventListener('pagehide',suspendDrawing);
  window.addEventListener('blur',suspendDrawing);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden&&!busy)closeModal();});
  // Test harness only exposes state and geometry. No fill-all shortcut is present in the UI.
  window.Studio={get painting(){return painting;},get board(){return board;},get work(){return work;},get view(){return view;},get crop(){return Object.assign({},crop);},get previews(){return previews;},save:()=>saveCurrent(true)};
  async function nativeLayout(){if(!window.xhs)return;$('#studio').classList.add('native-shell');const info=await OilStore.windowInfo();if(info){let bottom=info.safeArea?info.safeArea.top:0;Object.values(info.menuButtons||{}).forEach(r=>{if(r)bottom=Math.max(bottom,r.bottom);});document.documentElement.style.setProperty('--header-inset',bottom+'px');}}
  async function start(){document.documentElement.style.setProperty('--app-height',window.innerHeight+'px');await OilStore.init();await OilSocial.init();await nativeLayout();const match=location.search.match(/[?&]demo=([^&]+)/),demo=match?match[1]:'';if(demo&&Object.prototype.hasOwnProperty.call(quickArt,demo)){await startQuickArt(demo,true);}else{await setPhoto('./resources/photo-tabby.jpg','猫咪的午后',true);await go(testMode||/[?&]view=maker/.test(location.search)?'maker':'home');}if(OilStore.backend()==='memory')toast('当前环境无法保存画册，请及时导出作品');}
  start().catch(e=>{page.innerHTML='<div class="page-content"><h1>画室暂时没有打开</h1><p>'+esc(e.message)+'</p>'+action('retry','重新进入',null,'primary')+'</div>';});
})();
