import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function OnboardingPage() {
  const template = loadLegacyTemplate("onboarding");
  return <LegacyPage pageKey="onboarding" {...template} />;
}
