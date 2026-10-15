import { readFileSync, writeFileSync } from "node:fs";
const path = "Anchor.toml";
let config = readFileSync(path, "utf8");
const id = config.match(/\[programs\.localnet\]\s*roamsafe\s*=\s*"([^"]+)"/)?.[1];
if (!id) throw new Error("Local program ID missing after anchor keys sync.");
config = config.replace(/(\[programs\.devnet\]\s*roamsafe\s*=\s*")[^"]+(")/, "$1" + id + "$2");
writeFileSync(path, config);
