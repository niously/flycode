#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const source = process.argv[2];
if (!source) {
  console.error('用法：node scripts/prepare-d1-import.js <公开状态 JSON 文件>');
  process.exit(2);
}

const inputPath = path.resolve(source);
const outputPath = path.resolve(path.dirname(inputPath), 'flycode-d1-import.sql');
const publicState = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const now = new Date().toISOString();

const state = {
  schemaVersion: 1,
  project: publicState.project || {},
  phases: Array.isArray(publicState.phases) ? publicState.phases : [],
  proposals: Array.isArray(publicState.proposals) ? publicState.proposals.map(({ voteCount, ...proposal }) => proposal) : [],
  updates: Array.isArray(publicState.updates) ? publicState.updates : [],
  votes: {}
};

for (const phase of state.phases) {
  phase.candidates = Array.isArray(phase.candidates) ? phase.candidates : [];
}

const payload = JSON.stringify(state).replace(/'/g, "''");
const sql = `INSERT INTO flycode_state (id, payload, updated_at)\nVALUES ('main', '${payload}', '${now}')\nON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at;\n`;
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(JSON.stringify({ outputPath, project: state.project.name, phases: state.phases.length, proposals: state.proposals.length, updates: state.updates.length }, null, 2));
