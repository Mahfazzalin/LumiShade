/**
 * LumiShade - Settings & Preferences Controller
 * Handles configuration persistence, defaults restoration, live slider sync,
 * domain whitelist management, backup/restore JSON, and navigation.
 */

(() => {
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
    siteOverrides: {},
    excludedSites: [],

    // Automation & Scheduling
    autoScheduleEnabled: false,
    scheduleStartTime: '20:00',
    scheduleEndTime: '07:00',
    scheduleMode: 'night',
    syncWithOSTheme: false,

    // Eye Wellness & Reading Tools
    eyeRestReminderEnabled: false,
    eyeRestIntervalMinutes: 20,
    readingRulerActive: false,
    readingRulerHeight: 42,
    readingRulerDim: 55,

    // Advanced Privacy
    autoBlurOnBlur: false,
    autoBlurInactivity: 0
  };

  const REVIEW_STORAGE_KEY = 'lumishade_review';
  const CHROME_WEBSTORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/lumishade';

  let currentSettings = { ...DEFAULT_SETTINGS };
  let reviewState = {
    installDate: Date.now(),
    usageCount: 0,
    lastPromptDate: null,
    completed: false,
    dontAskAgain: false
  };
  let toastTimeout = null;

  // DOM Elements - Appearance
  const selectDefaultMode = document.getElementById('select-default-mode');
  const sliderDefBrightness = document.getElementById('slider-def-brightness');
  const valDefBrightness = document.getElementById('val-def-brightness');
  const sliderDefContrast = document.getElementById('slider-def-contrast');
  const valDefContrast = document.getElementById('val-def-contrast');
  const sliderDefWarmth = document.getElementById('slider-def-warmth');
  const valDefWarmth = document.getElementById('val-def-warmth');
  const sliderDefGrayscale = document.getElementById('slider-def-grayscale');
  const valDefGrayscale = document.getElementById('val-def-grayscale');
  const sliderDefDim = document.getElementById('slider-def-dim');
  const valDefDim = document.getElementById('val-def-dim');

  // DOM Elements - Automation & Schedule
  const toggleSchedule = document.getElementById('toggle-schedule');
  const inputScheduleStart = document.getElementById('input-schedule-start');
  const inputScheduleEnd = document.getElementById('input-schedule-end');
  const selectScheduleMode = document.getElementById('select-schedule-mode');
  const toggleOsSync = document.getElementById('toggle-os-sync');

  // DOM Elements - Privacy & Blur
  const selectBtnPos = document.getElementById('select-btn-pos');
  const sliderBlurStrength = document.getElementById('slider-blur-strength');
  const valBlurStrength = document.getElementById('val-blur-strength');
  const sliderVeilDarkness = document.getElementById('slider-veil-darkness');
  const valVeilDarkness = document.getElementById('val-veil-darkness');
  const toggleAutoBlurBlur = document.getElementById('toggle-autoblur-blur');
  const selectInactivity = document.getElementById('select-inactivity');

  // DOM Elements - Eye Wellness & Reading Tools
  const toggleEyeRest = document.getElementById('toggle-eye-rest');
  const selectBreakInterval = document.getElementById('select-break-interval');
  const sliderRulerHeight = document.getElementById('slider-ruler-height');
  const valRulerHeight = document.getElementById('val-ruler-height');
  const sliderRulerDim = document.getElementById('slider-ruler-dim');
  const valRulerDim = document.getElementById('val-ruler-dim');

  // DOM Elements - Behavior & Sites
  const toggleStartup = document.getElementById('toggle-startup');
  const togglePerSite = document.getElementById('toggle-per-site');
  const toggleReviewPrompts = document.getElementById('toggle-review-prompts');
  const inputAddDomain = document.getElementById('input-add-domain');
  const btnAddDomain = document.getElementById('btn-add-domain');
  const excludedTagsList = document.getElementById('excluded-tags-list');

  // DOM Elements - Backup & Restore
  const btnExportJson = document.getElementById('btn-export-json');
  const fileImportJson = document.getElementById('file-import-json');
  const btnTriggerImport = document.getElementById('btn-trigger-import');

  // DOM Elements - Footer & Misc
  const btnRateStore = document.getElementById('btn-rate-store');
  const btnRestoreAll = document.getElementById('btn-restore-all');
  const saveToast = document.getElementById('save-toast');
  const navItems = document.querySelectorAll('.nav-item');

  /**
   * Display floating toast notification.
   */
  function showToast(message = 'Settings saved automatically') {
    if (toastTimeout) clearTimeout(toastTimeout);
    saveToast.textContent = message;
    saveToast.classList.add('visible');
    toastTimeout = setTimeout(() => {
      saveToast.classList.remove('visible');
    }, 2200);
  }

  /**
   * Save settings to storage and notify background worker.
   */
  async function persist(notify = true, updateAlarms = false) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ lumishade_settings: currentSettings });
      } else {
        localStorage.setItem('lumishade_settings', JSON.stringify(currentSettings));
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          settings: currentSettings,
          updateAlarms
        }).catch(() => {});
      }
      if (notify) showToast();
    } catch (err) {
      console.warn('[LumiShade Settings] Save error:', err);
    }
  }

  /**
   * Render the list of excluded domain tags.
   */
  function renderExcludedSites() {
    if (!excludedTagsList) return;
    excludedTagsList.innerHTML = '';

    const list = currentSettings.excludedSites || [];
    if (list.length === 0) {
      excludedTagsList.innerHTML = '<span class="no-exclusions-msg">No domains excluded yet. Add one above to pause filters on specific sites.</span>';
      return;
    }

    list.forEach((domain) => {
      const tag = document.createElement('div');
      tag.className = 'site-tag';
      tag.innerHTML = `
        <span>${domain}</span>
        <button type="button" class="btn-remove-site" title="Remove exclusion" aria-label="Remove ${domain}">&times;</button>
      `;

      tag.querySelector('.btn-remove-site').addEventListener('click', () => {
        currentSettings.excludedSites = currentSettings.excludedSites.filter((d) => d !== domain);
        persist();
        renderExcludedSites();
      });

      excludedTagsList.appendChild(tag);
    });
  }

  /**
   * Populate UI inputs from currentSettings and reviewState.
   */
  function populateUI() {
    // Appearance
    if (selectDefaultMode) selectDefaultMode.value = currentSettings.mode || 'night';

    if (sliderDefBrightness) {
      sliderDefBrightness.value = currentSettings.brightness;
      valDefBrightness.textContent = `${currentSettings.brightness}%`;
    }
    if (sliderDefContrast) {
      sliderDefContrast.value = currentSettings.contrast;
      valDefContrast.textContent = `${currentSettings.contrast}%`;
    }
    if (sliderDefWarmth) {
      sliderDefWarmth.value = currentSettings.warmth;
      valDefWarmth.textContent = `${currentSettings.warmth}%`;
    }
    if (sliderDefGrayscale) {
      sliderDefGrayscale.value = currentSettings.grayscale;
      valDefGrayscale.textContent = `${currentSettings.grayscale}%`;
    }
    if (sliderDefDim) {
      sliderDefDim.value = currentSettings.dim;
      valDefDim.textContent = `${currentSettings.dim}%`;
    }

    // Automation & Schedule
    if (toggleSchedule) toggleSchedule.checked = Boolean(currentSettings.autoScheduleEnabled);
    if (inputScheduleStart) inputScheduleStart.value = currentSettings.scheduleStartTime || '20:00';
    if (inputScheduleEnd) inputScheduleEnd.value = currentSettings.scheduleEndTime || '07:00';
    if (selectScheduleMode) selectScheduleMode.value = currentSettings.scheduleMode || 'night';
    if (toggleOsSync) toggleOsSync.checked = Boolean(currentSettings.syncWithOSTheme);

    // Privacy & Blur
    if (selectBtnPos) selectBtnPos.value = currentSettings.floatingButtonPosition || 'bottom-right';
    if (sliderBlurStrength) {
      sliderBlurStrength.value = currentSettings.privacyBlurStrength || 28;
      valBlurStrength.textContent = `${currentSettings.privacyBlurStrength || 28}px`;
    }
    if (sliderVeilDarkness) {
      sliderVeilDarkness.value = currentSettings.privacyOverlayDarkness || 82;
      valVeilDarkness.textContent = `${currentSettings.privacyOverlayDarkness || 82}%`;
    }
    if (toggleAutoBlurBlur) toggleAutoBlurBlur.checked = Boolean(currentSettings.autoBlurOnBlur);
    if (selectInactivity) selectInactivity.value = String(currentSettings.autoBlurInactivity || 0);

    // Eye Care & Wellness
    if (toggleEyeRest) toggleEyeRest.checked = Boolean(currentSettings.eyeRestReminderEnabled);
    if (selectBreakInterval) selectBreakInterval.value = String(currentSettings.eyeRestIntervalMinutes || 20);
    if (sliderRulerHeight) {
      sliderRulerHeight.value = currentSettings.readingRulerHeight || 42;
      valRulerHeight.textContent = `${currentSettings.readingRulerHeight || 42}px`;
    }
    if (sliderRulerDim) {
      sliderRulerDim.value = currentSettings.readingRulerDim || 55;
      valRulerDim.textContent = `${currentSettings.readingRulerDim || 55}%`;
    }

    // Behavior & Sites
    if (toggleStartup) toggleStartup.checked = currentSettings.enableOnStartup !== false;
    if (togglePerSite) togglePerSite.checked = Boolean(currentSettings.rememberPerSite);
    if (toggleReviewPrompts) toggleReviewPrompts.checked = !reviewState.dontAskAgain;

    renderExcludedSites();
  }

  /**
   * Attach change listeners to all controls.
   */
  function setupListeners() {
    // Mode
    selectDefaultMode?.addEventListener('change', () => {
      currentSettings.mode = selectDefaultMode.value;
      persist();
    });

    // Helper for sliders
    const bindSlider = (slider, prop, labelEl, unit = '%') => {
      if (!slider || !labelEl) return;
      slider.addEventListener('input', () => {
        const val = parseInt(slider.value, 10);
        currentSettings[prop] = val;
        labelEl.textContent = `${val}${unit}`;
      });
      slider.addEventListener('change', () => {
        persist();
      });
    };

    bindSlider(sliderDefBrightness, 'brightness', valDefBrightness, '%');
    bindSlider(sliderDefContrast, 'contrast', valDefContrast, '%');
    bindSlider(sliderDefWarmth, 'warmth', valDefWarmth, '%');
    bindSlider(sliderDefGrayscale, 'grayscale', valDefGrayscale, '%');
    bindSlider(sliderDefDim, 'dim', valDefDim, '%');

    bindSlider(sliderBlurStrength, 'privacyBlurStrength', valBlurStrength, 'px');
    bindSlider(sliderVeilDarkness, 'privacyOverlayDarkness', valVeilDarkness, '%');
    bindSlider(sliderRulerHeight, 'readingRulerHeight', valRulerHeight, 'px');
    bindSlider(sliderRulerDim, 'readingRulerDim', valRulerDim, '%');

    // Automation Controls
    toggleSchedule?.addEventListener('change', () => {
      currentSettings.autoScheduleEnabled = toggleSchedule.checked;
      persist(true, true);
    });

    inputScheduleStart?.addEventListener('change', () => {
      currentSettings.scheduleStartTime = inputScheduleStart.value;
      persist(true, true);
    });

    inputScheduleEnd?.addEventListener('change', () => {
      currentSettings.scheduleEndTime = inputScheduleEnd.value;
      persist(true, true);
    });

    selectScheduleMode?.addEventListener('change', () => {
      currentSettings.scheduleMode = selectScheduleMode.value;
      persist(true, true);
    });

    toggleOsSync?.addEventListener('change', () => {
      currentSettings.syncWithOSTheme = toggleOsSync.checked;
      persist();
    });

    // Privacy Controls
    selectBtnPos?.addEventListener('change', () => {
      currentSettings.floatingButtonPosition = selectBtnPos.value;
      persist();
    });

    toggleAutoBlurBlur?.addEventListener('change', () => {
      currentSettings.autoBlurOnBlur = toggleAutoBlurBlur.checked;
      persist();
    });

    selectInactivity?.addEventListener('change', () => {
      currentSettings.autoBlurInactivity = parseInt(selectInactivity.value, 10) || 0;
      persist();
    });

    // Eye Wellness Controls
    toggleEyeRest?.addEventListener('change', () => {
      currentSettings.eyeRestReminderEnabled = toggleEyeRest.checked;
      persist(true, true);
    });

    selectBreakInterval?.addEventListener('change', () => {
      currentSettings.eyeRestIntervalMinutes = parseInt(selectBreakInterval.value, 10) || 20;
      persist(true, true);
    });

    // Startup & Per-Site Toggles
    toggleStartup?.addEventListener('change', () => {
      currentSettings.enableOnStartup = toggleStartup.checked;
      persist();
    });

    togglePerSite?.addEventListener('change', () => {
      currentSettings.rememberPerSite = togglePerSite.checked;
      persist();
    });

    // Add Domain Exclusions
    const handleAddDomain = () => {
      if (!inputAddDomain) return;
      let raw = (inputAddDomain.value || '').trim().toLowerCase();
      if (!raw) return;

      // Clean protocol and paths if pasted
      raw = raw.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].trim();
      if (!raw) return;

      if (!currentSettings.excludedSites) currentSettings.excludedSites = [];
      if (!currentSettings.excludedSites.includes(raw)) {
        currentSettings.excludedSites.push(raw);
        persist();
        renderExcludedSites();
      }
      inputAddDomain.value = '';
    };

    btnAddDomain?.addEventListener('click', handleAddDomain);
    inputAddDomain?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddDomain();
      }
    });

    // Backup & Restore
    btnExportJson?.addEventListener('click', () => {
      const backupData = {
        app: 'LumiShade',
        version: '1.1.0',
        exportedAt: new Date().toISOString(),
        settings: currentSettings
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumishade-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Settings exported to JSON backup');
    });

    btnTriggerImport?.addEventListener('click', () => {
      fileImportJson?.click();
    });

    fileImportJson?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const incomingSettings = parsed.settings || parsed;
          if (typeof incomingSettings === 'object' && incomingSettings !== null) {
            currentSettings = { ...DEFAULT_SETTINGS, ...incomingSettings };
            persist(true, true);
            populateUI();
            showToast('Settings imported successfully!');
          } else {
            alert('File does not contain valid LumiShade configuration.');
          }
        } catch (err) {
          alert('Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
      fileImportJson.value = '';
    });

    // Review prompts toggle
    if (toggleReviewPrompts) {
      toggleReviewPrompts.addEventListener('change', async () => {
        reviewState.dontAskAgain = !toggleReviewPrompts.checked;
        if (!toggleReviewPrompts.checked) {
          reviewState.lastPromptDate = Date.now();
        }
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ [REVIEW_STORAGE_KEY]: reviewState });
          } else {
            localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviewState));
          }
          showToast(toggleReviewPrompts.checked ? 'Feedback prompts enabled' : 'Feedback prompts disabled');
        } catch (e) {
          console.warn('[LumiShade Settings] Review toggle save error:', e);
        }
      });
    }

    // Direct Web Store rating button
    if (btnRateStore) {
      btnRateStore.addEventListener('click', () => {
        const storeUrl = (typeof chrome !== 'undefined' && chrome.runtime?.id)
          ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`
          : CHROME_WEBSTORE_REVIEW_URL;
        window.open(storeUrl, '_blank');
      });
    }

    // Restore all defaults
    btnRestoreAll?.addEventListener('click', () => {
      if (confirm('Reset all LumiShade settings and preferences to factory defaults?')) {
        currentSettings = { ...DEFAULT_SETTINGS };
        populateUI();
        persist(false, true);
        showToast('All settings reset to defaults');
      }
    });

    // Sidebar navigation smooth scroll and active highlights
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach((n) => n.classList.remove('active'));
        item.classList.add('active');

        const sectionId = item.dataset.section;
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Scroll-spy observer for sidebar links
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navItems.forEach((link) => {
            link.classList.toggle('active', link.dataset.section === id);
          });
        }
      });
    }, { threshold: 0.35 });

    document.querySelectorAll('.settings-section').forEach((sec) => {
      observer.observe(sec);
    });
  }

  /**
   * Initialize settings controller.
   */
  async function init() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(['lumishade_settings', REVIEW_STORAGE_KEY]);
        if (res && res.lumishade_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...res.lumishade_settings };
        }
        if (res && res[REVIEW_STORAGE_KEY]) {
          reviewState = { ...reviewState, ...res[REVIEW_STORAGE_KEY] };
        }
      } catch (e) {
        console.warn('[LumiShade Settings] Storage read error:', e);
      }
    } else {
      try {
        const local = localStorage.getItem('lumishade_settings');
        if (local) currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
        const localRev = localStorage.getItem(REVIEW_STORAGE_KEY);
        if (localRev) reviewState = { ...reviewState, ...JSON.parse(localRev) };
      } catch (e) {}
    }

    populateUI();
    setupListeners();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
