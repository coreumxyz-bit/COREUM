#!/usr/bin/env node
// Compiles contracts/CoreumVerdicts.sol → contracts/CoreumVerdicts.json (abi + bytecode)
// so CI and the site never need a compiler. Run: node scripts/compile-verdicts.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts");
const source = readFileSync(join(dir, "CoreumVerdicts.sol"), "utf8");
const input = {
  language: "Solidity",
  sources: { "CoreumVerdicts.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris", // widest compatibility across L2s
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) console.log(e.formattedMessage);
if (errors.length) process.exit(1);
const c = out.contracts["CoreumVerdicts.sol"].CoreumVerdicts;
writeFileSync(
  join(dir, "CoreumVerdicts.json"),
  JSON.stringify({ compiler: solc.version(), evmVersion: "paris", abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2) + "\n"
);
console.log(`compiled with solc ${solc.version()} · bytecode ${c.evm.bytecode.object.length / 2} bytes`);
