# Target Controller Capture Worksheet

Do not infer report offsets from an official DualShock 4 layout. Complete this worksheet with the target controller connected, first over USB and then over Bluetooth, once raw capture support is implemented.

## Device identity

- Connection type:
- VID:
- PID:
- Product name:
- Manufacturer:
- Interface number:
- Usage page and usage:
- Input/output/feature report sizes:
- Report IDs observed:
- Report descriptor location or reason unavailable:
- Firmware or release number:

## Input captures

Record a neutral report before and after every action. Activate only the named control unless the row explicitly requests a combination.

- Face buttons: Cross, Circle, Square, Triangle
- Shoulder buttons: L1, R1, L2, R2
- Stick buttons: L3, R3
- System buttons: Share, Options, PS
- Optional button: touchpad click
- D-pad: neutral, up, up-right, right, down-right, down, down-left, left, up-left
- Left stick X/Y: center, minimum, maximum, and representative intermediate positions
- Right stick X/Y: center, minimum, maximum, and representative intermediate positions
- Triggers: minimum, maximum, and representative intermediate positions

## Capture notes

- Stable bytes:
- Sequence counters:
- Checksums or CRC candidates:
- Packet-length variations:
- USB/Bluetooth differences:
- Unexpected simultaneous changes:
- Sanitization performed before committing fixtures:

## Evidence rule

A parser field is implemented only when labeled captures support it. Ambiguous fields remain unsupported until another controlled capture distinguishes them.
