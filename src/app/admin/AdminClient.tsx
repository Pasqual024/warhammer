"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FastForward, Hammer, RefreshCw, RotateCcw, Shield, SkipForward } from "lucide-react";
import { PHASE_STATE_LABELS } from "@/lib/statusLabels";

type Player = {
  id: string;
  factionName: string;
  username: string;
  code: number | null;
  colorHex: string | null;
  colorName: string | null;
};

type AdminStatus = {
  game: {
    id: string;
    name: string;
    currentTurn: number;
    currentPhase: number;
    currentState: string;
    status: string;
  };
  players: Player[];
  submissions: { playerId: string; factionName: string; colorHex: string | null; submittedAt: string }[];
  requiredSubmissions: number;
  metrics: {
    activeCellCount: number;
    announcementCount: number;
    encounterCounts: { status: string; _count: number }[];
  };
  zones: {
    id: string;
    name: string;
    type: string;
    colorRule: string | null;
    cells: { cellId: string }[];
  }[];
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(response.status === 401 ? "unauthorized" : `request_failed:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function AdminClient() {
  const router = useRouter();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [colorDrafts, setColorDrafts] = useState<Record<string, { colorName: string; colorHex: string }>>({});
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<AdminStatus>("/api/admin/status");
      setStatus(data);
      setColorDrafts(
        Object.fromEntries(
          data.players.map((player) => [
            player.id,
            {
              colorName: player.colorName ?? "",
              colorHex: player.colorHex ?? ""
            }
          ])
        )
      );
      setZoneDrafts(Object.fromEntries(data.zones.map((zone) => [zone.id, zone.cells.map((cell) => cell.cellId).join(", ")])));
      setMessage("");
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        router.push("/login");
        return;
      }

      setMessage("No tienes acceso de superadmin o falta preparar la base de datos.");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(url: string, successMessage: string) {
    setIsBusy(true);

    try {
      await fetchJson(url, { method: "POST" });
      setMessage(successMessage);
      await load();
    } catch {
      setMessage("La accion no se pudo completar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveConfig() {
    if (!status) {
      return;
    }

    setIsBusy(true);

    try {
      await fetchJson("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: status.players.map((player) => ({
            id: player.id,
            colorName: colorDrafts[player.id]?.colorName ?? player.colorName,
            colorHex: colorDrafts[player.id]?.colorHex ?? player.colorHex
          })),
          zones: status.zones.map((zone) => ({
            id: zone.id,
            cellIds: (zoneDrafts[zone.id] ?? "")
              .split(/[\s,;]+/)
              .map((cellId) => cellId.trim().toUpperCase())
              .filter(Boolean)
          }))
        })
      });
      setMessage("Configuracion guardada.");
      await load();
    } catch {
      setMessage("No se pudo guardar la configuracion.");
    } finally {
      setIsBusy(false);
    }
  }

  const state = status?.game.currentState ?? "movement_open";

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="topbar-title">Superadmin</h1>
            <p className="topbar-subtitle">Mantenimiento de partida y flujo automatico.</p>
          </div>
        </div>
        <nav className="nav-actions">
          <Link className="text-button" href="/dashboard">
            <ArrowLeft size={17} />
            Tablero
          </Link>
          <button className="icon-button" type="button" onClick={load} title="Actualizar">
            <RefreshCw size={17} />
          </button>
        </nav>
      </header>

      {message ? <div className={`notice ${message.includes("no") || message.includes("No") ? "error" : ""}`}>{message}</div> : null}

      <div className="layout-grid" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2 className="section-title">Estado global</h2>
          <div className="status-grid">
            <div className="metric">
              <p className="metric-label">Turno</p>
              <p className="metric-value">{status?.game.currentTurn ?? "-"}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Fase</p>
              <p className="metric-value">{status?.game.currentPhase ?? "-"}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Estado</p>
              <p className="metric-value">{PHASE_STATE_LABELS[state] ?? state}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Casillas activas</p>
              <p className="metric-value">{status?.metrics.activeCellCount ?? "-"}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Avisos fase</p>
              <p className="metric-value">{status?.metrics.announcementCount ?? "-"}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Confirmaciones</p>
              <p className="metric-value">
                {status?.submissions.length ?? 0}/{status?.requiredSubmissions ?? 3}
              </p>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button
              className="text-button"
              type="button"
              disabled={isBusy}
              onClick={() => runAction("/api/admin/recalculate-phase", "Fase recalculada.")}
            >
              <Hammer size={17} />
              Recalcular fase
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={isBusy}
              onClick={() => runAction("/api/admin/advance-phase", "Fase avanzada.")}
            >
              <SkipForward size={17} />
              Avanzar fase
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isBusy}
              onClick={() => runAction("/api/admin/force-close-phase", "Fase cerrada de forma forzada.")}
            >
              <FastForward size={17} />
              Forzar cierre
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={isBusy}
              onClick={() => runAction("/api/admin/reset-game", "Partida reiniciada.")}
            >
              <RotateCcw size={17} />
              Reiniciar partida
            </button>
          </div>
        </section>

        <aside>
          <section className="panel">
            <h2 className="section-title">Jugadores</h2>
            <div className="pill-list">
              {status?.players.map((player) => {
                const submitted = status.submissions.some((submission) => submission.playerId === player.id);
                return (
                  <span className="pill" key={player.id}>
                    <span className="pill-dot" style={{ "--pill-color": player.colorHex ?? "#64748b" } as CSSProperties} />
                    {player.factionName}: {submitted ? "confirmado" : "pendiente"}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title">Encuentros de fase</h2>
            {status?.metrics.encounterCounts.length ? (
              <div className="announcement-list">
                {status.metrics.encounterCounts.map((item) => (
                  <div className="compact-item" key={item.status}>
                    {item.status}: {item._count}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Sin encuentros registrados en la fase actual.</p>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title">Configuracion MVP</h2>
            <div className="form-grid">
              {status?.players.map((player) => (
                <div className="field" key={player.id}>
                  <label>{player.factionName}</label>
                  <div className="button-row">
                    <input
                      value={colorDrafts[player.id]?.colorName ?? ""}
                      onChange={(event) =>
                        setColorDrafts((current) => ({
                          ...current,
                          [player.id]: {
                            colorName: event.target.value,
                            colorHex: current[player.id]?.colorHex ?? ""
                          }
                        }))
                      }
                    />
                    <input
                      value={colorDrafts[player.id]?.colorHex ?? ""}
                      onChange={(event) =>
                        setColorDrafts((current) => ({
                          ...current,
                          [player.id]: {
                            colorName: current[player.id]?.colorName ?? "",
                            colorHex: event.target.value
                          }
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              {status?.zones.map((zone) => (
                <div className="field" key={zone.id}>
                  <label>{zone.name}</label>
                  <textarea
                    value={zoneDrafts[zone.id] ?? ""}
                    onChange={(event) => setZoneDrafts((current) => ({ ...current, [zone.id]: event.target.value }))}
                  />
                </div>
              ))}
              <button className="primary-button" type="button" disabled={isBusy} onClick={saveConfig}>
                Guardar configuracion
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
