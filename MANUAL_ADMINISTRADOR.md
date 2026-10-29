# Uso del panel de administración

## Entrar

Usa la clave configurada en NOVA_ACCESS_CODE. No se crean cuentas administrativas desde el panel: la administración permanece asociada a esa credencial privada del servidor.

## Crear un cliente y su clave

En Clientes y claves pulsa Nuevo cliente. Completa nombre, correo opcional, usos iniciales, límite diario y vencimiento opcional. El valor 0 en límite diario significa sin límite diario; el saldo disponible sigue aplicándose.

El sistema genera una clave individual NOVA-… con 192 bits aleatorios. Copia la clave al mostrarse y entrégala al cliente. Solo se conserva su hash y una referencia parcial; el administrador no puede recuperar el texto original después de cerrar esa pantalla.

Si se pierde, utiliza Regenerar clave. Se mostrará otra y la anterior dejará de funcionar.

## Gestionar datos y vigencia

Pulsa Gestionar junto al cliente para modificar su nombre, correo, notas internas, límite diario o vencimiento. Las notas son solo para administración y no se entregan en la respuesta de estado del cliente.

Las fechas se introducen según la zona horaria del navegador y se guardan en UTC. Los cupos diarios se miden por America/Guayaquil.

## Suspender y reactivar

Dentro de Gestionar encontrarás Suspender acceso o Activar acceso. Suspender revoca las sesiones abiertas y rechaza nuevos accesos. Conserva saldo e historial. Al reactivar, el cliente debe iniciar sesión otra vez; la vigencia y el saldo continúan aplicándose.

## Agregar o retirar usos

Pulsa el icono de usos de la fila del cliente. Elige Agregar o Retirar, introduce la cantidad y un motivo. El cambio se registra en Movimientos de usos y en Auditoría. No se permite dejar un saldo negativo.

Un ajuste modifica el cupo de NOVA. No compra ni añade usos a la cuenta del proveedor de API.

## Consultar el historial

Uso de la plataforma muestra las solicitudes admitidas. Puedes acceder al historial de un cliente desde el icono de consultas de su fila.

Resultados:

- CID recibido: la API devolvió un código y se guardó la respuesta.
- Error: la solicitud fue admitida pero terminó con un error registrado.
- Pendiente: la respuesta final todavía no está guardada. Puede estar en curso o haberse interrumpido.

Puedes abrir un CID recibido y descargar su registro. El administrador ve la actividad global; cada cliente solo puede ver sus propias consultas.

## Reintegrar un uso

En el historial, junto a una consulta cobrada, pulsa Reintegrar y escribe el motivo de la revisión. Solo puede reintegrarse una vez. El saldo del cliente aumenta en uno y queda un movimiento registrado.

Si la solicitud sigue pendiente, se exige esperar al menos dos minutos antes de reintegrarla. Esto da tiempo a que termine una consulta en curso; no demuestra que el proveedor la haya cancelado.

El reintegro restaura el saldo local de NOVA. No garantiza la devolución de un uso por parte del proveedor ni reduce el contador diario de solicitudes realizadas.

## Consultas repetidas

Una misma referencia de solicitud no vuelve a cobrar ni a consultar al proveedor. Si su CID ya está guardado se devuelve ese resultado. Si sigue pendiente, se informa de ello. Si cambias de instalación o necesitas otra solicitud, utiliza Nueva activación.

## Auditoría y movimientos

Movimientos de usos muestra las asignaciones iniciales, recargas, retiros, consumos y reintegros recientes. Auditoría muestra creaciones y modificaciones de clientes, suspensiones, regeneraciones de claves y ajustes administrativos. No almacena claves completas.

## Cuenta administradora

Las consultas realizadas por el administrador se registran con esa cuenta y no descuentan saldo a un cliente. Pueden consumir usos del proveedor.

La app no sincroniza el saldo real contratado con el proveedor, no procesa pagos y no envía claves por correo. La entrega de claves y las decisiones comerciales permanecen bajo tu control.
