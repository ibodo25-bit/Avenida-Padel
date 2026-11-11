import {initializeApp} from 'firebase/app';
import {getAuth,setPersistence,browserSessionPersistence,onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,doc,collection,onSnapshot,runTransaction,writeBatch,getDoc,serverTimestamp,query,where,setDoc} from 'firebase/firestore';
import {createSyncEngine,emptyState} from './sync-engine.js';
import {STAFF_VIEWS} from './access-model.js';
const firebaseConfig={apiKey:'AIzaSyAXMIUcmgHAgLmmJe9W7hRuP6ttwYmG_-o',authDomain:'avenida-padel.firebaseapp.com',projectId:'avenida-padel',storageBucket:'avenida-padel.firebasestorage.app',messagingSenderId:'579880979414',appId:'1:579880979414:web:7a6245e20eaf6abf75b277'};
const AUTHORIZED_UID='cVO9GozjI7O98zuswrSWH2xpfa23';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const sdk={doc,collection,onSnapshot,runTransaction,writeBatch,getDoc,serverTimestamp,query,where,setDoc};
let engine=null,session=0,firstRender=true,role=null,stopMember=null,stopMembers=null,memberList=[],loadedIdentity=null;
const el=id=>document.getElementById(id);
function status(message){el('cloud-status').textContent=message;el('cloud-status').setAttribute('role','status')}
function message(error){const code=error?.code||'';if(code.includes('permission-denied'))return 'Acceso denegado. Verificá el usuario autorizado y las reglas publicadas.';if(code.includes('resource-exhausted')||code.includes('quota'))return 'Se alcanzó una cuota del servicio. El cambio no está confirmado. Conservá un respaldo y reintentá más tarde.';if(code.includes('invalid-credential')||code.includes('wrong-password')||code.includes('user-not-found'))return 'Correo o contraseña incorrectos.';if(code.includes('network')||code==='unavailable')return 'No hay conexión con Firebase. No se confirmó el guardado.';if(code.includes('too-many-requests'))return 'Demasiados intentos. Esperá unos minutos antes de reintentar.';return error?.message||'No se pudo completar la operación.'}
function paint(initial=false){
 state.entries.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)||b.id-a.id);
 if(initial||!el('month').value){const days=state.entries.filter(e=>e.kind==='income').map(e=>e.date).sort();const fallback=state.settings?.startMonth?state.settings.startMonth+'-01':todayLocal();const day=[days.at(-1)||'',fallback].sort().at(-1);el('month').value=el('period').value==='month'?day.slice(0,7):day}
 render();applyLogo();
}
function showState(value){state=value;paint(firstRender);firstRender=false;el('cloud-initial').hidden=true;el('cloud-export').disabled=role!=='admin';el('import-backup').disabled=role!=='admin';applyPermissions()}
window.Cloud={
 get role(){return role},applyPermissions,renderAccess,
 load:async initial=>{if(engine?.ready)paint(initial)},
 post:async(url,data)=>{if(!engine)throw Error('Primero iniciá sesión');try{return await engine.post(url,data)}catch(e){throw Error(message(e))}},
 import:async file=>{
  if(!file)return;
  try{if(role!=='admin'||!engine)throw Error('Solo el administrador puede importar respaldos.');if(file.size>25000000)throw Error('El respaldo supera 25 MB.');const candidate=normalizeBackup(JSON.parse(await file.text()));
   if(!confirm(`Se cargarán ${candidate.entries.length} movimientos, ${candidate.clients.length} clientes y ${candidate.bookings.length} reservas. Si ya hay datos en la nube, este respaldo los REEMPLAZARÁ para todos los dispositivos. ¿Continuar?`))return;
   await engine.replace(candidate);el('notice').textContent='Respaldo importado en la nube. Los otros dispositivos recibirán la actualización.';
  }catch(e){el('notice').textContent=message(e)}finally{el('import-json').value=''}
 },
 saveLogo:async file=>{
  if(!file)return;
  try{if(role!=='admin')throw Error('Solo el administrador puede cambiar el logo.');if(!engine?.ready)throw Error('Esperá la sincronización antes de cambiar el logo.');const logo=await readCloudLogo(file);await engine.change(base=>{base.settings={...base.settings,logo};return base});el('notice').textContent='Logo guardado en la nube para todos los dispositivos.'}catch(e){el('notice').textContent=message(e)}finally{el('logo-file').value=''}
 }
};
function readCloudLogo(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15000000)return Promise.reject(Error('Elegí una imagen PNG, JPG o WebP de hasta 15 MB.'));
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer el logo'));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(Error('No se pudo abrir el logo'));image.onload=()=>{try{const scale=Math.min(1,700/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.88))}catch{reject(Error('No se pudo preparar el logo'))}};image.src=reader.result};reader.readAsDataURL(file)})
}
el('cloud-login').onsubmit=async e=>{e.preventDefault();const button=el('cloud-login-button');button.disabled=true;el('cloud-auth-error').textContent='';try{await signInWithEmailAndPassword(auth,el('cloud-email').value.trim(),el('cloud-password').value)}catch(error){el('cloud-auth-error').textContent=message(error)}finally{el('cloud-password').value='';button.disabled=false}};
el('cloud-logout').onclick=async()=>{try{await signOut(auth)}catch(e){el('notice').textContent=message(e)}};
el('cloud-initialize-empty').onclick=async()=>{if(role!=='admin')return;if(!confirm('¿Iniciar la nube vacía? Luego podés importar un respaldo JSON.'))return;try{await engine.replace(emptyState())}catch(e){el('notice').textContent=message(e)}};
el('cloud-initialize-import').onclick=()=>el('import-json').click();
el('cloud-export').onclick=()=>{if(role==='admin')exportBackup()};
window.addEventListener('offline',()=>status('Sin conexión · los nuevos cambios no se guardarán'));
window.addEventListener('online',()=>status('Reconectando…'));

function applyPermissions(){
 const staff=role==='staff';
 document.body.classList.toggle('staff-account',staff);
 document.querySelectorAll('nav button[data-view]').forEach(button=>button.classList.toggle('hidden',staff&&!STAFF_VIEWS.includes(button.dataset.view)));
 for(const id of ['cloud-export','export-html','export-backup','import-backup','choose-logo'])el(id)?.classList.toggle('hidden',staff);
 document.querySelectorAll('[data-export-csv],[data-export-backup],[data-entry-delete]').forEach(button=>button.classList.toggle('hidden',staff));
}
function renderAccess(){
 if(role!=='admin')return;
 el('title').textContent='ACCESOS';el('new').classList.add('hidden');el('month').parentElement.classList.add('hidden');el('period').parentElement.classList.add('hidden');document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='access'));
 el('content').innerHTML=`<section class="panel"><h2>Acceso de empleados</h2><p class="legend">Creá primero la cuenta en Firebase Authentication. Luego pegá aquí su UID para autorizar altas y ediciones de Turnos y cobros, Gastos, Productos y Clientes. No permite eliminaciones, Gym, Resumen, agenda ni respaldos completos.</p><p class="note">Si pueden consultar todos los cobros y gastos de Pádel, pueden calcular un resultado por su cuenta. El permiso restringe las secciones y los datos disponibles; no impide esa deducción.</p><form id="access-form" class="form-grid"><label class="wide">UID del usuario en Firebase<input name="uid" required maxlength="128" autocomplete="off"></label><label>Nombre visible<input name="displayName" value="Avenidapadel" required maxlength="100"></label><label>Correo de referencia<input name="email" type="email" required maxlength="254"></label><button class="primary" type="submit">Autorizar empleado</button></form><p id="access-error" role="alert"></p></section><section class="panel"><h2>Usuarios autorizados</h2>${memberList.length?memberList.map(m=>`<div class="split"><div><b>${esc(m.displayName||m.uid)}</b><p>${esc(m.email||'')} · ${m.enabled?'Habilitado':'Deshabilitado'}</p></div><button data-access-toggle="${esc(m.uid)}">${m.enabled?'Deshabilitar':'Habilitar'}</button></div>`).join(''):'<p class="empty">Todavía no hay empleados autorizados.</p>'}</section>`;
 el('access-form').onsubmit=grantStaff;
 document.querySelectorAll('[data-access-toggle]').forEach(button=>button.onclick=async()=>{const member=memberList.find(m=>m.uid===button.dataset.accessToggle);if(!member||!confirm((member.enabled?'¿Deshabilitar':'¿Habilitar')+' el acceso de '+member.displayName+'?'))return;button.disabled=true;try{if(!member.enabled)await prepareStaffData();await setDoc(doc(db,'clubs/avenida-padel/members/'+member.uid),{role:'staff',displayName:member.displayName,email:member.email,enabled:!member.enabled,updatedAt:serverTimestamp()})}catch(e){el('notice').textContent=message(e);button.disabled=false}});
 applyPermissions();
}
async function prepareStaffData(){
 if(role!=='admin'||!engine?.ready)throw Error('Esperá la sincronización de tu cuenta administradora.');
 if(engine.accessReady)return;
 if(!confirm('Para habilitar empleados se preparará una copia privada de los datos actuales, manteniendo todos los registros y el logo. No se importará ningún archivo antiguo. ¿Continuar?'))throw Error('Preparación cancelada.');
 const currentSession=session;await engine.replace(engine.current);
 await new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(currentSession!==session){clearInterval(timer);reject(Error('La sesión cambió.'));return}if(engine?.ready&&engine.accessReady){clearInterval(timer);resolve()}else if(Date.now()-start>20000){clearInterval(timer);reject(Error('Los datos siguen preparándose. Esperá y volvé a autorizar el usuario.'))}},100)});
}
async function grantStaff(event){
 event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;el('access-error').textContent='';
 const input=Object.fromEntries(new FormData(form)),uid=input.uid.trim();
 try{if(role!=='admin')throw Error('Solo el administrador puede autorizar usuarios.');if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||uid===AUTHORIZED_UID)throw Error('Pegá el UID de la cuenta del empleado, no el de tu cuenta administradora.');await prepareStaffData();await setDoc(doc(db,'clubs/avenida-padel/members/'+uid),{role:'staff',enabled:true,displayName:input.displayName.trim(),email:input.email.trim(),updatedAt:serverTimestamp()});el('notice').textContent='Usuario autorizado. Ya puede ingresar con el correo y contraseña creados en Firebase.'}catch(e){el('access-error')?el('access-error').textContent=message(e):el('notice').textContent=message(e)}finally{button.disabled=false}
}
async function bootAuth(){try{
 await setPersistence(auth,browserSessionPersistence);
 onAuthStateChanged(auth,async user=>{
  const current=++session;engine?.close();engine=null;stopMember?.();stopMember=null;stopMembers?.();stopMembers=null;role=null;memberList=[];firstRender=true;state=emptyState();el('content').textContent='';el('notice').textContent='';document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.body.classList.add('cloud-locked');el('cloud-initial').hidden=true;el('cloud-export').disabled=true;
  // Una identidad nueva no debe reutilizar la caché de Firestore de la cuenta anterior.
  if(loadedIdentity&&loadedIdentity!==user?.uid){location.reload();return;}
  if(!user){status('Sin sesión');return}
  try{
   if(user.uid===AUTHORIZED_UID)role='admin';
   else{const member=await getDoc(doc(db,'clubs/avenida-padel/members/'+user.uid));if(session!==current)return;if(!member.exists()||member.data().role!=='staff'||member.data().enabled!==true){await signOut(auth);el('cloud-auth-error').textContent='Este usuario no está autorizado para Avenida Pádel.';return}role='staff'}
   if(session!==current)return;
   if(role==='staff')view='income';else if(!['dashboard','income','expense','gym','bookings','products','clients','access'].includes(view))view='dashboard';
   loadedIdentity=user.uid;el('cloud-auth-error').textContent='';document.body.classList.remove('cloud-locked');applyPermissions();
   engine=createSyncEngine({sdk,db,normalize:normalizeBackup,applyOperation:applyCloudOperation,role,events:{
    data:value=>{if(session===current)showState(value)},
    empty:()=>{if(session!==current)return;state=emptyState();paint(true);el('cloud-initial').hidden=role!=='admin';status(role==='admin'?'Sin datos en la nube · importá tu respaldo':'El administrador debe preparar los datos del club.')},
    status:value=>{if(session===current)status(value)},
    error:error=>{if(session===current){status('Conexión no disponible');el('notice').textContent=message(error)}}
   }});engine.start();
   if(role==='staff')stopMember=onSnapshot(doc(db,'clubs/avenida-padel/members/'+user.uid),{includeMetadataChanges:true},snapshot=>{if(session!==current||snapshot.metadata.fromCache)return;if(!snapshot.exists()||snapshot.data().enabled!==true||snapshot.data().role!=='staff')void signOut(auth)},()=>{if(session===current)void signOut(auth)});
   else stopMembers=onSnapshot(collection(db,'clubs/avenida-padel/members'),{includeMetadataChanges:true},snapshot=>{if(session!==current)return;memberList=snapshot.docs.map(d=>({...d.data(),uid:d.id}));if(view==='access')renderAccess()},e=>{if(session===current)el('notice').textContent=message(e)});
  }catch(error){if(session===current){await signOut(auth);el('cloud-auth-error').textContent=message(error)}}
 },error=>{el('cloud-auth-error').textContent=message(error)});
}catch(error){el('cloud-auth-error').textContent=message(error)}
}
bootAuth();
