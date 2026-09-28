/**
 * LumiShade - Reading Ruler & Focus Guide
 * Renders an isolated Shadow DOM focus slit that follows the mouse cursor,
 * dimming surrounding lines to enhance concentration, reading speed, and eye comfort.
 */

(() => {
  if (window.LumiShadeReadingRuler) return;

  const RULER_HOST_ID = 'lumishade-ruler-host';

  class ReadingRulerController {
    constructor() {
      this.hostElement = null;
      this.shadowRoot = null;
      this.isActive = false;
      this.currentSettings = null;
      this.mouseMoveHandler = this.handleMouseMove.bind(this);
      this.rafPending = false;
      this.lastClientY = window.innerHeight / 2;
    }

    ensureHost() {
      if (!this.hostElement || !document.contains(this.hostElement)) {
        let el = document.getElementById(RULER_HOST_ID);
        if (!el) {
          el = document.createElement('div');
          el.id = RULER_HOST_ID;
          el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483640 !important; border: none !important; margin: 0 !important; padding: 0 !important; pointer-events: none !important;';
          (document.body || document.documentElement).appendChild(el);
        }
        this.hostElement = el;

        if (!this.hostElement.shadowRoot) {
          this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });
        } else {
          this.shadowRoot = this.hostElement.shadowRoot;
        }
      }
      return this.shadowRoot;
    }

    render(settings) {
      const shadow = this.ensureHost();
      const slitHeight = settings.readingRulerHeight || 42;
      const dimOpacity = ((settings.readingRulerDim || 55) / 100).toFixed(2);

      shadow.innerHTML = `
        <style>
          :host {
            all: initial !important;
            pointer-events: none !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          .ruler-container {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            pointer-events: none !important;
            z-index: 2147483640 !important;
            overflow: hidden !important;
          }
          .ruler-curtain-top,
          .ruler-curtain-bottom {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background: rgba(10, 14, 23, ${dimOpacity}) !important;
            pointer-events: none !important;
            backdrop-filter: blur(0.5px) !important;
            will-change: height, top;
          }
          .ruler-curtain-top {
            top: 0 !important;
            height: 40vh;
            border-bottom: 2px solid rgba(245, 158, 11, 0.7) !important;
            box-shadow: 0 4px 14px rgba(245, 158, 11, 0.25) !important;
          }
          .ruler-curtain-bottom {
            top: calc(40vh + ${slitHeight}px);
            bottom: 0 !important;
            border-top: 2px solid rgba(245, 158, 11, 0.7) !important;
            box-shadow: 0 -4px 14px rgba(245, 158, 11, 0.25) !important;
          }
          .ruler-slit {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            height: ${slitHeight}px !important;
            top: 40vh !important;
            background: rgba(254, 243, 199, 0.04) !important;
            pointer-events: none !important;
            will-change: top;
          }
        </style>
        <div class="ruler-container" id="ruler-container">
          <div class="ruler-curtain-top" id="ruler-top"></div>
          <div class="ruler-slit" id="ruler-slit"></div>
          <div class="ruler-curtain-bottom" id="ruler-bottom"></div>
        </div>
      `;

      this.updatePositions();
    }

    handleMouseMove(e) {
      this.lastClientY = e.clientY;
      if (!this.rafPending) {
        this.rafPending = true;
        requestAnimationFrame(() => {
          this.updatePositions();
          this.rafPending = false;
        });
      }
    }

    updatePositions() {
      if (!this.shadowRoot) return;
      const topEl = this.shadowRoot.getElementById('ruler-top');
      const bottomEl = this.shadowRoot.getElementById('ruler-bottom');
      const slitEl = this.shadowRoot.getElementById('ruler-slit');

      if (!topEl || !bottomEl || !slitEl) return;

      const slitHeight = (this.currentSettings && this.currentSettings.readingRulerHeight) || 42;
      const halfSlit = slitHeight / 2;
      const topHeight = Math.max(0, this.lastClientY - halfSlit);
      const bottomTop = this.lastClientY + halfSlit;

      topEl.style.height = `${topHeight}px`;
      slitEl.style.top = `${topHeight}px`;
      slitEl.style.height = `${slitHeight}px`;
      bottomEl.style.top = `${bottomTop}px`;
    }

    enable(settings) {
      this.isActive = true;
      this.currentSettings = settings;
      this.render(settings);
      window.addEventListener('mousemove', this.mouseMoveHandler, { passive: true });
    }

    disable() {
      this.isActive = false;
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = '';
      }
      if (this.hostElement && this.hostElement.parentNode) {
        this.hostElement.parentNode.removeChild(this.hostElement);
        this.hostElement = null;
        this.shadowRoot = null;
      }
    }

    toggle(settings) {
      if (this.isActive) {
        this.disable();
      } else {
        this.enable(settings);
      }
      return this.isActive;
    }
  }

  window.LumiShadeReadingRuler = new ReadingRulerController();
})();
