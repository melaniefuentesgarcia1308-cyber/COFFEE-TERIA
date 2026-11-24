import { useEffect, useState } from "react"
import { Badge, Button, Icon, Input, Modal, Select, Title } from "./ui"

const coffeePhoto =
  "https://images.unsplash.com/photo-1484157239365-80e635261db7?auto=format&fit=crop&w=1200&q=85"
const lattePhoto =
  "https://images.unsplash.com/photo-1533776992670-a72f4c28235e?auto=format&fit=crop&w=600&q=85"
const pastryPhoto =
  "https://images.unsplash.com/photo-1623334044303-241021148842?auto=format&fit=crop&w=600&q=85"
const interiorPhoto =
  "https://images.unsplash.com/photo-1771596378772-858323ca698f?auto=format&fit=crop&w=1200&q=85"
const money = (n: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(n)
type Product = {
  id: number
  name: string
  category: string
  price: number
  description: string
  image: string
  available: boolean
  recipe: {
    ingredient: number
    amount: number
  }[]
  directStock?: number
}
type Item = {
  productId: number
  quantity: number
  option: string
  unitPrice?: number
}
type Order = {
  id: number
  customer: string
  items: Item[]
  status: string
  time: string
  table: string
  paid: boolean
  paymentMethod?: string
}
type Reservation = {
  id: number
  customer: string
  guests: number
  date: string
  time: string
  table: number
  status: string
}
type Ingredient = {
  id: number
  name: string
  stock: number
  minimum: number
  unit: string
  supplier: string
}
type RecipeRow = {
  IdProducto: number
  IdInsumo: number
  Cantidad: number
}
type Movement = {
  id: number
  ingredient: number
  quantity: number
  type: string
  date: string
}
type Purchase = {
  id: number
  supplier: string
  ingredient: number
  quantity: number
  unitPrice: number
  total: number
  date: string
}
type Role = "Admin" | "Cajero" | "Barista"
type Employee = {
  id: number
  name: string
  role: Role
  email: string
  username?: string
  salary: number
  active: boolean
}
type SessionUser = {
  id: number
  idEmpleado: number
  nombre: string
  correo: string
  usuario: string
  rol: Role
}
type SalesReport = {
  ventas: { pedidos: number; importeVentas: number }
  compras: { importeCompras: number }
  nomina: { importeNomina: number }
  costoInsumosVendidos: number
  utilidadOperativa: number
  ventasPorProducto: {
    Producto: string
    Unidades: number
    Importe: number
    CostoInsumos: number
    UtilidadBruta: number
  }[]
  nominaRegistros: {
    IdNomina: number
    Empleado: string
    PeriodoInicio: string
    PeriodoFin: string
    TotalPagado: number
    Estado: string
    FechaPago: string | null
  }[]
}
async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("coffee-teria-token")
  const headers = new Headers(options?.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (options?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await fetch(url, { ...options, headers })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || body.mensaje || "No se pudo completar la solicitud.")
  return body as T
}
const initialProducts: Product[] = [
  {
    id: 1,
    name: "Latte de la casa",
    category: "Café",
    price: 65,
    description:
      "Espresso de origen, leche vaporizada y un delicado toque de vainilla. Un abrazo en cada sorbo.",
    image: lattePhoto,
    available: true,
    recipe: [
      { ingredient: 1, amount: 0.018 },
      { ingredient: 2, amount: 0.2 },
      { ingredient: 4, amount: 0.01 },
    ],
  },
  {
    id: 2,
    name: "Croissant de mantequilla",
    category: "Panes",
    price: 48,
    description:
      "Horneado cada mañana. Capas doradas, delicadas y crujientes con mantequilla de primera calidad.",
    image: pastryPhoto,
    available: true,
    recipe: [],
    directStock: 5,
  },
  {
    id: 3,
    name: "Cappuccino clásico",
    category: "Café",
    price: 58,
    description:
      "El equilibrio perfecto entre nuestro espresso, leche y una espuma aterciopelada.",
    image: coffeePhoto,
    available: true,
    recipe: [
      { ingredient: 1, amount: 0.018 },
      { ingredient: 2, amount: 0.15 },
    ],
  },
  {
    id: 4,
    name: "Cold brew",
    category: "Bebidas frías",
    price: 72,
    description:
      "Café de extracción lenta durante 18 horas, suave y refrescante. Servido con hielo.",
    image:
      "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=85",
    available: true,
    recipe: [{ ingredient: 1, amount: 0.025 }],
  },
  {
    id: 5,
    name: "Té de manzanilla",
    category: "Tés",
    price: 45,
    description:
      "Una infusión floral y reconfortante para regalarte un momento de calma.",
    image:
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=600&q=85",
    available: true,
    recipe: [{ ingredient: 3, amount: 0.004 }],
  },
  {
    id: 6,
    name: "Pastel de chocolate",
    category: "Pasteles",
    price: 85,
    description:
      "Bizcocho de cacao intenso con una generosa cobertura de chocolate. Elaborado en casa.",
    image:
      "https://images.unsplash.com/photo-1517427294546-5aa121f68e8a?auto=format&fit=crop&w=600&q=85",
    available: true,
    recipe: [],
    directStock: 6,
  },
]
const initialOrders: Order[] = [
  {
    id: 1048,
    customer: "Mariana López",
    items: [
      { productId: 1, quantity: 2, option: "Leche entera" },
      { productId: 2, quantity: 1, option: "" },
    ],
    status: "Preparando",
    time: "10:42",
    table: "Mesa 03",
    paid: true,
  },
  {
    id: 1047,
    customer: "Carlos Mendoza",
    items: [
      { productId: 3, quantity: 1, option: "Leche entera" },
      { productId: 2, quantity: 2, option: "" },
    ],
    status: "Pendiente",
    time: "10:38",
    table: "Para llevar",
    paid: false,
  },
  {
    id: 1046,
    customer: "Sofía Ramírez",
    items: [
      { productId: 4, quantity: 1, option: "" },
      { productId: 6, quantity: 1, option: "" },
    ],
    status: "Listo",
    time: "10:35",
    table: "Mesa 01",
    paid: true,
  },
  {
    id: 1045,
    customer: "Daniel García",
    items: [{ productId: 1, quantity: 1, option: "Leche entera" }],
    status: "Entregado",
    time: "10:28",
    table: "Mesa 05",
    paid: true,
  },
  {
    id: 1044,
    customer: "Valeria Torres",
    items: [
      { productId: 5, quantity: 2, option: "" },
      { productId: 6, quantity: 1, option: "" },
    ],
    status: "Entregado",
    time: "10:21",
    table: "Para llevar",
    paid: true,
  },
]
initialOrders.forEach((order) =>
  order.items.forEach((item) => {
    item.unitPrice = initialProducts.find((p) => p.id === item.productId)?.price
  }),
)
const initialIngredients: Ingredient[] = [
  {
    id: 1,
    name: "Café en grano · Chiapas",
    stock: 8.5,
    minimum: 3,
    unit: "kg",
    supplier: "Origen Café",
  },
  {
    id: 2,
    name: "Leche entera",
    stock: 3,
    minimum: 5,
    unit: "L",
    supplier: "Lácteos del Valle",
  },
  {
    id: 3,
    name: "Manzanilla",
    stock: 0.8,
    minimum: 0.2,
    unit: "kg",
    supplier: "Herbolaria Natural",
  },
  {
    id: 4,
    name: "Jarabe de vainilla",
    stock: 0.5,
    minimum: 1,
    unit: "L",
    supplier: "Dulce Origen",
  },
  {
    id: 5,
    name: "Croissant de mantequilla",
    stock: 24,
    minimum: 10,
    unit: "pzas",
    supplier: "Panadería Alba",
  },
  {
    id: 6,
    name: "Pastel de chocolate",
    stock: 12,
    minimum: 4,
    unit: "porciones",
    supplier: "Panadería Alba",
  },
]
const today = new Date().toISOString().slice(0, 10)
const initialReservations: Reservation[] = [
  {
    id: 201,
    customer: "Ana Martínez",
    guests: 2,
    date: today,
    time: "11:00",
    table: 2,
    status: "Confirmada",
  },
  {
    id: 202,
    customer: "Roberto Silva",
    guests: 4,
    date: today,
    time: "12:30",
    table: 4,
    status: "Confirmada",
  },
  {
    id: 203,
    customer: "Lucía Fernández",
    guests: 2,
    date: today,
    time: "13:00",
    table: 6,
    status: "Confirmada",
  },
]
function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`alba-${key}`)
      return saved ? JSON.parse(saved) : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`alba-${key}`, JSON.stringify(value))
    } catch {
      /* Keep the prototype usable when browser storage is unavailable. */
    }
  }, [key, value])
  return [value, setValue] as const
}
const navigation = [
  {
    section: "GENERAL",
    items: [
      ["Dashboard", "grid"],
      ["Pedidos", "bag"],
      ["Preparación · KDS", "coffee"],
      ["Mesas y reservas", "calendar"],
    ],
  },
  {
    section: "ADMINISTRACIÓN",
    items: [
      ["Productos", "book"],
      ["Recetas", "coffee"],
      ["Inventario", "box"],
      ["Proveedores y compras", "truck"],
    ],
  },
  {
    section: "NEGOCIO",
    items: [
      ["Ventas y pagos", "wallet"],
      ["Empleados", "users"],
      ["Reportes", "chart"],
    ],
  },
]
const toneFor = (status: string) =>
  (({
    Pendiente: "pending",
    Preparando: "preparing",
    Listo: "ready",
    Entregado: "neutral",
    Confirmada: "ready",
    Cancelada: "neutral",
  }) as Record<string, string>)[status] || "neutral"
const statusSteps = ["Pendiente", "Preparando", "Listo", "Entregado"]

export default function App() {
  const [page, setPage] = useState("Dashboard")
  const [publicZone, setPublicZone] = useState(true)
  const [publicPage, setPublicPage] = useState("Inicio")
  const [role, setRole] = useState<Role>("Admin")
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => {
    try {
      const saved = sessionStorage.getItem("coffee-teria-user")
      return saved ? JSON.parse(saved) as SessionUser : null
    } catch {
      return null
    }
  })
  const [products, setProducts] = useState<Product[]>([])
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [cart, setCart] = useStored<Item[]>("cart", [])
  const [trackedOrder, setTrackedOrder] = useStored<number | null>(
    "tracked-order",
    null,
  )
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [option, setOption] = useState("Leche entera")
  const [modal, setModal] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Todos")
  const [category, setCategory] = useState("Todos")
  const [toast, setToast] = useState("")
  const [mobileNav, setMobileNav] = useState(false)
  const [customer, setCustomer] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [guests, setGuests] = useState(2)
  const [reserveDate, setReserveDate] = useState(today)
  const [reserveTime, setReserveTime] = useState("11:00")
  const [orderType, setOrderType] = useState("Para llevar")
  const [paymentMethod, setPaymentMethod] = useState("Tarjeta")
  const [stockId, setStockId] = useState(1)
  const [stockQuantity, setStockQuantity] = useState(5)
  const [purchaseCost, setPurchaseCost] = useState(500)
  const [loginName, setLoginName] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [employeePassword, setEmployeePassword] = useState("")
  const [employeeConfirmPassword, setEmployeeConfirmPassword] = useState("")
  const [employeeUsername, setEmployeeUsername] = useState("")
  const [employeeEmail, setEmployeeEmail] = useState("")
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("")
  const [setupUser, setSetupUser] = useState("")
  const [setupEmail, setSetupEmail] = useState("")
  const [setupPhone, setSetupPhone] = useState("")
  const [setupRequired, setSetupRequired] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState(today)
  const [reportStart, setReportStart] = useState(today)
  const [reportEnd, setReportEnd] = useState(today)
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null)
  const [recipeProduct, setRecipeProduct] = useState<number | null>(null)
  const [recipeDraft, setRecipeDraft] = useState<{ ingredient: number; amount: number }[]>([])
  const [newIngredientName, setNewIngredientName] = useState("")
  const [newIngredientSupplier, setNewIngredientSupplier] = useState("")
  const [newSupplierName, setNewSupplierName] = useState("")
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([])
  const [newIngredientUnit, setNewIngredientUnit] = useState("kg")
  const [newIngredientStock, setNewIngredientStock] = useState(0)
  const [newIngredientMinimum, setNewIngredientMinimum] = useState(0)
  const [newIngredientCost, setNewIngredientCost] = useState(0)
  const [payrollEmployeeId, setPayrollEmployeeId] = useState(0)
  const [payrollStart, setPayrollStart] = useState(today)
  const [payrollEnd, setPayrollEnd] = useState(today)
  const [payrollAmount, setPayrollAmount] = useState(0)
  const [newRecipeProductId, setNewRecipeProductId] = useState(0)
  const [reservationResult, setReservationResult] =
    useStored<Reservation | null>("reservation-result", null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeName, setEmployeeName] = useState("")
  const [employeeRole, setEmployeeRole] = useState<Role>("Barista")
  const [employeeSalary, setEmployeeSalary] = useState(0)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const productCategories = Array.from(new Set(
    (products.length ? products : initialProducts)
      .map((product) => product.category.trim())
      .filter(Boolean),
  ))
  const lowStock = ingredients.filter((i) => i.stock < i.minimum)
  const orderTotal = (order: { items: Item[] }) =>
    order.items.reduce(
      (sum, item) =>
        sum +
        (item.unitPrice ??
          products.find((p) => p.id === item.productId)?.price ??
          0) *
          item.quantity,
      0,
    )
  const cartTotal = orderTotal({ items: cart })
  const activeOrders = orders.filter((o) => o.status !== "Entregado")
  const paidTotal = orders
    .filter((o) => o.paid)
    .reduce((sum, o) => sum + orderTotal(o), 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 4500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (currentUser) setRole(currentUser.rol)
  }, [currentUser])
  useEffect(() => {
    if (modal !== "ingredient") return
    let active = true
    requestJson<any[]>("/api/gestion/proveedores")
      .then((rows) => {
        if (active) setSuppliers(rows.map((row) => ({
          id: Number(row.IdProveedor),
          name: String(row.Nombre),
        })))
      })
      .catch((error) => {
        if (active) notify(error instanceof Error ? error.message : "No se pudieron cargar los proveedores.")
      })
    return () => { active = false }
  }, [modal])
  useEffect(() => {
    let active = true
    requestJson<{ configuracionInicialPendiente: boolean }>("/api/auth/setup-status")
      .then((status) => { if (active) setSetupRequired(status.configuracionInicialPendiente) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get("paypal")
    if (paymentStatus !== "success" && paymentStatus !== "cancel") return

    const orderId = Number(params.get("pedido"))
    const savedTicket = sessionStorage.getItem("coffee-teria-pending-order")
    let ticket: Order | null = null
    if (savedTicket) {
      try {
        ticket = JSON.parse(savedTicket) as Order
      } catch {
        sessionStorage.removeItem("coffee-teria-pending-order")
      }
    }
    const callbackTicket = ticket?.id === orderId ? ticket : null
    if (callbackTicket) {
      setOrders((current) => [callbackTicket, ...current.filter((order) => order.id !== orderId)])
    }
    if (orderId) setTrackedOrder(orderId)
    setPublicZone(true)
    setPublicPage("Mi pedido")

    const removePaymentQuery = () => {
      const url = new URL(window.location.href)
      for (const key of ["paypal", "pedido", "token", "PayerID"]) url.searchParams.delete(key)
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
    }

    if (paymentStatus === "cancel") {
      notify(`El pago PayPal fue cancelado. El pedido #${orderId} sigue pendiente.`)
      removePaymentQuery()
      return
    }
    const paypalOrderId = params.get("token")
    if (!orderId || !paypalOrderId) {
      notify("PayPal no devolvió los datos para confirmar el pago.")
      return
    }
    requestJson(`/api/public/pedidos/${orderId}/paypal/capturar`, {
      method: "POST",
      body: JSON.stringify({ paypalOrderId }),
    }).then(() => {
      setOrders((current) => current.map((order) =>
        order.id === orderId ? { ...order, paid: true } : order,
      ))
      if (callbackTicket) {
        sessionStorage.setItem(
          "coffee-teria-pending-order",
          JSON.stringify({ ...callbackTicket, paid: true }),
        )
      }
      notify(`Pago PayPal Sandbox confirmado. Ticket #${String(orderId).padStart(6, "0")}.`)
      removePaymentQuery()
    }).catch((error) => {
      notify(error instanceof Error ? error.message : "No se pudo confirmar el pago PayPal.")
    })
  }, [])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (publicZone) {
      url.searchParams.set("zona", "publica")
      url.searchParams.set("pagina", publicPage)
    } else {
      url.searchParams.delete("zona")
      url.searchParams.delete("pagina")
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }, [publicZone, publicPage])
  // El catálogo es público; una falla de las rutas administrativas nunca debe ocultarlo.
  useEffect(() => {
    let active = true
    requestJson<any[]>("/api/productos")
      .then((dbProducts) => {
        if (!active) return
        setProducts(dbProducts.map((p) => ({
          id: Number(p.IdProducto), name: p.Nombre, category: p.Categoria,
          price: Number(p.PrecioVenta), description: p.Descripcion || "",
          image: p.Imagen || initialProducts.find((initial) => initial.id === Number(p.IdProducto))?.image || coffeePhoto,
          available: Boolean(p.Disponible),
          directStock: p.StockDirecto == null ? undefined : Number(p.StockDirecto),
          recipe: [],
        })))
      })
      .catch((error) => { if (active) setToast(`${error.message}. No se pudo cargar el menú desde MySQL.`) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    setProducts((current) => {
      let changed = false
      const next = current.map((product) => {
        const recipe = recipeRows
          .filter((row) => Number(row.IdProducto) === product.id)
          .map((row) => ({
            ingredient: Number(row.IdInsumo),
            amount: Number(row.Cantidad),
          }))
        const unchanged = product.recipe.length === recipe.length &&
          recipe.every((item, index) =>
            product.recipe[index]?.ingredient === item.ingredient &&
            product.recipe[index]?.amount === item.amount,
          )
        if (unchanged) return product
        changed = true
        return { ...product, recipe }
      })
      return changed ? next : current
    })
  }, [products, recipeRows])
  // Los datos de administración solo se consultan después de iniciar sesión.
  useEffect(() => {
    if (!currentUser) return
    let active = true
    Promise.all([
      requestJson<any[]>("/api/pedidos"),
      requestJson<Reservation[]>("/api/reservas"),
      requestJson<any[]>("/api/gestion/insumos"),
      requestJson<RecipeRow[]>("/api/gestion/recetas"),
      requestJson<any[]>("/api/gestion/movimientos-stock"),
    ]).then(([dbOrders, dbReservations, dbIngredients, dbRecipes, dbMovements]) => {
      if (!active) return
      setOrders(dbOrders)
      setReservations(dbReservations)
      setIngredients(dbIngredients.filter((i) => i.Activo).map((i) => ({
        id: Number(i.IdInsumo), name: i.Nombre, stock: Number(i.CantidadDisponible),
        minimum: Number(i.StockMinimo), unit: i.UnidadMedida, supplier: i.Proveedor || "Sin proveedor",
      })))
      setRecipeRows(dbRecipes)
      setMovements(dbMovements.map((m) => ({
        id: Number(m.IdMovimiento), ingredient: Number(m.IdInsumo),
        quantity: m.TipoMovimiento === "Salida" ? -Number(m.Cantidad) : Number(m.Cantidad),
        type: m.Motivo, date: String(m.FechaHora).slice(0, 10),
      })))
    }).catch((error) => {
      if (active) setToast(`${error.message}. No se pudieron cargar los datos operativos.`)
    })
    if (currentUser.rol === "Admin") {
      Promise.all([
        requestJson<any[]>(`/api/gestion/compras?desde=${today}&hasta=${today}`),
        requestJson<any[]>("/api/gestion/empleados"),
      ]).then(([dbPurchases, dbEmployees]) => {
        if (!active) return
        setPurchases(dbPurchases.map((p) => ({
          id: Number(p.IdCompra), supplier: p.Proveedor || "Sin proveedor",
          ingredient: Number(p.IdInsumo), quantity: Number(p.Cantidad),
          unitPrice: Number(p.CostoUnitario),
          total: Number(p.Importe), date: String(p.FechaHora).slice(0, 10),
        })))
        setEmployees(dbEmployees.map((e) => ({
          id: Number(e.IdEmpleado), name: e.Nombre,
          role: e.RolAcceso === "Administrador" ? "Admin" : e.RolAcceso || "Cajero",
          email: e.Correo || "", username: e.Usuario || "",
          salary: Number(e.SalarioBase), active: Boolean(e.Activo),
        })))
      }).catch((error) => {
        if (active) setToast(`${error.message}. No se pudieron cargar los datos administrativos.`)
      })
    }
    return () => { active = false }
  }, [currentUser])
  useEffect(() => {
    if (page !== "Reportes" && page !== "Ventas y pagos") return
    let active = true
    requestJson<SalesReport>(`/api/gestion/reportes/resumen?desde=${reportStart}&hasta=${reportEnd}`)
      .then((report) => { if (active) setSalesReport(report) })
      .catch((error) => { if (active) notify(error.message) })
    return () => { active = false }
  }, [page, reportStart, reportEnd])
  useEffect(() => {
    if (page !== "Proveedores y compras") return
    let active = true
    loadPurchases(purchaseDate).catch((error) => { if (active) notify(error.message) })
    return () => { active = false }
  }, [page, purchaseDate])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null)
        setSelectedProduct(null)
        setSelectedOrder(null)
        setEditingProduct(null)
        setMobileNav(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
  function navigate(next: string) {
    setPage(next)
    setSearch("")
    setFilter("Todos")
    setMobileNav(false)
  }
  function notify(message: string) {
    setToast(message)
  }
  async function logout() {
    try {
      await requestJson("/api/auth/logout", { method: "POST" })
      sessionStorage.removeItem("coffee-teria-user")
      sessionStorage.removeItem("coffee-teria-token")
      setCurrentUser(null)
      setRole("Admin")
      setPublicZone(true)
      setModal(null)
      notify("Sesión cerrada.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo cerrar la sesión.")
    }
  }
  async function changeOwnPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmNewPassword) {
      notify("Las contraseñas nuevas no coinciden.")
      return
    }
    try {
      await requestJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword: confirmNewPassword }),
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      setModal(null)
      notify("Tu contraseña se actualizó correctamente.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo cambiar la contraseña.")
    }
  }
  async function refreshInventory() {
    const [dbIngredients, dbMovements] = await Promise.all([
      requestJson<any[]>("/api/gestion/insumos"),
      requestJson<any[]>("/api/gestion/movimientos-stock"),
    ])
    setIngredients(dbIngredients.filter((i) => i.Activo).map((i) => ({
      id: Number(i.IdInsumo), name: i.Nombre, stock: Number(i.CantidadDisponible),
      minimum: Number(i.StockMinimo), unit: i.UnidadMedida, supplier: i.Proveedor || "Sin proveedor",
    })))
    setMovements(dbMovements.map((m) => ({
      id: Number(m.IdMovimiento), ingredient: Number(m.IdInsumo),
      quantity: m.TipoMovimiento === "Salida" ? -Number(m.Cantidad) : Number(m.Cantidad),
      type: m.Motivo, date: String(m.FechaHora).slice(0, 10),
    })))
  }
  async function loadPurchases(date: string) {
    const rows = await requestJson<any[]>(`/api/gestion/compras?desde=${date}&hasta=${date}`)
    setPurchases(rows.map((p) => ({
      id: Number(p.IdCompra), supplier: p.Proveedor || "Sin proveedor",
      ingredient: Number(p.IdInsumo), quantity: Number(p.Cantidad),
      unitPrice: Number(p.CostoUnitario),
      total: Number(p.Importe), date: String(p.FechaHora).slice(0, 10),
    })))
  }
  async function copyPublicLink() {
    const url = new URL(window.location.href)
    url.searchParams.set("zona", "publica")
    url.searchParams.set("pagina", "Inicio")
    try {
      await navigator.clipboard.writeText(url.toString())
      notify("Enlace público copiado. Al abrirlo se mostrará el sitio de la cafetería.")
    } catch (error) {
      notify(error instanceof Error ? `No se pudo copiar el enlace: ${error.message}` : "No se pudo copiar el enlace público.")
    }
  }
  function openProduct(product: Product) {
    setSelectedProduct(product)
    setQuantity(1)
    setOption("Leche entera")
  }
  function addToCart() {
    if (!selectedProduct) return
    const chosenOption = ["Café", "Bebidas frías"].includes(
      selectedProduct.category,
    )
      ? option
      : ""
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.productId === selectedProduct.id && i.option === chosenOption,
      )
      return existing
        ? prev.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + quantity } : i,
          )
        : [
            ...prev,
            { productId: selectedProduct.id, quantity, option: chosenOption },
          ]
    })
    setSelectedProduct(null)
    notify(`${selectedProduct.name} agregado a tu pedido`)
  }
  async function updateOrder(id: number, status: string) {
    try {
      await requestJson(`/api/pedidos/${id}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: status }),
      })
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      setSelectedOrder(null)
      notify(`Pedido #${id} · ${status.toLowerCase()} guardado en MySQL`)
    } catch (error) { notify(error instanceof Error ? error.message : "Error al actualizar pedido") }
  }
  async function placeOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!cart.length) return
    const unavailable = cart.find(
      (item) => !products.find((p) => p.id === item.productId)?.available,
    )
    if (unavailable) {
      notify(
        "Uno de los productos ya no está disponible. Retíralo del carrito.",
      )
      return
    }
    if (!phone.trim()) {
      notify("Escribe tu teléfono para registrar el pedido en la base de datos.")
      return
    }
    try {
      const result = await requestJson<{ id: number }>("/api/public/pedidos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: customer, telefono: phone, correo: email || null,
          tipoPedido: orderType, metodoPago: paymentMethod,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: products.find((p) => p.id === item.productId)?.name,
            quantity: item.quantity, option: item.option,
          })),
        }),
      })
      const savedItems = cart.map((item) => ({
        ...item,
        unitPrice: products.find((p) => p.id === item.productId)?.price || 0,
      }))
      const newOrder: Order = {
        id: result.id, customer, items: savedItems, status: "Pendiente",
        time: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
        table: orderType, paid: false, paymentMethod,
      }
      setOrders((prev) => [newOrder, ...prev])
      setTrackedOrder(result.id)
      setCart([])
      setModal(null)
      setPublicPage("Mi pedido")
      sessionStorage.setItem("coffee-teria-pending-order", JSON.stringify(newOrder))
      if (paymentMethod === "Tarjeta") {
        await startPaypalCheckout(newOrder)
      } else {
        notify(`¡Gracias, ${customer}! Pedido #${result.id} guardado. Paga en caja al recogerlo.`)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar el pedido en MySQL")
    }
  }
  async function startPaypalCheckout(order: Order) {
    try {
      sessionStorage.setItem("coffee-teria-pending-order", JSON.stringify(order))
      const { approveUrl } = await requestJson<{ approveUrl: string }>(
        `/api/public/pedidos/${order.id}/paypal/crear`,
        { method: "POST" },
      )
      window.location.assign(approveUrl)
    } catch (error) {
      notify(
        `Pedido #${order.id} guardado; el pago sigue pendiente. ${
          error instanceof Error ? error.message : "No se pudo abrir PayPal Sandbox."
        }`,
      )
    }
  }
  async function makeReservation(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) {
      notify("Escribe tu teléfono para registrar la reservación en MySQL.")
      return
    }
    try {
      const response = await fetch("/api/public/reservas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: customer, telefono: phone, correo: email || null,
          fecha: reserveDate, hora: reserveTime, personas: guests }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la reservación")
      const reservation: Reservation = {
        id: result.id, customer, guests, date: reserveDate, time: reserveTime,
        table: result.mesa, status: "Confirmada",
      }
      setReservations((prev) => [...prev, reservation])
      setReservationResult(reservation)
      setModal(null)
      notify(`Reservación #${result.id} guardada en MySQL. Mesa ${result.mesa}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar la reservación en MySQL")
    }
  }
  async function receiveStock(e: React.FormEvent) {
    e.preventDefault()
    const employeeId = currentUser?.idEmpleado || employees.find((employee) => employee.active)?.id
    if (!employeeId) {
      notify("Registra primero un empleado para auditar movimientos de inventario.")
      return
    }
    const ingredient = ingredients.find((i) => i.id === stockId)
    if (!ingredient) {
      notify("Selecciona un insumo válido.")
      return
    }
    try {
      if (modal === "purchase") {
        await requestJson("/api/gestion/compras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idEmpleado: employeeId,
            proveedor: ingredient.supplier,
            items: [{ idInsumo: stockId, cantidad: stockQuantity, costoUnitario: purchaseCost }],
          }),
        })
        await loadPurchases(purchaseDate)
      } else {
        await requestJson("/api/gestion/movimientos-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idEmpleado: employeeId, idInsumo: stockId,
            tipo: "Entrada", cantidad: stockQuantity, motivo: "Entrada de almacén",
          }),
        })
      }
      await refreshInventory()
      setModal(null)
      notify(modal === "purchase" ? "Compra guardada y existencias actualizadas en MySQL." : "Entrada guardada en MySQL.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo actualizar el inventario.")
    }
  }
  async function createIngredient(e: React.FormEvent) {
    e.preventDefault()
    try {
      await requestJson("/api/gestion/insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: newIngredientName,
          unidadMedida: newIngredientUnit,
          cantidadDisponible: newIngredientStock,
          stockMinimo: newIngredientMinimum,
          costoUnitario: newIngredientCost,
          proveedor: addingSupplier ? newSupplierName.trim() || null : newIngredientSupplier || null,
        }),
      })
      await refreshInventory()
      setModal(null)
      setNewIngredientName("")
      setNewIngredientSupplier("")
      setNewSupplierName("")
      setAddingSupplier(false)
      setNewIngredientStock(0)
      setNewIngredientMinimum(0)
      setNewIngredientCost(0)
      notify("Insumo guardado en MySQL.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo crear el insumo.")
    }
  }
  async function saveRecipe(e: React.FormEvent) {
    e.preventDefault()
    if (!recipeProduct) return
    if (!recipeDraft.length) {
      notify("Agrega al menos un insumo para guardar la receta.")
      return
    }
    try {
      await requestJson(`/api/gestion/recetas/${recipeProduct}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: recipeDraft.map((item) => ({
            idInsumo: item.ingredient,
            cantidad: item.amount,
          })),
        }),
      })
      const recipeRows = await requestJson<RecipeRow[]>("/api/gestion/recetas")
      setRecipeRows(recipeRows)
      setRecipeProduct(null)
      notify("Receta guardada en MySQL.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar la receta.")
    }
  }
  async function saveProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProduct) return
    const productData = {
      nombre: editingProduct.name.trim(),
      categoria: editingProduct.category.trim(),
      descripcion: editingProduct.description.trim(),
      precio: editingProduct.price,
      imagen: editingProduct.image.trim() || coffeePhoto,
      disponible: editingProduct.available,
      stockDirecto: editingProduct.directStock ?? null,
    }
    if (!productData.nombre || !productData.categoria || !(productData.precio > 0)) {
      notify("Completa el nombre, la categoría y un precio mayor que cero.")
      return
    }
    try {
      if (editingProduct.id === 0) {
        const result = await requestJson<{ id: number }>("/api/gestion/productos", {
          method: "POST",
          body: JSON.stringify(productData),
        })
        setProducts((current) => [...current, {
          ...editingProduct,
          id: Number(result.id),
          name: productData.nombre,
          category: productData.categoria,
          description: productData.descripcion,
          price: productData.precio,
          image: productData.imagen,
          available: productData.disponible,
          directStock: productData.stockDirecto ?? undefined,
          recipe: [],
        }])
        notify("Producto agregado al catálogo de MySQL. Ahora puedes crear su receta.")
      } else {
        await requestJson(`/api/productos/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify({
            Nombre: productData.nombre,
            Categoria: productData.categoria,
            Descripcion: productData.descripcion || null,
            PrecioVenta: productData.precio,
            Imagen: productData.imagen,
            Disponible: productData.disponible ? 1 : 0,
            StockDirecto: productData.stockDirecto,
          }),
        })
        setProducts((current) => current.map((product) =>
          product.id === editingProduct.id
            ? {
                ...editingProduct,
                name: productData.nombre,
                category: productData.categoria,
                description: productData.descripcion,
                price: productData.precio,
                image: productData.imagen,
                available: productData.disponible,
                directStock: productData.stockDirecto ?? undefined,
              }
            : product,
        ))
        notify("Producto actualizado en MySQL.")
      }
      setEditingProduct(null)
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar el producto.")
    }
  }
  function startNewRecipe() {
    const availableProducts = products.filter((product) => !product.recipe.length)
    if (!availableProducts.length) {
      notify("Agrega primero un producto desde Productos para poder crear otra receta.")
      setPage("Productos")
      return
    }
    setNewRecipeProductId(availableProducts[0].id)
    setModal("new-recipe")
  }
  function chooseNewRecipeProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newRecipeProductId) {
      notify("Selecciona el producto que llevará esta receta.")
      return
    }
    setRecipeProduct(newRecipeProductId)
    setRecipeDraft([])
    setModal(null)
  }
  async function simulatePayroll(e: React.FormEvent) {
    e.preventDefault()
    try {
      await requestJson("/api/gestion/nomina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idEmpleado: payrollEmployeeId,
          periodoInicio: payrollStart,
          periodoFin: payrollEnd,
          sueldoBase: payrollAmount,
          estado: "Pagado",
          observaciones: "Pago simulado; no se realiza transferencia bancaria.",
        }),
      })
      setModal(null)
      notify("Pago simulado guardado en el historial de nómina.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar el pago.")
    }
  }
  function exportReport() {
    const csvCell = (value: string | number) => {
      const text = String(value)
      return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`
    }
    const rows = [
      ["Periodo", `${reportStart} a ${reportEnd}`, "", "", "", ""],
      ["Resumen", "Unidades", "Ingresos", "Costo", "Utilidad", ""],
      ["Ventas pagadas", salesReport?.ventas.pedidos || 0, salesReport?.ventas.importeVentas || 0, salesReport?.costoInsumosVendidos || 0, salesReport?.utilidadOperativa || 0, ""],
      ["Compras de insumos", "", salesReport?.compras.importeCompras || 0, "", "", ""],
      ["Salarios pagados", "", salesReport?.nomina.importeNomina || 0, "", "", ""],
      ...((salesReport?.ventasPorProducto || []).map((product) => [
        product.Producto, product.Unidades, product.Importe, product.CostoInsumos, product.UtilidadBruta, "",
      ])),
    ]
    const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "casa-alba-ventas.csv"
    link.click()
    URL.revokeObjectURL(url)
    notify("Reporte exportado")
  }
  function renderOrderTable(compact = false) {
    const filtered = orders.filter(
      (o) =>
        (filter === "Todos" || o.status === filter) &&
        `${o.id} ${o.customer} ${o.table}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    return (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Total</th>
              <th aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {(compact ? filtered.slice(0, 5) : filtered).map((o) => (
              <tr
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelectedOrder(o)}
              >
                <td>
                  <strong>#{o.id}</strong>
                  <small>{o.time} h</small>
                </td>
                <td>{o.customer}</td>
                <td>
                  <span className="table-type">
                    <Icon
                      name={o.table === "Para llevar" ? "bag" : "table"}
                      size={14}
                    />
                    {o.table}
                  </span>
                </td>
                <td>
                  <Badge tone={toneFor(o.status)}>{o.status}</Badge>
                </td>
                <td className="money-cell">{money(orderTotal(o))}</td>
                <td>
                  <Icon name="arrow" size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            No encontramos pedidos con estos filtros.
          </div>
        )}
      </div>
    )
  }
  function metrics() {
    const data = [
      {
        icon: "wallet",
        label: "Ventas del día",
        value: money(paidTotal),
        foot: `${orders.filter((o) => o.paid).length} pagos registrados`,
        trend: "Ventas en tiempo real",
      },
      {
        icon: "bag",
        label: "Pedidos",
        value: String(orders.length).padStart(2, "0"),
        foot: `${activeOrders.length} pedidos en curso`,
        trend: "Todo bajo control",
      },
      {
        icon: "calendar",
        label: "Reservaciones",
        value: String(
          reservations.filter(
            (r) => r.status === "Confirmada" && r.date === today,
          ).length,
        ).padStart(2, "0"),
        foot: "Para el día de hoy",
        trend: "Un lugar para todos",
      },
      {
        icon: "table",
        label: "Mesas disponibles",
        value: `${8 - new Set(activeOrders.filter((o) => o.table.startsWith("Mesa")).map((o) => o.table)).size} / 8`,
        foot: "En nuestro espacio",
        trend: "Listas para recibir",
      },
    ]
    return (
      <div className="metrics">
        {data.map((m, i) => (
          <div className="metric-card" key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <span className="metric-icon">
                <Icon name={m.icon} size={18} />
              </span>
            </div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-bottom">
              <span className={i === 0 ? "metric-trend" : ""}>
                {i === 0 && <Icon name="up" size={13} />} {m.foot}
              </span>
              <span className="metric-spark">{i < 2 ? "▁▂▂▃▂▄▅▃▅▆" : ""}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }
  function dashboard() {
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">UN NUEVO DÍA EN COFFEE-TERIA</div>
            <Title level={1}>Todo empieza con un buen café.</Title>
            <p>Así va tu cafetería hoy. Cada detalle, en su lugar.</p>
          </div>
          <Button variant="secondary" onClick={() => setModal("date")}>
            <Icon name="calendar" size={17} />{" "}
            {new Date().toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            <Icon name="down" size={14} />
          </Button>
        </div>
        <div className="welcome-banner">
          <div className="welcome-content">
            <span className="welcome-kicker">
              <span className="live-dot" /> CAFETERÍA ABIERTA
            </span>
            <Title>
              Pequeños momentos.
              <br />
              Grandes experiencias.
            </Title>
            <p>
              Tu equipo está listo para hacer de cada visita
              <br className="desktop-only" /> un momento especial.
            </p>
            <Button variant="secondary" onClick={() => navigate("Pedidos")}>
              Ver pedidos de hoy <Icon name="arrow" size={16} />
            </Button>
          </div>
          <img
            src={coffeePhoto}
            alt="Café recién preparado en una taza de cerámica sobre una mesa cálida"
          />
          <div className="banner-note">
            <Icon name="coffee" size={18} />
            <span>
              Hecho con calma.
              <br />
              <strong>Servido con cariño.</strong>
            </span>
          </div>
        </div>
        {metrics()}
        <div className="dashboard-columns">
          <div className="dashboard-left">
            <section className="panel recent-orders">
              <div className="panel-heading">
                <div>
                  <Title>Pedidos recientes</Title>
                  <p>De nuestra barra a tus manos.</p>
                </div>
                <Button variant="ghost" onClick={() => navigate("Pedidos")}>
                  Ver todos <Icon name="arrow" size={15} />
                </Button>
              </div>
              {renderOrderTable(true)}
              <div className="panel-footer">
                <span>
                  <span className="live-dot" /> Actualizado en tiempo real
                </span>
                <span>{orders.length} pedidos hoy</span>
              </div>
            </section>
            <section className="panel popular">
              <div className="panel-heading">
                <div>
                  <Title>Los favoritos de hoy</Title>
                  <p>Los pequeños placeres que más se repiten.</p>
                </div>
                <Button variant="ghost" onClick={() => navigate("Productos")}>
                  Ver catálogo <Icon name="arrow" size={15} />
                </Button>
              </div>
              <div className="popular-items">
                {products.slice(0, 3).map((p, i) => (
                  <div className="popular-item" key={p.id}>
                    <img src={p.image} alt={p.name} />
                    <div>
                      <span className="popular-rank">
                        0{i + 1} · {p.category}
                      </span>
                      <strong>{p.name}</strong>
                      <small>
                        {orders.reduce(
                          (n, o) =>
                            n +
                            o.items
                              .filter((item) => item.productId === p.id)
                              .reduce((a, item) => a + item.quantity, 0),
                          0,
                        )}{" "}
                        vendidos hoy
                      </small>
                    </div>
                    <span>{money(p.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="dashboard-right">
            <section className="panel reservations-panel">
              <div className="panel-heading">
                <div>
                  <Title>Próximas reservas</Title>
                  <p>Siempre hay un lugar en COFFEE-TERIA.</p>
                </div>
                <span className="soft-icon">
                  <Icon name="calendar" size={18} />
                </span>
              </div>
              <div className="reservation-list">
                {reservations
                  .filter((r) => r.status === "Confirmada" && r.date >= today)
                  .sort((a, b) =>
                    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
                  )
                  .slice(0, 3)
                  .map((r) => (
                    <div className="reservation-item" key={r.id}>
                      <span className="reservation-time">
                        {r.time}
                        <small>
                          {r.date === today ? "HOY" : r.date.slice(5)}
                        </small>
                      </span>
                      <div>
                        <strong>{r.customer}</strong>
                        <small>
                          <Icon name="users" size={13} />
                          {r.guests} personas <span>·</span> Mesa 0{r.table}
                        </small>
                      </div>
                      <span className="small-status" />
                    </div>
                  ))}
              </div>
              <Button
                variant="secondary"
                className="full"
                onClick={() => navigate("Mesas y reservas")}
              >
                Gestionar reservaciones <Icon name="arrow" size={15} />
              </Button>
            </section>
            <section className="stock-alert">
              <div className="stock-alert-heading">
                <span className="soft-icon">
                  <Icon name="box" size={19} />
                </span>
                <div>
                  <strong>Un vistazo al inventario</strong>
                  <p>
                    {lowStock.length
                      ? `${lowStock.length} insumos necesitan atención`
                      : "Todo está en su nivel ideal"}
                  </p>
                </div>
              </div>
              {lowStock.slice(0, 2).map((i) => (
                <div className="stock-alert-row" key={i.id}>
                  <span>{i.name}</span>
                  <strong>
                    {i.stock} {i.unit}
                    <span className="small-status" />
                  </strong>
                </div>
              ))}
              <Button variant="ghost" onClick={() => navigate("Inventario")}>
                Revisar inventario <Icon name="arrow" size={15} />
              </Button>
            </section>
            <div className="daily-note">
              <Icon name="leaf" size={21} />
              <p>
                El secreto está en los detalles.
                <br />Y en una buena taza de café.
              </p>
              <span>LA FILOSOFÍA COFFEE-TERIA</span>
            </div>
          </div>
        </div>
      </>
    )
  }
  function adminContent() {
    if (page === "Dashboard") return dashboard()
    if (page === "Design System")
      return (
        <>
          <PageHeading
            eyebrow="EL LENGUAJE DE COFFEE-TERIA"
            title="Design System"
            description="Una identidad cálida, sencilla y hecha para perdurar."
          />
          <section className="panel design-system">
            <Title>Color & tipografía</Title>
            <div className="swatches">
              {["Crema", "Marfil", "Arena", "Taupe", "Café", "Café oscuro"].map(
                (name, i) => (
                  <div key={name}>
                    <div className={`swatch swatch-${i}`} />
                    <strong>{name}</strong>
                    <small>
                      {
                        [
                          "#F3EBDD",
                          "#FFFCF6",
                          "#E4D5C1",
                          "#B7A38B",
                          "#6B4F3A",
                          "#38291F",
                        ][i]
                      }
                    </small>
                  </div>
                ),
              )}
            </div>
            <div className="type-sample">
              <Title level={1}>El arte de un buen café.</Title>
              <p>Playfair Display en títulos · DM Sans en cuerpo</p>
            </div>
            <Title>Componentes</Title>
            <div className="component-samples">
              <Button onClick={() => notify("Botón principal")}>
                Botón principal <Icon name="arrow" size={16} />
              </Button>
              <Button variant="secondary" onClick={() => setModal("sample")}>
                Abrir modal
              </Button>
              <Button
                variant="ghost"
                onClick={() => notify("Acción secundaria")}
              >
                Acción secundaria
              </Button>
              <Badge tone="ready">Listo</Badge>
              <Badge tone="preparing">Preparando</Badge>
              <Badge tone="pending">Pendiente</Badge>
            </div>
            <Input label="Nombre" placeholder="Un campo simple y cercano" />
            <p className="muted">
              Espaciado consistente · iconos de línea · esquinas suaves ·
              contraste cálido
            </p>
          </section>
        </>
      )
    if (page === "Flujos del Prototipo")
      return (
        <>
          <PageHeading
            eyebrow="EXPERIENCIAS CONECTADAS"
            title="Flujos del prototipo"
            description="De una primera visita a la operación diaria."
          />
          <div className="flow-grid">
            {[
              [
                "Explorar y pedir",
                "Menú → Producto → Carrito → Confirmación → Seguimiento",
                "bag",
              ],
              [
                "Reservar una mesa",
                "Elegir fecha → Personas → Disponibilidad → Confirmación",
                "calendar",
              ],
              [
                "Preparar un pedido",
                "Pendiente → Preparando → Listo → Entregado",
                "coffee",
              ],
              [
                "Gestionar inventario",
                "Alerta → Compra → Entrada → Movimiento de stock",
                "box",
              ],
            ].map(([title, description, icon], i) => (
              <section className="panel flow-card" key={title}>
                <Icon name={icon} size={30} />
                <Title>{title}</Title>
                <p>{description}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (i < 2) {
                      setPublicZone(true)
                      setPublicPage(i === 0 ? "Menú" : "Reservar")
                    } else
                      navigate(i === 2 ? "Preparación · KDS" : "Inventario")
                  }}
                >
                  Explorar flujo <Icon name="arrow" size={16} />
                </Button>
              </section>
            ))}
          </div>
        </>
      )
    if (page === "Pedidos")
      return (
        <>
          <PageHeading
            eyebrow="EN CADA PEDIDO, UN MOMENTO"
            title="Gestión de pedidos"
            description="Sigue cada pedido, desde la barra hasta la mesa."
            action={
              <Button
                onClick={() => {
                  setPublicZone(true)
                  setPublicPage("Menú")
                }}
              >
                <Icon name="plus" size={17} /> Nuevo pedido
              </Button>
            }
          />
          <div className="order-stats">
            {statusSteps.map((s) => (
              <div key={s}>
                <Badge tone={toneFor(s)}>{s}</Badge>
                <strong>{orders.filter((o) => o.status === s).length}</strong>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="table-toolbar">
              <div className="tabs">
                {["Todos", ...statusSteps].map((s) => (
                  <Button
                    variant="ghost"
                    className={filter === s ? "active" : ""}
                    onClick={() => setFilter(s)}
                    key={s}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <div className="search-field">
                <Icon name="search" size={16} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pedido o cliente"
                />
              </div>
            </div>
            {renderOrderTable()}
          </section>
        </>
      )
    if (page === "Preparación · KDS")
      return (
        <>
          <PageHeading
            eyebrow="EL CORAZÓN DE NUESTRA BARRA"
            title="Pantalla de preparación"
            description="Un equipo, un ritmo. Cada taza en su punto."
            action={
              <Badge tone="ready">{activeOrders.length} pedidos activos</Badge>
            }
          />
          <div className="kds-board">
            {statusSteps.slice(0, 3).map((status) => (
              <div className="kds-column" key={status}>
                <div className="kds-column-heading">
                  <Badge tone={toneFor(status)}>{status}</Badge>
                  <span>
                    {orders.filter((o) => o.status === status).length}
                  </span>
                </div>
                {orders
                  .filter((o) => o.status === status)
                  .map((o) => (
                    <section className="panel kds-card" key={o.id}>
                      <div className="kds-card-head">
                        <Title>#{o.id}</Title>
                        <span>
                          <Icon name="clock" size={14} />
                          {o.time}
                        </span>
                      </div>
                      <strong>{o.table}</strong>
                      <p>{o.customer}</p>
                      <div className="kds-items">
                        {o.items.map((item, i) => (
                          <div key={i}>
                            <span>{item.quantity}×</span>
                            <div>
                              <strong>
                                {
                                  products.find((p) => p.id === item.productId)
                                    ?.name
                                }
                              </strong>
                              <small>
                                {item.option || "Preparación de la casa"}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        className="full"
                        onClick={() =>
                          updateOrder(
                            o.id,
                            statusSteps[statusSteps.indexOf(status) + 1],
                          )
                        }
                      >
                        {status === "Pendiente"
                          ? "Comenzar preparación"
                          : status === "Preparando"
                            ? "Marcar como listo"
                            : "Entregar pedido"}
                        <Icon name="check" size={16} />
                      </Button>
                    </section>
                  ))}
                {!orders.some((o) => o.status === status) && (
                  <div className="empty-state">
                    <Icon name="coffee" size={25} />
                    <p>Todo en calma por aquí.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )
    if (page === "Mesas y reservas")
      return (
        <>
          <PageHeading
            eyebrow="UN LUGAR PARA COMPARTIR"
            title="Mesas y reservaciones"
            description="Prepara una bienvenida para cada visita."
            action={
              <Button
                onClick={() => {
                  setCustomer("")
                  setModal("reserve")
                }}
              >
                <Icon name="plus" size={17} /> Nueva reserva
              </Button>
            }
          />
          <div className="table-legend">
            <Badge tone="ready">Disponible</Badge>
            <Badge tone="preparing">Ocupada</Badge>
            <Badge tone="pending">Reservada</Badge>
          </div>
          <div className="tables-grid">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => {
              const occupied = activeOrders.some(
                (o) => o.table === `Mesa 0${n}`,
              )
              const reserved = reservations.some(
                (r) =>
                  r.table === n &&
                  r.date === today &&
                  r.status === "Confirmada",
              )
              return (
                <section
                  className={`panel table-card ${occupied ? "occupied" : ""}`}
                  key={n}
                >
                  <div className="table-drawing">
                    <span />
                    <Icon name="table" size={38} />
                    <span />
                  </div>
                  <Title>Mesa 0{n}</Title>
                  <p>{[4, 7, 8].includes(n) ? 4 : 2} personas</p>
                  <Badge
                    tone={
                      occupied ? "preparing" : reserved ? "pending" : "ready"
                    }
                  >
                    {occupied
                      ? "Ocupada"
                      : reserved
                        ? "Reservada"
                        : "Disponible"}
                  </Badge>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (occupied) {
                        setSelectedOrder(
                          activeOrders.find((o) => o.table === `Mesa 0${n}`)!,
                        )
                      } else {
                        setCustomer("")
                        setGuests([4, 7, 8].includes(n) ? 4 : 2)
                        setModal("reserve")
                      }
                    }}
                  >
                    {occupied ? "Ver pedido" : "Reservar"}{" "}
                    <Icon name="arrow" size={14} />
                  </Button>
                </section>
              )
            })}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <Title>Agenda de reservas</Title>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Personas</th>
                    <th>Mesa</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.customer}</strong>
                        <small>Reserva #{r.id}</small>
                      </td>
                      <td>{r.date}</td>
                      <td>{r.time}</td>
                      <td>{r.guests}</td>
                      <td>0{r.table}</td>
                      <td>
                        <Badge tone={toneFor(r.status)}>{r.status}</Badge>
                      </td>
                      <td>
                        {r.status === "Confirmada" && (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await requestJson(`/api/reservas/${r.id}`, {
                                  method: "DELETE",
                                })
                                setReservations((prev) => prev.filter((x) => x.id !== r.id))
                                notify("Reservación eliminada de MySQL")
                              } catch (error) { notify(error instanceof Error ? error.message : "No se pudo cancelar") }
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )
    if (page === "Productos")
      return (
        <>
          <PageHeading
            eyebrow="HECHO CON CARIÑO"
            title="Nuestro catálogo"
            description="Los sabores que hacen de COFFEE-TERIA un lugar especial."
            action={role === "Admin" && (
              <Button onClick={() => setEditingProduct({
                id: 0,
                name: "",
                category: productCategories[0] || "",
                price: 0,
                description: "",
                image: coffeePhoto,
                available: true,
                recipe: [],
              })}>
                <Icon name="plus" size={16} /> Agregar producto
              </Button>
            )}
          />
          <div className="table-toolbar standalone">
            <CategoryTabs
              category={category}
              onChange={setCategory}
              categories={products.map((product) => product.category)}
            />
            <div className="search-field">
              <Icon name="search" size={16} />
              <Input
                placeholder="Buscar producto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="product-grid">
            {products
              .filter(
                (p) =>
                  (category === "Todos" || p.category === category) &&
                  p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <section className="panel product-card" key={p.id}>
                  <div className="product-image">
                    <img src={p.image} alt={p.name} />
                    <Badge tone={p.available ? "ready" : "neutral"}>
                      {p.available ? "Disponible" : "No disponible"}
                    </Badge>
                  </div>
                  <div className="product-body">
                    <span className="eyebrow">{p.category}</span>
                    <Title>{p.name}</Title>
                    <p>{p.description}</p>
                    <div className="product-bottom">
                      <strong>{money(p.price)}</strong>
                      <Button
                        variant="secondary"
                        onClick={() => setEditingProduct({ ...p })}
                      >
                        Editar <Icon name="arrow" size={14} />
                      </Button>
                    </div>
                  </div>
                </section>
              ))}
          </div>
        </>
      )
    if (page === "Recetas")
      return (
        <>
          <PageHeading
            eyebrow="NUESTRO SABER HACER"
            title="Recetas de la casa"
            description="Consulta y administra las recetas de tus productos."
            action={role === "Admin" && (
              <Button onClick={startNewRecipe}>
                <Icon name="plus" size={16} /> Agregar receta
              </Button>
            )}
          />
          <div className="recipe-grid">
            {products.map((p) => (
                <section className="panel recipe-card" key={p.id}>
                  <div className="recipe-heading">
                    <img src={p.image} alt={p.name} />
                    <div>
                      <span className="eyebrow">{p.category} · 1 PORCIÓN</span>
                      <Title>{p.name}</Title>
                    </div>
                  </div>
                  <div className="recipe-ingredients">
                    {p.recipe.map((r) => {
                      const ingredient = ingredients.find(
                        (i) => i.id === r.ingredient,
                      )
                      if (!ingredient) return null
                      return (
                        <div key={r.ingredient}>
                          <span>{ingredient.name}</span>
                          <strong>
                            {r.amount < 1 ? r.amount * 1000 : r.amount}{" "}
                            {ingredient.unit === "kg"
                              ? "g"
                              : ingredient.unit === "L"
                                ? "ml"
                                : ingredient.unit}
                          </strong>
                        </div>
                      )
                    })}
                    {!p.recipe.length && (
                      <p className="muted">Aún no hay una receta registrada para este producto.</p>
                    )}
                  </div>
                  <p className="recipe-note">
                    <Icon name="coffee" size={16} /> Preparar al momento y
                    servir con cariño.
                  </p>
                  {role === "Admin" && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRecipeProduct(p.id)
                        setRecipeDraft(p.recipe.map((item) => ({ ...item })))
                      }}
                    >
                      {p.recipe.length ? "Editar receta" : "Crear receta"}{" "}
                      <Icon name="arrow" size={15} />
                    </Button>
                  )}
                </section>
            ))}
          </div>
          <div className="info-note">
            <Icon name="box" />
            Cada producto puede tener una receta con sus insumos y cantidades.
          </div>
        </>
      )
    if (page === "Inventario")
      return (
        <>
          <PageHeading
            eyebrow="CADA INGREDIENTE CUENTA"
            title="Inventario de insumos"
            description="Todo lo que necesitamos para crear buenos momentos."
            action={
              role === "Admin" && (
              <div className="page-actions">
                <Button variant="secondary" onClick={() => setModal("ingredient")}>
                  <Icon name="plus" size={17} /> Agregar insumo
                </Button>
                <Button onClick={() => setModal("stock")}>
                  <Icon name="plus" size={17} /> Registrar entrada
                </Button>
              </div>
              )
            }
          />
          {lowStock.length > 0 && (
            <div className="inventory-warning">
              <Icon name="alert" />
              <span>
                <strong>{lowStock.length} insumos con stock bajo.</strong> Es
                momento de preparar una nueva compra.
              </span>
              {role === "Admin" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigate("Proveedores y compras")
                    setModal("purchase")
                  }}
                >
                  Crear compra <Icon name="arrow" size={15} />
                </Button>
              )}
            </div>
          )}
          <section className="panel">
            <div className="table-toolbar">
              <div className="tabs">
                {["Todos", "Stock bajo"].map((s) => (
                  <Button
                    variant="ghost"
                    className={filter === s ? "active" : ""}
                    key={s}
                    onClick={() => setFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
              <div className="search-field">
                <Icon name="search" size={16} />
                <Input
                  placeholder="Buscar insumo"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Stock actual</th>
                    <th>Mínimo</th>
                    <th>Proveedor</th>
                    <th>Estado</th>
                    {role === "Admin" && <th />}
                  </tr>
                </thead>
                <tbody>
                  {ingredients
                    .filter(
                      (i) =>
                        (filter !== "Stock bajo" || i.stock < i.minimum) &&
                        i.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.name}</strong>
                          <small>INS-{String(i.id).padStart(3, "0")}</small>
                        </td>
                        <td>
                          <strong>
                            {Number(i.stock.toFixed(3))} {i.unit}
                          </strong>
                        </td>
                        <td>
                          {i.minimum} {i.unit}
                        </td>
                        <td>{i.supplier}</td>
                        <td>
                          <Badge
                            tone={i.stock < i.minimum ? "pending" : "ready"}
                          >
                            {i.stock < i.minimum ? "Stock bajo" : "Suficiente"}
                          </Badge>
                        </td>
                        {role === "Admin" && (
                          <td>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setStockId(i.id)
                                setModal("stock")
                              }}
                            >
                              <Icon name="plus" size={16} /> Entrada
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel movement-panel">
            <div className="panel-heading">
              <div>
                <Title>Movimientos de stock</Title>
                <p>Entradas y consumo por pedidos.</p>
              </div>
            </div>
            {movements.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Insumo</th>
                      <th>Movimiento</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, 15).map((m) => (
                      <tr key={m.id}>
                        <td>{m.date}</td>
                        <td>
                          {ingredients.find((i) => i.id === m.ingredient)?.name}
                        </td>
                        <td>{m.type}</td>
                        <td className={m.quantity > 0 ? "positive" : ""}>
                          {m.quantity > 0 ? "+" : ""}
                          {Number(m.quantity.toFixed(3))}{" "}
                          {ingredients.find((i) => i.id === m.ingredient)?.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                Las entradas y los nuevos pedidos aparecerán aquí.
              </div>
            )}
          </section>
        </>
      )
    if (page === "Proveedores y compras")
      return (
        <>
          <PageHeading
            eyebrow="BUENOS INGREDIENTES, BUENAS RELACIONES"
            title="Proveedores y compras"
            description="Personas y productos que comparten nuestra filosofía."
            action={
              <Button onClick={() => setModal("purchase")}>
                <Icon name="plus" size={17} /> Registrar compra
              </Button>
            }
          />
          <div className="supplier-grid">
            {[...new Set(ingredients.map((i) => i.supplier))].map(
              (supplier, index) => (
                <section className="panel supplier-card" key={supplier}>
                  <div className="supplier-monogram">
                    {supplier
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <Title>{supplier}</Title>
                  <p>
                    {ingredients
                      .filter((i) => i.supplier === supplier)
                      .map((i) => i.name)
                      .join(" · ")}
                  </p>
                  <Badge tone="ready">Proveedor activo</Badge>
                  <small>proveedor{index + 1}@ejemplo.mx</small>
                </section>
              ),
            )}
          </div>
          <section className="panel movement-panel">
            <div className="panel-heading purchase-history-heading">
              <div>
                <Title>Historial de compras de insumos</Title>
                <p>Selecciona un día para revisar compras y sus costos.</p>
              </div>
              <Input
                label="Filtrar por día"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            {purchases.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio unitario</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={`${p.id}-${p.ingredient}`}>
                        <td>{p.date}</td>
                        <td>{p.supplier}</td>
                        <td>
                          {ingredients.find((i) => i.id === p.ingredient)?.name}
                        </td>
                        <td>
                          {p.quantity}{" "}
                          {ingredients.find((i) => i.id === p.ingredient)?.unit}
                        </td>
                        <td>{money(p.unitPrice)}</td>
                        <td>{money(p.total)}</td>
                        <td>
                          <Badge tone="ready">Recibida</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Icon name="truck" size={28} />
                <p>Tus próximas compras empiezan aquí.</p>
                <Button
                  variant="secondary"
                  onClick={() => setModal("purchase")}
                >
                  Registrar primera compra
                </Button>
              </div>
            )}
          </section>
        </>
      )
    if (page === "Ventas y pagos" || page === "Reportes")
      return (
        <>
          <PageHeading
            eyebrow="EL PULSO DE TU NEGOCIO"
            title={
              page === "Reportes" ? "Reportes y resultados" : "Ventas y pagos"
            }
            description="Información clara para tomar mejores decisiones."
            action={
              <Button variant="secondary" onClick={exportReport}>
                <Icon name="chart" size={17} /> Exportar reporte
              </Button>
            }
          />
          <div className="table-toolbar report-date-filters">
            <Input
              label="Desde"
              type="date"
              value={reportStart}
              onChange={(e) => setReportStart(e.target.value)}
            />
            <Input
              label="Hasta"
              type="date"
              value={reportEnd}
              onChange={(e) => setReportEnd(e.target.value)}
            />
          </div>
          {metrics()}
          <div className="report-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <Title>Ventas por producto</Title>
                  <p>Ventas pagadas del periodo seleccionado.</p>
                </div>
              </div>
              <div className="sales-bars">
                {(salesReport?.ventasPorProducto || []).map((product) => {
                  const amount = Number(product.Importe)
                  const max = Math.max(
                    ...(salesReport?.ventasPorProducto || []).map((item) => Number(item.Importe)),
                    1,
                  )
                  return (
                    <div key={product.Producto}>
                      <div>
                        <span>{product.Producto}</span>
                        <strong>{money(amount)}</strong>
                      </div>
                      <progress max={max} value={amount} />
                    </div>
                  )
                })}
                {!salesReport?.ventasPorProducto.length && (
                  <div className="empty-state">No hay ventas pagadas en este periodo.</div>
                )}
              </div>
            </section>
            <section className="panel report-summary">
              <Icon name="wallet" size={30} />
              <Title>Resumen del periodo</Title>
              <p>Ventas pagadas</p>
              <div className="metric-value">
                {money(Number(salesReport?.ventas.importeVentas || 0))}
              </div>
              <div className="summary-row">
                <span>Compras de insumos</span>
                <strong>{money(Number(salesReport?.compras.importeCompras || 0))}</strong>
              </div>
              <div className="summary-row">
                <span>Insumos consumidos en ventas</span>
                <strong>{money(Number(salesReport?.costoInsumosVendidos || 0))}</strong>
              </div>
              <div className="summary-row">
                <span>Salarios pagados</span>
                <strong>{money(Number(salesReport?.nomina.importeNomina || 0))}</strong>
              </div>
              <div className="summary-row">
                <span>Utilidad operativa estimada</span>
                <strong>{money(Number(salesReport?.utilidadOperativa || 0))}</strong>
              </div>
            </section>
          </div>
          <section className="panel movement-panel">
            <div className="panel-heading">
              <Title>Registro de pagos</Title>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Importe</th>
                    <th>Pago</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>#{o.id}</td>
                      <td>{o.customer}</td>
                      <td>{money(orderTotal(o))}</td>
                      <td>
                        <Badge tone={o.paid ? "ready" : "pending"}>
                          {o.paid ? "Pagado" : "Pendiente"}
                        </Badge>
                      </td>
                      <td>
                        {!o.paid && (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await requestJson(`/api/pedidos/${o.id}/pago`, { method: "PUT" })
                                setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, paid: true } : x))
                                notify("Pago registrado en MySQL")
                              } catch (error) { notify(error instanceof Error ? error.message : "No se pudo registrar el pago") }
                            }}
                          >
                            Registrar pago
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel movement-panel">
            <div className="panel-heading">
              <Title>Historial de pagos de nómina</Title>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Empleado</th><th>Periodo</th><th>Fecha de pago</th><th>Importe</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {(salesReport?.nominaRegistros || []).map((row) => (
                    <tr key={row.IdNomina}>
                      <td>{row.Empleado}</td>
                      <td>{String(row.PeriodoInicio).slice(0, 10)} — {String(row.PeriodoFin).slice(0, 10)}</td>
                      <td>{row.FechaPago ? String(row.FechaPago).slice(0, 10) : "Pendiente"}</td>
                      <td>{money(Number(row.TotalPagado))}</td>
                      <td><Badge tone={row.Estado === "Pagado" ? "ready" : "pending"}>{row.Estado}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!salesReport?.nominaRegistros.length && <div className="empty-state">No hay pagos de nómina en este periodo.</div>}
            </div>
          </section>
        </>
      )
    if (page === "Empleados")
      return (
        <>
          <PageHeading
            eyebrow="LAS PERSONAS DETRÁS DE CADA TAZA"
            title="Nuestro equipo"
            description="Un equipo cercano, con responsabilidades claras."
            action={
              <div className="page-actions">
                <Button variant="secondary" onClick={() => {
                  const first = employees.find((employee) => employee.active)
                  setPayrollEmployeeId(first?.id || 0)
                  setPayrollAmount(first?.salary || 0)
                  setModal("payroll")
                }}>
                  Simular pago
                </Button>
                <Button onClick={() => setModal("employee")}>
                  <Icon name="plus" size={17} /> Añadir empleado
                </Button>
              </div>
            }
          />
          <div className="employee-grid">
            {employees.map((e) => (
              <section className="panel employee-card" key={e.id}>
                <div className="employee-avatar">
                  {e.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <Title>{e.name}</Title>
                <span>{e.role}</span>
                <p>{e.email}</p>
                <Badge tone={e.active ? "ready" : "neutral"}>
                  {e.active ? "Activo" : "Inactivo"}
                </Badge>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await requestJson(`/api/gestion/empleados/${e.id}/estado`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ activo: !e.active }),
                      })
                      setEmployees((prev) => prev.map((x) =>
                        x.id === e.id ? { ...x, active: !x.active } : x,
                      ))
                      notify(`Empleado ${e.active ? "desactivado" : "activado"} en MySQL.`)
                    } catch (error) {
                      notify(error instanceof Error ? error.message : "No se pudo actualizar al empleado.")
                    }
                  }}
                >
                  {e.active ? "Desactivar cuenta" : "Reactivar cuenta"}
                </Button>
              </section>
            ))}
          </div>
          <div className="info-note">
            <Icon name="users" />
            Admin: todas las áreas · Cajero: pedidos, reservas y pagos ·
            Barista: preparación y recetas. Cada persona cambia su contraseña
            desde su propio perfil.
          </div>
        </>
      )
    return null
  }
  function reserveForm() {
    return (
      <form onSubmit={makeReservation} className="form-stack">
        <p className="muted">
          Un café sabe mejor cuando tienes tiempo para disfrutarlo. Reserva tu
          lugar.
        </p>
        <Input
          label="Tu nombre"
          placeholder="Nombre y apellido"
          required
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
        <Input
          label="Teléfono"
          type="tel"
          placeholder="10 dígitos"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="hola@ejemplo.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="form-row">
          <Input
            label="Fecha"
            type="date"
            min={today}
            required
            value={reserveDate}
            onChange={(e) => setReserveDate(e.target.value)}
          />
          <Select
            label="Hora"
            value={reserveTime}
            onChange={(e) => setReserveTime(e.target.value)}
          >
            {[
              "08:00",
              "09:00",
              "10:00",
              "11:00",
              "12:00",
              "12:30",
              "13:00",
              "14:00",
              "15:00",
              "16:00",
              "17:00",
              "18:00",
              "19:00",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
        <Select
          label="Número de personas"
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
        >
          {[1, 2, 3, 4].map((n) => (
            <option value={n} key={n}>
              {n} {n === 1 ? "persona" : "personas"}
            </option>
          ))}
        </Select>
        <div className="info-note small">
          <Icon name="clock" size={17} /> Tu mesa se reserva durante 90 minutos.
        </div>
        <Button type="submit" className="full">
          Confirmar reservación <Icon name="arrow" size={17} />
        </Button>
        <small className="muted">
          Demostración local. No se envían correos.
        </small>
      </form>
    )
  }
  function publicContent() {
    if (publicPage === "Inicio")
      return (
        <>
          <div className="public-hero">
            <div>
              <span className="eyebrow">
                CAFÉ DE ESPECIALIDAD · MOMENTOS SENCILLOS
              </span>
              <Title level={1}>
                Tu pausa favorita.
                <br />
                <em>Tu casa, COFFEE-TERIA.</em>
              </Title>
              <p>
                Buen café, pan recién horneado y un lugar para quedarte.
                <br />
                Las cosas bonitas no necesitan prisa.
              </p>
              <div className="hero-actions">
                <Button onClick={() => setPublicPage("Menú")}>
                  Descubre nuestro menú <Icon name="arrow" size={17} />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPublicPage("Reservar")}
                >
                  Reserva una mesa
                </Button>
              </div>
              <div className="hero-footnote">
                <Icon name="leaf" size={18} /> Café de origen mexicano. Hecho
                con cariño.
              </div>
            </div>
            <div className="public-hero-image">
              <img
                src={coffeePhoto}
                alt="Una taza de café para disfrutar sin prisa"
              />
              <span>
                El arte de disfrutar
                <br />
                lo cotidiano.
              </span>
            </div>
          </div>
          <div className="public-values">
            <span>
              <Icon name="coffee" /> Café de especialidad
            </span>
            <span>
              <Icon name="sun" /> Horneado cada mañana
            </span>
            <span>
              <Icon name="heart" /> Siempre te sentirás en casa
            </span>
          </div>
          <section className="public-section">
            <div className="page-heading">
              <div>
                <span className="eyebrow">PEQUEÑOS PLACERES</span>
                <Title level={1}>Los favoritos de la casa.</Title>
              </div>
              <Button variant="ghost" onClick={() => setPublicPage("Menú")}>
                Ver todo el menú <Icon name="arrow" size={17} />
              </Button>
            </div>
            {publicProducts(products.slice(0, 3))}
          </section>
          <section className="promotion">
            <img src={pastryPhoto} alt="Croissants recién horneados" />
            <div>
              <span className="eyebrow">LAS MAÑANAS SABEN MEJOR AQUÍ</span>
              <Title level={1}>
                Un café. Un croissant.
                <br />
                Un buen comienzo.
              </Title>
              <p>
                Encuentra tus favoritos de la mañana: latte de la casa y
                croissant de mantequilla por {money(113)}.
              </p>
              <Button
                onClick={() => {
                  setCart((prev) => [
                    ...prev,
                    { productId: 1, quantity: 1, option: "Leche entera" },
                    { productId: 2, quantity: 1, option: "" },
                  ])
                  notify("Tu desayuno está en el carrito")
                  setPublicPage("Carrito")
                }}
              >
                Pedir mi desayuno <Icon name="arrow" size={17} />
              </Button>
            </div>
          </section>
        </>
      )
    if (publicPage === "Menú")
      return (
        <section className="public-section">
          <PageHeading
            eyebrow="EL SABOR DE LAS COSAS BIEN HECHAS"
            title="Nuestro menú"
            description="Café de origen, horno encendido y algo para cada antojo."
          />
          <div className="table-toolbar standalone">
            <CategoryTabs
              category={category}
              onChange={setCategory}
              categories={products.map((product) => product.category)}
            />
            <div className="search-field">
              <Icon name="search" size={16} />
              <Input
                placeholder="¿Qué se te antoja?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {publicProducts(
            products.filter(
              (p) =>
                (category === "Todos" || p.category === category) &&
                p.name.toLowerCase().includes(search.toLowerCase()),
            ),
          )}
        </section>
      )
    if (publicPage === "Carrito")
      return (
        <section className="public-section">
          <PageHeading
            eyebrow="A UN PASO DE TU MOMENTO COFFEE-TERIA"
            title="Tu pedido"
            description="Todo lo que se te antoja, en un solo lugar."
          />
          {cart.length ? (
            <div className="cart-layout">
              <section className="panel cart-items">
                {cart.map((item, index) => {
                  const product = products.find((p) => p.id === item.productId)!
                  return (
                    <div className="cart-item" key={index}>
                      <img src={product.image} alt={product.name} />
                      <div>
                        <Title level={3}>{product.name}</Title>
                        <p>{item.option || product.category}</p>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setCart((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          Eliminar
                        </Button>
                      </div>
                      <div className="quantity-control">
                        <Button
                          variant="icon"
                          aria-label="Reducir cantidad"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x, i) =>
                                i === index
                                  ? {
                                      ...x,
                                      quantity: Math.max(1, x.quantity - 1),
                                    }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Icon name="minus" size={14} />
                        </Button>
                        <span>{item.quantity}</span>
                        <Button
                          variant="icon"
                          aria-label="Aumentar cantidad"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x, i) =>
                                i === index
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Icon name="plus" size={14} />
                        </Button>
                      </div>
                      <strong>{money(product.price * item.quantity)}</strong>
                    </div>
                  )
                })}
                <Button variant="ghost" onClick={() => setPublicPage("Menú")}>
                  Seguir explorando el menú <Icon name="arrow" size={16} />
                </Button>
              </section>
              <section className="panel cart-summary">
                <Title>Tu momento está cerca.</Title>
                <div className="summary-row">
                  <span>Subtotal</span>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <div className="summary-row">
                  <span>Entrega en cafetería</span>
                  <span>Sin costo</span>
                </div>
                <div className="summary-row total">
                  <strong>Total</strong>
                  <strong>{money(cartTotal)}</strong>
                </div>
                <Button className="full" onClick={() => setModal("checkout")}>
                  Confirmar pedido <Icon name="arrow" size={16} />
                </Button>
                <small className="muted">Precios en MXN · IVA incluido</small>
              </section>
            </div>
          ) : (
            <div className="empty-state panel">
              <Icon name="bag" size={40} />
              <Title>Tu próxima pausa empieza aquí.</Title>
              <p>Todavía no hay productos en tu pedido.</p>
              <Button onClick={() => setPublicPage("Menú")}>
                Explorar el menú
              </Button>
            </div>
          )}
        </section>
      )
    if (publicPage === "Reservar")
      return (
        <section className="public-section reservation-public">
          <div>
            <span className="eyebrow">TE GUARDAMOS UN LUGAR</span>
            <Title level={1}>
              Las mejores conversaciones
              <br />
              <em>empiezan con un café.</em>
            </Title>
            <p>
              Una mesa para ti, para dos o para reencontrarse.
              <br />
              Nos encargamos del café. Tú, del momento.
            </p>
            <img
              src={interiorPhoto}
              alt="Mesas de madera iluminadas por la luz del sol en nuestra cafetería"
            />
          </div>
          <section className="panel reserve-form">
            <Title>Reserva tu mesa</Title>
            {reserveForm()}
            {reservationResult && (
              <div className="reservation-confirmation">
                <Icon name="check" />
                <strong>Tu reserva #{reservationResult.id}</strong>
                <p>
                  {reservationResult.customer} · {reservationResult.guests}{" "}
                  personas
                  <br />
                  {reservationResult.date} · {reservationResult.time} h · Mesa 0
                  {reservationResult.table}
                </p>
                <Badge
                  tone={
                    reservations.find((r) => r.id === reservationResult.id)
                      ?.status === "Cancelada"
                      ? "neutral"
                      : "ready"
                  }
                >
                  {reservations.find((r) => r.id === reservationResult.id)
                    ?.status || "Confirmada"}
                </Badge>
              </div>
            )}
          </section>
        </section>
      )
    if (publicPage === "Mi pedido") {
      const order = orders.find((o) => o.id === trackedOrder)
      return (
        <section className="public-section">
          <PageHeading
            eyebrow="DE NUESTRA BARRA A TUS MANOS"
            title="Tu momento está en camino."
            description="Aquí puedes seguir el estado de tu pedido."
          />
          {order ? (
            <section className="panel tracking-panel">
              <div className="tracking-heading">
                <div>
                  <Title>Pedido #{order.id}</Title>
                  <p>Gracias, {order.customer}. Lo preparamos con cariño.</p>
                </div>
                <Badge tone={toneFor(order.status)}>{order.status}</Badge>
              </div>
              <div className="summary-row">
                <span>Ticket de compra</span>
                <strong>#{String(order.id).padStart(6, "0")}</strong>
              </div>
              <div className="summary-row">
                <span>Forma de pago</span>
                <strong>{order.paymentMethod || "En caja"}</strong>
              </div>
              <div className="tracking-steps">
                {statusSteps.map((s, i) => (
                  <div
                    className={
                      statusSteps.indexOf(order.status) >= i ? "complete" : ""
                    }
                    key={s}
                  >
                    <span>
                      <Icon
                        name={i === 0 ? "bag" : i === 1 ? "coffee" : "check"}
                      />
                    </span>
                    <strong>{s}</strong>
                  </div>
                ))}
              </div>
              {order.items.map((item, i) => (
                <div className="summary-row" key={i}>
                  <span>
                    {item.quantity}×{" "}
                    {products.find((p) => p.id === item.productId)?.name || (item as Item & { productName?: string }).productName || `Producto #${item.productId}`}
                  </span>
                  <strong>
                    {money(
                      (item.unitPrice ??
                        products.find((p) => p.id === item.productId)?.price ??
                        0) * item.quantity,
                    )}
                  </strong>
                </div>
              ))}
              <div className="summary-row total">
                <strong>Total</strong>
                <strong>{money(orderTotal(order))}</strong>
              </div>
              <div className="info-note">
                <Icon name="pin" size={18} />
                {order.table} ·{" "}
                {order.paid
                  ? order.paymentMethod === "Tarjeta"
                    ? "Pago confirmado por PayPal Sandbox"
                    : "Pago registrado en caja"
                  : order.paymentMethod === "Tarjeta"
                    ? "Pago pendiente de confirmar en PayPal Sandbox"
                    : "Paga al recoger en caja"}
              </div>
              {order.paymentMethod === "Tarjeta" && !order.paid && (
                <Button onClick={() => startPaypalCheckout(order)}>
                  Continuar pago en PayPal Sandbox
                  <Icon name="arrow" size={16} />
                </Button>
              )}
              <Button variant="secondary" onClick={() => setPublicPage("Menú")}>
                Volver al menú <Icon name="arrow" size={16} />
              </Button>
              <Button variant="ghost" onClick={() => window.print()}>
                Imprimir ticket
              </Button>
            </section>
          ) : (
            <div className="empty-state panel">
              <Icon name="coffee" size={36} />
              <Title>¿Preparamos algo para ti?</Title>
              <p>Al confirmar un pedido podrás seguirlo aquí.</p>
              <Button onClick={() => setPublicPage("Menú")}>Ver menú</Button>
            </div>
          )}
        </section>
      )
    }
    return (
      <section className="public-section">
        <PageHeading
          eyebrow="NOS ENCANTARÁ VERTE"
          title="Aquí siempre estás en casa."
          description="Un rincón tranquilo en el corazón de la ciudad."
        />
        <div className="contact-grid">
          <img src={interiorPhoto} alt="El acogedor interior de COFFEE-TERIA" />
          <section className="panel contact-details">
            <Title>
              Ven por un café.
              <br />
              Quédate por el momento.
            </Title>
            <div>
              <Icon name="pin" />
              <p>
                <strong>Encuéntranos</strong>
                <br />
                Colima 145, Roma Norte
                <br />
                Ciudad de México, 06700
              </p>
            </div>
            <div>
              <Icon name="clock" />
              <p>
                <strong>Nuestros horarios</strong>
                <br />
                Lunes a viernes · 8:00–20:00
                <br />
                Sábado y domingo · 9:00–19:00
              </p>
            </div>
            <div>
              <Icon name="coffee" />
              <p>
                <strong>Hablemos</strong>
                <br />
                hola@casaalba.mx
                <br />
                55 1234 5678
              </p>
            </div>
            <Button onClick={() => setPublicPage("Reservar")}>
              Reserva tu lugar <Icon name="arrow" size={16} />
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                window.open(
                  "https://www.google.com/maps/search/?api=1&query=Colima+145+Roma+Norte+CDMX",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <Icon name="external" size={16} /> Cómo llegar
            </Button>
          </section>
        </div>
      </section>
    )
  }
  function publicProducts(list: Product[]) {
    return (
      <div className="product-grid">
        {list.map((p) => (
          <section className="panel product-card public-product" key={p.id}>
            <div
              className="product-image"
              onClick={() => p.available && openProduct(p)}
            >
              <img src={p.image} alt={p.name} />
              {!p.available && <Badge>No disponible</Badge>}
            </div>
            <div className="product-body">
              <span className="eyebrow">{p.category}</span>
              <Title>{p.name}</Title>
              <p>{p.description}</p>
              <div className="product-bottom">
                <strong>{money(p.price)}</strong>
                <Button
                  variant="secondary"
                  disabled={!p.available}
                  onClick={() => openProduct(p)}
                >
                  Elegir <Icon name="plus" size={16} />
                </Button>
              </div>
            </div>
          </section>
        ))}
        {list.length === 0 && (
          <div className="empty-state">
            No hay productos que coincidan con tu búsqueda.
          </div>
        )}
      </div>
    )
  }
  const allowed = (name: string) =>
    role === "Admin" ||
    (role === "Cajero"
      ? ["Dashboard", "Pedidos", "Mesas y reservas", "Ventas y pagos", "Inventario"].includes(name)
      : ["Preparación · KDS", "Recetas", "Inventario"].includes(name))
  const displayName = currentUser?.nombre || (
    role === "Admin" ? "Alejandra Moreno" : role === "Cajero" ? "Diego Flores" : "Camila Ríos"
  )
  const initials = displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")
  return (
    <div className={publicZone ? "app public-app" : "app admin-app"}>
      {!publicZone ? (
        <>
          <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
            <div className="brand">
              <span className="brand-icon">
                <Icon name="coffee" size={29} />
              </span>
              <div className="brand-name">
                COFFEE-TERIA<span>CAFÉ & MOMENTOS</span>
              </div>
              <Button
                variant="icon"
                className="mobile-only"
                aria-label="Cerrar menú"
                onClick={() => setMobileNav(false)}
              >
                <Icon name="close" />
              </Button>
            </div>
            <div className="workspace-label">
              <span className="live-dot" /> Mi cafetería <span>CDMX</span>
            </div>
            <nav className="sidebar-nav">
              {navigation.map((group) => (
                <div className="nav-group" key={group.section}>
                  {group.items.some(([name]) => allowed(name)) && (
                    <span className="nav-label">{group.section}</span>
                  )}
                  {group.items
                    .filter(([name]) => allowed(name))
                    .map(([name, icon]) => (
                      <Button
                        variant="ghost"
                        key={name}
                        className={`nav-item ${
                          page === name ? "selected" : ""
                        }`}
                        onClick={() => navigate(name)}
                      >
                        <Icon name={icon} size={19} />
                        <span>{name}</span>
                        {name === "Pedidos" && (
                          <span className="nav-count">
                            {activeOrders.length}
                          </span>
                        )}
                        {name === "Inventario" && lowStock.length > 0 && (
                          <span className="nav-alert" />
                        )}
                      </Button>
                    ))}
                </div>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <Button
                variant="ghost"
                className="public-link"
                onClick={() => {
                  setPublicZone(true)
                  setPublicPage("Inicio")
                }}
              >
                <Icon name="external" size={18} /> Ver sitio público{" "}
                <Icon name="arrow" size={15} />
              </Button>
              <Button variant="ghost" className="public-link share-link" onClick={copyPublicLink}>
                <Icon name="external" size={17} /> Copiar enlace público
              </Button>
              <div
                className="sidebar-user"
                onClick={() => {
                  if (currentUser) {
                    setModal("profile")
                  } else setModal("login")
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setModal(currentUser ? "profile" : "login")}
              >
                <span className="avatar">{initials}</span>
                <div>
                  <strong>{displayName}</strong>
                  <small>{role === "Admin" ? "Administradora" : role}</small>
                </div>
                <Icon name="down" size={15} />
              </div>
            </div>
          </aside>
          {mobileNav && (
            <div className="nav-backdrop" onClick={() => setMobileNav(false)} />
          )}
          <main className="admin-main">
            <header className="topbar">
              <div className="breadcrumb">
                <Button
                  variant="icon"
                  className="mobile-only"
                  aria-label="Abrir menú"
                  onClick={() => setMobileNav(true)}
                >
                  <Icon name="menu" />
                </Button>
                <span>Mi cafetería</span>
                <span>/</span>
                <strong>{page}</strong>
              </div>
              <div className="topbar-actions">
                <span className="topbar-open">
                  <span className="live-dot" /> Abierto hasta las 20:00
                </span>
                <Button
                  variant="icon"
                  aria-label="Ver alertas"
                  className="notification-button"
                  onClick={() => setModal("notifications")}
                >
                  <Icon name="bell" />
                  {lowStock.length > 0 && <span />}
                </Button>
                <span className="topbar-divider" />
                <Button
                  variant="icon"
                  className="topbar-avatar"
                  aria-label="Abrir perfil"
                  onClick={() => setModal(currentUser ? "profile" : "login")}
                >
                  {initials}
                </Button>
              </div>
            </header>
            <div className="admin-content">
              {adminContent()}
              <footer className="admin-footer">
                <span>
                  COFFEE-TERIA <span>·</span> Hecho para los pequeños momentos.
                </span>
                <div>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("Design System")}
                  >
                    Design System
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("Flujos del Prototipo")}
                  >
                    Flujos del prototipo
                  </Button>
                  <span>Prototipo · datos locales</span>
                </div>
              </footer>
            </div>
          </main>
        </>
      ) : (
        <>
          <header className="public-header">
            <div className="brand" onClick={() => setPublicPage("Inicio")}>
              <span className="brand-icon">
                <Icon name="coffee" size={28} />
              </span>
              <div className="brand-name">
                COFFEE-TERIA<span>CAFÉ & MOMENTOS</span>
              </div>
            </div>
            <nav>
              {["Inicio", "Menú", "Reservar", "Contacto", "Mi pedido"].map(
                (name) => (
                  <Button
                    variant="ghost"
                    className={publicPage === name ? "active" : ""}
                    key={name}
                    onClick={() => {
                      setPublicPage(name)
                      setSearch("")
                    }}
                  >
                    {name}
                  </Button>
                ),
              )}
            </nav>
            <div className="public-header-actions">
              <Button
                variant="ghost"
                className="team-access"
                onClick={() => setModal("login")}
              >
                Acceso equipo
              </Button>
              <Button
                variant="secondary"
                aria-label={`Carrito, ${cartCount} productos`}
                onClick={() => setPublicPage("Carrito")}
              >
                <Icon name="bag" size={19} />
                <span>{cartCount}</span>
              </Button>
            </div>
          </header>
          <main className="public-main">{publicContent()}</main>
          <footer className="public-footer">
            <div>
              <div className="brand-name">
                COFFEE-TERIA<span>CAFÉ & MOMENTOS</span>
              </div>
              <p>El gusto de sentirte en casa.</p>
            </div>
            <span>
              Colima 145 · Roma Norte, CDMX
              <br />
              Todos los días, buenos momentos.
            </span>
            <div>
              <Button variant="ghost" onClick={() => setModal("login")}>
                Zona privada <Icon name="arrow" size={16} />
              </Button>
              <small>
                © {new Date().getFullYear()} COFFEE-TERIA · Prototipo
              </small>
            </div>
          </footer>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{toast}</span>
          <Button
            variant="icon"
            aria-label="Cerrar aviso"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={15} />
          </Button>
        </div>
      )}
      {selectedProduct && (
        <Modal
          title="Un pequeño placer"
          onClose={() => setSelectedProduct(null)}
          wide
        >
          <div className="product-detail">
            <img src={selectedProduct.image} alt={selectedProduct.name} />
            <div>
              <span className="eyebrow">{selectedProduct.category}</span>
              <Title level={1}>{selectedProduct.name}</Title>
              <p>{selectedProduct.description}</p>
              <div className="detail-price">{money(selectedProduct.price)}</div>
              {["Café", "Bebidas frías"].includes(selectedProduct.category) && (
                <Select
                  label="Tu preferencia"
                  value={option}
                  onChange={(e) => setOption(e.target.value)}
                >
                  <option>Leche entera</option>
                  <option>Sin azúcar</option>
                  <option>Extra caliente</option>
                </Select>
              )}
              <div className="detail-quantity">
                <span>Cantidad</span>
                <div className="quantity-control">
                  <Button
                    variant="icon"
                    aria-label="Reducir cantidad"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Icon name="minus" size={16} />
                  </Button>
                  <strong>{quantity}</strong>
                  <Button
                    variant="icon"
                    aria-label="Aumentar cantidad"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Icon name="plus" size={16} />
                  </Button>
                </div>
              </div>
              <Button className="full" onClick={addToCart}>
                Agregar al pedido · {money(selectedProduct.price * quantity)}
                <Icon name="bag" size={17} />
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "profile" && currentUser && (
        <Modal title="Mi perfil" onClose={() => setModal(null)}>
          <div className="form-stack">
            <div className="info-note small">
              <Icon name="users" size={18} />
              <span>{currentUser.nombre} · {currentUser.rol}<br />{currentUser.correo || currentUser.usuario}</span>
            </div>
            <form className="form-stack" onSubmit={changeOwnPassword}>
              <Title>Cambiar contraseña</Title>
              <Input
                label="Contraseña actual"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label="Nueva contraseña (mínimo 8 caracteres)"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input
                label="Confirmar nueva contraseña"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
              <Button type="submit">Guardar contraseña <Icon name="check" size={17} /></Button>
            </form>
            <Button type="button" variant="ghost" onClick={logout}>
              Cerrar sesión <Icon name="logout" size={17} />
            </Button>
          </div>
        </Modal>
      )}
      {selectedOrder && (
        <Modal
          title={`Pedido #${selectedOrder.id}`}
          onClose={() => setSelectedOrder(null)}
        >
          <div className="order-detail-header">
            <div>
              <strong>{selectedOrder.customer}</strong>
              <p>
                {selectedOrder.table} · {selectedOrder.time} h
              </p>
            </div>
            <Badge tone={toneFor(selectedOrder.status)}>
              {selectedOrder.status}
            </Badge>
          </div>
          {selectedOrder.items.map((item, i) => (
            <div className="summary-row" key={i}>
              <span>
                {item.quantity}×{" "}
                {products.find((p) => p.id === item.productId)?.name || (item as Item & { productName?: string }).productName || `Producto #${item.productId}`}
                <small>{item.option}</small>
              </span>
              <strong>
                {money(
                  (item.unitPrice ??
                    products.find((p) => p.id === item.productId)?.price ??
                    0) * item.quantity,
                )}
              </strong>
            </div>
          ))}
          <div className="summary-row total">
            <strong>Total</strong>
            <strong>{money(orderTotal(selectedOrder))}</strong>
          </div>
          <div className="form-stack">
            <Select
              label="Estado del pedido"
              value={selectedOrder.status}
              onChange={(e) =>
                setSelectedOrder({ ...selectedOrder, status: e.target.value })
              }
            >
              {statusSteps.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Button
              onClick={() =>
                updateOrder(selectedOrder.id, selectedOrder.status)
              }
            >
              Guardar estado <Icon name="check" size={17} />
            </Button>
            <small className="muted">
              {selectedOrder.paid
                ? "Pago registrado"
                : "Pendiente de pago en caja"}
            </small>
          </div>
        </Modal>
      )}
      {editingProduct && (
        <Modal
          title={editingProduct.id === 0 ? "Agregar producto" : "Editar producto"}
          onClose={() => setEditingProduct(null)}
        >
          <form className="form-stack" onSubmit={saveProduct}>
            <Input
              label="Nombre"
              required
              value={editingProduct.name}
              onChange={(e) =>
                setEditingProduct({ ...editingProduct, name: e.target.value })
              }
            />
            <Select
              label="Categoría del menú"
              required
              value={editingProduct.category}
              onChange={(e) =>
                setEditingProduct({ ...editingProduct, category: e.target.value })
              }
            >
              <option value="" disabled>Selecciona una categoría</option>
              {productCategories.map((item) => <option key={item}>{item}</option>)}
            </Select>
            <Input
              label="Descripción"
              value={editingProduct.description}
              onChange={(e) =>
                setEditingProduct({
                  ...editingProduct,
                  description: e.target.value,
                })
              }
            />
            <Input
              label="Precio (MXN)"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={editingProduct.price}
              onChange={(e) =>
                setEditingProduct({
                  ...editingProduct,
                  price: Number(e.target.value),
                })
              }
            />
            <Input
              label="URL de imagen (opcional)"
              type="text"
              placeholder="https://..."
              value={editingProduct.image === coffeePhoto ? "" : editingProduct.image}
              onChange={(e) =>
                setEditingProduct({ ...editingProduct, image: e.target.value || coffeePhoto })
              }
            />
            <Input
              label="Stock directo (opcional, si no usarás receta)"
              type="number"
              min="0"
              step="1"
              value={editingProduct.directStock ?? ""}
              onChange={(e) =>
                setEditingProduct({
                  ...editingProduct,
                  directStock: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
            <Select
              label="Disponibilidad"
              value={String(editingProduct.available)}
              onChange={(e) =>
                setEditingProduct({
                  ...editingProduct,
                  available: e.target.value === "true",
                })
              }
            >
              <option value="true">Disponible</option>
              <option value="false">No disponible</option>
            </Select>
            <Button type="submit">
              {editingProduct.id === 0 ? "Guardar producto" : "Guardar cambios"}
              <Icon name="check" size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {modal === "new-recipe" && (
        <Modal title="Agregar receta a un producto" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={chooseNewRecipeProduct}>
            <p className="muted">
              Elige un producto que aún no tenga receta. Si es nuevo, agrégalo primero en Productos.
            </p>
            <Select
              label="Producto"
              value={newRecipeProductId}
              onChange={(e) => setNewRecipeProductId(Number(e.target.value))}
            >
              {products.filter((product) => !product.recipe.length).map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Select>
            <Button type="submit">Continuar <Icon name="arrow" size={16} /></Button>
          </form>
        </Modal>
      )}
      {modal === "reserve" && (
        <Modal title="Un lugar para ti" onClose={() => setModal(null)}>
          {reserveForm()}
        </Modal>
      )}
      {modal === "checkout" && (
        <Modal title="Ya casi es tu momento." onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={placeOrder}>
            <p className="muted">
              {paymentMethod === "Tarjeta"
                ? "El pago se abrirá en PayPal Sandbox con una cuenta y tarjeta de prueba; no se hará un cargo real."
                : "El pedido quedará pendiente para pagar en caja al recogerlo."}
            </p>
            <Input
              label="Tu nombre"
              placeholder="¿Cómo te llamas?"
              required
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <Input
              label="Teléfono"
              type="tel"
              placeholder="10 dígitos"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Select
              label="¿Dónde lo disfrutas?"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
            >
              <option>Para llevar</option>
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i}>Mesa 0{i + 1}</option>
              ))}
            </Select>
            <Select
              label="Forma de pago"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option>Tarjeta</option>
              <option>En caja</option>
            </Select>
            <div className="summary-row total">
              <strong>Total</strong>
              <strong>{money(cartTotal)}</strong>
            </div>
            <Button type="submit">
              Confirmar · {money(cartTotal)}
              <Icon name="check" size={18} />
            </Button>
          </form>
        </Modal>
      )}
      {(modal === "stock" || modal === "purchase") && (
        <Modal
          title={
            modal === "purchase"
              ? "Registrar compra recibida"
              : "Registrar entrada de almacén"
          }
          onClose={() => setModal(null)}
        >
          <form className="form-stack" onSubmit={receiveStock}>
            <Select
              label="Insumo"
              value={stockId}
              onChange={(e) => setStockId(Number(e.target.value))}
            >
              {ingredients.map((i) => (
                <option value={i.id} key={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </Select>
            <Input
              label={`Cantidad (${ingredients.find((i) => i.id === stockId)?.unit})`}
              type="number"
              min="0.001"
              step="0.001"
              required
              value={stockQuantity}
              onChange={(e) => setStockQuantity(Number(e.target.value))}
            />
            <Input
              label="Proveedor"
              readOnly
              value={ingredients.find((i) => i.id === stockId)?.supplier}
            />
            {modal === "purchase" && (
              <>
                <Input
                  label="Precio unitario (MXN)"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(Number(e.target.value))}
                />
                <div className="summary-row total">
                  <strong>Total de compra</strong>
                  <strong>{money(stockQuantity * purchaseCost)}</strong>
                </div>
              </>
            )}
            <div className="info-note small">
              <Icon name="box" size={17} /> Al confirmar se actualiza el stock y
              se registra el movimiento.
            </div>
            <Button type="submit">
              Confirmar entrada <Icon name="check" size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {modal === "ingredient" && (
        <Modal title="Agregar un insumo" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={createIngredient}>
            <Input
              label="Nombre del insumo"
              required
              value={newIngredientName}
              onChange={(e) => setNewIngredientName(e.target.value)}
            />
            <Select
              label="Proveedor"
              value={addingSupplier ? "__nuevo__" : newIngredientSupplier}
              onChange={(e) => {
                const isNewSupplier = e.target.value === "__nuevo__"
                setAddingSupplier(isNewSupplier)
                setNewIngredientSupplier(isNewSupplier ? "" : e.target.value)
              }}
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
              ))}
              <option value="__nuevo__">Agregar nuevo proveedor…</option>
            </Select>
            {addingSupplier && (
              <Input
                label="Nombre del nuevo proveedor"
                required
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
              />
            )}
            <Select
              label="Unidad de medida"
              value={newIngredientUnit}
              onChange={(e) => setNewIngredientUnit(e.target.value)}
            >
              {["kg", "g", "L", "ml", "pzas", "porciones"].map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </Select>
            <div className="form-row">
              <Input
                label="Existencia inicial"
                type="number"
                min="0"
                step="0.001"
                value={newIngredientStock}
                onChange={(e) => setNewIngredientStock(Number(e.target.value))}
              />
              <Input
                label="Stock mínimo"
                type="number"
                min="0"
                step="0.001"
                value={newIngredientMinimum}
                onChange={(e) => setNewIngredientMinimum(Number(e.target.value))}
              />
            </div>
            <Input
              label="Costo unitario (MXN)"
              type="number"
              min="0"
              step="0.0001"
              value={newIngredientCost}
              onChange={(e) => setNewIngredientCost(Number(e.target.value))}
            />
            <Button type="submit">Guardar insumo <Icon name="check" size={17} /></Button>
          </form>
        </Modal>
      )}
      {recipeProduct !== null && (
        <Modal
          title={`${products.find((p) => p.id === recipeProduct)?.recipe.length ? "Editar" : "Crear"} receta · ${products.find((p) => p.id === recipeProduct)?.name || ""}`}
          onClose={() => setRecipeProduct(null)}
        >
          <form className="form-stack" onSubmit={saveRecipe}>
            <p className="muted">Indica cuánta cantidad de cada insumo se utiliza para preparar una porción.</p>
            {recipeDraft.map((item, index) => (
              <div className="recipe-edit-row" key={index}>
                <Select
                  label="Insumo"
                  value={item.ingredient}
                  required
                  onChange={(e) => setRecipeDraft((draft) => draft.map((entry, row) =>
                    row === index ? { ...entry, ingredient: Number(e.target.value) } : entry,
                  ))}
                >
                  {ingredients.map((ingredient) => (
                    <option value={ingredient.id} key={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
                  ))}
                </Select>
                <Input
                  label="Cantidad por porción"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  required
                  value={item.amount}
                  onChange={(e) => setRecipeDraft((draft) => draft.map((entry, row) =>
                    row === index ? { ...entry, amount: Number(e.target.value) } : entry,
                  ))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Quitar ingrediente"
                  onClick={() => setRecipeDraft((draft) => draft.filter((_, row) => row !== index))}
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              disabled={!ingredients.length}
              onClick={() => {
                if (ingredients.length) setRecipeDraft((draft) => [
                  ...draft, { ingredient: ingredients[0].id, amount: 0.001 },
                ])
              }}
            >
              <Icon name="plus" size={16} /> Agregar ingrediente
            </Button>
            <Button type="submit">Guardar receta <Icon name="check" size={17} /></Button>
          </form>
        </Modal>
      )}
      {modal === "login" && (
        <Modal
          title={setupRequired ? "Configura la cuenta administradora" : "Bienvenido a tu cafetería."}
          onClose={() => setModal(null)}
        >
          {setupRequired ? (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await requestJson("/api/auth/setup", {
                  method: "POST",
                  body: JSON.stringify({
                    nombre: employeeName,
                    usuario: setupUser,
                    password: employeePassword,
                    confirmPassword: setupConfirmPassword,
                    correo: setupEmail,
                    telefono: setupPhone,
                  }),
                })
                setSetupRequired(false)
                setModal(null)
                setEmployeeName("")
                setEmployeePassword("")
                setSetupConfirmPassword("")
                notify("Administrador inicial creado. Ya puedes iniciar sesión.")
              } catch (error) {
                notify(error instanceof Error ? error.message : "No se pudo crear el administrador.")
              }
            }}
          >
            <Input label="Nombre completo" required value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
            <Input label="Nombre de usuario" required value={setupUser} onChange={(e) => setSetupUser(e.target.value)} />
            <Input label="Correo" type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} />
            <Input label="Teléfono" value={setupPhone} onChange={(e) => setSetupPhone(e.target.value)} />
            <Input label="Contraseña" type="password" required value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)} />
            <Input label="Confirmar contraseña" type="password" required value={setupConfirmPassword} onChange={(e) => setSetupConfirmPassword(e.target.value)} />
            <Button type="submit">Crear cuenta Administradora</Button>
          </form>
          ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                const result = await requestJson<{ token: string; usuario: SessionUser }>("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ usuario: loginName, password: loginPassword }),
                })
                setCurrentUser(result.usuario)
                setRole(result.usuario.rol)
                sessionStorage.setItem("coffee-teria-token", result.token)
                sessionStorage.setItem("coffee-teria-user", JSON.stringify(result.usuario))
                setPublicZone(false)
                const landingPage = result.usuario.rol === "Barista"
                  ? "Preparación · KDS"
                  : result.usuario.rol === "Cajero" ? "Pedidos" : "Dashboard"
                setPage(landingPage)
                setModal(null)
                setLoginPassword("")
                notify(`Bienvenida/o, ${result.usuario.nombre}. Perfil ${result.usuario.rol} activo.`)
              } catch (error) {
                notify(error instanceof Error ? error.message : "No se pudo iniciar sesión.")
              }
            }}
          >
            <div className="login-mark">
              <Icon name="coffee" size={40} />
            </div>
            <p className="muted">
              Ingresa con el usuario o correo y contraseña de tu perfil.
            </p>
            <Input
              label="Usuario o correo"
              autoComplete="username"
              required
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <div className="info-note small">
              <Icon name="users" size={18} />
              La aplicación abre el espacio según el rol asignado a tu cuenta.
            </div>
            <Button type="submit">
              Entrar a COFFEE-TERIA <Icon name="arrow" size={17} />
            </Button>
            <small className="muted">La contraseña se valida en el servidor y no se conserva en el navegador.</small>
          </form>
          )}
        </Modal>
      )}
      {modal === "notifications" && (
        <Modal title="Todo a su tiempo." onClose={() => setModal(null)}>
          <p className="muted">Estos detalles necesitan un poco de atención.</p>
          {lowStock.map((i) => (
            <div className="notification-row" key={i.id}>
              <Icon name="box" />
              <div>
                <strong>{i.name}</strong>
                <p>
                  Quedan {Number(i.stock.toFixed(3))} {i.unit} · mínimo{" "}
                  {i.minimum} {i.unit}
                </p>
              </div>
              <Badge tone="pending">Stock bajo</Badge>
            </div>
          ))}
          {!lowStock.length && (
            <div className="empty-state">
              <Icon name="check" size={32} />
              <p>Todo está en orden.</p>
            </div>
          )}
          <Button
            className="full"
            onClick={() => {
              setModal(null)
              navigate("Inventario")
            }}
          >
            Revisar inventario <Icon name="arrow" size={16} />
          </Button>
        </Modal>
      )}
      {modal === "date" && (
        <Modal title="El día en COFFEE-TERIA" onClose={() => setModal(null)}>
          <p className="muted">
            El dashboard muestra los pedidos locales y las reservaciones de hoy.
            Para revisar todo el historial, consulta Reportes.
          </p>
          <Input label="Fecha actual" type="date" value={today} readOnly />
          <Button
            className="full modal-action"
            onClick={() => {
              setModal(null)
              navigate("Reportes")
            }}
          >
            Ver reportes <Icon name="arrow" size={16} />
          </Button>
        </Modal>
      )}
      {modal === "sample" && (
        <Modal title="Los detalles importan." onClose={() => setModal(null)}>
          <p className="muted">
            Un modal del sistema de diseño: tipografía serena, controles claros
            y una sola acción principal.
          </p>
          <Button className="full modal-action" onClick={() => setModal(null)}>
            Entendido <Icon name="check" size={17} />
          </Button>
        </Modal>
      )}
      {modal === "employee" && (
        <Modal
          title="Una nueva persona en COFFEE-TERIA"
          onClose={() => setModal(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                if (employeePassword !== employeeConfirmPassword) {
                  notify("Las contraseñas no coinciden.")
                  return
                }
                const result = await requestJson<{ id: number }>("/api/gestion/empleados", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    nombre: employeeName, correo: employeeEmail, usuario: employeeUsername,
                    password: employeePassword,
                    confirmPassword: employeeConfirmPassword,
                    rol: employeeRole,
                    salarioBase: employeeSalary,
                  }),
                })
                setEmployees((prev) => [...prev, {
                  id: result.id, name: employeeName, role: employeeRole,
                  email: employeeEmail, username: employeeUsername,
                  salary: employeeSalary, active: true,
                }])
                setModal(null)
                setEmployeeName("")
                setEmployeeUsername("")
                setEmployeeEmail("")
                setEmployeePassword("")
                setEmployeeConfirmPassword("")
                setEmployeeSalary(0)
                notify("Empleado y perfil de acceso creados en MySQL.")
              } catch (error) {
                notify(error instanceof Error ? error.message : "No se pudo crear el perfil.")
              }
            }}
          >
            <Input
              label="Nombre completo"
              required
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
            />
            <Input
              label="Nombre de usuario"
              required
              autoComplete="username"
              value={employeeUsername}
              onChange={(e) => setEmployeeUsername(e.target.value)}
            />
            <Input
              label="Correo electrónico"
              type="email"
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
            />
            <Select
              label="Rol"
              value={employeeRole}
              onChange={(e) => {
                const value = e.target.value
                if (value === "Admin" || value === "Cajero" || value === "Barista") {
                  setEmployeeRole(value)
                }
              }}
            >
              <option>Admin</option>
              <option>Cajero</option>
              <option>Barista</option>
            </Select>
            <Input
              label="Salario base (MXN)"
              type="number"
              min="0"
              step="0.01"
              value={employeeSalary}
              onChange={(e) => setEmployeeSalary(Number(e.target.value))}
            />
            <Input
              label="Contraseña inicial"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={employeePassword}
              onChange={(e) => setEmployeePassword(e.target.value)}
            />
            <Input
              label="Confirmar contraseña"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={employeeConfirmPassword}
              onChange={(e) => setEmployeeConfirmPassword(e.target.value)}
            />
            <Button type="submit">
              Añadir al equipo <Icon name="plus" size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {modal === "payroll" && (
        <Modal title="Simular pago de nómina" onClose={() => setModal(null)}>
          <form className="form-stack" onSubmit={simulatePayroll}>
            <p className="muted">Se guarda el pago para reportes; no se realiza ninguna transferencia.</p>
            <Select
              label="Empleado"
              value={payrollEmployeeId}
              required
              onChange={(e) => {
                const id = Number(e.target.value)
                setPayrollEmployeeId(id)
                setPayrollAmount(employees.find((employee) => employee.id === id)?.salary || 0)
              }}
            >
              {employees.filter((employee) => employee.active).map((employee) => (
                <option value={employee.id} key={employee.id}>{employee.name} · {employee.role}</option>
              ))}
            </Select>
            <div className="form-row">
              <Input
                label="Inicio del periodo"
                type="date"
                required
                value={payrollStart}
                onChange={(e) => setPayrollStart(e.target.value)}
              />
              <Input
                label="Fin del periodo"
                type="date"
                required
                value={payrollEnd}
                onChange={(e) => setPayrollEnd(e.target.value)}
              />
            </div>
            <Input
              label="Sueldo base pagado (MXN)"
              type="number"
              min="0"
              step="0.01"
              required
              value={payrollAmount}
              onChange={(e) => setPayrollAmount(Number(e.target.value))}
            />
            <Button type="submit">Guardar pago simulado <Icon name="check" size={17} /></Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <Title level={1}>{title}</Title>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
function CategoryTabs({
  category,
  onChange,
  categories = [],
}: {
  category: string
  onChange: (value: string) => void
  categories?: string[]
}) {
  const allCategories = [
    ...new Set([
      "Todos",
      "Café",
      "Bebidas frías",
      "Tés",
      "Panes",
      "Pasteles",
      ...categories.filter(Boolean),
    ]),
  ]
  return (
    <div className="tabs category-tabs">
      {allCategories.map((c) => (
          <Button
            variant="ghost"
            className={category === c ? "active" : ""}
            key={c}
            onClick={() => onChange(c)}
          >
            {c}
          </Button>
      ))}
    </div>
  )
}
