import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configError =
  !url ||
  !key ||
  url.includes("YOUR_") ||
  key.includes("YOUR_") ||
  key.startsWith("sb_secret_");
const storage = {
  async getItem(key) {
    return (await chrome.storage.session.get(key))[key] ?? null;
  },
  async setItem(key, value) {
    await chrome.storage.session.set({ [key]: value });
  },
  async removeItem(key) {
    await chrome.storage.session.remove(key);
  },
};
export const supabase = configError
  ? null
  : createClient(url, key, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
