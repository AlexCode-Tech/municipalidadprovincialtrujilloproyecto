"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, ArrowLeft, CheckCircle2, Coins, CreditCard, DollarSign, LoaderCircle, Printer, User, Wallet } from "lucide-react";
import { CajaCerradaBlock } from "@/components/caja/CajaCerradaBlock";

type Tramite = {
  id: string;
  codigo: string;
  estado: string;
  tipoTramite: string;
  direccionTrujillo?: string | null;
  negocio: {
    razonSocial: string;
    ruc: string;
    domicilioFiscal: string;
  };
};

type MetodoPagoUI = "EFECTIVO" | "YAPE" | "MIXTO";
type SubmetodoMixto = "EFECTIVO_YAPE" | "YAPE_YAPE" | "TARJETA_YAPE" | "TARJETA_TARJETA" | "EFECTIVO_TARJETA";

export default function CajeroCobroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tramiteId = searchParams.get("tramiteId");

  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);

  // Estados de métodos de pago
  const [metodo, setMetodo] = useState<MetodoPagoUI>("EFECTIVO");
  const [submetodoMixto, setSubmetodoMixto] = useState<SubmetodoMixto>("EFECTIVO_YAPE");
  const [montoEfectivo, setMontoEfectivo] = useState("180.00");
  const [montoYape, setMontoYape] = useState("0.00");
  const [montoTarjeta, setMontoTarjeta] = useState("0.00");
  const [montoP1, setMontoP1] = useState("90.00");
  const [montoP2, setMontoP2] = useState("90.00");
  const [mpReference, setMpReference] = useState("");
  const [lastDesglose, setLastDesglose] = useState("");

  // Estado para solicitud de sencillo
  const [montoSencilloInput, setMontoSencilloInput] = useState("500.00");
  const [justificacionSencilloInput, setJustificacionSencilloInput] = useState("");
  const [saldoDisponibleEnCaja, setSaldoDisponibleEnCaja] = useState<number>(100.00);
  const [solicitandoSencillo, setSolicitandoSencillo] = useState(false);
  const [sencilloEnviado, setSencilloEnviado] = useState(false);
  const [estadoSencilloStatus, setEstadoSencilloStatus] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ pagoId: string; numeroFactura: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Cálculo en tiempo real de desgloses y total recibido
  let eff = 0;
  let yap = 0;
  let tar = 0;
  let desgloseCalculado = "";

  if (metodo === "EFECTIVO") {
    eff = parseFloat(montoEfectivo || "0") || 0;
    desgloseCalculado = `EFECTIVO (S/ ${eff.toFixed(2)})`;
  } else if (metodo === "YAPE") {
    yap = parseFloat(montoYape || "0") || 180.0;
    desgloseCalculado = `YAPE (S/ ${yap.toFixed(2)})`;
  } else if (metodo === "MIXTO") {
    if (submetodoMixto === "EFECTIVO_YAPE") {
      eff = parseFloat(montoEfectivo || "0") || 0;
      yap = parseFloat(montoYape || "0") || 0;
      desgloseCalculado = `EFECTIVO / YAPE (S/ ${eff.toFixed(2)} + S/ ${yap.toFixed(2)})`;
    } else if (submetodoMixto === "YAPE_YAPE") {
      const p1 = parseFloat(montoP1 || "0") || 0;
      const p2 = parseFloat(montoP2 || "0") || 0;
      yap = Math.round((p1 + p2) * 100) / 100;
      desgloseCalculado = `YAPE / YAPE (S/ ${p1.toFixed(2)} + S/ ${p2.toFixed(2)})`;
    } else if (submetodoMixto === "TARJETA_YAPE") {
      tar = parseFloat(montoTarjeta || "0") || 0;
      yap = parseFloat(montoYape || "0") || 0;
      desgloseCalculado = `TARJETA / YAPE (S/ ${tar.toFixed(2)} + S/ ${yap.toFixed(2)})`;
    } else if (submetodoMixto === "TARJETA_TARJETA") {
      const p1 = parseFloat(montoP1 || "0") || 0;
      const p2 = parseFloat(montoP2 || "0") || 0;
      tar = Math.round((p1 + p2) * 100) / 100;
      desgloseCalculado = `TARJETA / TARJETA (S/ ${p1.toFixed(2)} + S/ ${p2.toFixed(2)})`;
    } else if (submetodoMixto === "EFECTIVO_TARJETA") {
      eff = parseFloat(montoEfectivo || "0") || 0;
      tar = parseFloat(montoTarjeta || "0") || 0;
      desgloseCalculado = `EFECTIVO / TARJETA (S/ ${eff.toFixed(2)} + S/ ${tar.toFixed(2)})`;
    }
  }

  const totalRecibido = Math.round((eff + yap + tar) * 100) / 100;
  const vueltoCalculadoTotal = Math.max(0, Math.round((totalRecibido - 180.00) * 100) / 100);
  const vueltoEfectivoCalculado = vueltoCalculadoTotal;

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
      setMontoTarjeta("0.00");
    } else if (metodo === "YAPE") {
      setMontoEfectivo("0.00");
      setMontoYape("180.00");
    } else {
      setMontoEfectivo("100.00");
      setMontoYape("80.00");
      setMontoTarjeta("0.00");
      setMontoP1("90.00");
      setMontoP2("90.00");
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

    if (totalRecibido < 179.99) {
      setErrorMsg(`El total recibido (S/ ${totalRecibido.toFixed(2)}) debe ser al menos S/ 180.00.`);
      return;
    }

    if (vueltoCalculadoTotal > 0 && vueltoEfectivoCalculado > saldoDisponibleEnCaja) {
      setErrorMsg(`La caja no cuenta con suficiente efectivo para entregar S/ ${vueltoEfectivoCalculado.toFixed(2)} de vuelto.`);
      return;
    }

    setLastDesglose(desgloseCalculado);

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
            montoTarjeta: tar,
            vueltoTotal: vueltoCalculadoTotal,
            vueltoEfectivo: vueltoEfectivoCalculado,
            vueltoYape: 0,
            detalleEstado: desgloseCalculado
          }),
        });

        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo procesar el cobro.");
        } else {
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
    const fechaHoyFormatted = new Date().toISOString().split("T")[0];

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

        {/* Factura Electrónica SUNAT */}
        <div id="comprobante-imprimible" className="border-2 border-black p-5 bg-white font-sans text-xs text-black space-y-3">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1 text-left leading-tight">
              <h2 className="font-bold text-sm tracking-tight uppercase text-black">
                MUNICIPALIDAD PROVINCIAL DE TRUJILLO
              </h2>
              <p className="text-[11px] text-black">JR. ALMAGRO 525 URB. CENTRO HISTORICO</p>
              <p className="text-[11px] text-black">LA LIBERTAD - TRUJILLO - TRUJILLO</p>
              <p className="text-[10px] text-black mt-1">
                Establecimiento del Emisor : JR. ALMAGRO 525 URB. CENTRO HISTORICO LA LIBERTAD-TRUJILLO-TRUJILLO
              </p>
            </div>
            <div className="border-2 border-black p-2 text-center min-w-44 bg-slate-50">
              <p className="font-bold text-xs uppercase tracking-wide">FACTURA ELECTRONICA</p>
              <p className="font-bold text-xs my-0.5">RUC: 20175639391</p>
              <p className="font-extrabold text-sm tracking-wider text-black">{successData.numeroFactura}</p>
            </div>
          </div>

          <hr className="border-t border-black my-2" />

          <div className="space-y-1 text-[11px] leading-snug">
            <div className="flex">
              <span className="w-40 font-normal">Fecha de Vencimiento</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold">{new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString("es-PE")}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Fecha de Emisión</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold">{fechaHoyFormatted}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Señor(es)</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold uppercase">{tramite.negocio.razonSocial}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">RUC</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold">{tramite.negocio.ruc}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Establecimiento del Emisor</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold uppercase">{tramite.negocio.domicilioFiscal}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Forma de Pago</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold uppercase">Contado - {lastDesglose || desgloseCalculado}</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Tipo de Moneda</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold">SOLES</span>
            </div>
            <div className="flex">
              <span className="w-40 font-normal">Observación</span>
              <span className="w-3 text-center">:</span>
              <span className="font-bold uppercase">ORDEN DE SERVICIO N. {tramite.codigo} ({lastDesglose || desgloseCalculado})</span>
            </div>
          </div>

          <hr className="border-t border-black my-2" />

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="py-1">Cantidad</th>
                <th className="py-1">Unidad Medida</th>
                <th className="py-1">Código</th>
                <th className="py-1">Descripción</th>
                <th className="py-1 text-right">Valor Unitario</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 font-medium">1.00</td>
                <td className="py-1">UNIDAD</td>
                <td className="py-1 font-mono">SERV-MPT</td>
                <td className="py-1">POR DERECHO DE TRAMITE Y EMISION DE LICENCIA DE FUNCIONAMIENTO MUNICIPAL DE TRUJILLO</td>
                <td className="py-1 text-right font-medium">152.54</td>
              </tr>
            </tbody>
          </table>

          <hr className="border-t border-black my-2" />

          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="border border-black px-2 py-1 inline-block">
                <span className="font-bold text-[10px]">Valor de Venta de Operaciones Gratuitas : S/ 0.00</span>
              </div>
              <p className="font-bold">SON: CIENTO OCHENTA CON 00/100 SOLES</p>
            </div>
            <table className="text-right text-[11px] min-w-48">
              <tbody>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-2 font-medium">Sub Total Ventas :</td>
                  <td className="py-0.5 px-2 text-right font-medium">S/ 152.54</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-2 font-medium">Valor Venta :</td>
                  <td className="py-0.5 px-2 text-right font-medium">S/ 152.54</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-2 font-medium">IGV (18%) :</td>
                  <td className="py-0.5 px-2 text-right font-medium">S/ 27.46</td>
                </tr>
                <tr className="font-bold bg-slate-50">
                  <td className="py-1 px-2">Importe Total :</td>
                  <td className="py-1 px-2 text-right">S/ 180.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border border-black p-2 text-center text-[10px] italic text-black">
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
        description="Ingresa el desglose del cobro presencial (Efectivo, YAPE o Combinación Mixta) para activar el trámite."
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
                <p className="text-xs text-[var(--muted)] font-medium">Dirección del Local a Licenciar (Sucursal)</p>
                <p className="text-slate-800 font-bold leading-5">{tramite.direccionTrujillo || tramite.negocio.domicilioFiscal}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)] font-medium">Domicilio Fiscal (SUNAT)</p>
                <p className="text-slate-600 leading-5 text-xs">{tramite.negocio.domicilioFiscal}</p>
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
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Selecciona la Combinación de Pago Mixto:
                    </label>
                    <select
                      value={submetodoMixto}
                      onChange={(e) => setSubmetodoMixto(e.target.value as SubmetodoMixto)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="EFECTIVO_YAPE">💵 + 📱 Efectivo y YAPE</option>
                      <option value="YAPE_YAPE">📱 + 📱 YAPE y YAPE (Dos transacciones YAPE)</option>
                      <option value="TARJETA_YAPE">💳 + 📱 Tarjeta y YAPE</option>
                      <option value="TARJETA_TARJETA">💳 + 💳 Tarjeta y Tarjeta (Dos tarjetas)</option>
                      <option value="EFECTIVO_TARJETA">💵 + 💳 Efectivo y Tarjeta</option>
                    </select>
                  </div>

                  {submetodoMixto === "EFECTIVO_YAPE" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Efectivo (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoEfectivo}
                          onChange={(e) => setMontoEfectivo(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoEfectivo, setMontoEfectivo)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto YAPE (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoYape}
                          onChange={(e) => setMontoYape(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoYape, setMontoYape)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                    </div>
                  )}

                  {submetodoMixto === "YAPE_YAPE" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto YAPE 1 (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoP1}
                          onChange={(e) => setMontoP1(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoP1, setMontoP1)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto YAPE 2 (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoP2}
                          onChange={(e) => setMontoP2(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoP2, setMontoP2)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                    </div>
                  )}

                  {submetodoMixto === "TARJETA_YAPE" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Tarjeta (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoTarjeta}
                          onChange={(e) => setMontoTarjeta(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoTarjeta, setMontoTarjeta)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto YAPE (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoYape}
                          onChange={(e) => setMontoYape(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoYape, setMontoYape)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                    </div>
                  )}

                  {submetodoMixto === "TARJETA_TARJETA" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Tarjeta 1 (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoP1}
                          onChange={(e) => setMontoP1(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoP1, setMontoP1)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Tarjeta 2 (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoP2}
                          onChange={(e) => setMontoP2(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoP2, setMontoP2)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                    </div>
                  )}

                  {submetodoMixto === "EFECTIVO_TARJETA" && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Efectivo (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoEfectivo}
                          onChange={(e) => setMontoEfectivo(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoEfectivo, setMontoEfectivo)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                      <label className="text-xs font-bold text-slate-600 block">
                        Monto Tarjeta (S/)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoTarjeta}
                          onChange={(e) => setMontoTarjeta(handleDecimalInput(e.target.value))}
                          onBlur={() => handleBlurFormat(montoTarjeta, setMontoTarjeta)}
                          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none focus:border-blue-500"
                          required
                        />
                      </label>
                    </div>
                  )}

                  <div className="text-center text-xs text-slate-500 mt-1 border-t border-slate-200 pt-2 flex items-center justify-between">
                    <span>Desglose: <strong>{desgloseCalculado}</strong></span>
                    <span className="font-extrabold text-slate-800 text-sm">
                      Total: S/ {totalRecibido.toFixed(2)}
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
                              className="h-9 w-full rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                              Justificación / Motivo para el Administrador
                            </label>
                            <input
                              type="text"
                              value={justificacionSencilloInput}
                              onChange={(e) => setJustificacionSencilloInput(e.target.value)}
                              className="h-9 w-full rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold outline-none focus:border-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void handlePedirSencillo()}
                            disabled={solicitandoSencillo}
                            className="w-full h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            {solicitandoSencillo ? <LoaderCircle size={14} className="animate-spin" /> : null}
                            Solicitar Sencillo a Tesorería MPT
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={pending || (vueltoCalculadoTotal > 0 && vueltoEfectivoCalculado > saldoDisponibleEnCaja)}
                className="w-full h-12 rounded-xl bg-[var(--blue)] hover:bg-[var(--blue-hover)] text-white font-bold text-sm transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? <LoaderCircle className="animate-spin" size={18} /> : null}
                Confirmar y Registrar Pago (Factura)
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
