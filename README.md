# X-Vault - Twitter/X Media Downloader & Archival Hub

<p align="center">
  <a href="https://github.com/Pikurii/Twitter-Video-Downloader-Extension/raw/main/X-Vault-v2.2.0.zip">
    <img src="https://img.shields.io/badge/Download_Extension_(ZIP)-Ready_to_Use-22c55e?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download ZIP" />
  </a>
  <a href="https://ko-fi.com/pikurii" target="_blank">
    <img src="https://img.shields.io/badge/Ko--fi-Support_Pikuri-ff5e5b?style=for-the-badge&logo=kofi&logoColor=white" alt="Support on Ko-fi" />
  </a>
  <a href="https://tako.id/Pikuri" target="_blank">
    <img src="https://img.shields.io/badge/Tako.id-Tip_Pikuri-3b82f6?style=for-the-badge" alt="Support on Tako.id" />
  </a>
</p>

<p align="center">
  <a href="https://developer.chrome.com/docs/extensions/mv3/"><img src="https://img.shields.io/badge/Platform-Manifest_V3-2563eb" alt="Manifest V3" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981.svg" alt="License MIT" /></a>
  <a href="https://github.com/Pikurii/Twitter-Video-Downloader-Extension"><img src="https://img.shields.io/badge/Browsers-Chrome_|_Opera_GX_|_Edge_|_Brave-8b5cf6" alt="Supported Browsers" /></a>
</p>

X-Vault is a high-performance browser extension for Chromium browsers (Google Chrome, Opera GX, Microsoft Edge, Brave, and Vivaldi) designed to download and archive media directly from Twitter/X. It provides seamless saving of high-definition videos (up to 1080p), audio-only extraction (MP3), client-side animated GIF conversion (GIF89a with 256-color LZW compression), original full-resolution photos, and batch archiving from multi-image posts and quote tweets.

Engineered under Chrome Manifest V3 specifications with a strict privacy-first architecture: zero external network analytics, zero third-party telemetry, zero tracking scripts, and 100% local processing.

---

## Core Features

### Video & Audio Quality Selection
- **Comprehensive Stream Tiers**: Download videos at their native source resolution or choose from specific quality options: 1080p (Full HD), 720p (HD), 480p (Data Saver), 360p (Standard), 270p (Smallest), or Native best.
- **Portrait / Vertical Video Optimization**: Employs minimum-dimension matching (`Math.min(width, height)`) to guarantee vertical videos (such as `270x480`) are categorized and downloaded strictly as 270p rather than being misidentified as 480p or falling back to 1080p.
- **True Audio-Only Extraction (MP3)**: Extracts authentic audio streams using the Web Audio API (`AudioContext.decodeAudioData`) and encodes them directly to 192kbps MP3 via client-side LAME encoder (`lamejs`) with 16-bit PCM WAV fallback. Files contain **zero video tracks or containers**. Intelligently selects the lowest-bitrate video stream (270p) for near-instant processing and minimal memory footprint.
- **Interactive Quality Chooser**: Trigger a floating quality popover on-the-fly with a "Remember choice" option or configure a default quality rule in Settings.
- **Secondary Media Context Menu**: Right-click any video download button in the timeline to instantly open resolution choices without modifying your default preferences.

### Spec-Compliant Client-Side GIF Conversion
- Convert Twitter loop video streams directly into animated GIF89a files right inside your browser session without third-party web converters.
- **Spec-Compliant LZW Engine**: Utilizes standard variable-bit LZW compression (9 to 12 bits) with sub-block chunking for smooth playback in all desktop and mobile viewers.
- **Local Color Quantization**: Fast 256-color palette mapping with Euclidean color distance calculation per frame.
- **Three Resolution Presets**:
  - **Small (320p, 10 fps)**: Compact file size optimized for messaging apps and forum avatars.
  - **Medium (480p, 12 fps)**: Balanced detail and smooth frame rate for social sharing.
  - **Original (720p, 15 fps)**: High-definition archival quality matching the source animation.

### Batch & Quote Tweet Archiving
- **Download All in Multi-Media Posts**: Save all photos or videos from 2-image, 3-image, or 4-image grid posts in a single click.
- **Dedicated Quote Tweet Controls**: Quote tweet cards feature independent batch download buttons positioned in the header so they never obstruct media visibility.
- **Live Progress Indicators**: Circular ring spinners provide real-time percentage feedback for ongoing downloads.

### Smart Single-Tab Settings Management
- **Zero Tab Clutter**: Clicking the Settings button in the extension popup or timeline modals intelligently focuses and switches to an already-open Settings tab rather than spawning duplicate tabs.
- **Live Section Switching**: Supports hash navigation (`#general`, `#features`, `#history`, `#about`) with instant responsive switching via `hashchange` listeners without page reloads.

### Dynamic Filename Formatting Engine
- Customize automated file names using real-time dynamic tags:
  - `{author}` - Tweet author display name
  - `{username}` - Author handle without the `@` symbol
  - `{tweet_id}` - Unique status identifier
  - `{quality}` - Resolution tag (e.g., `1080p`, `720p`, `270p`, `MP3`, `GIF`)
  - `{date}` - Post date formatted as `YYYYMMDD`
  - `{time}` - Post time formatted as `HHmmss`
  - `{ext}` - File extension (`mp4`, `mp3`, `jpg`, `gif`)
- Live preview display in Settings with tag management, visual collision protection, and pattern resets.

### Local Archive & Gamified Control Hub
- **Offline Download History**: Search, inspect, re-download, and filter past downloads by media format (**MP4, JPG, GIF, and MP3**).
- **Dedicated Audio Categorization**: Distinct Neon Rose / Magenta Synth badges and musical note icons for MP3 files with isolated audio statistics tracking.
- **Data Portability**: Export and import your complete download history as JSON backups anytime.
- **Cyberpunk Leveling System**: Earn drops and rank up across 8 distinct tier milestones (from *Rookie* to *Godlike*) featuring segmented progress meters.

### Multi-Theme Glassmorphism UI
- **Dual Visual Themes**: Choose between **Neon Cyber** (Dark Mode with glowing cyan accents) and **Clean Slate** (Modern crisp Light Mode).
- **Full Bilingual Localization**: Complete native interface translations for both English and Bahasa Indonesia with instant language switching.

---

## Latest Updates & Changelog (v2.2.0)

- **Rebranded to X-Vault**: Official identity upgrade featuring a sleek, modern minimalist geometric logo with instant download arrow symbolism and seamless dark/light squircle antialiasing.
- **Real-Time Cross-Tab Synchronization**: Instant live settings and theme updates across all open Twitter/X tabs and Control Hub views without requiring manual page refresh (F5).
- **Default Quality & GIF "Ask Every Time"**: Ensured resolution and format prompts respect user preference on every download by default.
- **Keyboard Shortcut (`D`) Toggle**: Added dedicated settings control card to toggle in-timeline one-key media downloading.
- **Robust Storage Persistence**: Safe merging of settings on install/reload to prevent accidental resets.
- **Sub-Directory Input Validation & Smart Sanitization**: Added real-time character blocking for forbidden OS folder symbols (`< > : " / \ | ? *`) and clean sanitization that eliminates ugly double underscores.
- **Multi-Media Batch Download Reliability**: Fixed timeline action bar download errors when posts have multiple photos or videos by implementing collision-free serial numbering (`_01`, `_02`), safe download pacing (500ms queue intervals), and generous download progress watchdogs.
- **External Drive Storage Guidance**: Added an in-app tips banner explaining browser download sandbox policies and how to direct 1-click downloads to Drive D: or external hard drives without Save As dialogs.
- **Authentic MP3 Audio Extraction**: Integrated `lame.min.js` and Web Audio API (`AudioContext.decodeAudioData`) to extract pure audio with zero video tracks, resolving the issue where audio downloads were previously 1080p MP4 files renamed to `.mp3`.
- **Full Resolution Tiering (270p - 1080p)**: Added 360p and 270p options in the Control Hub and floating resolution chooser modal.
- **Vertical / Portrait Video Resolution Fix**: Fixed dimension parsing using `minDim = Math.min(width, height)` so that 270x480 portrait videos download strictly as 270p instead of defaulting to 1080p.
- **Strict Quality Stream Enforcement**: Guaranteed that the requested stream URL and `{quality}` filename token strictly match the chosen resolution.
- **Smart Single-Tab Settings Management**: Clicking the Settings button in the popup or timeline modals now instantly focuses and switches to the existing Settings tab instead of opening redundant duplicate tabs.
- **Dedicated MP3 Archive & Filter**: Added an **MP3** filter button in the Control Hub History toolbar, with vibrant neon rose badge styling and isolated audio statistics tracking.
- **CSP / CORS Resilience**: Added background proxy fallback (`FETCH_MEDIA_BUFFER`) for audio stream fetching to ensure 100% reliable extraction across all tweet security headers.

---

## Installation

### Method 1: Pre-packaged ZIP (Ready to Use)
1. Download [`X-Vault-v2.2.0.zip`](https://github.com/Pikurii/Twitter-Video-Downloader-Extension/raw/main/X-Vault-v2.2.0.zip).
2. Extract the ZIP file into a dedicated folder on your computer.
3. Open your browser and go to `chrome://extensions` (or `opera://extensions`, `edge://extensions`).
4. Enable **Developer mode** using the toggle switch in the upper-right corner.
5. Click **Load unpacked** and select the extracted folder (or the `package/X-Vault` folder).
6. Pin X-Vault to your browser toolbar for quick access.

### Method 2: Clone from Repository
```bash
git clone https://github.com/Pikurii/Twitter-Video-Downloader-Extension.git
```
In `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the cloned directory.

---

## Privacy Policy

X-Vault is built with an offline-first, zero-telemetry architecture:

1. **Zero Data Collection**: The extension does not collect, track, log, or transmit any user information, tweet links, browsing history, or downloaded files.
2. **100% Local Processing**: All video stream parsing, network request intercepting, canvas frame rendering, and GIF LZW encoding execute strictly within your local browser process.
3. **No External Network Calls**: The extension includes zero analytics trackers, zero advertising libraries, and zero external API dependencies. All operations communicate solely with Twitter/X CDN endpoints to fetch requested media.
4. **Local Sandbox Storage**: Download history, custom filename templates, and user preferences are saved exclusively inside your browser's local sandbox (`chrome.storage.local`).
5. **Minimal Permissions**:
   - `downloads`: To save chosen media files directly to your Downloads folder.
   - `storage`: To preserve your local settings and archival history.
   - `webRequest`: To intercept Twitter video manifest and playlist streams (m3u8).
   - `activeTab` & `tabs`: To communicate with the current tab for media detection.
   - `notifications`: To provide visual confirmation when a download completes.
   - `contextMenus`: To offer right-click quality selection on media items.

---

## Legal Disclaimer & Copyright Notice

> [!IMPORTANT]
> **Please read the following disclaimer carefully before using this software.**

1. **Third-Party Intellectual Property**: All tweets, images, videos, audio clips, and animations hosted on Twitter/X remain the exclusive property, trademark, and copyright of their respective authors, creators, or copyright holders.
2. **Personal and Non-Commercial Archival Only**: This extension is provided solely as a personal convenience tool for private offline backup and non-commercial archival viewing of publicly accessible media.
3. **Strict Prohibition of Unauthorized Re-uploads**: The author and developers of X-Vault do not condone, promote, or encourage copyright infringement, intellectual property theft, or unauthorized re-distribution. Downloading someone else's media and re-uploading, republishing, monetizing, or claiming ownership of it without explicit consent or licensing from the original creator is a violation of copyright law.
4. **User Responsibility & Limitation of Liability**: You, as the user, assume full, independent, and sole legal responsibility for how you utilize any content acquired through this software. The developer of X-Vault bears **no responsibility or legal liability** for any copyright violations, intellectual property claims, civil disputes, or criminal proceedings arising from third-party misuse, re-uploading, or unauthorized redistribution of downloaded content.
5. **Non-Affiliation**: This software is an independent open-source project and is not affiliated, endorsed, sponsored, or officially connected with Twitter, X Corp., or any of their subsidiaries or affiliates.

---

## Project Structure

```text
Twitter-Video-Downloader-Extension/
├── package/
│   ├── X-Vault/                  # Clean standalone extension package
│   │   ├── manifest.json         # Extension manifest (v2.2.0, MV3)
│   │   ├── background.js         # Service worker: stream capture & downloads
│   │   ├── content.js            # Content script: DOM observer & badges
│   │   ├── twitter_interceptor.js# Injected script: GraphQL & API stream capture
│   │   ├── lame.min.js           # Client-side LAME MP3 audio encoder
│   │   ├── modules/              # Sub-modules (gifEncoder.js)
│   │   ├── popup/                # Quick Drop Popup interface & controller
│   │   ├── settings/             # Control Hub dashboard & settings logic
│   │   └── icons/                # Production extension icons (16, 32, 48, 128 px)
│   └── X-Vault-v2.2.0.zip        # Offline distribution zip package
├── manifest.json                 # Root extension manifest
├── background.js                # Root service worker
├── content.js                   # Root content script
├── twitter_interceptor.js       # Root interceptor
├── lame.min.js                  # Root MP3 encoder
├── modules/                     # Root modules
├── popup/                       # Root popup module
├── settings/                    # Root settings module
├── icons/                       # Root extension icons
├── X-Vault-v2.2.0.zip           # Ready-to-use distribution package
├── LICENSE                      # MIT License (c) 2026 Pikuri
└── README.md                    # Documentation
```

---

## Author & License

- **Author**: Pikuri ([@Pikurii](https://github.com/Pikurii))
- **Repository**: [https://github.com/Pikurii/Twitter-Video-Downloader-Extension](https://github.com/Pikurii/Twitter-Video-Downloader-Extension)
- **Support**: [Ko-fi](https://ko-fi.com/pikurii) | [Tako.id](https://tako.id/Pikuri)
- **License**: Released under the [MIT License](LICENSE).
