const fs=require('fs'),path=require('path');
module.exports=function patch(script){
 if(script.includes('// ACCESO_EMPLEADOS_V1'))return script;
 script=script.replace("Math.max(0,...next.entries.map(r=>r.id))+1,source:'Manual'", "(data._allocatedId||Math.max(0,...next.entries.map(r=>r.id))+1),source:'Manual'");
 script=script.replace("Math.max(0,...next[key].map(p=>p.id))+1,...fields", "(data._allocatedId||Math.max(0,...next[key].map(p=>p.id))+1),...fields");
 script=script.replace("maxId=Math.max(0,...next.bookings.map(b=>b.id))", "maxId=data._allocatedId?data._allocatedId-1:Math.max(0,...next.bookings.map(b=>b.id))");
 return script+'\n'+fs.readFileSync(path.join(__dirname,'src/access-ui.js'),'utf8');
};
