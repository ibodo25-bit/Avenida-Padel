/** Sincronización confirmada por servidor; las copias locales no son la autoridad. */
export const ROOT_PATH='clubs/avenida-padel';
export const DATA_KEYS=['entries','clients','products','bookings'];
export class SyncConflict extends Error {constructor(){super('Llegaron cambios de otro dispositivo. Revisá los datos actualizados y volvé a guardar.');this.code='sync/conflict'}}
export function emptyState(){return {version:1,entries:[],clients:[],products:[],bookings:[],settings:{logo:'',startMonth:'2026-10',gymHistoryImported:false}}}
export function recordsOf(data){const out=new Map();for(const kind of DATA_KEYS)for(const item of data[kind]||[])out.set(kind+'-'+item.id,{kind,value:item});return out}
export function decodeRecords(snapshot,normalize){let meta=null;const data=emptyState();for(const doc of snapshot.docs){const value=doc.data();if(doc.id==='_meta')meta=value;else if(DATA_KEYS.includes(value.kind))data[value.kind].push(value.value);else throw Error('Documento no reconocido en la base')}if(!meta)return null;data.settings=meta.settings||{};return {revision:meta.revision,data:normalize(data)}}
export function createSyncEngine({sdk,db,normalize,applyOperation,events={}}){
 const {doc,collection,onSnapshot,runTransaction,writeBatch,getDoc,serverTimestamp}=sdk;
 const headRef=doc(db,ROOT_PATH+'/control/current');
 let generation=null,revision=-1,data=emptyState(),stopHead=null,stopRecords=null,active=true,ready=false,headEpoch=0,pending=false;
 const emit=(name,...args)=>{if(active)events[name]?.(...args)};
 const recordRef=(gen,id)=>doc(db,ROOT_PATH+'/datasets/'+gen+'/records/'+id);
 const recordsRef=gen=>collection(db,ROOT_PATH+'/datasets/'+gen+'/records');
 function assertOnline(){if(!active)throw Error('La sesión terminó');if(globalThis.navigator?.onLine===false)throw Error('Sin conexión. Este cambio no se guardó. Volvé a intentarlo con Internet.');if(pending)throw Error('Hay otro guardado en curso. Esperá a que termine.')}
 function start(){
  stopHead=onSnapshot(headRef,{includeMetadataChanges:true},head=>{
   if(!active||head.metadata.fromCache||head.metadata.hasPendingWrites)return;
   const next=head.exists()?head.data().generation:null;
   if(next===generation&&ready)return;
   if(next===generation&&stopRecords)return;
   headEpoch++;const epoch=headEpoch;stopRecords?.();stopRecords=null;ready=false;generation=next;revision=-1;data=emptyState();
   if(!next){emit('empty');return}
   emit('status','Conectando con los datos…');
   stopRecords=onSnapshot(recordsRef(next),{includeMetadataChanges:true},snapshot=>{
    if(!active||epoch!==headEpoch||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
    try{const decoded=decodeRecords(snapshot,normalize);if(!decoded)throw Error('No se encontró el estado del club.');if(decoded.revision<revision)return;revision=decoded.revision;data=decoded.data;ready=true;emit('data',structuredClone(data));emit('status','Sincronizado');}catch(error){ready=false;emit('error',error)}
   },error=>{if(epoch===headEpoch){ready=false;emit('error',error)}});
  },error=>{ready=false;emit('error',error)});
 }
 async function change(operation){
  assertOnline();if(!ready)throw Error('Esperá a que se complete la conexión a la nube.');
  const base=structuredClone(data),baseRevision=revision,baseGeneration=generation,epoch=headEpoch;
  const candidate=normalize(await operation(structuredClone(base)));
  const previous=recordsOf(base),next=recordsOf(candidate),changed=[];
  for(const [id,value] of next)if(JSON.stringify(value)!==JSON.stringify(previous.get(id)))changed.push({id,value});
  for(const id of previous.keys())if(!next.has(id))changed.push({id,remove:true});
  if(changed.length>450)throw Error('Son demasiados cambios para un guardado. Usá Importar respaldo para reemplazar el conjunto completo.');
  pending=true;emit('status','Guardando…');
  try{
   await runTransaction(db,async tx=>{
    const head=await tx.get(headRef),meta=await tx.get(recordRef(baseGeneration,'_meta'));
    if(!head.exists()||head.data().generation!==baseGeneration||!meta.exists()||meta.data().revision!==baseRevision)throw new SyncConflict();
    for(const item of changed){const ref=recordRef(baseGeneration,item.id);if(item.remove)tx.delete(ref);else tx.set(ref,item.value)}
    tx.set(recordRef(baseGeneration,'_meta'),{revision:baseRevision+1,settings:candidate.settings,updatedAt:serverTimestamp()});
   });
   if(!active||epoch!==headEpoch)throw Error('La sesión o los datos activos cambiaron durante el guardado.');
   if(revision<=baseRevision+1){data=candidate;revision=baseRevision+1;emit('data',structuredClone(data))}
   emit('status','Guardado en la nube');return {ok:true};
  }catch(error){emit('status',error.code==='sync/conflict'?'Datos actualizados: revisá y reintentá':'No se pudo guardar');throw error}finally{pending=false}
 }
 async function replace(input){
  assertOnline();const candidate=normalize(input),baseGeneration=generation,baseRevision=revision;
  if(baseGeneration&&!ready)throw Error('Esperá a que se sincronicen los datos antes de importar.');
  const nextGeneration=globalThis.crypto.randomUUID(),records=recordsOf(candidate);
  records.set('_meta',{revision:0,settings:candidate.settings,updatedAt:serverTimestamp()});
  const values=[...records];pending=true;emit('status','Subiendo respaldo…');
  try{
   for(let i=0;i<values.length;i+=400){if(!active)throw Error('La sesión terminó.');const batch=writeBatch(db);for(const [id,value] of values.slice(i,i+400))batch.set(recordRef(nextGeneration,id),value);await batch.commit()}
   await runTransaction(db,async tx=>{
    const current=await tx.get(headRef);
    if((current.exists()?current.data().generation:null)!==baseGeneration)throw new SyncConflict();
    if(baseGeneration){const previousMeta=await tx.get(recordRef(baseGeneration,'_meta'));if(!previousMeta.exists()||previousMeta.data().revision!==baseRevision)throw new SyncConflict()}
    tx.set(headRef,{generation:nextGeneration,schemaVersion:1,updatedAt:serverTimestamp()});
   });
   emit('status','Importación confirmada en la nube');return {ok:true};
  }catch(error){emit('status','Importación no aplicada');throw error}finally{pending=false}
 }
 function close(){active=false;ready=false;headEpoch++;stopHead?.();stopRecords?.();generation=null;revision=-1;data=emptyState()}
 return {start,close,replace,post:(url,input)=>change(base=>applyOperation(base,url,input)),change,get ready(){return ready},get current(){return structuredClone(data)}};
}
