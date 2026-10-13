// modules/gifEncoder.js - X-Vault: High-Performance Spec-Compliant GIF89a Encoder & Video-to-GIF Converter
// Dibuat oleh Pikuri (https://github.com/Pikurii)
//
// OPTIMASI PERFORMA TINGKAT TINGGI:
// 1. Flat Uint8Array growable buffer (zero-allocation memory footprint).
// 2. TypedArray LZW Hash Table (Int32Array/Int16Array 5003-bucket prime double-hashing).
// 3. Fast 32-bit pixel reading (Uint32Array word access).
// 4. Perceptual Frame Diffing & Intelligent Frame Deduplication (menggabungkan frame diam/identik).
// 5. Intelligent Adaptive FPS & Frame Cap (mencegah memory explosion pada video berdurasi panjang).
// 6. GPU-accelerated OffscreenCanvas rendering & hardware fastSeek.
// 7. Instant Cancelation / AbortSignal support.

(function (global) {
  "use strict";

  // Cross-browser WebExtensions API compatibility
  if (typeof chrome === "undefined" && typeof browser !== "undefined") {
    global.chrome = browser;
  } else if (typeof browser === "undefined" && typeof chrome !== "undefined") {
    global.browser = chrome;
  }

  // ==================== SPEC-COMPLIANT HIGH-PERFORMANCE GIF89a ENCODER ====================
  function createGifEncoder(width, height) {
    let capacity = Math.max(65536, width * height * 2);
    let buf = new Uint8Array(capacity);
    let p = 0;
    let lastFrameDelayPos = -1;

    function ensureCapacity(needed) {
      if (p + needed > capacity) {
        capacity = Math.max(capacity * 2, p + needed + 65536);
        const newBuf = new Uint8Array(capacity);
        newBuf.set(buf.subarray(0, p));
        buf = newBuf;
      }
    }

    ensureCapacity(1024);

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

    // ==================== TYPEDARRAY LZW ENGINE (5003-PRIME DOUBLE HASHING) ====================
    const HSIZE = 5003;
    const htab = new Int32Array(HSIZE);
    const codetab = new Int16Array(HSIZE);

    function writeLzwCodeStream(minCodeSize, indexStream) {
      ensureCapacity(indexStream.length * 2 + 1024);
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

      htab.fill(-1);
      emitCode(clearCode);

      let ibCode = indexStream[0] & codeMask;

      for (let idx = 1, len = indexStream.length; idx < len; ++idx) {
        const k = indexStream[idx] & codeMask;
        const fkey = (ibCode << 8) | k;
        let i = ((k << 4) ^ ibCode) % HSIZE;
        let disp = ((k << 4) ^ ibCode);
        if (disp === 0) disp = 1;
        disp = disp % HSIZE;
        if (disp === 0) disp = 1;

        let hit = false;
        while (htab[i] !== -1) {
          if (htab[i] === fkey) {
            ibCode = codetab[i];
            hit = true;
            break;
          }
          i -= disp;
          if (i < 0) i += HSIZE;
        }

        if (!hit) {
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
            htab.fill(-1);
          } else {
            if (nextCode >= (1 << curCodeSize)) {
              ++curCodeSize;
            }
            codetab[i] = nextCode++;
            htab[i] = fkey;
          }
          ibCode = k;
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

    // ==================== FAST 32-BIT COLOR QUANTIZATION & FRAME DIFFING ====================
    let prevFrameData32 = null;

    function quantizeFrame(rgbaData, w, h, quality = "medium", prevData32 = null) {
      const pixelCount = w * h;
      const data32 = new Uint32Array(rgbaData.buffer, rgbaData.byteOffset, pixelCount);
      const palette = new Uint8Array(256 * 3);
      const indexedPixels = new Uint8Array(pixelCount);

      const step = quality === "small" ? 4 : (quality === "medium" ? 2 : 1);
      const colorMap = new Map();

      // Scan and histogram sampling using fast 32-bit bitshifts
      for (let pix = 0; pix < pixelCount; pix += step) {
        const p32 = data32[pix];
        const r = (p32 & 0xF8) << 7;
        const g = (p32 & 0xF800) >> 6;
        const b = (p32 & 0xF80000) >> 19;
        const key = r | g | b;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }

      // Reserve index 255 for transparency frame diffing
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 255);

      const palR = new Uint8Array(256);
      const palG = new Uint8Array(256);
      const palB = new Uint8Array(256);

      const palCount = Math.min(sortedColors.length, 255) || 1;
      for (let i = 0; i < palCount; i++) {
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
      }

      const lookupCache = new Int16Array(32768).fill(-1);
      let matchingPixels = 0;
      const TRANSPARENT_IDX = 255;

      for (let pix = 0; pix < pixelCount; pix++) {
        const p32 = data32[pix];
        const r = p32 & 0xFF;
        const g = (p32 >> 8) & 0xFF;
        const b = (p32 >> 16) & 0xFF;

        // Frame diffing: Jika piksel cocok dengan frame sebelumnya dalam batas perseptual
        if (prevData32) {
          const prev32 = prevData32[pix];
          const pr = prev32 & 0xFF;
          const pg = (prev32 >> 8) & 0xFF;
          const pb = (prev32 >> 16) & 0xFF;
          if (Math.abs(r - pr) <= 2 && Math.abs(g - pg) <= 2 && Math.abs(b - pb) <= 2) {
            indexedPixels[pix] = TRANSPARENT_IDX;
            matchingPixels++;
            continue;
          }
        }

        const rgbKey = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let cached = lookupCache[rgbKey];
        if (cached !== -1) {
          indexedPixels[pix] = cached;
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
          lookupCache[rgbKey] = bestIdx;
          indexedPixels[pix] = bestIdx;
        }
      }

      const isFullDuplicate = prevData32 !== null && matchingPixels === pixelCount;

      return {
        palette,
        indexedPixels,
        hasTransparency: matchingPixels > 0,
        isFullDuplicate,
        data32Copy: new Uint32Array(data32)
      };
    }

    function addFrame(rgbaData, frameWidth, frameHeight, delayMs = 100, quality = "medium") {
      ensureCapacity(2048 + 768 + frameWidth * frameHeight * 2);
      const { palette, indexedPixels, hasTransparency, isFullDuplicate, data32Copy } = quantizeFrame(
        rgbaData,
        frameWidth,
        frameHeight,
        quality,
        prevFrameData32
      );

      // ==================== INTELLIGENT FRAME DEDUPLICATION ====================
      // Jika frame saat ini 100% sama dengan frame sebelumnya, jangan tulis frame baru!
      // Cukup tambahkan durasi delay pada frame sebelumnya di berkas GIF.
      if (isFullDuplicate && lastFrameDelayPos !== -1) {
        const prevDelay = buf[lastFrameDelayPos] | (buf[lastFrameDelayPos + 1] << 8);
        const addedDelay = Math.max(1, Math.round(delayMs / 10));
        const newDelay = Math.min(65535, prevDelay + addedDelay);
        buf[lastFrameDelayPos] = newDelay & 0xFF;
        buf[lastFrameDelayPos + 1] = (newDelay >> 8) & 0xFF;
        return; // Hemat kompresi LZW & ukuran berkas!
      }

      prevFrameData32 = data32Copy;

      // Graphic Control Extension (8 bytes)
      buf[p++] = 0x21; // Extension Introducer
      buf[p++] = 0xF9; // Graphic Control Label
      buf[p++] = 0x04; // Block Size (4 bytes)
      // Disposal Method 1 (do not dispose, leave in place)
      buf[p++] = hasTransparency ? 0x05 : 0x04;
      const delayHundredths = Math.max(1, Math.round(delayMs / 10));
      lastFrameDelayPos = p; // Catat indeks delay untuk deduplikasi frame berikutnya
      buf[p++] = delayHundredths & 0xFF;
      buf[p++] = (delayHundredths >> 8) & 0xFF;
      buf[p++] = hasTransparency ? 255 : 0x00; // Transparent Color Index = 255
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
      ensureCapacity(1);
      buf[p++] = 0x3B; // GIF Trailer
      return buf.subarray(0, p);
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

  async function convertMp4ToGif(mp4Url, presetKey, onProgress, options = {}) {
    const preset = GIF_PRESETS[presetKey] || GIF_PRESETS["gif-medium"];
    const signal = options?.signal;

    if (signal?.aborted) {
      throw new Error("ConversionCancelled");
    }

    if (onProgress) onProgress(5, "5%");

    // Fetch MP4 buffer via background script to bypass CSP/CORS
    const fetchRes = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "FETCH_MEDIA_BUFFER",
        payload: { url: mp4Url }
      }, (res) => resolve(res));
    });

    if (signal?.aborted) throw new Error("ConversionCancelled");

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

    if (signal?.aborted) {
      URL.revokeObjectURL(localBlobUrl);
      throw new Error("ConversionCancelled");
    }

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

    if (signal?.aborted) {
      URL.revokeObjectURL(localBlobUrl);
      video.src = "";
      throw new Error("ConversionCancelled");
    }

    // Duration cap (maksimal 20 detik untuk animasi GIF)
    const rawDuration = video.duration || 3;
    const duration = Math.min(rawDuration, options?.maxDuration || 20);

    // ==================== INTELLIGENT ADAPTIVE FPS & FRAME CAP ====================
    // Batasi total frame maksimal 120 agar tidak terjadi memory explosion pada video panjang
    const maxFramesCap = options?.maxFrames || 120;
    let fps = preset.fps;
    if (duration * fps > maxFramesCap) {
      fps = Math.max(8, Math.floor(maxFramesCap / duration));
    }
    const frameStep = 1 / fps;
    const delayMs = Math.round(frameStep * 1000);
    const totalFrames = Math.max(1, Math.floor(duration / frameStep));

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

    // ==================== OFFSCREENCANVAS GPU ACCELERATION ====================
    let canvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(targetW, targetH);
    } else {
      canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const encoder = createGifEncoder(targetW, targetH);
    let frameIdx = 0;
    let capturedThumbUrl = null;

    // Start with a slight offset to avoid pitch-black initial frame before video decoding
    const startOffset = Math.min(0.06, duration * 0.05);

    for (let currentTime = startOffset; currentTime < duration; currentTime += frameStep) {
      if (signal?.aborted) {
        URL.revokeObjectURL(localBlobUrl);
        video.src = "";
        video.load();
        throw new Error("ConversionCancelled");
      }

      const targetTime = Math.min(currentTime, duration - 0.01);
      if (typeof video.fastSeek === "function") {
        try {
          video.fastSeek(targetTime);
        } catch (e) {
          video.currentTime = targetTime;
        }
      } else {
        video.currentTime = targetTime;
      }

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
          const thumbW = 120;
          const thumbH = Math.max(60, Math.round((120 * targetH) / targetW));
          if (typeof OffscreenCanvas !== "undefined" && typeof canvas.convertToBlob === "function") {
            const tCanvas = new OffscreenCanvas(thumbW, thumbH);
            const tctx = tCanvas.getContext("2d");
            tctx.drawImage(canvas, 0, 0, thumbW, thumbH);
            const thumbBlob = await tCanvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
            capturedThumbUrl = await new Promise((res) => {
              const r = new FileReader();
              r.onloadend = () => res(r.result);
              r.readAsDataURL(thumbBlob);
            });
          } else {
            const tCanvas = document.createElement("canvas");
            tCanvas.width = thumbW;
            tCanvas.height = thumbH;
            const tctx = tCanvas.getContext("2d");
            tctx.drawImage(canvas, 0, 0, thumbW, thumbH);
            capturedThumbUrl = tCanvas.toDataURL("image/jpeg", 0.75);
          }
        } catch (e) {}
      }

      frameIdx++;
      const pct = Math.min(95, 15 + Math.round((frameIdx / totalFrames) * 80));
      if (onProgress) onProgress(pct, `${pct}%`);

      // Yield back to browser event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (onProgress) onProgress(98, "98%");
    const gifBytes = encoder.finish();

    // Clean up local resources immediately
    URL.revokeObjectURL(localBlobUrl);
    try {
      video.src = "";
      video.load();
      if (canvas.width !== undefined) {
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (e) {}

    const gifBlob = new Blob([gifBytes], { type: "image/gif" });
    const blobUrl = URL.createObjectURL(gifBlob);

    // Provide dataUrl for backwards compatibility for small GIFs, but primary is fast zero-copy blobUrl
    let dataUrl = "";
    if (gifBytes.length < 2 * 1024 * 1024) {
      try {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(gifBlob);
        });
      } catch (e) {}
    }

    return {
      blob: gifBlob,
      blobUrl,
      dataUrl: dataUrl || blobUrl,
      capturedThumbUrl
    };
  }

  // Export to global scope for content script & WebExtensions runtime
  global.createGifEncoder = createGifEncoder;
  global.GIF_PRESETS = GIF_PRESETS;
  global.convertMp4ToGif = convertMp4ToGif;

})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
