"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  LoaderCircle,
  Search,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";

import { DISTRITOS_TRUJILLO } from "@/lib/distritos";
import { solicitudTramiteSchema } from "@/lib/validaciones";

type LocalPrevio = {
  id: string;
  codigo: string;
  estado: string;
  direccion: string;
  licencia: string | null;
};

type DatosRuc = {
  razonSocial: string;
  domicilioFiscal: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  estado?: string;
  condicion?: string;
  localesPrevios?: LocalPrevio[];
};
type PlanoEstado = "idle" | "analizando" | "valido" | "invalido" | "error";
type FormErrors = Record<string, string | undefined>;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function RegistroTramiteForm({ presencial = false }: { presencial?: boolean }) {
  const router = useRouter();
  const [tipoTramite, setTipoTramite] = useState<"INICIAL" | "RENOVACION">("INICIAL");
  const [tieneCambios, setTieneCambios] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [ruc, setRuc] = useState("");
  const [telefono, setTelefono] = useState("");
  const [distrito, setDistrito] = useState("");
  const [provincia, setProvincia] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [direccionTrujillo, setDireccionTrujillo] = useState("");
  const [datosRuc, setDatosRuc] = useState<DatosRuc | null>(null);
  const [consultandoRuc, setConsultandoRuc] = useState(false);
  const [errorRuc, setErrorRuc] = useState("");
  const [fileName, setFileName] = useState("");
  const [planoBase64, setPlanoBase64] = useState("");
  const [planoEstado, setPlanoEstado] = useState<PlanoEstado>("idle");
  const [planoMotivo, setPlanoMotivo] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const clearErrors = (...fields: string[]) => {
    setFormErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const buscarRuc = async () => {
    if (!/^20\d{9}$/.test(ruc)) {
      setDatosRuc(null);
      setDistrito("");
      setProvincia("");
      setDepartamento("");
      setDireccionTrujillo("");
      setErrorRuc("Ingresa un RUC 20 válido de 11 dígitos.");
      return;
    }

    setConsultandoRuc(true);
    setErrorRuc("");
    try {
      const response = await fetch(`/api/sunat/ruc/${ruc}`);
      const result = (await response.json()) as DatosRuc & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo consultar el RUC.");

      // Validar que el RUC esté activo en la SUNAT
      if (result.estado && result.estado.toUpperCase() !== "ACTIVO") {
        throw new Error(`El RUC ingresado se encuentra INACTIVO en la SUNAT (Estado: ${result.estado}).`);
      }

      // Validar que pertenezca obligatoriamente al distrito de Trujillo
      if (result.distrito && result.distrito.toUpperCase() !== "TRUJILLO") {
        throw new Error("El negocio no se encuentra en el distrito de Trujillo.");
      }

      setDatosRuc({
        razonSocial: result.razonSocial,
        domicilioFiscal: result.domicilioFiscal,
        distrito: result.distrito,
        provincia: result.provincia,
        departamento: result.departamento,
        localesPrevios: result.localesPrevios || [],
      });
      if (result.distrito) setDistrito(result.distrito);
      if (result.provincia) setProvincia(result.provincia);
      if (result.departamento) setDepartamento(result.departamento);
      if (result.domicilioFiscal) setDireccionTrujillo(result.domicilioFiscal);
      clearErrors("ruc", "razonSocial", "domicilioFiscal", "distrito", "provincia", "departamento");
    } catch (error) {
      setDatosRuc(null);
      setDistrito("");
      setProvincia("");
      setDepartamento("");
      setDireccionTrujillo("");
      setErrorRuc(error instanceof Error ? error.message : "No se pudo consultar el RUC.");
    } finally {
      setConsultandoRuc(false);
    }
  };

  const cambiarRuc = (value: string) => {
    setRuc(value.replace(/\D/g, "").slice(0, 11));
    setDatosRuc(null);
    setDistrito("");
    setProvincia("");
    setDepartamento("");
    setErrorRuc("");
    clearErrors("ruc", "razonSocial", "domicilioFiscal", "distrito", "provincia", "departamento");
  };

  const validarPlano = async (file: File) => {
    setPlanoEstado("analizando");
    setPlanoMotivo("");
    try {
      const form = new FormData();
      form.append("archivo", file);
      const response = await fetch("/api/planos/validar", { method: "POST", body: form });
      const result = (await response.json()) as { esPlano?: boolean; motivo?: string; error?: string };

      if (!response.ok || result.error) {
        setPlanoEstado("error");
        setPlanoMotivo(result.error ?? "No se pudo validar la imagen.");
        return;
      }

      setPlanoEstado(result.esPlano ? "valido" : "invalido");
      setPlanoMotivo(result.motivo ?? "");
    } catch {
      setPlanoEstado("error");
      setPlanoMotivo("No se pudo conectar con el servicio de validación. Intenta nuevamente.");
    }
  };

  const procesarArchivo = (file: File) => {
    setFileName(file.name);
    if (!IMAGE_TYPES.has(file.type)) {
      setPlanoEstado("invalido");
      setPlanoMotivo("Formato no permitido. Solo puedes subir imágenes PNG o JPG.");
      return;
    }
    if (file.size < 1024 || file.size > MAX_IMAGE_BYTES) {
      setPlanoEstado("invalido");
      setPlanoMotivo("La imagen debe pesar entre 1 KB y 10 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPlanoBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);

    void validarPlano(file);
  };

  const limpiarPlano = () => {
    setFileName("");
    setPlanoBase64("");
    setPlanoEstado("idle");
    setPlanoMotivo("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const [submitError, setSubmitError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Only require plano validation for INICIAL or RENOVACION with structural changes
    const requierePlano = tipoTramite === "INICIAL" || tieneCambios;
    if (requierePlano && planoEstado !== "valido") return;

    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const result = solicitudTramiteSchema.safeParse(values);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      setFormErrors(Object.fromEntries(Object.entries(fields).map(([field, messages]) => [field, messages?.[0]])));
      if (!datosRuc) setErrorRuc("Consulta el RUC para completar y validar los datos fiscales.");
      return;
    }

    setFormErrors({});
    setSubmitError("");
    setLoading(true);

    try {
      let tramiteId: string;

      if (presencial) {
        // Flujo CAJERO: crear/actualizar negocio por RUC y luego crear trámite con negocioId
        const negocioRes = await fetch("/api/negocios/cajero", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruc: result.data.ruc,
            razonSocial: result.data.razonSocial,
            domicilioFiscal: result.data.domicilioFiscal,
            distrito: result.data.distrito,
            provincia: result.data.provincia,
            departamento: result.data.departamento,
            telefono: result.data.telefono || undefined,
            email: result.data.email || undefined,
          }),
        });

        if (negocioRes.status === 401) {
          setSubmitError("Sesión expirada. Redirigiendo al inicio de sesión...");
          setTimeout(() => router.push("/login"), 1500);
          setLoading(false);
          return;
        }

        if (!negocioRes.ok) {
          const err = (await negocioRes.json()) as { error?: string };
          setSubmitError(err.error ?? "No se pudo registrar el negocio. Inténtalo nuevamente.");
          setLoading(false);
          return;
        }

        const negocio = (await negocioRes.json()) as { id: string };

        const tramiteRes = await fetch("/api/tramites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negocioId: negocio.id,
            direccionTrujillo: (values.direccionTrujillo as string) || result.data.direccionTrujillo || direccionTrujillo || result.data.domicilioFiscal,
            planoValidado: tipoTramite === "INICIAL" || tieneCambios ? true : false,
            planoUrl: planoBase64 || (fileName ? `/uploads/${fileName}` : "/uploads/Plano_Arquitectonico_Validado.pdf"),
            planoNombre: fileName || "Plano_Arquitectonico_Validado.pdf",
            tipoTramite,
            poseeCambiosEstructura: tipoTramite === "RENOVACION" && tieneCambios,
            confirmacionSinCambios: tipoTramite === "RENOVACION" && !tieneCambios
          }),
        });

        if (tramiteRes.status === 401) {
          setSubmitError("Sesión expirada. Redirigiendo al inicio de sesión...");
          setTimeout(() => router.push("/login"), 1500);
          setLoading(false);
          return;
        }

        if (!tramiteRes.ok) {
          const err = (await tramiteRes.json()) as { error?: string };
          setSubmitError(err.error ?? "No se pudo registrar el trámite. Inténtalo nuevamente.");
          setLoading(false);
          return;
        }

        const tramite = (await tramiteRes.json()) as { id: string };
        tramiteId = tramite.id;
        router.push(presencial ? `/cajero/cobro?tramiteId=${tramiteId}` : `/negocio/pago?tramiteId=${tramiteId}`);
      } else {
        // Flujo NEGOCIO: Enviar datos fiscales ingresados por el usuario para actualizar/crear su negocio
        const tramiteRes = await fetch("/api/tramites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planoValidado: tipoTramite === "INICIAL" || tieneCambios ? true : false,
            planoUrl: planoBase64 || (fileName ? `/uploads/${fileName}` : "/uploads/Plano_Arquitectonico_Validado.pdf"),
            planoNombre: fileName || "Plano_Arquitectonico_Validado.pdf",
            ruc: result.data.ruc,
            razonSocial: result.data.razonSocial,
            domicilioFiscal: result.data.domicilioFiscal,
            direccionTrujillo: (values.direccionTrujillo as string) || result.data.direccionTrujillo || direccionTrujillo || result.data.domicilioFiscal,
            distrito: result.data.distrito,
            provincia: result.data.provincia,
            departamento: result.data.departamento,
            telefono: result.data.telefono || undefined,
            email: result.data.email || undefined,
            tipoTramite,
            poseeCambiosEstructura: tipoTramite === "RENOVACION" && tieneCambios,
            confirmacionSinCambios: tipoTramite === "RENOVACION" && !tieneCambios
          }),
        });

        if (tramiteRes.status === 401) {
          setSubmitError("Sesión expirada. Redirigiendo al inicio de sesión...");
          setTimeout(() => router.push("/login"), 1500);
          setLoading(false);
          return;
        }

        if (!tramiteRes.ok) {
          const err = (await tramiteRes.json()) as { error?: string };
          setSubmitError(err.error ?? "No se pudo registrar el trámite. Inténtalo nuevamente.");
          setLoading(false);
          return;
        }

        const tramite = (await tramiteRes.json()) as { id: string };
        tramiteId = tramite.id;
        router.push(`/negocio/pago?tramiteId=${tramiteId}`);
      }
    } catch {
      setSubmitError("Error de conexión. Por favor intenta nuevamente.");
      setLoading(false);
    }
  };

  const input = "focus-ring mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--blue)]";
  const readonlyInput = `${input} cursor-not-allowed bg-slate-50 text-slate-700`;
  const puedeEnviar = (!loading) && (tipoTramite === "INICIAL" || tieneCambios ? planoEstado === "valido" : true);
  const rucMessage = errorRuc || formErrors.ruc;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-5 md:grid-cols-2">
        {/* Selección del tipo de trámite */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold block mb-2">Tipo de Trámite</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setTipoTramite("INICIAL");
                setPlanoEstado("idle");
                setFileName("");
              }}
              className={`h-11 rounded-xl text-xs font-bold border transition ${
                tipoTramite === "INICIAL"
                  ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Primera Licencia (Inicial)
            </button>
            <button
              type="button"
              onClick={() => {
                setTipoTramite("RENOVACION");
                setTieneCambios(false);
                setPlanoEstado("idle");
                setFileName("");
              }}
              className={`h-11 rounded-xl text-xs font-bold border transition ${
                tipoTramite === "RENOVACION"
                  ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Renovación de Licencia
            </button>
          </div>
        </div>

        {tipoTramite === "RENOVACION" && (
          <div className="md:col-span-2 rounded-xl bg-slate-50 p-4 border border-slate-200">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              ¿El establecimiento comercial posee modificaciones estructurales?
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Por ejemplo: ampliación de metros cuadrados, aumento de niveles/pisos, cambios de distribución interna.
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tieneCambios"
                  checked={tieneCambios === false}
                  onChange={() => {
                    setTieneCambios(false);
                    setPlanoEstado("idle");
                    setFileName("");
                  }}
                  className="h-4 w-4 text-blue-600"
                />
                No, se mantiene igual (No requiere planos)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tieneCambios"
                  checked={tieneCambios === true}
                  onChange={() => {
                    setTieneCambios(true);
                    setPlanoEstado("idle");
                    setFileName("");
                  }}
                  className="h-4 w-4 text-blue-600"
                />
                Sí, tiene cambios (Requiere nuevo plano)
              </label>
            </div>
          </div>
        )}
        <label className="text-sm font-medium">
          RUC <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <span className="mt-2 flex">
            <input
              className="focus-ring h-12 min-w-0 flex-1 rounded-l-xl border border-r-0 border-[var(--border)] bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--blue)]"
              name="ruc"
              value={ruc}
              onChange={(event) => cambiarRuc(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void buscarRuc();
                }
              }}
              inputMode="numeric"
              pattern="20[0-9]{9}"
              maxLength={11}
              placeholder="20123456789"
              required
              aria-invalid={Boolean(rucMessage)}
              aria-describedby={rucMessage ? "ruc-error" : undefined}
            />
            <button
              type="button"
              onClick={() => void buscarRuc()}
              disabled={consultandoRuc || ruc.length !== 11}
              aria-label="Consultar RUC"
              className="focus-ring grid h-12 w-13 shrink-0 place-items-center rounded-r-xl border border-[var(--blue)] bg-[var(--blue)] text-white transition-colors hover:bg-[var(--blue-hover)] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              {consultandoRuc ? <LoaderCircle className="animate-spin" size={19} /> : <Search size={19} />}
            </button>
          </span>
          {rucMessage ? <span id="ruc-error" className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{rucMessage}</span> : null}
        </label>

        <label className="text-sm font-medium">
          Razón Social <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input className={readonlyInput} name="razonSocial" value={datosRuc?.razonSocial ?? ""} placeholder="Se completa al consultar el RUC" readOnly aria-readonly="true" required aria-invalid={Boolean(formErrors.razonSocial)} />
          {formErrors.razonSocial ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.razonSocial}</span> : null}
        </label>

        <label className="text-sm font-medium md:col-span-2">
          Domicilio Fiscal <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input className={readonlyInput} name="domicilioFiscal" value={datosRuc?.domicilioFiscal ?? ""} placeholder="Se completa al consultar el RUC" readOnly aria-readonly="true" required aria-invalid={Boolean(formErrors.domicilioFiscal)} />
          {formErrors.domicilioFiscal ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.domicilioFiscal}</span> : null}
        </label>

        {datosRuc ? (
          <div className="md:col-span-2 space-y-3">
            <p className="-mt-1 flex items-center gap-2 text-sm text-emerald-700 font-medium" role="status">
              <CheckCircle2 size={17} /> Datos fiscales SUNAT encontrados correctamente.
            </p>

            {datosRuc.localesPrevios && datosRuc.localesPrevios.length > 0 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-slate-700">
                <p className="font-bold text-blue-900 flex items-center gap-1.5 mb-2 text-sm">
                  🏢 Establecimientos / Sucursales Registradas de este RUC ({datosRuc.localesPrevios.length})
                </p>
                <p className="text-slate-600 mb-3">
                  Un mismo RUC puede poseer múltiples locales comerciales independientes en Trujillo. A continuación se muestran los trámites y locales existentes de esta empresa:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {datosRuc.localesPrevios.map((loc) => (
                    <div key={loc.id} className="rounded-lg bg-white p-2.5 border border-blue-100 shadow-2xs">
                      <span className="font-bold text-blue-800 block">{loc.codigo}</span>
                      <span className="text-slate-600 font-mono block truncate" title={loc.direccion}>{loc.direccion}</span>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-500">Estado: {loc.estado}</span>
                        {loc.licencia ? <span className="font-bold text-emerald-700">Lic. #{loc.licencia}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <label className="text-sm font-medium md:col-span-2">
          Dirección del Local a Licenciar (Sucursal) <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input
            className={input}
            name="direccionTrujillo"
            value={direccionTrujillo}
            onChange={(e) => {
              setDireccionTrujillo(e.target.value);
              clearErrors("direccionTrujillo");
            }}
            placeholder="Ej: Jr. Pizarro 450, Av. España 1200..."
            required
            aria-invalid={Boolean(formErrors.direccionTrujillo)}
          />
          {formErrors.direccionTrujillo ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.direccionTrujillo}</span> : null}
          <span className="mt-1 block text-xs text-slate-500 font-normal">
            Especifica la dirección del nuevo establecimiento comercial o sucursal a licenciar en Trujillo.
          </span>
        </label>

        <label className="text-sm font-medium">
          Distrito <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input
            className={readonlyInput}
            name="distrito"
            value={distrito}
            required
            readOnly
            tabIndex={-1}
            placeholder="Se completa al consultar el RUC"
            aria-invalid={Boolean(formErrors.distrito)}
          />
          {formErrors.distrito ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.distrito}</span> : null}
        </label>

        <label className="text-sm font-medium">
          Provincia <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input
            className={readonlyInput}
            name="provincia"
            value={provincia}
            required
            readOnly
            tabIndex={-1}
            placeholder="Se completa al consultar el RUC"
            aria-invalid={Boolean(formErrors.provincia)}
          />
          {formErrors.provincia ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.provincia}</span> : null}
        </label>

        <label className="text-sm font-medium">
          Departamento <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input
            className={readonlyInput}
            name="departamento"
            value={departamento}
            required
            readOnly
            tabIndex={-1}
            placeholder="Se completa al consultar el RUC"
            aria-invalid={Boolean(formErrors.departamento)}
          />
          {formErrors.departamento ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.departamento}</span> : null}
        </label>
        <label className="text-sm font-medium">
          Celular <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input
            className={input}
            name="telefono"
            value={telefono}
            inputMode="numeric"
            pattern="9[0-9]{8}"
            maxLength={9}
            placeholder="987654321"
            required
            aria-invalid={Boolean(formErrors.telefono)}
            onChange={(event) => {
              setTelefono(event.target.value.replace(/\D/g, "").slice(0, 9));
              clearErrors("telefono");
            }}
          />
          {formErrors.telefono ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.telefono}</span> : null}
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Correo electrónico <span className="text-[var(--danger)]" aria-hidden="true">*</span>
          <input className={input} name="email" type="email" placeholder="contacto@negocio.pe" required aria-invalid={Boolean(formErrors.email)} onChange={() => clearErrors("email")} />
          {formErrors.email ? <span className="mt-1.5 block text-xs text-[var(--danger)]" role="alert">{formErrors.email}</span> : null}
        </label>
      </div>

      {(tipoTramite === "INICIAL" || tieneCambios) && (
        <div className="mt-7 border-t border-[var(--border)] pt-6">
          <h3 className="font-bold">Plano del local</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Adjunta un plano arquitectónico legible en PNG o JPG. El sistema verificará su contenido antes de habilitar el pago.
          </p>

          {planoEstado === "idle" ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file) procesarArchivo(file);
              }}
              className={`focus-ring mt-4 flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm font-semibold transition select-none ${dragOver ? "border-[var(--blue)] bg-blue-100" : "border-blue-300 bg-blue-50/40 text-[var(--blue)] hover:bg-blue-50"}`}
            >
              <UploadCloud size={28} strokeWidth={1.6} />
              <span>{dragOver ? "Suelta la imagen aquí" : "Haz clic o arrastra el plano del local aquí"}</span>
              <span className="text-xs font-normal text-[var(--muted)]">Solo PNG o JPG — máx. 10 MB</span>
            </div>
          ) : null}

          {planoEstado === "analizando" ? (
            <div className="mt-4 flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4" role="status">
              <LoaderCircle size={28} className="animate-spin text-amber-500" />
              <p className="text-sm font-semibold text-amber-700">Analizando el contenido del plano…</p>
              <p className="text-xs text-amber-600">{fileName}</p>
            </div>
          ) : null}

          {planoEstado === "valido" ? (
            <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4" role="status">
              <div className="flex items-start gap-3">
                <ShieldCheck size={22} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-emerald-700">Plano validado correctamente</p>
                  <p className="mt-0.5 truncate text-xs text-emerald-600">{fileName}</p>
                  <p className="mt-1.5 text-xs leading-5 text-emerald-700/80">{planoMotivo}</p>
                </div>
                <button type="button" onClick={limpiarPlano} className="rounded-lg p-1 text-emerald-500 hover:bg-emerald-100" aria-label="Quitar archivo"><X size={16} /></button>
              </div>
            </div>
          ) : null}

          {planoEstado === "invalido" || planoEstado === "error" ? (
            <div className={`mt-4 rounded-xl border-2 p-4 ${planoEstado === "invalido" ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`} role="alert">
              <div className="flex items-start gap-3">
                <AlertCircle size={22} className={`mt-0.5 shrink-0 ${planoEstado === "invalido" ? "text-red-500" : "text-orange-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${planoEstado === "invalido" ? "text-red-700" : "text-orange-700"}`}>
                    {planoEstado === "invalido" ? "El archivo no es un plano válido" : "Error al validar el archivo"}
                  </p>
                  <p className={`mt-1 text-xs leading-5 ${planoEstado === "invalido" ? "text-red-600" : "text-orange-600"}`}>{planoMotivo}</p>
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-current bg-white px-3 py-1.5 text-xs font-semibold">
                    <UploadCloud size={14} /> Subir otra imagen
                  </button>
                </div>
                <button type="button" onClick={limpiarPlano} className="rounded-lg p-1 text-slate-500 hover:bg-white" aria-label="Quitar archivo"><X size={16} /></button>
              </div>
            </div>
          ) : null}

          <input
            ref={fileRef}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) procesarArchivo(file);
            }}
            className="hidden"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          />
        </div>
      )}

      {submitError ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col items-stretch justify-between gap-4 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff8df] text-[#9b7000]"><FileImage size={21} /></span>
          <div><p className="text-xs text-[var(--muted)]">Derecho de trámite</p><p className="text-xl font-bold">S/180.00</p></div>
        </div>
        <button
          disabled={!puedeEnviar}
          title={planoEstado !== "valido" ? "Debes subir un plano válido para continuar" : undefined}
          className="focus-ring flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--blue)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--blue-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : null}
          {presencial ? "Registrar y continuar al pago" : "Continuar al pago"}
        </button>
      </div>
    </form>
  );
}
