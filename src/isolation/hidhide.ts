import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Runs HidHideCLI with the given arguments and returns its standard output. */
export type HidHideRunner = (args: readonly string[]) => Promise<string>;

import type { IsolationState } from "../ui/contracts.js";

/** What XBridge changed, persisted so a crash can be undone on the next start. */
interface OwnedChanges {
  devices: string[];
  cloak: boolean;
}

export interface HidDeviceEntry {
  instancePath: string;
  present: boolean;
}

const ds4 = /VID[_&](?:0002)?054C.*PID[_&]05C4/i;

export function defaultHidHideCli(): string | undefined {
  const base = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const cli = join(base, "Nefarius Software Solutions", "HidHide", "x64", "HidHideCLI.exe");
  return existsSync(cli) ? cli : undefined;
}

export function cliRunner(cli: string): HidHideRunner {
  return (args) =>
    new Promise((resolve, reject) => {
      const child = execFile(
        cli,
        [...args],
        { windowsHide: true, timeout: 10_000 },
        (error, stdout, stderr) => {
          if (error) reject(new Error(stderr.trim() || error.message));
          else resolve(stdout);
        },
      );
      // The CLI keeps reading further commands from stdin; closing it makes it exit.
      child.stdin?.end();
    });
}

/** Parse `--dev-all` JSON into flat HID interface entries. */
export function parseDevices(output: string): HidDeviceEntry[] {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error("Unexpected HidHide device list.");
  const entries: HidDeviceEntry[] = [];
  for (const group of parsed as unknown[]) {
    if (typeof group !== "object" || group === null || !("devices" in group)) continue;
    const devices = group.devices;
    if (!Array.isArray(devices)) continue;
    for (const device of devices as unknown[]) {
      if (typeof device !== "object" || device === null) continue;
      const record = device as Record<string, unknown>;
      const instancePath = record["deviceInstancePath"];
      if (typeof instancePath === "string")
        entries.push({ instancePath, present: record["present"] === true });
    }
  }
  return entries;
}

/** Parse `--app-list` / `--dev-list` output: one `--flag "value"` per line. */
export function parseQuotedList(output: string): string[] {
  return [...output.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "").filter(Boolean);
}

export function isSourceController(instancePath: string): boolean {
  return ds4.test(instancePath);
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Hides the physical DualShock 4 from games while Xbox output runs, so games see only the
 * virtual Xbox controller. Only changes XBridge made are undone; other HidHide entries stay.
 */
export class InputIsolation {
  private state: IsolationState;
  private owned: OwnedChanges = { devices: [], cloak: false };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly run: HidHideRunner | undefined,
    private readonly allowedApps: readonly string[],
    private readonly stateFile: string,
  ) {
    this.state = run
      ? { status: "off", hidden: 0, detail: "" }
      : { status: "unavailable", hidden: 0, detail: "HidHide não está instalado." };
  }
  get current(): IsolationState {
    return { ...this.state };
  }
  get active(): boolean {
    return this.owned.devices.length > 0 || this.owned.cloak;
  }
  /** Serialise every HidHide operation so acquire/release never interleave. */
  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }
  /** Hide every connected source controller that is not hidden yet. */
  acquire(): Promise<IsolationState> {
    return this.exclusive(async () => {
      const run = this.run;
      if (!run) return this.current;
      try {
        if ((await run(["--inv-state"])).includes("--inv-on")) {
          this.state = {
            status: "failed",
            hidden: this.owned.devices.length,
            detail:
              "O HidHide está em modo de lista invertida; o XBridge não altera essa configuração.",
          };
          return this.current;
        }
        const apps = parseQuotedList(await run(["--app-list"]));
        const hidden = parseQuotedList(await run(["--dev-list"]));
        const cloakOn = (await run(["--cloak-state"])).includes("--cloak-on");
        const sources = parseDevices(await run(["--dev-all"]))
          .filter((device) => device.present && isSourceController(device.instancePath))
          .map((device) => device.instancePath);
        const toHide = sources.filter((path) => !hidden.some((entry) => same(entry, path)));
        const args: string[] = [];
        for (const app of this.allowedApps)
          if (!apps.some((entry) => same(entry, app))) args.push("--app-reg", app);
        for (const path of toHide) args.push("--dev-hide", path);
        const willCloak = !cloakOn && (toHide.length > 0 || this.owned.devices.length > 0);
        if (willCloak) args.push("--cloak-on");
        // Record intent before changing anything, so a crash mid-way can still be undone.
        const next: OwnedChanges = {
          devices: [...this.owned.devices, ...toHide],
          cloak: this.owned.cloak || willCloak,
        };
        if (toHide.length > 0 || willCloak) await this.persist(next);
        if (args.length > 0) await run(args);
        this.owned = next;
        const covered = sources.length;
        this.state =
          covered > 0
            ? {
                status: "active",
                hidden: this.owned.devices.length,
                detail:
                  toHide.length > 0
                    ? "Controle físico oculto dos jogos. Se um jogo já estava aberto, reinicie-o."
                    : "Controle físico oculto dos jogos.",
              }
            : {
                status: "failed",
                hidden: this.owned.devices.length,
                detail: "O HidHide não encontrou o controle físico para ocultar.",
              };
      } catch (error) {
        this.state = {
          status: "failed",
          hidden: this.owned.devices.length,
          detail: `Falha ao configurar o HidHide: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      return this.current;
    });
  }
  /** Undo only XBridge's own hiding so the controller works normally again. */
  release(detail = "", status: "off" | "failed" = "off"): Promise<IsolationState> {
    return this.exclusive(async () => {
      try {
        await this.undo(this.owned);
        this.owned = { devices: [], cloak: false };
        if (this.run) this.state = { status, hidden: 0, detail };
      } catch (error) {
        // The state file is kept, so the next start retries the undo.
        this.state = {
          status: "failed",
          hidden: this.owned.devices.length,
          detail: `Falha ao reexibir o controle no HidHide: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      return this.current;
    });
  }
  /** Undo changes left behind by a previous run that ended without releasing them. */
  recover(): Promise<void> {
    return this.exclusive(async () => {
      let leftover: { devices?: unknown; cloak?: unknown };
      try {
        leftover = JSON.parse(await readFile(this.stateFile, "utf8")) as typeof leftover;
      } catch {
        return;
      }
      await this.undo({
        devices: Array.isArray(leftover.devices)
          ? (leftover.devices as unknown[]).filter((path) => typeof path === "string")
          : [],
        cloak: leftover.cloak === true,
      });
    });
  }
  private async undo(changes: OwnedChanges) {
    const run = this.run;
    if (run && (changes.devices.length > 0 || changes.cloak)) {
      const args: string[] = [];
      for (const path of changes.devices) args.push("--dev-unhide", path);
      if (changes.cloak) {
        // Turn hiding back off only if no other app's devices still rely on it.
        const remaining = parseQuotedList(await run(["--dev-list"])).filter(
          (entry) => !changes.devices.some((path) => same(path, entry)),
        );
        if (remaining.length === 0) args.push("--cloak-off");
      }
      await run(args);
    }
    await rm(this.stateFile, { force: true });
  }
  private async persist(changes: OwnedChanges) {
    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, JSON.stringify(changes));
  }
}
