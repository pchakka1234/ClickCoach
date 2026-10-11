import { z } from "zod";
const webUrl = z
  .string()
  .max(2048)
  .url()
  .refine((v) => ["https:", "http:"].includes(new URL(v).protocol));
const targetSchema = z.object({ label: z.string().min(1).max(120), role: z.string().min(1).max(40) }).strict();
export const generateSchema = z
  .object({
    goal: z.string().trim().min(3).max(2000),
    context: z
      .object({
        url: webUrl,
        title: z.string().max(300),
        controls: z.array(targetSchema).max(100).optional(),
        screenshot: z
          .string()
          .max(4_000_000)
          .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)
          .optional(),
      })
      .strict(),
  })
  .strict();
export const planSchema = z
  .object({
    title: z.string().min(1).max(150),
    summary: z.string().min(1).max(1200),
    steps: z
      .array(
        z
          .object({
            title: z.string().min(1).max(150),
            instruction: z.string().min(1).max(1600),
            expectedResult: z.string().min(1).max(800),
            target: targetSchema.nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const progressSchema = z
  .object({
    currentStep: z.number().int().min(0),
    completed: z.array(z.number().int().min(0)).max(20),
    version: z.number().int().min(1),
  })
  .strict();
export const planJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "steps"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "instruction", "expectedResult", "target"],
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
          expectedResult: { type: "string" },
          target: { anyOf: [{ type: "null" }, { type: "object", additionalProperties: false,
            required: ["label", "role"], properties: { label: { type: "string" }, role: { type: "string" } } }] },
        },
      },
    },
  },
};

export const continueSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  version: z.number().int().min(1),
  context: generateSchema.shape.context.optional(),
}).strict();

// Model-selected targets must be a unique member of the reviewed page snapshot.
export function groundTargets(plan, controls = []) {
  return { ...plan, steps: plan.steps.map(step => ({ ...step, target:
    step.target && controls.filter(c => c.label === step.target.label && c.role === step.target.role).length === 1
      ? step.target : null })) };
}
