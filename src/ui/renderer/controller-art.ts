export type ArtKind = "physical" | "xbox";
export interface Anchor {
  x: number;
  y: number;
  r: number;
}

/** Offset of the controller drawing inside the SVG; the remaining space holds callouts. */
export const artOffset = { x: 90, y: 2 } as const;
export const artViewBox = { width: 780, height: 368 } as const;

const n = (value: number) => String(value);

const physicalAnchors: Record<string, Anchor> = {
  L2: { x: 170, y: 30, r: 26 },
  R2: { x: 430, y: 30, r: 26 },
  L1: { x: 165, y: 70, r: 18 },
  R1: { x: 435, y: 70, r: 18 },
  Share: { x: 213, y: 117, r: 12 },
  Options: { x: 387, y: 117, r: 12 },
  Touchpad: { x: 300, y: 134, r: 34 },
  PS: { x: 300, y: 236, r: 13 },
  L3: { x: 226, y: 238, r: 36 },
  R3: { x: 374, y: 238, r: 36 },
  "D-pad Up": { x: 150, y: 142, r: 14 },
  "D-pad Down": { x: 150, y: 198, r: 14 },
  "D-pad Left": { x: 122, y: 170, r: 14 },
  "D-pad Right": { x: 178, y: 170, r: 14 },
  Triangle: { x: 450, y: 132, r: 19 },
  Circle: { x: 488, y: 170, r: 19 },
  Cross: { x: 450, y: 208, r: 19 },
  Square: { x: 412, y: 170, r: 19 },
};

const xboxAnchors: Record<string, Anchor> = {
  LT: { x: 170, y: 30, r: 26 },
  RT: { x: 430, y: 30, r: 26 },
  LB: { x: 165, y: 70, r: 18 },
  RB: { x: 435, y: 70, r: 18 },
  Back: { x: 252, y: 160, r: 11 },
  Start: { x: 348, y: 160, r: 11 },
  Guide: { x: 300, y: 148, r: 22 },
  "Left Stick": { x: 162, y: 162, r: 36 },
  "Right Stick": { x: 374, y: 240, r: 36 },
  "D-pad Up": { x: 230, y: 212, r: 14 },
  "D-pad Down": { x: 230, y: 268, r: 14 },
  "D-pad Left": { x: 202, y: 240, r: 14 },
  "D-pad Right": { x: 258, y: 240, r: 14 },
  Y: { x: 450, y: 124, r: 18 },
  B: { x: 486, y: 160, r: 18 },
  A: { x: 450, y: 196, r: 18 },
  X: { x: 414, y: 160, r: 18 },
};

/** Center of each drawn control, in outer SVG coordinates (used for callouts). */
export function controlAnchor(kind: ArtKind, control: string): Anchor | undefined {
  const anchor = (kind === "xbox" ? xboxAnchors : physicalAnchors)[control];
  return anchor && { x: anchor.x + artOffset.x, y: anchor.y + artOffset.y, r: anchor.r };
}

function control(name: string, body: string, interactive: boolean, extraClass = ""): string {
  const attrs = interactive ? ` tabindex="0" role="button" aria-label="${name}"` : "";
  return `<g class="pad-control${extraClass ? ` ${extraClass}` : ""}" data-control="${name}"${attrs}>${body}</g>`;
}

function trigger(name: string, label: string, x: number, interactive: boolean): string {
  return control(
    name,
    `<path class="key" d="M${n(x)} 44 L${n(x)} 22 Q${n(x)} 6 ${n(x + 18)} 6 L${n(x + 82)} 6 Q${n(x + 100)} 6 ${n(x + 100)} 22 L${n(x + 100)} 44 Z"/><text x="${n(x + 50)}" y="${n(32)}" class="key-label">${label}</text>`,
    interactive,
    "shoulder",
  );
}

function bumper(name: string, label: string, x: number, interactive: boolean): string {
  return control(
    name,
    `<rect class="key" x="${n(x)}" y="58" width="110" height="24" rx="11"/><text x="${n(x + 55)}" y="75" class="key-label small">${label}</text>`,
    interactive,
    "shoulder",
  );
}

function stick(name: string, side: "left" | "right", a: Anchor, interactive: boolean): string {
  return control(
    name,
    `<circle class="stick-well" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r)}"/><circle class="stick-ring" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r - 7)}"/><g data-stick="${side}"><circle class="stick-cap" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r - 12)}"/><circle class="stick-dimple" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r - 20)}"/></g>`,
    interactive,
    "stick",
  );
}

function dpad(anchors: Record<string, Anchor>, interactive: boolean): string {
  const up = anchors["D-pad Up"],
    left = anchors["D-pad Left"];
  if (!up || !left) return "";
  const cx = up.x,
    cy = left.y;
  const arm = (name: string, x: number, y: number, w: number, h: number, arrow: string) =>
    control(
      `D-pad ${name}`,
      `<rect class="key dpad-arm" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="5"/><path class="dpad-arrow" d="${arrow}"/>`,
      interactive,
      "dpad",
    );
  return `<circle class="dpad-well" cx="${n(cx)}" cy="${n(cy)}" r="48"/>
  ${arm("Up", cx - 13, cy - 41, 26, 30, `M${n(cx)} ${n(cy - 33)} l-5 7 h10 Z`)}
  ${arm("Down", cx - 13, cy + 11, 26, 30, `M${n(cx)} ${n(cy + 33)} l-5 -7 h10 Z`)}
  ${arm("Left", cx - 41, cy - 13, 30, 26, `M${n(cx - 33)} ${n(cy)} l7 -5 v10 Z`)}
  ${arm("Right", cx + 11, cy - 13, 30, 26, `M${n(cx + 33)} ${n(cy)} l-7 -5 v10 Z`)}
  <rect class="dpad-center" x="${n(cx - 13)}" y="${n(cy - 13)}" width="26" height="26"/>`;
}

const psSymbols: Record<string, (a: Anchor) => string> = {
  Cross: (a) =>
    `<path class="glyph" d="M${n(a.x - 7)} ${n(a.y - 7)} L${n(a.x + 7)} ${n(a.y + 7)} M${n(a.x + 7)} ${n(a.y - 7)} L${n(a.x - 7)} ${n(a.y + 7)}"/>`,
  Circle: (a) => `<circle class="glyph" cx="${n(a.x)}" cy="${n(a.y)}" r="7.5"/>`,
  Square: (a) =>
    `<rect class="glyph" x="${n(a.x - 7)}" y="${n(a.y - 7)}" width="14" height="14" rx="1"/>`,
  Triangle: (a) =>
    `<path class="glyph" d="M${n(a.x)} ${n(a.y - 8)} L${n(a.x + 8)} ${n(a.y + 6)} L${n(a.x - 8)} ${n(a.y + 6)} Z"/>`,
};

function faceButton(name: string, a: Anchor, inner: string, interactive: boolean): string {
  return control(
    name,
    `<circle class="key face" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r)}"/>${inner}`,
    interactive,
    `face face-${name.toLowerCase()}`,
  );
}

function smallButton(name: string, a: Anchor, inner: string, interactive: boolean): string {
  return control(
    name,
    `<circle class="key" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r)}"/>${inner}`,
    interactive,
    "system",
  );
}

function physicalBody(interactive: boolean): string {
  const a = physicalAnchors;
  const req = (name: string): Anchor => {
    const anchor = a[name];
    if (!anchor) throw new Error(`Missing anchor ${name}`);
    return anchor;
  };
  const share = req("Share"),
    options = req("Options");
  return `
  ${trigger("L2", "L2", 120, interactive)}${trigger("R2", "R2", 380, interactive)}
  ${bumper("L1", "L1", 110, interactive)}${bumper("R1", "R1", 380, interactive)}
  <path class="shell" d="M150 92 C110 92 92 112 82 150 L42 290 C32 336 62 362 94 346 C122 332 152 292 180 270 C198 257 214 258 234 264 L366 264 C386 258 402 257 420 270 C448 292 478 332 506 346 C538 362 568 336 558 290 L518 150 C508 112 490 92 450 92 C412 92 398 104 300 104 C202 104 188 92 150 92 Z"/>
  <path class="shell-sheen" d="M110 132 Q92 196 72 284 M490 132 Q508 196 528 284"/>
  ${dpad(a, interactive)}
  ${control("Touchpad", `<rect class="key touchpad" x="236" y="100" width="128" height="70" rx="10"/><path class="lightbar" d="M248 104 H352"/><text x="300" y="146" class="key-label tiny">TOUCHPAD</text>`, interactive, "system")}
  <text x="${n(share.x)}" y="97" class="micro-label">SHARE</text><text x="${n(options.x)}" y="97" class="micro-label">OPTIONS</text>
  ${control("Share", `<rect class="key" x="${n(share.x - 6)}" y="${n(share.y - 13)}" width="12" height="26" rx="6"/>`, interactive, "system")}
  ${control("Options", `<rect class="key" x="${n(options.x - 6)}" y="${n(options.y - 13)}" width="12" height="26" rx="6"/>`, interactive, "system")}
  <g class="speaker">${[-12, -4, 4, 12].map((dx) => `<circle cx="${n(300 + dx)}" cy="190" r="1.6"/><circle cx="${n(300 + dx)}" cy="198" r="1.6"/>`).join("")}</g>
  ${stick("L3", "left", req("L3"), interactive)}${stick("R3", "right", req("R3"), interactive)}
  ${smallButton("PS", req("PS"), `<text x="300" y="240" class="key-label tiny">PS</text>`, interactive)}
  ${(["Triangle", "Circle", "Cross", "Square"] as const).map((name) => faceButton(name, req(name), psSymbols[name]?.(req(name)) ?? "", interactive)).join("")}`;
}

function xboxBody(interactive: boolean): string {
  const a = xboxAnchors;
  const req = (name: string): Anchor => {
    const anchor = a[name];
    if (!anchor) throw new Error(`Missing anchor ${name}`);
    return anchor;
  };
  const guide = req("Guide"),
    back = req("Back"),
    start = req("Start");
  const letter = (name: string) => {
    const anchor = req(name);
    return `<text x="${n(anchor.x)}" y="${n(anchor.y + 6)}" class="face-letter">${name}</text>`;
  };
  return `
  ${trigger("LT", "LT", 120, interactive)}${trigger("RT", "RT", 380, interactive)}
  ${bumper("LB", "LB", 110, interactive)}${bumper("RB", "RB", 380, interactive)}
  <path class="shell" d="M160 90 C112 88 88 110 76 158 L44 286 C34 334 66 362 100 344 C130 328 156 294 186 274 C206 260 228 264 250 270 L350 270 C372 264 394 260 414 274 C444 294 470 328 500 344 C534 362 566 334 556 286 L524 158 C512 110 488 88 440 90 C400 92 362 100 300 100 C238 100 200 92 160 90 Z"/>
  <path class="shell-sheen" d="M108 140 Q90 200 70 280 M492 140 Q510 200 530 280"/>
  ${stick("Left Stick", "left", req("Left Stick"), interactive)}
  ${dpad(a, interactive)}
  ${stick("Right Stick", "right", req("Right Stick"), interactive)}
  ${control("Guide", `<circle class="guide-ring" cx="${n(guide.x)}" cy="${n(guide.y)}" r="${n(guide.r)}"/><circle class="key guide" cx="${n(guide.x)}" cy="${n(guide.y)}" r="${n(guide.r - 5)}"/><path class="guide-x" d="M${n(guide.x - 7)} ${n(guide.y - 8)} Q${n(guide.x)} ${n(guide.y - 1)} ${n(guide.x + 7)} ${n(guide.y + 8)} M${n(guide.x + 7)} ${n(guide.y - 8)} Q${n(guide.x)} ${n(guide.y - 1)} ${n(guide.x - 7)} ${n(guide.y + 8)}"/>`, interactive, "system")}
  ${smallButton("Back", back, `<path class="glyph-sm" d="M${n(back.x + 3)} ${n(back.y - 4)} L${n(back.x - 3)} ${n(back.y)} L${n(back.x + 3)} ${n(back.y + 4)}"/>`, interactive)}
  ${smallButton("Start", start, `<path class="glyph-sm" d="M${n(start.x - 3)} ${n(start.y - 4)} L${n(start.x + 3)} ${n(start.y)} L${n(start.x - 3)} ${n(start.y + 4)}"/>`, interactive)}
  ${(["Y", "B", "A", "X"] as const).map((name) => faceButton(name, req(name), letter(name), interactive)).join("")}`;
}

export function controllerArt(kind: ArtKind, interactive = kind === "physical"): string {
  const label = kind === "xbox" ? "Controle Xbox 360 virtual" : "Controle físico DualShock 4";
  return `<svg viewBox="0 0 ${n(artViewBox.width)} ${n(artViewBox.height)}" role="group" aria-label="${label}" class="art-${kind}">
  <defs>
    <linearGradient id="shell-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f36"/><stop offset=".45" stop-color="#171a1f"/><stop offset="1" stop-color="#0c0e11"/></linearGradient>
    <radialGradient id="cap-${kind}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#3a4048"/><stop offset="1" stop-color="#121519"/></radialGradient>
    <filter id="drop-${kind}" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".55"/></filter>
    <filter id="glow-${kind}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g class="controller" transform="translate(${n(artOffset.x)} ${n(artOffset.y)})" style="--shell: url(#shell-${kind}); --cap: url(#cap-${kind}); --drop: url(#drop-${kind}); --glow: url(#glow-${kind})">
  ${kind === "xbox" ? xboxBody(interactive) : physicalBody(interactive)}
  </g>
  <g class="callout" hidden><path class="callout-line"/><rect class="callout-box" rx="8"/><text class="callout-text"></text></g>
  </svg>`;
}
