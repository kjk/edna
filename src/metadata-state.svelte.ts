import { normalizeMetadata } from "./metadata-merge";

export const metadataState = $state({ current: normalizeMetadata(null) });
