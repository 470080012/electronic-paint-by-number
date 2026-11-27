(function(root){
  'use strict';
  const PREFIX='oil-studio-v1-',INDEX=PREFIX+'album',KEY_LIMIT=450000,CHUNK_SIZE=180000;
  let mini=null,version=0,db=null,backend='memory',fileEnv=null;
  const memory=new Map(),manifests=new Map();
  async function init(){
    mini=window.xhs&&window.xhs.miniTool;
    let launch=window.xhs&&window.xhs.launchOptions;
    if((!launch||!launch.miniToolEnv||!launch.miniToolEnv.buildVersion)&&mini&&typeof mini.getLaunchOptions==='function')try{launch=await mini.getLaunchOptions();}catch(e){}
    version=Math.floor(Number(launch&&launch.miniToolEnv&&launch.miniToolEnv.buildVersion||0)/1000);
    if(version>=9460&&mini&&typeof mini.setStorage==='function'&&typeof mini.getStorage==='function'){
      backend='xhs';
      if(version>=9490&&launch&&launch.miniToolEnv&&launch.miniToolEnv.userDataPath&&['writeFile','appendFile','readFile','unlink','getFileStorageInfo'].every(k=>typeof mini[k]==='function'))try{
        const info=await mini.getFileStorageInfo();if(info.writeChunkMaxBytes>0&&info.readChunkMaxBytes>0)fileEnv={root:launch.miniToolEnv.userDataPath,write:Math.floor(info.writeChunkMaxBytes),read:Math.floor(info.readChunkMaxBytes)};
      }catch(e){}
      return;
    }
    if(window.xhs&&(!version||version>=9460))return;
    if(window.indexedDB)try{db=await new Promise((resolve,reject)=>{const req=indexedDB.open('digital-oil-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('works');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('请关闭其他画册标签页后重试'));});backend='idb';return;}catch(e){}
    try{localStorage.setItem(PREFIX+'probe','1');localStorage.removeItem(PREFIX+'probe');backend='local';}catch(e){backend='memory';}
  }
  async function get(key){
    if(backend==='xhs'){try{const r=await mini.getStorage({key});return r.data?JSON.parse(r.data):null;}catch(e){if(/not.?found|不存在|empty/i.test(e.errMsg||''))return null;throw e;}}
    if(backend==='idb')return new Promise((resolve,reject)=>{const t=db.transaction('works','readonly'),r=t.objectStore('works').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});
    if(backend==='local'){const s=localStorage.getItem(key);return s?JSON.parse(s):null;}
    return memory.get(key)||null;
  }
  async function set(key,value){
    if(backend==='xhs'){const data=JSON.stringify(value);if(data.length>KEY_LIMIT)throw new Error('作品存档超过本地缓存限制');const result=await mini.setStorage({key,data});if(result&&result.errMsg&&result.errMsg!=='setStorage:ok')throw result;return;}
    if(backend==='idb')return new Promise((resolve,reject)=>{const t=db.transaction('works','readwrite');t.objectStore('works').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('本地保存中断'));});
    if(backend==='local'){localStorage.setItem(key,JSON.stringify(value));return;}
    memory.set(key,value);throw new Error('当前环境无法持久保存，请先导出作品');
  }
  async function remove(key){
    if(backend==='xhs'){await mini.removeStorage({key});return;}
    if(backend==='idb')return new Promise((resolve,reject)=>{const t=db.transaction('works','readwrite');t.objectStore('works').delete(key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});
    if(backend==='local')localStorage.removeItem(key);else memory.delete(key);
  }
  function summary(work){return {id:work.id,title:work.title,progress:work.progress,thumbnail:work.thumbnail,updated:work.updated};}
  function drawingState(work){
    const {mask,maskBits,progress,thumbnail,updated,replayData,paintTime,quotaCharged,followPrompted,completionNotified}=work;
    return {mask,maskBits,progress,thumbnail,updated,replayData,paintTime,quotaCharged,followPrompted,completionNotified};
  }
  function replayKey(key,i){return key+'-replay-'+i;}
  async function trimReplay(key,start,count){for(let i=start;i<count;i++)try{await remove(replayKey(key,i));}catch(e){}}
  // Built-in artwork resolves from the packaged template. Photo templates are written once.
  async function save(work){
    const key=PREFIX+work.id,previous=await get(key),stamp=String(Date.now())+'-'+Math.random().toString(36).slice(2,6),chunkKeys=[];
    let filePath='',manifest;
    try{
      if(work.galleryKey){
        const {id,title,created,origin,galleryId,galleryKey}=work;
        manifest={gallery:{id,title,created,origin,galleryId,galleryKey},checkpoint:drawingState(work)};
        if(backend==='xhs'&&JSON.stringify(manifest).length>KEY_LIMIT){
          manifest.checkpoint.replayData=null;
          manifest.checkpoint.replaySlots=0;
        }
      }else if(fileEnv){
        // ASCII JSON makes native byte offsets and UTF-8 chunk boundaries unambiguous.
        const ascii=JSON.stringify(work).replace(/[^\x00-\x7f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
        // Native filesystem components have a short-name limit; identity stays in the manifest.
        filePath=fileEnv.root+'/oil-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)+'.json';
        for(let p=0;p<ascii.length;p+=fileEnv.write){const args={filePath,data:ascii.slice(p,p+fileEnv.write),encoding:'utf8'};if(p===0)await mini.writeFile(args);else await mini.appendFile(args);}
        manifest={filePath};
      }else{
        const serialized=JSON.stringify(work);
        for(let p=0;p<serialized.length;p+=CHUNK_SIZE){const ck=key+'-'+stamp+'-'+chunkKeys.length;await set(ck,serialized.slice(p,p+CHUNK_SIZE));chunkKeys.push(ck);}
        manifest={chunks:chunkKeys};
      }
      const index=await get(INDEX)||[];
      const entry=summary(work);
      if(manifest.gallery)entry.thumbnail='./resources/'+work.galleryId+'.webp';
      const next=index.filter(item=>item.id!==work.id);next.unshift(entry);
      await set(key,manifest);
      try{await set(INDEX,next);}catch(error){if(previous)await set(key,previous);else await remove(key);throw error;}
    }catch(error){for(const ck of chunkKeys)try{await remove(ck);}catch(e){}if(filePath)try{await mini.unlink({filePath});}catch(e){}throw error;}
    manifests.set(work.id,manifest);
    if(previous&&previous.chunks)for(const ck of previous.chunks)try{await remove(ck);}catch(e){}
    if(previous&&previous.filePath)try{await mini.unlink({filePath:previous.filePath});}catch(e){}
    if(previous&&previous.checkpoint)await trimReplay(key,0,previous.checkpoint.replaySlots||0);
    if(manifest.gallery&&manifest.checkpoint.replayData===null)return saveProgress(work.id,work);
    return true;
  }
  async function saveProgress(id,changes){
    const key=PREFIX+id,previous=manifests.get(id)||await get(key);
    if(!previous)throw new Error('画稿尚未存入画册');
    const oldSlots=previous.checkpoint&&previous.checkpoint.replaySlots||0;
    const checkpoint=drawingState(changes);
    const next=Object.assign({},previous,{checkpoint});
    let replay='',slots=0;
    if(backend==='xhs'&&JSON.stringify(next).length>KEY_LIMIT){
      replay=JSON.stringify(checkpoint.replayData);
      slots=Math.ceil(replay.length/CHUNK_SIZE);
      checkpoint.replayData=null;
    }
    // Commit the exact mask first. A close during a large replay write can only interrupt replay.
    checkpoint.replaySlots=Math.max(oldSlots,slots);
    await set(key,next);
    manifests.set(id,next);
    if(slots){
      try{
        for(let i=0;i<slots;i++)await set(replayKey(key,i),replay.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE));
        const complete=Object.assign({},next,{checkpoint:Object.assign({},checkpoint,{replayParts:slots})});
        await set(key,complete);
        manifests.set(id,complete);
      }catch(e){return false;}
    }
    await trimReplay(key,slots,oldSlots);
    return true;
  }
  async function load(id){const key=PREFIX+id,manifest=await get(key);if(!manifest)return null;const chunks=[];
    if(manifest.filePath){if(!fileEnv)throw new Error('当前客户端无法读取文件存档，请升级后重试');let position=0;
      for(let i=0;i<1024;i++){const r=await mini.readFile({filePath:manifest.filePath,encoding:'utf8',position,length:fileEnv.read});chunks.push(r.data);position+=r.bytesRead;if(r.eof)break;if(!r.bytesRead||i===1023)throw new Error('存档读取未完成');}
    }else if(!manifest.gallery)for(const ck of manifest.chunks){const chunk=await get(ck);if(typeof chunk!=='string')throw new Error('存档不完整，请重新生成');chunks.push(chunk);}
    const saved=manifest.gallery||JSON.parse(chunks.join(''));
    manifests.set(id,manifest);
    if(!manifest.checkpoint)return saved;
    const checkpoint=drawingState(manifest.checkpoint),replayParts=manifest.checkpoint.replayParts;
    if(replayParts)try{
      const parts=[];
      for(let i=0;i<replayParts;i++){const part=await get(replayKey(key,i));if(typeof part!=='string')throw new Error('回放记录不完整');parts.push(part);}
      checkpoint.replayData=JSON.parse(parts.join(''));
    }catch(e){checkpoint.replayData=null;}
    return Object.assign({},saved,checkpoint);
  }
  async function list(){
    const index=await get(INDEX)||[];
    const latest=await Promise.all(index.map(async entry=>{
      try{
        const manifest=await get(PREFIX+entry.id);
        if(manifest&&manifest.checkpoint)return summary(Object.assign({},entry,manifest.checkpoint));
      }catch(error){console.warn('画册摘要读取失败',entry.id,error);}
      return entry;
    }));
    return latest.sort((a,b)=>b.updated-a.updated);
  }
  async function del(id){const key=PREFIX+id,manifest=await get(key);const next=(await get(INDEX)||[]).filter(w=>w.id!==id);await set(INDEX,next);if(manifest&&manifest.chunks)for(const ck of manifest.chunks)await remove(ck);if(manifest&&manifest.filePath)await mini.unlink({filePath:manifest.filePath});if(manifest&&manifest.checkpoint)await trimReplay(key,0,manifest.checkpoint.replaySlots||0);await remove(key);manifests.delete(id);}
  async function saveImage(data){
    if(mini&&typeof mini.saveImageToPhotosAlbum==='function'&&(version===0||version>=9420)){
      let path=data;if(typeof mini.writeTempFile==='function'){const r=await mini.writeTempFile({data});path=r.filePath;}await mini.saveImageToPhotosAlbum({filePath:path});return true;
    }
    return false;
  }
  async function windowInfo(){if(version>=9490&&mini&&typeof mini.getWindowInfo==='function')try{return await mini.getWindowInfo();}catch(e){}return null;}
  function preferenceKey(key){if(!/^[a-z][a-z0-9-]{0,40}$/.test(key))throw new Error('设置名称无效');return PREFIX+'setting-'+key;}
  async function getPreference(key){return get(preferenceKey(key));}
  async function setPreference(key,value){return set(preferenceKey(key),value);}
  root.OilStore={init,save,saveProgress,load,list,del,saveImage,windowInfo,getPreference,setPreference,backend:()=>backend};
})(window);
