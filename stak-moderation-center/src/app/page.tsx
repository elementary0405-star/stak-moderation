"use client";

import { useEffect, useState } from "react";

type LoginResponse = {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    username: string;
    role: string;
    mustChangePassword: boolean;
  };
};

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          window.location.replace("/dashboard");
        }
      })
      .catch(() => {});
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.success || !result.user) {
        setError(result.message || "Login failed. Please try again.");
        return;
      }

      if (result.user.mustChangePassword) {
        window.location.replace("/change-password");
      } else {
        window.location.replace("/dashboard");
      }
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <div className="brand">
          <img src="/stak-logo.png" alt="STAK" className="brand-logo" />
          <h1>STAK</h1>
          <p>MODERATION &amp; ADMINISTRATION</p>
        </div>

        <section className="login-card">
          <div className="card-heading">
            <h2>Welcome back</h2>
            <p>Sign in to access your account.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="security-note">
            <span className="security-dot"></span>
            Restricted access · Authorized personnel only
          </div>
        </section>

        <footer>STAK © 2026 · All rights reserved</footer>
      </div>
    </main>
  );
}