'use client';

import { useEffect, useMemo } from 'react';
import Script from 'next/script';
import { LegacyBindings } from '@/components/legacy/legacy-bindings';

type InlinePageProps = {
  styles: string;
  body: string;
  script: string;
  pageKey?: string;
};

const stripEmbeddedScripts = (input: string) => input.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

export function InlinePage({ styles, body, script, pageKey }: InlinePageProps) {
  const sanitizedBody = useMemo(() => stripEmbeddedScripts(body), [body]);

  useEffect(() => {
    let disposed = false;
    let injectedScript: HTMLScriptElement | null = null;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const run = () => {
      if (disposed) {
        return;
      }

      (
        window as typeof window & {
          __versaficRefreshIcons?: () => void;
          lucide?: { createIcons: () => void };
        }
      ).__versaficRefreshIcons = () => {
        try {
          (window as typeof window & { lucide?: { createIcons: () => void } }).lucide?.createIcons();
        } catch (error) {
          console.error('Failed to refresh page icons', error);
        }
      };

      injectedScript = document.createElement('script');
      injectedScript.textContent = script;
      document.body.appendChild(injectedScript);

      try {
        const windowRef = window as typeof window & {
          lucide?: { createIcons: () => void };
          onload?: (() => void) | null;
          __versaficRefreshIcons?: () => void;
        };

        if (typeof windowRef.onload === 'function') {
          windowRef.onload();
        }

        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
        windowRef.__versaficRefreshIcons?.();
      } catch (error) {
        console.error('Failed to initialize page runtime', error);
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 200 }) as unknown as number;
    } else {
      timeoutId = window.setTimeout(run, 24);
    }

    return () => {
      disposed = true;

      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (injectedScript?.parentNode) {
        injectedScript.parentNode.removeChild(injectedScript);
      }
    };
  }, [script]);

  return (
    <>
      <Script
        src="https://unpkg.com/lucide@latest"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            (
              window as typeof window & {
                __versaficRefreshIcons?: () => void;
                lucide?: { createIcons: () => void };
              }
            ).__versaficRefreshIcons?.();
          } catch (error) {
            console.error('Failed to load lucide icons', error);
          }
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
      {pageKey ? <LegacyBindings pageKey={pageKey} /> : null}
    </>
  );
}
