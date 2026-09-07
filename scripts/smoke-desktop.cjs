const { app } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const timeout = setTimeout(() => {
  console.error("Desktop smoke test timed out");
  app.exit(1);
}, 15000);
app.on("browser-window-created", (_event, window) => {
  window.webContents.once("did-finish-load", async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async () => {
        if (!window.xbridge) throw new Error('Preload API unavailable');
        if (document.querySelectorAll('#mapping select').length !== 4) throw new Error('Mapping UI missing');
        if (document.querySelectorAll('svg').length !== 2) throw new Error('Controller drawings missing');
        const total = [...document.querySelectorAll('#tabs button')].reduce((count, tab) => { tab.click(); return count + document.querySelectorAll('#mapping select').length; }, 0);
        if (total !== 22) throw new Error('Incomplete control assignments');
        document.querySelector('#tabs button').click();
        document.querySelector('#physical [data-control="Circle"]').dispatchEvent(new MouseEvent('click'));
        document.querySelector('#xbox [data-control="A"]').dispatchEvent(new MouseEvent('click'));
        if (document.querySelector('#selected-target').textContent !== 'A') throw new Error('Drawing remap failed');
        document.querySelector('#reset').click();
        await window.xbridge.loadMapping();
        let hardware;
        try {
          await window.xbridge.connect();
          await new Promise(resolve => setTimeout(resolve, 1000));
          const state = await window.xbridge.state();
          if (state.inputAvailable) {
            await window.xbridge.startOutput();
            await new Promise(resolve => setTimeout(resolve, 300));
            if ((await window.xbridge.state()).outputStatus !== 'active') throw new Error('Physical-to-Xbox output did not activate');
            await window.xbridge.stopOutput();
            if ((await window.xbridge.state()).outputStatus !== 'stopped') throw new Error('Output did not stop');
          }
          hardware = { connected: state.connected, count: state.count, inputAvailable: state.inputAvailable, input: state.input, mappedInput: state.mappedInput, error: state.error, inputError: state.inputError };
        } catch (error) { hardware = { error: String(error) }; }
        return { controls: total, drawings: 2, clickRemapping: true, preload: true, hardware };
      })()`);
      await mkdir(join(__dirname, "../artifacts"), { recursive: true });
      await writeFile(
        join(__dirname, "../artifacts/desktop.png"),
        (await window.webContents.capturePage()).toPNG(),
      );
      console.log(JSON.stringify(result));
      await window.webContents.executeJavaScript("window.xbridge.disconnect()");
      clearTimeout(timeout);
      app.quit();
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});
void import("../dist/ui/main.js");
