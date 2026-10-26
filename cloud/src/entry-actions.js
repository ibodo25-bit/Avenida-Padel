// EDICION_MOVIMIENTOS_V2
function editableEntry(entry){return entry&&['income','expense'].includes(entry.kind)&&(entry.activity||'padel')==='padel'}
function updateIncomeOperation(next,url,input){
 const index=next.entries.findIndex(e=>e.id===Number(input.id));
 if(index<0)throw Error('Este registro ya no existe. Revisá la lista actualizada.');
 const previous=next.entries[index];
 if(!editableEntry(previous))throw Error('Esta acción solo se aplica a cobros y gastos de Pádel.');
 if(!input.original||JSON.stringify(previous)!==input.original)throw Error('Este registro cambió desde que lo abriste. Cerrá la ventana y volvé a editarlo para no sobrescribir otro cambio.');
 if(url==='/api/entries/delete'){next.entries.splice(index,1);return next}
 const edited={...previous,...input,id:previous.id,kind:previous.kind,activity:previous.activity,source:previous.source,bookingId:previous.bookingId};
 if(input.resetProductDetails)edited.details='{}';
 next.entries[index]=normalizeEntry(edited);
 return next;
}
function editIncome(id){
 const entry=state.entries.find(e=>e.id===Number(id));if(!editableEntry(entry))return;
 const snapshot=clone(entry),expense=snapshot.kind==='expense';view=expense?'expense':'income';render();$('#new').click();
 const form=$('#entry-form');form.dataset.entryId=snapshot.id;form.dataset.original=JSON.stringify(snapshot);
 form.dataset.bookingId=snapshot.bookingId||'';
 if(expense){
  if(![...form.elements.category.options].some(o=>o.value===snapshot.category))form.elements.category.add(new Option(snapshot.category||'Sin categoría',snapshot.category||''));
  if(!snapshot.paymentMethod){let option=form.elements.paymentMethod.querySelector('option[value=""]');if(!option){option=new Option('','');form.elements.paymentMethod.add(option)}option.textContent='Sin especificar'+(originalMethod(snapshot)?' · Original: '+originalMethod(snapshot):'')}
 }
 for(const key of ['date','time','client','cash','transfer','products','rate','concept','category','amount','paymentMethod'])form.elements[key].value=snapshot[key]??'';
 try{const details=JSON.parse(snapshot.details||'{}');consumptions=clone(details.items||[])}catch{consumptions=[]}
 if(consumptions.length)drawConsumptions();
 form.dataset.productsChanged='false';
 $('#form-title').textContent=expense?'Editar gasto':'Editar turno y cobro';form.querySelector('[type=submit]').textContent='Guardar cambios';
}
async function deleteIncome(id,button){
 const entry=state.entries.find(e=>e.id===Number(id));if(!editableEntry(entry))return;
 const original=JSON.stringify(entry);
 const expense=entry.kind==='expense';
 const note=entry.bookingId?' La reserva del calendario se conserva y dejará de figurar como cobrada.':'';
 if(!confirm(`¿Eliminar ${expense?'el gasto de '+entry.concept:'el cobro de '+entry.client} del ${entry.date} ${entry.time||''} por ${money(entry.amount)}?\n\nSe descontará de los ${expense?'egresos':'ingresos'} y se eliminará para todos los dispositivos.${note}\n\nEsta acción no se puede deshacer desde la aplicación.`))return;
 if(button)button.disabled=true;
 try{await post('/api/entries/delete',{id:entry.id,original});await load();$('#notice').textContent=(expense?'Gasto':'Cobro')+' eliminado de la nube. Los totales y los otros dispositivos se actualizaron.'}catch(error){$('#notice').textContent=error.message}finally{if(button)button.disabled=false}
}
document.addEventListener('click',event=>{
 const edit=event.target.closest('[data-entry-edit]'),remove=event.target.closest('[data-entry-delete]');
 if(edit)editIncome(Number(edit.dataset.entryEdit));
 if(remove)void deleteIncome(Number(remove.dataset.entryDelete),remove);
});
$('#entry-form').elements.products.addEventListener('input',()=>{$('#entry-form').dataset.productsChanged='true'});
