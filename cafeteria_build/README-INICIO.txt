COFFEE-TERIA | CONEXIÓN REAL CON MYSQL WORKBENCH
================================================

REQUISITOS
- Node.js LTS.
- MySQL Server iniciado (MySQL Workbench administra la base, pero no sustituye al servicio MySQL).
- Base de datos cefeteriap creada con el script SQL de COFFEE-TERIA.

INSTALACIÓN
1. Descomprime el ZIP y abre esta carpeta en Visual Studio Code.
2. Abre Terminal > Nueva terminal.
3. Ejecuta: npm install
4. Copia .env.example y pega el archivo como .env.
5. Abre .env y confirma tus datos:
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=tu_contraseña_de_mysql
   DB_NAME=cefeteriap
   API_PORT=3001
   PUBLIC_APP_URL=http://localhost:5173
   PAYPAL_CLIENT_ID=tu_client_id_de_sandbox
   PAYPAL_CLIENT_SECRET=tu_client_secret_de_sandbox
6. Para aceptar pagos de prueba, crea una aplicación REST en PayPal Developer > Sandbox y copia
   su Client ID y Secret solamente en tu archivo local .env. No uses credenciales Live.
7. En MySQL Workbench, selecciona cefeteriap y ejecuta sql_actualizacion_coffee_teria.sql.
   El script agrega TblPago.Referencia sin eliminar ni reemplazar registros.
8. Inicia MySQL Server desde los servicios de Windows o desde tu instalación de MySQL.
9. Ejecuta: npm run dev
10. Abre: http://localhost:5173

QUÉ SE CONECTÓ A MYSQL
- Al confirmar un pedido en la zona pública, el backend guarda o actualiza el cliente en TblCliente,
  crea el pedido en TblPedido, agrega cada producto en TblDetallePedido y registra un pago pendiente
  en TblPago.
- El pago con tarjeta se redirige al checkout de PayPal Sandbox; el pedido solo cambia a Pagado si
  PayPal confirma la captura y coinciden el importe y el pedido. Usa únicamente cuentas/tarjetas
  de prueba de Sandbox; no se ingresan tarjetas reales en COFFEE-TERIA.
- El pago En caja permanece pendiente y genera el ticket para pagar en el local.
- El panel carga productos, insumos, compras, movimientos, empleados, pedidos y reservaciones desde MySQL.
- Al cambiar el estado de un pedido, se actualiza TblPedido.Estado.
- Al registrar un pago simulado desde el panel de ventas, se actualiza TblPago.Estado a Pagado.
- Las compras guardan detalle, costo, proveedor e historial; actualizan existencia y costo promedio del insumo.
- Las recetas guardan sus insumos y al vender se descuenta inventario con movimientos auditables.
- El Administrador puede agregar productos desde Productos (TblProducto) y crear recetas para cualquier producto sin receta desde Recetas (TblReceta y TblDetalleReceta); no se requieren tablas nuevas.
- Los reportes muestran ventas pagadas, compras, costo estimado de insumos y pagos de nómina.
- Las cuentas se crean junto con el empleado y validan la contraseña cifrada; cada rol muestra su espacio.
- El enlace público copiado abre directamente el menú/portal en la misma URL de despliegue.
- Al confirmar una reservación, se guarda/actualiza el cliente en TblCliente, se busca una mesa con
  capacidad suficiente y sin otra reserva que se cruce, y se inserta TblReserva.
- El panel administrativo carga las reservaciones desde MySQL. Cancelar una reservación la elimina
  de TblReserva porque el esquema actual no tiene una columna Estado en esa tabla.

IMPORTANTE ANTES DE PROBAR
- TblProducto debe contener los productos del menú. El sistema intenta relacionarlos por Nombre y,
  como respaldo, por IdProducto. Si no encuentra el producto, mostrará un error y no guardará el pedido.
- TblMesa debe tener mesas registradas con NumeroMesa y Capacidad suficientes para las reservas.
- Si TblEmpleado está vacía, el backend crea automáticamente un empleado de sistema para registrar
  pedidos web; si ya hay empleados, utiliza el primero como responsable del pedido.
- El formulario de pedido y reservación ahora solicita teléfono porque TblCliente.Telefono es NOT NULL.
- Los pedidos/reservas antiguos que estaban guardados solamente en localStorage NO se migran
  automáticamente. Los pedidos nuevos sí se guardan en MySQL.
- Si faltan credenciales PayPal Sandbox, el pedido se guarda y permanece pendiente; completa el .env
  y vuelve a intentar el pago desde el ticket. No se realizan cobros reales.

COMPROBAR LA CONEXIÓN
Abre en el navegador: http://localhost:3001/api/estado
Debe responder con conectado: true y base: cefeteriap.
Pedidos guardados: http://localhost:3001/api/pedidos
Reservaciones guardadas: http://localhost:3001/api/reservas

CONSULTAS EN MYSQL WORKBENCH
USE cefeteriap;
SELECT * FROM TblPedido ORDER BY IdPedido DESC;
SELECT * FROM TblDetallePedido ORDER BY IdDetalle DESC;
SELECT * FROM TblPago ORDER BY IdPago DESC;
SELECT * FROM TblReserva ORDER BY IdReserva DESC;

SOLUCIÓN DE PROBLEMAS
- ECONNREFUSED: inicia MySQL Server y revisa DB_PORT.
- Access denied: corrige DB_USER y DB_PASSWORD en .env.
- Unknown database: confirma DB_NAME=cefeteriap.
- El producto no existe: agrega ese producto a TblProducto o revisa que su Nombre coincida con el menú.
- No hay mesas disponibles: agrega registros a TblMesa y revisa Capacidad.
- npm no se reconoce: instala Node.js LTS y reinicia VS Code.
