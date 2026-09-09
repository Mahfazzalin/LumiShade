/**
 * LumiShade - Full-Page Privacy Blur & Floating Unblur Controller
 * Uses isolated Shadow DOM to guarantee immunity from host page CSS.
 * Provides viewport-wide blur, accidental click prevention, and a sharp floating unblur button.
 */

(() => {
  if (window.LumiShadePrivacy) return;

  const PRIVACY_HOST_ID = 'lumishade-privacy-host';

  class PrivacyController {
    constructor() {
      this.hostElement = null;
      this.shadowRoot = null;
      this.isActive = false;
      this.onUnblurCallback = null;
      this.escapeHandler = this.handleEscape.bind(this);
    }

    /**
     * Set a callback to execute when the floating button or Escape key is used to unblur.
     */
    setOnUnblur(callback) {
      this.onUnblurCallback = callback;
    }

    /**
     * Mount or retrieve the Shadow DOM host.
     */
    ensureHost() {
      if (!this.hostElement || !document.contains(this.hostElement)) {
        let el = document.getElementById(PRIVACY_HOST_ID);
        if (!el) {
          el = document.createElement('div');
          el.id = PRIVACY_HOST_ID;
          el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483647 !important; border: none !important; margin: 0 !important; padding: 0 !important;';
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

    /**
     * Return position CSS properties based on preference.
     */
    getPositionStyles(position) {
      switch (position) {
        case 'top-left':
          return 'top: 24px; left: 24px;';
        case 'top-right':
          return 'top: 24px; right: 24px;';
        case 'bottom-left':
          return 'bottom: 24px; left: 24px;';
        case 'bottom-right':
        default:
          return 'bottom: 24px; right: 24px;';
      }
    }

    /**
     * Render the Privacy Veil and Floating Button inside Shadow DOM.
     */
    render(settings) {
      const shadow = this.ensureHost();
      const posStyle = this.getPositionStyles(settings.floatingButtonPosition);
      const blurPx = settings.privacyBlurStrength || 28;
      const darknessPercent = (settings.privacyOverlayDarkness || 82) / 100;
      const darknessAlpha = Math.min(0.96, Math.max(0.4, darknessPercent)).toFixed(2);

      shadow.innerHTML = `
        <style>
          :host {
            all: initial !important;
          }

          *, *::before, *::after {
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          }

          /* Full Viewport Privacy Curtain */
          .lumishade-privacy-curtain {
            position: fixed !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background-color: rgba(10, 14, 22, ${darknessAlpha}) !important;
            backdrop-filter: blur(${blurPx}px) saturate(70%) !important;
            -webkit-backdrop-filter: blur(${blurPx}px) saturate(70%) !important;
            z-index: 2147483646 !important;
            pointer-events: all !important;
            cursor: default !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            opacity: 1 !important;
            transition: opacity 0.2s ease-out !important;
          }

          /* Floating Unblur Pill Button (remains 100% sharp and unblurred) */
          .lumishade-unblur-btn {
            position: fixed !important;
            ${posStyle}
            z-index: 2147483647 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 10px !important;
            padding: 10px 18px !important;
            border-radius: 9999px !important;
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%) !important;
            color: #f8fafc !important;
            border: 1.5px solid rgba(129, 140, 248, 0.7) !important;
            box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.6), 0 0 18px rgba(99, 102, 241, 0.4) !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            letter-spacing: 0.02em !important;
            cursor: pointer !important;
            pointer-events: all !important;
            filter: none !important;
            transform: translateZ(0) !important;
            outline: none !important;
            user-select: none !important;
            transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), 
                        box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1), 
                        border-color 0.18s ease !important;
          }

          .lumishade-unblur-btn:hover {
            background: linear-gradient(135deg, #2e1065 0%, #4338ca 100%) !important;
            border-color: #a5b4fc !important;
            transform: scale(1.05) translateZ(0) !important;
            box-shadow: 0 14px 28px -2px rgba(0, 0, 0, 0.75), 0 0 24px rgba(129, 140, 248, 0.6) !important;
          }

          .lumishade-unblur-btn:active {
            transform: scale(0.97) translateZ(0) !important;
          }

          .lumishade-unblur-btn:focus-visible {
            outline: 3px solid #38bdf8 !important;
            outline-offset: 3px !important;
          }

          .lumishade-btn-icon {
            width: 18px !important;
            height: 18px !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #fbbf24 !important;
          }

          .lumishade-btn-icon svg {
            width: 100% !important;
            height: 100% !important;
            stroke: currentColor !important;
            fill: none !important;
          }

          .lumishade-btn-text {
            color: #ffffff !important;
            white-space: nowrap !important;
            font-size: 13px !important;
          }

          .lumishade-key-badge {
            display: inline-block !important;
            font-size: 10px !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
            background: rgba(255, 255, 255, 0.15) !important;
            color: #cbd5e1 !important;
            font-weight: 500 !important;
            margin-left: 2px !important;
          }

          @media (prefers-reduced-motion: reduce) {
            .lumishade-privacy-curtain,
            .lumishade-unblur-btn {
              transition: none !important;
              animation: none !important;
            }
          }
        </style>

        <div class="lumishade-privacy-curtain" aria-hidden="true"></div>

        <button type="button" class="lumishade-unblur-btn" id="lumishade-unblur-trigger"
                role="button" aria-label="Restore webpage view. Escape key also restores view." tabindex="0">
          <span class="lumishade-btn-icon">
            <!-- Eye / Unlock SVG icon -->
            <svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </span>
          <span class="lumishade-btn-text">Restore Page</span>
          <span class="lumishade-key-badge" title="Shortcut to restore">Esc</span>
        </button>
      `;

      // Attach unblur event to the button
      const btn = shadow.getElementById('lumishade-unblur-trigger');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.triggerUnblur();
        });

        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this.triggerUnblur();
          }
        });

        // Focus the unblur button for immediate keyboard accessibility
        setTimeout(() => btn.focus(), 50);
      }
    }

    /**
     * Escape key listener.
     */
    handleEscape(e) {
      if (e.key === 'Escape' && this.isActive) {
        e.preventDefault();
        e.stopPropagation();
        this.triggerUnblur();
      }
    }

    /**
     * Trigger unblur flow and notify subscribers.
     */
    triggerUnblur() {
      this.disable();
      if (typeof this.onUnblurCallback === 'function') {
        this.onUnblurCallback();
      }
    }

    /**
     * Enable Privacy Blur on the active page.
     */
    enable(settings) {
      this.isActive = true;
      this.render(settings);
      window.addEventListener('keydown', this.escapeHandler, true);
    }

    /**
     * Disable Privacy Blur and remove the veil.
     */
    disable() {
      this.isActive = false;
      window.removeEventListener('keydown', this.escapeHandler, true);
      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = '';
      }
      if (this.hostElement && this.hostElement.parentNode) {
        this.hostElement.parentNode.removeChild(this.hostElement);
        this.hostElement = null;
        this.shadowRoot = null;
      }
    }

    /**
     * Update settings while active without tearing down DOM.
     */
    update(settings) {
      if (this.isActive) {
        this.render(settings);
      }
    }
  }

  window.LumiShadePrivacy = new PrivacyController();
})();
