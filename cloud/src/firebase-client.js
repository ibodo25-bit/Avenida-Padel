import {initializeApp} from 'firebase/app';
import {getAuth,setPersistence,browserSessionPersistence,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,doc,collection,onSnapshot,runTransaction,writeBatch,getDoc,serverTimestamp} from 'firebase/firestore';
import {createSyncEngine,emptyState} from './sync-engine.js';
const firebaseConfig={apiKey:'AIzaSyAXMIUcmgHAgLmmJe9W7hRuP6ttwYmG_-o',authDomain:'avenida-padel.firebaseapp.com',projectId:'avenida-padel',storageBucket:'avenida-padel.firebasestorage.app',messagingSenderId:'579880979414',appId:'1:579880979414:web:7a6245e20eaf6abf75b277'};
const AUTHORIZED_UID='cVO9GozjI7O98zuswrSWH2xpfa23';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const sdk={doc,collection,onSnapshot,runTransaction,writeBatch,getDoc,serverTimestamp};
let engine=null,session=0,firstRender=true;
const el=id=>document.getElementById(id);
function status(message){el('cloud-status').textContent=message;el('cloud-status').setAttribute('role','status')}
function message(error){const code=error?.code||'';if(code.includes('permission-denied'))return 'Acceso denegado. Verificá el usuario autorizado y las reglas publicadas.';if(code.includes('resource-exhausted')||code.includes('quota'))return 'Se alcanzó una cuota del servicio. El cambio no está confirmado. Conservá un respaldo y reintentá más tarde.';if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'Correo o contraseña incorrectos.';if(code.includes('network')||code==='unavailable')return 'No hay conexión con Firebase. No se confirmó el guardado.';if(code.includes('too-many-requests'))return 'Demasiados intentos. Esperá unos minutos antes de reintentar.';return error?.message||'No se pudo completar la operación.'}
function paint(initial=false){
 state.entries.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||b.id-a.id);
 if(initial||!el('month').value){const days=state.entries.filter(e=>e.kind==='income').map(e=>e.date).sort();const fallback=state.settings?.startMonth?state.settings.startMonth+'-01':todayLocal();const day=[days.at(-1)||'',fallback].sort().at(-1);el('month').value=el('period').value==='month'?day.slice(0,7):day}
 render();applyLogo();
}
function showState(value){state=value;paint(firstRender);firstRender=false;el('cloud-initial').hidden=true;el('cloud-export').disabled=false;el('import-backup').disabled=false}
window.Cloud={
 load:async initial=>{if(engine?.ready)paint(initial)},
 post:async(url,data)=>{if(!engine)throw Error('Primero iniciá sesión');try{return await engine.post(url,data)}catch(e){throw Error(message(e))}},
 import:async file=>{
  if(!file)return;
  try{if(!engine)throw Error('Primero iniciá sesión');if(file.size>25000000)throw Error('El respaldo supera 25 MB.');const candidate=normalizeBackup(JSON.parse(await file.text()));
   if(!confirm(`Se cargarán ${candidate.entries.length} movimientos, ${candidate.clients.length} clientes y ${candidate.bookings.length} reservas. Si ya hay datos en la nube, este respaldo los REEMPLAZARÁ para todos los dispositivos. ¿Continuar?`))return;
   await engine.replace(candidate);el('notice').textContent='Respaldo importado en la nube. Los otros dispositivos recibirán la actualización.';
  }catch(e){el('notice').textContent=message(e)}finally{el('import-json').value=''}
 },
 saveLogo:async file=>{
  if(!file)return;
  try{if(!engine?.ready)throw Error('Esperá la sincronización antes de cambiar el logo.');const logo=await readCloudLogo(file);await engine.change(base=>{base.settings={...base.settings,logo};return base});el('notice').textContent='Logo guardado en la nube para todos los dispositivos.'}catch(e){el('notice').textContent=message(e)}finally{el('logo-file').value=''}
 }
};
function readCloudLogo(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15000000)return Promise.reject(Error('Elegí una imagen PNG, JPG o WebP de hasta 15 MB.'));
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer el logo'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(Error('No se pudo abrir el logo'));image.onload=()=>{try{const scale=Math.min(1,700/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.88))}catch{reject(Error('No se pudo preparar el logo'))}};image.src=reader.result};reader.readAsDataURL(file)})
}
el('cloud-login').onsubmit=async e=>{e.preventDefault();const button=el('cloud-login-button');button.disabled=true;el('cloud-auth-error').textContent='';try{await signInWithEmailAndPassword(auth,el('cloud-email').value.trim(),el('cloud-password').value)}catch(error){el('cloud-auth-error').textContent=message(error)}finally{el('cloud-password').value='';button.disabled=false}};
el('cloud-logout').onclick=async()=>{try{await signOut(auth)}catch(e){el('notice').textContent=message(e)}};
el('cloud-initialize-empty').onclick=async()=>{if(!confirm('¿Iniciar la nube vacía? Luego podés importar un respaldo JSON.'))return;try{await engine.replace(emptyState())}catch(e){el('notice').textContent=message(e)}};
el('cloud-initialize-import').onclick=()=>el('import-json').click();
el('cloud-export').onclick=()=>exportBackup();
window.addEventListener('offline',()=>status('Sin conexión · los nuevos cambios no se guardarán'));
window.addEventListener('online',()=>status('Reconectando…'));
async function bootAuth(){try{
 await setPersistence(auth,browserSessionPersistence);
 onAuthStateChanged(auth,async user=>{
  const current=++session;engine?.close();engine=null;firstRender=true;state=emptyState();el('content').textContent='';el('notice').textContent='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.body.classList.add('cloud-locked');el('cloud-initial').hidden=true;el('cloud-export').disabled=true;
  if(!user){status('Sin sesión');return}
  if(user.uid!==AUTHORIZED_UID){await signOut(auth);el('cloud-auth-error').textContent='Este usuario no está autorizado para Avenida Pádel.';return}
  el('cloud-auth-error').textContent='';document.body.classList.remove('cloud-locked');
  engine=createSyncEngine({sdk,db,normalize:normalizeBackup,applyOperation:applyCloudOperation,events:{
   data:value=>{if(session===current)showState(value)},
   empty:()=>{if(session!==current)return;state=emptyState();paint(true);el('cloud-initial').hidden=false;status('Sin datos en la nube · importá tu respaldo')},
   status:value=>{if(session===current)status(value)},
   error:error=>{if(session===current){status('Conexión no disponible');el('notice').textContent=message(error)}}
  }});engine.start();
 },error=>{el('cloud-auth-error').textContent=message(error)});
}catch(error){el('cloud-auth-error').textContent=message(error)}
}
bootAuth();
