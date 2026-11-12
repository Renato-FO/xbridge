# XBridge

Map a PlayStation-style controller to a virtual Xbox 360 controller for Windows games that use XInput.

XBridge combines a live controller tester, customizable mappings, raw HID capture, and virtual Xbox output in an Electron desktop app, backed by TypeScript and a small C#/.NET bridge. Protocol support is developed from real device captures; generic controllers are not assumed to use Sony's official report layout.

**Status: early development.** The desktop app currently targets one `054C:05C4` gamepad. Bluetooth input and virtual Xbox output have been checked on the development controller. Full physical-control and gameplay verification is pending; other controller models and USB operation are not yet verified.

## Quick start

Install the prerequisites below, then run these commands in PowerShell on Windows:

```powershell
git clone https://github.com/Renato-FO/xbridge.git
cd xbridge
npm ci
npm run electron
```

The launch command builds the native bridge and desktop app before opening Electron.

1. Connect your supported controller through Windows and press **PS** to wake it. Use **Reconnect** if needed.
2. Verify every button, D-pad direction, stick, and trigger against the live drawings.
3. Select a physical control and choose its Xbox destination from the assignment menu or Xbox drawing.
4. Click **Save layout**. Unsaved edits only affect the preview; games use the saved layout.
5. With ViGEmBus installed, click **Start Xbox output**, wait for **Xbox output active**, and open your game.

Click **Stop Xbox output** to remove the virtual controller. Closing the window keeps XBridge running in the tray; choose **Exit** from the tray to quit.

## Prerequisites

- Windows 10 or 11 x64
- Node.js 24.x and npm 11.x
- .NET 8 SDK (the native bridge targets `net8.0`)
- Git for cloning the repository
- [ViGEmBus](https://github.com/nefarius/ViGEmBus) installed separately for virtual Xbox output

ViGEmBus is not required for diagnostics or the live tester. It is discontinued, and XBridge isolates its output backend to allow future replacement. XBridge does not install or configure drivers or change HidHide settings.

## Development

```powershell
npm ci
npm run typecheck
npm test
npm run lint
npm run build:native
npm run build
dotnet test native/XBridge.VirtualController.Tests/XBridge.VirtualController.Tests.csproj
```

The direct test-project command works with the .NET 8 SDK. To use `dotnet test XBridge.slnx` instead, use an SDK with `.slnx` support (.NET 9.0.200 or newer). The native bridge still requires the .NET 8 runtime.

After building, run driver-free output and shutdown checks:

```powershell
node scripts/verify-output.mjs --fake
node scripts/verify-bridge-safety.mjs
```

See [virtual output verification](docs/virtual-output.md#verification) for the hardware-dependent check that creates a temporary virtual Xbox controller.

## Distribution

`npm run package` builds a Windows installer and a portable executable in `release/`:

- `XBridge-<version>-x64.exe`: installer with Start-menu and desktop shortcuts.
- `XBridge-<version>-portable.exe`: a single executable that runs without installing.

The .NET bridge is published self-contained, so end users need no .NET runtime. They still need the [ViGEmBus](https://github.com/nefarius/ViGEmBus/releases) driver for Xbox output. Builds are unsigned, so Windows SmartScreen warns on first launch. `npm run package:dir` produces just the unpacked app in `release/win-unpacked/` for a quick test. After editing `build/icon.svg`, run `npm run build:icons` to regenerate `build/icon.ico` and `build/icon.png`.

XBridge requires Windows APIs and local device access, so GitHub Pages cannot host the application. Use the quick start to run it locally.

## Troubleshooting

| Symptom                                   | What to check                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller not detected                   | Wake it with PS, confirm the Windows connection, click **Reconnect**, and run `npm run diagnostics`. The desktop expects exactly one `054C:05C4` gamepad. |
| Xbox output cannot start                  | Confirm ViGEmBus is installed and the source controller is connected. See [virtual output](docs/virtual-output.md).                                       |
| Game receives duplicate input             | The physical controller remains visible. Select the virtual Xbox controller in the game if supported.                                                     |
| Mapping edits do not affect the game      | Click **Save layout** to apply the preview to output.                                                                                                     |
| App stays active after closing the window | Choose **Exit** from the system tray to stop output and quit.                                                                                             |
| Native build or launch fails              | Check `dotnet --list-sdks` and `dotnet --list-runtimes` for a compatible SDK and the .NET 8 runtime, then rerun `npm run build:native`.                   |

## Contributing

[Open an issue](https://github.com/Renato-FO/xbridge/issues) with your Windows version, controller VID/PID, connection type, reproduction steps, and relevant error messages. Review raw captures for identifiers before attaching them.

Keep pull requests focused and run the relevant development checks. Protocol changes should be supported by labeled hardware captures rather than assumed report layouts.

## Read-only HID diagnostics

List HID interfaces in a readable format:

```powershell
npm run diagnostics
```

Emit versioned JSON suitable for inspection or later capture tooling:

```powershell
npm run diagnostics -- --json
```

Some HID metadata, including report sizes and report descriptors, is not exposed by `node-hid` during Windows enumeration. XBridge reports those fields as unavailable rather than guessing them.

## Current scope

Exclusive Xbox input is a final-release requirement: see [input isolation setup, recovery, and acceptance](docs/input-isolation.md) and `codex.md`. Guided HidHide installation and automatic hiding lifecycle are not implemented in the app yet; installing the driver alone does not complete this feature.

XBridge provides a live controller tester, saved mappings, raw capture, and real virtual Xbox 360 output through an already-installed ViGEmBus driver. It does not change HidHide settings or install drivers. See [virtual output](docs/virtual-output.md) for operation, verification, and remaining limitations.

## Raw controller capture

See the [controller capture guide](docs/controller-capture.md) for the full procedure and artifact format.

With exactly one matching controller awake and connected, hold the labeled control state and run:

```powershell
npm run capture -- 054c:05c4 neutral artifacts/captures/bt-neutral.json 5
```

Use a separate file and label for each control (see `docs/controller-capture.md`). Use `unlabeled` when the state is not known. Capture stops after the requested duration (1–60 seconds), 2,000 reports, or Ctrl+C. Existing files are never overwritten. Each report is bounded to 4,096 bytes. No output or feature reports are sent to the controller.

The version 1 JSON artifact contains numeric VID/PID, connection type, usage metadata, descriptor availability, a label, stop reason, and reports with monotonic elapsed milliseconds and raw hexadecimal bytes. Device paths and serial numbers are excluded from capture metadata; raw payloads may still contain identifiers and must be reviewed before sharing. Captures remain in ignored `artifacts/`. Fixture import validation is still pending.

On September 7, 2026, enumeration observed `054C:05C4`, Wireless Controller, Sony Computer Entertainment, usage page 1 / usage 5, with a Windows Bluetooth HID service path. After reconnection, a five-second capture received 438 identical buffers, each 547 bytes with report ID `01`. The first 32 bytes were `0180808080080008000000000000000000000000000000000000000000000000`; all subsequent bytes were zero. The capture is unlabeled: neutral state and control offsets are not yet verified. Summarize captures locally with `node scripts/summarize-capture.mjs artifacts/captures/bluetooth-initial.json`.

## Desktop controller lab

Run `npm run electron` (builds the native reader and desktop), then press PS. XBridge connects automatically; use **Reconnect** after waking a disconnected controller. The interface targets exactly one `054C:05C4` gamepad and permits only one app instance. It displays interactive DualShock and Xbox 360 drawings, live button highlights, moving sticks, trigger meters, and 22 physical-to-Xbox assignments. Select a physical control, then choose its destination in the assignment menu or by clicking the Xbox drawing. The five control groups cover face buttons, D-pad, shoulders/triggers, sticks/axes, and system buttons. **Save layout** persists the preview; **Reset defaults** restores the standard assignments as an unsaved draft. Duplicate destinations are explained, and incompatible axis-to-button mappings are rejected.

Live input comes from the Windows joystick API in a small native child process. The main process validates and maps decoded Windows values; the renderer only displays snapshots. This does not assume Bluetooth report offsets. The Windows DS4 button/axis layout is a preset and must be checked on hardware variants. On the connected Bluetooth controller, the live reader verified centered axes, released triggers/buttons, and neutral D-pad. Verify each physical button, all D-pad directions, stick extrema, and trigger travel against both drawings before treating the layout as fully hardware-verified.

Mappings are saved as `mapping.json` in Electron's XBridge user-data directory (normally `%APPDATA%/xbridge`). Captures are saved in its `captures` subfolder, bounded to 2,000 reports of at most 4,096 bytes. Start by recording `neutral` with all controls released, then record each individual control using the label suggestions. Capture files are never overwritten. Raw report payloads must still be reviewed before sharing.

Click **Start Xbox output** to create a virtual Xbox 360 controller driven by the saved layout. Save edits to apply them to games; unsaved edits only affect the drawings. **Stop Xbox output**, source disconnection, and app exit remove the owned virtual controller. The physical controller remains visible, so some games may receive duplicate input. Axis calibration, rumble, automatic output restart, and HidHide setup remain pending. Closing the window keeps the app in the tray; use **Exit** to stop the native processes and quit. Raw capture is under **Advanced diagnostics**.

Desktop verification: `npm run build:native`, `npm run build`, then `npx electron scripts/smoke-desktop.cjs` with the regular app closed. This opens one temporary window, verifies both drawings, all 22 assignments, click-to-remap behavior, and preload, attempts a read-only hardware connection, saves `artifacts/desktop.png`, disconnects, and exits. The latest September 7, 2026 check confirmed decoded Windows input alongside 90 Bluetooth reports with no read errors. Hardware absence is reported separately from desktop failures. Tests need no web server.
