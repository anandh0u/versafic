"use client";

import Script from "next/script";
import { LegacyBindings } from "@/components/legacy/legacy-bindings";

type LegacyPageProps = {
  pageKey: string;
  markup: string;
  styles: string;
  script: string;
  extraScript?: string;
};

export const LegacyPage = ({
  pageKey,
  markup,
  styles,
  script,
  extraScript,
}: LegacyPageProps) => {
  const bootstrapScript = `
${script}
window.setTimeout(() => {
  try {
    if (typeof window.onload === 'function') {
      window.onload();
    }
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  } catch (error) {
    console.error('Legacy page bootstrap error', error);
  }
}, 0);
`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="legacy-root" dangerouslySetInnerHTML={{ __html: markup }} />
      {script ? (
        <Script id={`legacy-script-${pageKey}`} strategy="afterInteractive">
          {bootstrapScript}
        </Script>
      ) : null}
      {extraScript ? (
        <Script id={`legacy-extra-${pageKey}`} strategy="afterInteractive">
          {extraScript}
        </Script>
      ) : null}
      <LegacyBindings pageKey={pageKey} />
    </>
  );
};
