import type { HidConnectionType } from "./hid-device.js";

export function inferConnectionType(path: string | undefined): HidConnectionType {
  if (path === undefined) {
    return "unknown";
  }

  const normalizedPath = path.toLowerCase();

  if (
    normalizedPath.includes("bthenum") ||
    normalizedPath.includes("bluetooth") ||
    normalizedPath.includes("{00001124-0000-1000-8000-00805f9b34fb}")
  ) {
    return "bluetooth";
  }

  if (normalizedPath.includes("usb")) {
    return "usb";
  }

  return "unknown";
}
