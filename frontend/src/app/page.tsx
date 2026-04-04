import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function HomePage() {
  const template = loadLegacyTemplate("index");
  return <LegacyPage pageKey="home" {...template} />;
}
