import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function LoginPage() {
  const template = loadLegacyTemplate("index");

  return (
    <LegacyPage
      pageKey="login"
      {...template}
      extraScript={`
window.setTimeout(() => {
  if (typeof window.openLogin === 'function') {
    window.openLogin();
  }
}, 80);
`}
    />
  );
}
