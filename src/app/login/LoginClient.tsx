"use client";

import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    setIsLoading(false);

    if (!response.ok) {
      setError("Usuario o contrasena no validos.");
      return;
    }

    const data = await response.json();
    router.push(data.player?.role === "superadmin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-heading">
          <h1 className="login-title">CAMPAÑA ISLA DEL MAL</h1>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <div className="notice error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={isLoading}>
            <LogIn size={18} />
            {isLoading ? "ENTRANDO..." : "ENTRAR"}
          </button>
        </form>
      </section>
    </main>
  );
}
