import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function DashboardPage() {
  const template = loadLegacyTemplate("dashboard");
  return <LegacyPage pageKey="dashboard" {...template} />;
}
