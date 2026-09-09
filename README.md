# LumiShade — Eye Comfort, Night Browsing & Screen Privacy

> **A modern, privacy-first Google Chrome Extension (Manifest V3) for low-light browsing, gentle color transformations, and instant full-screen privacy protection.**

---

## Overview

**LumiShade** is engineered for comfortable browsing during late hours and low-light conditions. It reduces harsh screen glare, balances high-contrast web elements, applies soothing amber overlays, and provides an instant **Privacy Blur** curtain when you need to quickly hide your screen from view.

Built with **Manifest V3**, modern CSS3, and vanilla JavaScript, LumiShade runs **100% locally on your computer** with zero external dependencies, zero trackers, and zero telemetry.

> **Notice**: LumiShade is designed to reduce visual brightness and provide a more comfortable environment for low-light browsing. It does not make medical or ophthalmological claims.

---

## Key Features

1. **7 Tailored Visual Modes**:
   - **Original**: Normal webpage rendering.
   - **Night Comfort**: Balanced contrast, reduced brightness (85%), and subtle amber warmth.
   - **Warm Night**: Warm amber color overlay to minimize harsh blue tones.
   - **Dim Level**: Gentle neutral dark overlay curtain preserving text contrast.
   - **Grayscale**: Converts saturated webpage colors into soft gray tones.
   - **Black & White**: High-contrast monochrome reading treatment.
   - **Custom**: User-defined combination of sliders.
2. **Precision Custom Sliders**:
   - **Brightness** (0% to 100%)
   - **Contrast** (0% to 200%)
   - **Grayscale** (0% to 100%)
   - **Warmth** (0% to 100%)
   - **Dim Level** (0% to 100%)
   - **Instant Reset** button to restore presets.
3. **Full-Page Privacy Blur Curtain**:
   - Immediately obscures the entire visible viewport with a heavy backdrop-filter blur (`blur(28px)`) and dark translucent curtain (`82% opacity`).
   - Prevents accidental clicks or text selection behind the veil.
   - Remains active continuously while scrolling.
4. **Sharp Floating Unblur Button**:
   - Encapsulated inside an **isolated Shadow DOM** so page CSS cannot hide or distort it.
   - Remains razor-sharp and unblurred on top of the veil.
   - Configurable position in any of the 4 screen corners (Bottom-Right, Bottom-Left, Top-Right, Top-Left).
   - Pressing the <kbd>Escape</kbd> key or clicking the button instantly restores the page.
5. **Keyboard Shortcuts**:
   - <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>E</kbd>: Toggle Eye Comfort Mode ON / OFF.
   - <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>: Toggle Privacy Blur.
   - <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>: Cycle through visual modes.
   - <kbd>Escape</kbd>: Instantly dismiss Privacy Blur.
6. **Robust Page Defense & SPA Compatibility**:
   - Injected elements use isolated Shadow DOM and unique namespaces (`lumishade-*`).
   - Mutation observers defend against single-page apps (SPAs) rewriting the DOM.
7. **Full Settings Dashboard**:
   - Dedicated settings page for startup preferences, privacy parameters, and per-site memory.
8. **Accessibility & Reduced Motion**:
   - Full keyboard navigation and visible focus rings.
   - Strict adherence to `prefers-reduced-motion` media queries.

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
   - The **LumiShade** card will appear in your extension list with version `1.0.0`.
   - Pin LumiShade to your browser toolbar for fast access.

---

## How to Use

1. **Opening the Popup**:
   - Click the LumiShade icon in your browser toolbar.
2. **Switching Modes**:
   - Click any of the 7 visual mode cards (Original, Night, Warm, Dim, Grayscale, B&W, Custom).
3. **Fine-Tuning**:
   - Drag any slider (Brightness, Contrast, Grayscale, Warmth, Dim). The page reflects changes in real-time.
   - Click **Reset** to return sliders to the default values of the active mode.
4. **Activating Privacy Blur**:
   - Click the **Privacy Blur** hero toggle in the popup or press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>.
   - To restore the page, click the floating pill button on the screen or press <kbd>Escape</kbd>.
5. **Customizing Preferences**:
   - Click the gear icon in the popup header to open the full Settings dashboard.

---

## Keyboard Shortcuts

| Shortcut | Action | Description |
|---|---|---|
| <kbd>Alt + Shift + E</kbd> | Toggle Power | Turns comfort filters ON or OFF |
| <kbd>Alt + Shift + B</kbd> | Toggle Privacy Blur | Hides or reveals the screen with blur |
| <kbd>Alt + Shift + M</kbd> | Cycle Visual Mode | Cycles through Night, Warm, Dim, Grayscale, B&W, and Original |
| <kbd>Escape</kbd> | Dismiss Blur | Unblurs the page immediately |

> **Customizing Shortcuts**: Chromium allows you to change default shortcuts at any time by navigating to `chrome://extensions/shortcuts`.

---

## Project Structure

```
LumiShade/
├── manifest.json                  # Manifest V3 specification
├── background/
│   └── service-worker.js          # Ephemeral SW for commands, lifecycle & badge
├── content/
│   ├── visual-engine.js           # Reusable CSS filter & overlay engine
│   ├── privacy.js                 # Isolated Shadow DOM privacy veil & floating button
│   ├── content.css                # Scoped injected curtain styles
│   └── content.js                 # Content script coordinator & message handler
├── popup/
│   ├── popup.html                 # Accessible, dark-first popup UI
│   ├── popup.css                  # Modern glassmorphic styles
│   └── popup.js                   # Popup state, slider syncing & tab communication
├── settings/
│   ├── settings.html              # Full preferences dashboard
│   ├── settings.css               # Settings styling
│   └── settings.js                # Settings controller & persistence
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

## Known Chrome Restrictions

- **Internal Chrome Pages**: Chromium security blocks extensions and content scripts from modifying internal pages like `chrome://extensions`, `chrome://settings`, and `chrome://newtab`.
- **Chrome Web Store**: Chrome extensions are strictly prevented from modifying pages hosted under `chromewebstore.google.com`.
- LumiShade detects these restricted pages and displays a discreet notice banner in the popup without throwing uncaught errors.

---

## Security & Privacy Guarantee

- **Zero Tracking**: No analytics, telemetry, or remote tracking libraries.
- **Zero Remote Code**: No external CDNs, `eval()`, `new Function()`, or third-party dependencies.
- **Local Storage Only**: Only uses `chrome.storage.local` to store your brightness and mode preferences on your device.
- **Minimum Permissions**: Only requests `storage` permission.

---

## Troubleshooting

- **Page didn't change after clicking a mode**:
  Ensure the page was loaded after installing the extension. Refresh the page once to initialize content scripts.
- **Privacy button is hidden by something**:
  LumiShade uses Shadow DOM with `z-index: 2147483647`. If a website has an unusual layout, you can press <kbd>Escape</kbd> on your keyboard or select a different corner position in the Settings page.
- **Shortcut didn't fire**:
  Check if another extension or browser native command is using that key combination in `chrome://extensions/shortcuts`.
