import { getSession } from "@/lib/auth";
import InviteAccept from "@/components/InviteAccept";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  return <InviteAccept token={token} loggedIn={!!session} />;
}
