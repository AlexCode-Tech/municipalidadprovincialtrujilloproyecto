import sharp from "sharp";

export type ResultadoPlano = {
  esPlano: boolean;
  motivo: string;
  puntuacion: number;
  metricas: {
    fondoClaro: number;
    trazosOscuros: number;
    bordes: number;
    saturacion: number;
    lineasHorizontales: number;
    lineasVerticales: number;
    coberturaEstructural: number;
  };
};

const ANALYSIS_SIZE = 320;

function countLineBands(mask: Uint8Array, width: number, height: number, horizontal: boolean) {
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const qualifying = new Uint8Array(outer);

  for (let a = 0; a < outer; a++) {
    let run = 0;
    let longest = 0;
    let gaps = 0;

    for (let b = 0; b < inner; b++) {
      const index = horizontal ? a * width + b : b * width + a;
      if (mask[index]) {
        run += gaps + 1;
        gaps = 0;
        longest = Math.max(longest, run);
      } else if (run > 0 && gaps < 1) {
        gaps++;
      } else {
        run = 0;
        gaps = 0;
      }
    }
    if (longest >= inner * 0.12) qualifying[a] = 1;
  }

  let bands = 0;
  let insideBand = false;
  for (const value of qualifying) {
    if (value && !insideBand) bands++;
    insideBand = Boolean(value);
  }
  return bands;
}

export function tipoImagenPermitido(bytes: Uint8Array) {
  const png = bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return png ? "image/png" as const : jpeg ? "image/jpeg" as const : null;
}

export async function analizarPlanoImagen(bytes: Uint8Array): Promise<ResultadoPlano> {
  const metadata = await sharp(bytes).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < 300 || height < 300) {
    return {
      esPlano: false,
      motivo: "La imagen tiene muy baja resolución para verificar un plano. Usa una imagen de al menos 300 × 300 píxeles.",
      puntuacion: 0,
      metricas: { fondoClaro: 0, trazosOscuros: 0, bordes: 0, saturacion: 0, lineasHorizontales: 0, lineasVerticales: 0, coberturaEstructural: 0 },
    };
  }

  const { data, info } = await sharp(bytes)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const total = info.width * info.height;
  const luminance = new Uint8Array(total);
  const inkMask = new Uint8Array(total);
  const horizontalEdgeMask = new Uint8Array(total);
  const verticalEdgeMask = new Uint8Array(total);
  let light = 0;
  let dark = 0;
  let mid = 0;
  let saturationSum = 0;

  for (let pixel = 0; pixel < total; pixel++) {
    const offset = pixel * info.channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const lum = Math.round((r * 299 + g * 587 + b * 114) / 1000);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    luminance[pixel] = lum;
    inkMask[pixel] = lum < 185 ? 1 : 0;
    saturationSum += max === 0 ? 0 : (max - min) / max;
    if (lum >= 230) light++;
    else if (lum <= 75) dark++;
    else mid++;
  }

  let edges = 0;
  let comparisons = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const index = y * info.width + x;
      if (x + 1 < info.width) {
        comparisons++;
        if (Math.abs(luminance[index] - luminance[index + 1]) >= 32) {
          edges++;
          verticalEdgeMask[index] = 1;
        }
      }
      if (y + 1 < info.height) {
        comparisons++;
        if (Math.abs(luminance[index] - luminance[index + info.width]) >= 32) {
          edges++;
          horizontalEdgeMask[index] = 1;
        }
      }
    }
  }

  const fondoClaro = light / total;
  const trazosOscuros = dark / total;
  const tonosMedios = mid / total;
  const bordes = edges / comparisons;
  const saturacion = saturationSum / total;
  const lineasHorizontales = Math.max(
    countLineBands(inkMask, info.width, info.height, true),
    countLineBands(horizontalEdgeMask, info.width, info.height, true),
  );
  const lineasVerticales = Math.max(
    countLineBands(inkMask, info.width, info.height, false),
    countLineBands(verticalEdgeMask, info.width, info.height, false),
  );

  const gridSize = 8;
  const cellWidth = info.width / gridSize;
  const cellHeight = info.height / gridSize;
  let occupiedCells = 0;
  for (let gridY = 0; gridY < gridSize; gridY++) {
    for (let gridX = 0; gridX < gridSize; gridX++) {
      let structuralPixels = 0;
      let cellPixels = 0;
      const startX = Math.floor(gridX * cellWidth);
      const endX = Math.floor((gridX + 1) * cellWidth);
      const startY = Math.floor(gridY * cellHeight);
      const endY = Math.floor((gridY + 1) * cellHeight);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const index = y * info.width + x;
          cellPixels++;
          if (inkMask[index] || horizontalEdgeMask[index] || verticalEdgeMask[index]) structuralPixels++;
        }
      }
      if (structuralPixels / cellPixels >= 0.025) occupiedCells++;
    }
  }
  const coberturaEstructural = occupiedCells / (gridSize * gridSize);

  let puntuacion = 0;
  puntuacion += fondoClaro >= 0.35 ? 2 : fondoClaro >= 0.2 ? 1 : -2;
  puntuacion += trazosOscuros >= 0.012 && trazosOscuros <= 0.38 ? 2 : -2;
  puntuacion += bordes >= 0.02 && bordes <= 0.42 ? 2 : -2;
  puntuacion += saturacion <= 0.18 ? 1 : saturacion <= 0.3 ? 0 : -2;
  puntuacion += tonosMedios <= 0.58 ? 1 : -1;
  puntuacion += lineasHorizontales >= 3 ? 2 : lineasHorizontales >= 1 ? 1 : -2;
  puntuacion += lineasVerticales >= 3 ? 2 : lineasVerticales >= 1 ? 1 : -2;
  if (lineasHorizontales >= 2 && lineasVerticales >= 2) puntuacion += 2;
  puntuacion += coberturaEstructural >= 0.55 ? 2 : coberturaEstructural >= 0.35 ? 0 : -3;

  const estructuraOrtogonal = lineasHorizontales >= 2 && lineasVerticales >= 2;
  const estructuraTecnicaDensa = coberturaEstructural >= 0.68
    && bordes >= 0.08
    && (lineasHorizontales >= 3 || lineasVerticales >= 3);
  const aparienciaTecnica = saturacion <= 0.1 || coberturaEstructural >= 0.75;
  const esPlano = puntuacion >= 8
    && coberturaEstructural >= 0.45
    && aparienciaTecnica
    && (estructuraOrtogonal || estructuraTecnicaDensa);
  return {
    esPlano,
    motivo: esPlano
      ? "Se detectó una vista en planta con trazos arquitectónicos y distribución de ambientes."
      : "La imagen no presenta suficientes paredes, ambientes y líneas estructurales propias de un plano en planta. Sube un plano arquitectónico legible, no una fotografía ni otro documento.",
    puntuacion,
    metricas: { fondoClaro, trazosOscuros, bordes, saturacion, lineasHorizontales, lineasVerticales, coberturaEstructural },
  };
}
