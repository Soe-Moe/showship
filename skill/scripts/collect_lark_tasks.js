#!/usr/bin/env node
// Backward-compatible wrapper: same as `collect_tasks.js <since> <until> [--json out] --provider lark`.
// Prefer collect_tasks.js, which follows config.json "tasks.provider".
const path = require("path");
process.argv.push("--provider", "lark");
require(path.join(__dirname, "collect_tasks.js"));
