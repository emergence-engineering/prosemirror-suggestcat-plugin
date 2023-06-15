import { getChangedRegions } from "./utils";

describe("getChangedRegions", () => {
  it("no change", () => {
    expect(getChangedRegions("abc", "abc")).toStrictEqual({
      start: 3,
      oldStart: 3,
      oldEnd: 3,
      end: 3,
      oldText: "",
      newText: "",
    });
  });

  it("change at the start, no newline", () => {
    expect(
      getChangedRegions(
        "qqq the same text stays here",
        "a the same text stays here",
      ),
    ).toStrictEqual({
      start: 0,
      end: 26,
      oldStart: 0,
      oldEnd: 28,
      oldText: "qqq the same text stays here",
      newText: "a the same text stays here",
    });
  });
  it("change at the start", () => {
    expect(
      getChangedRegions(
        "qqq the same text stays here\nsome\nmore\nlines",
        "a the same text stays here\nsome\nmore\nlines",
      ),
    ).toStrictEqual({
      start: 0,
      end: 26,
      oldStart: 0,
      oldEnd: 28,
      oldText: "qqq the same text stays here",
      newText: "a the same text stays here",
    });
  });
  it("change at the end, no newline", () => {
    expect(
      getChangedRegions(
        "the same text stays but there will be changes",
        "the same text stays and here are the diffs",
      ),
    ).toStrictEqual({
      start: 0,
      end: 42,
      oldStart: 0,
      oldEnd: 45,
      oldText: "the same text stays but there will be changes",
      newText: "the same text stays and here are the diffs",
    });
  });
  it("change at the end", () => {
    expect(
      getChangedRegions(
        "some\ntext\nthe same text stays but there will be changes",
        "some\ntext\nthe same text stays and here are the diffs",
      ),
    ).toStrictEqual({
      start: 10,
      end: 52,
      oldStart: 10,
      oldEnd: 55,
      oldText: "the same text stays but there will be changes",
      newText: "the same text stays and here are the diffs",
    });
  });
  it("change in the middle, no newline", () => {
    expect(
      getChangedRegions(
        "this is the same but then it changes and same again",
        "this is the same xxxxxxxxx and same again",
      ),
    ).toStrictEqual({
      start: 0,
      end: 41,
      oldStart: 0,
      oldEnd: 51,
      oldText: "this is the same but then it changes and same again",
      newText: "this is the same xxxxxxxxx and same again",
    });
  });
  it("change in the middle", () => {
    expect(
      getChangedRegions(
        "\nsome\nnew\nlines\nthis is the same but then it changes and same again\nsome\nnew\nlines\n",
        "\nsome\nnew\nlines\nthis is the same xxxxxxxxx and same again\nsome\nnew\nlines\n",
      ),
    ).toStrictEqual({
      start: 16,
      end: 57,
      oldStart: 16,
      oldEnd: 67,
      oldText: "this is the same but then it changes and same again",
      newText: "this is the same xxxxxxxxx and same again",
    });
  });
  it("change in the middle, newline in the middle", () => {
    expect(
      getChangedRegions(
        "\nsome\nnew\nlines\nthis is the same but then it\n changes and same again\nsome\nnew\nlines\n",
        "\nsome\nnew\nlines\nthis is the same xxxx\nxxxxx and same again\nsome\nnew\nlines\n",
      ),
    ).toStrictEqual({
      start: 16,
      end: 58,
      oldStart: 16,
      oldEnd: 68,
      oldText: "this is the same but then it\n changes and same again",
      newText: "this is the same xxxx\nxxxxx and same again",
    });
  });
  it("change in the middle, single char insert", () => {
    expect(
      getChangedRegions(
        "prosemirror-codemirror-block as\n \n",
        "prosemirror-codemirror-block asd\n \n",
      ),
    ).toStrictEqual({
      start: 0,
      end: 32,
      oldStart: 0,
      oldEnd: 31,
      oldText: "prosemirror-codemirror-block as",
      newText: "prosemirror-codemirror-block asd",
    });
  });
});
