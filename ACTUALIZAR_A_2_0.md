# Actualizar la instalación existente a NOVA Activación 2.0

## 1. Preparar los archivos

Descomprime el paquete y actualiza el contenido de tu repositorio GitHub. En la raíz deben quedar package.json, package-lock.json, netlify.toml y las carpetas public, server, netlify, scripts, tests y database.

Sube los archivos extraídos. Incluye los módulos nuevos de public y server y las funciones admin.mjs e history.mjs. Conserva la estructura de carpetas. No subas node_modules ni un .env con valores reales.

Netlify mantiene esta configuración:

| Ajuste | Valor |
|---|---|
| Build command | npm run build |
| Publish directory | public |
| Functions directory | netlify/functions |
| Node.js | 22 |

Ahora hay una dependencia de producción (pg). Netlify la instalará usando package.json y package-lock.json al desplegar desde el repositorio.

## 2. Conservar las credenciales actuales

Mantén NOVA_ACCESS_CODE y ACTIVATION_API_TOKEN en las variables privadas de tu proyecto Netlify. La primera pasa a ser la clave del administrador. La segunda sigue conectando el servidor con la API.

Reserva NOVA_ACCESS_CODE para el administrador. Si antes compartías esa clave, cámbiala en Netlify y despliega de nuevo antes de utilizar el panel. El panel generará las claves individuales de los clientes.

Las sesiones de la versión anterior deben iniciar sesión otra vez al actualizar.

## 3. Elegir la base de datos

### Opción A: Netlify Database

En tu proyecto Netlify, entra en Data & Storage → Database y crea una base de datos si esa opción está disponible en tu cuenta. Netlify proporciona la conexión mediante NETLIFY_DB_URL, que esta app reconoce.

Esta distribución no crea automáticamente una base de datos de alojamiento ni acepta términos o cargos en tu nombre. La creación se realiza desde tu cuenta y está sujeta a las condiciones que muestre el proveedor.

### Opción B: PostgreSQL externo

Crea o utiliza una base PostgreSQL, por ejemplo en Neon. Obtén su cadena de conexión para aplicaciones Node.js (postgresql://…). Cuando el proveedor ofrezca conexión agrupada o pooled, utilízala para las funciones serverless.

En Netlify, Project configuration → Environment variables, añade DATABASE_URL con esa cadena completa. Incluye la configuración TLS facilitada por el proveedor.

Configura el valor para Production y disponible en Functions si aparece el selector de ámbitos. Las credenciales se guardan en Netlify y no se pegan en el repositorio.

Si DATABASE_URL y NETLIFY_DB_URL están configuradas, la app utilizará DATABASE_URL. Para usar exclusivamente Netlify Database, conserva únicamente la conexión que corresponda a esa opción.

## 4. Volver a desplegar

Confirma los cambios en GitHub y ejecuta un nuevo despliegue en Netlify después de configurar la base de datos. Las variables nuevas requieren despliegue para aplicarse.

En Cloud compute → Functions deben aparecer cinco funciones: session, status, confirmation, history y admin.

## 5. Entrar como administrador

Abre el enlace principal HTTPS de tu app e introduce tu valor NOVA_ACCESS_CODE. La pantalla inicial del administrador será Clientes y claves.

Si falta la conexión, verás Configuración pendiente. Si existe la conexión pero todavía no están las tablas, verás el botón Inicializar panel.

## 6. Inicializar el panel

Pulsa Inicializar panel. La app creará sus tablas en la base configurada y registrará la inicialización. La operación es idempotente: no borra clientes, saldos ni consultas existentes.

La conexión de base de datos debe tener permisos para crear las tablas e índices de la aplicación. Si tu organización exige ejecutar migraciones por separado, utiliza database/001_admin.sql con el administrador de PostgreSQL; después vuelve a comprobar la app.

Una base con una versión incompatible debe actualizarse con una migración compatible; no se reinicia ni se vacía automáticamente.

## 7. Crear un cliente de prueba

Pulsa Nuevo cliente. Escribe un nombre, un saldo pequeño, un límite diario y una fecha de vencimiento si la necesitas. Al crear el cliente, copia su clave individual, que se mostrará una sola vez.

Entrega esa clave al cliente por el canal que elijas. La app no envía mensajes ni correos automáticamente.

## 8. Probar el acceso del cliente

Abre el enlace en una ventana privada de tu navegador e introduce la clave individual. Debes ver el nombre del cliente, su saldo y su historial propio. El cliente no verá el panel de administración.

Prueba suspenderlo desde el panel y recargar o realizar una solicitud en la ventana del cliente: se rechazará su acceso. Al reactivarlo, deberá volver a iniciar sesión.

## 9. Probar una consulta real

Utiliza un IID que corresponda a un producto instalado con licencia válida. Pulsa Consultar CID una sola vez. Se reservará un uso y se realizará una consulta a la API.

Comprueba que el historial y el saldo se actualicen, y que el producto acepte el CID recibido. Un error o timeout puede haber consumido un uso; revisa el caso antes de enviar otra solicitud.

Cada solicitud incluye una referencia idempotente. Repetir esa misma referencia permite recuperar su resultado guardado, sin otro descuento ni llamada al proveedor. Usar Nueva activación inicia otra referencia.

## 10. Mantener el servicio

Guarda las claves y credenciales en los lugares previstos. Regenerar una clave de cliente invalida la anterior y sus sesiones. Cambiar NOVA_ACCESS_CODE y desplegar de nuevo cierra las sesiones firmadas con la clave anterior, pero no cambia las claves individuales guardadas de los clientes.

La continuidad de los datos depende de conservar la misma base de datos y sus copias de seguridad. Cambiar la conexión por una base vacía mostrará un panel vacío que deberá inicializarse.

## Diagnóstico

| Situación | Revisión |
|---|---|
| Acceso pendiente de configuración | Verifica NOVA_ACCESS_CODE, longitud 16–256 y un despliegue reciente. |
| Base de datos pendiente | Verifica NETLIFY_DB_URL o DATABASE_URL y su disponibilidad para Functions. |
| No se puede inicializar | Revisa la conexión, TLS, permisos del usuario PostgreSQL y disponibilidad de la base. |
| El cliente no puede entrar | Revisa que esté activo, vigente y utilizando la última clave generada. |
| No tiene usos | Asigna saldo mediante Ajustar usos. |
| Límite diario alcanzado | Modifica el límite o espera al siguiente día de Ecuador. |
| API no disponible | Revisa la configuración y las condiciones del proveedor; no se debe eludir un bloqueo del servicio. |
| Consulta pendiente | Puede estar en curso o haberse interrumpido. Revisa el historial antes de iniciar otra. |
| Ajuste administrativo interrumpido | Actualiza el panel y revisa el libro de movimientos antes de repetir el ajuste. |

Referencias técnicas: https://docs.netlify.com/build/data-and-storage/netlify-database/tooling/ · https://node-postgres.com/features/transactions · https://docs.netlify.com/build/functions/environment-variables/
