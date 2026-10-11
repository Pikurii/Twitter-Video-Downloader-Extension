// popup.js - X-Vault: Modern Neo-Retro Media Collector UI Logic
// Developed for X-Vault by Pikuri (https://github.com/Pikurii)

// Cross-browser WebExtensions API compatibility (Chrome, Edge, Opera, Opera GX, Brave, Firefox)
if (typeof chrome === "undefined" && typeof browser !== "undefined") {
  globalThis.chrome = browser;
} else if (typeof browser === "undefined" && typeof chrome !== "undefined") {
  globalThis.browser = chrome;
}

document.addEventListener("DOMContentLoaded", () => {
  // ==================== I18N DICTIONARY ====================
  const I18N = {
    id: {
      totalDropsLabel: "TOTAL DROPS",
      videoCountLabel: "Videos",
      imageCountLabel: "Photos",
      levelProgress: "LEVEL EXP",
      nsfwShieldTitle: "NSFW Auto-Unblur",
      nsfwShieldDesc: "Buka konten sensitif otomatis di linimasa",
      btnDrop: "UNDUH",
      recentVaultTitle: "RECENT DROPS",
      viewAll: "Lihat Semua →",
      openTwitter: "Buka x.com ↗",
      toastNsfwOn: "NSFW: Otomatis tampilkan media",
      toastNsfwOff: "NSFW: Auto-unblur dinonaktifkan",
      toastInvalidUrl: "Masukkan tautan tweet yang valid",
      toastFetching: "Memproses unduhan tweet...",
      emptyRecent: "Belum ada file diunduh. Buka X untuk mulai!",
      statusReady: "READY",
      statusActive: "LINIMASA X",
      goalPrefix: "GOAL:",
      dropsSuffix: "DROPS",
      toastThemeDark: "Tema Gelap Aktif",
      toastThemeLight: "Tema Terang Aktif"
    },
    en: {
      totalDropsLabel: "TOTAL DROPS",
      videoCountLabel: "Videos",
      imageCountLabel: "Photos",
      levelProgress: "LEVEL EXP",
      nsfwShieldTitle: "NSFW Auto-Unblur",
      nsfwShieldDesc: "Automatically reveal sensitive media on timeline",
      btnDrop: "GET",
      recentVaultTitle: "RECENT DROPS",
      viewAll: "View All →",
      openTwitter: "Open x.com ↗",
      toastNsfwOn: "NSFW: Auto-reveal enabled",
      toastNsfwOff: "NSFW: Auto-reveal disabled",
      toastInvalidUrl: "Please enter a valid tweet URL",
      toastFetching: "Processing tweet download...",
      emptyRecent: "No files downloaded yet. Open X to start!",
      statusReady: "READY",
      statusActive: "X TIMELINE",
      goalPrefix: "GOAL:",
      dropsSuffix: "DROPS",
      toastThemeDark: "Dark Theme Active",
      toastThemeLight: "Light Theme Active"
    }
  };

  // Gamification Level Configurations
  const LEVEL_TIERS = [
    { level: 1, title: "Rookie", min: 0, next: 10 },
    { level: 2, title: "Explorer", min: 10, next: 25 },
    { level: 3, title: "Collector", min: 25, next: 50 },
    { level: 4, title: "Hunter", min: 50, next: 100 },
    { level: 5, title: "Master", min: 100, next: 250 },
    { level: 6, title: "Cyber Lord", min: 250, next: 500 },
    { level: 7, title: "X Legend", min: 500, next: 1000 },
    { level: 8, title: "Godlike", min: 1000, next: 99999 }
  ];

  // DOM Elements - Header & Status
  const tabStatusPill = document.getElementById("tabStatusPill");
  const tabStatusText = document.getElementById("tabStatusText");
  const btnQuickThemeToggle = document.getElementById("btnQuickThemeToggle");
  const themeToggleIcon = document.getElementById("themeToggleIcon");
  const btnEasterEgg = document.getElementById("btnEasterEgg");
  const btnOpenSettings = document.getElementById("btnOpenSettings");

  // DOM Elements - Player Badge Card & Stats
  const counterCard = document.getElementById("counterCard");
  const rankTitleText = document.getElementById("rankTitleText");
  const nextGoalText = document.getElementById("nextGoalText");
  const totalDropsNum = document.getElementById("totalDropsNum");
  const particleCanvas = document.getElementById("particleCanvas");
  const videoCountNum = document.getElementById("videoCountNum");
  const imageCountNum = document.getElementById("imageCountNum");
  const energyProgressText = document.getElementById("energyProgressText");
  const energySegmentsRow = document.getElementById("energySegmentsRow");

  // DOM Elements - NSFW Shield Card
  const toggleNsfw = document.getElementById("toggleNsfw");

  // DOM Elements - Quick Drop Card
  const quickDropInput = document.getElementById("quickDropInput");
  const btnQuickDrop = document.getElementById("btnQuickDrop");

  // DOM Elements - Recent Drops Card
  const recentDropsList = document.getElementById("recentDropsList");
  const btnOpenFullHistory = document.getElementById("btnOpenFullHistory");

  // DOM Elements - Footer
  const btnOpenTwitter = document.getElementById("btnOpenTwitter");

  // DOM Elements - Toast
  const toastNotification = document.getElementById("toastNotification");
  const toastMessage = document.getElementById("toastMessage");

  // State Management
  let toastTimer = null;
  let comboCount = 0;
  let comboTimer = null;

  let currentSettings = {
    theme: "dark",
    language: "id",
    autoRevealNsfw: true,
    inTweetBtn: true,
    mediaCornerBadges: true,
    defaultQuality: "native",
    filenameFormat: "author_text"
  };

  let downloadStats = {
    totalDownloads: 0,
    videoCount: 0,
    imageCount: 0
  };

  let downloadHistory = [];

  function t(key) {
    const lang = currentSettings.language || "id";
    const dict = I18N[lang] || I18N.id;
    return dict[key] || I18N.id[key] || key;
  }

  // Toast Helper
  function showToast(msg) {
    if (!toastNotification || !toastMessage) return;
    toastMessage.textContent = msg;
    toastNotification.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotification.classList.add("hidden");
    }, 2400);
  }

  // Persistent Shared AudioContext Singleton (Fixes Chrome 64 AudioContext limit bug)
  let sharedAudioCtx = null;

  function getSharedAudioContext() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return null;
      if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
        sharedAudioCtx = new AudioCtxClass();
      }
      if (sharedAudioCtx.state === "suspended") {
        sharedAudioCtx.resume().catch(() => {});
      }
      return sharedAudioCtx;
    } catch (e) {
      return null;
    }
  }

  // Web Audio Synth Sound Generator with persistent context
  function playRetroChime(type = "coin", pitchMultiplier = 1.0) {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (type === "coin") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";

        const f1 = 987.77 * pitchMultiplier; // B5
        const f2 = 1318.51 * pitchMultiplier; // E6

        osc.frequency.setValueAtTime(f1, now);
        osc.frequency.setValueAtTime(f2, now + 0.07);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.30);

        // Auto cleanup nodes after playing
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        };
      } else if (type === "level") {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";

          const noteStart = now + idx * 0.07;
          const noteStop = now + (idx + 1) * 0.12;

          osc.frequency.setValueAtTime(freq * pitchMultiplier, noteStart);
          gain.gain.setValueAtTime(0.08, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteStop);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteStart);
          osc.stop(noteStop);

          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch (e) {}
          };
        });
      }
    } catch (e) {
      // Audio policy or error handled safely
    }
  }

  // Apply Theme (Dark / Light)
  function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", selectedTheme);
    document.body.setAttribute("data-theme", selectedTheme);

    if (themeToggleIcon) {
      themeToggleIcon.innerHTML = selectedTheme === "dark"
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    }
    if (btnQuickThemeToggle) {
      btnQuickThemeToggle.title = selectedTheme === "dark"
        ? (currentSettings.language === "en" ? "Switch to Light Theme" : "Ganti ke Tema Terang")
        : (currentSettings.language === "en" ? "Switch to Dark Theme" : "Ganti ke Tema Gelap");
    }
  }

  // Apply Language to UI
  function applyLanguage(lang) {
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key && I18N[lang] && I18N[lang][key]) {
        el.textContent = I18N[lang][key];
      }
    });

    renderPlayerCardAndStats();
    renderRecentDrops();
  }

  // Calculate Level and Rank Progress
  function calculateLevelInfo(total) {
    const count = Math.max(0, parseInt(total, 10) || 0);
    let currentTier = LEVEL_TIERS[0];

    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (count >= LEVEL_TIERS[i].min) {
        currentTier = LEVEL_TIERS[i];
        break;
      }
    }

    const tierRange = Math.max(1, currentTier.next - currentTier.min);
    const progressInTier = Math.max(0, count - currentTier.min);
    const ratio = Math.min(1, Math.max(0, progressInTier / tierRange));
    const percent = Math.round(ratio * 100);
    const segmentsFilled = Math.min(10, Math.floor(ratio * 10));

    return {
      level: currentTier.level,
      title: currentTier.title,
      totalDownloads: count,
      nextGoal: currentTier.next,
      percent: percent,
      segmentsFilled: segmentsFilled
    };
  }

  // Render Main Player Card & Breakdown Stats
  function renderPlayerCardAndStats() {
    const totalCount = downloadStats.totalDownloads || 0;
    const vCount = downloadStats.videoCount || 0;
    const iCount = downloadStats.imageCount || 0;
    const info = calculateLevelInfo(totalCount);

    if (totalDropsNum) {
      totalDropsNum.textContent = totalCount < 10 ? `0${totalCount}` : String(totalCount);
    }
    if (videoCountNum) videoCountNum.textContent = String(vCount);
    if (imageCountNum) imageCountNum.textContent = String(iCount);

    if (rankTitleText) {
      rankTitleText.textContent = `LVL ${info.level} · ${info.title.toUpperCase()}`;
    }
    if (nextGoalText) {
      nextGoalText.textContent = `${t("goalPrefix")} ${info.nextGoal} ${t("dropsSuffix")}`;
    }
    if (energyProgressText) {
      energyProgressText.textContent = `${info.percent}%`;
    }

    if (energySegmentsRow) {
      const blocks = energySegmentsRow.querySelectorAll(".energy-block");
      blocks.forEach((block, idx) => {
        if (idx < info.segmentsFilled) {
          block.classList.add("filled");
        } else {
          block.classList.remove("filled");
        }
      });
    }
  }

  // Render Latest 2 Drops Preview in Main Card
  function renderRecentDrops() {
    if (!recentDropsList) return;
    recentDropsList.innerHTML = "";

    if (!downloadHistory || downloadHistory.length === 0) {
      recentDropsList.innerHTML = `
        <div class="empty-drops-placeholder">
          <span>${t("emptyRecent")}</span>
        </div>
      `;
      return;
    }

    const latestItems = downloadHistory.slice(0, 2);
    latestItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "recent-drop-item";

      const isGif = item.type === "gif" || (item.filename && item.filename.toLowerCase().endsWith(".gif")) || (item.title && item.title.toLowerCase().includes("gif"));
      const isImg = !isGif && item.type === "image";
      let badgeClass = "video";
      let badgeLabel = "MP4";
      if (isGif) {
        badgeClass = "gif";
        badgeLabel = "GIF";
      } else if (isImg) {
        badgeClass = "image";
        badgeLabel = "IMG";
      }
      const timeStr = item.timestamp
        ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

      row.innerHTML = `
        <div class="recent-drop-meta">
          <span class="recent-drop-title" title="${escapeHtml(item.title || item.filename || "X Media")}">
            ${escapeHtml(item.title || item.filename || "X Media")}
          </span>
          <span class="recent-drop-time">${timeStr}</span>
        </div>
        <span class="recent-badge ${badgeClass}">${badgeLabel}</span>
      `;
      recentDropsList.appendChild(row);
    });
  }

  // Load Saved State from Chrome Storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["settings", "downloadStats", "downloadHistory"], (data) => {
      if (data?.settings) {
        currentSettings = { ...currentSettings, ...data.settings };
      }
      if (data?.downloadStats) {
        downloadStats = { ...downloadStats, ...data.downloadStats };
      }
      if (data?.downloadHistory && Array.isArray(data.downloadHistory)) {
        downloadHistory = data.downloadHistory;
      }

      // Populate Input States
      if (toggleNsfw) toggleNsfw.checked = currentSettings.autoRevealNsfw !== false;

      applyTheme(currentSettings.theme || "dark");
      applyLanguage(currentSettings.language || "id");
    });
  } else {
    applyTheme("dark");
    applyLanguage("id");
  }

  // Listen for storage changes across tabs/windows
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings?.newValue) {
        currentSettings = { ...currentSettings, ...changes.settings.newValue };
        applyTheme(currentSettings.theme || "dark");
        applyLanguage(currentSettings.language || "id");
      }
    });
  }

  // Check Active Tab for Status indicator
  if (chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        if (url.includes("x.com") || url.includes("twitter.com")) {
          if (tabStatusText) tabStatusText.textContent = t("statusActive");
        } else {
          if (tabStatusText) tabStatusText.textContent = t("statusReady");
        }
      }
    });
  }

  // Listen for Live Download Events from Background Script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "DOWNLOAD_RECORDED" && msg.stats) {
      downloadStats = msg.stats;
      if (msg.lastItem) {
        const exists = (downloadHistory || []).some(it => it.id === msg.lastItem.id || (it.filename && it.filename === msg.lastItem.filename && Math.abs((it.timestamp || 0) - (msg.lastItem.timestamp || 0)) < 4000));
        if (!exists) {
          downloadHistory.unshift(msg.lastItem);
        }
      }
      renderPlayerCardAndStats();
      renderRecentDrops();
      playRetroChime("level");
    }
  });

  // ==================== INTERACTIVE EVENT LISTENERS ====================

  // Open Full Settings Page in New Tab
  function openSettingsPage(tabHash = "") {
    const url = chrome.runtime.getURL("settings/settings.html" + (tabHash ? `#${tabHash}` : ""));
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(url, "_blank");
    }
  }

  // Quick Theme Toggle Button
  if (btnQuickThemeToggle) {
    btnQuickThemeToggle.addEventListener("click", () => {
      const nextTheme = currentSettings.theme === "light" ? "dark" : "light";
      currentSettings.theme = nextTheme;
      applyTheme(nextTheme);
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ settings: currentSettings }, () => {
          showToast(nextTheme === "dark" ? t("toastThemeDark") : t("toastThemeLight"));
          playRetroChime("coin");
        });
      } else {
        showToast(nextTheme === "dark" ? t("toastThemeDark") : t("toastThemeLight"));
        playRetroChime("coin");
      }
    });
  }

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => {
      openSettingsPage("general");
    });
  }

  if (btnOpenFullHistory) {
    btnOpenFullHistory.addEventListener("click", () => {
      openSettingsPage("history");
    });
  }

  // NSFW Shield Switch
  if (toggleNsfw) {
    toggleNsfw.addEventListener("change", () => {
      currentSettings.autoRevealNsfw = toggleNsfw.checked;
      chrome.storage.local.set({ settings: currentSettings }, () => {
        showToast(currentSettings.autoRevealNsfw ? t("toastNsfwOn") : t("toastNsfwOff"));
        playRetroChime("coin");
      });
    });
  }

  // Easter Egg: Sound + Floating XP Particles on Counter Card or Brand Badge
  function triggerEasterEggParticle(evt) {
    comboCount++;
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => { comboCount = 0; }, 1500);

    const pitch = 1.0 + Math.min(0.4, comboCount * 0.03);
    playRetroChime("coin", pitch);

    if (particleCanvas) {
      const particle = document.createElement("div");
      particle.className = "pixel-particle";
      particle.textContent = comboCount > 2 ? `COMBO x${comboCount}!` : "+1 XP!";
      particle.style.left = `${Math.floor(Math.random() * 50) + 15}%`;
      particle.style.top = "6px";
      particleCanvas.appendChild(particle);

      setTimeout(() => { particle.remove(); }, 850);
    }
  }

  if (counterCard) {
    counterCard.addEventListener("click", triggerEasterEggParticle);
  }
  if (btnEasterEgg) {
    btnEasterEgg.addEventListener("click", triggerEasterEggParticle);
  }

  // Quick Drop Link Handler
  function handleQuickDrop() {
    const rawVal = quickDropInput ? quickDropInput.value.trim() : "";
    if (!rawVal) return;

    const tweetIdMatch = rawVal.match(/\/status\/(\d+)/i) || rawVal.match(/\b(\d{15,20})\b/);
    if (!tweetIdMatch) {
      showToast(t("toastInvalidUrl"));
      return;
    }

    const tweetId = tweetIdMatch[1];
    showToast(t("toastFetching"));

    chrome.runtime.sendMessage({
      action: "DOWNLOAD_TWITTER_TWEET",
      payload: { tweetId, pageUrl: rawVal }
    }, (res) => {
      if (!res || !res.success) {
        const targetUrl = `https://x.com/i/status/${tweetId}#x-auto-dl`;
        chrome.tabs.create({ url: targetUrl });
      } else {
        if (quickDropInput) quickDropInput.value = "";
      }
    });
  }

  if (btnQuickDrop) {
    btnQuickDrop.addEventListener("click", handleQuickDrop);
  }
  if (quickDropInput) {
    quickDropInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickDrop();
    });
  }

  // HTML Escape Helper
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
});
