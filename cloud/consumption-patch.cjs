module.exports=function patch(script){
 if(script.includes('// PRODUCTO_SIN_CONSUMO_V1'))return script;
 function replace(from,to){if(!script.includes(from))throw Error('Falta el selector de consumo esperado');script=script.replace(from,to)}
 replace("$('#consume-product').innerHTML=state.products.filter", "$('#consume-product').innerHTML='<option value=\"\">Sin consumo · elegir producto…</option>'+state.products.filter");
 replace(".join('');f.elements.kind.value=kind;", ".join('');$('#consume-product').value='';$('#consume-quantity').value='1';$('#add-consumption').disabled=true;$('#consume-product').onchange=()=>{$('#add-consumption').disabled=!$('#consume-product').value};f.elements.kind.value=kind;");
 replace("$('#add-consumption').onclick=()=>{const p=", "$('#add-consumption').onclick=()=>{if(!$('#consume-product').value)return;const p=");
 replace("consumptions.push({name:p.name,price:p.price,quantity});drawConsumptions()", "consumptions.push({name:p.name,price:p.price,quantity});drawConsumptions();$('#consume-product').value='';$('#consume-quantity').value='1';$('#add-consumption').disabled=true");
 return script+'\n// PRODUCTO_SIN_CONSUMO_V1\n';
};
