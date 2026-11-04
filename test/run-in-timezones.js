"use strict";

/**
 * Runs the whole test suite with the process in several time zones. The
 * add-on must not depend on the time zone of the machine it runs on (Apps
 * Script runs in the script's zone, which may differ from the user's).
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const zones = ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Budapest"];
const testDir = __dirname;
const files = fs
  .readdirSync(testDir)
  .filter((file) => file.endsWith(".test.js"))
  .map((file) => path.join(testDir, file));

let failed = false;
zones.forEach((zone) => {
  const result = spawnSync(process.execPath, ["--test", ...files], {
    env: Object.assign({}, process.env, { TZ: zone }),
    encoding: "utf8",
  });
  const summary = (result.stdout.match(/^# (pass|fail) \d+$/gm) || []).join(", ");
  console.log(`${zone.padEnd(20)} ${summary}`);
  if (result.status !== 0) {
    failed = true;
    console.log(result.stdout.split("\n").filter((line) => /^not ok|Error|expected|actual/.test(line)).slice(0, 20).join("\n"));
  }
});
process.exit(failed ? 1 : 0);
