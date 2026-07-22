"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight, Circle, Clock3, FileText, MapPin, AlertTriangle, Search } from "lucide-react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Inspeccion = {
  id: string;
  numeroVisita: number;
  fechaProgramada: string;
  resultado: string;
  observaciones?: string | null;
};

type Tramite = {
  id: string;
  codigo: string;
  estado: string;
  planoUrl?: string | null;
  planoValidado: boolean;
  creadoEn: string;
  negocio: {
    razonSocial: string;
    ruc: string;
    domicilioFiscal: string;
    distrito: string;
  };
  inspecciones: Inspeccion[];
};

export default function EstadoPage() {
  const [rucInput, setRucInput] = useState("");
  const [rucConsulta, setRucConsulta] = useState("");
  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(false);
  const [realizadoBusqueda, setRealizadoBusqueda] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState("");

  // Polling para sincronizar en tiempo real con las acciones del inspector para el RUC buscado
  useEffect(() => {
    if (!rucConsulta) return;

    let active = true;

    async function cargarTramite() {
      try {
        const res = await fetch(`/api/tramites/mi-tramite?ruc=${rucConsulta}&t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        });
        if (res.ok && active) {
          const data = await res.json();
          setTramite(data);
          if (!data) {
            setErrorConsulta("No se encontró ningún trámite registrado para el RUC ingresado.");
          } else {
            setErrorConsulta("");
          }
        }
      } catch (err) {
        console.error("Error al cargar el trámite:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    setLoading(true);
    setErrorConsulta("");
    void cargarTramite();
    
    // Consultar cambios cada 2 segundos
    const interval = setInterval(cargarTramite, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [rucConsulta]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^20\d{9}$/.test(rucInput)) {
      setErrorConsulta("Ingresa un RUC 20 válido de 11 dígitos.");
      return;
    }
    setErrorConsulta("");
    setRealizadoBusqueda(true);
    setRucConsulta(rucInput);
  };

  const handleLimpiarConsulta = () => {
    setRucConsulta("");
    setRucInput("");
    setTramite(null);
    setRealizadoBusqueda(false);
    setErrorConsulta("");
  };

  // 1. Mapear estado del trámite a una etiqueta legible
  const getLegibleEstado = (estado: string) => {
    switch (estado) {
      case "BORRADOR":
      case "PAGO_PENDIENTE": return "Pago pendiente";
      case "PAGO_RECHAZADO": return "Pago rechazado";
      case "INSPECCION_PROGRAMADA": return "Inspección programada";
      case "OBSERVADO": return "Observado";
      case "APROBADO": return "Aprobado";
      case "DENEGADO": return "Denegado";
      case "VENCIDO": return "Vencido";
      default: return estado;
    }
  };

  // Renderizado del Formulario Inicial de Consulta
  if (!realizadoBusqueda) {
    return (
      <div className="mx-auto max-w-2xl mt-10">
        <div className="text-center mb-8">
          <PageHeading
            title="Mi trámite"
            description="Consulta el avance de tu solicitud y las acciones que requiere ingresando tu RUC."
          />
        </div>

        <form onSubmit={handleBuscar} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md">
          <label className="text-sm font-semibold text-slate-700 block mb-3">
            Ingresa el RUC de la Empresa o Negocio:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                className="w-full h-12 rounded-xl border border-slate-300 pl-4 pr-10 outline-none focus:border-[var(--blue)] focus:ring-2 focus:ring-blue-100 font-mono text-sm tracking-wider"
                placeholder="20123456789"
                maxLength={11}
                value={rucInput}
                onChange={(e) => setRucInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
                required
              />
              <Search className="absolute right-3.5 top-3.5 text-slate-400" size={18} />
            </div>
            <button
              type="submit"
              className="focus-ring h-12 px-6 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-semibold text-sm transition-colors flex items-center gap-2 shrink-0"
            >
              Consultar
            </button>
          </div>
          {errorConsulta && (
            <p className="mt-3 text-xs text-[var(--danger)] flex items-center gap-1.5 font-medium" role="alert">
              <AlertTriangle size={14} /> {errorConsulta}
            </p>
          )}
        </form>
      </div>
    );
  }

  // Renderizado de Carga
  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-[var(--muted)]">
        <Clock3 className="animate-spin text-[var(--blue)]" size={32} />
        <p className="text-sm font-semibold">Buscando trámite para el RUC {rucConsulta}...</p>
      </div>
    );
  }

  // Renderizado de Error de No Encontrado
  if (!tramite) {
    return (
      <div className="mx-auto max-w-2xl mt-10">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <FileText className="mx-auto text-slate-400" size={46} />
          <h2 className="mt-4 text-lg font-bold">Trámite no encontrado</h2>
          <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
            No se encontró ninguna solicitud de Licencia de Funcionamiento activa para el RUC <strong className="font-mono">{rucConsulta}</strong>.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleLimpiarConsulta}
              className="focus-ring rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Consultar otro RUC
            </button>
            <Link
              href="/negocio/registro"
              className="focus-ring rounded-xl bg-[var(--blue)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--blue-hover)] transition-colors"
            >
              Iniciar nuevo trámite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Mapear estados para construir el avance
  const isBorradorOrPago = ["BORRADOR", "PAGO_PENDIENTE", "PAGO_RECHAZADO"].includes(tramite.estado);
  const isAprobado = tramite.estado === "APROBADO";
  const isObservado = tramite.estado === "OBSERVADO";

  // Función de utilería para sumar días hábiles en el cliente
  const sumarDiasHabilesCliente = (fechaBase: Date, dias: number): Date => {
    const fecha = new Date(fechaBase.getTime());
    let count = 0;
    while (count < dias) {
      fecha.setDate(fecha.getDate() + 1);
      const diaSemana = fecha.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        count++;
      }
    }
    return fecha;
  };

  const ultimaInspeccion = tramite.inspecciones[0];

  // Encontrar la próxima inspección programada o estimarla si el trámite está OBSERVADO
  const inspeccionPendiente = tramite.inspecciones.find(ins => ins.resultado === "PENDIENTE");
  const inspeccionCompletada = tramite.inspecciones.find(ins => ins.resultado !== "PENDIENTE");

  let fechaProximaObj: Date | null = null;
  if (inspeccionPendiente) {
    fechaProximaObj = new Date(inspeccionPendiente.fechaProgramada);
  } else if (isObservado && inspeccionCompletada) {
    fechaProximaObj = sumarDiasHabilesCliente(new Date(inspeccionCompletada.fechaProgramada), 30);
  } else if (tramite.inspecciones[0]) {
    fechaProximaObj = new Date(tramite.inspecciones[0].fechaProgramada);
  }

  let fechaInspeccionTexto = "Pendiente";
  if (fechaProximaObj) {
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    const hora = fechaProximaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    fechaInspeccionTexto = `${fechaProximaObj.toLocaleDateString("es-PE", options)} · ${hora}`;
  }

  const timeline = [
    {
      label: "Solicitud registrada",
      date: new Date(tramite.creadoEn).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }),
      done: true,
      active: false
    },
    {
      label: "Pago confirmado",
      date: isBorradorOrPago ? "Pendiente" : "Pago procesado con éxito",
      done: !isBorradorOrPago,
      active: tramite.estado === "PAGO_PENDIENTE"
    },
    {
      label: "Inspección programada",
      date: fechaInspeccionTexto,
      done: isAprobado,
      active: ["INSPECCION_PROGRAMADA", "OBSERVADO"].includes(tramite.estado)
    },
    {
      label: "Emisión de licencia",
      date: isAprobado ? "Licencia emitida" : "Pendiente",
      done: isAprobado,
      active: false
    }
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Mi trámite"
        description="Consulta el avance de tu solicitud y las acciones que requiere."
        action={
          <div className="flex gap-2">
            <button
              onClick={handleLimpiarConsulta}
              className="focus-ring rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Consultar otro RUC
            </button>
            {isAprobado ? (
              <Link href="/negocio/licencia" className="focus-ring rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors">
                Ver mi licencia
              </Link>
            ) : (
              <Link href="/negocio/registro" className="focus-ring rounded-xl bg-[var(--blue)] px-4 py-3 text-sm font-semibold text-white">
                Iniciar otro trámite
              </Link>
            )}
          </div>
        }
      />

      {isObservado && ultimaInspeccion?.observaciones ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-sm animate-pulse">
          <AlertTriangle className="shrink-0 text-orange-700" size={24} />
          <div>
            <h4 className="font-bold text-orange-850">Observaciones del Inspector</h4>
            <p className="mt-1 text-orange-800 leading-relaxed font-semibold">
              &ldquo;{ultimaInspeccion.observaciones}&rdquo;
            </p>
            <p className="mt-2 text-xs text-orange-700 font-medium">
              Por favor, subsana estas observaciones en tu local. Se programará una nueva visita para verificar los cambios.
            </p>
          </div>
        </div>
      ) : null}

      {isAprobado ? (
        <div className="mb-6 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950 shadow-sm">
          <Check className="shrink-0 text-emerald-700 bg-emerald-200 rounded-full p-1" size={24} />
          <div>
            <h4 className="font-bold text-emerald-900">¡Trámite Aprobado con Éxito!</h4>
            <p className="mt-1 text-emerald-800 leading-relaxed">
              Tu local ha pasado la inspección de conformidad satisfactoriamente. Tu licencia de funcionamiento ya está lista y disponible para descarga.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-mono text-lg font-bold">{tramite.codigo}</h2>
              <StatusBadge>{getLegibleEstado(tramite.estado)}</StatusBadge>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {tramite.negocio.razonSocial} · RUC {tramite.negocio.ruc}
            </p>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Registrado el {new Date(tramite.creadoEn).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_360px]">
          <div>
            <h3 className="font-bold">Avance del trámite</h3>
            <ol className="mt-5">
              {timeline.map((item, index) => (
                <li key={item.label} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < timeline.length - 1 ? (
                    <span className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px ${item.done ? "bg-emerald-400" : "bg-slate-200"}`} />
                  ) : null}
                  <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ${item.done ? "bg-emerald-600 text-white" : item.active ? "border-2 border-[var(--blue)] bg-blue-50 text-[var(--blue)]" : "border border-slate-300 bg-white text-slate-400"}`}>
                    {item.done ? <Check size={16} /> : item.active ? <Clock3 size={15} /> : <Circle size={10} />}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${item.active ? "text-[var(--blue)]" : ""}`}>{item.label}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.date}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <aside className="rounded-2xl bg-[#f2f6ff] p-5">
            <div className="flex items-center gap-3 text-[var(--blue)]">
              <CalendarDays />
              <h3 className="font-bold">Próxima inspección</h3>
            </div>
            
            {fechaProximaObj ? (
              <>
                <p className="mt-5 text-3xl font-bold tracking-[-.03em]">
                  {fechaProximaObj.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {fechaProximaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </>
            ) : (
              <p className="mt-5 text-sm text-[var(--muted)]">Por programar tras confirmación de pago.</p>
            )}

            <div className="mt-5 flex gap-2 border-t border-blue-200 pt-4 text-sm leading-6 text-[#45536e]">
              <MapPin className="mt-1 shrink-0" size={17} />
              <p>{tramite.negocio.domicilioFiscal}<br />Distrito de {tramite.negocio.distrito}</p>
            </div>
            <p className="mt-5 rounded-xl bg-white p-4 text-xs leading-5 text-[var(--muted)]">
              Asegúrate de que el local esté abierto y que la documentación presentada se encuentre disponible.
            </p>
          </aside>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-[var(--blue)]">
            <FileText size={21} />
          </span>
          <div>
            <p className="font-semibold">Plano presentado</p>
            <p className="text-xs text-emerald-700">Validado correctamente</p>
          </div>
          <button className="focus-ring ml-auto rounded-lg p-2 text-[var(--blue)]">
            <ChevronRight />
          </button>
        </div>
        
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm font-semibold">¿Cambió la construcción o el plano?</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Debes iniciar un nuevo trámite. La renovación solo aplica al mismo local sin cambios.
          </p>
        </div>
      </section>
    </div>
  );
}
