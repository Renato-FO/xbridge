import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import HID from "node-hid";
import { NodeHidDeviceProvider } from "../devices/node-hid-device-provider.js";
import { captureReports } from "../diagnostics/capture.js";

async function main(): Promise<void> {
  const [identity, label, output, seconds = "5", ...extra] = process.argv.slice(2);
  if (
    !identity ||
    !/^[0-9a-f]{4}:[0-9a-f]{4}$/i.test(identity) ||
    !label ||
    !/^[a-z0-9-]{1,64}$/.test(label) ||
    !output ||
    extra.length ||
    !Number.isFinite(Number(seconds)) ||
    Number(seconds) < 1 ||
    Number(seconds) > 60
  ) {
    throw new Error("Usage: npm run capture -- VID:PID label output.json [seconds: 1..60]");
  }
  const [vendorId, productId] = identity.split(":").map((value) => Number.parseInt(value, 16));
  const candidates = (await new NodeHidDeviceProvider().listDevices()).filter(
    (device) =>
      device.vendorId === vendorId &&
      device.productId === productId &&
      device.usagePage === 1 &&
      (device.usage === 4 || device.usage === 5),
  );
  const device = candidates[0];
  if (candidates.length !== 1 || !device?.path) {
    throw new Error(
      `Expected exactly one matching gamepad interface; found ${String(candidates.length)}.`,
    );
  }
  const controller = new AbortController();
  const stop = () => {
    controller.abort();
  };
  process.once("SIGINT", stop);
  try {
    const source = await HID.HIDAsync.open(device.path);
    console.log(`Capturing ${identity} (${device.connectionType}), label=${label}; Ctrl+C stops.`);
    const result = await captureReports(
      source,
      device,
      label,
      Math.round(Number(seconds) * 1000),
      controller.signal,
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
    const formats = [
      ...new Set(
        result.reports.map(
          (report) => `${report.hex.slice(0, 2)}:${String(report.hex.length / 2)}`,
        ),
      ),
    ];
    console.log(
      `Saved ${String(result.reports.length)} reports to ${output}; ID:length=${formats.join(", ")}; ${result.stopReason}.`,
    );
    if (!result.reports.length) process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", stop);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
