// Rasterize build/icon.svg into the PNG/ICO files Electron and the installer need.
// Run with: npx electron scripts/build-icons.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "build/icon.svg"), "utf8");
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

/** Draw the SVG straight onto a canvas at each size, keeping its transparent corners. */
const rasterize = (sizeList) => `(async () => {
  const url = "data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}";
  const image = new Image();
  image.src = url;
  await image.decode();
  return ${JSON.stringify(sizeList)}.map((size) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/png").split(",")[1];
  });
})()`;

function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((entry) => entry.png)]);
}

void app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL("data:text/html,<html></html>");
  const encoded = await win.webContents.executeJavaScript(rasterize([...sizes, 512]));
  const pngs = encoded.map((data) => Buffer.from(data, "base64"));
  const icoImages = sizes.map((size, index) => ({ size, png: pngs[index] }));
  fs.writeFileSync(path.join(root, "build/icon.ico"), ico(icoImages));
  fs.writeFileSync(path.join(root, "build/icon.png"), pngs[sizes.length]);
  console.log("icons written");
  app.quit();
});
