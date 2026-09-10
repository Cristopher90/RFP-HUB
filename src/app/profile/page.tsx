import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { ProfileForm } from "./ProfileForm";

// Common ISO 4217 currencies covering this app's known clients/suppliers
// (Mexico, Spain, US, Argentina, Brazil, UK) — a small curated list is
// proportionate here, unlike timezones which use the full IANA set below.
const CURRENCIES = ["USD", "MXN", "EUR", "ARS", "BRL", "GBP"];

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
