/**
 * Prayer Times Logic
 * Handles API calls and calendar event creation
 */

// Configuration constants
const CONFIG = {
    API_BASE_URL: "http://api.aladhan.com/v1",
    GEOAPIFY_API_URL: "https://api.geoapify.com/v1/geocode/search",
    DEFAULT_METHOD: 2, // ISNA calculation method
    DEFAULT_REMINDER_MINUTES: 30,
    PRAYER_NAMES: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
};

/**
 * Gets the Geoapify API key from Script Properties
 * @returns {string|null} API key or null if not set
 */
function getGeoapifyApiKey() {
    const scriptProps = PropertiesService.getScriptProperties();
    return scriptProps.getProperty("GEOAPIFY_API_KEY");
}

/**
 * Sets the Geoapify API key in Script Properties
 * @param {string} apiKey - The API key to save
 */
function setGeoapifyApiKey(apiKey) {
    const scriptProps = PropertiesService.getScriptProperties();
    scriptProps.setProperty("GEOAPIFY_API_KEY", apiKey);
    Logger.log("API key saved successfully");
}

/**
 * Main function to sync prayer times for today
 */
function syncPrayerTimes() {
    const settings = getUserSettings();

    if (!settings.latitude || !settings.longitude) {
        throw new Error("Please configure your location in Settings first.");
    }

    try {
        const prayerTimes = fetchPrayerTimes(settings);
        createPrayerEvents(prayerTimes, settings);

        // Track last sync date for progress indicator
        const props = PropertiesService.getUserProperties();
        props.setProperty("lastSyncDate", new Date().toISOString());

        Logger.log("Prayer times synced successfully");
    } catch (error) {
        Logger.log("Error syncing prayer times: " + error.message);
        throw error;
    }
}

/**
 * Fetches prayer times from Aladhan API
 */
function fetchPrayerTimes(settings) {
    const today = new Date();
    const timestamp = Math.floor(today.getTime() / 1000);

    // Build API URL
    const url = `${CONFIG.API_BASE_URL}/timings/${timestamp}` + `?latitude=${settings.latitude}` + `&longitude=${settings.longitude}` + `&method=${settings.method || CONFIG.DEFAULT_METHOD}`;

    Logger.log("Fetching prayer times from: " + url);

    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());

    if (data.code !== 200) {
        throw new Error("API returned error: " + data.status);
    }

    return data.data.timings;
}

/**
 * Creates calendar events for each prayer
 */
function createPrayerEvents(timings, settings) {
    const calendar = getSelectedCalendar(settings.calendarId);
    const today = new Date();

    CONFIG.PRAYER_NAMES.forEach((prayer) => {
        const timeStr = timings[prayer]; // Format: "HH:MM"
        const eventTime = parseTimeString(timeStr, today);

        // Check if event already exists
        if (!eventExistsForPrayer(calendar, prayer, eventTime)) {
            createPrayerEvent(calendar, prayer, eventTime, settings);
            Logger.log(`Created event for ${prayer} at ${timeStr}`);
        } else {
            Logger.log(`Event for ${prayer} already exists, skipping`);
        }
    });
}

/**
 * Creates a single prayer event
 */
function createPrayerEvent(calendar, prayerName, startTime, settings) {
    // Use configurable event duration (default 30 minutes)
    const durationMinutes = parseInt(settings.eventDuration) || 30;
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    const event = calendar.createEvent(`${prayerName} Prayer`, startTime, endTime, {
        description: `Islamic prayer time - ${prayerName}\nAdded by Prayer Times Add-on`,
        location: settings.locationName || "",
    });

    // Add reminder
    const reminderMinutes = parseInt(settings.reminderMinutes) || CONFIG.DEFAULT_REMINDER_MINUTES;
    event.addPopupReminder(reminderMinutes);

    // Tag the event for future identification
    event.setTag("prayerTimeEvent", "true");
    event.setTag("prayerName", prayerName);
}

/**
 * Checks if prayer event already exists for today
 */
function eventExistsForPrayer(calendar, prayerName, eventTime) {
    const startOfDay = new Date(eventTime);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(eventTime);
    endOfDay.setHours(23, 59, 59, 999);

    const events = calendar.getEvents(startOfDay, endOfDay);

    return events.some((event) => {
        const title = event.getTitle();
        return title.includes(prayerName) && title.includes("Prayer");
    });
}

/**
 * Parses time string (HH:MM) and returns Date object for today
 */
function parseTimeString(timeStr, baseDate) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

/**
 * Gets the calendar to use (user's choice or primary)
 */
function getSelectedCalendar(calendarId) {
    if (calendarId && calendarId !== "primary") {
        return CalendarApp.getCalendarById(calendarId);
    }
    return CalendarApp.getDefaultCalendar();
}

/**
 * Sets up daily trigger to sync prayer times
 * @param {number} syncHour - Hour to run the daily sync (0-23), defaults to 1
 */
function setupDailyTrigger(syncHour) {
    // Delete existing triggers first to avoid duplicates
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
        if (trigger.getHandlerFunction() === "syncPrayerTimes") {
            ScriptApp.deleteTrigger(trigger);
        }
    });

    // Use configurable hour (default to 1 AM)
    const hour = parseInt(syncHour) || 1;

    // Create new daily trigger
    ScriptApp.newTrigger("syncPrayerTimes").timeBased().atHour(hour).everyDays(1).create();

    Logger.log(`Daily sync trigger created for ${hour}:00`);
}

/**
 * Test function to check API connectivity
 */
function testAPIConnection() {
    const testSettings = {
        latitude: "40.7128",
        longitude: "-74.0060",
        method: "2",
    };

    try {
        const times = fetchPrayerTimes(testSettings);
        Logger.log("API Test Success!");
        Logger.log("Prayer times for test location:");
        CONFIG.PRAYER_NAMES.forEach((prayer) => {
            Logger.log(`${prayer}: ${times[prayer]}`);
        });
        return true;
    } catch (error) {
        Logger.log("API Test Failed: " + error.message);
        return false;
    }
}

/**
 * Fetches cities from Geoapify API
 * @param {string} query - City name to search
 * @returns {Array} Array of city objects
 */
function fetchCities(query) {
    // Get API key from Script Properties
    const apiKey = getGeoapifyApiKey();

    if (!apiKey) {
        throw new Error("Geoapify API key not set. Please add your API key in the add-on settings.");
    }

    const url = `${CONFIG.GEOAPIFY_API_URL}?` + `text=${encodeURIComponent(query)}` + `&type=city` + `&limit=10` + `&apiKey=${apiKey}`;

    Logger.log("Fetching cities with URL: " + url.replace(apiKey, "API_KEY"));

    try {
        const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
        });

        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        Logger.log("Response status: " + statusCode);
        Logger.log("Response (first 200 chars): " + responseText.substring(0, 200));

        if (statusCode === 401 || statusCode === 403) {
            throw new Error("Invalid API key. Please check your Geoapify API key in settings.");
        }

        if (statusCode !== 200) {
            throw new Error(`API returned status ${statusCode}. Response: ${responseText.substring(0, 100)}`);
        }

        const data = JSON.parse(responseText);

        if (!data.features || data.features.length === 0) {
            Logger.log("No results found");
            return [];
        }

        Logger.log(`Geoapify returned ${data.features.length} results`);

        // Transform Geoapify data to our format
        const cities = data.features
            .map((item) => {
                const props = item.properties;
                const coords = item.geometry.coordinates; // [lon, lat]

                // Build city name from available data
                const cityName = props.city || props.name || props.county;
                const country = props.country || "Unknown";
                const state = props.state || "";

                return {
                    name: cityName,
                    country: country,
                    state: state,
                    latitude: coords[1].toFixed(4),
                    longitude: coords[0].toFixed(4),
                    population: props.population || null,
                    displayName: props.formatted || `${cityName}, ${country}`,
                    type: props.result_type,
                };
            })
            .filter((city) => city.name) // Remove entries without names
            .slice(0, 8);

        Logger.log(`Filtered to ${cities.length} cities`);

        return cities;
    } catch (error) {
        Logger.log("Error fetching cities: " + error.message);
        Logger.log("Error stack: " + error.stack);
        throw error;
    }
}
