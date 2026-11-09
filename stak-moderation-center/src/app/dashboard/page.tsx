"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
};

type SessionResponse = {
  authenticated: boolean;
  user?: User;
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          window.location.replace("/");
          return;
        }

        const result = (await response.json()) as SessionResponse;

        if (!result.authenticated || !result.user) {
          window.location.replace("/");
          return;
        }

        setUser(result.user);
      })
      .catch(() => {
        window.location.replace("/");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.replace("/");
    }
  }

  if (loading || !user) {
    return (
      <main className="dashboard-page">
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>STAK</h1>
          <p>MODERATION &amp; ADMINISTRATION</p>
        </div>

        <button onClick={handleLogout} className="logout-button">
          Sign Out
        </button>
      </div>

      <section className="dashboard-panel">
        <p className="dashboard-eyebrow">OVERVIEW</p>
        <h2>Welcome, {user.username}</h2>
        <p>You are successfully signed in to the STAK Moderation Center.</p>

        <div className="dashboard-account">
          <span>Account</span>
          <strong>{user.username}</strong>

          <span>Permission level</span>
          <strong>{user.role.replace("_", " ")}</strong>
        </div>
      </section>
    </main>
  );
}