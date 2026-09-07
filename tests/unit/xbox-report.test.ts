import { expect, it } from "vitest";
import { toXboxReport } from "../../src/virtual-controller/report.js";
it("encodes all Xbox buttons, clamps axes/triggers, and reverses Y for XInput", () => {
  expect(
    toXboxReport({
      A: 1,
      B: 1,
      X: 1,
      Y: 1,
      LB: 1,
      RB: 1,
      Guide: 1,
      Start: 1,
      Back: 1,
      "Left Stick": 1,
      "Right Stick": 1,
      "D-pad Up": 1,
      "D-pad Down": 1,
      "D-pad Left": 1,
      "D-pad Right": 1,
      LT: -1,
      RT: 2,
      "Left X": -1,
      "Left Y": -1,
      "Right X": 1,
      "Right Y": 1,
    }),
  ).toEqual({ buttons: 0xf7ff, lt: 0, rt: 255, lx: -32768, ly: 32767, rx: 32767, ry: -32768 });
  expect(() => toXboxReport({ LT: NaN })).toThrow();
});
