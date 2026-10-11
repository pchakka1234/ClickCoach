// Full URLs and tab IDs stay local; only cleaned context is sent to the API.
const captureOrigins = new WeakMap();

async function optimizeScreenshot(source) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () =>
      reject(new Error("Could not prepare the screenshot."));
    image.src = source;
  });
  const scale = Math.min(
    1,
    1600 / image.naturalWidth,
    1600 / image.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the screenshot.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.65);
}
export async function captureTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:\/\//.test(tab.url))
    throw new Error(
      "Open a normal website before capturing. Chrome system pages cannot be captured.",
    );
  const screenshot = await optimizeScreenshot(
    await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 65,
    }),
  );
  const [after] = await chrome.tabs.query({
    active: true,
    windowId: tab.windowId,
  });
  if (after?.id !== tab.id || after.url !== tab.url)
    throw new Error("The tab changed during capture. Please capture again.");
  if (screenshot.length > 4_000_000)
    throw new Error("Screenshot too large. Reduce the browser window size.");
  const url = new URL(tab.url);
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  const context = { url: url.href, title: (tab.title || "").slice(0, 300), screenshot };
  captureOrigins.set(context, { tabId: tab.id, windowId: tab.windowId, url: tab.url });
  return context;
}

// This checks tab identity and navigation, not live contents. Recapture after UI changes.
export async function assertCurrentPage(context) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const origin = captureOrigins.get(context);
  if (!tab?.url || !/^https?:\/\//.test(tab.url))
    throw new Error("Open the captured website and recapture before generating.");
  if (!origin || tab.id !== origin.tabId || tab.windowId !== origin.windowId || tab.url !== origin.url)
    throw new Error("The page or tab changed. Click Recapture current tab before generating.");
}