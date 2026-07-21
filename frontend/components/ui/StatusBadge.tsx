const styles: Record<string, string> = {
  "En revisión": "bg-amber-50 text-amber-800 ring-amber-200",
  "Inspección programada": "bg-blue-50 text-blue-800 ring-blue-200",
  "Aprobado": "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Observado": "bg-orange-50 text-orange-800 ring-orange-200",
  "Pendiente": "bg-slate-100 text-slate-700 ring-slate-200",
  "Vencida": "bg-red-600 text-white ring-red-700 shadow-sm",
  "Vencido": "bg-red-600 text-white ring-red-700 shadow-sm",
};

export function StatusBadge({ children }: { children: string }) {
  const isVencido = children.startsWith("Vencid");
  const isObservado = children.startsWith("Observado");
  const isProgramada = children.startsWith("Inspección programada");

  let colorStyle = styles[children] ?? styles.Pendiente;
  if (isObservado) colorStyle = styles["Observado"];
  if (isProgramada) colorStyle = styles["Inspección programada"];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${colorStyle} ${
        isVencido ? "bg-red-600 text-white ring-red-700 uppercase tracking-wider shadow-md animate-pulse" : ""
      }`}
    >
      {children}
    </span>
  );
}

