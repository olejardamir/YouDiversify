(() => {
  if (window.__ytYouDiversifyGlobalOverlayLoaded) return;
  window.__ytYouDiversifyGlobalOverlayLoaded = true;

  const ENABLED_KEY = "yt_youdiversify_enabled";
  const OVERLAY_STATE_KEY = "yt_youdiversify_overlay_state";
  const VISITED_KEY = "yt_youdiversify_visited";
  const BLOCKED_CHANNELS_KEY = "yt_youdiversify_blocked_channels";
  const PLAYLIST_MODE_KEY = "yt_youdiversify_playlist_mode";
  const PLAYLIST_INCLUDE_UPVOTED_KEY = "yt_youdiversify_playlist_include_upvoted";
  const PLAYLIST_INCLUDE_NEUTRAL_KEY = "yt_youdiversify_playlist_include_neutral";
  const PLAYLIST_SHUFFLE_KEY = "yt_youdiversify_playlist_shuffle";
  const PLAYLIST_REPEAT_KEY = "yt_youdiversify_playlist_repeat";
  const FORCE_PLAY_ONCE_KEY = "yt_youdiversify_force_play_once";
  const NAV_FROM_SKIP_KEY = "yt_youdiversify_nav_from_skip";
  const THEME_KEY = "yt_youdiversify_theme";
  const OVERLAY_ID = "yt-youdiversify-floating-player";
  const STYLE_ID = "yt-youdiversify-global-overlay-style";
  const DEFAULT_OVERLAY_STATE = { x: null, y: null, collapsed: false, visible: false, managerOpen: false, managerX: null, managerY: null, managerWidth: null, managerHeight: null, managerSnapped: false, managerSnapX: null, managerSnapY: null };

  let enabled = true;
  let refreshTimer = null;
  let drag = null;
  let managerDrag = null;
  let managerResize = null;
  let managerSnap = null;
  let lastState = null;
  let sliderDragging = false;
  let skipWaiting = false;
  let videoSortCol = null;
  let videoSortDir = null;
  let blockedSortDir = null;

  const ICONS = {
    power: '<svg viewBox="0 0 24 24"><path d="M11 2h2v10h-2V2Zm6.5 3.9-1.4 1.4A7 7 0 1 1 7.9 7.3L6.5 5.9a9 9 0 1 0 11 0Z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/></svg>',
    up: '<svg viewBox="0 0 164 172" xmlns="http://www.w3.org/2000/svg"><path d="M 64,1 L 60,5 L 59,10 L 57,16 L 55,22 L 52,30 L 50,36 L 47,44 L 45,50 L 42,58 L 40,64 L 38,70 L 35,77 L 30,81 L 14,81 L 8,82 L 2,87 L 1,146 L 7,153 L 32,154 L 39,157 L 46,161 L 52,163 L 60,166 L 69,168 L 74,169 L 125,170 L 131,168 L 143,158 L 147,151 L 148,142 L 152,138 L 155,131 L 157,111 L 161,104 L 162,88 L 160,82 L 150,70 L 143,67 L 100,65 L 99,60 L 100,55 L 101,50 L 103,42 L 104,27 L 102,21 L 91,7 L 84,3 L 77,2 L 65,1 Z" style="fill:none;stroke:currentColor;stroke-width:8;stroke-linejoin:round;stroke-linecap:round"/></svg>',
    down: '<svg viewBox="0 0 163 173" xmlns="http://www.w3.org/2000/svg"><path d="M 38,1 L 32,3 L 26,7 L 20,12 L 16,19 L 15,25 L 11,32 L 7,39 L 6,45 L 5,55 L 6,59 L 2,66 L 1,85 L 4,92 L 12,101 L 19,104 L 62,106 L 63,113 L 61,122 L 60,127 L 58,143 L 60,150 L 66,159 L 69,163 L 75,167 L 82,169 L 88,170 L 98,171 L 102,166 L 104,159 L 106,153 L 108,147 L 111,139 L 113,133 L 115,127 L 118,119 L 120,113 L 122,107 L 125,99 L 129,92 L 152,90 L 160,84 L 161,25 L 155,18 L 129,17 L 122,13 L 115,10 L 107,7 L 101,5 L 92,3 L 86,2 L 39,1 Z" style="fill:none;stroke:currentColor;stroke-width:8;stroke-linejoin:round;stroke-linecap:round"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M5 4v16l10-8L5 4Zm11 0h3v16h-3V4Z"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/></svg>',
    channel: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/></svg>',
    collapse: '<svg viewBox="0 0 24 24"><path d="M7 10h10v4H7v-4Z"/></svg>',
    expand: '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"/></svg>',
    seek: '<svg viewBox="0 0 24 24"><path d="M4 6h10v2H4V6Zm0 5h16v2H4v-2Zm0 5h7v2H4v-2Zm13.5-10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-3 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>',
    volume: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5.5 1.4-1.4A5.5 5.5 0 0 1 17 16l-1.4-1.4a3.5 3.5 0 0 0-.1-5.1Zm2.8-2.8 1.4-1.4a9.5 9.5 0 0 1 .1 13.4l-1.4-1.4a7.5 7.5 0 0 0-.1-10.6Z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41ZM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5Zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13Z"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z"/></svg>',
    sortAsc: '<svg viewBox="0 0 8 8" width="8" height="8"><path d="M4 0L0 6h8z" fill="currentColor"/></svg>',
    sortDesc: '<svg viewBox="0 0 8 8" width="8" height="8"><path d="M4 8L0 2h8z" fill="currentColor"/></svg>',
    sortNone: '<svg viewBox="0 0 8 8" width="8" height="8"><rect x="0" y="3" width="8" height="2" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><path d="M6.76 4.84 5.34 3.42 3.93 4.83l1.42 1.42 1.41-1.41ZM1 13h3v-2H1v2Zm10-12v3h2V1h-2Zm8.66 2.42-1.41 1.41 1.41 1.41 1.41-1.41-1.41-1.41ZM17.24 19.16l1.42 1.42 1.41-1.41-1.42-1.42-1.41 1.41ZM20 11v2h3v-2h-3ZM12 6a6 6 0 1 0 0 12A6 6 0 0 0 12 6Zm-1 17h2v-3h-2v3ZM3.93 19.17l1.41 1.41 1.42-1.42-1.41-1.41-1.42 1.42Z"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M21 14.7A8.5 8.5 0 0 1 9.3 3a7 7 0 1 0 11.7 11.7Z"/></svg>'
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function isExtensionContextError(error) {
    return /Extension context invalidated|context invalidated|Extension context was invalidated/i.test(error?.message || String(error));
  }

  function hasExtensionContext() {
    try {
      return !!chrome?.runtime?.id;
    } catch {
      return false;
    }
  }

  function stopBecauseContextInvalidated() {
    stopRefresh();
  }

  async function safeStorageGet(key) {
    if (!hasExtensionContext()) return {};
    try {
      return await chrome.storage.local.get(key);
    } catch (error) {
      if (isExtensionContextError(error)) {
        stopBecauseContextInvalidated();
        return {};
      }
      throw error;
    }
  }

  async function safeStorageSet(value) {
    if (!hasExtensionContext()) return;
    try {
      await chrome.storage.local.set(value);
    } catch (error) {
      if (isExtensionContextError(error)) {
        stopBecauseContextInvalidated();
        return;
      }
      throw error;
    }
  }

  async function safeSendMessage(message, fallback = null) {
    if (!hasExtensionContext()) return fallback;
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (isExtensionContextError(error)) {
        stopBecauseContextInvalidated();
        return fallback;
      }
      throw error;
    }
  }

  async function getEnabled() {
    const result = await safeStorageGet(ENABLED_KEY);
    return result[ENABLED_KEY] !== false;
  }

  async function getTheme() {
    const result = await safeStorageGet(THEME_KEY);
    return result[THEME_KEY] === "light" ? "light" : "dark";
  }

  function applyTheme(overlay, theme) {
    if (!overlay) return;
    overlay.dataset.theme = theme === "light" ? "light" : "dark";
    overlay.querySelectorAll(".yds-theme").forEach(btn => {
      const light = overlay.dataset.theme === "light";
      btn.innerHTML = light ? ICONS.moon : ICONS.sun;
      btn.dataset.tooltip = light ? "Use dark mode" : "Use light mode";
      btn.setAttribute("aria-label", btn.dataset.tooltip);
      btn.classList.toggle("blue", light);
    });
  }

  async function setTheme(theme) {
    const nextTheme = theme === "light" ? "light" : "dark";
    await safeStorageSet({ [THEME_KEY]: nextTheme });
    applyTheme(document.getElementById(OVERLAY_ID), nextTheme);
    setStatus(nextTheme === "light" ? "Light mode." : "Dark mode.");
  }

  async function toggleTheme() {
    const overlay = document.getElementById(OVERLAY_ID);
    await setTheme(overlay?.dataset.theme === "light" ? "dark" : "light");
  }

  async function setEnabled(value) {
    enabled = value !== false;
    await safeStorageSet({ [ENABLED_KEY]: enabled });
    await safeSendMessage({ type: "YT_YOUDIVERSIFY_SET_BADGE", enabled }).catch(() => {});
    await relay({ type: "YT_YOUDIVERSIFY_ENABLED_CHANGED", enabled }).catch(() => {});
    updatePowerButtons();
    setStatus(enabled ? "Extension on" : "Extension off");
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    if (!enabled) await closeManager(overlay);
    overlay.querySelectorAll("button:not(.yds-close):not(.yds-power):not(.yds-theme)").forEach(btn => { btn.disabled = !enabled; });
    overlay.querySelectorAll(".yds-slider,.yds-volume-slider").forEach(slider => { slider.disabled = !enabled; });
    await refreshTheme(overlay);
  }

  async function relay(command) {
    return await safeSendMessage({ type: "YT_YOUDIVERSIFY_RELAY", command }, { ok: false, error: "Extension context is no longer active. Reload the page." });
  }

  async function findTarget() {
    return await safeSendMessage({ type: "YT_YOUDIVERSIFY_FIND_TARGET" }, { ok: false, error: "Extension context is no longer active. Reload the page." });
  }

  async function getOverlayState() {
    const result = await safeStorageGet(OVERLAY_STATE_KEY);
    return Object.assign({}, DEFAULT_OVERLAY_STATE, result[OVERLAY_STATE_KEY] || {});
  }

  async function saveOverlayState(partial) {
    if (!hasExtensionContext()) return;
    const current = await getOverlayState();
    await safeStorageSet({ [OVERLAY_STATE_KEY]: Object.assign(current, partial) });
  }

  async function ensureBodyReady() {
    while (!document.body) await sleep(25);
  }

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
        width: 318px; color: #f3f4f6; background: #111316; border: 1px solid #2a2f3a;
        box-shadow: 0 18px 48px rgba(0,0,0,.46);
        font: 13px/1.4 Arial, sans-serif; overflow: visible; user-select: none;
      }
      #${OVERLAY_ID}::before {
        content:""; position:absolute; inset:0; z-index:1; pointer-events:none;
        background:inherit; border:inherit; box-sizing:border-box;
      }
      #${OVERLAY_ID} > :not(.yds-manager) { position:relative; z-index:2; }
      #${OVERLAY_ID}.collapsed { width: 236px; }
      #${OVERLAY_ID}, #${OVERLAY_ID} *:not(button) { border-radius: 0 !important; }
      #${OVERLAY_ID} svg { width: 22px; height: 22px; fill: currentColor; pointer-events: none; }
      #${OVERLAY_ID} button { border: 1px solid #333846; background: #242832; color: #fff; cursor: pointer; display: grid; place-items: center; }
      #${OVERLAY_ID} button:hover { border-color: #51596a; background: #2b303b; }
      #${OVERLAY_ID} button:disabled { opacity: .35; cursor: not-allowed; }
      #${OVERLAY_ID} [data-tooltip] { position:relative; }
      #${OVERLAY_ID} [data-tooltip]:hover::after {
        content:attr(data-tooltip); position:absolute; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%);
        z-index:3; width:max-content; max-width:240px; padding:5px 7px; background:#050609; color:#f3f4f6;
        border:1px solid #333846; font:11px/1.3 Arial, sans-serif; white-space:normal; pointer-events:none;
      }
      #${OVERLAY_ID}.collapsed [data-tooltip]:hover::after { display:none; }
      #${OVERLAY_ID} .yds-head { display:flex; align-items:center; gap:8px; padding:10px; background:#181b20; cursor: move; }
      #${OVERLAY_ID} .yds-title { min-width:0; flex:1; }
      #${OVERLAY_ID} .yds-name { font-weight:700; font-size:13px; }
      #${OVERLAY_ID} .yds-track { color:#9ca3af; font-size:11px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; max-width:148px; }
      #${OVERLAY_ID} .yds-track-scrolling { text-overflow:clip; }
      #${OVERLAY_ID} .yds-track-scrolling .yds-track-inner { display:inline-block; white-space:nowrap; animation:yds-marquee 10s linear infinite; }
      #${OVERLAY_ID} .yds-track-scrolling:hover .yds-track-inner { animation-play-state:paused; }
      @keyframes yds-marquee { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }
      #${OVERLAY_ID} .yds-head-actions { display:flex; gap:6px; }
      #${OVERLAY_ID} .yds-small { width:28px; height:28px; border-radius:999px; padding:0; }
      #${OVERLAY_ID} .yds-controls { display:grid; grid-template-columns:repeat(6, 1fr); gap:8px; padding:10px; }
      #${OVERLAY_ID} .yds-icon { height:40px; border-radius:14px; padding:0; }
      #${OVERLAY_ID} .yds-skip-wrap { position:relative; display:grid; min-width:0; }
      #${OVERLAY_ID} .yds-skip-wrap > .yds-next { width:100%; }
      #${OVERLAY_ID} .yds-next-untracked { position:absolute; right:-5px; top:-7px; z-index:4; width:18px; height:18px; min-width:18px; border-radius:999px; padding:0; color:#22c55e; border-color:rgba(34,197,94,.55); font-weight:700; font-size:12px; line-height:1; }
      #${OVERLAY_ID} .yds-mini { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:4px; padding:6px; cursor:move; }
      #${OVERLAY_ID}.collapsed .yds-head, #${OVERLAY_ID}.collapsed .yds-controls, #${OVERLAY_ID}.collapsed > .yds-seek, #${OVERLAY_ID}.collapsed .yds-status { display:none; }
      #${OVERLAY_ID}:not(.collapsed) .yds-mini { display:none; }
      #${OVERLAY_ID} .yds-mini .yds-icon { width:21px; height:19px; border-radius:999px; }
      #${OVERLAY_ID} .yds-mini .yds-next-untracked { position:static; width:21px; height:19px; min-width:21px; font-size:11px; }
      #${OVERLAY_ID}.collapsed svg { width:11px; height:11px; }
      #${OVERLAY_ID} .yds-mini-seek { flex:0 0 100%; padding:0 10px 4px; box-sizing:border-box; }
      #${OVERLAY_ID} .yds-mini-seek .yds-slider { width:100%; box-sizing:border-box; }
      #${OVERLAY_ID}:not(.collapsed) .yds-mini-seek { display:none; }
      #${OVERLAY_ID} .yds-theme-corner { position:absolute; right:5px; bottom:5px; z-index:3; width:18px; height:18px; min-width:18px; border-radius:999px; padding:0; opacity:.82; }
      #${OVERLAY_ID} .yds-theme-corner svg { width:10px; height:10px; }
      #${OVERLAY_ID} .yds-theme-corner:hover { opacity:1; }
      #${OVERLAY_ID}.collapsed .yds-mini-seek { padding-right:30px; }
      #${OVERLAY_ID} .green { color:#22c55e; border-color:rgba(34,197,94,.55); }
      #${OVERLAY_ID} .red { color:#e67e22; }
      #${OVERLAY_ID} .yds-channel { color:#ff3434; }
      #${OVERLAY_ID} .blue { color:#60a5fa; }
      #${OVERLAY_ID} .yds-seek { padding: 0 10px 10px; }
      #${OVERLAY_ID} .yds-volume-panel { position:absolute; z-index:4; padding:8px; display:flex; align-items:center; gap:8px; background:#111316; border:1px solid #333846; box-shadow:0 12px 32px rgba(0,0,0,.45); }
      #${OVERLAY_ID} .yds-volume-panel[hidden] { display:none; }
      #${OVERLAY_ID} .yds-volume-slider { width:28px; height:118px; writing-mode:vertical-rl; direction:rtl; }
      #${OVERLAY_ID} .yds-volume-label { color:#9ca3af; font-size:11px; min-width:34px; text-align:right; }
      
      #${OVERLAY_ID} .yds-times { display:flex; justify-content:space-between; color:#9ca3af; font-size:11px; margin-bottom:5px; }
      #${OVERLAY_ID} input[type=range] { width:100%; accent-color:#ff3434; }
      #${OVERLAY_ID} .yds-volume-panel .yds-volume-slider { width:28px; height:118px; }
      #${OVERLAY_ID} .yds-status { color:#9ca3af; font-size:11px; padding:0 10px 10px; min-height:16px; }
      #${OVERLAY_ID} .yds-manager { position:fixed; left:0; top:0; right:auto; bottom:auto; height:min(460px, calc(100vh - 48px)); min-width:480px; min-height:170px; max-height:calc(100vh - 48px); overflow:hidden; border:1px solid #2a2f3a; background:#111316; padding:10px; box-shadow:0 18px 48px rgba(0,0,0,.46); z-index:0; resize:none; display:flex; flex-direction:column; }
      #${OVERLAY_ID} .yds-manager[hidden] { display:none; }
      #${OVERLAY_ID} .yds-manager-bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px; cursor:move; }
      #${OVERLAY_ID} .yds-manager-bar button { height:28px; border-radius:10px; padding:0 10px; font-size:12px; }
      #${OVERLAY_ID} .yds-manager-actions { display:flex; gap:8px; margin-left:auto; }
      #${OVERLAY_ID} .yds-manager-grid { flex:1; min-height:60px; overflow-y:scroll; overflow-x:hidden; scrollbar-gutter:stable; border:1px solid #2a2f3a; border-right:1px solid #2a2f3a; padding-right:20px; box-sizing:border-box; }
      #${OVERLAY_ID} .yds-manager-grid .yds-manager-row:last-child { border-bottom:0; }
      #${OVERLAY_ID} .yds-manager-blocked { flex:0 0 auto; max-height:150px; display:flex; flex-direction:column; overflow:hidden; margin-top:4px; }
      #${OVERLAY_ID} .yds-manager-blocked[hidden] { display:none; }
      #${OVERLAY_ID} .yds-manager-blocked-grid { overflow-y:auto; flex:1; padding-right:20px; scrollbar-gutter:stable; border:1px solid #2a2f3a; box-sizing:border-box; }
      #${OVERLAY_ID} .yds-manager-resize { position:absolute; right:0; bottom:0; width:18px; height:18px; cursor:nwse-resize; }
      #${OVERLAY_ID} .yds-manager-resize::after { content:""; position:absolute; right:4px; bottom:4px; width:8px; height:8px; border-right:2px solid #51596a; border-bottom:2px solid #51596a; }
      #${OVERLAY_ID} .yds-manager-row { display:grid; grid-template-columns:minmax(100px, 1fr) minmax(70px, 1fr) 58px 64px; align-items:center; min-height:32px; border-bottom:1px solid #242832; box-sizing:border-box; }
      #${OVERLAY_ID} .yds-manager-row > div { padding:6px 8px; min-width:0; }
      #${OVERLAY_ID} .yds-manager-row > div:last-child { display:grid; place-items:center; }
      #${OVERLAY_ID} .yds-manager-head { position:sticky; top:0; background:#181b20; color:#9ca3af; font-size:11px; font-weight:700; z-index:1; }
      #${OVERLAY_ID} .yds-video-name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer; color:#f3f4f6; }
      #${OVERLAY_ID} .yds-video-name:hover { color:#60a5fa; }
      #${OVERLAY_ID} .yds-channel-name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer; color:#6b7280; font-size:12px; }
      #${OVERLAY_ID} .yds-channel-name:hover { color:#60a5fa; }
      #${OVERLAY_ID} .yds-channel-name.highlighted { color:#fbbf24; background:#2b303b; border-radius:4px; }

      #${OVERLAY_ID} .yds-blocked-row { display:grid; grid-template-columns:1fr 64px; align-items:center; min-height:32px; border-bottom:1px solid #242832; box-sizing:border-box; }
      #${OVERLAY_ID} .yds-blocked-row:last-child { border-bottom:0; }
      #${OVERLAY_ID} .yds-blocked-row > div { padding:6px 8px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      #${OVERLAY_ID} .yds-blocked-row > div:last-child { display:grid; place-items:center; }
      #${OVERLAY_ID} .yds-blocked-name { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#f3f4f6; font-size:12px; cursor:pointer; }
      #${OVERLAY_ID} .yds-blocked-name:hover { color:#60a5fa; }
      #${OVERLAY_ID} .yds-blocked-head { position:sticky; top:0; background:#181b20; color:#9ca3af; font-size:11px; font-weight:700; z-index:1; }
      #${OVERLAY_ID} .yds-sortable { display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; }
      #${OVERLAY_ID} .yds-sortable:hover { color:#f3f4f6; }
      #${OVERLAY_ID} .yds-sort-icon { width:8px; height:8px; display:inline-flex; align-items:center; justify-content:center; color:#9ca3af; flex-shrink:0; vertical-align:middle; }
      #${OVERLAY_ID} .yds-sort-icon.active { color:#60a5fa; }
      #${OVERLAY_ID} .yds-blocked-row.highlighted { background:#2b303b; }
      #${OVERLAY_ID} .yds-vote-state { color:#f3f4f6; font-size:16px; text-align:center; }
      #${OVERLAY_ID} .yds-vote-state svg { width:16px; height:16px; display:block; margin:0 auto; }
      #${OVERLAY_ID} .yds-entry-remove { width:22px; height:22px; min-width:22px; max-width:22px; border-radius:10px; padding:0; font-size:0; line-height:1; overflow:hidden; }
      #${OVERLAY_ID} .yds-entry-remove::before { content:"×"; font-size:14px; line-height:1; display:inline-block; transform:translateY(2px); }
      #${OVERLAY_ID} .yds-manager-empty { color:#9ca3af; padding:12px; text-align:center; }
      #${OVERLAY_ID} .yds-mode-tab { height:28px; border-radius:10px; padding:0 10px; font-size:12px; color:#9ca3af; border-color:#333846; }
      #${OVERLAY_ID} .yds-mode-tab.active { color:#f3f4f6; background:#2b303b; border-color:#60a5fa; }
      #${OVERLAY_ID} .yds-playlist-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding-bottom:8px; cursor:default; }
      #${OVERLAY_ID} .yds-playlist-controls label { display:flex; align-items:center; gap:4px; font-size:12px; color:#9ca3af; cursor:pointer; user-select:none; }
      #${OVERLAY_ID} .yds-playlist-controls input[type=checkbox] { accent-color:#60a5fa; cursor:pointer; }
      #${OVERLAY_ID} .yds-playlist-btn { height:28px; border-radius:10px; padding:0 10px; font-size:12px; color:#9ca3af; }
      #${OVERLAY_ID} .yds-playlist-btn.active { color:#60a5fa; border-color:#60a5fa; }
      #${OVERLAY_ID}[data-theme="light"] {
        color:#111827; background:#f8fafc; border-color:#cbd5e1;
        box-shadow:0 18px 48px rgba(15,23,42,.18);
      }
      #${OVERLAY_ID}[data-theme="light"] .yds-head,
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-head,
      #${OVERLAY_ID}[data-theme="light"] .yds-blocked-head { background:#e5e7eb; color:#475569; }
      #${OVERLAY_ID}[data-theme="light"] button {
        border-color:#cbd5e1; background:#ffffff; color:#111827;
      }
      #${OVERLAY_ID}[data-theme="light"] button:hover {
        border-color:#94a3b8; background:#f1f5f9;
      }
      #${OVERLAY_ID}[data-theme="light"] [data-tooltip]:hover::after {
        background:#ffffff; color:#111827; border-color:#cbd5e1;
        box-shadow:0 8px 24px rgba(15,23,42,.16);
      }
      #${OVERLAY_ID}[data-theme="light"] .yds-track,
      #${OVERLAY_ID}[data-theme="light"] .yds-times,
      #${OVERLAY_ID}[data-theme="light"] .yds-status,
      #${OVERLAY_ID}[data-theme="light"] .yds-volume-label,
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-empty,
      #${OVERLAY_ID}[data-theme="light"] .yds-mode-tab,
      #${OVERLAY_ID}[data-theme="light"] .yds-playlist-controls label,
      #${OVERLAY_ID}[data-theme="light"] .yds-playlist-btn,
      #${OVERLAY_ID}[data-theme="light"] .yds-sort-icon { color:#64748b; }
      #${OVERLAY_ID}[data-theme="light"] .yds-volume-panel,
      #${OVERLAY_ID}[data-theme="light"] .yds-manager {
        background:#f8fafc; border-color:#cbd5e1;
        box-shadow:0 18px 48px rgba(15,23,42,.18);
      }
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-grid,
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-blocked-grid { border-color:#cbd5e1; }
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-row,
      #${OVERLAY_ID}[data-theme="light"] .yds-blocked-row { border-bottom-color:#e2e8f0; }
      #${OVERLAY_ID}[data-theme="light"] .yds-video-name,
      #${OVERLAY_ID}[data-theme="light"] .yds-blocked-name,
      #${OVERLAY_ID}[data-theme="light"] .yds-vote-state { color:#111827; }
      #${OVERLAY_ID}[data-theme="light"] .yds-channel-name { color:#64748b; }
      #${OVERLAY_ID}[data-theme="light"] .yds-video-name:hover,
      #${OVERLAY_ID}[data-theme="light"] .yds-channel-name:hover,
      #${OVERLAY_ID}[data-theme="light"] .yds-blocked-name:hover,
      #${OVERLAY_ID}[data-theme="light"] .yds-sortable:hover { color:#2563eb; }
      #${OVERLAY_ID}[data-theme="light"] .yds-channel-name.highlighted,
      #${OVERLAY_ID}[data-theme="light"] .yds-blocked-row.highlighted { background:#dbeafe; color:#1d4ed8; }
      #${OVERLAY_ID}[data-theme="light"] .yds-mode-tab.active {
        color:#111827; background:#e0f2fe; border-color:#2563eb;
      }
      #${OVERLAY_ID}[data-theme="light"] button.green {
        color:#22c55e; border-color:rgba(34,197,94,.55);
      }
      #${OVERLAY_ID}[data-theme="light"] button.red {
        color:#e67e22;
      }
      #${OVERLAY_ID}[data-theme="light"] button.yds-channel {
        color:#ff3434;
      }
      #${OVERLAY_ID}[data-theme="light"] button.blue,
      #${OVERLAY_ID}[data-theme="light"] .yds-playlist-btn.active,
      #${OVERLAY_ID}[data-theme="light"] .yds-sort-icon.active {
        color:#60a5fa; border-color:#60a5fa;
      }
      #${OVERLAY_ID}[data-theme="light"] .yds-manager-resize::after { border-color:#94a3b8; }
    `;
  }

  function button(cls, title, icon) {
    return `<button type="button" class="${cls}" data-tooltip="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${icon}</button>`;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  }

  function setStatus(text) {
    const overlay = document.getElementById(OVERLAY_ID);
    const status = overlay?.querySelector(".yds-status");
    if (status) status.textContent = text || "";
  }

  function updatePowerButtons() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.querySelectorAll(".yds-power").forEach(btn => btn.classList.toggle("green", enabled));
  }

  function updateManagerButtons(overlay = document.getElementById(OVERLAY_ID)) {
    const manager = overlay?.querySelector(".yds-manager");
    overlay?.querySelectorAll(".yds-reset").forEach(btn => btn.classList.toggle("blue", !!manager && !manager.hidden));
  }

  async function refreshTheme(overlay = document.getElementById(OVERLAY_ID)) {
    applyTheme(overlay, await getTheme());
  }

  async function updatePlaylistUI(overlay) {
    const [playlistMode, includeUpvoted, includeNeutral, shuffle, repeat] = await Promise.all([
      getPlaylistMode(), getPlaylistIncludeUpvoted(), getPlaylistIncludeNeutral(), getPlaylistShuffle(), getPlaylistRepeat()
    ]);
    overlay.querySelectorAll(".yds-mode-tab").forEach(t => t.classList.remove("active"));
    (playlistMode ? overlay.querySelector(".yds-mode-playlist") : overlay.querySelector(".yds-mode-manager"))?.classList.add("active");
    const upvotedCheckbox = overlay.querySelector(".yds-playlist-upvoted");
    if (upvotedCheckbox) upvotedCheckbox.checked = includeUpvoted;
    const neutralCheckbox = overlay.querySelector(".yds-playlist-neutral");
    if (neutralCheckbox) neutralCheckbox.checked = includeNeutral;
    overlay.querySelector(".yds-playlist-shuffle")?.classList.toggle("active", shuffle);
    overlay.querySelector(".yds-playlist-repeat")?.classList.toggle("active", repeat);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampWindowPosition(left, top, width, height) {
    return {
      left: clamp(left, 8, Math.max(8, window.innerWidth - width - 8)),
      top: clamp(top, 8, Math.max(8, window.innerHeight - height - 8))
    };
  }

  function setManagerPosition(manager, left, top) {
    const pos = clampWindowPosition(left, top, manager.offsetWidth, manager.offsetHeight);
    manager.style.left = `${pos.left}px`;
    manager.style.top = `${pos.top}px`;
    manager.style.right = "auto";
    manager.style.bottom = "auto";
    return pos;
  }

  function maybeSnapManagerToPlayer(manager, overlay) {
    const managerRect = manager.getBoundingClientRect();
    const playerRect = overlay.getBoundingClientRect();
    const threshold = 28;
    const candidates = [
      { left: playerRect.left - managerRect.width, top: playerRect.top },
      { left: playerRect.right, top: playerRect.top },
      { left: playerRect.left, top: playerRect.top - managerRect.height },
      { left: playerRect.left, top: playerRect.bottom }
    ];

    for (const candidate of candidates) {
      if (Math.abs(managerRect.left - candidate.left) <= threshold && Math.abs(managerRect.top - candidate.top) <= threshold) {
        const pos = setManagerPosition(manager, candidate.left, candidate.top);
        managerSnap = { x: pos.left - playerRect.left, y: pos.top - playerRect.top };
        return true;
      }
    }

    managerSnap = null;
    return false;
  }

  function moveSnappedManager(overlay) {
    const manager = overlay.querySelector(".yds-manager");
    if (!manager || manager.hidden || !managerSnap) return;
    const playerRect = overlay.getBoundingClientRect();
    setManagerPosition(manager, playerRect.left + managerSnap.x, playerRect.top + managerSnap.y);
  }

  function clampPlayerPositionForSnap(overlay, left, top) {
    const manager = overlay.querySelector(".yds-manager");
    if (!manager || manager.hidden || !managerSnap) {
      return {
        left: clamp(left, 8, Math.max(8, window.innerWidth - overlay.offsetWidth - 8)),
        top: clamp(top, 8, Math.max(8, window.innerHeight - overlay.offsetHeight - 8))
      };
    }

    const minLeft = 8 - Math.min(0, managerSnap.x);
    const minTop = 8 - Math.min(0, managerSnap.y);
    const maxLeft = Math.max(minLeft, window.innerWidth - Math.max(overlay.offsetWidth, managerSnap.x + manager.offsetWidth) - 8);
    const maxTop = Math.max(minTop, window.innerHeight - Math.max(overlay.offsetHeight, managerSnap.y + manager.offsetHeight) - 8);
    return {
      left: clamp(left, minLeft, maxLeft),
      top: clamp(top, minTop, maxTop)
    };
  }

  function positionManagerAtDefault(overlay, manager, state = {}) {
    const gap = 0;
    const minWidth = 480;
    const minHeight = 170;
    let playerRect = overlay.getBoundingClientRect();
    const defaultWidth = Math.max(minWidth, playerRect.width);
    const width = Number.isFinite(state.managerWidth)
      ? Math.max(minWidth, Math.min(window.innerWidth - 16, state.managerWidth))
      : Math.max(minWidth, Math.min(window.innerWidth - 16, defaultWidth));
    const height = Number.isFinite(state.managerHeight)
      ? Math.max(minHeight, Math.min(window.innerHeight - 16, state.managerHeight))
      : Math.max(minHeight, Math.min(window.innerHeight - 16, manager.offsetHeight || 460));

    manager.style.width = `${width}px`;
    manager.style.height = `${height}px`;
    manager.style.maxHeight = "none";

    const playerLeft = clamp(playerRect.left, 8, Math.max(8, window.innerWidth - width - 8));
    const playerTop = clamp(playerRect.top, 8, Math.max(8, window.innerHeight - playerRect.height - height - gap - 8));
    if (Math.round(playerLeft) !== Math.round(playerRect.left) || Math.round(playerTop) !== Math.round(playerRect.top)) {
      overlay.style.left = `${playerLeft}px`;
      overlay.style.top = `${playerTop}px`;
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      playerRect = overlay.getBoundingClientRect();
    }

    const pos = setManagerPosition(manager, playerRect.left, playerRect.bottom + gap);
    managerSnap = { x: 0, y: Math.round(pos.top - playerRect.top) };
  }

  async function openManager(overlay) {
    const manager = overlay.querySelector(".yds-manager");
    if (!manager) return;
    manager.hidden = false;
    const state = await getOverlayState();
    positionManagerAtDefault(overlay, manager, state);
    const playerRect = overlay.getBoundingClientRect();
    updateManagerButtons(overlay);
    const rect = manager.getBoundingClientRect();
    await saveOverlayState({
      x: Math.round(playerRect.left),
      y: Math.round(playerRect.top),
      managerOpen: true,
      managerX: Math.round(rect.left),
      managerY: Math.round(rect.top),
      managerWidth: Math.round(rect.width),
      managerHeight: Math.round(rect.height),
      managerSnapped: true,
      managerSnapX: Math.round(managerSnap.x),
      managerSnapY: Math.round(managerSnap.y)
    });
    await updatePlaylistUI(overlay);
    await renderManager(overlay);
  }

  async function closeManager(overlay) {
    const manager = overlay.querySelector(".yds-manager");
    if (!manager) return;
    manager.hidden = true;
    managerSnap = null;
    updateManagerButtons(overlay);
    await saveOverlayState({ managerOpen: false, managerSnapped: false, managerSnapX: null, managerSnapY: null });
  }

  function normalizeYoutubeWatchUrl(value, videoId = "") {
    try {
      const url = new URL(value || `https://www.youtube.com/watch?v=${videoId}`);
      if (!/(^|\.)youtube\.com$/i.test(url.hostname) || url.pathname !== "/watch") return "";
      const id = url.searchParams.get("v") || videoId;
      if (!id) return "";
      url.protocol = "https:";
      url.hostname = "www.youtube.com";
      url.pathname = "/watch";
      url.search = `?v=${encodeURIComponent(id)}`;
      return url.href;
    } catch {
      return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "";
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalizeVisitedEntry(item) {
    if (typeof item === "string") {
      return {
        videoId: item,
        title: "",
        url: "",
        href: "",
        upvoted: null,
        downvoted: null,
        userPressedNext: false,
        channelId: "",
        channelName: "",
        addedAt: 0,
        updatedAt: 0,
        lastAccessedAt: 0
      };
    }
    return {
      videoId: asString(item?.videoId || item?.id).trim(),
      title: asString(item?.title),
      url: asString(item?.url || item?.href),
      href: asString(item?.href || item?.url),
      upvoted: typeof item?.upvoted === "boolean" ? item.upvoted : null,
      downvoted: typeof item?.downvoted === "boolean" ? item.downvoted : null,
      userPressedNext: item?.userPressedNext === true,
      channelId: asString(item?.channelId),
      channelName: asString(item?.channelName),
      addedAt: item?.addedAt || 0,
      updatedAt: item?.updatedAt || item?.addedAt || 0,
      lastAccessedAt: item?.lastAccessedAt || item?.updatedAt || item?.addedAt || 0
    };
  }

  function asString(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeChannelName(value) {
    return asString(value).trim().replace(/^@/, "").replace(/\s+/g, " ").toLowerCase();
  }

  function isSameChannel(current, candidate) {
    if (!current || !candidate) return false;
    const currentId = asString(current.channelId);
    const candidateId = asString(candidate.channelId);
    if (currentId && candidateId && currentId === candidateId) return true;

    const currentName = normalizeChannelName(current.channelName);
    const candidateName = normalizeChannelName(candidate.channelName);
    return !!currentName && !!candidateName && currentName === candidateName;
  }

  async function getVisitedEntries() {
    const result = await safeStorageGet(VISITED_KEY);
    const raw = Array.isArray(result[VISITED_KEY]) ? result[VISITED_KEY] : [];
    return dedupeVisitedEntries(raw.map(normalizeVisitedEntry).filter(item => item.videoId));
  }

  async function repairVisitedEntriesIfNeeded() {
    const result = await safeStorageGet(VISITED_KEY);
    const raw = Array.isArray(result[VISITED_KEY]) ? result[VISITED_KEY] : [];
    const normalized = raw.map(normalizeVisitedEntry).filter(item => item.videoId);
    const deduped = dedupeVisitedEntries(normalized);
    if (deduped.length !== normalized.length) await saveVisitedEntries(deduped);
    return deduped;
  }

  async function saveVisitedEntries(entries) {
    await safeStorageSet({ [VISITED_KEY]: dedupeVisitedEntries(entries.map(normalizeVisitedEntry).filter(item => item.videoId)).slice(-1000) });
  }

  function mergeVisitedEntry(existing, item) {
    if (!existing) return item;
    return {
      videoId: existing.videoId,
      title: item.title || existing.title || "",
      url: item.url || item.href || existing.url || existing.href || "",
      href: item.href || item.url || existing.href || existing.url || "",
      upvoted: typeof item.upvoted === "boolean" ? item.upvoted : existing.upvoted,
      downvoted: typeof item.downvoted === "boolean" ? item.downvoted : existing.downvoted,
      userPressedNext: item.userPressedNext === true || existing.userPressedNext === true,
      channelId: item.channelId || existing.channelId || "",
      channelName: item.channelName || existing.channelName || "",
      addedAt: Math.min(...[existing.addedAt, item.addedAt].filter(Boolean)) || existing.addedAt || item.addedAt || 0,
      updatedAt: Math.max(existing.updatedAt || 0, item.updatedAt || 0),
      lastAccessedAt: Math.max(existing.lastAccessedAt || 0, item.lastAccessedAt || 0)
    };
  }

  function dedupeVisitedEntries(entries) {
    const byId = new Map();
    for (const item of entries) {
      if (!item.videoId) continue;
      byId.set(item.videoId, mergeVisitedEntry(byId.get(item.videoId), item));
    }
    const merged = Array.from(byId.values());
    const byName = new Map();
    for (const item of merged) {
      if (!item.title || !item.channelName) { byName.set(item.videoId, item); continue; }
      const key = item.title.toLowerCase() + "|" + item.channelName.toLowerCase();
      const existing = byName.get(key);
      if (!existing) { byName.set(key, item); continue; }
      if (item.addedAt < existing.addedAt) {
        byName.set(key, mergeVisitedEntry(item, existing));
      } else {
        byName.set(key, mergeVisitedEntry(existing, item));
      }
    }
    return Array.from(byName.values());
  }

  function normalizeBlockedChannel(item) {
    return {
      channelId: typeof item?.channelId === "string" ? item.channelId : "",
      channelName: typeof item?.channelName === "string" ? item.channelName : "",
      blockedAt: Number(item?.blockedAt || Date.now())
    };
  }

  async function getBlockedChannels() {
    const result = await safeStorageGet(BLOCKED_CHANNELS_KEY);
    return (Array.isArray(result[BLOCKED_CHANNELS_KEY]) ? result[BLOCKED_CHANNELS_KEY] : []).map(normalizeBlockedChannel).filter(c => c.channelId || c.channelName);
  }

  async function saveBlockedChannels(list) {
    await safeStorageSet({ [BLOCKED_CHANNELS_KEY]: list });
  }

  async function markForcePlayOnce(url) {
    const safeUrl = normalizeYoutubeWatchUrl(url);
    if (!safeUrl) return;
    const videoId = new URL(safeUrl).searchParams.get("v");
    if (!videoId) return;
    await safeStorageSet({
      [FORCE_PLAY_ONCE_KEY]: { videoId, url: safeUrl, createdAt: Date.now() }
    });
    if (hasExtensionContext()) {
      try { await chrome.storage.local.remove(NAV_FROM_SKIP_KEY); } catch {}
    }
  }

  async function getPlaylistMode() {
    const result = await safeStorageGet(PLAYLIST_MODE_KEY);
    return result[PLAYLIST_MODE_KEY] === true;
  }

  async function getPlaylistIncludeUpvoted() {
    const result = await safeStorageGet(PLAYLIST_INCLUDE_UPVOTED_KEY);
    return result[PLAYLIST_INCLUDE_UPVOTED_KEY] !== false;
  }

  async function getPlaylistIncludeNeutral() {
    const result = await safeStorageGet(PLAYLIST_INCLUDE_NEUTRAL_KEY);
    return result[PLAYLIST_INCLUDE_NEUTRAL_KEY] !== false;
  }

  async function getPlaylistShuffle() {
    const result = await safeStorageGet(PLAYLIST_SHUFFLE_KEY);
    return result[PLAYLIST_SHUFFLE_KEY] === true;
  }

  async function getPlaylistRepeat() {
    const result = await safeStorageGet(PLAYLIST_REPEAT_KEY);
    return result[PLAYLIST_REPEAT_KEY] === true;
  }

  async function blockChannel(channelId, channelName) {
    const list = await getBlockedChannels();
    const normalizedName = normalizeChannelName(channelName);
    if (channelId && list.some(c => c.channelId === channelId)) return;
    if (normalizedName && list.some(c => normalizeChannelName(c.channelName) === normalizedName)) return;
    list.push({ channelId, channelName, blockedAt: Date.now() });
    await saveBlockedChannels(list);
  }

  async function unblockChannel(channelId, channelName) {
    const list = await getBlockedChannels();
    const normalizedName = normalizeChannelName(channelName);
    await saveBlockedChannels(list.filter(c => {
      if (channelId && c.channelId === channelId) return false;
      if (normalizedName && normalizeChannelName(c.channelName) === normalizedName) return false;
      return true;
    }));
  }

  function setTrackText(track, title) {
    if (track._marqueeTitle === title) return;
    track._marqueeTitle = title;
    if (track._marqueeTimer) clearTimeout(track._marqueeTimer);
    track.textContent = title;
    track.classList.remove("yds-track-scrolling");
    track._marqueeTimer = setTimeout(() => {
      if (track.scrollWidth > track.clientWidth) {
        track.textContent = "";
        const inner = document.createElement("span");
        inner.className = "yds-track-inner";
        inner.append(Object.assign(document.createElement("span"), { textContent: title }));
        inner.append(Object.assign(document.createElement("span"), { textContent: title }));
        track.append(inner);
        track.classList.add("yds-track-scrolling");
      }
    }, 0);
  }

  function getVoteIcon(entry) {
    if (entry.upvoted === true) return `<span style="color:#22c55e">${ICONS.up}</span>`;
    if (entry.downvoted === true) return `<span style="color:#ef4444">${ICONS.down}</span>`;
    return '<span style="color:#6b7280">\u2014</span>';
  }

  function getSortIcon(col) {
    const active = videoSortCol === col && videoSortDir !== null;
    const icon = videoSortCol === col
      ? videoSortDir === "asc" ? ICONS.sortAsc : videoSortDir === "desc" ? ICONS.sortDesc : ICONS.sortNone
      : ICONS.sortNone;
    return `<span class="yds-sort-icon${active ? " active" : ""}" data-col="${col}">${icon}</span>`;
  }

  function getBlockedSortIcon() {
    const active = blockedSortDir !== null;
    const icon = blockedSortDir === "asc" ? ICONS.sortAsc : blockedSortDir === "desc" ? ICONS.sortDesc : ICONS.sortNone;
    return `<span class="yds-sort-icon${active ? " active" : ""}" data-col="blocked-name">${icon}</span>`;
  }

  function sortEntries(entries, col, dir) {
    if (!col || !dir) return entries.slice().reverse();
    const sorted = entries.slice().sort((a, b) => {
      let cmp = 0;
      if (col === "video") {
        cmp = (a.title || "").localeCompare(b.title || "");
      } else if (col === "channel") {
        cmp = (a.channelName || "").localeCompare(b.channelName || "");
      } else if (col === "vote") {
        const aVal = a.upvoted ? 1 : a.downvoted ? -1 : 0;
        const bVal = b.upvoted ? 1 : b.downvoted ? -1 : 0;
        cmp = aVal - bVal;
      }
      return dir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }

  function sortBlockedChannels(blocked, dir) {
    if (!dir) return blocked.slice();
    return blocked.slice().sort((a, b) => {
      const an = (a.channelName || a.channelId || "").toLowerCase();
      const bn = (b.channelName || b.channelId || "").toLowerCase();
      return dir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
    });
  }

  async function renderManager(overlay) {
    const manager = overlay.querySelector(".yds-manager");
    if (!manager || manager.hidden) return;

    const [entries, blocked, playlistMode, target] = await Promise.all([
      repairVisitedEntriesIfNeeded(), getBlockedChannels(), getPlaylistMode(),
      safeSendMessage({ type: "YT_YOUDIVERSIFY_FIND_TARGET" }, { ok: false })
    ]);
    const currentChannel = target?.state?.channel || null;
    const grid = overlay.querySelector(".yds-manager-grid");
    const controls = overlay.querySelector(".yds-playlist-controls");

    if (playlistMode) {
      overlay.querySelector(".yds-manager-blocked")?.setAttribute("hidden", "");
      const includeUpvoted = await getPlaylistIncludeUpvoted();
      const includeNeutral = await getPlaylistIncludeNeutral();
      const blockedChannelIds = new Set(blocked.map(c => c.channelId).filter(Boolean));
      const blockedChannelNames = new Set(blocked.map(c => normalizeChannelName(c.channelName)).filter(Boolean));
      const filtered = entries.filter(e => {
        if (e.downvoted) return false;
        if (e.upvoted) return includeUpvoted;
        return includeNeutral;
      }).filter(e => {
        const id = e.channelId || "";
        const name = normalizeChannelName(e.channelName);
        if (id && blockedChannelIds.has(id)) return false;
        if (name && blockedChannelNames.has(name)) return false;
        if (isSameChannel(currentChannel, e)) return false;
        return true;
      });
      if (controls) controls.hidden = false;

      let html = '';
      if (!filtered.length) {
        html += '<div class="yds-manager-empty">No videos match the playlist filters.</div>';
      } else {
        html += `
          <div class="yds-manager-row yds-manager-head">
            <div class="yds-sortable" data-col="video"><span>Video</span>${getSortIcon("video")}</div>
            <div class="yds-sortable" data-col="channel"><span>Channel</span>${getSortIcon("channel")}</div>
            <div class="yds-sortable" data-col="vote"><span>Vote</span>${getSortIcon("vote")}</div>
            <div>Remove</div>
          </div>
          ${sortEntries(filtered, videoSortCol, videoSortDir).map(entry => `
            <div class="yds-manager-row" data-video-id="${escapeHtml(entry.videoId)}" data-video-url="${escapeHtml(normalizeYoutubeWatchUrl('', entry.videoId))}">
              <div class="yds-video-name" data-tooltip="${escapeHtml(entry.title || entry.url || entry.videoId)}">${escapeHtml(entry.title || entry.url || entry.videoId)}</div>
              <div class="yds-channel-name" data-channel-id="${escapeHtml(entry.channelId || '')}" data-channel-name="${escapeHtml(entry.channelName || '')}">${escapeHtml(entry.channelName || '')}</div>
              <div class="yds-vote-state" aria-label="${entry.upvoted === true ? "Upvoted" : entry.downvoted === true ? "Downvoted" : "Neither"}">${getVoteIcon(entry)}</div>
              <div><button type="button" class="yds-entry-remove" data-tooltip="Remove from list" aria-label="Remove from list">×</button></div>
            </div>
          `).join("")}
        `;
      }
      grid.innerHTML = html;
    } else {
      if (controls) controls.hidden = true;

      let html = '';
      if (!entries.length) {
        html += '<div class="yds-manager-empty">No videos in the list.</div>';
      } else {
        html += `
          <div class="yds-manager-row yds-manager-head">
            <div class="yds-sortable" data-col="video"><span>Video</span>${getSortIcon("video")}</div>
            <div class="yds-sortable" data-col="channel"><span>Channel</span>${getSortIcon("channel")}</div>
            <div class="yds-sortable" data-col="vote"><span>Vote</span>${getSortIcon("vote")}</div>
            <div>Remove</div>
          </div>
          ${sortEntries(entries, videoSortCol, videoSortDir).map(entry => `
            <div class="yds-manager-row" data-video-id="${escapeHtml(entry.videoId)}" data-video-url="${escapeHtml(normalizeYoutubeWatchUrl('', entry.videoId))}">
              <div class="yds-video-name" data-tooltip="${escapeHtml(entry.title || entry.url || entry.videoId)}">${escapeHtml(entry.title || entry.url || entry.videoId)}</div>
              <div class="yds-channel-name" data-channel-id="${escapeHtml(entry.channelId || '')}" data-channel-name="${escapeHtml(entry.channelName || '')}">${escapeHtml(entry.channelName || '')}</div>
              <div class="yds-vote-state" aria-label="${entry.upvoted === true ? "Upvoted" : entry.downvoted === true ? "Downvoted" : "Neither"}">${getVoteIcon(entry)}</div>
              <div><button type="button" class="yds-entry-remove" data-tooltip="Remove from list" aria-label="Remove from list">×</button></div>
            </div>
          `).join("")}
        `;
      }

      grid.innerHTML = html;

      const blockedContainer = overlay.querySelector(".yds-manager-blocked");
      const blockedGrid = overlay.querySelector(".yds-manager-blocked-grid");
      if (blocked.length) {
        blockedContainer.hidden = false;
        blockedGrid.innerHTML = `<div class="yds-blocked-row yds-blocked-head"><div class="yds-sortable" data-col="blocked-name"><span>Blocked Channels</span>${getBlockedSortIcon()}</div><div>Remove</div></div>` +
          sortBlockedChannels(blocked, blockedSortDir).map(c => `
            <div class="yds-blocked-row" data-channel-id="${escapeHtml(c.channelId)}" data-channel-name="${escapeHtml(c.channelName || "")}">
              <div class="yds-blocked-name">${escapeHtml(c.channelName || c.channelId)}</div>
              <div><button type="button" class="yds-entry-remove yds-unblock-channel" data-tooltip="Unblock channel" aria-label="Unblock channel">×</button></div>
            </div>
          `).join("");
      } else {
        blockedContainer.hidden = true;
      }
    }
  }

  async function refreshManagerIfOpen(overlay = document.getElementById(OVERLAY_ID)) {
    const manager = overlay?.querySelector(".yds-manager");
    if (!manager || manager.hidden) return;
    await renderManager(overlay);
  }

  async function removeManagerEntry(videoId) {
    const entries = await getVisitedEntries();
    await saveVisitedEntries(entries.filter(entry => entry.videoId !== videoId));
  }

  async function exportManagerList() {
    const [entries, blockedChannels, playlistMode, includeUpvoted, includeNeutral, shuffle, repeat] = await Promise.all([
      getVisitedEntries(), getBlockedChannels(),
      getPlaylistMode(), getPlaylistIncludeUpvoted(), getPlaylistIncludeNeutral(), getPlaylistShuffle(), getPlaylistRepeat()
    ]);
    const blob = new Blob([JSON.stringify({
      version: 1, exportedAt: Date.now(), entries, blockedChannels,
      playlist: { mode: playlistMode, includeUpvoted, includeNeutral, shuffle, repeat }
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `youtube-youdiversify-list-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importManagerList(file, overlay) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(entries)) throw new Error("Imported file does not contain a video list.");
    await saveVisitedEntries(entries);
    if (Array.isArray(parsed.blockedChannels)) {
      await saveBlockedChannels(parsed.blockedChannels.map(normalizeBlockedChannel).filter(c => c.channelId || c.channelName));
    }
    if (parsed.playlist) {
      const p = parsed.playlist;
      await safeStorageSet({
        [PLAYLIST_MODE_KEY]: !!p.mode,
        [PLAYLIST_INCLUDE_UPVOTED_KEY]: p.includeUpvoted !== false,
        [PLAYLIST_INCLUDE_NEUTRAL_KEY]: p.includeNeutral !== false,
        [PLAYLIST_SHUFFLE_KEY]: !!p.shuffle,
        [PLAYLIST_REPEAT_KEY]: !!p.repeat
      });
    }
    await updatePlaylistUI(overlay);
    await renderManager(overlay);
  }

  async function createOverlay() {
    await ensureBodyReady();
    ensureStyles();
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="yds-head">
        <button type="button" class="yds-small yds-play" data-tooltip="Play or pause" aria-label="Play or pause">${ICONS.play}</button>
        <div class="yds-title"><div class="yds-name">YouDiversify</div><div class="yds-track">Finding YouTube tab...</div></div>
        <div class="yds-head-actions">
          ${button("yds-small yds-collapse", "Collapse", ICONS.collapse)}
          ${button("yds-small yds-close", "Close", ICONS.close)}
          ${button("yds-small yds-power green", "Turn extension on or off", ICONS.power)}
        </div>
      </div>
      <div class="yds-controls">
        ${button("yds-icon yds-up", "Upvote", ICONS.up)}
        ${button("yds-icon yds-down red", "Downvote and skip", ICONS.down)}
        ${button("yds-icon yds-channel", "Block channel", ICONS.channel)}
        <div class="yds-skip-wrap">
          ${button("yds-icon yds-next", "Skip next", ICONS.next)}
          ${button("yds-next-untracked green", "Skip next without tracking", "?")}
        </div>
        ${button("yds-icon yds-volume-toggle", "Show or hide volume slider", ICONS.volume)}
        ${button("yds-icon yds-reset", "Management grid", ICONS.reset)}
      </div>
      <div class="yds-seek">
        <div class="yds-times"><span class="yds-current">0:00</span><span class="yds-duration">0:00</span></div>
        <input class="yds-slider" type="range" min="0" max="1000" value="0" data-tooltip="Move through video" aria-label="Move through video">
      </div>
      <div class="yds-volume-panel" hidden>
        <input class="yds-volume-slider" type="range" min="0" max="100" value="100" aria-label="Volume">
        <span class="yds-volume-label">100%</span>
      </div>
      <div class="yds-manager" hidden>
        <div class="yds-manager-bar">
          <button type="button" class="yds-mode-tab yds-mode-playlist" data-tooltip="Switch to playlist mode" aria-label="Switch to playlist mode">Playlist</button>
          <button type="button" class="yds-mode-tab yds-mode-manager active" data-tooltip="Switch to manager mode" aria-label="Switch to manager mode">Manager</button>
          <div class="yds-manager-actions">
            <button type="button" class="yds-manager-export" data-tooltip="Save list" aria-label="Save list">Save</button>
            <button type="button" class="yds-manager-import" data-tooltip="Load external list" aria-label="Load external list">Import</button>
            <input class="yds-manager-file" type="file" accept="application/json,.json" hidden>
            <button type="button" class="yds-manager-reset" data-tooltip="Clean list" aria-label="Clean list">Reset</button>
          </div>
        </div>
        <div class="yds-playlist-controls" hidden>
          <button type="button" class="yds-playlist-btn yds-playlist-shuffle" data-tooltip="Shuffle">${ICONS.shuffle}</button>
          <button type="button" class="yds-playlist-btn yds-playlist-repeat" data-tooltip="Repeat">${ICONS.repeat}</button>
          <label><input type="checkbox" class="yds-playlist-upvoted" checked> Upvoted</label>
          <label><input type="checkbox" class="yds-playlist-neutral" checked> Neutral</label>
        </div>
        <div class="yds-manager-grid"></div>
        <div class="yds-manager-blocked" hidden>
          <div class="yds-manager-blocked-grid"></div>
        </div>
        <div class="yds-manager-resize" aria-hidden="true"></div>
      </div>
      <div class="yds-status">Ready</div>
      ${button("yds-theme yds-theme-corner", "Use light mode", ICONS.sun)}
      <div class="yds-mini">
        ${button("yds-icon yds-play", "Play or pause", ICONS.play)}
        ${button("yds-icon yds-up", "Upvote", ICONS.up)}
        ${button("yds-icon yds-down red", "Downvote and skip", ICONS.down)}
        ${button("yds-icon yds-channel", "Block channel", ICONS.channel)}
        ${button("yds-icon yds-next", "Skip next", ICONS.next)}
        ${button("yds-icon yds-next-untracked green", "Skip next without tracking", "?")}
        ${button("yds-icon yds-expand", "Expand", ICONS.expand)}
        ${button("yds-icon yds-close", "Close", ICONS.close)}
        <div class="yds-mini-seek"><input class="yds-slider yds-mini-slider" type="range" min="0" max="1000" value="0" data-tooltip="Move through video" aria-label="Move through video"></div>
      </div>`;
    document.body.appendChild(overlay);
    bindEvents(overlay);
    return overlay;
  }

  async function applyStoredState(overlay) {
    const state = await getOverlayState();
    overlay.classList.toggle("collapsed", !!state.collapsed);
    overlay.querySelector(".yds-seek").hidden = false;
    const manager = overlay.querySelector(".yds-manager");
    if (manager) {
      manager.hidden = state.managerOpen !== true || state.collapsed === true;
      if (Number.isFinite(state.managerWidth)) {
        manager.style.width = `${Math.max(480, Math.min(window.innerWidth - 16, state.managerWidth))}px`;
        manager.style.right = "auto";
      } else {
        manager.style.width = "";
      }
      if (Number.isFinite(state.managerHeight)) {
        manager.style.height = `${Math.max(170, Math.min(window.innerHeight - 16, state.managerHeight))}px`;
        manager.style.maxHeight = "none";
      } else {
        manager.style.height = "";
        manager.style.maxHeight = "";
      }
    }
    const volumePanel = overlay.querySelector(".yds-volume-panel");
    if (volumePanel) volumePanel.hidden = true;
    overlay.querySelectorAll(".yds-volume-toggle").forEach(btn => btn.classList.remove("blue"));
    if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
      overlay.style.left = `${Math.max(8, Math.min(window.innerWidth - 80, state.x))}px`;
      overlay.style.top = `${Math.max(8, Math.min(window.innerHeight - 48, state.y))}px`;
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
    }
    if (manager) {
      if (!manager.hidden) {
        positionManagerAtDefault(overlay, manager, state);
        await updatePlaylistUI(overlay);
        await renderManager(overlay);
      } else {
        managerSnap = null;
      }
      updateManagerButtons(overlay);
    }
  }

  function renderState(state) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.hidden) return;
    lastState = state || null;

    const hasTarget = !!state?.ok;
    if (typeof state?.enabled === "boolean") {
      enabled = state.enabled;
      updatePowerButtons();
    }
    const controlsEnabled = hasTarget && enabled && state?.enabled !== false;
    setTrackText(overlay.querySelector(".yds-track"), hasTarget ? (state.title || "YouTube video") : "No YouTube video tab");
    overlay.querySelectorAll(".yds-play").forEach(btn => {
      btn.innerHTML = state?.playing ? ICONS.pause : ICONS.play;
    });
    overlay.querySelectorAll(".yds-up").forEach(btn => btn.classList.toggle("green", !!state?.liked));

    const currentTime = Number(state?.currentTime || 0);
    const duration = Number(state?.duration || 0);
    overlay.querySelector(".yds-current").textContent = formatTime(currentTime);
    overlay.querySelector(".yds-duration").textContent = formatTime(duration);
    const sliderValue = duration > 0 ? String(Math.round((currentTime / duration) * 1000)) : "0";
    overlay.querySelectorAll(".yds-slider").forEach(slider => { if (!sliderDragging) slider.value = sliderValue; });

    const volume = Math.round(Math.max(0, Math.min(1, Number(state?.volume ?? 1))) * 100);
    const volumeSlider = overlay.querySelector(".yds-volume-slider");
    if (volumeSlider && document.activeElement !== volumeSlider) volumeSlider.value = String(volume);
    const volumeLabel = overlay.querySelector(".yds-volume-label");
    if (volumeLabel) volumeLabel.textContent = `${volume}%`;
    overlay.querySelector(".yds-volume-toggle")?.classList.toggle("red", !!state?.muted || volume === 0);

    const canSeek = controlsEnabled && duration > 0;
    overlay.querySelectorAll(".yds-play,.yds-up,.yds-down,.yds-channel,.yds-next,.yds-next-untracked,.yds-volume-toggle").forEach(btn => { btn.disabled = !controlsEnabled; });
    overlay.querySelectorAll(".yds-slider").forEach(slider => { slider.disabled = !canSeek; });
    const volumeRange = overlay.querySelector(".yds-volume-slider");
    if (volumeRange) volumeRange.disabled = !controlsEnabled;
  }

  async function refreshState() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.hidden) return;
    try {
      const target = await findTarget();
      if (target?.ok && target.state) {
        renderState(target.state);
        if (!skipWaiting) {
          if (target.state.ok === false) setStatus(target.state.error || "Command failed.");
          else if (!target.state.title) setStatus("Ready");
        }
      } else {
        renderState({ ok: false });
        if (!skipWaiting) setStatus(target?.error || "Open a YouTube video tab to control playback.");
      }
    } catch {
      renderState({ ok: false });
      if (!skipWaiting) setStatus("Open a YouTube video tab to control playback.");
    }
  }

  async function waitUntilPlaybackStarts(previousVideoId = null, timeoutMs = 25000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const target = await findTarget().catch(() => null);
      const state = target?.state;
      if (target?.ok && state?.ok) {
        renderState(state);
        const changed = !previousVideoId || !state.videoId || state.videoId !== previousVideoId;
        if (changed && state.playing) return { ok: true, state };
      }
      await sleep(350);
    }
    return { ok: false, error: "Still waiting for playback." };
  }

  async function sendCommand(type, payload = {}, waitingText = "Done.") {
    const isSkipCommand = type === "YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP" ||
      type === "YT_YOUDIVERSIFY_SKIP_NEXT" ||
      type === "YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED";
    const before = isSkipCommand ? await findTarget().catch(() => null) : null;
    if (waitingText) setStatus(waitingText);
    if (isSkipCommand) skipWaiting = true;
    const response = await relay({ type, ...payload });
    if (response?.ok === false) {
      skipWaiting = false;
      setStatus(response.error || "Command failed.");
      await refreshState();
      if (isSkipCommand) await refreshManagerIfOpen();
      return response;
    }
    if (isSkipCommand) {
      const waited = await waitUntilPlaybackStarts(before?.state?.videoId || null);
      skipWaiting = false;
      if (waited.ok) setStatus("Playing");
      else setStatus("Skipping, please wait...");
      await refreshState();
      await refreshManagerIfOpen();
      return response;
    }
    if (type === "YT_YOUDIVERSIFY_UPVOTE") {
      setStatus(response?.liked ? "Upvoted." : "Upvote removed.");
      await refreshState();
      await refreshManagerIfOpen();
      return response;
    }
    setStatus("Done.");
    await refreshState();
    return response;
  }

  function toggleVolumePanel(overlay, button) {
    const panel = overlay.querySelector(".yds-volume-panel");
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    overlay.querySelectorAll(".yds-volume-toggle").forEach(btn => btn.classList.toggle("blue", open));
    if (open) {
      const b = button.getBoundingClientRect();
      const o = overlay.getBoundingClientRect();
      panel.style.left = `${Math.max(0, b.right - o.left + 6)}px`;
      panel.style.top = `${Math.max(0, b.top - o.top - 52)}px`;
    }
  }

  function hideVolumePanel(overlay) {
    const panel = overlay.querySelector(".yds-volume-panel");
    if (!panel) return;
    panel.hidden = true;
    overlay.querySelectorAll(".yds-volume-toggle").forEach(btn => btn.classList.remove("blue"));
  }

  function eventHitElement(event, element) {
    if (!element) return false;
    if (element.hidden) return false;
    if (event.composedPath?.().includes(element)) return true;
    if (event.target instanceof Node && element.contains(event.target)) return true;
    const rect = element.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function eventHitAppWindow(event, overlay) {
    const manager = overlay?.querySelector(".yds-manager");
    if (eventHitElement(event, overlay) || eventHitElement(event, manager)) return true;
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;

    return [overlay, manager].some(element => {
      if (!element || element.hidden) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 &&
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  }

  function bindEvents(overlay) {
    overlay.addEventListener("click", async (event) => {
      const sortable = event.target.closest(".yds-sortable");
      if (sortable && !event.target.closest("button")) {
        const col = sortable.dataset.col;
        if (col === "blocked-name") {
          blockedSortDir = blockedSortDir === null ? "asc" : blockedSortDir === "asc" ? "desc" : null;
        } else {
          if (col !== videoSortCol) {
            videoSortCol = col;
            videoSortDir = "asc";
          } else {
            videoSortDir = videoSortDir === null ? "asc" : videoSortDir === "asc" ? "desc" : null;
            if (videoSortDir === null) videoSortCol = null;
          }
        }
        await renderManager(overlay);
        return;
      }

      const target = event.target.closest("button");
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();

      if (target.classList.contains("yds-close")) { overlay.hidden = true; stopRefresh(); await saveOverlayState({ visible: false }); return; }
      if (target.classList.contains("yds-collapse")) {
        overlay.classList.add("collapsed");
        await closeManager(overlay);
        await saveOverlayState({ collapsed: true });
        return;
      }
      if (target.classList.contains("yds-expand")) {
        overlay.classList.remove("collapsed");
        await saveOverlayState({ collapsed: false });
        await refreshManagerIfOpen(overlay);
        return;
      }
      if (target.classList.contains("yds-theme")) { await toggleTheme(); return; }
      if (target.classList.contains("yds-power")) { await setEnabled(!enabled); return; }
      if (target.classList.contains("yds-play")) { await sendCommand("YT_YOUDIVERSIFY_PLAY_PAUSE"); return; }
      if (target.classList.contains("yds-up")) { await sendCommand("YT_YOUDIVERSIFY_UPVOTE", {}, "Upvoting..."); return; }
      if (target.classList.contains("yds-down")) { await sendCommand("YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP", {}, "Skipping, please wait..."); return; }
      if (target.classList.contains("yds-channel")) { await sendCommand("YT_YOUDIVERSIFY_SKIP_CHANNEL", {}, "Blocking channel and skipping..."); return; }
      if (target.classList.contains("yds-next-untracked")) { await sendCommand("YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED", {}, "Skipping without tracking..."); return; }
      if (target.classList.contains("yds-next")) { await sendCommand("YT_YOUDIVERSIFY_SKIP_NEXT", {}, "Skipping, please wait..."); return; }
      if (target.classList.contains("yds-manager-export")) { await exportManagerList(); setStatus("List saved."); return; }
      if (target.classList.contains("yds-manager-import")) { overlay.querySelector(".yds-manager-file")?.click(); return; }
      if (target.classList.contains("yds-manager-reset")) {
        if (confirm("Clear the whole management list?")) {
          await saveVisitedEntries([]);
          await saveBlockedChannels([]);
          await renderManager(overlay);
          setStatus("Management list cleared.");
        }
        return;
      }
      if (target.classList.contains("yds-volume-toggle")) {
        toggleVolumePanel(overlay, target);
        return;
      }
      if (target.classList.contains("yds-mode-playlist")) {
        await safeStorageSet({ [PLAYLIST_MODE_KEY]: true });
        overlay.querySelectorAll(".yds-mode-tab").forEach(t => t.classList.remove("active"));
        target.classList.add("active");
        overlay.querySelector(".yds-mode-manager")?.classList.remove("active");
        await renderManager(overlay);
        setStatus("Playlist mode.");
        return;
      }
      if (target.classList.contains("yds-mode-manager")) {
        await safeStorageSet({ [PLAYLIST_MODE_KEY]: false });
        overlay.querySelectorAll(".yds-mode-tab").forEach(t => t.classList.remove("active"));
        target.classList.add("active");
        overlay.querySelector(".yds-mode-playlist")?.classList.remove("active");
        await renderManager(overlay);
        setStatus("Manager mode.");
        return;
      }
      if (target.classList.contains("yds-playlist-shuffle")) {
        const current = await getPlaylistShuffle();
        await safeStorageSet({ [PLAYLIST_SHUFFLE_KEY]: !current });
        target.classList.toggle("active", !current);
        return;
      }
      if (target.classList.contains("yds-playlist-repeat")) {
        const current = await getPlaylistRepeat();
        await safeStorageSet({ [PLAYLIST_REPEAT_KEY]: !current });
        target.classList.toggle("active", !current);
        return;
      }
      if (target.classList.contains("yds-reset")) {
        const manager = overlay.querySelector(".yds-manager");
        const open = manager?.hidden !== false;
        if (open) await openManager(overlay);
        else await closeManager(overlay);
        setStatus(open ? "Management window open." : "Management window closed.");
        return;
      }
      if (target.classList.contains("yds-entry-remove")) {
        const row = target.closest(".yds-manager-row[data-video-id]");
        const videoId = row?.dataset?.videoId;
        if (videoId) {
          await removeManagerEntry(videoId);
          await renderManager(overlay);
          setStatus("Video removed from list.");
          return;
        }
      }
      if (target.classList.contains("yds-unblock-channel")) {
        const row = target.closest("[data-channel-id]");
        const channelId = row?.dataset?.channelId || "";
        const channelName = row?.dataset?.channelName || "";
        await unblockChannel(channelId, channelName);
        await renderManager(overlay);
        setStatus("Channel unblocked.");
        return;
      }
    }, true);

    overlay.querySelectorAll(".yds-slider").forEach(slider => {
      slider.addEventListener("input", (event) => {
        sliderDragging = true;
        const duration = Number(lastState?.duration || 0);
        overlay.querySelector(".yds-current").textContent = formatTime((Number(event.target.value) / 1000) * duration);
      });
      slider.addEventListener("change", async (event) => {
        sliderDragging = false;
        await sendCommand("YT_YOUDIVERSIFY_SEEK_TO_PERCENT", { percent: Number(event.target.value) / 10 });
      });
    });

    overlay.querySelector(".yds-volume-slider")?.addEventListener("input", async (event) => {
      const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
      const label = overlay.querySelector(".yds-volume-label");
      if (label) label.textContent = `${Math.round(value)}%`;
      await sendCommand("YT_YOUDIVERSIFY_SET_VOLUME", { volume: value / 100 }, "");
    });

    overlay.querySelector(".yds-manager-file")?.addEventListener("change", async (event) => {
      try {
        await importManagerList(event.target.files?.[0], overlay);
        setStatus("List imported.");
      } catch (error) {
        setStatus(error?.message || "Could not import list.");
      } finally {
        event.target.value = "";
      }
    });

    overlay.querySelector(".yds-manager")?.addEventListener("change", async (event) => {
      const target = event.target;
      if (!target) return;

      if (target.classList.contains("yds-playlist-upvoted")) {
        await safeStorageSet({ [PLAYLIST_INCLUDE_UPVOTED_KEY]: target.checked });
        await renderManager(overlay);
        return;
      }
      if (target.classList.contains("yds-playlist-neutral")) {
        await safeStorageSet({ [PLAYLIST_INCLUDE_NEUTRAL_KEY]: target.checked });
        await renderManager(overlay);
        return;
      }

      const row = target.closest(".yds-manager-row[data-video-id]");
      const videoId = row?.dataset?.videoId;
      if (!videoId) return;

    });

    overlay.querySelector(".yds-manager")?.addEventListener("click", async (event) => {
      const channelEl = event.target.closest?.(".yds-channel-name");
      if (channelEl) {
        const blockedGrid = overlay.querySelector(".yds-manager-blocked-grid");
        if (blockedGrid) {
          const channelId = channelEl.dataset.channelId;
          const channelName = channelEl.dataset.channelName;
          const blockedRow = Array.from(blockedGrid.querySelectorAll(".yds-blocked-row")).find(r =>
            channelId ? r.dataset.channelId === channelId : r.dataset.channelName === channelName
          );
          if (blockedRow) {
            overlay.querySelectorAll(".yds-channel-name.highlighted").forEach(el => el.classList.remove("highlighted"));
            overlay.querySelectorAll(".yds-blocked-row.highlighted").forEach(el => el.classList.remove("highlighted"));
            channelEl.classList.add("highlighted");
            blockedRow.classList.add("highlighted");
            blockedRow.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }
        return;
      }

      const title = event.target.closest?.(".yds-video-name");
      if (!title) return;
      event.preventDefault();
      event.stopPropagation();

      const row = title.closest(".yds-manager-row[data-video-url]");
      const url = normalizeYoutubeWatchUrl(row?.dataset?.videoUrl, row?.dataset?.videoId);
      if (!url) {
        setStatus("Could not open video.");
        return;
      }

      const response = await safeSendMessage({ type: "YT_YOUDIVERSIFY_OPEN_VIDEO", url }, { ok: false });
      if (response?.ok) {
        setStatus("Opening video.");
      } else if (location.hostname === "www.youtube.com") {
        await markForcePlayOnce(url);
        window.location.href = url;
      } else {
        setStatus(response?.error || "Open a YouTube video tab first.");
      }
    });

    const closeOnOutsidePointer = (event) => {
      const target = event.target;
      if (!overlay.hidden && !eventHitAppWindow(event, overlay)) {
        hideOverlay().catch(() => null);
        return;
      }
      const clickedVolumeControl = target.closest?.(".yds-volume-toggle") || target.closest?.(".yds-volume-panel");
      if (!clickedVolumeControl) hideVolumePanel(overlay);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    window.addEventListener("blur", () => {
      if (!overlay.hidden) hideOverlay().catch(() => null);
    });

    const startDrag = (event) => {
      if (event.target.closest("button") || event.target.closest("input")) return;
      const rect = overlay.getBoundingClientRect();
      drag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, pointerId: event.pointerId };
      overlay.setPointerCapture(event.pointerId);
    };
    overlay.querySelector(".yds-head")?.addEventListener("pointerdown", startDrag);
    overlay.querySelector(".yds-mini")?.addEventListener("pointerdown", startDrag);

    const manager = overlay.querySelector(".yds-manager");
    manager?.querySelector(".yds-manager-bar")?.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button") || event.target.closest("input")) return;
      const rect = manager.getBoundingClientRect();
      managerDrag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, pointerId: event.pointerId };
      manager.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    manager?.querySelector(".yds-manager-resize")?.addEventListener("pointerdown", (event) => {
      const rect = manager.getBoundingClientRect();
      managerResize = { startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, pointerId: event.pointerId };
      manager.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    overlay.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const pos = clampPlayerPositionForSnap(
        overlay,
        drag.left + event.clientX - drag.startX,
        drag.top + event.clientY - drag.startY
      );
      overlay.style.left = `${pos.left}px`;
      overlay.style.top = `${pos.top}px`;
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      moveSnappedManager(overlay);
    });

    document.addEventListener("pointermove", (event) => {
      if (managerDrag) {
        setManagerPosition(manager, managerDrag.left + event.clientX - managerDrag.startX, managerDrag.top + event.clientY - managerDrag.startY);
        maybeSnapManagerToPlayer(manager, overlay);
      } else if (managerResize) {
        const rect = manager.getBoundingClientRect();
        const width = Math.max(480, Math.min(window.innerWidth - rect.left - 8, managerResize.width + event.clientX - managerResize.startX));
        const height = Math.max(170, Math.min(window.innerHeight - rect.top - 8, managerResize.height + event.clientY - managerResize.startY));
        manager.style.width = `${width}px`;
        manager.style.height = `${height}px`;
        manager.style.right = "auto";
        manager.style.bottom = "auto";
        manager.style.maxHeight = "none";
        maybeSnapManagerToPlayer(manager, overlay);
      }
    });

    overlay.addEventListener("pointerup", async () => {
      if (!drag) return;
      drag = null;
      const rect = overlay.getBoundingClientRect();
      const manager = overlay.querySelector(".yds-manager");
      const managerRect = manager?.getBoundingClientRect();
      await saveOverlayState({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        ...(manager && managerRect && managerSnap ? {
          managerX: Math.round(managerRect.left),
          managerY: Math.round(managerRect.top),
          managerSnapped: true,
          managerSnapX: Math.round(managerSnap.x),
          managerSnapY: Math.round(managerSnap.y)
        } : {})
      });
    });

    document.addEventListener("pointerup", async () => {
      if (!managerDrag && !managerResize) return;
      managerDrag = null;
      managerResize = null;
      const rect = manager.getBoundingClientRect();
      await saveOverlayState({
        managerX: Math.round(rect.left),
        managerY: Math.round(rect.top),
        managerWidth: Math.round(rect.width),
        managerHeight: Math.round(rect.height),
        managerSnapped: !!managerSnap,
        managerSnapX: managerSnap ? Math.round(managerSnap.x) : null,
        managerSnapY: managerSnap ? Math.round(managerSnap.y) : null
      });
    });
  }

  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(refreshState, 1000);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  async function showOverlay() {
    enabled = await getEnabled();
    const overlay = await createOverlay();
    overlay.hidden = false;
    await refreshTheme(overlay);
    await saveOverlayState({ visible: true });
    await applyStoredState(overlay);
    updatePowerButtons();
    await refreshState();
    await refreshManagerIfOpen(overlay);
    startRefresh();
    return { ok: true, visible: true };
  }


  async function hideOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = true;
    stopRefresh();
    await saveOverlayState({ visible: false });
    return { ok: true, visible: false };
  }

  async function toggleOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay && !overlay.hidden) {
      overlay.hidden = true;
      stopRefresh();
      await saveOverlayState({ visible: false });
      return { ok: true, visible: false };
    }
    return await showOverlay();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message?.type === "YT_YOUDIVERSIFY_GLOBAL_PING") return { ok: true };
      if (message?.type === "YT_YOUDIVERSIFY_GLOBAL_TOGGLE_OVERLAY") return await toggleOverlay();
      if (message?.type === "YT_YOUDIVERSIFY_GLOBAL_SHOW_OVERLAY") return await showOverlay();
      if (message?.type === "YT_YOUDIVERSIFY_GLOBAL_HIDE_OVERLAY") return await hideOverlay();
      return undefined;
    })().then((response) => {
      if (response !== undefined) sendResponse(response);
    }).catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
    return true;
  });
})();
