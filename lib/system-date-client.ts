/**
 * Retorna la fecha simulada actual desde el lado del cliente (lectura sincrónica de cookies).
 * Este archivo no importa "next/headers" por lo que es seguro importarlo en componentes del cliente.
 */
export function getSystemDateClient(): Date {
  if (typeof window === "undefined") return new Date();
  const match = document.cookie.match(/(?:^|; )x-system-date=([^;]*)/);
  if (match && match[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      const parts = decoded.split("|");
      const baseDate = new Date(parts[0]);
      if (!isNaN(baseDate.getTime())) {
        if (parts[1]) {
          const setTimestamp = parseInt(parts[1], 10);
          if (!isNaN(setTimestamp)) {
            const elapsed = Date.now() - setTimestamp;
            return new Date(baseDate.getTime() + elapsed);
          }
        }
        return baseDate;
      }
    } catch {
      // Ignorar errores de decodificación
    }
  }
  return new Date();
}
