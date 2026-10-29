# NOVA Activación 2.0 — Panel de administración

La clave NOVA_ACCESS_CODE que ya configuraste sirve ahora para entrar como administrador. A los clientes debes entregarles las claves individuales que generes en el panel; esas claves no se agregan a las variables de Netlify.

## Funciones incluidas

- Crear clientes con nombre, correo opcional y notas internas.
- Generar una clave criptográfica individual por cliente; mostrarla una sola vez.
- Asignar usos iniciales y agregar o retirar usos con un motivo.
- Establecer un límite diario opcional y una fecha/hora de vencimiento.
- Suspender y reactivar accesos conservando sus saldos e historial.
- Regenerar claves e invalidar inmediatamente las claves y sesiones anteriores.
- Consultar solicitudes, CID recibidos, errores y pendientes.
- Reintegrar un uso con una justificación y protección contra doble reintegro.
- Revisar el libro de movimientos y la auditoría de acciones administrativas.
- Permitir a cada cliente consultar su saldo, vigencia, límites e historial propio.

## Requisito nuevo

Esta versión requiere una base de datos PostgreSQL. Puedes usar Netlify Database o una base externa, por ejemplo Neon. Los archivos del sitio y el almacenamiento del navegador no sustituyen la base de datos para controlar cupos de forma consistente.

Los pasos de actualización están en ACTUALIZAR_A_2_0.md. El uso cotidiano del panel se explica en MANUAL_ADMINISTRADOR.md.

## Qué se descuenta

Cada solicitud admitida para envío a la API descuenta un uso del cupo del cliente. Una respuesta con error del proveedor o un timeout también puede dejar un uso consumido, porque la solicitud pudo haber sido procesada. El administrador puede revisar el caso y reintegrarlo.

Los rechazos previos por clave, suspensión, vencimiento, formato de IID, configuración, falta de saldo o límite diario no consumen usos ni envían solicitudes al proveedor.

El límite diario cuenta las solicitudes admitidas durante el día de Ecuador (America/Guayaquil). Un reintegro restaura el saldo; conserva el contador de solicitudes realizadas ese día.

El saldo del cliente es un cupo administrado por NOVA. Es independiente de los usos contratados en la cuenta del proveedor.

## Qué se verificó

46 pruebas automáticas con PostgreSQL embebido: separación entre clientes, permisos administrativos, claves, caducidad, suspensión, concurrencia, doble envío, reintegros y persistencia entre instancias de servidor. La API externa se sustituyó por respuestas controladas en las pruebas, sin consumir usos.

No se proporcionaron credenciales de tu base de datos alojada ni un token real del proveedor. La conexión a tu base de datos de producción y una activación real deben comprobarse después del despliegue.

## Datos y conservación

Los clientes, sus saldos y el historial se guardan en la base de datos y permanecen al recargar o desplegar código. Las claves completas no se almacenan en ella. Suspender un cliente no borra su información. Mantén las copias de seguridad que ofrezca el alojamiento de tu base de datos.

Esta entrega mantiene la marca NOVA y la consulta por API sin añadir enlaces de activación externos a la interfaz.
