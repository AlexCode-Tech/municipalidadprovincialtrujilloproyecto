# ⚙️ BACKEND - Servicios, API Routes & Base de Datos

Esta carpeta contiene la capa de backend, lógica de negocio, endpoints HTTP y esquemas de base de datos del **Sistema de Licencias de Funcionamiento de Trujillo**:

## 📁 Estructura del Backend

- **`app/api/`**: Endpoints HTTP (Route Handlers)
  - **`sunat/ruc/[ruc]/`**: Consulta a SUNAT con validación de estado Activo, Habido y Trujillo.
  - **`tramites/`**: CRUD de solicitudes, mi-tramite y estado.
  - **`pagos/`**: Integración con MercadoPago (Preferencia, Yape OTP, confirmación).
  - **`inspecciones/`**: Dictamen técnico de inspección (Conforme / Observado).
  - **`licencias-pdf/[tramiteId]/`**: Emisión dinámica de Licencia PDF con marca de agua "VENCIDA".
  - **`notificaciones/`**: Despacho de emails (Nodemailer/Gmail) y SMS (Twilio).
  - **`cron/`**: Revisión diaria de vencimiento de licencias.
  - **`qstash/`**: Workers de tareas en segundo plano.
  - **`dev/`**: Endpoints de pruebas y utilidades.
  - **`negocios/cajero/`**: Registro asistido por Cajero.

- **`lib/`**: Lógica de Negocio y Conectores de Infraestructura
  - **`prisma.ts`**: Cliente Prisma ORM para conexión a PostgreSQL.
  - **`auth.ts`**: Configuración de autenticación con NextAuth.js.
  - **`autorizacion.ts`**: Control de acceso basado en roles (RBAC).
  - **`consulta-ruc.ts`**: Servicio de consulta de datos fiscales SUNAT.
  - **`factura-pdf.ts`**: Generación de Factura Electrónica PDF con PDFKit.
  - **`notificaciones.ts`**: Despachador multi-canal (Gmail / Twilio SMS).
  - **`registrar-pago.ts`**: Transacciones de pago y agendamiento automático.
  - **`inspecciones.ts`**: Algoritmo de bloques horarios útiles (8:30 am - 2:30 pm).
  - **`mercadopago.ts`**: SDK MercadoPago (Tarjetas y Yape).
  - **`sms.ts`**: Formateador E.164 y cliente Twilio SMS.
  - **`validar-plano.ts`**: Validación visual de planos con Canvas API.

- **`prisma/`**: Esquema de Base de Datos
  - **`schema.prisma`**: Modelos de datos (`Usuario`, `Negocio`, `Tramite`, `Pago`, `Inspeccion`, `Licencia`).
