"use client";

import { ArrowUpRight } from "lucide-react";

type FactionIconProps = {
  factionName?: string | null;
  className?: string;
};

type FactionIconLabelProps = {
  player: {
    factionName: string;
    colorHex?: string | null;
  };
};

function WeaponIcon({ kind }: { kind: "spear" | "halberd" }) {
  return (
    <svg className="faction-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19L18.5 5.5" />
      <path d="M16 4L20 4L20 8" />
      {kind === "spear" ? (
        <path d="M18.5 5.5L20.5 3.5L20 8" />
      ) : (
        <>
          <path d="M14.5 7.5C17 8 19 9.8 20 12" />
          <path d="M13 9L18 14" />
        </>
      )}
      <path d="M4 20L8 18.5" />
    </svg>
  );
}

export function FactionIcon({ factionName, className = "" }: FactionIconProps) {
  const normalizedFaction = (factionName ?? "").toLowerCase();
  const iconLabel = factionName ?? "Faccion";

  if (normalizedFaction.includes("altos")) {
    return (
      <span className={`faction-icon ${className}`} aria-label={iconLabel} title={iconLabel}>
        <WeaponIcon kind="spear" />
      </span>
    );
  }

  if (normalizedFaction.includes("oscuros")) {
    return (
      <span className={`faction-icon ${className}`} aria-label={iconLabel} title={iconLabel}>
        <WeaponIcon kind="halberd" />
      </span>
    );
  }

  return (
    <span className={`faction-icon ${className}`} aria-label={iconLabel} title={iconLabel}>
      <ArrowUpRight className="faction-icon-svg" aria-hidden="true" />
    </span>
  );
}

export function FactionIconLabel({ player }: FactionIconLabelProps) {
  return (
    <span className="faction-icon-label">
      <FactionIcon factionName={player.factionName} />
      <span>{player.factionName}</span>
    </span>
  );
}
