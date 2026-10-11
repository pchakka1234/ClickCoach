import { supabase } from "./supabase";
export async function api(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to continue.");
  let response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      signal: AbortSignal.timeout(75000),
    });
  } catch (e) {
    throw new Error(
      e.name === "TimeoutError"
        ? "Request timed out. Check History before retrying."
        : "Cannot reach the API. Check server, API URL and extension ID.",
    );
  }
  if (response.status === 204) return null;
  const data = await response
    .json()
    .catch(() => ({
      error:
        response.status === 429
          ? "Too many requests. Wait a minute."
          : "Server returned an invalid response.",
    }));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
