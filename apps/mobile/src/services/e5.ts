import { initLlama, type LlamaContext } from 'llama.rn';
import { AppState } from 'react-native';

interface EmbeddingConfig {
  query_prefix: string;
  runtime_n_ctx: number;
  dims: number;
}

export function l2normalise(v: ArrayLike<number>): number[] {
  let n = 0;
  for (let i = 0; i < v.length; i += 1) n += (v[i] as number) ** 2;
  const s = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / s);
}

/**
 * Lazily loads the bundled e5 GGUF and embeds queries with the `query: ` prefix.
 * Same model file and n_ctx as the pipeline (ADR 0003), CPU only, ≤ 4 threads, mmap.
 * Released when the app goes to the background; reloaded on next use.
 */
export function createE5Embedder(modelPath: string, cfg: EmbeddingConfig) {
  let ctx: Promise<LlamaContext> | null = null;
  const load = () =>
    (ctx ??= initLlama({
      model: modelPath,
      embedding: true,
      n_ctx: cfg.runtime_n_ctx,
      n_batch: cfg.runtime_n_ctx,
      n_threads: 4,
      n_gpu_layers: 0,
      use_mmap: true,
      use_mlock: false,
    }));

  AppState.addEventListener('change', (state) => {
    if (state === 'background' && ctx) {
      const c = ctx;
      ctx = null;
      void c.then((x) => x.release()).catch(() => undefined);
    }
  });

  return async function embedQuery(
    text: string,
    prefix = cfg.query_prefix,
  ): Promise<number[] | null> {
    try {
      const { embedding } = await (await load()).embedding(prefix + text);
      return embedding.length === cfg.dims ? l2normalise(embedding) : null;
    } catch {
      ctx = null;
      return null;
    }
  };
}
