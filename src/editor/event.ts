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
  cursorLine: CursorLineInfo;
  selectionSize: number;
  language: string;
  languageAuto: boolean;
  constructor({ cursorLine, language, languageAuto, selectionSize }: SelectionChangeEventInit) {
    super("selectionChange");
    this.cursorLine = cursorLine;
    this.selectionSize = selectionSize;
    this.language = language;
    this.languageAuto = languageAuto;
  }
}
