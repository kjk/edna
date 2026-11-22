interface CursorLineInfo {
  line: number;
  col: number;
  length: number;
}

interface SelectionChangeEventInit {
  cursorLine: CursorLineInfo;
  selectionSize: number;
  language: string;
  languageAuto: boolean;
}

export class SelectionChangeEvent extends Event {
  readonly cursorLine: CursorLineInfo;
  readonly selectionSize: number;
  readonly language: string;
  readonly languageAuto: boolean;

  constructor({ cursorLine, selectionSize, language, languageAuto }: SelectionChangeEventInit) {
    super("selectionChange");
    this.cursorLine = cursorLine;
    this.selectionSize = selectionSize;
    this.language = language;
    this.languageAuto = languageAuto;
  }
}
