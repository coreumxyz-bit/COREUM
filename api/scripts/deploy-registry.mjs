#!/usr/bin/env node
// One-off: deploys CoreumTokenRegistry to Robinhood Chain. The owner is the
// contracts wallet (CONTRACTS_KEY); the writer is the anchor wallet that already
// writes CoreumVerdicts every hour (WRITER). Records it in contracts/deployments.json.
//   CONTRACTS_KEY=… WRITER=0x… node scripts/deploy-registry.mjs [--estimate]
import { ContractFactory, JsonRpcProvider, Wallet, formatEther, isAddress } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "contracts");
const art = JSON.parse(readFileSync(join(dir, "CoreumTokenRegistry.json"), "utf8"));
const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const WRITER = process.env.WRITER;
if (!process.env.CONTRACTS_KEY) throw new Error("CONTRACTS_KEY is required");
if (!isAddress(WRITER)) throw new Error("WRITER must be an address");

const provider = new JsonRpcProvider(RPC, 4663, { staticNetwork: true });
const wallet = new Wallet(process.env.CONTRACTS_KEY, provider);
const factory = new ContractFactory(art.abi, art.bytecode, wallet);
const fee = await provider.getFeeData();
const gas = await provider.estimateGas({ ...(await factory.getDeployTransaction(WRITER)), from: wallet.address });
console.log(`owner ${wallet.address} · writer ${WRITER} · balance ${formatEther(await provider.getBalance(wallet.address))} ETH`);
console.log(`estimated gas ${gas} · ~${formatEther(gas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n))} ETH at most`);
if (process.argv.includes("--estimate")) process.exit(0);

const contract = await factory.deploy(WRITER);
const tx = contract.deploymentTransaction();
console.log(`deploy tx ${tx.hash} — waiting`);
await contract.waitForDeployment();
const rc = await tx.wait();
const address = await contract.getAddress();
const all = JSON.parse(readFileSync(join(dir, "deployments.json"), "utf8"));
all.CoreumTokenRegistry = {
  chainId: 4663,
  address,
  owner: wallet.address,
  writer: WRITER,
  deployTx: tx.hash,
  block: rc.blockNumber,
  compiler: art.compiler,
  deployedAt: new Date().toISOString(),
};
writeFileSync(join(dir, "deployments.json"), JSON.stringify(all, null, 2) + "\n");
console.log(`CoreumTokenRegistry at ${address} · block ${rc.blockNumber} · fee ${formatEther(rc.gasUsed * (rc.gasPrice ?? 0n))} ETH`);
