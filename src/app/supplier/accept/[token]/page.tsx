import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getViewerPreferences } from "@/lib/preferences";
import { getDictionary } from "@/i18n/getDictionary";
import { AcceptForm } from "./AcceptForm";

// Public page reached from the invitation email.
export default async function AcceptInvitationPage({ params }: PageProps<"/supplier/accept/[token]">) {
  const { token } = await params;
  const dictionary = getDictionary((await getViewerPreferences()).language);
  const t = dictionary.supplierAccept;

  const link = await prisma.supplierUserLink.findUnique({
    where: { inviteToken: token },
    include: { supplierUser: true, supplierDirectory: true, client: true },
  });

  let content: React.ReactNode;
  if (!link) {
    content = <p className="mt-4 text-sm text-slate-600">{t.invalid}</p>;
  } else if (link.status === "ACCEPTED") {
    content = (
      <>
        <p className="mt-4 text-sm text-slate-600">{t.alreadyAccepted}</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
          {t.goToLogin}
        </Link>
      </>
    );
  } else if (link.status === "PENDING_APPROVAL") {
    content = <p className="mt-4 text-sm text-slate-600">{t.pendingApproval}</p>;
  } else {
    const hasPassword = Boolean(link.supplierUser.passwordHash);
    content = (
      <>
        <p className="mt-4 text-sm text-slate-600">
          {(hasPassword ? t.existingIntro : t.newIntro)
            .replace("{name}", link.supplierUser.name)
            .replace("{client}", link.client.description)
            .replace("{company}", link.supplierDirectory.companyName)}
        </p>
        <AcceptForm token={token} hasPassword={hasPassword} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t.title}</h1>
      {content}
    </div>
  );
}
