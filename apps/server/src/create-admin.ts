import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { createFirstAdmin } from "@/modules/identity";
import { prisma } from "@/platform/db/prisma";
import { cache, queueConnection } from "@/platform/redis/connections";

// Creates the first admin; every later one is invited from the admin app. Refuses once any admin
// exists. The password is read from stdin (hidden on a terminal), never from arguments, which end up
// in shell history and process lists.
//
//   pnpm --filter @hagz/server admin:create --email omar@hagz.app --name Omar
//   (deployed: node dist/create-admin.js --email ... --name ...)

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
});
if (!values.email || !values.name) {
  console.error("Usage: create-admin --email <email> --name <name>  (password on stdin)");
  process.exit(1);
}

const readPassword = async (): Promise<string> => {
  const interactive = process.stdin.isTTY;
  // Not a terminal (piped): readline must not echo what it reads.
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: interactive,
  });
  if (interactive) {
    // Echo nothing while the password is typed.
    const output = input as unknown as { _writeToOutput: (text: string) => void };
    process.stdout.write("Password: ");
    output._writeToOutput = () => undefined;
  }
  const password = await input.question("");
  input.close();
  if (interactive) process.stdout.write("\n");
  return password;
};

const password = await readPassword();
if (password.length < 8 || password.length > 128) {
  console.error("The password must be 8 to 128 characters.");
  process.exit(1);
}

try {
  const admin = await createFirstAdmin({ email: values.email, name: values.name, password });
  console.log(`Admin ${admin.id} created. Sign in to set up the authenticator app.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // The modules open Redis connections on import; close everything so the process can exit.
  await prisma.$disconnect();
  queueConnection.disconnect();
  cache.disconnect();
}
