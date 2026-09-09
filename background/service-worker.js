/**
 * LumiShade - Background Service Worker (Manifest V3)
 * Handles lifecycle, keyboard commands, storage initialization, and badge updates.
 * Ephemeral: strictly avoids storing state in global variables.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'night', // 'original' | 'grayscale' | 'blackwhite' | 'night' | 'warm' | 'dim' | 'custom'
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

const MODE_CYCLE_ORDER = ['original', 'night', 'warm', 'dim', 'grayscale', 'blackwhite', 'custom'];

const MODE_PRESETS = {
  original: { brightness: 100, contrast: 100, grayscale: 0, warmth: 0, dim: 0 },
  grayscale: { brightness: 100, contrast: 100, grayscale: 100, warmth: 0, dim: 0 },
  blackwhite: { brightness: 90, contrast: 150, grayscale: 100, warmth: 0, dim: 0 },
  night: { brightness: 85, contrast: 92, grayscale: 0, warmth: 35, dim: 15 },
  warm: { brightness: 92, contrast: 100, grayscale: 0, warmth: 60, dim: 0 },
  dim: { brightness: 70, contrast: 95, grayscale: 0, warmth: 0, dim: 35 }
};

/**
 * Retrieve merged settings safely from storage.
 */
async function getSettings() {
  try {
    const data = await chrome.storage.local.get('lumishade_settings');
    return { ...DEFAULT_SETTINGS, ...(data.lumishade_settings || {}) };
  } catch (error) {
    console.error('[LumiShade SW] Failed to read storage:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to chrome.storage.local and update the extension badge.
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ lumishade_settings: settings });
    await updateBadge(settings);
  } catch (error) {
    console.error('[LumiShade SW] Failed to save storage:', error);
  }
}

/**
 * Update the extension icon badge based on state.
 */
async function updateBadge(settings) {
  try {
    if (!settings.enabled) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    } else if (settings.privacyActive) {
      await chrome.action.setBadgeText({ text: 'BLUR' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    } else {
      const modeLabels = {
        original: '',
        night: 'NGT',
        warm: 'WRM',
        dim: 'DIM',
        grayscale: 'GRAY',
        blackwhite: 'B&W',
        custom: 'CST'
      };
      const text = modeLabels[settings.mode] || 'ON';
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  } catch (error) {
    console.warn('[LumiShade SW] Badge update failed:', error);
  }
}

/**
 * Safely send a message to a specific tab or active tab.
 */
async function sendToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return null;
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    // Restricted tabs (chrome://, webstore) or unloaded tabs will throw gracefully
    return null;
  }
}

/**
 * Extension install and update lifecycle.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();
  await saveSettings(settings);
  console.log('[LumiShade SW] Installed/Initialized, reason:', details.reason);
});

/**
 * Browser startup lifecycle.
 */
chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (!settings.enableOnStartup) {
    settings.enabled = false;
  }
  // Reset privacyActive on browser restart for safety
  settings.privacyActive = false;
  await saveSettings(settings);
});

/**
 * Keyboard Command Listeners (Commands API).
 */
chrome.commands.onCommand.addListener(async (command) => {
  const settings = await getSettings();

  if (command === 'toggle_extension') {
    settings.enabled = !settings.enabled;
    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  } else if (command === 'toggle_privacy') {
    if (!settings.enabled) {
      settings.enabled = true;
    }
    settings.privacyActive = !settings.privacyActive;
    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  } else if (command === 'cycle_mode') {
    if (!settings.enabled) {
      settings.enabled = true;
    }
    const currentIndex = MODE_CYCLE_ORDER.indexOf(settings.mode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE_ORDER.length;
    const nextMode = MODE_CYCLE_ORDER[nextIndex];
    settings.mode = nextMode;

    if (MODE_PRESETS[nextMode]) {
      Object.assign(settings, MODE_PRESETS[nextMode]);
    }

    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  }
});

/**
 * Runtime Message Passing.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        sendResponse({ success: true, settings });
        break;
      }

      case 'SAVE_SETTINGS': {
        if (message.settings) {
          await saveSettings(message.settings);
          sendResponse({ success: true, settings: message.settings });
        } else {
          sendResponse({ success: false, error: 'No settings provided' });
        }
        break;
      }

      case 'UNBLUR_REQUESTED': {
        const settings = await getSettings();
        settings.privacyActive = false;
        await saveSettings(settings);
        sendResponse({ success: true, settings });
        break;
      }

      case 'SYNC_STATE': {
        const settings = await getSettings();
        await updateBadge(settings);
        sendResponse({ success: true, settings });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();

  return true; // Keep channel open for async response
});
