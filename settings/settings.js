// settings.js - X-Vault: Neo-Retro Options & Control Center Logic
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
      // Sidebar & Navigation
      navGeneral: "Umum",
      navFeatures: "Fitur",
      navHistory: "Riwayat",
      navAbout: "Tentang & Level",
      openTwitter: "Buka x.com ↗",

      // Tab 1: General
      generalDesc: "Pengaturan penyimpanan berkas, sub-folder, dan format nama berkas otomatis.",
      askSaveTitle: "Tanya lokasi penyimpanan berkas",
      askSaveDesc: "Tampilkan jendela pemilih folder sebelum unduhan dimulai. Nonaktifkan jika ingin unduhan berjalan instan satu-klik.",
      subDirTitle: "Buat sub-direktori khusus",
      subDirDesc: "Simpan berkas unduhan ke dalam sub-folder khusus di dalam folder default Downloads browser.",
      subDirPlaceholder: "Nama folder...",
      btnSave: "SIMPAN",
      groupByAccountTitle: "Kelompokkan unduhan berdasarkan akun",
      groupByAccountDesc: "Otomatis pisahkan berkas ke dalam sub-folder tersendiri untuk setiap akun Twitter (@username).",
      patternTitle: "Penyusun Pola Nama Berkas (Filename Pattern)",
      patternDesc: "Klik tag di bawah untuk menyalakan atau mematikan. Gunakan tombol panah ◀ ▶ untuk mengatur urutan. Pratinjau langsung diperbarui.",
      btnResetDefault: "RESET KE DEFAULT",
      activeTagsLabel: "Pola Tag Aktif (Urutan Berkas):",
      availableTagsLabel: "Pilihan Tag (Klik untuk Menyalakan / Mematikan):",
      patternWarning: "Peringatan: Pola tidak menyertakan penanda unik (Tweet ID, Serial, atau Timestamp). Berkas yang diunduh berisiko saling menimpa!",
      themeTitle: "Tema Tampilan",
      themeDesc: "Pilih mode tampilan antarmuka antara tema gelap (Cyber Dark) yang nyaman di mata atau tema terang (Clean Light).",
      themeDark: "Gelap (Dark)",
      themeLight: "Terang (Light)",
      langTitle: "Bahasa Antarmuka",
      langDesc: "Pilih bahasa tampilan untuk ekstensi, popup, tombol di linimasa, dan notifikasi.",
      btnResetGeneral: "Reset Pengaturan Umum ke Default",

      // Tab 2: Features
      featuresDesc: "Sesuaikan perilaku pengunduhan, filter sensitif, kualitas media, dan tombol linimasa.",
      nsfwTitle: "Auto-reveal sensitif (NSFW Auto-Unblur)",
      nsfwDesc: "Otomatis menampilkan dan membuka postingan yang bertanda sensitif tanpa perlu mengklik tombol peringatan secara manual.",
      thumbnailTitle: "Unduh cover thumbnail video",
      thumbnailDesc: "Unduh juga gambar cover poster thumbnail (.jpg) saat mengunduh video dari tweet.",
      gifTitle: "Format Animasi GIF (Animated GIF format)",
      gifDesc: "Pilih bagaimana animasi GIF Twitter disimpan. Format .gif berukuran lebih besar dari .mp4 dan terbatas 256 warna. Pilih 'Tanya Setiap Unduh' untuk menampilkan pemilih format di linimasa setiap kali mengunduh.",
      gifAsk: "Tanya Setiap Unduh",
      gifMp4: "Native MP4",
      gifSmall: "GIF · Small",
      gifMedium: "GIF · Medium",
      gifOriginal: "GIF · Original",
      qualityTitle: "Kualitas Default Video",
      qualityDesc: "Pilih resolusi video yang diutamakan saat mengunduh video melalui tombol satu-klik. Pilih 'Tanya Setiap Unduh' untuk menampilkan pemilih resolusi di linimasa setiap kali mengunduh.",
      qualityAsk: "Tanya Setiap Unduh",
      qualityNative: "Native (Kualitas Asli)",
      quality1080p: "1080p (Full HD)",
      quality720p: "720p (HD)",
      quality480p: "480p (Hemat Data)",
      inTweetTitle: "Tombol Unduh di Kanan Bawah Postingan",
      inTweetDesc: "Tampilkan tombol logo unduh di bilah aksi kanan bawah setiap postingan tweet (di samping tombol like, retweet, dan bookmark).",
      mediaBadgesTitle: "Lencana Unduh di Sudut Media (Corner Badge)",
      mediaBadgesDesc: "Sematkan lencana tombol unduh HD / MP4 / GIF langsung di sudut kanan atas video dan foto tweet.",
      headerDlAllTitle: "Tombol Unduh Semua di Header Tweet",
      headerDlAllDesc: "Tampilkan tombol 'Unduh Semua' di sudut kanan atas postingan (di samping ikon Grok) jika tweet memiliki banyak media.",
      shortcutTitle: "Pintasan Papan Ketik (Keyboard shortcut)",
      shortcutDesc: "Tekan huruf <code>D</code> pada keyboard saat kursor berada di tweet untuk langsung memulai unduhan media.",

      // Tab 3: History
      recentDownloadsTitle: "Riwayat Unduhan",
      totalDropsStat: "TOTAL DROPS",
      videosStat: "VIDEOS",
      photosStat: "PHOTOS",
      gifsStat: "GIFS",
      loggingStat: "LOGGING",
      searchPlaceholder: "Cari berdasarkan nama akun atau isi tweet...",
      filterAll: "SEMUA",
      filterVideo: "MP4",
      filterImage: "JPG",
      filterGif: "GIF",
      btnClearAll: "Hapus Semua",
      btnClearAllTitle: "Hapus seluruh riwayat unduhan",
      btnExport: "Ekspor",
      btnExportTitle: "Ekspor riwayat ke JSON",
      btnImport: "Impor",
      btnImportTitle: "Impor riwayat dari berkas JSON",

      // Tab 4: About
      aboutDesc: "Profil kolektor Anda, penghargaan level, serta integritas ekstensi.",
      aboutCounterLabel: "TOTAL MEDIA TERKUMPUL",
      aboutProgressLabel: "PROGRES LEVEL",
      btnResetRank: "Reset Statistik & Level ke 0",
      aboutInfoTitle: "X-Vault: Media Downloader",
      aboutInfoText: "Ekstensi pengunduh media berkinerja tinggi yang dirancang untuk mengunduh video resolusi penuh, foto definisi tinggi (orig), dan animasi dari linimasa X / Twitter tanpa batasan.",
      metaVersion: "Versi:",
      metaDev: "Pengembang:",
      metaArch: "Arsitektur:",
      metaPrivacy: "Privasi:",
      metaPrivacyVal: "100% Client-Side (Tanpa Pelacak)",
      privacyCalloutText: "Ekstensi ini berjalan sepenuhnya secara lokal di peramban Anda. Tidak ada data unduhan, riwayat penjelajahan, maupun informasi akun yang dikirimkan ke server eksternal manapun.",

      // Tooltips & Dynamic Labels
      tagMoveLeft: "Geser ke kiri",
      tagMoveRight: "Geser ke kanan",
      tagRemove: "Hapus tag",
      tagToggleOn: "Klik untuk mengaktifkan tag",
      tagToggleOff: "Klik untuk menonaktifkan tag",
      nextGoalPrefix: "Target Berikutnya",
      dropsSuffix: "Drops",

      // Toasts & Alerts
      toastSaved: "Pengaturan berhasil disimpan!",
      toastReset: "Pengaturan telah direset ke default.",
      toastHistoryCleared: "Seluruh riwayat unduhan berhasil dibersihkan.",
      toastExportSuccess: "Riwayat berhasil diekspor ke format JSON.",
      toastImportSuccess: "Riwayat unduhan berhasil diimpor!",
      toastImportInvalid: "Format berkas JSON tidak valid!",
      confirmClearHistory: "Yakin ingin menghapus seluruh riwayat unduhan?",
      confirmResetGeneral: "Reset semua pengaturan umum ke default?",
      confirmResetRank: "Reset level dan statistik unduhan ke 0?",
      emptyHistory: "Belum ada riwayat unduhan. Mulai unduh media dari X!",
      noSearchResults: "Tidak ada riwayat unduhan yang cocok dengan pencarian.",
      btnOpenPostTitle: "Buka postingan asli di X ↗",
      btnRedownloadTitle: "Unduh ulang berkas ini",
      btnDeleteTitle: "Hapus item ini dari riwayat",
      toastItemDeleted: "Item riwayat berhasil dihapus.",
      toastRedownload: "Memulai unduhan ulang berkas...",
      toastOpeningPost: "Membuka postingan asli di tab baru...",
      toastNoDownloadUrl: "Tautan unduhan tidak tersedia."
    },
    en: {
      // Sidebar & Navigation
      navGeneral: "General",
      navFeatures: "Features",
      navHistory: "History",
      navAbout: "About & Rank",
      openTwitter: "Open x.com ↗",

      // Tab 1: General
      generalDesc: "Configure download destination, sub-folders, and automatic filename pattern.",
      askSaveTitle: "Ask where to save each file",
      askSaveDesc: "Show folder picker dialog before starting download. Disable for instant 1-click downloads.",
      subDirTitle: "Create dedicated sub-folder",
      subDirDesc: "Save downloaded media into a dedicated sub-folder inside your browser's default Downloads directory.",
      subDirPlaceholder: "Sub-folder name...",
      btnSave: "SAVE",
      groupByAccountTitle: "Group downloads by account",
      groupByAccountDesc: "Automatically separate files into individual sub-folders for each Twitter account (@username).",
      patternTitle: "Filename Pattern Builder",
      patternDesc: "Click tags below to toggle on or off. Use arrow buttons ◀ ▶ to reorder. Live preview updates in real-time.",
      btnResetDefault: "RESET TO DEFAULT",
      activeTagsLabel: "Active Pattern Tags (Sequence):",
      availableTagsLabel: "Available Tags (Click to Toggle On / Off):",
      patternWarning: "Warning: Pattern does not include a unique identifier (Tweet ID, Serial, or Timestamp). Files may overwrite each other!",
      themeTitle: "Interface Theme",
      themeDesc: "Choose between sleek cyber dark theme or clean light theme for extension UI.",
      themeDark: "Dark Mode",
      themeLight: "Light Mode",
      langTitle: "Interface Language",
      langDesc: "Choose display language for the extension, popup, timeline buttons, and notifications.",
      btnResetGeneral: "Reset General Settings to Default",

      // Tab 2: Features
      featuresDesc: "Customize download behavior, sensitive media filters, media quality, and timeline buttons.",
      nsfwTitle: "Auto-reveal sensitive content (NSFW Auto-Unblur)",
      nsfwDesc: "Automatically unblur and reveal sensitive tweets without needing to manually click warning buttons.",
      thumbnailTitle: "Download video thumbnail cover",
      thumbnailDesc: "Also download poster thumbnail cover image (.jpg) when downloading video from a tweet.",
      gifTitle: "Animated GIF Format",
      gifDesc: "Choose how Twitter GIFs are saved. Native .gif files are larger than .mp4 with a 256-color limit. Select 'Ask Every Download' to show format chooser on each download.",
      gifAsk: "Ask Every Download",
      gifMp4: "Native MP4",
      gifSmall: "GIF · Small",
      gifMedium: "GIF · Medium",
      gifOriginal: "GIF · Original",
      qualityTitle: "Default Video Quality",
      qualityDesc: "Preferred video resolution when downloading via 1-click buttons. Select 'Ask Every Download' to display the resolution picker on each download.",
      qualityAsk: "Ask Every Download",
      qualityNative: "Native (Original Quality)",
      quality1080p: "1080p (Full HD)",
      quality720p: "720p (HD)",
      quality480p: "480p (Data Saver)",
      inTweetTitle: "Bottom-Right Post Download Button",
      inTweetDesc: "Display download button on the bottom-right action bar of each tweet post (alongside like, repost, and bookmark).",
      mediaBadgesTitle: "Media Player Corner Badges",
      mediaBadgesDesc: "Embed HD / MP4 / GIF download badges directly on the top-right corner of tweet videos and photos.",
      headerDlAllTitle: "Tweet Header Download All Button",
      headerDlAllDesc: "Display 'Download All' button in the top-right corner of the post (next to Grok) on multi-media tweets.",
      shortcutTitle: "Keyboard Shortcut",
      shortcutDesc: "Press <code>D</code> on keyboard while hovering over a tweet to immediately download media.",

      // Tab 3: History
      recentDownloadsTitle: "Recent Downloads",
      totalDropsStat: "TOTAL DROPS",
      videosStat: "VIDEOS",
      photosStat: "PHOTOS",
      gifsStat: "GIFS",
      loggingStat: "LOGGING",
      searchPlaceholder: "Search by account name or tweet text...",
      filterAll: "ALL",
      filterVideo: "MP4",
      filterImage: "JPG",
      filterGif: "GIF",
      btnClearAll: "Clear All",
      btnClearAllTitle: "Clear all download history",
      btnExport: "Export",
      btnExportTitle: "Export history to JSON",
      btnImport: "Import",
      btnImportTitle: "Import history from JSON file",

      // Tab 4: About
      aboutDesc: "Your collector profile, level rewards, and extension integrity.",
      aboutCounterLabel: "TOTAL MEDIA COLLECTED",
      aboutProgressLabel: "LEVEL PROGRESS",
      btnResetRank: "Reset Stats & Level to 0",
      aboutInfoTitle: "X-Vault: Media Downloader",
      aboutInfoText: "High-performance media downloader extension engineered to capture full-resolution videos, original high-definition photos, and animated GIFs directly from X / Twitter timelines without limits.",
      metaVersion: "Version:",
      metaDev: "Developer:",
      metaArch: "Architecture:",
      metaPrivacy: "Privacy:",
      metaPrivacyVal: "100% Client-Side (No Trackers)",
      privacyCalloutText: "This extension runs completely locally in your browser. No download data, browsing history, or account credentials are ever transmitted to any external server.",

      // Tooltips & Dynamic Labels
      tagMoveLeft: "Move left",
      tagMoveRight: "Move right",
      tagRemove: "Remove tag",
      tagToggleOn: "Click to enable tag",
      tagToggleOff: "Click to disable tag",
      nextGoalPrefix: "Next Goal",
      dropsSuffix: "Drops",

      // Toasts & Alerts
      toastSaved: "Settings saved successfully!",
      toastReset: "Settings reset to default.",
      toastHistoryCleared: "Download history cleared successfully.",
      toastExportSuccess: "History exported as JSON file.",
      toastImportSuccess: "Download history imported successfully!",
      toastImportInvalid: "Invalid JSON history file format!",
      confirmClearHistory: "Are you sure you want to clear all download history?",
      confirmResetGeneral: "Reset general settings to default?",
      confirmResetRank: "Reset level and download stats to 0?",
      emptyHistory: "No download history yet. Start collecting media from X!",
      noSearchResults: "No download history matching your search query.",
      btnOpenPostTitle: "Open original post on X ↗",
      btnRedownloadTitle: "Re-download this file",
      btnDeleteTitle: "Delete this item from history",
      toastItemDeleted: "History item deleted.",
      toastRedownload: "Starting re-download...",
      toastOpeningPost: "Opening original post in new tab...",
      toastNoDownloadUrl: "Download URL not available."
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

  // Available Tokens in Canonical Order for Pattern Palette
  const ALL_PATTERN_TOKENS = [
    "{account}",
    "{account_id}",
    "{tweet_id}",
    "{serial}",
    "{quality}",
    "{text}",
    "{date}",
    "{datetime}",
    "{timestamp}"
  ];

  // Token Labels Map for Pattern Builder
  const TOKEN_LABELS = {
    "{account}": "@Account",
    "{account_id}": "Account ID",
    "{tweet_id}": "Tweet ID",
    "{serial}": "Serial / No",
    "{quality}": "Quality (HD)",
    "{text}": "Tweet Text",
    "{date}": "Date (YYYY-MM-DD)",
    "{datetime}": "Datetime",
    "{timestamp}": "Timestamp"
  };

  // Sample Mock Values for Live Pattern Preview
  const PREVIEW_SAMPLES = {
    "{account}": "@Pikuri",
    "{account_id}": "Pikuri",
    "{tweet_id}": "184920491820",
    "{serial}": "01",
    "{quality}": "1080p",
    "{text}": "Epic_Cyber_Art",
    "{date}": "2026-10-10",
    "{datetime}": "20261010_172030",
    "{timestamp}": "1791624265"
  };

  // ==================== STATE MANAGEMENT ====================
  let currentSettings = {
    theme: "dark",
    language: "id",
    askSaveLocation: false,
    createSubDir: true,
    subDirName: "X_Vault_Downloads",
    groupByAccount: false,
    activePatternTags: ["{account}", "{tweet_id}", "{serial}"],
    autoRevealNsfw: true,
    downloadThumbnail: false,
    gifFormat: "ask",
    defaultQuality: "native",
    inTweetBtn: true,
    mediaCornerBadges: true,
    headerDlAll: true,
    keyboardShortcut: true,
    historyLogging: true
  };

  let downloadStats = {
    totalDownloads: 0,
    videoCount: 0,
    imageCount: 0
  };

  let downloadHistory = [];
  let currentFilterType = "all";
  let toastTimer = null;

  // DOM Elements - Navigation Tabs
  const navTabBtns = document.querySelectorAll(".nav-tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");
  const historyCounterBadge = document.getElementById("historyCounterBadge");

  // DOM Elements - General Tab
  const toggleAskSave = document.getElementById("toggleAskSave");
  const toggleCreateSubDir = document.getElementById("toggleCreateSubDir");
  const subDirInputRow = document.getElementById("subDirInputRow");
  const inputSubDirName = document.getElementById("inputSubDirName");
  const btnSaveSubDir = document.getElementById("btnSaveSubDir");
  const toggleGroupByAccount = document.getElementById("toggleGroupByAccount");
  const themeChoices = document.getElementById("themeChoices");
  const selectLanguage = document.getElementById("selectLanguage");
  const btnResetGeneral = document.getElementById("btnResetGeneral");

  // DOM Elements - Pattern Builder
  const filenamePreviewText = document.getElementById("filenamePreviewText");
  const activeTagsList = document.getElementById("activeTagsList");
  const paletteTagsList = document.getElementById("paletteTagsList");
  const patternWarningBox = document.getElementById("patternWarningBox");
  const patternWarningText = document.getElementById("patternWarningText");
  const btnResetPattern = document.getElementById("btnResetPattern");

  // DOM Elements - Features Tab
  const toggleFeaturesNsfw = document.getElementById("toggleFeaturesNsfw");
  const toggleDownloadThumbnail = document.getElementById("toggleDownloadThumbnail");
  const gifFormatChoices = document.getElementById("gifFormatChoices");
  const videoQualityChoices = document.getElementById("videoQualityChoices");
  const selectDefaultQuality = document.getElementById("selectDefaultQuality");
  const toggleInTweetBtn = document.getElementById("toggleInTweetBtn");
  const toggleMediaBadges = document.getElementById("toggleMediaBadges");
  const toggleHeaderDlAll = document.getElementById("toggleHeaderDlAll");
  const toggleKeyboardShortcut = document.getElementById("toggleKeyboardShortcut");

  // DOM Elements - History Tab
  const metricTotalDrops = document.getElementById("metricTotalDrops");
  const metricVideos = document.getElementById("metricVideos");
  const metricPhotos = document.getElementById("metricPhotos");
  const metricGifs = document.getElementById("metricGifs");
  const toggleHistoryLogging = document.getElementById("toggleHistoryLogging");
  const inputHistorySearch = document.getElementById("inputHistorySearch");
  const historyTypeFilters = document.getElementById("historyTypeFilters");
  const btnClearAllHistory = document.getElementById("btnClearAllHistory");
  const btnExportHistory = document.getElementById("btnExportHistory");
  const btnImportHistory = document.getElementById("btnImportHistory");
  const inputImportHistory = document.getElementById("inputImportHistory");
  const historyTableContainer = document.getElementById("historyTableContainer");

  // DOM Elements - About Tab
  const aboutRankTitle = document.getElementById("aboutRankTitle");
  const aboutRankGoal = document.getElementById("aboutRankGoal");
  const aboutTotalCounter = document.getElementById("aboutTotalCounter");
  const aboutProgressPct = document.getElementById("aboutProgressPct");
  const aboutEnergySegments = document.getElementById("aboutEnergySegments");
  const btnResetGamification = document.getElementById("btnResetGamification");

  // DOM Elements - Global Toast
  const dashboardToast = document.getElementById("dashboardToast");
  const dashboardToastText = document.getElementById("dashboardToastText");

  // ==================== HELPER FUNCTIONS ====================
  function t(key) {
    const lang = currentSettings.language || "id";
    const dict = I18N[lang] || I18N.id;
    return dict[key] || I18N.id[key] || key;
  }

  // Apply Theme (Dark / Light)
  function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", selectedTheme);
    document.body.setAttribute("data-theme", selectedTheme);

    if (themeChoices) {
      themeChoices.querySelectorAll(".choice-pill").forEach(p => {
        p.classList.toggle("active", p.getAttribute("data-value") === selectedTheme);
      });
    }
  }

  // Apply Language to all UI elements and placeholders
  function applyLanguage(lang) {
    const selectedLang = lang || currentSettings.language || "id";
    document.documentElement.lang = selectedLang;
    const dict = I18N[selectedLang] || I18N.id;

    // 1. Elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key]) {
        el.innerHTML = dict[key];
      }
    });

    // 2. Placeholder attributes
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key && dict[key]) {
        el.placeholder = dict[key];
      }
    });

    // 3. Title attributes
    document.querySelectorAll("[data-i18n-title]").forEach(el => {
      const key = el.getAttribute("data-i18n-title");
      if (key && dict[key]) {
        el.title = dict[key];
      }
    });

    // 4. Update language select dropdown value
    if (selectLanguage && selectLanguage.value !== selectedLang) {
      selectLanguage.value = selectedLang;
    }

    // 5. Re-render dynamic components
    renderPatternBuilder();
    renderHistoryTable();
    renderAboutRank();
  }

  function showToast(msg) {
    if (!dashboardToast || !dashboardToastText) return;
    dashboardToastText.textContent = msg;
    dashboardToast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dashboardToast.classList.add("hidden");
    }, 2400);
  }

  function saveCurrentSettings() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ settings: currentSettings }, () => {
        showToast(t("toastSaved"));
      });
    } else {
      showToast(t("toastSaved"));
    }
  }

  // ==================== TAB NAVIGATION ====================
  function switchTab(tabId) {
    navTabBtns.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });

    tabPanes.forEach(pane => {
      pane.classList.toggle("active", pane.id === `pane-${tabId}`);
    });

    if (history.replaceState) {
      history.replaceState(null, null, `#${tabId}`);
    }
  }

  navTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      switchTab(target);
    });
  });

  // Check URL hash on load
  const initialHash = window.location.hash.replace("#", "").toLowerCase();
  if (["general", "features", "history", "about"].includes(initialHash)) {
    switchTab(initialHash);
  } else {
    switchTab("general");
  }

  // ==================== FILENAME PATTERN BUILDER ====================
  function renderPatternBuilder() {
    if (!activeTagsList) return;

    // Deduplicate active tags and ensure valid array
    if (!Array.isArray(currentSettings.activePatternTags)) {
      currentSettings.activePatternTags = ["{account}", "{tweet_id}", "{serial}"];
    } else {
      // Cleanse duplicate tokens while preserving current order
      currentSettings.activePatternTags = [...new Set(currentSettings.activePatternTags)];
    }

    if (currentSettings.activePatternTags.length === 0) {
      currentSettings.activePatternTags = ["{tweet_id}"];
    }

    const tags = currentSettings.activePatternTags;

    // 1. Render Active Tags Row (Orderable with ◀ ▶ and removable with ×)
    activeTagsList.innerHTML = "";
    tags.forEach((token, index) => {
      const chip = document.createElement("div");
      chip.className = "tag-chip active";
      chip.setAttribute("data-token", token);

      const label = TOKEN_LABELS[token] || token;
      const isFirst = index === 0;
      const isLast = index === tags.length - 1;

      chip.innerHTML = `
        <button class="tag-reorder-btn" data-action="left" data-index="${index}" title="${escapeHtml(t("tagMoveLeft"))}" ${isFirst ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>◀</button>
        <span class="tag-label">${escapeHtml(label)}</span>
        <button class="tag-reorder-btn" data-action="right" data-index="${index}" title="${escapeHtml(t("tagMoveRight"))}" ${isLast ? "disabled style='opacity:0.3;cursor:not-allowed;'" : ""}>▶</button>
        <button class="tag-remove-btn" data-action="remove" data-index="${index}" title="${escapeHtml(t("tagRemove"))}">&times;</button>
      `;

      activeTagsList.appendChild(chip);
    });

    // 2. Render Available Tags Palette (1-click Toggle On/Off)
    if (paletteTagsList) {
      paletteTagsList.innerHTML = "";
      ALL_PATTERN_TOKENS.forEach(token => {
        const isSelected = tags.includes(token);
        const label = TOKEN_LABELS[token] || token;

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `tag-chip addable${isSelected ? " is-selected" : ""}`;
        chip.setAttribute("data-token", token);
        chip.title = isSelected ? t("tagToggleOff") : t("tagToggleOn");

        const statusIconHtml = isSelected
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:0px;"><polyline points="20 6 9 17 4 12"/></svg>`
          : `+`;

        chip.innerHTML = `
          <span class="tag-status-icon">${statusIconHtml}</span>
          <span>${escapeHtml(label)}</span>
        `;

        paletteTagsList.appendChild(chip);
      });
    }

    // 3. Collision Protection Validation Check
    const hasUniqueId = tags.some(t => ["{tweet_id}", "{serial}", "{timestamp}"].includes(t));
    if (patternWarningBox) {
      if (!hasUniqueId) {
        patternWarningBox.style.display = "flex";
        if (patternWarningText) {
          patternWarningText.textContent = t("patternWarning");
        }
      } else {
        patternWarningBox.style.display = "none";
      }
    }

    // 4. Update Live Preview Display
    const sampleSegments = tags.map(t => PREVIEW_SAMPLES[t] || "X");
    const previewString = sampleSegments.join("-") + ".mp4";
    if (filenamePreviewText) {
      filenamePreviewText.textContent = previewString;
    }
  }

  // Active Tags Interaction Handler (Left, Right, Remove)
  if (activeTagsList) {
    activeTagsList.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (isNaN(idx)) return;

      const tags = currentSettings.activePatternTags;
      if (!tags || !tags[idx]) return;

      if (action === "left") {
        if (idx > 0) {
          const temp = tags[idx - 1];
          tags[idx - 1] = tags[idx];
          tags[idx] = temp;
          renderPatternBuilder();
          saveCurrentSettings();
        }
      } else if (action === "right") {
        if (idx < tags.length - 1) {
          const temp = tags[idx + 1];
          tags[idx + 1] = tags[idx];
          tags[idx] = temp;
          renderPatternBuilder();
          saveCurrentSettings();
        }
      } else if (action === "remove") {
        tags.splice(idx, 1);
        if (tags.length === 0) {
          currentSettings.activePatternTags = ["{tweet_id}"];
        }
        renderPatternBuilder();
        saveCurrentSettings();
      }
    });
  }

  // Palette Tags Toggle On / Off Handler
  if (paletteTagsList) {
    paletteTagsList.addEventListener("click", (e) => {
      const chip = e.target.closest(".tag-chip.addable");
      if (!chip) return;
      const token = chip.getAttribute("data-token");
      if (!token) return;

      if (!Array.isArray(currentSettings.activePatternTags)) {
        currentSettings.activePatternTags = [];
      }

      const existingIndex = currentSettings.activePatternTags.indexOf(token);
      if (existingIndex !== -1) {
        // Toggle OFF (Deactivate)
        currentSettings.activePatternTags.splice(existingIndex, 1);
        if (currentSettings.activePatternTags.length === 0) {
          currentSettings.activePatternTags = ["{tweet_id}"];
        }
      } else {
        // Toggle ON (Activate)
        currentSettings.activePatternTags.push(token);
      }

      renderPatternBuilder();
      saveCurrentSettings();
    });
  }

  // Reset Pattern to Default
  if (btnResetPattern) {
    btnResetPattern.addEventListener("click", () => {
      currentSettings.activePatternTags = ["{account}", "{tweet_id}", "{serial}"];
      renderPatternBuilder();
      saveCurrentSettings();
    });
  }

  // ==================== HISTORY RENDERING & FILTERING ====================
  function isItemGif(item) {
    if (!item) return false;
    if (item.type === "gif" || item.isGif) return true;
    const fn = (item.filename || "").toLowerCase();
    if (fn.endsWith(".gif")) return true;
    const ti = (item.title || "").toLowerCase();
    if (ti.includes("gif") && !ti.includes("mp4")) return true;
    return false;
  }

  function renderHistoryTable() {
    if (!historyTableContainer) return;
    historyTableContainer.innerHTML = "";

    // Deduplicate history items in memory so identical entries are never shown
    const uniqueHistory = [];
    const seenIds = new Set();
    const seenFiles = new Set();
    (downloadHistory || []).forEach(it => {
      if (!it) return;
      const keyId = it.id || (it.filename ? (it.filename + "_" + Math.floor((it.timestamp || 0) / 3000)) : null);
      if (keyId && (seenIds.has(keyId) || (it.id && seenIds.has(it.id)))) {
        return;
      }
      if (it.id) seenIds.add(it.id);
      if (keyId) seenIds.add(keyId);
      uniqueHistory.push(it);
    });

    if (uniqueHistory.length !== (downloadHistory || []).length) {
      downloadHistory = uniqueHistory;
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ downloadHistory });
      }
    }

    const query = inputHistorySearch ? inputHistorySearch.value.trim().toLowerCase() : "";

    let filtered = (downloadHistory || []).filter(item => {
      const itemIsGif = isItemGif(item);
      if (currentFilterType === "video") {
        if (itemIsGif || item.type === "image") return false;
      } else if (currentFilterType === "image") {
        if (item.type !== "image") return false;
      } else if (currentFilterType === "gif") {
        if (!itemIsGif) return false;
      }
      if (query) {
        const titleMatch = (item.title || "").toLowerCase().includes(query);
        const fileMatch = (item.filename || "").toLowerCase().includes(query);
        const textMatch = (item.tweetText || "").toLowerCase().includes(query);
        const authorMatch = (item.author || "").toLowerCase().includes(query);
        const screenNameMatch = (item.screenName || "").toLowerCase().includes(query);
        const idMatch = (item.tweetId || "").toString().toLowerCase().includes(query);
        return titleMatch || fileMatch || textMatch || authorMatch || screenNameMatch || idMatch;
      }
      return true;
    });

    // Update Counter Badges
    let vCount = 0;
    let iCount = 0;
    let gCount = 0;
    (downloadHistory || []).forEach(it => {
      if (isItemGif(it)) gCount++;
      else if (it.type === "image") iCount++;
      else vCount++;
    });

    if (historyCounterBadge) historyCounterBadge.textContent = String(downloadHistory.length);
    if (metricTotalDrops) metricTotalDrops.textContent = String(downloadStats.totalDownloads || downloadHistory.length);
    if (metricVideos) metricVideos.textContent = String(downloadStats.videoCount || vCount);
    if (metricPhotos) metricPhotos.textContent = String(downloadStats.imageCount || iCount);
    if (metricGifs) metricGifs.textContent = String(downloadStats.gifCount || gCount);

    if (filtered.length === 0) {
      historyTableContainer.innerHTML = `
        <div class="history-empty-state">
          <span class="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
          </span>
          <span>${query ? t("noSearchResults") : t("emptyHistory")}</span>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-row";
      row.setAttribute("data-id", item.id);

      const isGif = isItemGif(item);
      const isImg = !isGif && item.type === "image";
      let badgeClass = "video";
      let badgeLabel = "MP4";
      if (isGif) {
        badgeClass = "gif";
        badgeLabel = "GIF";
      } else if (isImg) {
        badgeClass = "image";
        badgeLabel = "JPG";
      }

      // 1. Title / Text headline
      let headlineText = item.tweetText || item.title || item.filename || "X Media";
      if (headlineText.length > 90) {
        headlineText = headlineText.substring(0, 90).trim() + "...";
      }

      // 2. Author & Handle
      let authorName = item.author || "";
      let handleText = item.screenName ? `@${item.screenName.replace(/^@+/, "")}` : "";
      if (!handleText && authorName && authorName.startsWith("@")) {
        handleText = authorName;
        authorName = "";
      }
      if (!handleText) {
        const fileHandle = (item.filename || "").match(/@([a-zA-Z0-9_]+)/);
        if (fileHandle) handleText = `@${fileHandle[1]}`;
      }
      if (!authorName && !handleText) {
        authorName = currentSettings.language === "en" ? "X Post" : "Postingan X";
      }

      // 3. Post Upload Date
      let postDateText = item.tweetTime || "";
      if (!postDateText && item.tweetIsoDate) {
        try {
          const d = new Date(item.tweetIsoDate);
          postDateText = d.toLocaleDateString(currentSettings.language === "en" ? "en-US" : "id-ID", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        } catch (e) {}
      }
      if (!postDateText && item.timestamp) {
        const d = new Date(item.timestamp);
        postDateText = d.toLocaleDateString(currentSettings.language === "en" ? "en-US" : "id-ID", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      // 4. Download Date Tag for right column
      const badgeDateStr = item.timestamp
        ? new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()
        : "RECENT";

      // 5. Tweet Link
      const tweetUrl = item.tweetUrl || (item.tweetId ? `https://x.com/${item.screenName ? item.screenName.replace(/^@+/, "") : "i"}/status/${item.tweetId}` : null);

      // 6. Thumbnail
      let thumbUrl = item.thumbnail || (isImg && item.downloadUrl ? item.downloadUrl : "");
      if (isGif && (!thumbUrl || thumbUrl.startsWith("data:image/gif"))) {
        thumbUrl = (item.tweetId && /^\d+$/.test(String(item.tweetId)))
          ? `https://pbs.twimg.com/tweet_video_thumb/${item.tweetId}.jpg`
          : "";
      }

      const fallbackSvgIcon = isGif
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
        : (isImg
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`);

      row.innerHTML = `
        <div class="history-item-main">
          <div class="history-thumb-wrap" title="${escapeHtml(item.title || item.filename || "")}">
            ${thumbUrl ? `
              <img src="${escapeHtml(thumbUrl)}" class="history-thumb-img" alt="Thumbnail" loading="lazy">
            ` : `
              <div class="history-thumb-fallback ${badgeClass}">
                <span class="fallback-icon">${fallbackSvgIcon}</span>
                <span class="fallback-tag">${badgeLabel}</span>
              </div>
            `}
          </div>

          <div class="history-content-meta">
            <div class="history-row-headline" title="${escapeHtml(item.tweetText || item.title || item.filename || "")}">
              ${escapeHtml(headlineText)}
            </div>
            <div class="history-row-subline">
              ${authorName ? `<span class="history-author-name">${escapeHtml(authorName)}</span>` : ""}
              ${authorName && handleText ? `<span class="history-dot">·</span>` : ""}
              ${handleText ? `<span class="history-handle">${escapeHtml(handleText)}</span>` : ""}
              ${(authorName || handleText) && postDateText ? `<span class="history-dot">·</span>` : ""}
              ${postDateText ? `<span class="history-post-date">${escapeHtml(postDateText)}</span>` : ""}
              ${tweetUrl ? `
                <a href="${escapeHtml(tweetUrl)}" target="_blank" class="history-inline-link" title="${escapeHtml(t("btnOpenPostTitle"))}" rel="noopener noreferrer">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ` : ""}
            </div>
          </div>
        </div>

        <div class="history-item-actions-side">
          <span class="history-date-badge">${escapeHtml(badgeDateStr)}</span>
          <span class="history-format-pill ${badgeClass}">${badgeLabel}</span>

          <div class="history-actions-group">
            ${tweetUrl ? `
              <button type="button" class="history-action-btn btn-open-post" data-url="${escapeHtml(tweetUrl)}" title="${escapeHtml(t("btnOpenPostTitle"))}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            ` : ""}

            <button type="button" class="history-action-btn btn-redownload" data-id="${escapeHtml(item.id)}" title="${escapeHtml(t("btnRedownloadTitle"))}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>

            <button type="button" class="history-action-btn btn-delete-item" data-id="${escapeHtml(item.id)}" title="${escapeHtml(t("btnDeleteTitle"))}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      // Fallback on image load error
      const img = row.querySelector(".history-thumb-img");
      if (img) {
        img.addEventListener("error", () => {
          const wrap = img.parentElement;
          if (wrap) {
            wrap.innerHTML = `
              <div class="history-thumb-fallback ${badgeClass}">
                <span class="fallback-icon">${fallbackSvgIcon}</span>
                <span class="fallback-tag">${badgeLabel}</span>
              </div>
            `;
          }
        });
      }

      historyTableContainer.appendChild(row);
    });
  }

  // History Action Handlers: Open, Re-download, Delete
  function handleRedownloadHistoryItem(item, btn) {
    if (!item) return;
    const downloadUrl = item.downloadUrl || (item.type === "image" ? item.thumbnail : null);

    if (!downloadUrl && item.tweetUrl) {
      window.open(item.tweetUrl, "_blank");
      showToast(t("toastOpeningPost"));
      return;
    }

    if (!downloadUrl) {
      showToast(t("toastNoDownloadUrl"));
      return;
    }

    if (btn) btn.style.color = "#10b981";
    showToast(t("toastRedownload"));

    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "REDOWNLOAD_HISTORY_ITEM",
        payload: {
          url: downloadUrl,
          filename: item.filename || "twitter_download"
        }
      }, () => {
        setTimeout(() => {
          if (btn) btn.style.color = "";
        }, 1200);
      });
    } else {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = item.filename || "twitter_download";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function deleteSingleHistoryItem(id) {
    if (!id) return;
    const row = historyTableContainer?.querySelector(`.history-row[data-id="${id}"]`);
    const proceed = () => {
      const idx = (downloadHistory || []).findIndex(it => it.id === id);
      if (idx !== -1) {
        downloadHistory.splice(idx, 1);
      } else {
        downloadHistory = (downloadHistory || []).filter(it => it.id !== id);
      }
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ downloadHistory }, () => {
          renderHistoryTable();
          showToast(t("toastItemDeleted"));
        });
      } else {
        renderHistoryTable();
        showToast(t("toastItemDeleted"));
      }
    };

    if (row) {
      row.style.transition = "all 0.2s ease";
      row.style.opacity = "0";
      row.style.transform = "translateX(20px)";
      setTimeout(proceed, 200);
    } else {
      proceed();
    }
  }

  if (historyTableContainer) {
    historyTableContainer.addEventListener("click", (e) => {
      // 1. Open post button
      const openBtn = e.target.closest(".btn-open-post");
      if (openBtn) {
        e.stopPropagation();
        const url = openBtn.getAttribute("data-url");
        if (url) window.open(url, "_blank");
        return;
      }

      // 2. Re-download button
      const redownloadBtn = e.target.closest(".btn-redownload");
      if (redownloadBtn) {
        e.stopPropagation();
        const id = redownloadBtn.getAttribute("data-id");
        const item = (downloadHistory || []).find(it => it.id === id);
        if (item) handleRedownloadHistoryItem(item, redownloadBtn);
        return;
      }

      // 3. Delete single item button
      const delBtn = e.target.closest(".btn-delete-item");
      if (delBtn) {
        e.stopPropagation();
        const id = delBtn.getAttribute("data-id");
        deleteSingleHistoryItem(id);
        return;
      }

      // 4. Click thumbnail image to open original tweet
      const thumbWrap = e.target.closest(".history-thumb-wrap");
      if (thumbWrap) {
        const row = thumbWrap.closest(".history-row");
        const id = row?.getAttribute("data-id");
        const item = (downloadHistory || []).find(it => it.id === id);
        const url = item?.tweetUrl || (item?.tweetId ? `https://x.com/i/status/${item.tweetId}` : null);
        if (url) window.open(url, "_blank");
      }
    });
  }

  // History Search Input
  if (inputHistorySearch) {
    inputHistorySearch.addEventListener("input", renderHistoryTable);
  }

  // History Filter Pills
  if (historyTypeFilters) {
    historyTypeFilters.addEventListener("click", (e) => {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;
      historyTypeFilters.querySelectorAll(".filter-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilterType = pill.getAttribute("data-filter") || "all";
      renderHistoryTable();
    });
  }

  // Clear All History
  if (btnClearAllHistory) {
    btnClearAllHistory.addEventListener("click", () => {
      if (confirm(t("confirmClearHistory"))) {
        downloadHistory = [];
        chrome.storage.local.set({ downloadHistory: [] }, () => {
          renderHistoryTable();
          showToast(t("toastHistoryCleared"));
        });
      }
    });
  }

  // Export History as JSON
  if (btnExportHistory) {
    btnExportHistory.addEventListener("click", () => {
      try {
        const exportPayload = {
          version: "2.2.0",
          exportDate: new Date().toISOString(),
          downloadStats: downloadStats,
          downloadHistory: downloadHistory
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `x_vault_history_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast(t("toastExportSuccess"));
      } catch (e) {
        console.error("Export error:", e);
      }
    });
  }

  // Import History from JSON
  if (btnImportHistory && inputImportHistory) {
    btnImportHistory.addEventListener("click", () => {
      inputImportHistory.click();
    });

    inputImportHistory.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          let importedItems = [];

          if (Array.isArray(parsed)) {
            importedItems = parsed;
          } else if (parsed && Array.isArray(parsed.downloadHistory)) {
            importedItems = parsed.downloadHistory;
            if (parsed.downloadStats) {
              downloadStats.totalDownloads = Math.max(downloadStats.totalDownloads || 0, parsed.downloadStats.totalDownloads || 0);
              downloadStats.videoCount = Math.max(downloadStats.videoCount || 0, parsed.downloadStats.videoCount || 0);
              downloadStats.imageCount = Math.max(downloadStats.imageCount || 0, parsed.downloadStats.imageCount || 0);
              if (parsed.downloadStats.gifCount) {
                downloadStats.gifCount = Math.max(downloadStats.gifCount || 0, parsed.downloadStats.gifCount || 0);
              }
            }
          } else {
            showToast(t("toastImportInvalid"));
            inputImportHistory.value = "";
            return;
          }

          if (importedItems.length === 0) {
            showToast(t("toastImportInvalid"));
            inputImportHistory.value = "";
            return;
          }

          // Normalize items
          const validItems = importedItems.map(it => {
            const isGif = it.type === "gif" || (it.filename && it.filename.toLowerCase().endsWith(".gif")) || (it.title && it.title.toLowerCase().includes("gif"));
            return {
              id: it.id || ("dl_" + (it.timestamp || Date.now()) + "_" + Math.random().toString(36).substring(2, 6)),
              type: isGif ? "gif" : (it.type === "image" ? "image" : "video"),
              title: it.title || it.filename || "X Media",
              filename: it.filename || "",
              timestamp: it.timestamp || Date.now()
            };
          });

          // Merge deduplicated
          const existingIds = new Set(downloadHistory.map(h => h.id || `${h.filename}_${h.timestamp}`));
          const newItems = validItems.filter(it => !existingIds.has(it.id) && !existingIds.has(`${it.filename}_${it.timestamp}`));

          downloadHistory = [...newItems, ...downloadHistory];
          if (downloadHistory.length > 250) {
            downloadHistory = downloadHistory.slice(0, 250);
          }

          // Recalculate stats
          let vCount = 0;
          let iCount = 0;
          let gCount = 0;
          downloadHistory.forEach(it => {
            if (it.type === "gif" || (it.filename && it.filename.toLowerCase().endsWith(".gif"))) {
              gCount++;
            } else if (it.type === "image") {
              iCount++;
            } else {
              vCount++;
            }
          });
          downloadStats.totalDownloads = Math.max(downloadStats.totalDownloads || 0, downloadHistory.length);
          downloadStats.videoCount = Math.max(downloadStats.videoCount || 0, vCount);
          downloadStats.imageCount = Math.max(downloadStats.imageCount || 0, iCount);
          downloadStats.gifCount = Math.max(downloadStats.gifCount || 0, gCount);

          chrome.storage.local.set({
            downloadHistory: downloadHistory,
            downloadStats: downloadStats
          }, () => {
            renderHistoryTable();
            renderAboutRank();
            showToast(`${t("toastImportSuccess")} (+${newItems.length})`);
          });
        } catch (err) {
          console.error("Import error:", err);
          showToast(t("toastImportInvalid"));
        } finally {
          inputImportHistory.value = "";
        }
      };
      reader.readAsText(file);
    });
  }

  // ==================== ABOUT & RANK RENDERING ====================
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

  function renderAboutRank() {
    const count = downloadStats.totalDownloads || 0;
    const info = calculateLevelInfo(count);

    if (aboutRankTitle) aboutRankTitle.textContent = `LVL ${info.level} · ${info.title.toUpperCase()}`;
    if (aboutRankGoal) aboutRankGoal.textContent = `${t("nextGoalPrefix")}: ${info.nextGoal} ${t("dropsSuffix")}`;
    if (aboutTotalCounter) aboutTotalCounter.textContent = count < 10 ? `0${count}` : String(count);
    if (aboutProgressPct) aboutProgressPct.textContent = `${info.percent}%`;

    if (aboutEnergySegments) {
      const blocks = aboutEnergySegments.querySelectorAll(".energy-block");
      blocks.forEach((block, idx) => {
        if (idx < info.segmentsFilled) {
          block.classList.add("filled");
        } else {
          block.classList.remove("filled");
        }
      });
    }
  }



  // Reset Gamification
  if (btnResetGamification) {
    btnResetGamification.addEventListener("click", () => {
      if (confirm(t("confirmResetRank"))) {
        downloadStats = { totalDownloads: 0, videoCount: 0, imageCount: 0, gifCount: 0 };
        chrome.storage.local.set({ downloadStats }, () => {
          renderAboutRank();
          renderHistoryTable();
          showToast(t("toastReset"));
        });
      }
    });
  }

  // ==================== EVENT LISTENERS FOR SETTINGS ====================
  // 1. Ask where to save
  if (toggleAskSave) {
    toggleAskSave.addEventListener("change", () => {
      currentSettings.askSaveLocation = toggleAskSave.checked;
      saveCurrentSettings();
    });
  }

  // 2. Create sub-directory
  function updateSubDirInputState(isEnabled) {
    if (subDirInputRow) {
      if (isEnabled) {
        subDirInputRow.classList.remove("is-disabled");
      } else {
        subDirInputRow.classList.add("is-disabled");
      }
    }
    if (inputSubDirName) inputSubDirName.disabled = !isEnabled;
    if (btnSaveSubDir) btnSaveSubDir.disabled = !isEnabled;
  }

  if (toggleCreateSubDir) {
    toggleCreateSubDir.addEventListener("change", () => {
      currentSettings.createSubDir = toggleCreateSubDir.checked;
      updateSubDirInputState(toggleCreateSubDir.checked);
      saveCurrentSettings();
    });
  }

  if (btnSaveSubDir) {
    btnSaveSubDir.addEventListener("click", () => {
      if (inputSubDirName) {
        currentSettings.subDirName = inputSubDirName.value.trim() || "X_Vault_Downloads";
        saveCurrentSettings();
      }
    });
  }

  if (inputSubDirName) {
    inputSubDirName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        currentSettings.subDirName = inputSubDirName.value.trim() || "X_Vault_Downloads";
        saveCurrentSettings();
      }
    });
  }

  // 3. Group by account
  if (toggleGroupByAccount) {
    toggleGroupByAccount.addEventListener("change", () => {
      currentSettings.groupByAccount = toggleGroupByAccount.checked;
      saveCurrentSettings();
    });
  }

  // 4. Theme Choices
  if (themeChoices) {
    themeChoices.addEventListener("click", (e) => {
      const pill = e.target.closest(".choice-pill");
      if (!pill) return;
      themeChoices.querySelectorAll(".choice-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const chosenTheme = pill.getAttribute("data-value") || "dark";
      currentSettings.theme = chosenTheme;
      applyTheme(chosenTheme);
      saveCurrentSettings();
    });
  }

  // 5. Language selector
  if (selectLanguage) {
    selectLanguage.addEventListener("change", () => {
      currentSettings.language = selectLanguage.value;
      applyLanguage(currentSettings.language);
      saveCurrentSettings();
    });
  }

  // 6. Reset General Settings
  if (btnResetGeneral) {
    btnResetGeneral.addEventListener("click", () => {
      if (confirm(t("confirmResetGeneral"))) {
        currentSettings.theme = "dark";
        currentSettings.askSaveLocation = false;
        currentSettings.createSubDir = true;
        currentSettings.subDirName = "X_Vault_Downloads";
        currentSettings.groupByAccount = false;
        currentSettings.activePatternTags = ["{account}", "{tweet_id}", "{serial}"];

        applyTheme("dark");
        if (toggleAskSave) toggleAskSave.checked = false;
        if (toggleCreateSubDir) {
          toggleCreateSubDir.checked = true;
          updateSubDirInputState(true);
        }
        if (inputSubDirName) inputSubDirName.value = "X_Vault_Downloads";
        if (toggleGroupByAccount) toggleGroupByAccount.checked = false;

        renderPatternBuilder();
        saveCurrentSettings();
      }
    });
  }

  // 6. Features Tab Listeners
  if (toggleFeaturesNsfw) {
    toggleFeaturesNsfw.addEventListener("change", () => {
      currentSettings.autoRevealNsfw = toggleFeaturesNsfw.checked;
      saveCurrentSettings();
    });
  }

  if (toggleDownloadThumbnail) {
    toggleDownloadThumbnail.addEventListener("change", () => {
      currentSettings.downloadThumbnail = toggleDownloadThumbnail.checked;
      saveCurrentSettings();
    });
  }

  if (gifFormatChoices) {
    gifFormatChoices.addEventListener("click", (e) => {
      const pill = e.target.closest(".choice-pill");
      if (!pill) return;
      gifFormatChoices.querySelectorAll(".choice-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentSettings.gifFormat = pill.getAttribute("data-value") || "mp4";
      saveCurrentSettings();
    });
  }

  if (videoQualityChoices) {
    videoQualityChoices.addEventListener("click", (e) => {
      const pill = e.target.closest(".choice-pill");
      if (!pill) return;
      videoQualityChoices.querySelectorAll(".choice-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      const chosenQuality = pill.getAttribute("data-value") || "native";
      currentSettings.defaultQuality = chosenQuality;
      if (selectDefaultQuality) selectDefaultQuality.value = chosenQuality;
      saveCurrentSettings();
    });
  }

  if (selectDefaultQuality) {
    selectDefaultQuality.addEventListener("change", () => {
      currentSettings.defaultQuality = selectDefaultQuality.value;
      if (videoQualityChoices) {
        videoQualityChoices.querySelectorAll(".choice-pill").forEach(p => {
          p.classList.toggle("active", p.getAttribute("data-value") === currentSettings.defaultQuality);
        });
      }
      saveCurrentSettings();
    });
  }

  if (toggleInTweetBtn) {
    toggleInTweetBtn.addEventListener("change", () => {
      currentSettings.inTweetBtn = toggleInTweetBtn.checked;
      saveCurrentSettings();
    });
  }

  if (toggleMediaBadges) {
    toggleMediaBadges.addEventListener("change", () => {
      currentSettings.mediaCornerBadges = toggleMediaBadges.checked;
      saveCurrentSettings();
    });
  }

  if (toggleHeaderDlAll) {
    toggleHeaderDlAll.addEventListener("change", () => {
      currentSettings.headerDlAll = toggleHeaderDlAll.checked;
      saveCurrentSettings();
    });
  }

  if (toggleKeyboardShortcut) {
    toggleKeyboardShortcut.addEventListener("change", () => {
      currentSettings.keyboardShortcut = toggleKeyboardShortcut.checked;
      saveCurrentSettings();
    });
  }

  if (toggleHistoryLogging) {
    toggleHistoryLogging.addEventListener("change", () => {
      currentSettings.historyLogging = toggleHistoryLogging.checked;
      saveCurrentSettings();
    });
  }

  // ==================== LOAD INITIAL STORAGE ====================
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["settings", "downloadStats", "downloadHistory"], (data) => {
      if (data?.settings) {
        currentSettings = { ...currentSettings, ...data.settings };
      }
      if (data?.downloadStats) {
        downloadStats = { ...downloadStats, ...data.downloadStats };
      }
      if (data?.downloadHistory && Array.isArray(data.downloadHistory)) {
        let historyNeedsSave = false;
        downloadHistory = data.downloadHistory.map(it => {
          if (it.thumbnail && it.thumbnail.startsWith("data:image/gif")) {
            it.thumbnail = (it.tweetId && /^\d+$/.test(String(it.tweetId)))
              ? `https://pbs.twimg.com/tweet_video_thumb/${it.tweetId}.jpg`
              : null;
            historyNeedsSave = true;
          }
          if (it.downloadUrl && it.downloadUrl.startsWith("data:image/gif")) {
            it.downloadUrl = null;
            historyNeedsSave = true;
          }
          return it;
        });
        if (historyNeedsSave) {
          chrome.storage.local.set({ downloadHistory });
        }
      }

      // Populate Input Values
      if (toggleAskSave) toggleAskSave.checked = Boolean(currentSettings.askSaveLocation);
      if (toggleCreateSubDir) {
        toggleCreateSubDir.checked = currentSettings.createSubDir !== false;
        updateSubDirInputState(toggleCreateSubDir.checked);
      }
      if (inputSubDirName) inputSubDirName.value = currentSettings.subDirName || "X_Vault_Downloads";
      if (toggleGroupByAccount) toggleGroupByAccount.checked = Boolean(currentSettings.groupByAccount);
      if (selectLanguage) selectLanguage.value = currentSettings.language || "id";

      if (toggleFeaturesNsfw) toggleFeaturesNsfw.checked = currentSettings.autoRevealNsfw !== false;
      if (toggleDownloadThumbnail) toggleDownloadThumbnail.checked = Boolean(currentSettings.downloadThumbnail);
      if (selectDefaultQuality) selectDefaultQuality.value = currentSettings.defaultQuality || "native";
      if (toggleInTweetBtn) toggleInTweetBtn.checked = currentSettings.inTweetBtn !== false;
      if (toggleMediaBadges) toggleMediaBadges.checked = currentSettings.mediaCornerBadges !== false;
      if (toggleHeaderDlAll) toggleHeaderDlAll.checked = currentSettings.headerDlAll !== false;
      if (toggleKeyboardShortcut) toggleKeyboardShortcut.checked = currentSettings.keyboardShortcut !== false;
      if (toggleHistoryLogging) toggleHistoryLogging.checked = currentSettings.historyLogging !== false;

      // GIF choice active pill
      if (gifFormatChoices) {
        let targetVal = currentSettings.gifFormat || "ask";
        if (targetVal === "gif") targetVal = "gif-medium";
        gifFormatChoices.querySelectorAll(".choice-pill").forEach(p => {
          p.classList.toggle("active", p.getAttribute("data-value") === targetVal);
        });
      }

      // Video Quality choice active pill
      if (videoQualityChoices) {
        const targetQ = currentSettings.defaultQuality || "native";
        videoQualityChoices.querySelectorAll(".choice-pill").forEach(p => {
          p.classList.toggle("active", p.getAttribute("data-value") === targetQ);
        });
      }

      applyTheme(currentSettings.theme || "dark");
      applyLanguage(currentSettings.language || "id");
    });
  } else {
    // Standalone / preview environment fallback
    applyTheme(currentSettings.theme || "dark");
    applyLanguage(currentSettings.language || "id");
  }

  // Listen for storage changes (e.g. theme, language, or stats updated from popup / background)
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.settings?.newValue) {
          currentSettings = { ...currentSettings, ...changes.settings.newValue };
          applyTheme(currentSettings.theme || "dark");
          applyLanguage(currentSettings.language || "id");
          if (toggleFeaturesNsfw && changes.settings.newValue.autoRevealNsfw !== undefined) {
            toggleFeaturesNsfw.checked = changes.settings.newValue.autoRevealNsfw !== false;
          }
        }
        if (changes.downloadStats?.newValue) {
          downloadStats = { ...downloadStats, ...changes.downloadStats.newValue };
          renderAboutRank();
          renderHistoryTable();
        }
        if (changes.downloadHistory?.newValue) {
          downloadHistory = changes.downloadHistory.newValue;
          renderHistoryTable();
        }
      }
    });
  }

  // Listen for Real-Time Background Download Events
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "DOWNLOAD_RECORDED") {
        if (msg.stats) downloadStats = msg.stats;
        if (msg.lastItem) {
          const exists = (downloadHistory || []).some(it => it.id === msg.lastItem.id || (it.filename && it.filename === msg.lastItem.filename && Math.abs((it.timestamp || 0) - (msg.lastItem.timestamp || 0)) < 4000));
          if (!exists) {
            downloadHistory.unshift(msg.lastItem);
          }
        }
        renderHistoryTable();
        renderAboutRank();
      }
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
