import assert from "node:assert/strict";
import test from "node:test";
import { markInToken0 } from "../src/math.ts";

test("10,000 deterministic integer valuations satisfy rounding and monotonicity", () => {
  let state = 0x5707n;
  const mask = (1n << 112n) - 1n;
  function next() {
    state = (state * 6364136223846793005n + 1442695040888963407n) & mask;
    return state;
  }
  for (let i = 0; i < 10_000; i++) {
    const amount0 = next();
    const amount1 = next();
    const reserve0 = next();
    const reserve1 = next() + 1n;
    const result = markInToken0(amount0, amount1, reserve0, reserve1);
    assert.notEqual(result, null);
    const exactNumerator = amount0 * reserve1 + amount1 * reserve0;
    const remainder = exactNumerator - result! * reserve1;
    assert.ok(remainder >= 0n && remainder < reserve1, "floor rounding error bounds");
    assert.equal(markInToken0(amount0 + 1n, amount1, reserve0, reserve1), result! + 1n);
    assert.ok(markInToken0(amount0, amount1 + 1n, reserve0, reserve1)! >= result!);
    assert.equal(markInToken0(amount0, amount1, reserve0 * 3n, reserve1 * 3n), result);
  }
});
