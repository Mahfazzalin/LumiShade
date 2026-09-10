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

  // Configurable Chrome Web Store Review URL
  const CHROME_WEBSTORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/lumishade';

  // Review System Constants
  const REVIEW_STORAGE_KEY = 'lumishade_review';
  const FEEDBACK_STORAGE_KEY = 'lumishade_local_feedback';
  const COOLDOWN_DAYS = 30;
  const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const MIN_INSTALL_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
  const MIN_USAGE_COUNT = 5;

  const DEFAULT_REVIEW_STATE = {
    installDate: 0,
    usageCount: 0,
    lastPromptDate: 0,
    completed: false,
    dontAskAgain: false
  };

  let reviewState = { ...DEFAULT_REVIEW_STATE };
  let selectedRating = 0;
  const selectedTags = new Set();

  // Review DOM Elements
  const reviewModalBackdrop = document.getElementById('review-modal-backdrop');
  const btnReviewClose = document.getElementById('btn-review-close');
  const starRatingGroup = document.getElementById('star-rating-group');
  const starBtns = document.querySelectorAll('.star-btn');
  const reviewPositivePanel = document.getElementById('review-positive-panel');
  const btnLeaveStoreReview = document.getElementById('btn-leave-store-review');
  const reviewFeedbackPanel = document.getElementById('review-feedback-panel');
  const feedbackTags = document.querySelectorAll('.feedback-tag');
  const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
  const btnSkipFeedback = document.getElementById('btn-skip-feedback');
  const reviewDefaultActions = document.getElementById('review-default-actions');
  const btnReviewLater = document.getElementById('btn-review-later');
  const btnReviewNever = document.getElementById('btn-review-never');

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

    // Attach review dialog listeners
    attachReviewListeners();
  }

  /**
   * Load review metadata from storage.
   */
  async function loadReviewState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const data = await chrome.storage.local.get(REVIEW_STORAGE_KEY);
        if (data && data[REVIEW_STORAGE_KEY]) {
          reviewState = { ...DEFAULT_REVIEW_STATE, ...data[REVIEW_STORAGE_KEY] };
        }
      } else {
        const local = localStorage.getItem(REVIEW_STORAGE_KEY);
        if (local) reviewState = { ...DEFAULT_REVIEW_STATE, ...JSON.parse(local) };
      }
    } catch (e) {
      console.warn('[LumiShade Review] Failed to load review state:', e);
    }

    if (!reviewState.installDate) {
      reviewState.installDate = Date.now();
    }
    reviewState.usageCount = (reviewState.usageCount || 0) + 1;
    await persistReviewState();
  }

  /**
   * Persist review metadata to storage.
   */
  async function persistReviewState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [REVIEW_STORAGE_KEY]: reviewState });
      } else {
        localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewState));
      }
    } catch (e) {
      console.warn('[LumiShade Review] Failed to save review state:', e);
    }
  }

  /**
   * Check if review prompt should be shown.
   */
  function shouldShowReviewPrompt() {
    if (!reviewState) return false;
    if (reviewState.completed || reviewState.dontAskAgain) return false;
    if (currentSettings && currentSettings.privacyActive) return false;
    if (isRestrictedTab) return false;

    const now = Date.now();
    if (now - reviewState.installDate < MIN_INSTALL_AGE_MS) return false;
    if (reviewState.usageCount < MIN_USAGE_COUNT) return false;
    if (reviewState.lastPromptDate && (now - reviewState.lastPromptDate < COOLDOWN_MS)) return false;

    return true;
  }

  /**
   * Show the review dialog.
   */
  function showReviewModal() {
    if (!reviewModalBackdrop) return;
    selectedRating = 0;
    selectedTags.clear();
    updateStarUI(0);
    if (reviewPositivePanel) reviewPositivePanel.style.display = 'none';
    if (reviewFeedbackPanel) reviewFeedbackPanel.style.display = 'none';
    if (reviewDefaultActions) reviewDefaultActions.style.display = 'flex';
    feedbackTags.forEach((t) => t.classList.remove('selected'));
    reviewModalBackdrop.style.display = 'flex';

    const firstStar = starRatingGroup?.querySelector('.star-btn');
    if (firstStar) setTimeout(() => firstStar.focus(), 60);
  }

  /**
   * Hide the review dialog.
   */
  function hideReviewModal() {
    if (reviewModalBackdrop) {
      reviewModalBackdrop.style.display = 'none';
    }
  }

  /**
   * Update visual states of star buttons.
   */
  function updateStarUI(rating, isHover = false) {
    starBtns.forEach((btn) => {
      const r = parseInt(btn.dataset.rating, 10);
      if (isHover) {
        btn.classList.toggle('hovered', r <= rating);
      } else {
        btn.classList.remove('hovered');
        btn.classList.toggle('active', r <= rating);
        btn.setAttribute('aria-checked', r === rating ? 'true' : 'false');
      }
    });
  }

  /**
   * Select a rating and transition to appropriate panel.
   */
  function selectRating(rating) {
    selectedRating = rating;
    updateStarUI(selectedRating, false);
    if (reviewDefaultActions) reviewDefaultActions.style.display = 'none';

    if (selectedRating >= 4) {
      if (reviewFeedbackPanel) reviewFeedbackPanel.style.display = 'none';
      if (reviewPositivePanel) {
        reviewPositivePanel.style.display = 'flex';
        btnLeaveStoreReview?.focus();
      }
    } else {
      if (reviewPositivePanel) reviewPositivePanel.style.display = 'none';
      if (reviewFeedbackPanel) {
        reviewFeedbackPanel.style.display = 'flex';
        btnSubmitFeedback?.focus();
      }
    }
  }

  /**
   * Setup review listeners.
   */
  function attachReviewListeners() {
    if (!reviewModalBackdrop) return;

    // Close button
    btnReviewClose?.addEventListener('click', async () => {
      reviewState.lastPromptDate = Date.now();
      await persistReviewState();
      hideReviewModal();
    });

    // Star buttons
    starBtns.forEach((btn) => {
      const r = parseInt(btn.dataset.rating, 10);

      btn.addEventListener('mouseenter', () => updateStarUI(r, true));

      btn.addEventListener('click', () => selectRating(r));

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectRating(r);
        }
      });
    });

    starRatingGroup?.addEventListener('mouseleave', () => {
      updateStarUI(selectedRating, false);
    });

    // Keyboard navigation within star rating group
    starRatingGroup?.addEventListener('keydown', (e) => {
      let nextRating = selectedRating;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextRating = Math.min(5, (selectedRating || 0) + 1);
        selectRating(nextRating);
        starBtns[nextRating - 1]?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextRating = Math.max(1, (selectedRating || 2) - 1);
        selectRating(nextRating);
        starBtns[nextRating - 1]?.focus();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        selectRating(num);
        starBtns[num - 1]?.focus();
      }
    });

    // 4-5 Stars Action
    btnLeaveStoreReview?.addEventListener('click', async () => {
      const storeUrl = (typeof chrome !== 'undefined' && chrome.runtime?.id)
        ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`
        : CHROME_WEBSTORE_REVIEW_URL;
      window.open(storeUrl, '_blank');
      reviewState.completed = true;
      await persistReviewState();
      hideReviewModal();
    });

    // Feedback tags (1-3 stars)
    feedbackTags.forEach((tag) => {
      tag.addEventListener('click', () => {
        const cat = tag.dataset.tag;
        if (selectedTags.has(cat)) {
          selectedTags.delete(cat);
          tag.classList.remove('selected');
        } else {
          selectedTags.add(cat);
          tag.classList.add('selected');
        }
      });
    });

    // Submit feedback
    btnSubmitFeedback?.addEventListener('click', async () => {
      try {
        const feedbackEntry = {
          timestamp: Date.now(),
          rating: selectedRating,
          categories: Array.from(selectedTags)
        };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const res = await chrome.storage.local.get(FEEDBACK_STORAGE_KEY);
          const feedbackList = (res && res[FEEDBACK_STORAGE_KEY]) || [];
          feedbackList.push(feedbackEntry);
          await chrome.storage.local.set({ [FEEDBACK_STORAGE_KEY]: feedbackList });
        }
      } catch (e) {
        console.warn('[LumiShade Review] Failed to store local feedback:', e);
      }
      reviewState.completed = true;
      await persistReviewState();
      hideReviewModal();
    });

    // Skip feedback
    btnSkipFeedback?.addEventListener('click', async () => {
      reviewState.completed = true;
      await persistReviewState();
      hideReviewModal();
    });

    // Maybe Later (30-day cooldown)
    btnReviewLater?.addEventListener('click', async () => {
      reviewState.lastPromptDate = Date.now();
      await persistReviewState();
      hideReviewModal();
    });

    // Don't Ask Again (permanent opt-out)
    btnReviewNever?.addEventListener('click', async () => {
      reviewState.dontAskAgain = true;
      await persistReviewState();
      hideReviewModal();
    });

    // Escape key listener for dialog dismissal
    window.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape' && reviewModalBackdrop.style.display !== 'none') {
        e.preventDefault();
        e.stopPropagation();
        reviewState.lastPromptDate = Date.now();
        await persistReviewState();
        hideReviewModal();
      }
    }, true);

    // Global testing hook for manual verification
    window.__lumishade_show_review__ = showReviewModal;
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

    // 4. Load review metadata and prompt if eligible
    await loadReviewState();
    if (shouldShowReviewPrompt()) {
      setTimeout(showReviewModal, 350);
    }
  }

  // Run init on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
