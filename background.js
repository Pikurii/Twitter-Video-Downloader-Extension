// background.js - X-Vault: Twitter / X Video & Media Downloader Service Worker
// Dibuat oleh Pikuri (https://github.com/Pikurii)

// Cross-browser WebExtensions API compatibility (Chrome, Edge, Opera, Opera GX, Brave, Firefox)
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
} else if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  globalThis.browser = chrome;
}

const IS_DEV = false;
function logDebug(...args) {
  if (IS_DEV) console.debug("[X-Vault ServiceWorker]", ...args);
}

const DEFAULT_SETTINGS = {
  theme: "dark",
  language: "id",
  downloadAsMkv: false,
  notifyOnComplete: true,
  maxConcurrentDownloads: 6,
  defaultQuality: "ask",
  gifFormat: "ask",
  downloadThumbnail: false,
  askSaveLocation: false,
  createSubDir: true,
  subDirName: "X_Vault_Downloads",
  groupByAccount: false,
  filenameFormat: "author_text",
  activePatternTags: ["{account}", "{tweet_id}", "{serial}"],
  autoRevealNsfw: true,
  inTweetBtn: true,
  mediaCornerBadges: true,
  badgeMediaTypes: ["video", "gif", "photo"],
  headerDlAll: true,
  keyboardShortcut: true,
  historyLogging: true,
  tosAccepted: true
};

// In-memory stores
const mediaStore = new Map();
const tabMetadataStore = new Map();
const downloadTracker = new Map();
const completedDownloadIds = new Set();
const intendedDownloadFilenames = new Map();
const intendedDownloadByUrl = new Map();

// In-memory caches for Twitter / X media
const twitterThumbStore = new Map();
const twitterVariantsCache = new Map();
const twitterVariantsByTweetId = new Map();
const twitterVariantsByParentId = new Map();
const twitterTweetUrlStore = new Map();

// Session storage backing for MV3 resilience (safely fallback to local on Opera GX / Firefox)
let sessionStore = chrome?.storage?.local;
try {
  if (chrome?.storage?.session) {
    sessionStore = chrome.storage.session;
  }
} catch (e) {
  sessionStore = chrome?.storage?.local;
}
let isStateLoaded = false;
let persistTimeout = null;

async function saveSessionState() {
  clearTimeout(persistTimeout);
  persistTimeout = setTimeout(async () => {
    try {
      const mediaObj = {};
      for (const [k, v] of mediaStore.entries()) mediaObj[k] = v;
      const metaObj = {};
      for (const [k, v] of tabMetadataStore.entries()) metaObj[k] = v;
      const trackerObj = {};
      for (const [k, v] of downloadTracker.entries()) trackerObj[k] = v;
      await sessionStore.set({
        __mediaStore: mediaObj,
        __tabMetadataStore: metaObj,
        __downloadTracker: trackerObj
      });
    } catch (e) {}
  }, 100);
}

async function loadSessionState() {
  try {
    const data = await sessionStore.get(["__mediaStore", "__tabMetadataStore", "__downloadTracker"]);
    if (data.__mediaStore) {
      for (const k of Object.keys(data.__mediaStore)) {
        mediaStore.set(Number(k) || k, data.__mediaStore[k]);
      }
    }
    if (data.__tabMetadataStore) {
      for (const k of Object.keys(data.__tabMetadataStore)) {
        tabMetadataStore.set(Number(k) || k, data.__tabMetadataStore[k]);
      }
    }
    if (data.__downloadTracker) {
      for (const k of Object.keys(data.__downloadTracker)) {
        downloadTracker.set(Number(k) || k, data.__downloadTracker[k]);
      }
    }
    isStateLoaded = true;
  } catch (e) {}
}

loadSessionState();

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get(["settings", "downloadStats", "downloadHistory"]);
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    // Preserve existing settings and fill in any missing defaults
    const merged = { ...DEFAULT_SETTINGS, ...existing.settings };
    if (!existing.settings.defaultQuality) {
      merged.defaultQuality = "ask";
    }
    await chrome.storage.local.set({ settings: merged });
  }
  if (!existing.downloadStats) {
    await chrome.storage.local.set({
      downloadStats: { totalDownloads: 0, videoCount: 0, imageCount: 0 }
    });
  }
  if (!existing.downloadHistory) {
    await chrome.storage.local.set({ downloadHistory: [] });
  }
  await loadSessionState();
  setupContextMenus();

  // Re-inject content script into open Twitter/X tabs so users NEVER have to manually refresh Twitter (F5)
  if (chrome.scripting && chrome.tabs) {
    try {
      const tabs = await chrome.tabs.query({ url: ["*://*.x.com/*", "*://*.twitter.com/*"] });
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["lame.min.js", "content.js"]
          });
        } catch (err) {}
      }
    } catch (e) {}
  }
});

// Setup context menus (restricted only to Twitter/X)
function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "vdp_download_video",
      title: "Download Video X Ini",
      contexts: ["video"],
      documentUrlPatterns: ["*://x.com/*", "*://twitter.com/*"]
    });
    chrome.contextMenus.create({
      id: "vdp_download_audio",
      title: "Ekstrak Audio Saja (MP3)",
      contexts: ["video"],
      documentUrlPatterns: ["*://x.com/*", "*://twitter.com/*"]
    });
    chrome.contextMenus.create({
      id: "vdp_copy_media_link",
      title: "Salin Tautan Media X",
      contexts: ["video", "audio", "image"],
      documentUrlPatterns: ["*://x.com/*", "*://twitter.com/*"]
    });
  });
}

setupContextMenus();

// Context menu click handler
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const tabId = tab ? tab.id : null;
    const mediaUrl = info.srcUrl || info.linkUrl;
    if (!mediaUrl) return;

    if (info.menuItemId === "vdp_copy_media_link") {
      let directUrl = mediaUrl;
      if (directUrl && directUrl.includes("pbs.twimg.com/media/")) {
        if (directUrl.includes("?")) {
          directUrl = directUrl.replace(/name=[\w\d]+/, "name=orig");
          if (!directUrl.includes("name=orig")) directUrl += "&name=orig";
        } else {
          directUrl += "?name=orig";
        }
      }
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: "COPY_TEXT_TO_CLIPBOARD", payload: { text: directUrl } }).catch(() => {});
      }
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Tautan Disalin",
        message: "Tautan media berhasil disalin ke clipboard."
      });
      return;
    }

    const isAudioOnly = info.menuItemId === "vdp_download_audio";
    const pageTitle = tab ? cleanTitleString(tab.title) : "X Media";
    const ext = isAudioOnly ? "mp3" : "mp4";

    chrome.downloads.download({
      url: mediaUrl,
      filename: `${pageTitle}.${ext}`,
      saveAs: false,
      conflictAction: "uniquify"
    }, (downloadId) => {
      if (downloadId) {
        trackPendingDownload(downloadId, "video", {
          title: pageTitle,
          filename: `${pageTitle}.${ext}`
        });
      }
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: isAudioOnly ? "Mengekstrak Audio..." : "Memulai Unduhan...",
      message: `Mengunduh ${isAudioOnly ? "audio MP3" : "video"} dari "${pageTitle}"`
    });
  });
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return "";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function sanitizeFilename(name) {
  if (!name) return "video_" + Date.now();
  let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  sanitized = sanitized.replace(/\s+/g, " ");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^_+|_+$/g, "");
  if (sanitized.length > 120) {
    sanitized = sanitized.substring(0, 120);
  }
  return sanitized || "media_" + Date.now();
}

function sanitizeDirectoryName(name) {
  if (!name) return "X_Vault_Downloads";
  let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  sanitized = sanitized.replace(/\s+/g, "_");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^[\s._]+|[\s._]+$/g, "");
  return sanitized || "X_Vault_Downloads";
}

function cleanTitleString(rawTitle) {
  if (!rawTitle) return "";
  let t = rawTitle;
  t = t.replace(/https?:\/\/\S+/gi, "").replace(/httpst?\.co\S*/gi, "").replace(/t\.co\/\S*/gi, "");
  t = t.replace(/^\(\d+\)\s*/, "");
  t = t.replace(/\s*[-–—|]\s*(YouTube|Vimeo|Dailymotion|Facebook|Twitter|X|Instagram|TikTok).*$/i, "");
  t = t.replace(/\s+on\s+X:?\s*/i, " - ").replace(/\s*\/\s*X$/i, "");
  t = t.replace(/[<>:"/\\|?*]/g, "").trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\.(mp4|webm|mkv|m3u8|mpd|ts|mov)$/i, "");
  if (t.length > 70) {
    t = t.substring(0, 70).trim().replace(/\s+\S*$/, "") + "...";
  }
  const lower = (t || "").toLowerCase();
  if (!t || lower === "video" || lower === "x" || lower === "home" || lower.startsWith("home") || lower === "notifications" || lower === "explore" || lower === "messages" || lower === "bookmarks" || lower === "lists" || lower === "profile") {
    return "";
  }
  return t;
}

// Find best matching video format from available GraphQL/variant formats
function findMatchingFormat(availableFormats, targetQuality) {
  if (!Array.isArray(availableFormats) || availableFormats.length === 0 || !targetQuality) return null;
  const target = String(targetQuality).toLowerCase().trim();
  const playable = availableFormats.filter(f => f && f.url && !f.url.includes(".m3u8") && f.format !== "HLS" && f.format !== "AUDIO");
  const pool = playable.length > 0 ? playable : availableFormats;

  if (target === "native" || target === "highest" || target === "max") {
    return pool[0] || null;
  }

  const targetNum = parseInt(target.replace(/\D/g, ""), 10); // e.g. 270, 360, 480, 720, 1080

  // 1. Exact string match on quality or resolution
  let match = pool.find(f => {
    const q = (f.quality || "").toLowerCase();
    const res = (f.resolution || "").toLowerCase();
    return q === target || res === target || q.includes(target) || res.includes(target);
  });
  if (match) return match;

  // 2. Numeric dimension match (checking width, height, or shorter dimension)
  if (targetNum > 0) {
    match = pool.find(f => {
      const qNum = parseInt((f.quality || "").replace(/\D/g, ""), 10);
      if (qNum === targetNum) return true;
      if (f.resolution && f.resolution.includes("x")) {
        const parts = f.resolution.split("x").map(n => parseInt(n, 10)).filter(Boolean);
        if (parts.length === 2) {
          const minDim = Math.min(parts[0], parts[1]);
          if (minDim === targetNum || parts[1] === targetNum || parts[0] === targetNum) return true;
        }
      }
      return false;
    });
    if (match) return match;

    // 3. Closest dimension match
    let bestDiff = Infinity;
    let closest = null;
    for (const f of pool) {
      let fNum = parseInt((f.quality || "").replace(/\D/g, ""), 10);
      if (!fNum && f.resolution && f.resolution.includes("x")) {
        const parts = f.resolution.split("x").map(n => parseInt(n, 10)).filter(Boolean);
        if (parts.length === 2) fNum = Math.min(parts[0], parts[1]);
      }
      if (fNum > 0) {
        const diff = Math.abs(fNum - targetNum);
        if (diff < bestDiff) {
          bestDiff = diff;
          closest = f;
        }
      }
    }
    if (closest) return closest;
  }

  return pool[0] || null;
}

// Generate formatted Twitter filename based on user settings
async function getFormattedTwitterFilename(item, customPayload = null) {
  let settings = {};
  try {
    const data = await chrome.storage.local.get("settings");
    if (data?.settings) settings = data.settings;
  } catch (e) {}

  const isItemAuthorValid = Boolean(item.author && item.author !== "Pengguna X" && item.author !== "X User");
  const isItemTextValid = Boolean(item.tweetText && !["home", "x", "video"].includes(item.tweetText.toLowerCase().trim()));

  let author = "";
  let screenName = "";
  let tweetText = "";

  if (isItemAuthorValid) {
    author = item.author.trim();
    screenName = (item.screenName || "").trim();
  } else if (customPayload?.author && customPayload.author !== "Pengguna X" && customPayload.author !== "X User") {
    author = customPayload.author.trim();
    screenName = (customPayload.screenName || "").trim();
  }

  if (isItemTextValid) {
    tweetText = item.tweetText.trim();
  } else if (customPayload?.tweetText) {
    const customLower = customPayload.tweetText.toLowerCase().trim();
    if (!["home", "x", "video"].includes(customLower)) {
      tweetText = customPayload.tweetText.trim();
    }
  }

  screenName = screenName.replace(/^@+/, "");
  if (!author && screenName) author = screenName;

  if (tweetText) {
    const lower = tweetText.toLowerCase();
    if (lower === "home" || lower === "x" || lower === "video" || lower.startsWith("home") || lower === "explore" || lower === "notifications" || lower === "messages" || lower === "bookmarks") {
      tweetText = "";
    }
  }

  if (!tweetText && item.title) {
    const lower = item.title.trim().toLowerCase();
    if (lower !== "home" && lower !== "home.mp4" && lower !== "x.mp4" && lower !== "video.mp4" && !lower.startsWith("home.") && !lower.startsWith("x.")) {
      tweetText = item.title.replace(/\.(mp4|webm|mkv|m3u8|mp3|wav)$/i, "");
    }
  }

  const isGif = Boolean(customPayload?.isGif || item.quality === "GIF" || item.format === "GIF");
  const isAudio = Boolean(customPayload?.isAudioOnly || item.format === "AUDIO" || item.isAudioOnly);
  const quality = isGif
    ? (customPayload?.quality || "GIF")
    : isAudio
      ? "MP3"
      : (customPayload?.targetQuality || item.selectedFormat?.quality || item.quality || "HD");
  let ext = "mp4";
  if (customPayload?.ext) {
    ext = customPayload.ext.toLowerCase();
  } else if (isAudio) {
    ext = "mp3";
  } else if (customPayload?.asGif || item.format === "GIF" || customPayload?.gifFormat?.startsWith("gif")) {
    ext = "gif";
  } else {
    ext = "mp4";
  }
  const cleanAuthor = screenName ? `@${sanitizeFilename(screenName)}` : (author ? `@${sanitizeFilename(author)}` : "");
  const cleanText = sanitizeFilename(tweetText || "").replace(/\s+/g, " ").trim().substring(0, 50);
  const tweetId = item.tweetId || customPayload?.tweetId || Date.now();

  let finalName = "";

  if (Array.isArray(settings.activePatternTags) && settings.activePatternTags.length > 0) {
    const parts = settings.activePatternTags.map(t => {
      switch (t) {
        case "{account}": return cleanAuthor || "@user";
        case "{account_id}": return screenName || author || "user";
        case "{tweet_id}": return String(tweetId);
        case "{serial}": return "01";
        case "{quality}": return quality;
        case "{text}": return cleanText || (isGif ? "GIF" : (isAudio ? "Audio" : "Video"));
        case "{date}": return new Date().toISOString().split("T")[0];
        case "{datetime}": {
          const d = new Date();
          return `${d.toISOString().split("T")[0].replace(/-/g, "")}_${d.toTimeString().split(" ")[0].replace(/:/g, "")}`;
        }
        case "{timestamp}": return String(Math.floor(Date.now() / 1000));
        default: return "";
      }
    }).filter(Boolean);

    finalName = sanitizeFilename(`${parts.join("-")}.${ext}`);
  } else {
    const filenameFormat = settings.filenameFormat || "author_text";
    if (filenameFormat === "author_text" && cleanAuthor && cleanText) {
      finalName = `${cleanAuthor} - ${cleanText}.${ext}`;
    } else if (filenameFormat === "text_only" && cleanText) {
      finalName = `${cleanText}.${ext}`;
    } else if (cleanAuthor) {
      finalName = `${cleanAuthor} - ${tweetId}.${ext}`;
    } else {
      finalName = `X_${tweetId}.${ext}`;
    }
    finalName = sanitizeFilename(finalName);
  }

  let targetPath = finalName;
  if (settings.groupByAccount && cleanAuthor) {
    targetPath = `${sanitizeFilename(cleanAuthor)}/${targetPath}`;
  }
  if (settings.createSubDir !== false) {
    const sub = sanitizeDirectoryName((settings.subDirName || "X_Vault_Downloads").trim());
    if (sub) targetPath = `${sub}/${targetPath}`;
  }

  return targetPath;
}

// Generate formatted Twitter image filename
async function getFormattedTwitterImageFilename(payload, ext = "jpg") {
  let settings = {};
  try {
    const data = await chrome.storage.local.get("settings");
    if (data?.settings) settings = data.settings;
  } catch (e) {}

  let screenName = (payload.screenName || "").replace(/^@+/, "");
  let author = payload.author || screenName || "X";
  let tweetText = (payload.tweetText || "").trim();
  const serialNo = payload.index !== undefined ? (payload.index < 9 ? `0${payload.index + 1}` : String(payload.index + 1)) : "01";

  if (["home", "x", "video", "explore", "home / x"].includes(tweetText.toLowerCase())) {
    tweetText = "";
  }

  const cleanAuthor = screenName ? `@${sanitizeFilename(screenName)}` : `@${sanitizeFilename(author)}`;
  const cleanText = sanitizeFilename(tweetText).substring(0, 50);
  const tweetId = payload.tweetId || Date.now();

  let finalName = "";

  if (Array.isArray(settings.activePatternTags) && settings.activePatternTags.length > 0) {
    const hasSerialTag = settings.activePatternTags.includes("{serial}");
    const parts = settings.activePatternTags.map(t => {
      switch (t) {
        case "{account}": return cleanAuthor || "@user";
        case "{account_id}": return screenName || author || "user";
        case "{tweet_id}": return String(tweetId);
        case "{serial}": return serialNo;
        case "{quality}": return "HD";
        case "{text}": return cleanText || "Photo";
        case "{date}": return new Date().toISOString().split("T")[0];
        case "{datetime}": {
          const d = new Date();
          return `${d.toISOString().split("T")[0].replace(/-/g, "")}_${d.toTimeString().split(" ")[0].replace(/:/g, "")}`;
        }
        case "{timestamp}": return String(Math.floor(Date.now() / 1000));
        default: return "";
      }
    }).filter(Boolean);

    const baseName = parts.join("-");
    if (!hasSerialTag && payload.index !== undefined) {
      finalName = sanitizeFilename(`${baseName}_${serialNo}.${ext}`);
    } else {
      finalName = sanitizeFilename(`${baseName}.${ext}`);
    }
  } else {
    const filenameFormat = settings.filenameFormat || "author_text";
    const indexStr = payload.index !== undefined ? `_${serialNo}` : "";
    if (filenameFormat === "author_text" && cleanAuthor && cleanText) {
      finalName = `${cleanAuthor} - ${cleanText}${indexStr}.${ext}`;
    } else if (filenameFormat === "text_only" && cleanText) {
      finalName = `${cleanText}${indexStr}.${ext}`;
    } else if (cleanAuthor) {
      finalName = `${cleanAuthor}${indexStr || "_Photo"}.${ext}`;
    } else {
      finalName = `X_Photo${indexStr || "_" + tweetId}.${ext}`;
    }
    finalName = sanitizeFilename(finalName);
  }

  let targetPath = finalName;
  if (settings.groupByAccount && cleanAuthor) {
    targetPath = `${sanitizeFilename(cleanAuthor)}/${targetPath}`;
  }
  if (settings.createSubDir !== false) {
    const sub = sanitizeDirectoryName((settings.subDirName || "X_Vault_Downloads").trim());
    if (sub) targetPath = `${sub}/${targetPath}`;
  }

  return targetPath;
}

// Gamified stats & history recorder
async function recordDownload(type = "video", metadata = {}) {
  try {
    const data = await chrome.storage.local.get(["settings", "downloadStats", "downloadHistory"]);
    const settings = data?.settings || {};
    let history = data.downloadHistory || [];

    // Deduplication check: prevent recording same download if already added within 4s or with same downloadId
    const isDuplicate = history.some(h => (
      (metadata.downloadId && h.downloadId && h.downloadId === metadata.downloadId) ||
      (metadata.filename && h.filename === metadata.filename && Math.abs(Date.now() - (h.timestamp || 0)) < 4000)
    ));
    if (isDuplicate) {
      return;
    }

    const stats = data.downloadStats || { totalDownloads: 0, videoCount: 0, imageCount: 0, audioCount: 0 };
    stats.totalDownloads = (stats.totalDownloads || 0) + 1;
    if (type === "image") {
      stats.imageCount = (stats.imageCount || 0) + 1;
    } else if (type === "gif") {
      stats.gifCount = (stats.gifCount || 0) + 1;
    } else if (type === "audio") {
      stats.audioCount = (stats.audioCount || 0) + 1;
    } else {
      stats.videoCount = (stats.videoCount || 0) + 1;
    }

    let item = null;
    if (settings.historyLogging !== false) {
      item = {
        id: "dl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        downloadId: metadata.downloadId || null,
        type: type,
        title: metadata.title || (type === "image" ? "Twitter Photo" : (type === "gif" ? "Twitter GIF" : (type === "audio" ? "Twitter Audio" : "Twitter Video"))),
        filename: metadata.filename || "",
        timestamp: Date.now(),
        tweetId: metadata.tweetId || null,
        author: metadata.author || null,
        screenName: metadata.screenName || null,
        tweetText: metadata.tweetText || metadata.title || "",
        tweetTime: metadata.tweetTime || "",
        tweetIsoDate: metadata.tweetIsoDate || "",
        thumbnail: metadata.thumbnail || null,
        tweetUrl: metadata.tweetUrl || (metadata.tweetId ? `https://x.com/${metadata.screenName || "i"}/status/${metadata.tweetId}` : null),
        downloadUrl: metadata.downloadUrl || null
      };
      history.unshift(item);
      if (history.length > 100) history.pop();
    }

    await chrome.storage.local.set({
      downloadStats: stats,
      downloadHistory: history
    });

    chrome.runtime.sendMessage({
      action: "DOWNLOAD_RECORDED",
      stats,
      lastItem: item
    }).catch(() => {});
  } catch (e) {
    console.error("Failed to record download stat:", e);
  }
}

// Track pending download to only increment drops/XP once the download completes on disk
function trackPendingDownload(downloadId, type = "video", metadata = {}) {
  if (!downloadId) return;
  downloadTracker.set(downloadId, { type, ...metadata });
  saveSessionState();

  chrome.downloads.search({ id: downloadId }, (results) => {
    const item = results && results[0];
    if (item && item.state === "complete") {
      if (completedDownloadIds.has(downloadId)) return;
      completedDownloadIds.add(downloadId);
      downloadTracker.delete(downloadId);
      downloadTracker.delete(Number(downloadId));
      downloadTracker.delete(String(downloadId));
      saveSessionState();
      recordDownload(type, { ...metadata, downloadId });

      const completePayload = {
        downloadId,
        clientReqId: metadata.clientReqId || null,
        state: "complete",
        percent: 100
      };
      if (metadata.tabId) {
        chrome.tabs.sendMessage(metadata.tabId, {
          action: "DOWNLOAD_PROGRESS_UPDATE",
          payload: completePayload
        }).catch(() => {});
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id && tabs[0].id !== metadata.tabId) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "DOWNLOAD_PROGRESS_UPDATE",
            payload: completePayload
          }).catch(() => {});
        }
      });
    } else if (item && item.state === "interrupted") {
      // User canceled in file dialog or download failed - do not award XP
      downloadTracker.delete(downloadId);
      downloadTracker.delete(Number(downloadId));
      downloadTracker.delete(String(downloadId));
      saveSessionState();
    }
  });
}

function updateBadge(tabId) {
  const list = mediaStore.get(tabId) || [];
  const count = list.length;
  if (count > 0) {
    chrome.action.setBadgeText({ tabId, text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#1d9bf0" });
  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
  }
}

function applyMetadataToTabMedia(tabId, meta) {
  if (!meta || !mediaStore.has(tabId)) return;
  const list = mediaStore.get(tabId);
  list.forEach((item) => {
    if (!item.title || item.title.startsWith("Home.") || item.title.startsWith("X.") || item.title.startsWith("Video.")) {
      if (meta.title) {
        item.title = `${meta.title}.mp4`;
        item.filename = `${meta.title}.mp4`;
      }
    }
    if (!item.thumbnail && meta.thumbnail) {
      item.thumbnail = meta.thumbnail;
    }
    if (meta.duration) {
      item.duration = meta.duration;
    }
  });
  saveSessionState();
}

function addTwitterMediaItem(tabId, item) {
  if (!tabId || !item) return;
  let list = mediaStore.get(tabId);
  if (!list) {
    list = [];
    mediaStore.set(tabId, list);
  }
  const existing = list.find(m => (item.twVideoId && m.twVideoId === item.twVideoId) || (item.tweetId && m.tweetId === item.tweetId));
  if (!existing) {
    list.unshift(item);
    if (list.length > 25) list.pop();
  }
  updateBadge(tabId);
  saveSessionState();
}

// Dedicated lightweight network listener for Twitter thumbnails from pbs.twimg.com
if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const { tabId, url } = details;
      if (tabId < 0 || !url) return;
      if (url.includes("pbs.twimg.com/") && (url.includes("video_thumb") || url.includes("/media/"))) {
        const idMatch = url.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/i);
        const twVideoId = idMatch ? idMatch[1] : null;
        const cleanThumbUrl = url.replace(/:(?:small|thumb|tiny)$/i, ":medium");

        if (twVideoId) {
          twitterThumbStore.set(twVideoId, cleanThumbUrl);
        }

        const list = mediaStore.get(tabId) || [];
        let updated = false;
        list.forEach((item) => {
          if (twVideoId && (item.twVideoId === twVideoId || item.url?.includes(twVideoId))) {
            item.thumbnail = cleanThumbUrl;
            updated = true;
          }
        });

        if (updated) {
          saveSessionState();
        }
      }
    },
    { urls: ["*://pbs.twimg.com/*"] }
  );
}

// Download status tracker & live progress broadcaster
chrome.downloads.onChanged.addListener((delta) => {
  const downloadId = delta.id;
  const pending = downloadTracker.get(downloadId) || downloadTracker.get(Number(downloadId)) || downloadTracker.get(String(downloadId));

  if (pending) {
    chrome.downloads.search({ id: downloadId }, (results) => {
      const item = results && results[0];
      if (!item) return;

      const totalBytes = item.totalBytes || 0;
      const bytesReceived = item.bytesReceived || 0;
      const percent = (totalBytes > 0) ? Math.min(100, Math.max(0, Math.round((bytesReceived / totalBytes) * 100))) : null;
      const state = item.state; // "in_progress", "complete", "interrupted"

      const progressPayload = {
        downloadId,
        clientReqId: pending.clientReqId || null,
        state,
        percent,
        bytesReceived,
        totalBytes
      };

      if (pending.tabId) {
        chrome.tabs.sendMessage(pending.tabId, {
          action: "DOWNLOAD_PROGRESS_UPDATE",
          payload: progressPayload
        }).catch(() => {});
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id && tabs[0].id !== pending.tabId) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "DOWNLOAD_PROGRESS_UPDATE",
            payload: progressPayload
          }).catch(() => {});
        }
      });
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_PROGRESS_UPDATE",
        payload: progressPayload
      }).catch(() => {});

      if (state === "complete") {
        if (!completedDownloadIds.has(downloadId)) {
          completedDownloadIds.add(downloadId);
          downloadTracker.delete(downloadId);
          downloadTracker.delete(Number(downloadId));
          downloadTracker.delete(String(downloadId));
          saveSessionState();
          recordDownload(pending.type, { ...pending, downloadId });
        }
      } else if (state === "interrupted") {
        downloadTracker.delete(downloadId);
        downloadTracker.delete(Number(downloadId));
        downloadTracker.delete(String(downloadId));
        saveSessionState();
      }
    });
  }
});

// Reliable Subfolder & Account directory enforcement across all Chromium browsers
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    let desiredPath = intendedDownloadFilenames.get(item.id) || 
                      intendedDownloadFilenames.get(Number(item.id)) || 
                      intendedDownloadFilenames.get(String(item.id)) ||
                      intendedDownloadByUrl.get(item.url);

    if (!desiredPath && item.url) {
      const cleanUrl = item.url.split("?")[0];
      for (const [storedUrl, p] of intendedDownloadByUrl.entries()) {
        if (storedUrl === item.url || storedUrl.split("?")[0] === cleanUrl) {
          desiredPath = p;
          intendedDownloadByUrl.delete(storedUrl);
          break;
        }
      }
    }

    if (desiredPath) {
      intendedDownloadFilenames.delete(item.id);
      intendedDownloadFilenames.delete(Number(item.id));
      intendedDownloadFilenames.delete(String(item.id));
      intendedDownloadByUrl.delete(item.url);

      desiredPath = desiredPath.replace(/^[\/\\]+/, "").replace(/\\/g, "/");
      suggest({ filename: desiredPath, conflictAction: "uniquify" });
      return;
    } else {
      suggest();
    }
  });
}

// Central Message Listener
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  const { action, payload } = req;

  (async () => {
    if (action === "THEME_CHANGED") {
      if (req.theme) {
        chrome.storage.local.get("settings", (data) => {
          const s = (data && data.settings) ? data.settings : {};
          s.theme = req.theme;
          chrome.storage.local.set({ settings: s });
        });
      }
      chrome.tabs.query({}, (tabs) => {
        (tabs || []).forEach((t) => {
          if (t?.id) {
            chrome.tabs.sendMessage(t.id, req).catch(() => {});
          }
        });
      });
      sendResponse({ success: true });
      return;
    }

    if (action === "SETTINGS_UPDATED") {
      if (req.settings) {
        chrome.storage.local.get("settings", (data) => {
          const s = { ...(data?.settings || {}), ...req.settings };
          chrome.storage.local.set({ settings: s });
        });
      }
      chrome.tabs.query({}, (tabs) => {
        (tabs || []).forEach((t) => {
          if (t?.id) {
            chrome.tabs.sendMessage(t.id, req).catch(() => {});
          }
        });
      });
      sendResponse({ success: true });
      return;
    }

    if (action === "GET_SESSION_STATE") {
      const tabId = payload?.tabId;
      const media = tabId ? (mediaStore.get(tabId) || []) : [];
      const meta = tabId ? (tabMetadataStore.get(tabId) || null) : null;
      sendResponse({ media, metadata: meta });
      return;
    }

    if (action === "UPDATE_TAB_METADATA") {
      const tabId = sender.tab ? sender.tab.id : payload?.tabId;
      if (tabId && payload) {
        tabMetadataStore.set(tabId, payload);
        applyMetadataToTabMedia(tabId, payload);
        saveSessionState();
      }
      sendResponse({ success: true });
      return;
    }

    if (action === "CACHE_TWITTER_VARIANTS") {
      const items = payload?.items;
      if (Array.isArray(items)) {
        items.forEach((it) => {
          if (it.twVideoId) twitterVariantsCache.set(it.twVideoId, it);
          if (it.tweetId) twitterVariantsByTweetId.set(it.tweetId, it);
          if (it.parentTweetId) twitterVariantsByParentId.set(it.parentTweetId, it);
          if (it.twVideoId && it.tweetUrl) twitterTweetUrlStore.set(it.twVideoId, it.tweetUrl);
          if (it.tweetId && it.tweetUrl) twitterTweetUrlStore.set(it.tweetId, it.tweetUrl);
        });
      }
      sendResponse({ success: true });
      return;
    }

    if (action === "LINK_TWITTER_MEDIA_TO_TWEET") {
      const { twVideoId, tweetId, tweetUrl, author, screenName, tweetText } = payload || {};
      const validUrl = tweetUrl && tweetUrl.includes("/status/") ? tweetUrl : null;
      if (twVideoId && validUrl) twitterTweetUrlStore.set(twVideoId, validUrl);
      if (tweetId && validUrl) twitterTweetUrlStore.set(tweetId, validUrl);

      if (twVideoId && twitterVariantsCache.has(twVideoId)) {
        const item = twitterVariantsCache.get(twVideoId);
        if (tweetId && !item.tweetId) item.tweetId = tweetId;
        if (validUrl) {
          item.tweetUrl = validUrl;
          item.pageUrl = validUrl;
        }
        if (author && (!item.author || item.author === "Pengguna X")) item.author = author;
        if (screenName && !item.screenName) item.screenName = screenName;
        if (tweetText && !item.tweetText) item.tweetText = tweetText;
      }

      sendResponse({ success: true });
      return;
    }

    if (action === "RESOLVE_TWEET_URL") {
      const { twVideoId, tweetId, parentTweetId } = payload || {};
      let resolvedUrl = null;
      if (tweetId) resolvedUrl = twitterTweetUrlStore.get(tweetId) || `https://x.com/i/status/${tweetId}`;
      if (!resolvedUrl && twVideoId) resolvedUrl = twitterTweetUrlStore.get(twVideoId);
      if (!resolvedUrl && parentTweetId) resolvedUrl = `https://x.com/i/status/${parentTweetId}`;
      sendResponse({ tweetUrl: resolvedUrl });
      return;
    }

    if (action === "GET_DIRECT_MEDIA_URL") {
      const { twVideoId, tweetId, outerTweetId, allTweetIds } = payload || {};
      const tids = Array.isArray(allTweetIds) && allTweetIds.length > 0
        ? allTweetIds
        : [tweetId, outerTweetId].filter(Boolean);

      let item = null;
      if (twVideoId && twitterVariantsCache.has(twVideoId)) {
        item = twitterVariantsCache.get(twVideoId);
      }
      if (!item && tweetId && twitterVariantsByTweetId.has(tweetId)) {
        item = twitterVariantsByTweetId.get(tweetId);
      }
      if (!item && tweetId && twitterVariantsByParentId.has(tweetId)) {
        item = twitterVariantsByParentId.get(tweetId);
      }
      if (!item && outerTweetId && twitterVariantsByTweetId.has(outerTweetId)) {
        item = twitterVariantsByTweetId.get(outerTweetId);
      }
      if (!item) {
        for (const tid of tids) {
          if (tid && twitterVariantsByTweetId.has(tid)) {
            item = twitterVariantsByTweetId.get(tid);
            break;
          }
        }
      }

      let directUrl = item?.selectedFormat?.url || item?.url || null;
      if (!directUrl && tweetId) {
        directUrl = `https://video.twimg.com/tweet_video/${tweetId}.mp4`;
      }
      sendResponse({ success: Boolean(directUrl), url: directUrl });
      return;
    }

    if (action === "GET_VIDEO_FORMATS") {
      const { twVideoId, tweetId, outerTweetId, allTweetIds } = payload || {};
      const tids = Array.isArray(allTweetIds) && allTweetIds.length > 0
        ? allTweetIds
        : [tweetId, outerTweetId].filter(Boolean);

      let item = null;
      if (twVideoId && twitterVariantsCache.has(twVideoId)) {
        item = twitterVariantsCache.get(twVideoId);
      }
      if (!item && tweetId && twitterVariantsByTweetId.has(tweetId)) {
        item = twitterVariantsByTweetId.get(tweetId);
      }
      if (!item && tweetId && twitterVariantsByParentId.has(tweetId)) {
        item = twitterVariantsByParentId.get(tweetId);
      }
      if (!item && outerTweetId && twitterVariantsByTweetId.has(outerTweetId)) {
        item = twitterVariantsByTweetId.get(outerTweetId);
      }
      if (!item) {
        for (const tid of tids) {
          if (tid && twitterVariantsByTweetId.has(tid)) {
            item = twitterVariantsByTweetId.get(tid);
            break;
          }
        }
      }

      const formats = (Array.isArray(item?.availableFormats) ? item.availableFormats : []).map(f => ({
        format: f.format || "MP4",
        quality: f.quality || f.resolution || "HD",
        resolution: f.resolution || "",
        bitrate: f.bitrate || "",
        bitrateRaw: f.bitrateRaw || 0,
        url: f.url
      }));

      const defaultUrl = item?.selectedFormat?.url || item?.url || null;
      sendResponse({ success: true, formats, defaultUrl, duration: item?.duration || null });
      return;
    }

    if (action === "DOWNLOAD_TWITTER_TWEET") {
      const twVideoId = payload?.twVideoId;
      const tweetId = payload?.tweetId;
      const outerTweetId = payload?.outerTweetId;
      const allTweetIds = Array.isArray(payload?.allTweetIds) && payload.allTweetIds.length > 0
        ? payload.allTweetIds
        : [tweetId, outerTweetId].filter(Boolean);

      let itemToDownload = null;

      if (payload?.isGif && payload?.directMediaUrl) {
        itemToDownload = {
          url: payload.directMediaUrl,
          tweetId: tweetId || Date.now(),
          author: payload.author || "X User",
          screenName: payload.screenName || "",
          tweetText: payload.tweetText || "Twitter GIF",
          quality: "GIF",
          format: "MP4"
        };
      }

      if (!itemToDownload && twVideoId && twitterVariantsCache.has(twVideoId)) {
        itemToDownload = twitterVariantsCache.get(twVideoId);
      }
      if (!itemToDownload && tweetId && twitterVariantsByTweetId.has(tweetId)) {
        itemToDownload = twitterVariantsByTweetId.get(tweetId);
      }
      if (!itemToDownload && tweetId && twitterVariantsByParentId.has(tweetId)) {
        itemToDownload = twitterVariantsByParentId.get(tweetId);
      }
      if (!itemToDownload && outerTweetId && twitterVariantsByTweetId.has(outerTweetId)) {
        itemToDownload = twitterVariantsByTweetId.get(outerTweetId);
      }

      if (!itemToDownload) {
        for (const tid of allTweetIds) {
          if (tid && twitterVariantsByTweetId.has(tid)) {
            itemToDownload = twitterVariantsByTweetId.get(tid);
            break;
          }
        }
      }

      if (!itemToDownload && payload?.directMediaUrl) {
        itemToDownload = {
          url: payload.directMediaUrl,
          tweetId: tweetId || Date.now(),
          author: payload.author || "X User",
          screenName: payload.screenName || "",
          tweetText: payload.tweetText || (payload.isGif ? "Twitter GIF" : "Twitter Video"),
          quality: "HD",
          format: "MP4"
        };
      }

      if (itemToDownload && (itemToDownload.selectedFormat?.url || itemToDownload.url)) {
        let downloadUrl = itemToDownload.selectedFormat?.url || itemToDownload.url;
        const data = await chrome.storage.local.get("settings");
        const settings = data?.settings || {};

        let chosenQualityLabel = payload?.targetQuality || null;

        if (payload?.targetFormatUrl) {
          downloadUrl = payload.targetFormatUrl;
          if (Array.isArray(itemToDownload.availableFormats)) {
            const matched = itemToDownload.availableFormats.find(f => f.url === payload.targetFormatUrl);
            if (matched) {
              itemToDownload.selectedFormat = matched;
              chosenQualityLabel = matched.quality || chosenQualityLabel;
            }
          }
        } else if (payload?.targetQuality) {
          const matched = findMatchingFormat(itemToDownload.availableFormats, payload.targetQuality);
          if (matched?.url) {
            downloadUrl = matched.url;
            itemToDownload.selectedFormat = matched;
            chosenQualityLabel = matched.quality || chosenQualityLabel;
          }
        } else if (Array.isArray(itemToDownload.availableFormats) && settings.defaultQuality && settings.defaultQuality !== "native" && settings.defaultQuality !== "ask") {
          const matched = findMatchingFormat(itemToDownload.availableFormats, settings.defaultQuality);
          if (matched?.url) {
            downloadUrl = matched.url;
            itemToDownload.selectedFormat = matched;
            chosenQualityLabel = matched.quality || chosenQualityLabel;
          }
        }

        if (chosenQualityLabel) {
          itemToDownload.quality = chosenQualityLabel;
        }

        let fname = await getFormattedTwitterFilename(itemToDownload, {
          ...payload,
          targetQuality: chosenQualityLabel || payload?.targetQuality
        });
        const askSave = Boolean(settings.askSaveLocation);

        intendedDownloadByUrl.set(downloadUrl, fname);
        chrome.downloads.download({
          url: downloadUrl,
          filename: fname,
          saveAs: askSave,
          conflictAction: "uniquify"
        }, (downloadId) => {
          if (downloadId) {
            intendedDownloadFilenames.set(downloadId, fname);
            intendedDownloadFilenames.set(Number(downloadId), fname);
            intendedDownloadFilenames.set(String(downloadId), fname);
            const resolvedThumbnail = payload?.thumbnail || itemToDownload.thumbnail || (twVideoId ? twitterThumbStore.get(twVideoId) : null);
            const resolvedTweetUrl = payload?.pageUrl || itemToDownload.tweetUrl || (tweetId ? `https://x.com/${payload?.screenName || itemToDownload.screenName || "i"}/status/${tweetId}` : null);
            const resolvedTweetTime = payload?.tweetTime || itemToDownload.tweetTime || "";
            const resolvedTweetIsoDate = payload?.tweetIsoDate || itemToDownload.tweetIsoDate || "";
            const resolvedQuality = payload?.isGif ? "GIF" : (payload?.isAudioOnly ? "MP3" : (chosenQualityLabel || itemToDownload.quality || "HD"));

            trackPendingDownload(downloadId, payload?.isGif ? "gif" : (payload?.isAudioOnly ? "audio" : "video"), {
              title: itemToDownload.tweetText || payload?.tweetText || itemToDownload.title || ("Tweet " + tweetId),
              filename: fname,
              tweetId: tweetId || itemToDownload.tweetId,
              author: payload?.author || itemToDownload.author,
              screenName: payload?.screenName || itemToDownload.screenName,
              tweetText: payload?.tweetText || itemToDownload.tweetText,
              tweetTime: resolvedTweetTime,
              tweetIsoDate: resolvedTweetIsoDate,
              thumbnail: resolvedThumbnail,
              tweetUrl: resolvedTweetUrl,
              quality: resolvedQuality,
              downloadUrl: downloadUrl,
              clientReqId: payload?.clientReqId || null,
              tabId: sender.tab ? sender.tab.id : null
            });

            if (data?.settings?.downloadThumbnail && itemToDownload.thumbnail) {
              const thumbName = fname.replace(/\.mp4$/i, ".jpg");
              intendedDownloadByUrl.set(itemToDownload.thumbnail, thumbName);
              chrome.downloads.download({
                url: itemToDownload.thumbnail,
                filename: thumbName,
                saveAs: false,
                conflictAction: "uniquify"
              }, (thumbDlId) => {
                if (thumbDlId) {
                  intendedDownloadFilenames.set(thumbDlId, thumbName);
                  intendedDownloadFilenames.set(Number(thumbDlId), thumbName);
                  intendedDownloadFilenames.set(String(thumbDlId), thumbName);
                }
              });
            }
          }
          sendResponse({ success: Boolean(downloadId), downloadId, clientReqId: payload?.clientReqId || null });
        });
      } else {
        sendResponse({ success: false, error: "Media tweet belum dimuat" });
      }
      return;
    }

    if (action === "DOWNLOAD_AUDIO_BLOB") {
      const { blobUrl, tweetId, outerTweetId, author, screenName, tweetText, tweetTime, tweetIsoDate, thumbnail, pageUrl, ext, clientReqId } = payload || {};
      const tid = tweetId || outerTweetId || Date.now();
      const fakeItem = {
        tweetId: tid,
        author: author || "Pengguna X",
        screenName: screenName || "",
        tweetText: tweetText || "Audio",
        format: "AUDIO",
        quality: "MP3",
        isAudioOnly: true
      };

      const fname = await getFormattedTwitterFilename(fakeItem, {
        author,
        screenName,
        tweetText,
        tweetId: tid,
        ext: ext || "mp3",
        isAudioOnly: true,
        targetQuality: "MP3"
      });

      const data = await chrome.storage.local.get("settings");
      const askSave = Boolean(data?.settings?.askSaveLocation);

      intendedDownloadByUrl.set(blobUrl, fname);
      chrome.downloads.download({
        url: blobUrl,
        filename: fname,
        saveAs: askSave,
        conflictAction: "uniquify"
      }, (downloadId) => {
        if (downloadId) {
          intendedDownloadFilenames.set(downloadId, fname);
          intendedDownloadFilenames.set(Number(downloadId), fname);
          intendedDownloadFilenames.set(String(downloadId), fname);
          trackPendingDownload(downloadId, "audio", {
            title: tweetText || "Audio " + tid,
            filename: fname,
            tweetId: tid,
            author,
            screenName,
            tweetText,
            tweetTime: tweetTime || "",
            tweetIsoDate: tweetIsoDate || "",
            thumbnail: thumbnail || null,
            tweetUrl: pageUrl || (tweetId ? `https://x.com/${screenName || "i"}/status/${tweetId}` : null),
            quality: "MP3",
            downloadUrl: blobUrl,
            clientReqId: clientReqId || null,
            tabId: sender.tab ? sender.tab.id : null
          });
        }
        sendResponse({ success: Boolean(downloadId), downloadId, filename: fname, clientReqId });
      });
      return;
    }

    if (action === "DOWNLOAD_TWITTER_IMAGE") {
      const { imageUrl, tweetId, author, screenName, tweetText, index } = payload || {};

      let highResUrl = imageUrl;
      if (highResUrl && highResUrl.includes("pbs.twimg.com/media/")) {
        if (highResUrl.includes("?")) {
          highResUrl = highResUrl.replace(/name=[\w\d]+/, "name=orig");
          if (!highResUrl.includes("name=orig")) highResUrl += "&name=orig";
        } else {
          highResUrl += "?name=orig";
        }
      }

      const ext = highResUrl?.match(/format=(\w+)/)?.[1] || highResUrl?.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
      const fname = await getFormattedTwitterImageFilename({ author, screenName, tweetText, tweetId, index }, ext);
      const data = await chrome.storage.local.get("settings");
      const askSave = Boolean(data?.settings?.askSaveLocation);

      intendedDownloadByUrl.set(highResUrl, fname);
      intendedDownloadByUrl.set(highResUrl.split("?")[0], fname);
      chrome.downloads.download({
        url: highResUrl,
        filename: fname,
        saveAs: askSave,
        conflictAction: "uniquify"
      }, (downloadId) => {
        if (downloadId) {
          intendedDownloadFilenames.set(downloadId, fname);
          intendedDownloadFilenames.set(Number(downloadId), fname);
          intendedDownloadFilenames.set(String(downloadId), fname);
          const resolvedTweetUrl = payload?.pageUrl || (tweetId ? `https://x.com/${screenName || "i"}/status/${tweetId}` : null);
          trackPendingDownload(downloadId, "image", {
            title: tweetText || `@${screenName || author || "user"} photo`,
            filename: fname,
            tweetId: tweetId,
            author: author,
            screenName: screenName,
            tweetText: tweetText,
            tweetTime: payload?.tweetTime || "",
            tweetIsoDate: payload?.tweetIsoDate || "",
            thumbnail: highResUrl,
            tweetUrl: resolvedTweetUrl,
            downloadUrl: highResUrl,
            clientReqId: payload?.clientReqId || null,
            tabId: sender.tab ? sender.tab.id : null
          });
        }
        sendResponse({ success: Boolean(downloadId), downloadId, clientReqId: payload?.clientReqId || null });
      });
      return;
    }

    if (action === "REDOWNLOAD_HISTORY_ITEM") {
      const { url, filename } = payload || {};
      if (url) {
        chrome.downloads.download({
          url: url,
          filename: filename || "twitter_download",
          saveAs: false,
          conflictAction: "uniquify"
        }, (downloadId) => {
          sendResponse({ success: Boolean(downloadId), downloadId });
        });
      } else {
        sendResponse({ success: false, error: "No URL available" });
      }
      return;
    }

    if (action === "FETCH_MEDIA_BUFFER") {
      const { url } = payload || {};
      if (!url) {
        sendResponse({ success: false, error: "No URL provided" });
        return;
      }
      fetch(url)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          const chunkSize = 8192;
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, chunk);
          }
          const base64 = btoa(binary);
          sendResponse({ success: true, base64 });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      return;
    }

    if (action === "DOWNLOAD_GIF_FILE") {
      const { dataUrl, tweetId, author, screenName, tweetText, quality } = payload || {};
      if (!dataUrl) {
        sendResponse({ success: false, error: "No GIF data provided" });
        return;
      }

      try {
        const itemForGif = { tweetText, tweetId, format: "GIF", quality: quality ? `GIF_${quality}` : "GIF" };
        const fname = await getFormattedTwitterFilename(itemForGif, {
          ...payload,
          isGif: true,
          asGif: true,
          ext: "gif"
        });
        const data = await chrome.storage.local.get("settings");
        const askSave = Boolean(data?.settings?.askSaveLocation);

        intendedDownloadByUrl.set(dataUrl, fname);
        chrome.downloads.download({
          url: dataUrl,
          filename: fname,
          saveAs: askSave
        }, (downloadId) => {
          if (downloadId) {
            intendedDownloadFilenames.set(downloadId, fname);
            intendedDownloadFilenames.set(Number(downloadId), fname);
            intendedDownloadFilenames.set(String(downloadId), fname);
            const resolvedTweetUrl = payload?.pageUrl || (tweetId ? `https://x.com/${screenName || "i"}/status/${tweetId}` : null);
            let resolvedThumb = payload?.thumbnail;
            if (!resolvedThumb || resolvedThumb.startsWith("data:image/gif")) {
              resolvedThumb = tweetId ? `https://pbs.twimg.com/tweet_video_thumb/${tweetId}.jpg` : null;
            }

            trackPendingDownload(downloadId, "gif", {
              title: tweetText || `@${screenName || author || "user"} GIF`,
              filename: fname,
              tweetId: tweetId,
              author: author,
              screenName: screenName,
              tweetText: tweetText,
              tweetTime: payload?.tweetTime || "",
              tweetIsoDate: payload?.tweetIsoDate || "",
              thumbnail: resolvedThumb,
              tweetUrl: resolvedTweetUrl,
              downloadUrl: null,
              clientReqId: payload?.clientReqId || null,
              tabId: sender.tab ? sender.tab.id : null
            });
          }
          sendResponse({ success: Boolean(downloadId), downloadId, clientReqId: payload?.clientReqId || null });
        });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return;
    }

    if (action === "TWITTER_PRIMARY_MEDIA") {
      const tabId = sender.tab ? sender.tab.id : payload?.tabId;
      const item = payload?.item;
      if (tabId && item) {
        if (item.twVideoId) twitterVariantsCache.set(item.twVideoId, item);
        if (item.tweetId) twitterVariantsByTweetId.set(item.tweetId, item);
        if (item.parentTweetId) twitterVariantsByTweetId.set(item.parentTweetId, item);

        chrome.tabs.get(tabId, (tab) => {
          const tabUrl = (tab && tab.url) || "";
          const isTwitterStatus = tabUrl.includes("/status/");
          if (isTwitterStatus) {
            item.id = item.id || ("tw_" + (item.twVideoId || Math.random().toString(36).substring(2, 9)));
            mediaStore.set(tabId, [item]);
            updateBadge(tabId);
            saveSessionState();
          } else {
            addTwitterMediaItem(tabId, item);
          }
        });
        sendResponse({ success: true });
      }
      return;
    }

    if (action === "TWITTER_URL_CHANGED") {
      const tabId = sender.tab ? sender.tab.id : payload?.tabId;
      const { statusTweetId } = payload || {};
      if (tabId) {
        mediaStore.delete(tabId);
        tabMetadataStore.delete(tabId);
        if (statusTweetId && twitterVariantsByTweetId.has(statusTweetId)) {
          const cached = twitterVariantsByTweetId.get(statusTweetId);
          cached.isPrimary = true;
          cached.id = cached.id || ("tw_" + (cached.twVideoId || Math.random().toString(36).substring(2, 9)));
          mediaStore.set(tabId, [cached]);
        }
        updateBadge(tabId);
        saveSessionState();
      }
      sendResponse({ success: true });
      return;
    }

    if (action === "CLEAR_DETECTED_MEDIA") {
      const tabId = payload?.tabId;
      if (tabId) {
        mediaStore.delete(tabId);
        updateBadge(tabId);
        saveSessionState();
      }
      sendResponse({ success: true });
      return;
    }

    if (action === "OPEN_SETTINGS_PAGE") {
      const tabHash = payload?.tabHash || "";
      const baseUrl = chrome.runtime.getURL("settings/settings.html");
      const targetUrl = baseUrl + (tabHash ? `#${tabHash}` : "");

      if (chrome.tabs && chrome.tabs.query) {
        chrome.tabs.query({}, (tabs) => {
          const existingTab = (tabs || []).find(t => {
            if (!t || !t.url) return false;
            return t.url.split("#")[0] === baseUrl;
          });

          if (existingTab && existingTab.id) {
            const updateInfo = { active: true };
            if (tabHash && existingTab.url !== targetUrl) {
              updateInfo.url = targetUrl;
            }
            chrome.tabs.update(existingTab.id, updateInfo, (updatedTab) => {
              const winId = updatedTab?.windowId || existingTab.windowId;
              if (chrome.windows && chrome.windows.update && winId) {
                chrome.windows.update(winId, { focused: true });
              }
            });
          } else if (chrome.tabs.create) {
            chrome.tabs.create({ url: targetUrl });
          } else if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
          }
        });
      } else if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: targetUrl });
      }

      sendResponse({ success: true });
      return;
    }

    if (action === "RESOLVE_TWITTER_MEDIA_URL") {
      const { tweetId, allTweetIds, twVideoId } = payload || {};
      let item = null;
      if (tweetId && twitterVariantsByTweetId.has(tweetId)) {
        item = twitterVariantsByTweetId.get(tweetId);
      }
      if (!item && twVideoId && twitterVariantsCache.has(twVideoId)) {
        item = twitterVariantsCache.get(twVideoId);
      }
      if (!item && Array.isArray(allTweetIds)) {
        for (const tid of allTweetIds) {
          if (tid && twitterVariantsByTweetId.has(tid)) {
            item = twitterVariantsByTweetId.get(tid);
            break;
          }
        }
      }
      const mediaUrl = item?.selectedFormat?.url || item?.url || null;
      sendResponse({ success: Boolean(mediaUrl), url: mediaUrl, item });
      return;
    }

    if (action === "OPEN_DOWNLOADS_FOLDER") {
      chrome.downloads.showDefaultFolder();
      sendResponse({ success: true });
      return;
    }
  })();

  return true;
});
