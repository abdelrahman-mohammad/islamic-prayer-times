"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAddOn } = require("./helpers/load");
const springfield = require("./fixtures/open-meteo-springfield.json");
const budapest = require("./fixtures/open-meteo-budapest.json");
const geocodeError = require("./fixtures/open-meteo-error.json");

loadAddOn();

test("buildGeocodeUrl_ calls Open-Meteo without a key", () => {
  assert.equal(
    buildGeocodeUrl_("  Springfield, Illinois ", 10),
    "https://geocoding-api.open-meteo.com/v1/search?name=Springfield%2C%20Illinois&count=10&language=en&format=json"
  );
  assert.doesNotMatch(buildGeocodeUrl_("Paris"), /key/i);
});

test("parseGeocodeResults_ keeps city, region, country and time zone", () => {
  const places = parseGeocodeResults_(springfield);
  assert.equal(places.length, 4);
  assert.deepEqual(places[0], {
    name: "Springfield",
    region: "Illinois",
    country: "United States",
    countryCode: "US",
    latitude: 39.8017,
    longitude: -89.6437,
    timezone: "America/Chicago",
    population: 114394,
  });
  // Open-Meteo leaves out empty fields.
  assert.equal(places[3].region, "");
  assert.equal(places[3].population, 0);
});

test("parseGeocodeResults_ handles no results and API errors", () => {
  assert.deepEqual(parseGeocodeResults_({ generationtime_ms: 0.4 }), []);
  assert.deepEqual(parseGeocodeResults_(null), []);
  assert.throws(() => parseGeocodeResults_(geocodeError), /Parameter count must be between 1 and 100/);
  assert.deepEqual(parseGeocodeResults_({ results: [{ name: "No coordinates" }, { latitude: 1, longitude: 2 }] }), []);
});

test("formatPlaceName_ and formatPlaceDetail_ show city, region and country", () => {
  const places = parseGeocodeResults_(springfield);
  assert.equal(formatPlaceName_(places[1]), "Springfield, Missouri, United States");
  assert.equal(formatPlaceDetail_(places[1]), "Missouri, United States");
  assert.equal(formatPlaceName_(places[3]), "Springfield, Australia");
  const city = parseGeocodeResults_(budapest)[0];
  assert.equal(formatPlaceName_(city), "Budapest, Hungary");
  assert.equal(formatPlaceDetail_(city), "Hungary");
  assert.equal(formatPlaceName_(null), "");
});

test("fallbackQuery_ drops the part after the first comma", () => {
  assert.equal(fallbackQuery_("Springfield, IL"), "Springfield");
  assert.equal(fallbackQuery_("Springfield"), null);
  assert.equal(fallbackQuery_("X, Y"), null);
  assert.equal(fallbackQuery_(""), null);
});

test("placeToLocation_ keeps only what settings need", () => {
  const place = parseGeocodeResults_(budapest)[0];
  assert.deepEqual(placeToLocation_(place), {
    name: "Budapest",
    region: "Budapest",
    country: "Hungary",
    countryCode: "HU",
    latitude: 47.4984,
    longitude: 19.0405,
    timezone: "Europe/Budapest",
  });
});

test("timeZoneCityName_ finds the city in a time zone name", () => {
  assert.equal(timeZoneCityName_("America/New_York"), "New York");
  assert.equal(timeZoneCityName_("Europe/Budapest"), "Budapest");
  assert.equal(timeZoneCityName_("America/Argentina/Buenos_Aires"), "Buenos Aires");
  assert.equal(timeZoneCityName_("America/Indiana/Indianapolis"), "Indianapolis");
  assert.equal(timeZoneCityName_("Asia/Calcutta"), "Kolkata");
  assert.equal(timeZoneCityName_("US/Eastern"), "New York");
  assert.equal(timeZoneCityName_("Etc/UTC"), null);
  assert.equal(timeZoneCityName_("Etc/GMT+5"), null);
  assert.equal(timeZoneCityName_("UTC"), null);
  assert.equal(timeZoneCityName_(""), null);
  assert.equal(timeZoneCityName_(undefined), null);
});

test("pickPlaceForTimeZone_ only suggests a place in the same time zone", () => {
  const places = parseGeocodeResults_(budapest);
  assert.equal(pickPlaceForTimeZone_(places, "Europe/Budapest").countryCode, "HU");
  assert.equal(pickPlaceForTimeZone_(places, "America/New_York").region, "Georgia");
  assert.equal(pickPlaceForTimeZone_(places, "Asia/Tokyo"), null);
  const chicago = pickPlaceForTimeZone_(parseGeocodeResults_(springfield), "America/Chicago");
  assert.equal(chicago.region, "Missouri", "the most populous match wins");
  assert.equal(normalizeTimeZone_("Europe/Kiev"), "Europe/Kyiv");
});

test("suggestMethod_ and suggestSchool_ follow the country", () => {
  assert.equal(suggestMethod_("US"), 2);
  assert.equal(suggestMethod_("ca"), 2);
  assert.equal(suggestMethod_("SA"), 4);
  assert.equal(suggestMethod_("EG"), 5);
  assert.equal(suggestMethod_("PK"), 1);
  assert.equal(suggestMethod_("TR"), 13);
  assert.equal(suggestMethod_("MY"), 17);
  assert.equal(suggestMethod_("ID"), 20);
  assert.equal(suggestMethod_("HU"), 3);
  assert.equal(suggestMethod_(""), 3);
  assert.equal(suggestMethod_(undefined), 3);
  assert.equal(suggestMethod_("hasOwnProperty"), 3);
  assert.equal(suggestSchool_("PK"), 1);
  assert.equal(suggestSchool_("in"), 1);
  assert.equal(suggestSchool_("TR"), 0);
  assert.equal(suggestSchool_(""), 0);
});

test("every suggested method is a method the add-on offers", () => {
  const offered = gasMethods();
  Object.values(COUNTRY_METHOD_).forEach((id) => assert.ok(offered.includes(id), "method " + id));
  assert.equal(new Set(offered).size, offered.length, "method IDs are unique");
  assert.ok(!offered.includes(6) && !offered.includes(99), "no undocumented or custom methods");
  assert.equal(methodName_(3), "Muslim World League");
  assert.equal(methodName_(42), "Method 42");
});

function gasMethods() {
  return METHODS_.map((m) => m.id);
}

test("parseCoordinates_ reads pasted coordinates", () => {
  assert.deepEqual(parseCoordinates_("47.4979, 19.0402"), { latitude: 47.4979, longitude: 19.0402 });
  assert.deepEqual(parseCoordinates_("-33.86882 151.20929"), { latitude: -33.8688, longitude: 151.2093 });
  assert.deepEqual(parseCoordinates_("40.7128° N, 74.0060° W"), { latitude: 40.7128, longitude: -74.006 });
  assert.deepEqual(parseCoordinates_("33.9 S; 18.4 E"), { latitude: -33.9, longitude: 18.4 });
  assert.deepEqual(parseCoordinates_("21.4225,39.8262"), { latitude: 21.4225, longitude: 39.8262 });
  ["", "hello", "91, 0", "0, 181", "47.4979", "47,4979, 19,0402", null].forEach((text) => {
    assert.equal(parseCoordinates_(text), null, String(text));
  });
});

test("qiblaBearing_ matches published Qibla directions", () => {
  const cases = [
    [40.7128, -74.006, 58.48],
    [51.5074, -0.1278, 118.99],
    [-33.8688, 151.2093, 277.5],
    [-6.2088, 106.8456, 295.15],
    [35.6762, 139.6503, 293.0],
  ];
  cases.forEach(([lat, lon, expected]) => {
    const bearing = qiblaBearing_(lat, lon);
    assert.ok(Math.abs(bearing - expected) < 0.1, `${lat},${lon}: ${bearing}`);
  });
  const fromMedina = qiblaBearing_(24.4672, 39.6111);
  assert.ok(fromMedina > 170 && fromMedina < 180, "Makkah is almost due south of Madinah");
});

test("compassName_ uses eight directions", () => {
  assert.equal(compassName_(0), "north");
  assert.equal(compassName_(22.4), "north");
  assert.equal(compassName_(22.6), "northeast");
  assert.equal(compassName_(118.99), "southeast");
  assert.equal(compassName_(277.5), "west");
  assert.equal(compassName_(359), "north");
  assert.equal(compassName_(-10), "north");
});
