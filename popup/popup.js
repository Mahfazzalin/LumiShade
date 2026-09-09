/**
 * LumiShade - Popup Controller
 * Manages UI state, live slider updates, presets, privacy blur toggle, and tab synchronization.
 */

(() => {
  // Mode Presets definition
  const MODE_PRESETS = {
    original: { brightness: 100, contrast: 100, grayscale: 0, warmth: 0, dim: 0 },
    night: { brightness: 85, contrast: 92, grayscale: 0, warmth: 35, dim: 15 },
    warm: { brightness: 92, contrast: 100, grayscale: 0, warmth: 60, dim: 0 },
    dim: { brightness: 70, contrast: 95, grayscale: 0, warmth: 0, dim: 35 },
    grayscale: { brightness: 100, contrast: 100, grayscale: 100, warmth: 0, dim: 0 },
    blackwhite: { brightness: 90, contrast: 155, grayscale: 100, warmth: 0, dim: 0 }
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'night',
    brightness: 85,
    contrast: 92,
    grayscale: 0,
    warmth: 35,
    dim: 15,
    privacyActive: false,
    privacyBlurStrength: 28,
    privacyOverlayDarkness: 82,
    floatingButtonPosition: 'bottom-right',
    enableOnStartup: true,
    rememberPerSite: false,
    siteOverrides: {}
  };

  // State
  let currentSettings = { ...DEFAULT_SETTINGS };
  let activeTabId = null;
  let isRestrictedTab = false;
  let rafId = null;

  // DOM Elements
  const powerToggle = document.getElementById('power-toggle');
  const statusDot = document.getElementById('status-dot');
  const statusTitle = document.getElementById('status-title');
  const statusSubtext = document.getElementById('status-subtext');
  const restrictedNotice = document.getElementById('restricted-notice');

  const privacyCard = document.getElementById('privacy-card');
  const btnPrivacyToggle = document.getElementById('btn-privacy-toggle');
  const privacyBtnText = document.getElementById('privacy-btn-text');
  const privacyStatusText = document.getElementById('privacy-status-text');

  const modeCards = document.querySelectorAll('.mode-card');
  const activeModeLabel = document.getElementById('active-mode-label');

  const sliderBrightness = document.getElementById('slider-brightness');
  const sliderContrast = document.getElementById('slider-contrast');
  const sliderGrayscale = document.getElementById('slider-grayscale');
  const sliderWarmth = document.getElementById('slider-warmth');
  const sliderDim = document.getElementById('slider-dim');

  const valBrightness = document.getElementById('val-brightness');
  const valContrast = document.getElementById('val-contrast');
  const valGrayscale = document.getElementById('val-grayscale');
  const valWarmth = document.getElementById('val-warmth');
  const valDim = document.getElementById('val-dim');

  const btnResetSliders = document.getElementById('btn-reset-sliders');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  /**
   * Safe communication with the active tab.
   */
  async function sendMessageToTab(message) {
    if (!activeTabId || isRestrictedTab || typeof chrome === 'undefined' || !chrome.tabs?.sendMessage) return null;
    try {
      return await chrome.tabs.sendMessage(activeTabId, message);
    } catch (err) {
      // Content script may not be loaded or page is restricted
      return null;
    }
  }

  /**
   * Save current settings to chrome.storage.local and background.
   */
  async function persistSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ lumishade_settings: currentSettings });
      } else {
        localStorage.setItem('lumishade_settings', JSON.stringify(currentSettings));
      }
      // Notify background to update extension badge
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: currentSettings }).catch(() => {});
      }
    } catch (err) {
      console.warn('[LumiShade Popup] Storage save failed:', err);
    }
  }

  /**
   * Push settings to active tab with requestAnimationFrame batching.
   */
  function dispatchSettingsToTab() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(async () => {
      await sendMessageToTab({ type: 'APPLY_SETTINGS', settings: currentSettings });
      await persistSettings();
    });
  }

  /**
   * Render UI based on currentSettings.
   */
  function updateUI() {
    // 1. Power State
    powerToggle.checked = currentSettings.enabled;
    if (currentSettings.enabled) {
      statusDot.className = 'status-indicator';
      statusTitle.textContent = 'Comfort mode is ON';
      statusSubtext.textContent = 'Active on current tab';
    } else {
      statusDot.className = 'status-indicator disabled';
      statusTitle.textContent = 'Comfort mode is OFF';
      statusSubtext.textContent = 'Original page view';
    }

    // 2. Privacy Card
    if (currentSettings.privacyActive && currentSettings.enabled) {
      privacyCard.classList.add('active');
      btnPrivacyToggle.setAttribute('aria-pressed', 'true');
      privacyBtnText.textContent = 'Disable';
      privacyStatusText.textContent = 'Page content is blurred';
    } else {
      privacyCard.classList.remove('active');
      btnPrivacyToggle.setAttribute('aria-pressed', 'false');
      privacyBtnText.textContent = 'Enable';
      privacyStatusText.textContent = 'Hide & blur screen instantly';
    }

    // 3. Mode Cards
    modeCards.forEach((card) => {
      const mode = card.dataset.mode;
      const isActive = mode === currentSettings.mode;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    const modeLabels = {
      original: 'Original View',
      night: 'Night Comfort',
      warm: 'Warm Night',
      dim: 'Dim Level',
      grayscale: 'Grayscale',
      blackwhite: 'Black & White',
      custom: 'Custom Fine-Tuning'
    };
    activeModeLabel.textContent = modeLabels[currentSettings.mode] || 'Custom';

    // 4. Sliders values
    sliderBrightness.value = currentSettings.brightness;
    valBrightness.textContent = `${currentSettings.brightness}%`;
    sliderBrightness.setAttribute('aria-valuenow', currentSettings.brightness);

    sliderContrast.value = currentSettings.contrast;
    valContrast.textContent = `${currentSettings.contrast}%`;
    sliderContrast.setAttribute('aria-valuenow', currentSettings.contrast);

    sliderGrayscale.value = currentSettings.grayscale;
    valGrayscale.textContent = `${currentSettings.grayscale}%`;
    sliderGrayscale.setAttribute('aria-valuenow', currentSettings.grayscale);

    sliderWarmth.value = currentSettings.warmth;
    valWarmth.textContent = `${currentSettings.warmth}%`;
    sliderWarmth.setAttribute('aria-valuenow', currentSettings.warmth);

    sliderDim.value = currentSettings.dim;
    valDim.textContent = `${currentSettings.dim}%`;
    sliderDim.setAttribute('aria-valuenow', currentSettings.dim);
  }

  /**
   * Set active mode and apply preset values if applicable.
   */
  function setMode(mode) {
    currentSettings.mode = mode;
    if (MODE_PRESETS[mode]) {
      Object.assign(currentSettings, MODE_PRESETS[mode]);
    }
    updateUI();
    dispatchSettingsToTab();
  }

  /**
   * Reset sliders to the active mode's preset or default values.
   */
  function resetSliders() {
    if (MODE_PRESETS[currentSettings.mode]) {
      Object.assign(currentSettings, MODE_PRESETS[currentSettings.mode]);
    } else {
      // Custom reset to baseline night values
      Object.assign(currentSettings, MODE_PRESETS.night);
      currentSettings.mode = 'night';
    }
    updateUI();
    dispatchSettingsToTab();
  }

  /**
   * Event Listeners setup.
   */
  function attachEventListeners() {
    // Power Toggle
    powerToggle.addEventListener('change', () => {
      currentSettings.enabled = powerToggle.checked;
      updateUI();
      dispatchSettingsToTab();
    });

    // Privacy Toggle Button
    btnPrivacyToggle.addEventListener('click', () => {
      if (!currentSettings.enabled) {
        currentSettings.enabled = true;
      }
      currentSettings.privacyActive = !currentSettings.privacyActive;
      updateUI();
      dispatchSettingsToTab();
    });

    // Mode Cards
    modeCards.forEach((card) => {
      card.addEventListener('click', () => {
        if (!currentSettings.enabled) {
          currentSettings.enabled = true;
        }
        setMode(card.dataset.mode);
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!currentSettings.enabled) {
            currentSettings.enabled = true;
          }
          setMode(card.dataset.mode);
        }
      });
    });

    // Slider change handler helper
    const handleSliderInput = (slider, prop, labelEl) => {
      slider.addEventListener('input', () => {
        const val = parseInt(slider.value, 10);
        currentSettings[prop] = val;
        labelEl.textContent = `${val}%`;
        slider.setAttribute('aria-valuenow', val);

        // Switching sliders automatically switches mode to 'custom' unless already matching
        if (currentSettings.mode !== 'custom') {
          currentSettings.mode = 'custom';
          modeCards.forEach((c) => {
            const isCustom = c.dataset.mode === 'custom';
            c.classList.toggle('active', isCustom);
            c.setAttribute('aria-checked', isCustom ? 'true' : 'false');
          });
          activeModeLabel.textContent = 'Custom Fine-Tuning';
        }

        if (!currentSettings.enabled) {
          currentSettings.enabled = true;
          powerToggle.checked = true;
          statusDot.className = 'status-indicator';
          statusTitle.textContent = 'Comfort mode is ON';
        }

        dispatchSettingsToTab();
      });
    };

    handleSliderInput(sliderBrightness, 'brightness', valBrightness);
    handleSliderInput(sliderContrast, 'contrast', valContrast);
    handleSliderInput(sliderGrayscale, 'grayscale', valGrayscale);
    handleSliderInput(sliderWarmth, 'warmth', valWarmth);
    handleSliderInput(sliderDim, 'dim', valDim);

    // Reset button
    btnResetSliders.addEventListener('click', resetSliders);

    // Settings page launcher
    btnOpenSettings.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        window.open(chrome.runtime.getURL('settings/settings.html'));
      } else {
        window.open('../settings/settings.html', '_blank');
      }
    });

    // Storage change listener (e.g. if floating button unblurs in content script)
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.lumishade_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...changes.lumishade_settings.newValue };
          updateUI();
        }
      });
    }
  }

  /**
   * Initialize popup state.
   */
  async function init() {
    // 1. Check active tab
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          activeTabId = tab.id;
          // Check if restricted page (Chrome internal or Web Store)
          if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.includes('chromewebstore.google.com'))) {
            isRestrictedTab = true;
            restrictedNotice.style.display = 'flex';
          }
        }
      } catch (err) {
        console.warn('[LumiShade Popup] Tab query error:', err);
      }
    }

    // 2. Load stored settings
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const data = await chrome.storage.local.get('lumishade_settings');
        if (data && data.lumishade_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...data.lumishade_settings };
        }
      } catch (err) {
        console.warn('[LumiShade Popup] Storage fetch error:', err);
      }
    } else {
      try {
        const local = localStorage.getItem('lumishade_settings');
        if (local) currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch (e) {}
    }

    // 3. Query active tab state for live sync
    if (activeTabId && !isRestrictedTab && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
      try {
        const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATE' });
        if (response && response.success && response.settings) {
          currentSettings = { ...currentSettings, ...response.settings };
        }
      } catch (err) {
        // Content script might be initializing or page not yet refreshed
      }
    }

    updateUI();
    attachEventListeners();
  }

  // Run init on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
