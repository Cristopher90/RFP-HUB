import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { getDictionary } from "@/i18n/getDictionary";
import { CURRENCIES } from "@/lib/profileOptions";
import { DEFAULT_GLASS_BACKGROUND, isGlassBackground, isUiStyle, normalizeGlass } from "@/lib/themes";
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
            theme: activeSession.theme,
            colorMode: activeSession.colorMode,
            uiStyle: user?.role === "ADMIN" && isUiStyle(user.uiStyle) ? user.uiStyle : "standard",
            uiGlass: user ? normalizeGlass(user.uiGlass) : undefined,
            uiBackground: user && isGlassBackground(user.uiBackground) ? user.uiBackground : DEFAULT_GLASS_BACKGROUND,
          }}
          canChooseUiStyle={user?.role === "ADMIN"}
          timezones={timezones}
          currencies={CURRENCIES}
        />
      </div>
    </div>
  );
}
