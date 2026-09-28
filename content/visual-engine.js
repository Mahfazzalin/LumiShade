/**
 * LumiShade - Visual Filter & Color Transformation Engine
 * Applies mathematically balanced CSS filters, intelligent dark/light theme detection,
 * non-destructive media preservation, and isolated overlay curtains.
 */

(() => {
  if (window.LumiShadeVisualEngine) return;

  const STYLE_ID = 'lumishade-style-root';
  const WARM_CURTAIN_ID = 'lumishade-warm-curtain';
  const DIM_CURTAIN_ID = 'lumishade-dim-curtain';

  /**
   * Parse an RGB, RGBA, HSL, or Hex color string into { r, g, b, a }.
   * Returns null if completely transparent or unparseable.
   */
  function parseColorString(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const str = colorStr.trim().toLowerCase();
    if (str === 'transparent' || str === 'inherit' || str === 'initial') return null;

    // 1. rgba(...) or rgb(...)
    const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgbMatch) {
      const a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
      if (a < 0.1) return null;
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10),
        a
      };
    }

    // 2. Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
        if (a < 0.1) return null;
        return { r, g, b, a };
      }
    }

    return null;
  }

  /**
   * Calculate ITU-R BT.709 relative perceived luminance.
   * Values range from 0 (pure black) to 255 (pure white).
   */
  function getPerceivedLuminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Return effective luminance, blending semi-transparent colors against a white canvas.
   */
  function getEffectiveLuminance(color) {
    if (!color) return 255;
    const r = color.r * color.a + 255 * (1 - color.a);
    const g = color.g * color.a + 255 * (1 - color.a);
    const b = color.b * color.a + 255 * (1 - color.a);
    return getPerceivedLuminance(r, g, b);
  }

  /**
   * Walk up the DOM tree from an element until a non-transparent background color is found.
   */
  function getElementBackgroundColor(el) {
    let curr = el;
    while (curr && curr !== document && curr.nodeType === 1) {
      try {
        const style = window.getComputedStyle(curr);
        const bg = style.backgroundColor;
        const parsed = parseColorString(bg);
        if (parsed) return parsed;
      } catch (e) {
        break;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  class VisualEngine {
    constructor() {
      this.currentSettings = null;
      this.styleElement = null;
      this.warmCurtain = null;
      this.dimCurtain = null;
      this.themeObserver = null;
      this.themeDebounce = null;

      // Re-evaluate smart dark on page lifecycle events
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.recheckSmartDark());
      }
      window.addEventListener('load', () => this.recheckSmartDark());
    }

    /**
     * Ensure the dynamic <style> tag exists in the document.
     */
    getOrCreateStyleElement() {
      if (!this.styleElement || !document.contains(this.styleElement)) {
        let el = document.getElementById(STYLE_ID);
        if (!el) {
          el = document.createElement('style');
          el.id = STYLE_ID;
          el.type = 'text/css';
          (document.head || document.documentElement).appendChild(el);
        }
        this.styleElement = el;
      }
      return this.styleElement;
    }

    /**
     * Ensure overlay curtain elements (Warmth, Dim) are mounted in the DOM.
     */
    getOrCreateCurtains() {
      // Warm curtain
      if (!this.warmCurtain || !document.contains(this.warmCurtain)) {
        let el = document.getElementById(WARM_CURTAIN_ID);
        if (!el) {
          el = document.createElement('div');
          el.id = WARM_CURTAIN_ID;
          el.className = 'lumishade-curtain';
          el.setAttribute('aria-hidden', 'true');
          (document.body || document.documentElement).appendChild(el);
        }
        this.warmCurtain = el;
      }

      // Dim curtain
      if (!this.dimCurtain || !document.contains(this.dimCurtain)) {
        let el = document.getElementById(DIM_CURTAIN_ID);
        if (!el) {
          el = document.createElement('div');
          el.id = DIM_CURTAIN_ID;
          el.className = 'lumishade-curtain';
          el.setAttribute('aria-hidden', 'true');
          (document.body || document.documentElement).appendChild(el);
        }
        this.dimCurtain = el;
      }
    }

    /**
     * Intelligently inspect the current page to detect if it is ALREADY DARK.
     * Prevents double-inverting native dark modes (YouTube, GitHub, ChatGPT, Reddit, Twitter, etc.).
     * Returns true if already dark (should NOT invert), or false if white/light (should invert).
     */
    isPageAlreadyDark() {
      try {
        // 1. Explicit CSS color-scheme
        const htmlStyle = window.getComputedStyle(document.documentElement);
        if (htmlStyle && htmlStyle.colorScheme && htmlStyle.colorScheme.includes('dark')) {
          return true;
        }
        if (document.body) {
          const bodyStyle = window.getComputedStyle(document.body);
          if (bodyStyle && bodyStyle.colorScheme && bodyStyle.colorScheme.includes('dark')) {
            return true;
          }
        }
      } catch (e) {}

      // 2. Meta color-scheme tag (<meta name="color-scheme" content="dark">)
      const metaScheme = document.querySelector('meta[name="color-scheme"]');
      if (metaScheme) {
        const content = (metaScheme.getAttribute('content') || '').toLowerCase();
        if (content === 'dark' || content.startsWith('dark ') || content.endsWith(' dark')) {
          return true;
        }
      }

      // 3. Explicit dark theme attributes & class names on root elements
      const rootEls = [document.documentElement, document.body].filter(Boolean);
      const darkAttrNames = ['data-theme', 'data-color-mode', 'data-bs-theme', 'data-mode', 'theme', 'dark'];
      for (const el of rootEls) {
        for (const attr of darkAttrNames) {
          const val = (el.getAttribute(attr) || '').toLowerCase();
          if (val && (val === 'dark' || val.includes('dark') || val.includes('night') || val === 'black' || val === 'dim' || val === 'true')) {
            if (attr === 'dark' && val !== 'true') continue;
            return true;
          }
        }

        // Class list inspection (excluding lumishade's own classes)
        const classList = Array.from(el.classList).filter(c => !c.startsWith('lumishade'));
        for (const cls of classList) {
          const lower = cls.toLowerCase();
          if (
            lower === 'dark' ||
            lower === 'dark-mode' ||
            lower === 'theme-dark' ||
            lower === 'dark-theme' ||
            lower === 'vscode-dark' ||
            lower.endsWith('-dark') ||
            lower.startsWith('dark-') ||
            lower === 'tw-dark'
          ) {
            return true;
          }
        }
      }

      // 4. Background color evaluation of document.body and document.documentElement
      let rootBg = null;
      if (document.body) {
        rootBg = parseColorString(window.getComputedStyle(document.body).backgroundColor);
      }
      if (!rootBg) {
        rootBg = parseColorString(window.getComputedStyle(document.documentElement).backgroundColor);
      }

      // Check common primary layout wrappers if root is transparent
      if (!rootBg) {
        const wrapper = document.querySelector('#root, #__next, #app, main, [role="main"], #main-content, #content, .app, #layout');
        if (wrapper) {
          rootBg = getElementBackgroundColor(wrapper);
        }
      }

      if (rootBg) {
        const lum = getEffectiveLuminance(rootBg);
        // Luminance < 135 indicates dark/black background; >= 135 indicates glare-producing white/light surface
        return lum < 135;
      }

      // 5. Viewport point sampling (fallback for full-bleed canvases, absolute wrappers, or complex layouts)
      if (typeof window.innerWidth === 'number' && typeof window.innerHeight === 'number' && document.elementFromPoint) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const sampleCoords = [
          [w * 0.5, h * 0.5],
          [w * 0.5, Math.min(120, h * 0.15)],
          [w * 0.5, Math.max(h - 120, h * 0.85)],
          [Math.min(120, w * 0.15), h * 0.5],
          [Math.max(w - 120, w * 0.85), h * 0.5]
        ];

        let totalLum = 0;
        let sampleCount = 0;

        for (const [x, y] of sampleCoords) {
          try {
            const el = document.elementFromPoint(x, y);
            if (el) {
              const bg = getElementBackgroundColor(el);
              if (bg) {
                totalLum += getEffectiveLuminance(bg);
                sampleCount++;
              }
            }
          } catch (err) {}
        }

        if (sampleCount > 0) {
          const avgLum = totalLum / sampleCount;
          return avgLum < 135;
        }
      }

      // Default browser canvas is white (255)
      return false;
    }

    /**
     * Setup a live observer to detect on-the-fly theme toggling (e.g. YouTube/GitHub dark toggle or SPA route change).
     */
    setupThemeObserver() {
      if (this.themeObserver) return;
      this.themeObserver = new MutationObserver(() => {
        if (this.themeDebounce) clearTimeout(this.themeDebounce);
        this.themeDebounce = setTimeout(() => {
          this.recheckSmartDark();
        }, 120);
      });

      const targets = [document.documentElement, document.body].filter(Boolean);
      targets.forEach((target) => {
        this.themeObserver.observe(target, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'data-bs-theme', 'data-mode', 'theme', 'dark']
        });
      });

      if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body && this.themeObserver) {
            this.themeObserver.observe(document.body, {
              attributes: true,
              attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode', 'data-bs-theme', 'data-mode', 'theme', 'dark']
            });
          }
          this.recheckSmartDark();
        });
      }
    }

    /**
     * Re-check and smoothly adapt smart dark when the underlying page theme toggles dynamically.
     */
    recheckSmartDark() {
      if (!this.currentSettings || !this.currentSettings.enabled || this.currentSettings.mode !== 'smartdark') {
        return;
      }
      const isCurrentlyDark = this.isPageAlreadyDark();
      const wasInverted = document.documentElement.classList.contains('lumishade-smartdark-inverted');
      const wasNative = document.documentElement.classList.contains('lumishade-smartdark-native');

      if ((isCurrentlyDark && !wasNative) || (!isCurrentlyDark && !wasInverted)) {
        this.apply(this.currentSettings);
      }
    }

    /**
     * Build the CSS filter string based on settings and standard visual modes.
     */
    buildFilterString(settings) {
      if (!settings.enabled || settings.mode === 'original') {
        return 'none';
      }

      const filters = [];

      // 1. Grayscale
      let grayVal = settings.grayscale || 0;
      if (settings.mode === 'grayscale' || settings.mode === 'blackwhite') {
        grayVal = 100;
      }
      if (grayVal > 0) {
        filters.push(`grayscale(${Math.min(100, Math.max(0, grayVal))}%)`);
      }

      // 2. Brightness
      let brightVal = typeof settings.brightness === 'number' ? settings.brightness : 100;
      if (settings.mode === 'blackwhite') {
        brightVal = 90;
      } else if (settings.mode === 'night') {
        brightVal = Math.min(brightVal, 88);
      } else if (settings.mode === 'dim') {
        brightVal = Math.min(brightVal, 75);
      }
      if (brightVal !== 100) {
        filters.push(`brightness(${(brightVal / 100).toFixed(2)})`);
      }

      // 3. Contrast
      let contrastVal = typeof settings.contrast === 'number' ? settings.contrast : 100;
      if (settings.mode === 'blackwhite') {
        contrastVal = 155; // Strong monochrome punch
      } else if (settings.mode === 'night') {
        contrastVal = Math.min(contrastVal, 95);
      }
      if (contrastVal !== 100) {
        filters.push(`contrast(${(contrastVal / 100).toFixed(2)})`);
      }

      // 4. Warmth filter accents (subtle sepia + soft hue adjustment)
      let warmVal = settings.warmth || 0;
      if (settings.mode === 'warm' && warmVal < 50) {
        warmVal = 55;
      } else if (settings.mode === 'night' && warmVal < 30) {
        warmVal = 35;
      }
      if (warmVal > 0) {
        const sepiaFactor = (warmVal * 0.4).toFixed(1);
        const hueRotate = -(warmVal * 0.12).toFixed(1);
        filters.push(`sepia(${sepiaFactor}%) hue-rotate(${hueRotate}deg)`);
      }

      return filters.length > 0 ? filters.join(' ') : 'none';
    }

    /**
     * Apply the visual settings to the current page.
     */
    apply(settings) {
      this.currentSettings = settings;

      if (!settings.enabled || settings.mode === 'original') {
        this.clear();
        return;
      }

      const style = this.getOrCreateStyleElement();

      // =========================================================================
      // SMART DARK MODE
      // Intelligently darkens glare-heavy white pages while leaving native dark
      // themes intact without ugly inverted whites!
      // =========================================================================
      if (settings.mode === 'smartdark') {
        this.setupThemeObserver();
        const isAlreadyDark = this.isPageAlreadyDark();

        const brightVal = typeof settings.brightness === 'number' ? settings.brightness : 95;
        const contrastVal = typeof settings.contrast === 'number' ? settings.contrast : 90;
        const brightFactor = (brightVal / 100).toFixed(2);
        const contrastFactor = (contrastVal / 100).toFixed(2);

        if (isAlreadyDark) {
          // -------------------------------------------------------------
          // NATIVE DARK PAGE: Keep native dark theme untouched!
          // Soften harsh contrast slightly for maximum eye comfort without inverting.
          // -------------------------------------------------------------
          document.documentElement.classList.remove('lumishade-smartdark-inverted');
          document.documentElement.classList.add('lumishade-active', 'lumishade-smartdark', 'lumishade-smartdark-native');

          const nativeFilters = [];
          if (brightVal !== 100) nativeFilters.push(`brightness(${brightFactor})`);
          if (contrastVal !== 100) nativeFilters.push(`contrast(${contrastFactor})`);
          if (settings.warmth && settings.warmth > 0) {
            const sepiaFactor = (settings.warmth * 0.25).toFixed(1);
            nativeFilters.push(`sepia(${sepiaFactor}%)`);
          }

          const nativeFilterStr = nativeFilters.length > 0 ? nativeFilters.join(' ') : 'none';

          style.textContent = `
            html.lumishade-active.lumishade-smartdark-native {
              filter: ${nativeFilterStr} !important;
              transition: filter 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
          `;
        } else {
          // -------------------------------------------------------------
          // BRIGHT / WHITE PAGE: Convert harmful glare to soothing dark!
          // -------------------------------------------------------------
          document.documentElement.classList.remove('lumishade-smartdark-native');
          document.documentElement.classList.add('lumishade-active', 'lumishade-smartdark', 'lumishade-smartdark-inverted');

          const invertFilters = [
            'invert(90%) hue-rotate(180deg)',
            `brightness(${brightFactor})`,
            `contrast(${contrastFactor})`
          ];
          if (settings.warmth && settings.warmth > 0) {
            const sepiaFactor = (settings.warmth * 0.2).toFixed(1);
            invertFilters.push(`sepia(${sepiaFactor}%)`);
          }
          const invertFilterStr = invertFilters.join(' ');

          style.textContent = `
            html.lumishade-active.lumishade-smartdark-inverted {
              filter: ${invertFilterStr} !important;
              background-color: #ffffff !important;
              transition: filter 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            /* Re-invert media so images, videos, and graphics look completely natural */
            html.lumishade-active.lumishade-smartdark-inverted img,
            html.lumishade-active.lumishade-smartdark-inverted video,
            html.lumishade-active.lumishade-smartdark-inverted canvas,
            html.lumishade-active.lumishade-smartdark-inverted picture,
            html.lumishade-active.lumishade-smartdark-inverted [data-lumishade-preserve],
            html.lumishade-active.lumishade-smartdark-inverted [style*="background-image"]:not(body):not(html) {
              filter: invert(100%) hue-rotate(180deg) !important;
            }
            /* Keep LumiShade extension overlays sharp and un-inverted */
            html.lumishade-active.lumishade-smartdark-inverted #lumishade-warm-curtain,
            html.lumishade-active.lumishade-smartdark-inverted #lumishade-dim-curtain,
            html.lumishade-active.lumishade-smartdark-inverted #lumishade-privacy-host,
            html.lumishade-active.lumishade-smartdark-inverted #lumishade-ruler-host,
            html.lumishade-active.lumishade-smartdark-inverted #lumishade-break-host {
              filter: invert(100%) hue-rotate(180deg) !important;
            }
          `;
        }

        // In Smart Dark mode, overlay curtains are disabled so text remains razor sharp
        this.getOrCreateCurtains();
        if (this.warmCurtain) this.warmCurtain.style.display = 'none';
        if (this.dimCurtain) this.dimCurtain.style.display = 'none';
        return;
      }

      // =========================================================================
      // STANDARD VISUAL MODES (Night, Warm, Dim, Grayscale, Black & White, Custom)
      // =========================================================================
      if (this.themeObserver) {
        this.themeObserver.disconnect();
        this.themeObserver = null;
      }

      document.documentElement.classList.remove('lumishade-smartdark', 'lumishade-smartdark-inverted', 'lumishade-smartdark-native');
      document.documentElement.classList.add('lumishade-active');

      const filterStr = this.buildFilterString(settings);
      style.textContent = `
        html.lumishade-active {
          filter: ${filterStr} !important;
          transition: filter 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `;

      // Update warm and dim curtains
      this.getOrCreateCurtains();

      // Warm curtain: amber tone overlay
      let warmth = settings.warmth || 0;
      if (settings.mode === 'warm' && warmth < 50) warmth = 55;
      else if (settings.mode === 'night' && warmth < 30) warmth = 35;

      if (this.warmCurtain) {
        if (warmth > 0) {
          const warmAlpha = ((warmth / 100) * 0.26).toFixed(3);
          this.warmCurtain.style.backgroundColor = `rgba(245, 158, 11, ${warmAlpha})`;
          this.warmCurtain.style.display = 'block';
        } else {
          this.warmCurtain.style.display = 'none';
        }
      }

      // Dim curtain: neutral dark overlay
      let dim = settings.dim || 0;
      if (settings.mode === 'dim' && dim < 30) dim = 35;
      else if (settings.mode === 'night' && dim < 15) dim = 15;

      if (this.dimCurtain) {
        if (dim > 0) {
          const dimAlpha = ((dim / 100) * 0.68).toFixed(3);
          this.dimCurtain.style.backgroundColor = `rgba(0, 0, 0, ${dimAlpha})`;
          this.dimCurtain.style.display = 'block';
        } else {
          this.dimCurtain.style.display = 'none';
        }
      }
    }

    /**
     * Clear all filters and hide curtains.
     */
    clear() {
      document.documentElement.classList.remove(
        'lumishade-active',
        'lumishade-smartdark',
        'lumishade-smartdark-inverted',
        'lumishade-smartdark-native'
      );
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.textContent = '';
      }
      if (this.warmCurtain) {
        this.warmCurtain.style.display = 'none';
      }
      if (this.dimCurtain) {
        this.dimCurtain.style.display = 'none';
      }
      if (this.themeObserver) {
        this.themeObserver.disconnect();
        this.themeObserver = null;
      }
    }
  }

  window.LumiShadeVisualEngine = new VisualEngine();
})();
