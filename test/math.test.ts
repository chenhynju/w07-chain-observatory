import assert from "node:assert/strict";
import test from "node:test";
import { markInToken0, swapInputs } from "../src/math.ts";

test("keeps amounts above JS safe integer exact", () => {
  const large = 2n ** 112n - 1n;
  assert.equal(markInToken0(large, large, large, large), 2n * large);
});
test("rounds down and signals missing denominator", () => {
  assert.equal(markInToken0(0n, 1n, 2n, 3n), 0n);
  assert.equal(markInToken0(5n, 0n, 1n, 0n), null);
});
test("counts both input legs", () => {
  assert.deepEqual(swapInputs({ amount0In: 3n, amount1In: 4n }), [3n, 4n]);
});

