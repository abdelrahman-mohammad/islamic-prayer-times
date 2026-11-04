/**
 * Prayer Times Calendar Add-on
 * Main entry points and UI logic
 */

/**
 * Runs when add-on is opened from Calendar homepage
 */
function onHomepage(e) {
    const status = getSetupStatus();
    const settings = getUserSettings();

    // Show onboarding for incomplete setup or first-time users
    if (!status.isComplete && settings.onboardingComplete !== "true") {
        return createOnboardingCard();
    }

    return createSettingsCard();
}

/**
 * Runs when Calendar is opened
 */
function onCalendarOpen(e) {
    const status = getSetupStatus();
    const settings = getUserSettings();

    // Show onboarding for incomplete setup or first-time users
    if (!status.isComplete && settings.onboardingComplete !== "true") {
        return createOnboardingCard();
    }

    return createSettingsCard();
}

/**
 * Runs when a calendar event is opened
 */
function onEventOpen(e) {
    // Optional: could show prayer time info if viewing a prayer event
    return null;
}

/**
 * Creates the onboarding card for first-time users
 */
function createOnboardingCard() {
    const status = getSetupStatus();
    const step = determineOnboardingStep(status);

    const card = CardService.newCardBuilder().setHeader(
        CardService.newCardHeader().setTitle("Welcome to Prayer Times").setSubtitle(`Step ${step} of 3`).setImageUrl("https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png")
    );

    // Progress indicator
    card.addSection(createOnboardingProgressSection(step));

    // Step-specific content
    switch (step) {
        case 1:
            card.addSection(createApiKeyOnboardingSection());
            break;
        case 2:
            card.addSection(createLocationOnboardingSection());
            break;
        case 3:
            card.addSection(createFirstSyncSection());
            break;
    }

    // Skip link
    const skipSection = CardService.newCardSection();
    skipSection.addWidget(
        CardService.newTextButton()
            .setText("Skip to main settings")
            .setOnClickAction(CardService.newAction().setFunctionName("skipOnboarding"))
    );
    card.addSection(skipSection);

    return card.build();
}

/**
 * Determines which onboarding step the user is on
 */
function determineOnboardingStep(status) {
    if (!status.hasApiKey) return 1;
    if (!status.hasLocation) return 2;
    return 3; // Ready to sync
}

/**
 * Creates the onboarding progress indicator
 */
function createOnboardingProgressSection(currentStep) {
    const section = CardService.newCardSection();

    const steps = ["API Key", "Location", "First Sync"];
    let progressText = "";

    steps.forEach((stepName, index) => {
        const stepNum = index + 1;
        let icon, color;

        if (stepNum < currentStep) {
            icon = "✓";
            color = "#0f9d58"; // Green - completed
        } else if (stepNum === currentStep) {
            icon = "●";
            color = "#4285f4"; // Blue - current
        } else {
            icon = "○";
            color = "#999999"; // Gray - pending
        }

        progressText += `<font color="${color}">${icon} ${stepName}</font>`;
        if (stepNum < steps.length) progressText += " → ";
    });

    section.addWidget(CardService.newTextParagraph().setText(progressText));

    return section;
}

/**
 * Onboarding Step 1: API Key setup
 */
function createApiKeyOnboardingSection() {
    const section = CardService.newCardSection().setHeader("Step 1: Get Your API Key");

    section.addWidget(
        CardService.newTextParagraph().setText(
            "To search for cities, you need a free API key from Geoapify.<br><br>" +
                "<b>Quick steps:</b><br>" +
                "1. Go to <a href='https://www.geoapify.com/'>geoapify.com</a><br>" +
                "2. Sign up for a free account<br>" +
                "3. Copy your API key<br>" +
                "4. Paste it below"
        )
    );

    section.addWidget(CardService.newTextInput().setFieldName("apiKey").setTitle("API Key").setHint("Paste your Geoapify API key here"));

    section.addWidget(
        CardService.newButtonSet().addButton(
            CardService.newTextButton()
                .setText("Save & Continue")
                .setOnClickAction(CardService.newAction().setFunctionName("saveApiKeyAndContinue"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
    );

    return section;
}

/**
 * Onboarding Step 2: Location selection
 */
function createLocationOnboardingSection() {
    const section = CardService.newCardSection().setHeader("Step 2: Set Your Location");

    section.addWidget(
        CardService.newTextParagraph().setText(
            "Search for your city to get accurate prayer times based on your location.<br><br>" + "<i>Prayer times vary based on geographic position.</i>"
        )
    );

    section.addWidget(CardService.newTextInput().setFieldName("citySearch").setTitle("Search City").setHint("e.g., New York, London, Dubai"));

    section.addWidget(
        CardService.newButtonSet().addButton(
            CardService.newTextButton()
                .setText("Search Cities")
                .setOnClickAction(CardService.newAction().setFunctionName("searchCities"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
    );

    return section;
}

/**
 * Onboarding Step 3: First sync
 */
function createFirstSyncSection() {
    const settings = getUserSettings();
    const section = CardService.newCardSection().setHeader("Step 3: Sync Your First Prayer Times");

    section.addWidget(
        CardService.newTextParagraph().setText(
            `<font color="#0f9d58"><b>✓ Setup Complete!</b></font><br><br>` +
                `<b>Location:</b> ${settings.locationName}<br>` +
                `<b>Coordinates:</b> ${settings.latitude}, ${settings.longitude}<br><br>` +
                `Click below to sync today's prayer times to your calendar.`
        )
    );

    section.addWidget(
        CardService.newButtonSet().addButton(
            CardService.newTextButton()
                .setText("Sync Prayer Times")
                .setOnClickAction(CardService.newAction().setFunctionName("syncAndCompleteOnboarding"))
                .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
    );

    return section;
}

/**
 * Saves API key and refreshes onboarding
 */
function saveApiKeyAndContinue(e) {
    const apiKey = e.formInput.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please enter an API key")).build();
    }

    try {
        setGeoapifyApiKey(apiKey.trim());
        return CardService.newActionResponseBuilder()
            .setNavigation(CardService.newNavigation().updateCard(createOnboardingCard()))
            .setNotification(CardService.newNotification().setText("API key saved! Now search for your city."))
            .build();
    } catch (error) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: " + error.message)).build();
    }
}

/**
 * Syncs prayer times and marks onboarding as complete
 */
function syncAndCompleteOnboarding(e) {
    try {
        syncPrayerTimes();

        // Mark onboarding as complete
        const currentSettings = getUserSettings();
        saveUserSettings({
            ...currentSettings,
            onboardingComplete: "true",
        });

        return CardService.newActionResponseBuilder()
            .setNavigation(CardService.newNavigation().updateCard(createSettingsCard()))
            .setNotification(CardService.newNotification().setText("Prayer times synced! Welcome to Prayer Times."))
            .build();
    } catch (error) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: " + error.message)).build();
    }
}

/**
 * Skips onboarding and goes to main settings
 */
function skipOnboarding(e) {
    const currentSettings = getUserSettings();
    saveUserSettings({
        ...currentSettings,
        onboardingComplete: "true",
    });

    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(createSettingsCard())).build();
}

/**
 * Creates the main settings card UI - Compact layout with actions at top
 */
function createSettingsCard() {
    const settings = getUserSettings();
    const apiKey = getGeoapifyApiKey();
    const status = getSetupStatus();

    const card = CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader().setTitle("Prayer Times").setImageUrl("https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png"))
        .addSection(createQuickActionsSection(settings, status)) // Actions at TOP
        .addSection(createStatusBarSection(status)) // Status indicator
        .addSection(createLocationSection(settings)) // Collapsible, expanded
        .addSection(createSyncSettingsSection(settings)) // Collapsible, collapsed
        .addSection(createApiConfigSection(apiKey)) // Collapsible, collapsed
        .addSection(createTroubleshootingSection()) // Collapsible, collapsed
        .build();

    return card;
}

/**
 * Creates quick actions section at top of card
 */
function createQuickActionsSection(settings, status) {
    const section = CardService.newCardSection();

    // Primary: Sync Prayer Times
    const syncButton = CardService.newTextButton()
        .setText("Sync")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

    if (status.isComplete) {
        syncButton.setOnClickAction(CardService.newAction().setFunctionName("syncFromCard"));
    } else {
        syncButton.setDisabled(true);
    }

    // Secondary: Save Settings
    const saveButton = CardService.newTextButton()
        .setText("Save")
        .setOnClickAction(CardService.newAction().setFunctionName("saveSettingsFromCard"))
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED);

    // Tertiary: Daily Sync
    const dailySyncButton = CardService.newTextButton()
        .setText("Daily Sync")
        .setOnClickAction(CardService.newAction().setFunctionName("setupDailyTriggerFromCard"));

    section.addWidget(CardService.newButtonSet().addButton(syncButton).addButton(saveButton).addButton(dailySyncButton));

    return section;
}

/**
 * Creates status bar section
 */
function createStatusBarSection(status) {
    const section = CardService.newCardSection();

    const apiIcon = status.hasApiKey ? "✓" : "✗";
    const apiColor = status.hasApiKey ? "#0f9d58" : "#d93025";
    const locationIcon = status.hasLocation ? "✓" : "✗";
    const locationColor = status.hasLocation ? "#0f9d58" : "#d93025";
    const syncIcon = status.hasSynced ? "✓" : "✗";
    const syncColor = status.hasSynced ? "#0f9d58" : "#999999";

    section.addWidget(
        CardService.newTextParagraph().setText(
            `<font color="${apiColor}">${apiIcon} API</font> | ` +
                `<font color="${locationColor}">${locationIcon} Location</font> | ` +
                `<font color="${syncColor}">${syncIcon} Synced</font>`
        )
    );

    return section;
}

/**
 * Creates location section (collapsible, expanded by default)
 */
function createLocationSection(settings) {
    const section = CardService.newCardSection()
        .setHeader("Location")
        .setCollapsible(true)
        .setNumUncollapsibleWidgets(1); // Keep city display visible when collapsed

    // Display selected city or search prompt
    if (settings.locationName) {
        section.addWidget(
            CardService.newDecoratedText()
                .setTopLabel("Current City")
                .setText(settings.locationName)
                .setBottomLabel(`${settings.latitude}, ${settings.longitude}`)
                .setButton(CardService.newTextButton().setText("Change").setOnClickAction(CardService.newAction().setFunctionName("openCitySearch")))
        );
    } else {
        // No city set - show search
        section.addWidget(CardService.newTextInput().setFieldName("citySearch").setTitle("Search City").setHint("e.g., New York, London"));
        section.addWidget(
            CardService.newButtonSet().addButton(
                CardService.newTextButton()
                    .setText("Search Cities")
                    .setOnClickAction(CardService.newAction().setFunctionName("searchCities"))
                    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            )
        );
    }

    // Calculation method dropdown
    section.addWidget(
        CardService.newSelectionInput()
            .setType(CardService.SelectionInputType.DROPDOWN)
            .setFieldName("method")
            .setTitle("Calculation Method")
            .addItem("ISNA (North America)", "2", settings.method === "2" || !settings.method)
            .addItem("Muslim World League", "3", settings.method === "3")
            .addItem("Umm Al-Qura (Saudi)", "4", settings.method === "4")
            .addItem("Egyptian", "5", settings.method === "5")
            .addItem("Karachi", "1", settings.method === "1")
    );

    return section;
}

/**
 * Creates sync settings section (collapsible, collapsed by default)
 */
function createSyncSettingsSection(settings) {
    const section = CardService.newCardSection()
        .setHeader("Sync Settings")
        .setCollapsible(true)
        .setNumUncollapsibleWidgets(0); // Fully collapsed

    // Daily sync hour dropdown
    const syncHourDropdown = CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.DROPDOWN)
        .setFieldName("dailySyncHour")
        .setTitle("Daily Sync Time");

    for (let h = 0; h < 24; h++) {
        const label = formatHour(h);
        const isSelected = settings.dailySyncHour === h.toString() || (!settings.dailySyncHour && h === 1);
        syncHourDropdown.addItem(label, h.toString(), isSelected);
    }
    section.addWidget(syncHourDropdown);

    // Event duration dropdown
    const durationDropdown = CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.DROPDOWN)
        .setFieldName("eventDuration")
        .setTitle("Event Duration");

    [
        { label: "15 minutes", value: "15" },
        { label: "30 minutes", value: "30" },
        { label: "45 minutes", value: "45" },
        { label: "60 minutes", value: "60" },
    ].forEach((d) => {
        const isSelected = settings.eventDuration === d.value || (!settings.eventDuration && d.value === "30");
        durationDropdown.addItem(d.label, d.value, isSelected);
    });
    section.addWidget(durationDropdown);

    // Calendar selection
    section.addWidget(createCalendarDropdown(settings));

    // Reminder
    section.addWidget(
        CardService.newTextInput()
            .setFieldName("reminderMinutes")
            .setTitle("Reminder (minutes before)")
            .setValue(settings.reminderMinutes?.toString() || "30")
    );

    return section;
}

/**
 * Creates API configuration section (collapsible, collapsed by default)
 */
function createApiConfigSection(currentApiKey) {
    const section = CardService.newCardSection()
        .setHeader("API Configuration")
        .setCollapsible(true)
        .setNumUncollapsibleWidgets(0);

    if (!currentApiKey) {
        section.addWidget(
            CardService.newTextParagraph().setText(
                `<font color="#d93025"><b>⚠ API Key Required</b></font><br>` + `Get a free key from <a href="https://www.geoapify.com/">geoapify.com</a>`
            )
        );
        section.addWidget(CardService.newTextInput().setFieldName("apiKey").setTitle("API Key").setHint("Paste your Geoapify API key"));
        section.addWidget(
            CardService.newButtonSet().addButton(
                CardService.newTextButton()
                    .setText("Save API Key")
                    .setOnClickAction(CardService.newAction().setFunctionName("saveApiKey"))
                    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            )
        );
    } else {
        const maskedKey = currentApiKey.substring(0, 8) + "..." + currentApiKey.substring(currentApiKey.length - 4);
        section.addWidget(
            CardService.newDecoratedText()
                .setTopLabel("API Key")
                .setText(`✓ ${maskedKey}`)
                .setButton(CardService.newTextButton().setText("Update").setOnClickAction(CardService.newAction().setFunctionName("showApiKeyInput")))
        );
    }

    return section;
}

/**
 * Creates troubleshooting section (collapsible, collapsed by default)
 */
function createTroubleshootingSection() {
    const section = CardService.newCardSection()
        .setHeader("Troubleshooting")
        .setCollapsible(true)
        .setNumUncollapsibleWidgets(0);

    section.addWidget(
        CardService.newDecoratedText()
            .setText("Test API connections")
            .setButton(CardService.newTextButton().setText("Test").setOnClickAction(CardService.newAction().setFunctionName("testAPIsFromCard")))
    );

    return section;
}

/**
 * Creates calendar selection dropdown
 */
function createCalendarDropdown(settings) {
    const calendars = getUserCalendars();
    const dropdown = CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.DROPDOWN)
        .setFieldName("calendarId")
        .setTitle("Target Calendar");

    calendars.forEach((cal) => {
        if (cal.isOwned) {
            const label = cal.isPrimary ? `${cal.name} (Primary)` : cal.name;
            const isSelected = settings.calendarId === cal.id || (cal.isPrimary && settings.calendarId === "primary");
            dropdown.addItem(label, cal.id, isSelected);
        }
    });

    return dropdown;
}

/**
 * Formats hour (0-23) to readable time string
 */
function formatHour(hour) {
    if (hour === 0) return "12:00 AM";
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return "12:00 PM";
    return `${hour - 12}:00 PM`;
}

/**
 * Saves settings from card form
 */
function saveSettingsFromCard(e) {
    const formInputs = e.formInput;
    const currentSettings = getUserSettings();

    // Check if city is selected (coordinates must be set)
    if (!currentSettings.latitude || !currentSettings.longitude) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please search and select a city first")).build();
    }

    // Build new settings object
    const newSettings = {
        locationName: currentSettings.locationName,
        latitude: currentSettings.latitude,
        longitude: currentSettings.longitude,
        calendarId: formInputs.calendarId || currentSettings.calendarId || "primary",
        method: formInputs.method || currentSettings.method,
        reminderMinutes: formInputs.reminderMinutes || currentSettings.reminderMinutes || "30",
        dailySyncHour: formInputs.dailySyncHour || currentSettings.dailySyncHour || "1",
        eventDuration: formInputs.eventDuration || currentSettings.eventDuration || "30",
        onboardingComplete: currentSettings.onboardingComplete,
        lastSyncDate: currentSettings.lastSyncDate,
    };

    // Validate before saving
    const validation = validateSettings(newSettings);
    if (!validation.isValid) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: " + validation.errors.join(", "))).build();
    }

    saveUserSettings(newSettings);

    return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Settings saved successfully!")).build();
}

/**
 * Syncs prayer times from card
 */
function syncFromCard(e) {
    try {
        syncPrayerTimes();
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Prayer times synced to your calendar!")).build();
    } catch (error) {
        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification().setText("Error: " + error.message))
            .build();
    }
}

/**
 * Sets up daily trigger from card
 */
function setupDailyTriggerFromCard(e) {
    try {
        const settings = getUserSettings();
        const syncHour = parseInt(settings.dailySyncHour) || 1;

        setupDailyTrigger(syncHour);

        const timeText = formatHour(syncHour);
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText(`Daily sync enabled! Prayers will update at ${timeText}.`)).build();
    } catch (error) {
        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification().setText("Error: " + error.message))
            .build();
    }
}

/**
 * Searches for cities from main card (when no city is set)
 */
function searchCities(e) {
    const cityQuery = e.formInput.citySearch;

    if (!cityQuery || cityQuery.trim().length < 2) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please enter at least 2 characters")).build();
    }

    try {
        const cities = fetchCities(cityQuery);

        if (cities.length === 0) {
            return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("No cities found. Try a different search.")).build();
        }

        // Open city search card with results
        const settings = getUserSettings();
        const searchCard = createCitySearchCard(settings, cities);
        return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(searchCard)).build();
    } catch (error) {
        Logger.log("Search error: " + error.message);
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: " + error.message)).build();
    }
}

/**
 * Handles city selection
 */
function selectCity(e) {
    const params = e.parameters;

    // Save the selected city while preserving all other settings
    const currentSettings = getUserSettings();
    saveUserSettings({
        ...currentSettings,
        locationName: params.name,
        latitude: params.latitude,
        longitude: params.longitude,
    });

    // Pop back to main card and show success
    return CardService.newActionResponseBuilder()
        .setNavigation(CardService.newNavigation().popToRoot())
        .setNotification(CardService.newNotification().setText("City selected: " + params.name))
        .setStateChanged(true)
        .build();
}

/**
 * Opens the city search card (direct search, preserves current city)
 */
function openCitySearch(e) {
    const settings = getUserSettings();
    const card = createCitySearchCard(settings, null); // No results initially
    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(card)).build();
}

/**
 * Creates the city search card with current city preserved and optional inline results
 */
function createCitySearchCard(settings, cities) {
    const card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle("Change City"));

    // Show current city banner (preserved until new selection)
    if (settings.locationName) {
        const currentSection = CardService.newCardSection();
        currentSection.addWidget(
            CardService.newDecoratedText()
                .setTopLabel("Current City (kept until you select a new one)")
                .setText(settings.locationName)
                .setBottomLabel(`${settings.latitude}, ${settings.longitude}`)
        );
        card.addSection(currentSection);
    }

    // Search section
    const searchSection = CardService.newCardSection();
    searchSection.addWidget(CardService.newTextInput().setFieldName("citySearch").setTitle("Search City").setHint("Enter city name"));

    searchSection.addWidget(
        CardService.newButtonSet()
            .addButton(
                CardService.newTextButton()
                    .setText("Search")
                    .setOnClickAction(CardService.newAction().setFunctionName("searchCitiesFromChangeCard"))
                    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
            )
            .addButton(CardService.newTextButton().setText("Cancel").setOnClickAction(CardService.newAction().setFunctionName("goBackToSettings")))
    );
    card.addSection(searchSection);

    // Inline results section (if cities provided)
    if (cities && cities.length > 0) {
        const resultsSection = CardService.newCardSection().setHeader(`Found ${cities.length} cities`);

        cities.forEach((city) => {
            const cityLabel = `${city.name}, ${city.country}`;
            const cityInfo = city.population ? `Pop: ${formatPopulation(city.population)}` : "";

            resultsSection.addWidget(
                CardService.newDecoratedText()
                    .setTopLabel(cityLabel)
                    .setText(cityInfo || "Select this city")
                    .setButton(
                        CardService.newTextButton()
                            .setText("Select")
                            .setOnClickAction(
                                CardService.newAction()
                                    .setFunctionName("selectCity")
                                    .setParameters({
                                        name: city.name + ", " + city.country,
                                        latitude: city.latitude.toString(),
                                        longitude: city.longitude.toString(),
                                    })
                            )
                    )
            );
        });

        card.addSection(resultsSection);
    }

    return card.build();
}

/**
 * Searches for cities and shows results inline (updates same card)
 */
function searchCitiesFromChangeCard(e) {
    const cityQuery = e.formInput.citySearch;

    if (!cityQuery || cityQuery.trim().length < 2) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please enter at least 2 characters")).build();
    }

    try {
        const cities = fetchCities(cityQuery);

        if (cities.length === 0) {
            return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("No cities found. Try a different search.")).build();
        }

        // Update same card with results (no push)
        const settings = getUserSettings();
        const updatedCard = createCitySearchCard(settings, cities);
        return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().updateCard(updatedCard)).build();
    } catch (error) {
        Logger.log("Search error: " + error.message);
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Error: " + error.message)).build();
    }
}

/**
 * Formats population number for display
 */
function formatPopulation(pop) {
    if (!pop) return "Unknown";
    if (pop >= 1000000) return (pop / 1000000).toFixed(1) + "M";
    if (pop >= 1000) return (pop / 1000).toFixed(0) + "K";
    return pop.toString();
}

/**
 * Creates an error card with detailed debugging info
 */
function createErrorCard(error) {
    const card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle("Error Details"));

    const section = CardService.newCardSection().setHeader("Debug Information");

    section.addWidget(CardService.newTextParagraph().setText(`<b>Error Message:</b><br>${error.message}`));

    if (error.stack) {
        section.addWidget(CardService.newTextParagraph().setText(`<b>Stack Trace:</b><br><font color="#666666">${error.stack.substring(0, 500)}</font>`));
    }

    // Add instructions
    section.addWidget(
        CardService.newTextParagraph().setText(`<br><b>What to do:</b><br>
1. Check the Apps Script execution log<br>
2. Try a simpler search (just city name)<br>
3. Make sure you have internet access`)
    );

    section.addWidget(CardService.newButtonSet().addButton(CardService.newTextButton().setText("Back").setOnClickAction(CardService.newAction().setFunctionName("goBackToSettings"))));

    card.addSection(section);
    return card.build();
}

/**
 * Goes back to settings card
 */
function goBackToSettings(e) {
    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().popCard()).build();
}

/**
 * Saves the API key from the form
 */
function saveApiKey(e) {
    const apiKey = e.formInput.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please enter an API key")).build();
    }

    try {
        setGeoapifyApiKey(apiKey.trim());
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("API key saved successfully!")).setStateChanged(true).build();
    } catch (error) {
        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification().setText("Error saving API key: " + error.message))
            .build();
    }
}

/**
 * Shows a card to update the API key
 */
function showApiKeyInput(e) {
    const card = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle("Update API Key"));

    const section = CardService.newCardSection().setHeader("Enter New API Key");

    section.addWidget(CardService.newTextParagraph().setText('Get a free API key from <a href="https://www.geoapify.com/">geoapify.com</a>'));

    section.addWidget(CardService.newTextInput().setFieldName("apiKey").setTitle("API Key").setHint("Paste your new Geoapify API key"));

    section.addWidget(
        CardService.newButtonSet()
            .addButton(CardService.newTextButton().setText("Save").setOnClickAction(CardService.newAction().setFunctionName("updateApiKey")).setTextButtonStyle(CardService.TextButtonStyle.FILLED))
            .addButton(CardService.newTextButton().setText("Cancel").setOnClickAction(CardService.newAction().setFunctionName("goBackToSettings")))
    );

    card.addSection(section);

    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(card.build())).build();
}

/**
 * Updates the API key
 */
function updateApiKey(e) {
    const apiKey = e.formInput.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
        return CardService.newActionResponseBuilder().setNotification(CardService.newNotification().setText("Please enter an API key")).build();
    }

    try {
        setGeoapifyApiKey(apiKey.trim());
        return CardService.newActionResponseBuilder()
            .setNavigation(CardService.newNavigation().popCard())
            .setNotification(CardService.newNotification().setText("API key updated successfully!"))
            .setStateChanged(true)
            .build();
    } catch (error) {
        return CardService.newActionResponseBuilder()
            .setNotification(CardService.newNotification().setText("Error updating API key: " + error.message))
            .build();
    }
}

/**
 * Tests API connections and shows results
 */
function testAPIsFromCard(e) {
    const resultsCard = CardService.newCardBuilder().setHeader(CardService.newCardHeader().setTitle("API Test Results"));

    const section = CardService.newCardSection().setHeader("Testing APIs...");

    // Test Geoapify API
    try {
        const testQuery = "London";
        const apiKey = getGeoapifyApiKey();

        if (!apiKey) {
            section.addWidget(
                CardService.newTextParagraph().setText(
                    `<font color="#d93025"><b>✗ Geoapify API Key Not Set</b></font><br>Please add your API key in the settings above.<br><br><b>Get a free key:</b><br>1. Go to https://www.geoapify.com/<br>2. Sign up (free)<br>3. Copy your API key<br>4. Paste it in the settings`
                )
            );
        } else {
            const url = `${CONFIG.GEOAPIFY_API_URL}?text=${encodeURIComponent(testQuery)}&type=city&limit=3&apiKey=${apiKey}`;

            section.addWidget(CardService.newTextParagraph().setText(`<b>Testing Geoapify API:</b><br>Query: ${testQuery}`));

            const response = UrlFetchApp.fetch(url, {
                muteHttpExceptions: true,
            });

            const statusCode = response.getResponseCode();
            const responseText = response.getContentText();

            section.addWidget(
                CardService.newTextParagraph().setText(`<b>Status:</b> ${statusCode}<br><b>Response (first 300 chars):</b><br><font color="#666666">${responseText.substring(0, 300)}</font>`)
            );

            if (statusCode === 200) {
                const data = JSON.parse(responseText);
                section.addWidget(CardService.newTextParagraph().setText(`<font color="#0f9d58"><b>✓ Geoapify API Working!</b></font><br>Found ${data.features ? data.features.length : 0} results`));
            } else if (statusCode === 401 || statusCode === 403) {
                section.addWidget(CardService.newTextParagraph().setText(`<font color="#d93025"><b>✗ Invalid API Key</b></font><br>Please check your Geoapify API key`));
            } else {
                section.addWidget(CardService.newTextParagraph().setText(`<font color="#d93025"><b>✗ Geoapify API Failed</b></font>`));
            }
        }
    } catch (error) {
        section.addWidget(CardService.newTextParagraph().setText(`<font color="#d93025"><b>✗ Geoapify Error:</b></font><br>${error.message}`));
    }

    // Test Prayer Times API
    try {
        const testLat = "51.5074";
        const testLon = "-0.1278";
        const prayerUrl = `${CONFIG.API_BASE_URL}/timings?latitude=${testLat}&longitude=${testLon}&method=2`;

        section.addWidget(CardService.newTextParagraph().setText(`<br><b>Testing Prayer Times API:</b><br>URL: ${prayerUrl}`));

        const prayerResponse = UrlFetchApp.fetch(prayerUrl);
        const prayerData = JSON.parse(prayerResponse.getContentText());

        if (prayerData.code === 200) {
            section.addWidget(CardService.newTextParagraph().setText(`<font color="#0f9d58"><b>✓ Prayer Times API Working!</b></font><br>Fajr: ${prayerData.data.timings.Fajr}`));
        } else {
            section.addWidget(CardService.newTextParagraph().setText(`<font color="#d93025"><b>✗ Prayer Times API Failed</b></font>`));
        }
    } catch (error) {
        section.addWidget(CardService.newTextParagraph().setText(`<font color="#d93025"><b>✗ Prayer Times Error:</b></font><br>${error.message}`));
    }

    section.addWidget(CardService.newButtonSet().addButton(CardService.newTextButton().setText("Back").setOnClickAction(CardService.newAction().setFunctionName("goBackToSettings"))));

    resultsCard.addSection(section);

    return CardService.newActionResponseBuilder().setNavigation(CardService.newNavigation().pushCard(resultsCard.build())).build();
}
