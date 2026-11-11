import type { ControlValues, Mapping } from "../ui/contracts.js";

// Standard Windows DS4 layout. The UI exposes every source and destination for verification.
export function decodeWindowsJoystick(value: unknown): ControlValues | undefined {
  if (typeof value !== "object" || value === null || !("connected" in value))
    throw new Error("Invalid joystick message.");
  if (value.connected === false) return undefined;
  if (value.connected !== true) throw new Error("Invalid connection state.");
  if (
    !("buttons" in value) ||
    !Number.isInteger(value.buttons) ||
    typeof value.buttons !== "number" ||
    value.buttons < 0 ||
    value.buttons > 0xffffffff ||
    !("pov" in value) ||
    typeof value.pov !== "number" ||
    !Number.isInteger(value.pov) ||
    !(value.pov === 65535 || (value.pov >= 0 && value.pov < 36000)) ||
    !("axes" in value) ||
    !Array.isArray(value.axes) ||
    value.axes.length !== 6 ||
    value.axes.some(
      (axis: unknown) => typeof axis !== "number" || !Number.isFinite(axis) || axis < 0 || axis > 1,
    )
  )
    throw new Error("Invalid joystick controls.");
  const result: ControlValues = {};
  const buttons = value.buttons;
  [
    "Square",
    "Cross",
    "Circle",
    "Triangle",
    "L1",
    "R1",
    "L2 button",
    "R2 button",
    "Share",
    "Options",
    "L3",
    "R3",
    "PS",
    "Touchpad",
  ].forEach((control, index) => {
    result[control] = (buttons & (1 << index)) !== 0 ? 1 : 0;
  });
  const axes = value.axes as number[];
  ["Left X", "Left Y", "Right X", "Right Y"].forEach((control, index) => {
    result[control] = (axes[index] ?? 0.5) * 2 - 1;
  });
  result["L2"] = axes[4] ?? 0;
  result["R2"] = axes[5] ?? 0;
  const direction = value.pov === 65535 ? -1 : Math.round(value.pov / 4500) % 8;
  result["D-pad Up"] = [7, 0, 1].includes(direction) ? 1 : 0;
  result["D-pad Right"] = [1, 2, 3].includes(direction) ? 1 : 0;
  result["D-pad Down"] = [3, 4, 5].includes(direction) ? 1 : 0;
  result["D-pad Left"] = [5, 6, 7].includes(direction) ? 1 : 0;
  return result;
}
export interface JoystickInput {
  id: number;
  input: ControlValues;
}
// Native monitor message: every connected 054C:05C4 joystick, keyed by its Windows joystick ID.
export function decodeWindowsJoysticks(value: unknown): JoystickInput[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("controllers" in value) ||
    !Array.isArray(value.controllers) ||
    value.controllers.length > 16
  )
    throw new Error("Invalid joystick list.");
  const result: JoystickInput[] = [];
  for (const controller of value.controllers as unknown[]) {
    if (
      typeof controller !== "object" ||
      controller === null ||
      !("id" in controller) ||
      typeof controller.id !== "number" ||
      !Number.isInteger(controller.id) ||
      controller.id < 0 ||
      controller.id > 15 ||
      result.some((other) => other.id === controller.id)
    )
      throw new Error("Invalid joystick ID.");
    const input = decodeWindowsJoystick(controller);
    if (input) result.push({ id: controller.id, input });
  }
  return result;
}
export function mapPreview(input: ControlValues, mapping: Mapping): ControlValues {
  const result: ControlValues = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (target === "Disabled") continue;
    const value = input[source] ?? 0;
    const analog = ["LT", "RT", "Left X", "Left Y", "Right X", "Right Y"].includes(target);
    result[target] = analog
      ? Math.max(-1, Math.min(1, (result[target] ?? 0) + value))
      : Math.max(result[target] ?? 0, value > 0.5 ? 1 : 0);
  }
  for (const [a, b] of [
    ["D-pad Up", "D-pad Down"],
    ["D-pad Left", "D-pad Right"],
  ] as const)
    if (result[a] && result[b]) {
      result[a] = 0;
      result[b] = 0;
    }
  return result;
}
