/** Count each input once, including swaps with both tokens entering the pair. */
export function swapInputs(args: { amount0In: bigint; amount1In: bigint }): [bigint, bigint] {
  return [args.amount0In, args.amount1In];
}

/** Token0 value in raw units at the reserve ratio, rounded down. */
export function markInToken0(amount0: bigint, amount1: bigint, reserve0: bigint, reserve1: bigint) {
  return reserve1 === 0n ? null : amount0 + amount1 * reserve0 / reserve1;
}

