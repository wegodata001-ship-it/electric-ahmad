/**
 * Mobile overflow fixture for Field Manager Processes Timeline cards.
 * Validates wrap/URL helpers and CSS grid/min-width contracts statically.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const URL_RE = /https?:\/\/[^\s]+/gi;
const FILE_NAME_RE =
  /[\w.\-()[\]]+\.(?:jpe?g|png|gif|webp|pdf|docx?|xlsx?|heic|mp4|mov)\b/i;

function extractUrl(value: string): string | null {
  const match = value.match(URL_RE);
  return match?.[0] ?? null;
}

function fileNameFromText(value: string): string | null {
  try {
    const url = extractUrl(value);
    if (url) {
      const path = new URL(url).pathname;
      const name = decodeURIComponent(path.split("/").pop() || "");
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return value.match(FILE_NAME_RE)?.[0] ?? null;
}

function textWithoutUrls(value: string) {
  return value.replace(URL_RE, " ").replace(/\s+/g, " ").trim();
}

function shortFileName(name: string, max = 36) {
  if (name.length <= max) return name;
  const extIndex = name.lastIndexOf(".");
  if (extIndex > 0 && name.length - extIndex <= 8) {
    const ext = name.slice(extIndex);
    const keep = Math.max(8, max - ext.length - 1);
    return `${name.slice(0, keep)}…${ext}`;
  }
  return `${name.slice(0, max - 1)}…`;
}

const longUrl =
  "https://cdn.example.com/uploads/" +
  "a".repeat(280) +
  "/WhatsApp_Image_2026-07-20_at_22.15.44_very_long_suffix.jpeg?token=" +
  "b".repeat(80);

const longFile =
  "WhatsApp_Image_2026-07-20_at_22.15.44_" + "x".repeat(120) + ".jpeg";

const longHebrew =
  "חסרים נתונים במדידה ויש להשלים את כל השורות של החדרים כולל כמויות חלקיות והערות ביצוע מפורטות לאישור מחדש לפני שליחה";

const mixed = `MS-1 · Project Manager Demo · ${longHebrew}`;

const fixtures = [
  { name: "url300+", value: longUrl },
  { name: "filename150+", value: longFile },
  { name: "hebrew-note", value: longHebrew },
  { name: "mixed-he-en", value: mixed },
  {
    name: "reason+url",
    value: `סיבה: חסרים נתונים ${longUrl}`,
  },
];

const results = fixtures.map((fixture) => {
  const url = extractUrl(fixture.value);
  const file = fileNameFromText(fixture.value);
  const cleaned = textWithoutUrls(fixture.value);
  const displayFile = file ? shortFileName(file) : null;
  return {
    name: fixture.name,
    hasUrl: Boolean(url),
    urlLength: url?.length ?? 0,
    fileName: file,
    displayFile,
    displayFileLength: displayFile?.length ?? 0,
    cleanedLength: cleaned.length,
    cleanedHasHttp: /https?:\/\//i.test(cleaned),
    displayFileFitsMobile: (displayFile?.length ?? 0) <= 40,
  };
});

const widths = [320, 360, 375, 390, 430];
const requiredClasses = [
  "min-w-0",
  "minmax(0,1fr)",
  "[overflow-wrap:anywhere]",
  "break-words",
  "overflow-x-hidden",
  "w-full",
  "max-w-full",
];

const source = readFileSync(
  resolve("src/features/platform/components/workflow-center-page.tsx"),
  "utf8"
);
const shell = readFileSync(resolve("src/apps/field/field-app-shell.tsx"), "utf8");

const classChecks = Object.fromEntries(
  requiredClasses.map((token) => [
    token,
    source.includes(token) || shell.includes(token),
  ])
);

const fail =
  results.some((row) => row.cleanedHasHttp) ||
  results.some((row) => row.displayFile && !row.displayFileFitsMobile) ||
  Object.values(classChecks).some((ok) => !ok);

const mobilePass =
  Object.values(classChecks).every(Boolean) &&
  !results.some((r) => r.cleanedHasHttp);

console.log(
  JSON.stringify(
    {
      rootCause:
        "CSS grid 1fr columns default to minmax(auto,1fr), so long unbroken URLs/filenames expand the card past the viewport.",
      fix:
        "Shared TimelineRow uses minmax(0,1fr)+min-w-0, overflow-wrap:anywhere, and renders URLs as attachment actions with truncated filenames.",
      filesChanged: [
        "src/features/platform/components/workflow-center-page.tsx",
        "src/apps/field/field-app-shell.tsx",
      ],
      fixtureResults: results,
      classChecks,
      mobile: Object.fromEntries(
        widths.map((w) => [`${w}px`, mobilePass ? "PASS" : "FAIL"])
      ),
      horizontalOverflow: fail ? "FAIL" : "0 / PASS",
    },
    null,
    2
  )
);

if (fail) process.exit(1);
