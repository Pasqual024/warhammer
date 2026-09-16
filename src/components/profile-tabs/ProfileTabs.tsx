"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronRight, Coins, NotebookTabs, Plus, Save, Trash2 } from "lucide-react";
import {
  ARMY_COLUMNS,
  DIARY_FIXED_ROWS,
  INGRESAR_ROWS,
  INVERTIR_EXTRA_ROWS,
  INVERTIR_ROWS,
  calculateArmyPoints,
  calculateIngresar,
  calculateInvertir,
  calculateTotalArmyPoints,
  normalizeArmyListData,
  normalizeDiaryData,
  toNumber,
  type ArmyData,
  type ArmyListData,
  type ArmyRowData,
  type DiaryData
} from "@/lib/profileCalculations";

type ProfileSection = "armyList" | "economy" | "diary" | "encounters" | null;
type ProfilePageSection = "armyList" | "economy" | "diary";
type EconomyTabKey = "invertir" | "ingresar";

type ProfileTabsState = {
  game: {
    id: string;
    currentTurn: number;
    currentPhase: number;
  };
  armyList: ArmyListData;
  diary: DiaryData;
  invertir: {
    editableInputs: Record<string, unknown>;
    calculatedCells: Record<string, number>;
  };
  ingresar: {
    editableInputs: Record<string, unknown>;
    calculatedCells: Record<string, number>;
  };
  previousTurnIngresarD16: number;
};

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(response.status === 401 ? "unauthorized" : `request_failed:${response.status}`);
  }

  return response.json() as Promise<T>;
}

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeEmptyArmyRow(): ArmyRowData {
  return Object.fromEntries(ARMY_COLUMNS.map((column) => [column.key, ""])) as ArmyRowData;
}

function setNestedArmy(armyList: ArmyListData, updater: (armies: ArmyData[]) => ArmyData[]) {
  return normalizeArmyListData({ armies: updater(armyList.armies) });
}

function ordinal(index: number) {
  return `${index}º`;
}

export function ProfileTabsNav({
  activeSection = null,
  totalArmyPoints = null,
  currentPhase = null
}: {
  activeSection?: ProfileSection;
  totalArmyPoints?: number | null;
  currentPhase?: number | null;
}) {
  const canUseEconomy = currentPhase === null || currentPhase === 1;
  const armyLabel = typeof totalArmyPoints === "number" ? `Lista de Ejércitos · ${totalArmyPoints} pts` : "Lista de Ejércitos";

  return (
    <div className="profile-tabs-bar profile-main-nav" role="tablist" aria-label="Pestañas de perfil">
      <Link className={`profile-tab${activeSection === "armyList" ? " is-active" : ""}`} href="/armies">
        {armyLabel}
      </Link>
      {canUseEconomy ? (
        <Link className={`profile-tab${activeSection === "economy" ? " is-active" : ""}`} href="/economy">
          Economía
        </Link>
      ) : (
        <span
          className={`profile-tab is-disabled${activeSection === "economy" ? " is-active" : ""}`}
          aria-disabled="true"
          title="Disponible solo en Fase 1"
        >
          Economía
          <span className="tab-lock">Fase 1</span>
        </span>
      )}
      <Link className={`profile-tab${activeSection === "diary" ? " is-active" : ""}`} href="/diary">
        Diario
      </Link>
      <Link className={`profile-tab${activeSection === "encounters" ? " is-active" : ""}`} href="/encounters">
        Encuentros
      </Link>
    </div>
  );
}

export function ProfileTabs({ activeSection }: { activeSection: ProfilePageSection }) {
  const router = useRouter();
  const [economyTab, setEconomyTab] = useState<EconomyTabKey>("invertir");
  const [data, setData] = useState<ProfileTabsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchJson<ProfileTabsState>("/api/profile-tabs");
      setData(next);
      setMessage("");
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        router.push("/login");
        return;
      }

      setMessage("No se pudieron cargar las pestañas de perfil.");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const canUseEconomyTabs = data?.game.currentPhase === 1;
  const invertirCalc = useMemo(
    () =>
      calculateInvertir({
        editableInputs: data?.invertir.editableInputs ?? {},
        previousTurnIngresarD16: data?.previousTurnIngresarD16 ?? 0
      }),
    [data?.invertir.editableInputs, data?.previousTurnIngresarD16]
  );
  const ingresarCalc = useMemo(
    () =>
      calculateIngresar({
        editableInputs: data?.ingresar.editableInputs ?? {},
        currentTurnInvertirE30: invertirCalc.cells.E30
      }),
    [data?.ingresar.editableInputs, invertirCalc.cells.E30]
  );
  const totalArmyPoints = calculateTotalArmyPoints(data?.armyList.armies ?? []);

  async function saveSection(section: "armyList" | "diary" | "invertir" | "ingresar", payload: unknown) {
    setIsSaving(true);
    setMessage("");
    try {
      const next = await fetchJson<ProfileTabsState>("/api/profile-tabs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: payload })
      });
      setData(next);
      setMessage("Datos guardados.");
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        router.push("/login");
        return;
      }

      setMessage(section === "invertir" || section === "ingresar" ? "Disponible solo en Fase 1." : "No se pudieron guardar los datos.");
    } finally {
      setIsSaving(false);
    }
  }

  function setArmyList(armyList: ArmyListData) {
    setData((current) => (current ? { ...current, armyList } : current));
  }

  function setDiary(diary: DiaryData) {
    setData((current) => (current ? { ...current, diary } : current));
  }

  function setInvertirInput(cell: string, value: string) {
    setData((current) =>
      current
        ? {
            ...current,
            invertir: {
              ...current.invertir,
              editableInputs: { ...current.invertir.editableInputs, [cell]: value }
            }
          }
        : current
    );
  }

  function setIngresarInput(cell: string, value: string) {
    setData((current) =>
      current
        ? {
            ...current,
            ingresar: {
              ...current.ingresar,
              editableInputs: { ...current.ingresar.editableInputs, [cell]: value }
            }
          }
        : current
    );
  }

  const title =
    activeSection === "armyList" ? "Lista de Ejércitos" : activeSection === "economy" ? "Economía" : "Diario de Campaña";
  const icon = activeSection === "economy" ? <Coins size={20} /> : <NotebookTabs size={20} />;

  if (isLoading || !data) {
    return (
      <main className="app-page">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">{icon}</div>
            <div>
              <h1 className="topbar-title">{title}</h1>
              <p className="topbar-subtitle">Cargando datos del perfil.</p>
            </div>
          </div>
          <Link className="text-button" href="/dashboard">
            <ArrowLeft size={17} />
            Tablero
          </Link>
        </header>
        <section className="panel profile-tabs-panel">
          <p className="muted">Cargando pestañas de perfil...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">{icon}</div>
          <div>
            <h1 className="topbar-title">{title}</h1>
            <p className="topbar-subtitle">
              Turno {data.game.currentTurn}, fase {data.game.currentPhase}
            </p>
          </div>
        </div>
        <Link className="text-button" href="/dashboard">
          <ArrowLeft size={17} />
          Tablero
        </Link>
      </header>

      {message ? <div className={`notice ${message.includes("No se") || message.includes("Disponible") ? "error" : ""}`}>{message}</div> : null}

      <section className="panel profile-tabs-panel">
        <ProfileTabsNav activeSection={activeSection} totalArmyPoints={totalArmyPoints} currentPhase={data.game.currentPhase} />

        <div className="profile-tab-meta">
          <span>Turno {data.game.currentTurn}</span>
          <span>Fase {data.game.currentPhase}</span>
        </div>

        {activeSection === "armyList" ? (
          <ArmyListTab
            armyList={data.armyList}
            isSaving={isSaving}
            onChange={setArmyList}
            onSave={() => saveSection("armyList", data.armyList)}
          />
        ) : null}

        {activeSection === "economy" ? (
          canUseEconomyTabs ? (
            <div className="profile-tab-content">
              <div className="profile-tabs-bar profile-tabs-subbar" role="tablist" aria-label="Pestañas de economía">
                <button
                  className={`profile-tab${economyTab === "invertir" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setEconomyTab("invertir")}
                >
                  2.1 Invertir
                </button>
                <button
                  className={`profile-tab${economyTab === "ingresar" ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setEconomyTab("ingresar")}
                >
                  2.2 Ingresar
                </button>
              </div>

              {economyTab === "invertir" ? (
                <InvertirTab
                  inputs={data.invertir.editableInputs}
                  calculatedCells={invertirCalc.cells}
                  isSaving={isSaving}
                  onChange={setInvertirInput}
                  onSave={() => saveSection("invertir", data.invertir.editableInputs)}
                />
              ) : (
                <IngresarTab
                  inputs={data.ingresar.editableInputs}
                  calculatedCells={ingresarCalc.cells}
                  invertirE30={invertirCalc.cells.E30}
                  isSaving={isSaving}
                  onChange={setIngresarInput}
                  onSave={() => saveSection("ingresar", data.ingresar.editableInputs)}
                />
              )}
            </div>
          ) : (
            <LockedPhasePanel />
          )
        ) : null}

        {activeSection === "diary" ? (
          <DiaryTab diary={data.diary} isSaving={isSaving} onChange={setDiary} onSave={() => saveSection("diary", data.diary)} />
        ) : null}
      </section>
    </main>
  );
}

function LockedPhasePanel() {
  return (
    <div className="profile-locked">
      <p className="section-title panel-accent-title">Disponible solo en Fase 1</p>
      <p className="muted">Economía se bloquea durante Fase 2 y Fase 3. Los datos de turnos anteriores se conservan.</p>
    </div>
  );
}

function ArmyListTab({
  armyList,
  isSaving,
  onChange,
  onSave
}: {
  armyList: ArmyListData;
  isSaving: boolean;
  onChange: (armyList: ArmyListData) => void;
  onSave: () => void;
}) {
  function addArmy() {
    onChange(
      setNestedArmy(armyList, (armies) => [
        ...armies,
        {
          id: uid("army"),
          name: `Ejército ${armies.length + 1}`,
          collapsed: false,
          rows: [makeEmptyArmyRow()]
        }
      ])
    );
  }

  function updateArmy(armyId: string, patch: Partial<ArmyData>) {
    onChange(setNestedArmy(armyList, (armies) => armies.map((army) => (army.id === armyId ? { ...army, ...patch } : army))));
  }

  function updateRow(armyId: string, rowIndex: number, key: string, value: string) {
    onChange(
      setNestedArmy(armyList, (armies) =>
        armies.map((army) =>
          army.id === armyId
            ? {
                ...army,
                rows: army.rows.map((row, index) => (index === rowIndex ? { ...row, [key]: key === "points" ? String(toNumber(value)) : value } : row))
              }
            : army
        )
      )
    );
  }

  function addRow(armyId: string) {
    onChange(setNestedArmy(armyList, (armies) => armies.map((army) => (army.id === armyId ? { ...army, rows: [...army.rows, makeEmptyArmyRow()] } : army))));
  }

  function removeRow(armyId: string, rowIndex: number) {
    onChange(
      setNestedArmy(armyList, (armies) =>
        armies.map((army) => (army.id === armyId ? { ...army, rows: army.rows.filter((_, index) => index !== rowIndex) } : army))
      )
    );
  }

  function removeArmy(armyId: string) {
    onChange(setNestedArmy(armyList, (armies) => armies.filter((army) => army.id !== armyId)));
  }

  function setAllCollapsed(collapsed: boolean) {
    onChange(setNestedArmy(armyList, (armies) => armies.map((army) => ({ ...army, collapsed }))));
  }

  return (
    <div className="profile-tab-content">
      <div className="profile-actions">
        <button className="text-button" type="button" onClick={addArmy}>
          <Plus size={17} />
          Crear ejército
        </button>
        <button className="text-button" type="button" onClick={() => setAllCollapsed(false)}>
          Desplegar todos
        </button>
        <button className="text-button" type="button" onClick={() => setAllCollapsed(true)}>
          Agrupar todos
        </button>
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          <Save size={17} />
          {isSaving ? "Guardando..." : "Guardar lista"}
        </button>
      </div>

      <div className="fixed-excel-note">
        <strong>Filas fijas del Excel:</strong> EJÉRCITOS (Personajes y Unidades) · GLOBAL · {ARMY_COLUMNS.map((column) => column.label).join(" · ")}
      </div>

      {armyList.armies.length === 0 ? <p className="muted">No hay ejércitos creados todavía.</p> : null}

      <div className="army-list">
        {armyList.armies.map((army) => (
          <article className="army-card" key={army.id}>
            <div className="army-card-header">
              <button className="icon-button" type="button" onClick={() => updateArmy(army.id, { collapsed: !army.collapsed })} title="Desplegar o agrupar">
                {army.collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
              </button>
              <input className="army-name-input" value={army.name} onChange={(event) => updateArmy(army.id, { name: event.currentTarget.value })} />
              <span className="pill">{calculateArmyPoints(army)} pts</span>
              <button className="icon-button" type="button" onClick={() => removeArmy(army.id)} title="Eliminar ejército">
                <Trash2 size={17} />
              </button>
            </div>

            {army.collapsed ? null : (
              <>
                <div className="army-table-wrap">
                  <table className="profile-table army-table">
                    <thead>
                      <tr>
                        {ARMY_COLUMNS.map((column) => (
                          <th key={column.key}>{column.label}</th>
                        ))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {army.rows.map((row, rowIndex) => (
                        <tr key={`${army.id}-${rowIndex}`}>
                          {ARMY_COLUMNS.map((column) => (
                            <td key={column.key}>
                              <input
                                type={"numeric" in column && column.numeric ? "number" : "text"}
                                value={row[column.key] ?? ""}
                                onChange={(event) => updateRow(army.id, rowIndex, column.key, event.currentTarget.value)}
                              />
                            </td>
                          ))}
                          <td>
                            <button className="icon-button" type="button" onClick={() => removeRow(army.id, rowIndex)} title="Eliminar fila">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="text-button" type="button" onClick={() => addRow(army.id)}>
                  <Plus size={17} />
                  Añadir fila
                </button>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function NumericInput({ value, onChange }: { value: unknown; onChange: (value: string) => void }) {
  return <input className="sheet-input" type="number" value={String(value ?? "")} onChange={(event) => onChange(event.currentTarget.value)} />;
}

function NumberCell({ value }: { value: unknown }) {
  return <span>{toNumber(value)}</span>;
}

function InvertirTab({
  inputs,
  calculatedCells,
  isSaving,
  onChange,
  onSave
}: {
  inputs: Record<string, unknown>;
  calculatedCells: Record<string, number>;
  isSaving: boolean;
  onChange: (cell: string, value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="profile-tab-content">
      <div className="profile-actions">
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          <Save size={17} />
          {isSaving ? "Guardando..." : "Guardar invertir"}
        </button>
      </div>
      <div className="economy-layout">
        <div className="profile-table-wrap">
          <table className="profile-table sheet-table">
            <thead>
              <tr>
                <th>Inversión</th>
                <th>Coste</th>
                <th>Tiempo en turnos</th>
                <th>Nº</th>
                <th>Gasto</th>
              </tr>
            </thead>
            <tbody>
              {INVERTIR_ROWS.map((row) => (
                <tr key={row.row}>
                  <th className="fixed-cell">{row.label}</th>
                  <td className="fixed-cell">{row.cost}</td>
                  <td className="fixed-cell">{row.turns}</td>
                  <td className="editable-cell">
                    <NumericInput value={inputs[`D${row.row}`] ?? ""} onChange={(value) => onChange(`D${row.row}`, value)} />
                  </td>
                  <td className="calculated-cell">
                    <NumberCell value={calculatedCells[`E${row.row}`]} />
                  </td>
                </tr>
              ))}
              {INVERTIR_EXTRA_ROWS.map((row) => (
                <tr key={row.row}>
                  <th className="fixed-cell" colSpan={4}>
                    {row.label}
                  </th>
                  <td className="editable-cell">
                    <NumericInput value={inputs[`E${row.row}`] ?? ""} onChange={(value) => onChange(`E${row.row}`, value)} />
                  </td>
                </tr>
              ))}
              <tr>
                <th className="fixed-cell" colSpan={4}>
                  TOTAL GASTO
                </th>
                <td className="calculated-cell strong-cell">
                  <NumberCell value={calculatedCells.E28} />
                </td>
              </tr>
              <tr>
                <th className="fixed-cell" colSpan={4}>
                  ACUMULADO TURNO ANTERIOR
                </th>
                <td className="calculated-cell strong-cell">
                  <NumberCell value={calculatedCells.E29} />
                </td>
              </tr>
              <tr>
                <th className="fixed-cell" colSpan={4}>
                  RESTANTE PARA GASTAR EN TURNO
                </th>
                <td className="calculated-cell strong-cell">
                  <NumberCell value={calculatedCells.E30} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <aside className="economy-info" aria-label="Información fija de economía">
          <div>
            <h3>HAMBRE (PUNTOS GLOBALES)</h3>
            <p>0-500 puntos -&gt; 10%</p>
            <p>501-2000 puntos -&gt; 20%</p>
            <p>2001-3000 puntos -&gt; 40%</p>
            <p>3001-5000 puntos -&gt; 50%</p>
            <p>5001 puntos o más -&gt; 100%</p>
          </div>
          <div>
            <h3>COSTE UNIDADES (PUNTOS GLOBALES)</h3>
            <p>0-1000 puntos: 1/2 rupia/punto</p>
            <p>1001-2500 puntos: 1 rupia/punto</p>
            <p>2501-3500 puntos: 2 rupias/punto</p>
            <p>3501 puntos o más: 3 rupias/punto</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function IngresarTab({
  inputs,
  calculatedCells,
  invertirE30,
  isSaving,
  onChange,
  onSave
}: {
  inputs: Record<string, unknown>;
  calculatedCells: Record<string, number>;
  invertirE30: number;
  isSaving: boolean;
  onChange: (cell: string, value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="profile-tab-content">
      <div className="profile-actions">
        <span className="muted">D14 = suma F4:F13 + G4:G13 · D16 = D14 + Invertir E30 ({invertirE30})</span>
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          <Save size={17} />
          {isSaving ? "Guardando..." : "Guardar ingresar"}
        </button>
      </div>
      <div className="profile-table-wrap">
        <table className="profile-table sheet-table">
          <thead>
            <tr>
              <th>Ingresos</th>
              <th>X 1</th>
              <th>X 2 Región</th>
              <th>Territorios X1</th>
              <th>Territorios X2</th>
              <th>Ingreso X1</th>
              <th>Ingreso X2</th>
            </tr>
          </thead>
          <tbody>
            {INGRESAR_ROWS.map((row) => (
              <tr key={row.row}>
                <th className="fixed-cell">{row.label}</th>
                <td className="fixed-cell">{row.base}</td>
                <td className="fixed-cell">{row.region}</td>
                <td className="editable-cell">
                  <NumericInput value={inputs[`D${row.row}`] ?? ""} onChange={(value) => onChange(`D${row.row}`, value)} />
                </td>
                <td className="editable-cell">
                  <NumericInput value={inputs[`E${row.row}`] ?? ""} onChange={(value) => onChange(`E${row.row}`, value)} />
                </td>
                <td className="calculated-cell">
                  <NumberCell value={calculatedCells[`F${row.row}`]} />
                </td>
                <td className="calculated-cell">
                  <NumberCell value={calculatedCells[`G${row.row}`]} />
                </td>
              </tr>
            ))}
            <tr>
              <th className="fixed-cell" colSpan={5}>
                RUPIAS POR BATALLAS
              </th>
              <td className="editable-cell">
                <NumericInput value={inputs.F13 ?? ""} onChange={(value) => onChange("F13", value)} />
              </td>
              <td className="fixed-cell">0</td>
            </tr>
            <tr>
              <th className="fixed-cell" colSpan={3}>
                TOTAL INGRESADO EN TURNO
              </th>
              <td className="calculated-cell strong-cell" colSpan={4}>
                <NumberCell value={calculatedCells.D14} />
              </td>
            </tr>
            <tr>
              <th className="fixed-cell" colSpan={3}>
                TOTAL ACUMULADO EN TURNO
              </th>
              <td className="calculated-cell strong-cell" colSpan={4}>
                <NumberCell value={calculatedCells.D16} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiaryTab({
  diary,
  isSaving,
  onChange,
  onSave
}: {
  diary: DiaryData;
  isSaving: boolean;
  onChange: (diary: DiaryData) => void;
  onSave: () => void;
}) {
  function updateCell(row: number, turn: number, value: string) {
    onChange(
      normalizeDiaryData({
        cells: {
          ...diary.cells,
          [`${row}:${turn}`]: value
        }
      })
    );
  }

  return (
    <div className="profile-tab-content">
      <div className="profile-actions">
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          <Save size={17} />
          {isSaving ? "Guardando..." : "Guardar diario"}
        </button>
      </div>
      <div className="diary-table-wrap">
        <table className="profile-table diary-table">
          <tbody>
            {DIARY_FIXED_ROWS.map((row) => (
              <tr key={row.row}>
                <th className="sticky-col sticky-col-a fixed-cell">{row.a}</th>
                <th className="sticky-col sticky-col-b fixed-cell">{row.b}</th>
                {Array.from({ length: 200 }, (_, index) => {
                  const turn = index + 1;
                  if (row.row === 1) {
                    return (
                      <th className="fixed-cell diary-title-cell" key={turn}>
                        {turn === 1 ? "DIARIO" : ""}
                      </th>
                    );
                  }

                  if (row.row === 2) {
                    return (
                      <th className="fixed-cell diary-turn-cell" key={turn}>
                        {ordinal(turn)}
                      </th>
                    );
                  }

                  if (row.row === 3) {
                    return <th className="fixed-cell" key={turn} />;
                  }

                  return (
                    <td className="editable-cell diary-edit-cell" key={turn}>
                      <textarea
                        value={diary.cells[`${row.row}:${turn}`] ?? ""}
                        maxLength={1000}
                        onChange={(event) => updateCell(row.row, turn, event.currentTarget.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
