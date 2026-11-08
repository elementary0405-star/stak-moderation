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
          <img
            src="/stak-logo.png"
            alt="STAK"
            className="brand-logo"
          />

          <h1>STAK</h1>
          <p>MODERATION & ADMINISTRATION</p>
        </div>

        <div className="login-card">
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
                onChange={(event) =>
                  setUsername(event.target.value)
                }
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
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
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
        </div>

        <footer>
          STAK © 2026 · All rights reserved
        </footer>

      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background:
            radial-gradient(
              ellipse at 50% 35%,
              rgba(36, 75, 125, 0.16),
              transparent 55%
            ),
            #080d16;
          color: #f1f5f9;
          font-family: Arial, Helvetica, sans-serif;
        }

        .login-container {
          width: 100%;
          max-width: 410px;
        }

        .brand {
          text-align: center;
          margin-bottom: 32px;
        }

        .brand-logo {
          width: 100px;
          height: 100px;
          object-fit: contain;
          margin-bottom: 10px;
        }

        .brand h1 {
          font-size: 27px;
          font-weight: 800;
          letter-spacing: 7px;
          margin: 0;
        }

        .brand p {
          font-size: 10px;
          letter-spacing: 3px;
          color: #8190a5;
          margin-top: 9px;
        }

        .login-card {
          background: #111a29;
          border: 1px solid #253348;
          border-radius: 13px;
          padding: 34px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
        }

        .card-heading {
          margin-bottom: 29px;
        }

        .card-heading h2 {
          font-size: 23px;
          margin: 0 0 8px;
          font-weight: 700;
        }

        .card-heading p {
          color: #8997aa;
          font-size: 13px;
          margin: 0;
        }

        .form-group {
          margin-bottom: 21px;
        }

        label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 9px;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          height: 46px;
          border: 1px solid #304158;
          border-radius: 7px;
          background: #0b1320;
          color: white;
          padding: 0 13px;
          font-size: 13px;
          outline: none;
          transition: border 0.2s;
        }

        input:focus {
          border-color: #4d8de0;
        }

        input::placeholder {
          color: #64748b;
        }

        .password-wrapper {
          position: relative;
        }

        .password-wrapper input {
          padding-right: 65px;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #8da4c2;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .login-button {
          width: 100%;
          height: 47px;
          margin-top: 7px;
          background: #2866b2;
          border: 1px solid #397acb;
          border-radius: 7px;
          color: white;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }

        .login-button:hover {
          background: #3479ca;
        }

        .security-note {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          color: #718198;
          font-size: 10px;
          margin-top: 27px;
        }

        .security-dot {
          width: 6px;
          height: 6px;
          background: #4c9a78;
          border-radius: 50%;
        }

        footer {
          text-align: center;
          margin-top: 28px;
          color: #56657a;
          font-size: 10px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 27px 22px;
          }
        }
      `}</style>
    </main>
  );
}