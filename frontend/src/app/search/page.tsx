import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function SearchPage() {
  const template = loadLegacyTemplate("search");
  return <LegacyPage pageKey="search" {...template} />;
}
