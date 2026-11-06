import { createConfig } from "ponder";
import { getAddress, parseAbi } from "viem";

const startBlock = Number(process.env.START_BLOCK ?? "10008355");
if (!Number.isSafeInteger(startBlock) || startBlock < 0) throw new Error("Invalid START_BLOCK");

export default createConfig({
  database: process.env.PGLITE_DIR
    ? { kind: "pglite", directory: process.env.PGLITE_DIR }
    : undefined,
  chains: { ethereum: { id: 1, rpc: process.env.RPC_URL! } },
  contracts: {
    Pair: {
      chain: "ethereum",
      address: getAddress(process.env.PAIR_ADDRESS ?? "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc"),
      startBlock,
      abi: parseAbi([
        "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)",
        "event Mint(address indexed sender,uint256 amount0,uint256 amount1)",
        "event Burn(address indexed sender,uint256 amount0,uint256 amount1,address indexed to)",
        "event Sync(uint112 reserve0,uint112 reserve1)",
        "event Transfer(address indexed from,address indexed to,uint256 value)"
      ])
    }
  }
});

