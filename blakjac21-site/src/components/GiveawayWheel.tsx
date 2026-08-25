"use client";

import { useMemo } from "react";
import styles from "./GiveawayWheel.module.css";

const SEGMENT_COLORS = [
  "#0a3a4a",
  "#0d5568",
  "#117a92",
  "#0bb4e0",
  "#22e0ff",
  "#065a6e",
  "#1490ab",
  "#1ac8e6",
];

type GiveawayWheelProps = {
  names: string[];
  rotationDeg: number;
  spinning: boolean;
  winner: string | null;
};

export function GiveawayWheel({
  names,
  rotationDeg,
  spinning,
  winner,
}: GiveawayWheelProps) {
  const slices = useMemo(() => {
    if (names.length === 0) {
      return [{ name: "Waiting…", color: SEGMENT_COLORS[0] }];
    }
    return names.map((name, index) => ({
      name,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
    }));
  }, [names]);

  const count = slices.length;
  const segment = 360 / count;

  const gradient = slices
    .map((slice, index) => {
      const start = index * segment;
      const end = (index + 1) * segment;
      return `${slice.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className={styles.wrap}>
      <div className={styles.pointer} aria-hidden />
      <div className={styles.rim}>
        <div
          className={styles.disk}
          style={{
            background: `conic-gradient(from -90deg, ${gradient})`,
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning
              ? "transform 5.5s cubic-bezier(0.12, 0.75, 0.08, 1)"
              : "none",
          }}
          aria-hidden
        >
          {slices.map((slice, index) => {
            const mid = -90 + index * segment + segment / 2;
            const label = slice.name.length > 12
              ? `${slice.name.slice(0, 11)}…`
              : slice.name;
            return (
              <span
                key={`${slice.name}-${index}`}
                className={styles.label}
                style={{
                  transform: `rotate(${mid}deg) translateY(-42%)`,
                }}
              >
                <span
                  className={styles.labelText}
                  style={{
                    transform: `rotate(${segment > 28 ? 0 : 90}deg)`,
                    fontSize: count > 18 ? "0.55rem" : count > 10 ? "0.62rem" : "0.72rem",
                  }}
                >
                  {label}
                </span>
              </span>
            );
          })}
        </div>
        <div className={styles.hub}>
          <span className={styles.hubText}>WIN</span>
        </div>
      </div>

      <p className={styles.result} aria-live="polite">
        {spinning
          ? "Spinning…"
          : winner
            ? (
              <>
                Winner: <strong>@{winner}</strong>
              </>
              )
            : names.length === 0
              ? "Need entrants to roll"
              : "Ready to roll"}
      </p>
    </div>
  );
}

/** Rotation that lands segment `index` under the top pointer. */
export function rotationForWinner(
  index: number,
  count: number,
  currentRotation: number,
): number {
  if (count <= 0) return currentRotation;
  const segment = 360 / count;
  // Segments painted from -90deg (top). Center of index i is at i*segment + segment/2
  // from the top when rotation is 0. Positive CSS rotate moves that center clockwise.
  // Pointer is fixed at top, so we need rotation R where (center + R) % 360 === 0
  // → R ≡ -center (mod 360)
  const center = index * segment + segment / 2;
  const targetMod = ((360 - center) % 360 + 360) % 360;
  const currentMod = ((currentRotation % 360) + 360) % 360;
  const delta = (targetMod - currentMod + 360) % 360;
  const spins = 5 + Math.floor(Math.random() * 3); // 5–7 full turns
  return currentRotation + spins * 360 + delta;
}
