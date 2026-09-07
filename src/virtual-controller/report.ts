import type { ControlValues } from "../ui/contracts.js";
export interface XboxReport {
  buttons: number;
  lt: number;
  rt: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}
const buttonBits: Record<string, number> = {
  "D-pad Up": 1,
  "D-pad Down": 2,
  "D-pad Left": 4,
  "D-pad Right": 8,
  Start: 16,
  Back: 32,
  "Left Stick": 64,
  "Right Stick": 128,
  LB: 256,
  RB: 512,
  Guide: 1024,
  A: 4096,
  B: 8192,
  X: 16384,
  Y: 32768,
};
export function toXboxReport(input: ControlValues): XboxReport {
  const number = (name: string) => {
    const value = input[name] ?? 0;
    if (!Number.isFinite(value)) throw new Error("Non-finite controller input.");
    return value;
  };
  const axis = (name: string, invert = false) => {
    const value = Math.max(-1, Math.min(1, number(name) * (invert ? -1 : 1)));
    return Math.round(value * (value < 0 ? 32768 : 32767));
  };
  const trigger = (name: string) => Math.round(Math.max(0, Math.min(1, number(name))) * 255);
  let buttons = 0;
  for (const [name, bit] of Object.entries(buttonBits)) if (number(name) > 0.5) buttons |= bit;
  return {
    buttons,
    lt: trigger("LT"),
    rt: trigger("RT"),
    lx: axis("Left X"),
    ly: axis("Left Y", true),
    rx: axis("Right X"),
    ry: axis("Right Y", true),
  };
}
