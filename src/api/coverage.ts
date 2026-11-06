export type CoverageReason =
  | "pair-creation-not-configured"
  | "starts-after-pair-creation"
  | "complete";

export interface Coverage {
  complete: boolean;
  reason: CoverageReason;
  configuredStartBlock: string;
  pairCreationBlock: string | null;
}

/**
 * Coverage is complete only when the configured start block is known to be at
 * or before pair creation. A timestamp window cannot substitute for this check.
 */
export function describeCoverage(startBlock: bigint, creationBlock: bigint | undefined): Coverage {
  if (creationBlock === undefined) {
    return {
      complete: false,
      reason: "pair-creation-not-configured",
      configuredStartBlock: startBlock.toString(),
      pairCreationBlock: null,
    };
  }
  return {
    complete: startBlock <= creationBlock,
    reason: startBlock <= creationBlock ? "complete" : "starts-after-pair-creation",
    configuredStartBlock: startBlock.toString(),
    pairCreationBlock: creationBlock.toString(),
  };
}
