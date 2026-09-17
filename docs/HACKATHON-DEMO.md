# AI HR Hackathon Demo

## Positioning

AI HR is an AI HR copilot that organizes employee information, prepares HR work, and keeps important decisions under human control.

Do not describe it as an autonomous replacement for HR. The responsible approval workflow is part of the product value.

## Three-Minute Click Path

1. Open **Home** and point out the active dataset, employee count, open reviews, pending onboarding, complaints, and recent activity.
2. Select **Use demo data** when starting with a new workspace. The IBM benchmark is fictional and appears as **Demo data**.
3. Open **Employees**. Upload a CSV, or use the demo directory. Show the import summary for imported, duplicate, and rejected rows.
4. Select an employee to open the unified profile. Point out role, department, performance history, timeline records, pending actions, and audit history.
5. Choose **Add performance review**. Record one measurable win, one documented concern, the evidence, support already provided, and a next review date.
6. Return to the employee profile and choose **Add timeline record**. Add a shout-out or factual complaint record.
7. Choose **Prepare AI summary** to create a balanced summary from the documented history.
8. In **Reviews**, choose **Review next action**. Explain that promotion, compensation, demotion, discipline, or termination creates a recommendation for human review; it never applies the action automatically.
9. Approve or reject the brief in **Human review queue** and show the audit record in **Settings**.
10. Download a performance PDF. In **Onboarding**, generate and download a new-hire pack if time remains.

## Sample Review Data

- Employee: choose any fictional demo employee.
- Review period: `Hackathon demo - Q3 2026`
- Outcome: `Meeting expectations`
- Goals: `Resolve assigned work within the agreed service level and document repeatable solutions.`
- Win: `Published a troubleshooting guide that reduced repeat questions during the demo period.`
- Concern: `Two assigned follow-ups were completed after the agreed date.`
- Evidence: `Manager notes dated 12 and 19 August; guide published 22 August.`
- Support: `Weekly manager check-in and priority clarification.`
- Status: `Support needed`

## Presenter Boundary

Say: "The AI prepares a factual brief and proposes proportionate options. A named HR reviewer must approve or reject any high-impact action, and the outcome is audited."

Avoid claiming that the demo dataset predicts who should be fired. Aggregate IBM analytics demonstrate ingestion and workforce context, not individual scoring or causal conclusions.

## Demo Reset

- The **Use demo data** button is idempotent after the fictional IBM dataset is loaded.
- Exact duplicate uploads are skipped.
- Use a disposable workspace for repeated judging sessions when you want a clean activity timeline.
