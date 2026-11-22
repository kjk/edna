import { expect, test } from "vitest";
import { hilightText, makeHilightRegExp } from "./util";
test("hilightText escapes HTML and highlights matches", () => {
  expect(hilightText("Foo bar foo", makeHilightRegExp("foo"))).toBe('<span class="hili">Foo</span> bar <span class="hili">foo</span>');
  expect(hilightText("a<b>&c", makeHilightRegExp(""))).toBe("a&lt;b&gt;&amp;c");
  expect(hilightText("x & y", makeHilightRegExp("&"))).toBe('x <span class="hili">&amp;</span> y');
  expect(hilightText("one two", makeHilightRegExp("one two"))).toContain('<span class="hili">one</span>');
});
