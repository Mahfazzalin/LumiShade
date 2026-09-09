/**
 * LumiShade - Main Content Script Coordinator
 * Bridges background service worker, storage, visual engine, and privacy modules.
 */

(() => {
  if (window.__lumishade_initialized__) return;
  window.__lumishade_initialized__ = true;

  const visualEngine = window.LumiShadeVisualEngine;
  const privacyController = window.LumiShadePrivacy;

  let currentEffectiveSettings = null;

  /**
   * Determine effective settings taking site-specific overrides into account.
   */
  function resolveEffectiveSettings(settings) {
    if (!settings) return null;
    const resolved = { ...settings };

    if (settings.rememberPerSite && settings.siteOverrides && location.hostname) {
      const siteConfig = settings.siteOverrides[location.hostname];
      if (siteConfig && siteConfig.mode) {
        resolved.mode = siteConfig.mode;
        if (siteConfig.brightness !== undefined) resolved.brightness = siteConfig.brightness;
        if (siteConfig.contrast !== undefined) resolved.contrast = siteConfig.contrast;
        if (siteConfig.grayscale !== undefined) resolved.grayscale = siteConfig.grayscale;
        if (siteConfig.warmth !== undefined) resolved.warmth = siteConfig.warmth;
        if (siteConfig.dim !== undefined) resolved.dim = siteConfig.dim;
      }
    }

    return resolved;
  }

  /**
   * Apply settings through visual engine and privacy controller.
   */
  function applyToPage(settings) {
    if (!settings) return;
    currentEffectiveSettings = resolveEffectiveSettings(settings);

    // 1. Visual comfort filter
    if (visualEngine) {
      visualEngine.apply(currentEffectiveSettings);
    }

    // 2. Privacy veil
    if (privacyController) {
      if (currentEffectiveSettings.enabled && currentEffectiveSettings.privacyActive) {
        privacyController.enable(currentEffectiveSettings);
      } else {
        privacyController.disable();
      }
    }
  }

  /**
   * Unblur callback - when floating button or Escape key is clicked.
   */
  if (privacyController) {
    privacyController.setOnUnblur(async () => {
      try {
        // Notify service worker so storage and badge are updated
        await chrome.runtime.sendMessage({ type: 'UNBLUR_REQUESTED' });
        if (currentEffectiveSettings) {
          currentEffectiveSettings.privacyActive = false;
        }
      } catch (err) {
        // In case extension was updated or context is dead
        console.warn('[LumiShade Content] Failed to send unblur message:', err);
      }
    });
  }

  /**
   * Initial load: fetch settings from chrome.storage.local.
   */
  async function init() {
    try {
      const result = await chrome.storage.local.get('lumishade_settings');
      if (result && result.lumishade_settings) {
        applyToPage(result.lumishade_settings);
      }
    } catch (err) {
      console.warn('[LumiShade Content] Could not load initial storage:', err);
    }
  }

  /**
   * Message passing listener.
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'APPLY_SETTINGS': {
        if (message.settings) {
          applyToPage(message.settings);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No settings' });
        }
        break;
      }

      case 'ENABLE_PRIVACY': {
        if (currentEffectiveSettings) {
          currentEffectiveSettings.privacyActive = true;
          if (privacyController) {
            privacyController.enable(currentEffectiveSettings);
          }
        }
        sendResponse({ success: true });
        break;
      }

      case 'DISABLE_PRIVACY': {
        if (currentEffectiveSettings) {
          currentEffectiveSettings.privacyActive = false;
        }
        if (privacyController) {
          privacyController.disable();
        }
        sendResponse({ success: true });
        break;
      }

      case 'GET_STATE': {
        sendResponse({
          success: true,
          hostname: location.hostname,
          settings: currentEffectiveSettings,
          privacyActive: privacyController ? privacyController.isActive : false
        });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true; // Keep channel open
  });

  /**
   * Listen for storage changes directly to synchronize instantly across tabs.
   */
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.lumishade_settings) {
      applyToPage(changes.lumishade_settings.newValue);
    }
  });

  /**
   * SPA Navigation & DOM Mutation Defense.
   * If a framework re-renders or replaces the document body, re-mount curtains if needed.
   */
  let debounceTimer = null;
  const domObserver = new MutationObserver(() => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (currentEffectiveSettings && currentEffectiveSettings.enabled) {
        // If curtains were removed by an SPA page swap, re-apply
        if (visualEngine && currentEffectiveSettings.mode !== 'original') {
          visualEngine.apply(currentEffectiveSettings);
        }
        if (privacyController && currentEffectiveSettings.privacyActive && !document.getElementById('lumishade-privacy-host')) {
          privacyController.enable(currentEffectiveSettings);
        }
      }
    }, 250);
  });

  if (document.body) {
    domObserver.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        domObserver.observe(document.body, { childList: true });
      }
    });
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
