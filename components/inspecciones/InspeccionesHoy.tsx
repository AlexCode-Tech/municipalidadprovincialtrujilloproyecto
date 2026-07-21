"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MapPin, MessageSquareWarning, Phone, X, LoaderCircle } from "lucide-react";

type InspeccionItem = {
  id: string;
  hora: string;
  negocio: string;
  ruc: string;
  direccion: string;
  telefono: string;
  visita: number;
  codigoTramite: string;
};

export function InspeccionesHoy() {
  const [items, setItems] = useState<InspeccionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completadasCount, setCompletadasCount] = useState(0);
  const [observing, setObserving] = useState<InspeccionItem | null>(null);
  const [notes, setNotes] = useState("");
  
  useEffect(() => {
    async function cargarInspecciones(inicial = false) {
      if (inicial) setLoading(true);
      try {
        const res = await fetch("/api/inspecciones/hoy");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setItems(data);
          } else if (data && typeof data === "object") {
            setItems(data.inspecciones ?? []);
            if (typeof data.completadasCount === "number") {
              setCompletadasCount(data.completadasCount);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar inspecciones del día:", err);
      } finally {
        if (inicial) setLoading(false);
      }
    }
    
    void cargarInspecciones(true);

    const intervalo = setInterval(() => {
      void cargarInspecciones(false);
    }, 2000);

    return () => clearInterval(intervalo);
  }, []);

  const complete = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setCompletadasCount((prev) => prev + 1);
  };

  const handleConforme = async (id: string, ruc: string) => {
    try {
      const cleanRuc = ruc.replace(/\D/g, "");
      const response = await fetch("/api/inspecciones/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc: cleanRuc, resultado: "CONFORME" })
      });
      if (response.ok) {
        complete(id);
      } else {
        alert("No se pudo registrar la conformidad en el servidor.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al registrar la conformidad.");
    }
  };

  const handleObservar = async (id: string, ruc: string, notes: string) => {
    try {
      const cleanRuc = ruc.replace(/\D/g, "");
      const response = await fetch("/api/inspecciones/resultado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc: cleanRuc, resultado: "OBSERVADO", observaciones: notes })
      });
      if (response.ok) {
        complete(id);
      } else {
        alert("No se pudo registrar la observación en el servidor.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al registrar la observación.");
    }
  };

  const { getSystemDateClient } = require("@/lib/system-date-client");
  const fechaHoy = getSystemDateClient().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-[var(--muted)] bg-white rounded-2xl border border-[var(--border)]">
        <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
        <p className="text-sm font-semibold">Cargando la agenda de inspecciones...</p>
      </div>
    );
  }

  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <p className="text-xs text-[var(--muted)]">Pendientes hoy</p>
        <p className="mt-2 text-3xl font-bold">{items.length}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <p className="text-xs text-[var(--muted)]">Completadas</p>
        <p className="mt-2 text-3xl font-bold text-emerald-700">{completadasCount}</p>
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <p className="text-xs text-[var(--muted)]">Fecha</p>
        <p className="mt-2 text-lg font-bold">{fechaHoy}</p>
      </div>
    </div>
    {items.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-white p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={46} /><h2 className="mt-4 text-xl font-bold">Jornada completada</h2><p className="mt-2 text-sm text-[var(--muted)]">No quedan inspecciones pendientes para hoy.</p></div> : <div className="space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="flex shrink-0 items-center gap-3 lg:w-28"><Clock3 className="text-[var(--blue)]" size={20} /><span className="text-xl font-bold">{item.hora}</span></div><div className="min-w-0 flex-1 border-y border-[var(--border)] py-4 lg:border-x lg:border-y-0 lg:px-6 lg:py-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.negocio}</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold">Visita {item.visita} de 2</span></div><p className="mt-1 font-mono text-xs text-[var(--muted)]">Trámite: <span className="font-bold text-[var(--blue)]">{item.codigoTramite}</span> &middot; RUC {item.ruc}</p><div className="mt-3 flex flex-col gap-2 text-sm text-[#526079] sm:flex-row sm:gap-5"><span className="flex items-center gap-2"><MapPin size={16} />{item.direccion}</span><span className="flex items-center gap-2"><Phone size={16} />{item.telefono}</span></div></div><div className="flex gap-2 lg:flex-col"><button onClick={() => handleConforme(item.id, item.ruc)} className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"><CheckCircle2 size={17} /> Conforme</button><button onClick={() => setObserving(item)} className="focus-ring flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-800"><MessageSquareWarning size={17} /> Observar</button></div></div></article>)}</div>}
    {observing ? <div className="fixed inset-0 z-50 grid place-items-center bg-[#071739]/55 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Registrar observaciones</h2><p className="mt-1 text-sm text-[var(--muted)]">{observing.negocio} · Visita {observing.visita} de 2</p></div><button onClick={() => setObserving(null)} className="focus-ring rounded-lg p-2"><X /></button></div><label className="mt-5 block text-sm font-medium">Detalle de las observaciones<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="focus-ring mt-2 min-h-32 w-full rounded-xl border border-[var(--border)] p-3 outline-none" placeholder="Describe qué debe subsanar el negocio…" /></label><p className="mt-3 rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">{observing.visita === 1 ? "Se programará automáticamente una segunda visita dentro de 30 días hábiles y se notificará al negocio." : "Al ser la segunda observación, el trámite se denegará y quedará terminado."}</p><div className="mt-5 flex justify-end gap-3"><button onClick={() => setObserving(null)} className="focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={notes.trim().length < 10} onClick={() => { handleObservar(observing.id, observing.ruc, notes); setObserving(null); setNotes(""); }} className="focus-ring rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Guardar observación</button></div></div></div> : null}
  </>;
}
