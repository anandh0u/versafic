import { LegacyPage } from "@/components/legacy/legacy-page";
import { loadLegacyTemplate } from "@/lib/legacy-template";

export default function DashboardCallsPage() {
  const template = loadLegacyTemplate("dashboard");

  return (
    <LegacyPage
      pageKey="dashboard-calls"
      {...template}
      extraScript={`
window.setTimeout(() => {
  const navItem = document.querySelectorAll('.nav-item')[1];
  if (typeof window.showPage === 'function') {
    window.showPage('calls', navItem);
  }
}, 100);
`}
    />
  );
}
