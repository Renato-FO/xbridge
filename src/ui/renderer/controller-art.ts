/**
 * Interaction layer for the realistic controller drawings in ./art (inlined into index.html at
 * build time, ids prefixed with `ds4-` / `xbx-`). The drawings themselves stay untouched; this
 * module adds an overlay with hotspots, highlight rings, the L2/R2 (LT/RT) labels and a callout.
 */
export type ArtKind = "physical" | "xbox";
export interface Anchor {
  x: number;
  y: number;
  r: number;
  /** Optional rounded-rectangle highlight instead of a circle. */
  rect?: { w: number; h: number; rx: number };
}
interface ArtSpec {
  prefix: string;
  viewBox: { x: number; y: number; width: number; height: number };
  /** Controller body limits; callouts are placed outside them. */
  body: { left: number; right: number };
  /** SVG units per CSS pixel at the usual rendering size: scales strokes and text. */
  unit: number;
  anchors: Record<string, Anchor>;
  /** Visible labels drawn above the controller (the triggers). */
  labels: string[];
  sticks: Record<"left" | "right", { id: string; x: number; y: number }>;
}

const mirror = (x: number) => 1600 - x;

const specs: Record<ArtKind, ArtSpec> = {
  physical: {
    prefix: "ds4",
    viewBox: { x: -260, y: 46, width: 2120, height: 900 },
    body: { left: 120, right: 1480 },
    unit: 3,
    labels: ["L2", "R2"],
    sticks: {
      left: { id: "ds4-leftAnalog", x: 590, y: 573 },
      right: { id: "ds4-rightAnalog", x: 1010, y: 573 },
    },
    anchors: {
      L2: { x: 400, y: 88, r: 40, rect: { w: 150, h: 76, rx: 22 } },
      R2: { x: mirror(400), y: 88, r: 40, rect: { w: 150, h: 76, rx: 22 } },
      L1: { x: 397, y: 214, r: 40, rect: { w: 210, h: 52, rx: 22 } },
      R1: { x: mirror(397), y: 214, r: 40, rect: { w: 210, h: 52, rx: 22 } },
      Share: { x: 535, y: 260, r: 40 },
      Options: { x: 1065, y: 260, r: 40 },
      Touchpad: { x: 806, y: 306, r: 120, rect: { w: 440, h: 248, rx: 24 } },
      PS: { x: 800, y: 578, r: 40 },
      L3: { x: 590, y: 566, r: 90 },
      R3: { x: 1010, y: 566, r: 90 },
      "D-pad Up": { x: 390, y: 318, r: 38 },
      "D-pad Down": { x: 390, y: 442, r: 38 },
      "D-pad Left": { x: 328, y: 380, r: 38 },
      "D-pad Right": { x: 452, y: 380, r: 38 },
      Triangle: { x: 1210, y: 277, r: 56 },
      Circle: { x: 1313, y: 380, r: 56 },
      Cross: { x: 1210, y: 483, r: 56 },
      Square: { x: 1107, y: 380, r: 56 },
    },
  },
  xbox: {
    prefix: "xbx",
    viewBox: { x: -260, y: 56, width: 2120, height: 980 },
    body: { left: 120, right: 1480 },
    unit: 3,
    labels: ["LT", "RT"],
    sticks: {
      left: { id: "xbx-leftAnalog", x: 458, y: 390 },
      right: { id: "xbx-rightAnalog", x: 977, y: 577 },
    },
    anchors: {
      LT: { x: 460, y: 102, r: 40, rect: { w: 150, h: 76, rx: 22 } },
      RT: { x: mirror(460), y: 102, r: 40, rect: { w: 150, h: 76, rx: 22 } },
      LB: { x: 450, y: 214, r: 40, rect: { w: 230, h: 56, rx: 24 } },
      RB: { x: mirror(450), y: 214, r: 40, rect: { w: 230, h: 56, rx: 24 } },
      Guide: { x: 800, y: 266, r: 58 },
      Back: { x: 706, y: 389, r: 36 },
      Start: { x: 894, y: 389, r: 36 },
      "Left Stick": { x: 458, y: 390, r: 98 },
      "Right Stick": { x: 977, y: 577, r: 98 },
      "D-pad Up": { x: 627, y: 535, r: 38 },
      "D-pad Down": { x: 627, y: 659, r: 38 },
      "D-pad Left": { x: 565, y: 597, r: 38 },
      "D-pad Right": { x: 689, y: 597, r: 38 },
      Y: { x: 1140, y: 307, r: 54 },
      B: { x: 1234, y: 395, r: 54 },
      A: { x: 1140, y: 483, r: 54 },
      X: { x: 1046, y: 395, r: 54 },
    },
  },
};

export function artSpec(kind: ArtKind): Readonly<ArtSpec> {
  return specs[kind];
}

/** Center of a control in the drawing's own coordinates (used for callouts). */
export function controlAnchor(kind: ArtKind, control: string): Anchor | undefined {
  return specs[kind].anchors[control];
}

const NS = "http://www.w3.org/2000/svg";
function svgNode<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}
function shape(anchor: Anchor, className: string): SVGElement {
  return anchor.rect
    ? svgNode("rect", {
        class: className,
        x: anchor.x - anchor.rect.w / 2,
        y: anchor.y - anchor.rect.h / 2,
        width: anchor.rect.w,
        height: anchor.rect.h,
        rx: anchor.rect.rx,
      })
    : svgNode("circle", { class: className, cx: anchor.x, cy: anchor.y, r: anchor.r });
}

/**
 * Prepare an inlined drawing: crop the view box, add the hotspot overlay and callout.
 * Returns the SVG element, or undefined when the drawing was not inlined.
 */
export function decorateArt(host: HTMLElement, kind: ArtKind, interactive: boolean) {
  const spec = specs[kind];
  const svg = host.querySelector<SVGSVGElement>(`svg[data-art="${spec.prefix}"]`);
  if (!svg) return undefined;
  const { x, y, width, height } = spec.viewBox;
  svg.setAttribute("viewBox", `${String(x)} ${String(y)} ${String(width)} ${String(height)}`);
  svg.setAttribute("role", "group");
  svg.setAttribute(
    "aria-label",
    kind === "xbox" ? "Controle Xbox virtual" : "Controle físico DualShock 4",
  );
  svg.classList.add(`art-${kind}`);
  svg.style.setProperty("--u", String(spec.unit));

  const defs = svgNode("defs", {});
  const glow = svgNode("filter", {
    id: `${spec.prefix}-hl-glow`,
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%",
  });
  glow.append(svgNode("feGaussianBlur", { stdDeviation: 4 * spec.unit }));
  defs.append(glow);

  const overlay = svgNode("g", { class: "overlay" });
  overlay.style.setProperty("--hl-glow", `url(#${spec.prefix}-hl-glow)`);
  for (const [name, anchor] of Object.entries(spec.anchors)) {
    const group = svgNode("g", { class: "pad-control", "data-control": name });
    if (interactive) {
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", name);
    }
    const labelled = spec.labels.includes(name);
    if (labelled) group.classList.add("labelled");
    group.append(shape(anchor, "hl-glow"), shape(anchor, "hl-ring"));
    if (labelled) {
      const text = svgNode("text", { class: "hl-label", x: anchor.x, y: anchor.y });
      text.textContent = name;
      group.append(text);
    }
    group.append(shape(anchor, "hotspot"));
    overlay.append(group);
  }
  const callout = svgNode("g", { class: "callout", hidden: "" });
  callout.append(
    svgNode("path", { class: "callout-line" }),
    svgNode("rect", { class: "callout-box", rx: 8 * spec.unit }),
    svgNode("text", { class: "callout-text" }),
  );
  svg.append(defs, overlay, callout);
  return svg;
}

/** Move an analog stick of the drawing by a normalized deflection (-1..1). */
export function moveStick(kind: ArtKind, side: "left" | "right", dx: number, dy: number) {
  const stick = specs[kind].sticks[side];
  const node = document.getElementById(stick.id);
  const reach = 22;
  const value = `translate(${(stick.x + dx * reach).toFixed(1)} ${(stick.y + dy * reach).toFixed(1)})`;
  if (node && node.getAttribute("transform") !== value) node.setAttribute("transform", value);
}
