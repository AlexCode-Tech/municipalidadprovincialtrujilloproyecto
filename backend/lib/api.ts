import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(error: unknown, fallback = "No pudimos completar la operación") {
  console.error(error);
  if (error instanceof ZodError) return NextResponse.json({ error: "Datos inválidos", fields: error.flatten().fieldErrors }, { status: 400 });
  return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export function mapEstadoPago(estado: "approved" | "pending" | "rejected") {
  return estado === "approved" ? "APPROVED" as const : estado === "pending" ? "PENDING" as const : "REJECTED" as const;
}
