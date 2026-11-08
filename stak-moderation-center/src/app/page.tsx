"use client";

import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    alert("Authentication is not configured yet.");
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

            <button type="submit" className="login-button">
              Sign In
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