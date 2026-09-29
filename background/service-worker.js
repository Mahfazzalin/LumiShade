/**
 * LumiShade - Background Service Worker (Manifest V3)
 * Handles lifecycle, keyboard commands, storage initialization, alarms, context menus,
 * tab switching, per-domain mode memory, and badge updates.
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
  rememberPerSite: true, // Remembers tailored mode independently for each domain
  siteOverrides: {},
  excludedSites: [],

  // Automation & Scheduling
  autoScheduleEnabled: false,
  scheduleStartTime: '20:00',
  scheduleEndTime: '07:00',
  scheduleMode: 'night',
  scheduleState: 'idle', // Transition threshold tracker to avoid continuous overwriting
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
 * Retrieve per-site configuration matching exact host, stripped www, or parent domain.
 */
function getSiteConfig(siteOverrides, hostname) {
  if (!siteOverrides || !hostname) return null;
  const host = hostname.toLowerCase().trim();
  if (siteOverrides[host]) return siteOverrides[host];
  if (host.startsWith('www.') && siteOverrides[host.slice(4)]) {
    return siteOverrides[host.slice(4)];
  }
  const parts = host.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(-2).join('.');
    if (siteOverrides[parent]) return siteOverrides[parent];
  }
  return null;
}

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
 * Update the extension icon badge based on state and optional active domain.
 */
async function updateBadge(settings, targetHostname = '') {
  try {
    if (!settings.enabled) {
      await chrome.action.setBadgeText({ text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
      return;
    }

    if (settings.privacyActive) {
      await chrome.action.setBadgeText({ text: 'BLUR' });
      await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
      return;
    }

    // Determine effective mode for the active domain
    let effectiveMode = settings.mode;
    if (targetHostname && settings.rememberPerSite !== false && settings.siteOverrides) {
      const siteConfig = getSiteConfig(settings.siteOverrides, targetHostname);
      if (siteConfig && siteConfig.mode) {
        effectiveMode = siteConfig.mode;
      }
    }

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

    const text = modeLabels[effectiveMode] || 'ON';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
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
    // Daytime interval, e.g. 09:00 to 17:00
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
    let hostname = '';
    if (tab && tab.url) {
      try {
        hostname = new URL(tab.url).hostname;
      } catch (e) {}
    }

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
        await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        break;

      case 'lumishade_toggle_smartdark':
        settings.enabled = true;
        settings.mode = 'smartdark';
        Object.assign(settings, MODE_PRESETS.smartdark);
        if (settings.rememberPerSite !== false && hostname) {
          if (!settings.siteOverrides) settings.siteOverrides = {};
          settings.siteOverrides[hostname] = {
            mode: 'smartdark',
            brightness: settings.brightness,
            contrast: settings.contrast,
            grayscale: settings.grayscale,
            warmth: settings.warmth,
            dim: settings.dim
          };
        }
        await saveSettings(settings);
        await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
        break;

      case 'lumishade_toggle_site_exclude':
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
        break;
    }
  });
}

/**
 * Alarms listener for auto-schedule and eye rest reminders.
 * Only triggers schedule mode changes upon crossing time boundaries,
 * strictly avoiding recurring clobbering of manually chosen modes!
 */
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    const settings = await getSettings();

    if (alarm.name === 'lumishade_schedule_alarm') {
      if (settings.autoScheduleEnabled) {
        const isScheduledTime = isCurrentTimeInSchedule(settings.scheduleStartTime, settings.scheduleEndTime);
        const targetMode = settings.scheduleMode || 'night';
        const targetState = isScheduledTime ? 'in_schedule' : 'out_of_schedule';

        // State transition detection: only execute when crossing the schedule threshold!
        if (settings.scheduleState !== targetState) {
          settings.scheduleState = targetState;

          if (isScheduledTime) {
            settings.mode = targetMode;
            settings.enabled = true;
            if (MODE_PRESETS[targetMode]) {
              Object.assign(settings, MODE_PRESETS[targetMode]);
            }
          } else {
            // Revert back to daytime default
            settings.mode = 'original';
            if (MODE_PRESETS.original) {
              Object.assign(settings, MODE_PRESETS.original);
            }
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
 * Tab switch listener: ensures active tab's per-site mode is reflected on the badge
 * and applied seamlessly when switching between tabs/domains.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab || !tab.url) return;
    const settings = await getSettings();
    if (!settings.enabled) {
      await updateBadge(settings);
      return;
    }

    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      if (hostname) {
        // Excluded site check
        const isExcluded = Array.isArray(settings.excludedSites) && settings.excludedSites.some(s => {
          const lower = s.toLowerCase().trim();
          return hostname === lower || hostname.endsWith('.' + lower);
        });

        if (isExcluded) {
          await chrome.action.setBadgeText({ text: 'OFF' });
          await chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
          return;
        }

        const siteConfig = getSiteConfig(settings.siteOverrides, hostname);
        const effectiveMode = (settings.rememberPerSite !== false && siteConfig && siteConfig.mode)
          ? siteConfig.mode
          : settings.mode;

        await updateBadge({ ...settings, mode: effectiveMode });
        await chrome.tabs.sendMessage(activeInfo.tabId, { type: 'APPLY_SETTINGS', settings }).catch(() => {});
      }
    } catch (e) {}
  } catch (err) {}
});

/**
 * Tab navigation listener: update badge when page completes loading.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.active && tab.url) {
    try {
      const settings = await getSettings();
      const url = new URL(tab.url);
      const hostname = url.hostname;
      if (hostname) {
        const siteConfig = getSiteConfig(settings.siteOverrides, hostname);
        const effectiveMode = (settings.rememberPerSite !== false && siteConfig && siteConfig.mode)
          ? siteConfig.mode
          : settings.mode;
        await updateBadge({ ...settings, mode: effectiveMode });
      }
    } catch (e) {}
  }
});

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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let currentMode = settings.mode;
    let hostname = '';
    if (tab && tab.url) {
      try {
        hostname = new URL(tab.url).hostname;
        if (settings.rememberPerSite !== false && hostname) {
          const siteConfig = getSiteConfig(settings.siteOverrides, hostname);
          if (siteConfig && siteConfig.mode) {
            currentMode = siteConfig.mode;
          }
        }
      } catch (e) {}
    }

    const currentIndex = MODE_CYCLE_ORDER.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE_ORDER.length;
    const nextMode = MODE_CYCLE_ORDER[nextIndex];

    settings.mode = nextMode;
    if (MODE_PRESETS[nextMode]) {
      Object.assign(settings, MODE_PRESETS[nextMode]);
    }

    if (settings.rememberPerSite !== false && hostname) {
      if (!settings.siteOverrides) settings.siteOverrides = {};
      settings.siteOverrides[hostname] = {
        mode: nextMode,
        brightness: settings.brightness,
        contrast: settings.contrast,
        grayscale: settings.grayscale,
        warmth: settings.warmth,
        dim: settings.dim
      };
    }

    await saveSettings(settings);
    await sendToActiveTab({ type: 'APPLY_SETTINGS', settings });
  } else if (command === 'toggle_reading_ruler') {
    settings.readingRulerActive = !settings.readingRulerActive;
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
