/**
 * Device services: opens the bundled corpus DB (op-sqlite, FTS5 + sqlite-vec compiled in) and
 * sets up e5 query embeddings (llama.rn). Everything is local; no network.
 */
import {
  ANDROID_DATABASE_PATH,
  moveAssetsDatabase,
  open,
  Storage,
  type Scalar,
} from '@op-engineering/op-sqlite';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import type { Row, SqlExecutor, SqlValue } from '@dalail/core';
import modelConfig from '../../../../config/models.json';
import { CorpusRepository } from '../data/repository';
import { configureUserStorage } from '../state/userStore';
import { createE5Embedder } from './e5';
import { ensureVerifiedModel, type ModelStatus } from './modelCopy';
import type { Services } from './ServicesContext';
import { detectTier } from './tier';

const DB_FILE = 'dalail.db';
const INSTALLED_KEY = 'dalail-installed-build';
const MODEL_VERIFIED_KEY = 'dalail-model-verified-build';

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

function toScalar(v: SqlValue): Scalar {
  return typeof v === 'bigint' ? Number(v) : v;
}

export async function initDeviceServices(): Promise<Services> {
  const t0 = Date.now();
  // User data (recents, bookmarks, saved questions, settings) lives in its own writable file.
  const kv = new Storage({ name: 'dalail-user.sqlite' });
  configureUserStorage({
    getItem: (k) => kv.getItemSync(k) ?? null,
    setItem: (k, v) => kv.setItemSync(k, v),
    removeItem: (k) => kv.removeItemSync(k),
  });

  // Copy the bundled DB (and model) out of the APK once per app build.
  const build = `${DeviceInfo.getVersion()}+${DeviceInfo.getBuildNumber()}`;
  const fresh = kv.getItemSync(INSTALLED_KEY) !== build;
  await moveAssetsDatabase({ filename: DB_FILE, path: 'custom', overwrite: fresh });
  let modelPath: string | null = null;
  let modelStatus: ModelStatus = 'not_bundled';
  if (Platform.OS === 'android') {
    const { file, sha256, size_bytes } = modelConfig.embedding;
    const dest = joinPath(ANDROID_DATABASE_PATH, file);
    const handle = () => new File(`file://${dest}`);
    const result = await ensureVerifiedModel(
      {
        copy: (overwrite) =>
          moveAssetsDatabase({ filename: file, path: 'models', overwrite }).then(() => undefined),
        sha256: async () => (handle().exists ? handle().digest('SHA-256') : null),
        size: () => (handle().exists ? (handle().size ?? null) : null),
        remove: () => {
          if (handle().exists) handle().delete();
        },
      },
      { sha256, sizeBytes: size_bytes },
      { fresh, verifiedForThisBuild: kv.getItemSync(MODEL_VERIFIED_KEY) === build },
    );
    modelStatus = result.status;
    if (result.status === 'verified') {
      modelPath = dest;
      kv.setItemSync(MODEL_VERIFIED_KEY, build);
    } else {
      kv.removeItemSync(MODEL_VERIFIED_KEY);
    }
  }
  kv.setItemSync(INSTALLED_KEY, build);

  const db = open({ name: DB_FILE });
  const exec: SqlExecutor = {
    all: async (sql, params = []) => (await db.execute(sql, params.map(toScalar))).rows as Row[],
  };
  const vecVersion = await exec
    .all('SELECT vec_version() AS v')
    .then((rows) => String(rows[0]?.v ?? '') || null)
    .catch(() => null);

  const repo = new CorpusRepository(exec);
  const meta = await repo.meta();
  const embedQuery =
    meta.embedModel !== 'none' && vecVersion && modelPath
      ? createE5Embedder(modelPath, modelConfig.embedding)
      : null;

  const totalMemory = await DeviceInfo.getTotalMemory().catch(() => null);
  return {
    repo,
    meta,
    embedQuery,
    detectedTier: detectTier(totalMemory),
    diagnostics: { vecVersion, modelPath, modelStatus, initMs: Date.now() - t0 },
  };
}
