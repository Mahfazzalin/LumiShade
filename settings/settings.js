/**
 * LumiShade - Settings & Preferences Controller
 * Handles configuration persistence, defaults restoration, live slider sync, and navigation.
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
    siteOverrides: {}
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let toastTimeout = null;

  // DOM Elements
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

  const selectBtnPos = document.getElementById('select-btn-pos');
  const sliderBlurStrength = document.getElementById('slider-blur-strength');
  const valBlurStrength = document.getElementById('val-blur-strength');
  const sliderVeilDarkness = document.getElementById('slider-veil-darkness');
  const valVeilDarkness = document.getElementById('val-veil-darkness');

  const toggleStartup = document.getElementById('toggle-startup');
  const togglePerSite = document.getElementById('toggle-per-site');
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
  async function persist(notify = true) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ lumishade_settings: currentSettings });
      } else {
        localStorage.setItem('lumishade_settings', JSON.stringify(currentSettings));
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: currentSettings }).catch(() => {});
      }
      if (notify) showToast();
    } catch (err) {
      console.warn('[LumiShade Settings] Save error:', err);
    }
  }

  /**
   * Populate UI inputs from currentSettings.
   */
  function populateUI() {
    selectDefaultMode.value = currentSettings.mode || 'night';

    sliderDefBrightness.value = currentSettings.brightness;
    valDefBrightness.textContent = `${currentSettings.brightness}%`;

    sliderDefContrast.value = currentSettings.contrast;
    valDefContrast.textContent = `${currentSettings.contrast}%`;

    sliderDefWarmth.value = currentSettings.warmth;
    valDefWarmth.textContent = `${currentSettings.warmth}%`;

    sliderDefGrayscale.value = currentSettings.grayscale;
    valDefGrayscale.textContent = `${currentSettings.grayscale}%`;

    sliderDefDim.value = currentSettings.dim;
    valDefDim.textContent = `${currentSettings.dim}%`;

    selectBtnPos.value = currentSettings.floatingButtonPosition || 'bottom-right';

    sliderBlurStrength.value = currentSettings.privacyBlurStrength || 28;
    valBlurStrength.textContent = `${currentSettings.privacyBlurStrength || 28}px`;

    sliderVeilDarkness.value = currentSettings.privacyOverlayDarkness || 82;
    valVeilDarkness.textContent = `${currentSettings.privacyOverlayDarkness || 82}%`;

    toggleStartup.checked = currentSettings.enableOnStartup !== false;
    togglePerSite.checked = Boolean(currentSettings.rememberPerSite);
  }

  /**
   * Attach change listeners to all controls.
   */
  function setupListeners() {
    // Mode
    selectDefaultMode.addEventListener('change', () => {
      currentSettings.mode = selectDefaultMode.value;
      persist();
    });

    // Helper for sliders
    const bindSlider = (slider, prop, labelEl, unit = '%') => {
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

    // Floating Button Position
    selectBtnPos.addEventListener('change', () => {
      currentSettings.floatingButtonPosition = selectBtnPos.value;
      persist();
    });

    // Startup toggle
    toggleStartup.addEventListener('change', () => {
      currentSettings.enableOnStartup = toggleStartup.checked;
      persist();
    });

    // Per-site toggle
    togglePerSite.addEventListener('change', () => {
      currentSettings.rememberPerSite = togglePerSite.checked;
      persist();
    });

    // Restore all defaults
    btnRestoreAll.addEventListener('click', () => {
      if (confirm('Reset all LumiShade settings and preferences to factory defaults?')) {
        currentSettings = { ...DEFAULT_SETTINGS };
        populateUI();
        persist(false);
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
   * Load storage settings on page load.
   */
  async function init() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const data = await chrome.storage.local.get('lumishade_settings');
        if (data && data.lumishade_settings) {
          currentSettings = { ...DEFAULT_SETTINGS, ...data.lumishade_settings };
        }
      } catch (err) {
        console.warn('[LumiShade Settings] Init load error:', err);
      }
    } else {
      try {
        const local = localStorage.getItem('lumishade_settings');
        if (local) currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch (e) {}
    }

    populateUI();
    setupListeners();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
