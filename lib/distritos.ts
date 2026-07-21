export const DISTRITOS_TRUJILLO = [
  "Trujillo",
  "Porvenir",
  "Florencia de Mora",
  "Huanchaco",
  "La Esperanza",
  "Laredo",
  "Moche",
  "Poroto",
  "Salaverry",
  "Simbal",
  "Victor Larco Herrera",
  "Alto Trujillo",
] as const;

export type DistritoTrujillo = (typeof DISTRITOS_TRUJILLO)[number];
export const distritoSchemaValues = DISTRITOS_TRUJILLO as unknown as [string, ...string[]];
