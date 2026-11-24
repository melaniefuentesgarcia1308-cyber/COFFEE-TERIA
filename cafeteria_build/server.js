import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cefeteriap',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

async function authenticate(req, res, next) {
  const publicGet = req.method === 'GET' && [
    '/api/estado', '/api/productos', '/api/reservas', '/api/auth/setup-status'
  ].includes(req.path);
  const publicPost = req.method === 'POST' && [
    '/api/auth/setup', '/api/auth/login', '/api/public/pedidos', '/api/public/reservas'
  ].includes(req.path) || (
    req.method === 'POST' &&
    /^\/api\/public\/pedidos\/\d+\/paypal\/(crear|capturar)$/.test(req.path)
  );
  if (publicGet || publicPost) return next();

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.execute(`
      SELECT s.IdSesion,u.IdUsuario,u.Usuario,u.Rol,u.Activo AS UsuarioActivo,
             e.IdEmpleado,e.Nombre,e.Correo,e.Activo AS EmpleadoActivo
      FROM TblSesion s
      JOIN TblUsuario u ON u.IdUsuario=s.IdUsuario
      JOIN TblEmpleado e ON e.IdEmpleado=u.IdEmpleado
      WHERE s.TokenHash=? AND s.Activa=1 AND s.ExpiraEn>NOW()
      LIMIT 1`, [tokenHash]);
    if (!rows.length || !rows[0].UsuarioActivo || !rows[0].EmpleadoActivo)
      return res.status(401).json({ error: 'Sesión inválida o cuenta inactiva.' });
    req.user = rows[0];
    if (req.method !== 'GET' && rows[0].Rol !== 'Administrador') {
      const cashierAction =
        rows[0].Rol === 'Cajero' && req.path.startsWith('/api/pedidos/');
      const baristaAction =
        rows[0].Rol === 'Barista' && req.method === 'PUT' &&
        req.path.startsWith('/api/pedidos/') && req.path.endsWith('/estado');
      const selfPasswordChange =
        req.method === 'POST' && req.path === '/api/auth/change-password';
      if (!cashierAction && !baristaAction && !selfPasswordChange)
        return res.status(403).json({ error:'No tienes permiso para esta operación.' });
    }
    if (req.path.startsWith('/api/gestion/') && rows[0].Rol !== 'Administrador') {
      const readOnlyManagement =
        req.method === 'GET' &&
        ['/api/gestion/insumos', '/api/gestion/recetas', '/api/gestion/movimientos-stock']
          .includes(req.path);
      const baristaPreparation =
        rows[0].Rol === 'Barista' && req.method === 'PUT' &&
        req.path.startsWith('/api/pedidos/');
      if (!readOnlyManagement && !baristaPreparation)
        return res.status(403).json({ error: 'No tienes permiso para esta operación.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo validar la sesión.', detalle: error.message });
  }
}
app.use(authenticate);

const requireRole = (...roles) => (req, res, next) => {
  const role = req.user?.Rol === 'Administrador' ? 'Admin' : req.user?.Rol;
  return role && roles.includes(role)
    ? next()
    : res.status(403).json({ error: 'No tienes permiso para esta operación.' });
};

const initialInventory = [
  { name:'Café en grano · Chiapas', quantity:8.5, minimum:3, unit:'kg', supplier:'Origen Café' },
  { name:'Leche entera', quantity:3, minimum:5, unit:'L', supplier:'Lácteos del Valle' },
  { name:'Manzanilla', quantity:0.8, minimum:0.2, unit:'kg', supplier:'Herbolaria Natural' },
  { name:'Jarabe de vainilla', quantity:0.5, minimum:1, unit:'L', supplier:'Dulce Origen' },
  { name:'Croissant de mantequilla', quantity:24, minimum:10, unit:'pzas', supplier:'Panadería Alba' },
  { name:'Pastel de chocolate', quantity:12, minimum:4, unit:'porciones', supplier:'Panadería Alba' }
];

const initialRecipes = [
  { product:'Latte de la casa', items:[['Café en grano · Chiapas',0.018],['Leche entera',0.2],['Jarabe de vainilla',0.01]] },
  { product:'Cappuccino clásico', items:[['Café en grano · Chiapas',0.018],['Leche entera',0.15]] },
  { product:'Cold brew', items:[['Café en grano · Chiapas',0.025]] },
  { product:'Té de manzanilla', items:[['Manzanilla',0.004]] }
];

let initialDataPromise;
async function ensureInitialTables() {
  for (let number = 1; number <= 8; number++) {
    const capacity = [4, 7, 8].includes(number) ? 4 : 2;
    await pool.execute(
      'INSERT IGNORE INTO TblMesa (NumeroMesa, Capacidad, Estado) VALUES (?, ?, ?)',
      [String(number), capacity, 'Disponible']
    );
  }
}

async function ensureInitialTemplateData() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ingredientIds = new Map();
    for (const item of initialInventory) {
      const [suppliers] = await conn.execute(
        'SELECT IdProveedor FROM TblProveedor WHERE Nombre=? ORDER BY IdProveedor LIMIT 1 FOR UPDATE',
        [item.supplier]
      );
      let supplierId = suppliers[0]?.IdProveedor;
      if (!supplierId) {
        const [createdSupplier] = await conn.execute(
          'INSERT INTO TblProveedor (Nombre) VALUES (?)', [item.supplier]
        );
        supplierId = createdSupplier.insertId;
      }
      const [ingredients] = await conn.execute(
        'SELECT IdInsumo FROM TblInsumo WHERE Nombre=? ORDER BY IdInsumo LIMIT 1 FOR UPDATE',
        [item.name]
      );
      let ingredientId = ingredients[0]?.IdInsumo;
      if (!ingredientId) {
        const [createdIngredient] = await conn.execute(
          `INSERT INTO TblInsumo
           (Nombre,UnidadMedida,CantidadDisponible,StockMinimo,IdProveedor,Activo)
           VALUES (?,?,?,?,?,1)`,
          [item.name,item.unit,item.quantity,item.minimum,supplierId]
        );
        ingredientId = createdIngredient.insertId;
        await conn.execute(
          `INSERT INTO TblMovimientoStock
           (IdInsumo,TipoMovimiento,Cantidad,Motivo,ExistenciaAnterior,ExistenciaNueva)
           VALUES (?,'Entrada',?,'Existencia inicial de plantilla',0,?)`,
          [ingredientId,item.quantity,item.quantity]
        );
      }
      ingredientIds.set(item.name, ingredientId);
    }

    for (const recipe of initialRecipes) {
      const [products] = await conn.execute(
        'SELECT IdProducto FROM TblProducto WHERE Nombre=? ORDER BY IdProducto LIMIT 1',
        [recipe.product]
      );
      if (!products.length) continue;
      const [recipes] = await conn.execute(
        'SELECT IdReceta FROM TblReceta WHERE IdProducto=? LIMIT 1 FOR UPDATE',
        [products[0].IdProducto]
      );
      if (recipes.length) continue;
      const [createdRecipe] = await conn.execute(
        'INSERT INTO TblReceta (IdProducto,Nombre) VALUES (?,?)',
        [products[0].IdProducto,`Receta de ${recipe.product}`]
      );
      for (const [ingredientName, quantity] of recipe.items) {
        const ingredientId = ingredientIds.get(ingredientName);
        const [ingredient] = await conn.execute(
          'SELECT UnidadMedida,CostoUnitario FROM TblInsumo WHERE IdInsumo=?',
          [ingredientId]
        );
        await conn.execute(
          `INSERT INTO TblDetalleReceta
           (IdReceta,IdInsumo,Cantidad,UnidadMedida,CostoUnitarioReferencia)
           VALUES (?,?,?,?,?)`,
          [createdRecipe.insertId,ingredientId,quantity,ingredient[0].UnidadMedida,ingredient[0].CostoUnitario]
        );
      }
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/gestion/insumos') &&
      !req.path.startsWith('/api/gestion/recetas') &&
      !req.path.startsWith('/api/gestion/movimientos-stock')) return next();
  try {
    if (!initialDataPromise) initialDataPromise = ensureInitialTemplateData();
    await initialDataPromise;
    next();
  } catch (error) {
    initialDataPromise = null;
    res.status(500).json({ error:'No se pudieron restaurar los insumos iniciales.', detalle:error.message });
  }
});

// Recursos permitidos: el nombre de tabla y la llave primaria nunca vienen del usuario.
const resources = {
  clientes: { table: 'TblCliente', pk: 'IdCliente' },
  mesas: { table: 'TblMesa', pk: 'IdMesa' },
  empleados: { table: 'TblEmpleado', pk: 'IdEmpleado' },
  productos: { table: 'TblProducto', pk: 'IdProducto' },
  insumos: { table: 'TblInsumo', pk: 'IdInsumo' },
  proveedores: { table: 'TblProveedor', pk: 'IdProveedor' },
  reservas: { table: 'TblReserva', pk: 'IdReserva' },
  pedidos: { table: 'TblPedido', pk: 'IdPedido' },
  'detalles-pedido': { table: 'TblDetallePedido', pk: 'IdDetalle' },
  pagos: { table: 'TblPago', pk: 'IdPago' },
  recetas: { table: 'TblReceta', pk: null },
  compras: { table: 'TblCompra', pk: 'IdCompra' },
  'detalles-compra': { table: 'TblDetalleCompra', pk: 'IdDetalleCompra' },
  'movimientos-stock': { table: 'TblMovimientoStock', pk: 'IdMovimiento' },
};

app.get('/api/estado', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS base, NOW() AS servidor');
    res.json({ conectado: true, ...rows[0] });
  } catch (error) {
    res.status(500).json({ conectado: false, mensaje: 'No se pudo conectar con MySQL. Revisa el archivo .env y que el servicio MySQL esté iniciado.', detalle: error.message });
  }
});

app.get('/api/pedidos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.IdPedido, p.FechaHora, p.TipoPedido, p.Estado,
             c.Nombre AS Cliente, c.Telefono,
             d.IdProducto, pr.Nombre AS Producto, d.Cantidad,
             d.PrecioUnitario, d.NotasPreparacion,
             pg.Estado AS EstadoPago, pg.MetodoPago
      FROM TblPedido p
      LEFT JOIN TblCliente c ON c.IdCliente = p.IdCliente
      LEFT JOIN TblDetallePedido d ON d.IdPedido = p.IdPedido
      LEFT JOIN TblProducto pr ON pr.IdProducto = d.IdProducto
      LEFT JOIN TblPago pg ON pg.IdPedido = p.IdPedido
      ORDER BY p.IdPedido DESC`);
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.IdPedido)) grouped.set(row.IdPedido, {
        id: row.IdPedido, customer: row.Cliente || 'Cliente',
        phone: row.Telefono || '', status: row.Estado,
        time: String(row.FechaHora).slice(11, 16), table: row.TipoPedido,
        paid: row.EstadoPago === 'Pagado', paymentMethod: row.MetodoPago || '', items: []
      });
      if (row.IdProducto) grouped.get(row.IdPedido).items.push({
        productId: row.IdProducto, productName: row.Producto,
        quantity: row.Cantidad, option: row.NotasPreparacion || '',
        unitPrice: Number(row.PrecioUnitario)
      });
    }
    res.json([...grouped.values()]);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron consultar los pedidos.', detalle: error.message });
  }
});


app.get('/api/auth/setup-status', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS total FROM TblUsuario u JOIN TblEmpleado e ON e.IdEmpleado=u.IdEmpleado WHERE u.Rol='Administrador' AND u.Activo=1 AND e.Activo=1"
    );
    res.json({ configuracionInicialPendiente: Number(rows[0].total) === 0 });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo verificar la configuración inicial.', detalle: error.message });
  }
});

app.post('/api/auth/setup', async (req, res) => {
  const { nombre, usuario, password, confirmPassword, correo, telefono } = req.body || {};
  if (!nombre || !usuario || !password || password !== confirmPassword)
    return res.status(400).json({ error: 'Completa nombre, usuario y confirma una contraseña coincidente.' });
  if (String(password).length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [admins] = await conn.execute(
      "SELECT COUNT(*) AS total FROM TblUsuario WHERE Rol='Administrador' AND Activo=1"
    );
    if (Number(admins[0].total) > 0)
      throw new Error('La configuración inicial ya fue completada.');
    const [employee] = await conn.execute(
      "INSERT INTO TblEmpleado (Nombre,Rol,Telefono,Correo,Activo) VALUES (?, 'Administrador', ?, ?, 1)",
      [String(nombre).trim(), telefono || null, correo || null]
    );
    const hash = await bcrypt.hash(String(password), 12);
    await conn.execute(
      "INSERT INTO TblUsuario (IdEmpleado,Usuario,PasswordHash,Rol,Activo) VALUES (?, ?, ?, 'Administrador', 1)",
      [employee.insertId, String(usuario).trim(), hash]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Administrador inicial creado.' });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({
      error: error.code === 'ER_DUP_ENTRY' ? 'Ese usuario ya existe.' : error.message
    });
  } finally {
    conn.release();
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'No hay sesión activa.' });
  await pool.execute('UPDATE TblSesion SET Activa=0 WHERE IdSesion=?', [req.user.IdSesion]);
  res.json({ mensaje: 'Sesión cerrada.' });
});

app.post('/api/auth/change-password', async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  if (newPassword !== confirmPassword)
    return res.status(400).json({ error: 'Las contraseñas nuevas no coinciden.' });
  if (!currentPassword)
    return res.status(400).json({ error: 'Escribe tu contraseña actual.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.execute(
      'SELECT PasswordHash FROM TblUsuario WHERE IdUsuario=? AND Activo=1 FOR UPDATE',
      [req.user.IdUsuario]
    );
    if (!users.length) {
      await conn.rollback();
      return res.status(401).json({ error: 'La cuenta ya no está activa.' });
    }
    if (!(await bcrypt.compare(currentPassword, users[0].PasswordHash))) {
      await conn.rollback();
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await conn.execute(
      'UPDATE TblUsuario SET PasswordHash=? WHERE IdUsuario=?',
      [hash, req.user.IdUsuario]
    );
    await conn.execute(
      'UPDATE TblSesion SET Activa=0 WHERE IdUsuario=? AND IdSesion<>?',
      [req.user.IdUsuario, req.user.IdSesion]
    );
    await conn.commit();
    res.json({ mensaje: 'Contraseña actualizada; las demás sesiones fueron cerradas.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error al cambiar contraseña:', error.message);
    res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
  } finally {
    conn.release();
  }
});

app.get('/api/reservas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.IdReserva AS id, c.Nombre AS customer, c.Telefono AS phone,
             r.NumPersonas AS guests, DATE_FORMAT(r.Fecha, '%Y-%m-%d') AS date,
             TIME_FORMAT(r.HoraInicio, '%H:%i') AS time, m.NumeroMesa AS tableNumber,
             'Confirmada' AS status
      FROM TblReserva r
      INNER JOIN TblCliente c ON c.IdCliente = r.IdCliente
      INNER JOIN TblMesa m ON m.IdMesa = r.IdMesa
      ORDER BY r.IdReserva DESC`);
    res.json(rows.map(r => ({ id:r.id, customer:r.customer, phone:r.phone, guests:r.guests, date:r.date, time:r.time, table:r.tableNumber, status:r.status })));
  } catch (error) { res.status(500).json({ error: 'No se pudieron consultar las reservaciones.', detalle: error.message }); }
});


app.get('/api/productos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT IdProducto,Nombre,Categoria,Descripcion,PrecioVenta,Imagen,Disponible,StockDirecto
      FROM TblProducto
      ORDER BY IdProducto`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error:'No se pudo cargar el menú desde MySQL.', detalle:error.message });
  }
});

app.post('/api/gestion/productos', requireRole('Admin'), async (req, res) => {
  const { nombre, categoria, descripcion, precio, imagen, disponible = true, stockDirecto = null } = req.body || {};
  const cleanName = String(nombre || '').trim();
  const cleanCategory = String(categoria || '').trim();
  const cleanDescription = String(descripcion || '').trim();
  const cleanImage = String(imagen || '').trim();
  const amount = Number(precio);
  const stock = stockDirecto === null || stockDirecto === '' ? null : Number(stockDirecto);
  if (!cleanName || !cleanCategory || !Number.isFinite(amount) || amount <= 0 ||
      (stock !== null && (!Number.isFinite(stock) || stock < 0)))
    return res.status(400).json({ error:'Completa el nombre, la categoría y un precio válido. El stock no puede ser negativo.' });
  try {
    const [result] = await pool.execute(
      `INSERT INTO TblProducto
       (Nombre,Categoria,Descripcion,PrecioVenta,Imagen,Disponible,StockDirecto)
       VALUES (?,?,?,?,?,?,?)`,
      [cleanName,cleanCategory,cleanDescription || null,amount,cleanImage || null,disponible ? 1 : 0,stock]
    );
    res.status(201).json({ mensaje:'Producto agregado al catálogo.', id:result.insertId });
  } catch (error) {
    res.status(400).json({ error:'No se pudo guardar el producto en MySQL.', detalle:error.message });
  }
});

app.get('/api/:recurso', async (req, res) => {
  const resource = resources[req.params.recurso];
  if (!resource) return res.status(404).json({ error: 'Recurso no encontrado' });
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${resource.table}\` ORDER BY 1 DESC`);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/:recurso/:id', async (req, res, next) => {
  const resource = resources[req.params.recurso];
  if (!resource) return next();
  if (!resource.pk) return res.status(400).json({ error: 'Este recurso no permite consulta por ID.' });
  try {
    const [rows] = await pool.execute(`SELECT * FROM \`${resource.table}\` WHERE \`${resource.pk}\` = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/gestion/insumos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT i.*, p.Nombre AS Proveedor
      FROM TblInsumo i LEFT JOIN TblProveedor p ON p.IdProveedor = i.IdProveedor
      ORDER BY i.Nombre`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron consultar los insumos.', detalle: error.message });
  }
});

app.get('/api/gestion/proveedores', requireRole('Admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT IdProveedor,Nombre FROM TblProveedor ORDER BY Nombre'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron consultar los proveedores.' });
  }
});

app.post('/api/gestion/insumos', async (req, res) => {
  const { nombre, descripcion, unidadMedida, cantidadDisponible = 0, stockMinimo = 0, costoUnitario = 0, proveedor } = req.body || {};
  const stock = Number(cantidadDisponible), minimum = Number(stockMinimo), cost = Number(costoUnitario);
  if (!nombre || !unidadMedida || !(stock >= 0) || !(minimum >= 0) || !(cost >= 0))
    return res.status(400).json({ error: 'Completa nombre, unidad y cantidades válidas.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let idProveedor = null;
    if (proveedor) {
      const [providers] = await conn.execute('SELECT IdProveedor FROM TblProveedor WHERE Nombre = ? LIMIT 1', [String(proveedor).trim()]);
      if (providers.length) idProveedor = providers[0].IdProveedor;
      else {
        const [createdProvider] = await conn.execute('INSERT INTO TblProveedor (Nombre) VALUES (?)', [String(proveedor).trim()]);
        idProveedor = createdProvider.insertId;
      }
    }
    const [result] = await conn.execute(
      `INSERT INTO TblInsumo
       (Nombre, Descripcion, UnidadMedida, CantidadDisponible, StockMinimo, CostoUnitario, IdProveedor)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(nombre).trim(), descripcion || null, String(unidadMedida).trim(), stock, minimum, cost, idProveedor]
    );
    if (stock > 0) {
      await conn.execute(
        `INSERT INTO TblMovimientoStock
         (IdInsumo, TipoMovimiento, Cantidad, Motivo, ExistenciaAnterior, ExistenciaNueva)
         VALUES (?, 'Entrada', ?, 'Existencia inicial', 0, ?)`,
        [result.insertId, stock, stock]
      );
    }
    await conn.commit();
    res.status(201).json({ mensaje: 'Insumo creado.', id: result.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message });
  } finally { conn.release(); }
});

app.get('/api/gestion/empleados', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT e.IdEmpleado, e.Nombre, e.Rol AS Puesto, e.Correo,
      e.SalarioBase, e.Activo, u.Usuario, u.Rol AS RolAcceso
      FROM TblEmpleado e LEFT JOIN TblUsuario u ON u.IdEmpleado = e.IdEmpleado
      ORDER BY e.Nombre`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo consultar el equipo.', detalle: error.message });
  }
});

app.put('/api/gestion/empleados/:id/estado', requireRole('Admin'), async (req, res) => {
  const activo = req.body?.activo === true || req.body?.activo === 1 || req.body?.Activo === 1;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [employees] = await conn.execute(
      'SELECT IdEmpleado,Rol FROM TblEmpleado WHERE IdEmpleado=? FOR UPDATE',
      [Number(req.params.id)]
    );
    if (!employees.length) throw new Error('Empleado no encontrado.');
    if (!activo) {
      const [admins] = await conn.execute(
        "SELECT COUNT(*) AS total FROM TblUsuario u JOIN TblEmpleado e ON e.IdEmpleado=u.IdEmpleado WHERE u.Rol='Administrador' AND u.Activo=1 AND e.Activo=1 AND e.IdEmpleado<>?",
        [Number(req.params.id)]
      );
      if (employees[0].Rol === 'Administrador' && Number(admins[0].total) === 0)
        throw new Error('No se puede desactivar al último administrador activo.');
    }
    await conn.execute('UPDATE TblEmpleado SET Activo=? WHERE IdEmpleado=?',
      [activo ? 1 : 0, Number(req.params.id)]);
    await conn.execute('UPDATE TblUsuario SET Activo=? WHERE IdEmpleado=?',
      [activo ? 1 : 0, Number(req.params.id)]);
    if (!activo)
      await conn.execute(
        'UPDATE TblSesion s JOIN TblUsuario u ON u.IdUsuario=s.IdUsuario SET s.Activa=0 WHERE u.IdEmpleado=?',
        [Number(req.params.id)]
      );
    await conn.commit();
    res.json({ mensaje: activo ? 'Cuenta reactivada.' : 'Cuenta desactivada; sus sesiones fueron cerradas.' });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error:error.message });
  } finally { conn.release(); }
});

app.post('/api/gestion/empleados', requireRole('Admin'), async (req, res) => {
  const { nombre, correo, usuario, password, confirmPassword, rol, salarioBase = 0 } = req.body || {};
  const databaseRole = rol === 'Admin' ? 'Administrador' : rol;
  if (!nombre || !usuario || !password || String(password).length < 8 || password !== confirmPassword ||
      !['Administrador', 'Cajero', 'Barista'].includes(databaseRole) || !(Number(salarioBase) >= 0))
    return res.status(400).json({ error: 'Completa nombre, usuario, rol e importe válido y confirma una contraseña de al menos 8 caracteres.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [employee] = await conn.execute(
      'INSERT INTO TblEmpleado (Nombre, Rol, Correo, SalarioBase) VALUES (?, ?, ?, ?)',
      [String(nombre).trim(), databaseRole, String(correo).trim().toLowerCase(), Number(salarioBase)]
    );
    const hash = await bcrypt.hash(String(password), 12);
    await conn.execute(
      'INSERT INTO TblUsuario (IdEmpleado, Usuario, PasswordHash, Rol) VALUES (?, ?, ?, ?)',
      [employee.insertId, String(usuario).trim(), hash, databaseRole]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Empleado y perfil creados.', id: employee.insertId });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Ese correo o nombre de usuario ya está registrado.' : error.message });
  } finally { conn.release(); }
});

app.post('/api/:recurso', async (req, res) => {
  const resource = resources[req.params.recurso];
  if (!resource) return res.status(404).json({ error: 'Recurso no encontrado' });
  try {
    const [columns] = await pool.query(`SHOW COLUMNS FROM \`${resource.table}\``);
    const allowed = columns.map(c => c.Field).filter(c => c !== resource.pk);
    const entries = Object.entries(req.body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return res.status(400).json({ error: 'Envía al menos un campo válido.' });
    const names = entries.map(([key]) => `\`${key}\``).join(', ');
    const marks = entries.map(() => '?').join(', ');
    const values = entries.map(([, value]) => value);
    const [result] = await pool.execute(`INSERT INTO \`${resource.table}\` (${names}) VALUES (${marks})`, values);
    res.status(201).json({ mensaje: 'Registro creado', id: result.insertId });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/:recurso/:id', async (req, res) => {
  const resource = resources[req.params.recurso];
  if (!resource || !resource.pk) return res.status(400).json({ error: 'Este recurso no permite actualización por ID.' });
  try {
    const [columns] = await pool.query(`SHOW COLUMNS FROM \`${resource.table}\``);
    const allowed = columns.map(c => c.Field).filter(c => c !== resource.pk);
    const entries = Object.entries(req.body || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return res.status(400).json({ error: 'Envía al menos un campo válido.' });
    const set = entries.map(([key]) => `\`${key}\` = ?`).join(', ');
    const values = entries.map(([, value]) => value);
    const [result] = await pool.execute(`UPDATE \`${resource.table}\` SET ${set} WHERE \`${resource.pk}\` = ?`, [...values, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ mensaje: 'Registro actualizado' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/:recurso/:id', async (req, res) => {
  const resource = resources[req.params.recurso];
  if (!resource || !resource.pk) return res.status(400).json({ error: 'Este recurso no permite eliminación por ID.' });
  try {
    const [result] = await pool.execute(`DELETE FROM \`${resource.table}\` WHERE \`${resource.pk}\` = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ mensaje: 'Registro eliminado' });
  } catch (error) { res.status(409).json({ error: 'No se puede eliminar: el registro puede estar relacionado con otros datos.', detalle: error.message }); }
});


// Pedidos y reservaciones creados desde la zona pública: se guardan en MySQL.
async function getOrCreateCustomer(conn, { nombre, telefono, correo }) {
  const cleanPhone = String(telefono || '').trim();
  if (!cleanPhone) throw new Error('El teléfono del cliente es obligatorio.');
  const [found] = await conn.execute(
    'SELECT IdCliente FROM TblCliente WHERE Telefono = ? LIMIT 1', [cleanPhone]
  );
  if (found.length) {
    await conn.execute(
      'UPDATE TblCliente SET Nombre = ?, Correo = ? WHERE IdCliente = ?',
      [String(nombre).trim(), correo || null, found[0].IdCliente]
    );
    return found[0].IdCliente;
  }
  const [created] = await conn.execute(
    'INSERT INTO TblCliente (Nombre, Telefono, Correo) VALUES (?, ?, ?)',
    [String(nombre).trim(), cleanPhone, correo || null]
  );
  return created.insertId;
}

async function getOrCreateWebEmployee(conn) {
  const [rows] = await conn.query('SELECT IdEmpleado FROM TblEmpleado ORDER BY IdEmpleado LIMIT 1');
  if (rows.length) return rows[0].IdEmpleado;
  const [created] = await conn.execute(
    'INSERT INTO TblEmpleado (Nombre, Rol) VALUES (?, ?)',
    ['Pedidos de página web', 'Sistema']
  );
  return created.insertId;
}

app.post('/api/public/pedidos', async (req, res) => {
  const { nombre, telefono, correo, tipoPedido, metodoPago, items } = req.body || {};
  if (!nombre || !telefono || !tipoPedido || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Completa nombre, teléfono, tipo de pedido y agrega al menos un producto.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const idCliente = await getOrCreateCustomer(conn, { nombre, telefono, correo });
    const idEmpleado = await getOrCreateWebEmployee(conn);
    const resolvedItems = [];
    for (const item of items) {
      let [products] = [[], []];
      if (item.productName) {
        [products] = await conn.execute(
          'SELECT IdProducto, Nombre, PrecioVenta, Disponible FROM TblProducto WHERE Nombre = ? LIMIT 1',
          [String(item.productName)]
        );
      }
      if (!products.length && !item.productName) {
        [products] = await conn.execute(
          'SELECT IdProducto, Nombre, PrecioVenta, Disponible FROM TblProducto WHERE IdProducto = ? LIMIT 1',
          [Number(item.productId)]
        );
      }
      if (!products.length) throw new Error(`El producto "${item.productName || item.productId}" no existe en TblProducto. Regístralo con ese mismo nombre en MySQL antes de venderlo.`);
      if (!products[0].Disponible) throw new Error(`El producto "${products[0].Nombre}" no está disponible.`);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      resolvedItems.push({ ...products[0], quantity, notes: item.option || null });
    }
    const [orderResult] = await conn.execute(
      'INSERT INTO TblPedido (FechaHora, TipoPedido, Estado, IdCliente, IdMesa, IdEmpleado) VALUES (NOW(), ?, ?, ?, ?, ?)',
      [String(tipoPedido), 'Pendiente', idCliente, null, idEmpleado]
    );
    let total = 0;
    for (const item of resolvedItems) {
      const price = Number(item.PrecioVenta);
      total += price * item.quantity;
      await conn.execute(
        'INSERT INTO TblDetallePedido (IdPedido, IdProducto, Cantidad, PrecioUnitario, NotasPreparacion) VALUES (?, ?, ?, ?, ?)',
        [orderResult.insertId, item.IdProducto, item.quantity, price, item.notes]
      );
      const [recipe] = await conn.execute(
        `SELECT dr.IdInsumo, dr.Cantidad, i.Nombre, i.CantidadDisponible
         FROM TblReceta r
         JOIN TblDetalleReceta dr ON dr.IdReceta = r.IdReceta
         JOIN TblInsumo i ON i.IdInsumo = dr.IdInsumo
         WHERE r.IdProducto = ? FOR UPDATE`,
        [item.IdProducto]
      );
      if (recipe.length) {
        for (const ingredient of recipe) {
          const used = Number(ingredient.Cantidad) * item.quantity;
          const before = Number(ingredient.CantidadDisponible);
          if (before < used) throw new Error(`No hay suficiente ${ingredient.Nombre} para completar el pedido.`);
          const after = before - used;
          await conn.execute(
            'UPDATE TblInsumo SET CantidadDisponible = ? WHERE IdInsumo = ?',
            [after, ingredient.IdInsumo]
          );
          await conn.execute(
            `INSERT INTO TblMovimientoStock
             (IdInsumo, TipoMovimiento, Cantidad, Motivo, IdEmpleado, IdPedido, ExistenciaAnterior, ExistenciaNueva)
             VALUES (?, 'Salida', ?, ?, ?, ?, ?, ?)`,
            [ingredient.IdInsumo, used, `Pedido #${orderResult.insertId}`, idEmpleado, orderResult.insertId, before, after]
          );
        }
      } else {
        const [products] = await conn.execute(
          'SELECT StockDirecto FROM TblProducto WHERE IdProducto = ? FOR UPDATE',
          [item.IdProducto]
        );
        if (products[0].StockDirecto !== null) {
          const before = Number(products[0].StockDirecto);
          if (before < item.quantity) throw new Error(`No hay existencias suficientes de ${item.Nombre}.`);
          await conn.execute(
            'UPDATE TblProducto SET StockDirecto = ? WHERE IdProducto = ?',
            [before - item.quantity, item.IdProducto]
          );
        }
      }
    }
    // El formulario indica que el pago es simulado; se registra como pendiente, sin cobrar.
    await conn.execute(
      'INSERT INTO TblPago (FechaHora, Monto, MetodoPago, Estado, IdPedido) VALUES (NOW(), ?, ?, ?, ?)',
      [total, String(metodoPago || 'En caja'), 'Pendiente', orderResult.insertId]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Pedido guardado en MySQL.', id: orderResult.insertId, total, estado: 'Pendiente' });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message });
  } finally { conn.release(); }
});

const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error('Configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET de Sandbox en el archivo .env.');
  const response = await fetch(`${PAYPAL_SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const result = await response.json();
  if (!response.ok || !result.access_token)
    throw new Error('PayPal Sandbox no pudo autenticar la aplicación. Verifica sus credenciales en .env.');
  return result.access_token;
}

app.post('/api/public/pedidos/:id/paypal/crear', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isSafeInteger(orderId) || orderId < 1)
    return res.status(400).json({ error:'Número de pedido no válido.' });
  try {
    const [payments] = await pool.execute(
      'SELECT Monto,Estado,MetodoPago FROM TblPago WHERE IdPedido=? LIMIT 1',[orderId]
    );
    if (!payments.length) return res.status(404).json({ error:'No se encontró el pedido.' });
    if (payments[0].MetodoPago !== 'Tarjeta')
      return res.status(400).json({ error:'Este pedido no fue registrado para pagar con tarjeta.' });
    if (payments[0].Estado === 'Pagado')
      return res.status(409).json({ error:'Este pedido ya aparece pagado.' });

    const accessToken = await getPayPalAccessToken();
    const appUrl = new URL(process.env.PUBLIC_APP_URL || 'http://localhost:5173');
    const returnUrl = new URL('/', appUrl);
    returnUrl.searchParams.set('zona','publica');
    returnUrl.searchParams.set('pagina','Mi pedido');
    returnUrl.searchParams.set('paypal','success');
    returnUrl.searchParams.set('pedido',String(orderId));
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('paypal','cancel');

    const response = await fetch(`${PAYPAL_SANDBOX_API}/v2/checkout/orders`, {
      method:'POST',
      headers:{
        Authorization:`Bearer ${accessToken}`,
        'Content-Type':'application/json',
        'PayPal-Request-Id':`coffee-teria-order-${orderId}-${Date.now()}`
      },
      body:JSON.stringify({
        intent:'CAPTURE',
        purchase_units:[{
          reference_id:String(orderId),
          custom_id:String(orderId),
          amount:{currency_code:'MXN',value:Number(payments[0].Monto).toFixed(2)}
        }],
        application_context:{
          brand_name:'COFFEE-TERIA',
          user_action:'PAY_NOW',
          return_url:returnUrl.toString(),
          cancel_url:cancelUrl.toString()
        }
      })
    });
    const paypalOrder = await response.json();
    if (!response.ok || !paypalOrder.id)
      return res.status(502).json({ error:'PayPal Sandbox no pudo iniciar el pago. El pedido permanece guardado y pendiente.' });
    const approvalLink = paypalOrder.links?.find((link) =>
      link.rel === 'payer-action' || link.rel === 'approve'
    )?.href;
    if (!approvalLink)
      return res.status(502).json({ error:'PayPal no devolvió el enlace de aprobación. El pedido permanece pendiente.' });
    await pool.execute(
      "UPDATE TblPago SET Referencia=? WHERE IdPedido=? AND Estado='Pendiente'",
      [paypalOrder.id,orderId]
    );
    res.json({ approveUrl:approvalLink });
  } catch (error) {
    res.status(503).json({ error:error.message || 'No se pudo iniciar PayPal Sandbox.' });
  }
});

app.post('/api/public/pedidos/:id/paypal/capturar', async (req, res) => {
  const orderId = Number(req.params.id);
  const paypalOrderId = String(req.body?.paypalOrderId || '');
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !paypalOrderId)
    return res.status(400).json({ error:'Pedido o referencia de PayPal no válidos.' });
  try {
    const [payments] = await pool.execute(
      'SELECT Monto,Estado,Referencia FROM TblPago WHERE IdPedido=? LIMIT 1',[orderId]
    );
    if (!payments.length) return res.status(404).json({ error:'No se encontró el pago del pedido.' });
    if (payments[0].Referencia !== paypalOrderId)
      return res.status(409).json({ error:'La referencia de PayPal no corresponde a este pedido.' });
    if (payments[0].MetodoPago !== 'Tarjeta')
      return res.status(400).json({ error:'Este pedido no fue registrado para pagar con tarjeta.' });
    if (payments[0].Estado === 'Pagado')
      return res.json({ mensaje:'Pago de Sandbox ya confirmado.',pagado:true });

    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `${PAYPAL_SANDBOX_API}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'} }
    );
    const capture = await response.json();
    if (!response.ok || capture.status !== 'COMPLETED')
      return res.status(402).json({ error:'PayPal Sandbox no confirmó el pago. El pedido sigue pendiente.' });
    const purchaseUnit = capture.purchase_units?.[0];
    const captured = purchaseUnit?.payments?.captures?.[0];
    const capturedAmount = Number(captured?.amount?.value);
    if (
      String(purchaseUnit?.custom_id || purchaseUnit?.reference_id || '') !== String(orderId) ||
      captured?.amount?.currency_code !== 'MXN' ||
      !Number.isFinite(capturedAmount) ||
      capturedAmount !== Number(payments[0].Monto)
    )
      return res.status(409).json({ error:'El importe confirmado por PayPal no coincide con el pedido.' });

    const [updated] = await pool.execute(
      "UPDATE TblPago SET Estado='Pagado',FechaHora=NOW() WHERE IdPedido=? AND Estado='Pendiente' AND Referencia=?",
      [orderId,paypalOrderId]
    );
    if (!updated.affectedRows) {
      const [current] = await pool.execute(
        'SELECT Estado FROM TblPago WHERE IdPedido=? LIMIT 1',[orderId]
      );
      if (current[0]?.Estado !== 'Pagado')
        return res.status(409).json({ error:'No se pudo guardar la confirmación del pago.' });
    }
    res.json({ mensaje:'Pago de Sandbox confirmado.',pagado:true });
  } catch (error) {
    res.status(503).json({ error:error.message || 'No se pudo confirmar el pago de PayPal Sandbox.' });
  }
});

app.put('/api/pedidos/:id/pago', async (req, res) => {
  try {
    const [result] = await pool.execute(
      "UPDATE TblPago SET Estado = 'Pagado', FechaHora = NOW() WHERE IdPedido = ?",
      [req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No existe un registro de pago para este pedido.' });
    res.json({ mensaje: 'Pago registrado en MySQL.' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.put('/api/pedidos/:id/estado', async (req, res) => {
  const allowed = ['Pendiente', 'Preparando', 'Listo', 'Entregado', 'Cancelado'];
  if (!allowed.includes(req.body?.estado)) return res.status(400).json({ error: 'Estado no válido.' });
  try {
    const [result] = await pool.execute('UPDATE TblPedido SET Estado = ? WHERE IdPedido = ?', [req.body.estado, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json({ mensaje: 'Estado actualizado en MySQL.' });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/public/reservas', async (req, res) => {
  const { nombre, telefono, correo, fecha, hora, personas } = req.body || {};
  if (!nombre || !telefono || !fecha || !hora || !Number(personas))
    return res.status(400).json({ error: 'Completa nombre, teléfono, fecha, hora y número de personas.' });
  try {
    await ensureInitialTables();
  } catch (error) {
    return res.status(500).json({ error: 'No se pudieron preparar las mesas.', detalle: error.message });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const idCliente = await getOrCreateCustomer(conn, { nombre, telefono, correo });
    const [tables] = await conn.execute(
      `SELECT m.IdMesa, m.NumeroMesa FROM TblMesa m
       WHERE m.Capacidad >= ?
       AND NOT EXISTS (
         SELECT 1 FROM TblReserva r
         WHERE r.IdMesa = m.IdMesa AND r.Fecha = ?
         AND r.HoraInicio < ADDTIME(?, '01:30:00')
         AND r.HoraFin > ?
       ) ORDER BY m.Capacidad ASC, m.NumeroMesa ASC LIMIT 1`,
      [Number(personas), fecha, hora, hora]
    );
    if (!tables.length) throw new Error('No hay mesas disponibles para esa fecha, hora y cantidad de personas.');
    const [result] = await conn.execute(
      'INSERT INTO TblReserva (Fecha, HoraInicio, HoraFin, NumPersonas, IdCliente, IdMesa) VALUES (?, ?, ADDTIME(?, \'01:30:00\'), ?, ?, ?)',
      [fecha, hora, hora, Number(personas), idCliente, tables[0].IdMesa]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Reservación guardada en MySQL.', id: result.insertId, mesa: tables[0].NumeroMesa });
  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message });
  } finally { conn.release(); }
});


// ===================== FUNCIONES ADMINISTRATIVAS =====================
// Se usan rutas /api/gestion/* para no interferir con las rutas CRUD existentes.

app.get('/api/gestion/compras', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    let sql = `SELECT c.IdCompra, c.FechaHora, c.Estado, c.Observaciones,
                      c.Total, pr.Nombre AS Proveedor, e.Nombre AS Empleado,
                      dc.IdInsumo, i.Nombre AS Insumo, dc.Cantidad,
                      i.UnidadMedida, dc.CostoUnitario,
                      (dc.Cantidad * dc.CostoUnitario) AS Importe
               FROM TblCompra c
               LEFT JOIN TblProveedor pr ON pr.IdProveedor = c.IdProveedor
               LEFT JOIN TblEmpleado e ON e.IdEmpleado = c.IdEmpleado
               LEFT JOIN TblDetalleCompra dc ON dc.IdCompra = c.IdCompra
               LEFT JOIN TblInsumo i ON i.IdInsumo = dc.IdInsumo
               WHERE 1=1`;
    const params = [];
    if (desde) { sql += ' AND DATE(c.FechaHora) >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND DATE(c.FechaHora) <= ?'; params.push(hasta); }
    sql += ' ORDER BY c.FechaHora DESC, c.IdCompra DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'No se pudo consultar el historial de compras.', detalle: e.message }); }
});

// Compra completa: registra encabezado, detalle, incrementa stock y genera movimientos.
app.post('/api/gestion/compras', async (req, res) => {
  const { idProveedor, proveedor, idEmpleado, observaciones, items } = req.body || {};
  if (!idEmpleado || !Array.isArray(items) || !items.length || (!idProveedor && !proveedor))
    return res.status(400).json({ error: 'Indica proveedor, empleado y al menos un insumo.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let resolvedProvider = Number(idProveedor) || null;
    if (!resolvedProvider) {
      const [providers] = await conn.execute(
        'SELECT IdProveedor FROM TblProveedor WHERE Nombre = ? LIMIT 1',
        [String(proveedor).trim()]
      );
      if (providers.length) resolvedProvider = providers[0].IdProveedor;
      else {
        const [createdProvider] = await conn.execute(
          'INSERT INTO TblProveedor (Nombre) VALUES (?)',
          [String(proveedor).trim()]
        );
        resolvedProvider = createdProvider.insertId;
      }
    }
    const [head] = await conn.execute(
      "INSERT INTO TblCompra (FechaHora, Estado, Observaciones, IdProveedor, IdEmpleado) VALUES (NOW(), 'Recibida', ?, ?, ?)",
      [observaciones || null, resolvedProvider, Number(idEmpleado)]
    );
    let total = 0;
    for (const item of items) {
      const idInsumo = Number(item.idInsumo);
      const cantidad = Number(item.cantidad);
      const costo = Number(item.costoUnitario);
      if (!idInsumo || !(cantidad > 0) || !(costo >= 0)) throw new Error('Hay un detalle de compra con datos inválidos.');
      const [ingredients] = await conn.execute(
        'SELECT CantidadDisponible, CostoUnitario FROM TblInsumo WHERE IdInsumo = ? FOR UPDATE',
        [idInsumo]
      );
      if (!ingredients.length) throw new Error(`El insumo ${idInsumo} no existe.`);
      const before = Number(ingredients[0].CantidadDisponible);
      const next = before + cantidad;
      const averageCost = next > 0
        ? (before * Number(ingredients[0].CostoUnitario) + cantidad * costo) / next
        : costo;
      const subtotal = cantidad * costo;
      await conn.execute(
        'INSERT INTO TblDetalleCompra (IdCompra, IdInsumo, Cantidad, CostoUnitario, Subtotal) VALUES (?, ?, ?, ?, ?)',
        [head.insertId, idInsumo, cantidad, costo, subtotal]
      );
      await conn.execute(
        'UPDATE TblInsumo SET CantidadDisponible = ?, CostoUnitario = ?, IdProveedor = ? WHERE IdInsumo = ?',
        [next, averageCost, resolvedProvider, idInsumo]
      );
      await conn.execute(
        `INSERT INTO TblMovimientoStock
         (IdInsumo, TipoMovimiento, Cantidad, Motivo, IdEmpleado, IdCompra, ExistenciaAnterior, ExistenciaNueva)
         VALUES (?, 'Entrada', ?, ?, ?, ?, ?, ?)`,
        [idInsumo, cantidad, `Compra #${head.insertId}`, Number(idEmpleado), head.insertId, before, next]
      );
      total += subtotal;
    }
    await conn.execute(
      'UPDATE TblCompra SET Subtotal = ?, Total = ? WHERE IdCompra = ?',
      [total, total, head.insertId]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Compra registrada; inventario actualizado.', id: head.insertId, total });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); }
  finally { conn.release(); }
});

// Ajustes de inventario manuales: toda entrada/salida queda auditada.
app.post('/api/gestion/movimientos-stock', async (req, res) => {
  const { tipo, cantidad, motivo, idEmpleado, idInsumo } = req.body || {};
  const qty = Number(cantidad);
  if (!['Entrada','Salida','Ajuste'].includes(tipo) || !(qty > 0) || !motivo || !idEmpleado || !idInsumo)
    return res.status(400).json({ error: 'Completa tipo, cantidad positiva, motivo, empleado e insumo.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT CantidadDisponible FROM TblInsumo WHERE IdInsumo = ? FOR UPDATE', [Number(idInsumo)]);
    if (!rows.length) throw new Error('El insumo no existe.');
    const before = Number(rows[0].CantidadDisponible);
    const next = tipo === 'Entrada' ? before + qty : tipo === 'Salida' ? before - qty : qty;
    if (next < 0) throw new Error('No hay existencias suficientes.');
    await conn.execute('UPDATE TblInsumo SET CantidadDisponible = ? WHERE IdInsumo = ?', [next, Number(idInsumo)]);
    await conn.execute(
      `INSERT INTO TblMovimientoStock
       (IdInsumo, TipoMovimiento, Cantidad, Motivo, IdEmpleado, ExistenciaAnterior, ExistenciaNueva)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [Number(idInsumo), tipo, Math.abs(next - before) || qty, String(motivo), Number(idEmpleado), before, next]
    );
    await conn.commit();
    res.status(201).json({ mensaje: 'Movimiento registrado y stock actualizado.' });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); }
  finally { conn.release(); }
});

app.get('/api/gestion/movimientos-stock', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT m.*, i.Nombre AS Insumo, e.Nombre AS Empleado
      FROM TblMovimientoStock m LEFT JOIN TblInsumo i ON i.IdInsumo=m.IdInsumo
      LEFT JOIN TblEmpleado e ON e.IdEmpleado=m.IdEmpleado ORDER BY m.FechaHora DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sustituye de forma transaccional los ingredientes de una receta de producto.
app.put('/api/gestion/recetas/:idProducto', async (req, res) => {
  const idProducto = Number(req.params.idProducto);
  const items = req.body?.items;
  if (!idProducto || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: 'Selecciona un producto y agrega al menos un insumo a la receta.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [product] = await conn.execute('SELECT IdProducto FROM TblProducto WHERE IdProducto=?', [idProducto]);
    if (!product.length) throw new Error('El producto no existe.');
    const [existing] = await conn.execute('SELECT IdReceta FROM TblReceta WHERE IdProducto = ?', [idProducto]);
    let idReceta;
    if (existing.length) {
      idReceta = existing[0].IdReceta;
      await conn.execute('DELETE FROM TblDetalleReceta WHERE IdReceta = ?', [idReceta]);
    } else {
      const [created] = await conn.execute(
        'INSERT INTO TblReceta (IdProducto, Nombre) VALUES (?, ?)',
        [idProducto, `Receta de producto ${idProducto}`]
      );
      idReceta = created.insertId;
    }
    let preparationCost = 0;
    for (const item of items) {
      const idInsumo = Number(item.idInsumo), cantidad = Number(item.cantidad);
      if (!idInsumo || !(cantidad > 0)) throw new Error('Cada ingrediente debe tener insumo y cantidad mayor que cero.');
      const [ingredients] = await conn.execute(
        'SELECT UnidadMedida, CostoUnitario FROM TblInsumo WHERE IdInsumo = ?',
        [idInsumo]
      );
      if (!ingredients.length) throw new Error(`El insumo ${idInsumo} no existe.`);
      preparationCost += cantidad * Number(ingredients[0].CostoUnitario);
      await conn.execute(
        `INSERT INTO TblDetalleReceta
         (IdReceta, IdInsumo, Cantidad, UnidadMedida, CostoUnitarioReferencia)
         VALUES (?, ?, ?, ?, ?)`,
        [idReceta, idInsumo, cantidad, ingredients[0].UnidadMedida, ingredients[0].CostoUnitario]
      );
    }
    await conn.execute('UPDATE TblReceta SET CostoPreparacion = ? WHERE IdReceta = ?', [preparationCost, idReceta]);
    await conn.commit();
    res.json({ mensaje: 'Receta guardada en MySQL.' });
  } catch (e) { await conn.rollback(); res.status(400).json({ error: e.message }); }
  finally { conn.release(); }
});

app.get('/api/gestion/recetas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT r.IdProducto, p.Nombre AS Producto, dr.IdInsumo,
      i.Nombre AS Insumo, dr.Cantidad, dr.UnidadMedida
      FROM TblReceta r JOIN TblProducto p ON p.IdProducto = r.IdProducto
      JOIN TblDetalleReceta dr ON dr.IdReceta = r.IdReceta
      JOIN TblInsumo i ON i.IdInsumo = dr.IdInsumo ORDER BY p.Nombre, i.Nombre`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Nómina: registra pagos de empleados y alimenta los reportes de gastos.
app.get('/api/gestion/nomina', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT n.*, e.Nombre AS Empleado, e.Rol
      FROM TblNomina n JOIN TblEmpleado e ON e.IdEmpleado = n.IdEmpleado ORDER BY n.PeriodoInicio DESC, n.IdNomina DESC`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/gestion/nomina', async (req, res) => {
  const { idEmpleado, periodoInicio, periodoFin, sueldoBase, bonificaciones = 0, deducciones = 0, observaciones, estado } = req.body || {};
  const base = Number(sueldoBase), bonus = Number(bonificaciones), deductions = Number(deducciones);
  if (!idEmpleado || !periodoInicio || !periodoFin || !(base >= 0) || !(bonus >= 0) || !(deductions >= 0) || deductions > base + bonus)
    return res.status(400).json({ error: 'Completa empleado, periodo e importes válidos.' });
  try {
    const [result] = await pool.execute(
      `INSERT INTO TblNomina
       (IdEmpleado, PeriodoInicio, PeriodoFin, SueldoBase, Bonificaciones, Deducciones, TotalPagado, FechaPago, Estado, Observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(idEmpleado), periodoInicio, periodoFin, base, bonus, deductions, base + bonus - deductions,
        estado === 'Pendiente' ? null : new Date(), estado === 'Pendiente' ? 'Pendiente' : 'Pagado', observaciones || null]
    );
    res.status(201).json({ mensaje: 'Pago de nómina registrado.', id: result.insertId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Reporte resumido por fechas. Ventas pagadas, compras e importe de nómina.
app.get('/api/gestion/reportes/resumen', async (req, res) => {
  const desde = req.query.desde || '2000-01-01';
  const hasta = req.query.hasta || '2099-12-31';
  try {
    const [[ventas]] = await pool.execute(`SELECT COUNT(DISTINCT p.IdPedido) AS pedidos,
      COALESCE(SUM(d.Cantidad * d.PrecioUnitario), 0) AS importeVentas
      FROM TblPedido p JOIN TblPago pg ON pg.IdPedido=p.IdPedido
      JOIN TblDetallePedido d ON d.IdPedido=p.IdPedido
      WHERE pg.Estado = 'Pagado' AND p.Estado <> 'Cancelado' AND DATE(p.FechaHora) BETWEEN ? AND ?`, [desde, hasta]);
    const [[compras]] = await pool.execute(`SELECT COALESCE(SUM(dc.Cantidad*dc.CostoUnitario),0) AS importeCompras
      FROM TblCompra c JOIN TblDetalleCompra dc ON dc.IdCompra=c.IdCompra
      WHERE DATE(c.FechaHora) BETWEEN ? AND ?`, [desde, hasta]);
    const [[nomina]] = await pool.execute(`SELECT COALESCE(SUM(TotalPagado),0) AS importeNomina
      FROM TblNomina WHERE Estado = 'Pagado' AND DATE(FechaPago) BETWEEN ? AND ?`, [desde, hasta]);
    const [nominaRegistros] = await pool.execute(`SELECT n.IdNomina, n.PeriodoInicio,
      n.PeriodoFin, n.TotalPagado, n.Estado, n.FechaPago, e.Nombre AS Empleado
      FROM TblNomina n JOIN TblEmpleado e ON e.IdEmpleado = n.IdEmpleado
      WHERE (n.FechaPago IS NULL OR DATE(n.FechaPago) BETWEEN ? AND ?)
      ORDER BY n.PeriodoInicio DESC, n.IdNomina DESC`, [desde, hasta]);
    const [ventasPorProducto] = await pool.execute(`SELECT pr.Nombre AS Producto,
      SUM(d.Cantidad) AS Unidades, SUM(d.Cantidad * d.PrecioUnitario) AS Importe,
      SUM(d.Cantidad * COALESCE(costos.Costo, 0)) AS CostoInsumos,
      SUM(d.Cantidad * (d.PrecioUnitario - COALESCE(costos.Costo, 0))) AS UtilidadBruta
      FROM TblPedido p JOIN TblPago pg ON pg.IdPedido=p.IdPedido
      JOIN TblDetallePedido d ON d.IdPedido=p.IdPedido JOIN TblProducto pr ON pr.IdProducto=d.IdProducto
      LEFT JOIN (
        SELECT r.IdProducto, SUM(dr.Cantidad * i.CostoUnitario) AS Costo
        FROM TblReceta r
        JOIN TblDetalleReceta dr ON dr.IdReceta = r.IdReceta
        JOIN TblInsumo i ON i.IdInsumo = dr.IdInsumo
        GROUP BY r.IdProducto
      ) costos ON costos.IdProducto = pr.IdProducto
      WHERE pg.Estado = 'Pagado' AND p.Estado <> 'Cancelado' AND DATE(p.FechaHora) BETWEEN ? AND ?
      GROUP BY pr.IdProducto, pr.Nombre ORDER BY Importe DESC`, [desde, hasta]);
    const [ventasDiarias] = await pool.execute(`SELECT DATE(p.FechaHora) AS Fecha,
      COUNT(DISTINCT p.IdPedido) AS Pedidos, SUM(d.Cantidad) AS Unidades,
      SUM(d.Cantidad * d.PrecioUnitario) AS Importe
      FROM TblPedido p JOIN TblPago pg ON pg.IdPedido = p.IdPedido
      JOIN TblDetallePedido d ON d.IdPedido = p.IdPedido
      WHERE pg.Estado = 'Pagado' AND p.Estado <> 'Cancelado' AND DATE(p.FechaHora) BETWEEN ? AND ?
      GROUP BY DATE(p.FechaHora) ORDER BY Fecha DESC`, [desde, hasta]);
    const [[insumos]] = await pool.execute(`SELECT COUNT(*) AS totalInsumos,
      COALESCE(SUM(CASE WHEN CantidadDisponible <= StockMinimo THEN 1 ELSE 0 END), 0) AS stockBajo
      FROM TblInsumo WHERE Activo = 1`);
    const costoInsumosVendidos = ventasPorProducto.reduce((sum, row) => sum + Number(row.CostoInsumos), 0);
    res.json({
      ventas, compras, nomina, nominaRegistros, insumos, ventasDiarias, ventasPorProducto, costoInsumosVendidos,
      utilidadOperativa: Number(ventas.importeVentas) - costoInsumosVendidos - Number(nomina.importeNomina)
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo generar el reporte.', detalle: e.message }); }
});

// Alta de usuarios. La contraseña nunca se almacena en texto plano.
app.post('/api/gestion/usuarios', async (req, res) => {
  const { idEmpleado, correo, password, rol } = req.body || {};
  const databaseRole = rol === 'Admin' ? 'Administrador' : rol;
  if (!idEmpleado || !correo || !password || String(password).length < 8 || !['Administrador','Cajero','Barista'].includes(databaseRole))
    return res.status(400).json({ error: 'Indica empleado, correo, contraseña de al menos 8 caracteres y rol válido.' });
  try {
    const hash = await bcrypt.hash(String(password), 12);
    const [result] = await pool.execute(
      'INSERT INTO TblUsuario (IdEmpleado, Usuario, PasswordHash, Rol) VALUES (?, ?, ?, ?)',
      [Number(idEmpleado), String(correo).trim().toLowerCase(), hash, databaseRole]
    );
    res.status(201).json({ mensaje: 'Usuario creado.', id: result.insertId });
  } catch (e) { res.status(400).json({ error: e.code === 'ER_DUP_ENTRY' ? 'El empleado o correo ya tiene usuario.' : e.message }); }
});
app.post('/api/auth/login', async (req, res) => {
  const { usuario, correo, password } = req.body || {};
  const login = String(usuario || correo || '').trim();
  if (!login || !password) return res.status(400).json({ error: 'Escribe tu usuario o correo y contraseña.' });
  try {
    const [rows] = await pool.execute(`SELECT u.IdUsuario, u.Usuario, u.PasswordHash, u.Rol,
      e.IdEmpleado, e.Nombre, e.Correo FROM TblUsuario u
      JOIN TblEmpleado e ON e.IdEmpleado = u.IdEmpleado
      WHERE (u.Usuario = ? OR e.Correo = ?) AND u.Activo = 1 AND e.Activo = 1 LIMIT 1`,
    [login, login.toLowerCase()]);
    if (!rows.length || !(await bcrypt.compare(String(password), rows[0].PasswordHash)))
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.execute(
      'INSERT INTO TblSesion (IdUsuario,TokenHash,ExpiraEn) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))',
      [rows[0].IdUsuario, tokenHash]
    );
    await pool.execute('UPDATE TblUsuario SET UltimoAcceso = NOW() WHERE IdUsuario = ?', [rows[0].IdUsuario]);
    res.json({ token, usuario: {
      id: rows[0].IdUsuario, idEmpleado: rows[0].IdEmpleado, nombre: rows[0].Nombre,
      correo: rows[0].Correo, usuario: rows[0].Usuario,
      rol: rows[0].Rol === 'Administrador' ? 'Admin' : rows[0].Rol
    } });
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE' && /TblSesion/i.test(e.message)) {
      return res.status(503).json({
        error: 'Falta la tabla TblSesion. En MySQL Workbench ejecuta sql_actualizacion_coffee_teria.sql sobre cefeteriap y reinicia el backend.'
      });
    }
    console.error('Error al iniciar sesión:', e.message);
    res.status(500).json({ error: 'No se pudo iniciar sesión por un problema de base de datos.' });
  }
});

// ==========================================
// COFFEE-TERIA: COMPRAS E INVENTARIO
// ==========================================

// Consultar compras con filtro de fecha
app.get('/api/reportes/compras', async (req, res) => {
  try {
    const { fecha } = req.query;

    let sql = `
      SELECT c.IdCompra, c.FechaHora, c.Estado,
             pr.Nombre AS Proveedor,
             e.Nombre AS Empleado,
             SUM(dc.Cantidad * dc.CostoUnitario) AS Total
      FROM TblCompra c
      INNER JOIN TblProveedor pr ON pr.IdProveedor = c.IdProveedor
      INNER JOIN TblEmpleado e ON e.IdEmpleado = c.IdEmpleado
      LEFT JOIN TblDetalleCompra dc ON dc.IdCompra = c.IdCompra
    `;

    const params = [];

    if (fecha) {
      sql += ` WHERE DATE(c.FechaHora) = ?`;
      params.push(fecha);
    }

    sql += `
      GROUP BY c.IdCompra, c.FechaHora, c.Estado,
               pr.Nombre, e.Nombre
      ORDER BY c.FechaHora DESC
    `;

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({
      error: 'Error al consultar las compras.',
      detalle: error.message
    });
  }
});


// Registrar una compra y aumentar el inventario
app.post('/api/gestion/compras', async (req, res) => {
  const {
    IdProveedor,
    IdEmpleado,
    Observaciones,
    detalles
  } = req.body;

  if (!IdProveedor || !IdEmpleado ||
      !Array.isArray(detalles) || !detalles.length) {
    return res.status(400).json({
      error: 'Debes indicar proveedor, empleado e insumos.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [compra] = await conn.execute(
      `INSERT INTO TblCompra
       (FechaHora, Estado, Observaciones, IdProveedor, IdEmpleado)
       VALUES (NOW(), 'Recibida', ?, ?, ?)`,
      [Observaciones || null, IdProveedor, IdEmpleado]
    );

    let total = 0;

    for (const item of detalles) {
      const cantidad = Number(item.Cantidad);
      const costo = Number(item.CostoUnitario);

      if (!item.IdInsumo || cantidad <= 0 || costo < 0) {
        throw new Error('Los datos de los insumos no son válidos.');
      }

      const [insumos] = await conn.execute(
        'SELECT IdInsumo, CantidadDisponible FROM TblInsumo WHERE IdInsumo = ? FOR UPDATE',
        [item.IdInsumo]
      );

      if (!insumos.length) {
        throw new Error(`No existe el insumo ${item.IdInsumo}.`);
      }

      await conn.execute(
        `INSERT INTO TblDetalleCompra
         (IdCompra, IdInsumo, Cantidad, CostoUnitario, Subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [compra.insertId, item.IdInsumo, cantidad, costo, cantidad * costo]
      );

      const before = Number(insumos[0].CantidadDisponible);
      const after = before + cantidad;
      await conn.execute(
        `UPDATE TblInsumo
         SET CantidadDisponible = ?
         WHERE IdInsumo = ?`,
        [after, item.IdInsumo]
      );

      await conn.execute(
        `INSERT INTO TblMovimientoStock
         (IdInsumo, TipoMovimiento, Cantidad, Motivo, IdEmpleado, IdCompra, ExistenciaAnterior, ExistenciaNueva)
         VALUES (?, 'Entrada', ?, ?, ?, ?, ?, ?)`,
        [
          item.IdInsumo,
          cantidad,
          `Compra #${compra.insertId}`,
          IdEmpleado,
          compra.insertId,
          before,
          after
        ]
      );

      total += cantidad * costo;
    }

    await conn.execute(
      'UPDATE TblCompra SET Subtotal = ?, Total = ? WHERE IdCompra = ?',
      [total, total, compra.insertId]
    );
    await conn.commit();

    res.status(201).json({
      mensaje: 'Compra registrada y stock actualizado.',
      IdCompra: compra.insertId,
      Total: total
    });

  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    conn.release();
  }
});


// Registrar una entrada o salida manual de insumos
app.post('/api/gestion/stock', async (req, res) => {
  const {
    IdInsumo,
    IdEmpleado,
    TipoMovimiento,
    Cantidad,
    Motivo
  } = req.body;

  if (!IdInsumo || !IdEmpleado ||
      !['Entrada', 'Salida'].includes(TipoMovimiento) ||
      Number(Cantidad) <= 0) {
    return res.status(400).json({
      error: 'Datos de movimiento incorrectos.'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT CantidadDisponible FROM TblInsumo WHERE IdInsumo = ? FOR UPDATE',
      [IdInsumo]
    );

    if (!rows.length) throw new Error('Insumo no encontrado.');

    const stockActual = Number(rows[0].CantidadDisponible);
    const cantidad = Number(Cantidad);

    if (TipoMovimiento === 'Salida' && cantidad > stockActual) {
      throw new Error('No hay suficiente stock para realizar la salida.');
    }

    const nuevoStock = TipoMovimiento === 'Entrada'
      ? stockActual + cantidad
      : stockActual - cantidad;

    await conn.execute(
      'UPDATE TblInsumo SET CantidadDisponible = ? WHERE IdInsumo = ?',
      [nuevoStock, IdInsumo]
    );

    await conn.execute(
      `INSERT INTO TblMovimientoStock
       (IdInsumo, TipoMovimiento, Cantidad, Motivo, IdEmpleado, ExistenciaAnterior, ExistenciaNueva)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        IdInsumo,
        TipoMovimiento,
        cantidad,
        Motivo || 'Movimiento manual',
        IdEmpleado,
        stockActual,
        nuevoStock
      ]
    );

    await conn.commit();

    res.json({
      mensaje: 'Inventario actualizado.',
      stockAnterior: stockActual,
      stockActual: nuevoStock
    });

  } catch (error) {
    await conn.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    conn.release();
  }
});


// Historial de movimientos de inventario
app.get('/api/reportes/stock', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.IdMovimiento, m.TipoMovimiento,
             m.Cantidad, m.FechaHora, m.Motivo,
             i.Nombre AS Insumo,
             e.Nombre AS Empleado
      FROM TblMovimientoStock m
      LEFT JOIN TblInsumo i ON i.IdInsumo = m.IdInsumo
      LEFT JOIN TblEmpleado e ON e.IdEmpleado = m.IdEmpleado
      ORDER BY m.FechaHora DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// COFFEE-TERIA: RECETAS
// ==========================================

// Consultar recetas con sus ingredientes
app.get('/api/reportes/recetas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.IdProducto, p.Nombre AS Producto,
             dr.IdInsumo, i.Nombre AS Insumo,
             dr.Cantidad, dr.UnidadMedida
      FROM TblReceta r
      INNER JOIN TblProducto p ON p.IdProducto = r.IdProducto
      INNER JOIN TblDetalleReceta dr ON dr.IdReceta = r.IdReceta
      INNER JOIN TblInsumo i ON i.IdInsumo = dr.IdInsumo
      ORDER BY p.Nombre, i.Nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Agregar o actualizar ingrediente de una receta
app.post('/api/gestion/recetas', async (req, res) => {
  const { IdProducto, IdInsumo, CantidadUsada } = req.body;
  const amount = Number(CantidadUsada);

  if (!IdProducto || !IdInsumo || !(amount > 0)) {
    return res.status(400).json({
      error: 'Indica producto, insumo y cantidad utilizada.'
    });
  }

  try {
    const [recipes] = await pool.execute('SELECT IdReceta FROM TblReceta WHERE IdProducto = ?', [IdProducto]);
    let idReceta = recipes[0]?.IdReceta;
    if (!idReceta) {
      const [created] = await pool.execute('INSERT INTO TblReceta (IdProducto) VALUES (?)', [IdProducto]);
      idReceta = created.insertId;
    }
    const [ingredients] = await pool.execute(
      'SELECT UnidadMedida, CostoUnitario FROM TblInsumo WHERE IdInsumo = ?',
      [IdInsumo]
    );
    if (!ingredients.length) return res.status(404).json({ error: 'El insumo no existe.' });
    await pool.execute(`
      INSERT INTO TblDetalleReceta
        (IdReceta, IdInsumo, Cantidad, UnidadMedida, CostoUnitarioReferencia)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        Cantidad = VALUES(Cantidad),
        UnidadMedida = VALUES(UnidadMedida),
        CostoUnitarioReferencia = VALUES(CostoUnitarioReferencia)
    `, [idReceta, IdInsumo, amount, ingredients[0].UnidadMedida, ingredients[0].CostoUnitario]);

    res.status(201).json({
      mensaje: 'Receta guardada correctamente.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ==========================================
// COFFEE-TERIA: NÓMINA
// ==========================================

// Consultar salarios
app.get('/api/gestion/nomina', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT n.IdNomina, e.Nombre, e.Rol,
             n.PeriodoInicio, n.PeriodoFin,
             n.SueldoBase, n.Bonificaciones, n.Deducciones, n.TotalPagado, n.FechaPago,
             n.Estado, n.Observaciones
      FROM TblNomina n
      INNER JOIN TblEmpleado e ON e.IdEmpleado = n.IdEmpleado
      ORDER BY n.IdNomina DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Registrar salario o pago
app.post('/api/gestion/nomina', async (req, res) => {
  const {
    IdEmpleado,
    PeriodoInicio,
    PeriodoFin,
    Salario,
    Estado,
    Observaciones
  } = req.body;

  if (!IdEmpleado || !PeriodoInicio ||
      !PeriodoFin || Number(Salario) <= 0) {
    return res.status(400).json({
      error: 'Completa empleado, periodo y salario.'
    });
  }

  try {
    const [result] = await pool.execute(`
      INSERT INTO TblNomina
      (IdEmpleado, PeriodoInicio, PeriodoFin, SueldoBase, Bonificaciones,
       Deducciones, TotalPagado, FechaPago, Estado, Observaciones)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `, [
      IdEmpleado,
      PeriodoInicio,
      PeriodoFin,
      Number(Salario),
      Number(Salario),
      Estado === 'Pagado' ? new Date() : null,
      Estado === 'Pagado' ? 'Pagado' : 'Pendiente',
      Observaciones || null
    ]);

    res.status(201).json({
      mensaje: 'Registro de nómina guardado.',
      IdNomina: result.insertId
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ==========================================
// COFFEE-TERIA: REPORTES
// ==========================================

// Reporte general de ventas
app.get('/api/reportes/ventas', async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    let sql = `
      SELECT DATE(p.FechaHora) AS Fecha,
             COUNT(DISTINCT p.IdPedido) AS Pedidos,
             SUM(d.Cantidad) AS ProductosVendidos,
             SUM(d.Cantidad * d.PrecioUnitario) AS TotalVentas
      FROM TblPedido p
      INNER JOIN TblPago pg ON pg.IdPedido = p.IdPedido AND pg.Estado = 'Pagado'
      INNER JOIN TblDetallePedido d ON d.IdPedido = p.IdPedido
      WHERE p.Estado <> 'Cancelado'
    `;

    const params = [];

    if (desde) {
      sql += ' AND DATE(p.FechaHora) >= ?';
      params.push(desde);
    }

    if (hasta) {
      sql += ' AND DATE(p.FechaHora) <= ?';
      params.push(hasta);
    }

    sql += ' GROUP BY DATE(p.FechaHora) ORDER BY Fecha DESC';

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Reporte de costos y utilidades estimadas
app.get('/api/reportes/utilidades', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.IdProducto,
             p.Nombre AS Producto,
             SUM(d.Cantidad) AS UnidadesVendidas,
             SUM(d.Cantidad * d.PrecioUnitario) AS Ingresos,
             SUM(d.Cantidad * COALESCE(costos.Costo, 0)) AS Costos,
             SUM(d.Cantidad * (d.PrecioUnitario - COALESCE(costos.Costo, 0))) AS UtilidadBruta
      FROM TblPedido pe
      INNER JOIN TblPago pg ON pg.IdPedido = pe.IdPedido AND pg.Estado = 'Pagado'
      INNER JOIN TblDetallePedido d
        ON pe.IdPedido = d.IdPedido
      INNER JOIN TblProducto p
        ON p.IdProducto = d.IdProducto
      LEFT JOIN (
        SELECT r.IdProducto, SUM(dr.Cantidad * i.CostoUnitario) AS Costo
        FROM TblReceta r
        JOIN TblDetalleReceta dr ON dr.IdReceta = r.IdReceta
        JOIN TblInsumo i ON i.IdInsumo = dr.IdInsumo
        GROUP BY r.IdProducto
      ) costos ON costos.IdProducto = p.IdProducto
      WHERE pe.Estado <> 'Cancelado'
      GROUP BY p.IdProducto, p.Nombre
      ORDER BY p.Nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Resumen general para el panel administrativo
app.get('/api/reportes/resumen', async (_req, res) => {
  try {
    const [[ventas]] = await pool.query(`
      SELECT COUNT(DISTINCT p.IdPedido) AS pedidos,
             COALESCE(SUM(d.Cantidad * d.PrecioUnitario), 0) AS ventas
      FROM TblPedido p
      LEFT JOIN TblDetallePedido d ON d.IdPedido = p.IdPedido
      WHERE p.Estado <> 'Cancelado'
    `);

    const [[inventario]] = await pool.query(`
      SELECT COUNT(*) AS totalInsumos,
             SUM(CASE WHEN CantidadDisponible <= StockMinimo
                 THEN 1 ELSE 0 END) AS stockBajo
      FROM TblInsumo
    `);

    const [[nomina]] = await pool.query(`
      SELECT COALESCE(SUM(TotalPagado), 0) AS salarios
      FROM TblNomina
      WHERE Estado = 'Pagado'
    `);

    res.json({ ...ventas, ...inventario, ...nomina });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// COFFEE-TERIA: AUTENTICACIÓN DE EMPLEADOS
// ==========================================

// Crear usuario con contraseña protegida
app.post('/api/gestion/usuarios', async (req, res) => {
  const { IdEmpleado, Usuario, Contrasena, Rol } = req.body;
  const databaseRole = Rol === 'Admin' ? 'Administrador' : Rol;

  if (!IdEmpleado || !Usuario || !Contrasena ||
      String(Contrasena).length < 8 ||
      !['Administrador', 'Cajero', 'Barista'].includes(databaseRole)) {
    return res.status(400).json({
      error: 'Completa empleado, usuario, contraseña y rol válido.'
    });
  }

  try {
    const hash = await bcrypt.hash(String(Contrasena), 12);

    const [result] = await pool.execute(`
      INSERT INTO TblUsuario
      (IdEmpleado, Usuario, PasswordHash, Rol)
      VALUES (?, ?, ?, ?)
    `, [IdEmpleado, Usuario, hash, databaseRole]);

    res.status(201).json({
      mensaje: 'Usuario creado.',
      IdUsuario: result.insertId
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Iniciar sesión
app.post('/api/gestion/login', async (req, res) => {
  const { Usuario, Contrasena } = req.body;
  if (!Usuario || !Contrasena) return res.status(400).json({ error: 'Escribe usuario y contraseña.' });

  try {
    const [rows] = await pool.execute(`
      SELECT u.IdUsuario, u.Usuario, u.PasswordHash,
             u.Rol, e.Nombre, u.Activo
      FROM TblUsuario u
      INNER JOIN TblEmpleado e ON e.IdEmpleado = u.IdEmpleado
      WHERE (u.Usuario = ? OR e.Correo = ?) AND e.Activo = 1
      LIMIT 1
    `, [String(Usuario).trim(), String(Usuario).trim().toLowerCase()]);

    if (!rows.length || !rows[0].Activo) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.'
      });
    }

    const valid = await bcrypt.compare(String(Contrasena), rows[0].PasswordHash);

    if (!valid) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.'
      });
    }

    res.json({
      mensaje: 'Inicio de sesión correcto.',
      usuario: {
        IdUsuario: rows[0].IdUsuario,
        Usuario: rows[0].Usuario,
        Nombre: rows[0].Nombre,
        Rol: rows[0].Rol === 'Administrador' ? 'Admin' : rows[0].Rol
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const port = Number(process.env.PORT || process.env.API_PORT || 3001);

app.listen(port, '0.0.0.0', () => {
    console.log(`API de COFFEE-TERIA activa en el puerto ${port}`);
});