/**
 * Settings Management
 * Handles user preferences storage and retrieval
 */

/**
 * Gets user settings from properties
 * @returns {Object} User settings object
 */
function getUserSettings() {
    const props = PropertiesService.getUserProperties();
    return {
        latitude: props.getProperty("latitude"),
        longitude: props.getProperty("longitude"),
        locationName: props.getProperty("locationName"),
        calendarId: props.getProperty("calendarId") || "primary",
        method: props.getProperty("method") || CONFIG.DEFAULT_METHOD.toString(),
        reminderMinutes: props.getProperty("reminderMinutes") || CONFIG.DEFAULT_REMINDER_MINUTES.toString(),
        // New configurable options
        dailySyncHour: props.getProperty("dailySyncHour") || "1",
        eventDuration: props.getProperty("eventDuration") || "30",
        onboardingComplete: props.getProperty("onboardingComplete") || "false",
        lastSyncDate: props.getProperty("lastSyncDate") || "",
    };
}

/**
 * Saves user settings to properties
 * @param {Object} settings - Settings object to save
 */
function saveUserSettings(settings) {
    const props = PropertiesService.getUserProperties();

    const settingsToSave = {
        latitude: settings.latitude || "",
        longitude: settings.longitude || "",
        locationName: settings.locationName || "",
        calendarId: settings.calendarId || "primary",
        method: settings.method || CONFIG.DEFAULT_METHOD.toString(),
        reminderMinutes: settings.reminderMinutes || CONFIG.DEFAULT_REMINDER_MINUTES.toString(),
        // New configurable options
        dailySyncHour: settings.dailySyncHour || "1",
        eventDuration: settings.eventDuration || "30",
        onboardingComplete: settings.onboardingComplete || "false",
        lastSyncDate: settings.lastSyncDate || "",
    };

    props.setProperties(settingsToSave);
    Logger.log("Settings saved successfully");
}

/**
 * Gets list of user's calendars
 * @returns {Array} Array of calendar objects
 */
function getUserCalendars() {
    const calendars = CalendarApp.getAllCalendars();
    const primaryCalendar = CalendarApp.getDefaultCalendar();

    return calendars.map((cal) => ({
        id: cal.getId(),
        name: cal.getName(),
        isPrimary: cal.getId() === primaryCalendar.getId(),
        isOwned: cal.isOwnedByMe(),
    }));
}

/**
 * Clears all user settings
 */
function clearUserSettings() {
    const props = PropertiesService.getUserProperties();
    props.deleteAllProperties();
    Logger.log("All settings cleared");
}

/**
 * Gets the current setup status for progress indicator
 * @returns {Object} Setup status with flags for each step
 */
function getSetupStatus() {
    const settings = getUserSettings();
    const apiKey = getGeoapifyApiKey();

    return {
        hasApiKey: !!apiKey,
        hasLocation: !!(settings.latitude && settings.longitude),
        hasCalendar: !!settings.calendarId,
        hasSynced: !!settings.lastSyncDate,
        isComplete: !!apiKey && !!settings.latitude && !!settings.longitude,
    };
}

/**
 * Validates settings before saving
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validateSettings(settings) {
    const errors = [];

    if (!settings.latitude) {
        errors.push("Latitude is required");
    } else if (isNaN(parseFloat(settings.latitude)) || parseFloat(settings.latitude) < -90 || parseFloat(settings.latitude) > 90) {
        errors.push("Latitude must be between -90 and 90");
    }

    if (!settings.longitude) {
        errors.push("Longitude is required");
    } else if (isNaN(parseFloat(settings.longitude)) || parseFloat(settings.longitude) < -180 || parseFloat(settings.longitude) > 180) {
        errors.push("Longitude must be between -180 and 180");
    }

    if (settings.reminderMinutes && (isNaN(parseInt(settings.reminderMinutes)) || parseInt(settings.reminderMinutes) < 0)) {
        errors.push("Reminder minutes must be a positive number");
    }

    // Validate new fields
    if (settings.dailySyncHour) {
        const hour = parseInt(settings.dailySyncHour);
        if (isNaN(hour) || hour < 0 || hour > 23) {
            errors.push("Daily sync hour must be between 0 and 23");
        }
    }

    if (settings.eventDuration) {
        const duration = parseInt(settings.eventDuration);
        if (isNaN(duration) || duration < 5 || duration > 120) {
            errors.push("Event duration must be between 5 and 120 minutes");
        }
    }

    return {
        isValid: errors.length === 0,
        errors: errors,
    };
}

/**
 * Gets current settings as a readable string (for debugging)
 * @returns {string} Settings summary
 */
function getSettingsSummary() {
    const settings = getUserSettings();
    return `
Location: ${settings.locationName || "Not set"}
Coordinates: ${settings.latitude}, ${settings.longitude}
Calculation Method: ${settings.method}
Reminder: ${settings.reminderMinutes} minutes before
Calendar: ${settings.calendarId}
  `.trim();
}
