"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LegacyDashboardRedirect() {
  const [message, setMessage] = useState("Verifying your STAK account...");

  useEffect(() => {
    let active = true;

    async function redirectToArea() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.replace("/");
          return;
        }

        if (!response.ok) {
          throw new Error("Your Discord role could not be verified right now.");
        }

        const payload = await response.json() as {
          authenticated?: boolean;
          user?: { stakRole?: string } | null;
        };

        if (!payload.authenticated || !payload.user?.stakRole) {
          window.location.replace("/");
          return;
        }

        const destination = payload.user.stakRole === "community-member"
          ? "/community-area"
          : "/staff-area";
        window.location.replace(destination);
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Unable to verify your account.");
        }
      }
    }

    void redirectToArea();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#080d16", color: "#dce7f5", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <section style={{ width: "min(440px, 100%)", padding: 30, border: "1px solid #26364b", borderRadius: 8, background: "#101a28", textAlign: "center" }}>
        <p style={{ color: "#78a9df", fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>STAK OFFICIAL PLATFORM</p>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Opening your area</h1>
        <p style={{ color: "#9eacc0", fontSize: 13, lineHeight: 1.7 }}>{message}</p>
        <Link href="/" style={{ color: "#8ab9ec", fontSize: 12 }}>Return to Home</Link>
      </section>
    </main>
  );
}
