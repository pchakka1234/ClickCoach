import { createApp } from "./app.js";
const config = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  aiProvider: process.env.AI_PROVIDER || "mock",
  geminiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  openaiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  extensionId: process.env.EXTENSION_ID,
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error("Invalid PORT.");
for (const key of ["supabaseUrl", "supabaseKey"])
  if (!config[key] || config[key].includes("YOUR_"))
    throw new Error(`Configure ${key} in server/.env.`);
if (!["mock", "gemini", "openai"].includes(config.aiProvider))
  throw new Error("AI_PROVIDER must be mock, gemini or openai.");
if (
  config.aiProvider === "gemini" &&
  (!config.geminiKey || config.geminiKey.includes("YOUR_"))
)
  throw new Error(
    "Configure GEMINI_API_KEY in server/.env when AI_PROVIDER=gemini.",
  );
if (!/^[a-z0-9._-]+$/i.test(config.geminiModel))
  throw new Error("Invalid GEMINI_MODEL.");
if (
  config.aiProvider === "openai" &&
  (!config.openaiKey || config.openaiKey.includes("YOUR_"))
)
  throw new Error(
    "Configure openaiKey in server/.env when AI_PROVIDER=openai.",
  );
if (!/^[a-p]{32}$/.test(config.extensionId || ""))
  throw new Error("Set EXTENSION_ID from chrome://extensions in server/.env.");
if (!config.supabaseUrl.startsWith("https://"))
  throw new Error("Use your HTTPS Supabase project URL.");
if (config.supabaseKey.startsWith("sb_secret_"))
  throw new Error("Use a Supabase publishable/anon key, not a secret key.");
try {
  if (
    JSON.parse(
      Buffer.from(
        config.supabaseKey.split(".")[1] || "",
        "base64url",
      ).toString(),
    ).role === "service_role"
  )
    throw new Error("SERVICE_ROLE");
} catch (e) {
  if (e.message === "SERVICE_ROLE")
    throw new Error("Use the anon key, not service_role.");
}
createApp(config).listen(config.port, config.host, () =>
  console.log(
    `ClickCoach API listening on http://${config.host}:${config.port}`,
  ),
);
