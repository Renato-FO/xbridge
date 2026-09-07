# XBridge

XBridge is a Windows application for converting supported PlayStation-style HID controllers into virtual Xbox 360 controllers. Protocol support is developed from real device captures; the project does not assume that generic devices use Sony's official report layout.

## Prerequisites

- Windows 10 or 11 x64
- Node.js 24.x and npm 11.x
- .NET 8 SDK (the native bridge targets `net8.0`)

ViGEmBus and HidHide are not required for the current diagnostic foundation. XBridge will never install or configure drivers without an explicit user action.

## Development

```powershell
npm install
npm run typecheck
npm test
npm run lint
npm run build
dotnet test XBridge.slnx
```

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

XBridge provides a live controller tester, saved mappings, raw capture, and real virtual Xbox 360 output through an already-installed ViGEmBus driver. It does not change HidHide settings or install drivers. See [virtual output](docs/virtual-output.md) for operation, verification, and remaining limitations.

## Raw controller capture

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
