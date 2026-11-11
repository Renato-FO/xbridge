import { describe, expect, it } from "vitest";
import {
  decodeWindowsJoystick,
  decodeWindowsJoysticks,
  mapPreview,
} from "../../src/devices/windows-joystick.js";
import { controls, defaultMapping, validateMapping } from "../../src/ui/contracts.js";
const neutral = { connected: true, buttons: 0, pov: 65535, axes: [0.5, 0.5, 0.5, 0.5, 0, 0] };
describe("Windows joystick preview", () => {
  it("decodes each Windows button and every D-pad direction independently", () => {
    const names = [
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
    ];
    names.forEach((name, index) => {
      const input = decodeWindowsJoystick({ ...neutral, buttons: 1 << index });
      expect(input?.[name]).toBe(1);
      expect(names.filter((other) => input?.[other] === 1)).toEqual([name]);
    });
    const expected = [
      ["Up"],
      ["Up", "Right"],
      ["Right"],
      ["Right", "Down"],
      ["Down"],
      ["Down", "Left"],
      ["Left"],
      ["Left", "Up"],
    ];
    expected.forEach((directions, index) => {
      const input = decodeWindowsJoystick({ ...neutral, pov: index * 4500 });
      expect(
        ["Up", "Down", "Left", "Right"]
          .filter((direction) => input?.[`D-pad ${direction}`] === 1)
          .sort(),
      ).toEqual([...directions].sort());
    });
  });
  it("maps all 22 physical controls including axes, triggers and D-pad", () => {
    expect(controls).toHaveLength(22);
    expect(validateMapping(defaultMapping)).toEqual(defaultMapping);
    const input = decodeWindowsJoystick({
      ...neutral,
      buttons: 2,
      pov: 4500,
      axes: [1, 0, 0.5, 1, 0.25, 1],
    });
    expect(input).toMatchObject({
      Cross: 1,
      "D-pad Up": 1,
      "D-pad Right": 1,
      "Left X": 1,
      "Left Y": -1,
      "Right Y": 1,
      L2: 0.25,
      R2: 1,
    });
    expect(mapPreview(input ?? {}, defaultMapping)).toMatchObject({
      A: 1,
      "D-pad Up": 1,
      "D-pad Right": 1,
      LT: 0.25,
      RT: 1,
      "Left X": 1,
      "Left Y": -1,
    });
  });
  it("changes live destinations, disables inputs, and thresholds analog-to-button assignments", () => {
    expect(
      mapPreview(
        { Cross: 1, L2: 0.8, "Left X": -0.7 },
        { ...defaultMapping, Cross: "Disabled", L2: "B", "Left X": "Right X" },
      ),
    ).toMatchObject({ B: 1, "Right X": -0.7 });
    expect(mapPreview({ L2: 0.2 }, { ...defaultMapping, L2: "B" })["B"]).toBe(0);
  });
  it("clears disconnected input and rejects malformed native messages", () => {
    expect(decodeWindowsJoystick({ connected: false })).toBeUndefined();
    for (const value of [
      null,
      {},
      { ...neutral, buttons: -1 },
      { ...neutral, axes: [NaN] },
      { ...neutral, pov: 36000 },
    ])
      expect(() => decodeWindowsJoystick(value)).toThrow();
  });
  it("rejects analog axis assignments to buttons", () => {
    expect(() => validateMapping({ ...defaultMapping, "Left X": "A" })).toThrow();
  });
});
describe("multiple Windows joysticks", () => {
  it("decodes every connected controller by its joystick ID", () => {
    const inputs = decodeWindowsJoysticks({
      controllers: [
        { ...neutral, id: 0, buttons: 2 },
        { ...neutral, id: 3, buttons: 4 },
      ],
    });
    expect(inputs.map((controller) => controller.id)).toEqual([0, 3]);
    expect(inputs[0]?.input["Cross"]).toBe(1);
    expect(inputs[1]?.input["Circle"]).toBe(1);
    expect(decodeWindowsJoysticks({ controllers: [] })).toEqual([]);
  });
  it("rejects malformed lists, duplicate IDs and out-of-range IDs", () => {
    for (const value of [
      null,
      {},
      { controllers: {} },
      { controllers: [{ ...neutral }] },
      { controllers: [{ ...neutral, id: 16 }] },
      { controllers: [{ ...neutral, id: 1.5 }] },
      {
        controllers: [
          { ...neutral, id: 1 },
          { ...neutral, id: 1 },
        ],
      },
    ])
      expect(() => decodeWindowsJoysticks(value)).toThrow();
  });
});
