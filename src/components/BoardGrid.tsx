"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, WheelEvent } from "react";
import type { BoardCell } from "@/lib/gameEngine";

type BoardGridProps = {
  cells: BoardCell[];
  selectedCellIds: string[];
  encounterCellIds?: string[];
  factionColor?: string | null;
  locked: boolean;
  debug?: boolean;
  onToggleCell: (cellId: string) => void;
};

type BoardTransform = {
  x: number;
  y: number;
  scale: number;
};

type RenderableCell = {
  cell: BoardCell;
  x: number;
  y: number;
  points: string;
};

const MAP_WIDTH = 2968;
const MAP_HEIGHT = 3044;
const BASE_MAP_WIDTH = 1996;
const BASE_MAP_HEIGHT = 2048;
const SCALE_X = MAP_WIDTH / BASE_MAP_WIDTH;
const SCALE_Y = MAP_HEIGHT / BASE_MAP_HEIGHT;
const MAX_ZOOM_MULTIPLIER = 5;
const DRAG_THRESHOLD = 5;

const GRID = {
  originX: 3 * SCALE_X,
  originY: 0,
  stepX: 111 * SCALE_X,
  stepY: 128 * SCALE_Y,
  oddColumnOffsetY: 64 * SCALE_Y
};

const HEX_POINTS = [
  [-74 * SCALE_X, 0],
  [-37 * SCALE_X, -64 * SCALE_Y],
  [37 * SCALE_X, -64 * SCALE_Y],
  [74 * SCALE_X, 0],
  [37 * SCALE_X, 64 * SCALE_Y],
  [-37 * SCALE_X, 64 * SCALE_Y]
];

const HIDDEN_VISUAL_CELLS = new Set(["A4", "S4", "A35", "S35"]);

function getGridColumn(cell: BoardCell) {
  return cell.col.charCodeAt(0) - "A".charCodeAt(0);
}

function getGridRow(cell: BoardCell, colIndex: number) {
  const rowOffset = cell.row - 4;

  return colIndex % 2 === 0 ? Math.ceil(rowOffset / 2) : Math.floor(rowOffset / 2);
}

function getHexCenter(cell: BoardCell) {
  const colIndex = getGridColumn(cell);
  const rowIndex = getGridRow(cell, colIndex);

  return {
    x: GRID.originX + colIndex * GRID.stepX,
    y: GRID.originY + rowIndex * GRID.stepY + (colIndex % 2 === 1 ? GRID.oddColumnOffsetY : 0)
  };
}

function getHexPoints(x: number, y: number) {
  return HEX_POINTS.map(([pointX, pointY]) => `${x + pointX},${y + pointY}`).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getFitTransform(width: number, height: number): BoardTransform {
  const scale = Math.min(width / MAP_WIDTH, height / MAP_HEIGHT);

  return {
    scale,
    x: (width - MAP_WIDTH * scale) / 2,
    y: (height - MAP_HEIGHT * scale) / 2
  };
}

function clampTransform(transform: BoardTransform, width: number, height: number): BoardTransform {
  const scaledWidth = MAP_WIDTH * transform.scale;
  const scaledHeight = MAP_HEIGHT * transform.scale;
  const x =
    scaledWidth <= width
      ? (width - scaledWidth) / 2
      : clamp(transform.x, width - scaledWidth, 0);
  const y =
    scaledHeight <= height
      ? (height - scaledHeight) / 2
      : clamp(transform.y, height - scaledHeight, 0);

  return { ...transform, x, y };
}

export function BoardGrid({
  cells,
  selectedCellIds,
  encounterCellIds = [],
  factionColor,
  locked,
  debug = false,
  onToggleCell
}: BoardGridProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTransform: BoardTransform;
    isDragging: boolean;
    isCaptured: boolean;
  } | null>(null);
  const transformRef = useRef<BoardTransform>({ x: 0, y: 0, scale: 1 });
  const suppressClickRef = useRef(false);
  const [transform, setTransform] = useState<BoardTransform>({ x: 0, y: 0, scale: 1 });
  const [minScale, setMinScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);

  const selected = useMemo(() => new Set(selectedCellIds), [selectedCellIds]);
  const encounterCells = useMemo(() => new Set(encounterCellIds), [encounterCellIds]);
  const renderableCells = useMemo<RenderableCell[]>(
    () =>
      cells
        .filter((cell) => cell.isActive && !HIDDEN_VISUAL_CELLS.has(cell.id))
        .map((cell) => {
          const { x, y } = getHexCenter(cell);

          return {
            cell,
            x,
            y,
            points: getHexPoints(x, y)
          };
        }),
    [cells]
  );
  const encounterRenderableCells = useMemo(
    () => renderableCells.filter(({ cell }) => encounterCells.has(cell.id)),
    [encounterCells, renderableCells]
  );

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const fitToViewport = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const { width, height } = viewport.getBoundingClientRect();

    if (width <= 0 || height <= 0) {
      return;
    }

    const fit = getFitTransform(width, height);
    setMinScale(fit.scale);
    setTransform(fit);
  }, []);

  useLayoutEffect(() => {
    fitToViewport();

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => fitToViewport());
    resizeObserver.observe(viewport);

    return () => resizeObserver.disconnect();
  }, [fitToViewport]);

  const applyZoom = useCallback(
    (factor: number, centerX?: number, centerY?: number) => {
      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const nextMinScale = minScale || getFitTransform(rect.width, rect.height).scale;
      const current = transformRef.current;
      const nextScale = clamp(current.scale * factor, nextMinScale, nextMinScale * MAX_ZOOM_MULTIPLIER);
      const originX = centerX ?? rect.width / 2;
      const originY = centerY ?? rect.height / 2;
      const boardX = (originX - current.x) / current.scale;
      const boardY = (originY - current.y) / current.scale;

      setTransform(
        clampTransform(
          {
            scale: nextScale,
            x: originX - boardX * nextScale,
            y: originY - boardY * nextScale
          },
          rect.width,
          rect.height
        )
      );
    },
    [minScale]
  );

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.16 : 0.86;

    applyZoom(factor, event.clientX - rect.left, event.clientY - rect.top);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTransform: transformRef.current,
      isDragging: false,
      isCaptured: false
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (!drag.isDragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
      return;
    }

    drag.isDragging = true;
    setIsPanning(true);

    if (!drag.isCaptured) {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.isCaptured = true;
    }

    const rect = viewport.getBoundingClientRect();
    setTransform(
      clampTransform(
        {
          ...drag.startTransform,
          x: drag.startTransform.x + deltaX,
          y: drag.startTransform.y + deltaY
        },
        rect.width,
        rect.height
      )
    );
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (drag.isDragging) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
    }

    setIsPanning(false);
    dragRef.current = null;

    if (drag.isCaptured && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCellClick(cellId: string) {
    if (suppressClickRef.current || locked) {
      return;
    }

    onToggleCell(cellId);
  }

  const zoomStyle = {
    "--faction-color": factionColor ?? "#2563eb",
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
  } as CSSProperties;

  return (
    <div className="board-container" aria-label="Tablero de movimiento">
      <div className="board-toolbar" aria-label="Controles del tablero">
        <button className="icon-button board-zoom-button" type="button" onClick={() => applyZoom(1.25)} aria-label="Acercar">
          +
        </button>
        <button className="icon-button board-zoom-button" type="button" onClick={() => applyZoom(0.8)} aria-label="Alejar">
          -
        </button>
        <button className="text-button compact-toggle" type="button" onClick={fitToViewport}>
          Ver todo
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`board-shell${isPanning ? " is-panning" : ""}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <div className="board-map-frame" style={zoomStyle}>
          <img
            className="board-map-image"
            src="/mapa-campanya-png.png"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <svg
            className={`board-map-overlay${debug ? " debug" : ""}`}
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            role="group"
            aria-label="Mapa hexagonal de movimiento"
            preserveAspectRatio="xMidYMid meet"
          >
            <g className="board-hex-layer">
              {renderableCells.map(({ cell, x, y, points }) => {
                const isSelected = selected.has(cell.id);
                const isPrincipal = cell.zoneTypes.includes("principal");
                const isSecondary = cell.zoneTypes.includes("secondary");
                const className = [
                  "board-hex",
                  isSelected ? "selected" : "",
                  locked ? "locked" : "",
                  isPrincipal ? "principal" : "",
                  isSecondary ? "secondary" : ""
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <g
                    key={cell.id}
                    role={locked ? "img" : "button"}
                    aria-label={cell.id}
                    aria-pressed={locked ? undefined : isSelected}
                    tabIndex={locked ? -1 : 0}
                    className={className}
                    onClick={() => handleCellClick(cell.id)}
                    onKeyDown={(event) => {
                      if (locked) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggleCell(cell.id);
                      }
                    }}
                  >
                    <polygon className="board-hex-shape" points={points} />
                    <text className="board-hex-label" x={x} y={y + 8}>
                      {cell.id}
                    </text>
                  </g>
                );
              })}
            </g>

            {encounterRenderableCells.length > 0 ? (
              <g className="board-encounter-layer" aria-hidden="true">
                {encounterRenderableCells.map(({ cell, points }) => (
                  <polygon className="board-encounter-shape" points={points} key={cell.id} />
                ))}
              </g>
            ) : null}
          </svg>
        </div>
      </div>
    </div>
  );
}
