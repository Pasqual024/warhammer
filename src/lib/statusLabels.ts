export const PHASE_STATE_LABELS: Record<string, string> = {
  movement_open: "Introduccion de movimientos",
  waiting_for_players: "Esperando jugadores",
  calculating_results: "Calculando resultados",
  results_available: "Resultados disponibles",
  encounters_pending: "Encuentros pendientes",
  phase_closed: "Fase cerrada"
};

export const ENCOUNTER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  resolved: "Resuelto",
  cancelled: "Cancelado"
};
