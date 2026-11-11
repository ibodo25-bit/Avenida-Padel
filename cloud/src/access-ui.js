// ACCESO_EMPLEADOS_V1
const renderWithoutAccess=render;
render=function(){
 if(window.Cloud?.role==='staff'&&!['income','expense','products','clients'].includes(view))view='income';
 if(view==='access'&&window.Cloud?.role==='admin'){window.Cloud.renderAccess();return}
 renderWithoutAccess();window.Cloud?.applyPermissions();
};
const exportBackupWithoutAccess=exportBackup,exportCSVWithoutAccess=exportCSV;
exportBackup=function(){if(window.Cloud?.role!=='admin'){$('#notice').textContent='Los respaldos están disponibles solo para el administrador.';return}exportBackupWithoutAccess()};
exportCSV=function(){if(window.Cloud?.role!=='admin'){$('#notice').textContent='La exportación está disponible solo para el administrador.';return}exportCSVWithoutAccess()};
