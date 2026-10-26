const fs=require('fs'),path=require('path');
module.exports=function patch(script){
 if(script.includes('// EDICION_MOVIMIENTOS_V2'))return script;
 function replace(from,to){if(!script.includes(from))throw Error('No se encontró el punto de edición: '+from.slice(0,65));script=script.replace(from,to)}
 replace("['Fecha','Hora','Cliente','Efectivo','Transferencia','Productos','Total']","['Fecha','Hora','Cliente','Efectivo','Transferencia','Productos','Total','Acciones']");
 replace('<td class="money"><b>${money(r.amount)}</b></td></tr>', '<td class="money"><b>${money(r.amount)}</b></td><td><div class="entry-actions"><button type="button" data-entry-edit="${r.id}">Editar</button><button type="button" class="danger-action" data-entry-delete="${r.id}">Eliminar</button></div></td></tr>');
 replace("['Mes / fecha','Concepto','Categoría','Importe','Método de pago','Origen']","['Mes / fecha','Concepto','Categoría','Importe','Método de pago','Origen','Acciones']");
 replace('<td>${esc(r.source)}</td></tr>', '<td>${esc(r.source)}</td><td><div class="entry-actions"><button type="button" data-entry-edit="${r.id}">Editar</button><button type="button" class="danger-action" data-entry-delete="${r.id}">Eliminar</button></div></td></tr>');
 replace("f.reset();f.dataset.bookingId='';", "f.reset();f.dataset.bookingId='';f.dataset.entryId='';f.dataset.original='';f.dataset.productsChanged='false';f.elements.products.readOnly=false;f.querySelector('[type=submit]').textContent='Guardar registro';");
 replace("await post('/api/entries',{...Object.fromEntries(new FormData(e.target)),items:consumptions,bookingId:e.target.dataset.bookingId||null});", "const editing=!!e.target.dataset.entryId,productsChanged=e.target.dataset.productsChanged==='true';await post(editing?'/api/entries/update':'/api/entries',{...Object.fromEntries(new FormData(e.target)),id:editing?Number(e.target.dataset.entryId):undefined,original:editing?e.target.dataset.original:undefined,items:editing&&!productsChanged?undefined:consumptions,resetProductDetails:editing&&productsChanged&&consumptions.length===0,bookingId:e.target.dataset.bookingId||null});");
 replace("function drawConsumptions(){$('#consumptions')", "function drawConsumptions(){$('#entry-form').dataset.productsChanged='true';$('#entry-form').elements.products.readOnly=consumptions.length>0;$('#consumptions')");
 replace("function applyCloudOperation(base,url,data){\n const next=clone(base);", "function applyCloudOperation(base,url,data){\n const next=clone(base);\n if(['/api/entries/update','/api/entries/delete'].includes(url))return updateIncomeOperation(next,url,data);");
 return script+'\n'+fs.readFileSync(path.join(__dirname,'src/entry-actions.js'),'utf8');
};
