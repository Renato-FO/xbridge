import {
  controls,
  choices,
  defaultMapping,
  type Control,
  type ControlValues,
  type DesktopApi,
  type Mapping,
  type MonitorState,
  type Output,
} from "../contracts.js";
import { artSpec, controlAnchor, decorateArt, moveStick, type ArtKind } from "./controller-art.js";
declare global {
  interface Window {
    xbridge: DesktopApi;
  }
}
// Fixed application markup: callers specify the expected DOM element type.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing element ${id}`);
  return result as T;
}
const api = window.xbridge;

const labels: Record<string, string> = {
  Cross: "Cross ×",
  Circle: "Circle ○",
  Square: "Square □",
  Triangle: "Triangle △",
  L3: "L3 · clique",
  R3: "R3 · clique",
  L2: "L2 · gatilho",
  R2: "R2 · gatilho",
  "D-pad Up": "Direcional ↑",
  "D-pad Down": "Direcional ↓",
  "D-pad Left": "Direcional ←",
  "D-pad Right": "Direcional →",
  "Left X": "Analógico esq. · X",
  "Left Y": "Analógico esq. · Y",
  "Right X": "Analógico dir. · X",
  "Right Y": "Analógico dir. · Y",
};
const outputLabels: Record<string, string> = {
  Disabled: "Desativado",
  "Left Stick": "L3 · Left Stick",
  "Right Stick": "R3 · Right Stick",
  "D-pad Up": "Direcional ↑",
  "D-pad Down": "Direcional ↓",
  "D-pad Left": "Direcional ←",
  "D-pad Right": "Direcional →",
};
const sourceIcons: Record<string, string> = {
  Cross: "×",
  Circle: "○",
  Square: "□",
  Triangle: "△",
  "D-pad Up": "↑",
  "D-pad Down": "↓",
  "D-pad Left": "←",
  "D-pad Right": "→",
  Share: "SH",
  Options: "OP",
  Touchpad: "TP",
  "Left X": "LX",
  "Left Y": "LY",
  "Right X": "RX",
  "Right Y": "RY",
};
const outputBadges: Record<string, string> = {
  "Left Stick": "L3",
  "Right Stick": "R3",
  Back: "◁",
  Start: "▷",
  Guide: "⊗",
  Disabled: "–",
  "D-pad Up": "↑",
  "D-pad Down": "↓",
  "D-pad Left": "←",
  "D-pad Right": "→",
  "Left X": "LX",
  "Left Y": "LY",
  "Right X": "RX",
  "Right Y": "RY",
};
const groups: Record<string, readonly Control[]> = {
  Botões: controls.slice(0, 4),
  Direcional: controls.slice(12, 16),
  Ombros: ["L1", "R1", "L2", "R2"],
  Analógicos: ["L3", "R3", ...controls.slice(18)],
  Sistema: ["Share", "Options", "PS", "Touchpad"],
};
const responseOutputs: readonly Output[] = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "Back",
  "Start",
  "D-pad Up",
  "D-pad Down",
  "D-pad Left",
  "D-pad Right",
  "Left Stick",
  "Right Stick",
  "Guide",
];
const analog = new Set(["Left X", "Left Y", "Right X", "Right Y"]);

let mapping: Mapping = { ...defaultMapping };
let selected: Control = "Cross";
let group = "Botões";
let dirty = false;
let available = false;
let outputActive = false;
let pressedOutputs = new Set<string>();
let lastOutput: string | undefined;
let pressedSources = new Set<string>();
let lastCommand: { source: Control; target: Output; at: number } | undefined;

const label = (control: string) => labels[control] ?? control;
const outputLabel = (output: string) => outputLabels[output] ?? output;
const percent = (value: number) => `${String(Math.round(value * 100))}%`;

function setBadge(node: HTMLElement, output: string) {
  const letter = ["A", "B", "X", "Y"].includes(output);
  const tag = !letter && !(output in outputBadges) && output !== "Disabled";
  node.className = [
    "badge",
    node.classList.contains("big") ? "big" : "",
    letter ? `badge-${output}` : "",
    tag || analog.has(output) || output.endsWith("Stick") ? "badge-tag" : "",
    output === "Disabled" ? "badge-none" : "",
  ]
    .filter(Boolean)
    .join(" ");
  node.textContent = outputBadges[output] ?? output;
}
function badge(output: string): HTMLSpanElement {
  const node = document.createElement("span");
  setBadge(node, output);
  return node;
}
function sourceIcon(control: string): HTMLSpanElement {
  const node = document.createElement("span");
  const icon = sourceIcons[control] ?? control;
  node.className = `src-icon src-${control}${icon.length > 1 ? " tag" : ""}`;
  node.textContent = icon;
  return node;
}
function fillSelect(select: HTMLSelectElement, source: Control) {
  select.replaceChildren(
    ...choices(source).map((output) => new Option(outputLabel(output), output)),
  );
  select.value = mapping[source];
}

async function action(work: () => Promise<unknown>) {
  try {
    element("notice").textContent = "";
    await work();
  } catch (error) {
    element("notice").textContent = error instanceof Error ? error.message : String(error);
  }
}

/* ---------- Art & callouts ---------- */
decorateArt(element("physical"), "physical", true);
decorateArt(element("xbox"), "xbox", false);

function placeCallout(kind: ArtKind, control: string | undefined, text: string) {
  const callout = element(kind).querySelector<SVGGElement>(".callout");
  if (!callout) return;
  const anchor = control === undefined ? undefined : controlAnchor(kind, control);
  if (!anchor) {
    callout.setAttribute("hidden", "");
    return;
  }
  callout.removeAttribute("hidden");
  const { viewBox, body, unit } = artSpec(kind);
  const width = Math.round((28 + text.length * 8.4) * unit),
    height = 36 * unit;
  const right = anchor.x >= body.left + (body.right - body.left) / 2;
  const reach = (anchor.rect ? anchor.rect.w / 2 : anchor.r) + 40 * unit;
  const minX = viewBox.x + 2 * unit,
    maxX = viewBox.x + viewBox.width - width - 2 * unit;
  const boxX = right
    ? Math.min(maxX, Math.max(anchor.x + reach, body.right))
    : Math.max(minX, Math.min(anchor.x - reach - width, body.left - width));
  const boxY = Math.min(
    viewBox.y + viewBox.height - height - 4 * unit,
    Math.max(viewBox.y + 4 * unit, anchor.y + anchor.r * 0.9 - height / 2),
  );
  const midY = boxY + height / 2;
  const edgeX = right ? boxX : boxX + width;
  const startX = anchor.x + (right ? 1 : -1) * anchor.r * 0.72,
    startY = anchor.y + anchor.r * 0.7;
  const elbowX = edgeX + (right ? -26 : 26) * unit;
  callout
    .querySelector(".callout-line")
    ?.setAttribute(
      "d",
      `M${String(startX)} ${String(startY)} L${String(elbowX)} ${String(midY)} L${String(edgeX)} ${String(midY)}`,
    );
  const box = callout.querySelector(".callout-box");
  box?.setAttribute("x", String(boxX));
  box?.setAttribute("y", String(boxY));
  box?.setAttribute("width", String(width));
  box?.setAttribute("height", String(height));
  const caption = callout.querySelector(".callout-text");
  caption?.setAttribute("x", String(boxX + 14 * unit));
  caption?.setAttribute("y", String(midY));
  if (caption) caption.textContent = text;
}

/* ---------- Mapping panel ---------- */
function updateSelection() {
  element("selected-source").textContent = label(selected);
  const select = element<HTMLSelectElement>("selected-target");
  fillSelect(select, selected);
  setBadge(element("selected-badge"), mapping[selected]);
  document
    .querySelectorAll<HTMLElement>("[data-source]")
    .forEach((node) => node.classList.toggle("selected", node.dataset["source"] === selected));
  element("physical")
    .querySelectorAll<SVGElement>("[data-control]")
    .forEach((node) => node.classList.toggle("selected", node.dataset["control"] === selected));
  const symbol = sourceIcons[selected] ?? selected;
  placeCallout(
    "physical",
    selected,
    `${symbol}  →  ${outputBadges[mapping[selected]] ?? mapping[selected]}`,
  );
}
function conflicts() {
  const duplicate = Object.entries(mapping).filter(
    ([source, target]) =>
      target !== "Disabled" &&
      Object.entries(mapping).some(
        ([other, destination]) => other !== source && destination === target,
      ),
  );
  const targets = [...new Set(duplicate.map(([, target]) => outputLabel(target)))];
  element("conflicts").textContent = targets.length
    ? `Destinos compartilhados: ${targets.join(", ")}. Qualquer uma das entradas ativa o destino.`
    : "";
}
function renderChips() {
  element("mapping-chips").replaceChildren(
    ...(groups[group] ?? []).map((source) => {
      const chip = document.createElement("button");
      chip.className = "chip mapping-chip";
      chip.dataset["source"] = source;
      chip.title = `${label(source)} → ${outputLabel(mapping[source])}`;
      const arrow = document.createElement("span");
      arrow.className = "arrow-small";
      arrow.textContent = "→";
      chip.append(sourceIcon(source), arrow, badge(mapping[source]));
      chip.onclick = () => {
        selectSource(source);
      };
      return chip;
    }),
  );
}
function renderMappings() {
  element("mapping").replaceChildren();
  for (const source of groups[group] ?? []) {
    const row = document.createElement("div");
    row.className = "mapping-row";
    row.dataset["source"] = source;
    const button = document.createElement("button");
    button.className = "source-button";
    const text = document.createElement("span");
    text.textContent = label(source);
    button.append(sourceIcon(source), text);
    button.onclick = () => {
      selectSource(source);
    };
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("viewBox", "0 0 24 24");
    arrow.setAttribute("class", "icon arrow");
    arrow.setAttribute("aria-hidden", "true");
    arrow.innerHTML = '<path d="M4 12h16m-6-6 6 6-6 6"/>';
    const target = document.createElement("span");
    target.className = "target";
    const targetBadge = badge(mapping[source]);
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Destino Xbox de ${label(source)}`);
    fillSelect(select, source);
    select.onfocus = () => {
      selected = source;
      updateSelection();
    };
    select.onchange = () => {
      assign(source, select.value);
    };
    target.append(targetBadge, select);
    row.append(button, arrow, target);
    element("mapping").append(row);
  }
  element("tabs")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) => {
      button.classList.toggle("current", button.textContent === group);
      button.setAttribute("aria-pressed", String(button.textContent === group));
    });
  renderChips();
  updateSelection();
  conflicts();
}
function assign(source: Control, value: string) {
  const target = choices(source).find((output) => output === value);
  if (!target) return;
  mapping[source] = target;
  selected = source;
  changed();
  renderMappings();
}
function selectSource(source: Control) {
  selected = source;
  group = Object.keys(groups).find((name) => groups[name]?.includes(source)) ?? "Botões";
  renderMappings();
}
function setSaved(text: string, state: "dirty" | "saved" | "") {
  const node = element("saved");
  node.className = state;
  const span = node.querySelector("span");
  if (span) span.textContent = text;
}
function changed() {
  dirty = true;
  setSaved("Alterações não salvas", "dirty");
  updateSelection();
  conflicts();
  void action(() => api.previewMapping(mapping));
}
element<HTMLSelectElement>("selected-target").onchange = (event) => {
  assign(selected, (event.target as HTMLSelectElement).value);
};
for (const name of Object.keys(groups)) {
  const button = document.createElement("button");
  button.textContent = name;
  button.onclick = () => {
    group = name;
    selected = groups[name]?.[0] ?? "Cross";
    renderMappings();
  };
  element("tabs").append(button);
}
for (const node of Array.from(element("physical").querySelectorAll<SVGElement>("[data-control]"))) {
  const choose = () => {
    const source = controls.find((value) => value === node.dataset["control"]);
    if (source) selectSource(source);
  };
  node.addEventListener("click", choose);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose();
    }
  });
}

/* ---------- Navigation ---------- */
document.querySelectorAll<HTMLButtonElement>("[data-view-target]").forEach((button) => {
  button.onclick = () => {
    const view = button.dataset["viewTarget"] ?? "controller";
    document.body.dataset["view"] = view;
    document.querySelectorAll<HTMLButtonElement>(".nav-item[data-view-target]").forEach((item) => {
      const current = item.dataset["viewTarget"] === view;
      item.classList.toggle("current", current);
      item.setAttribute("aria-pressed", String(current));
    });
  };
});
document.querySelectorAll<HTMLButtonElement>("[data-mode-target]").forEach((button) => {
  button.onclick = () => {
    const mode = button.dataset["modeTarget"] ?? "map";
    document.body.dataset["mode"] = mode;
    document.querySelectorAll<HTMLButtonElement>("[data-mode-target]").forEach((tab) => {
      const current = tab.dataset["modeTarget"] === mode;
      tab.classList.toggle("current", current);
      tab.setAttribute("aria-selected", String(current));
    });
  };
});
element("response-buttons").replaceChildren(
  ...responseOutputs.map((output) => {
    const key = document.createElement("div");
    key.className = "response-key";
    key.dataset["output"] = output;
    key.title = outputLabel(output);
    if (["A", "B", "X", "Y"].includes(output)) key.append(badge(output));
    else key.textContent = outputBadges[output] ?? output;
    if (output === "Back" || output === "Start" || output === "Guide")
      key.append(document.createTextNode(` ${output}`));
    return key;
  }),
);

/* ---------- Live drawing ---------- */
function draw(side: ArtKind, values: ControlValues) {
  element(side)
    .querySelectorAll<SVGElement>("[data-control]")
    .forEach((node) => {
      node.classList.toggle("active", (values[node.dataset["control"] ?? ""] ?? 0) > 0.15);
    });
  for (const stick of ["left", "right"] as const) {
    const prefix = stick === "left" ? "Left" : "Right";
    moveStick(side, stick, values[`${prefix} X`] ?? 0, values[`${prefix} Y`] ?? 0);
  }
}
function drawStick(id: string, values: ControlValues, prefix: string) {
  const x = values[`${prefix} X`] ?? 0,
    y = values[`${prefix} Y`] ?? 0;
  element(`${id}-dot`).style.transform = `translate(${String(x * 32)}px, ${String(y * 32)}px)`;
  element(`${id}-value`).textContent = `X: ${percent(x)}   Y: ${percent(y)}`;
}
function drawBar(id: string, value: number) {
  element(`${id}-bar`).style.width = percent(Math.min(1, Math.max(0, value)));
  element(`${id}-value`).textContent = percent(value);
}
function trackTest(input: ControlValues, mapped: ControlValues) {
  const outputsNow = new Set(
    Object.entries(mapped)
      .filter(([name, value]) => !analog.has(name) && value > 0.5)
      .map(([name]) => name),
  );
  for (const output of outputsNow) if (!pressedOutputs.has(output)) lastOutput = output;
  if (lastOutput !== undefined && !outputsNow.has(lastOutput)) lastOutput = [...outputsNow].at(-1);
  pressedOutputs = outputsNow;

  const sourcesNow = new Set(
    Object.entries(input)
      .filter(([name, value]) => !analog.has(name) && value > 0.5)
      .map(([name]) => name),
  );
  for (const name of sourcesNow) {
    const source = controls.find((value) => value === name);
    if (source && !pressedSources.has(name))
      lastCommand = { source, target: mapping[source], at: Date.now() };
  }
  pressedSources = sourcesNow;

  document.querySelectorAll<HTMLElement>(".response-key").forEach((key) => {
    key.classList.toggle("active", (mapped[key.dataset["output"] ?? ""] ?? 0) > 0.5);
  });
  const pressed =
    lastOutput === undefined ? "" : `${outputBadges[lastOutput] ?? lastOutput} pressionado`;
  placeCallout("xbox", lastOutput, pressed);
  setBadge(element("test-last-badge"), lastOutput ?? "Disabled");
  element("test-last").textContent = pressed || "Nenhum botão pressionado";

  if (lastCommand) {
    setBadge(element("last-badge"), lastCommand.target);
    element("last-command").textContent =
      `${label(lastCommand.source)}  →  ${outputLabel(lastCommand.target)}`;
    const seconds = Math.floor((Date.now() - lastCommand.at) / 1000);
    element("last-time").textContent =
      seconds < 2 ? "Entrada recebida agora" : `Entrada recebida há ${String(seconds)} s`;
  }
}

/* ---------- Actions ---------- */
element("output-toggle").onclick = () => {
  void action(() => (outputActive ? api.stopOutput() : api.startOutput()));
};
element("connect").onclick = () => {
  void action(() => api.connect());
};
element("disconnect").onclick = () => {
  void action(() => api.disconnect());
};
element("capture").onclick = () => {
  void action(() => api.capture(element<HTMLInputElement>("label").value));
};
element("reset").onclick = () => {
  mapping = { ...defaultMapping };
  changed();
  renderMappings();
};
element("save").onclick = () => {
  void action(async () => {
    await api.saveMapping(mapping);
    dirty = false;
    setSaved("Perfil salvo", "saved");
  });
};

function renderStatus(state: MonitorState) {
  const starting = state.outputStatus === "starting";
  const outputError = state.outputError !== undefined && state.outputError !== "";
  const outputStatus = element("output-status");
  outputStatus.textContent = outputActive
    ? "Saída ativa"
    : starting
      ? "Iniciando…"
      : outputError
        ? "Falha na saída"
        : "Saída desativada";
  outputStatus.className = `pill${outputActive ? " on" : starting ? " warn" : outputError ? " error" : ""}`;
  const toggle = element<HTMLButtonElement>("output-toggle");
  toggle.classList.toggle("active", outputActive);
  toggle.classList.toggle("primary", !outputActive);
  element("output-toggle-label").textContent = outputActive
    ? "Desativar saída"
    : "Ativar saída Xbox";
  toggle.disabled = starting || (!available && !outputActive);
  const detail = element("output-detail");
  detail.textContent = outputError
    ? (state.outputError ?? "")
    : outputActive
      ? "Os jogos recebem o perfil salvo. Edições não salvas só mudam a prévia."
      : "Cria um controle Xbox 360 virtual para os jogos usando o perfil salvo.";
  detail.classList.toggle("error", outputError);
  element("layout-hint").textContent =
    dirty && outputActive
      ? "Salve para aplicar as alterações aos jogos."
      : "Salve para aplicar o perfil à saída Xbox.";

  const status = element("status");
  status.textContent = available
    ? "Conectado"
    : state.connected
      ? "Aguardando entrada do Windows"
      : "Pressione PS para conectar";
  status.className = `state-text${available ? " on" : state.connected ? " warn" : ""}`;
  element("connection-dot").className = `dot${available ? " on" : state.connected ? " warn" : ""}`;
  element("footer-input").textContent = available
    ? "DualShock 4 conectado"
    : state.connected
      ? "DualShock 4 aguardando entrada"
      : "Controle desconectado";
  element("footer-output-dot").className = `dot${outputActive ? " on" : starting ? " warn" : ""}`;
  element("footer-output").textContent = outputActive
    ? "Saída Xbox ativa"
    : starting
      ? "Iniciando saída Xbox…"
      : "Saída Xbox desativada";
  element("test-connection-dot").className = `dot${available ? " on" : ""}`;
  element("test-connection").textContent = available ? "Conectado" : "Desconectado";
  const live = element("monitor-live");
  live.textContent = available ? "Ao vivo" : "Sem entrada";
  live.className = `pill${available ? " on" : ""}`;
  document.querySelectorAll<HTMLElement>(".live-pill").forEach((pill) => {
    pill.classList.toggle("on", available);
  });
}

async function refresh() {
  try {
    const state = await api.state();
    available = state.inputAvailable === true;
    outputActive = state.outputStatus === "active";
    renderStatus(state);
    element<HTMLButtonElement>("disconnect").disabled = !state.connected;
    element<HTMLButtonElement>("capture").disabled = !state.connected || state.capturing;
    element("capture").textContent = state.capturing ? "Gravando…" : "Gravar 5 segundos";
    if (state.inputError) element("notice").textContent = state.inputError;
    else if (state.error) element("notice").textContent = state.error;
    if (state.captureResult) element("capture-result").textContent = state.captureResult;
    const input = available ? (state.input ?? {}) : {},
      mapped = available ? (state.mappedInput ?? {}) : {};
    draw("physical", input);
    draw("xbox", mapped);
    drawStick("left", input, "Left");
    drawStick("right", input, "Right");
    drawBar("l2", input["L2"] ?? 0);
    drawBar("r2", input["R2"] ?? 0);
    drawBar("lt", mapped["LT"] ?? 0);
    drawBar("rt", mapped["RT"] ?? 0);
    element("test-lt").textContent = percent(mapped["LT"] ?? 0);
    element("test-rt").textContent = percent(mapped["RT"] ?? 0);
    trackTest(input, mapped);
    document
      .querySelectorAll<HTMLElement>(".mapping-row")
      .forEach((row) =>
        row.classList.toggle("active", Math.abs(input[row.dataset["source"] ?? ""] ?? 0) > 0.15),
      );
    element<HTMLButtonElement>("save").disabled = !dirty;
  } catch (error) {
    element("notice").textContent = String(error);
  }
  setTimeout(() => {
    void refresh();
  }, 33);
}
renderMappings();
if (typeof window.xbridge !== "undefined") {
  void action(async () => {
    mapping = await api.loadMapping();
    setSaved("Perfil salvo", "saved");
    renderMappings();
    await api.previewMapping(mapping);
    await api.connect();
  });
  void refresh();
} else element("notice").textContent = "Abra esta tela pelo XBridge para conectar o controle.";
