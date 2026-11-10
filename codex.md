XBridge

Release requirement: exclusive virtual Xbox input

The final Windows release must include a guided HidHide prerequisite and setup flow. Explain the driver change and request an explicit install/configure action; verify the official installer signature, report elevation/reboot requirements, and never reboot automatically.

While Xbox output is active, games must receive only the virtual Xbox controller for each managed physical controller. Hide only the identified source gamepad, never keyboards, mice, unrelated controllers, or the virtual Xbox device. Keyboard/mouse input remains available; window focus and the game's input-mode selection are separate from controller isolation.

Allow every XBridge executable that reads the physical device, including the native joystick reader and the desktop HID capture process. Preserve existing HidHide application/device entries and polarity; detect incompatible configuration instead of overwriting it.

Verify that virtual output is connected and the allowed reader can access the source before hiding it. Use process-scoped hiding where the installed HidHide version supports it; otherwise provide owned-state tracking, rollback, and a documented recovery path. Restore only XBridge-owned hiding changes on output stop, disconnect, startup failure, exit, and crash recovery. Do not leave a physical controller unusable when XBridge is not running.

Expose isolation status (unavailable, setup required, active, failed) separately from virtual-output status. Do not claim exclusive output merely because an Xbox virtual device exists. Explain any required controller reconnection or game restart.

Release acceptance must verify from an unprivileged, non-allowed observer that the physical gamepad is inaccessible while the XBridge reader continues receiving it and the virtual Xbox remains visible. In Minecraft for Windows, one Cross/A press must assign once, one Options/Start press must toggle the menu once, and L3 plus forward movement must reach Xbox Left Stick plus forward movement without requiring keyboard input. Verify held buttons, both sticks, triggers, reconnect, stop, exit, crash recovery, and preservation of unrelated HidHide settings. Record hardware/transport and observed results; do not mark gameplay acceptance complete from sampled XInput logs alone.

Investigation on 2026-11-10: physical and virtual devices were simultaneously available; sampled logs showed A, Start, and L3 reaching XInput, including four L3 presses with forward movement. The user observed duplicate menu actions and intermittent sprint behavior. Duplicate physical/virtual input is a working hypothesis pending isolation and gameplay verification, not a proven keyboard/focus defect. HidHide integration is required for release and is not yet implemented in the application.

Project objective

Build a lightweight Windows application that converts generic PlayStation-style controllers into virtual Xbox 360 controllers so they work in games that support XInput.

The initial target is a generic PS4-compatible Bluetooth/USB controller. The implementation must not assume that it uses the exact protocol of an original Sony DualShock 4. Device behavior must be discovered from its VID, PID, HID report descriptor, and input/output reports.

Target platform

Windows 10 and Windows 11, x64.

USB and Bluetooth connections.

One or two controllers connected simultaneously.

Xbox 360/XInput virtual output.

Technology

TypeScript with strict mode.

Node.js for device discovery, HID input processing, mapping, profiles, and application orchestration.

node-hid for HID communication.

A small C#/.NET native bridge for virtual Xbox 360 controller operations.

ViGEmBus as the initial virtual controller driver.

HidHide to hide physical controllers from games and prevent double input.

Electron only for the desktop interface and system tray. The input loop must not run in the renderer process.

ViGEm integration must be isolated behind an interface because ViGEmBus is discontinued and may need to be replaced later.

Architecture

Physical controller
-> HID transport
-> Device-specific report parser
-> Normalized controller state
-> Mapping and calibration
-> Native virtual-controller bridge
-> Virtual Xbox 360 controller
-> XInput game

Main modules

src/
application/ Application lifecycle and orchestration
devices/ HID discovery, connection, and reconnection
protocols/ Device-specific HID report parsers
mapping/ PlayStation-to-Xbox mapping
calibration/ Deadzone, axis range, inversion, and trigger calibration
profiles/ Persistent controller profiles
virtual-controller/ Abstraction over the native bridge
diagnostics/ HID report inspection and structured logs
ui/ Electron interface and tray
native/
XBridge.VirtualController/ C#/.NET bridge
tests/

Controller state model

Every device-specific parser must convert raw reports into a common state:

export interface ControllerState {
buttons: {
south: boolean;
east: boolean;
west: boolean;
north: boolean;
leftBumper: boolean;
rightBumper: boolean;
leftStick: boolean;
rightStick: boolean;
back: boolean;
start: boolean;
guide: boolean;
dpadUp: boolean;
dpadDown: boolean;
dpadLeft: boolean;
dpadRight: boolean;
};
axes: {
leftX: number;
leftY: number;
rightX: number;
rightY: number;
leftTrigger: number;
rightTrigger: number;
};
timestamp: number;
}

Stick values must be normalized to -1..1. Trigger values must be normalized to 0..1.

Default mapping

Physical control

Xbox 360 output

Cross

A

Circle

B

Square

X

Triangle

Y

L1

LB

R1

RB

L2

LT

R2

RT

Share

Back

Options

Start

PS

Guide

L3

Left Stick

R3

Right Stick

D-pad

D-pad

Touchpad movement, speaker, headset audio, accelerometer, and Sixaxis are outside the first version. The touchpad click may be exposed as an optional remappable button.

Functional requirements

Detect supported HID controllers automatically.

Identify devices by VID, PID, product name, report descriptor, and connection type.

Capture raw HID reports in a diagnostics mode.

Support separate USB and Bluetooth report parsers when their packet formats differ.

Create one virtual Xbox 360 controller for each connected physical controller.

Forward buttons, sticks, triggers, and D-pad with low latency.

Forward game rumble to the physical controller when its output protocol is known.

Reconnect automatically without restarting the application.

Apply deadzone and calibration per device.

Save profiles locally.

Start minimized and remain available in the Windows system tray.

Shut down cleanly and remove all virtual controllers.

Never send telemetry or controller data over the network.

Performance requirements

Keep input processing outside the Electron renderer.

Process reports as events; do not use busy-wait loops.

Avoid allocations in the hot input path where practical.

Do not write a log entry for every report unless diagnostics mode is active.

XBridge

Project objective

Build a lightweight Windows application that converts generic PlayStation-style controllers into virtual Xbox 360 controllers so they work in games that support XInput.

The initial target is a generic PS4-compatible Bluetooth/USB controller. The implementation must not assume that it uses the exact protocol of an original Sony DualShock 4. Device behavior must be discovered from its VID, PID, HID report descriptor, and input/output reports.

Target platform

Windows 10 and Windows 11, x64.

USB and Bluetooth connections.

One or two controllers connected simultaneously.

Xbox 360/XInput virtual output.

Technology

TypeScript with strict mode.

Node.js for device discovery, HID input processing, mapping, profiles, and application orchestration.

node-hid for HID communication.

A small C#/.NET native bridge for virtual Xbox 360 controller operations.

ViGEmBus as the initial virtual controller driver.

HidHide to hide physical controllers from games and prevent double input.

Electron only for the desktop interface and system tray. The input loop must not run in the renderer process.

ViGEm integration must be isolated behind an interface because ViGEmBus is discontinued and may need to be replaced later.

Architecture

Physical controller
-> HID transport
-> Device-specific report parser
-> Normalized controller state
-> Mapping and calibration
-> Native virtual-controller bridge
-> Virtual Xbox 360 controller
-> XInput game

Main modules

src/
application/ Application lifecycle and orchestration
devices/ HID discovery, connection, and reconnection
protocols/ Device-specific HID report parsers
mapping/ PlayStation-to-Xbox mapping
calibration/ Deadzone, axis range, inversion, and trigger calibration
profiles/ Persistent controller profiles
virtual-controller/ Abstraction over the native bridge
diagnostics/ HID report inspection and structured logs
ui/ Electron interface and tray
native/
XBridge.VirtualController/ C#/.NET bridge
tests/

Controller state model

Every device-specific parser must convert raw reports into a common state:

export interface ControllerState {
buttons: {
south: boolean;
east: boolean;
west: boolean;
north: boolean;
leftBumper: boolean;
rightBumper: boolean;
leftStick: boolean;
rightStick: boolean;
back: boolean;
start: boolean;
guide: boolean;
dpadUp: boolean;
dpadDown: boolean;
dpadLeft: boolean;
dpadRight: boolean;
};
axes: {
leftX: number;
leftY: number;
rightX: number;
rightY: number;
leftTrigger: number;
rightTrigger: number;
};
timestamp: number;
}

Stick values must be normalized to -1..1. Trigger values must be normalized to 0..1.

Default mapping

Physical control

Xbox 360 output

Cross

A

Circle

B

Square

X

Triangle

Y

L1

LB

R1

RB

L2

LT

R2

RT

Share

Back

Options

Start

PS

Guide

L3

Left Stick

D-pad
Touchpad movement, speaker, headset audio, accelerometer, and Sixaxis are outside the first version. The touchpad click may be exposed as an optional remappable button.

Identify devices by VID, PID, product name, report descriptor, and connection type.

Capture raw HID reports in a diagnostics mode.

Support separate USB and Bluetooth report parsers when their packet formats differ.

Create one virtual Xbox 360 controller for each connected physical controller.

Forward buttons, sticks, triggers, and D-pad with low latency.

Forward game rumble to the physical controller when its output protocol is known.

Reconnect automatically without restarting the application.

Apply deadzone and calibration per device.

Save profiles locally.

Start minimized and remain available in the Windows system tray.

Shut down cleanly and remove all virtual controllers.

Never send telemetry or controller data over the network.

Performance requirements

Keep input processing outside the Electron renderer.

Process reports as events; do not use busy-wait loops.

Avoid allocations in the hot input path where practical.

Do not write a log entry for every report unless diagnostics mode is active.

Target less than 5 ms of application-added input latency.

Coalesce unchanged controller states before sending updates to the native bridge.

Reliability and safety

Never hide a physical device until its virtual controller is connected successfully.

The application itself must remain allowed through HidHide so it can read hidden devices.

If startup fails, leave physical devices usable.

Do not install, remove, or reconfigure drivers silently.

Administrative operations require an explicit user action and a clear explanation.

Detect stale virtual devices and clean them up during controlled shutdown.

Development rules

Use English for identifiers, comments, logs, and documentation.

Prefer const; use let only when reassignment is required. Never use var.

Use small modules with one responsibility.

Keep device protocol parsing separate from mapping and virtual output.

Do not place business logic in Electron UI components.

Do not use any; use unknown and validate external data.

Validate configuration files before applying them.

Use dependency injection for HID transport and virtual-controller implementations.

Use structured errors with an error code, technical detail, and user-facing message.

Do not swallow exceptions.

Add unit tests for report parsing, normalization, calibration, and mapping.

Add integration tests with recorded HID report fixtures; hardware must not be required for normal test execution.

Keep native APIs behind interfaces so drivers and transport libraries can be replaced.

Avoid unrelated refactors while implementing a feature or fix.

Initial delivery plan

Create a diagnostic CLI that lists HID devices and prints VID, PID, product name, usage page, usage, report sizes, and raw input reports.

Record reports while each button, trigger, stick, and D-pad direction is activated individually.

Implement the protocol parser for the target controller over USB.

Implement the protocol parser for the target controller over Bluetooth.

Implement the normalized state, calibration, and default mapping.

Implement the C# virtual-controller bridge and Xbox 360 output.

Add reconnection and two-controller support.

Add rumble forwarding.

Integrate HidHide safely.

Add the Electron interface, profiles, and system tray.

Definition of done for the first playable version

The target controller works through USB and Bluetooth.

Windows recognizes exactly one Xbox 360 controller for each physical controller.

Buttons, D-pad, sticks, and triggers work correctly in joy.cpl and XInput games.

No double input occurs after HidHide is configured.

Disconnecting and reconnecting the controller does not require restarting XBridge.

Automated tests cover raw-report parsing and PlayStation-to-Xbox mapping.

Instructions for Codex

Read this file before modifying the project.

Inspect the existing repository and preserve its conventions unless this file explicitly overrides them.

Before implementing device parsing, request or collect real diagnostic reports from the target hardware. Do not guess byte offsets.

Implement the smallest complete increment and test it before moving to the next layer.

When changing the native bridge contract, update both TypeScript and C# implementations and their tests.

Report hardware-dependent assumptions explicitly.

Do not claim USB, Bluetooth, rumble, or HidHide support without testing or providing a repeatable manual verification procedure.Functional requirements

Detect supported HID controllers automatically.

D-pad

R3
Right Stick
