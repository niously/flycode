function hasValue(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function resolveStorageConfig(env = process.env) {
  const requested = hasValue(env.FLYCODE_STORAGE) ? env.FLYCODE_STORAGE.trim().toLowerCase() : '';
  if (requested) {
    if (['json', 'cloudbase', 'postgres'].includes(requested)) return requested;
    throw new Error('FLYCODE_STORAGE 必须是 json、cloudbase 或 postgres。');
  }
  if (hasValue(env.FLYCODE_DATABASE_URL) || hasValue(env.DATABASE_URL)
    || ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].every((name) => hasValue(env[name]))) {
    return 'postgres';
  }
  if (hasValue(env.FLYCODE_CLOUDBASE_API_KEY)) return 'cloudbase';
  return 'json';
}

function postgresConfig(env = process.env) {
  const connectionString = env.FLYCODE_DATABASE_URL || env.DATABASE_URL;
  if (hasValue(connectionString)) {
    return {
      connectionString: connectionString.trim(),
      ssl: env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
    };
  }

  const required = ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
  const missing = required.filter((name) => !hasValue(env[name]));
  if (missing.length) return null;
  return {
    host: env.PGHOST.trim(),
    port: Number(env.PGPORT || 5432),
    database: env.PGDATABASE.trim(),
    user: env.PGUSER.trim(),
    password: env.PGPASSWORD,
    ssl: env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
  };
}

module.exports = { postgresConfig, resolveStorageConfig };
