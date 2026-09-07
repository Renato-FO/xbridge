import { toXBridgeError } from "../application/errors.js";
import { NodeHidDeviceProvider } from "../devices/node-hid-device-provider.js";
import { formatDeviceList } from "../diagnostics/format-device-list.js";

const JSON_FLAG = "--json";

async function main(arguments_: readonly string[]): Promise<void> {
  const unknownArguments = arguments_.filter((argument) => argument !== JSON_FLAG);
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  }

  const provider = new NodeHidDeviceProvider();
  const devices = await provider.listDevices();

  if (arguments_.includes(JSON_FLAG)) {
    console.log(JSON.stringify({ schemaVersion: 1, devices }, null, 2));
    return;
  }

  console.log(formatDeviceList(devices));
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const applicationError = toXBridgeError(error);
  console.error(
    JSON.stringify({
      code: applicationError.code,
      message: applicationError.userMessage,
      detail: applicationError.technicalDetail,
    }),
  );
  process.exitCode = 1;
});
