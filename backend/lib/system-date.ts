import { cookies } from "next/headers";

/**
 * Retorna la fecha actual del sistema, considerando el override (cookie x-system-date)
 * para simular el paso del tiempo de forma realista (ticking clock).
 * Función exclusiva del servidor.
 */
export async function getSystemDate(): Promise<Date> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get("x-system-date")?.value;
    if (val) {
      const parts = val.split("|");
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
    }
  } catch (e) {
    // Ignorar errores durante compilación estática (SSG)
  }
  return new Date();
}
