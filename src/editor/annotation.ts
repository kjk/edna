import { Annotation, type Transaction } from "@codemirror/state";

export const ednaEvent = Annotation.define<string>();
export const kLanguageChange = "edna-change";
export const kCurrenciesLoaded = "edna-currencies-loaded";
export const kSetContent = "edna-set-content";
export const kAddNewBlock = "edna-add-new-block";
export const kMoveBlock = "edna-move-block";
export const kDeleteBlock = "edna-delete-block";

export function transactionsHasAnnotation(transactions: readonly Transaction[], annotation: string): boolean {
  return transactions.some((tr) => tr.annotation(ednaEvent) === annotation);
}

function hasAnnotationAny(tr: Transaction, annotations: string[]): boolean {
  const annotation = tr.annotation(ednaEvent);
  return annotation !== undefined && annotations.includes(annotation);
}

function isHistoryEvent(tr: Transaction): boolean {
  return tr.isUserEvent("undo") || tr.isUserEvent("redo");
}

// undo / redo or a change made by a block command or by loading content (not by typing)
export function isStructuralChange(tr: Transaction): boolean {
  return isHistoryEvent(tr) || hasAnnotationAny(tr, [kSetContent, kLanguageChange, kAddNewBlock, kMoveBlock, kDeleteBlock]);
}
