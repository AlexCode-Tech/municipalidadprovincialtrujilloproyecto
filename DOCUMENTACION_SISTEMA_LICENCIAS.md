# 🏛️ Documentación Técnica Oficial: Sistema de Licencias de Funcionamiento - Municipalidad Provincial de Trujillo (MPT)

---

## 📋 Resumen del Proyecto

El **Sistema de Licencias de Funcionamiento de la Municipalidad Provincial de Trujillo (MPT)** es una plataforma web full-stack de última generación desarrollada con **Next.js 15 (App Router)**, **TypeScript**, **Prisma ORM**, y **PostgreSQL**.

Permite automatizar integralmente el flujo de emisión, pago, inspección técnica y vencimiento de licencias de funcionamiento municipales para establecimientos comerciales en la provincia de Trujillo.

---

## 🏗️ Arquitectura General del Sistema

El proyecto sigue una arquitectura unificada **Full-Stack (Backend + Frontend)** dentro del ecosistema Next.js:

```
sistema-licencias-trujillo/
├── 🌐 FRONTEND (Interfaz de Usuario & Componentes)
│   ├── app/                                 # Rutas y páginas de la aplicación
│   │   ├── (auth)/login/                    # Vista de inicio de sesión
│   │   ├── negocio/                         # Módulo del Contribuyente / Negocio
│   │   │   ├── registro/                    # Formulario de Nuevo Trámite
│   │   │   ├── pago/                        # Pasarela de Pago (MercadoPago / Simulación)
│   │   │   ├── estado/                      # Consulta de estado del trámite en tiempo real
│   │   │   └── licencia/                    # Visualización y descarga de Licencia PDF
│   │   ├── cajero/                          # Módulo de Atención presencial / Cajero
│   │   │   ├── nuevo-tramite/               # Registro asistido por RUC
│   │   │   └── solicitudes/                 # Tabla sincronizada en tiempo real de trámites pagados
│   │   └── inspector/                       # Módulo del Inspector de Seguridad
│   │       └── inspecciones-hoy/            # Agenda de inspecciones del día y dictamen
│   └── components/                          # Componentes reutilizables de UI
│       ├── brand/                           # Logo oficial MPT con alto contraste
│       ├── layout/                          # DashboardShell y PageHeading
│       ├── tramites/                        # Formulario interactivo con validación de planos
│       └── ui/                              # StatusBadge (Estados: Aprobado, Vencido, Observado, etc.)
│
├── ⚙️ BACKEND (Servicios, API Routes & Base de Datos)
│   ├── app/api/                             # Endpoints HTTP (Route Handlers)
│   │   ├── sunat/ruc/[ruc]/                 # Consulta de RUC a SUNAT (Estado, Condición, Trujillo)
│   │   ├── tramites/                        # CRUD de trámites, mi-tramite, estado
│   │   ├── pagos/                           # Preferencia MercadoPago, Yape OTP, confirmación
│   │   ├── inspecciones/                    # Dictamen de inspecciones (Conforme / Observado)
│   │   ├── licencias-pdf/[tramiteId]/       # Generación dinámica de PDF con marca de agua "VENCIDA"
│   │   ├── notificaciones/                  # Envío manual o de prueba de correos y SMS
│   │   ├── cron/                            # Cron Jobs (Revisión diaria de vencimientos)
│   │   ├── qstash/                          # Workers asíncronos para tareas en segundo plano
│   │   ├── dev/                             # Endpoints de utilidad (vencer-licencia)
│   │   └── negocios/cajero/                 # Registro asistido por Cajero
│   ├── lib/                                 # Lógica de Negocio y Servicios de Infraestructura
│   │   ├── prisma.ts                        # Cliente Prisma ORM (Conexión PostgreSQL)
│   │   ├── auth.ts                          # Configuración NextAuth.js (JWT & Sesiones)
│   │   ├── autorizacion.ts                  # Control de Acceso basado en Roles (RBAC)
│   │   ├── consulta-ruc.ts                  # Scraping / API REST SUNAT (Valida Trujillo, Activo, Habido)
│   │   ├── factura-pdf.ts                   # Generación de Factura Electrónica en PDF con PDFKit
│   │   ├── notificaciones.ts                # Despacho de Correo (Nodemailer/Gmail) y SMS (Twilio)
│   │   ├── registrar-pago.ts                # Transacciones de pago y programación automática de inspección
│   │   ├── inspecciones.ts                  # Algoritmo de programación de inspecciones en días hábiles
│   │   ├── mercadopago.ts                   # Integración SDK MercadoPago (Tarjetas y Yape)
│   │   ├── sms.ts                           # Envío de SMS vía Twilio con normalización E.164 (+51)
│   │   └── validar-plano.ts                 # Detección y validación de plano de distribución con Canvas
│   └── prisma/                              # Modelado de Base de Datos
│       └── schema.prisma                    # Modelos: Usuario, Negocio, Tramite, Pago, Inspeccion, Licencia
```

---

## 🗄️ Modelo de Base de Datos (`prisma/schema.prisma`)

El esquema de base de datos define 6 entidades principales relacionadas en cadena:

1. **`Usuario`**: Almacena las cuentas del sistema con su rol (`NEGOCIO`, `CAJERO`, `INSPECTOR`).
2. **`Negocio`**: Almacena los datos fiscales del contribuyente extraídos de la SUNAT (`ruc`, `razonSocial`, `domicilioFiscal`, `distrito`, `provincia`, `departamento`, `telefono`). Vinculado de forma única al usuario.
3. **`Tramite`**: Representa la solicitud de licencia (`codigo`, `estado`, `monto`, `planoValidado`).
   - Estados posibles: `BORRADOR`, `PAGO_PENDIENTE`, `PAGO_RECHAZADO`, `INSPECCION_PROGRAMADA`, `OBSERVADO`, `APROBADO`, `DENEGADO`, `VENCIDO`.
4. **`Pago`**: Guarda las transacciones electrónicas (`mercadoPagoId`, `monto`, `metodo`, `estado`).
5. **`Inspeccion`**: Registra las visitas del inspector municipal (`numeroVisita`, `fechaProgramada`, `resultado`, `observaciones`).
6. **`Licencia`**: Registra el documento oficial emitido (`numero`, `emitidaEn`, `venceEn`).

---

## 🔄 Flujo de Trabajo y Procesos Clave

### 1. Registro del Trámite y Verificación SUNAT
- El contribuyente o cajero ingresa el **RUC 20** (11 dígitos).
- La API `/api/sunat/ruc/[ruc]` consulta el RUC en la SUNAT, verificando obligatoriamente que:
  - Esté en estado **ACTIVO** y condición **HABIDO**.
  - El domicilio fiscal pertenezca al **distrito de Trujillo**.
  - El RUC no posea una licencia aprobada y vigente en el sistema.
- Se adjunta y analiza el plano del local (`/api/planos/validar`).

### 2. Pago de la Tasa Municipal (S/ 180.00)
- Al enviar el formulario, el trámite se registra en estado `PAGO_PENDIENTE`.
- El contribuyente puede pagar mediante **MercadoPago** (Tarjeta de Crédito/Débito, Yape con OTP) o mediante el **Simulador Instantáneo**.
- Al confirmarse el pago (`lib/registrar-pago.ts`):
  - El trámite cambia automáticamente a `INSPECCION_PROGRAMADA`.
  - Se genera la **Factura Electrónica PDF** con RUC Municipal (`20145480033`) y se envía por **Gmail** al contribuyente.
  - Se programa automáticamente la **Visita N° 1 de Inspección Técnica** para el día hábil siguiente a las 14:00 hrs.
  - El trámite aparece en **tiempo real (polling 3s)** en el panel del Cajero (`/cajero/solicitudes`).

### 3. Inspección Técnica de Seguridad (Inspector)
- En `/inspector/inspecciones-hoy`, el inspector revisa las visitas programadas para la fecha.
- **Dictamen Conforme**:
  - El trámite cambia a **`APROBADO`**.
  - Se emite automáticamente la **Licencia de Funcionamiento N° `LF-MPT-2026-XXXXXX`** con vigencia de 1 año.
- **Dictamen Observado**:
  - **Visita 1**: Se registra la observación y se programa automáticamente la **Visita 2 (Subsanación)** para dentro de 30 días hábiles. Se envía correo y SMS de alerta.
  - **Visita 2**: Si se vuelve a observar, el trámite cambia a **`DENEGADO`** y se concluye el proceso.

### 4. Control de Vencimiento y Marca de Agua "VENCIDA"
- La vigencia de las licencias es de 1 año desde su fecha de emisión.
- El servicio Cron diario (`/api/cron/revision-diaria`) evalúa las licencias vencidas (`venceEn < new Date()`).
- Al vencer:
  - El trámite cambia a **`VENCIDO`**.
  - Se notifican las alertas por correo electrónico y SMS.
  - La descarga de la licencia PDF en `/api/licencias-pdf/[tramiteId]` aplica dinámicamente la marca de agua diagonal **"VENCIDA"** en color rojo con transparencia sobre el documento.
  - El contribuyente debe realizar un **Nuevo Trámite** desde cero para regularizar su establecimiento.

---

## 🔑 Credenciales y Configuración de Entorno (`.env`)

```env
# Base de datos PostgreSQL local o Vercel Postgres
DATABASE_URL="postgresql://trujillo:12345@localhost:5432/licencias_trujillo?schema=public"

# Autenticación NextAuth.js
NEXTAUTH_SECRET="tu_clave_secreta_nextauth"
NEXTAUTH_URL="http://localhost:3000"

# Credenciales de Correo (Gmail SMTP)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="tu_correo@gmail.com"
EMAIL_SERVER_PASSWORD="tu_app_password_gmail"
EMAIL_FROM="Municipalidad Provincial de Trujillo <tu_correo@gmail.com>"

# Credenciales de SMS (Twilio)
TWILIO_ACCOUNT_SID="tu_twilio_account_sid"
TWILIO_AUTH_TOKEN="tu_twilio_auth_token"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"

# Integración MercadoPago
MERCADOPAGO_ACCESS_TOKEN="TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 🛠️ Comandos de Ejecución y Mantenimiento

- **Iniciar entorno de desarrollo**:
  ```bash
  npm run dev
  ```
- **Sincronizar base de datos con Prisma**:
  ```bash
  npx prisma db push
  ```
- **Abrir interfaz visual de base de datos**:
  ```bash
  npx prisma studio
  ```
- **Forzar vencimiento de un RUC para pruebas**:
  ```
  http://localhost:3000/api/dev/vencer-licencia?ruc=20141878477
  ```
