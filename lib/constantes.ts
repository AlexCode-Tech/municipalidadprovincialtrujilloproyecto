export const COSTO_TRAMITE = 180;
export const ROLES = ["ADMIN", "NEGOCIO", "CAJERO", "INSPECTOR"] as const;
export type Rol = (typeof ROLES)[number];

export const RUTAS_POR_ROL: Record<Rol, string> = {
  ADMIN: "/admin/usuarios",
  NEGOCIO: "/negocio/estado",
  CAJERO: "/cajero/caja",
  INSPECTOR: "/inspector/inspecciones-hoy",
};
