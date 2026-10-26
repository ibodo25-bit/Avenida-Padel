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
 // Edición de gastos: fecha, concepto, categoría, importe y método.
 await w.Cloud.post('/api/entries',{kind:'expense',date:'2026-10-26',concept:'Materiales prueba',category:'Insumos',amount:2500,paymentMethod:'',details:JSON.stringify({metodo_original:'Credicoop',nota:'Referencia histórica'})});await tick();
 const expenseId=w.eval("state.entries.find(e=>e.concept==='Materiales prueba').id");
 w.document.querySelector('[data-view=expense]').click();w.document.querySelector('[data-entry-edit="'+expenseId+'"]').click();
 let expenseForm=w.document.querySelector('#entry-form');assert.equal(w.document.querySelector('#form-title').textContent,'Editar gasto');assert.equal(expenseForm.elements.amount.value,'2500');assert.equal(expenseForm.elements.category.value,'Insumos');assert.equal(expenseForm.elements.paymentMethod.value,'');
 expenseForm.elements.date.value='2026-10-27';expenseForm.elements.concept.value='Materiales corregidos';expenseForm.elements.amount.value='3200';expenseForm.elements.category.value='Mantenimiento';expenseForm.elements.paymentMethod.value='Transferencia';expenseForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(w.document.querySelector('#form-error').textContent,'');
 let expense=w.eval('state.entries.find(e=>e.id==='+expenseId+')');assert.equal(expense.amount,3200);assert.equal(expense.paymentMethod,'Transferencia');assert.equal(expense.category,'Mantenimiento');assert.equal(expense.date,'2026-10-27');assert.equal(expense.details,JSON.stringify({metodo_original:'Credicoop',nota:'Referencia histórica'}));
 // Las copias viejas tampoco sobrescriben gastos actualizados.
 w.document.querySelector('[data-entry-edit="'+expenseId+'"]').click();const expenseOriginal=w.eval('JSON.stringify(state.entries.find(e=>e.id==='+expenseId+'))');await w.Cloud.post('/api/entries/update',{id:expenseId,original:expenseOriginal,amount:3500});await tick();expenseForm.elements.amount.value='4000';expenseForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert(w.document.querySelector('#form-error').textContent.includes('cambió'));assert.equal(w.eval('state.entries.find(e=>e.id==='+expenseId+').amount'),3500);expenseForm.closest('dialog').close();
 w.confirm=()=>false;w.document.querySelector('[data-entry-delete="'+expenseId+'"]').click();await tick();assert(w.eval('state.entries.some(e=>e.id==='+expenseId+')'));
 w.confirm=()=>true;w.document.querySelector('[data-entry-delete="'+expenseId+'"]').click();await tick();assert(!w.eval('state.entries.some(e=>e.id==='+expenseId+')'));assert(![...mock.data.keys()].some(k=>k.endsWith('/entries-'+expenseId)));
 // Editar un cobro histórico conserva su detalle de productos si no se modifica.
 await w.Cloud.post('/api/entries',{kind:'income',date:'2026-10-26',time:'18:00',client:'Cliente edición prueba',cash:40000,transfer:10000,products:5000,details:JSON.stringify({Agua:5000})});await tick();
 const entryId=w.eval("state.entries.find(e=>e.client==='Cliente edición prueba').id");
 w.document.querySelector('[data-view=income]').click();w.document.querySelector('[data-entry-edit="'+entryId+'"]').click();
 let form=w.document.querySelector('#entry-form');assert.equal(form.elements.products.value,'5000');assert.equal(form.elements.cash.value,'40000');form.elements.cash.value='45000';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').amount'),55000);assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').details'),JSON.stringify({Agua:5000}));
 // Agregar consumos y luego quitarlos actualiza tanto el total como el detalle.
 w.document.querySelector('[data-entry-edit="'+entryId+'"]').click();form=w.document.querySelector('#entry-form');
 w.document.querySelector('#consume-quantity').value='2';w.document.querySelector('#add-consumption').click();
 const expectedProducts=w.eval('consumptions.reduce((sum,item)=>sum+item.quantity*item.price,0)');
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').products'),expectedProducts);
 w.document.querySelector('[data-entry-edit="'+entryId+'"]').click();w.document.querySelector('[data-remove]').click();form=w.document.querySelector('#entry-form');
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').products'),0);assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').details'),'{}');
 // Una edición abierta no pisa una modificación posterior.
 w.document.querySelector('[data-entry-edit="'+entryId+'"]').click();
 const beforeRemote=w.eval('JSON.stringify(state.entries.find(e=>e.id==='+entryId+'))');
 await w.Cloud.post('/api/entries/update',{id:entryId,original:beforeRemote,cash:50000});await tick();
 form=w.document.querySelector('#entry-form');form.elements.cash.value='60000';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
 assert(w.document.querySelector('#form-error').textContent.includes('cambió'));assert.equal(w.eval('state.entries.find(e=>e.id==='+entryId+').amount'),60000);form.closest('dialog').close();
 // Cancelar la confirmación no borra; confirmar sí elimina el documento.
 w.confirm=()=>false;w.document.querySelector('[data-entry-delete="'+entryId+'"]').click();await tick();assert(w.eval('state.entries.some(e=>e.id==='+entryId+')'));
 w.confirm=()=>true;w.document.querySelector('[data-entry-delete="'+entryId+'"]').click();await tick();assert(!w.eval('state.entries.some(e=>e.id==='+entryId+')'));assert(![...mock.data.keys()].some(key=>key.endsWith('/entries-'+entryId)));
 // Borrar un cobro vinculado no elimina la reserva.
 const clientId=w.eval('state.clients[0].id');await w.Cloud.post('/api/bookings',{date:'2026-10-27',time:'18:00',clientId,duration:90,court:1});await tick();
 const bookingId=w.eval("state.bookings.find(b=>b.date==='2026-10-27').id");
 await w.Cloud.post('/api/entries',{kind:'income',date:'2026-10-27',client:'Reserva de prueba',cash:40000,bookingId});await tick();
 const linked=w.eval('JSON.stringify(state.entries.find(e=>e.bookingId==='+bookingId+'))');
 await w.Cloud.post('/api/entries/delete',{id:JSON.parse(linked).id,original:linked});await tick();assert(w.eval('state.bookings.some(b=>b.id==='+bookingId+')'));assert(!w.eval('state.entries.some(e=>e.bookingId==='+bookingId+')'));
 await authListener(null);await tick();assert(w.document.body.classList.contains('cloud-locked'));assert.equal(w.eval('state.entries.length'),0);assert.equal(w.document.querySelector('#content').textContent,'');assert.deepEqual(errors,[]);dom.window.close();
});
