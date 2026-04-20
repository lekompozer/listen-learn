/**
 * Stub: exploreInteractions — explore feed is not used in WynAI Listen & Learn.
 * All functions are no-ops.
 */
export async function recordChannelInteraction(_userId: string, _category: string, _type?: 'like' | 'watch', _watchSeconds?: number): Promise<void> {}
export async function getTopCategories(_userId: string, _limit?: number): Promise<string[]> { return []; }
export async function resetInteractions(_userId: string): Promise<void> {}
