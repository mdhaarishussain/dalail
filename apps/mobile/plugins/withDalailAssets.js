/**
 * Bundles the corpus DB and the pinned e5 embedding model into the Android APK as uncompressed
 * assets (copied out to app storage on first launch). Runs at `expo prebuild`; no network.
 *
 *   APP_VARIANT=dev  (default) → dist/dalail.db must be a dev build
 *   APP_VARIANT=prod           → dist/prod/dalail.db must be a prod build
 *
 * Fails the prebuild if a file is missing, the DB's build_mode doesn't match the variant, or the
 * model's sha256 doesn't match config/models.json.
 */
const nodeCrypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod, withAppBuildGradle } = require('expo/config-plugins');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readMeta(dbPath) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return Object.fromEntries(
      db
        .prepare('SELECT key, value FROM meta')
        .all()
        .map((r) => [r.key, r.value]),
    );
  } finally {
    db.close();
  }
}

function sha256(file) {
  const h = nodeCrypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return h.digest('hex');
}

function resolveInputs(variant) {
  const dbPath =
    process.env.DALAIL_DB ||
    path.join(repoRoot, 'dist', variant === 'prod' ? 'prod' : '', 'dalail.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `[dalail] ${dbPath} not found. Build it first: cd pipeline && uv run python -m dalail_pipeline build --${variant}` +
        (variant === 'prod' ? ' --out ../dist/prod' : ''),
    );
  }
  const meta = readMeta(dbPath);
  if (meta.build_mode !== variant) {
    throw new Error(`[dalail] ${dbPath} is a ${meta.build_mode} build but APP_VARIANT=${variant}`);
  }
  const model = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'config', 'models.json'), 'utf8'),
  ).embedding;
  const modelPath = path.join(repoRoot, 'models', model.file);
  if (meta.embed_model === 'none') {
    return { dbPath, meta, model: null, modelPath: null };
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `[dalail] ${modelPath} not found. Run: uv run python -m dalail_pipeline fetch-model`,
    );
  }
  if (meta.embed_model_sha256 !== model.sha256) {
    throw new Error('[dalail] the DB was embedded with a different model than config/models.json');
  }
  if (sha256(modelPath) !== model.sha256) {
    throw new Error(`[dalail] ${modelPath} does not match the pinned sha256`);
  }
  return { dbPath, meta, model, modelPath };
}

const withDalailAssets = (config) => {
  const variant = process.env.APP_VARIANT === 'prod' ? 'prod' : 'dev';

  config = withDangerousMod(config, [
    'android',
    async (c) => {
      const { dbPath, model, modelPath } = resolveInputs(variant);
      const assets = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(path.join(assets, 'custom'), { recursive: true });
      fs.copyFileSync(dbPath, path.join(assets, 'custom', 'dalail.db'));
      if (model && modelPath) {
        fs.mkdirSync(path.join(assets, 'models'), { recursive: true });
        fs.copyFileSync(modelPath, path.join(assets, 'models', model.file));
      }
      return c;
    },
  ]);

  // Keep the DB and GGUF uncompressed in the APK (fast copy-out, smaller install-time work).
  config = withAppBuildGradle(config, (c) => {
    const marker = '// dalail: noCompress';
    if (!c.modResults.contents.includes(marker)) {
      c.modResults.contents += `\n${marker}\nandroid {\n    androidResources {\n        noCompress += ['db', 'gguf']\n    }\n}\n`;
    }
    return c;
  });
  return config;
};

module.exports = withDalailAssets;
module.exports.resolveInputs = resolveInputs;
