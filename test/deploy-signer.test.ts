import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("deployment preflight uses the keystore interface and stops before signing when unfunded", () => {
  const dir = mkdtempSync(join(tmpdir(), "w07-signer-"));
  try {
    const key = join(dir, "wallet.json"), password = join(dir, "password"), calls = join(dir, "calls");
    writeFileSync(key, "{}", { mode: 0o600 });
    writeFileSync(password, "fixture-only-not-a-real-password", { mode: 0o600 });
    writeFileSync(join(dir, "cast"), `#!/bin/sh
printf '%s\n' "$*" >> "$CAST_CALLS"
case "$1 $2" in
  'chain-id --rpc-url') echo 11155111 ;;
  'wallet address') echo 0x1111111111111111111111111111111111111111 ;;
  'balance 0x1111111111111111111111111111111111111111') echo 0 ;;
  *) exit 94 ;;
esac
`, { mode: 0o755 });
    const result = spawnSync("bash", ["scripts/deploy-testnet.sh"], { encoding: "utf8", env: {
      ...process.env, PATH: dir + ":" + process.env.PATH,
      W07_CHAIN: "ethereum-sepolia", W07_PROXY: "none", W07_KEYSTORE: key,
      W07_PASSWORD_FILE: password, W07_EXPECTED_DEPLOYER: "0x1111111111111111111111111111111111111111", CAST_CALLS: calls,
    }});
    assert.equal(result.status, 3, result.stderr);
    assert.match(result.stderr, /no test ETH/);
    const used = readFileSync(calls, "utf8");
    assert.match(used, /wallet address --keystore .* --password-file/);
    assert.doesNotMatch(used, /--private-key|decrypt-keystore|fixture-only/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
