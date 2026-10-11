import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { generateSchema, progressSchema } from "./schema.js";
import { generatePlan } from "./planner.js";
import { generateMockPlan } from "./mock-planner.js";
import { generateGeminiPlan } from "./gemini-planner.js";
const columns =
  "id,goal,title,summary,steps,source_url,current_step,completed,version,created_at";
const fail = (status, message) => Object.assign(new Error(message), { status });
const checked = ({ data, error }) => {
  if (error)
    throw fail(503, "Database request failed. Check the Supabase SQL setup.");
  return data;
};
export function createApp(
  config,
  { planner, clientFactory = createClient } = {},
) {
  const app = express();
  const providers = {
    mock: generateMockPlan,
    gemini: generateGeminiPlan,
    openai: generatePlan,
  };
  const createPlan =
    planner || providers[config.aiProvider] || generateMockPlan;
  const auth = clientFactory(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        cb(null, origin === `chrome-extension://${config.extensionId}`);
      },
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", async (req, res, next) => {
    const match = req.get("Authorization")?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw fail(401, "Sign in to continue.");
    const { data, error } = await auth.auth.getUser(match[1]);
    if (error || !data.user)
      throw fail(401, "Your session expired. Sign in again.");
    req.user = data.user;
    // The user JWT makes RLS apply on every query. No service-role key is used.
    req.db = clientFactory(config.supabaseUrl, config.supabaseKey, {
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    next();
  });
  app.use("/api", express.json({ limit: "5mb" }));
  app.get("/api/tutorials", async (req, res) =>
    res.json(
      checked(
        await req.db
          .from("clickcoach_tutorials")
          .select(columns)
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ),
    ),
  );
  app.post(
    "/api/tutorials",
    rateLimit({
      windowMs: 60_000,
      limit: 8,
      keyGenerator: (req) => req.user.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const input = generateSchema.parse(req.body);
      const plan = await createPlan(input, config);
      const url = new URL(input.context.url);
      url.search = "";
      url.hash = "";
      url.username = "";
      url.password = "";
      const row = checked(
        await req.db
          .from("clickcoach_tutorials")
          .insert({
            user_id: req.user.id,
            goal: input.goal,
            ...plan,
            source_url: url.href,
          })
          .select(columns)
          .single(),
      );
      res.status(201).json(row);
    },
  );
  app.param("id", (_req, _res, next, id) =>
    next(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? undefined
        : fail(400, "Invalid tutorial ID."),
    ),
  );
  app.get("/api/tutorials/:id", async (req, res) => {
    const row = checked(
      await req.db
        .from("clickcoach_tutorials")
        .select(columns)
        .eq("user_id", req.user.id)
        .eq("id", req.params.id)
        .maybeSingle(),
    );
    if (!row) throw fail(404, "Tutorial not found.");
    res.json(row);
  });
  app.patch("/api/tutorials/:id", async (req, res) => {
    const input = progressSchema.parse(req.body);
    const row = checked(
      await req.db
        .from("clickcoach_tutorials")
        .select("steps")
        .eq("user_id", req.user.id)
        .eq("id", req.params.id)
        .maybeSingle(),
    );
    if (!row) throw fail(404, "Tutorial not found.");
    if (
      input.currentStep >= row.steps.length ||
      input.completed.some((i) => i >= row.steps.length)
    )
      throw fail(400, "Step is outside this tutorial.");
    const updated = checked(
      await req.db
        .from("clickcoach_tutorials")
        .update({
          current_step: input.currentStep,
          completed: [...new Set(input.completed)],
          version: input.version + 1,
        })
        .eq("user_id", req.user.id)
        .eq("id", req.params.id)
        .eq("version", input.version)
        .select(columns)
        .maybeSingle(),
    );
    if (!updated)
      throw fail(409, "Progress changed elsewhere. Click Refresh progress.");
    res.json(updated);
  });
  app.delete("/api/tutorials/:id", async (req, res) => {
    checked(
      await req.db
        .from("clickcoach_tutorials")
        .delete()
        .eq("user_id", req.user.id)
        .eq("id", req.params.id),
    );
    res.status(204).end();
  });
  app.use((err, _req, res, _next) => {
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({
          error: "Invalid request.",
          details: err.issues
            .slice(0, 4)
            .map((i) => `${i.path.join(".")}: ${i.message}`),
        });
    if (err.type === "entity.too.large")
      return res
        .status(413)
        .json({
          error: "Screenshot is too large. Try a smaller browser window.",
        });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid JSON." });
    if (err.name === "TimeoutError")
      return res
        .status(504)
        .json({ error: "AI request timed out. Please retry." });
    const status = [400, 401, 404, 409, 422, 429, 502, 503].includes(err.status)
      ? err.status
      : 500;
    res
      .status(status)
      .json({
        error:
          status === 500
            ? "Could not complete the request. Check server configuration."
            : err.message,
      });
  });
  return app;
}
