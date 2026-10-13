// twitter_interceptor.js - Intercepts Twitter GraphQL & React state in MAIN world to extract highest quality MP4 variants (up to 1440p/4K)

(function () {
  if (window.__vdp_twitter_interceptor_active) return;
  window.__vdp_twitter_interceptor_active = true;

  // Cache of Twitter media items by twVideoId and by tweetId (bounded to prevent memory bloat)
  const MAX_CACHE_SIZE = 300;
  const twitterCacheByVideoId = new Map();
  const twitterCacheByTweetId = new Map();

  function setBoundedCache(map, key, val) {
    if (map.has(key)) {
      map.delete(key);
    } else if (map.size >= MAX_CACHE_SIZE) {
      const oldestKey = map.keys().next().value;
      map.delete(oldestKey);
    }
    map.set(key, val);
  }

  function formatBitrate(bps) {
    if (!bps || isNaN(bps) || bps <= 0) return "";
    const mbps = bps / 1000000;
    if (mbps >= 1) {
      return `${Math.round(mbps)}MB/s`;
    }
    return `${Math.round(bps / 1000)}KB/s`;
  }

  function getQualityFromRes(w, h, bitrate) {
    const minDim = (w && h) ? Math.min(w, h) : (h || w || 0);
    const maxDim = (w && h) ? Math.max(w, h) : (h || w || 0);

    if (minDim >= 2160 || maxDim >= 3840) return "4K";
    if (minDim >= 1440 || maxDim >= 2560) return "1440p";
    if (minDim >= 1080 || maxDim >= 1920) return "1080p";
    if (minDim >= 720 || maxDim >= 1280) return "720p";
    if (minDim >= 480 || maxDim >= 854) return "480p";
    if (minDim >= 360 || maxDim >= 640) return "360p";
    if (minDim >= 240) return "270p";

    if (bitrate >= 8000000) return "1440p";
    if (bitrate >= 3000000) return "1080p";
    if (bitrate >= 1500000) return "720p";
    if (bitrate >= 800000) return "480p";
    if (bitrate >= 400000) return "360p";
    return "270p";
  }

  function cleanTitle(str) {
    if (!str) return "video";
    let t = str.replace(/https?:\/\/\S+/gi, "").replace(/httpst?\.co\S*/gi, "").replace(/t\.co\/\S*/gi, "");
    t = t.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").trim().replace(/\s+/g, " ");
    if (t.length > 70) {
      t = t.substring(0, 70).trim().replace(/\s+\S*$/, "") + "..";
    }
    return t || "video";
  }

  function formatDurationMs(ms) {
    if (!ms || isNaN(ms)) return "";
    const totalSecs = Math.round(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function getCurrentStatusTweetId() {
    try {
      const match = window.location.pathname.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }

  function parseVideoInfo(videoInfo, tweetContext) {
    if (!videoInfo || !Array.isArray(videoInfo.variants)) return null;
    const variants = videoInfo.variants;
    if (variants.length === 0) return null;

    const mp4Variants = variants.filter(v => v.content_type === "video/mp4" && v.url);
    if (mp4Variants.length === 0 && !variants.some(v => v.url)) return null;

    // Sort MP4 variants by bitrate descending (highest quality first)
    mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const availableFormats = [];
    let bestMp4 = null;

    mp4Variants.forEach(v => {
      const bw = v.bitrate || 0;
      let w = 0, h = 0;
      const resMatch = v.url.match(/\/(\d+)x(\d+)\//);
      if (resMatch) {
        w = parseInt(resMatch[1], 10);
        h = parseInt(resMatch[2], 10);
      }
      const quality = getQualityFromRes(w, h, bw);
      const resStr = (w && h) ? `${w}x${h}` : quality;
      const bitrateStr = formatBitrate(bw);
      const label = `MP4 - ${resStr}${bitrateStr ? ` - ${bitrateStr}` : ""}`;

      const fmtObj = {
        format: "MP4",
        resolution: resStr,
        quality: quality,
        bitrate: bitrateStr,
        bitrateRaw: bw,
        label: label,
        url: v.url
      };
      availableFormats.push(fmtObj);

      if (!bestMp4) {
        bestMp4 = fmtObj;
      }
    });

    // Also include HLS master playlist if available
    const hlsVariant = variants.find(v => (v.content_type && v.content_type.includes("mpegURL")) || (v.url && v.url.includes(".m3u8")));
    if (hlsVariant) {
      availableFormats.push({
        format: "HLS",
        resolution: "Adaptif",
        quality: bestMp4 ? bestMp4.quality : "720p",
        bitrate: "",
        label: "HLS - Stream Adaptif (.m3u8)",
        url: hlsVariant.url
      });
    }

    if (!bestMp4 && hlsVariant) {
      bestMp4 = {
        format: "HLS",
        resolution: "720p",
        quality: "720p",
        bitrate: "",
        label: "HLS - 1280x720",
        url: hlsVariant.url
      };
    }

    if (!bestMp4) return null;

    // Add Matroska & Audio options
    availableFormats.push({
      format: "MKV",
      resolution: bestMp4.quality,
      quality: bestMp4.quality,
      bitrate: "",
      label: `MKV - ${bestMp4.quality} (Kontainer Matroska)`,
      url: bestMp4.url
    });
    if (!tweetContext.isGif) {
      availableFormats.push({
        format: "AUDIO",
        resolution: "Audio MP3",
        quality: "MP3",
        bitrate: "320kbps",
        label: "AUDIO - Ekstrak Suara (MP3)",
        url: bestMp4.url
      });
    }

    const author = (tweetContext.author || "").trim();
    const rawText = (tweetContext.text || "").trim();
    let titleStr = "";
    if (author && rawText) {
      titleStr = `${author} - ${cleanTitle(rawText)}.mp4`;
    } else if (rawText) {
      titleStr = `${cleanTitle(rawText)}.mp4`;
    } else if (author) {
      titleStr = `${author} Video.mp4`;
    } else {
      titleStr = "Twitter Video.mp4";
    }

    const durationStr = formatDurationMs(videoInfo.duration_millis);
    const screenNameStr = tweetContext.screenName || "";
    let tweetUrlStr = "";
    if (tweetContext.tweetId) {
      tweetUrlStr = `https://x.com/${screenNameStr || "i"}/status/${tweetContext.tweetId}`;
    } else if (window.location.pathname.includes("/status/")) {
      tweetUrlStr = window.location.href;
    }

    return {
      twVideoId: tweetContext.mediaId || "",
      tweetId: tweetContext.tweetId || "",
      parentTweetId: tweetContext.parentTweetId || "",
      url: bestMp4.url,
      title: titleStr,
      filename: titleStr,
      format: bestMp4.format,
      extension: "mp4",
      size: null,
      sizeFormatted: bestMp4.bitrate || "",
      isStream: bestMp4.format === "HLS",
      duration: durationStr,
      quality: bestMp4.quality,
      thumbnail: tweetContext.thumbnail || null,
      author: author || "Pengguna X",
      screenName: screenNameStr,
      avatar: tweetContext.avatar || null,
      tweetText: rawText,
      tweetUrl: tweetUrlStr,
      pageUrl: tweetUrlStr,
      isGif: Boolean(tweetContext.isGif),
      availableFormats: availableFormats,
      selectedFormat: bestMp4,
      detectedAt: Date.now(),
      source: "twitter_highres_api"
    };
  }

  function extractMediaFromTweetObj(tweetObj, parentContext = {}) {
    const results = [];
    if (!tweetObj || typeof tweetObj !== "object") return results;

    // Handle TweetWithVisibilityResults wrapper or nested tweet objects
    if (tweetObj.__typename === "TweetWithVisibilityResults" && tweetObj.tweet) {
      tweetObj = tweetObj.tweet;
    } else if (tweetObj.tweet && typeof tweetObj.tweet === "object") {
      tweetObj = tweetObj.tweet;
    }

    const tweetId = tweetObj.rest_id || tweetObj.id_str || (tweetObj.__typename === "Tweet" && tweetObj.id) || tweetObj.legacy?.id_str || parentContext.tweetId || "";
    const author = tweetObj.core?.user_results?.result?.legacy?.name || 
                   tweetObj.user?.name || 
                   parentContext.author || "";
    const screenName = tweetObj.core?.user_results?.result?.legacy?.screen_name ||
                       tweetObj.user?.screen_name ||
                       parentContext.screenName || "";
    const avatar = tweetObj.core?.user_results?.result?.legacy?.profile_image_url_https ||
                   tweetObj.user?.profile_image_url_https ||
                   parentContext.avatar || "";
    const text = tweetObj.note_tweet?.note_tweet_results?.result?.text || 
                 tweetObj.legacy?.full_text || 
                 tweetObj.text || 
                 parentContext.text || "";

    const mediaList = tweetObj.legacy?.extended_entities?.media || 
                      tweetObj.extended_entities?.media || 
                      tweetObj.legacy?.entities?.media || 
                      tweetObj.entities?.media || [];

    if (Array.isArray(mediaList) && mediaList.length > 0) {
      mediaList.forEach(m => {
        if (m && m.video_info && Array.isArray(m.video_info.variants)) {
          const mediaId = m.id_str || m.id || "";
          const thumb = m.media_url_https || m.media_url || null;
          const isGif = m.type === "animated_gif";
          const ctx = {
            tweetId,
            parentTweetId: parentContext.parentTweetId || "",
            author,
            screenName,
            avatar,
            text,
            mediaId,
            thumbnail: thumb,
            isGif
          };
          const item = parseVideoInfo(m.video_info, ctx);
          if (item) {
            results.push(item);
          }
        }
      });
    }

    // Check quoted tweet (e.g. quote tweets with videos)
    let quoted = tweetObj.quoted_status_result?.result;
    if (quoted) {
      if (quoted.__typename === "TweetWithVisibilityResults" && quoted.tweet) {
        quoted = quoted.tweet;
      } else if (quoted.tweet && typeof quoted.tweet === "object") {
        quoted = quoted.tweet;
      }
      const quotedMedia = extractMediaFromTweetObj(quoted, { parentTweetId: tweetId });
      quotedMedia.forEach(m => {
        m.parentTweetId = tweetId;
      });
      results.push(...quotedMedia);
    }

    // Check retweeted tweet
    let retweeted = tweetObj.legacy?.retweeted_status_result?.result;
    if (retweeted) {
      if (retweeted.__typename === "TweetWithVisibilityResults" && retweeted.tweet) {
        retweeted = retweeted.tweet;
      } else if (retweeted.tweet && typeof retweeted.tweet === "object") {
        retweeted = retweeted.tweet;
      }
      const rtMedia = extractMediaFromTweetObj(retweeted, { parentTweetId: tweetId });
      rtMedia.forEach(m => {
        m.parentTweetId = tweetId;
      });
      results.push(...rtMedia);
    }

    return results;
  }

  function traverseForTwitterMedia(obj, context = {}, results = []) {
    if (!obj || typeof obj !== "object") return results;

    let currentContext = { ...context };

    // Extract tweet context if present at this level
    if (obj.entryId && typeof obj.entryId === "string") {
      const match = obj.entryId.match(/(?:tweet|status)-(\d{15,22})/i) || obj.entryId.match(/\b(\d{15,22})\b/);
      if (match) {
        currentContext.tweetId = match[1];
      }
    }
    if (obj.rest_id && typeof obj.rest_id === "string" && /^\d{15,22}$/.test(obj.rest_id)) {
      currentContext.tweetId = obj.rest_id;
    }
    if (obj.legacy && typeof obj.legacy === "object") {
      if (obj.legacy.id_str) currentContext.tweetId = obj.legacy.id_str;
      if (obj.legacy.full_text) currentContext.text = obj.legacy.full_text;
    }
    if (obj.core?.user_results?.result?.legacy) {
      const userLegacy = obj.core.user_results.result.legacy;
      if (userLegacy.name) currentContext.author = userLegacy.name;
      if (userLegacy.screen_name) currentContext.screenName = userLegacy.screen_name;
      if (userLegacy.profile_image_url_https) currentContext.avatar = userLegacy.profile_image_url_https;
    }

    // If this object represents a Tweet entity, parse it directly
    if (obj.__typename === "Tweet" || (obj.rest_id && (obj.legacy || obj.core))) {
      const tweetItems = extractMediaFromTweetObj(obj, currentContext);
      if (tweetItems.length > 0) {
        results.push(...tweetItems);
      }
    }

    // Generic fallback for standalone video_info (e.g. Card player)
    if (obj.video_info && Array.isArray(obj.video_info.variants) && !results.some(r => r.twVideoId === (obj.id_str || obj.id))) {
      const mediaId = obj.id_str || obj.id || "";
      const thumb = obj.media_url_https || obj.media_url || currentContext.thumbnail || null;
      const ctx = {
        tweetId: currentContext.tweetId || "",
        parentTweetId: currentContext.parentTweetId || "",
        author: currentContext.author || "",
        screenName: currentContext.screenName || "",
        avatar: currentContext.avatar || "",
        text: currentContext.text || "",
        mediaId,
        thumbnail: thumb
      };
      const item = parseVideoInfo(obj.video_info, ctx);
      if (item) {
        results.push(item);
      }
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        traverseForTwitterMedia(obj[i], currentContext, results);
      }
    } else {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (typeof obj[k] === "object") {
          traverseForTwitterMedia(obj[k], currentContext, results);
        }
      }
    }

    return results;
  }

  function processExtractedMedia(mediaList) {
    if (!mediaList || mediaList.length === 0) return;

    // Deduplicate extracted items by twVideoId or URL
    const uniqueItems = [];
    const seenKeys = new Set();
    mediaList.forEach(item => {
      const key = item.twVideoId || item.url;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    });

    // Cache all items locally with bounded LRU protection
    uniqueItems.forEach(item => {
      if (item.twVideoId) setBoundedCache(twitterCacheByVideoId, item.twVideoId, item);
      if (item.tweetId) setBoundedCache(twitterCacheByTweetId, item.tweetId, item);
      if (item.parentTweetId) setBoundedCache(twitterCacheByTweetId, item.parentTweetId, item);
    });

    // Send CACHE_TWITTER_VARIANTS to content/background to prime the high-res cache
    try {
      window.postMessage({
        source: "VDP_TWITTER_MAIN",
        type: "CACHE_TWITTER_VARIANTS",
        payload: { items: uniqueItems }
      }, "*");
    } catch (e) {}

    // Determine PRIMARY status video
    const currentStatusId = getCurrentStatusTweetId();
    if (currentStatusId) {
      // Find the item matching the active status page URL
      const primaryItems = uniqueItems.filter(item => item.tweetId === currentStatusId);
      if (primaryItems.length > 0) {
        primaryItems.forEach(item => {
          item.isPrimary = true;
          window.postMessage({
            source: "VDP_TWITTER_MAIN",
            type: "TWITTER_PRIMARY_MEDIA",
            payload: { item }
          }, "*");
        });
      } else {
        // If exact status tweet match not labeled, check if the first item in a TweetDetail payload belongs to the status
        const firstItem = uniqueItems[0];
        if (firstItem && (!firstItem.tweetId || firstItem.tweetId === currentStatusId)) {
          firstItem.isPrimary = true;
          window.postMessage({
            source: "VDP_TWITTER_MAIN",
            type: "TWITTER_PRIMARY_MEDIA",
            payload: { item: firstItem }
          }, "*");
        }
      }
    }
  }

  function handleJsonResponse(data) {
    if (!data) return;
    try {
      const found = traverseForTwitterMedia(data);
      if (found && found.length > 0) {
        processExtractedMedia(found);
      }
    } catch (e) {}
  }

  // Intercept window.fetch
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || args[0]?.href || "");
      if (response && response.ok && (url.includes("/graphql/") || url.includes("/i/api/") || url.includes("twitter.com") || url.includes("x.com"))) {
        const clone = response.clone();
        clone.json().then(handleJsonResponse).catch(() => {});
      }
    } catch (e) {}
    return response;
  };

  // Intercept XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._vdp_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (this._vdp_url && (this._vdp_url.includes("/graphql/") || this._vdp_url.includes("/i/api/"))) {
          const parsed = JSON.parse(this.responseText);
          handleJsonResponse(parsed);
        }
      } catch (e) {}
    });
    return origSend.apply(this, args);
  };

  // Scan React fiber properties in DOM on request
  function scanDomReactFiber() {
    try {
      const statusTweetId = getCurrentStatusTweetId();
      if (statusTweetId) {
        // Only scan the primary status tweet article
        const statusLink = document.querySelector(`a[href*="/status/${statusTweetId}"]`);
        const targetArticle = statusLink ? statusLink.closest('article[data-testid="tweet"]') : document.querySelector('article[data-testid="tweet"]');
        if (targetArticle) {
          const fiberKey = Object.keys(targetArticle).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
          if (fiberKey && targetArticle[fiberKey]) {
            handleJsonResponse(targetArticle[fiberKey]);
          }
        }
        return;
      }

      // On non-status pages (feed/timeline), only scan articles currently with video
      const videoArticles = document.querySelectorAll('article[data-testid="tweet"] div[data-testid="videoPlayer"], article[data-testid="tweet"] div[data-testid="videoComponent"]');
      videoArticles.forEach(container => {
        const art = container.closest('article[data-testid="tweet"]');
        if (art) {
          const fiberKey = Object.keys(art).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"));
          if (fiberKey && art[fiberKey]) {
            handleJsonResponse(art[fiberKey]);
          }
        }
      });
    } catch (e) {}
  }

  // Handle SPA navigation (history.pushState / history.replaceState)
  let lastUrl = window.location.href;
  function handleUrlChange() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    const newStatusId = getCurrentStatusTweetId();
    window.postMessage({
      source: "VDP_TWITTER_MAIN",
      type: "TWITTER_URL_CHANGED",
      payload: { newUrl: lastUrl, statusTweetId: newStatusId }
    }, "*");

    if (newStatusId && twitterCacheByTweetId.has(newStatusId)) {
      const cached = twitterCacheByTweetId.get(newStatusId);
      cached.isPrimary = true;
      window.postMessage({
        source: "VDP_TWITTER_MAIN",
        type: "TWITTER_PRIMARY_MEDIA",
        payload: { item: cached }
      }, "*");
    } else {
      setTimeout(scanDomReactFiber, 500);
    }
  }

  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    handleUrlChange();
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    handleUrlChange();
  };

  window.addEventListener("popstate", handleUrlChange);

  window.addEventListener("message", (ev) => {
    if (ev.source === window && ev.data && ev.data.type === "VDP_TRIGGER_DOM_SCAN") {
      scanDomReactFiber();
    }
  });

  // Initial scan after DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(scanDomReactFiber, 1000));
  } else {
    setTimeout(scanDomReactFiber, 1000);
  }
})();

