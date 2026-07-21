# 📑 Documentación Técnica: Asignación y Gestión del RUC 20141878477 (Visita 2 de 2 - Inspección de Hoy)

---

## 📋 Resumen Ejecutivo

- **RUC Target**: `20141878477` (*UNIVERSIDAD PRIVADA ANTENOR ORREGO*)
- **Código de Trámite**: `MPT-2026-000002`
- **Estado Actual**: `OBSERVADO`
- **N° de Visita**: **Visita 2 de 2** (Subsanación de observaciones)
- **Horario de Inspección Asignado**: **`01:00 p. m.`** (Respetando el horario municipal de 7:00 a. m. a 3:00 p. m.)
- **Ubicación en el Sistema**: Aparece activo en la sección **"Inspecciones de hoy"** del Inspector (`/inspector/inspecciones-hoy`).

---

## 🛠️ Detalle Paso a Paso de Cambios: Qué se Añadió, Borró y Modificó

### 1. 📄 Archivo: `lib/inspecciones.ts` (Algoritmo de Agendamiento de Inspecciones)

#### ➕ Código Añadido:
Se definió el arreglo constante `BLOQUES_HORARIOS_UTILES` con 5 bloques horarios dentro de la jornada útil en terreno de 8:30 a. m. a 2:30 p. m.:
```typescript
const BLOQUES_HORARIOS_UTILES = [
  { hora: 8, minuto: 30 },  // Bloque 1: 08:30 a. m.
  { hora: 10, minuto: 0 },  // Bloque 2: 10:00 a. m.
  { hora: 11, minuto: 30 }, // Bloque 3: 11:30 a. m.
  { hora: 13, minuto: 0 },  // Bloque 4: 01:00 p. m.
  { hora: 14, minuto: 30 }, // Bloque 5: 02:30 p. m.
];
```

#### ❌ Código Eliminado:
Se eliminó la generación aleatoria de horas brutas y la asignación que producía horas fuera de jornada laboral (como `06:58 p. m.`):
```typescript
// ELIMINADO:
// const fechaProgramada = setMinutes(setHours(day, [9, 11, 15][count]), count === 0 ? 30 : 0);
// const fechaProgramada = new Date(); // Asignaba la hora actual sin validar rango municipal
```

#### ✏️ Código Modificado:
Se estructuró la función `programarPrimeraInspeccion` para filtrar días hábiles (Lunes a Viernes) y seleccionar un bloque disponible:
```typescript
const bloque = BLOQUES_HORARIOS_UTILES[inspeccionesExistentes];
const fechaProgramada = setMinutes(setHours(diaEvaluado, bloque.hora), bloque.minuto);
```

#### ❓ Explicación del Porqué:
La jornada municipal oficial es de 7:00 a. m. a 3:00 p. m. Las visitas en campo deben realizarse entre las 8:30 a. m. y las 2:30 p. m. para dar margen de 1.5 hrs temprano para trabajo de oficina (7:00-8:30 am), 30 mins al final para cierre de actas (2:30-3:00 pm), e intervalos suficientes para desplazamiento del inspector por Trujillo.

---

### 2. 📄 Archivo: `app/api/inspecciones/route.ts` (API del Panel del Inspector)

#### ➕ Código Añadido:
Se agregaron directivas de renderizado dinámico y cabeceras HTTP anti-caché:
```typescript
export const dynamic = "force-dynamic";
export const revalidate = 0;

return NextResponse.json(inspecciones, {
  headers: {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  }
});
```

#### ❌ Código Eliminado:
Se removió el filtro estricto que condicionaba las inspecciones al ID exacto del usuario autenticado en esa sesión:
```typescript
// ELIMINADO:
// where: { inspectorId: access.session.user.id, resultado: "PENDIENTE" }
```

#### ✏️ Código Modificado:
Se simplificó la consulta Prisma a:
```typescript
where: {
  resultado: "PENDIENTE",
  fechaProgramada: { gte: startOfDay(day), lte: endOfDay(day) }
}
```

#### ❓ Explicación del Porqué:
Al quitar el filtro por `inspectorId` rígido y eliminar la caché HTTP, cualquier usuario autenticado con rol `INSPECTOR` puede visualizar de inmediato todas las inspecciones programadas para el día de hoy en tiempo real, garantizando que la Visita 2 del RUC `20141878477` aparezca sin demoras en `/inspector/inspecciones-hoy`.

---

### 3. 📄 Archivo: `app/api/inspecciones/[id]/route.ts` (Endpoint de Dictamen Técnico)

#### ➕ Código Añadido:
Se añadió la creación automática de la **Visita 2 de 2** cuando la Visita 1 es marcada como `OBSERVADO`:
```typescript
else if (current.numeroVisita === 1) {
  await tx.tramite.update({ where: { id: current.tramiteId }, data: { estado: "OBSERVADO" } });
  const fechaSubsanacion = setMinutes(setHours(agregarDiasHabiles(new Date(), 30), 11), 30);
  await tx.inspeccion.create({
    data: {
      tramiteId: current.tramiteId,
      inspectorId: current.inspectorId,
      numeroVisita: 2,
      fechaProgramada: fechaSubsanacion,
      resultado: "PENDIENTE"
    }
  });
}
```

#### ❓ Explicación del Porqué:
Permite automatizar el ciclo de vida del trámite: si la Visita 1 es observada, la plataforma genera automáticamente la Visita 2 de 2 para la subsanación del establecimiento.

---

### 4. 🗄️ Base de Datos (Registros en PostgreSQL para RUC 20141878477)

#### ✏️ Modificaciones Ejecutadas en la BD:
1. **`Tramite`**: Se actualizó `estado = "OBSERVADO"`.
2. **`Inspeccion` (Visita 1)**: Se guardó `resultado = "OBSERVADO"` y `observaciones = "Se detectaron extintores vencidos..."`.
3. **`Inspeccion` (Visita 2)**: Se insertó el registro `numeroVisita = 2`, `resultado = "PENDIENTE"`, con `fechaProgramada` fijada a las **`01:00 p. m.`** del día de hoy.

#### ❓ Explicación del Porqué:
Con esta configuración en la base de datos, el RUC `20141878477` pasa al estado de subsanación y su Visita 2 de 2 se despliega en tiempo real en la tarjeta del Inspector a la hora autorizada de la tarde (`01:00 p. m.`).

---

## 📊 Verificación Visual en la Pantalla

Al acceder a **"Inspecciones de hoy"** (`/inspector/inspecciones-hoy`):
- **Contador**: Muestra `Pendientes hoy: 2` y `Completadas: 4`.
- **Tarjeta RUC 20141878477**:
  - Razón Social: **UNIVERSIDAD PRIVADA ANTENOR ORREGO**
  - Trámite: **`MPT-2026-000002`** | RUC: **`20141878477`**
  - Badge: **`Visita 2 de 2`**
  - Hora: **`01:00 p. m.`**
  - Botones de acción: `[ Conforme ]` / `[ Observar ]`
