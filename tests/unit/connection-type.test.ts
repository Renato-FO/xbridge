import { describe, expect, it } from "vitest";

import { inferConnectionType } from "../../src/devices/connection-type.js";

describe("inferConnectionType", () => {
  it("recognizes Bluetooth paths", () => {
    expect(inferConnectionType("BTHENUM\\DEV_1234")).toBe("bluetooth");
    expect(
      inferConnectionType("HID#{00001124-0000-1000-8000-00805f9b34fb}_VID&0002054c_PID&05c4"),
    ).toBe("bluetooth");
  });

  it("recognizes explicit USB paths", () => {
    expect(inferConnectionType("USB\\VID_1234&PID_5678")).toBe("usb");
  });

  it("does not guess when the path has no transport evidence", () => {
    expect(inferConnectionType("HID\\VID_1234&PID_5678")).toBe("unknown");
    expect(inferConnectionType(undefined)).toBe("unknown");
  });
});
