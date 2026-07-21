"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { getSystemDateClient } from "@/lib/system-date-client";

export function SystemDateSimulator() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [inputDate, setInputDate] = useState("");

  // Actualizar el reloj cada segundo para emular el segundero
  useEffect(() => {
    setCurrentDate(getSystemDateClient());
    const interval = setInterval(() => {
      setCurrentDate(getSystemDateClient());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = () => {
    if (currentDate) {
      // Formatear Date local a string para input datetime-local: YYYY-MM-DDTHH:MM
      const offset = currentDate.getTimezoneOffset() * 60000;
      const localISOTime = new Date(currentDate.getTime() - offset).toISOString().slice(0, 16);
      setInputDate(localISOTime);
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    try {
      const res = await fetch("/api/system-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: inputDate }),
      });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
        window.location.reload();
      }
    } catch (e) {
      console.error("Error al guardar la fecha simulada:", e);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch("/api/system-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: null }),
      });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
        window.location.reload();
      }
    } catch (e) {
      console.error("Error al restablecer la fecha:", e);
    }
  };

  if (!currentDate) return null;

  const dateStr = currentDate.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = currentDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const isOverridden = typeof document !== "undefined" && document.cookie.includes("x-system-date");

  return (
    <>
      {/* Botón flotante del simulador */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={handleOpen}
          className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-xs font-bold text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${
            isOverridden
              ? "bg-gradient-to-r from-amber-500 to-orange-600 ring-4 ring-orange-200"
              : "bg-[#1e293b] hover:bg-[#0f172a]"
          }`}
        >
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isOverridden ? "bg-white" : "bg-emerald-400"}`}></span>
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isOverridden ? "bg-white" : "bg-emerald-500"}`}></span>
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} />
            {dateStr}
          </span>
          <span className="border-l border-white/20 pl-2 flex items-center gap-1.5">
            <Clock size={13} />
            {timeStr}
          </span>
          {isOverridden && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] uppercase font-extrabold tracking-wider">
              Simulado
            </span>
          )}
        </button>
      </div>

      {/* Modal de Configuración */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  Simulador de Fecha y Hora (Date Override)
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Adelanta el reloj del sistema para verificar el vencimiento automático de licencias, arqueos de caja y visitas.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Fecha/Hora del Sistema a Simular
                </label>
                <input
                  type="datetime-local"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReset}
                  disabled={!isOverridden}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} />
                  Restablecer real
                </button>
                <button
                  onClick={handleSave}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 h-11 text-xs font-bold text-white shadow-sm"
                >
                  <Save size={14} />
                  Simular Fecha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
