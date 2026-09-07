import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const executable = fileURLToPath(
  new URL("../artifacts/native-output/XBridge.VirtualController.exe", import.meta.url),
);
const child = spawn(executable, ["--output-fake"], { windowsHide: true, stdio: "pipe" });
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
const receive = async () => {
  let timer;
  try {
    const line = await Promise.race([
      lines.next(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Bridge safety test timed out")), 3000);
      }),
    ]);
    assert.equal(line.done, false);
    return JSON.parse(line.value);
  } finally {
    clearTimeout(timer);
  }
};
const send = (id, type, report) =>
  child.stdin.write(JSON.stringify({ version: 1, id, type, report }) + "\n");
try {
  assert.equal((await receive()).type, "ready");
  send(1, "start");
  assert.equal((await receive()).type, "ack");
  send(2, "update", { buttons: 999999, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
  assert.equal((await receive()).type, "error");
  send(3, "start");
  assert.equal((await receive()).type, "ack");
  const timeout = await receive();
  assert.equal(timeout.id, 0);
  assert.match(timeout.message, /heartbeat timed out/);
  send(4, "update", { buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 });
  assert.equal((await receive()).type, "error");
  send(5, "start");
  assert.equal((await receive()).type, "ack");
  const closed = new Promise((resolve) => child.once("close", resolve));
  child.stdin.end();
  assert.equal(await closed, 0);
  console.log(
    "Bridge safety passed: invalid reports rejected, stalled input disconnects output, EOF exits cleanly.",
  );
} finally {
  if (child.exitCode === null) child.kill();
}
