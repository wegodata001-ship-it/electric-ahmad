/**
 * AI scan job — validation, recovery rules, and status mapping.
 * Run: npx tsx scripts/test-ai-scan-job.ts
 */
import { normalizeContractBoq } from "../src/lib/ai/contract-boq.schema";
import { extractJson } from "../src/lib/ai/document-parser.service";
import {
  classifyGeminiError,
  isTransientGeminiError,
} from "../src/lib/ai/gemini-errors";
import {
  backoffMs,
  isActiveScanStatus,
  isStaleLock,
  isTerminalScanStatus,
  normalizeScanStatus,
  SCAN_STATUS,
  scanStepIndex,
} from "../src/lib/ai/scan-job";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}`);
  }
}

const validRaw = {
  documentType: "contract_boq",
  project: {
    name: "פרויקט בדיקה",
    contractNumber: "C-100",
    contractor: "קבלן",
    location: "תל אביב",
    contractValue: 1000,
  },
  rooms: [{ name: "חדר חשמל", sortOrder: 1 }],
  chapters: [{ name: "חדר חשמל", sortOrder: 1 }],
  items: [
    {
      code: "01.01",
      description: "התקנת לוח",
      unit: "יח'",
      contractQuantity: 2,
      unitPrice: 100,
      chapter: "חדר חשמל",
    },
  ],
  missingFields: [],
  confidence: 0.9,
};

const valid = normalizeContractBoq(validRaw);
assert("valid JSON + schema", valid.ok && valid.ok && valid.data.items.length === 1);
assert("does not invent rooms", valid.ok && valid.data.rooms?.[0]?.name === "חדר חשמל");
assert(
  "computes total only from qty*price",
  valid.ok && valid.data.items[0].totalPrice === 200
);

const inventedFiltered = normalizeContractBoq({
  ...validRaw,
  items: [
    { description: null, code: null, contractQuantity: 99, unitPrice: 99 },
    validRaw.items[0],
  ],
});
assert(
  "drops items without description/code",
  inventedFiltered.ok && inventedFiltered.data.items.length === 1
);

const missing = normalizeContractBoq({
  documentType: "contract_boq",
  project: { name: null },
  items: [],
});
assert(
  "missing fields are flagged, not invented",
  missing.ok &&
    missing.data.project.contractValue == null &&
    missing.data.missingFields.includes("project.name") &&
    missing.data.missingFields.includes("items")
);

const invalid = normalizeContractBoq("not-json-object");
assert("invalid payload fails validation", !invalid.ok);

try {
  extractJson("hello");
  assert("extractJson rejects non-json", false);
} catch {
  assert("extractJson rejects non-json", true);
}

assert("legacy success maps to completed", normalizeScanStatus("success") === SCAN_STATUS.COMPLETED);
assert("queued is active", isActiveScanStatus(SCAN_STATUS.QUEUED));
assert("completed is terminal", isTerminalScanStatus(SCAN_STATUS.COMPLETED));
assert("timed_out is terminal", isTerminalScanStatus(SCAN_STATUS.TIMED_OUT));
assert("step index for processing", scanStepIndex(SCAN_STATUS.PROCESSING) === 2);
assert("stale lock after 5 minutes", isStaleLock(new Date(Date.now() - 5 * 60_000)));
assert("fresh lock after 30s", !isStaleLock(new Date(Date.now() - 30_000)));
assert("backoff grows", backoffMs(1) === 2000 && backoffMs(3) === 8000);

assert("429 is transient", isTransientGeminiError(classifyGeminiError("429 rate limit")));
assert("503 is transient", isTransientGeminiError(classifyGeminiError("503 unavailable")));
assert("timeout is not retried as unknown", classifyGeminiError(new DOMException("aborted", "AbortError")) === "timeout");
assert("bad json is permanent", classifyGeminiError("לא התקבל JSON תקין מ-AI") === "invalid_json");
assert("auth is permanent", !isTransientGeminiError(classifyGeminiError("401 api key")));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
