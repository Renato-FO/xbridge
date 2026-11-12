# Exclusive Xbox input (release requirement)

Status: implemented in the app (`src/isolation/hidhide.ts`); gameplay acceptance pending.

## How XBridge applies it

- After Xbox output starts and the virtual controller is active, XBridge reads the HidHide configuration through `HidHideCLI.exe`. If inverse mode is on, it changes nothing and reports a failure.
- It allows its own readers (the Electron executable and the native joystick reader) and hides every present `054C:05C4` interface that is not hidden yet. It turns cloaking on only if it was off.
- About 1.5 s later it checks that it still receives the controllers. If not, it undoes the hiding.
- A controller connected while output runs is hidden as soon as its output starts.
- Stopping output, unplugging every controller, disconnecting, or exiting un-hides only the entries XBridge added. Cloaking goes back off only if XBridge turned it on and no other device remains hidden. Allowed-application entries are left in place.
- Owned changes are written to `isolation.json` in the app data folder before they are applied. The next start undoes anything left over from a crash.
- The output card shows the isolation status: _Controle físico oculto_, _Ocultação falhou_, or _Sem HidHide_.

The final release must guide users through installing HidHide from the official Nefarius release, with a verified Authenticode signature and explicit consent for administrative changes. The setup must explain any required controller reconnection, game restart, or Windows restart. Never reboot automatically.

HidHide prevents games from reading the source gamepad while XBridge reads it and exposes a virtual Xbox controller. This does not disable keyboard/mouse input or control Minecraft's window focus/input-mode selection.

## Setup and recovery procedure

1. Record the installed driver version and save existing application/device lists, cloak state, and inverse state. Preserve unrelated entries.
2. Identify the connected physical gamepad by its actual instance path and verify the expected VID/PID. Do not hide the virtual Xbox, a keyboard, mouse, or unrelated device.
3. Allow the exact executables that read the physical device. In the current source-build layout these include `node_modules/electron/dist/electron.exe` for HID capture and `artifacts/native/XBridge.VirtualController.exe` for Windows joystick input. Resolve absolute paths at runtime; packaged releases must use their installed paths. Do not allow games or broad interpreter executables just to bypass isolation.
4. Start Xbox output and verify the owned XInput slot, then confirm source input still reaches the allowed reader before enabling hiding.
5. Apply only owned hiding changes. Reconnect the physical controller if required for the filter to attach; restart the game if it retains an existing device handle. Verify the allowed reader still works and a non-allowed observer cannot access the source.
6. Verify gameplay: one Cross/A press assigns once; one Options/Start press opens or closes the menu once; L3 with forward movement reaches the expected sprint assignment. Check held buttons, both sticks, triggers, and operation without touching the keyboard.
7. Stop output, disconnect, and exit in separate tests. Confirm owned hiding is released and unrelated settings remain unchanged. Test crash recovery before accepting the release.

The application must manage the hiding lifecycle before advertising this mode as supported. A one-time machine configuration is not equivalent to automatic release on stop/exit.

For manual recovery, use HidHide Configuration Client to unhide only the source gamepad or disable device hiding temporarily, then reconnect it. The CLI supports `--dev-unhide "<exact instance path>"`; `--cloak-off` disables all hiding globally and can affect other remappers, so reserve it for an informed emergency recovery.

## Investigation evidence (2026-11-10)

Minecraft for Windows was running alongside the physical `054C:05C4` controller and a ViGEm Xbox controller. The user observed duplicate A assignments and Start toggles. A ten-second capture observed four physical L3 presses while moving forward and four matching Xbox Left Stick presses. These sampled observations support testing duplicate-device exposure, but do not establish a keyboard/focus defect or prove that isolation fixes gameplay. Local captures are under ignored `artifacts/captures/`.

HidHide 1.5.230 was subsequently installed from the official signed Nefarius installer. Temporary session configuration hid only the physical Bluetooth HID instance and allowed the Electron executable and native reader. Verification from a non-allowed Node process found zero matching source devices and direct open of the source interface failed with Windows error 5 (access denied). The allowed native reader reported `connected: true`; the virtual Xbox remained readable through XInput in slot 1. A temporary recovery watcher removes the owned hide entry when this output process ends. This is local investigation tooling, not shipped application lifecycle integration. Gameplay acceptance and recovery execution remain unverified.

## Official references

Follow-up video analysis: the temporary recovery watcher recorded successful removal of the owned hide entry at 15:11:44 America/Sao_Paulo on 2026-11-10. The user then supplied a video named `DESKTOPCAPTURE__2026-11-10__15-17-19.mp4`; it shows A being assigned across multiple controller actions. At analysis time cloak state was off and a new output process was running. The earlier one-session isolation therefore did not persist across an output restart; the video cannot establish a failure while isolation was continuously active. This reinforces the release requirement to reacquire isolation on every successful output start and expose its current status. User gameplay acceptance remains pending.

- [HidHide releases](https://github.com/nefarius/HidHide/releases)
- [Setup guide](https://docs.nefarius.at/projects/HidHide/Simple-Setup-Guide/)
- [CLI and backup/recovery commands](https://docs.nefarius.at/projects/HidHide/CLI-Usage/)
