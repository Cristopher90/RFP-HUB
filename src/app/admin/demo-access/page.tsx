import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { appEnv } from "@/lib/appEnv";
import { demoAccessEnabled } from "@/lib/appSettings";
import { DemoAccessToggle } from "./DemoAccessToggle";

// Super Administrador only: switch the password-less demo shortcut of the
// login page. In production it is always off and cannot be changed.
export default async function DemoAccessPage() {
  const scope = await requireClientScope();
  if (!scope.isSuperAdmin) redirect("/");
  const d = getDictionary(scope.user.language).demoAccessPage;
  const env = appEnv();
  const enabled = await demoAccessEnabled();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
        {d.backToSettings}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle}</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-slate-600">
          {d.environment}: <strong>{d[`env_${env}`]}</strong>
        </p>
        {env === "production" ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-medium text-slate-800">{d.stateOff}</p>
            <p className="mt-1 text-xs text-slate-500">{d.lockedInProduction}</p>
          </div>
        ) : (
          <DemoAccessToggle initialEnabled={enabled} />
        )}
      </div>
    </div>
  );
}
