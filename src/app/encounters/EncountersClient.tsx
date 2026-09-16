"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Play, RefreshCw, Swords } from "lucide-react";
import { FactionIconLabel } from "@/components/FactionIcon";
import { ProfileTabsNav } from "@/components/profile-tabs/ProfileTabs";
import { ENCOUNTER_STATUS_LABELS } from "@/lib/statusLabels";

type Player = {
  id: string;
  factionName: string;
  code: number | null;
  shortCode: string | null;
  colorName: string | null;
  colorHex: string | null;
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
  resolutionNotes: string | null;
  winnerPlayer: { id: string; factionName: string } | null;
  resolvedAt: string | null;
  confirmations: { playerId: string; factionName: string; confirmedAt: string }[];
};

type Draft = {
  winnerPlayerId: string;
  resolutionNotes: string;
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(response.status === 401 ? "unauthorized" : `request_failed:${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function EncountersClient() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await fetchJson<{ encounters: Encounter[] }>("/api/my/encounters");
      setEncounters(data.encounters);
      setDrafts((current) => {
        const next = { ...current };

        for (const encounter of data.encounters) {
          next[encounter.id] ??= {
            winnerPlayerId: encounter.winnerPlayer?.id ?? "",
            resolutionNotes: encounter.resolutionNotes ?? ""
          };
        }

        return next;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        router.push("/login");
        return;
      }

      setMessage("No se pudieron cargar los encuentros.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function updateDraft(encounterId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [encounterId]: { ...(current[encounterId] ?? { winnerPlayerId: "", resolutionNotes: "" }), ...patch }
    }));
  }

  async function markInProgress(encounterId: string) {
    try {
      await fetchJson(`/api/encounters/${encounterId}/mark-in-progress`, { method: "POST" });
      setMessage("Encuentro marcado en curso.");
      await load();
    } catch {
      setMessage("No se pudo actualizar el encuentro.");
    }
  }

  async function resolve(encounter: Encounter) {
    const draft = drafts[encounter.id] ?? { winnerPlayerId: "", resolutionNotes: "" };

    try {
      const data = await fetchJson<{ encounters: Encounter[] }>(`/api/encounters/${encounter.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerPlayerId: draft.winnerPlayerId || null,
          resolutionNotes: draft.resolutionNotes || null,
          status: "resolved"
        })
      });
      setEncounters(data.encounters);
      setMessage("Resolución registrada.");
    } catch {
      setMessage("No se pudo registrar la resolución.");
    }
  }

  const unresolvedEncounters = encounters.filter((encounter) => encounter.status !== "resolved" && encounter.status !== "cancelled");
  const resolvedEncounters = encounters.filter((encounter) => encounter.status === "resolved" || encounter.status === "cancelled");

  function renderEncounterCard(encounter: Encounter) {
    const draft = drafts[encounter.id] ?? { winnerPlayerId: "", resolutionNotes: "" };
    const isClosed = encounter.status === "resolved" || encounter.status === "cancelled";

    return (
      <article className={`encounter-card ${isClosed ? "encounter-card-closed" : "encounter-card-active"}`} key={encounter.id}>
        <div className="encounter-header">
          <div>
            <p className="encounter-title">
              Turno {encounter.turnNumber}, fase {encounter.phaseNumber} · Casilla {encounter.cellId}
            </p>
            <p className="topbar-subtitle">{ENCOUNTER_STATUS_LABELS[encounter.status] ?? encounter.status}</p>
          </div>
          <span className="symbol-badge">{encounter.symbol || "-"}</span>
        </div>

        <div className="pill-list" style={{ marginTop: 10 }}>
          {encounter.participants.map((participant) => (
            <span className="pill faction-pill" key={participant.id}>
              <FactionIconLabel player={participant} />
            </span>
          ))}
          {encounter.isSecondaryWar ? <span className="war-badge">{encounter.warLabel}</span> : null}
        </div>

        {isClosed ? (
          <div className="notice" style={{ marginTop: 12 }}>
            {encounter.winnerPlayer ? `Gana ${encounter.winnerPlayer.factionName}. ` : "Empate. "}
            {encounter.resolutionNotes || "Encuentro cerrado sin notas."}
          </div>
        ) : (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor={`winner-${encounter.id}`}>Resolución</label>
              <select
                id={`winner-${encounter.id}`}
                value={draft.winnerPlayerId}
                onChange={(event) => updateDraft(encounter.id, { winnerPlayerId: event.target.value })}
              >
                <option value="">Empate</option>
                {encounter.participants.map((participant) => (
                  <option value={participant.id} key={participant.id}>
                    Gana {participant.factionName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`notes-${encounter.id}`}>Notas de resolución</label>
              <textarea
                id={`notes-${encounter.id}`}
                value={draft.resolutionNotes}
                onChange={(event) => updateDraft(encounter.id, { resolutionNotes: event.target.value })}
              />
            </div>
            <div className="button-row">
              <button className="text-button" type="button" onClick={() => markInProgress(encounter.id)}>
                <Play size={17} />
                En curso
              </button>
              <button className="primary-button" type="button" onClick={() => resolve(encounter)}>
                <CheckCircle2 size={17} />
                Guardar resolución
              </button>
            </div>
          </div>
        )}

        {encounter.confirmations.length > 0 ? (
          <p className="topbar-subtitle" style={{ marginTop: 10 }}>
            Confirmado por {encounter.confirmations.map((confirmation) => confirmation.factionName).join(", ")}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Swords size={20} />
          </div>
          <div>
            <h1 className="topbar-title">Encuentros privados</h1>
            <p className="topbar-subtitle">Solo aparecen los encuentros donde participa tu facción.</p>
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

      <section className="panel profile-tabs-panel">
        <ProfileTabsNav activeSection="encounters" />
      </section>

      {message ? <div className={`notice ${message.includes("No se") ? "error" : ""}`}>{message}</div> : null}

      <section className="encounter-list" style={{ marginTop: 12 }}>
        {isLoading ? <p className="muted">Cargando encuentros...</p> : null}
        {!isLoading && encounters.length === 0 ? <div className="panel muted">No hay encuentros para tu usuario.</div> : null}

        {unresolvedEncounters.map(renderEncounterCard)}

        {!isLoading && resolvedEncounters.length > 0 ? (
          <>
            <button className="resolved-toggle" type="button" onClick={() => setShowResolved((current) => !current)} aria-expanded={showResolved}>
              {showResolved ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              Encuentros resueltos ({resolvedEncounters.length})
            </button>
            {showResolved ? resolvedEncounters.map(renderEncounterCard) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
