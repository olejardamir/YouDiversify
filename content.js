(() => {
  const VISITED_KEY = "yt_youdiversify_visited";
  const ENABLED_KEY = "yt_youdiversify_enabled";
  const OVERLAY_STATE_KEY = "yt_youdiversify_overlay_state";
  const FORCE_PLAY_ONCE_KEY = "yt_youdiversify_force_play_once";
  const UNTRACKED_SKIP_ONCE_KEY = "yt_youdiversify_untracked_skip_once";
  const BLOCKED_CHANNELS_KEY = "yt_youdiversify_blocked_channels";
  const PLAYLIST_MODE_KEY = "yt_youdiversify_playlist_mode";
  const PLAYLIST_INCLUDE_UPVOTED_KEY = "yt_youdiversify_playlist_include_upvoted";
  const PLAYLIST_INCLUDE_NEUTRAL_KEY = "yt_youdiversify_playlist_include_neutral";
  const PLAYLIST_SHUFFLE_KEY = "yt_youdiversify_playlist_shuffle";
  const PLAYLIST_REPEAT_KEY = "yt_youdiversify_playlist_repeat";
  const FORCE_PLAY_ONCE_MAX_AGE_MS = 2 * 60 * 1000;

  let enabled = true;
  let skipInProgress = false;
  let attachedVideo = null;
  let controlsObserver = null;
  let lastUrl = location.href;
  let controlDetectionActive = false;
  let startupPauseToken = 0;
  let trackingSuppressedVideoId = "";
  let rightPanelBlockObserver = null;
  let rightPanelBlockTimer = null;
  let rightPanelBlockRunning = false;
  let rightPanelBlockDone = false;
  let rightPanelBlockScheduled = false;
  let rightPanelLastVideoId = "";
  const rightPanelBlockAttempts = new Map();

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function ensureSquarePlayerStyles() {
    let style = document.getElementById("yt-youdiversify-square-player-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "yt-youdiversify-square-player-style";
      document.documentElement.appendChild(style);
    }

    style.textContent = `
      ytd-watch-flexy {
        --ytd-watch-flexy-player-border-radius: 0 !important;
        --ytd-watch-flexy-player-rounded-border-radius: 0 !important;
      }
      ytd-watch-flexy[rounded-player],
      ytd-watch-flexy[rounded-player-large],
      ytd-player,
      #ytd-player,
      #player,
      #player-container,
      #player-container-outer,
      #player-theater-container,
      #movie_player,
      .html5-video-player,
      .html5-video-container,
      video.html5-main-video {
        border-radius: 0 !important;
      }
    `;
  }

  function isWatchPage() {
    return location.hostname === "www.youtube.com" &&
      location.pathname === "/watch" &&
      new URLSearchParams(location.search).has("v");
  }

  function getVideoIdFromUrl(url = location.href) {
    try {
      return new URL(url, location.origin).searchParams.get("v");
    } catch {
      return null;
    }
  }

  async function getEnabled() {
    const result = await chrome.storage.local.get(ENABLED_KEY);
    return result[ENABLED_KEY] !== false;
  }

  function asString(value) {
    return typeof value === "string" ? value : "";
  }

  async function getVisitedEntries() {
    const result = await chrome.storage.local.get(VISITED_KEY);
    const raw = Array.isArray(result[VISITED_KEY]) ? result[VISITED_KEY] : [];
    const normalized = raw.map(item => {
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
    }).filter(item => item.videoId);
    return dedupeVisitedEntries(normalized);
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

  async function getVisited() {
    return new Set((await getVisitedEntries()).map(item => item.videoId));
  }

  async function getCurrentVideoEntry(videoId = getVideoIdFromUrl()) {
    if (!videoId) return null;
    return (await getVisitedEntries()).find(item => item.videoId === videoId) || null;
  }

  async function saveVisited(videoId, title = "", url = "", metadata = {}) {
    if (!videoId) return;
    videoId = videoId.trim();
    let entries = await getVisitedEntries();
    const matchById = entries.find(item => item.videoId === videoId);
    const channelName = metadata.channelName || matchById?.channelName || "";
    const matchByName = title && channelName ? entries.find(item => item.videoId !== videoId && item.title === title && item.channelName === channelName) : null;
    const existing = matchByName || matchById;
    const targetId = existing?.videoId || videoId;
    const now = Date.now();
    const nextEntry = {
      videoId: targetId,
      title: title || existing?.title || "",
      url: url || existing?.url || existing?.href || "",
      href: url || existing?.href || existing?.url || "",
      upvoted: typeof metadata.upvoted === "boolean" ? metadata.upvoted : existing?.upvoted ?? null,
      downvoted: typeof metadata.downvoted === "boolean" ? metadata.downvoted : existing?.downvoted ?? null,
      userPressedNext: metadata.userPressedNext === true || existing?.userPressedNext === true,
      channelId: metadata.channelId || existing?.channelId || "",
      channelName: metadata.channelName || existing?.channelName || "",
      addedAt: existing?.addedAt || now,
      updatedAt: now,
      lastAccessedAt: metadata.lastAccessedAt || now
    };
    entries = entries.filter(item => item.videoId !== targetId);
    entries.push(nextEntry);
    const deduped = dedupeVisitedEntries(entries).slice(-1000);
    await chrome.storage.local.set({ [VISITED_KEY]: deduped });
  }

  async function removeVisitedVideos(videoIds = []) {
    const ids = new Set(videoIds.filter(Boolean));
    if (!ids.size) return;
    const entries = await getVisitedEntries();
    await chrome.storage.local.set({ [VISITED_KEY]: dedupeVisitedEntries(entries.filter(item => !ids.has(item.videoId))) });
  }

  async function saveCurrentVideoMetadata(metadata = {}) {
    const videoId = getVideoIdFromUrl();
    if (!videoId) return;
    if (videoId === trackingSuppressedVideoId) {
      await removeVisitedVideos([videoId]);
      return;
    }

    const entries = await getVisitedEntries();
    const existing = entries.find(item => item.videoId === videoId);

    const nextMetadata = { ...metadata };
    const likeState = getLikeButtonState();
    const dislikeState = getDislikeButtonState();

    if (typeof nextMetadata.upvoted !== "boolean") {
      if (likeState?.ready) {
        nextMetadata.upvoted = likeState.liked;
      } else if (existing?.upvoted != null) {
        nextMetadata.upvoted = existing.upvoted;
      }
    }
    if (typeof nextMetadata.downvoted !== "boolean") {
      if (dislikeState?.ready) {
        nextMetadata.downvoted = dislikeState.downvoted;
      } else if (existing?.downvoted != null) {
        nextMetadata.downvoted = existing.downvoted;
      }
    }

    const channelInfo = getChannelInfo();
    if (channelInfo) {
      nextMetadata.channelId = channelInfo.channelId || nextMetadata.channelId || "";
      nextMetadata.channelName = channelInfo.channelName || nextMetadata.channelName || "";
    }

    await saveVisited(videoId, getVideoTitle(), location.href, nextMetadata);
  }

  async function resetVisited() {
    await chrome.storage.local.set({ [VISITED_KEY]: [], [BLOCKED_CHANNELS_KEY]: [] });
    return { ok: true, skipped: true };
  }

  async function consumeForcePlayOnce(videoId = getVideoIdFromUrl()) {
    if (!videoId) return false;

    try {
      const result = await chrome.storage.local.get(FORCE_PLAY_ONCE_KEY);
      const force = result[FORCE_PLAY_ONCE_KEY];
      if (!force) return false;

      const expired = Date.now() - Number(force.createdAt || 0) > FORCE_PLAY_ONCE_MAX_AGE_MS;
      const matches = force.videoId === videoId;
      if (expired || matches) {
        await chrome.storage.local.remove(FORCE_PLAY_ONCE_KEY);
      }

      return matches && !expired;
    } catch {
      return false;
    }
  }

  async function consumeUntrackedSkipOnce(videoId = getVideoIdFromUrl()) {
    if (!videoId) return false;

    try {
      const result = await chrome.storage.local.get(UNTRACKED_SKIP_ONCE_KEY);
      const marker = result[UNTRACKED_SKIP_ONCE_KEY];
      if (!marker) return false;

      const expired = Date.now() - Number(marker.createdAt || 0) > FORCE_PLAY_ONCE_MAX_AGE_MS;
      const matches = marker.videoId === videoId;
      if (expired || matches) {
        await chrome.storage.local.remove(UNTRACKED_SKIP_ONCE_KEY);
      }

      return matches && !expired;
    } catch {
      return false;
    }
  }

  function getChannelInfo() {
    const nameEl = document.querySelector("#owner yt-formatted-string.ytd-channel-name a") ||
      document.querySelector("#owner .ytd-channel-name a") ||
      document.querySelector("#channel-name yt-formatted-string");
    const channelName = nameEl?.textContent?.trim() || "";
    const channelLink = document.querySelector("#owner a[href*='/channel/']") ||
      document.querySelector("#owner a[href*='/@']");
    const href = channelLink?.getAttribute("href") || "";
    let channelId = "";
    const idMatch = href.match(/\/channel\/(UC[\w-]{22})/);
    if (idMatch) { channelId = idMatch[1]; }
    return channelId || channelName ? { channelId, channelName } : null;
  }

  function normalizeBlockedChannel(item) {
    return {
      channelId: typeof item?.channelId === "string" ? item.channelId : "",
      channelName: typeof item?.channelName === "string" ? item.channelName : "",
      blockedAt: Number(item?.blockedAt || Date.now())
    };
  }

  async function getBlockedChannels() {
    const result = await chrome.storage.local.get(BLOCKED_CHANNELS_KEY);
    return (Array.isArray(result[BLOCKED_CHANNELS_KEY]) ? result[BLOCKED_CHANNELS_KEY] : []).map(normalizeBlockedChannel).filter(c => c.channelId || c.channelName);
  }

  async function saveBlockedChannels(list) {
    await chrome.storage.local.set({ [BLOCKED_CHANNELS_KEY]: list });
  }

  async function blockChannel(channelId, channelName) {
    const list = await getBlockedChannels();
    const normalizedName = normalizeChannelText(channelName);
    if (channelId && list.some(c => c.channelId === channelId)) return;
    if (normalizedName && list.some(c => normalizeChannelText(c.channelName) === normalizedName)) return;
    list.push({ channelId, channelName, blockedAt: Date.now() });
    await saveBlockedChannels(list);
  }

  async function unblockChannel(channelId, channelName) {
    const list = await getBlockedChannels();
    const normalizedName = normalizeChannelText(channelName);
    await saveBlockedChannels(list.filter(c => {
      if (channelId && c.channelId === channelId) return false;
      if (normalizedName && normalizeChannelText(c.channelName) === normalizedName) return false;
      return true;
    }));
  }

  async function isChannelBlocked(channelId, channelName) {
    const list = await getBlockedChannels();
    const normalizedName = normalizeChannelText(channelName);
    return list.some(c =>
      (channelId && c.channelId === channelId) ||
      (normalizedName && normalizeChannelText(c.channelName) === normalizedName)
    );
  }

  async function getPlaylistMode() {
    const result = await chrome.storage.local.get(PLAYLIST_MODE_KEY);
    return result[PLAYLIST_MODE_KEY] === true;
  }

  async function getPlaylistIncludeUpvoted() {
    const result = await chrome.storage.local.get(PLAYLIST_INCLUDE_UPVOTED_KEY);
    return result[PLAYLIST_INCLUDE_UPVOTED_KEY] !== false;
  }

  async function getPlaylistIncludeNeutral() {
    const result = await chrome.storage.local.get(PLAYLIST_INCLUDE_NEUTRAL_KEY);
    return result[PLAYLIST_INCLUDE_NEUTRAL_KEY] !== false;
  }

  async function getPlaylistShuffle() {
    const result = await chrome.storage.local.get(PLAYLIST_SHUFFLE_KEY);
    return result[PLAYLIST_SHUFFLE_KEY] === true;
  }

  async function getPlaylistRepeat() {
    const result = await chrome.storage.local.get(PLAYLIST_REPEAT_KEY);
    return result[PLAYLIST_REPEAT_KEY] === true;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  function normalizedSimilarity(a, b) {
    const da = a.toLowerCase().trim();
    const db = b.toLowerCase().trim();
    if (!da && !db) return 0;
    if (!da || !db) return 0;
    const dist = levenshtein(da, db);
    const maxLen = Math.max(da.length, db.length);
    return 1 - dist / maxLen;
  }

  function getDuplicateTitlePenalty(entry, allEntries) {
    const clean = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const title = clean(entry.title);
    if (title.length <= 5) return 0;
    for (const other of allEntries) {
      if (other.videoId === entry.videoId) continue;
      const otherTitle = clean(other.title);
      if (otherTitle.length <= 5) continue;
      if (title.includes(otherTitle) || otherTitle.includes(title)) {
        return 0.5;
      }
    }
    return 0;
  }

  async function getPlaylistNextVideo(currentVideoId) {
    const entries = await getVisitedEntries();
    const [includeUpvoted, includeNeutral, shuffle, repeat, blocked] = await Promise.all([
      getPlaylistIncludeUpvoted(), getPlaylistIncludeNeutral(), getPlaylistShuffle(), getPlaylistRepeat(), getBlockedChannels()
    ]);
    const currentChannel = getChannelInfo();

    const blockedChannelIds = new Set(blocked.map(c => c.channelId).filter(Boolean));
    const blockedChannelNames = new Set(blocked.map(c => normalizeChannelText(c.channelName)).filter(Boolean));

    let playlist = entries.filter(e => {
      if (e.downvoted) return false;
      if (e.upvoted) return includeUpvoted;
      return includeNeutral;
    }).filter(e => {
      const id = e.channelId || "";
      const name = normalizeChannelText(e.channelName);
      if (id && blockedChannelIds.has(id)) return false;
      if (name && blockedChannelNames.has(name)) return false;
      if (isSameChannel(currentChannel, e)) return false;
      return true;
    });

    if (!playlist.length) return null;

    if (shuffle) {
      const recentHundred = entries.slice(-100);
      const refs = [];
      for (const e of recentHundred) {
        if (e.channelName) refs.push(e.channelName);
        if (e.title) refs.push(e.title);
      }
      const recentEntries = entries.slice(-500);
      const scored = playlist.map(e => {
        const title = e.title || "";
        const channel = e.channelName || "";
        let score = 0;
        if (refs.length > 0) {
          score = Math.max(...refs.map(r => Math.max(normalizedSimilarity(title, r), normalizedSimilarity(channel, r))));
        }
        const dupPenalty = getDuplicateTitlePenalty(e, recentEntries);
        return { entry: e, score: Math.max(score, dupPenalty) };
      });
      scored.sort((a, b) => a.score - b.score);
      const topN = Math.max(2, Math.ceil(scored.length / 3));
      const pick = scored.slice(0, topN)[Math.floor(Math.random() * Math.min(topN, scored.length))];
      return pick.entry;
    }

    const idx = playlist.findIndex(e => e.videoId === currentVideoId);
    if (idx === -1) return playlist[0];
    if (idx < playlist.length - 1) return playlist[idx + 1];
    if (repeat) return playlist[0];
    return null;
  }

  function getVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }


  function getVideoTitle() {
    return document.querySelector("h1 yt-formatted-string")?.textContent?.trim() ||
      document.querySelector("h1")?.textContent?.trim() ||
      document.title.replace(/ - YouTube$/, "").trim();
  }

  async function togglePlayPause() {
    const video = getVideo();
    if (!video) return { ok: false, error: "Video element is not available yet." };

    if (video.paused) {
      try {
        await video.play();
      } catch {
        return { ok: false, error: "Chrome blocked play. Click the video once, then try again." };
      }
    } else {
      video.pause();
    }

    return {
      ok: true,
      paused: video.paused,
      playing: !video.paused,
      title: getVideoTitle()
    };
  }


  function getPlaybackStatus() {
    const video = getVideo();
    const currentTime = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    return {
      currentTime,
      duration,
      percent: duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0
    };
  }

  async function seekVideoToPercent(percent) {
    const video = getVideo();
    if (!video) return { ok: false, error: "Video element is not available yet." };
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return { ok: false, error: "Video duration is not available yet." };
    }

    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    video.currentTime = (safePercent / 100) * video.duration;
    return { ok: true, ...getPlaybackStatus(), paused: video.paused, playing: !video.paused, title: getVideoTitle() };
  }

  async function seekVideoBySeconds(deltaSeconds) {
    const video = getVideo();
    if (!video) return { ok: false, error: "Video element is not available yet." };
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    const nextTime = Math.max(0, Math.min(duration, video.currentTime + Number(deltaSeconds || 0)));
    video.currentTime = nextTime;
    return { ok: true, ...getPlaybackStatus(), paused: video.paused, playing: !video.paused, title: getVideoTitle() };
  }

  async function setVideoVolume(volume) {
    const video = getVideo();
    if (!video) return { ok: false, error: "Video element is not available yet." };
    const safeVolume = Math.max(0, Math.min(1, Number(volume)));
    video.volume = Number.isFinite(safeVolume) ? safeVolume : 1;
    video.muted = video.volume === 0;
    return {
      ok: true,
      volume: video.volume,
      muted: video.muted,
      paused: video.paused,
      playing: !video.paused,
      title: getVideoTitle(),
      ...getPlaybackStatus()
    };
  }

  function findDislikeButton() {
    return document.querySelector("dislike-button-view-model button") ||
      document.querySelector("segmented-like-dislike-button-view-model dislike-button-view-model button") ||
      document.querySelector("#segmented-dislike-button button") ||
      document.querySelector("button[aria-label*='Dislike' i][aria-pressed]") ||
      document.querySelector("button[title*='Dislike' i][aria-pressed]") ||
      Array.from(document.querySelectorAll("button[aria-label]")).find(button => {
        const label = button.getAttribute("aria-label") || "";
        return /dislike this video/i.test(label);
      }) || null;
  }

  function findLikeButton() {
    return document.querySelector("like-button-view-model button[aria-label*='like this video' i]") ||
      document.querySelector("segmented-like-dislike-button-view-model like-button-view-model button") ||
      document.querySelector("#segmented-like-button button") ||
      Array.from(document.querySelectorAll("button[aria-label]")).find(button => {
        const label = button.getAttribute("aria-label") || "";
        return /^like this video/i.test(label);
      }) || null;
  }

  function isCurrentVideoDownvoted() {
    return getDislikeButtonState()?.downvoted === true;
  }

  function isCurrentVideoLiked() {
    return getLikeButtonState()?.liked === true;
  }

  function injectInlineControls(retry = 0) {
    if (document.getElementById("yt-yd-inline-controls")) return;
    const segmented = document.querySelector("segmented-like-dislike-button-view-model");
    if (!segmented) {
      if (retry < 20) setTimeout(() => injectInlineControls(retry + 1), 200);
      return;
    }
    const wrapper = segmented.querySelector(".ytSegmentedLikeDislikeButtonViewModelSegmentedButtonsWrapper");
    if (!wrapper) {
      if (retry < 20) setTimeout(() => injectInlineControls(retry + 1), 200);
      return;
    }

    const container = document.createElement("div");
    container.id = "yt-yd-inline-controls";
    container.style.cssText = "display:flex;gap:4px;margin-left:8px;align-items:center;";

    const makeBtn = (title, icon, cls, handler) => {
      const btn = document.createElement("button");
      btn.className = `yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-button ${cls}`;
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-disabled", "false");
      btn.textContent = icon;
      btn.style.fontSize = "16px";
      btn.style.lineHeight = "1";
      btn.style.minWidth = "36px";
      btn.style.height = "36px";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      if (cls.includes("yd-inline-next")) {
        btn.style.fontSize = "20px";
        btn.style.marginTop = "3px";
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        handler();
      });
      return btn;
    };

    const ICONS = {
      next: '⏭',
      untracked: '❓',
      channel: '🚫',
    };

    const sendCommand = (type) => chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_RELAY", command: { type } });

    const btnNext = makeBtn("Skip next", ICONS.next, "yd-inline-next", () => sendCommand("YT_YOUDIVERSIFY_SKIP_NEXT"));
    const btnUntracked = makeBtn("Skip next without tracking", ICONS.untracked, "yd-inline-untracked", () => sendCommand("YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED"));
    const btnChannel = makeBtn("Block channel and skip", ICONS.channel, "yd-inline-channel", () => sendCommand("YT_YOUDIVERSIFY_SKIP_CHANNEL"));

    container.append(btnNext, btnUntracked, btnChannel);
    wrapper.appendChild(container);

    new MutationObserver(() => {
      if (!document.querySelector("segmented-like-dislike-button-view-model")) {
        container.remove();
      }
    }).observe(wrapper, { childList: true, subtree: true });
  }

  function getLikeButtonState() {
    const button = findLikeButton();
    if (!button) return null;

    const stateCandidates = [
      button,
      button.closest("like-button-view-model"),
      button.closest("#segmented-like-button"),
      button.closest("ytd-toggle-button-renderer"),
      button.closest("yt-button-view-model")
    ].filter(Boolean);

    const stateElement = stateCandidates.find(element => {
      const value = element?.getAttribute?.("aria-pressed");
      return value === "true" || value === "false";
    });

    const ariaPressed = stateElement?.getAttribute("aria-pressed");
    if (ariaPressed === "true") return { button, ready: true, liked: true };
    if (ariaPressed === "false") return { button, ready: true, liked: false };

    const textState = stateCandidates.map(element => [
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
      element.textContent
    ].filter(Boolean).join(" ")).join(" ").toLowerCase();

    if (/\b(remove|undo)\s+like\b|\bliked\b/.test(textState)) {
      return { button, ready: true, liked: true };
    }

    if (/\blike\b/.test(textState)) {
      return { button, ready: true, liked: false };
    }

    return { button, ready: false, liked: false };
  }

  function getDislikeButtonState(clickedButton) {
    const button = clickedButton || findDislikeButton();
    if (!button) return null;

    const stateCandidates = [
      button,
      button.closest("dislike-button-view-model"),
      button.closest("#segmented-dislike-button"),
      button.closest("ytd-toggle-button-renderer"),
      button.closest("yt-button-view-model")
    ].filter(Boolean);


    const stateElement = stateCandidates.find(element => {
      const value = element?.getAttribute?.("aria-pressed");
      return value === "true" || value === "false";
    });

    const ariaPressed = stateElement?.getAttribute("aria-pressed");

    if (ariaPressed === "true") return { button, ready: true, downvoted: true };
    if (ariaPressed === "false") return { button, ready: true, downvoted: false };

    const textState = stateCandidates.map(element => [
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
      element.textContent
    ].filter(Boolean).join(" ")).join(" ").toLowerCase();


    if (/\b(remove|undo)\s+dislike\b|\bdisliked\b/.test(textState)) {
      return { button, ready: true, downvoted: true };
    }

    if (/\bdislike\b/.test(textState)) {
      return { button, ready: true, downvoted: false };
    }

    return { button, ready: false, downvoted: false };
  }

  async function waitForDislikeButtonState(token, timeoutMs = 10000) {
    const started = Date.now();
    let lastDownvoted = null;
    let stableCount = 0;
    const requiredStableChecks = 3;

    while (enabled && isWatchPage() && token === startupPauseToken && Date.now() - started < timeoutMs) {
      pauseVideoIfPossible();

      const state = getDislikeButtonState();
      if (state?.ready) {
        if (state.downvoted === lastDownvoted) {
          stableCount++;
          if (stableCount >= requiredStableChecks) {
            return state;
          }
        } else {
          stableCount = 1;
          lastDownvoted = state.downvoted;
        }
      }

      await sleep(20);
    }

    if (lastDownvoted !== null) {
      return { ready: true, downvoted: lastDownvoted };
    }
    return null;
  }

  async function clickLikeButton() {
    const button = findLikeButton();
    if (!button) return { ok: false, error: "Like button is not available yet." };
    const before = getLikeButtonState()?.liked === true;
    button.click();

    let liked = before;
    const started = Date.now();
    while (Date.now() - started < 800) {
      await sleep(40);
      liked = getLikeButtonState()?.liked === true;
      if (liked !== before) break;
    }

    await saveCurrentVideoMetadata({ upvoted: liked, downvoted: liked ? false : undefined });
    return { ok: true, liked };
  }

  async function clickDislikeButton() {
    const state = getDislikeButtonState();
    if (!state?.button) return { ok: false, error: "Dislike button is not available yet." };
    if (!state.ready) return { ok: false, error: "Dislike button state is not available yet." };
    if (state.downvoted) {
      await saveCurrentVideoMetadata({ downvoted: true, upvoted: false });
      return { ok: true, downvoted: true };
    }
    state.button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    state.button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    state.button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    state.button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    state.button.click();
    await saveCurrentVideoMetadata({ downvoted: true, upvoted: false });
    return { ok: true, downvoted: true };
  }

  function getRecommendationItems() {
    return Array.from(document.querySelectorAll(
      "yt-lockup-view-model, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer"
    ));
  }

  function getRightPanel() {
    return document.querySelector("#secondary, ytd-watch-next-secondary-results-renderer");
  }

  function getRightPanelRecommendationItems() {
    const panel = getRightPanel();
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(
      "yt-lockup-view-model, ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer"
    ));
  }

  function getRightPanelScrollContainer() {
    const panel = getRightPanel();
    if (!panel) return null;
    const candidates = [panel, ...panel.querySelectorAll("#items, #contents, ytd-item-section-renderer")];
    return candidates.find(element => element.scrollHeight > element.clientHeight) || panel;
  }

  function captureRightPanelScrollPosition() {
    const container = getRightPanelScrollContainer();
    return {
      container,
      top: container?.scrollTop || 0,
      windowTop: window.scrollY
    };
  }

  function restoreRightPanelScrollPosition(position) {
    if (!position) return;
    if (position.container) position.container.scrollTop = position.top;
    window.scrollTo({ top: position.windowTop, behavior: "instant" });
  }

  function normalizeChannelText(text) {
    return (text || "").trim().replace(/^@/, "").replace(/\s+/g, " ").toLowerCase();
  }

  function isSameChannel(current, candidate) {
    if (!current || !candidate) return false;
    const currentId = current.channelId || "";
    const candidateId = candidate.channelId || "";
    if (currentId && candidateId && currentId === candidateId) return true;

    const currentName = normalizeChannelText(current.channelName);
    const candidateName = normalizeChannelText(candidate.channelName);
    return !!currentName && !!candidateName && currentName === candidateName;
  }

  function normalizeTitle(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTitleWords(title) {
    return normalizeTitle(title).split(" ").filter(w => w.length > 2);
  }

  function titlesAreSimilar(titleA, titleB, threshold = 0.6) {
    if (!titleA || !titleB) return false;
    const wordsA = new Set(getTitleWords(titleA));
    const wordsB = new Set(getTitleWords(titleB));
    if (wordsA.size === 0 || wordsB.size === 0) return false;
    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / union.size >= threshold;
  }

  function extractVideoData(item) {
    const titleLink = item.querySelector("a.ytLockupMetadataViewModelTitle[href*='/watch?v='], a#video-title[href*='/watch?v=']");
    const thumbnailLink = item.querySelector("a.ytLockupViewModelContentImage[href*='/watch?v='], a#thumbnail[href*='/watch?v=']");
    const link = titleLink || thumbnailLink;
    if (!link) return null;

    const href = new URL(link.getAttribute("href"), location.origin).href;
    const videoId = getVideoIdFromUrl(href);
    const title =
      item.querySelector("h3[title]")?.getAttribute("title")?.trim() ||
      titleLink?.textContent?.trim() ||
      item.querySelector("#video-title")?.textContent?.trim() ||
      "";

    const allLinks = item.querySelectorAll('a[href*="/channel/"], a[href*="/@"]');
    let channelId = "";
    let channelName = "";
    for (const link of allLinks) {
      const href = link.getAttribute("href") || "";
      const idMatch = href.match(/\/channel\/(UC[\w-]{22})/);
      if (idMatch) { channelId = idMatch[1]; }
      if (!channelName) channelName = link.textContent?.trim() || "";
    }
    if (!channelName) {
      channelName = item.querySelector('.ytContentMetadataViewModelMetadataRow .ytAttributedStringHost')?.textContent?.trim() || "";
    }
    if (!channelName) {
      const avatarLabel = item.querySelector('div[aria-label*="Go to channel"]')?.getAttribute("aria-label");
      if (avatarLabel) channelName = avatarLabel.replace(/^Go to channel /, "").trim();
    }
    if (!channelName) {
      channelName =
        item.querySelector('#channel-name a, yt-formatted-string#channel-name a, .ytd-channel-name a, .yt-lockup-metadata-view-model-wpti')?.textContent?.trim() ||
        item.querySelector('#text.ytd-channel-name a')?.textContent?.trim() ||
        item.querySelector('#metadata-line span.ytd-video-meta-block')?.textContent?.trim() ||
        "";
    }

    if (!videoId || !title) return null;
    return { videoId, title, href, channelId, channelName, link };
  }

  function isBlockedRecommendation(data, blocked) {
    if (!data) return false;
    const channelId = data.channelId || "";
    const channelName = normalizeChannelText(data.channelName);
    return blocked.some(channel => {
      if (channel.channelId && channel.channelId === channelId) return true;
      const blockedName = normalizeChannelText(channel.channelName);
      return !!blockedName && !!channelName && blockedName === channelName;
    });
  }

  function isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function clickElementLikeUser(element) {
    if (!element) return false;
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    element.click();
    return true;
  }

  function findRecommendationMenuButton(item) {
    const candidates = [
      ...item.querySelectorAll("ytd-menu-renderer button[aria-label*='Action menu' i]"),
      ...item.querySelectorAll("ytd-menu-renderer button[aria-label*='More actions' i]"),
      ...item.querySelectorAll("button[aria-label*='Action menu' i]"),
      ...item.querySelectorAll("button[aria-label*='More actions' i]"),
      ...item.querySelectorAll("ytd-menu-renderer yt-icon-button button"),
      ...item.querySelectorAll("ytd-menu-renderer button"),
      ...item.querySelectorAll("yt-icon-button button"),
      ...item.querySelectorAll("[role='button'][aria-label*='Action menu' i]"),
      ...item.querySelectorAll("[role='button'][aria-label*='More actions' i]"),
      ...item.querySelectorAll("yt-touch-feedback-shape .ytSpecTouchFeedbackShapeFill")
    ];
    return candidates.find(isElementVisible) || null;
  }

  function getOpenMenuContainers() {
    return Array.from(document.querySelectorAll(
      "ytd-popup-container, tp-yt-iron-dropdown, ytd-menu-popup-renderer, yt-sheet-view-model, ytd-menu-service-item-renderer"
    )).filter(isElementVisible);
  }

  function findOpenMenuAction(preferredText) {
    const normalizedPreferred = preferredText.toLowerCase().replace(/[’`]/g, "'");
    const containers = getOpenMenuContainers();
    const roots = containers.length ? containers : [document];
    const selectors = [
      "span.ytAttributedStringHost[role='text']",
      "ytd-menu-service-item-renderer",
      "tp-yt-paper-item",
      "yt-list-item-view-model",
      "[role='menuitem']",
      "button"
    ].join(",");

    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll(selectors)).filter(isElementVisible);
      const textNode = candidates.find(candidate =>
        candidate.textContent?.trim().toLowerCase().replace(/[’`]/g, "'") === normalizedPreferred
      );
      if (textNode) return textNode.closest("[role='menuitem'], ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model, button") || textNode;

      const looseNode = candidates.find(candidate =>
        candidate.textContent?.trim().toLowerCase().replace(/[’`]/g, "'").includes(normalizedPreferred)
      );
      if (looseNode) return looseNode.closest("[role='menuitem'], ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model, button") || looseNode;
    }

    return null;
  }

  async function clickOpenMenuAction() {
    for (let i = 0; i < 20; i++) {
      const dontRecommend = findOpenMenuAction("don't recommend channel");
      const notInterested = findOpenMenuAction("not interested");
      const action = dontRecommend || notInterested;
      if (action) {
        clickElementLikeUser(action);
        return true;
      }
      await sleep(50);
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  function hasRecentRightPanelAttempt(key, cooldownMs) {
    const attemptedAt = rightPanelBlockAttempts.get(key);
    return Number.isFinite(attemptedAt) && Date.now() - attemptedAt < cooldownMs;
  }

  async function blockVisibleRightPanelChannels() {
    if (rightPanelBlockRunning || !enabled || !isWatchPage()) return;

    const currentVideoId = getVideoIdFromUrl() || "";
    if (currentVideoId !== rightPanelLastVideoId) {
      rightPanelLastVideoId = currentVideoId;
      rightPanelBlockAttempts.clear();
      rightPanelBlockDone = false;
    }

    if (rightPanelBlockDone) return;

    const video = getVideo();
    if (!video || video.paused) return;

    rightPanelBlockRunning = true;
    try {
      const blocked = await getBlockedChannels();
      if (!blocked.length) return;

      for (const item of getRightPanelRecommendationItems()) {
        const data = extractVideoData(item);
        if (!isBlockedRecommendation(data, blocked)) continue;

        const attemptKey = data.videoId || `${data.channelId}:${normalizeChannelText(data.channelName)}:${data.title}`;
        if (hasRecentRightPanelAttempt(attemptKey, 30000)) continue;

        const menuButton = findRecommendationMenuButton(item);
        if (!menuButton) {
          rightPanelBlockAttempts.set(attemptKey, Date.now());
          continue;
        }

        const scrollPosition = captureRightPanelScrollPosition();
        clickElementLikeUser(menuButton);
        await sleep(150);
        const clickedAction = await clickOpenMenuAction();
        rightPanelBlockAttempts.set(attemptKey, Date.now());
        await sleep(250);
        restoreRightPanelScrollPosition(scrollPosition);
        if (clickedAction) rightPanelBlockDone = true;
        return;
      }
    } finally {
      rightPanelBlockRunning = false;
    }
  }

  function scheduleRightPanelBlockScan(delayMs = 300) {
    if (!enabled || !isWatchPage() || rightPanelBlockScheduled) return;
    rightPanelBlockScheduled = true;
    setTimeout(() => {
      rightPanelBlockScheduled = false;
      blockVisibleRightPanelChannels().catch(() => null);
    }, delayMs);
  }

  function observeRightPanelForBlockedChannels() {
    if (rightPanelBlockObserver) rightPanelBlockObserver.disconnect();
    if (rightPanelBlockTimer) clearInterval(rightPanelBlockTimer);

    rightPanelBlockObserver = new MutationObserver(scheduleRightPanelBlockScan);
    rightPanelBlockObserver.observe(document.documentElement, { childList: true, subtree: true });
    rightPanelBlockTimer = setInterval(scheduleRightPanelBlockScan, 3500);
    scheduleRightPanelBlockScan();
  }

  function isMixVideo(video) {
    return video.title.trim().toLowerCase().startsWith("mix - ");
  }

  async function findNextPlayableVideo() {
    const entries = await getVisitedEntries();
    const managedById = new Map(entries.map(item => [item.videoId, item]));
    const currentId = getVideoIdFromUrl();
    const currentChannel = getChannelInfo();
    const currentTitle = getVideoTitle();
    const blocked = await getBlockedChannels();
    const blockedChannelIds = new Set(blocked.map(c => c.channelId).filter(Boolean));
    const blockedChannelNames = new Set(blocked.map(c => normalizeChannelText(c.channelName)).filter(Boolean));

    for (const item of getRecommendationItems()) {
      const data = extractVideoData(item);
      if (!data) continue;
      if (data.videoId === currentId) continue;
      const existingEntry = managedById.get(data.videoId);
      if (existingEntry) continue;
      if (isMixVideo(data)) continue;
      if (currentTitle && titlesAreSimilar(currentTitle, data.title)) continue;
      const entry = managedById.get(data.videoId);
      const entryChannelId = data.channelId || entry?.channelId || "";
      const entryChannelName = normalizeChannelText(data.channelName || entry?.channelName || "");
      if (entryChannelId && blockedChannelIds.has(entryChannelId)) continue;
      if (entryChannelName && blockedChannelNames.has(entryChannelName)) continue;
      if (isSameChannel(currentChannel, data)) continue;
      return data;
    }

    return null;
  }

  async function waitForRecommendationCountToGrow(previousCount, timeoutMs = 4000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (getRecommendationItems().length > previousCount) return true;
      await sleep(100);
    }
    return false;
  }

  async function scrollForMoreRecommendations() {
    const before = getRecommendationItems().length;
    const secondary = document.querySelector("#secondary, ytd-watch-next-secondary-results-renderer");
    if (secondary) secondary.scrollTop = secondary.scrollHeight;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await waitForRecommendationCountToGrow(before, 4000);
  }

  async function requestScheduledGlobalOverlayRestore() {
    try {
      const result = await chrome.storage.local.get(OVERLAY_STATE_KEY);
      if (result[OVERLAY_STATE_KEY]?.visible !== true) return;
      await chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_RESTORE_VISIBLE_GLOBAL_OVERLAY_SOON" });
    } catch {
      // Best-effort: losing this request should not block playback navigation.
    }
  }

  async function navigateToVideo(next) {
    await requestScheduledGlobalOverlayRestore();
    const link = next?.link;
    if (link?.isConnected) {
      link.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      link.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      link.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      link.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      link.click();
      return;
    }
    location.href = next.href;
  }

  async function skipToNextPlayableVideo(reason = "manual", force = false) {
    if (skipInProgress && reason !== "already-downvoted" && reason !== "ended") return { ok: false, error: "Skip is already running." };
    if (skipInProgress) skipInProgress = false;
    if (!isWatchPage()) return { ok: false, error: "The selected tab is not a YouTube video page." };
    if (!enabled && !force) return { ok: false, error: "Extension is turned off. Use the power button to turn it on." };
    skipInProgress = true;

    try {
      const currentMetadata = { userPressedNext: isUserPressedNextReason(reason) };
      await saveCurrentVideoMetadata(currentMetadata);

      let next;
      const playlistMode = await getPlaylistMode();
      if (playlistMode) {
        const currentVideoId = getVideoIdFromUrl();
        next = await getPlaylistNextVideo(currentVideoId);
      } else {
        next = await findNextPlayableVideo();
        if (!next) {
          await scrollForMoreRecommendations();
          next = await findNextPlayableVideo();
        }
      }

      if (!next) {
        return { ok: false, error: "There is nothing new to play." };
      }

      await navigateToVideo(next);
      return { ok: true, videoId: next.videoId, title: next.title };
    } finally {
      skipInProgress = false;
    }
  }

  async function skipToNextUntrackedVideo() {
    if (skipInProgress) return { ok: false, error: "Skip is already running." };
    if (!isWatchPage()) return { ok: false, error: "The selected tab is not a YouTube video page." };
    if (!enabled) return { ok: false, error: "Extension is turned off. Use the power button to turn it on." };
    skipInProgress = true;

    try {
      const currentVideoId = getVideoIdFromUrl();
      let next;
      const playlistMode = await getPlaylistMode();
      if (playlistMode) {
        next = await getPlaylistNextVideo(currentVideoId);
      } else {
        next = await findNextPlayableVideo();
        if (!next) {
          await scrollForMoreRecommendations();
          next = await findNextPlayableVideo();
        }
      }

      if (!next) {
        return { ok: false, error: "There is nothing new to play." };
      }

      trackingSuppressedVideoId = next.videoId;
      await chrome.storage.local.set({
        [UNTRACKED_SKIP_ONCE_KEY]: {
          videoId: next.videoId,
          createdAt: Date.now()
        }
      });
      await removeVisitedVideos([currentVideoId, next.videoId]);
      await navigateToVideo(next);
      return { ok: true, videoId: next.videoId, title: next.title, untracked: true };
    } finally {
      skipInProgress = false;
    }
  }

  async function skipChannel() {
    if (!enabled) return { ok: false, error: "Extension is turned off." };
    const channelInfo = getChannelInfo();
    if (!channelInfo || (!channelInfo.channelId && !channelInfo.channelName)) {
      return { ok: false, error: "Could not identify the channel." };
    }
    await blockChannel(channelInfo.channelId, channelInfo.channelName);
    await saveCurrentVideoMetadata({ channelId: channelInfo.channelId, channelName: channelInfo.channelName });
    await clickDislikeButton();
    return await skipToNextPlayableVideo("channel-skip", false);
  }

  function isUserPressedNextReason(reason) {
    return reason === "button" ||
      reason === "overlay-skip" ||
      reason === "overlay-dislike" ||
      reason === "manual";
  }

  function attachVideoEndListener() {
    const video = getVideo();
    if (!video || video === attachedVideo) return;

    if (attachedVideo) {
      attachedVideo.removeEventListener("ended", onVideoEnded, true);
    }

    attachedVideo = video;
    attachedVideo.addEventListener("ended", onVideoEnded, true);
  }

  function onVideoEnded() {
    skipToNextPlayableVideo("ended");
  }

  function pauseVideoIfPossible() {
    const video = getVideo();
    if (!video) return false;
    if (!video.paused) video.pause();
    return true;
  }

  async function notifyPlaybackWaiting() {
    try {
      await chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_PLAYBACK_WAITING" });
    } catch {
      // Badge updates are best-effort; playback control should continue.
    }
  }

  async function notifyPlaybackStarted() {
    try {
      await chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_PLAYBACK_STARTED" });
    } catch {
      // Badge updates are best-effort; playback control should continue.
    }
  }

  async function playVideoIfStillCurrent(token) {
    if (token !== startupPauseToken || !enabled || !isWatchPage()) return;
    const video = getVideo();
    if (!video) return;
    if (!video.paused) {
      await notifyPlaybackStarted();
      return;
    }

    try {
      await video.play();
      if (!video.paused) await notifyPlaybackStarted();
    } catch {
      // Browser autoplay rules may block play in some cases.
    }
  }

  async function pauseUntilDislikeButtonThenCheck() {

    const token = ++startupPauseToken;
    controlDetectionActive = true;
    await notifyPlaybackWaiting();

    const started = Date.now();
    const maxWaitMs = 10000;

    try {
      while (enabled && isWatchPage() && token === startupPauseToken) {
        pauseVideoIfPossible();

        if (Date.now() - started > maxWaitMs) {
          await saveCurrentVideoMetadata({});
          await playVideoIfStillCurrent(token);
          return;
        }

        const dislikeState = await waitForDislikeButtonState(token);
        if (dislikeState?.ready) {
          const forcePlayOnce = await consumeForcePlayOnce();

          if (dislikeState.downvoted && !forcePlayOnce) {
            await skipToNextPlayableVideo("already-downvoted");
          } else {
            await saveCurrentVideoMetadata({ downvoted: dislikeState.downvoted });
            await playVideoIfStillCurrent(token);
          }
          return;
        }

        await sleep(10);
      }
    } finally {
      controlDetectionActive = false;
    }
  }

  function watchDislikeClicks() {
    document.addEventListener("click", async (event) => {
      if (!enabled) return;
      const button = event.target.closest?.("dislike-button-view-model button, button[aria-label*='Dislike']");
      if (!button) return;
      const wasDownvoted = getDislikeButtonState(button)?.downvoted === true;
      await saveCurrentVideoMetadata({ downvoted: !wasDownvoted, upvoted: !wasDownvoted ? false : undefined });
      if (!wasDownvoted) {
        await skipToNextPlayableVideo("dislike-click");
      }
    }, true);
  }

  function watchLikeClicks() {
    document.addEventListener("click", async (event) => {
      if (!enabled) return;
      const button = event.target.closest?.("like-button-view-model button, button[aria-label*='like this video' i]");
      if (!button) return;
      await sleep(80);
      const liked = isCurrentVideoLiked();
      await saveCurrentVideoMetadata({ upvoted: liked, downvoted: liked ? false : undefined });
    }, true);
  }

  async function onPageReadyOrChanged() {
    if (!enabled || !isWatchPage()) {
      trackingSuppressedVideoId = "";
      return;
    }

    const videoId = getVideoIdFromUrl();
    if (trackingSuppressedVideoId && trackingSuppressedVideoId !== videoId) {
      trackingSuppressedVideoId = "";
    }
    if (await consumeUntrackedSkipOnce(videoId)) {
      trackingSuppressedVideoId = videoId;
      await removeVisitedVideos([videoId]);
    }
    attachVideoEndListener();
    pauseUntilDislikeButtonThenCheck();
    requestVisibleGlobalOverlayRestore();
    injectInlineControls();
  }

  async function requestVisibleGlobalOverlayRestore() {
    try {
      const result = await chrome.storage.local.get(OVERLAY_STATE_KEY);
      if (result[OVERLAY_STATE_KEY]?.visible !== true) return;
      await chrome.runtime.sendMessage({ type: "YT_YOUDIVERSIFY_RESTORE_VISIBLE_GLOBAL_OVERLAY" });
    } catch {
      // The overlay restore is best-effort; normal page controls still work without it.
    }
  }

  function observeControls() {
    if (controlsObserver) controlsObserver.disconnect();
    controlsObserver = new MutationObserver(() => {
      if (!enabled || !isWatchPage()) return;
      attachVideoEndListener();
    });
    controlsObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function watchUrlChanges() {
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        skipInProgress = false;
        startupPauseToken++;
        onPageReadyOrChanged();
      }
    }, 250);

    new MutationObserver(() => {
      if (!document.getElementById("yt-yd-inline-controls")) {
        injectInlineControls();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }



  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const knownTypes = new Set([
      "YT_YOUDIVERSIFY_ENABLED_CHANGED",
      "YT_YOUDIVERSIFY_GET_STATUS", "YT_YOUDIVERSIFY_PLAY_PAUSE",
      "YT_YOUDIVERSIFY_UPVOTE", "YT_YOUDIVERSIFY_SEEK_TO_PERCENT",
      "YT_YOUDIVERSIFY_SEEK_BY_SECONDS", "YT_YOUDIVERSIFY_SET_VOLUME",
      "YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP", "YT_YOUDIVERSIFY_SKIP_NEXT",
      "YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED",
      "YT_YOUDIVERSIFY_SKIP_CHANNEL", "YT_YOUDIVERSIFY_RESET_VISITED"
    ]);
    if (!message?.type || !knownTypes.has(message.type)) return false;
    (async () => {
      if (message?.type === "YT_YOUDIVERSIFY_ENABLED_CHANGED") {
        enabled = message.enabled;
        if (enabled) {
          await onPageReadyOrChanged();
        } else {
          startupPauseToken++;
        }
        return { ok: true, enabled };
      }

      const controlTypes = new Set([
        "YT_YOUDIVERSIFY_PLAY_PAUSE",
        "YT_YOUDIVERSIFY_UPVOTE",
        "YT_YOUDIVERSIFY_SEEK_TO_PERCENT",
        "YT_YOUDIVERSIFY_SEEK_BY_SECONDS",
        "YT_YOUDIVERSIFY_SET_VOLUME",
        "YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP",
        "YT_YOUDIVERSIFY_SKIP_NEXT",
        "YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED",
        "YT_YOUDIVERSIFY_SKIP_CHANNEL"
      ]);
      if (controlTypes.has(message?.type) && !enabled) {
        return { ok: false, error: "Extension is turned off." };
      }

      if (message?.type === "YT_YOUDIVERSIFY_GET_STATUS") {
        const likeState = getLikeButtonState();
        const storedEntry = await getCurrentVideoEntry();
        const liked = likeState?.ready ? likeState.liked : storedEntry?.upvoted === true;
        return {
          ok: true,
          enabled,
          isWatchPage: isWatchPage(),
          videoId: getVideoIdFromUrl(),
          liked,
          downvoted: isCurrentVideoDownvoted(),
          paused: !!getVideo()?.paused,
          playing: !!getVideo() && !getVideo().paused,
          title: getVideoTitle(),
          channel: getChannelInfo(),
          volume: Number.isFinite(getVideo()?.volume) ? getVideo().volume : 1,
          muted: !!getVideo()?.muted,
          hasLikeButton: !!findLikeButton(),
          hasDislikeButton: !!findDislikeButton(),
          ...getPlaybackStatus()
        };
      }

      if (message?.type === "YT_YOUDIVERSIFY_PLAY_PAUSE") {
        return await togglePlayPause();
      }

      if (message?.type === "YT_YOUDIVERSIFY_UPVOTE") {
        return await clickLikeButton();
      }

      if (message?.type === "YT_YOUDIVERSIFY_SEEK_TO_PERCENT") {
        return await seekVideoToPercent(message.percent);
      }

      if (message?.type === "YT_YOUDIVERSIFY_SEEK_BY_SECONDS") {
        return await seekVideoBySeconds(message.seconds);
      }

      if (message?.type === "YT_YOUDIVERSIFY_SET_VOLUME") {
        return await setVideoVolume(message.volume);
      }

      if (message?.type === "YT_YOUDIVERSIFY_DOWNVOTE_AND_SKIP") {
        const result = await clickDislikeButton();
        if (!result.ok) return result;
        await sleep(100);
        return await skipToNextPlayableVideo("overlay-dislike", false);
      }

      if (message?.type === "YT_YOUDIVERSIFY_SKIP_NEXT") {
        return await skipToNextPlayableVideo("overlay-skip", false);
      }

      if (message?.type === "YT_YOUDIVERSIFY_SKIP_NEXT_UNTRACKED") {
        return await skipToNextUntrackedVideo();
      }

      if (message?.type === "YT_YOUDIVERSIFY_SKIP_CHANNEL") {
        return await skipChannel();
      }

      if (message?.type === "YT_YOUDIVERSIFY_RESET_VISITED") {
        return await resetVisited();
      }

      return undefined;
    })().then((response) => {
      if (response !== undefined) sendResponse(response);
    }).catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[ENABLED_KEY]) return;
    enabled = changes[ENABLED_KEY].newValue !== false;
    if (!enabled) {
      startupPauseToken++;
    } else {
      onPageReadyOrChanged();
    }
  });

  async function init() {
    ensureSquarePlayerStyles();
    enabled = await getEnabled();
    observeControls();
    observeRightPanelForBlockedChannels();
    watchUrlChanges();
    watchDislikeClicks();
    watchLikeClicks();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onPageReadyOrChanged, { once: true });
    } else {
      onPageReadyOrChanged();
    }
  }

  init();
})();
