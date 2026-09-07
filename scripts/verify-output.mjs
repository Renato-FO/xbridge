import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { OutputClient } from "../dist/virtual-controller/output-client.js";
import { toXboxReport } from "../dist/virtual-controller/report.js";
const fake = process.argv.includes("--fake");
const execute = promisify(execFile);
const executable = fileURLToPath(
  new URL("../artifacts/native-output/XBridge.VirtualController.exe", import.meta.url),
);
const client = new OutputClient(fake);
const report = toXboxReport({
  A: 1,
  LB: 1,
  "D-pad Right": 1,
  LT: 0.4,
  RT: 0.8,
  "Left X": 0.5,
  "Left Y": -0.5,
  "Right X": -0.25,
  "Right Y": 0.25,
});
client.setInput(report);
const heartbeat = setInterval(() => client.setInput(report), 50);
const snapshot = async () =>
  JSON.parse((await execute(executable, ["--xinput-state"], { windowsHide: true })).stdout);
try {
  await client.start();
  assert.equal(client.status, "active");
  if (!fake) {
    let observed;
    for (let attempt = 0; attempt < 20; attempt++) {
      observed = (await snapshot()).find((state) => state.index === client.userIndex);
      if (observed && Object.entries(report).every(([key, value]) => observed[key] === value))
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(Number.isInteger(client.userIndex), "Windows must assign an XInput user slot");
    assert.deepEqual(observed, { index: client.userIndex, ...report });
    console.log(
      `XInput slot ${client.userIndex}: buttons, both triggers, and all four axes match mapped output.`,
    );
  }
  await client.stop();
  if (!fake) {
    let removed = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      removed = !(await snapshot()).some((state) => state.index === client.userIndex);
      if (removed) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(removed, "Owned virtual controller must disappear on shutdown");
  }
  console.log(
    `${fake ? "Fake bridge" : "Real ViGEm bridge"}: create/update/shutdown passed; no owned controller left behind.`,
  );
} finally {
  clearInterval(heartbeat);
  await client.stop();
}
