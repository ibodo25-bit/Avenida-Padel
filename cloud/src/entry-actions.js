// EDICION_COBROS_V1
function editableIncome(entry){return entry&&entry.kind==='income'&&(entry.activity||'padel')==='padel'}
function updateIncomeOperation(next,url,input){
 const index=next.entries.findIndex(e=>e.id===Number(input.id));
 if(index<0)throw Error('Este turno ya no existe. Revisá la lista actualizada.');
 const previous=next.entries[index];
 if(!editableIncome(previous))throw Error('Esta acción solo se aplica a Turnos y cobros de Pádel.');
 if(!input.original||JSON.stringify(previous)!==input.original)throw Error('Este turno cambió desde que lo abriste. Cerrá la ventana y volvé a editarlo para no sobrescribir otro cambio.');
 if(url==='/api/entries/delete'){next.entries.splice(index,1);return next}
 const edited={...previous,...input,id:previous.id,kind:previous.kind,activity:previous.activity,source:previous.source,bookingId:previous.bookingId};
 if(input.resetProductDetails)edited.details='{}';
 next.entries[index]=normalizeEntry(edited);
 return next;
}
function editIncome(id){
 const entry=state.entries.find(e=>e.id===Number(id));if(!editableIncome(entry))return;
 const snapshot=clone(entry);view='income';render();$('#new').click();
 const form=$('#entry-form');form.dataset.entryId=snapshot.id;form.dataset.original=JSON.stringify(snapshot);
 form.dataset.bookingId=snapshot.bookingId||'';
 for(const key of ['date','time','client','cash','transfer','products','rate'])form.elements[key].value=snapshot[key]??'';
 try{const details=JSON.parse(snapshot.details||'{}');consumptions=clone(details.items||[])}catch{consumptions=[]}
 if(consumptions.length)drawConsumptions();
 form.dataset.productsChanged='false';
 $('#form-title').textContent='Editar turno y cobro';form.querySelector('[type=submit]').textContent='Guardar cambios';
}
async function deleteIncome(id,button){
 const entry=state.entries.find(e=>e.id===Number(id));if(!editableIncome(entry))return;
 const original=JSON.stringify(entry);
 const note=entry.bookingId?' La reserva del calendario se conserva y dejará de figurar como cobrada.':'';
 if(!confirm(`¿Eliminar el cobro de ${entry.client} del ${entry.date} ${entry.time||''} por ${money(entry.amount)}?\n\nSe descontará de los ingresos y se eliminará para todos los dispositivos.${note}\n\nEsta acción no se puede deshacer desde la aplicación.`))return;
 if(button)button.disabled=true;
 try{await post('/api/entries/delete',{id:entry.id,original});await load();$('#notice').textContent='Cobro eliminado de la nube. Los totales y los otros dispositivos se actualizaron.'}catch(error){$('#notice').textContent=error.message}finally{if(button)button.disabled=false}
}
document.addEventListener('click',event=>{
 const edit=event.target.closest('[data-entry-edit]'),remove=event.target.closest('[data-entry-delete]');
 if(edit)editIncome(Number(edit.dataset.entryEdit));
 if(remove)void deleteIncome(Number(remove.dataset.entryDelete),remove);
});
$('#entry-form').elements.products.addEventListener('input',()=>{$('#entry-form').dataset.productsChanged='true'});
