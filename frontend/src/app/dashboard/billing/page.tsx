import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function DashboardBillingPage() {
  const template = loadLegacyTemplate("dashboard");

  return (
    <LegacyPage
      pageKey="dashboard-billing"
      {...template}
      extraScript={`
window.setTimeout(() => {
  const navItem = document.querySelectorAll('.nav-item')[6];
  if (typeof window.showPage === 'function') {
    window.showPage('credits', navItem);
  }
}, 100);
`}
    />
  );
}
