import type { HidDeviceDescriptor } from "../devices/hid-device.js";

function hex(value: number): string {
  return `0x${value.toString(16).padStart(4, "0").toUpperCase()}`;
}

function available(value: string | number | undefined): string {
  return value === undefined || value === "" ? "unavailable" : String(value);
}

function formatIndex(index: number): string {
  return String(index + 1);
}

export function formatDeviceList(devices: readonly HidDeviceDescriptor[]): string {
  if (devices.length === 0) {
    return "No HID devices found.";
  }

  return devices
    .map((device, index) =>
      [
        `[${formatIndex(index)}] ${available(device.product)}`,
        `  VID: ${hex(device.vendorId)}  PID: ${hex(device.productId)}`,
        `  Manufacturer: ${available(device.manufacturer)}`,
        `  Serial number: ${available(device.serialNumber)}`,
        `  Usage page: ${available(device.usagePage)}  Usage: ${available(device.usage)}`,
        `  Interface: ${available(device.interfaceNumber)}`,
        `  Connection: ${device.connectionType}`,
        `  Input report bytes: ${available(device.inputReportByteLength)}`,
        `  Output report bytes: ${available(device.outputReportByteLength)}`,
        `  Feature report bytes: ${available(device.featureReportByteLength)}`,
        `  Report descriptor: ${device.reportDescriptorAvailable ? "available" : "unavailable"}`,
        `  Path: ${available(device.path)}`,
      ].join("\n"),
    )
    .join("\n\n");
}
