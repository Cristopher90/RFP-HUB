import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireMasterDataScope } from "@/lib/masterDataScope";
import { AdminClientSwitcher } from "@/components/AdminClientSwitcher";
import { getDictionary } from "@/i18n/getDictionary";
import { ASSISTANT_MODELS } from "@/lib/assistant/access";
import { AssistantSettingsForm } from "./AssistantSettingsForm";

export default async function AssistantSettingsPage({ searchParams }: PageProps<"/admin/assistant">) {
  const sp = await searchParams;
  const { scope, clients, effectiveClientId } = await requireMasterDataScope(sp);
  const dictionary = getDictionary(scope.user.language);
  const d = dictionary.assistantSettings;

  const client = effectiveClientId
    ? await prisma.client.findUnique({
        where: { id: effectiveClientId },
        select: { assistantEnabled: true, assistantApiKeyEnc: true, assistantApiKeyLast4: true, assistantModel: true },
      })
    : null;
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const usage = effectiveClientId
    ? await prisma.assistantLog.aggregate({
        where: { clientId: effectiveClientId, createdAt: { gt: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
      })
    : null;
  const enabledUsers = effectiveClientId
    ? await prisma.user.count({ where: { clientId: effectiveClientId, canUseAssistant: true } })
    : 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      {scope.isSuperAdmin && (
        <div className="mt-6">
          <AdminClientSwitcher clients={clients} />
        </div>
      )}
      {effectiveClientId && client ? (
        <div className="mt-8">
          <AssistantSettingsForm
            key={effectiveClientId}
            targetClientId={effectiveClientId}
            initial={{
              enabled: client.assistantEnabled,
              model: client.assistantModel,
              hasKey: Boolean(client.assistantApiKeyEnc),
              last4: client.assistantApiKeyLast4,
            }}
            models={ASSISTANT_MODELS.map((m) => ({ id: m.id, label: m.label, note: m.note }))}
            usage={{
              questions: usage?._count._all ?? 0,
              inputTokens: usage?._sum.inputTokens ?? 0,
              outputTokens: usage?._sum.outputTokens ?? 0,
              users: enabledUsers,
            }}
          />
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-500">{d.selectClient}</p>
      )}
    </div>
  );
}
