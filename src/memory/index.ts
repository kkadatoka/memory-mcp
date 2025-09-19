// Minimal memory module placeholder
// Exported functions will be implemented during the refactor.

export async function saveMemoriesPlaceholder(memories: string[], llm: string, userId?: string) {
  // noop placeholder
  return { ok: true, count: memories.length };
}

export async function getMemoriesPlaceholder() {
  return [] as string[];
}
