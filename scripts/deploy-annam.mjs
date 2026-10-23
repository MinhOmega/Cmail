// Patch the vite build output into a second-instance config and deploy cmail-annam.
// Usage: npm run build && node scripts/deploy-annam.mjs
import { readFileSync, writeFileSync } from "node:fs";
const ANNAM_D1_ID = "81d91341-336a-4b6e-bd46-6e5a3f66a9a1";
const c = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
c.name = "cmail-annam";
c.topLevelName = "cmail-annam";
c.routes = [{ pattern: "mail.annamlabs.com", custom_domain: true }];
c.vars = { ...c.vars, WORKER_NAME: "cmail-annam" };
for (const s of c.services ?? []) if (s.binding === "WORKER_SELF_REFERENCE") s.service = "cmail-annam";
if (c.d1_databases?.[0]) { c.d1_databases[0].database_name = "cmail-annam"; c.d1_databases[0].database_id = ANNAM_D1_ID; }
for (const b of c.r2_buckets ?? []) b.bucket_name = "cmail-annam-raw";
const qmap = (q) => q.replace(/^cmail-/, "cmail-annam-");
for (const q of c.queues?.producers ?? []) q.queue = qmap(q.queue);
for (const q of c.queues?.consumers ?? []) q.queue = qmap(q.queue);
writeFileSync("dist/server/wrangler.annam.json", JSON.stringify(c, null, "\t"));
console.log("assets:", JSON.stringify(c.assets));
console.log("dist/server/wrangler.annam.json written");
