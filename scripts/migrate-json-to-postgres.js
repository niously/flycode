#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(process.env.FLYCODE_DATA_DIR
  ? path.resolve(process.env.FLYCODE_DATA_DIR)
  : path.join(root, 'data'), 'db.json');
const schemaFile = path.join(root, 'db-schema.sql');

function databaseConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.FLYCODE_DATABASE_URL;
  if (connectionString) {
    return {
      connectionString,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
    };
  }

  const required = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) return null;
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
  };
}

const postgresConfig = databaseConfig();

if (!postgresConfig) {
  console.error('缺少 PostgreSQL 连接配置。设置 DATABASE_URL，或设置 PGHOST、PGPORT、PGDATABASE、PGUSER、PGPASSWORD。');
  process.exit(2);
}

if (!fs.existsSync(dataFile)) {
  console.error(`找不到 JSON 数据文件：${dataFile}`);
  process.exit(2);
}

function readJson() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (error) {
    throw new Error(`JSON 数据无效：${error.message}`);
  }
}

function asDate(value) {
  return value ? new Date(value) : null;
}

async function migrate() {
  const db = readJson();
  const client = new Client(postgresConfig);
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(schemaFile, 'utf8'));

    await client.query(
      `INSERT INTO projects (id, name, tagline, description, current_phase_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tagline = EXCLUDED.tagline,
         description = EXCLUDED.description, current_phase_id = EXCLUDED.current_phase_id`,
      ['flycode', db.project.name, db.project.tagline, db.project.description, db.project.currentPhaseId, asDate(db.project.createdAt)]
    );

    for (const phase of db.phases || []) {
      await client.query(
        `INSERT INTO phases (id, project_id, number, title, question, status, deadline,
           chosen_proposal_id, decision_note, created_at, decided_at)
         VALUES ($1, 'flycode', $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, title = EXCLUDED.title,
           question = EXCLUDED.question, status = EXCLUDED.status, deadline = EXCLUDED.deadline,
           chosen_proposal_id = EXCLUDED.chosen_proposal_id, decision_note = EXCLUDED.decision_note,
           created_at = EXCLUDED.created_at, decided_at = EXCLUDED.decided_at`,
        [phase.id, phase.number, phase.title, phase.question, phase.status, phase.deadline || null,
          phase.chosenProposalId, phase.decisionNote || '', asDate(phase.createdAt), asDate(phase.decidedAt)]
      );
    }

    for (const proposal of db.proposals || []) {
      await client.query(
        `INSERT INTO proposals (id, phase_id, title, description, author, link, status, created_at, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET phase_id = EXCLUDED.phase_id, title = EXCLUDED.title,
           description = EXCLUDED.description, author = EXCLUDED.author, link = EXCLUDED.link,
           status = EXCLUDED.status, created_at = EXCLUDED.created_at, reviewed_at = EXCLUDED.reviewed_at`,
        [proposal.id, proposal.phaseId, proposal.title, proposal.description, proposal.author || '', proposal.link || '',
          proposal.status, asDate(proposal.createdAt), asDate(proposal.reviewedAt)]
      );
    }

    for (const phase of db.phases || []) {
      for (const [position, proposalId] of (phase.candidates || []).entries()) {
        await client.query(
          `INSERT INTO phase_candidates (phase_id, proposal_id, position)
           VALUES ($1, $2, $3) ON CONFLICT (phase_id, proposal_id) DO UPDATE SET position = EXCLUDED.position`,
          [phase.id, proposalId, position]
        );
      }
    }

    for (const [phaseId, phaseVotes] of Object.entries(db.votes || {})) {
      for (const [visitorId, vote] of Object.entries(phaseVotes || {})) {
        await client.query(
          `INSERT INTO votes (phase_id, visitor_id, proposal_id, created_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT (phase_id, visitor_id) DO UPDATE SET proposal_id = EXCLUDED.proposal_id`,
          [phaseId, visitorId, vote.proposalId, asDate(vote.createdAt)]
        );
      }
    }

    for (const update of db.updates || []) {
      await client.query(
        `INSERT INTO updates (id, project_id, title, body, created_at)
         VALUES ($1, 'flycode', $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, created_at = EXCLUDED.created_at`,
        [update.id, update.title, update.body, asDate(update.createdAt)]
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, dataFile, project: db.project.name, phases: (db.phases || []).length,
      proposals: (db.proposals || []).length, votes: Object.values(db.votes || {}).reduce((n, votes) => n + Object.keys(votes || {}).length, 0) }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(`迁移失败：${error.message}`);
  process.exitCode = 1;
});
