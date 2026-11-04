/**
 * Cards.gs: the add-on's interface, built with CardService.
 *
 * Views:
 *   Setup step 1: choose a location, suggested from the calendar time zone or found by search.
 *   Setup step 2: check the preferences, then add the prayer times to the calendar.
 *   Home: today's times, the next prayer, the Qibla direction and the calendar status.
 *   Settings: every option. Each change is saved as soon as it is made.
 *   Location search, coordinates, and confirmations for removing events and resetting.
 *
 * The builders only read the model they are given. Code.gs loads the data.
 */

const MUTED_COLOR_ = "#5f6368";
const WARNING_COLOR_ = "#b3261e";

// ---------------------------------------------------------------------------
// Widget helpers
// ---------------------------------------------------------------------------

function newAction_(functionName, parameters) {
  const action = CardService.newAction().setFunctionName(functionName);
  if (parameters) action.setParameters(parameters);
  return action;
}

/** The action every settings input runs on change. It saves without a spinner. */
function saveAction_(fields, view) {
  return newAction_("onSettingChange", { fields: fields.join(","), view: view }).setLoadIndicator(
    CardService.LoadIndicator.NONE
  );
}

function button_(text, action) {
  return CardService.newTextButton().setText(text).setOnClickAction(action);
}

function filledButton_(text, action) {
  return button_(text, action).setTextButtonStyle(CardService.TextButtonStyle.FILLED);
}

function buttonRow_(buttons) {
  const set = CardService.newButtonSet();
  buttons.forEach((b) => set.addButton(b));
  return set;
}

function paragraph_(html) {
  return CardService.newTextParagraph().setText(html);
}

function muted_(html) {
  return '<font color="' + MUTED_COLOR_ + '">' + html + "</font>";
}

function warning_(html) {
  return '<font color="' + WARNING_COLOR_ + '">' + html + "</font>";
}

/** Labels, titles and dropdown items are plain text: remove anything that looks like markup. */
function plain_(text) {
  return String(text === undefined || text === null ? "" : text).replace(/[<>]/g, "");
}

function header_(title, subtitle) {
  const header = CardService.newCardHeader().setTitle(title);
  if (subtitle) header.setSubtitle(plain_(subtitle));
  return header;
}

function section_(title) {
  const section = CardService.newCardSection();
  if (title) section.setHeader(title);
  return section;
}

function dropdown_(name, title, items, selected, onChange) {
  const input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName(name)
    .setTitle(title);
  items.forEach((item) => input.addItem(plain_(item.label), String(item.value), String(item.value) === String(selected)));
  if (onChange) input.setOnChangeAction(onChange);
  return input;
}

function switchRow_(name, label, description, selected, onChange) {
  const control = CardService.newSwitch().setFieldName(name).setValue("on").setSelected(!!selected);
  if (onChange) control.setOnChangeAction(onChange);
  const row = CardService.newDecoratedText().setText(label).setWrapText(true).setSwitchControl(control);
  if (description) row.setBottomLabel(description);
  return row;
}

function textInput_(name, title, value, hint, onChange) {
  const input = CardService.newTextInput().setFieldName(name).setTitle(title);
  if (value !== undefined && value !== null && value !== "") input.setValue(String(value));
  if (hint) input.setHint(hint);
  if (onChange) input.setOnChangeAction(onChange);
  return input;
}

function attributionParagraph_() {
  return paragraph_(
    muted_(
      'Prayer times by <a href="https://aladhan.com/">AlAdhan</a>. Location search by ' +
        '<a href="https://open-meteo.com/">Open-Meteo.com</a> with data from ' +
        '<a href="https://www.geonames.org/">GeoNames</a> ' +
        '(<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>).'
    )
  );
}

// ---------------------------------------------------------------------------
// Choice lists
// ---------------------------------------------------------------------------

function minutesLabel_(minutes) {
  if (minutes >= 60 && minutes % 60 === 0) return minutes / 60 + (minutes === 60 ? " hour" : " hours");
  return minutes + (minutes === 1 ? " minute" : " minutes");
}

function reminderItems_(current) {
  const values = REMINDER_CHOICES_.slice();
  if (current !== null && values.indexOf(current) === -1) values.push(current);
  return values.map((minutes) => ({
    value: minutes === null ? "none" : minutes,
    label: minutes === null ? "No reminder" : minutes === 0 ? "At the time of the event" : minutesLabel_(minutes) + " before",
  }));
}

function durationItems_(current) {
  const values = DURATION_CHOICES_.slice();
  if (values.indexOf(current) === -1) values.push(current);
  return values.sort((a, b) => a - b).map((minutes) => ({ value: minutes, label: minutesLabel_(minutes) }));
}

function daysAheadItems_(current) {
  const values = DAYS_AHEAD_CHOICES_.slice();
  if (values.indexOf(current) === -1) values.push(current);
  return values.sort((a, b) => a - b).map((days) => ({ value: days, label: days + (days === 1 ? " day" : " days") }));
}

function hijriAdjustmentItems_() {
  return HIJRI_ADJUSTMENT_CHOICES_.map((days) => ({
    value: days,
    label: days === 0 ? "None" : (days > 0 ? "+" : "") + days + (Math.abs(days) === 1 ? " day" : " days"),
  }));
}

/** The calendar dropdown: the add-on's own calendar first, then the calendars the user owns. */
function calendarItems_(settings, calendars) {
  const items = [{
    value: DEDICATED_CALENDAR_,
    label: settings.dedicatedCalendarId ? APP_.calendarName + " (made by this add-on)" : "New calendar named " + APP_.calendarName + " (recommended)",
  }];
  calendars.forEach((calendar) => {
    if (calendar.id === settings.dedicatedCalendarId) return;
    items.push({ value: calendar.id, label: calendar.primary ? calendar.name + " (main calendar)" : calendar.name });
  });
  const selected = selectedCalendarValue_(settings, calendars);
  if (!items.some((item) => item.value === selected)) items.push({ value: selected, label: "The calendar chosen before" });
  return items;
}

function selectedCalendarValue_(settings, calendars) {
  if (settings.calendar === DEDICATED_CALENDAR_ || settings.calendar === settings.dedicatedCalendarId) return DEDICATED_CALENDAR_;
  if (settings.calendar === "primary") {
    const primary = calendars.filter((calendar) => calendar.primary)[0];
    return primary ? primary.id : "primary";
  }
  return settings.calendar;
}

/** Fields shown on setup step 2 and on the settings card. Built on call, not at load time. */
function setupFields_() {
  return [
    FIELD_.method, FIELD_.school, FIELD_.prayers, FIELD_.reminder, FIELD_.calendar, FIELD_.autoSync,
    FIELD_.duration, FIELD_.showAsFree, FIELD_.daysAhead, FIELD_.jumuah, FIELD_.ramadan,
  ];
}

function settingsFields_() {
  return setupFields_().concat(
    [FIELD_.jumuahTime, FIELD_.hijriAdjustment, FIELD_.highLatitudeRule],
    DAILY_EVENTS_.map((name) => OFFSET_FIELD_PREFIX_ + name)
  );
}

// ---------------------------------------------------------------------------
// Sections shared by setup and settings
// ---------------------------------------------------------------------------

function locationSection_(settings, changeAction) {
  const location = settings.location;
  const zone = location && location.timezone ? "Time zone: " + location.timezone : "The time zone is looked up at the next sync.";
  return section_("Location")
    .addWidget(
      CardService.newDecoratedText()
        .setText(location ? escapeHtml_(formatPlaceName_(location)) : "Not set")
        .setBottomLabel(plain_(zone))
        .setWrapText(true)
        .setButton(button_("Change", changeAction))
    )
    .addWidget(attributionParagraph_());
}

function calculationSection_(settings, onChange) {
  const country = settings.location && settings.location.country;
  const hint = !settings.methodChosen && country
    ? "Suggested for " + escapeHtml_(country) + ". Choose the method your local mosque uses."
    : "Choose the method your local mosque uses.";
  return section_("Prayer times")
    .addWidget(dropdown_(FIELD_.method, "Calculation method", METHODS_.map((m) => ({ value: m.id, label: m.name })), settings.method, onChange))
    .addWidget(paragraph_(muted_(hint)))
    .addWidget(dropdown_(FIELD_.school, "Asr time", SCHOOLS_.map((s) => ({ value: s.id, label: s.name })), settings.school, onChange));
}

function prayerCheckboxes_(settings, onChange) {
  const input = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName(FIELD_.prayers)
    .setTitle("Add to my calendar")
    .setOnChangeAction(onChange);
  DAILY_EVENTS_.forEach((name) => {
    const label = name === "Sunrise" ? "Sunrise (end of Fajr time)" : name;
    input.addItem(label, name, settings.prayers.indexOf(name) !== -1);
  });
  return input;
}

function calendarDropdown_(settings, calendars, onChange) {
  return dropdown_(FIELD_.calendar, "Calendar", calendarItems_(settings, calendars), selectedCalendarValue_(settings, calendars), onChange);
}

function autoSyncSwitch_(settings, onChange) {
  return switchRow_(FIELD_.autoSync, "Update automatically", "Adds the next days every night", settings.autoSync, onChange);
}

function eventOptionWidgets_(settings, onChange) {
  return [
    dropdown_(FIELD_.duration, "Event length", durationItems_(settings.durationMinutes), settings.durationMinutes, onChange),
    switchRow_(FIELD_.showAsFree, "Show as free", "Others can still book meetings at prayer times", settings.showAsFree, onChange),
    dropdown_(FIELD_.daysAhead, "Days to keep in the calendar", daysAheadItems_(settings.daysAhead), settings.daysAhead, onChange),
    switchRow_(FIELD_.jumuah, "Jumu'ah on Fridays", "Friday's Dhuhr event is called Jumu'ah", settings.jumuah, onChange),
    switchRow_(FIELD_.ramadan, "Suhoor and Iftar in Ramadan", "Adds when Suhoor ends and when to break the fast", settings.ramadan, onChange),
  ];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/**
 * Location card, used for setup step 1 (mode "setup") and for changing the
 * location from Settings (mode "settings").
 * model: { mode, suggestion, calendarTimeZone, query, places }
 */
function buildLocationCard_(model) {
  const setup = model.mode === "setup";
  const card = CardService.newCardBuilder()
    .setName("location")
    .setHeader(setup ? header_("Set up Prayer Times", "Step 1 of 2: your location") : header_("Change location"));

  if (setup) {
    card.addSection(
      section_().addWidget(
        paragraph_("Prayer Times adds the daily prayer times for your city to Google Calendar. You do not need an account or an API key.")
      )
    );
  }
  const showSuggestion = model.suggestion && !(model.places && model.places.length);
  if (showSuggestion) {
    card.addSection(
      section_("Suggested location")
        .addWidget(placeRow_(model.suggestion, model.mode, "Use"))
        .addWidget(paragraph_(muted_("Based on your calendar's time zone, " + escapeHtml_(model.calendarTimeZone) + ".")))
    );
  }

  const search = section_(showSuggestion ? "Or search for your city" : "Search for your city")
    .addWidget(textInput_(FIELD_.locationQuery, "City", model.query, "For example: Springfield, Illinois"))
    .addWidget(
      buttonRow_([
        filledButton_("Search", newAction_("onSearchLocation", { mode: model.mode })),
        button_("Enter coordinates", newAction_("onShowCoordinates", { mode: model.mode })),
      ])
    );
  if (!setup) search.addWidget(buttonRow_([button_("Cancel", newAction_("onCancel"))]));
  card.addSection(search);

  if (model.places) {
    const results = section_(model.places.length ? "Results" : "No results");
    if (!model.places.length) {
      results.addWidget(
        paragraph_(
          "No places found for " + escapeHtml_(model.query) + ". Check the spelling, try a nearby larger town, or add the country after a comma."
        )
      );
    }
    model.places.forEach((place) => results.addWidget(placeRow_(place, model.mode, "Select")));
    card.addSection(results);
  }
  card.addSection(section_().addWidget(attributionParagraph_()));
  return card.build();
}

/** One place: city in bold, then region and country. */
function placeRow_(place, mode, buttonText) {
  const parameters = { mode: mode, place: JSON.stringify(placeToLocation_(place)) };
  const row = CardService.newDecoratedText()
    .setText("<b>" + escapeHtml_(place.name) + "</b>")
    .setWrapText(true)
    .setButton(button_(buttonText, newAction_("onSelectPlace", parameters)));
  const detail = formatPlaceDetail_(place);
  if (detail) row.setBottomLabel(plain_(detail));
  return row;
}

function buildCoordinatesCard_(mode) {
  return CardService.newCardBuilder()
    .setName("coordinates")
    .setHeader(header_("Enter coordinates"))
    .addSection(
      section_()
        .addWidget(paragraph_("In Google Maps, right-click your location and click the coordinates at the top of the menu to copy them. Then paste them here."))
        .addWidget(textInput_(FIELD_.coordinates, "Latitude, longitude", "", "For example: 47.4979, 19.0402"))
        .addWidget(textInput_(FIELD_.placeName, "Name (optional)", "", "For example: Home"))
        .addWidget(
          buttonRow_([
            filledButton_("Save", newAction_("onSaveCoordinates", { mode: mode })),
            button_("Cancel", newAction_("onCancel")),
          ])
        )
    )
    .build();
}

/**
 * Setup step 2. model: { settings, calendars }
 */
function buildPreferencesCard_(model) {
  const settings = model.settings;
  const fields = setupFields_();
  const onChange = saveAction_(fields, "setup");
  const card = CardService.newCardBuilder()
    .setName("preferences")
    .setHeader(header_("Set up Prayer Times", "Step 2 of 2: your preferences"))
    .addSection(locationSection_(settings, newAction_("onBackToLocation")))
    .addSection(calculationSection_(settings, onChange))
    .addSection(
      section_("Calendar")
        .addWidget(prayerCheckboxes_(settings, onChange))
        .addWidget(dropdown_(FIELD_.reminder, "Reminder", reminderItems_(settings.reminderMinutes), settings.reminderMinutes === null ? "none" : settings.reminderMinutes, onChange))
        .addWidget(calendarDropdown_(settings, model.calendars, onChange))
        .addWidget(autoSyncSwitch_(settings, onChange))
    );
  const more = section_("More options").setCollapsible(true).setNumUncollapsibleWidgets(0);
  eventOptionWidgets_(settings, onChange).forEach((widget) => more.addWidget(widget));
  card.addSection(more);
  card.setFixedFooter(
    CardService.newFixedFooter()
      .setPrimaryButton(filledButton_("Add to my calendar", newAction_("onFinishSetup", { fields: fields.join(",") })))
      .setSecondaryButton(button_("Back", newAction_("onBackToLocation")))
  );
  return card.build();
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/**
 * model: { settings, state, prefs: {timeZone, use24h}, nowMs, today, days, error }
 * days holds today and tomorrow.
 */
function buildHomeCard_(model) {
  const settings = model.settings;
  const card = CardService.newCardBuilder()
    .setName("home")
    .setHeader(header_(APP_.name, formatPlaceName_(settings.location)))
    .addSection(todaySection_(model));
  if (settings.location) card.addSection(qiblaSection_(settings.location));
  card.addSection(calendarStatusSection_(model));
  card.addSection(section_().addWidget(attributionParagraph_()));
  card.setFixedFooter(
    CardService.newFixedFooter()
      .setPrimaryButton(filledButton_("Sync now", newAction_("onSyncNow", { view: "home" })))
      .setSecondaryButton(button_("Settings", newAction_("onOpenSettings")))
  );
  return card.build();
}

function todaySection_(model) {
  const section = section_("Today");
  if (model.error || !model.days || !model.days.length) {
    section.addWidget(paragraph_(warning_(escapeHtml_(model.error || "Prayer times are not available right now."))));
    section.addWidget(buttonRow_([button_("Try again", newAction_("onRefreshHome"))]));
    return section;
  }
  const settings = model.settings;
  const use24h = model.prefs.use24h;
  const today = model.days[0];
  const next = findNextPrayer_(model.days, settings, model.nowMs);

  let intro = "<b>" + formatLongDate_(today.date) + "</b>";
  const hijri = formatHijriDate_(today.hijri);
  if (hijri) intro += "<br>" + escapeHtml_(hijri) + (isRamadan_(today.hijri) ? ". Ramadan Mubarak." : "");
  section.addWidget(paragraph_(intro));

  if (next) {
    const day = next.date === today.date ? "" : "Tomorrow, ";
    section.addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Next prayer")
        .setText("<b>" + escapeHtml_(next.title) + " at " + formatClock_(next.minutes, use24h) + "</b>")
        .setBottomLabel(day + "in " + formatDuration_((next.epochMs - model.nowMs) / 60000))
        .setWrapText(true)
    );
  }

  scheduleForDay_(today, settings).forEach((row) => {
    const isNext = next && next.date === today.date && next.slot === row.slot && next.title === row.title;
    let time = formatClock_(row.minutes, use24h);
    if (isNext) time = "<b>" + time + "</b>";
    else if (row.epochMs <= model.nowMs) time = muted_(time);
    section.addWidget(CardService.newDecoratedText().setTopLabel(row.title).setText(time));
  });

  const zone = settings.location && settings.location.timezone;
  if (zone && model.prefs.timeZone && normalizeTimeZone_(zone) !== normalizeTimeZone_(model.prefs.timeZone)) {
    section.addWidget(
      paragraph_(
        muted_(
          "Times are local to " + escapeHtml_(settings.location.name) + " (" + escapeHtml_(zone) +
            "). Your calendar shows events in its own time zone, " + escapeHtml_(model.prefs.timeZone) + "."
        )
      )
    );
  }
  return section;
}

function qiblaSection_(location) {
  const bearing = qiblaBearing_(location.latitude, location.longitude);
  return section_("Qibla").addWidget(
    CardService.newDecoratedText()
      .setTopLabel("Direction of the Kaaba")
      .setText((Math.round(bearing) % 360) + "° " + compassName_(bearing))
      .setBottomLabel("Measured clockwise from true north")
      .setWrapText(true)
  );
}

function calendarStatusSection_(model) {
  const settings = model.settings;
  const state = model.state;
  const lines = [];
  const name = state.calendarName || (settings.calendar === DEDICATED_CALENDAR_ ? APP_.calendarName : "your calendar");
  if (!state.lastSyncAt) {
    lines.push("Prayer times are not in your calendar yet. Select Sync now.");
  } else if (state.syncedThrough && (!model.today || state.syncedThrough >= model.today)) {
    lines.push("Prayer times are in <b>" + escapeHtml_(name) + "</b> through " + formatLongDate_(state.syncedThrough) + ".");
  } else {
    lines.push("There are no upcoming prayer times in your calendar. Select Sync now.");
  }
  lines.push(settings.autoSync ? "New days are added automatically every night." : "Automatic updates are off. You can turn them on in Settings.");
  if (state.pendingChanges) lines.push("<b>Your settings changed.</b> Select Sync now to update your calendar.");
  if (state.lastError) lines.push(warning_("Last sync problem: " + escapeHtml_(state.lastError)));
  return section_("Your calendar").addWidget(paragraph_(lines.join("<br>")));
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** model: { settings, state, calendars } */
function buildSettingsCard_(model) {
  const settings = model.settings;
  const fields = settingsFields_();
  const onChange = saveAction_(fields, "settings");
  const card = CardService.newCardBuilder()
    .setName("settings")
    .setHeader(header_("Settings", "Changes are saved as you make them"))
    .addSection(locationSection_(settings, newAction_("onOpenLocationSearch")))
    .addSection(calculationSection_(settings, onChange));

  const events = section_("Calendar")
    .addWidget(prayerCheckboxes_(settings, onChange))
    .addWidget(dropdown_(FIELD_.reminder, "Reminder", reminderItems_(settings.reminderMinutes), settings.reminderMinutes === null ? "none" : settings.reminderMinutes, onChange))
    .addWidget(calendarDropdown_(settings, model.calendars, onChange))
    .addWidget(autoSyncSwitch_(settings, onChange));
  const options = eventOptionWidgets_(settings, onChange);
  options.slice(0, 3).forEach((widget) => events.addWidget(widget));
  card.addSection(events);

  const special = section_("Friday and Ramadan");
  options.slice(3).forEach((widget) => special.addWidget(widget));
  special
    .addWidget(textInput_(FIELD_.jumuahTime, "Jumu'ah time (optional)", settings.jumuahTime, "Leave empty to use the Dhuhr time, or enter a time such as 13:30", onChange))
    .addWidget(dropdown_(FIELD_.hijriAdjustment, "Hijri date adjustment", hijriAdjustmentItems_(), settings.hijriAdjustment, onChange))
    .addWidget(paragraph_(muted_("Moves the Hijri date, and so the days of Ramadan, to match the moon sighting where you live.")));
  card.addSection(special);

  const tuning = section_("Fine-tuning").setCollapsible(true).setNumUncollapsibleWidgets(0);
  tuning.addWidget(paragraph_(muted_("Add or subtract minutes to match your local mosque's timetable.")));
  DAILY_EVENTS_.forEach((name) => {
    tuning.addWidget(textInput_(OFFSET_FIELD_PREFIX_ + name, name + " (minutes)", settings.offsets[name], "0", onChange));
  });
  tuning
    .addWidget(dropdown_(FIELD_.highLatitudeRule, "High latitude rule", HIGH_LATITUDE_RULES_.map((r) => ({ value: r.id, label: r.name })), settings.highLatitudeRule, onChange))
    .addWidget(paragraph_(muted_("Used where Fajr and Isha are hard to calculate, roughly north of 48 degrees or south of -48 degrees.")));
  card.addSection(tuning);

  card.addSection(
    section_("Remove")
      .addWidget(paragraph_("Remove every event this add-on created, or start over with new settings."))
      .addWidget(
        buttonRow_([
          button_("Remove prayer events", newAction_("onConfirmRemoveEvents")),
          button_("Reset add-on", newAction_("onConfirmReset")),
        ])
      )
  );
  card.setFixedFooter(
    CardService.newFixedFooter()
      .setPrimaryButton(filledButton_("Done", newAction_("onCloseSettings", { fields: fields.join(",") })))
      .setSecondaryButton(button_("Sync now", newAction_("onSyncNow", { view: "settings", fields: fields.join(",") })))
  );
  return card.build();
}

/** model: { calendarNames } */
function buildConfirmRemoveCard_(model) {
  const names = model.calendarNames.length ? model.calendarNames.map(escapeHtml_).join(", ") : "your calendar";
  return CardService.newCardBuilder()
    .setName("confirmRemove")
    .setHeader(header_("Remove prayer events"))
    .addSection(
      section_()
        .addWidget(
          paragraph_(
            "This deletes every event Prayer Times added, past and future, from <b>" + names + "</b>. " +
              "Your own events are not touched.<br><br>Automatic updates are turned off. Select Sync now later to add the events again."
          )
        )
        .addWidget(
          buttonRow_([
            filledButton_("Remove events", newAction_("onRemoveEvents")),
            button_("Cancel", newAction_("onCancel")),
          ])
        )
    )
    .build();
}

function buildConfirmResetCard_() {
  return CardService.newCardBuilder()
    .setName("confirmReset")
    .setHeader(header_("Reset Prayer Times"))
    .addSection(
      section_()
        .addWidget(
          paragraph_(
            "This clears your Prayer Times settings and turns off automatic updates. Events already in your calendar stay. " +
              "To delete them as well, use Remove prayer events first."
          )
        )
        .addWidget(
          buttonRow_([
            filledButton_("Reset", newAction_("onResetAddOn")),
            button_("Cancel", newAction_("onCancel")),
          ])
        )
    )
    .build();
}

function buildErrorCard_(message) {
  return CardService.newCardBuilder()
    .setName("error")
    .setHeader(header_(APP_.name))
    .addSection(
      section_()
        .addWidget(paragraph_(warning_(escapeHtml_(message))))
        .addWidget(buttonRow_([button_("Try again", newAction_("onRefreshHome"))]))
    )
    .build();
}
