import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseDetails } from "../analytics.js";
import { createStorage } from "../storage.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const storage = createStorage({
  dataDir: process.env.AIHR_DATA_DIR || join(root, "data"),
  databaseUrl: process.env.DATABASE_URL || "",
  organizationId: process.env.AIHR_ORGANIZATION_ID || "default",
  sslMode: process.env.DATABASE_SSL || "auto"
});

const canonicalKey = (key) => key === "overtime" ? "over time" : key;
const isRichDemoRecord = (record) => record.type === "employee" && !record.deletedAt && record.attributes?.attrition;
const isCompactDemoRecord = (record) => record.type === "employee" && !record.deletedAt && !record.attributes && /^IBM Synthetic Employee #\d+$/.test(record.name);

await storage.initialize();

const result = await storage.mutate((store) => {
  const richRecords = store.records.filter(isRichDemoRecord);
  const compactRecords = store.records.filter(isCompactDemoRecord);
  const replacements = new Map();

  for (const compact of compactRecords) {
    const fields = parseDetails(compact.details);
    const matches = richRecords.filter((record) => Object.entries(fields).every(([key, value]) =>
      String(record.attributes?.[canonicalKey(key)] ?? "") === String(value)
    ));
    if (matches.length !== 1) {
      throw new Error(`Cleanup stopped: ${compact.name} matched ${matches.length} rich demo records.`);
    }
    replacements.set(compact.id, matches[0]);
  }

  const compactIds = new Set(replacements.keys());
  const compactNames = new Map(compactRecords.map((record) => [record.name.toLowerCase(), record.id]));
  let reviewsRemoved = 0;
  let eventsRemoved = 0;
  let reviewsMigrated = 0;
  let eventsMigrated = 0;

  store.performanceReviews = store.performanceReviews.filter((review) => {
    const compactId = compactIds.has(review.employeeRecordId)
      ? review.employeeRecordId
      : compactNames.get(String(review.employeeName || "").toLowerCase());
    if (!compactId) return true;
    const replacement = replacements.get(compactId);
    if (review.demoSeed === "synthetic-history-v1") {
      reviewsRemoved += 1;
      return false;
    }
    review.employeeRecordId = replacement.id;
    review.employeeName = replacement.name;
    reviewsMigrated += 1;
    return true;
  });

  store.employeeEvents = store.employeeEvents.filter((event) => {
    const compactId = compactIds.has(event.employeeRecordId)
      ? event.employeeRecordId
      : compactNames.get(String(event.employeeName || "").toLowerCase());
    if (!compactId) return true;
    const replacement = replacements.get(compactId);
    if (event.demoSeed === "synthetic-history-v1") {
      eventsRemoved += 1;
      return false;
    }
    event.employeeRecordId = replacement.id;
    event.employeeName = replacement.name;
    eventsMigrated += 1;
    return true;
  });

  store.records = store.records.filter((record) => !compactIds.has(record.id));
  const now = new Date().toISOString();
  store.audit.push({
    id: randomUUID(),
    action: "duplicate_demo_employees_removed",
    actor: "system:data-cleanup",
    detail: {
      recordsRemoved: compactIds.size,
      reviewsRemoved,
      eventsRemoved,
      reviewsMigrated,
      eventsMigrated
    },
    createdAt: now
  });

  return {
    recordsRemoved: compactIds.size,
    reviewsRemoved,
    eventsRemoved,
    reviewsMigrated,
    eventsMigrated,
    employeesRemaining: store.records.filter((record) => record.type === "employee" && !record.deletedAt).length
  };
});

await storage.close();
console.log(JSON.stringify(result));
