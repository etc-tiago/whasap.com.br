import { carregarConfig } from "./config";
import { criarClienteR2 } from "./r2";
import { sincronizar, type SyncOptions } from "./sync";

function parseArgs(argv: string[]): SyncOptions {
  const options: SyncOptions = {
    clean: false,
    force: false,
    dryRun: false,
    purgeRemote: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case "--clean":
        options.clean = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--purge-remote":
        options.purgeRemote = true;
        break;
      case "--help":
      case "-h":
        console.log(`Uso: bun run sync [--clean] [--force] [--dry-run] [--purge-remote]

Opções:
  --clean          Apaga R2_OUTPUT_DIR e .manifest.json antes do sync
  --force          Re-baixa todos os objetos (ignora skip incremental)
  --dry-run        Simula limpeza, download e purge sem gravar/apagar
  --purge-remote   Apaga no R2 os objetos que têm cópia local após o sync

Configuração via packages/r2-sync/.env.local`);
        process.exit(0);
        break;
      default:
        throw new Error(`Flag desconhecida: ${arg}`);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = carregarConfig();
  const client = criarClienteR2(config);

  console.log(`Bucket: ${config.bucket}`);
  console.log(`Saída: ${config.outputDir}`);
  console.log(`Prefixos: ${config.prefixes.join(", ")}`);

  const result = await sincronizar(client, config, options);

  console.log("");
  console.log("Concluído:");
  console.log(`  Listados: ${result.listed}`);
  console.log(`  Baixados: ${result.downloaded}`);
  console.log(`  Pulados:  ${result.skipped}`);
  if (result.cleaned) {
    console.log("  Limpeza local executada");
  }
  if (result.purgedRemote > 0) {
    console.log(`  Apagados no R2: ${result.purgedRemote}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${message}`);
  process.exit(1);
});
