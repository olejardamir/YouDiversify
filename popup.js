const ENABLED_KEY = "yt_youdiversify_enabled";
const el = {
  target: document.getElementById("target"),
  status: document.getElementById("status"),
  toggle: document.getElementById("toggle"),
  playPause: document.getElementById("playPause"),
  upvote: document.getElementById("upvote"),
  downvote: document.getElementById("downvote"),
  skip: document.getElementById("skip"),
  skipChannel: document.getElementById("skipChannel"),
  seekPanel: document.getElementById("seekPanel"),
  seekSlider: document.getElementById("seekSlider"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),
  back10: document.getElementById("back10"),
  forward10: document.getElementById("forward10"),
  reset: document.getElementById("reset")
};

let targetTab = null;
let enabled = true;
let lastState = null;
let sliderIsDragging = false;

function setStatus(text) {
  el.status.textContent = text;
}

async function getEnabled() {
  const result = await chrome.storage.local.get(ENABLED_KEY);
  return result[ENABLED_KEY] !== false;
}

async function setEnabled(value) {
  enabled = value !== false;
  await chrome.storage.local.set({ [ENABLED_KEY]: enabled });
  await chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_SET_BADGE", enabled }).catch(() => {});
  updateToggle();
  if (targetTab?.id) {
    await chrome.tabs.sendMessage(targetTab.id, {
      type: "YT_YOUDIVERSIFY_ENABLED_CHANGED",
      enabled
    }).catch(() => {});
  }
}

function updateToggle() {
  el.toggle.classList.toggle("on", enabled);
  el.toggle.classList.toggle("off", !enabled);
  el.toggle.title = enabled ? "Turn extension off" : "Turn extension on";
  el.toggle.setAttribute("aria-label", el.toggle.title);
}

async function findYoutubeTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });
  if (!tabs.length) return null;

  const activeCurrent = tabs.find(tab => tab.active && tab.currentWindow);
  if (activeCurrent) return activeCurrent;

  const audible = tabs.find(tab => tab.audible);
  if (audible) return audible;

  const activeAny = tabs.find(tab => tab.active);
  if (activeAny) return activeAny;

  return tabs[0];
}

async function sendToYoutube(type, payload = {}) {
  if (!targetTab?.id) {
    setStatus("Open a YouTube video tab to control playback.");
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(targetTab.id, { type, ...payload });
    if (response?.ok === false) {
      setStatus(response.error || "Command failed.");
    } else {
      setStatus("Done.");
    }
    await refreshState();
    return response;
  } catch {
    setStatus("The YouTube tab is not ready yet. Reload that tab if this continues.");
    return null;
  }
}

function setControlAvailability() {
  const hasTarget = !!targetTab?.id;
  for (const button of [el.playPause, el.upvote, el.downvote, el.skipChannel, el.skip, el.reset, el.seekSlider, el.back10, el.forward10]) {
    button.disabled = !hasTarget;
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function renderState(state) {
  lastState = state;

  el.upvote.classList.toggle("success", !!state?.liked);
  el.upvote.title = state?.liked ? "Already upvoted" : "Upvote current YouTube video";
  el.upvote.setAttribute("aria-label", el.upvote.title);

  const isPlaying = !!state?.playing;
  el.playPause.classList.toggle("is-playing", isPlaying);
  el.playPause.title = isPlaying ? "Pause current YouTube video" : "Play current YouTube video";
  el.playPause.setAttribute("aria-label", el.playPause.title);

  const duration = Number(state?.duration || 0);
  const currentTime = Number(state?.currentTime || 0);
  const canSeek = duration > 0;
  el.currentTime.textContent = formatTime(currentTime);
  el.duration.textContent = formatTime(duration);
  if (!sliderIsDragging) {
    el.seekSlider.value = canSeek ? String(Math.round((currentTime / duration) * 1000)) : "0";
  }
  el.seekSlider.disabled = !canSeek || !targetTab?.id;
  el.back10.disabled = !targetTab?.id;
  el.forward10.disabled = !targetTab?.id;
}

async function refreshState() {
  if (!targetTab?.id) return;
  try {
    const state = await chrome.tabs.sendMessage(targetTab.id, { type: "YT_YOUDIVERSIFY_GET_STATUS" });
    if (state?.ok) {
      renderState(state);
      if (state.title) el.target.textContent = state.title;
    }
  } catch {
    // The content script may not be ready yet.
  }
}

async function init() {
  enabled = await getEnabled();
  updateToggle();
  el.seekPanel.hidden = false;

  targetTab = await findYoutubeTab();
  if (targetTab) {
    setStatus("Opening overlay...");
    try {
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_OPEN_OVERLAY", tabId: targetTab.id }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
      ]);
      if (response?.ok) {
        window.close();
        return;
      }
      setStatus(response?.error || "Could not open overlay.");
    } catch {
      // Fallback to showing popup controls
    }
    el.target.textContent = targetTab.title || "YouTube video tab";
    setStatus(enabled ? "Ready" : "Extension is off");
  } else {
    el.target.textContent = "No YouTube video tab";
    setStatus("Open a YouTube video tab to use these controls.");
  }

  setControlAvailability();
  await refreshState();
}

el.toggle.addEventListener("click", async () => {
  await setEnabled(!enabled);
  setStatus(enabled ? "Extension turned on." : "Extension turned off.");
  await refreshState();
});

el.playPause.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_PLAY_PAUSE"));
el.upvote.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_UPVOTE"));
el.downvote.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP"));
el.skip.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_SKIP_NEXT"));
el.skipChannel.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_SKIP_CHANNEL"));

el.seekSlider.addEventListener("input", () => {
  sliderIsDragging = true;
  const duration = Number(lastState?.duration || 0);
  const percent = Number(el.seekSlider.value || 0) / 1000;
  el.currentTime.textContent = formatTime(duration * percent);
});

el.seekSlider.addEventListener("change", async () => {
  const percent = Number(el.seekSlider.value || 0) / 10;
  await sendToYoutube("YT_YOUDIVERSIFY_SEEK_TO_PERCENT", { percent });
  sliderIsDragging = false;
  await refreshState();
});

el.back10.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_SEEK_BY_SECONDS", { seconds: -10 }));
el.forward10.addEventListener("click", () => sendToYoutube("YT_YOUDIVERSIFY_SEEK_BY_SECONDS", { seconds: 10 }));

el.reset.addEventListener("click", async () => {
  await chrome.storage.local.set({ yt_youdiversify_visited: [], yt_youdiversify_blocked_channels: [] });
  await sendToYoutube("YT_YOUDIVERSIFY_RESET_VISITED");
  setStatus("Visited list reset.");
});

init();
setInterval(refreshState, 1000);
