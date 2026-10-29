# NOVA Activación 2.0 — Administración y clientes

Actualización para Netlify y GitHub. Conserva la consulta de CID por API e incorpora usuarios individuales, claves, cupos, vencimiento, suspensión, historial persistente y auditoría.

Empieza por ACTUALIZAR_A_2_0.md y consulta MANUAL_ADMINISTRADOR.md.

## Variables de producción

- NOVA_ACCESS_CODE: clave del administrador (16–256 caracteres). Puedes conservar la existente.
- ACTIVATION_API_TOKEN: token privado del servicio de activación. Puedes conservar el existente.
- Base de datos: NETLIFY_DB_URL suministrada por Netlify Database, o DATABASE_URL para PostgreSQL externo. DATABASE_URL tiene prioridad si existen ambas.

Configura credenciales únicamente en las variables privadas de Netlify. La app no las entrega al navegador.

## Arquitectura

Frontend: public/. Funciones: netlify/functions/. Almacenamiento y permisos: server/. Dependencia de producción: pg. Las pruebas utilizan PostgreSQL embebido con PGlite y respuestas controladas del proveedor.

La autenticación se comprueba en el servidor. Los clientes solo acceden a sus propios datos. El administrador gestiona los accesos y consulta los registros globales. Las claves individuales se generan criptográficamente y se guardan solo como hash; el texto completo se muestra una sola vez.

## Comandos

- npm ci
- npm test
- npm run build
- npm run dev (con variables locales en .env, solo para desarrollo)

No incluye pagos, envío de correos, facturación ni validación jurídica de licencias. El usuario completa la activación del producto con el CID recibido. La aceptación del proveedor sigue dependiendo del token, de sus usos y de las condiciones de su API.
