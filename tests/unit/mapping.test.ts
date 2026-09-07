import { describe, expect, it } from "vitest";
import { defaultMapping, validateMapping } from "../../src/ui/contracts.js";
describe("mapping validation", () => {
  it("accepts remapping and disabling without mutating input", () => {
    const input = { ...defaultMapping, Cross: "B", PS: "Disabled" };
    expect(validateMapping(input)).toEqual(input);
    expect(validateMapping(input)).not.toBe(input);
  });
  it.each([
    null,
    [],
    {},
    { ...defaultMapping, Cross: "invalid" },
    { ...defaultMapping, extra: "A" },
  ])("rejects malformed external configuration", (value) => {
    expect(() => validateMapping(value)).toThrow();
  });
});
