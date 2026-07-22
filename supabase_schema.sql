-- ====================================================================================
-- SCRIPT DE MIGRACIÓN: supabase_schema.sql
-- PROYECTO: Sistema de Licencias de Funcionamiento - Municipalidad Provincial de Trujillo
-- INSTRUCCIONES:
-- 1. Ve a tu panel de Supabase (https://supabase.com/dashboard/project/xqhjipccolswhhhbqqcd).
-- 2. En el menú de la izquierda, haz clic en "SQL Editor" (ícono con el símbolo de >_).
-- 3. Haz clic en el botón "New query" (+).
-- 4. Copia y pega TODO este script SQL en el editor.
-- 5. Haz clic en el botón "Run" (abajo a la derecha) para ejecutarlo.
-- ====================================================================================

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'NEGOCIO', 'CAJERO', 'INSPECTOR');

-- CreateEnum
CREATE TYPE "EstadoTramite" AS ENUM ('BORRADOR', 'PAGO_PENDIENTE', 'PAGO_RECHAZADO', 'INSPECCION_PROGRAMADA', 'OBSERVADO', 'APROBADO', 'DENEGADO', 'VENCIDO', 'PENDIENTE_PAGO', 'EN_INSPECCION', 'SUBSANADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TARJETA', 'YAPE', 'EFECTIVO', 'MIXTO');

-- CreateEnum
CREATE TYPE "ResultadoInspeccion" AS ENUM ('PENDIENTE', 'CONFORME', 'OBSERVADO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'SOLICITADO_CIERRE', 'CERRADA');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negocio" (
    "id" TEXT NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "domicilioFiscal" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,
    "provincia" TEXT NOT NULL DEFAULT 'Trujillo',
    "departamento" TEXT NOT NULL DEFAULT 'La Libertad',
    "telefono" TEXT,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tramite" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "cajeroId" TEXT,
    "estado" "EstadoTramite" NOT NULL DEFAULT 'BORRADOR',
    "monto" DECIMAL(10,2) NOT NULL DEFAULT 180,
    "planoUrl" TEXT,
    "planosUrl" TEXT,
    "planoValidado" BOOLEAN NOT NULL DEFAULT false,
    "esRenovacion" BOOLEAN NOT NULL DEFAULT false,
    "confirmacionSinCambios" BOOLEAN NOT NULL DEFAULT false,
    "representanteId" TEXT,
    "direccionTrujillo" TEXT,
    "rubro" TEXT,
    "areaM2" DOUBLE PRECISION,
    "tipoTramite" TEXT NOT NULL DEFAULT 'INICIAL',
    "poseeCambiosEstructura" BOOLEAN NOT NULL DEFAULT false,
    "zonificacionValida" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tramite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "tramiteId" TEXT NOT NULL,
    "cajaSessionId" TEXT,
    "mercadoPagoId" TEXT,
    "estado" "EstadoPago" NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "montoEfectivo" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montoYape" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montoTarjeta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipoComprobante" TEXT NOT NULL DEFAULT 'FACTURA',
    "numeroFactura" TEXT,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalleEstado" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CajaSession" (
    "id" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "montoApertura" DECIMAL(10,2) NOT NULL,
    "montoCierreEfectivo" DECIMAL(10,2),
    "montoCierreYape" DECIMAL(10,2),
    "diferenciaArqueo" DECIMAL(10,2),
    "justificacionArqueo" TEXT,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CajaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarjetaGuardada" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "ultimosCuatro" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarjetaGuardada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspeccion" (
    "id" TEXT NOT NULL,
    "tramiteId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "numeroVisita" INTEGER NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "bloqueHorario" TEXT,
    "resultado" "ResultadoInspeccion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "completadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Licencia" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tramiteId" TEXT NOT NULL,
    "emitidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "venceEn" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "Licencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuscripcionPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuscripcionPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionEmail" (
    "id" TEXT NOT NULL,
    "destinoEmail" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositoMunicipal" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "referencia" TEXT,
    "registradoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositoMunicipal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_ruc_key" ON "Negocio"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "Negocio_usuarioId_key" ON "Negocio"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Tramite_codigo_key" ON "Tramite"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_mercadoPagoId_key" ON "Pago"("mercadoPagoId");

-- CreateIndex
CREATE UNIQUE INDEX "TarjetaGuardada_negocioId_cardId_key" ON "TarjetaGuardada"("negocioId", "cardId");

-- CreateIndex
CREATE INDEX "Inspeccion_inspectorId_fechaProgramada_resultado_idx" ON "Inspeccion"("inspectorId", "fechaProgramada", "resultado");

-- CreateIndex
CREATE UNIQUE INDEX "Inspeccion_tramiteId_numeroVisita_key" ON "Inspeccion"("tramiteId", "numeroVisita");

-- CreateIndex
CREATE UNIQUE INDEX "Licencia_numero_key" ON "Licencia"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Licencia_tramiteId_key" ON "Licencia"("tramiteId");

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionPush_endpoint_key" ON "SuscripcionPush"("endpoint");

-- AddForeignKey
ALTER TABLE "Negocio" ADD CONSTRAINT "Negocio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tramite" ADD CONSTRAINT "Tramite_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tramite" ADD CONSTRAINT "Tramite_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_tramiteId_fkey" FOREIGN KEY ("tramiteId") REFERENCES "Tramite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cajaSessionId_fkey" FOREIGN KEY ("cajaSessionId") REFERENCES "CajaSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CajaSession" ADD CONSTRAINT "CajaSession_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarjetaGuardada" ADD CONSTRAINT "TarjetaGuardada_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspeccion" ADD CONSTRAINT "Inspeccion_tramiteId_fkey" FOREIGN KEY ("tramiteId") REFERENCES "Tramite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspeccion" ADD CONSTRAINT "Inspeccion_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Licencia" ADD CONSTRAINT "Licencia_tramiteId_fkey" FOREIGN KEY ("tramiteId") REFERENCES "Tramite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================
-- INSERTAR USUARIOS SEMILLA (LOGINS PREDETERMINADOS)
-- ==========================================
INSERT INTO "Usuario" (id, nombre, email, "passwordHash", rol, estado, "actualizadoEn") VALUES
('cmru4zxd00000trg835k7sisj', 'Administrador Único', 'alexpsm2005@gmail.com', '$2b$12$tvEA8b0lkx6wroCg23LhwOLIOaExyWBtjE7CXar8hmgBO6W7MfG9a', 'ADMIN', 'ACTIVO', NOW())
ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", rol = EXCLUDED.rol, estado = EXCLUDED.estado;

INSERT INTO "Usuario" (id, nombre, email, "passwordHash", rol, estado, "actualizadoEn") VALUES
('cmru5ktvv0001tracq6wxpi59', 'María Torres', 'cajero@demo.pe', '$2b$12$tvEA8b0lkx6wroCg23LhwOLIOaExyWBtjE7CXar8hmgBO6W7MfG9a', 'CAJERO', 'ACTIVO', NOW())
ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", rol = EXCLUDED.rol, estado = EXCLUDED.estado;

INSERT INTO "Usuario" (id, nombre, email, "passwordHash", rol, estado, "actualizadoEn") VALUES
('cmru5ktvv0002tracq6wxpi59', 'Juan Carlos', 'cajero2@demo.pe', '$2b$12$tvEA8b0lkx6wroCg23LhwOLIOaExyWBtjE7CXar8hmgBO6W7MfG9a', 'CAJERO', 'ACTIVO', NOW())
ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", rol = EXCLUDED.rol, estado = EXCLUDED.estado;

INSERT INTO "Usuario" (id, nombre, email, "passwordHash", rol, estado, "actualizadoEn") VALUES
('cmru5ktvv0003tracq6wxpi59', 'Carlos Mendoza', 'inspector@demo.pe', '$2b$12$tvEA8b0lkx6wroCg23LhwOLIOaExyWBtjE7CXar8hmgBO6W7MfG9a', 'INSPECTOR', 'ACTIVO', NOW())
ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", rol = EXCLUDED.rol, estado = EXCLUDED.estado;

