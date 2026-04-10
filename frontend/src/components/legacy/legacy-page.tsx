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

const LEGACY_ICON_STYLES = `
.vf-icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  vertical-align: -0.14em;
  color: currentColor;
}

.vf-icon--sm {
  width: 0.95em;
  height: 0.95em;
}

.vf-icon--lg {
  width: 1.15em;
  height: 1.15em;
}

.vf-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
`;

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
    window.__versaficRefreshIcons?.();
  } catch (error) {
    console.error('Legacy page bootstrap error', error);
  }
}, 0);
`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${styles}\n${LEGACY_ICON_STYLES}` }} />
      <div className="legacy-root" dangerouslySetInnerHTML={{ __html: markup }} />
      <Script id={`legacy-icon-runtime-${pageKey}`} strategy="afterInteractive">
        {`
window.__versaficRefreshIcons = function() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error('Legacy icon refresh error', error);
  }
};
`}
      </Script>
      <Script
        src="https://unpkg.com/lucide@latest"
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== "undefined") {
            (window as typeof window & { __versaficRefreshIcons?: () => void }).__versaficRefreshIcons?.();
          }
        }}
      />
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
