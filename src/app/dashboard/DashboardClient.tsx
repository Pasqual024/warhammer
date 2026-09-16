"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, LogOut, Map, RefreshCw, Shield } from "lucide-react";
import { BoardGrid } from "@/components/BoardGrid";
import { FactionIconLabel } from "@/components/FactionIcon";
import { ProfileTabsNav } from "@/components/profile-tabs/ProfileTabs";
import type { BoardCell } from "@/lib/gameEngine";
import { ENCOUNTER_STATUS_LABELS, PHASE_STATE_LABELS } from "@/lib/statusLabels";

type Player = {
  id: string;
  username: string;
  factionName: string;
  code: number | null;
  shortCode: string | null;
  colorName: string | null;
  colorHex: string | null;
  role: string;
};

type GameData = {
  game: {
    currentTurn: number;
    currentPhase: number;
    currentState: string;
  };
  players: Player[];
  submissions: { playerId: string; factionName: string; colorHex: string | null; submittedAt: string }[];
  requiredSubmissions: number;
};

type MovesState = {
  selectedCellIds: string[];
  isSubmitted: boolean;
  submittedAt: string | null;
  isLocked: boolean;
};

type Announcement = {
  id: string;
  type: string;
  cellId: string | null;
  message: string;
};

type Encounter = {
  id: string;
  turnNumber: number;
  phaseNumber: number;
  cellId: string;
  status: string;
  symbol: string;
  opponents: Player[];
  participants: Player[];
  isSecondaryWar: boolean;
  warLabel: string | null;
};

type VisibleEncounterCells = {
  canShowEncounters: boolean;
  encounterCellIds: string[];
};

type KillsRankingItem = {
  userName: string;
  campaignGeneralName: string;
  unitType: string;
  kills: number;
};

type ExperienceRankingItem = {
  userName: string;
  unitName: string;
  experience: string;
  rank: string;
  battles: string;
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(response.status === 401 ? "unauthorized" : `request_failed:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function DashboardClient() {
  const router = useRouter();
  const [me, setMe] = useState<Player | null>(null);
  const [cells, setCells] = useState<BoardCell[]>([]);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [moves, setMoves] = useState<MovesState | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [visibleEncounterCellIds, setVisibleEncounterCellIds] = useState<string[]>([]);
  const [killsRanking, setKillsRanking] = useState<KillsRankingItem[]>([]);
  const [experienceRanking, setExperienceRanking] = useState<ExperienceRankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isBoardDebug, setIsBoardDebug] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const [
        meData,
        boardData,
        currentGame,
        myMoves,
        phaseAnnouncements,
        myEncounters,
        visibleEncounters,
        killsRankingData,
        experienceRankingData
      ] = await Promise.all([
        fetchJson<{ player: Player }>("/api/me"),
        fetchJson<{ cells: BoardCell[] }>("/api/board"),
        fetchJson<GameData>("/api/game/current"),
        fetchJson<{ moves: MovesState }>("/api/my/moves"),
        fetchJson<{ announcements: Announcement[] }>("/api/announcements/current-phase"),
        fetchJson<{ encounters: Encounter[] }>("/api/my/encounters"),
        fetchJson<VisibleEncounterCells>("/api/encounters/visible-cells"),
        fetchJson<{ ranking: KillsRankingItem[] }>("/api/army-kills-ranking"),
        fetchJson<{ ranking: ExperienceRankingItem[] }>("/api/army-experience-ranking")
      ]);

      setMe(meData.player);
      setCells(boardData.cells);
      setGameData(currentGame);
      setMoves(myMoves.moves);
      setAnnouncements(phaseAnnouncements.announcements);
      setEncounters(myEncounters.encounters);
      setVisibleEncounterCellIds(visibleEncounters.canShowEncounters ? visibleEncounters.encounterCellIds : []);
      setKillsRanking(killsRankingData.ranking);
      setExperienceRanking(experienceRankingData.ranking);
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        router.push("/login");
        return;
      }

      setMessage("No se pudo cargar el estado. Revisa la instalacion y la base de datos.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function toggleCell(cellId: string) {
    if (moves?.isLocked) {
      return;
    }

    try {
      const data = await fetchJson<{ moves: MovesState }>("/api/my/moves/toggle-cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cellId })
      });
      setMoves(data.moves);
      setMessage("");
    } catch {
      setMessage("No se pudo modificar esa casilla.");
    }
  }

  async function submitMoves() {
    try {
      const result = await fetchJson<{ calculated?: boolean; advanced?: boolean; nextTurn?: number; nextPhase?: number }>(
        "/api/my/moves/submit",
        { method: "POST" }
      );
      setMessage(
        result.advanced
          ? `Movimientos confirmados. No hay encuentros y la partida ha avanzado al turno ${result.nextTurn}, fase ${result.nextPhase}.`
          : result.calculated
          ? "Movimientos confirmados. Los 3 jugadores han confirmado y se han calculado los resultados."
          : "Movimientos confirmados. Esperando al resto de jugadores."
      );
      await load();
    } catch {
      setMessage("No se pudieron confirmar los movimientos.");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordMessage("Las nuevas contrasenas no coinciden.");
      return;
    }

    setIsChangingPassword(true);

    const response = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    setIsChangingPassword(false);

    if (!response.ok) {
      setPasswordMessage(response.status === 403 ? "La contrasena actual no es valida." : "No se pudo cambiar la contrasena.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Contrasena actualizada.");
  }

  const currentState = gameData?.game.currentState ?? "movement_open";
  const pendingCurrentEncounters = encounters.filter((encounter) => encounter.status !== "resolved" && encounter.status !== "cancelled");

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Map size={20} />
          </div>
          <div>
            <h1 className="topbar-title">{me?.factionName ?? "Tablero privado"}</h1>
            <p className="topbar-subtitle">
              {me?.colorName ? `${me.colorName} - codigo ${me.code}` : "Estado de partida"}
            </p>
          </div>
        </div>
        <nav className="nav-actions">
          {me?.role === "superadmin" ? (
            <Link className="text-button" href="/admin">
              <Shield size={17} />
              Admin
            </Link>
          ) : null}
          <button className="icon-button" type="button" onClick={load} title="Actualizar">
            <RefreshCw size={17} />
          </button>
          <button className="icon-button" type="button" onClick={logout} title="Salir">
            <LogOut size={17} />
          </button>
        </nav>
      </header>

      {message ? <div className={`notice ${message.includes("No se") ? "error" : ""}`}>{message}</div> : null}

      {gameData ? (
        <section className="panel profile-tabs-panel">
          <ProfileTabsNav currentPhase={gameData.game.currentPhase} />
        </section>
      ) : null}

      <div className="layout-grid" style={{ marginTop: 12 }}>
        <section className="panel">
          <h2 className="section-title">
            <span>Tablero de movimiento</span>
            <button
              className={`text-button compact-toggle${isBoardDebug ? " is-active" : ""}`}
              type="button"
              aria-pressed={isBoardDebug}
              onClick={() => setIsBoardDebug((current) => !current)}
            >
              <Map size={16} />
              Debug
            </button>
          </h2>
          {isLoading || !moves ? (
            <p className="muted">Cargando tablero...</p>
          ) : (
            <BoardGrid
              cells={cells}
              selectedCellIds={moves.selectedCellIds}
              encounterCellIds={visibleEncounterCellIds}
              factionColor={me?.colorHex}
              locked={moves.isLocked}
              debug={isBoardDebug}
              onToggleCell={toggleCell}
            />
          )}
          <div className="button-row" style={{ marginTop: 12 }}>
            <button className="primary-button" type="button" disabled={moves?.isLocked ?? true} onClick={submitMoves}>
              <CheckCircle2 size={18} />
              Confirmar movimientos
            </button>
            <span className="muted">
              {moves?.isSubmitted
                ? "Movimientos confirmados. Esperando el flujo de fase."
                : "Las casillas marcadas son privadas para tu faccion."}
            </span>
          </div>
        </section>

        <aside>
          <section className="panel">
            <h2 className="section-title panel-accent-title">ESTADO ACTUAL</h2>
            <div className="status-grid">
              <div className="metric">
                <p className="metric-label">Turno</p>
                <p className="metric-value">{gameData?.game.currentTurn ?? "-"}</p>
              </div>
              <div className="metric">
                <p className="metric-label">Fase</p>
                <p className="metric-value">{gameData?.game.currentPhase ?? "-"}</p>
              </div>
              <div className="metric">
                <p className="metric-label">Estado</p>
                <p className="metric-value">{PHASE_STATE_LABELS[currentState] ?? currentState}</p>
              </div>
            </div>
            <div className="pill-list" style={{ marginTop: 10 }}>
              {gameData?.players.map((player) => {
                const submitted = gameData.submissions.some((submission) => submission.playerId === player.id);
                return (
                  <span className={`pill status-pill${submitted ? " confirmed" : ""}`} key={player.id}>
                    <span className="pill-dot" style={{ "--pill-color": player.colorHex ?? "#64748b" } as CSSProperties} />
                    {player.factionName}: {submitted ? "confirmado" : "pendiente"}
                  </span>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title panel-accent-title">AVISOS PÚBLICOS</h2>
            {announcements.length === 0 ? (
              <p className="muted">Sin avisos calculados para la fase actual.</p>
            ) : (
              <div className="announcement-list">
                {announcements.map((announcement) => (
                  <div className={`announcement ${announcement.type}`} key={announcement.id}>
                    {announcement.message}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title panel-accent-title">MIS ENCUENTROS</h2>
            {pendingCurrentEncounters.length === 0 ? (
              <p className="muted">No tienes encuentros pendientes.</p>
            ) : (
              <div className="encounter-list">
                {pendingCurrentEncounters.slice(0, 4).map((encounter) => (
                  <div className="compact-item encounter-card-active" key={encounter.id}>
                    <div className="encounter-header">
                      <div>
                        <p className="encounter-title">Casilla {encounter.cellId}</p>
                        <p className="topbar-subtitle">
                          Turno {encounter.turnNumber}, fase {encounter.phaseNumber} -{" "}
                          {ENCOUNTER_STATUS_LABELS[encounter.status] ?? encounter.status}
                        </p>
                      </div>
                      <span className="symbol-badge">{encounter.symbol || "-"}</span>
                    </div>
                    <div className="faction-icon-list" style={{ marginTop: 10 }}>
                      {encounter.participants.map((participant) => (
                        <FactionIconLabel player={participant} key={participant.id} />
                      ))}
                    </div>
                    {encounter.isSecondaryWar ? <p className="war-badge">{encounter.warLabel}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title panel-accent-title">Ranking de Muertes</h2>
            {killsRanking.length === 0 ? (
              <p className="muted">Aún no hay muertes registradas.</p>
            ) : (
              <div className="ranking-table-wrap">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre de General Campaña</th>
                      <th>Tipo de Unidad</th>
                      <th>Muertes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {killsRanking.map((item, index) => (
                      <tr key={`${item.userName}-${item.campaignGeneralName}-${item.unitType}-${index}`}>
                        <td>{item.userName || "—"}</td>
                        <td>{item.campaignGeneralName || "—"}</td>
                        <td>{item.unitType || "—"}</td>
                        <td>{item.kills}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title panel-accent-title">Ranking de Experiencia</h2>
            {experienceRanking.length === 0 ? (
              <p className="muted">Aún no hay experiencia registrada.</p>
            ) : (
              <div className="ranking-table-wrap">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Nombre de Unidades</th>
                      <th>Experiencia</th>
                      <th>Rango</th>
                      <th>Nº de batallas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {experienceRanking.map((item, index) => (
                      <tr key={`${item.userName}-${item.unitName}-${index}`}>
                        <td>{item.userName || "—"}</td>
                        <td>{item.unitName || "—"}</td>
                        <td>{item.experience || "—"}</td>
                        <td>{item.rank || "—"}</td>
                        <td>{item.battles || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="section-title">
              <span>Cambiar contrasena</span>
              <KeyRound size={17} />
            </h2>
            <form className="form-grid" onSubmit={changePassword}>
              <div className="field">
                <label htmlFor="current-password">Contrasena actual</label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-password">Nueva contrasena</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-password">Repetir nueva</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
              {passwordMessage ? (
                <div className={`notice ${passwordMessage.includes("No se") || passwordMessage.includes("no") ? "error" : ""}`}>
                  {passwordMessage}
                </div>
              ) : null}
              <button className="text-button" type="submit" disabled={isChangingPassword}>
                <KeyRound size={17} />
                {isChangingPassword ? "Guardando..." : "Guardar contrasena"}
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}
