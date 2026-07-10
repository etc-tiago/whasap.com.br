import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";
import { readFileSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { R2SyncConfig } from "./config";

export type SyncOptions = {
  clean: boolean;
  force: boolean;
  dryRun: boolean;
  purgeRemote: boolean;
};

export type SyncResult = {
  listed: number;
  downloaded: number;
  skipped: number;
  cleaned: boolean;
  purgedRemote: number;
};

type ListedObject = {
  key: string;
  size: number;
};

type Manifest = {
  syncedAt: string;
  bucket: string;
  prefixes: string[];
  total: number;
  keys: string[];
};

async function listarObjetos(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<ListedObject[]> {
  const objects: ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key || !object.Key.endsWith(".json")) continue;
      objects.push({
        key: object.Key,
        size: object.Size ?? 0,
      });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function listarTodos(
  client: S3Client,
  config: R2SyncConfig,
): Promise<ListedObject[]> {
  const all: ListedObject[] = [];

  for (const prefix of config.prefixes) {
    console.log(`Listando prefixo: ${prefix}`);
    const objects = await listarObjetos(client, config.bucket, prefix);
    console.log(`  ${objects.length} objeto(s) .json`);
    all.push(...objects);
  }

  return all;
}

async function apagarSaidaLocal(config: R2SyncConfig, dryRun: boolean): Promise<void> {
  const targets = [config.outputDir, config.manifestPath];

  for (const target of targets) {
    if (dryRun) {
      console.log(`[dry-run] removeria: ${target}`);
      continue;
    }

    await rm(target, { recursive: true, force: true });
    console.log(`Removido: ${target}`);
  }
}

async function existeLocal(config: R2SyncConfig, key: string): Promise<boolean> {
  try {
    const info = await stat(caminhoLocal(config, key));
    return info.isFile();
  } catch {
    return false;
  }
}

async function apagarRemotos(
  client: S3Client,
  config: R2SyncConfig,
  keys: string[],
  dryRun: boolean,
): Promise<number> {
  if (keys.length === 0) return 0;

  const loteMax = 1000;
  let purged = 0;

  for (let i = 0; i < keys.length; i += loteMax) {
    const lote = keys.slice(i, i + loteMax);

    if (dryRun) {
      for (const key of lote) {
        console.log(`[dry-run] apagaria no R2: ${key}`);
      }
      purged += lote.length;
      continue;
    }

    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: {
          Objects: lote.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    const erros = response.Errors ?? [];
    if (erros.length > 0) {
      const detalhes = erros.map((e) => `${e.Key}: ${e.Message}`).join("; ");
      throw new Error(`Falha ao apagar objetos no R2: ${detalhes}`);
    }

    purged += lote.length;
    console.log(`  ${purged}/${keys.length} apagado(s) no R2`);
  }

  return purged;
}

function caminhoLocal(config: R2SyncConfig, key: string): string {
  return join(config.outputDir, key);
}

async function chavesComCopiaLocal(
  config: R2SyncConfig,
  objects: ListedObject[],
): Promise<string[]> {
  const keys: string[] = [];
  for (const object of objects) {
    if (await existeLocal(config, object.key)) {
      keys.push(object.key);
    }
  }
  return keys;
}

async function devePular(
  config: R2SyncConfig,
  object: ListedObject,
  force: boolean,
): Promise<boolean> {
  if (force) return false;

  try {
    const localPath = caminhoLocal(config, object.key);
    const info = await stat(localPath);
    return info.isFile() && info.size === object.size;
  } catch {
    return false;
  }
}

async function baixarObjeto(
  client: S3Client,
  config: R2SyncConfig,
  object: ListedObject,
): Promise<void> {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: object.key,
    }),
  );

  const body = await response.Body?.transformToByteArray();
  if (!body) {
    throw new Error(`Corpo vazio para chave: ${object.key}`);
  }

  const localPath = caminhoLocal(config, object.key);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, body);
}

async function processarEmLotes<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function runWorker(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
}

async function gravarManifest(config: R2SyncConfig, keys: string[]): Promise<void> {
  const manifest: Manifest = {
    syncedAt: new Date().toISOString(),
    bucket: config.bucket,
    prefixes: config.prefixes,
    total: keys.length,
    keys: keys.sort(),
  };

  await writeFile(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

/** Sincroniza objetos R2 para o diretório local. */
export async function sincronizar(
  client: S3Client,
  config: R2SyncConfig,
  options: SyncOptions,
): Promise<SyncResult> {
  if (options.clean) {
    console.log("Limpando saída local...");
    await apagarSaidaLocal(config, options.dryRun);
  }

  const objects = await listarTodos(client, config);
  console.log(`Total listado: ${objects.length} objeto(s)`);

  if (options.dryRun) {
    for (const object of objects) {
      console.log(`[dry-run] baixaria: ${object.key} (${object.size} bytes)`);
    }

    let purgedRemote = 0;
    if (options.purgeRemote) {
      const keys = await chavesComCopiaLocal(config, objects);
      console.log(`Apagando ${keys.length} objeto(s) no R2 (com cópia local)...`);
      purgedRemote = await apagarRemotos(client, config, keys, true);
    }

    return {
      listed: objects.length,
      downloaded: 0,
      skipped: 0,
      cleaned: options.clean,
      purgedRemote,
    };
  }

  let downloaded = 0;
  let skipped = 0;

  const pendentes: ListedObject[] = [];
  for (const object of objects) {
    if (await devePular(config, object, options.force)) {
      skipped += 1;
      continue;
    }
    pendentes.push(object);
  }

  if (pendentes.length > 0) {
    console.log(`Baixando ${pendentes.length} objeto(s) (concorrência ${config.concurrency})...`);

    let concluidos = 0;
    await processarEmLotes(pendentes, config.concurrency, async (object) => {
      await baixarObjeto(client, config, object);
      downloaded += 1;
      concluidos += 1;
      if (concluidos % 50 === 0 || concluidos === pendentes.length) {
        console.log(`  ${concluidos}/${pendentes.length} baixado(s)`);
      }
    });
  }

  const keysPresentes = await chavesComCopiaLocal(config, objects);
  await gravarManifest(config, keysPresentes);

  let purgedRemote = 0;
  if (options.purgeRemote) {
    console.log(`Apagando ${keysPresentes.length} objeto(s) no R2 (com cópia local)...`);
    purgedRemote = await apagarRemotos(client, config, keysPresentes, false);
  }

  return {
    listed: objects.length,
    downloaded,
    skipped,
    cleaned: options.clean,
    purgedRemote,
  };
}

/** Lê manifest existente (se houver). */
export function lerManifest(config: R2SyncConfig): Manifest | null {
  try {
    const raw = readFileSync(config.manifestPath, "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}
