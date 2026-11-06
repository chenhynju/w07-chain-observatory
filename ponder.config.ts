import { createConfig } from "ponder";
import { parseAbi } from "viem";
import { resolveRuntime } from "./src/chain";

const runtime = resolveRuntime(process.env);
const rpc = process.env.RPC_URL;
if (!rpc) throw new Error("RPC_URL is required");

const pairAbi = parseAbi([
  "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)",
  "event Mint(address indexed sender,uint256 amount0,uint256 amount1)",
  "event Burn(address indexed sender,uint256 amount0,uint256 amount1,address indexed to)",
  "event Sync(uint112 reserve0,uint112 reserve1)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);

const database = process.env.PGLITE_DIR
  ? { kind: "pglite" as const, directory: process.env.PGLITE_DIR }
  : undefined;

function buildConfig(chain: "ethereum" | "baseSepolia" | "ethereumSepolia", id: number) {
  return createConfig({
    database,
    chains: { [chain]: { id, rpc } },
    contracts: {
      Pair: {
        chain,
        address: runtime.pair,
        startBlock: Number(runtime.startBlock),
        abi: pairAbi,
      },
    },
  });
}

const chain = runtime.ponderName === "baseSepolia"
  ? "baseSepolia"
  : runtime.ponderName === "ethereumSepolia"
    ? "ethereumSepolia"
    : "ethereum";

export default buildConfig(chain, runtime.id);
