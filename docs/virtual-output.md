# Virtual Xbox output

XBridge uses the installed ViGEmBus driver through Nefarius.ViGEm.Client 1.21.256. The library is an application dependency; XBridge does not install or configure drivers. The backend is isolated behind `IVirtualOutput`, with a fake implementation for driver-free contract checks.

The client library is MIT-licensed, copyright Nefarius Software Solutions e.U. 2017–2023; source: https://github.com/ViGEm/ViGEm.NET. ViGEmBus is an existing machine prerequisite, not bundled or installed by this change.

## Use

1. Start XBridge with `npm run electron`, wake the DualShock, and verify live input.
2. Edit assignments and click **Save layout**.
3. Click **Start Xbox output** in the header. Wait for **Xbox output active**, then open an XInput game.
4. Click **Stop Xbox output** to remove the virtual controller. Disconnecting the source or exiting also stops output. After a disconnect, reconnect and explicitly start output again.

With HidHide installed, the physical controller is hidden from games while output runs (see [input isolation](input-isolation.md)); without it, a game that reads both devices can receive duplicate input. Rumble forwarding, automatic output restart, and calibration remain pending. Windows joystick input is currently sampled at about 16 ms; the less-than-5-ms latency target has not been met or benchmarked.

The drawings preview current edits. Games receive the last saved layout; saving while output is active applies the updated layout on the next input event. Y axes are inverted when converted to XInput's positive-up coordinate system. Trigger values are scaled to 0–255, stick axes to signed 16-bit values, and buttons to the Xbox mask.

## Protocol and lifecycle

`--output` selects ViGEm; `--output-fake` selects the fake backend. A long-lived child process exchanges JSON Lines with the main process. All messages use `version: 1`. The host emits `ready`; requests carry a positive `id` and `type` (`start`, `update`, or `shutdown`), and receive an `ack` or `error` with the same ID. Update messages include `report` with `buttons`, `lt`, `rt`, `lx`, `ly`, `rx`, and `ry`. Numeric ranges are validated before calling the driver. An assigned XInput slot is returned as `userIndex` when Windows makes it available.

The client keeps at most one update in flight, coalesces unchanged reports, and sends periodic heartbeats. Stale physical input stops the client output after 500 ms. The native host removes its target after one second without commands or on EOF, malformed commands, explicit shutdown, or controlled process exit. Only the target owned by this process is disconnected. Backend failure leaves the physical controller visible.

## Verification

After building the TypeScript and native projects:

```powershell
node scripts/verify-output.mjs --fake
node scripts/verify-bridge-safety.mjs
node scripts/verify-output.mjs
```

The last command requires ViGEmBus and creates one temporary virtual controller. It drives a synthetic mapped report, reads that exact owned slot through Windows `XInputGetState`, checks buttons/triggers/axes, disconnects, and verifies that the slot disappears. It does not require controller movement or a game. The fake and safety scripts do not create virtual devices. No web servers are used.

On September 7, 2026, real verification passed in XInput slot 0 for buttons, both triggers, all four axes, and removal. The desktop test also activated and stopped output while the `054C:05C4` Bluetooth controller was connected. Individual physical button/axis travel and gameplay still require manual verification; these checks do not establish full game compatibility, USB support, or rumble support.
