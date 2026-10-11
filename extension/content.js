// content.js - X Video Downloader Content Script (Twitter / X Dedicated)
// Dibuat oleh Pikuri (https://github.com/Pikurii)

// Cross-browser WebExtensions API compatibility (Chrome, Edge, Opera, Opera GX, Brave, Firefox)
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
} else if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  globalThis.browser = chrome;
}

(function () {
  const isTwitter = window.location.hostname.includes("x.com") || window.location.hostname.includes("twitter.com");
  if (!isTwitter && !window.location.href.includes("test_page.html")) {
    // Strictly do not run on YouTube, Facebook, or any non-target websites
    return;
  }

  // Cross-browser fallback: ensure twitter_interceptor.js runs in MAIN world (vital for Opera GX, Brave & Firefox)
  if (typeof window !== "undefined" && !window.__vdp_twitter_interceptor_active) {
    try {
      const getExtUrl = (typeof chrome !== "undefined" && chrome.runtime?.getURL) ? chrome.runtime.getURL.bind(chrome.runtime) : (typeof browser !== "undefined" && browser.runtime?.getURL) ? browser.runtime.getURL.bind(browser.runtime) : null;
      if (getExtUrl) {
        const scriptEl = document.createElement("script");
        scriptEl.src = getExtUrl("twitter_interceptor.js");
        scriptEl.async = false;
        (document.head || document.documentElement).appendChild(scriptEl);
        scriptEl.onload = () => scriptEl.remove();
      }
    } catch (e) {}
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0 || !isFinite(seconds)) return null;
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  function cleanTitleString(raw) {
    if (!raw) return null;
    let t = raw;
    t = t.replace(/https?:\/\/\S+/gi, "").replace(/httpst?\.co\S*/gi, "").replace(/t\.co\/\S*/gi, "");
    t = t.replace(/^\(\d+\)\s*/, "");
    t = t.replace(/\s*[-–—|]\s*(YouTube|Vimeo|Dailymotion|Facebook|Twitter|X|Instagram|TikTok).*$/i, "");
    t = t.replace(/\s+on\s+X:?\s*/i, " - ").replace(/\s*\/\s*X$/i, "");
    t = t.replace(/[<>:"/\\|?*]/g, "").trim();
    t = t.replace(/\s+/g, " ");
    if (t.length > 70) {
      t = t.substring(0, 70).trim().replace(/\s+\S*$/, "") + "...";
    }
    const lower = t.toLowerCase();
    if (!t || lower === "video" || lower === "x" || lower === "home" || lower === "home / x" || lower.startsWith("home") || lower === "explore" || lower === "notifications" || lower === "messages" || lower === "bookmarks" || lower === "lists" || lower === "profile") {
      return null;
    }
    return t;
  }

  function getTwitterThumbnail() {
    // Priority 1: Meta tag from head
    const twMetaImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (twMetaImg && twMetaImg.content && twMetaImg.content.includes("pbs.twimg.com") && !twMetaImg.content.includes("profile_images")) {
      return twMetaImg.content;
    }

    // Priority 2: Primary tweet article images
    const statusTweetId = window.location.pathname.match(/\/status\/(\d+)/)?.[1];
    let primaryArticle = null;
    if (statusTweetId) {
      const statusLink = document.querySelector(`a[href*="/status/${statusTweetId}"]`);
      primaryArticle = statusLink ? statusLink.closest('article[data-testid="tweet"]') : null;
    }
    if (!primaryArticle) {
      primaryArticle = document.querySelector('article[data-testid="tweet"]');
    }

    if (primaryArticle) {
      const twImg = primaryArticle.querySelector('img[src*="pbs.twimg.com/ext_tw_video_thumb"], img[src*="pbs.twimg.com/amplify_video_thumb"], img[src*="video_thumb"], div[data-testid="videoPlayer"] img, div[data-testid="videoComponent"] img, img[src*="pbs.twimg.com"]');
      if (twImg && twImg.src && !twImg.src.includes("profile_images")) {
        return twImg.src;
      }
    }

    // Priority 3: Any video thumbnail in document.images
    if (document.images && typeof document.images[Symbol.iterator] === "function") {
      for (const img of document.images) {
        if (img.src && (img.src.includes("video_thumb") || img.src.includes("amplify_video_thumb") || img.src.includes("pbs.twimg.com/media")) && !img.src.includes("profile_images")) {
          return img.src;
        }
      }
    }

    // Priority 4: Video poster tag
    const videos = document.querySelectorAll("video");
    for (const v of videos) {
      if (v.poster && v.poster.trim().length > 0 && !v.poster.startsWith("blob:") && !v.poster.startsWith("data:")) {
        return v.poster;
      }
    }

    return null;
  }

  function getPageDuration() {
    const video = document.querySelector("video");
    if (video && video.duration && !isNaN(video.duration) && video.duration > 0 && isFinite(video.duration)) {
      return formatDuration(video.duration);
    }
    return null;
  }

  function syncPageMetadata() {
    const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
    let title = ogTitle ? cleanTitleString(ogTitle.getAttribute("content")?.trim()) : null;
    if (!title) {
      title = cleanTitleString(document.title || "");
    }

    const thumbnail = getTwitterThumbnail();
    const duration = getPageDuration();

    const payload = {
      thumbnail: thumbnail,
      duration: duration,
      videoId: "",
      isYouTube: false,
      url: window.location.href
    };

    if (title && title.toLowerCase() !== "video" && title.toLowerCase() !== "x" && !title.toLowerCase().startsWith("home")) {
      payload.title = title;
    }

    if (payload.title || thumbnail) {
      try {
        chrome.runtime.sendMessage({
          action: "UPDATE_TAB_METADATA",
          payload: payload
        });
      } catch (e) {}
    }
  }

  // Initial metadata sync
  syncPageMetadata();
  window.addEventListener("popstate", () => {
    syncPageMetadata();
    setTimeout(syncPageMetadata, 800);
  });

  // High-Res Twitter media & GIF interceptor cache
  const cachedGifMediaIds = new Set();
  const cachedGifTweetIds = new Set();
  const cachedGifUrlsByTweetId = new Map();

  function registerIfGifItem(item) {
    if (!item) return;
    if (item.isGif || item.quality === "GIF" || item.format === "GIF") {
      if (item.twVideoId) cachedGifMediaIds.add(String(item.twVideoId));
      if (item.tweetId) {
        cachedGifTweetIds.add(String(item.tweetId));
        if (item.url) cachedGifUrlsByTweetId.set(String(item.tweetId), item.url);
      }
      if (item.parentTweetId) {
        cachedGifTweetIds.add(String(item.parentTweetId));
        if (item.url) cachedGifUrlsByTweetId.set(String(item.parentTweetId), item.url);
      }
    }
  }

  // Listen to High-Res Twitter media items from twitter_interceptor.js (MAIN world)
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.source === "VDP_TWITTER_MAIN") {
      if (event.data.type === "CACHE_TWITTER_VARIANTS") {
        const items = event.data.payload?.items;
        if (items && items.length > 0) {
          items.forEach(registerIfGifItem);
          try {
            chrome.runtime.sendMessage({
              action: "CACHE_TWITTER_VARIANTS",
              payload: { items }
            });
          } catch (e) {}
        }
      }

      if (event.data.type === "TWITTER_PRIMARY_MEDIA") {
        const item = event.data.payload?.item;
        if (item && item.url) {
          registerIfGifItem(item);
          try {
            chrome.runtime.sendMessage({
              action: "TWITTER_PRIMARY_MEDIA",
              payload: { item }
            });
          } catch (e) {}
        }
      }

      if (event.data.type === "TWITTER_URL_CHANGED") {
        try {
          chrome.runtime.sendMessage({
            action: "TWITTER_URL_CHANGED",
            payload: event.data.payload
          });
        } catch (e) {}
      }

      if (event.data.type === "TWITTER_MEDIA_VARIANTS") {
        const item = event.data.payload?.item;
        if (item && item.isPrimary && item.url) {
          registerIfGifItem(item);
          try {
            chrome.runtime.sendMessage({
              action: "TWITTER_PRIMARY_MEDIA",
              payload: { item }
            });
          } catch (e) {}
        }
      }
    }
  });

  // Language & settings preference tracking
  let currentLang = "id";
  let contentSettings = {
    autoRevealNsfw: true,
    inTweetBtn: true,
    mediaCornerBadges: true,
    headerDlAll: true,
    gifFormat: "ask",
    defaultQuality: "ask",
    theme: "dark"
  };

  try {
    chrome.storage?.local?.get("settings", (data) => {
      if (data?.settings) {
        if (data.settings.language) currentLang = data.settings.language;
        contentSettings = { ...contentSettings, ...data.settings };
      }
    });
  } catch (e) {}

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings?.newValue) {
        const newVal = changes.settings.newValue;
        if (newVal.language) {
          currentLang = newVal.language;
          document.querySelectorAll(".x-tweet-dl-btn").forEach((btn) => {
            btn.title = currentLang === "en" ? "Download This Video (X Downloader)" : "Unduh Video Ini (X Downloader)";
          });
          document.querySelectorAll(".x-badge-photo").forEach(b => {
            b.title = currentLang === "en" ? "Download High-Res Original Photo" : "Unduh Foto Asli HD";
          });
          document.querySelectorAll(".x-badge-gif").forEach(b => {
            b.title = currentLang === "en" ? "Download Animated GIF" : "Unduh Animasi GIF";
          });
          document.querySelectorAll(".x-badge-video").forEach(b => {
            b.title = currentLang === "en" ? "Download HD Video (MP4)" : "Unduh Video HD (MP4)";
          });
        }
        contentSettings = { ...contentSettings, ...newVal };
        if (newVal.theme) {
          const isLight = newVal.theme === "light";
          if (activeGifModal) {
            activeGifModal.classList.toggle("x-theme-light", isLight);
            activeGifModal.classList.toggle("x-theme-dark", !isLight);
          }
          if (activeQualityModal) {
            activeQualityModal.classList.toggle("x-theme-light", isLight);
            activeQualityModal.classList.toggle("x-theme-dark", !isLight);
          }
        }
        if (newVal.inTweetBtn !== undefined) {
          document.querySelectorAll(".x-tweet-dl-wrapper, .x-tweet-dl-btn, .x-quote-dl-all-wrapper").forEach(el => {
            el.style.display = newVal.inTweetBtn ? "" : "none";
          });
        }
        if (newVal.mediaCornerBadges !== undefined) {
          document.querySelectorAll(".x-media-corner-badge, .x-media-dl-all-badge").forEach(el => {
            el.style.display = newVal.mediaCornerBadges ? "" : "none";
          });
        }
        if (newVal.headerDlAll !== undefined) {
          document.querySelectorAll(".x-tweet-header-dl-all-wrapper").forEach(el => {
            el.style.display = newVal.headerDlAll ? "" : "none";
          });
        }
        if (newVal.inTweetBtn !== undefined || newVal.mediaCornerBadges !== undefined) {
          const hideLightbox = contentSettings.inTweetBtn === false && contentSettings.mediaCornerBadges === false;
          document.querySelectorAll(".x-lightbox-toolbar").forEach(el => {
            el.style.display = hideLightbox ? "none" : "inline-flex";
          });
        }
        if (contentSettings.autoRevealNsfw) {
          try {
            autoRevealSensitiveMedia();
          } catch (e) {}
        }
      }
    });
  }

  // Keyboard shortcut 'D' for quick media download on hovered tweet
  let currentHoveredTweet = null;
  document.addEventListener("mouseover", (e) => {
    currentHoveredTweet = e.target.closest?.('article[data-testid="tweet"]') || null;
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (contentSettings.keyboardShortcut === false) return;
    if (e.key !== "d" && e.key !== "D") return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Do not trigger while typing in input, textarea, or contenteditable
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.isContentEditable ||
      activeEl.getAttribute("role") === "textbox"
    )) {
      return;
    }

    if (!currentHoveredTweet) return;

    // Trigger in-tweet video button or media corner badge
    const dlBtn = currentHoveredTweet.querySelector(".x-tweet-dl-btn");
    if (dlBtn && dlBtn.offsetParent !== null) {
      dlBtn.click();
      return;
    }
    const badgeBtn = currentHoveredTweet.querySelector(".x-corner-badge-btn");
    if (badgeBtn && badgeBtn.offsetParent !== null) {
      badgeBtn.click();
    }
  });

  // Extract twVideoId helper from element or player container
  function extractTwVideoId(containerOrVideo) {
    if (!containerOrVideo) return null;
    if (containerOrVideo.poster) {
      const m = containerOrVideo.poster.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/i);
      if (m) return m[1];
    }
    const img = containerOrVideo.matches?.("img") ? containerOrVideo : containerOrVideo.querySelector?.('img[src*="video_thumb"], img[src*="amplify_video_thumb"], img[src*="pbs.twimg.com/media/"]');
    if (img && img.src) {
      const m = img.src.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/i);
      if (m) return m[1];
    }
    const player = containerOrVideo.closest?.('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]');
    if (player) {
      const pImg = player.querySelector('img[src*="video_thumb"], img[src*="amplify_video_thumb"]');
      if (pImg && pImg.src) {
        const m = pImg.src.match(/(?:ext_tw_video_thumb|amplify_video_thumb)\/(\d+)/i);
        if (m) return m[1];
      }
    }
    return null;
  }

  // Extract author & tweet text helper
  function extractTweetInfo(container) {
    if (!container) return { author: "", screenName: "", text: "" };
    let author = "";
    let screenName = "";
    let text = "";

    const userHeader = container.querySelector('[data-testid="User-Name"]');
    if (userHeader) {
      const spans = Array.from(userHeader.querySelectorAll("span")).map(s => s.textContent.trim()).filter(Boolean);
      const handlePart = spans.find(p => p.startsWith("@"));
      if (handlePart) {
        screenName = handlePart.replace("@", "");
      }
      if (spans.length > 0 && spans[0] !== handlePart && !spans[0].startsWith("@")) {
        author = spans[0];
      }
    }

    // Fallback for quoted tweet cards where User-Name testid might not be used
    if (!author || !screenName) {
      const userLinks = Array.from(container.querySelectorAll('a[href^="/"]')).filter(a => {
        const href = a.getAttribute("href") || "";
        return href.length > 1 && !href.includes("/status/") && !href.includes("/hashtag/") && !href.includes("/search") && !href.includes("/i/");
      });
      for (const a of userLinks) {
        const handle = a.getAttribute("href").replace(/^\//, "").split("/")[0].split("?")[0];
        if (handle && !screenName) {
          screenName = handle;
        }
        const textContent = a.textContent.trim();
        if (textContent && !textContent.startsWith("@") && !author) {
          author = textContent;
        }
      }
    }

    const tweetTextEl = container.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl) {
      text = tweetTextEl.innerText?.trim() || "";
    } else {
      const textContainers = Array.from(container.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
      for (const tc of textContainers) {
        if (!tc.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"], a, button')) {
          const t = tc.innerText?.trim();
          if (t && t.length > 5 && !t.startsWith("@") && t !== author) {
            text = t;
            break;
          }
        }
      }
    }

    const timeEl = container.querySelector("time") || container.closest("article")?.querySelector("time");
    let tweetTime = "";
    let tweetIsoDate = "";
    if (timeEl) {
      tweetIsoDate = timeEl.getAttribute("datetime") || "";
      tweetTime = timeEl.textContent?.trim() || "";
    }

    return { author, screenName, text, tweetTime, tweetIsoDate };
  }

  // Dedicated In-Tweet Action Bar Download Button for Twitter/X
  const injectedTweets = new WeakSet();
  const linkedVideoIds = new Set();

  // Helper to detect if a media player container is a Twitter GIF
  function isTwitterGif(container, videoEl, targetTweetId) {
    if (targetTweetId && cachedGifTweetIds.has(String(targetTweetId))) return true;

    if (!container && !videoEl) return false;
    const el = container || videoEl;

    // Check twVideoId
    const twVidId = extractTwVideoId(el);
    if (twVidId && cachedGifMediaIds.has(String(twVidId))) return true;

    // Search root within element or its parent media container / tweetPhoto
    const searchRoot = el.closest?.('div[data-testid="tweetPhoto"], div[role="link"]:not([role="group"]), div[aria-label="Embedded video"]') || el.parentElement || el;

    // 1. Direct aria-label on container or children in searchRoot
    const aria = (el.getAttribute?.("aria-label") || "") + " " + (searchRoot.getAttribute?.("aria-label") || "");
    if (aria.toLowerCase().includes("gif")) return true;

    const gifAriaEls = searchRoot.querySelectorAll?.('[aria-label*="GIF" i], [aria-label*="gif" i]') || [];
    if (gifAriaEls.length > 0) return true;

    // 2. Twitter renders a badge pill in the bottom-left of the media with text "GIF" or "❚❚ GIF"
    const badges = searchRoot.querySelectorAll?.('span, div[role="button"], button') || [];
    for (const b of badges) {
      if (b.closest?.('[data-testid="tweetText"]')) continue;
      const txt = (b.textContent || "").trim();
      if (txt === "GIF" || txt.endsWith(" GIF") || txt.startsWith("GIF ") || txt.includes(" GIF")) {
        return true;
      }
    }

    // 3. Poster or video src URL patterns
    const poster = videoEl?.poster || el.querySelector?.("img")?.src || "";
    if (poster.includes("tweet_video_thumb") || poster.includes("tweet_video") || poster.includes("/tweet_video/")) return true;

    const vSrc = videoEl?.src || videoEl?.currentSrc || "";
    if (vSrc.includes("tweet_video") || vSrc.includes("/tweet_video/")) return true;

    // 4. Video attributes: looping without scrub bar or volume controls
    if (videoEl && (videoEl.hasAttribute?.("loop") || videoEl.loop === true)) {
      if (!poster.includes("ext_tw_video_thumb") && !poster.includes("amplify_video_thumb")) {
        return true;
      }
      const hasControls = searchRoot.querySelector?.('[aria-label*="Seek" i], [aria-label*="Mute" i], [aria-label*="Volume" i], [role="slider"]');
      if (!hasControls) return true;
    }

    return false;
  }

  // Helper to resolve the direct master MP4 URL for Twitter GIFs
  function resolveGifDirectUrl(container, videoEl, targetTweetId) {
    if (targetTweetId && cachedGifUrlsByTweetId.has(String(targetTweetId))) {
      return cachedGifUrlsByTweetId.get(String(targetTweetId));
    }
    const vSrc = videoEl?.src || videoEl?.currentSrc || "";
    if (vSrc && vSrc.includes("tweet_video") && vSrc.startsWith("http") && !vSrc.startsWith("blob:")) {
      return vSrc;
    }
    const searchRoot = container?.closest?.('div[data-testid="tweetPhoto"], div[role="link"]:not([role="group"]), div[aria-label="Embedded video"]') || container;
    const poster = videoEl?.poster || "";
    const m = poster.match(/(?:tweet_video_thumb|tweet_video)\/([a-zA-Z0-9_-]+)/i);
    if (m && m[1]) {
      return `https://video.twimg.com/tweet_video/${m[1]}.mp4`;
    }
    if (searchRoot) {
      const imgs = Array.from(searchRoot.querySelectorAll?.("img") || []);
      for (const img of imgs) {
        const match = (img.src || "").match(/(?:tweet_video_thumb|tweet_video)\/([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          return `https://video.twimg.com/tweet_video/${match[1]}.mp4`;
        }
      }
    }
    return null;
  }

  // ==================== SPEC-COMPLIANT HIGH-PERFORMANCE GIF89a ENCODER ====================
  function createGifEncoder(width, height) {
    const buf = [];
    let p = 0;

    // Header: GIF89a
    buf[p++] = 0x47; buf[p++] = 0x49; buf[p++] = 0x46; // GIF
    buf[p++] = 0x38; buf[p++] = 0x39; buf[p++] = 0x61; // 89a

    // Logical Screen Descriptor
    buf[p++] = width & 0xFF; buf[p++] = (width >> 8) & 0xFF;
    buf[p++] = height & 0xFF; buf[p++] = (height >> 8) & 0xFF;
    buf[p++] = 0x00; // No Global Color Table
    buf[p++] = 0x00; // Background Color Index
    buf[p++] = 0x00; // Pixel Aspect Ratio

    // Netscape Application Extension (Infinite Animation Loop)
    buf[p++] = 0x21; buf[p++] = 0xFF; buf[p++] = 0x0B;
    // NETSCAPE2.0
    buf[p++] = 0x4E; buf[p++] = 0x45; buf[p++] = 0x54; buf[p++] = 0x53;
    buf[p++] = 0x43; buf[p++] = 0x41; buf[p++] = 0x50; buf[p++] = 0x45;
    buf[p++] = 0x32; buf[p++] = 0x2E; buf[p++] = 0x30;
    buf[p++] = 0x03; buf[p++] = 0x01;
    buf[p++] = 0x00; buf[p++] = 0x00; // loop count 0 = loop forever
    buf[p++] = 0x00; // terminator

    // LZW Output Stream (Spec-compliant GIF89a Variable-Bit LZW)
    function writeLzwCodeStream(minCodeSize, indexStream) {
      buf[p++] = minCodeSize;
      let curSubblock = p++;

      const clearCode = 1 << minCodeSize;
      const codeMask = clearCode - 1;
      const eoiCode = clearCode + 1;
      let nextCode = eoiCode + 1;

      let curCodeSize = minCodeSize + 1;
      let curShift = 0;
      let cur = 0;

      function emitCode(c) {
        cur |= c << curShift;
        curShift += curCodeSize;
        while (curShift >= 8) {
          buf[p++] = cur & 0xFF;
          cur >>= 8;
          curShift -= 8;
          if (p === curSubblock + 256) {
            buf[curSubblock] = 255;
            curSubblock = p++;
          }
        }
      }

      let ibCode = indexStream[0] & codeMask;
      let codeTable = Object.create(null);

      emitCode(clearCode);

      for (let i = 1, len = indexStream.length; i < len; ++i) {
        const k = indexStream[i] & codeMask;
        const curKey = (ibCode << 8) | k;
        const curCode = codeTable[curKey];

        if (curCode === undefined) {
          // Emit current index buffer
          cur |= ibCode << curShift;
          curShift += curCodeSize;
          while (curShift >= 8) {
            buf[p++] = cur & 0xFF;
            cur >>= 8;
            curShift -= 8;
            if (p === curSubblock + 256) {
              buf[curSubblock] = 255;
              curSubblock = p++;
            }
          }

          if (nextCode === 4096) {
            emitCode(clearCode);
            nextCode = eoiCode + 1;
            curCodeSize = minCodeSize + 1;
            codeTable = Object.create(null);
          } else {
            if (nextCode >= (1 << curCodeSize)) {
              ++curCodeSize;
            }
            codeTable[curKey] = nextCode++;
          }
          ibCode = k;
        } else {
          ibCode = curCode;
        }
      }

      emitCode(ibCode);
      emitCode(eoiCode);

      // Flush remaining bits
      while (curShift > 0) {
        buf[p++] = cur & 0xFF;
        cur >>= 8;
        curShift -= 8;
        if (p === curSubblock + 256) {
          buf[curSubblock] = 255;
          curSubblock = p++;
        }
      }

      // Finish subblock
      if (curSubblock + 1 === p) {
        buf[curSubblock] = 0;
      } else {
        buf[curSubblock] = p - curSubblock - 1;
        buf[p++] = 0;
      }
    }

    function quantizeFrame(rgbaData, w, h, quality = "medium") {
      const pixelCount = w * h;
      const palette = new Uint8Array(256 * 3);
      const indexedPixels = new Uint8Array(pixelCount);

      const step = quality === "small" ? 4 : (quality === "medium" ? 2 : 1);
      const colorMap = new Map();

      for (let i = 0; i < rgbaData.length; i += 4 * step) {
        const r = rgbaData[i] >> 3;
        const g = rgbaData[i + 1] >> 3;
        const b = rgbaData[i + 2] >> 3;
        const key = (r << 10) | (g << 5) | b;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }

      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 256);

      const palR = new Uint8Array(256);
      const palG = new Uint8Array(256);
      const palB = new Uint8Array(256);

      for (let i = 0; i < 256; i++) {
        if (i < sortedColors.length) {
          const key = sortedColors[i][0];
          const r = ((key >> 10) & 0x1F) << 3;
          const g = ((key >> 5) & 0x1F) << 3;
          const b = (key & 0x1F) << 3;
          palR[i] = r;
          palG[i] = g;
          palB[i] = b;
          palette[i * 3] = r;
          palette[i * 3 + 1] = g;
          palette[i * 3 + 2] = b;
        } else {
          palR[i] = 0;
          palG[i] = 0;
          palB[i] = 0;
          palette[i * 3] = 0;
          palette[i * 3 + 1] = 0;
          palette[i * 3 + 2] = 0;
        }
      }

      const palCount = Math.min(sortedColors.length, 256) || 1;
      const lookupCache = new Map();

      for (let pix = 0; pix < pixelCount; pix++) {
        const offset = pix * 4;
        const r = rgbaData[offset];
        const g = rgbaData[offset + 1];
        const b = rgbaData[offset + 2];
        const rgbKey = (r << 16) | (g << 8) | b;

        if (lookupCache.has(rgbKey)) {
          indexedPixels[pix] = lookupCache.get(rgbKey);
        } else {
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < palCount; i++) {
            const dr = r - palR[i];
            const dg = g - palG[i];
            const db = b - palB[i];
            const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
              if (dist === 0) break;
            }
          }
          lookupCache.set(rgbKey, bestIdx);
          indexedPixels[pix] = bestIdx;
        }
      }

      return { palette, indexedPixels };
    }

    function addFrame(rgbaData, frameWidth, frameHeight, delayMs = 100, quality = "medium") {
      const { palette, indexedPixels } = quantizeFrame(rgbaData, frameWidth, frameHeight, quality);

      // Graphic Control Extension (8 bytes)
      buf[p++] = 0x21; // Extension Introducer
      buf[p++] = 0xF9; // Graphic Control Label
      buf[p++] = 0x04; // Block Size (4 bytes)
      buf[p++] = 0x04; // Disposal Method 1 (do not dispose, leave in place)
      const delayHundredths = Math.max(1, Math.round(delayMs / 10));
      buf[p++] = delayHundredths & 0xFF;
      buf[p++] = (delayHundredths >> 8) & 0xFF;
      buf[p++] = 0x00; // Transparent Color Index
      buf[p++] = 0x00; // Block Terminator

      // Image Descriptor (10 bytes)
      buf[p++] = 0x2C; // Image Separator
      buf[p++] = 0x00; buf[p++] = 0x00; // Left: 0
      buf[p++] = 0x00; buf[p++] = 0x00; // Top: 0
      buf[p++] = frameWidth & 0xFF; buf[p++] = (frameWidth >> 8) & 0xFF;
      buf[p++] = frameHeight & 0xFF; buf[p++] = (frameHeight >> 8) & 0xFF;
      buf[p++] = 0x87; // Local Color Table Present, 256 colors (2^(7+1) = 256)

      // Local Color Table (256 * 3 = 768 bytes)
      for (let i = 0; i < 768; i++) {
        buf[p++] = palette[i];
      }

      // LZW Image Data
      writeLzwCodeStream(8, indexedPixels);
    }

    function finish() {
      buf[p++] = 0x3B; // GIF Trailer
      return new Uint8Array(buf.slice(0, p));
    }

    return { addFrame, finish };
  }

  const GIF_PRESETS = {
    "gif-small": {
      maxWidth: 320,
      fps: 10,
      quality: "small",
      label: "Small"
    },
    "gif-medium": {
      maxWidth: 480,
      fps: 12,
      quality: "medium",
      label: "Medium"
    },
    "gif-original": {
      maxWidth: 720,
      fps: 15,
      quality: "original",
      label: "Original"
    }
  };

  async function convertMp4ToGif(mp4Url, presetKey, onProgress) {
    const preset = GIF_PRESETS[presetKey] || GIF_PRESETS["gif-medium"];
    if (onProgress) onProgress(5, "5%");

    // Fetch MP4 buffer via background script to bypass CSP/CORS
    const fetchRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "FETCH_MEDIA_BUFFER",
        payload: { url: mp4Url }
      }, (res) => resolve(res));
    });

    if (!fetchRes || !fetchRes.success || !fetchRes.base64) {
      throw new Error(fetchRes?.error || "Gagal mengunduh stream video");
    }

    const binary = atob(fetchRes.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const videoBlob = new Blob([bytes], { type: "video/mp4" });
    const localBlobUrl = URL.createObjectURL(videoBlob);

    if (onProgress) onProgress(15, "15%");

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = localBlobUrl;

    await new Promise((resolve, reject) => {
      let done = false;
      const onReady = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      video.addEventListener("loadeddata", onReady, { once: true });
      video.addEventListener("canplay", onReady, { once: true });
      video.onerror = () => reject(new Error("Gagal memuat video GIF"));
      setTimeout(onReady, 2500);
      video.load();
    });

    const duration = Math.min(video.duration || 3, 30);
    let origW = video.videoWidth || 480;
    let origH = video.videoHeight || 480;

    let targetW = origW;
    let targetH = origH;
    if (targetW > preset.maxWidth) {
      targetH = Math.round((targetH * preset.maxWidth) / targetW);
      targetW = preset.maxWidth;
    }
    if (targetW % 2 !== 0) targetW--;
    if (targetH % 2 !== 0) targetH--;
    if (targetW <= 0) targetW = 200;
    if (targetH <= 0) targetH = 200;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const encoder = createGifEncoder(targetW, targetH);
    const fps = preset.fps;
    const frameStep = 1 / fps;
    const delayMs = Math.round(frameStep * 1000);
    const totalFrames = Math.max(1, Math.floor(duration / frameStep));
    let frameIdx = 0;
    let capturedThumbUrl = null;

    // Start with a slight offset to avoid pitch-black initial frame before video decoding
    const startOffset = Math.min(0.06, duration * 0.05);

    for (let currentTime = startOffset; currentTime < duration; currentTime += frameStep) {
      video.currentTime = Math.min(currentTime, duration - 0.01);
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 300);
        const onSeeked = () => {
          clearTimeout(timer);
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked, { once: true });
      });

      ctx.drawImage(video, 0, 0, targetW, targetH);
      const imgData = ctx.getImageData(0, 0, targetW, targetH);
      encoder.addFrame(imgData.data, targetW, targetH, delayMs, preset.quality);

      if (!capturedThumbUrl && frameIdx === 0) {
        try {
          const tCanvas = document.createElement("canvas");
          tCanvas.width = 120;
          tCanvas.height = Math.max(60, Math.round((120 * targetH) / targetW));
          const tctx = tCanvas.getContext("2d");
          tctx.drawImage(canvas, 0, 0, tCanvas.width, tCanvas.height);
          capturedThumbUrl = tCanvas.toDataURL("image/jpeg", 0.75);
        } catch (e) {}
      }

      frameIdx++;
      const pct = Math.min(95, 15 + Math.round((frameIdx / totalFrames) * 80));
      if (onProgress) onProgress(pct, `${pct}%`);
    }

    if (onProgress) onProgress(98, "98%");
    const gifBytes = encoder.finish();
    URL.revokeObjectURL(localBlobUrl);

    let dataUrl = "";
    try {
      const gifBlob = new Blob([gifBytes], { type: "image/gif" });
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Gagal membaca blob GIF"));
        reader.readAsDataURL(gifBlob);
      });
    } catch (e) {
      let binaryGif = "";
      const chunkSize = 8192;
      for (let i = 0; i < gifBytes.length; i += chunkSize) {
        const chunk = gifBytes.subarray(i, Math.min(i + chunkSize, gifBytes.length));
        binaryGif += String.fromCharCode.apply(null, chunk);
      }
      dataUrl = "data:image/gif;base64," + btoa(binaryGif);
    }

    return {
      dataUrl,
      capturedThumbUrl
    };
  }

  let activeGifModal = null;

  function ensureGifModalStyles() {
    if (document.getElementById("x-vault-gif-modal-styles")) return;
    const style = document.createElement("style");
    style.id = "x-vault-gif-modal-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen:wght@400;700&family=Space+Mono:wght@400;700&display=swap');

      @keyframes xVaultDropdownDown {
        0% { opacity: 0; transform: translateY(-8px) scale(0.97); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes xVaultDropdownUp {
        0% { opacity: 0; transform: translateY(8px) scale(0.97); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }

      .x-gif-picker-popup {
        position: fixed;
        z-index: 2147483647;
        width: 295px;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        box-shadow: 0 16px 38px -8px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(226, 232, 240, 0.9);
        padding: 12px 13px 10px;
        font-family: "Space Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #0f172a;
        box-sizing: border-box;
        user-select: none;
      }
      .x-gif-picker-popup.open-down {
        animation: xVaultDropdownDown 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transform-origin: top right;
      }
      .x-gif-picker-popup.open-up {
        animation: xVaultDropdownUp 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transform-origin: bottom right;
      }

      /* Section Label */
      .x-gif-picker-section-title {
        font-family: "Silkscreen", "Press Start 2P", monospace;
        font-size: 8.5px;
        font-weight: 700;
        letter-spacing: 0.7px;
        color: #64748b;
        text-transform: uppercase;
        margin: 6px 0 5px;
        line-height: 1.2;
      }

      /* Option Card */
      .x-gif-picker-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        width: 100%;
        text-align: left;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 7px 10px;
        margin-bottom: 4px;
        cursor: pointer;
        box-sizing: border-box;
        transition: all 0.14s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .x-gif-picker-card:hover {
        background: #f0f9ff;
        border-color: #38bdf8;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.08);
        transform: translateY(-1px);
      }
      .x-gif-picker-card:active {
        background: #e0f2fe;
        transform: translateY(0);
      }
      .x-gif-card-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .x-gif-card-title {
        font-family: "Space Mono", ui-monospace, SFMono-Regular, monospace;
        font-size: 11.5px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
      }
      .x-gif-card-desc {
        font-size: 9.5px;
        color: #64748b;
        margin-top: 1.5px;
        line-height: 1.2;
      }

      /* Badge Pills */
      .x-gif-card-tag {
        font-family: monospace;
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 5px;
        letter-spacing: 0.5px;
        flex-shrink: 0;
      }
      .tag-mp4 {
        background: #e0f2fe;
        color: #0284c7;
        border: 1px solid #bae6fd;
      }
      .tag-sm {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
      }
      .tag-med {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
      }
      .tag-orig {
        background: #fdf4ff;
        color: #a21caf;
        border: 1px solid #f0abfc;
      }

      /* Footer */
      .x-gif-picker-footer {
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid #e2e8f0;
      }
      .x-gif-remember-label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 10.5px;
        font-weight: 600;
        color: #334155;
        user-select: none;
      }
      .x-gif-remember-checkbox {
        appearance: none;
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border: 1.5px solid #cbd5e1;
        border-radius: 3.5px;
        background: #ffffff;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }
      .x-gif-remember-checkbox:checked {
        background: #1d9bf0;
        border-color: #1d9bf0;
      }
      .x-gif-remember-checkbox:checked::before {
        content: "";
        width: 6.5px;
        height: 3px;
        border-left: 2px solid #ffffff;
        border-bottom: 2px solid #ffffff;
        transform: rotate(-45deg) translate(0.5px, -0.5px);
      }
      .x-gif-footer-note {
        font-size: 9px;
        color: #94a3b8;
        line-height: 1.3;
        margin-top: 4px;
      }
      .x-gif-settings-link {
        color: #1d9bf0;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
      }
      .x-gif-settings-link:hover {
        text-decoration: underline;
      }
      .x-gif-footer-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
        padding-top: 4px;
        border-top: 1px dashed #f1f5f9;
        font-size: 8px;
        font-family: monospace;
      }
      .x-gif-brand-tag {
        color: #94a3b8;
        font-weight: 700;
      }

      /* ========================================================= */
      /* THEME: LIGHT (.x-theme-light) - Matches Extension Popup Light Mode */
      /* ========================================================= */
      .x-theme-light.x-gif-picker-popup {
        background: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.06) !important;
        color: #0f172a !important;
      }
      .x-theme-light .x-gif-picker-section-title {
        color: #64748b !important;
      }
      .x-theme-light .x-gif-picker-card {
        background: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
      }
      .x-theme-light .x-gif-picker-card:hover {
        background: #f0f9ff !important;
        border-color: #38bdf8 !important;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12) !important;
      }
      .x-theme-light .x-gif-picker-card:active {
        background: #e0f2fe !important;
      }
      .x-theme-light .x-gif-card-title {
        color: #0f172a !important;
      }
      .x-theme-light .x-gif-card-desc {
        color: #64748b !important;
      }
      .x-theme-light .tag-mp4 {
        background: #e0f2fe !important;
        color: #0284c7 !important;
        border: 1px solid #bae6fd !important;
      }
      .x-theme-light .tag-orig {
        background: #fdf4ff !important;
        color: #a21caf !important;
        border: 1px solid #f0abfc !important;
      }
      .x-theme-light .tag-med {
        background: #ecfdf5 !important;
        color: #059669 !important;
        border: 1px solid #a7f3d0 !important;
      }
      .x-theme-light .tag-sm {
        background: #f1f5f9 !important;
        color: #475569 !important;
        border: 1px solid #cbd5e1 !important;
      }
      .x-theme-light .x-gif-picker-footer {
        border-top: 1px solid #e2e8f0 !important;
      }
      .x-theme-light .x-gif-remember-label {
        color: #334155 !important;
      }
      .x-theme-light .x-gif-remember-checkbox {
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1 !important;
      }
      .x-theme-light .x-gif-remember-checkbox:checked {
        background: #1d9bf0 !important;
        border-color: #1d9bf0 !important;
      }
      .x-theme-light .x-gif-footer-bottom {
        border-top: 1px dashed #e2e8f0 !important;
      }
      .x-theme-light .x-gif-footer-note,
      .x-theme-light .x-gif-brand-tag {
        color: #94a3b8 !important;
      }
      .x-theme-light .x-gif-settings-link {
        color: #1d9bf0 !important;
      }

      /* ========================================================= */
      /* THEME: DARK (.x-theme-dark) - Matches Extension Popup Dark Mode */
      /* ========================================================= */
      .x-theme-dark.x-gif-picker-popup {
        background: #090d16 !important;
        border: 1px solid #1e293b !important;
        box-shadow: 0 20px 48px rgba(0, 0, 0, 0.85), 0 2px 10px rgba(0, 0, 0, 0.6) !important;
        color: #f8fafc !important;
      }
      .x-theme-dark .x-gif-picker-section-title {
        color: #94a3b8 !important;
      }
      .x-theme-dark .x-gif-picker-card {
        background: #131929 !important;
        border: 1px solid #1e293b !important;
      }
      .x-theme-dark .x-gif-picker-card:hover {
        background: #192238 !important;
        border-color: #38bdf8 !important;
        box-shadow: 0 4px 16px rgba(29, 155, 240, 0.25) !important;
      }
      .x-theme-dark .x-gif-picker-card:active {
        background: #222d48 !important;
      }
      .x-theme-dark .x-gif-card-title {
        color: #f8fafc !important;
      }
      .x-theme-dark .x-gif-card-desc {
        color: #94a3b8 !important;
      }
      .x-theme-dark .tag-mp4 {
        background: rgba(2, 132, 199, 0.22) !important;
        color: #38bdf8 !important;
        border: 1px solid rgba(56, 189, 248, 0.35) !important;
      }
      .x-theme-dark .tag-orig {
        background: rgba(162, 28, 175, 0.22) !important;
        color: #f0abfc !important;
        border: 1px solid rgba(240, 171, 252, 0.35) !important;
      }
      .x-theme-dark .tag-med {
        background: rgba(16, 185, 129, 0.22) !important;
        color: #34d399 !important;
        border: 1px solid rgba(52, 211, 153, 0.35) !important;
      }
      .x-theme-dark .tag-sm {
        background: rgba(148, 163, 184, 0.18) !important;
        color: #cbd5e1 !important;
        border: 1px solid rgba(203, 213, 225, 0.28) !important;
      }
      .x-theme-dark .x-gif-picker-footer {
        border-top: 1px solid #1e293b !important;
      }
      .x-theme-dark .x-gif-remember-label {
        color: #cbd5e1 !important;
      }
      .x-theme-dark .x-gif-remember-checkbox {
        background: #131929 !important;
        border: 1.5px solid #334155 !important;
      }
      .x-theme-dark .x-gif-remember-checkbox:checked {
        background: #1d9bf0 !important;
        border-color: #1d9bf0 !important;
      }
      .x-theme-dark .x-gif-footer-bottom {
        border-top: 1px dashed #1e293b !important;
      }
      .x-theme-dark .x-gif-footer-note,
      .x-theme-dark .x-gif-brand-tag {
        color: #64748b !important;
      }
      .x-theme-dark .x-gif-settings-link {
        color: #38bdf8 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function showGifFormatModal({ anchorEl, onSelect, onCancel }) {
    if (activeGifModal) {
      activeGifModal.remove();
      activeGifModal = null;
    }

    ensureGifModalStyles();

    const isEn = currentLang === "en";
    const i18n = {
      saveAs: isEn ? "SAVE ANIMATED GIF AS" : "SIMPAN ANIMASI GIF SEBAGAI",
      mp4Title: isEn ? "MP4 Video" : "Video MP4",
      mp4Desc: isEn ? "Smaller file, original quality" : "Ukuran lebih kecil, kualitas asli",
      qualitySection: isEn ? "GIF QUALITY (GIF89a)" : "KUALITAS GIF (GIF89a)",
      smallTitle: isEn ? "Small (320p)" : "Small (320p)",
      smallDesc: isEn ? "Smallest file, lowest quality" : "Ukuran terkecil, proses cepat",
      mediumTitle: isEn ? "Medium (480p)" : "Medium (480p)",
      mediumDesc: isEn ? "Balanced quality & size" : "Kualitas & ukuran seimbang",
      originalTitle: isEn ? "Original HD" : "Original HD",
      originalDesc: isEn ? "Original size, largest file" : "Resolusi asli, ukuran maksimal",
      rememberChoice: isEn ? "Remember choice" : "Ingat pilihan ini",
      footerNote: isEn
        ? 'Applies only to animated GIFs. You can change this in extension <span class="x-gif-settings-link">Settings</span>.'
        : 'Hanya berlaku untuk animasi GIF. Dapat diubah di <span class="x-gif-settings-link">Pengaturan</span> ekstensi.',
      byPikuri: "BY PIKURI",
      escToClose: isEn ? "ESC TO CLOSE" : "ESC TUTUP"
    };

    const popup = document.createElement("div");
    popup.className = "x-gif-picker-popup";
    const currentTheme = contentSettings.theme === "light" ? "light" : "dark";
    popup.classList.add(currentTheme === "light" ? "x-theme-light" : "x-theme-dark");

    popup.innerHTML = `
      <div class="x-gif-picker-section-title" style="margin-top: 2px;">${i18n.saveAs}</div>
      <div class="x-gif-picker-card" data-format="mp4">
        <div class="x-gif-card-content">
          <div class="x-gif-card-title">${i18n.mp4Title}</div>
          <div class="x-gif-card-desc">${i18n.mp4Desc}</div>
        </div>
        <span class="x-gif-card-tag tag-mp4">MP4</span>
      </div>

      <div class="x-gif-picker-section-title" style="margin-top: 8px;">${i18n.qualitySection}</div>
      <div class="x-gif-picker-card" data-format="gif-small">
        <div class="x-gif-card-content">
          <div class="x-gif-card-title">${i18n.smallTitle}</div>
          <div class="x-gif-card-desc">${i18n.smallDesc}</div>
        </div>
        <span class="x-gif-card-tag tag-sm">SM</span>
      </div>
      <div class="x-gif-picker-card" data-format="gif-medium">
        <div class="x-gif-card-content">
          <div class="x-gif-card-title">${i18n.mediumTitle}</div>
          <div class="x-gif-card-desc">${i18n.mediumDesc}</div>
        </div>
        <span class="x-gif-card-tag tag-med">MED</span>
      </div>
      <div class="x-gif-picker-card" data-format="gif-original">
        <div class="x-gif-card-content">
          <div class="x-gif-card-title">${i18n.originalTitle}</div>
          <div class="x-gif-card-desc">${i18n.originalDesc}</div>
        </div>
        <span class="x-gif-card-tag tag-orig">MAX</span>
      </div>

      <div class="x-gif-picker-footer">
        <label class="x-gif-remember-label">
          <input type="checkbox" class="x-gif-remember-checkbox" id="xGifRememberChoice">
          <span>${i18n.rememberChoice}</span>
        </label>
        <div class="x-gif-footer-note">${i18n.footerNote}</div>
        <div class="x-gif-footer-bottom">
          <span class="x-gif-brand-tag">${i18n.byPikuri}</span>
          <span class="x-gif-brand-tag" style="color: #64748b;">${i18n.escToClose}</span>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
    activeGifModal = popup;

    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { top: 100, right: 300, bottom: 140, left: 200, width: 30, height: 30 };
    const modalWidth = 295;
    const modalHeight = popup.offsetHeight || 280;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = 0;
    let openDirection = "down";

    if (spaceBelow >= modalHeight + 10) {
      top = rect.bottom + 6;
      openDirection = "down";
    } else if (spaceAbove >= modalHeight + 10) {
      top = rect.top - modalHeight - 6;
      openDirection = "up";
    } else {
      if (spaceBelow >= spaceAbove) {
        top = rect.bottom + 6;
        openDirection = "down";
      } else {
        top = rect.top - modalHeight - 6;
        openDirection = "up";
      }
    }

    top = Math.max(8, Math.min(window.innerHeight - modalHeight - 8, top));

    let left = rect.right - modalWidth;
    if (left < 10) {
      left = rect.left;
    }
    left = Math.max(10, Math.min(window.innerWidth - modalWidth - 10, left));

    popup.classList.add(openDirection === "down" ? "open-down" : "open-up");
    popup.style.top = `${Math.round(top)}px`;
    popup.style.left = `${Math.round(left)}px`;

    const rememberCheck = popup.querySelector("#xGifRememberChoice");

    popup.querySelectorAll(".x-gif-picker-card").forEach(card => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const chosenFormat = card.getAttribute("data-format");
        const shouldRemember = rememberCheck ? rememberCheck.checked : false;

        if (shouldRemember) {
          contentSettings.gifFormat = chosenFormat;
          try {
            chrome.storage?.local?.get("settings", (data) => {
              const updated = { ...(data?.settings || {}), gifFormat: chosenFormat };
              chrome.storage?.local?.set({ settings: updated });
            });
          } catch (e) {}
        }

        cleanup();
        if (onSelect) onSelect(chosenFormat);
      });
    });

    const settingsLink = popup.querySelector(".x-gif-settings-link");
    if (settingsLink) {
      settingsLink.addEventListener("click", (e) => {
        e.stopPropagation();
        cleanup();
        try {
          chrome.runtime.sendMessage({ action: "OPEN_SETTINGS_PAGE" });
        } catch (e) {}
      });
    }

    function onScrollOrResize() {
      cleanup();
      if (onCancel) onCancel();
    }

    function onDocClick(e) {
      if (popup && !popup.contains(e.target) && (!anchorEl || !anchorEl.contains(e.target))) {
        cleanup();
        if (onCancel) onCancel();
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cleanup();
        if (onCancel) onCancel();
      }
    }

    popup.addEventListener("keydown", (e) => e.stopPropagation());

    function cleanup() {
      document.removeEventListener("pointerdown", onDocClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
      if (popup.parentElement) {
        popup.remove();
      }
      if (activeGifModal === popup) {
        activeGifModal = null;
      }
    }

    setTimeout(() => {
      document.addEventListener("pointerdown", onDocClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
      window.addEventListener("resize", onScrollOrResize, { passive: true });
    }, 50);
  }

  // Live Video Quality Selector Popover ("Ask Every Time" and Right-Click Quality Chooser)
  let activeQualityModal = null;

  function showVideoQualityModal({ anchorEl, twVideoId, targetTweetId, outerTweetId, quotedTweetId, directMediaUrl, onSelect, onCancel }) {
    if (activeQualityModal) {
      activeQualityModal.remove();
      activeQualityModal = null;
    }

    ensureGifModalStyles();

    const isEn = currentLang === "en";
    const i18n = {
      title: isEn ? "SELECT VIDEO QUALITY" : "PILIH KUALITAS VIDEO",
      rememberChoice: isEn ? "Remember choice" : "Ingat pilihan ini",
      audioTitle: isEn ? "Audio Only (MP3)" : "Audio Saja (MP3)",
      audioDesc: isEn ? "Extract high quality audio without video" : "Ekstrak audio tanpa video",
      footerNote: isEn
        ? 'You can change this anytime in extension <span class="x-gif-settings-link">Settings</span>.'
        : 'Dapat diubah kapan saja di <span class="x-gif-settings-link">Pengaturan</span> ekstensi.',
      byPikuri: "BY PIKURI",
      escToClose: isEn ? "ESC TO CLOSE" : "ESC TUTUP"
    };

    const popup = document.createElement("div");
    popup.className = "x-gif-picker-popup";
    const currentTheme = contentSettings.theme === "light" ? "light" : "dark";
    popup.classList.add(currentTheme === "light" ? "x-theme-light" : "x-theme-dark");

    chrome.runtime.sendMessage({
      action: "GET_VIDEO_FORMATS",
      payload: {
        twVideoId,
        tweetId: targetTweetId,
        outerTweetId,
        allTweetIds: [targetTweetId, outerTweetId, quotedTweetId].filter(Boolean)
      }
    }, (res) => {
      const formats = (Array.isArray(res?.formats) ? res.formats : []).filter(f => Boolean(f.url));

      let cardsHtml = "";
      if (formats.length > 0) {
        formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        formats.forEach((f, idx) => {
          let qLabel = f.quality || "HD";
          if (!qLabel.toLowerCase().includes("p") && f.resolution) {
            const h = f.resolution.split("x")[1];
            if (h) qLabel = `${h}p`;
          }
          let resDesc = f.resolution ? `${f.resolution}` : "";
          if (f.bitrate) {
            const mbps = (f.bitrate / 1000000).toFixed(1);
            resDesc += resDesc ? ` · ~${mbps} Mbps` : `~${mbps} Mbps`;
          }
          if (idx === 0) {
            resDesc += isEn ? " (Highest)" : " (Tertinggi)";
          }

          let tagClass = "tag-mp4";
          if (qLabel.includes("1080")) tagClass = "tag-orig";
          else if (qLabel.includes("720")) tagClass = "tag-med";
          else if (qLabel.includes("480") || qLabel.includes("360")) tagClass = "tag-sm";

          cardsHtml += `
            <div class="x-gif-picker-card" data-quality="${qLabel}" data-url="${encodeURIComponent(f.url)}">
              <div class="x-gif-card-content">
                <div class="x-gif-card-title">${qLabel} ${idx === 0 ? "★" : ""}</div>
                <div class="x-gif-card-desc">${resDesc || (isEn ? "Standard MP4" : "Video MP4")}</div>
              </div>
              <span class="x-gif-card-tag ${tagClass}">${qLabel}</span>
            </div>
          `;
        });
      } else {
        cardsHtml = `
          <div class="x-gif-picker-card" data-quality="native" data-url="${encodeURIComponent(directMediaUrl || "")}">
            <div class="x-gif-card-content">
              <div class="x-gif-card-title">${isEn ? "Native High Quality" : "Kualitas Asli Terbaik"} ★</div>
              <div class="x-gif-card-desc">${isEn ? "Original stream from tweet" : "Resolusi tertinggi dari tweet"}</div>
            </div>
            <span class="x-gif-card-tag tag-orig">MAX</span>
          </div>
          <div class="x-gif-picker-card" data-quality="720p" data-url="${encodeURIComponent(directMediaUrl || "")}">
            <div class="x-gif-card-content">
              <div class="x-gif-card-title">720p HD</div>
              <div class="x-gif-card-desc">${isEn ? "Balanced resolution" : "Kualitas seimbang"}</div>
            </div>
            <span class="x-gif-card-tag tag-med">720p</span>
          </div>
        `;
      }

      // Audio Only Option
      cardsHtml += `
        <div class="x-gif-picker-card" data-audio="true" data-url="${encodeURIComponent(directMediaUrl || "")}" style="margin-top: 6px; border-style: dashed;">
          <div class="x-gif-card-content">
            <div class="x-gif-card-title">${i18n.audioTitle}</div>
            <div class="x-gif-card-desc">${i18n.audioDesc}</div>
          </div>
          <span class="x-gif-card-tag tag-mp4">MP3</span>
        </div>
      `;

      popup.innerHTML = `
        <div class="x-gif-picker-section-title" style="margin-top: 2px;">${i18n.title}</div>
        ${cardsHtml}
        <div class="x-gif-picker-footer">
          <label class="x-gif-remember-label">
            <input type="checkbox" class="x-gif-remember-checkbox" id="xQualityRememberChoice">
            <span>${i18n.rememberChoice}</span>
          </label>
          <div class="x-gif-footer-note">${i18n.footerNote}</div>
          <div class="x-gif-footer-bottom">
            <span class="x-gif-brand-tag">${i18n.byPikuri}</span>
            <span class="x-gif-brand-tag" style="color: #64748b;">${i18n.escToClose}</span>
          </div>
        </div>
      `;

      document.body.appendChild(popup);
      activeQualityModal = popup;

      const rect = anchorEl ? anchorEl.getBoundingClientRect() : { top: 100, right: 300, bottom: 140, left: 200, width: 30, height: 30 };
      const modalWidth = 295;
      const modalHeight = popup.offsetHeight || 290;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = 0;
      let openDirection = "down";

      if (spaceBelow >= modalHeight + 10) {
        top = rect.bottom + 6;
        openDirection = "down";
      } else if (spaceAbove >= modalHeight + 10) {
        top = rect.top - modalHeight - 6;
        openDirection = "up";
      } else {
        top = spaceBelow >= spaceAbove ? rect.bottom + 6 : rect.top - modalHeight - 6;
        openDirection = spaceBelow >= spaceAbove ? "down" : "up";
      }

      top = Math.max(8, Math.min(window.innerHeight - modalHeight - 8, top));

      let left = rect.right - modalWidth;
      if (left < 10) {
        left = rect.left;
      }
      left = Math.max(10, Math.min(window.innerWidth - modalWidth - 10, left));

      popup.classList.add(openDirection === "down" ? "open-down" : "open-up");
      popup.style.top = `${Math.round(top)}px`;
      popup.style.left = `${Math.round(left)}px`;

      const rememberCheck = popup.querySelector("#xQualityRememberChoice");

      popup.querySelectorAll(".x-gif-picker-card").forEach(card => {
        card.addEventListener("click", (e) => {
          e.stopPropagation();
          const targetQuality = card.getAttribute("data-quality");
          const targetFormatUrl = card.getAttribute("data-url") ? decodeURIComponent(card.getAttribute("data-url")) : null;
          const isAudioOnly = card.getAttribute("data-audio") === "true";
          const shouldRemember = rememberCheck ? rememberCheck.checked : false;

          if (shouldRemember && targetQuality) {
            contentSettings.defaultQuality = targetQuality;
            try {
              chrome.storage?.local?.get("settings", (data) => {
                const updated = { ...(data?.settings || {}), defaultQuality: targetQuality };
                chrome.storage?.local?.set({ settings: updated });
              });
            } catch (e) {}
          }

          cleanup();
          if (onSelect) onSelect({ targetQuality, targetFormatUrl, isAudioOnly });
        });
      });

      const settingsLink = popup.querySelector(".x-gif-settings-link");
      if (settingsLink) {
        settingsLink.addEventListener("click", (e) => {
          e.stopPropagation();
          cleanup();
          try {
            chrome.runtime.sendMessage({ action: "OPEN_SETTINGS_PAGE" });
          } catch (e) {}
        });
      }

      function onScrollOrResize() {
        cleanup();
        if (onCancel) onCancel();
      }

      function onDocClick(e) {
        if (popup && !popup.contains(e.target) && (!anchorEl || !anchorEl.contains(e.target))) {
          cleanup();
          if (onCancel) onCancel();
        }
      }

      function onKeyDown(e) {
        if (e.key === "Escape") {
          e.stopPropagation();
          cleanup();
          if (onCancel) onCancel();
        }
      }

      popup.addEventListener("keydown", (e) => e.stopPropagation());

      function cleanup() {
        document.removeEventListener("pointerdown", onDocClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("scroll", onScrollOrResize, { capture: true });
        window.removeEventListener("resize", onScrollOrResize);
        if (popup.parentElement) {
          popup.remove();
        }
        if (activeQualityModal === popup) {
          activeQualityModal = null;
        }
      }

      setTimeout(() => {
        document.addEventListener("pointerdown", onDocClick, true);
        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
        window.addEventListener("resize", onScrollOrResize, { passive: true });
      }, 50);
    });
  }

  async function executeGifDownload({ choice, anchorEl, targetTweetId, outerTweetId, quotedTweetId, isQuote, author, screenName, tweetText, tweetTime, tweetIsoDate, directMediaUrl, pageUrl, clientReqId, onDone }) {
    if (choice === "mp4") {
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_TWEET",
        payload: {
          tweetId: targetTweetId,
          outerTweetId: outerTweetId,
          allTweetIds: [targetTweetId, outerTweetId, quotedTweetId].filter(Boolean),
          author,
          screenName,
          tweetText,
          tweetTime,
          tweetIsoDate,
          isQuoteTweet: isQuote,
          isGif: true,
          directMediaUrl,
          pageUrl,
          clientReqId,
          ext: "mp4"
        }
      }, (res) => {
        if (!res?.success) {
          if (onDone) onDone(false);
        } else if (res?.downloadId && clientReqId) {
          const tracker = activeDownloadTrackers.get(clientReqId);
          if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
        }
      });
      return;
    }

    const updateProgress = (pct, label) => {
      if (!anchorEl) return;
      const span = anchorEl.querySelector("span");
      if (span) {
        span.textContent = `${pct}%`;
      }
      anchorEl.title = `Mengonversi GIF (${label || pct + "%"})...`;
    };

    try {
      updateProgress(5, "5%");

      let mp4Url = directMediaUrl;
      if (!mp4Url) {
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: "RESOLVE_TWITTER_MEDIA_URL",
            payload: {
              tweetId: targetTweetId,
              allTweetIds: [targetTweetId, outerTweetId, quotedTweetId].filter(Boolean)
            }
          }, (r) => resolve(r));
        });
        if (res?.success && res.url) {
          mp4Url = res.url;
        }
      }

      if (!mp4Url && targetTweetId) {
        mp4Url = `https://video.twimg.com/tweet_video/${targetTweetId}.mp4`;
      }

      if (!mp4Url) {
        throw new Error("URL sumber animasi GIF belum ditemukan");
      }

      const gifResult = await convertMp4ToGif(mp4Url, choice, (pct, lbl) => {
        updateProgress(pct, lbl);
      });
      const dataUrl = typeof gifResult === "string" ? gifResult : gifResult.dataUrl;
      const capturedThumbUrl = gifResult.capturedThumbUrl || null;

      // Resolve official Twitter poster thumbnail for the GIF
      const article = anchorEl?.closest?.('article[data-testid="tweet"]') || document;
      const videoEl = article.querySelector?.("video");
      let posterThumb = (videoEl?.poster && !videoEl.poster.startsWith("blob:") && !videoEl.poster.startsWith("data:")) ? videoEl.poster : null;

      if (!posterThumb) {
        const thumbImg = article.querySelector?.('img[src*="tweet_video_thumb"], img[src*="video_thumb"]');
        if (thumbImg?.src) posterThumb = thumbImg.src;
      }

      if (!posterThumb && mp4Url) {
        const m = mp4Url.match(/\/tweet_video\/([a-zA-Z0-9_-]+)\.mp4/i);
        if (m && m[1]) {
          posterThumb = `https://pbs.twimg.com/tweet_video_thumb/${m[1]}.jpg`;
        }
      }

      if (!posterThumb && targetTweetId) {
        posterThumb = `https://pbs.twimg.com/tweet_video_thumb/${targetTweetId}.jpg`;
      }

      const finalThumb = posterThumb || capturedThumbUrl || null;

      updateProgress(99, "Menyimpan...");
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_GIF_FILE",
        payload: {
          dataUrl,
          tweetId: targetTweetId,
          author,
          screenName,
          tweetText,
          tweetTime: tweetTime || "",
          tweetIsoDate: tweetIsoDate || "",
          thumbnail: finalThumb,
          pageUrl,
          quality: choice.replace("gif-", ""),
          clientReqId
        }
      }, (resp) => {
        if (!resp?.success) {
          if (onDone) onDone(false);
        } else {
          if (resp?.downloadId && clientReqId) {
            const tracker = activeDownloadTrackers.get(clientReqId);
            if (tracker) {
              activeDownloadTrackers.set(resp.downloadId, tracker);
              activeDownloadTrackers.set(Number(resp.downloadId), tracker);
              activeDownloadTrackers.set(String(resp.downloadId), tracker);
            }
          }
          if (onDone) onDone(true);
        }
      });
    } catch (err) {
      console.error("Gagal mengonversi GIF:", err);
      if (anchorEl) {
        const span = anchorEl.querySelector("span");
        if (span) span.textContent = "ERR";
      }
      setTimeout(() => {
        if (onDone) onDone(false);
      }, 1500);
    }
  }

  function handleGifDownloadFlow({ anchorEl, targetTweetId, outerTweetId, quotedTweetId, isQuote, author, screenName, tweetText, tweetTime, tweetIsoDate, directMediaUrl, pageUrl, clientReqId, onDone }) {
    const currentFormat = contentSettings.gifFormat || "ask";
    if (currentFormat === "ask") {
      showGifFormatModal({
        anchorEl,
        onSelect: (chosenFormat) => {
          executeGifDownload({
            choice: chosenFormat,
            anchorEl,
            targetTweetId,
            outerTweetId,
            quotedTweetId,
            isQuote,
            author,
            screenName,
            tweetText,
            tweetTime,
            tweetIsoDate,
            directMediaUrl,
            pageUrl,
            clientReqId,
            onDone: (success) => {
              if (onDone) onDone(success);
            }
          });
        },
        onCancel: () => {
          if (onDone) onDone(false);
        }
      });
    } else {
      executeGifDownload({
        choice: currentFormat,
        anchorEl,
        targetTweetId,
        outerTweetId,
        quotedTweetId,
        isQuote,
        author,
        screenName,
        tweetText,
        tweetTime,
        tweetIsoDate,
        directMediaUrl,
        pageUrl,
        clientReqId,
        onDone: (success) => {
          if (onDone) onDone(success);
        }
      });
    }
  }

  // Floating Toast Notification in Twitter Linimasa
  let activeTwitterToast = null;
  function showTwitterToast(message) {
    try {
      if (activeTwitterToast && activeTwitterToast.parentNode) {
        activeTwitterToast.parentNode.removeChild(activeTwitterToast);
        activeTwitterToast = null;
      }
      const toast = document.createElement("div");
      toast.className = "x-vault-toast";
      toast.style.cssText = `
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 20, 25, 0.94);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 9999px;
        padding: 9px 16px;
        color: #f7f9f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
        pointer-events: none;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.22s ease, transform 0.22s ease;
      `;
      toast.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00ba7c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${message}</span>
      `;
      document.body.appendChild(toast);
      activeTwitterToast = toast;
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.opacity = "0";
          toast.style.transform = "translateY(10px)";
          setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            if (activeTwitterToast === toast) activeTwitterToast = null;
          }, 250);
        }
      }, 2500);
    } catch (e) {
      console.error("[X-Vault] Toast error:", e);
    }
  }

  // Get direct high-resolution original URL for Twitter photo
  function getDirectPhotoUrl(src) {
    if (!src) return "";
    try {
      const url = new URL(src);
      if (url.hostname.includes("twimg.com")) {
        url.searchParams.set("name", "orig");
        return url.toString();
      }
      return src;
    } catch (e) {
      if (src.includes("pbs.twimg.com")) {
        if (src.includes("name=")) {
          return src.replace(/name=[a-zA-Z0-9_-]+/, "name=orig");
        }
        return src + (src.includes("?") ? "&name=orig" : "?name=orig");
      }
      return src;
    }
  }

  // Copy text to clipboard with user feedback toast
  function copyDirectLink(url, customToastMsg) {
    if (!url) return;
    const msg = customToastMsg || (currentLang === "en" ? "Direct media link copied!" : "Tautan media langsung disalin!");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showTwitterToast(msg))
        .catch(() => {
          chrome.runtime.sendMessage({ action: "COPY_TEXT_TO_CLIPBOARD", payload: { text: url } });
          showTwitterToast(msg);
        });
    } else {
      chrome.runtime.sendMessage({ action: "COPY_TEXT_TO_CLIPBOARD", payload: { text: url } });
      showTwitterToast(msg);
    }
  }

  // Download a single media item (Photo, Video, or GIF)
  function downloadMediaItem(item, targetTid, targetInfo, pageUrl, clientReqId = null) {
    if (!item) return;
    if (item.type === "photo") {
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_IMAGE",
        payload: {
          imageUrl: item.url,
          tweetId: targetTid,
          author: targetInfo.author,
          screenName: targetInfo.screenName,
          tweetText: targetInfo.text,
          tweetTime: targetInfo.tweetTime,
          tweetIsoDate: targetInfo.tweetIsoDate,
          thumbnail: item.url,
          pageUrl: pageUrl,
          index: item.index || 0,
          clientReqId: clientReqId
        }
      }, (res) => {
        if (res?.downloadId && clientReqId) {
          const tracker = activeDownloadTrackers.get(clientReqId);
          if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
        }
      });
    } else if (item.type === "video") {
      const thumbUrl = item.targetVideoEl?.querySelector?.("video")?.poster || item.targetVideoEl?.querySelector?.('img[src*="video_thumb"], img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"]')?.src || item.targetVideoEl?.querySelector?.("img")?.src || null;
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_TWEET",
        payload: {
          twVideoId: item.twVideoId,
          tweetId: item.targetTweetId || targetTid,
          outerTweetId: item.outerTweetId || targetTid,
          allTweetIds: [item.targetTweetId, targetTid].filter(Boolean),
          author: targetInfo.author,
          screenName: targetInfo.screenName,
          tweetText: targetInfo.text,
          tweetTime: targetInfo.tweetTime,
          tweetIsoDate: targetInfo.tweetIsoDate,
          thumbnail: thumbUrl,
          isQuoteTweet: Boolean(item.isQuote),
          isGif: false,
          directMediaUrl: item.directMediaUrl,
          pageUrl: pageUrl,
          clientReqId: clientReqId
        }
      }, (res) => {
        if (res?.downloadId && clientReqId) {
          const tracker = activeDownloadTrackers.get(clientReqId);
          if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
        }
      });
    } else if (item.type === "gif") {
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_TWEET",
        payload: {
          twVideoId: item.twVideoId,
          tweetId: item.targetTweetId || targetTid,
          outerTweetId: item.outerTweetId || targetTid,
          allTweetIds: [item.targetTweetId, targetTid].filter(Boolean),
          author: targetInfo.author,
          screenName: targetInfo.screenName,
          tweetText: targetInfo.text,
          tweetTime: targetInfo.tweetTime,
          tweetIsoDate: targetInfo.tweetIsoDate,
          thumbnail: null,
          isQuoteTweet: Boolean(item.isQuote),
          isGif: true,
          directMediaUrl: item.directMediaUrl,
          pageUrl: pageUrl,
          clientReqId: clientReqId
        }
      }, (res) => {
        if (res?.downloadId && clientReqId) {
          const tracker = activeDownloadTrackers.get(clientReqId);
          if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
        }
      });
    }
  }

  // Active download tracking registry for real-time progress callbacks
  const activeDownloadTrackers = new Map();

  function registerDownloadTracker(clientReqId, controller) {
    if (clientReqId && controller) {
      activeDownloadTrackers.set(clientReqId, controller);
    }
  }

  function unregisterDownloadTracker(id) {
    if (id) {
      activeDownloadTrackers.delete(id);
    }
  }

  // Batch download a list of media items with live progress tracking
  function downloadAllMediaList(mediaList, targetTid, targetInfo, pageUrl, onDone, onProgress) {
    if (!mediaList || mediaList.length === 0) {
      if (onDone) onDone(false);
      return;
    }

    const totalCount = mediaList.length;
    let completedCount = 0;

    mediaList.forEach((item, idx) => {
      const itemReqId = "req_batch_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substring(2, 6);

      registerDownloadTracker(itemReqId, {
        onProgress: (pct) => {
          if (onProgress) {
            onProgress({ completedCount, totalCount, currentItemIdx: idx, itemPercent: pct });
          }
        },
        onComplete: () => {
          completedCount++;
          if (onProgress) {
            onProgress({ completedCount, totalCount, currentItemIdx: idx, itemPercent: 100 });
          }
          if (completedCount >= totalCount && onDone) {
            onDone(true);
          }
        },
        onError: () => {
          completedCount++;
          if (completedCount >= totalCount && onDone) {
            onDone(completedCount > 0);
          }
        }
      });

      setTimeout(() => {
        downloadMediaItem(item, targetTid, targetInfo, pageUrl, itemReqId);
      }, idx * 280);
    });
  }

  // Inject clean media hover styles (hides corner badges & download-all badges until mouse hover)
  function ensureMediaOverlayStyles() {
    if (document.getElementById("x-vault-media-styles")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "x-vault-media-styles";
    styleEl.textContent = `
      /* Keyframe animation for smooth progress spinner */
      @keyframes xVaultSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .x-vault-spin {
        animation: xVaultSpin 0.85s linear infinite !important;
        transform-origin: center center !important;
      }

      /* By default, corner badges on media are hidden (opacity: 0) to keep photos and videos clean */
      .x-media-corner-badge {
        opacity: 0 !important;
        pointer-events: none !important;
        transform: translateY(-2px);
        transition: opacity 0.22s cubic-bezier(0.2, 0, 0, 1), transform 0.22s cubic-bezier(0.2, 0, 0, 1) !important;
      }

      /* When mouse hovers over the photo or video container, reveal corner badges smoothly! */
      div[data-testid="tweetPhoto"]:hover .x-media-corner-badge,
      div[data-testid="videoPlayer"]:hover .x-media-corner-badge,
      div[data-testid="videoComponent"]:hover .x-media-corner-badge,
      div[data-testid*="card.layout"]:hover .x-media-corner-badge,
      div[role="link"]:hover .x-media-corner-badge,
      .x-media-corner-badge:hover,
      .x-media-corner-badge:focus-within,
      .x-media-corner-badge[data-active="true"] {
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: translateY(0) !important;
      }
    `;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // Unified Ultra-Compact Corner Badge (Icon-only [ ⬇ ] and [ 🔗 ])
  function createMediaCornerBadge({ type, title, onClick, onCopy, onQualitySelect }) {
    const badgeWrap = document.createElement("div");
    badgeWrap.className = "x-media-corner-badge";
    badgeWrap.style.cssText = "position: absolute; top: 8px; right: 8px; z-index: 25; pointer-events: auto; display: inline-flex; align-items: center; gap: 4px;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `x-corner-badge-btn x-badge-${type}`;
    btn.title = title;
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: rgba(18, 22, 31, 0.82);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 0;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      transition: all 0.18s ease;
      user-select: none;
    `;

    const dlSvg = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
    btn.innerHTML = dlSvg;

    btn.addEventListener("mouseenter", () => {
      if (!btn.dataset.saved && !btn.dataset.downloading) {
        btn.style.backgroundColor = "#1d9bf0";
        btn.style.borderColor = "#1d9bf0";
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.saved && !btn.dataset.downloading) {
        btn.style.backgroundColor = "rgba(18, 22, 31, 0.82)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
      }
    });

    function resetBtnToDefault() {
      delete btn.dataset.saved;
      delete btn.dataset.downloading;
      delete badgeWrap.dataset.active;
      btn.style.backgroundColor = "rgba(18, 22, 31, 0.82)";
      btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
      btn.innerHTML = dlSvg;
      btn.title = title;
    }

    function renderProgressRing(percent) {
      btn.dataset.downloading = "true";
      badgeWrap.dataset.active = "true";
      btn.style.backgroundColor = "rgba(18, 22, 31, 0.92)";
      btn.style.borderColor = "#1d9bf0";

      if (percent === null || percent === undefined) {
        btn.title = currentLang === "en" ? "Downloading..." : "Mengunduh...";
        btn.innerHTML = `
          <svg class="x-vault-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5"/>
            <path d="M12 4a8 8 0 0 1 8 8" stroke="#1d9bf0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        `;
      } else {
        const circum = 50.26; // 2 * pi * 8
        const offset = Math.max(0, circum - (percent / 100) * circum);
        btn.title = (currentLang === "en" ? "Downloading" : "Mengunduh") + ` ${percent}%`;
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="rgba(255, 255, 255, 0.2)" stroke-width="2.4"/>
            <circle cx="12" cy="12" r="8" stroke="#1d9bf0" stroke-width="2.4" stroke-linecap="round"
              stroke-dasharray="50.26" stroke-dashoffset="${offset}" transform="rotate(-90 12 12)"/>
          </svg>
        `;
      }
    }

    function setSuccessState() {
      delete btn.dataset.downloading;
      btn.dataset.saved = "true";
      badgeWrap.dataset.active = "true";
      btn.style.backgroundColor = "#00ba7c";
      btn.style.borderColor = "#00ba7c";
      btn.title = currentLang === "en" ? "Downloaded" : "Tersimpan";
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;

      setTimeout(() => {
        resetBtnToDefault();
      }, 2200);
    }

    function triggerDownload(chosen) {
      if (btn.dataset.downloading || btn.dataset.saved) return;

      const clientReqId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
      renderProgressRing(null);

      registerDownloadTracker(clientReqId, {
        onProgress: (pct) => {
          renderProgressRing(pct);
        },
        onComplete: () => {
          setSuccessState();
        },
        onError: () => {
          resetBtnToDefault();
        }
      });

      if (typeof onClick === "function") {
        onClick({
          clientReqId,
          done: (success) => {
            if (success === false) {
              unregisterDownloadTracker(clientReqId);
              resetBtnToDefault();
            } else if (success === true) {
              // Safety watchdog: ensure spinner never hangs indefinitely if browser download events are skipped
              setTimeout(() => {
                if (btn.dataset.downloading) {
                  setSuccessState();
                  unregisterDownloadTracker(clientReqId);
                }
              }, 3500);
            }
          },
          btnEl: btn,
          targetQuality: chosen?.targetQuality,
          targetFormatUrl: chosen?.targetFormatUrl,
          isAudioOnly: chosen?.isAudioOnly
        }, (success) => {
          if (success === false) {
            unregisterDownloadTracker(clientReqId);
            resetBtnToDefault();
          } else if (success === true) {
            setTimeout(() => {
              if (btn.dataset.downloading) {
                setSuccessState();
                unregisterDownloadTracker(clientReqId);
              }
            }, 3500);
          }
        });
      }
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.dataset.downloading || btn.dataset.saved) return;

      if (type === "video" && contentSettings.defaultQuality === "ask" && typeof onQualitySelect === "function") {
        onQualitySelect(btn, (chosen) => {
          if (chosen) triggerDownload(chosen);
        });
        return;
      }

      triggerDownload(null);
    });

    btn.addEventListener("contextmenu", (e) => {
      if (type === "video" && typeof onQualitySelect === "function") {
        e.preventDefault();
        e.stopPropagation();
        if (btn.dataset.downloading || btn.dataset.saved) return;
        onQualitySelect(btn, (chosen) => {
          if (chosen) triggerDownload(chosen);
        });
      }
    });

    badgeWrap.appendChild(btn);

    // Direct Media Link Copy Button
    if (typeof onCopy === "function") {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "x-corner-badge-btn x-badge-copy";
      copyBtn.title = currentLang === "en" ? "Copy Direct CDN Link" : "Salin Tautan Media Langsung";
      copyBtn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: rgba(18, 22, 31, 0.82);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 0;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        transition: all 0.18s ease;
        user-select: none;
      `;

      const copySvg = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      `;
      copyBtn.innerHTML = copySvg;

      copyBtn.addEventListener("mouseenter", () => {
        copyBtn.style.backgroundColor = "#1d9bf0";
        copyBtn.style.borderColor = "#1d9bf0";
      });
      copyBtn.addEventListener("mouseleave", () => {
        if (!copyBtn.dataset.saved) {
          copyBtn.style.backgroundColor = "rgba(18, 22, 31, 0.82)";
          copyBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        }
      });

      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onCopy((success) => {
          if (success !== false) {
            copyBtn.dataset.saved = "true";
            badgeWrap.dataset.active = "true";
            copyBtn.style.backgroundColor = "#00ba7c";
            copyBtn.style.borderColor = "#00ba7c";
            copyBtn.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            `;
            setTimeout(() => {
              delete copyBtn.dataset.saved;
              delete badgeWrap.dataset.active;
              copyBtn.style.backgroundColor = "rgba(18, 22, 31, 0.82)";
              copyBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
              copyBtn.innerHTML = copySvg;
            }, 2000);
          }
        });
      });

      badgeWrap.appendChild(copyBtn);
    }

    return badgeWrap;
  }

  // Inject "Download All" button into Quote Tweet header card (never covers media!)
  function injectQuoteTweetDownloadAll(quoteBox, mediaList, targetInfo, targetTid, pageUrl) {
    if (!quoteBox || !mediaList || mediaList.length <= 1) return;
    if (quoteBox.querySelector(".x-quote-dl-all-btn")) return;

    const count = mediaList.length;
    const btnWrap = document.createElement("div");
    btnWrap.className = "x-quote-dl-all-wrapper";
    btnWrap.style.cssText = `
      position: absolute;
      top: 10px;
      right: 12px;
      z-index: 50;
      display: inline-flex;
      align-items: center;
      pointer-events: auto;
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "x-quote-dl-all-btn";
    btn.title = currentLang === "en" ? `Download All ${count} Media` : `Unduh Semua ${count} Media`;
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(18, 22, 31, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      padding: 4px 10px;
      color: #f0f3f5;
      font-size: 11.5px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.2;
      cursor: pointer;
      transition: all 0.18s ease;
      user-select: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    `;
    const defaultQuoteBtnHtml = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${currentLang === "en" ? `Download All (${count})` : `Unduh Semua (${count})`}</span>
    `;
    btn.innerHTML = defaultQuoteBtnHtml;

    btn.addEventListener("mouseenter", () => {
      if (!btn.dataset.saved) {
        btn.style.background = "#1d9bf0";
        btn.style.borderColor = "#1d9bf0";
        btn.style.color = "#ffffff";
        btn.style.boxShadow = "0 2px 10px rgba(29, 155, 240, 0.4)";
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.saved) {
        btn.style.background = "rgba(18, 22, 31, 0.88)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        btn.style.color = "#f0f3f5";
        btn.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.4)";
      }
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.dataset.saved || btn.dataset.downloading) return;

      btn.dataset.downloading = "true";
      btn.style.background = "rgba(18, 22, 31, 0.92)";
      btn.style.borderColor = "#1d9bf0";

      const updateQuoteProgress = (status) => {
        const { completedCount, totalCount, itemPercent } = status;
        const pctStr = (itemPercent !== null && itemPercent !== undefined && itemPercent > 0 && itemPercent < 100) ? ` ${itemPercent}%` : "";
        btn.innerHTML = `
          <svg class="x-vault-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255, 255, 255, 0.25)" stroke-width="2.5"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="#1d9bf0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>${currentLang === "en" ? "Downloading" : "Mengunduh"} (${Math.min(completedCount + 1, totalCount)}/${totalCount})${pctStr}</span>
        `;
      };

      updateQuoteProgress({ completedCount: 0, totalCount: mediaList.length, itemPercent: null });

      downloadAllMediaList(mediaList, targetTid, targetInfo, pageUrl, (ok) => {
        delete btn.dataset.downloading;
        if (ok) {
          btn.dataset.saved = "true";
          btn.style.background = "#00ba7c";
          btn.style.borderColor = "#00ba7c";
          btn.style.color = "#ffffff";
          btn.style.boxShadow = "0 2px 10px rgba(0, 186, 124, 0.4)";
          btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${currentLang === "en" ? "Saved" : "Tersimpan"}</span>
          `;
          setTimeout(() => {
            delete btn.dataset.saved;
            btn.style.background = "rgba(18, 22, 31, 0.88)";
            btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
            btn.style.color = "#f0f3f5";
            btn.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.4)";
            btn.innerHTML = defaultQuoteBtnHtml;
          }, 2500);
        } else {
          btn.style.background = "rgba(18, 22, 31, 0.88)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btn.style.color = "#f0f3f5";
          btn.innerHTML = defaultQuoteBtnHtml;
        }
      }, (prog) => {
        updateQuoteProgress(prog);
      });
    });

    btnWrap.appendChild(btn);

    // Only hide if both inTweetBtn and mediaCornerBadges are disabled
    if (contentSettings.inTweetBtn === false && contentSettings.mediaCornerBadges === false) {
      btnWrap.style.display = "none";
    }

    if (getComputedStyle(quoteBox).position === "static") {
      quoteBox.style.position = "relative";
    }
    quoteBox.appendChild(btnWrap);
  }

  // Helper to reliably find Grok button in tweet header
  function findGrokButton(article, caret) {
    if (!article) return null;

    // 1. Check aria-label / testid / href matches (language-independent patterns)
    const directGrok = article.querySelector(
      '[aria-label*="grok" i], [data-testid*="grok" i], a[href*="/i/grok"], [role="button"][aria-label*="grok" i]'
    );
    if (directGrok) return directGrok.closest('button, a, [role="button"]') || directGrok;

    // 2. Structural locator: Sibling inside the same top-right actions group as caret
    if (caret) {
      const caretButton = caret.closest('button, [role="button"]') || caret;
      const parentGroup = caretButton.parentElement;
      if (parentGroup) {
        const siblings = Array.from(parentGroup.children);
        for (const s of siblings) {
          if (s === caretButton || s.contains(caretButton)) continue;
          if (s.classList?.contains("x-tweet-header-dl-all-wrapper")) continue;
          if (s.querySelector?.('[data-testid="User-Name"], [data-testid="tweetText"]')) continue;
          return s;
        }
      }

      // 3. Previous sibling of caretButton
      let prev = caretButton.previousElementSibling;
      while (prev) {
        if (prev.classList?.contains("x-tweet-header-dl-all-wrapper")) {
          prev = prev.previousElementSibling;
          continue;
        }
        if (!prev.querySelector?.('[data-testid="User-Name"], [data-testid="tweetText"]')) {
          return prev;
        }
        break;
      }
    }

    return null;
  }

  // Inject "Download All" button into Tweet Header (STRICTLY to the left of Grok / Caret)
  function injectTweetHeaderDownloadAll(article, mediaList, targetInfo, targetTid, pageUrl) {
    if (!article || !mediaList || mediaList.length <= 1) return;

    let btnWrap = article.querySelector(".x-tweet-header-dl-all-wrapper");
    const count = mediaList.length;

    const caret = article.querySelector('[data-testid="caret"]');
    const caretButton = caret ? (caret.closest('button, [role="button"]') || caret) : null;
    const grokBtn = findGrokButton(article, caret);

    // TARGET ANCHOR: Must STRICTLY be Grok if Grok exists, otherwise Caret!
    const targetAnchor = grokBtn || caretButton;

    if (btnWrap) {
      const countSpan = btnWrap.querySelector(".x-header-dl-all-count");
      if (countSpan) countSpan.textContent = `(${count})`;
      btnWrap.style.display = contentSettings.headerDlAll !== false ? "inline-flex" : "none";

      // Self-healing / reposition check:
      // If Grok exists and our button is currently to the RIGHT of Grok (or between Grok & Caret),
      // immediately move our button to the LEFT of Grok!
      if (targetAnchor && targetAnchor.parentElement) {
        if (btnWrap.nextElementSibling !== targetAnchor) {
          targetAnchor.parentElement.insertBefore(btnWrap, targetAnchor);
        }
      }
      return;
    }

    if (!targetAnchor || !targetAnchor.parentElement) return;

    btnWrap = document.createElement("div");
    btnWrap.className = "x-tweet-header-dl-all-wrapper";
    btnWrap.style.cssText = `
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      z-index: 10;
      flex-shrink: 0;
      vertical-align: middle;
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "x-tweet-header-dl-all-btn";
    btn.title = currentLang === "en" ? `Download All ${count} Media Items` : `Unduh Semua ${count} Media`;
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(18, 22, 31, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      padding: 3px 9px;
      color: #f0f3f5;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.2;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      transition: all 0.18s ease;
      user-select: none;
    `;

    const defaultBtnHtml = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${currentLang === "en" ? "Download All" : "Unduh Semua"} <span class="x-header-dl-all-count">(${count})</span></span>
    `;
    btn.innerHTML = defaultBtnHtml;

    btn.addEventListener("mouseenter", () => {
      if (!btn.dataset.saved) {
        btn.style.background = "#1d9bf0";
        btn.style.borderColor = "#1d9bf0";
        btn.style.color = "#ffffff";
        btn.style.boxShadow = "0 2px 10px rgba(29, 155, 240, 0.4)";
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.saved) {
        btn.style.background = "rgba(18, 22, 31, 0.88)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        btn.style.color = "#f0f3f5";
        btn.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.3)";
      }
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (btn.dataset.saved || btn.dataset.downloading) return;

      btn.dataset.downloading = "true";
      btn.style.background = "rgba(18, 22, 31, 0.92)";
      btn.style.borderColor = "#1d9bf0";

      const updateHeaderProgress = (status) => {
        const { completedCount, totalCount, itemPercent } = status;
        const pctStr = (itemPercent !== null && itemPercent !== undefined && itemPercent > 0 && itemPercent < 100) ? ` ${itemPercent}%` : "";
        btn.innerHTML = `
          <svg class="x-vault-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="#1d9bf0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>${currentLang === "en" ? "Downloading" : "Mengunduh"} (${Math.min(completedCount + 1, totalCount)}/${totalCount})${pctStr}</span>
        `;
      };

      updateHeaderProgress({ completedCount: 0, totalCount: mediaList.length, itemPercent: null });

      downloadAllMediaList(mediaList, targetTid, targetInfo, pageUrl, (ok) => {
        delete btn.dataset.downloading;
        if (ok) {
          btn.dataset.saved = "true";
          btn.style.background = "#00ba7c";
          btn.style.borderColor = "#00ba7c";
          btn.style.color = "#ffffff";
          btn.style.boxShadow = "0 2px 10px rgba(0, 186, 124, 0.4)";
          btn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${currentLang === "en" ? "Downloaded All" : "Selesai Mengunduh"} (${count})</span>
          `;
          setTimeout(() => {
            delete btn.dataset.saved;
            btn.style.background = "rgba(18, 22, 31, 0.88)";
            btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
            btn.style.color = "#f0f3f5";
            btn.style.boxShadow = "0 1px 4px rgba(0, 0, 0, 0.3)";
            btn.innerHTML = defaultBtnHtml;
          }, 2500);
        } else {
          btn.style.background = "rgba(18, 22, 31, 0.88)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
          btn.style.color = "#f0f3f5";
          btn.innerHTML = defaultBtnHtml;
        }
      }, (prog) => {
        updateHeaderProgress(prog);
      });
    });

    btnWrap.appendChild(btn);

    if (contentSettings.headerDlAll === false) {
      btnWrap.style.display = "none";
    }

    // Insert strictly before targetAnchor (before Grok, or before Caret if no Grok)
    targetAnchor.parentElement.insertBefore(btnWrap, targetAnchor);
  }

  // Reliable Tweet Action Bar Locator (Bottom interaction bar)
  function findTweetActionBar(article, quoteBox) {
    if (!article) return null;
    // 1. Locate by interaction testids outside quoteBox (iterate through all matches)
    const actionEls = Array.from(article.querySelectorAll('[data-testid="reply"], [data-testid="like"], [data-testid="retweet"], [data-testid="bookmark"]'));
    for (const actionEl of actionEls) {
      const grp = actionEl.closest('div[role="group"]');
      if (grp && (!quoteBox || !quoteBox.contains(grp))) {
        return grp;
      }
    }

    // 2. Locate groups outside quoteBox
    const groups = Array.from(article.querySelectorAll('div[role="group"]')).filter(g => !quoteBox || !quoteBox.contains(g));
    if (groups.length === 0) {
      // Fallback: any action group in article
      const anyAction = article.querySelector('[data-testid="reply"], [data-testid="like"]')?.closest('div[role="group"]');
      if (anyAction) return anyAction;
      return null;
    }

    // Check aria-labels for interaction keywords
    const match = groups.find(g => {
      const lbl = (g.getAttribute("aria-label") || "").toLowerCase();
      return lbl.includes("repl") || lbl.includes("like") || lbl.includes("bala") || lbl.includes("suka") || lbl.includes("repost") || lbl.includes("share");
    });
    if (match) return match;

    // Default to the last group in the article (the bottom action bar)
    return groups[groups.length - 1];
  }

  // Reliable Quote Tweet Container Locator using <time> hierarchy and DOM containment
  function getQuoteTweetBox(article) {
    if (!article) return null;

    // Direct testids (legacy/fallback)
    const direct = article.querySelector('div[data-testid="quoteTweet"], [data-testid="tweetQuote"]');
    if (direct) return direct;

    // STRICT RULE: If there are fewer than 2 <time> elements, this tweet CANNOT have a quote tweet!
    const allTimes = Array.from(article.querySelectorAll("time"));
    if (allTimes.length < 2) return null;

    const outerTime = allTimes[0];
    const quoteTime = allTimes[1];

    // The outer tweet's primary text (if present)
    const allTexts = Array.from(article.querySelectorAll('div[data-testid="tweetText"]'));
    const outerText = allTexts[0] || null;

    // Any media (photos, videos, players) rendered before quoteTime in DOM order belongs to the outer tweet!
    const allMedia = Array.from(article.querySelectorAll('div[data-testid="tweetPhoto"], video, div[data-testid="videoPlayer"], div[data-testid="videoComponent"]'));
    const outerMediaElements = allMedia.filter(m => {
      return Boolean(m.compareDocumentPosition(quoteTime) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    let curr = quoteTime;
    while (curr.parentElement && curr.parentElement !== article) {
      const parent = curr.parentElement;
      // Stop if parent contains outerTime
      if (parent.contains(outerTime)) break;
      // Stop if parent contains outer tweet text (when curr does not)
      if (outerText && parent.contains(outerText) && !curr.contains(outerText)) break;
      // Stop if parent contains any outer media that is not inside curr
      if (outerMediaElements.some(m => parent.contains(m) && !curr.contains(m))) break;

      curr = parent;
    }

    // Sanity check: Ensure curr does NOT contain outerTime or outerMediaElements
    if (curr && curr !== article) {
      if (curr.contains(outerTime)) return null;
      if (outerMediaElements.some(m => curr.contains(m))) return null;
      return curr;
    }

    return null;
  }

  function updateTweetDlButtonHtml(btn, totalMedia) {
    if (!btn || btn.dataset.saved) return;
    if (totalMedia > 1) {
      btn.dataset.isPill = "true";
      btn.title = currentLang === "en" ? `Download All ${totalMedia} Media Items` : `Unduh Semua ${totalMedia} Media`;
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(29, 155, 240, 0.14);
        border: 1px solid rgba(29, 155, 240, 0.45);
        border-radius: 9999px;
        padding: 4px 11px;
        min-height: 28px;
        color: #1d9bf0;
        font-size: 11.5px;
        font-weight: 700;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        user-select: none;
      `;
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>${currentLang === "en" ? `Download All (${totalMedia})` : `Unduh Semua (${totalMedia})`}</span>
      `;
    } else {
      btn.dataset.isPill = "false";
      btn.title = currentLang === "en" ? "Download Media (X Downloader)" : "Unduh Media (X Downloader)";
      btn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 9999px;
        padding: 0 6px;
        min-width: 32px;
        height: 32px;
        color: rgb(113, 118, 123);
        cursor: pointer;
        transition: background-color 0.2s, color 0.2s;
        flex-shrink: 0;
      `;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      `;
    }
  }

  function injectTwitterDownloadButtons() {
    if (!window.location.hostname.includes("x.com") && !window.location.hostname.includes("twitter.com")) return;

    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    tweetArticles.forEach((article) => {
      try {
        // 1. Gather outer tweet ID from the primary <time> timestamp in the header
        const timeLinks = Array.from(article.querySelectorAll('time')).map(t => t.closest('a[href*="/status/"]')).filter(Boolean);
        const outerTimeLink = timeLinks[0];
        let outerTweetId = outerTimeLink?.href?.match(/\/status\/(\d+)/)?.[1] || null;

        // Fallback: any link in article with /status/<digits>
        if (!outerTweetId) {
          const anyStatusLink = article.querySelector('a[href*="/status/"]');
          if (anyStatusLink) {
            outerTweetId = anyStatusLink.href.match(/\/status\/(\d+)/)?.[1] || null;
          }
        }
        // Fallback: permalink URL on status page
        if (!outerTweetId) {
          const pageMatch = window.location.pathname.match(/\/status\/(\d+)/);
          if (pageMatch) {
            outerTweetId = pageMatch[1];
          }
        }

        // 2. Identify embedded Quote Tweet box (if present)
        const quoteBox = getQuoteTweetBox(article);

        const allStatusLinks = Array.from(article.querySelectorAll('a[href*="/status/"]'));
        const quotedStatusLink = (quoteBox ? quoteBox.querySelector('a[href*="/status/"]') : null) || allStatusLinks.find(a => {
          const id = a.href.match(/\/status\/(\d+)/)?.[1];
          return id && id !== outerTweetId;
        }) || null;
        let quotedTweetId = quotedStatusLink?.href?.match(/\/status\/(\d+)/)?.[1] || null;

        // 3. Detect videos: players, videos, video cards, amplify cards, and unplayed video thumbnails
        const allVideos = Array.from(article.querySelectorAll("video"));
        const allPlayers = Array.from(article.querySelectorAll('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]'));

        // Also detect video preview cards (with video_thumb image or duration badges like "0:27")
        const videoCards = Array.from(article.querySelectorAll('img[src*="video_thumb"], img[src*="amplify_video_thumb"], img[src*="ext_tw_video_thumb"]')).map(img => {
          return img.closest('div[data-testid*="card.layout"], div[data-testid="tweetPhoto"], div[role="link"]:not([role="group"])') || img.parentElement;
        }).filter(Boolean);

        // Check for containers with duration badges (e.g. 0:27 badge in video thumbnails)
        const candidateBadges = Array.from(article.querySelectorAll('div[data-testid*="card"], div[data-testid="tweetPhoto"], div[role="link"]:not([role="group"])'));
        candidateBadges.forEach(wrap => {
          if (videoCards.includes(wrap)) return;
          const hasDuration = Array.from(wrap.querySelectorAll("span, div")).some(el => {
            return /^\s*\d+:\d{2}(?::\d{2})?\s*$/.test(el.textContent || "") && el.children.length === 0;
          });
          if (hasDuration) videoCards.push(wrap);
        });

        videoCards.forEach(card => {
          if (!allPlayers.some(p => p === card || p.contains(card) || card.contains(p))) {
            allPlayers.push(card);
          }
        });

        const isElementInQuote = (el) => {
          if (!el || !quoteBox) return false;
          return quoteBox.contains(el);
        };

        const outerVideos = allVideos.filter(v => !isElementInQuote(v));
        const outerPlayers = allPlayers.filter(p => !isElementInQuote(p));
        const quotedVideos = allVideos.filter(v => isElementInQuote(v));
        const quotedPlayers = allPlayers.filter(p => isElementInQuote(p));

        const outerVideoTargets = [];
        outerPlayers.forEach(p => {
          if (!outerVideoTargets.some(e => e === p || e.contains(p) || p.contains(e))) outerVideoTargets.push(p);
        });
        outerVideos.forEach(v => {
          const p = v.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]') || v.parentElement;
          if (p && !outerVideoTargets.some(e => e === p || e.contains(p) || p.contains(e))) outerVideoTargets.push(p);
        });

        const quotedVideoTargets = [];
        quotedPlayers.forEach(p => {
          if (!quotedVideoTargets.some(e => e === p || e.contains(p) || p.contains(e))) quotedVideoTargets.push(p);
        });
        quotedVideos.forEach(v => {
          const p = v.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]') || v.parentElement;
          if (p && !quotedVideoTargets.some(e => e === p || e.contains(p) || p.contains(e))) quotedVideoTargets.push(p);
        });

        const hasOuterVideo = outerVideoTargets.length > 0;
        const hasQuotedVideo = quotedVideoTargets.length > 0;

        // Detect real static photos in tweet (exclude any video/GIF wrappers or video thumbnails)
        const isRealPhotoWrap = (wrap) => {
          if (!wrap) return false;
          if (wrap.querySelector('video, div[data-testid="videoPlayer"], div[data-testid="videoComponent"]')) return false;
          if (videoCards.some(vc => vc === wrap || vc.contains(wrap) || wrap.contains(vc))) return false;
          const img = wrap.querySelector("img");
          if (!img || !img.src) return false;
          if (img.src.includes("video_thumb") || img.src.includes("amplify_video_thumb") || img.src.includes("tweet_video") || img.src.includes("ext_tw_video_thumb")) return false;
          const hasDuration = Array.from(wrap.querySelectorAll("span, div")).some(el => /^\s*\d+:\d{2}(?::\d{2})?\s*$/.test(el.textContent || "") && el.children.length === 0);
          if (hasDuration) return false;
          return img.src.includes("pbs.twimg.com/media/") || img.src.includes("pbs.twimg.com");
        };

        const photoContainers = Array.from(article.querySelectorAll('div[data-testid="tweetPhoto"]')).filter(isRealPhotoWrap);
        const outerPhotoContainers = photoContainers.filter(p => !isElementInQuote(p));
        const quotedPhotoContainers = photoContainers.filter(p => isElementInQuote(p));
        const hasOuterPhotos = outerPhotoContainers.length > 0;
        const hasQuotedPhotos = quotedPhotoContainers.length > 0;
        const hasAnyMedia = hasOuterVideo || hasQuotedVideo || hasOuterPhotos || hasQuotedPhotos;

        if (!quoteBox && hasQuotedVideo) {
          const vEl = quotedVideoTargets[0];
          if (vEl) {
            quoteBox = vEl.closest('div[role="link"]:not([role="group"]), div[data-testid="quoteTweet"], [data-testid="tweetQuote"]') || vEl.parentElement;
          }
        }

        if (!hasAnyMedia) return;

        // A. Process Video and GIF players (Ultra-Compact Corner Badge)
        const allVideoTargets = [...outerVideoTargets, ...quotedVideoTargets];
        allVideoTargets.forEach(vContainer => {
          if (!vContainer || typeof vContainer.querySelector !== "function") return;
          if (vContainer.querySelector(".x-media-corner-badge") || vContainer.closest?.(".x-media-corner-badge")) return;
          if (vContainer.parentElement?.querySelector?.(".x-media-corner-badge")) return;

          const enclosingPhoto = vContainer.closest('div[data-testid="tweetPhoto"]');
          if (enclosingPhoto) {
            enclosingPhoto.setAttribute("data-vault-handled", "video");
          }
          vContainer.setAttribute("data-vault-handled", "video");

          const videoEl = vContainer.querySelector("video") || (vContainer.tagName === "VIDEO" ? vContainer : null);
          const isQuote = isElementInQuote(vContainer);
          const targetBox = isQuote ? (quoteBox || vContainer.closest('div[role="link"]') || article) : article;
          const targetInfo = extractTweetInfo(targetBox);
          const targetTid = (isQuote ? quotedTweetId : outerTweetId) || outerTweetId;
          const isGif = Boolean(isTwitterGif(vContainer, videoEl, targetTid));
          const pageUrl = (isQuote ? quotedStatusLink?.href : outerTimeLink?.href) || window.location.href;

          const badgeType = isGif ? "gif" : "video";
          const badgeTitle = isGif
            ? (currentLang === "en" ? "Download Animated GIF" : "Unduh Animasi GIF")
            : (currentLang === "en" ? "Download HD Video (MP4)" : "Unduh Video HD (MP4)");

          let directMediaUrl = null;
          if (isGif) {
            directMediaUrl = resolveGifDirectUrl(vContainer, videoEl, targetTid);
          } else if (videoEl?.src && videoEl.src.startsWith("http") && !videoEl.src.startsWith("blob:")) {
            directMediaUrl = videoEl.src;
          }

          const twVideoId = extractTwVideoId(vContainer);

          const badge = createMediaCornerBadge({
            type: badgeType,
            title: badgeTitle,
            onQualitySelect: !isGif ? (anchorEl, onChosen) => {
              showVideoQualityModal({
                anchorEl,
                twVideoId,
                targetTweetId: targetTid,
                outerTweetId: outerTweetId,
                quotedTweetId: quotedTweetId,
                directMediaUrl,
                onSelect: (chosen) => {
                  if (onChosen) onChosen(chosen);
                },
                onCancel: () => {
                  if (onChosen) onChosen(null);
                }
              });
            } : null,
            onCopy: (done) => {
              if (isGif && directMediaUrl) {
                copyDirectLink(directMediaUrl);
                if (done) done(true);
                return;
              }
              if (!isGif && directMediaUrl && !directMediaUrl.startsWith("blob:")) {
                copyDirectLink(directMediaUrl);
                if (done) done(true);
                return;
              }
              chrome.runtime.sendMessage({
                action: "GET_DIRECT_MEDIA_URL",
                payload: {
                  twVideoId,
                  tweetId: targetTid,
                  allTweetIds: [targetTid, outerTweetId, quotedTweetId].filter(Boolean)
                }
              }, (res) => {
                const url = res?.url || (videoEl?.src && !videoEl.src.startsWith("blob:") ? videoEl.src : null);
                if (url) {
                  copyDirectLink(url);
                  if (done) done(true);
                } else {
                  showTwitterToast(currentLang === "en" ? "Media link ready when played" : "Tautan siap saat media diputar");
                  if (done) done(false);
                }
              });
            },
            onClick: (opt, fallbackDone) => {
              const done = typeof opt === "function" ? opt : (opt?.done || fallbackDone);
              const clientReqId = typeof opt === "object" ? opt?.clientReqId : null;
              const btnEl = typeof opt === "object" ? opt?.btnEl : null;

              if (isGif) {
                handleGifDownloadFlow({
                  anchorEl: btnEl,
                  targetTweetId: targetTid,
                  outerTweetId: outerTweetId,
                  quotedTweetId: quotedTweetId,
                  isQuote: isQuote,
                  author: targetInfo.author,
                  screenName: targetInfo.screenName,
                  tweetText: targetInfo.text,
                  directMediaUrl: directMediaUrl,
                  pageUrl: pageUrl,
                  clientReqId: clientReqId,
                  onDone: done
                });
              } else {
                const thumbUrl = vContainer?.querySelector?.("video")?.poster || vContainer?.querySelector?.('img[src*="video_thumb"], img[src*="amplify_video_thumb"]')?.src || null;
                chrome.runtime.sendMessage({
                  action: "DOWNLOAD_TWITTER_TWEET",
                  payload: {
                    twVideoId,
                    tweetId: targetTid,
                    outerTweetId: outerTweetId,
                    allTweetIds: [targetTid, outerTweetId, quotedTweetId].filter(Boolean),
                    author: targetInfo.author,
                    screenName: targetInfo.screenName,
                    tweetText: targetInfo.text,
                    tweetTime: targetInfo.tweetTime,
                    tweetIsoDate: targetInfo.tweetIsoDate,
                    thumbnail: thumbUrl,
                    isQuoteTweet: isQuote,
                    isGif: false,
                    directMediaUrl,
                    targetQuality: opt?.targetQuality,
                    targetFormatUrl: opt?.targetFormatUrl,
                    isAudioOnly: Boolean(opt?.isAudioOnly),
                    pageUrl,
                    clientReqId
                  }
                }, (res) => {
                  if (!res?.success) {
                    done(false);
                  } else if (res?.downloadId && clientReqId) {
                    const tracker = activeDownloadTrackers.get(clientReqId);
                    if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
                  }
                });
              }
            }
          });

          if (contentSettings.mediaCornerBadges === false) {
            badge.style.display = "none";
          }

          vContainer.appendChild(badge);
        });

        // B. Process Static Photos (Ultra-Compact Corner Badge)
        photoContainers.forEach((photoWrap, pIdx) => {
          if (photoWrap.querySelector(".x-media-corner-badge")) return;
          if (photoWrap.getAttribute("data-vault-handled") === "video") return;
          if (photoWrap.querySelector('video, div[data-testid="videoPlayer"], div[data-testid="videoComponent"]')) return;

          const img = photoWrap.querySelector("img");
          if (!img || !img.src) return;
          if (img.src.includes("video_thumb") || img.src.includes("amplify_video_thumb") || img.src.includes("tweet_video")) return;
          if (!img.src.includes("pbs.twimg.com/media/") && !img.src.includes("pbs.twimg.com")) return;

          const isQuote = isElementInQuote(photoWrap);
          const targetInfo = extractTweetInfo(isQuote ? (quoteBox || article) : article);
          const targetTid = (isQuote ? quotedTweetId : outerTweetId) || outerTweetId;
          const directPhotoUrl = getDirectPhotoUrl(img.src);
          const tweetPageUrl = (isQuote ? (quotedStatusLink?.href || (targetTid ? `https://x.com/${targetInfo.screenName || "i"}/status/${targetTid}` : window.location.href)) : outerTimeLink?.href) || window.location.href;

          const badge = createMediaCornerBadge({
            type: "photo",
            title: currentLang === "en" ? "Download High-Res Original Photo" : "Unduh Foto Asli HD",
            onCopy: (done) => {
              copyDirectLink(directPhotoUrl);
              if (done) done(true);
            },
            onClick: (opt, fallbackDone) => {
              const done = typeof opt === "function" ? opt : (opt?.done || fallbackDone);
              const clientReqId = typeof opt === "object" ? opt?.clientReqId : null;

              chrome.runtime.sendMessage({
                action: "DOWNLOAD_TWITTER_IMAGE",
                payload: {
                  imageUrl: directPhotoUrl || img.src,
                  tweetId: targetTid,
                  author: targetInfo.author,
                  screenName: targetInfo.screenName,
                  tweetText: targetInfo.text,
                  tweetTime: targetInfo.tweetTime,
                  tweetIsoDate: targetInfo.tweetIsoDate,
                  thumbnail: img.src,
                  pageUrl: tweetPageUrl,
                  index: pIdx,
                  clientReqId
                }
              }, (res) => {
                if (!res?.success) {
                  done(false);
                } else if (res?.downloadId && clientReqId) {
                  const tracker = activeDownloadTrackers.get(clientReqId);
                  if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
                }
              });
            }
          });

          if (contentSettings.mediaCornerBadges === false) {
            badge.style.display = "none";
          }

          photoWrap.appendChild(badge);
        });

        // Link detected videos with tweet status URLs in background store
        if (hasOuterVideo && outerTweetId) {
          outerVideoTargets.forEach(vTarget => {
            const vidId = extractTwVideoId(vTarget);
            if (vidId && !linkedVideoIds.has(vidId)) {
              linkedVideoIds.add(vidId);
              const outerInfo = extractTweetInfo(article);
              chrome.runtime.sendMessage({
                action: "LINK_TWITTER_MEDIA_TO_TWEET",
                payload: {
                  twVideoId: vidId,
                  tweetId: outerTweetId,
                  tweetUrl: outerTimeLink?.href || `https://x.com/${outerInfo.screenName || "i"}/status/${outerTweetId}`,
                  author: outerInfo.author,
                  screenName: outerInfo.screenName,
                  tweetText: outerInfo.text
                }
              });
            }
          });
        }

        if (hasQuotedVideo && (quotedTweetId || quoteBox)) {
          quotedVideoTargets.forEach(vTarget => {
            const vidId = extractTwVideoId(vTarget);
            if (vidId && !linkedVideoIds.has(vidId)) {
              linkedVideoIds.add(vidId);
              const quoteInfo = extractTweetInfo(quoteBox);
              chrome.runtime.sendMessage({
                action: "LINK_TWITTER_MEDIA_TO_TWEET",
                payload: {
                  twVideoId: vidId,
                  tweetId: quotedTweetId,
                  tweetUrl: quotedStatusLink?.href || (quotedTweetId ? `https://x.com/${quoteInfo.screenName || "i"}/status/${quotedTweetId}` : ""),
                  author: quoteInfo.author,
                  screenName: quoteInfo.screenName,
                  tweetText: quoteInfo.text
                }
              });
            }
          });
        }

        // Build media lists for batch downloads
        const outerMediaList = [];
        outerPhotoContainers.forEach((pWrap, pIdx) => {
          const img = pWrap.querySelector("img");
          if (img && img.src) {
            outerMediaList.push({
              type: "photo",
              url: getDirectPhotoUrl(img.src) || img.src,
              index: pIdx
            });
          }
        });
        outerVideoTargets.forEach(vContainer => {
          const vEl = vContainer.querySelector("video") || (vContainer.tagName === "VIDEO" ? vContainer : null);
          const isGif = Boolean(isTwitterGif(vContainer, vEl, outerTweetId));
          const twVidId = extractTwVideoId(vContainer);
          let directMediaUrl = isGif ? resolveGifDirectUrl(vContainer, vEl, outerTweetId) : (vEl?.src && !vEl.src.startsWith("blob:") ? vEl.src : null);
          outerMediaList.push({
            type: isGif ? "gif" : "video",
            twVideoId: twVidId,
            targetTweetId: outerTweetId,
            outerTweetId: outerTweetId,
            targetVideoEl: vContainer,
            directMediaUrl: directMediaUrl,
            isQuote: false
          });
        });

        const quotedMediaList = [];
        quotedPhotoContainers.forEach((pWrap, pIdx) => {
          const img = pWrap.querySelector("img");
          if (img && img.src) {
            quotedMediaList.push({
              type: "photo",
              url: getDirectPhotoUrl(img.src) || img.src,
              index: pIdx
            });
          }
        });
        quotedVideoTargets.forEach(vContainer => {
          const vEl = vContainer.querySelector("video") || (vContainer.tagName === "VIDEO" ? vContainer : null);
          const targetTid = quotedTweetId || outerTweetId;
          const isGif = Boolean(isTwitterGif(vContainer, vEl, targetTid));
          const twVidId = extractTwVideoId(vContainer);
          let directMediaUrl = isGif ? resolveGifDirectUrl(vContainer, vEl, targetTid) : (vEl?.src && !vEl.src.startsWith("blob:") ? vEl.src : null);
          quotedMediaList.push({
            type: isGif ? "gif" : "video",
            twVideoId: twVidId,
            targetTweetId: targetTid,
            outerTweetId: outerTweetId,
            targetVideoEl: vContainer,
            directMediaUrl: directMediaUrl,
            isQuote: true
          });
        });

        // C. Inject "Download All" in Quote Tweet Header row ONLY IF quote tweet has > 1 media items
        if (quoteBox && quotedMediaList.length > 1) {
          const quoteInfo = extractTweetInfo(quoteBox);
          injectQuoteTweetDownloadAll(
            quoteBox,
            quotedMediaList,
            quoteInfo,
            quotedTweetId || outerTweetId,
            quotedStatusLink?.href || window.location.href
          );
        } else {
          // Clean up any stray quote download-all wrappers if quote has <= 1 media
          const staleQuoteBtn = article.querySelector(".x-quote-dl-all-wrapper");
          if (staleQuoteBtn) staleQuoteBtn.remove();
        }

        // D. Inject Main Download Button into Tweet Action Bar
        const allMediaInTweet = [...outerMediaList, ...quotedMediaList];
        const totalMedia = allMediaInTweet.length;

        // D1. Inject "Download All" button into Tweet Header (next to Grok / Caret) if outer tweet has > 1 media items
        if (outerMediaList.length > 1) {
          const outerInfo = extractTweetInfo(article);
          const pageUrl = outerTimeLink?.href || window.location.href;
          injectTweetHeaderDownloadAll(article, outerMediaList, outerInfo, outerTweetId, pageUrl);
        } else {
          const staleHeaderBtn = article.querySelector(".x-tweet-header-dl-all-wrapper");
          if (staleHeaderBtn) staleHeaderBtn.remove();
        }

        // Clean up any stray floating media download-all badges on media
        const staleMediaBadges = article.querySelectorAll(".x-media-dl-all-badge");
        staleMediaBadges.forEach(b => b.remove());

        const actionGroup = findTweetActionBar(article, quoteBox);
        if (actionGroup && totalMedia > 0) {
          let btnWrapper = actionGroup.querySelector(".x-tweet-dl-wrapper");
          let btn = btnWrapper?.querySelector(".x-tweet-dl-btn");

          if (!btnWrapper) {
            btnWrapper = document.createElement("div");
            btnWrapper.className = "x-tweet-dl-wrapper";
            btnWrapper.style.cssText = "display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; min-width: 36px; height: 100%;";

            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "x-tweet-dl-btn";
            btn.style.cssText = `
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: transparent;
              border: none;
              cursor: pointer;
              padding: 0 6px;
              min-width: 32px;
              height: 32px;
              border-radius: 9999px;
              color: rgb(113, 118, 123);
              transition: background-color 0.2s, color 0.2s;
              flex-shrink: 0;
            `;

            btnWrapper.appendChild(btn);

            btn.addEventListener("mouseenter", () => {
              if (btn.dataset.saved) return;
              if (btn.dataset.isPill === "true") {
                btn.style.background = "#1d9bf0";
                btn.style.borderColor = "#1d9bf0";
                btn.style.color = "#ffffff";
              } else {
                btn.style.backgroundColor = "rgba(29, 155, 240, 0.1)";
                btn.style.color = "rgb(29, 155, 240)";
              }
            });
            btn.addEventListener("mouseleave", () => {
              if (btn.dataset.saved) return;
              if (btn.dataset.isPill === "true") {
                btn.style.background = "rgba(29, 155, 240, 0.14)";
                btn.style.borderColor = "rgba(29, 155, 240, 0.45)";
                btn.style.color = "#1d9bf0";
              } else {
                btn.style.backgroundColor = "transparent";
                btn.style.color = "rgb(113, 118, 123)";
              }
            });

            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              e.preventDefault();

              const outerInfo = extractTweetInfo(article);
              const pageUrl = outerTimeLink?.href || window.location.href;

              const markSuccess = () => {
                btn.dataset.saved = "true";
                btn.style.color = "#ffffff";
                btn.style.background = "#00ba7c";
                btn.style.borderColor = "#00ba7c";
                btn.innerHTML = `
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  ${btn.dataset.isPill === "true" ? `<span>${currentLang === "en" ? "Saved" : "Tersimpan"}</span>` : ""}
                `;
                setTimeout(() => {
                  delete btn.dataset.saved;
                  updateTweetDlButtonHtml(btn, allMediaInTweet.length);
                }, 2500);
              };
              const markReset = () => {
                delete btn.dataset.saved;
                updateTweetDlButtonHtml(btn, allMediaInTweet.length);
              };

              downloadAllMediaList(allMediaInTweet, outerTweetId, outerInfo, pageUrl, (ok) => {
                if (ok) markSuccess();
                else markReset();
              });
            });

            if (actionGroup.children.length >= 2) {
              actionGroup.insertBefore(btnWrapper, actionGroup.lastElementChild);
            } else {
              actionGroup.appendChild(btnWrapper);
            }
          }

          if (btn && !btn.dataset.saved) {
            updateTweetDlButtonHtml(btn, totalMedia);
          }

          if (contentSettings.inTweetBtn === false) {
            btnWrapper.style.display = "none";
          } else {
            btnWrapper.style.display = "inline-flex";
          }
        }
      } catch (err) {
        console.error("[X-Vault] Error processing tweet article:", err);
      }
    });
  }

  // Lightbox / Enlarged Modal Viewer Download Buttons
  function injectLightboxDownloadButtons() {
    if (!window.location.hostname.includes("x.com") && !window.location.hostname.includes("twitter.com")) return;

    const isModalUrl = window.location.pathname.includes("/photo/") || window.location.pathname.includes("/video/");
    const modalDialog = document.querySelector('div[role="dialog"], div[aria-modal="true"], div[data-testid="swipe-to-dismiss"]');

    if (!isModalUrl && !modalDialog) {
      const staleTb = document.querySelector(".x-lightbox-toolbar");
      if (staleTb) staleTb.remove();
      return;
    }

    // Locate enlarged media
    let enlargedImg = null;
    let enlargedVideo = null;

    if (modalDialog) {
      enlargedImg = modalDialog.querySelector('div[aria-label="Image"] img, div[role="group"] img[src*="pbs.twimg.com/media"], div[data-testid="swipe-to-dismiss"] img, img[src*="pbs.twimg.com/media"]');
      enlargedVideo = modalDialog.querySelector("video");
    } else {
      enlargedImg = document.querySelector('div[aria-label="Image"] img, div[data-testid="swipe-to-dismiss"] img, img[src*="pbs.twimg.com/media"]');
      enlargedVideo = document.querySelector('div[data-testid="swipe-to-dismiss"] video, video');
    }

    if (enlargedImg && enlargedImg.src && enlargedImg.src.includes("profile_images")) {
      enlargedImg = null;
    }

    if (!enlargedImg && !enlargedVideo) {
      const staleTb = document.querySelector(".x-lightbox-toolbar");
      if (staleTb) staleTb.remove();
      return;
    }

    const currentMediaSrc = enlargedImg ? enlargedImg.src : (enlargedVideo?.src || enlargedVideo?.currentSrc || "video");
    let existingTb = document.querySelector(".x-lightbox-toolbar");
    if (existingTb) {
      if (existingTb.dataset.mediaSrc === currentMediaSrc) {
        return; // Already current
      }
      existingTb.remove(); // Media changed (e.g. Next / Prev photo clicked)
    }

    const statusTweetId = window.location.pathname.match(/\/status\/(\d+)/)?.[1] || null;
    const sidebarArticle = (modalDialog?.querySelector('article[data-testid="tweet"]')) || document.querySelector('article[data-testid="tweet"]');
    const tweetInfo = sidebarArticle ? extractTweetInfo(sidebarArticle) : {
      author: "Twitter User",
      screenName: "i",
      text: cleanTitleString(document.title) || "X Post",
      tweetTime: "",
      tweetIsoDate: ""
    };
    const tweetPageUrl = statusTweetId ? `https://x.com/${tweetInfo.screenName || "i"}/status/${statusTweetId}` : window.location.href;

    const isVideo = Boolean(enlargedVideo);
    const directPhotoUrl = enlargedImg ? getDirectPhotoUrl(enlargedImg.src) : null;

    const tb = document.createElement("div");
    tb.className = "x-lightbox-toolbar";
    tb.dataset.mediaSrc = currentMediaSrc;
    tb.style.cssText = `
      position: fixed;
      top: 12px;
      left: 58px;
      z-index: 999999;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      pointer-events: auto;
    `;

    // Download Button
    const dlBtn = document.createElement("button");
    dlBtn.type = "button";
    dlBtn.className = "x-lightbox-dl-btn";
    dlBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 9999px;
      padding: 6px 14px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      cursor: pointer;
      transition: all 0.18s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      user-select: none;
    `;
    const defaultDlText = isVideo
      ? (currentLang === "en" ? "Download Video" : "Unduh Video")
      : (currentLang === "en" ? "Download Photo" : "Unduh Foto");
    const defaultDlHtml = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${defaultDlText}</span>
    `;
    dlBtn.innerHTML = defaultDlHtml;

    dlBtn.addEventListener("mouseenter", () => {
      if (!dlBtn.dataset.saved) {
        dlBtn.style.background = "#1d9bf0";
        dlBtn.style.borderColor = "#1d9bf0";
      }
    });
    dlBtn.addEventListener("mouseleave", () => {
      if (!dlBtn.dataset.saved) {
        dlBtn.style.background = "rgba(0, 0, 0, 0.75)";
        dlBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
      }
    });

    function startLightboxVideoDownload(chosen) {
      if (dlBtn.dataset.saved || dlBtn.dataset.downloading) return;

      const clientReqId = "req_modal_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      dlBtn.dataset.downloading = "true";
      dlBtn.style.background = "rgba(0, 0, 0, 0.85)";
      dlBtn.style.borderColor = "#1d9bf0";

      const renderModalProgress = (pct) => {
        const pctStr = (pct !== null && pct !== undefined && pct > 0 && pct < 100) ? ` ${pct}%` : "";
        dlBtn.innerHTML = `
          <svg class="x-vault-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="#1d9bf0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>${currentLang === "en" ? "Downloading..." : "Mengunduh..."}${pctStr}</span>
        `;
      };
      renderModalProgress(null);

      const restoreDefault = () => {
        delete dlBtn.dataset.saved;
        delete dlBtn.dataset.downloading;
        dlBtn.style.background = "rgba(0, 0, 0, 0.75)";
        dlBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
        dlBtn.innerHTML = defaultDlHtml;
      };

      registerDownloadTracker(clientReqId, {
        onProgress: (pct) => {
          renderModalProgress(pct);
        },
        onComplete: () => {
          delete dlBtn.dataset.downloading;
          dlBtn.dataset.saved = "true";
          dlBtn.style.background = "#00ba7c";
          dlBtn.style.borderColor = "#00ba7c";
          dlBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${currentLang === "en" ? "Saved" : "Tersimpan"}</span>
          `;
          setTimeout(() => {
            restoreDefault();
          }, 2500);
        },
        onError: () => {
          restoreDefault();
        }
      });

      const vidTarget = enlargedVideo.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]') || enlargedVideo.parentElement;
      const twVidId = extractTwVideoId(vidTarget);
      const thumbUrl = enlargedVideo.poster || null;
      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_TWEET",
        payload: {
          twVideoId: twVidId,
          tweetId: statusTweetId,
          outerTweetId: statusTweetId,
          allTweetIds: [statusTweetId].filter(Boolean),
          author: tweetInfo.author,
          screenName: tweetInfo.screenName,
          tweetText: tweetInfo.text,
          tweetTime: tweetInfo.tweetTime,
          tweetIsoDate: tweetInfo.tweetIsoDate,
          thumbnail: thumbUrl,
          isQuoteTweet: false,
          isGif: false,
          directMediaUrl: enlargedVideo.src?.startsWith("blob:") ? null : enlargedVideo.src,
          targetQuality: chosen?.targetQuality,
          targetFormatUrl: chosen?.targetFormatUrl,
          isAudioOnly: Boolean(chosen?.isAudioOnly),
          pageUrl: tweetPageUrl,
          clientReqId
        }
      }, (res) => {
        if (!res?.success) {
          unregisterDownloadTracker(clientReqId);
          restoreDefault();
        } else if (res?.downloadId && clientReqId) {
          const tracker = activeDownloadTrackers.get(clientReqId);
          if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
        }
      });
    }

    dlBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (dlBtn.dataset.saved || dlBtn.dataset.downloading) return;

      if (isVideo) {
        if (contentSettings.defaultQuality === "ask") {
          const vidTarget = enlargedVideo.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]') || enlargedVideo.parentElement;
          const twVidId = extractTwVideoId(vidTarget);
          showVideoQualityModal({
            anchorEl: dlBtn,
            twVideoId: twVidId,
            targetTweetId: statusTweetId,
            outerTweetId: statusTweetId,
            directMediaUrl: enlargedVideo.src?.startsWith("blob:") ? null : enlargedVideo.src,
            onSelect: (chosen) => {
              if (chosen) startLightboxVideoDownload(chosen);
            }
          });
          return;
        }
        startLightboxVideoDownload(null);
        return;
      }

      const clientReqId = "req_modal_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      dlBtn.dataset.downloading = "true";
      dlBtn.style.background = "rgba(0, 0, 0, 0.85)";
      dlBtn.style.borderColor = "#1d9bf0";

      const renderModalProgress = (pct) => {
        const pctStr = (pct !== null && pct !== undefined && pct > 0 && pct < 100) ? ` ${pct}%` : "";
        dlBtn.innerHTML = `
          <svg class="x-vault-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
            <path d="M12 3a9 9 0 0 1 9 9" stroke="#1d9bf0" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <span>${currentLang === "en" ? "Downloading..." : "Mengunduh..."}${pctStr}</span>
        `;
      };
      renderModalProgress(null);

      const restoreDefault = () => {
        delete dlBtn.dataset.saved;
        delete dlBtn.dataset.downloading;
        dlBtn.style.background = "rgba(0, 0, 0, 0.75)";
        dlBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
        dlBtn.innerHTML = defaultDlHtml;
      };

      registerDownloadTracker(clientReqId, {
        onProgress: (pct) => {
          renderModalProgress(pct);
        },
        onComplete: () => {
          delete dlBtn.dataset.downloading;
          dlBtn.dataset.saved = "true";
          dlBtn.style.background = "#00ba7c";
          dlBtn.style.borderColor = "#00ba7c";
          dlBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>${currentLang === "en" ? "Saved" : "Tersimpan"}</span>
          `;
          setTimeout(() => {
            restoreDefault();
          }, 2500);
        },
        onError: () => {
          restoreDefault();
        }
      });

      chrome.runtime.sendMessage({
        action: "DOWNLOAD_TWITTER_IMAGE",
        payload: {
          imageUrl: directPhotoUrl || enlargedImg.src,
          tweetId: statusTweetId,
          author: tweetInfo.author,
          screenName: tweetInfo.screenName,
            tweetText: tweetInfo.text,
            tweetTime: tweetInfo.tweetTime,
            tweetIsoDate: tweetInfo.tweetIsoDate,
            thumbnail: enlargedImg.src,
            pageUrl: tweetPageUrl,
            index: 0,
            clientReqId
          }
        }, (res) => {
          if (!res?.success) {
            unregisterDownloadTracker(clientReqId);
            restoreDefault();
          } else if (res?.downloadId && clientReqId) {
            const tracker = activeDownloadTrackers.get(clientReqId);
            if (tracker) activeDownloadTrackers.set(res.downloadId, tracker);
          }
        });
    });

    dlBtn.addEventListener("contextmenu", (e) => {
      if (isVideo) {
        e.preventDefault();
        e.stopPropagation();
        if (dlBtn.dataset.saved || dlBtn.dataset.downloading) return;
        const vidTarget = enlargedVideo.closest('div[data-testid="videoPlayer"], div[data-testid="videoComponent"]') || enlargedVideo.parentElement;
        const twVidId = extractTwVideoId(vidTarget);
        showVideoQualityModal({
          anchorEl: dlBtn,
          twVideoId: twVidId,
          targetTweetId: statusTweetId,
          outerTweetId: statusTweetId,
          directMediaUrl: enlargedVideo.src?.startsWith("blob:") ? null : enlargedVideo.src,
          onSelect: (chosen) => {
            if (chosen) startLightboxVideoDownload(chosen);
          }
        });
      }
    });

    // Copy Link Button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "x-lightbox-copy-btn";
    copyBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 9999px;
      padding: 6px 12px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      cursor: pointer;
      transition: all 0.18s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      user-select: none;
    `;
    const defaultCopyHtml = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      <span>${currentLang === "en" ? "Copy Link" : "Salin Link"}</span>
    `;
    copyBtn.innerHTML = defaultCopyHtml;

    copyBtn.addEventListener("mouseenter", () => {
      if (!copyBtn.dataset.copied) {
        copyBtn.style.background = "#1d9bf0";
        copyBtn.style.borderColor = "#1d9bf0";
      }
    });
    copyBtn.addEventListener("mouseleave", () => {
      if (!copyBtn.dataset.copied) {
        copyBtn.style.background = "rgba(0, 0, 0, 0.75)";
        copyBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
      }
    });

    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      const onCopyDone = () => {
        copyBtn.dataset.copied = "true";
        copyBtn.style.background = "#00ba7c";
        copyBtn.style.borderColor = "#00ba7c";
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>${currentLang === "en" ? "Copied" : "Disalin"}</span>
        `;
        setTimeout(() => {
          delete copyBtn.dataset.copied;
          copyBtn.style.background = "rgba(0, 0, 0, 0.75)";
          copyBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
          copyBtn.innerHTML = defaultCopyHtml;
        }, 2000);
      };

      if (!isVideo && directPhotoUrl) {
        copyDirectLink(directPhotoUrl);
        onCopyDone();
      } else if (isVideo && enlargedVideo?.src && !enlargedVideo.src.startsWith("blob:")) {
        copyDirectLink(enlargedVideo.src);
        onCopyDone();
      } else if (isVideo) {
        chrome.runtime.sendMessage({
          action: "GET_DIRECT_MEDIA_URL",
          payload: {
            tweetId: statusTweetId,
            allTweetIds: [statusTweetId].filter(Boolean)
          }
        }, (res) => {
          if (res?.url) {
            copyDirectLink(res.url);
            onCopyDone();
          } else {
            showTwitterToast(currentLang === "en" ? "Media link ready when played" : "Tautan siap saat media diputar");
          }
        });
      }
    });

    tb.appendChild(dlBtn);
    tb.appendChild(copyBtn);

    if (contentSettings.inTweetBtn === false && contentSettings.mediaCornerBadges === false) {
      tb.style.display = "none";
    }

    document.body.appendChild(tb);
  }

  // Auto-Reveal Sensitive / NSFW Media
  function autoRevealSensitiveMedia() {
    if (contentSettings.autoRevealNsfw === false) return;
    try {
      const warningContainers = document.querySelectorAll(
        'article[data-testid="tweet"] div[data-testid="emptyState"]:not([data-vault-unblurred]), ' +
        'article[data-testid="tweet"] [aria-label*="sensitive" i]:not([data-vault-unblurred]), ' +
        'article[data-testid="tweet"] [aria-label*="sensitif" i]:not([data-vault-unblurred])'
      );
      for (const container of warningContainers) {
        container.setAttribute("data-vault-unblurred", "true");
        const txt = (container.textContent || "").toLowerCase();
        if (txt.includes("sensitive") || txt.includes("sensitif") || txt.includes("show content") || txt.includes("tampilkan konten")) {
          const btn = container.querySelector('button, div[role="button"]');
          if (btn) {
            btn.click();
          }
        }
      }
    } catch (e) {}
  }

  // High-performance DOM scanner with RAF throttling & idle debounce
  let scanScheduled = false;
  let metadataTimer = null;

  function scheduleFullScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      try {
        ensureMediaOverlayStyles();
      } catch (e) {}
      try {
        injectTwitterDownloadButtons();
      } catch (e) {
        console.error("[X-Vault] Scan error:", e);
      }
      try {
        injectLightboxDownloadButtons();
      } catch (e) {
        console.error("[X-Vault] Lightbox scan error:", e);
      }
      try {
        autoRevealSensitiveMedia();
      } catch (e) {}
    });

    if (!metadataTimer) {
      metadataTimer = setTimeout(() => {
        metadataTimer = null;
        try {
          syncPageMetadata();
        } catch (e) {}
      }, 1200);
    }
  }

  const twObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
      if (mutations[i].removedNodes.length > 0) {
        for (let j = 0; j < mutations[i].removedNodes.length; j++) {
          const node = mutations[i].removedNodes[j];
          if (node.nodeType === 1 && (node.classList?.contains("x-tweet-dl-wrapper") || node.querySelector?.(".x-tweet-dl-wrapper, .x-media-corner-badge, .x-tweet-header-dl-all-wrapper, .x-quote-dl-all-wrapper"))) {
            shouldScan = true;
            break;
          }
        }
        if (shouldScan) break;
      }
    }
    if (shouldScan) {
      scheduleFullScan();
    }
  });

  function startObserverAndScan() {
    try {
      ensureMediaOverlayStyles();
    } catch (e) {}
    if (document.body) {
      try {
        twObserver.observe(document.body, { childList: true, subtree: true });
      } catch (e) {}
    }
    // Also listen to window scroll to catch newly rendered tweets in virtualized feed
    window.addEventListener("scroll", () => scheduleFullScan(), { passive: true });
    scheduleFullScan();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserverAndScan);
  } else {
    startObserverAndScan();
  }

  // Fast burst scans on page initialization to catch instant React hydrates
  [100, 300, 700, 1500, 3000].forEach(delay => setTimeout(scheduleFullScan, delay));

  // Handle URL / navigation changes (Twitter SPA)
  window.addEventListener("popstate", () => {
    syncPageMetadata();
    scheduleFullScan();
    setTimeout(scheduleFullScan, 600);
  });

  // Low-frequency fallback heartbeat (only when tab is active and visible)
  setInterval(() => {
    if (!document.hidden) {
      scheduleFullScan();
    }
  }, 2500);

  // Auto-download listener if opened with #x-auto-dl from popup
  if (window.location.hash && window.location.hash.includes("x-auto-dl")) {
    let autoTriggered = false;
    const autoInterval = setInterval(() => {
      const btn = document.querySelector(".x-tweet-dl-btn");
      if (btn && !autoTriggered) {
        autoTriggered = true;
        clearInterval(autoInterval);
        setTimeout(() => {
          btn.click();
        }, 800);
      }
    }, 600);
    setTimeout(() => clearInterval(autoInterval), 20000);
  }

  // Listen to manual scan requests, clipboard requests, and live download progress updates
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "DOWNLOAD_PROGRESS_UPDATE") {
      const { downloadId, clientReqId, state, percent, bytesReceived, totalBytes } = req.payload || {};
      const tracker = (clientReqId && activeDownloadTrackers.get(clientReqId)) ||
                      (downloadId && (activeDownloadTrackers.get(downloadId) || activeDownloadTrackers.get(Number(downloadId)) || activeDownloadTrackers.get(String(downloadId))));
      if (tracker) {
        if (downloadId && clientReqId && !activeDownloadTrackers.has(downloadId)) {
          activeDownloadTrackers.set(downloadId, tracker);
          activeDownloadTrackers.set(Number(downloadId), tracker);
          activeDownloadTrackers.set(String(downloadId), tracker);
        }
        if (state === "complete") {
          if (tracker.onComplete) tracker.onComplete();
          if (clientReqId) activeDownloadTrackers.delete(clientReqId);
          if (downloadId) {
            activeDownloadTrackers.delete(downloadId);
            activeDownloadTrackers.delete(Number(downloadId));
            activeDownloadTrackers.delete(String(downloadId));
          }
        } else if (state === "interrupted") {
          if (tracker.onError) tracker.onError("interrupted");
          if (clientReqId) activeDownloadTrackers.delete(clientReqId);
          if (downloadId) {
            activeDownloadTrackers.delete(downloadId);
            activeDownloadTrackers.delete(Number(downloadId));
            activeDownloadTrackers.delete(String(downloadId));
          }
        } else {
          if (tracker.onProgress) tracker.onProgress(percent, bytesReceived, totalBytes);
        }
      }
      sendResponse({ received: true });
      return;
    }
    if (req.action === "SCAN_PAGE") {
      syncPageMetadata();
      injectTwitterDownloadButtons();
      sendResponse({ success: true });
    }
    if (req.action === "COPY_TEXT_TO_CLIPBOARD") {
      if (req.payload?.text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(req.payload.text).catch(() => {});
        }
        showTwitterToast(currentLang === "en" ? "Direct media link copied!" : "Tautan media langsung disalin!");
        sendResponse({ success: true });
      }
    }
  });
})();
