import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assistantAccess } from "@/lib/assistant/access";
import { getDictionary } from "@/i18n/getDictionary";
import { AssistantChat } from "./AssistantChat";

// Available only to users marked for it, in clients that turned it on.
export default async function AssistantPage() {
  const user = await requireUser();
  const access = await assistantAccess(user);
  if (!access) redirect("/home");
  const d = getDictionary(user.language).assistantPage;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>
      <div className="mt-6">
        <AssistantChat currency={access.client.currency} />
      </div>
    </div>
  );
}
