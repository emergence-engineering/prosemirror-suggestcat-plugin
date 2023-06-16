import diff from "fast-diff";

import {
  convertDiffToReplaceSet,
  getDiff,
  mergeReplacePair,
  Replace,
} from "./mergeDiffs";

const createIdentity = (text: string, shift = 0): Replace => ({
  from: shift,
  to: shift + text.length,
  original: text,
  replacement: text,
});

const createDelete = (text: string, shift = 0): Replace => ({
  from: shift,
  to: shift + text.length,
  original: text,
  replacement: "",
});

const createInsert = (text: string, shift = 0): Replace => ({
  from: shift,
  to: shift,
  original: "",
  replacement: text,
});

const createReplace = (
  text1: string,
  text2: string,
  from: number,
  to: number,
): Replace => ({
  from,
  to,
  original: text1,
  replacement: text2,
});

describe("convertDiffToReplaceSet", () => {
  it("equal", () => {
    expect(convertDiffToReplaceSet([[diff.EQUAL, "a"]])).toStrictEqual([
      { from: 0, to: 1, original: "a", replacement: "a" },
    ]);
  });
  it("delete", () => {
    expect(convertDiffToReplaceSet([[diff.DELETE, "a"]])).toStrictEqual([
      { from: 0, to: 1, original: "a", replacement: "" },
    ]);
  });
  it("insert", () => {
    expect(convertDiffToReplaceSet([[diff.INSERT, "a"]])).toStrictEqual([
      { from: 0, to: 0, original: "", replacement: "a" },
    ]);
  });
  it("converts equals with newlines into two replaces", () => {
    expect(convertDiffToReplaceSet([[diff.EQUAL, "\na"]])).toStrictEqual([
      { from: 0, to: 1, original: "\n", replacement: "\n" },
      { from: 1, to: 2, original: "a", replacement: "a" },
    ]);
  });
  it("complex case", () => {
    expect(
      convertDiffToReplaceSet([
        [diff.DELETE, "a"],
        [diff.INSERT, "b"],
        [diff.EQUAL, "c"],
      ]),
    ).toStrictEqual([
      { from: 0, to: 1, original: "a", replacement: "" },
      { from: 1, to: 1, original: "", replacement: "b" },
      { from: 1, to: 2, original: "c", replacement: "c" },
    ]);
  });
});

describe("mergeReplacePair", () => {
  it("throws error when items are not adjacent", () => {
    expect(() =>
      mergeReplacePair(
        { from: 0, to: 1, original: "", replacement: "" },
        { from: 4, to: 5, original: "", replacement: "" },
      ),
    ).toThrowError();
  });
  it("if left element ends with newline then don't merge", () => {
    expect(
      mergeReplacePair(createIdentity("\n"), createIdentity("a", 1)),
    ).toStrictEqual([
      { from: 0, to: 1, original: "\n", replacement: "\n" },
      { from: 1, to: 2, original: "a", replacement: "a" },
    ]);
  });
  it("adjacent identity elements", () => {
    expect(
      mergeReplacePair(createIdentity("text"), createIdentity("text", 4)),
    ).toStrictEqual([
      { from: 0, to: 8, original: "texttext", replacement: "texttext" },
    ]);
  });

  const identityWhiteSpace = createIdentity("abc ");
  const identityNoWhiteSpace = createIdentity("abc");
  const identityNoWhiteSpaceShifted3 = createIdentity("abc", 3);
  const identityNoWhiteSpaceShifted4 = createIdentity("abc", 4);
  const identityPreWhiteSpaceShifted = createIdentity(" abc", 3);
  const deleteNoWhiteSpace = createDelete("def", 0);
  const deleteNoWhiteSpaceShifted = createDelete("def", 3);
  const deleteWithWhiteSpace = createDelete("def ", 0);
  const deleteWithWhiteSpaceShifted = createDelete(" def", 3);
  const insertWhiteSpaceShifted = createInsert(" def", 3);
  const insertWhiteSpace = createInsert("def ", 0);
  const insertNoWhiteSpace = createInsert("def", 0);
  const insertNoWhiteSpaceShifted = createInsert("def", 3);

  const pairCases: [string, string, Replace, Replace, Replace[]][] = [
    [
      "Remove new word from end",
      "abc| def => abc",
      identityNoWhiteSpace,
      deleteWithWhiteSpaceShifted,
      [
        { from: 0, to: 3, original: "abc", replacement: "abc" },
        { from: 3, to: 7, original: " def", replacement: "" },
      ],
    ],
    [
      "Remove characters from end",
      "abd|def => abc",
      identityNoWhiteSpace,
      deleteNoWhiteSpaceShifted,
      [{ from: 0, to: 6, original: "abcdef", replacement: "abc" }],
    ],
    [
      "Insert new word to end",
      "abc => abc| def",
      identityNoWhiteSpace,
      insertWhiteSpaceShifted,
      [
        { from: 0, to: 3, original: "abc", replacement: "abc" },
        { from: 3, to: 3, original: "", replacement: " def" },
      ],
    ],
    [
      "Insert characters to end",
      "abc => abc|def",
      identityNoWhiteSpace,
      insertNoWhiteSpaceShifted,
      [{ from: 0, to: 3, original: "abc", replacement: "abcdef" }],
    ],
    [
      "Replace whole world at end",
      "abc |ijk => abc |lmn",
      identityWhiteSpace,
      createReplace("ijk", "lmn", 4, 7),
      [
        { from: 0, to: 4, original: "abc ", replacement: "abc " },
        { from: 4, to: 7, original: "ijk", replacement: "lmn" },
      ],
    ],
    [
      "Replace characters at end",
      "abc|ijk => abc|lmn",
      identityNoWhiteSpace,
      createReplace("ijk", "lmn", 3, 6),
      [{ from: 0, to: 6, original: "abcijk", replacement: "abclmn" }],
    ],
    [
      "Remove word from beginning",
      "def |abc => abc",
      deleteWithWhiteSpace,
      identityNoWhiteSpaceShifted4,
      [
        { from: 0, to: 4, original: "def ", replacement: "" },
        { from: 4, to: 7, original: "abc", replacement: "abc" },
      ],
    ],
    [
      "Remove characters from beginning",
      "def|abc => abc",
      deleteNoWhiteSpace,
      identityNoWhiteSpaceShifted3,
      [{ from: 0, to: 6, original: "defabc", replacement: "abc" }],
    ], // abc|def => def
    [
      "Add word to beginning",
      "abc => def |abc",
      insertWhiteSpace,
      identityNoWhiteSpace,
      [
        { from: 0, to: 0, original: "", replacement: "def " },
        { from: 0, to: 3, original: "abc", replacement: "abc" },
      ],
    ],
    [
      "Add characters to beginning",
      "abc => def|abc",
      insertNoWhiteSpace,
      identityNoWhiteSpace,
      [{ from: 0, to: 3, original: "abc", replacement: "defabc" }],
    ],
    [
      "Replace word at beginning",
      "ijk| abc => lmn| abc",
      createReplace("ijk", "lmn", 0, 3),
      identityPreWhiteSpaceShifted,
      [
        { from: 0, to: 3, original: "ijk", replacement: "lmn" },
        { from: 3, to: 7, original: " abc", replacement: " abc" },
      ],
    ],
    [
      "Replace characters at beginning",
      "ijk|abc => lmn|abc",
      createReplace("ijk", "lmn", 0, 3),
      identityNoWhiteSpaceShifted3,
      [{ from: 0, to: 6, original: "ijkabc", replacement: "lmnabc" }],
    ],
  ];

  it.each(pairCases)(
    "test %s - [%p]",
    (
      name: string,
      example: string,
      diff1: Replace,
      diff2: Replace,
      result: Replace[],
    ) => {
      expect(mergeReplacePair(diff1, diff2)).toStrictEqual(result);
    },
  );
});

describe("e2e mergeDiff tests", () => {
  it("single word", () => {
    expect(getDiff("imagination", "irreversible")).toStrictEqual([
      {
        from: 0,
        to: 11,
        original: "imagination",
        replacement: "irreversible",
      },
    ]);
  });
  test("one char", () => {
    expect(getDiff("i don t", "i don't")).toStrictEqual([
      {
        from: 0,
        to: 2,
        original: "i ",
        replacement: "i ",
      },
      {
        from: 2,
        to: 7,
        original: "don t",
        replacement: "don't",
      },
    ]);
  });
  it("single sentence", () => {
    expect(
      getDiff("The dogs are on a boat.", "Most dogs like bulldozers!"),
    ).toStrictEqual([
      {
        from: 0,
        original: "The",
        to: 3,
        replacement: "Most",
      },
      {
        from: 3,
        original: " dogs ",
        to: 9,
        replacement: " dogs ",
      },
      {
        from: 9,
        original: "are on a boat.",
        to: 23,
        replacement: "like bulldozers!",
      },
    ] as Replace[]);
  });

  it("single sentence, word removal", () => {
    expect(
      getDiff("Is this this sentence correct?", "Is this sentence correct?"),
    ).toStrictEqual([
      {
        from: 0,
        original: "Is this ",
        to: 8,
        replacement: "Is this ",
      },
      {
        from: 8,
        original: "this ",
        to: 13,
        replacement: "",
      },
      {
        from: 13,
        original: "sentence correct?",
        to: 30,
        replacement: "sentence correct?",
      },
    ] as Replace[]);
  });
  it("single sentence, word removal from beginning", () => {
    expect(
      getDiff("Is this sentence correct?", "this sentence correct?"),
    ).toStrictEqual([
      {
        from: 0,
        original: "Is ",
        to: 3,
        replacement: "",
      },
      {
        from: 3,
        original: "this sentence correct?",
        to: 25,
        replacement: "this sentence correct?",
      },
    ] as Replace[]);
  });

  it("single sentence, word insert to beginning", () => {
    expect(
      getDiff("this sentence correct?", "Is this sentence correct?"),
    ).toStrictEqual([
      {
        from: 0,
        original: "",
        to: 0,
        replacement: "Is ",
      },
      {
        from: 0,
        original: "this sentence correct?",
        to: 22,
        replacement: "this sentence correct?",
      },
    ] as Replace[]);
  });

  it("single sentence, word insert to end", () => {
    expect(
      getDiff("Is this sentence", "Is this sentence correct?"),
    ).toStrictEqual([
      {
        from: 0,
        original: "Is this sentence",
        to: 16,
        replacement: "Is this sentence",
      },
      {
        from: 16,
        original: "",
        to: 16,
        replacement: " correct?",
      },
    ] as Replace[]);
  });
});
