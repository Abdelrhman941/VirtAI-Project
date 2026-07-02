/**
 * Split the streamed string into a "frozen" prefix (everything up to and
 * including the last complete paragraph / code fence / list item) and a "hot"
 * tail (the currently-growing chunk). Only the tail re-parses every delta —
 * the prefix is memoized once and only invalidated when a new boundary is
 * crossed.
 */
export function splitForStreaming(input: string): { prefix: string; tail: string } {
  // last blank line = safest paragraph boundary
  const lastBoundary = input.lastIndexOf('\n\n');
  if (lastBoundary === -1) return { prefix: '', tail: input };
  return {
    prefix: input.slice(0, lastBoundary + 2),
    tail: input.slice(lastBoundary + 2),
  };
}
