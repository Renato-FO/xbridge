import {
  controls,
  choices,
  defaultMapping,
  type Control,
  type ControlValues,
  type DesktopApi,
  type Mapping,
} from "../contracts.js";
import { controllerArt } from "./controller-art.js";
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
  L3: "L3 · stick click",
  R3: "R3 · stick click",
  "Left X": "Left stick · X",
  "Left Y": "Left stick · Y",
  "Right X": "Right stick · X",
  "Right Y": "Right stick · Y",
  L2: "L2 · trigger",
  R2: "R2 · trigger",
};
const groups: Record<string, readonly Control[]> = {
  Buttons: controls.slice(0, 4),
  "D-pad": controls.slice(12, 16),
  Shoulders: ["L1", "R1", "L2", "R2"],
  Sticks: ["L3", "R3", ...controls.slice(18)],
  System: ["Share", "Options", "PS", "Touchpad"],
};
let mapping: Mapping = { ...defaultMapping };
let selected: Control = "Cross";
let group = "Buttons";
let dirty = false;
let available = false;
let outputActive = false;
element("output-toggle").onclick = () => {
  void action(() => (outputActive ? api.stopOutput() : api.startOutput()));
};
element("physical").innerHTML = controllerArt("physical");
element("xbox").innerHTML = controllerArt("xbox");
async function action(work: () => Promise<unknown>) {
  try {
    element("notice").textContent = "";
    await work();
  } catch (error) {
    element("notice").textContent = error instanceof Error ? error.message : String(error);
  }
}
function updateSelection() {
  element("selected-source").textContent = labels[selected] ?? selected;
  element("selected-target").textContent = mapping[selected];
  document
    .querySelectorAll<HTMLElement>(".mapping-row")
    .forEach((row) => row.classList.toggle("selected", row.dataset["source"] === selected));
  for (const side of ["physical", "xbox"])
    element(side)
      .querySelectorAll<SVGElement>("[data-control]")
      .forEach((node) =>
        node.classList.toggle(
          "selected",
          node.dataset["control"] === (side === "physical" ? selected : mapping[selected]),
        ),
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
  const targets = [...new Set(duplicate.map(([, target]) => target))];
  element("conflicts").textContent = targets.length
    ? `Shared destinations: ${targets.join(", ")}. Either input will activate the destination.`
    : "";
}
function renderMappings() {
  element("mapping").replaceChildren();
  for (const source of groups[group] ?? []) {
    const row = document.createElement("div");
    row.className = "mapping-row";
    row.dataset["source"] = source;
    const button = document.createElement("button");
    button.className = "source-button";
    button.textContent = labels[source] ?? source;
    button.onclick = () => {
      selectSource(source);
    };
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "→";
    const select = document.createElement("select");
    select.setAttribute("aria-label", `${source} Xbox assignment`);
    for (const output of choices(source)) select.add(new Option(output, output));
    select.value = mapping[source];
    select.onfocus = () => {
      selected = source;
      updateSelection();
    };
    select.onchange = () => {
      const target = choices(source).find((value) => value === select.value);
      if (target) {
        mapping[source] = target;
        selected = source;
        changed();
      }
    };
    row.append(button, arrow, select);
    element("mapping").append(row);
  }
  element("tabs")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) => {
      button.classList.toggle("current", button.textContent === group);
      button.setAttribute("aria-pressed", String(button.textContent === group));
    });
  updateSelection();
  conflicts();
}
function selectSource(source: Control) {
  selected = source;
  group = Object.keys(groups).find((name) => groups[name]?.includes(source)) ?? "Buttons";
  renderMappings();
}
function changed() {
  dirty = true;
  element("saved").textContent = "Unsaved layout · preview updated";
  updateSelection();
  conflicts();
  void action(() => api.previewMapping(mapping));
}
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
for (const side of ["physical", "xbox"] as const) {
  for (const node of Array.from(element(side).querySelectorAll<SVGElement>("[data-control]"))) {
    const choose = () => {
      const control = node.dataset["control"];
      if (side === "physical") {
        const source = controls.find((value) => value === control);
        if (source) selectSource(source);
      } else {
        const target = choices(selected).find((value) => value === control);
        if (target) {
          mapping[selected] = target;
          changed();
          renderMappings();
        } else
          element("notice").textContent =
            "Choose a compatible destination from the assignment menu for this axis.";
      }
    };
    node.addEventListener("click", choose);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
      }
    });
  }
}
function draw(side: string, values: ControlValues) {
  element(side)
    .querySelectorAll<SVGElement>("[data-control]")
    .forEach((node) => {
      node.classList.toggle("active", (values[node.dataset["control"] ?? ""] ?? 0) > 0.15);
    });
  for (const stick of ["left", "right"]) {
    const prefix = stick === "left" ? "Left" : "Right";
    const x = values[`${prefix} X`] ?? 0,
      y = values[`${prefix} Y`] ?? 0;
    element(side)
      .querySelector(`[data-stick="${stick}"]`)
      ?.setAttribute("transform", `translate(${String(x * 15)} ${String(y * 15)})`);
  }
}
function activeText(values: ControlValues): string {
  const active = Object.entries(values)
    .filter(
      ([name, value]) =>
        !name.endsWith("button") &&
        Math.abs(value) > (name.endsWith("X") || name.endsWith("Y") ? 0.15 : 0.5),
    )
    .map(([name]) => name);
  return active.length ? active.join(" · ") : "All controls released";
}
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
    element("saved").textContent = "Layout saved";
  });
};
async function refresh() {
  try {
    const state = await api.state();
    available = state.inputAvailable === true;
    outputActive = state.outputStatus === "active";
    element("output-status").textContent = outputActive
      ? "● Xbox output active"
      : state.outputStatus === "starting"
        ? "● Starting Xbox output…"
        : "● Xbox output stopped";
    element("output-status").classList.toggle("output-on", outputActive);
    element("output-toggle").textContent = outputActive ? "Stop Xbox output" : "Start Xbox output";
    element<HTMLButtonElement>("output-toggle").disabled =
      state.outputStatus === "starting" || (!available && !outputActive);
    element("output-detail").textContent =
      state.outputError !== undefined && state.outputError !== ""
        ? state.outputError
        : outputActive
          ? "Games receive your saved layout. Unsaved edits only change the preview."
          : "Creates a virtual Xbox 360 controller for games using your saved layout.";
    element("layout-hint").textContent =
      dirty && outputActive
        ? "Unsaved changes: save to apply them to games."
        : "Save to apply this layout to Xbox output.";
    element("status").textContent = available
      ? "Connected · live input"
      : state.connected
        ? "Connected · waiting for Windows input"
        : "Press PS to connect";
    element("connection-dot").classList.toggle("online", available);
    element<HTMLButtonElement>("disconnect").disabled = !state.connected;
    element<HTMLButtonElement>("capture").disabled = !state.connected || state.capturing;
    element("capture").textContent = state.capturing ? "Recording…" : "Record 5 seconds";
    if (state.inputError) element("notice").textContent = state.inputError;
    else if (state.error) element("notice").textContent = state.error;
    if (state.captureResult) element("capture-result").textContent = state.captureResult;
    const input = available ? (state.input ?? {}) : {},
      mapped = available ? (state.mappedInput ?? {}) : {};
    draw("physical", input);
    draw("xbox", mapped);
    element("physical-active").textContent = available
      ? activeText(input)
      : "No live input · reconnect your controller";
    element("mapped-active").textContent = available
      ? activeText(mapped)
      : "Waiting for physical input";
    for (const [id, key] of [
      ["lt", "LT"],
      ["rt", "RT"],
    ] as const) {
      const value = mapped[key] ?? 0;
      element<HTMLMeterElement>(id).value = value;
      element(`${id}-value`).textContent = `${String(Math.round(value * 100))}%`;
    }
    for (const [id, prefix] of [
      ["left", "Left"],
      ["right", "Right"],
    ])
      element(`${id ?? ""}-value`).textContent =
        `${(mapped[`${prefix ?? ""} X`] ?? 0).toFixed(2)} / ${(mapped[`${prefix ?? ""} Y`] ?? 0).toFixed(2)}`;
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
    renderMappings();
    await api.previewMapping(mapping);
    await api.connect();
  });
  void refresh();
} else
  element("notice").textContent = "Open this screen through XBridge to connect your controller.";
