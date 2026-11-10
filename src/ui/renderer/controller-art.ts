export type ArtKind = "physical" | "xbox";
export interface Anchor {
  x: number;
  y: number;
  r: number;
}

/** Offset of the 600×370 controller drawing inside the SVG; the side margins hold callouts. */
export const artOffset = { x: 120, y: -14 } as const;
export const artViewBox = { width: 840, height: 362 } as const;
const drawingWidth = 600;
/** Horizontal limits (outer coordinates) callouts must stay outside of. */
export const calloutBounds = {
  left: artOffset.x + 12,
  right: artOffset.x + drawingWidth - 12,
} as const;

const n = (value: number) => String(Math.round(value * 10) / 10);
const mirror = (x: number) => drawingWidth - x;

const physicalAnchors: Record<string, Anchor> = {
  L2: { x: 152, y: 44, r: 22 },
  R2: { x: 448, y: 44, r: 22 },
  L1: { x: 150, y: 72, r: 12 },
  R1: { x: 450, y: 72, r: 12 },
  Share: { x: 204, y: 116, r: 10 },
  Options: { x: 396, y: 116, r: 10 },
  Touchpad: { x: 300, y: 138, r: 40 },
  PS: { x: 300, y: 240, r: 14 },
  L3: { x: 212, y: 236, r: 40 },
  R3: { x: 388, y: 236, r: 40 },
  "D-pad Up": { x: 128, y: 142, r: 14 },
  "D-pad Down": { x: 128, y: 198, r: 14 },
  "D-pad Left": { x: 100, y: 170, r: 14 },
  "D-pad Right": { x: 156, y: 170, r: 14 },
  Triangle: { x: 472, y: 132, r: 19 },
  Circle: { x: 510, y: 170, r: 19 },
  Cross: { x: 472, y: 208, r: 19 },
  Square: { x: 434, y: 170, r: 19 },
};

const xboxAnchors: Record<string, Anchor> = {
  LT: { x: 152, y: 44, r: 22 },
  RT: { x: 448, y: 44, r: 22 },
  LB: { x: 150, y: 72, r: 12 },
  RB: { x: 450, y: 72, r: 12 },
  Back: { x: 250, y: 160, r: 10 },
  Start: { x: 350, y: 160, r: 10 },
  Guide: { x: 300, y: 152, r: 23 },
  "Left Stick": { x: 148, y: 160, r: 38 },
  "Right Stick": { x: 376, y: 234, r: 38 },
  "D-pad Up": { x: 224, y: 206, r: 14 },
  "D-pad Down": { x: 224, y: 262, r: 14 },
  "D-pad Left": { x: 196, y: 234, r: 14 },
  "D-pad Right": { x: 252, y: 234, r: 14 },
  Y: { x: 454, y: 122, r: 18 },
  B: { x: 490, y: 158, r: 18 },
  A: { x: 454, y: 194, r: 18 },
  X: { x: 418, y: 158, r: 18 },
};

/** Center of each drawn control, in outer SVG coordinates (used for callouts). */
export function controlAnchor(kind: ArtKind, control: string): Anchor | undefined {
  const anchor = (kind === "xbox" ? xboxAnchors : physicalAnchors)[control];
  return anchor && { x: anchor.x + artOffset.x, y: anchor.y + artOffset.y, r: anchor.r };
}

function anchorOf(anchors: Record<string, Anchor>, name: string): Anchor {
  const anchor = anchors[name];
  if (!anchor) throw new Error(`Missing anchor ${name}`);
  return anchor;
}

interface Ctx {
  kind: ArtKind;
  interactive: boolean;
  anchors: Record<string, Anchor>;
}
const ref = (ctx: Ctx, id: string) => `url(#${id}-${ctx.kind})`;

function control(ctx: Ctx, name: string, body: string, extraClass = ""): string {
  const attrs = ctx.interactive ? ` tabindex="0" role="button" aria-label="${name}"` : "";
  return `<g class="pad-control${extraClass ? ` ${extraClass}` : ""}" data-control="${name}"${attrs}>${body}</g>`;
}

/* ---------- Shoulders: drawn behind the shell so they read as part of the body ---------- */
function triggerPath(right: boolean): string {
  const x = (value: number) => n(right ? mirror(value) : value);
  return `M${x(98)} 92 L${x(100)} 58 C${x(102)} 36 ${x(122)} 24 ${x(150)} 24 C${x(180)} 24 ${x(200)} 36 ${x(204)} 58 L${x(208)} 90 Z`;
}
function bumperPath(right: boolean): string {
  const x = (value: number) => n(right ? mirror(value) : value);
  return `M${x(70)} 112 C${x(80)} 80 ${x(112)} 62 ${x(158)} 62 C${x(196)} 62 ${x(218)} 70 ${x(230)} 82 L${x(232)} 98 L${x(72)} 120 Z`;
}
function shoulders(ctx: Ctx, names: [string, string, string, string]): string {
  const [l2, r2, l1, r1] = names;
  const trigger = (name: string, right: boolean) => {
    const a = anchorOf(ctx.anchors, name);
    return control(
      ctx,
      name,
      `<path class="key trigger" fill="${ref(ctx, "trigger")}" d="${triggerPath(right)}"/><path class="edge-light" d="${right ? `M${n(mirror(112))} 40 Q${n(mirror(150))} 28 ${n(mirror(190))} 40` : "M112 40 Q150 28 190 40"}"/><text x="${n(a.x)}" y="${n(a.y + 4)}" class="key-label">${name}</text>`,
      "shoulder",
    );
  };
  const bumper = (name: string, right: boolean) => {
    const a = anchorOf(ctx.anchors, name);
    return control(
      ctx,
      name,
      `<path class="key bumper" fill="${ref(ctx, "bumper")}" d="${bumperPath(right)}"/><text x="${n(a.x)}" y="${n(a.y + 4)}" class="key-label small">${name}</text>`,
      "shoulder",
    );
  };
  return `${trigger(l2, false)}${trigger(r2, true)}${bumper(l1, false)}${bumper(r1, true)}`;
}

/* ---------- Shared parts ---------- */
function shell(ctx: Ctx, d: string): string {
  return `<ellipse class="floor-shadow" cx="300" cy="352" rx="250" ry="16" filter="${ref(ctx, "blur")}"/>
  <path class="shell" fill="${ref(ctx, "shell")}" d="${d}"/>
  <path class="shell-overlay" fill="${ref(ctx, "shade")}" d="${d}"/>
  <path class="shell-overlay" fill="${ref(ctx, "sheen")}" d="${d}"/>
  <path class="shell-rim" stroke="${ref(ctx, "rim")}" d="${d}"/>`;
}

function dpad(ctx: Ctx): string {
  const up = anchorOf(ctx.anchors, "D-pad Up"),
    left = anchorOf(ctx.anchors, "D-pad Left");
  const cx = up.x,
    cy = left.y;
  const arm = (name: string, d: string, arrow: string) =>
    control(
      ctx,
      `D-pad ${name}`,
      `<path class="key dpad-arm" fill="${ref(ctx, "key")}" d="${d}"/><path class="dpad-arrow" d="${arrow}"/>`,
      "dpad",
    );
  // Each arm is a tapered, rounded block meeting at the center.
  const w = 13,
    len = 42;
  return `<circle class="well" fill="${ref(ctx, "well")}" cx="${n(cx)}" cy="${n(cy)}" r="52"/>
  ${arm("Up", `M${n(cx - w)} ${n(cy - 8)} V${n(cy - len + 6)} Q${n(cx - w)} ${n(cy - len)} ${n(cx - w + 6)} ${n(cy - len)} H${n(cx + w - 6)} Q${n(cx + w)} ${n(cy - len)} ${n(cx + w)} ${n(cy - len + 6)} V${n(cy - 8)} L${n(cx)} ${n(cy + 2)} Z`, `M${n(cx)} ${n(cy - 33)} l-5 7 h10 Z`)}
  ${arm("Down", `M${n(cx - w)} ${n(cy + 8)} V${n(cy + len - 6)} Q${n(cx - w)} ${n(cy + len)} ${n(cx - w + 6)} ${n(cy + len)} H${n(cx + w - 6)} Q${n(cx + w)} ${n(cy + len)} ${n(cx + w)} ${n(cy + len - 6)} V${n(cy + 8)} L${n(cx)} ${n(cy - 2)} Z`, `M${n(cx)} ${n(cy + 33)} l-5 -7 h10 Z`)}
  ${arm("Left", `M${n(cx - 8)} ${n(cy - w)} H${n(cx - len + 6)} Q${n(cx - len)} ${n(cy - w)} ${n(cx - len)} ${n(cy - w + 6)} V${n(cy + w - 6)} Q${n(cx - len)} ${n(cy + w)} ${n(cx - len + 6)} ${n(cy + w)} H${n(cx - 8)} L${n(cx + 2)} ${n(cy)} Z`, `M${n(cx - 33)} ${n(cy)} l7 -5 v10 Z`)}
  ${arm("Right", `M${n(cx + 8)} ${n(cy - w)} H${n(cx + len - 6)} Q${n(cx + len)} ${n(cy - w)} ${n(cx + len)} ${n(cy - w + 6)} V${n(cy + w - 6)} Q${n(cx + len)} ${n(cy + w)} ${n(cx + len - 6)} ${n(cy + w)} H${n(cx + 8)} L${n(cx - 2)} ${n(cy)} Z`, `M${n(cx + 33)} ${n(cy)} l-7 -5 v10 Z`)}`;
}

function stick(ctx: Ctx, name: string, side: "left" | "right"): string {
  const a = anchorOf(ctx.anchors, name);
  const knurl = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2,
      r1 = a.r - 13,
      r2 = a.r - 9;
    return `M${n(a.x + Math.cos(angle) * r1)} ${n(a.y + Math.sin(angle) * r1)} L${n(a.x + Math.cos(angle) * r2)} ${n(a.y + Math.sin(angle) * r2)}`;
  }).join(" ");
  return control(
    ctx,
    name,
    `<circle class="key stick-well" fill="${ref(ctx, "well")}" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r)}"/>
    <g data-stick="${side}">
      <circle class="stick-shadow" cx="${n(a.x)}" cy="${n(a.y + 5)}" r="${n(a.r - 6)}" filter="${ref(ctx, "blur-sm")}"/>
      <circle class="stick-cap" fill="${ref(ctx, "dome")}" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r - 7)}"/>
      <path class="stick-knurl" d="${knurl}"/>
      <circle class="stick-dish" fill="${ref(ctx, "dish")}" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r - 16)}"/>
    </g>`,
    "stick",
  );
}

function face(ctx: Ctx, name: string, inner: string): string {
  const a = anchorOf(ctx.anchors, name);
  return control(
    ctx,
    name,
    `<circle class="button-shadow" cx="${n(a.x)}" cy="${n(a.y + 3)}" r="${n(a.r)}"/><circle class="key face-key" fill="${ref(ctx, "dome")}" cx="${n(a.x)}" cy="${n(a.y)}" r="${n(a.r)}"/><path class="face-gloss" d="M${n(a.x - a.r * 0.6)} ${n(a.y - a.r * 0.45)} Q${n(a.x)} ${n(a.y - a.r * 1.05)} ${n(a.x + a.r * 0.6)} ${n(a.y - a.r * 0.45)}"/>${inner}`,
    `face face-${name.toLowerCase()}`,
  );
}

function defs(kind: ArtKind): string {
  const id = (name: string) => `${name}-${kind}`;
  const base =
    kind === "xbox" ? ["#2f343b", "#191c21", "#0c0e11"] : ["#2b3037", "#17191e", "#0b0c0f"];
  return `<defs>
    <linearGradient id="${id("shell")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${base[0] ?? ""}"/><stop offset=".5" stop-color="${base[1] ?? ""}"/><stop offset="1" stop-color="${base[2] ?? ""}"/></linearGradient>
    <linearGradient id="${id("shade")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
    <radialGradient id="${id("sheen")}" cx=".5" cy=".12" r=".6" fx=".5" fy="0"><stop offset="0" stop-color="#fff" stop-opacity=".13"/><stop offset=".6" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id("rim")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7480" stop-opacity=".9"/><stop offset=".35" stop-color="#3a4049" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>
    <linearGradient id="${id("trigger")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4048"/><stop offset=".6" stop-color="#1c1f24"/><stop offset="1" stop-color="#0e1013"/></linearGradient>
    <linearGradient id="${id("bumper")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#454c55"/><stop offset=".55" stop-color="#22262c"/><stop offset="1" stop-color="#121418"/></linearGradient>
    <linearGradient id="${id("key")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363c44"/><stop offset="1" stop-color="#14171b"/></linearGradient>
    <radialGradient id="${id("dome")}" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="#3d434b"/><stop offset=".55" stop-color="#1d2025"/><stop offset="1" stop-color="#0d0f12"/></radialGradient>
    <radialGradient id="${id("dish")}" cx=".55" cy=".7" r=".75"><stop offset="0" stop-color="#2f343b"/><stop offset="1" stop-color="#101215"/></radialGradient>
    <radialGradient id="${id("well")}" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#050607"/><stop offset=".85" stop-color="#0d0f12"/><stop offset="1" stop-color="#1e2227"/></radialGradient>
    <linearGradient id="${id("pad")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2025"/><stop offset="1" stop-color="#0d0f12"/></linearGradient>
    <radialGradient id="${id("guide")}" cx=".4" cy=".3" r=".85"><stop offset="0" stop-color="#f4f7f9"/><stop offset=".6" stop-color="#b9c1c9"/><stop offset="1" stop-color="#7c858f"/></radialGradient>
    <filter id="${id("blur")}" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="${id("blur-sm")}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="${id("glow")}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="${id("lightbar")}" x="-20%" y="-400%" width="140%" height="900%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>`;
}

/* ---------- DualShock 4 ---------- */
const ds4Shell =
  "M300 92 C360 92 400 84 432 80 C474 74 506 82 524 106 C542 130 550 162 558 198 L582 300 C590 338 570 360 540 360 C514 360 498 344 484 324 L458 292 C446 278 430 272 410 274 C380 282 340 286 300 286 C260 286 220 282 190 274 C170 272 154 278 142 292 L116 324 C102 344 86 360 60 360 C30 360 10 338 18 300 L42 198 C50 162 58 130 76 106 C94 82 126 74 168 80 C200 84 240 92 300 92 Z";

function physicalBody(ctx: Ctx): string {
  const a = (name: string) => anchorOf(ctx.anchors, name);
  const share = a("Share"),
    options = a("Options"),
    ps = a("PS");
  const pill = (name: string, p: Anchor) =>
    control(
      ctx,
      name,
      `<rect class="key" fill="${ref(ctx, "key")}" x="${n(p.x - 6)}" y="${n(p.y - 13)}" width="12" height="26" rx="6"/>`,
      "system",
    );
  const symbols: Record<string, string> = {
    Triangle: `<path class="glyph" d="M472 123 L480 137 L464 137 Z"/>`,
    Circle: `<circle class="glyph" cx="510" cy="170" r="7.5"/>`,
    Cross: `<path class="glyph" d="M465 201 L479 215 M479 201 L465 215"/>`,
    Square: `<rect class="glyph" x="427" y="163" width="14" height="14" rx="1.5"/>`,
  };
  const grille = [-14, -7, 0, 7, 14]
    .flatMap((dx) =>
      [0, 7, 14].map(
        (dy) => `<circle cx="${n(300 + dx + (dy === 7 ? 3.5 : 0))}" cy="${n(190 + dy)}" r="1.7"/>`,
      ),
    )
    .join("");
  return `
  ${shoulders(ctx, ["L2", "R2", "L1", "R1"])}
  ${shell(ctx, ds4Shell)}
  <path class="seam" d="M60 120 Q40 210 30 300 M540 120 Q560 210 570 300"/>
  ${control(ctx, "Touchpad", `<rect class="key touchpad" fill="${ref(ctx, "pad")}" x="226" y="100" width="148" height="80" rx="9"/><path class="lightbar-glow" d="M246 106 H354" filter="${ref(ctx, "lightbar")}"/><path class="lightbar" d="M244 104 H356"/><path class="touchpad-sheen" d="M232 112 H368"/>`, "system touch")}
  <text x="${n(share.x)}" y="${n(share.y - 19)}" class="micro-label">SHARE</text><text x="${n(options.x)}" y="${n(options.y - 19)}" class="micro-label">OPTIONS</text>
  ${pill("Share", share)}${pill("Options", options)}
  <g class="grille">${grille}</g>
  ${dpad(ctx)}
  <circle class="well face-well" fill="${ref(ctx, "well")}" cx="472" cy="170" r="66"/>
  ${(["Triangle", "Circle", "Cross", "Square"] as const).map((name) => face(ctx, name, symbols[name] ?? "")).join("")}
  ${stick(ctx, "L3", "left")}${stick(ctx, "R3", "right")}
  ${control(ctx, "PS", `<circle class="key" fill="${ref(ctx, "dome")}" cx="${n(ps.x)}" cy="${n(ps.y)}" r="${n(ps.r)}"/><text x="${n(ps.x)}" y="${n(ps.y + 4)}" class="ps-mark">PS</text>`, "system")}`;
}

/* ---------- Xbox 360 ---------- */
const xboxShell =
  "M300 96 C350 96 392 84 430 82 C478 80 508 98 522 128 C536 160 546 200 560 250 C574 300 578 332 556 350 C534 366 506 352 490 332 C470 306 452 286 420 284 L180 284 C148 286 130 306 110 332 C94 352 66 366 44 350 C22 332 26 300 40 250 C54 200 64 160 78 128 C92 98 122 80 170 82 C208 84 250 96 300 96 Z";

function xboxBody(ctx: Ctx): string {
  const a = (name: string) => anchorOf(ctx.anchors, name);
  const guide = a("Guide"),
    back = a("Back"),
    start = a("Start");
  const letter = (name: string) => {
    const p = a(name);
    return `<text x="${n(p.x)}" y="${n(p.y + 6.5)}" class="face-letter">${name}</text>`;
  };
  const small = (name: string, p: Anchor, glyph: string) =>
    control(
      ctx,
      name,
      `<circle class="key" fill="${ref(ctx, "dome")}" cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}"/><path class="glyph-sm" d="${glyph}"/>`,
      "system",
    );
  const quadrant = (start: number) => {
    const r = guide.r + 4,
      from = (start * Math.PI) / 180,
      to = ((start + 80) * Math.PI) / 180;
    return `M${n(guide.x + Math.cos(from) * r)} ${n(guide.y + Math.sin(from) * r)} A${n(r)} ${n(r)} 0 0 1 ${n(guide.x + Math.cos(to) * r)} ${n(guide.y + Math.sin(to) * r)}`;
  };
  return `
  ${shoulders(ctx, ["LT", "RT", "LB", "RB"])}
  ${shell(ctx, xboxShell)}
  <path class="seam" d="M74 140 Q52 220 40 300 M526 140 Q548 220 560 300"/>
  <circle class="well" fill="${ref(ctx, "well")}" cx="${n(guide.x)}" cy="${n(guide.y)}" r="${n(guide.r + 9)}"/>
  <path class="guide-ring" d="${[275, 5, 95, 185].map(quadrant).join(" ")}"/>
  ${control(ctx, "Guide", `<circle class="key guide" fill="${ref(ctx, "guide")}" cx="${n(guide.x)}" cy="${n(guide.y)}" r="${n(guide.r - 3)}"/><circle class="guide-core" cx="${n(guide.x)}" cy="${n(guide.y)}" r="${n(guide.r - 8)}"/><path class="guide-x" d="M${n(guide.x - 7)} ${n(guide.y - 8)} Q${n(guide.x)} ${n(guide.y - 1)} ${n(guide.x + 7)} ${n(guide.y + 8)} M${n(guide.x + 7)} ${n(guide.y - 8)} Q${n(guide.x)} ${n(guide.y - 1)} ${n(guide.x - 7)} ${n(guide.y + 8)}"/>`, "system")}
  ${small("Back", back, `M${n(back.x + 3)} ${n(back.y - 4)} L${n(back.x - 3)} ${n(back.y)} L${n(back.x + 3)} ${n(back.y + 4)}`)}
  ${small("Start", start, `M${n(start.x - 3)} ${n(start.y - 4)} L${n(start.x + 3)} ${n(start.y)} L${n(start.x - 3)} ${n(start.y + 4)}`)}
  ${stick(ctx, "Left Stick", "left")}
  ${dpad(ctx)}
  ${stick(ctx, "Right Stick", "right")}
  <circle class="well face-well" fill="${ref(ctx, "well")}" cx="454" cy="158" r="62"/>
  ${(["Y", "B", "A", "X"] as const).map((name) => face(ctx, name, letter(name))).join("")}`;
}

export function controllerArt(kind: ArtKind, interactive = kind === "physical"): string {
  const ctx: Ctx = {
    kind,
    interactive,
    anchors: kind === "xbox" ? xboxAnchors : physicalAnchors,
  };
  const label = kind === "xbox" ? "Controle Xbox 360 virtual" : "Controle físico DualShock 4";
  return `<svg viewBox="0 0 ${n(artViewBox.width)} ${n(artViewBox.height)}" role="group" aria-label="${label}" class="art-${kind}">
  ${defs(kind)}
  <g class="controller" transform="translate(${n(artOffset.x)} ${n(artOffset.y)})" style="--glow: url(#glow-${kind})">
  ${kind === "xbox" ? xboxBody(ctx) : physicalBody(ctx)}
  </g>
  <g class="callout" hidden><path class="callout-line"/><rect class="callout-box" rx="8"/><text class="callout-text"></text></g>
  </svg>`;
}
