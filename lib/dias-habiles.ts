import { addDays, getDay } from "date-fns";

// Se pueden añadir feriados oficiales publicados para cada año sin alterar el algoritmo.
export function agregarDiasHabiles(fecha: Date, cantidad: number, feriados: Date[] = []) {
  const noLaborables = new Set(feriados.map((dia) => dia.toISOString().slice(0, 10)));
  let resultado = new Date(fecha);
  let sumados = 0;
  while (sumados < cantidad) {
    resultado = addDays(resultado, 1);
    const dia = getDay(resultado);
    const clave = resultado.toISOString().slice(0, 10);
    if (dia !== 0 && dia !== 6 && !noLaborables.has(clave)) sumados += 1;
  }
  return resultado;
}
