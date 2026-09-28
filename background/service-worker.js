/**
 * LumiShade - Background Service Worker (Manifest V3)
 * Handles lifecycle, keyboard commands, storage initialization, alarms, context menus, and badge updates.
 * Ephemeral: strictly avoids storing state in global variables.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'night', // 'original' | 'night' | 'warm' | 'dim' | 'smartdark' | 'grayscale' | 'blackwhite' | 'custom'
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

const MODE_CYCLE_ORDER = ['original', 'night', 'warm', 'dim', 'smartdark', 'grayscale', 'blackwhite', 'custom'];

const MODE_PRESETS = {
  original: { brightness: 100, contrast: 100, grayscale: 0, warmth: 0, dim: 0 },
  night: { brightness: 85, contrast: 92, grayscale: 0, warmth: 35, dim: 15 },
  warm: { brightness: 92, contrast: 100, grayscale: 0, warmth: 60, dim: 0 },
  dim: { brightness: 70, contrast: 95, grayscale: 0, warmth: 0, dim: 35 },
  smartdark: { brightness: 95, contrast: 90, grayscale: 0, warmth: 15, dim: 0 },
  grayscale: { brightness: 100, contrast: 100, grayscale: 100, warmth: 0, dim: 0 },
  blackwhite: { brightness: 90, contrast: 150, grayscale: 100, warmth: 0, dim: 0 }
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
        smartdark: 'DARK',
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
    return null;
  }
}

/**
 * Setup alarms for auto-schedule and eye rest break reminders.
 */
async function setupAlarms(settings) {
  try {
    await chrome.alarms.clearAll();

    // 1. Schedule check alarm (runs once a minute)
    chrome.alarms.create('lumishade_schedule_alarm', { periodInMinutes: 1 });

    // 2. Eye rest alarm (if enabled)
    if (settings.eyeRestReminderEnabled) {
      const interval = Math.max(5, settings.eyeRestIntervalMinutes || 20);
      chrome.alarms.create('lumishade_eye_rest_alarm', { periodInMinutes: interval });
    }
  } catch (err) {
    console.warn('[LumiShade SW] Failed to setup alarms:', err);
  }
}

/**
 * Check if the current time falls inside the user-defined schedule.
 */
function isCurrentTimeInSchedule(startTimeStr, endTimeStr) {
  if (!startTimeStr || !endTimeStr) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    // Normal daytime interval, e.g. 09:00 to 17:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight interval, e.g. 20:00 to 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Configure Context Menus.
 */
function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lumishade_parent',
      title: 'LumiShade Eye Care',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_toggle_power',
      parentId: 'lumishade_parent',
      title: 'Toggle Comfort Mode',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_toggle_privacy',
      parentId: 'lumishade_parent',
      title: 'Toggle Privacy Blur',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_toggle_ruler',
      parentId: 'lumishade_parent',
      title: 'Toggle Reading Ruler',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_toggle_smartdark',
      parentId: 'lumishade_parent',
      title: 'Smart Dark Mode',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_separator',
      parentId: 'lumishade_parent',
      type: 'separator',
      contexts: ['page', 'selection', 'link']
    });
    chrome.contextMenus.create({
      id: 'lumishade_toggle_site_exclude',
      parentId: 'lumishade_parent',
      title: 'Exclude / Re-enable on this Site',
      contexts: ['page', 'selection', 'link']
    });
  });
}

/**
 * Handle Context Menu Clicks.
 */
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const settings = await getSettings();

    switch (info.menuItemId) {
      case 'lumishade_toggle_power':
        settings.enabled = !settings.enabled;
        await saveSettings(settings);
        await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        break;

      case 'lumishade_toggle_privacy':
        settings.privacyActive = !settings.privacyActive;
        await saveSettings(settings);
        await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        break;

      case 'lumishade_toggle_ruler':
        settings.readingRulerActive = !settings.readingRulerActive;
        await saveSettings(settings);
        await sendToActiveTab({ type: 'TOGGLE_READING_RULER' });
        break;

      case 'lumishade_toggle_smartdark':
        settings.enabled = true;
        settings.mode = 'smartdark';
        Object.assign(settings, MODE_PRESETS.smartdark);
        await saveSettings(settings);
        await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        break;

      case 'lumishade_toggle_site_exclude':
        if (tab && tab.url) {
          try {
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            if (hostname) {
              const list = settings.excludedSites || [];
              const idx = list.indexOf(hostname);
              if (idx >= 0) {
                list.splice(idx, 1);
              } else {
                list.push(hostname);
              }
              settings.excludedSites = list;
              await saveSettings(settings);
              await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
            }
          } catch (e) {}
        }
        break;
    }
  });
}

/**
 * Alarms listener for schedule and break reminders.
 */
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    const settings = await getSettings();

    if (alarm.name === 'lumishade_schedule_alarm') {
      if (settings.autoScheduleEnabled) {
        const isScheduledTime = isCurrentTimeInSchedule(settings.scheduleStartTime, settings.scheduleEndTime);
        const targetMode = settings.scheduleMode || 'night';

        if (isScheduledTime && settings.mode !== targetMode) {
          settings.mode = targetMode;
          settings.enabled = true;
          if (MODE_PRESETS[targetMode]) {
            Object.assign(settings, MODE_PRESETS[targetMode]);
          }
          await saveSettings(settings);
          await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        }
      }
    } else if (alarm.name === 'lumishade_eye_rest_alarm') {
      if (settings.enabled && settings.eyeRestReminderEnabled && !settings.privacyActive) {
        await sendToActiveTab({ type: 'TRIGGER_EYE_BREAK' });
      }
    }
  });
}

/**
 * Extension install and update lifecycle.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  const settings = await getSettings();
  await saveSettings(settings);
  setupContextMenus();
  await setupAlarms(settings);
  console.log('[LumiShade SW] Installed/Initialized v1.1.0, reason:', details.reason);
});

/**
 * Browser startup lifecycle.
 */
chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  if (!settings.enableOnStartup) {
    settings.enabled = false;
  }
  settings.privacyActive = false;
  settings.readingRulerActive = false;
  await saveSettings(settings);
  setupContextMenus();
  await setupAlarms(settings);
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
    if (!settings.enabled) settings.enabled = true;
    settings.privacyActive = !settings.privacyActive;
    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  } else if (command === 'cycle_mode') {
    if (!settings.enabled) settings.enabled = true;
    const currentIndex = MODE_CYCLE_ORDER.indexOf(settings.mode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE_ORDER.length;
    const nextMode = MODE_CYCLE_ORDER[nextIndex];
    settings.mode = nextMode;

    if (MODE_PRESETS[nextMode]) {
      Object.assign(settings, MODE_PRESETS[nextMode]);
    }

    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  } else if (command === 'toggle_reading_ruler') {
    settings.readingRulerActive = !settings.readingRulerActive;
    await saveSettings(settings);
    await sendToActiveTab({ type: 'TOGGLE_READING_RULER' });
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
          if (message.updateAlarms) {
            await setupAlarms(message.settings);
          }
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

      case 'TOGGLE_SITE_EXCLUSION': {
        const settings = await getSettings();
        const hostname = message.hostname;
        if (hostname) {
          const list = settings.excludedSites || [];
          const idx = list.indexOf(hostname);
          if (idx >= 0) {
            list.splice(idx, 1);
          } else {
            list.push(hostname);
          }
          settings.excludedSites = list;
          await saveSettings(settings);
          await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
          sendResponse({ success: true, excluded: list.includes(hostname), excludedSites: list });
        } else {
          sendResponse({ success: false, error: 'No hostname' });
        }
        break;
      }

      case 'UPDATE_ALARMS': {
        const settings = await getSettings();
        await setupAlarms(settings);
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();

  return true;
});
