"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { LegacyApiError, resetPassword } from "@/lib/legacy-api";

export default function ResetPasswordPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
    type: "idle",
    message: "Set a new password for your account.",
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!token) {
      setStatus({
        type: "error",
        message: "This password reset link is missing a token. Request a fresh reset email.",
      });
      return;
    }

    if (!password.trim()) {
      setStatus({ type: "error", message: "Enter a new password to continue." });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match yet." });
      return;
    }

    setSubmitting(true);
    setStatus({ type: "idle", message: "Updating your password..." });

    try {
      await resetPassword({ token, password });
      setStatus({
        type: "success",
        message: "Your password has been updated. You can sign in with it now.",
      });
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      const message =
        error instanceof LegacyApiError ? error.message : "Unable to reset your password right now.";
      setStatus({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

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
          maxWidth: "460px",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "18px",
          background: "#111111",
          padding: "32px 28px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            marginBottom: "18px",
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: "1rem",
          }}
        >
          V
        </div>
        <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 700 }}>Reset your password</h1>
        <p
          style={{
            margin: "12px 0 24px",
            color: status.type === "error" ? "#fca5a5" : status.type === "success" ? "#86efac" : "#a1a1aa",
            lineHeight: 1.6,
          }}
        >
          {status.message}
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: "16px" }}>
          <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
            <span style={{ color: "#d4d4d8" }}>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a strong password"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.95rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "8px", fontSize: "0.9rem" }}>
            <span style={{ color: "#d4d4d8" }}>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              style={{
                width: "100%",
                padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: "0.95rem",
              }}
            />
          </label>

          <p style={{ margin: 0, color: "#71717a", fontSize: "0.82rem", lineHeight: 1.6 }}>
            Use at least 8 characters with uppercase, lowercase, a number, and a special character.
          </p>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "none",
              cursor: submitting ? "wait" : "pointer",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.95rem",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Saving..." : "Save new password"}
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "0.88rem", color: "#a1a1aa" }}>
          <Link href="/login" style={{ color: "#c4b5fd", textDecoration: "none" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
