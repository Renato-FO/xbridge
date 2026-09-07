export function controllerArt(kind: "physical" | "xbox"): string {
  const xbox = kind === "xbox";
  const button = (
    name: string,
    label: string,
    x: number,
    y: number,
    radius = 21,
    color = "#c2cedb",
  ) =>
    `<g class="pad-control" data-control="${name}" tabindex="0" role="button" aria-label="${name}"><circle cx="${String(x)}" cy="${String(y)}" r="${String(radius)}"/><text x="${String(x)}" y="${String(y + 6)}" fill="${color}">${label}</text></g>`;
  const shoulder = (name: string, x: number, y: number, label: string, trigger = false) =>
    `<g class="pad-control" data-control="${name}" tabindex="0" role="button" aria-label="${name}"><rect x="${String(x)}" y="${String(y)}" width="100" height="${trigger ? "42" : "28"}" rx="12"/><text x="${String(x + 50)}" y="${String(y + (trigger ? 26 : 20))}">${label}</text></g>`;
  const stick = (name: string, x: number, y: number, label: string) =>
    `<g class="pad-control stick" data-control="${name}" tabindex="0" role="button" aria-label="${name}"><circle cx="${String(x)}" cy="${String(y)}" r="42"/><circle class="stick-ring" cx="${String(x)}" cy="${String(y)}" r="30"/><g data-stick="${label}"><circle class="stick-cap" cx="${String(x)}" cy="${String(y)}" r="25"/><path class="crosshair" d="M${String(x - 7)} ${String(y)}h14 M${String(x)} ${String(y - 7)}v14"/></g></g>`;
  const dx = xbox ? 236 : 158,
    dy = xbox ? 239 : 179;
  const direction = (name: string, label: string, x: number, y: number) =>
    `<g class="pad-control" data-control="D-pad ${name}" tabindex="0" role="button" aria-label="D-pad ${name}"><rect x="${String(x - 15)}" y="${String(y - 15)}" width="30" height="30" rx="5"/><text x="${String(x)}" y="${String(y + 5)}" class="direction">${label}</text></g>`;
  return `<svg viewBox="0 0 600 370" role="group" aria-label="${xbox ? "Mapped Xbox 360 controller" : "Physical DualShock controller"}">
  <defs><linearGradient id="shell-${kind}" x2="0" y2="1"><stop stop-color="#354252"/><stop offset="1" stop-color="#1a2431"/></linearGradient><filter id="shadow-${kind}"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-opacity=".35"/></filter></defs>
  ${shoulder(xbox ? "LT" : "L2", 116, 18, xbox ? "LT" : "L2", true)}${shoulder(xbox ? "RT" : "R2", 384, 18, xbox ? "RT" : "R2", true)}
  ${shoulder(xbox ? "LB" : "L1", 106, 67, xbox ? "LB" : "L1")}${shoulder(xbox ? "RB" : "R1", 394, 67, xbox ? "RB" : "R1")}
  <path class="shell" fill="url(#shell-${kind})" filter="url(#shadow-${kind})" d="M155 101 Q104 97 85 153 L45 285 Q31 337 69 343 Q94 347 119 316 L172 267 Q185 256 209 265 Q300 294 391 265 Q415 256 428 267 L481 316 Q506 347 531 343 Q569 337 555 285 L515 153 Q496 97 445 101 Q300 121 155 101Z"/>
  <path class="shell-detail" d="M111 151 Q94 207 81 267 M489 151 Q506 207 519 267 M218 264 Q300 281 382 264"/>
  ${xbox ? button("Guide", "X", 300, 141, 23, "#99e8b3") : `<g class="pad-control" data-control="Touchpad" tabindex="0" role="button" aria-label="Touchpad"><rect x="246" y="116" width="108" height="57" rx="9"/><text x="300" y="150" class="tiny">TOUCHPAD</text></g>`}
  ${button(xbox ? "Back" : "Share", xbox ? "◁" : "SH", xbox ? 250 : 218, xbox ? 180 : 140, 13)}${button(xbox ? "Start" : "Options", xbox ? "▷" : "OP", xbox ? 350 : 382, xbox ? 180 : 140, 13)}
  ${!xbox ? button("PS", "PS", 300, 213, 16) : ""}
  ${stick(xbox ? "Left Stick" : "L3", xbox ? 155 : 239, xbox ? 179 : 241, "left")}${stick(xbox ? "Right Stick" : "R3", xbox ? 368 : 363, 241, "right")}
  ${direction("Up", "▲", dx, dy - 27)}${direction("Down", "▼", dx, dy + 27)}${direction("Left", "◀", dx - 27, dy)}${direction("Right", "▶", dx + 27, dy)}
  ${button(xbox ? "Y" : "Triangle", xbox ? "Y" : "△", 448, 142, 20, "#e7cb67")}${button(xbox ? "B" : "Circle", xbox ? "B" : "○", 482, 177, 20, "#ef8d98")}${button(xbox ? "A" : "Cross", xbox ? "A" : "×", 448, 212, 20, "#88d6a2")}${button(xbox ? "X" : "Square", xbox ? "X" : "□", 414, 177, 20, "#87bdfa")}
  </svg>`;
}
