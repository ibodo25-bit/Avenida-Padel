# Avenida Pádel

Aplicación web para administrar turnos, cobros, productos, gastos y Avenida Gym. Incluye agenda manual con reservas semanales y sincronización entre dispositivos mediante Firebase Authentication y Firestore.

La versión para publicar está en **[cloud/](cloud/)**. Mantiene el diseño oscuro y naranja y el logo del club.

## Publicar sin descargar archivos

Abrir Google Cloud Shell con la cuenta propietaria del proyecto Firebase y ejecutar cada comando por separado:

```sh
git clone https://github.com/ibodo25-bit/Avenida-Padel.git
cd Avenida-Padel/cloud
npx --yes firebase-tools@15.34.1 login --no-localhost
npx --yes firebase-tools@15.34.1 deploy --only hosting --project avenida-padel
```

Firebase devuelve la dirección de Hosting al completar la publicación. No hace falta ejecutar `firebase init`, reconstruir la app ni habilitar Blaze. Si GitHub solicita acceso porque el repositorio es privado, autenticarse con la cuenta autorizada sin compartir credenciales.

## Primera carga

Iniciar sesión con el usuario autorizado de Firebase e importar el respaldo JSON más reciente exportado desde la aplicación local. Este repositorio **no contiene movimientos financieros, clientes ni respaldos privados**. La configuración web de Firebase y el identificador autorizado son públicos; las reglas de Firestore protegen los datos.

Verificar los totales antes de usar la nube como registro principal. Conservar respaldos JSON descargados. Los nuevos cambios requieren conexión y confirmación del servidor.

- [Guía de publicación](cloud/LEEME-PUBLICACION.txt)
- [Documentación técnica y pruebas](cloud/README.md)

La aplicación preparada debe validarse con el proyecto real después de publicar. Las pruebas automatizadas usan un servicio simulado y no acreditan que un despliegue ya esté activo.
