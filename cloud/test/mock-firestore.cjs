function mockFirestore(){
 const data=new Map(),listeners=new Set();let failureBatch=0,batchCalls=0,beforeTransaction=null;
 const clone=v=>v===undefined?undefined:structuredClone(v);
 const snap=(id,value)=>({id,metadata:{fromCache:false,hasPendingWrites:false},exists:()=>value!==undefined,data:()=>clone(value)});
 function emit(){for(const l of listeners){if(l.collection){const docs=[];for(const [key,value]of data)if(key.startsWith(l.path+'/')&&!key.slice(l.path.length+1).includes('/'))docs.push(snap(key.slice(l.path.length+1),value));l.callback({docs,metadata:{fromCache:false,hasPendingWrites:false}})}else l.callback(snap(l.path.split('/').at(-1),data.get(l.path)))}}
 const sdk={doc:(_,p)=>p,collection:(_,p)=>p,serverTimestamp:()=>0,getDoc:async ref=>snap(ref.split('/').at(-1),data.get(ref)),
 onSnapshot:(ref,opts,callback,error)=>{const l={path:ref,collection:ref.endsWith('/records'),callback,error};listeners.add(l);queueMicrotask(()=>{if(listeners.has(l))emit()});return()=>listeners.delete(l)},
 writeBatch:()=>{const changes=[];return {set:(ref,v)=>changes.push([ref,v]),commit:async()=>{batchCalls++;if(failureBatch===batchCalls)throw Error('falló el lote');for(const [k,v]of changes)data.set(k,clone(v));queueMicrotask(emit)}}},
 runTransaction:async(_,fn)=>{if(beforeTransaction){const cb=beforeTransaction;beforeTransaction=null;cb()};const changes=[];const result=await fn({get:async ref=>snap(ref.split('/').at(-1),data.get(ref)),set:(ref,v)=>changes.push([ref,v]),delete:ref=>changes.push([ref,undefined])});for(const [k,v]of changes){if(v===undefined)data.delete(k);else data.set(k,clone(v))}queueMicrotask(emit);return result}
 };
 return {data,sdk,emit,failBatch:n=>{failureBatch=n;batchCalls=0},before:cb=>beforeTransaction=cb};
}
module.exports={mockFirestore};
