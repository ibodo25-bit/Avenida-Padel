# Avenida Pádel: Firebase

Interfaz de la versión final del usuario, con logo, título en mayúsculas/negrita y sin el cuadro introductorio. Se conservan Pádel, Gym, agenda y respaldo JSON. SDK Firebase 13.1.0 empaquetado localmente; no utiliza Analytics ni Cloud Storage.

`public/` es la única carpeta publicable. Los archivos privados y el HTML original no forman parte del hosting. El constructor extrae el respaldo a `private/datos-iniciales.json`, elimina los scripts del entorno de chat y reemplaza la semilla pública por un estado vacío.

## Reproducir

Node 22 o posterior. `npm ci`, `npm run build`, `npm test`. El repositorio incluye la interfaz publicable ya preparada. Opcionalmente, quien mantiene la aplicación puede regenerarla colocando el HTML final del usuario en `private/template.html`; sin esa plantilla el build conserva la interfaz existente y recompila la conexión Firebase. La copia privada original y la extracción de datos no se versionan. Los artefactos ya están compilados: quien publica no necesita reconstruirlos.

## Estructura Firestore

- `clubs/avenida-padel/control/current`: generación activa.
- `clubs/avenida-padel/datasets/{generation}/records/{entries|clients|products|bookings}-{id}`: registros.
- `clubs/avenida-padel/datasets/{generation}/records/_meta`: revisión transaccional y configuración/logo.

Las reglas existentes autorizan únicamente el UID indicado en firestore.rules. No se usa Admin SDK ni credenciales de servicio. La configuración web de Firebase es pública; no otorga acceso sin autenticación y reglas.

Cada modificación usa una transacción que comprueba generación y revisión. Los IDs numéricos se asignan a partir de la copia confirmada; si otro dispositivo se adelanta, la copia atrasada se rechaza en vez de sobrescribir registros. Las reservas recurrentes se guardan juntas, manteniendo el control de superposiciones bajo esa revisión. Los listeners aceptan solo snapshots confirmados por servidor; no hay cola de escrituras offline.

Las importaciones grandes se dividen en lotes de 400 documentos dentro de una generación nueva. Solo se activa al finalizar y verificar que la generación anterior no cambió. Las generaciones antiguas se retienen; su limpieza es una mejora administrativa pendiente, y consume cuota de almacenamiento si se importan muchas copias.

Las pruebas de sincronización inyectan un SDK simulado y cubren concurrencia, importación parcial, dos clientes y cierre de sesión. La prueba de interfaz simula Authentication y Firestore, valida aislamiento público/privado e importa un respaldo en memoria (el privado local cuando existe, o un ejemplo sintético en un checkout limpio). No prueban conectividad, credenciales o reglas reales del proyecto: deben verificarse después de publicar e iniciar sesión. Las reglas conservan el alcance original solicitado; no agregan validación de esquema en servidor.

## Editar y eliminar cobros y gastos

Turnos y cobros incluye acciones por fila. Editar permite corregir fecha, hora, cliente, cobros, tarifa y consumos; conserva detalles históricos si no se modifican. Eliminar pide confirmación y quita el cobro del conjunto activo, sin borrar la reserva vinculada. Las transacciones sincronizan los cambios y comprueban tanto la revisión compartida como la copia del registro que abrió el usuario, para evitar ediciones atrasadas. La eliminación no ofrece deshacer: conservar respaldos JSON. La actualización de Hosting no modifica ni reimporta los datos de Firestore.

El registro de gastos de Pádel también permite editar fecha, concepto, categoría, importe y método de pago, y eliminar con confirmación. Los métodos no informados del histórico permanecen sin especificar al abrir el editor; no se asigna Mercado Pago por defecto. Se conservan los detalles originales de la importación.


## Empleados: acceso restringido

La cuenta propietaria conserva todo el acceso. Las cuentas de empleados deben existir primero en Firebase Authentication y luego tener un documento administrado por el propietario en `clubs/avenida-padel/members/{uid}` con `role: staff` y `enabled: true`. La pestaña Accesos del propietario crea, habilita o revoca ese permiso, sin guardar contraseñas. El acceso usa correo y contraseña; el nombre visible no sustituye al correo de inicio de sesión.

El empleado puede consultar, crear y editar Turnos y cobros, Gastos, Productos y Clientes de Pádel, con todo el historial de esas secciones. No puede consultar Gym, Resumen, agenda, conjuntos antiguos de datos ni importar/exportar respaldos completos, cambiar el logo, eliminar registros o administrar accesos. Quien puede leer ingresos y egresos de Pádel puede calcular un resultado por su cuenta: estos permisos no ocultan esa deducción.

Los registros incluyen `scope: staff` o `scope: admin`, validado también en las escrituras del propietario. El empleado consulta solamente `where(scope == staff)`, nunca la colección completa. Las reglas de Firestore bloquean los documentos de Gym y agenda aunque el empleado altere el JavaScript. La configuración compartida contiene solamente logo y preferencias operativas; no incluye resultados financieros. Los contadores globales de IDs en `_meta` impiden que una cuenta con vista parcial sobrescriba un ID de Gym que no puede ver.

### Activación y compatibilidad

1. Exportar un respaldo JSON actual como propietario.
2. Validar las reglas nuevas con `npm ci` y `npm run verify:rules` en un entorno con Java 21 y acceso al emulador oficial. El proyecto de pruebas es `demo-avenida-roles`; no accede a producción ni factura.
3. Publicar Hosting y reglas juntos: `npx --yes firebase-tools@15.35.0 deploy --only hosting,firestore:rules --project avenida-padel`.
4. Recargar todos los dispositivos del propietario. La app antigua puede recibir acceso denegado al escribir porque no incorpora los atributos de acceso requeridos. No relajar las reglas para permitir clientes antiguos.
5. Crear la cuenta del empleado en Firebase Authentication y copiar su UID.
6. Como propietario, abrir Accesos y autorizar el UID, nombre y correo. Si la base antigua todavía no está preparada, la app solicita confirmación para copiar el conjunto ACTUAL a una generación nueva con atributos de acceso. No toma datos de un respaldo viejo ni modifica importes. Si otro dispositivo guarda durante la preparación, se cancela y debe reintentarse. No autoriza al empleado hasta finalizar correctamente.
7. Verificar desde otro navegador que el empleado vea solamente las cuatro secciones y que su registro aparezca en la cuenta del propietario. Deshabilitar el perfil cierra su sesión y las reglas bloquean nuevas consultas.

Las importaciones futuras del propietario producen conjuntos con el esquema de acceso. Los perfiles viven fuera de cada conjunto, por lo que restaurar un respaldo no crea ni modifica permisos.

### Estado de verificación de esta actualización

Las pruebas simuladas cubren perfiles, navegación, altas de empleado, sincronización con el propietario, contadores sin colisiones con Gym, prohibición de importar/borrar y revocación. Las pruebas de `rules-test/` están preparadas para ejecutarse contra el emulador real: no confundir el resultado de `npm test` con el de `npm run verify:rules`. No activar empleados sin que la suite de reglas haya pasado.
