"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, Calendar, Eye, LoaderCircle, Mail, MessageSquareText, Send, X } from "lucide-react";

type Notificacion = {
  id: string;
  destinoEmail: string;
  asunto: string;
  mensaje: string;
  fechaEnvio: string;
};

export default function AdminNotificacionesPage() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<Notificacion | null>(null);

  const cargarNotificaciones = async () => {
    try {
      const res = await fetch(`/api/admin/notificaciones?t=${Date.now()}`);
      if (res.ok) {
        const body = await res.json();
        setNotificaciones(body);
      }
    } catch (err) {
      console.error("Error al cargar notificaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarNotificaciones();
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Historial de Notificaciones"
        description="Audita todas las notificaciones de comprobantes de pago y citaciones de inspección enviadas a los contribuyentes."
      />

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
          <Mail size={18} className="text-[var(--blue)]" />
          Comunicaciones Emitidas (Email / Alertas)
        </h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
            <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
            <p className="mt-3 text-sm font-medium">Cargando historial de notificaciones...</p>
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 text-sm">
            <Send size={32} className="text-slate-350 mb-3" />
            <p>No se han registrado envíos de notificaciones en el sistema.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[750px]">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3">Destinatario</th>
                  <th className="px-4 py-3">Asunto</th>
                  <th className="px-4 py-3">Fecha y Hora de Envío</th>
                  <th className="px-4 py-3 text-right">Contenido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notificaciones.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {n.destinoEmail}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {n.asunto}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {new Date(n.fechaEnvio).toLocaleString("es-PE")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedNotif(n)}
                        className="inline-flex items-center gap-1 justify-center h-8 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Eye size={13} />
                        Ver mensaje
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Visor de Correo */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl flex flex-col h-[85vh]">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquareText size={18} className="text-[var(--blue)]" />
                  Visor de Alertas MPT
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Para: <span className="font-semibold text-slate-700">{selectedNotif.destinoEmail}</span> | Enviado: {new Date(selectedNotif.fechaEnvio).toLocaleString("es-PE")}
                </p>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-5 font-sans">
              <p className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">
                Asunto: {selectedNotif.asunto}
              </p>
              {/* Renderizar mensaje HTML o texto */}
              {selectedNotif.mensaje.includes("<") ? (
                <div
                  className="prose prose-sm max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: selectedNotif.mensaje }}
                />
              ) : (
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6">{selectedNotif.mensaje}</p>
              )}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedNotif(null)}
                className="h-10 px-5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
