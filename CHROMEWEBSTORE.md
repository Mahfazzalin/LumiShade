# Chrome Web Store Listing — LumiShade — Eye Comfort, Night Mode & Privacy

> Last Updated: 2026-09-10

## Store Listing

**Extension Name** [REQUIRED]
LumiShade — Eye Comfort, Night Mode & Privacy

**Short Description** [REQUIRED]
Transform webpage colors for eye comfort, night browsing, warm tints, and instant screen privacy with one-click blur.

**Detailed Description** [REQUIRED]
LumiShade transforms the visual appearance of any webpage to deliver comfortable, low-glare reading and instant screen privacy.

Key features:
- Night Comfort: Carefully balances brightness, contrast, and subtle warmth for low-light evening environments.
- Warm Night: Introduces an amber tint overlay to minimize harsh blue-white glare.
- Dim Mode: Lowers page brightness with an overlay curtain while maintaining deep text clarity.
- Grayscale & Monochrome B&W: Mutes vibrant colors or provides high-contrast black and white reading.
- Custom Sliders: Fine-tune Brightness, Contrast, Grayscale, Warmth, and Dim levels to your preference.
- Instant Privacy Blur: Conceals the entire viewport with an impenetrable blur and dark veil to protect confidential data from shoulder surfers.
- Floating Unblur Button: When Privacy Blur is active, a sharp, isolated floating button allows instant one-click restoration or pressing the Escape key.
- 100% Local & Zero Tracking: Operates entirely on your computer. No analytics, no remote code, and no telemetry.

How to use:
1. Click the LumiShade icon in your Chrome toolbar to open the quick panel.
2. Select any visual mode (Night, Warm, Dim, Grayscale, B&W, or Original).
3. Fine-tune sliders as needed or activate Privacy Blur for screen privacy.
4. Use keyboard shortcuts (Alt+Shift+E for power, Alt+Shift+B for Privacy Blur, Alt+Shift+M to cycle modes).

Privacy & Permissions note:
LumiShade strictly requests the "storage" permission to save your brightness and mode preferences locally on your machine. It never transmits data to any external server.

Notice:
LumiShade is an environmental visual comfort and privacy tool. It does not make ophthalmological or medical claims.

**Category** [REQUIRED]
Accessibility

**Single Purpose** [REQUIRED]
Applies eye-comfort color adjustments and full-screen privacy blur overlays to webpages.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Small Icon [REQUIRED] | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| Toolbar Icon [REQUIRED] | 32×32 PNG | ✅ Ready | `icons/icon-32.png` |
| Favicon [REQUIRED] | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | 🟡 Pending Capture | `promo/screenshot-popup.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | 🟡 Pending Capture | `promo/screenshot-night-mode.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | 🟡 Pending Capture | `promo/screenshot-privacy-veil.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | 🟡 Pending Design | `promo/promo-small.png` |
| Marquee Promo Tile | 1400×560 | 🟡 Pending Design | `promo/promo-marquee.png` |

### Screenshot Notes
- Screenshot 1: Shows the dark-first extension popup with live mode cards and sliders.
- Screenshot 2: Demonstrates a website before and after applying Night Comfort mode.
- Screenshot 3: Displays Privacy Blur mode with the sharp floating unblur pill button.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Required to store user brightness, warmth, mode, and privacy preferences locally across browser restarts. |
| `<all_urls>` | content_scripts.matches | Required to inject non-destructive visual filters and the privacy curtain onto web pages the user navigates to. |

## Privacy & Data Use

### Data Collection
**Does the extension collect user data?** No.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health info | No | No | N/A | No |
| Financial info | No | No | N/A | No |
| Authentication info | No | No | N/A | No |
| Personal communications | No | No | N/A | No |
| Location | No | No | N/A | No |
| Web history | No | No | N/A | No |
| User activity | No | No | N/A | No |
| Website content | No | No | N/A | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy
**Privacy Policy URL**: Hosted locally in `README.md` and accessible in the extension settings page.

## Distribution
**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info
**Publisher Name**: LumiShade Team
**Contact Email**: support@lumishade.local

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-10 | Initial production release with 7 visual modes, custom sliders, isolated Shadow DOM privacy veil, and keyboard shortcuts. | Draft |

## Review Notes

### Known Issues / Limitations
- Content scripts cannot execute on internal `chrome://` URLs or Chrome Web Store pages per Chromium security architecture. LumiShade detects these pages and shows a clear user notification in the popup.
