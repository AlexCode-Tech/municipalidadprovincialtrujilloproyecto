"use client";

import { useEffect, useState, useTransition, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, ArrowLeft, CheckCircle2, Coins, CreditCard, DollarSign, FileText, LoaderCircle, Printer, Store, User } from "lucide-react";
import { CajaCerradaBlock } from "@/components/caja/CajaCerradaBlock";

type Tramite = {
  id: string;
  codigo: string;
  estado: string;
  tipoTramite: string;
  negocio: {
    razonSocial: string;
    ruc: string;
    domicilioFiscal: string;
  };
};

export default function CajeroCobroPage({ params }: { params?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tramiteId = searchParams.get("tramiteId");

  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);
  
  const [metodo, setMetodo] = useState<"EFECTIVO" | "YAPE" | "MIXTO">("EFECTIVO");
  const [montoEfectivo, setMontoEfectivo] = useState("180.00");
  const [montoYape, setMontoYape] = useState("0.00");

  // Estado para solicitud de sencillo con monto y justificación editable
  const [montoSencilloInput, setMontoSencilloInput] = useState("500.00");
  const [justificacionSencilloInput, setJustificacionSencilloInput] = useState("");

  // Estado de saldo en caja del cajero y solicitud de sencillo
  const [saldoDisponibleEnCaja, setSaldoDisponibleEnCaja] = useState<number>(100.00);
  const [solicitandoSencillo, setSolicitandoSencillo] = useState(false);
  const [sencilloEnviado, setSencilloEnviado] = useState(false);
  const [estadoSencilloStatus, setEstadoSencilloStatus] = useState<string | null>(null);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ pagoId: string; numeroFactura: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Cálculo en tiempo real de vuelto (SOLO EN EFECTIVO)
  const effVal = parseFloat(montoEfectivo || "0") || 0;
  const yapVal = parseFloat(montoYape || "0") || 0;
  const totalRecibido = Math.round((effVal + yapVal) * 100) / 100;
  const vueltoCalculadoTotal = Math.max(0, Math.round((totalRecibido - 180.00) * 100) / 100);
  const vueltoEfectivoCalculado = vueltoCalculadoTotal; // 100% Efectivo

  // Auto-completar sugerencia de sencillo y motivo si la caja no cuenta con suficiente dinero
  useEffect(() => {
    if (vueltoEfectivoCalculado > saldoDisponibleEnCaja) {
      const sugerido = Math.ceil(vueltoEfectivoCalculado - saldoDisponibleEnCaja + 50);
      setMontoSencilloInput(sugerido.toFixed(2));
      setJustificacionSencilloInput(`Se requiere sencillo en efectivo para entregar vuelto de S/ ${vueltoCalculadoTotal.toFixed(2)} al cliente.`);
    }
  }, [vueltoEfectivoCalculado, saldoDisponibleEnCaja, vueltoCalculadoTotal]);

  useEffect(() => {
    if (!tramiteId) return;

    async function cargarTramite() {
      try {
        const res = await fetch(`/api/tramites/${tramiteId}`);
        if (!res.ok) {
          setErrorMsg("No se pudo cargar el trámite solicitado.");
        } else {
          const body = await res.json();
          setTramite(body);
          const ESTADOS_PAGABLES = ["BORRADOR", "PAGO_PENDIENTE", "PENDIENTE_PAGO", "PAGO_RECHAZADO"];
          if (!ESTADOS_PAGABLES.includes(body.estado)) {
            setErrorMsg(`Este trámite ya se encuentra pagado o en estado: ${body.estado}.`);
          }
        }
      } catch (err) {
        setErrorMsg("Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }

    void cargarTramite();
  }, [tramiteId]);

  useEffect(() => {
    async function checkCaja() {
      try {
        const res = await fetch(`/api/cajas?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" }
        });
        if (res.ok) {
          const data = await res.json();
          setCajaAbierta(data?.session?.estado === "ABIERTA");
          if (data?.session) {
            const expEff = data?.expected?.efectivo || Number(data?.session?.montoApertura || 100);
            setSaldoDisponibleEnCaja(Math.max(100, expEff));
            if (data?.session?.estadoSencillo) {
              setEstadoSencilloStatus(data.session.estadoSencillo);
            }
          }
        } else {
          setCajaAbierta(false);
        }
      } catch (err) {
        setCajaAbierta(false);
      } finally {
        setCajaLoading(false);
      }
    }
    void checkCaja();
  }, []);

  // Polling para verificar aprobación de sencillo por el Administrador MPT
  useEffect(() => {
    if (!sencilloEnviado) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/cajas?t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            const status = data.session.estadoSencillo;
            if (status === "APROBADO") {
              setEstadoSencilloStatus("APROBADO");
              const montoSolicitado = parseFloat(montoSencilloInput || "500");
              setSaldoDisponibleEnCaja(prev => prev + montoSolicitado);
              setSencilloEnviado(false);
              clearInterval(interval);
            } else if (status === "RECHAZADO") {
              setEstadoSencilloStatus("RECHAZADO");
              setSencilloEnviado(false);
              clearInterval(interval);
            }
          }
        }
      } catch (e) {
        console.error("Error polling sencillo status:", e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [sencilloEnviado, montoSencilloInput]);

  const handlePedirSencillo = async () => {
    const montoSencillo = parseFloat(montoSencilloInput || "0");
    if (isNaN(montoSencillo) || montoSencillo <= 0) {
      setErrorMsg("Ingresa un monto válido de sencillo a solicitar.");
      return;
    }
    const motivo = justificacionSencilloInput.trim() || `Solicitud de sencillo en efectivo para entregar vuelto de S/ ${vueltoCalculadoTotal.toFixed(2)}`;

    setSolicitandoSencillo(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/cajas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SOLICITAR_SENCILLO",
          montoSencillo,
          motivo
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo solicitar sencillo.");
      }

      setSencilloEnviado(true);
      setEstadoSencilloStatus("PENDIENTE");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al solicitar sencillo.");
    } finally {
      setSolicitandoSencillo(false);
    }
  };

  useEffect(() => {
    if (metodo === "EFECTIVO") {
      setMontoEfectivo("180.00");
      setMontoYape("0.00");
    } else if (metodo === "YAPE") {
      setMontoEfectivo("0.00");
      setMontoYape("180.00");
    } else {
      setMontoEfectivo("100.00");
      setMontoYape("80.00");
    }
  }, [metodo]);

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const parts = val.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return val;
  };

  const handleBlurFormat = (val: string, setter: (v: string) => void) => {
    if (!val || isNaN(parseFloat(val))) return;
    setter(parseFloat(val).toFixed(2));
  };

  const handleCobro = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const eff = Math.round(parseFloat(montoEfectivo || "0") * 100) / 100;
    const yap = Math.round(parseFloat(montoYape || "0") * 100) / 100;

    if (isNaN(eff) || eff < 0 || isNaN(yap) || yap < 0) {
      setErrorMsg("Los montos ingresados deben ser válidos y mayores o iguales a cero.");
      return;
    }

    const suma = Math.round((eff + yap) * 100) / 100;
    if (suma < 179.99) {
      setErrorMsg(`El total recibido (S/ ${suma.toFixed(2)}) debe ser al menos S/ 180.00.`);
      return;
    }

    const vueltoTotal = vueltoCalculadoTotal;
    const vueltoEfectivo = vueltoCalculadoTotal;
    const vueltoYape = 0;

    if (vueltoTotal > 0 && vueltoEfectivo > saldoDisponibleEnCaja) {
      setErrorMsg(`La caja no cuenta con suficiente efectivo para entregar S/ ${vueltoEfectivo.toFixed(2)} de vuelto.`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/cajas/cobrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tramiteId,
            metodo,
            montoEfectivo: eff,
            montoYape: yap,
            vueltoTotal,
            vueltoEfectivo,
            vueltoYape,
          }),
        });

        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo procesar el cobro.");
        } else {
          // Obtener datos del pago creado
          const resPago = await fetch(`/api/tramites/${tramiteId}`);
          const dataPago = await resPago.json();
          const fact = dataPago.pagos?.[0]?.numeroFactura || `F001-${Math.floor(100000 + Math.random() * 900000)}`;

          setSuccessData({
            pagoId: body.pagoId,
            numeroFactura: fact,
          });
        }
      } catch (err) {
        setErrorMsg("Error de red al procesar el cobro.");
      }
    });
  };

  if (loading || cajaLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <LoaderCircle className="animate-spin text-[var(--blue)]" size={36} />
        <p className="text-sm font-semibold text-slate-500">Cargando...</p>
      </div>
    );
  }

  if (!successData && !cajaAbierta) {
    return (
      <div className="mx-auto max-w-4xl pt-10">
        <CajaCerradaBlock accion="procesar el cobro de esta licencia" />
      </div>
    );
  }

  if (!tramiteId) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
        <p className="font-bold">Error: Parámetro tramiteId requerido en la URL.</p>
      </div>
    );
  }

  if (successData && tramite) {
    const fechaPagoObj = new Date();
    const fechaEmisionStr = `${String(fechaPagoObj.getDate()).padStart(2, "0")}/${String(fechaPagoObj.getMonth() + 1).padStart(2, "0")}/${fechaPagoObj.getFullYear()}`;
    const fechaVenceObj = new Date(fechaPagoObj.getFullYear() + 1, fechaPagoObj.getMonth(), fechaPagoObj.getDate());
    const fechaVencimientoStr = `${String(fechaVenceObj.getDate()).padStart(2, "0")}/${String(fechaVenceObj.getMonth() + 1).padStart(2, "0")}/${fechaVenceObj.getFullYear()}`;

    return (
      <div className="mx-auto max-w-2xl bg-white rounded-2xl border border-[var(--border)] p-7 shadow-xl">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #comprobante-imprimible, #comprobante-imprimible * {
              visibility: visible;
            }
            #comprobante-imprimible {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 20px !important;
            }
          }
        `}</style>

        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
            <CheckCircle2 size={30} />
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--navy)]">¡Cobro Registrado con Éxito!</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">El trámite se ha activado y se encuentra en inspección técnica.</p>
        </div>

        {/* Factura Electrónica en la estructura exacta de la imagen SUNAT */}
        <div id="comprobante-imprimible" className="border-2 border-black p-5 bg-white font-sans text-xs text-black space-y-3">
          {/* Bloque 1: Encabezado */}
          <div className="flex justify-between items-start gap-4">
            <div className="leading-snug">
              <h2 className="font-bold text-sm sm:text-base text-black uppercase">
                MUNICIPALIDAD PROVINCIAL DE TRUJILLO
              </h2>
              <p className="text-[11px] text-black">JR. ALMAGRO 525 URB. CENTRO HISTORICO</p>
              <p className="text-[11px] text-black">LA LIBERTAD - TRUJILLO - TRUJILLO</p>
            </div>

            <div className="border-2 border-black p-2.5 text-center min-w-[210px] bg-white leading-tight">
              <p className="font-bold text-xs">FACTURA ELECTRONICA</p>
              <p className="font-bold text-xs my-0.5">RUC: 20175639391</p>
              <p className="font-bold text-sm text-black">{successData.numeroFactura}</p>
            </div>
          </div>

          <hr className="border-t border-black my-2" />

          {/* Bloque 2: Datos del Cliente */}
          <div className="grid grid-cols-[140px_10px_1fr] gap-y-1 text-[11px] text-black leading-tight">
            <div>Fecha de Vencimiento</div>
            <div>:</div>
            <div><strong>{fechaVencimientoStr}</strong></div>

            <div>Fecha de Emisión</div>
            <div>:</div>
            <div><strong>{fechaEmisionStr}</strong></div>

            <div>Señor(es)</div>
            <div>:</div>
            <div><strong>{tramite.negocio.razonSocial.toUpperCase()}</strong></div>

            <div>RUC</div>
            <div>:</div>
            <div><strong>{tramite.negocio.ruc}</strong></div>

            <div>Establecimiento del Emisor</div>
            <div>:</div>
            <div><strong>{tramite.negocio.domicilioFiscal.toUpperCase()}</strong></div>

            <div>Tipo de Moneda</div>
            <div>:</div>
            <div><strong>SOLES</strong></div>

            <div>Observación</div>
            <div>:</div>
            <div><strong>ORDEN DE SERVICIO N. {tramite.codigo} ({metodo})</strong></div>
          </div>

          <hr className="border-t border-black my-2" />

          {/* Bloque 3: Tabla de Detalles */}
          <table className="w-full text-left text-[11px] border-collapse my-2">
            <thead>
              <tr className="border-y border-black font-bold">
                <th className="py-1 px-1 text-right w-16">Cantidad</th>
                <th className="py-1 px-1 text-left w-20">Unidad Medida</th>
                <th className="py-1 px-1 text-left w-20">Código</th>
                <th className="py-1 px-1 text-left">Descripción</th>
                <th className="py-1 px-1 text-right w-24">Valor Unitario</th>
              </tr>
            </thead>
            <tbody className="font-medium text-black">
              <tr>
                <td className="py-2 px-1 text-right align-top">1.00</td>
                <td className="py-2 px-1 text-left align-top">UNIDAD</td>
                <td className="py-2 px-1 text-left align-top">SERV-MPT</td>
                <td className="py-2 px-1 text-left align-top">POR DERECHO DE TRAMITE Y EMISION DE LICENCIA DE FUNCIONAMIENTO MUNICIPAL DE TRUJILLO</td>
                <td className="py-2 px-1 text-right align-top">152.54</td>
              </tr>
            </tbody>
          </table>

          <hr className="border-t border-black my-2" />

          {/* Bloque 4: Totales */}
          <div className="grid grid-cols-[1fr_210px] gap-4 items-start pt-1">
            <div className="space-y-3">
              <div className="border border-black px-3 py-1.5 inline-block text-[11px]">
                Valor de Venta de Operaciones Gratuitas : <strong>S/ 0.00</strong>
              </div>
              <p className="font-bold text-[11px] text-black">
                SON: CIENTO OCHENTA CON 00/100 SOLES
              </p>
            </div>

            <table className="w-full text-[10.5px] border border-black border-collapse">
              <tbody className="divide-y divide-black">
                <tr><td className="py-0.5 px-1.5">Sub Total Ventas :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 152.54</td></tr>
                <tr><td className="py-0.5 px-1.5">Anticipos :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 0.00</td></tr>
                <tr><td className="py-0.5 px-1.5">Descuentos :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 0.00</td></tr>
                <tr><td className="py-0.5 px-1.5">Valor Venta :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 152.54</td></tr>
                <tr><td className="py-0.5 px-1.5">ISC :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 0.00</td></tr>
                <tr><td className="py-0.5 px-1.5">IGV :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 27.46</td></tr>
                <tr><td className="py-0.5 px-1.5">Otros Cargos :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 0.00</td></tr>
                <tr><td className="py-0.5 px-1.5">Otros Tributos :</td><td className="py-0.5 px-1.5 text-right font-medium">S/ 0.00</td></tr>
                <tr className="font-bold bg-slate-50"><td className="py-1 px-1.5">Importe Total :</td><td className="py-1 px-1.5 text-right">S/ 180.00</td></tr>
              </tbody>
            </table>
          </div>

          {/* Bloque 5: Pie de Página */}
          <div className="border border-black p-2 text-center text-[10px] italic mt-3 text-black">
            Esta es una representación impresa de la factura electrónica, generada en el Sistema de SUNAT. Puede verificarla utilizando su clave SOL.
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => window.print()}
            className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
          >
            <Printer size={15} />
            Imprimir Factura
          </button>
          <button
            onClick={() => router.push("/cajero/solicitudes")}
            className="flex-1 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-xs font-bold text-white transition"
          >
            Ir a solicitudes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Volver atrás
        </button>
      </div>

      <PageHeading
        title="Registrar Cobro Presencial"
        description="Ingresa el desglose del cobro presencial en efectivo y/o YAPE para activar el trámite."
      />

      {errorMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in" role="alert">
          <AlertCircle className="shrink-0 text-red-500" size={20} />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {tramite && (
        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          {/* Detalles del Negocio */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <User size={18} className="text-[var(--blue)]" />
              Detalles del Trámite
            </h3>
            <div className="text-sm space-y-2.5">
              <div>
                <p className="text-xs text-[var(--muted)]">Código Trámite</p>
                <p className="font-bold text-slate-800">{tramite.codigo}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Razón Social</p>
                <p className="font-semibold text-slate-800">{tramite.negocio.razonSocial}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">RUC</p>
                <p className="font-mono text-slate-800">{tramite.negocio.ruc}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Dirección</p>
                <p className="text-slate-700 leading-5">{tramite.negocio.domicilioFiscal}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Tipo de Trámite</p>
                <p className="font-semibold text-slate-800 uppercase text-xs">{tramite.tipoTramite}</p>
              </div>
            </div>
          </div>

          {/* Formulario de Pago */}
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <DollarSign size={18} className="text-[var(--blue)]" />
              Desglose de Cobro (Tasa S/ 180.00)
            </h3>

            <form onSubmit={handleCobro} className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold block mb-2">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodo("EFECTIVO")}
                    className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                      metodo === "EFECTIVO"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Coins size={14} />
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodo("YAPE")}
                    className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                      metodo === "YAPE"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard size={14} />
                    YAPE
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodo("MIXTO")}
                    className={`h-11 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition ${
                      metodo === "MIXTO"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowLeft size={14} />
                    Mixto
                  </button>
                </div>
              </div>

              {metodo === "MIXTO" ? (
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
                  <label className="text-xs font-bold text-slate-600 block">
                    Monto Recibido Efectivo (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(handleDecimalInput(e.target.value))}
                      onBlur={() => handleBlurFormat(montoEfectivo, setMontoEfectivo)}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                      required
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600 block">
                    Monto Recibido YAPE (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoYape}
                      onChange={(e) => setMontoYape(handleDecimalInput(e.target.value))}
                      onBlur={() => handleBlurFormat(montoYape, setMontoYape)}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                      required
                    />
                  </label>
                  <div className="col-span-2 text-center text-xs text-slate-500 mt-1 border-t border-slate-200 pt-2 flex items-center justify-between">
                    <span>Total Recibido:</span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      S/ {totalRecibido.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : metodo === "EFECTIVO" ? (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <label className="text-xs font-bold text-slate-600 block">
                    Dinero Recibido en Efectivo (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="180"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(handleDecimalInput(e.target.value))}
                      onBlur={() => handleBlurFormat(montoEfectivo, setMontoEfectivo)}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 text-slate-900"
                      required
                    />
                  </label>
                  <div className="text-right text-xs text-slate-500">
                    Tasa oficial: <span className="font-bold text-slate-800">S/ 180.00</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <label className="text-xs font-bold text-slate-600 block">
                    Monto Recibido por YAPE (S/)
                    <input
                      type="number"
                      step="0.01"
                      min="180"
                      value={montoYape}
                      onChange={(e) => setMontoYape(handleDecimalInput(e.target.value))}
                      onBlur={() => handleBlurFormat(montoYape, setMontoYape)}
                      className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 text-slate-900"
                      required
                    />
                  </label>
                  <div className="text-right text-xs text-slate-500">
                    Tasa oficial: <span className="font-bold text-slate-800">S/ 180.00</span>
                  </div>
                </div>
              )}

              {/* SECCIÓN DE CÁLCULO DE VUELTO & VALIDACIÓN DE CAJA */}
              {vueltoCalculadoTotal > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Vuelto Total a Entregar:
                    </span>
                    <span className="text-base font-black text-emerald-700">
                      S/ {vueltoCalculadoTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-emerald-100/60 p-2.5 rounded-xl border border-emerald-200">
                    <span className="font-bold text-emerald-900">Modalidad de Entrega del Vuelto:</span>
                    <span className="font-extrabold text-emerald-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-300">
                      💵 Efectivo (S/ {vueltoCalculadoTotal.toFixed(2)})
                    </span>
                  </div>

                  {/* ALERTA DE SALDO INSUFICIENTE EN CAJA DEL CAJERO & FORMULARIO PEDIR SENCILLO */}
                  {vueltoEfectivoCalculado > saldoDisponibleEnCaja && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3.5 animate-in fade-in">
                      <div className="flex items-start gap-2 text-amber-900 border-b border-amber-200/80 pb-2.5">
                        <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-bold text-amber-950">Saldo Insuficiente en Caja del Cajero</p>
                          <p className="mt-0.5 text-amber-900 leading-snug">
                            El vuelto en efectivo (<strong>S/ {vueltoEfectivoCalculado.toFixed(2)}</strong>) supera el saldo disponible en tu caja (<strong>S/ {saldoDisponibleEnCaja.toFixed(2)}</strong>).
                          </p>
                        </div>
                      </div>

                      {sencilloEnviado ? (
                        <div className="rounded-xl bg-amber-100 p-3 text-center border border-amber-300 animate-pulse space-y-1">
                          <p className="text-xs font-extrabold text-amber-950 flex items-center justify-center gap-1.5">
                            <LoaderCircle size={16} className="animate-spin text-amber-700" />
                            ⌛ Solicitud de Sencillo Enviada (S/ {parseFloat(montoSencilloInput || "0").toFixed(2)})
                          </p>
                          <p className="text-[11px] text-amber-800">
                            En espera de aprobación por el Administrador MPT para transferir dinero desde Tesorería.
                          </p>
                        </div>
                      ) : estadoSencilloStatus === "RECHAZADO" ? (
                        <div className="rounded-xl bg-red-100 p-2.5 text-xs font-bold text-red-800 text-center">
                          ❌ Solicitud de Sencillo Rechazada por el Administrador. Ajusta los montos.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-amber-950">
                            Completa los datos para solicitar sencillo al Administrador MPT:
                          </p>
                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                              Monto de Sencillo a Solicitar (S/)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={montoSencilloInput}
                              onChange={(e) => setMontoSencilloInput(handleDecimalInput(e.target.value))}
                              onBlur={() => handleBlurFormat(montoSencilloInput, setMontoSencilloInput)}
                              className="h-10 w-full rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200"
                              placeholder="500.00"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                              Justificación / Motivo para el Administrador
                            </label>
                            <textarea
                              rows={2}
                              value={justificacionSencilloInput}
                              onChange={(e) => setJustificacionSencilloInput(e.target.value)}
                              placeholder="Escribe el motivo por el cual necesitas sencillo..."
                              className="w-full rounded-xl border border-amber-300 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 resize-none font-sans"
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handlePedirSencillo}
                            disabled={solicitandoSencillo || !montoSencilloInput || !justificacionSencilloInput.trim()}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-3 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                          >
                            <Coins size={16} />
                            {solicitandoSencillo ? "Enviando Solicitud..." : "🙋‍♂️ Enviar Solicitud de Sencillo al Administrador MPT"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {estadoSencilloStatus === "APROBADO" && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                      ✅ ¡Solicitud de sencillo APROBADA por el Administrador MPT! Tu caja ha sido recargada.
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={pending || (vueltoCalculadoTotal > 0 && vueltoEfectivoCalculado > saldoDisponibleEnCaja)}
                className="focus-ring mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white shadow-sm transition disabled:opacity-55"
              >
                {pending && <LoaderCircle className="animate-spin" size={16} />}
                Confirmar y Registrar Pago (Factura)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
