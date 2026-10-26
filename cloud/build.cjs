const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const root=__dirname,template=path.join(root,'private','template.html');
if(!fs.existsSync(template)){
 if(!fs.existsSync(path.join(root,'public','index.html'))||!fs.existsSync(path.join(root,'public','app.js')))throw Error('Falta la interfaz de la aplicación.');
 console.log('Se conserva la interfaz publicable existente; no se requiere una plantilla con datos privados.');
 return;
}
const source=fs.readFileSync(template,'utf8');
const dom=new JSDOM(source),d=dom.window.document;
const original=[...d.scripts].find(s=>s.textContent.startsWith('const SEED_DATA='));if(!original)throw Error('Falta aplicación original');
let script=original.textContent;const backup=JSON.parse(script.match(/^const SEED_DATA=(.*?);\n/)[1]);
fs.mkdirSync(path.join(root,'private'),{recursive:true});fs.writeFileSync(path.join(root,'private','datos-iniciales.json'),JSON.stringify(backup,null,2));
const empty={version:1,entries:[],clients:[],products:[],bookings:[],settings:{logo:'',startMonth:'2026-10',gymHistoryImported:false}};
script=script.replace(/^const SEED_DATA=.*?;\n/,()=> 'const SEED_DATA='+JSON.stringify(empty)+';\n');
const begin=script.indexOf('async function offlinePost(url,data){'),end=script.indexOf('\nfunction exportCSV()',begin);
if(begin<0||end<0)throw Error('No se pudo extraer la lógica de operaciones');
let operation=script.slice(begin,end).replace('async function offlinePost(url,data){','function applyCloudOperation(base,url,data){').replace('const next=clone(state);','const next=clone(base);').replace('state=persist(next);return {ok:true};','return next;');
if(operation.includes('persist(next)'))throw Error('Operación no independiente');
script+='\n'+operation;
script=script.replace(/async function load\(initial=false\)\{return offlineLoad\(initial\)\}/,"async function load(initial=false){if(window.Cloud)return window.Cloud.load(initial)}");
script=script.replace(/async function post\(url,data\)\{return offlinePost\(url,data\)\}/,"async function post(url,data){if(!window.Cloud)throw Error('Esperá a que cargue la conexión');return window.Cloud.post(url,data)}");
let a=script.indexOf('async function importBackup(file){'),b=script.indexOf('\nasync function offlineLoad',a);
script=script.slice(0,a)+"async function importBackup(file){return window.Cloud?.import(file)}\n"+script.slice(b);
a=script.indexOf('async function saveLogo(file){');b=script.indexOf('\nfunction exportPortableHTML()',a);
script=script.slice(0,a)+"async function saveLogo(file){return window.Cloud?.saveLogo(file)}\n"+script.slice(b);
a=script.indexOf('function exportPortableHTML(){');b=script.indexOf('\nfunction validateBookings',a);
script=script.slice(0,a)+"function exportPortableHTML(){exportBackup()}\n"+script.slice(b);
// No fallback to local storage: una escritura local nunca se presenta como guardado en nube.
a=script.indexOf('function persist(candidate){');b=script.indexOf('\nfunction downloadFile(',a);
script=script.slice(0,a)+"function persist(){throw Error('Esta versión guarda exclusivamente en Firebase.')}\n"+script.slice(b);
script=script.replace(/window\.addEventListener\('storage',[^\n]+\n/g,'');
// Eliminar migraciones locales y notas financieras incrustadas antes de publicar.
let localStart=script.indexOf('async function offlineLoad(initial=false){');
let localEnd=script.indexOf('\nfunction exportCSV()',localStart);
if(localStart>=0&&localEnd>=0)script=script.slice(0,localStart)+script.slice(localEnd);
let migrationStart=script.indexOf('function migrateGymHistory(data){');
let migrationEnd=script.indexOf('// Actividades separadas',migrationStart);
if(migrationStart>=0&&migrationEnd>=0)script=script.slice(0,migrationStart)+script.slice(migrationEnd);
script=script.replace(/<div class="note">Los ingresos históricos se importaron del RESUMEN ANUAL del Excel\.[\s\S]*?<\/div>/g,'<div class="note">Los ingresos históricos mensuales no informan fechas ni métodos de cobro. Las actividades se contabilizan por separado y se consolidan en el resumen.</div>');
d.querySelectorAll('details.note').forEach(e=>e.remove());
for(const s of [...d.scripts])s.remove();
d.querySelector('#content').textContent='';d.querySelector('#notice').textContent='';
d.querySelectorAll('#gym-dialog,#booking-dialog').forEach(e=>e.remove());
d.querySelectorAll('dialog').forEach(e=>e.removeAttribute('open'));
d.querySelectorAll('#client-list,#consume-product,#consumptions').forEach(e=>e.textContent='');
d.querySelectorAll('input').forEach(e=>{if(!['hidden','number','file'].includes(e.type))e.removeAttribute('value')});
d.querySelector('#export-html').textContent='Exportar copia de datos';
d.querySelector('footer').textContent='Avenida Pádel · Guardado compartido en Firebase · Requiere Internet · Exportá respaldos JSON periódicamente';
const extra=d.createElement('style');extra.textContent=`
.cloud-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px;flex-wrap:wrap}.cloud-top span{font-size:12px;color:#ffad6b}.cloud-top button{font-size:11px}.cloud-locked main,.cloud-locked aside{display:none}#cloud-gate{display:none;min-height:100vh;padding:30px;align-items:center;justify-content:center}.cloud-locked #cloud-gate{display:flex}.cloud-login-card{width:100%;max-width:420px;background:#1d1e23;border:1px solid #49413a;border-radius:16px;padding:30px}.cloud-login-card h1{font-size:27px}.cloud-login-card form{display:grid;gap:18px}.cloud-login-card p{line-height:1.7;color:#c7beb5;font-size:13px}.cloud-login-card button{background:#f47721;color:#141414;font-weight:bold}.cloud-login-card img{max-width:100%;max-height:140px;object-fit:contain}.cloud-login-card #cloud-auth-error{color:#ffb078}#cloud-initial[hidden]{display:none}#cloud-initial{padding:24px;margin-bottom:24px;border:1px solid #a66432;border-radius:10px;background:#30221a}#cloud-initial p{line-height:1.7}#cloud-initial button{margin:6px 10px 6px 0}button:disabled{opacity:.55;cursor:wait}`;
d.head.append(extra);d.title='Avenida Pádel · Gestión en la nube';
const gate=d.createElement('section');gate.id='cloud-gate';gate.innerHTML=`<div class="cloud-login-card"><h1>AVENIDA PÁDEL</h1><p>Iniciá sesión para acceder a los turnos y las finanzas del club.</p><form id="cloud-login"><label>Correo electrónico<input id="cloud-email" type="email" autocomplete="username" required></label><label>Contraseña<input id="cloud-password" type="password" autocomplete="current-password" required></label><p id="cloud-auth-error" role="alert"></p><button id="cloud-login-button" type="submit">Ingresar</button></form><p>Solo usuarios autorizados. No necesitás ingresar datos de pago.</p></div>`;
const logo=d.querySelector('.brand img');if(logo){gate.querySelector('.cloud-login-card').prepend(logo.cloneNode(true))}
d.body.classList.add('cloud-locked');d.body.prepend(gate);
const main=d.querySelector('main');main.insertAdjacentHTML('afterbegin',`<div class="cloud-top"><span id="cloud-status" role="status">Iniciá sesión</span><div><button id="cloud-export" disabled>Exportar respaldo JSON</button> <button id="cloud-logout">Cerrar sesión</button></div></div><section id="cloud-initial" hidden><h2>Tu nube todavía está vacía</h2><p>Importá el respaldo JSON más reciente de tu app local. La importación incluye logo, movimientos, clientes, productos y reservas. No cargamos datos históricos sin que elijas el archivo.</p><button id="cloud-initialize-import" class="primary">Importar respaldo JSON</button><button id="cloud-initialize-empty">Empezar sin datos</button></section>`);
const app=d.createElement('script');app.src='/app.js';d.body.append(app);const cloud=d.createElement('script');cloud.type='module';cloud.src='/cloud.js';d.body.append(cloud);
fs.mkdirSync(path.join(root,'public'),{recursive:true});fs.writeFileSync(path.join(root,'public','index.html'),'<!doctype html>\n'+d.documentElement.outerHTML.replace(/[ \t]+$/gm,''));
fs.writeFileSync(path.join(root,'public','app.js'),script);
fs.writeFileSync(path.join(root,'private','apply-operation.js'),operation);
dom.window.close();console.log('Interfaz preparada sin datos financieros públicos. Respaldo separado en private/.');
