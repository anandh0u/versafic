import DashboardPageClient from './dashboard-page-client';

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const dashboardSections = [
  'overview',
  'calls',
  'chats',
  'bookings',
  'customers',
  'analytics',
  'credits',
  'agent',
] as const;

const normalizeLegacyTab = (value?: string | null) => {
  if (!value) {
    return 'overview';
  }

  if (value === 'billing') {
    return 'credits';
  }

  return value;
};

const normalizeDashboardSection = (value?: string | null) => {
  if (value && dashboardSections.includes(value as (typeof dashboardSections)[number])) {
    return value as (typeof dashboardSections)[number];
  }

  return 'overview';
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawTab = resolvedSearchParams?.tab;
  const tab = Array.isArray(rawTab) ? rawTab[0] : rawTab;

  return (
    <DashboardPageClient initialPageId={normalizeDashboardSection(normalizeLegacyTab(tab))} />
  );
}
