import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const action = process.argv[2];

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(".env")) return "(DATABASE_URL not set)";

  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("DATABASE_URL="));

  return line?.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "") || "(DATABASE_URL not set)";
}

const databaseUrl = readDatabaseUrl();

const commands: Record<string, { command: string[]; phrase: string; description: string }> = {
  "push-lossy": {
    command: ["npx", "prisma", "db", "push", "--accept-data-loss"],
    phrase: "I UNDERSTAND THIS MAY DELETE DATA",
    description: "强制同步 Prisma schema，并允许数据丢失。该命令可能删除字段、表或数据。",
  },
  reset: {
    command: ["npx", "prisma", "migrate", "reset", "--force", "--skip-seed"],
    phrase: "RESET DATABASE",
    description: "重置数据库。该命令会删除所有数据，并根据迁移重新建表。",
  },
};

async function main() {
  const selected = commands[action || ""];

  if (!selected) {
    console.error("用法：tsx scripts/confirm-db-danger.ts <push-lossy|reset>");
    process.exit(1);
  }

  console.error("");
  console.error("危险数据库命令");
  console.error(selected.description);
  console.error(`目标数据库：${databaseUrl}`);
  console.error(`实际命令：${selected.command.join(" ")}`);
  console.error("");
  console.error(`如果确认继续，请逐字输入：${selected.phrase}`);

  const rl = createInterface({ input, output });
  const answer = await rl.question("> ");
  rl.close();

  if (answer !== selected.phrase) {
    console.error("确认短语不匹配，已中止。");
    process.exit(1);
  }

  const result = spawnSync(selected.command[0], selected.command.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
