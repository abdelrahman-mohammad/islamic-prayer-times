"use strict";

/**
 * Loads the add-on's .gs files the way Apps Script does: every file is a
 * separate script in one shared global scope, run in file name order. Each
 * test file runs in its own Node.js process, so the globals do not leak
 * between test files.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC_DIR = path.join(__dirname, "..", "..", "src");

function sourceFiles() {
  return fs
    .readdirSync(SRC_DIR)
    .filter((file) => file.endsWith(".gs"))
    .sort();
}

/**
 * Puts the given fake Apps Script services on the global object, runs every
 * .gs file, and returns a getter for top-level names, including const
 * declarations that do not become properties of globalThis.
 */
function loadAddOn(globals) {
  Object.assign(globalThis, globals || {});
  sourceFiles().forEach((file) => {
    const code = fs.readFileSync(path.join(SRC_DIR, file), "utf8");
    vm.runInThisContext(code, { filename: path.join("src", file) });
  });
  return (name) => vm.runInThisContext(name);
}

module.exports = { loadAddOn, sourceFiles, SRC_DIR };
