const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM,VirtualConsole}=require('jsdom');
const {mockFirestore}=require('./mock-firestore.cjs');
const base=path.join(__dirname,'..'),html=fs.readFileSync(path.join(base,'public/index.html'),'utf8'),app=fs.readFileSync(path.join(base,'public/app.js'),'utf8'),backup=fs.existsSync(path.join(base,'private/datos-iniciales.json'))?JSON.parse(fs.readFileSync(path.join(base,'private/datos-iniciales.json'),'utf8')):{version:1,entries:[],clients:[{id:1,name:'Cliente de prueba'}],products:[{id:1,name:'Producto de prueba',price:100}],bookings:[],settings:{logo:'data:image/jpeg;base64,AA==',startMonth:'2026-10'}};
const tick=()=>new Promise(r=>setTimeout(r,25));
test('los archivos públicos no contienen el historial, ni scripts del entorno de chat',()=>{
 const dom=new JSDOM(html);assert.equal(dom.window.document.scripts.length,2);assert(dom.window.document.body.classList.contains('cloud-locked'));assert.equal(dom.window.document.querySelector('#content').textContent,'');assert(!html.includes('__codexVisualization'));assert(!html.includes('$5.416.745'));assert(!html.includes('373 turnos'));assert(!app.includes('495000'));assert(!app.includes('$495.000'));assert(!app.includes('507642'));assert(!app.includes('Cuotas octubre'));
 const seed=JSON.parse(app.match(/^const SEED_DATA=(.*?);\n/)[1]);assert.equal(seed.entries.length,0);assert.equal(seed.clients.length,0);assert.equal(seed.bookings.length,0);assert.equal(seed.settings.logo,'');
 const normalized=dom.window.document.querySelector('.brand img').src;assert(normalized.startsWith('data:image/'));dom.window.close();
});
test('login, importación privada, alta financiera, sincronización y cierre de sesión',async()=>{
 const {createSyncEngine,emptyState}=await import('../src/sync-engine.js');let errors=[],authListener=null;const mock=mockFirestore(),vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const inline=html.replace('<script src="/app.js"></script>',()=>'<script>'+app.replace(/<\/script/gi,'<\\/script')+'</script>').replace('<script type="module" src="/cloud.js"></script>','');
 const dom=new JSDOM(inline,{runScripts:'dangerously',url:'https://avenida-padel.web.app',virtualConsole:vc,beforeParse(w){w.confirm=()=>true;w.structuredClone=structuredClone;w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLDialogElement.prototype.showModal=function(){this.open=true}}});
 const w=dom.window;Object.assign(w,{initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),setPersistence:async()=>{},browserSessionPersistence:{},onAuthStateChanged:(a,fn)=>{authListener=fn;fn(null)},signInWithEmailAndPassword:async()=>authListener({uid:'cVO9GozjI7O98zuswrSWH2xpfa23'}),signOut:async()=>authListener(null),createSyncEngine,emptyState,...mock.sdk});
 let client=fs.readFileSync(path.join(base,'src/firebase-client.js'),'utf8').replace(/^import .*;\n/gm,'');
 await w.eval('(async()=>{'+client+'})()');await tick();assert(w.document.body.classList.contains('cloud-locked'));
 await authListener({uid:'not-authorized'});await tick();assert(w.document.body.classList.contains('cloud-locked'));assert(w.document.querySelector('#cloud-auth-error').textContent.includes('no está autorizado'));
 await authListener({uid:'cVO9GozjI7O98zuswrSWH2xpfa23'});await tick();assert(!w.document.body.classList.contains('cloud-locked'));assert(!w.document.querySelector('#cloud-initial').hidden);
 const result=await w.Cloud.import({size:1000,text:async()=>JSON.stringify(backup)});await tick();assert(w.document.querySelector('#cloud-initial').hidden);assert.equal(w.eval('state.entries.length'),backup.entries.length);assert.equal(w.eval('state.settings.logo'),backup.settings.logo);
 await w.Cloud.post('/api/entries',{kind:'expense',activity:'padel',date:'2026-10-26',concept:'Prueba nube',amount:1200,paymentMethod:'Efectivo'});await tick();assert(w.eval("state.entries.some(e=>e.concept==='Prueba nube')"));assert(w.document.querySelector('#cloud-status').textContent.match(/Sincronizado|Guardado/));
 await authListener(null);await tick();assert(w.document.body.classList.contains('cloud-locked'));assert.equal(w.eval('state.entries.length'),0);assert.equal(w.document.querySelector('#content').textContent,'');assert.deepEqual(errors,[]);dom.window.close();
});
