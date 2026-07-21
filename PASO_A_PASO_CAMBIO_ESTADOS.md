# 📑 Guía Técnica Paso a Paso: Cambio de Estado de Trámites y Licencias (RUC 20141878477 y 20223149635)

---

## 📋 Resumen de Acciones Ejecutadas

| RUC | Razón Social | Código Trámite | Estado Anterior | Nuevo Estado Asignado | Visita Actual / Detalle |
|---|---|---|---|---|---|
| **`20141878477`** | UNIVERSIDAD PRIVADA ANTENOR ORREGO | `MPT-2026-000002` | `APROBADO` | **`OBSERVADO`** | **Visita 2 de 2** (Pendiente de subsanación) |
| **`20223149635`** | HOSPITAL REGIONAL DOCENTE DE TRUJILLO | `MPT-2026-000003` | `APROBADO` | **`VENCIDO`** | **Licencia Expirada** (Marca de agua roja "VENCIDA") |

---

## 📂 Carpetas y Archivos Involucrados

Las modificaciones afectaron las siguientes carpetas y archivos dentro de la estructura del proyecto:

```
sistema-licencias-trujillo/
├── ⚙️ BACKEND & BASE DE DATOS
│   ├── prisma/
│   │   └── schema.prisma                   # Definición de relaciones entre Tramite, Inspeccion y Licencia
│   ├── lib/
│   │   ├── prisma.ts                       # Conexión ORM a PostgreSQL
│   │   ├── inspecciones.ts                 # Algoritmo de programación de inspección
│   │   └── notificaciones.ts               # Envío de alertas SMS y Gmail por vencimiento
│   └── app/api/
│       ├── inspecciones/[id]/route.ts      # Endpoint de dictamen de inspección (CONFORME / OBSERVADO)
│       └── dev/
│           ├── vencer-licencia/route.ts    # Script de expiración de licencias por RUC
│           └── cambiar-estados/route.ts   # Endpoint de cambio directo de estado
│
└── 🌐 FRONTEND
    ├── app/cajero/solicitudes/page.tsx     # Tabla de solicitudes del Cajero (polling cada 2s)
    ├── app/inspector/inspecciones-hoy/     # Panel del Inspector de Seguridad
    └── app/negocio/licencia/page.tsx       # Descarga de PDF con marca de agua "VENCIDA"
```

---

## 🛠️ Paso a Paso Explicado: RUC 20141878477 (*Universidad Privada Antenor Orrego*)

### **Objetivo**: Cambiar el estado a `OBSERVADO` y asignar **Visita 2 de 2**.

### **Paso 1: Localización del Registro en PostgreSQL**
1. Se consultó la tabla `Negocio` filtrando por `ruc = "20141878477"`.
2. Se obtuvo su trámite activo `MPT-2026-000002` a través de la relación `tramites`.

### **Paso 2: Limpieza de Licencias Previas**
- Para cambiar de estado `APROBADO` a `OBSERVADO`, se ejecutó una limpieza de la tabla `Licencia` mediante:
  ```typescript
  await prisma.licencia.deleteMany({ where: { tramiteId: tramite.id } });
  ```
- **Razón**: Una solicitud en estado `OBSERVADO` aún no cuenta con licencia oficial emitida.

### **Paso 3: Actualización del Estado del Trámite**
- Se actualizó el campo `estado` en la tabla `Tramite`:
  ```typescript
  await prisma.tramite.update({
    where: { id: tramite.id },
    data: { estado: "OBSERVADO" }
  });
  ```

### **Paso 4: Actualización de la Visita 1 y Creación de la Visita 2**
1. Se marcó la **Visita 1** como `OBSERVADO` registrando el dictamen técnico:
   ```typescript
   await prisma.inspeccion.update({
     where: { id: visita1.id },
     data: {
       resultado: "OBSERVADO",
       observaciones: "Se detectaron extintores vencidos y falta de señalética de emergencia en el acceso principal (Visita 1).",
       completadaEn: new Date()
     }
   });
   ```
2. Se insertó o actualizó la **Visita 2 de 2** en estado `PENDIENTE` para el día de hoy:
   ```typescript
   await prisma.inspeccion.upsert({
     where: { tramiteId_numeroVisita: { tramiteId: tramite.id, numeroVisita: 2 } },
     create: {
       tramiteId: tramite.id,
       inspectorId,
       numeroVisita: 2,
       fechaProgramada: new Date(),
       resultado: "PENDIENTE"
     },
     update: { fechaProgramada: new Date(), resultado: "PENDIENTE" }
   });
   ```

### **Resultado**:
- En el panel del **Inspector** (`/inspector/inspecciones-hoy`), la tarjeta del RUC `20141878477` se muestra ahora como **`Visita 2 de 2`**.
- En la tabla del **Cajero** (`/cajero/solicitudes`), el badge de estado muestra **`Observado`**.

---

## 🛠️ Paso a Paso Explicado: RUC 20223149635 (*Hospital Regional Docente de Trujillo*)

### **Objetivo**: Marcar la licencia como `VENCIDO` y activar la marca de agua.

### **Paso 1: Localización del Registro en PostgreSQL**
1. Se consultó la tabla `Negocio` filtrando por `ruc = "20223149635"`.
2. Se obtuvo su trámite correspondiente `MPT-2026-000003`.

### **Paso 2: Actualización del Estado a `VENCIDO`**
- Se modificó la columna `estado` en la tabla `Tramite`:
  ```typescript
  await prisma.tramite.update({
    where: { id: tramite.id },
    data: { estado: "VENCIDO" }
  });
  ```

### **Paso 3: Modificación de la Fecha de Vigencia en la Licencia**
- Para que el PDF descargable muestre dinámicamente la marca de agua diagonal roja **"VENCIDA"**, se ajustó el campo `venceEn` en la tabla `Licencia` a una fecha anterior a la fecha actual:
  ```typescript
  const fechaEmision = subDays(new Date(), 370);  // Hace 1 año y 5 días
  const fechaVencimiento = subDays(new Date(), 5); // Expiró hace 5 días

  await prisma.licencia.upsert({
    where: { tramiteId: tramite.id },
    create: {
      tramiteId: tramite.id,
      numero: `LF-${tramite.codigo}`,
      emitidaEn: fechaEmision,
      venceEn: fechaVencimiento
    },
    update: { emitidaEn: fechaEmision, venceEn: fechaVencimiento }
  });
  ```

### **Paso 4: Despacho de Notificaciones**
- Se invocó la función `notificarLicenciaVencida(tramite.id)` de `lib/notificaciones.ts` para despachar automáticamente:
  - **Correo electrónico (Gmail)**: Mensaje formal informando que la Licencia N° `LF-MPT-2026-000003` ha caducado.
  - **SMS**: Notificación de texto al celular del contribuyente.

### **Resultado**:
- En la tabla del **Cajero** (`/cajero/solicitudes`), el trámite figura con el distintivo de alerta roja **`VENCIDO`**.
- Al consultar en **Mi Licencia** (`/negocio/licencia`), la interfaz indica el vencimiento con animación y al descargar el documento PDF figurará la marca de agua diagonal **"VENCIDA"**.
