#!/usr/bin/env node
// Compiles contracts/CoreumTokenRegistry.sol → contracts/CoreumTokenRegistry.json (abi + bytecode)
// so CI and the site never need a compiler. Run: node scripts/compile-verdicts.mjs
import solc from "solc";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts");
const source = readFileSync(join(dir, "CoreumTokenRegistry.sol"), "utf8");
const input = {
  language: "Solidity",
  sources: { "CoreumTokenRegistry.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris", // widest compatibility across L2s
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) console.log(e.formattedMessage);
if (errors.length) process.exit(1);
const c = out.contracts["CoreumTokenRegistry.sol"].CoreumTokenRegistry;
writeFileSync(
  join(dir, "CoreumTokenRegistry.json"),
  JSON.stringify({ compiler: solc.version(), evmVersion: "paris", abi: c.abi, bytecode: "0x" + c.evm.bytecode.object, deployedBytecode: "0x" + c.evm.deployedBytecode.object }, null, 2) + "\n"
);
console.log(`compiled with solc ${solc.version()} · bytecode ${c.evm.bytecode.object.length / 2} bytes`);
