import { analyzeWorkforce, analyticsEvidence, validateAnalyticsOutput } from "../analytics.js";
import { retrieveKnowledge } from "../knowledge.js";

const records = [
  employee("A", "Yes", "Sales", "Yes"),
  employee("B", "No", "Sales", "No"),
  employee("C", "No", "Research", "No"),
  { id: "p1", type: "policy", name: "Leave policy", details: "Employees may request annual leave through the HR system.", updatedAt: new Date().toISOString() }
];
const analysis = analyzeWorkforce(records);
assert(analysis.summary.employees === 3, "Employee count is incorrect.");
assert(analysis.summary.attritionRate === 33.33, "Attrition rate is incorrect.");
assert(analysis.breakdowns.department.find((item) => item.label === "Sales")?.attritionRate === 50, "Department rate is incorrect.");
assert(analyticsEvidence(analysis).includes("33.33%"), "Evidence text omitted the verified rate.");
assert(validateAnalyticsOutput("Attrition is 33.33%.", analysis).length === 0, "Verified percentage was flagged.");
assert(validateAnalyticsOutput("We guarantee a 20% reduction because overtime causes attrition.", analysis).length === 2, "Unsupported claims were not flagged.");
assert(retrieveKnowledge(records, "How do I request leave?")[0]?.title === "Leave policy", "Knowledge retrieval failed.");
console.log("Grounded analytics, claim validation, and knowledge retrieval verification passed.");

function employee(name, attrition, department, overtime) {
  return { id: name, type: "employee", name, details: `Attrition: ${attrition}\nDepartment: ${department}\nOvertime: ${overtime}`, updatedAt: new Date().toISOString() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
