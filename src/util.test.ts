import { expect, test } from "vitest";
import { hilightText, html, makeHilightRegExp } from "./util";
test("hilightText escapes HTML and highlights matches", () => {
  expect(hilightText("Foo bar foo", makeHilightRegExp("foo"))).toBe('<span class="hili">Foo</span> bar <span class="hili">foo</span>');
  expect(hilightText("a<b>&c", makeHilightRegExp(""))).toBe("a&lt;b&gt;&amp;c");
  expect(hilightText("x & y", makeHilightRegExp("&"))).toBe('x <span class="hili">&amp;</span> y');
  expect(hilightText("one two", makeHilightRegExp("one two"))).toContain('<span class="hili">one</span>');
});

test("html`` escapes interpolated values (U1)", () => {
  const name = '<img src=x onerror="alert(1)">';
  expect(html`Loading <b>${name}</b>`).toBe("Loading <b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>");
  expect(html`a${1}b${"&"}c`).toBe("a1b&amp;c");
});
