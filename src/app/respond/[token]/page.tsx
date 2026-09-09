import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ResponseForm } from "./ResponseForm";

export default async function RespondPage({
  params,
}: PageProps<"/respond/[token]">) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      supplier: true,
      rfp: {
        include: {
          items: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" } },
        },
      },
      response: {
        include: { answers: true, itemPrices: true },
      },
    },
  });

  if (!invitation) notFound();

  const isPublished = invitation.rfp.status === "OPEN" || invitation.rfp.status === "CLOSED";

  if (invitation.status === "INVITED" && isPublished) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  const { rfp, supplier, response } = invitation;
  const isClosed = rfp.status === "CLOSED";
  const isNotYetPublished = !isPublished;
  // Internal / buyer-answered questions are never sent to the supplier —
  // filter them out before anything reaches the client, not just at render
  // time.
  const supplierQuestions = rfp.questions.filter(
    (q) => q.visibility !== "INTERNAL" && q.respondedBy !== "BUYER",
  );
  // Buyer-only item fields (weight, decimals precision aside, historicalPrice,
  // commodity, locked, ...) must not reach the supplier's browser — strip
  // them here, not just at render time, same discipline as supplierQuestions.
  const supplierItems = rfp.items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    decimals: item.decimals,
    customFields: item.customFields,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
          Invitación a cotizar
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {rfp.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{rfp.description}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>Comprador: {rfp.buyerName}</span>
          <span>Fecha límite: {formatDate(rfp.deadlineAt)}</span>
          <span>
            Proveedor: {supplier.name} ({supplier.company})
          </span>
          {rfp.commodity && <span>Commodity: {rfp.commodity}</span>}
          {rfp.region && <span>Región: {rfp.region}</span>}
          {rfp.startDate && (
            <span>Inicio estimado: {formatDate(rfp.startDate)}</span>
          )}
        </div>
      </div>

      {response ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-base font-semibold text-emerald-800">
            ¡Gracias! Tu cotización fue enviada el{" "}
            {formatDateTime(response.submittedAt)}.
          </h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-emerald-100 bg-white">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Artículo</th>
                  <th className="px-4 py-2">Precio unitario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfp.items.map((item) => {
                  const price = response.itemPrices.find(
                    (p) => p.itemId === item.id,
                  );
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2">
                        {price ? formatCurrency(price.unitPrice) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {supplierQuestions.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {supplierQuestions.map((q) => {
                const answer = response.answers.find(
                  (a) => a.questionId === q.id,
                );
                if (!answer) return null;
                if (q.type === "ATTACHMENT") {
                  const [href, filename] = answer.value.split("|");
                  return (
                    <div key={q.id}>
                      <p className="font-medium">{q.text}</p>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 underline hover:text-violet-700"
                      >
                        {filename ?? "Ver archivo"}
                      </a>
                    </div>
                  );
                }
                return (
                  <div key={q.id}>
                    <p className="font-medium">{q.text}</p>
                    <p className="text-slate-500">
                      {q.type === "MONEY"
                        ? formatCurrency(Number(answer.value))
                        : answer.value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isNotYetPublished ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Esta RFP todavía no fue publicada por el comprador. Vuelve a
          revisar este link más adelante.
        </div>
      ) : isClosed ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Esta RFP ya fue cerrada por el comprador y ya no acepta nuevas
          cotizaciones.
        </div>
      ) : (
        <ResponseForm
          token={token}
          items={supplierItems}
          questions={supplierQuestions}
          rfpCommodity={rfp.commodity}
          rfpRegion={rfp.region}
        />
      )}
    </div>
  );
}
