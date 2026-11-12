export const controls = [
  "Cross",
  "Circle",
  "Square",
  "Triangle",
  "L1",
  "R1",
  "L3",
  "R3",
  "Share",
  "Options",
  "PS",
  "Touchpad",
  "D-pad Up",
  "D-pad Down",
  "D-pad Left",
  "D-pad Right",
  "L2",
  "R2",
  "Left X",
  "Left Y",
  "Right X",
  "Right Y",
] as const;
export const outputs = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "Left Stick",
  "Right Stick",
  "Back",
  "Start",
  "Guide",
  "Disabled",
  "D-pad Up",
  "D-pad Down",
  "D-pad Left",
  "D-pad Right",
  "LT",
  "RT",
  "Left X",
  "Left Y",
  "Right X",
  "Right Y",
] as const;
export type Mapping = Record<(typeof controls)[number], (typeof outputs)[number]>;
export type Control = (typeof controls)[number];
export type Output = (typeof outputs)[number];
export type ControlValues = Record<string, number>;
export function choices(control: Control): readonly Output[] {
  if (["Left X", "Left Y", "Right X", "Right Y"].includes(control))
    return ["Left X", "Left Y", "Right X", "Right Y", "Disabled"];
  return outputs.filter((output) => !["Left X", "Left Y", "Right X", "Right Y"].includes(output));
}
export const defaultMapping: Mapping = {
  Cross: "A",
  Circle: "B",
  Square: "X",
  Triangle: "Y",
  L1: "LB",
  R1: "RB",
  L3: "Left Stick",
  R3: "Right Stick",
  Share: "Back",
  Options: "Start",
  PS: "Guide",
  Touchpad: "Disabled",
  "D-pad Up": "D-pad Up",
  "D-pad Down": "D-pad Down",
  "D-pad Left": "D-pad Left",
  "D-pad Right": "D-pad Right",
  L2: "LT",
  R2: "RT",
  "Left X": "Left X",
  "Left Y": "Left Y",
  "Right X": "Right X",
  "Right Y": "Right Y",
};
export function validateMapping(value: unknown): Mapping {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== controls.length
  )
    throw new Error("Invalid mapping.");
  const record = value as Record<string, unknown>;
  for (const control of controls)
    if (!choices(control).some((output) => output === record[control]))
      throw new Error(`Invalid mapping for ${control}.`);
  return Object.fromEntries(controls.map((control) => [control, record[control]])) as Mapping;
}
export type OutputStatus = "stopped" | "starting" | "active";
/** One connected physical controller and its own virtual Xbox output. */
export interface ControllerState {
  id: number;
  input: ControlValues;
  mappedInput: ControlValues;
  outputStatus: OutputStatus;
  outputError: string;
  userIndex?: number;
}
export type IsolationStatus = "unavailable" | "off" | "active" | "failed";
/** Whether the physical controller is hidden from games (HidHide), apart from output status. */
export interface IsolationState {
  status: IsolationStatus;
  hidden: number;
  detail: string;
}
export interface MonitorState {
  isolation?: IsolationState;
  controllers?: ControllerState[];
  connected: boolean;
  name: string;
  count: number;
  bytes: number[];
  error: string;
  capturing: boolean;
  captureResult: string;
  input?: ControlValues;
  inputAvailable?: boolean;
  inputError?: string;
  mappedInput?: ControlValues;
  outputStatus?: OutputStatus;
  outputError?: string;
}
export interface DesktopApi {
  startOutput(): Promise<void>;
  stopOutput(): Promise<void>;
  previewMapping(mapping: Mapping): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  state(): Promise<MonitorState>;
  capture(label: string): Promise<void>;
  loadMapping(): Promise<Mapping>;
  saveMapping(mapping: Mapping): Promise<void>;
}
