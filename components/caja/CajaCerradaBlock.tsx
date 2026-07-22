"use client";

import Link from "next/link";
import { Lock, ArrowRight, Store, AlertTriangle } from "lucide-react";

export function CajaCerradaBlock({ accion = "realizar operaciones" }: { accion?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/20 p-8 shadow-md text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100/80 text-amber-600 shadow-inner">
        <Lock size={28} className="animate-pulse" />
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1 rounded-full">
          Caja Inactiva / Cerrada
        </span>
        <h2 className="text-xl font-black text-slate-900 pt-1">
          Apertura de Caja Requerida
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          No puedes {accion} hasta que el administrador te asigne un fondo y abras tu caja desde el panel de gestión.
        </p>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4 text-left text-xs text-slate-600 space-y-2.5 shadow-sm">
        <p className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <AlertTriangle size={14} className="text-amber-500" />
          Funciones Restringidas:
        </p>
        <ul className="space-y-1.5 font-medium">
          <li className="flex items-center gap-2 text-slate-500">
            <span className="text-red-500 font-bold">✕</span> Registro de trámites presenciales
          </li>
          <li className="flex items-center gap-2 text-slate-500">
            <span className="text-red-500 font-bold">✕</span> Visualización y búsqueda de solicitudes
          </li>
          <li className="flex items-center gap-2 text-slate-500">
            <span className="text-red-500 font-bold">✕</span> Cobro y emisión de recibos MPT
          </li>
        </ul>
      </div>

      <div className="pt-2">
        <Link
          href="/cajero/caja"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition px-6 py-3 text-xs font-bold text-white shadow-md shadow-amber-600/10"
        >
          <Store size={15} />
          Ir a Gestión de Caja
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
