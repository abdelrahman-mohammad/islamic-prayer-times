"use strict";

/** Checks on the manifest and the source files that need no Apps Script at all. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { sourceFiles, SRC_DIR } = require("./helpers/load");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "appsscript.json"), "utf8"));
const sources = Object.fromEntries(sourceFiles().map((file) => [file, fs.readFileSync(path.join(SRC_DIR, file), "utf8")]));
const allSource = Object.values(sources).join("\n");
const EMOJI = /\p{Extended_Pictographic}/u;

test("the manifest declares a Calendar add-on with a homepage and no event trigger", () => {
  assert.equal(manifest.runtimeVersion, "V8");
  assert.equal(manifest.addOns.common.homepageTrigger.runFunction, "onHomepage");
  assert.equal(manifest.addOns.calendar.homepageTrigger.runFunction, "onHomepage");
  assert.equal(manifest.addOns.calendar.eventOpenTrigger, undefined);
  assert.match(allSource, /^function onHomepage\(e\)/m);
  assert.doesNotMatch(allSource, /function onEventOpen/);
  assert.deepEqual(manifest.dependencies.enabledAdvancedServices, [{ userSymbol: "Calendar", version: "v3", serviceId: "calendar" }]);
});

test("the manifest asks only for the scopes the add-on uses", () => {
  assert.deepEqual(manifest.oauthScopes.slice().sort(), [
    "https://www.googleapis.com/auth/calendar.addons.execute",
    "https://www.googleapis.com/auth/calendar.app.created",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events.owned",
    "https://www.googleapis.com/auth/calendar.settings.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
  ]);
});

test("every fetched host is https and in urlFetchWhitelist", () => {
  manifest.urlFetchWhitelist.forEach((prefix) => assert.match(prefix, /^https:\/\/[a-z0-9.-]+\/(.+\/)?$/, prefix));
  const urls = [...allSource.matchAll(/"(https?:\/\/[^"\s]+)"/g)].map((m) => m[1]);
  const fetched = urls.filter((url) => /aladhan\.com\/v1|open-meteo\.com\/v1|googleapis\.com\/calendar/.test(url));
  assert.ok(fetched.length >= 3);
  // The constants are base URLs; the add-on appends paths such as /calendars/... to them.
  fetched.forEach((url) => assert.ok(manifest.urlFetchWhitelist.some((prefix) => (url + "/").startsWith(prefix)), url));
  assert.doesNotMatch(allSource, /http:\/\//, "no plain http anywhere");
});

test("links shown on cards are allowed by openLinkUrlPrefixes", () => {
  const links = [...allSource.matchAll(/href=\\?"(https:\/\/[^"\\]+)/g)].map((m) => m[1]);
  assert.ok(links.length > 0);
  links.forEach((link) => assert.ok(manifest.addOns.common.openLinkUrlPrefixes.some((prefix) => link.startsWith(prefix)), link));
});

test("no API keys, Geoapify or shared script properties are used", () => {
  assert.doesNotMatch(allSource, /geoapify\.com/i);
  assert.doesNotMatch(allSource, /apiKey|api_key/);
  const scriptProperties = allSource.match(/getScriptProperties\(\)/g) || [];
  assert.equal(scriptProperties.length, 1, "only to delete the old shared key");
  assert.match(allSource, /getScriptProperties\(\)\.deleteProperty\("GEOAPIFY_API_KEY"\)/);
});

test("no `parseInt(x) || default` that would turn 0 into the default", () => {
  assert.doesNotMatch(allSource, /parseInt\(/, "parseWholeNumber_ is used instead");
  // `Number(x) || 0` is fine: 0 stays 0. A non-zero default would replace a real 0.
  assert.doesNotMatch(allSource, /Number\([^)]*\)\s*\|\|\s*[1-9]/);
});

test("no emojis in the add-on, its docs or its tests", () => {
  const files = Object.keys(sources).map((file) => path.join(SRC_DIR, file));
  files.push(path.join(ROOT, "README.md"), path.join(ROOT, "CLAUDE.md"), path.join(SRC_DIR, "appsscript.json"));
  fs.readdirSync(__dirname).filter((f) => f.endsWith(".js")).forEach((f) => files.push(path.join(__dirname, f)));
  files.forEach((file) => {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => assert.doesNotMatch(line, EMOJI, `${path.relative(ROOT, file)}:${i + 1}`));
  });
});

test("the source files load in any order, as Apps Script does not promise one", () => {
  const files = Object.keys(sources);
  [files, files.slice().reverse()].forEach((order) => {
    const context = vm.createContext({});
    order.forEach((file) => vm.runInContext(sources[file], context, { filename: file }));
    assert.equal(typeof vm.runInContext("onHomepage", context), "function");
  });
});

test("every public function is an entry point; helpers end in an underscore", () => {
  const publicFunctions = [...allSource.matchAll(/^function (\w+)\s*\(/gm)].map((m) => m[1]).filter((name) => !name.endsWith("_"));
  const actions = new Set([...allSource.matchAll(/newAction_\("(\w+)"/g)].map((m) => m[1]));
  publicFunctions.forEach((name) => {
    const isEntryPoint = name === "onHomepage" || name === "syncPrayerTimes" || actions.has(name);
    assert.ok(isEntryPoint, `${name} is public but nothing calls it from outside`);
  });
  actions.forEach((name) => assert.ok(publicFunctions.includes(name), `action ${name} must be a public function`));
});
