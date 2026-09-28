/**
 * LumiShade - 20-20-20 Eye Rest Break & Wellness Guide
 * Encourages the ophthalmologist-recommended 20-20-20 rule:
 * Every 20 minutes, look at an object 20 feet away for at least 20 seconds.
 */

(() => {
  if (window.LumiShadeEyeBreak) return;

  const BREAK_HOST_ID = 'lumishade-break-host';

  class EyeBreakController {
    constructor() {
      this.hostElement = null;
      this.shadowRoot = null;
      this.countdownInterval = null;
      this.remainingSeconds = 20;
      this.escapeHandler = (e) => {
        if (e.key === 'Escape') this.dismiss();
      };
    }

    ensureHost() {
      if (!this.hostElement || !document.contains(this.hostElement)) {
        let el = document.getElementById(BREAK_HOST_ID);
        if (!el) {
          el = document.createElement('div');
          el.id = BREAK_HOST_ID;
          el.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; z-index: 2147483645 !important; border: none !important; margin: 0 !important; padding: 0 !important;';
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
     * Show the gentle floating invitation toast in the bottom-left corner.
     */
    showPrompt() {
      const shadow = this.ensureHost();
      window.addEventListener('keydown', this.escapeHandler, true);

      shadow.innerHTML = `
        <style>
          :host {
            all: initial !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          .break-toast {
            position: fixed !important;
            bottom: 24px !important;
            left: 24px !important;
            z-index: 2147483645 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            padding: 16px 20px !important;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)) !important;
            border: 1.5px solid rgba(16, 185, 129, 0.5) !important;
            border-radius: 16px !important;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.25) !important;
            backdrop-filter: blur(12px) !important;
            color: #f8fafc !important;
            max-width: 320px !important;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .break-header {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
          }
          .break-icon {
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            background: rgba(16, 185, 129, 0.2) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            color: #34d399 !important;
            font-size: 16px !important;
          }
          .break-title {
            font-size: 14px !important;
            font-weight: 700 !important;
            color: #f1f5f9 !important;
          }
          .break-desc {
            font-size: 12px !important;
            line-height: 1.45 !important;
            color: #94a3b8 !important;
          }
          .break-actions {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-top: 4px !important;
          }
          .btn-primary {
            flex: 1 !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            background: #10b981 !important;
            color: #ffffff !important;
            border: none !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: background 0.15s ease !important;
          }
          .btn-primary:hover {
            background: #059669 !important;
          }
          .btn-secondary {
            padding: 8px 12px !important;
            border-radius: 8px !important;
            background: rgba(255, 255, 255, 0.1) !important;
            color: #cbd5e1 !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            font-size: 12px !important;
            cursor: pointer !important;
            transition: background 0.15s ease !important;
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.18) !important;
          }
        </style>

        <div class="break-toast" role="alertdialog" aria-label="Eye Rest Reminder">
          <div class="break-header">
            <div class="break-icon">👁️</div>
            <div>
              <div class="break-title">20-20-20 Eye Break</div>
              <div style="font-size: 11px; color: #34d399;">Rest time reached</div>
            </div>
          </div>
          <div class="break-desc">
            Look away from your screen at an object <strong>20 feet (6m) away</strong> to relax your eye muscles.
          </div>
          <div class="break-actions">
            <button type="button" class="btn-primary" id="btn-start-countdown">Take 20s Rest</button>
            <button type="button" class="btn-secondary" id="btn-snooze">Snooze</button>
            <button type="button" class="btn-secondary" id="btn-dismiss">Skip</button>
          </div>
        </div>
      `;

      shadow.getElementById('btn-start-countdown')?.addEventListener('click', () => {
        this.startCountdown(20);
      });
      shadow.getElementById('btn-snooze')?.addEventListener('click', () => {
        this.dismiss();
      });
      shadow.getElementById('btn-dismiss')?.addEventListener('click', () => {
        this.dismiss();
      });
    }

    /**
     * Launch soothing full-screen 20-second resting screen with countdown.
     */
    startCountdown(seconds = 20) {
      const shadow = this.ensureHost();
      this.remainingSeconds = seconds;
      clearInterval(this.countdownInterval);

      shadow.innerHTML = `
        <style>
          :host {
            all: initial !important;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          .rest-curtain {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: radial-gradient(circle at center, rgba(15, 23, 42, 0.94) 0%, rgba(2, 6, 23, 0.98) 100%) !important;
            backdrop-filter: blur(16px) !important;
            z-index: 2147483646 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            color: #f8fafc !important;
            text-align: center !important;
            padding: 20px !important;
            animation: fadeIn 0.3s ease-out !important;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .rest-circle {
            width: 130px !important;
            height: 130px !important;
            border-radius: 50% !important;
            border: 4px solid rgba(16, 185, 129, 0.25) !important;
            border-top-color: #10b981 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 42px !important;
            font-weight: 800 !important;
            color: #34d399 !important;
            margin-bottom: 24px !important;
            box-shadow: 0 0 35px rgba(16, 185, 129, 0.2) !important;
            transition: all 0.3s ease !important;
          }
          .rest-heading {
            font-size: 24px !important;
            font-weight: 700 !important;
            margin-bottom: 8px !important;
            letter-spacing: -0.02em !important;
          }
          .rest-tip {
            font-size: 15px !important;
            color: #94a3b8 !important;
            max-width: 440px !important;
            line-height: 1.5 !important;
            margin-bottom: 30px !important;
          }
          .btn-cancel {
            padding: 9px 22px !important;
            border-radius: 9999px !important;
            background: rgba(255, 255, 255, 0.12) !important;
            color: #cbd5e1 !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            cursor: pointer !important;
            transition: background 0.15s ease !important;
          }
          .btn-cancel:hover {
            background: rgba(255, 255, 255, 0.22) !important;
          }
        </style>

        <div class="rest-curtain">
          <div class="rest-circle" id="countdown-num">${this.remainingSeconds}</div>
          <h2 class="rest-heading">Look 20 feet (6m) away</h2>
          <p class="rest-tip">Blink gently, soften your gaze, and focus on the furthest point in the room or outside your window.</p>
          <button type="button" class="btn-cancel" id="btn-cancel-rest">Resume Now (Esc)</button>
        </div>
      `;

      shadow.getElementById('btn-cancel-rest')?.addEventListener('click', () => {
        this.dismiss();
      });

      this.countdownInterval = setInterval(() => {
        this.remainingSeconds -= 1;
        const numEl = shadow.getElementById('countdown-num');
        if (numEl) numEl.textContent = this.remainingSeconds;

        if (this.remainingSeconds <= 0) {
          clearInterval(this.countdownInterval);
          if (numEl) {
            numEl.textContent = '✓';
            numEl.style.color = '#38bdf8';
            numEl.style.borderColor = '#38bdf8';
          }
          setTimeout(() => {
            this.dismiss();
          }, 1000);
        }
      }, 1000);
    }

    dismiss() {
      clearInterval(this.countdownInterval);
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
  }

  window.LumiShadeEyeBreak = new EyeBreakController();
})();
