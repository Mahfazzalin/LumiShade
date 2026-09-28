/**
 * LumiShade - Main Content Script Coordinator
 * Bridges background service worker, storage, visual engine, reading ruler, eye break, and privacy modules.
 */

(() => {
  if (window.__lumishade_initialized__) return;
  window.__lumishade_initialized__ = true;

  const visualEngine = window.LumiShadeVisualEngine;
  const privacyController = window.LumiShadePrivacy;
  const readingRuler = window.LumiShadeReadingRuler;
  const eyeBreak = window.LumiShadeEyeBreak;

  let currentEffectiveSettings = null;
  let inactivityTimer = null;

  /**
   * Check if the current website is in the user's exclusion list.
   */
  function isCurrentSiteExcluded(settings) {
    if (!settings || !settings.excludedSites || !Array.isArray(settings.excludedSites)) return false;
    const host = (location.hostname || '').toLowerCase();
    if (!host) return false;
    return settings.excludedSites.some(site => {
      const s = site.toLowerCase().trim();
      return host === s || host.endsWith('.' + s);
    });
  }

  /**
   * Determine effective settings taking site-specific overrides and exclusions into account.
   */
  function resolveEffectiveSettings(settings) {
    if (!settings) return null;
    const resolved = { ...settings };

    // Check exclusion
    if (isCurrentSiteExcluded(settings)) {
      resolved.isSiteExcluded = true;
      return resolved;
    }
    resolved.isSiteExcluded = false;

    // Check per-site custom overrides
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

    // System OS Theme Sync
    if (settings.syncWithOSTheme && (!settings.mode || settings.mode === 'original' || settings.mode === 'night')) {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved.mode = isSystemDark ? 'night' : 'original';
    }

    return resolved;
  }

  /**
   * Reset the auto-blur inactivity countdown timer.
   */
  function resetInactivity() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!currentEffectiveSettings || !currentEffectiveSettings.enabled) return;
    const minutes = parseInt(currentEffectiveSettings.autoBlurInactivity, 10) || 0;
    if (minutes > 0 && !currentEffectiveSettings.privacyActive && !currentEffectiveSettings.isSiteExcluded) {
      inactivityTimer = setTimeout(() => {
        if (privacyController && currentEffectiveSettings && !currentEffectiveSettings.privacyActive) {
          currentEffectiveSettings.privacyActive = true;
          privacyController.enable(currentEffectiveSettings);
          chrome.runtime.sendMessage({ type: 'SYNC_STATE' }).catch(() => {});
        }
      }, minutes * 60 * 1000);
    }
  }

  // Attach activity listeners for inactivity auto-blur
  ['mousemove', 'keydown', 'scroll', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, resetInactivity, { passive: true });
  });

  /**
   * Auto-blur on tab switch / window blur if option is enabled.
   */
  window.addEventListener('blur', () => {
    if (currentEffectiveSettings && currentEffectiveSettings.enabled && currentEffectiveSettings.autoBlurOnBlur && !currentEffectiveSettings.privacyActive && !currentEffectiveSettings.isSiteExcluded) {
      currentEffectiveSettings.privacyActive = true;
      if (privacyController) {
        privacyController.enable(currentEffectiveSettings);
      }
      chrome.runtime.sendMessage({ type: 'SYNC_STATE' }).catch(() => {});
    }
  });

  /**
   * Listen to system OS dark mode changes live.
   */
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (currentEffectiveSettings && currentEffectiveSettings.syncWithOSTheme) {
        currentEffectiveSettings.mode = e.matches ? 'night' : 'original';
        if (visualEngine && !currentEffectiveSettings.isSiteExcluded) {
          visualEngine.apply(currentEffectiveSettings);
        }
      }
    });
  }

  /**
   * Apply settings through visual engine, privacy controller, and reading ruler.
   */
  function applyToPage(settings) {
    if (!settings) return;
    currentEffectiveSettings = resolveEffectiveSettings(settings);

    // 1. Visual comfort filter
    if (visualEngine) {
      if (currentEffectiveSettings.isSiteExcluded) {
        visualEngine.clear();
      } else {
        visualEngine.apply(currentEffectiveSettings);
      }
    }

    // 2. Privacy veil
    if (privacyController) {
      if (currentEffectiveSettings.enabled && currentEffectiveSettings.privacyActive) {
        privacyController.enable(currentEffectiveSettings);
      } else {
        privacyController.disable();
      }
    }

    // 3. Reading Ruler
    if (readingRuler) {
      if (currentEffectiveSettings.readingRulerActive) {
        readingRuler.enable(currentEffectiveSettings);
      } else {
        readingRuler.disable();
      }
    }

    resetInactivity();
  }

  /**
   * Unblur callback - when floating button or Escape key is clicked.
   */
  if (privacyController) {
    privacyController.setOnUnblur(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'UNBLUR_REQUESTED' });
        if (currentEffectiveSettings) {
          currentEffectiveSettings.privacyActive = false;
        }
        resetInactivity();
      } catch (err) {
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

      case 'TOGGLE_READING_RULER': {
        if (readingRuler && currentEffectiveSettings) {
          const isActive = readingRuler.toggle(currentEffectiveSettings);
          currentEffectiveSettings.readingRulerActive = isActive;
          sendResponse({ success: true, active: isActive });
        } else {
          sendResponse({ success: false, error: 'Reading ruler unavailable' });
        }
        break;
      }

      case 'TRIGGER_EYE_BREAK': {
        if (eyeBreak) {
          if (message.directCountdown) {
            eyeBreak.startCountdown(20);
          } else {
            eyeBreak.showPrompt();
          }
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Eye break module unavailable' });
        }
        break;
      }

      case 'GET_STATE': {
        sendResponse({
          success: true,
          hostname: location.hostname,
          isSiteExcluded: isCurrentSiteExcluded(currentEffectiveSettings),
          settings: currentEffectiveSettings,
          privacyActive: privacyController ? privacyController.isActive : false,
          readingRulerActive: readingRuler ? readingRuler.isActive : false
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
   */
  let debounceTimer = null;
  const domObserver = new MutationObserver(() => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (currentEffectiveSettings && currentEffectiveSettings.enabled && !currentEffectiveSettings.isSiteExcluded) {
        if (visualEngine && currentEffectiveSettings.mode !== 'original') {
          visualEngine.apply(currentEffectiveSettings);
        }
        if (privacyController && currentEffectiveSettings.privacyActive && !document.getElementById('lumishade-privacy-host')) {
          privacyController.enable(currentEffectiveSettings);
        }
        if (readingRuler && currentEffectiveSettings.readingRulerActive && !document.getElementById('lumishade-ruler-host')) {
          readingRuler.enable(currentEffectiveSettings);
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
