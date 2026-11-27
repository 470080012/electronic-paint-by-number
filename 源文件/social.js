(function(root){
  'use strict';
  const DAILY='creation-daily-v1',GIFT='follow-gift-v1';
  // Builder Hub for 电子数字油画 shows 赞赏 enabled in its version settings.
  const REWARD_ENABLED=true,REWARD_MIN_CLIENT_VERSION=9533;
  let mini=null,version=0,publishing=false;
  let ledger=null,gift=null,storageError=false,queue=Promise.resolve();
  const sessionPhotos=new Set();
  function dayKey(now){return new Date((now===undefined?Date.now():now)+28800000).toISOString().slice(0,10);}
  function clean(raw){
    const day=dayKey(),same=raw&&raw.day===day,num=n=>Number.isSafeInteger(n)&&n>=0?n:0;
    const photos=raw&&Array.isArray(raw.photos)?Array.from(new Set(raw.photos.filter(x=>typeof x==='string'))).slice(-512):[];
    const balance=raw&&raw.version===2?num(raw.balance):same?Math.max(0,(raw.noteBonus===1?1:0)-Math.max(0,num(raw.used)-3)):0;
    return {version:2,day,used:same?Math.max(0,num(raw.used)-(raw.version!==2&&raw.noteBonus===1&&num(raw.used)>3?1:0)):0,photos,balance,followed:!!(raw&&raw.followed),receipts:raw&&Array.isArray(raw.receipts)?raw.receipts.filter(x=>typeof x==='string').slice(-512):[]};
  }
  function serial(fn){const task=queue.catch(()=>{}).then(fn);queue=task.catch(()=>{});return task;}
  function error(message,code){const e=new Error(message);e.code=code;return e;}
  function supportsNote(){return !!(mini&&typeof mini.postNote==='function');}
  function canReward(){return REWARD_ENABLED&&version>=REWARD_MIN_CLIENT_VERSION&&!!mini&&typeof mini.rewardAuthor==='function';}
  async function openReward(){
    if(!canReward())throw error('当前环境暂不支持赞赏','UNSUPPORTED');
    const result=await mini.rewardAuthor();
    if(!result||result.errMsg!=='rewardAuthor:ok')throw result||error('未能打开赞赏','REWARD');
  }
  function snapshot(){ledger=clean(ledger);const followed=ledger.followed,base=3,followBonus=followed?3:0,total=base+followBonus,dailyRemaining=Math.max(0,total-ledger.used);
    return {day:ledger.day,used:ledger.used,base,bonus:ledger.balance,balance:ledger.balance,followBonus,followed,unlimited:false,total,dailyRemaining,remaining:dailyRemaining+ledger.balance,publishing,canPost:supportsNote(),storageError,giftClaimed:!!(gift&&gift.version===OilGift.version&&gift.claimed)};
  }
  async function readDaily(){if(!ledger)ledger=clean(await OilStore.getPreference(DAILY));else ledger=clean(ledger);return ledger;}
  async function persist(){const next=JSON.parse(JSON.stringify(clean(ledger)));try{await OilStore.setPreference(DAILY,next);storageError=false;}catch(e){storageError=true;throw error('次数暂时无法保存，请稍后重试；已有作品仍可继续画','STORAGE');}}
  function consume(key){
    ledger=clean(ledger);if(sessionPhotos.has(key)||ledger.photos.indexOf(key)>=0)return {charged:false,persisted:Promise.resolve()};
    if(OilStore.backend()==='memory')throw error('当前环境无法记录次数，请先允许本地存储；已有作品仍可继续画','STORAGE');
    const state=snapshot();if(state.remaining<=0)throw error('新开画作次数已用完，晒画可再得 1 次；已有作品可以继续画','QUOTA');
    if(state.dailyRemaining>0)ledger.used++;else ledger.balance--;
    ledger.photos=ledger.photos.concat(key).slice(-512);sessionPhotos.add(key);
    return {charged:true,daily:state.dailyRemaining>0,key,persisted:serial(persist)};
  }
  function noteToken(){return 'note-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
  async function confirmNote(result,token){
    if(!result||typeof result.errMsg!=='string'||result.errMsg.indexOf('postNote:ok')!==0)return {confirmed:false,rewarded:false};
    try{return await serial(async()=>{await readDaily();if(ledger.receipts.indexOf(token)>=0)return {confirmed:true,rewarded:false};
      ledger.balance++;ledger.receipts=ledger.receipts.concat(token).slice(-512);
      try{await persist();return {confirmed:true,rewarded:true};}catch(e){ledger.balance=Math.max(0,ledger.balance-1);ledger.receipts=ledger.receipts.filter(x=>x!==token);throw e;}
    });}catch(e){return {confirmed:true,rewarded:false,recordFailed:true};}
  }
  async function init(){
    mini=root.xhs&&root.xhs.miniTool;let launch=root.xhs&&root.xhs.launchOptions;
    if((!launch||!launch.miniToolEnv||!launch.miniToolEnv.buildVersion)&&mini&&typeof mini.getLaunchOptions==='function')try{launch=await mini.getLaunchOptions();}catch(e){}
    version=Math.floor(Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion||0)/1000);
    try{await readDaily();}catch(e){storageError=true;ledger=clean(null);}
    try{gift=await OilStore.getPreference(GIFT);}catch(e){storageError=true;}
    return snapshot();
  }
  function photoKey(data){let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);return data.length+'-'+(hash>>>0).toString(36);}
  async function canGenerate(key){
    await readDaily();if(sessionPhotos.has(key)||ledger.photos.indexOf(key)>=0)return true;
    if(OilStore.backend()==='memory')throw error('当前环境无法记录次数，请先允许本地存储；已有作品仍可继续画','STORAGE');
    return snapshot().remaining>0;
  }
  async function charge(key){const result=consume(key);try{await result.persisted;return result.charged;}catch(e){if(result.charged){ledger=clean(ledger);if(result.daily)ledger.used=Math.max(0,ledger.used-1);else ledger.balance++;ledger.photos=ledger.photos.filter(x=>x!==key);sessionPhotos.delete(key);}throw e;}}
  async function claimGift(ready){
    if(!ready)throw error('礼图还在准备，选定后就会在这里展示','GIFT_PENDING');
    return serial(async()=>{
      const state=snapshot();
      if(state.giftClaimed)return true;
      if(!state.followed)throw error('暂时无法验证新关注，验证恢复后可领取','FOLLOW_REQUIRED');
      const next={version:OilGift.version,claimed:true};
      await OilStore.setPreference(GIFT,next);
      gift=next;
      return true;
    });
  }
  function noteCopy(work,progress,kind){
    const title=Array.from(String(work.title||'我的数字油画').replace(/[\r\n]+/g,' ')).slice(0,80).join(''),gallery=work.origin==='gallery'||/^painting-(art-|easy-)/.test(work.id||''),photo=work.origin==='photo';
    const heading='原来小红书还能玩数字油画🎨',invite='小红书里就能玩，你也来涂一张？',peach=title==='蜜桃气泡饮',intro=peach?'给自己涂了一杯蜜桃气泡饮🍑':'给自己涂了一幅《'+title+'》🎨';
    let body;
    if(kind==='color'&&progress<1&&photo)body='把自己的照片变成了数字油画🎨\n\n用上传的照片生成了《'+title+'》。这是生成效果，准备开始填色。\n'+invite;
    else if(progress>=1)body=intro+'\n\n'+(gallery?'在图库挑了这张':photo?'用自己上传的照片做了这张':'挑了这幅画来涂')+'，一格一格填上颜色，终于涂完啦🎨\n'+invite;
    else{const percent=Math.max(0,Math.min(99,Math.floor(progress*100)||0));body='今天给《'+title+'》添了点颜色🎨\n\n'+(gallery?'在图库挑了这张':photo?'用自己上传的照片做了这张':'继续涂这幅画')+'，一格一格慢慢填，目前完成 '+percent+'%。\n'+invite;}
    return {title:progress>=1?OilReplay.noteTitle(work.paintTime):heading,content:body};
  }
  async function postNote(data,copy){
    if(!supportsNote())throw error(root.xhs?'当前版本暂不支持晒画，请更新小红书':'请在小红书内晒画，也可以先保存图片','UNSUPPORTED');
    if(publishing)throw error('正在打开发布页，请稍候','BUSY');publishing=true;const token=noteToken();
    try{
      let path=data;if(typeof mini.writeTempFile==='function'){const temp=await mini.writeTempFile({data});if(!temp||!temp.filePath)throw error('暂时无法准备晒画图片，请重试','MEDIA');path=temp.filePath;}
      const args={title:copy.title,content:copy.content,mediaInfo:{image_resources:[{url:path}]}};if(version>=9430)args.pageType='photo_publish';
      const result=await mini.postNote(args);
      return await confirmNote(result,token);
    }catch(e){if(e.errCode===20002||/cancel|取消/i.test(e.errMsg||e.message||''))throw error('已取消晒画','CANCELLED');throw e;}
    finally{publishing=false;}
  }
  root.OilSocial={init,snapshot,dayKey,photoKey,canGenerate,charge,consume,noteToken,confirmNote,claimGift,noteCopy,postNote,canReward,openReward};
})(window);
