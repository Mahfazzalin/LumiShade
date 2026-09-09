/**
 * LumiShade - Visual Filter & Color Transformation Engine
 * Applies mathematically balanced CSS filters and non-destructive overlay curtains.
 */

(() => {
  if (window.LumiShadeVisualEngine) return;

  const STYLE_ID = 'lumishade-style-root';
  const WARM_CURTAIN_ID = 'lumishade-warm-curtain';
  const DIM_CURTAIN_ID = 'lumishade-dim-curtain';

  class VisualEngine {
    constructor() {
      this.currentSettings = null;
      this.styleElement = null;
      this.warmCurtain = null;
      this.dimCurtain = null;
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
     * Build the CSS filter string based on settings and mode.
     */
    buildFilterString(settings) {
      if (!settings.enabled || settings.mode === 'original') {
        return 'none';
      }

      const filters = [];

      // 1. Grayscale
      let grayVal = settings.grayscale || 0;
      if (settings.mode === 'grayscale') {
        grayVal = 100;
      } else if (settings.mode === 'blackwhite') {
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
      const filterStr = this.buildFilterString(settings);

      // We apply filter to html root with smooth transitions
      style.textContent = `
        html.lumishade-active {
          filter: ${filterStr} !important;
          transition: filter 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `;
      document.documentElement.classList.add('lumishade-active');

      // Update warm and dim curtains
      this.getOrCreateCurtains();

      // Warm curtain: amber tone overlay
      let warmth = settings.warmth || 0;
      if (settings.mode === 'warm' && warmth < 50) warmth = 55;
      else if (settings.mode === 'night' && warmth < 30) warmth = 35;

      if (this.warmCurtain) {
        if (warmth > 0) {
          // Calculate opacity: 0 to 0.28 max for comfort without obscuring contrast
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
          // Calculate opacity: 0 to 0.70 max
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
      document.documentElement.classList.remove('lumishade-active');
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.textContent = '';
      }
      if (this.warmCurtain) {
        this.warmCurtain.style.display = 'none';
      }
      if (this.dimCurtain) {
        this.dimCurtain.style.display = 'none';
      }
    }
  }

  window.LumiShadeVisualEngine = new VisualEngine();
})();
