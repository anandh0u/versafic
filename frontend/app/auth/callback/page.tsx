"use client";

import { useEffect, useState } from "react";
import { completeOAuthCallback } from "@/lib/legacy-api";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign-in...");

  useEffect(() => {
    let cancelled = false;

    const finishLogin = async () => {
      try {
        const result = await completeOAuthCallback(window.location.href);
        if (cancelled) {
          return;
        }

        if (result.success) {
          setMessage("Connected. Taking you to your dashboard...");
          const destination = result.user?.isOnboarded === false ? "/onboarding" : "/dashboard";
          window.location.replace(destination);
          return;
        }

        window.location.replace(`/login?oauth_error=${encodeURIComponent(result.message)}`);
      } catch {
        if (!cancelled) {
          window.location.replace("/login?oauth_error=Unable to complete social login right now.");
        }
      }
    };

    void finishLogin();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: "Inter, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "18px",
          background: "#111111",
          padding: "32px 28px",
          textAlign: "center",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            margin: "0 auto 18px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: "1rem",
          }}
        >
          V
        </div>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Connecting your account</h1>
        <p style={{ margin: "12px 0 0", color: "#a1a1aa", lineHeight: 1.6 }}>{message}</p>
      </div>
    </main>
  );
}
