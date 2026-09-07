import { readFile } from "node:fs/promises";

const capture = JSON.parse(await readFile(process.argv[2], "utf8"));
if (
  capture.schemaVersion !== 1 ||
  !Array.isArray(capture.reports) ||
  capture.reports.length === 0 ||
  capture.reports.some(
    (report) => typeof report.hex !== "string" || !/^(?:[0-9a-f]{2}){1,4096}$/.test(report.hex),
  )
) {
  throw new Error("Expected a nonempty version 1 capture with valid hexadecimal reports.");
}
const groups = Map.groupBy(
  capture.reports,
  (report) => `${report.hex.slice(0, 2)}:${report.hex.length / 2}`,
);
for (const [format, reports] of groups) {
  const first = Buffer.from(reports[0].hex, "hex");
  const changingOffsets = [];
  const nonzeroOffsets = [];
  for (let offset = 0; offset < first.length; offset++) {
    const values = [
      ...new Set(reports.map((report) => report.hex.slice(offset * 2, offset * 2 + 2))),
    ];
    if (values.length > 1) changingOffsets.push({ offset, values });
    if (values.some((value) => value !== "00")) nonzeroOffsets.push(offset);
  }
  console.log(
    JSON.stringify(
      {
        format,
        count: reports.length,
        first32Bytes: first.subarray(0, 32).toString("hex"),
        nonzeroOffsets,
        changingOffsets,
      },
      null,
      2,
    ),
  );
}
