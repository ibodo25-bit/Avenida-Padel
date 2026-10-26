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
