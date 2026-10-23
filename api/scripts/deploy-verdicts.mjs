#!/usr/bin/env node
// One-off: deploys CoreumVerdicts to Robinhood Chain from the anchor wallet
// (ANCHOR_KEY) and records the address in contracts/deployments.json.
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts");
const art = JSON.parse(readFileSync(join(dir, "CoreumVerdicts.json"), "utf8"));
const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
if (!process.env.ANCHOR_KEY) throw new Error("ANCHOR_KEY is required");

const provider = new JsonRpcProvider(RPC, 4663, { staticNetwork: true });
const wallet = new Wallet(process.env.ANCHOR_KEY, provider);
console.log(`deployer ${wallet.address} · balance ${formatEther(await provider.getBalance(wallet.address))} ETH`);

const contract = await new ContractFactory(art.abi, art.bytecode, wallet).deploy();
const tx = contract.deploymentTransaction();
console.log(`deploy tx ${tx.hash} — waiting`);
await contract.waitForDeployment();
const rc = await tx.wait();
const address = await contract.getAddress();
const out = {
  CoreumVerdicts: {
    chainId: 4663,
    address,
    writer: wallet.address,
    deployTx: tx.hash,
    block: rc.blockNumber,
    compiler: art.compiler,
    deployedAt: new Date().toISOString(),
  },
};
writeFileSync(join(dir, "deployments.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`CoreumVerdicts at ${address} · block ${rc.blockNumber} · fee ${formatEther(rc.gasUsed * (rc.gasPrice ?? 0n))} ETH`);
