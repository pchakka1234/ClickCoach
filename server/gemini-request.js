// Retry only temporary provider failures. Never log prompts, images or keys.
export async function requestGemini(
  url,
  options,
  request = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const signal = AbortSignal.timeout(60_000);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await request(url, { ...options, signal });
    if (response.ok) return response;
    const body = await response.json().catch(() => ({}));
    const retryable = [500, 502, 503, 504].includes(response.status);
    console.error("Gemini request failed:", {
      status: response.status,
      code: body.error?.status,
      attempt,
      retrying: retryable && attempt < 3,
    });
    if (retryable && attempt < 3) {
      await wait(1000 * 2 ** (attempt - 1));
      signal.throwIfAborted();
      continue;
    }
    const messages = {
      400: "Gemini rejected the request format. Check the configured model and request schema.",
      401: "Gemini authentication failed. Check the server API key.",
      403: "Gemini denied access. Check API key restrictions and project permissions.",
      404: "The configured Gemini model was not found.",
      429: "Gemini rate or quota limit reached. Check your project limits before retrying.",
    };
    throw Object.assign(
      new Error(
        messages[response.status] ||
          "Gemini is temporarily unavailable after 3 attempts. Your capture is still available; please retry.",
      ),
      {
        status: response.status === 429 ? 429 : retryable ? 503 : 502,
      },
    );
  }
}
