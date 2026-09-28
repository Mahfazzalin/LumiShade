# LumiShade — Eye Comfort, Night Browsing & Screen Privacy

> **A modern, privacy-first Google Chrome Extension (Manifest V3) for low-light browsing, gentle color transformations, reading focus, and instant full-screen privacy protection.**

---

## Overview

**LumiShade** is engineered for comfortable browsing during late hours, intense reading sessions, and low-light conditions. It reduces harsh screen glare, balances contrast, converts bright backgrounds into soothing dark modes, applies warm amber overlays, and provides an instant **Privacy Blur** curtain when you need to quickly hide your screen from view.

Built with **Manifest V3**, modern CSS3, and vanilla JavaScript, LumiShade runs **100% locally on your computer** with zero external dependencies, zero trackers, and zero telemetry.

> **Notice**: LumiShade is designed to reduce visual brightness and provide a more comfortable environment for low-light browsing. It does not make medical or ophthalmological claims.

---

## Key Features

1. **8 Tailored Visual Modes**:
   - **Original**: Normal natural webpage rendering.
   - **Night Comfort**: Balanced contrast, reduced brightness (85%), and subtle amber warmth.
   - **Warm Night**: Warm amber color overlay to minimize harsh blue tones.
   - **Dim Level**: Gentle neutral dark overlay curtain preserving text contrast.
   - **Smart Dark**: High-performance inversion for bright sites, keeping images, videos, and icons looking natural.
   - **Grayscale**: Converts saturated webpage colors into soft gray tones.
   - **Black & White**: High-contrast monochrome reading treatment.
   - **Custom**: User-defined combination of sliders.
2. **Precision Custom Sliders**:
   - **Brightness** (0% to 100%)
   - **Contrast** (0% to 200%)
   - **Grayscale** (0% to 100%)
   - **Warmth** (0% to 100%) with **Kelvin temperature indicator** (6500K down to 1900K candlelight).
   - **Dim Level** (0% to 100%)
   - **Instant Reset** button to restore presets.
3. **Focus Reading Ruler (<kbd>Alt + Shift + R</kbd>)**:
   - An isolated Shadow DOM reading slit following your mouse cursor.
   - Dims surrounding lines to reduce distractions and boost reading speed for documents, research, and long articles.
4. **20-20-20 Eye Rest Break & Wellness Guide**:
   - Ophthalmologist-recommended habit: every 20 minutes, look 20 feet away for 20 seconds.
   - Gentle floating prompts or quick-launch 20-second breathing countdown from the popup.
5. **Full-Page Privacy Blur Curtain (<kbd>Alt + Shift + B</kbd>)**:
   - Immediately obscures the entire visible viewport with a heavy backdrop-filter blur (`blur(28px)`) and dark translucent curtain (`82% opacity`).
   - Displays a discreet center shield badge and live clock.
   - Prevents accidental clicks or text selection behind the veil.
   - Sharp floating unblur button in isolated Shadow DOM (configurable corners) + <kbd>Escape</kbd> instant restore.
6. **Smart Automation & Scheduled Night Shift**:
   - Set custom start and end hours (e.g., 20:00 to 07:00) to auto-engage night mode.
   - Optional automatic sync with your operating system's dark/light theme (`prefers-color-scheme`).
7. **Automated Safety Triggers**:
   - Auto-blur on tab switch / window blur.
   - Inactivity auto-blur timer (1, 2, 5, or 10 minutes of idle time).
8. **One-Click Domain Whitelist / Exclusion**:
   - Directly toggle *"Exclude / Include this Site"* from the popup header or right-click context menu.
   - Manage excluded websites table in the Settings dashboard.
9. **Backup & Restore**:
   - Export your custom modes, whitelist rules, and slider preferences to `.json`.
   - Restore seamlessly across computers and browsers.
10. **Keyboard Shortcuts & Context Menus**:
    - Right-click anywhere for instant access to power, privacy blur, smart dark mode, and domain exclusions.

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
|---|---|---|
| <kbd>Alt + Shift + E</kbd> | Toggle Power | Turns comfort filters ON or OFF |
| <kbd>Alt + Shift + B</kbd> | Toggle Privacy Blur | Hides or reveals the screen with blur |
| <kbd>Alt + Shift + M</kbd> | Cycle Visual Mode | Cycles through Night, Warm, Dim, Smart Dark, Grayscale, B&W & Original |
| <kbd>Alt + Shift + R</kbd> | Toggle Reading Ruler | Toggles guided cursor reading slit |
| <kbd>Escape</kbd> | Dismiss Privacy Veil | Unblurs the page immediately |

> **Customizing Shortcuts**: Chromium allows you to change default shortcuts at any time by navigating to `chrome://extensions/shortcuts`.

---

## Project Structure

```
LumiShade/
├── manifest.json                  # Manifest V3 specification (v1.1.0)
├── background/
│   └── service-worker.js          # Ephemeral SW for commands, alarms, context menus & badge
├── content/
│   ├── visual-engine.js           # Reusable CSS filter, smart dark & overlay engine
│   ├── privacy.js                 # Isolated Shadow DOM privacy veil, clock & floating button
│   ├── reading-ruler.js           # Mouse-tracking reading guide slit
│   ├── eye-break.js               # 20-20-20 eye rest prompt & countdown
│   ├── content.css                # Scoped injected curtain styles
│   └── content.js                 # Content script coordinator & message handler
├── popup/
│   ├── popup.html                 # Accessible, dark-first popup UI
│   ├── popup.css                  # Modern glassmorphic styles
│   └── popup.js                   # Popup state, site exclusion & tab communication
├── settings/
│   ├── settings.html              # Full preferences dashboard with schedule & backup
│   ├── settings.css               # Settings styling
│   └── settings.js                # Settings controller & JSON import/export
├── icons/
│   ├── icon.svg                   # Vector source icon
│   ├── icon-16.png                # 16x16 PNG
│   ├── icon-32.png                # 32x32 PNG
│   ├── icon-48.png                # 48x48 PNG
│   └── icon-128.png               # 128x128 PNG
├── generate_icons.py              # Icon generation script via Pillow
├── CHROMEWEBSTORE.md              # Chrome Web Store listing, permissions & privacy docs
└── README.md                      # Complete documentation
```

---

## Installation Guide (Developer Mode)

To install and run LumiShade in Google Chrome or any Chromium-based browser (Brave, Microsoft Edge, Arc, Opera, Vivaldi):

1. **Open the Extensions Page**:
   - In your browser's address bar, navigate to `chrome://extensions/` (or `edge://extensions/` in Microsoft Edge).
2. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch in the top-right corner of the page.
3. **Load Unpacked**:
   - Click the **Load unpacked** button in the top-left toolbar.
4. **Select Folder**:
   - Select the `LumiShade` folder:
     ```
     c:\Users\mahf\Desktop\LumiShade
     ```
5. **Verify Installation**:
   - The **LumiShade** card will appear in your extension list with version `1.1.0`.
   - Pin LumiShade to your browser toolbar for fast access.

---

## Security & Privacy Guarantee

- **Zero Tracking**: No analytics, telemetry, or remote tracking libraries.
- **Zero Remote Code**: No external CDNs, `eval()`, `new Function()`, or third-party dependencies.
- **Local Storage Only**: Only uses `chrome.storage.local` on your machine.
- **Minimum Permissions**: Only requests `storage`, `alarms`, and `contextMenus`.
