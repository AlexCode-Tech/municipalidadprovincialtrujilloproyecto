"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageHeading } from "@/components/layout/DashboardShell";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  CreditCard,
  DollarSign,
  ExternalLink,
  HelpCircle,
  LoaderCircle,
  Play,
  Printer,
  QrCode,
  ShieldCheck,
  Split,
  User,
  Wallet,
  X,
} from "lucide-react";
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

export default function CajeroCobroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tramiteId = searchParams.get("tramiteId") ?? "";

  const [tramite, setTramite] = useState<Tramite | null>(null);
  const [loading, setLoading] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Estados de cobro simulado / modal
  const [showModalSimular, setShowModalSimular] = useState(false);
  const [metodoSimulacion, setMetodoSimulacion] = useState<"EFECTIVO" | "YAPE" | "TARJETA" | "MIXTO">("EFECTIVO");
  const [submetodoMixto, setSubmetodoMixto] = useState<"EFECTIVO_YAPE" | "YAPE_YAPE" | "TARJETA_YAPE" | "TARJETA_TARJETA" | "EFECTIVO_TARJETA">("EFECTIVO_YAPE");
  
  const [montoEfectivo, setMontoEfectivo] = useState("180.00");
  const [montoYape, setMontoYape] = useState("0.00");
  const [montoTarjeta, setMontoTarjeta] = useState("0.00");
  const [montoP1, setMontoP1] = useState("90.00");
  const [montoP2, setMontoP2] = useState("90.00");
  const [lastDesglose, setLastDesglose] = useState("");

  // Estado para gestión de vuelto en Pago Mixto
  const [vueltoModo, setVueltoModo] = useState<"EFECTIVO" | "YAPE" | "MIXTO">("EFECTIVO");
  const [vueltoEfectivoCustom, setVueltoEfectivoCustom] = useState("0.00");
  const [vueltoYapeCustom, setVueltoYapeCustom] = useState("0.00");

  // Estado de caja y solicitud de sencillo
  const [montoSencilloInput, setMontoSencilloInput] = useState("500.00");
  const [justificacionSencilloInput, setJustificacionSencilloInput] = useState("");
  const [saldoDisponibleEnCaja, setSaldoDisponibleEnCaja] = useState<number>(100.00);
  const [solicitandoSencillo, setSolicitandoSencillo] = useState(false);
  const [sencilloEnviado, setSencilloEnviado] = useState(false);
  const [estadoSencilloStatus, setEstadoSencilloStatus] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ pagoId: string; numeroFactura: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDecimalInput = (val: string): string => {
    if (!val) return "";
    const sanitized = val.replace(",", ".");
    const parts = sanitized.split(".");
    if (parts.length > 1 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return sanitized;
  };

  const handleBlurFormat = (val: string, setter: (v: string) => void) => {
    if (!val || isNaN(parseFloat(val))) return;
    setter(parseFloat(val).toFixed(2));
  };

  // Cálculo en tiempo real de desgloses y total recibido
  let eff = 0;
  let yap = 0;
  let tar = 0;
  let desgloseCalculado = "";

  if (metodoSimulacion === "EFECTIVO") {
    eff = parseFloat(montoEfectivo || "0") || 0;
    desgloseCalculado = `EFECTIVO (S/ ${eff.toFixed(2)})`;
  } else if (metodoSimulacion === "YAPE") {
    yap = parseFloat(montoYape || "0") || 180.0;
    desgloseCalculado = `YAPE (S/ ${yap.toFixed(2)})`;
  } else if (metodoSimulacion === "TARJETA") {
    tar = parseFloat(montoTarjeta || "0") || 180.0;
    desgloseCalculado = `TARJETA DE DEBITO / CREDITOS (S/ 180.00)`;
  } else if (metodoSimulacion === "MIXTO") {
    if (submetodoMixto === "EFECTIVO_YAPE") {
      eff = parseFloat(montoEfectivo || "0") || 0;
      yap = parseFloat(montoYape || "0") || 0;
      desgloseCalculado = `EFECTIVO / YAPE (S/ ${eff.toFixed(2)} + S/ ${yap.toFixed(2)})`;
    } else if (submetodoMixto === "YAPE_YAPE") {
      const p1 = parseFloat(montoP1 || "0") || 0;
      const p2 = parseFloat(montoP2 || "0") || 0;
      yap = Math.round((p1 + p2) * 100) / 100;
      desgloseCalculado = `MERCADO PAGO MIXTO: YAPE / YAPE (S/ ${p1.toFixed(2)} + S/ ${p2.toFixed(2)})`;
    } else if (submetodoMixto === "TARJETA_YAPE") {
      tar = parseFloat(montoTarjeta || "0") || 0;
      yap = parseFloat(montoYape || "0") || 0;
      desgloseCalculado = `MERCADO PAGO MIXTO: TARJETA / YAPE (S/ ${tar.toFixed(2)} + S/ ${yap.toFixed(2)})`;
    } else if (submetodoMixto === "TARJETA_TARJETA") {
      const p1 = parseFloat(montoP1 || "0") || 0;
      const p2 = parseFloat(montoP2 || "0") || 0;
      tar = Math.round((p1 + p2) * 100) / 100;
      desgloseCalculado = `MERCADO PAGO MIXTO: TARJETA / TARJETA (S/ ${p1.toFixed(2)} + S/ ${p2.toFixed(2)})`;
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

    async function cargarDatos() {
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

        // Cargar preferencia de Mercado Pago
        const prefRes = await fetch("/api/pagos/preferencia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tramiteId }),
        }).catch(() => null);

        if (prefRes && prefRes.ok) {
          const data = await prefRes.json();
          setCheckoutUrl(data.checkoutUrl);
        }
      } catch (err) {
        setErrorMsg("Error al conectar con el servidor.");
      } finally {
        setLoading(false);
      }
    }

    void cargarDatos();
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

  const handleEjecutarCobroSimulado = async () => {
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
            metodo: metodoSimulacion === "TARJETA" ? "TARJETA" : (metodoSimulacion === "YAPE" ? "YAPE" : (metodoSimulacion === "EFECTIVO" ? "EFECTIVO" : "MIXTO")),
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
          setShowModalSimular(false);
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
    <div className="mx-auto max-w-xl">
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Volver atrás
        </button>
      </div>

      <div className="mb-7 text-center sm:text-left">
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--blue)]">Pasarela de Pago Municipal</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl font-sans">Pago de tu Trámite</h1>
        <p className="mt-2 text-sm text-slate-500">
          Selecciona tu método preferido para completar la tasa de tu Licencia de Funcionamiento.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in" role="alert">
          <AlertCircle className="shrink-0 text-red-500" size={20} />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      {tramite && (
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-100 sm:p-8 space-y-6">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600" />

          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concepto de pago</p>
              <p className="mt-1 font-bold text-slate-800">Licencia de Funcionamiento</p>
              <p className="text-xs text-[var(--blue)] font-mono font-semibold mt-1">Trámite ID: {tramite.codigo}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                Monto a Pagar
              </span>
              <p className="mt-1 text-3xl font-black text-slate-900">S/ 180.00</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-700">
            <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <User size={16} className="text-blue-600" /> Detalles del Contribuyente
            </p>
            <p><strong>Razón Social:</strong> {tramite.negocio.razonSocial}</p>
            <p><strong>RUC:</strong> {tramite.negocio.ruc}</p>
            <p><strong>Dirección del Local a Licenciar (Sucursal):</strong> <span className="font-bold text-blue-900">{tramite.direccionTrujillo || tramite.negocio.domicilioFiscal}</span></p>
            <p><strong>Domicilio Fiscal (SUNAT):</strong> {tramite.negocio.domicilioFiscal}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800">Métodos disponibles para pruebas</p>
                <p className="mt-0.5">
                  Puedes realizar el pago real a través del sandbox de Mercado Pago o simular el éxito instantáneamente usando la herramienta local de desarrollo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {/* Botón 1: Pagar con Mercado Pago (Abre la Pasarela Integrada con Pago Mixto, Tarjeta, Yape y Enlace Web) */}
            <button
              type="button"
              onClick={() => {
                setMetodoSimulacion("MIXTO");
                setSubmetodoMixto("TARJETA_YAPE");
                setMontoTarjeta("90.00");
                setMontoYape("90.00");
                setShowModalSimular(true);
              }}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-[#009ee3] px-6 py-4 text-base font-bold text-white shadow-lg shadow-sky-100 transition-all hover:bg-[#008ed0] hover:shadow-xl active:scale-[0.98]"
            >
              Pagar con Mercado Pago (Tarjeta, Yape o Mixto)
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </button>

            {/* Botón 2: Abrir modal de Simulación de Pago Presencial */}
            <button
              onClick={() => {
                setMetodoSimulacion("EFECTIVO");
                setShowModalSimular(true);
              }}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-6 py-4 text-base font-bold text-white shadow-lg shadow-emerald-50 transition-all hover:bg-emerald-800 hover:shadow-xl active:scale-[0.98]"
            >
              <Play className="h-5 w-5 fill-current" />
              Simular Pago en Efectivo (Sin Mercado Pago)
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 border-t border-slate-100 pt-5 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" /> ¿Necesitas ayuda?
            </span>
            <span className="flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Términos y condiciones
            </span>
          </div>
        </section>
      )}

      {/* MODAL PARA SELECCIONAR MÉTODO DE PAGO SIMULADO Y CALCULAR VUELTO */}
      {showModalSimular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Play className="h-5 w-5 text-emerald-600 fill-current" />
                  Selecciona Método de Pago Simulado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elige la modalidad para emitir el comprobante y calcular vuelto.
                </p>
              </div>
              <button
                onClick={() => setShowModalSimular(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Opciones de Método de Pago Simulado */}
            <div className="grid gap-3">
              {/* Opción 1: Efectivo */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("EFECTIVO")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "EFECTIVO"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "EFECTIVO" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Coins size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Pago en Efectivo</p>
                    <p className="text-xs text-slate-500">Cobro presencial en caja con entrega de vuelto</p>
                  </div>
                </div>
                {metodoSimulacion === "EFECTIVO" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 2: Tarjeta */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("TARJETA")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "TARJETA"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "TARJETA" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Tarjeta de Débito / Crédito</p>
                    <p className="text-xs text-slate-500">Pago exacto S/ 180.00 con tarjeta bancaria</p>
                  </div>
                </div>
                {metodoSimulacion === "TARJETA" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 3: Yape / BCP */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("YAPE")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "YAPE"
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "YAPE" ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <QrCode size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Yape / BCP QR</p>
                    <p className="text-xs text-slate-500">Pago exacto S/ 180.00 por transferencia móvil Yape</p>
                  </div>
                </div>
                {metodoSimulacion === "YAPE" && <Check className="text-emerald-600" size={20} />}
              </button>

              {/* Opción 4: Pago Mixto Mercado Pago / Pasarela */}
              <button
                type="button"
                onClick={() => setMetodoSimulacion("MIXTO")}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  metodoSimulacion === "MIXTO"
                    ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl ${metodoSimulacion === "MIXTO" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Split size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">Pago Mixto Mercado Pago (Tarjeta / Yape)</p>
                    <p className="text-xs text-slate-500">Admite combinaciones: Tarjeta + Yape, Tarjeta + Tarjeta, Yape + Yape o Efectivo</p>
                  </div>
                </div>
                {metodoSimulacion === "MIXTO" && <Check className="text-indigo-600" size={20} />}
              </button>
            </div>

            {/* Inputs dinámicos para Efectivo o Pago Mixto */}
            {metodoSimulacion === "EFECTIVO" && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Dinero Recibido en Efectivo (S/)
                  <input
                    type="number"
                    step="0.01"
                    min="180"
                    value={montoEfectivo}
                    onChange={(e) => setMontoEfectivo(handleDecimalInput(e.target.value))}
                    onBlur={() => handleBlurFormat(montoEfectivo, setMontoEfectivo)}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-600"
                    required
                  />
                </label>
                <p className="text-xs text-slate-500 text-right">Tasa oficial: <strong>S/ 180.00</strong></p>
              </div>
            )}

            {metodoSimulacion === "MIXTO" && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4 animate-in fade-in">
                <div>
                  <label className="text-xs font-bold text-indigo-900 block mb-1">
                    Selecciona la Combinación de Pago Mixto:
                  </label>
                  <select
                    value={submetodoMixto}
                    onChange={(e) => setSubmetodoMixto(e.target.value as any)}
                    className="h-10 w-full rounded-xl border border-indigo-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-600"
                  >
                    <option value="TARJETA_YAPE">💳 + 📱 Mercado Pago Mixto: Tarjeta y YAPE (S/ 90.00 + S/ 90.00)</option>
                    <option value="TARJETA_TARJETA">💳 + 💳 Mercado Pago Mixto: Tarjeta y Tarjeta (Dos tarjetas bancarias)</option>
                    <option value="YAPE_YAPE">📱 + 📱 Mercado Pago Mixto: YAPE y YAPE (Dos transacciones YAPE)</option>
                    <option value="EFECTIVO_YAPE">💵 + 📱 Efectivo y YAPE</option>
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

                <div className="flex items-center justify-between border-t border-indigo-100 pt-3 text-xs">
                  <span className="text-slate-600 font-medium">Total Recibido:</span>
                  <span className="font-bold text-slate-900">S/ {totalRecibido.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* SECCIÓN DE CÁLCULO DE VUELTO & VALIDACIÓN DE CAJA */}
            {vueltoCalculadoTotal > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Check size={16} className="text-emerald-600" />
                    Vuelto Total a Entregar:
                  </span>
                  <span className="text-base font-black text-emerald-700">
                    S/ {vueltoCalculadoTotal.toFixed(2)}
                  </span>
                </div>

                {vueltoEfectivoCalculado > saldoDisponibleEnCaja && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold">Saldo Insuficiente en Caja del Cajero</p>
                        <p className="mt-0.5">
                          El vuelto en efectivo (<strong>S/ {vueltoEfectivoCalculado.toFixed(2)}</strong>) supera el dinero disponible en caja (<strong>S/ {saldoDisponibleEnCaja.toFixed(2)}</strong>).
                        </p>
                      </div>
                    </div>

                    {sencilloEnviado ? (
                      <div className="rounded-xl bg-amber-100 p-3 text-center border border-amber-300 animate-pulse">
                        <p className="text-xs font-extrabold text-amber-900 flex items-center justify-center gap-1.5">
                          <LoaderCircle size={16} className="animate-spin text-amber-700" />
                          ⌛ Solicitud de Sencillo Enviada
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePedirSencillo}
                        disabled={solicitandoSencillo}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                      >
                        <Coins size={16} />
                        {solicitandoSencillo ? "Enviando..." : "Solicitar Sencillo a Tesorería MPT"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Acciones del Modal */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModalSimular(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEjecutarCobroSimulado}
                  disabled={pending || totalRecibido < 179.99 || (vueltoCalculadoTotal > 0 && vueltoEfectivoCalculado > saldoDisponibleEnCaja)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Procesando cobro...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar y Registrar Pago
                    </>
                  )}
                </button>
              </div>

              {checkoutUrl && (
                <div className="text-center pt-1 border-t border-slate-100">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 hover:text-sky-800 hover:underline"
                  >
                    <ExternalLink size={13} />
                    Ir al Checkout Web Externo de Mercado Pago (mercadopago.com.pe)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
