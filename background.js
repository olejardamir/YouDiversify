const ENABLED_KEY = "yt_youdiversify_enabled";
const OVERLAY_STATE_KEY = "yt_youdiversify_overlay_state";
const RESTORE_OVERLAY_TAB_ID_KEY = "yt_youdiversify_restore_overlay_tab_id";
const FORCE_PLAY_ONCE_KEY = "yt_youdiversify_force_play_once";

const scheduledOverlayRestoreTimers = new Map();

const ICON_ON = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
  128: "icons/icon128.png"
};
const ICON_OFF = {
  16: "icons/icon16_off.png",
  32: "icons/icon32_off.png",
  48: "icons/icon48_off.png",
  128: "icons/icon128_off.png"
};
const ICON_WARN = {
  16: "icons/icon16_warn.png",
  32: "icons/icon32_warn.png",
  48: "icons/icon48_warn.png",
  128: "icons/icon128_warn.png"
};

async function getEnabled() {
  const result = await chrome.storage.local.get(ENABLED_KEY);
  return result[ENABLED_KEY] !== false;
}

async function setBadge(enabled) {
  await chrome.action.setIcon({ path: enabled ? ICON_ON : ICON_OFF });
  await chrome.action.setTitle({ title: `YouDiversify: ${enabled ? "ON" : "OFF"}` });
}

async function setPlaybackWaitingBadge() {
  await setBadge(await getEnabled());
}

async function setTemporaryWarningBadge() {
  await chrome.action.setIcon({ path: ICON_WARN });
}

async function findYoutubeTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });
  if (!tabs.length) return null;
  return tabs.find(tab => tab.audible) ||
    tabs.find(tab => tab.active && tab.currentWindow) ||
    tabs.find(tab => tab.active) ||
    tabs[0];
}

async function findOverlayHostCandidates(activeTab) {
  const youtubeTab = await findYoutubeTab();
  const seen = new Set();
  return [activeTab, youtubeTab].filter(tab => {
    if (!canInjectInto(tab) || seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
}

function canInjectInto(tab) {
  return !!tab?.id && /^(https?:)\/\//i.test(tab.url || "");
}

async function sendToTab(tabId, message) {
  return await chrome.tabs.sendMessage(tabId, message);
}

async function ensureOverlayScript(tab) {
  if (!canInjectInto(tab)) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["global_overlay.js"] });
    return true;
  } catch {
    return false;
  }
}

async function hideOverlayEverywhereExcept(activeTabId) {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs
    .filter(tab => tab.id && tab.id !== activeTabId && canInjectInto(tab))
    .map(tab => sendToTab(tab.id, { type: "YT_YOUDIVERSIFY_GLOBAL_HIDE_OVERLAY" }).catch(() => null)));
}

async function hideOverlayEverywhere() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs
    .filter(tab => tab.id && canInjectInto(tab))
    .map(tab => sendToTab(tab.id, { type: "YT_YOUDIVERSIFY_GLOBAL_HIDE_OVERLAY" }).catch(() => null)));
}

async function toggleOverlayFromAction(activeTab) {
  await setBadge(await getEnabled());
  const currentTab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  const candidates = await findOverlayHostCandidates(currentTab);

  for (const tab of candidates) {
    await hideOverlayEverywhereExcept(tab.id);
    const ready = await ensureOverlayScript(tab);
    if (!ready) continue;

    const response = await sendToTab(tab.id, { type: "YT_YOUDIVERSIFY_GLOBAL_TOGGLE_OVERLAY" }).catch(() => null);
    if (response) return;
  }

  await setTemporaryWarningBadge();
  setTimeout(async () => setBadge(await getEnabled()), 1600);
}

async function rememberOverlayTabForNavigation(tabId, command) {
  const navigationCommands = new Set([
    "YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP",
    "YT_YOUDIVERSIFY_SKIP_NEXT",
    "YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED"
  ]);
  if (!tabId || !navigationCommands.has(command?.type)) return;
  await chrome.storage.local.set({ [RESTORE_OVERLAY_TAB_ID_KEY]: tabId });
  scheduleOverlayRestore(tabId);
}

async function restoreOverlayAfterNavigation(tabId, url) {
  if (!tabId || !/^https:\/\/www\.youtube\.com\/watch/i.test(url || "")) return;

  const state = await chrome.storage.local.get([OVERLAY_STATE_KEY, RESTORE_OVERLAY_TAB_ID_KEY]);
  if (state[RESTORE_OVERLAY_TAB_ID_KEY] !== tabId) return;
  if (state[OVERLAY_STATE_KEY]?.visible !== true) return;

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !canInjectInto(tab)) return;

  const ready = await ensureOverlayScript(tab);
  if (ready) {
    await sendToTab(tabId, { type: "YT_YOUDIVERSIFY_GLOBAL_SHOW_OVERLAY" }).catch(() => null);
  }
  await chrome.storage.local.remove(RESTORE_OVERLAY_TAB_ID_KEY);
}

function scheduleOverlayRestore(tabId) {
  if (!tabId) return;

  const existingTimers = scheduledOverlayRestoreTimers.get(tabId) || [];
  existingTimers.forEach(timer => clearTimeout(timer));

  const delays = [250, 900, 1800, 3200, 5200];
  const timers = delays.map(delay => setTimeout(async () => {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab?.url || !/^https:\/\/www\.youtube\.com\/watch/i.test(tab.url)) return;

    const result = await showOverlayOnTab(tabId).catch(() => null);
    if (result?.visible === true) {
      const pending = scheduledOverlayRestoreTimers.get(tabId) || [];
      pending.forEach(timer => clearTimeout(timer));
      scheduledOverlayRestoreTimers.delete(tabId);
      await chrome.storage.local.remove(RESTORE_OVERLAY_TAB_ID_KEY).catch(() => null);
    }
  }, delay));

  scheduledOverlayRestoreTimers.set(tabId, timers);
}

async function showOverlayOnTab(tabId) {
  if (!tabId) return { ok: false, error: "No tab to restore overlay in." };
  const state = await chrome.storage.local.get(OVERLAY_STATE_KEY);
  if (state[OVERLAY_STATE_KEY]?.visible !== true) return { ok: true, visible: false };

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || !canInjectInto(tab)) return { ok: false, error: "Tab is not available." };

  const ready = await ensureOverlayScript(tab);
  if (!ready) return { ok: false, error: "Could not inject overlay." };

  await sendToTab(tabId, { type: "YT_YOUDIVERSIFY_GLOBAL_SHOW_OVERLAY" });
  return { ok: true, visible: true };
}

async function relayToYoutube(message) {
  const tab = await findYoutubeTab();
  if (!tab?.id) return { ok: false, error: "Open a YouTube video tab to control playback." };
  try {
    return await sendToTab(tab.id, message);
  } catch {
    return { ok: false, error: "The YouTube tab is not ready yet. Reload that tab if this continues." };
  }
}

async function openInYoutubeTab(url) {
  let safeUrl;
  try {
    safeUrl = new URL(url);
  } catch {
    return { ok: false, error: "Video URL is invalid." };
  }
  if (!safeUrl.hostname.endsWith("youtube.com") || safeUrl.pathname !== "/watch") {
    return { ok: false, error: "Only YouTube watch URLs can be opened." };
  }
  safeUrl.hostname = "www.youtube.com";
  const videoId = safeUrl.searchParams.get("v");
  if (!videoId) return { ok: false, error: "Video URL is missing a video id." };

  const tab = await findYoutubeTab();
  if (!tab?.id) return { ok: false, error: "Open a YouTube video tab first." };
  await chrome.storage.local.set({
    [FORCE_PLAY_ONCE_KEY]: {
      videoId,
      url: safeUrl.href,
      createdAt: Date.now()
    }
  });
  await chrome.tabs.update(tab.id, { url: safeUrl.href, active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  scheduleOverlayRestore(tab.id);
  return { ok: true };
}

chrome.action.onClicked.addListener(toggleOverlayFromAction);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  restoreOverlayAfterNavigation(tabId, tab.url).catch(() => null);
});

chrome.tabs.onActivated.addListener(() => {
  hideOverlayEverywhere().catch(() => null);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    hideOverlayEverywhere().catch(() => null);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setBadgeText({ text: "" });
  await setBadge(await getEnabled());
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.action.setBadgeText({ text: "" });
  await setBadge(await getEnabled());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[ENABLED_KEY]) return;
  setBadge(changes[ENABLED_KEY].newValue !== false);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "YT_YOUDIVERSIFY_SET_BADGE") {
      await setBadge(message.enabled !== false);
      return { ok: true };
    }

    if (message?.type === "YT_YOUDIVERSIFY_PLAYBACK_WAITING") {
      if (await getEnabled()) await setPlaybackWaitingBadge();
      return { ok: true };
    }

    if (message?.type === "YT_YOUDIVERSIFY_PLAYBACK_STARTED") {
      await setBadge(await getEnabled());
      return { ok: true };
    }

    if (message?.type === "YT_YOUDIVERSIFY_RELAY") {
      await rememberOverlayTabForNavigation(sender.tab?.id, message.command);
      return await relayToYoutube(message.command || {});
    }

    if (message?.type === "YT_YOUDIVERSIFY_FIND_TARGET") {
      const tab = await findYoutubeTab();
      if (!tab?.id) return { ok: false, error: "No YouTube video tab found." };
      const state = await relayToYoutube({ type: "YT_YOUDIVERSIFY_GET_STATUS" });
      return { ok: true, tabTitle: tab.title || "YouTube video tab", state };
    }

    if (message?.type === "YT_YOUDIVERSIFY_RESTORE_VISIBLE_GLOBAL_OVERLAY") {
      return await showOverlayOnTab(sender.tab?.id);
    }

    if (message?.type === "YT_YOUDIVERSIFY_RESTORE_VISIBLE_GLOBAL_OVERLAY_SOON") {
      const tabId = sender.tab?.id;
      if (!tabId) return { ok: false, error: "No sender tab." };
      await chrome.storage.local.set({ [RESTORE_OVERLAY_TAB_ID_KEY]: tabId });
      scheduleOverlayRestore(tabId);
      return { ok: true };
    }

    if (message?.type === "YT_YOUDIVERSIFY_OPEN_VIDEO") {
      return await openInYoutubeTab(message.url);
    }

    return undefined;
  })().then((response) => {
    if (response !== undefined) sendResponse(response);
  }).catch((error) => {
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
  return true;
});
