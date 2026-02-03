export class SelectionChangeEvent extends Event {
  cursorLine: any;
  selectionSize: any;
  language: string;
  languageAuto: boolean;
  constructor({ cursorLine, language, languageAuto, selectionSize }) {
    super("selectionChange");
    this.cursorLine = cursorLine;
    this.selectionSize = selectionSize;
    this.language = language;
    this.languageAuto = languageAuto;
  }
}
