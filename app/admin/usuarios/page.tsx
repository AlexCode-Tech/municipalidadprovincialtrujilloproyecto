"use client";

import { useEffect, useState, useTransition } from "react";
import { PageHeading } from "@/components/layout/DashboardShell";
import { AlertCircle, CheckCircle2, CreditCard, Eye, EyeOff, LoaderCircle, Pencil, ShieldCheck, Store, UserPlus, Users, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: "CAJERO" | "INSPECTOR";
  estado: "ACTIVO" | "INACTIVO";
  creadoEn: string;
};

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [cajaAbiertaPrompt, setCajaAbiertaPrompt] = useState<{ user: Usuario; mensaje: string } | null>(null);
  
  // Registration Form State
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [rol, setRol] = useState<"CAJERO" | "INSPECTOR">("CAJERO");

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRol, setEditRol] = useState<"CAJERO" | "INSPECTOR">("CAJERO");
  const [editPassword, setEditPassword] = useState("");
  const [editRepetirPassword, setEditRepetirPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditRepetirPassword, setShowEditRepetirPassword] = useState(false);
  const [modalError, setModalError] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const cargarUsuarios = async () => {
    try {
      const res = await fetch(`/api/usuarios?t=${Date.now()}`);
      if (res.ok) {
        const body = await res.json();
        setUsuarios(body);
      }
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarUsuarios();
    const interval = setInterval(() => {
      void cargarUsuarios();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCrearUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!nombre.trim() || !email.trim() || password.length < 6) {
      setErrorMsg("Completa todos los campos correctamente (Contraseña mín. 6 caracteres).");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, password, rol }),
        });
        const body = await res.json();
        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo registrar el usuario.");
        } else {
          setSuccessMsg(`Usuario ${nombre} registrado con éxito.`);
          setNombre("");
          setEmail("");
          setPassword("");
          void cargarUsuarios();
        }
      } catch (err) {
        setErrorMsg("Error de conexión al registrar usuario.");
      }
    });
  };

  const handleOpenEditModal = (u: Usuario) => {
    setEditingUser(u);
    setEditNombre(u.nombre);
    setEditEmail(u.email);
    setEditRol(u.rol);
    setEditPassword("");
    setEditRepetirPassword("");
    setShowEditPassword(false);
    setShowEditRepetirPassword(false);
    setModalError("");
  };

  const handleGuardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");
    setErrorMsg("");
    setSuccessMsg("");

    if (!editingUser) return;

    if (!editNombre.trim() || !editEmail.trim()) {
      setModalError("Nombre y correo electrónico son obligatorios.");
      return;
    }

    if (editPassword || editRepetirPassword) {
      if (editPassword.length < 6) {
        setModalError("La nueva contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (editPassword !== editRepetirPassword) {
        setModalError("Las contraseñas ingresadas no coinciden.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/usuarios/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: editNombre.trim(),
            email: editEmail.trim(),
            rol: editRol,
            password: editPassword ? editPassword.trim() : undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setModalError(body.error ?? "No se pudieron actualizar los datos del usuario.");
        } else {
          setSuccessMsg(`Datos de ${editNombre} actualizados correctamente.`);
          setEditingUser(null);
          void cargarUsuarios();
        }
      } catch (err) {
        setModalError("Error de red al actualizar usuario.");
      }
    });
  };

  const toggleEstado = (user: Usuario, cerrarCaja: boolean = false) => {
    if ((user.rol as string) === "ADMIN") {
      setErrorMsg("No se puede desactivar la cuenta del administrador.");
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    const nuevoEstado = user.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    startTransition(async () => {
      try {
        const res = await fetch(`/api/usuarios/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado: nuevoEstado, cerrarCaja }),
        });
        const body = await res.json();

        if (body.requiereConfirmacionCierreCaja) {
          setCajaAbiertaPrompt({ user, mensaje: body.mensaje });
          return;
        }

        if (!res.ok) {
          setErrorMsg(body.error ?? "No se pudo cambiar el estado del usuario.");
        } else {
          setCajaAbiertaPrompt(null);
          if (body.cajaCerrada) {
            setSuccessMsg(`Caja cerrada correctamente y cuenta de ${user.nombre} desactivada.`);
          } else {
            setSuccessMsg(`Estado de ${user.nombre} actualizado a ${nuevoEstado}.`);
          }
          void cargarUsuarios();
        }
      } catch (err) {
        setErrorMsg("Error de red al actualizar estado.");
      }
    });
  };

  const countActivos = () => usuarios.filter(u => u.estado === "ACTIVO").length;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Gestión de Usuarios"
        description="Registra cajeros e inspectores técnicos y gestiona sus datos y estado activo/inactivo."
      />

      {errorMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 animate-in fade-in" role="alert">
          <AlertCircle className="shrink-0 text-red-500" size={20} />
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="mb-6 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 animate-in fade-in" role="status">
          <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}

      <div className="grid gap-7 lg:grid-cols-[1.3fr_1fr]">
        {/* Tabla de Usuarios */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h3 className="text-base font-bold text-[var(--navy)] flex items-center gap-2">
              <Users size={18} className="text-[var(--blue)]" />
              Cuentas Registradas
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {countActivos()} activas / {usuarios.length} total
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
              <LoaderCircle className="animate-spin text-[var(--blue)]" size={32} />
              <p className="mt-3 text-sm font-medium">Cargando personal municipal...</p>
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--muted)]">
              <p className="text-sm">No hay cajeros ni inspectores registrados aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{u.nombre}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                          u.rol === "CAJERO" ? "bg-blue-50 text-blue-700" :
                          u.rol === "INSPECTOR" ? "bg-purple-50 text-purple-700" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {u.rol === "CAJERO" ? <CreditCard size={11} /> : <ShieldCheck size={11} />}
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge>
                          {u.estado === "ACTIVO" ? "Cuenta Activada" : "Cuenta Desactivada"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            disabled={pending}
                            className="inline-flex items-center gap-1 justify-center h-8 px-3 rounded-lg text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Pencil size={13} />
                            Editar
                          </button>

                          <button
                            onClick={() => toggleEstado(u)}
                            disabled={pending}
                            title={u.estado === "ACTIVO" ? "Hacer clic para desactivar cuenta" : "Hacer clic para activar cuenta"}
                            className={`inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-bold transition border ${
                              u.estado === "ACTIVO"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700"
                            }`}
                          >
                            {u.estado === "ACTIVO" ? "Cuenta Activada" : "Cuenta Desactivada"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulario de Registro */}
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[var(--navy)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <UserPlus size={18} className="text-[var(--blue)]" />
            Registrar Nuevo Personal
          </h3>

          <form onSubmit={handleCrearUsuario} className="mt-5 space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-semibold">Nombre Completo</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--blue)] bg-slate-50/50"
                placeholder="Juan Pérez"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm outline-none focus:border-[var(--blue)] bg-slate-50/50"
                placeholder="contacto@demo.pe"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold">Contraseña</label>
              <div className="relative">
                <input
                  type={showCreatePassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] pl-3 pr-10 text-sm outline-none focus:border-[var(--blue)] bg-slate-50/50"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">Rol Asignado</label>
              <div className="grid grid-cols-1">
                <div className="flex h-11 items-center justify-center rounded-xl text-xs font-bold border bg-blue-50 border-blue-500 text-blue-700 select-none">
                  Cajero
                </div>
              </div>
            </div>

            <button
              disabled={pending}
              className="focus-ring mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white shadow-sm transition disabled:opacity-55"
            >
              {pending && <LoaderCircle className="animate-spin" size={16} />}
              Crear Cuenta
            </button>
          </form>
        </div>
      </div>

      {/* Modal de Edición de Usuario */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                Editar Usuario — {editingUser.nombre}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="shrink-0 text-red-500" size={16} />
                <p className="font-medium">{modalError}</p>
              </div>
            )}

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nombre Completo *</label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Correo electrónico *</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Rol Asignado</label>
                <div className="flex h-10 items-center justify-center rounded-xl text-xs font-bold border bg-blue-50 border-blue-500 text-blue-700 select-none">
                  {editRol === "CAJERO" ? "Cajero" : "Inspector Técnico"}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Nueva Contraseña (Opcional)</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 pl-3 pr-10 text-xs outline-none focus:border-blue-600"
                    placeholder="Dejar en blanco para mantener la actual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Repetir Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showEditRepetirPassword ? "text" : "password"}
                    value={editRepetirPassword}
                    onChange={(e) => setEditRepetirPassword(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-300 pl-3 pr-10 text-xs outline-none focus:border-blue-600"
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditRepetirPassword(!showEditRepetirPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditRepetirPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  disabled={pending}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 text-xs font-bold text-white shadow-sm transition disabled:opacity-55"
                >
                  {pending && <LoaderCircle className="animate-spin" size={14} />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Caja Abierta al Desactivar Cajero */}
      {cajaAbiertaPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
              <Store size={30} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">¿Desea cerrar caja?</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                El cajero <strong className="text-slate-900">{cajaAbiertaPrompt.user.nombre}</strong> tiene una caja abierta actualmente.
                <br />
                ¿Deseas cerrar su sesión de caja automáticamente y desactivar su cuenta?
              </p>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setCajaAbiertaPrompt(null)}
                disabled={pending}
                className="flex-1 h-11 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => toggleEstado(cajaAbiertaPrompt.user, true)}
                disabled={pending}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
              >
                {pending && <LoaderCircle className="animate-spin" size={16} />}
                Sí, cerrar caja y desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
