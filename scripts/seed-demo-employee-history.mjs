import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStorage } from "../storage.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const marker = "synthetic-history-v1";
const storage = createStorage({
  dataDir: process.env.AIHR_DATA_DIR || join(root, "data"),
  databaseUrl: process.env.DATABASE_URL || "",
  organizationId: process.env.AIHR_ORGANIZATION_ID || "default",
  sslMode: process.env.DATABASE_SSL || "auto"
});

await storage.initialize();

const result = await storage.mutate((store) => {
  const employees = store.records.filter((record) => record.type === "employee" && !record.deletedAt);
  const reviewed = new Set(
    store.performanceReviews
      .filter((review) => review.demoSeed === marker)
      .map((review) => review.employeeRecordId)
  );
  const recorded = new Set(
    store.employeeEvents
      .filter((event) => event.demoSeed === marker)
      .map((event) => event.employeeRecordId)
  );
  const now = new Date();
  const nextReviewAt = new Date(now);
  nextReviewAt.setDate(nextReviewAt.getDate() + 90);
  let reviewsAdded = 0;
  let eventsAdded = 0;

  for (const [index, employee] of employees.entries()) {
    const isRecognitionQueue = index < 3;
    const isSupportQueue = index >= 3 && index < 6;
    const category = isRecognitionQueue ? "recognition" : isSupportQueue ? "support" : index % 4 === 0 ? "win" : "steady";

    if (!reviewed.has(employee.id)) {
      const reviewContent = category === "recognition"
        ? {
            outcome: "exceeding",
            status: "recognition_review",
            wins: "Synthetic demo evidence: delivered a documented milestone and received positive stakeholder feedback.",
            concerns: "No concerns recorded in this synthetic review.",
            evidence: "Synthetic demonstration record for product testing. A human reviewer must replace this with verified workplace evidence before making any decision.",
            supportProvided: "Manager check-in and continued growth opportunities."
          }
        : category === "support"
          ? {
              outcome: "partially_meeting",
              status: "support_needed",
              wins: "Synthetic demo evidence: completed assigned work and participated in team check-ins.",
              concerns: "Synthetic demo concern: one agreed milestone needs clearer follow-through and documented coaching.",
              evidence: "Synthetic demonstration record for product testing. It is not a real assessment or an employment recommendation.",
              supportProvided: "A 30-day coaching plan, clear milestones, and weekly manager check-ins."
            }
          : {
              outcome: category === "win" ? "exceeding" : "meeting",
              status: "closed",
              wins: category === "win"
                ? "Synthetic demo evidence: completed a team milestone and shared a useful process improvement."
                : "Synthetic demo evidence: completed assigned responsibilities during the review period.",
              concerns: "No concerns recorded in this synthetic review.",
              evidence: "Synthetic demonstration record for product testing. A human reviewer must use verified evidence for real HR decisions.",
              supportProvided: "Routine manager feedback and access to role resources."
            };

      store.performanceReviews.push({
        id: randomUUID(),
        employeeRecordId: employee.id,
        employeeName: employee.name,
        reviewPeriod: "Synthetic demo baseline",
        goals: "Maintain role expectations, document progress, and discuss development goals with a manager.",
        nextReviewAt: nextReviewAt.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: "system:demo-history",
        demoSeed: marker,
        ...reviewContent
      });
      reviewsAdded += 1;
    }

    if (!recorded.has(employee.id)) {
      const isOpenComplaint = index >= 6 && index < 9;
      const type = isOpenComplaint ? "complaint" : category === "recognition" || category === "win" ? "shout_out" : "observation";
      const summary = isOpenComplaint
        ? "Synthetic demo complaint: a sample workplace concern was submitted and requires factual human review."
        : type === "shout_out"
          ? "Synthetic demo shout-out: recognized for constructive teamwork and delivery on an agreed milestone."
          : "Synthetic demo observation: routine progress check-in recorded; no high-impact action proposed.";
      store.employeeEvents.push({
        id: randomUUID(),
        employeeRecordId: employee.id,
        employeeName: employee.name,
        type,
        summary,
        source: "Built-in synthetic demo generator",
        status: isOpenComplaint ? "open" : "reviewed",
        occurredAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: "system:demo-history",
        demoSeed: marker
      });
      eventsAdded += 1;
    }
  }

  store.audit.push({
    id: randomUUID(),
    action: "synthetic_employee_history_populated",
    actor: "system:demo-history",
    detail: { marker, employees: employees.length, reviewsAdded, eventsAdded },
    createdAt: now.toISOString()
  });
  return { employees: employees.length, reviewsAdded, eventsAdded };
});

await storage.close();
console.log(JSON.stringify(result));
