import { planSchema } from "./schema.js";

const clean = (value) => value.replace(/\s+/g, " ").trim();

export async function generateMockPlan(input) {
  const goal = clean(input.goal).slice(0, 400);
  const pageTitle = clean(input.context.title) || "the current page";
  const hasScreenshot = Boolean(input.context.screenshot);

  return planSchema.parse({
    title: `Mock guide: ${goal}`.slice(0, 150),
    summary: `This local demo guide shows how ClickCoach presents and saves steps for “${goal}” on ${pageTitle}. No AI provider was contacted.`,
    steps: [
      {
        title: "Review the current page",
        instruction: hasScreenshot
          ? `Look at the captured preview of ${pageTitle} and find the part of the page related to your goal.`
          : `Open ${pageTitle} and find the part of the page related to your goal.`,
        expectedResult:
          "The relevant area of the page is visible and ready to use.",
      },
      {
        title: "Perform the main action",
        instruction: `In a real Gemini-generated guide, this step would identify the exact control for: ${goal}. For this mock run, use any safe control on the page to test the guide workflow.`,
        expectedResult:
          "You can mark this step complete and ClickCoach advances to the next step.",
      },
      {
        title: "Confirm the result",
        instruction:
          "Check the page for the result you expected, then mark this final step complete. You can reopen this guide from Recent guides afterward.",
        expectedResult:
          "The progress bar is complete and the saved guide remains available in Recent guides.",
      },
    ],
  });
}
