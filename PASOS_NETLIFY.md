# Instalación y actualización

Para actualizar la versión 1.1 a la versión 2.0 utiliza ACTUALIZAR_A_2_0.md.

Configuración de Netlify: build npm run build, carpeta publicada public, funciones netlify/functions, Node.js 22.

Variables: NOVA_ACCESS_CODE para el administrador, ACTIVATION_API_TOKEN para la API y NETLIFY_DB_URL (Netlify Database) o DATABASE_URL (PostgreSQL externo) para el almacenamiento persistente.

Las cinco funciones son session, status, confirmation, history y admin. Inicializa las tablas desde el panel después de configurar la conexión y desplegar.

El manual de operación es MANUAL_ADMINISTRADOR.md.
