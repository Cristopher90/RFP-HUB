import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { CURRENCIES } from "@/lib/profileOptions";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  const supplierUser = user ? null : await getCurrentSupplierUser();
  const activeSession = user ?? supplierUser;
  if (!activeSession) redirect("/login");

  const dictionary = getDictionary(activeSession.language);
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{dictionary.profile.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dictionary.profile.subtitle}</p>

      <div className="mt-6">
        <ProfileForm
          initial={{
            language: activeSession.language,
            timezone: activeSession.timezone,
            currency: activeSession.currency,
          }}
          timezones={timezones}
          currencies={CURRENCIES}
        />
      </div>
    </div>
  );
}
