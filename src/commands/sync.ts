import pc from "picocolors";
import { Buffer } from "../buffer";
import { syncPending } from "../sync";

export async function syncCommand(_args: string[]) {
  const buf = new Buffer();
  const result = await syncPending(buf);
  buf.close();
  if (result.reason && result.sent === 0 && result.failed === 0) {
    console.log(pc.dim(result.reason));
    return;
  }
  const mark = result.failed > 0 ? pc.red("✗") : pc.green("✓");
  console.log(`${mark} sent=${result.sent} failed=${result.failed}${result.reason ? pc.dim(`  (${result.reason})`) : ""}`);
  if (result.failed > 0) process.exit(1);
}
