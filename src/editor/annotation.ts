import { Annotation, type Transaction } from "@codemirror/state";

export const ednaEvent = Annotation.define<string>();
export const kLanguageChange = "edna-change";
export const kCurrenciesLoaded = "edna-currencies-loaded";
export const kSetContent = "edna-set-content";
export const kAddNewBlock = "edna-add-new-block";
export const kMoveBlock = "edna-move-block";
export const kDeleteBlock = "edna-delete-block";
export const kSetFont = "edna-set-font";

export function transactionsHasAnnotation(transactions: readonly Transaction[], annotation: string): boolean {
  return transactions.some((tr) => tr.annotation(ednaEvent) === annotation);
}

export function transactionsHasAnnotationsAny(transactions: readonly Transaction[], annotations: string[]): boolean {
  return transactions.some((tr) => {
    const annotation = tr.annotation(ednaEvent);
    return annotation !== undefined && annotations.includes(annotation);
  });
}

export function transactionsHasHistoryEvent(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo"));
}
