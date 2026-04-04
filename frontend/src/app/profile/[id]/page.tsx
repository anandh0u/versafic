import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = loadLegacyTemplate("profile", { profileId: id });
  return <LegacyPage pageKey={`profile-${id}`} {...template} />;
}
