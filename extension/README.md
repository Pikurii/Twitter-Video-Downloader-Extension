# X-Vault - Twitter/X Media Downloader & Archival Hub

<p align="center">
  <a href="https://github.com/Pikurii/Twitter-Video-Downloader-Extension/raw/main/Video-Downloader-Extension.zip">
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
- Download videos at their native source resolution or choose from specific stream tiers: 1080p, 720p, 480p, 360p, or 270p.
- **Audio Only (MP3)**: Extract pure audio streams from videos and podcasts without downloading redundant video payloads.
- **Interactive Quality Chooser**: Trigger a floating quality popover on-the-fly or configure a default quality rule ("Always ask" or "Native best").
- **Secondary Media Context Menu**: Right-click any video download button to instantly open resolution choices without modifying your default preferences.

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

### Dynamic Filename Formatting Engine
- Customize automated file names using real-time dynamic tags:
  - `{author}` - Tweet author display name
  - `{username}` - Author handle without the `@` symbol
  - `{tweet_id}` - Unique status identifier
  - `{quality}` - Resolution tag (e.g., `1080p`, `720p`, `audio`, `GIF`)
  - `{date}` - Post date formatted as `YYYYMMDD`
  - `{time}` - Post time formatted as `HHmmss`
  - `{ext}` - File extension (`mp4`, `mp3`, `jpg`, `gif`)
- Live preview display in Settings with tag management, visual validation, and pattern resets.

### Local Archive & Gamified Control Hub
- **Offline Download History**: Search, inspect, re-download, and filter past downloads by media format (MP4, JPG, GIF).
- **Data Portability**: Export and import your complete download history as JSON backups anytime.
- **Cyberpunk Leveling System**: Earn drops and rank up across 8 distinct tier milestones (from *Rookie* to *Godlike*) featuring segmented progress meters.

### Multi-Theme Glassmorphism UI
- **Dual Visual Themes**: Choose between **Neon Cyber** (Dark Mode with glowing cyan accents) and **Clean Slate** (Modern crisp Light Mode).
- **Full Bilingual Localization**: Complete native interface translations for both English and Bahasa Indonesia with instant language switching.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + X` | Open X-Vault Quick Drop popup |
| `Esc` | Close open quality pickers or floating popups |

To customize shortcuts in your browser:
- **Chrome / Brave / Edge**: Navigate to `chrome://extensions/shortcuts`
- **Opera / Opera GX**: Navigate to `chrome://extensions/shortcuts` (standard Chromium shortcut configuration)

---

## Installation

### Method 1: Pre-packaged ZIP (Ready to Use)
1. Download [`Video-Downloader-Extension.zip`](https://github.com/Pikurii/Twitter-Video-Downloader-Extension/raw/main/Video-Downloader-Extension.zip).
2. Extract the ZIP file into a dedicated folder on your computer.
3. Open your browser and go to `chrome://extensions` (or `opera://extensions`, `edge://extensions`).
4. Enable **Developer mode** using the toggle switch in the upper-right corner.
5. Click **Load unpacked** and select the extracted folder.
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
video-download-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js             # Service worker: stream interception, downloads, history
├── content.js                # Content script: DOM observer, badges, GIF LZW encoder
├── twitter_interceptor.js    # Injected script: GraphQL & API stream capture
├── popup.html                # Quick drop popup interface
├── popup.css                 # Popup glassmorphism stylesheet (Dark & Light)
├── popup.js                  # Popup controller, particle canvas & stats
├── settings.html             # Control Hub: general, features, history, ranks
├── settings.css              # Control Hub stylesheet (Cyber Dark & Light)
├── settings.js               # Control Hub controller, pattern engine, history
├── icons/                    # Extension icons (16, 32, 48, 128 px)
├── Video-Downloader-Extension.zip # Pre-built distribution package
├── LICENSE                   # MIT License (c) 2026 Pikuri
└── README.md                 # Documentation
```

---

## Author & License

- **Author**: Pikuri ([@Pikurii](https://github.com/Pikurii))
- **Repository**: [https://github.com/Pikurii/Twitter-Video-Downloader-Extension](https://github.com/Pikurii/Twitter-Video-Downloader-Extension)
- **Support**: [Ko-fi](https://ko-fi.com/pikurii) | [Tako.id](https://tako.id/Pikuri)
- **License**: Released under the [MIT License](LICENSE).
