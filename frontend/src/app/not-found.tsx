import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0a0a", color: "#ededed", fontFamily: "var(--font-inter), sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Page not found</h1>
        <p style={{ marginBottom: 20, color: "#a1a1aa" }}>The requested route does not exist.</p>
        <Link href="/" style={{ color: "#a78bfa" }}>Go back home</Link>
      </div>
    </main>
  );
}
