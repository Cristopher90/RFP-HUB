const STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_PUBLISH_APPROVAL: "bg-amber-100 text-amber-700",
  AWAITING_START: "bg-blue-100 text-blue-700",
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-500",
  DELETED: "bg-red-100 text-red-600",
  INVITED: "bg-amber-100 text-amber-700",
  VIEWED: "bg-blue-100 text-blue-700",
  RESPONDED: "bg-emerald-100 text-emerald-700",
};

const LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_PUBLISH_APPROVAL: "Pendiente de aprobación",
  AWAITING_START: "Aguardando inicio",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
  DELETED: "Eliminada",
  INVITED: "Invitado",
  VIEWED: "Visto",
  RESPONDED: "Respondido",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
