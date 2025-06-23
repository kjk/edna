let a = [
    [
      "Alt-Shift-r",
      () => {
        openFunctionSelector(false);
      },
    ],
    ["Mod-k", openNoteSelector],
    ["Alt-0", openNoteSelector],
    ["Mod-o", openNoteSelector],
    ["Mod-p", openNoteSelector],
    ["Mod-Shift-p", openCommandPalette],
    ["Mod-Shift-k", openCommandPalette],
    ["Mod-Shift-o", openCommandPalette],
    ["Mod-h", openHistorySelector],
    ["Alt-Shift-f", formatBlockContent],
    ["Mod-Alt-ArrowDown", newCursorBelow],
    ["Mod-Alt-ArrowUp", newCursorAbove],
    // https://github.com/kjk/edna/issues/87
    // this is a "open command palette" shortcut
    //    ["Mod-Shift-k", deleteLine],
    {
      key: "Mod-ArrowUp",
      run: gotoPreviousBlock,
      shift: selectPreviousBlock,
    },
    { key: "Mod-ArrowDown", run: gotoNextBlock, shift: selectNextBlock },
    {
      key: "Ctrl-ArrowUp",
      run: gotoPreviousParagraph,
      shift: selectPreviousParagraph,
    },
    {
      key: "Ctrl-ArrowDown",
      run: gotoNextParagraph,
      shift: selectNextParagraph,
    },
    ["Mod-Shift-Alt-ArrowUp", moveCurrentBlockUp],
    ["Mod-Shift-Alt-ArrowDown", moveCurrentBlockDown],
  ];
  // for some reason CodeMirror uses Ctrl + Y on Windows
  // and only binds Mod-Shift-z on Mac and Linux
  // Windows editors also use Ctrl-Shift-z
  if (platform.isWindows) {
    spec.push(["Mod-Shift-z", redo]);
  }
];
