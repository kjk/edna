import { Annotation, type Transaction } from "@codemirror/state";

export const heynoteEvent = Annotation.define<string>();
export const LANGUAGE_CHANGE = "heynote-change";
export const CURRENCIES_LOADED = "heynote-currencies-loaded";
export const SET_CONTENT = "heynote-set-content";
export const ADD_NEW_BLOCK = "heynote-add-new-block";
export const MOVE_BLOCK = "heynote-move-block";
export const DELETE_BLOCK = "heynote-delete-block";
export const SET_FONT = "heynote-set-font";

export function transactionsHasAnnotation(transactions: readonly Transaction[], annotation: string): boolean {
  return transactions.some((tr) => tr.annotation(heynoteEvent) === annotation);
}

export function transactionsHasAnnotationsAny(transactions: readonly Transaction[], annotations: string[]): boolean {
  return transactions.some((tr) => {
    const annotation = tr.annotation(heynoteEvent);
    return annotation !== undefined && annotations.includes(annotation);
  });
}

export function transactionsHasHistoryEvent(transactions: readonly Transaction[]): boolean {
  return transactions.some((tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo"));
}
