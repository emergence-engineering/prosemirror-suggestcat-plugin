import diff from "fast-diff";

export interface Replace {
  from: number;
  to: number;
  original: string;
  replacement: string;
}

export const isIdentity = (replace: Replace) =>
  replace.replacement === replace.original;

export const convertDiffToReplaceSet = (diffSet: diff.Diff[]): Replace[] => {
  let position = 0;
  return (
    diffSet
      /* eslint-disable */
      .map(([type, text]): Replace[] => {
        switch (type) {
          case diff.EQUAL:
            const lastLineBreak = text.lastIndexOf("\n");
            const equal = {
              from: position,
              to: position + text.length,
              original: text,
              replacement: text,
            };
            if (lastLineBreak !== -1 && text !== "\n") {
              const multilineEq = [
                {
                  from: position,
                  to: position + lastLineBreak + 1,
                  original: text.slice(0, lastLineBreak + 1),
                  replacement: text.slice(0, lastLineBreak + 1),
                },
                {
                  from: position + lastLineBreak + 1,
                  to: position + text.length,
                  original: text.slice(lastLineBreak + 1),
                  replacement: text.slice(lastLineBreak + 1),
                },
              ];
              position += text.length;
              return multilineEq;
            }
            position += text.length;
            return [equal];
          case diff.DELETE:
            const deletion = {
              from: position,
              to: position + text.length,
              original: text,
              replacement: "",
            };
            position += text.length;
            return [deletion];
          case diff.INSERT:
            return [
              {
                from: position,
                to: position,
                original: "",
                replacement: text,
              },
            ];
        }
      })
      .flat()
  );
};

export const mergeReplacePair = (
  leftReplace: Replace,
  rightReplace: Replace,
): Replace[] => {
  if (leftReplace.to !== rightReplace.from)
    throw new Error(`Replace pairs must be adjacent\n
, ${JSON.stringify({ leftReplace, rightReplace })}`);
  if (leftReplace.replacement.endsWith("\n"))
    return [leftReplace, rightReplace];
  if (isIdentity(leftReplace) && isIdentity(rightReplace)) {
    return [
      {
        from: leftReplace.from,
        to: rightReplace.to,
        original: leftReplace.original + rightReplace.original,
        replacement: leftReplace.replacement + rightReplace.replacement,
      },
    ];
  }
  if (isIdentity(leftReplace)) {
    if (
      (rightReplace.replacement.startsWith(" ") &&
        rightReplace.original === "") ||
      (rightReplace.original.startsWith(" ") && rightReplace.replacement === "")
    ) {
      return [leftReplace, rightReplace];
    }
    const leftSplit = leftReplace.original.split(" ");
    const lastWord = leftSplit.pop() || "";
    const textWithoutLastWord =
      leftSplit.join(" ") + (leftSplit.length ? " " : "");
    return [
      ...(textWithoutLastWord.length
        ? [
            {
              from: leftReplace.from,
              to: leftReplace.from + textWithoutLastWord.length,
              original: textWithoutLastWord,
              replacement: textWithoutLastWord,
            },
          ]
        : []),
      {
        from: leftReplace.from + textWithoutLastWord.length,
        to: rightReplace.to,
        original: lastWord + rightReplace.original,
        replacement: lastWord + rightReplace.replacement,
      },
    ];
  }
  if (isIdentity(rightReplace)) {
    if (
      (leftReplace.replacement.endsWith(" ") && leftReplace.original === "") ||
      (leftReplace.original.endsWith(" ") && leftReplace.replacement === "")
    ) {
      return [leftReplace, rightReplace];
    }
    const rightSplit = rightReplace.original.split(" ");
    const firstWord = rightSplit.shift() || "";
    const textWithoutFirstWord =
      (rightSplit.length ? " " : "") + rightSplit.join(" ");
    if (textWithoutFirstWord === " ")
      return [
        {
          from: leftReplace.from,
          to: rightReplace.to,
          original: leftReplace.original + rightReplace.original,
          replacement: leftReplace.replacement + rightReplace.replacement,
        },
      ];
    return [
      {
        from: leftReplace.from,
        to: leftReplace.to + firstWord.length,
        original: leftReplace.original + firstWord,
        replacement: leftReplace.replacement + firstWord,
      },
      ...(textWithoutFirstWord.length
        ? [
            {
              from: leftReplace.to + firstWord.length,
              to: rightReplace.to,
              original: textWithoutFirstWord,
              replacement: textWithoutFirstWord,
            },
          ]
        : []),
    ];
  }
  return [
    {
      from: leftReplace.from,
      to: rightReplace.to,
      original: leftReplace.original + rightReplace.original,
      replacement: leftReplace.replacement + rightReplace.replacement,
    },
  ];
};

const reduceReplaceSet = (replaceSet: Replace[]): Replace[] => {
  return replaceSet.reduce((acc, curr) => {
    const last: Replace | undefined = acc[acc.length - 1];
    const head = acc.slice(0, acc.length - 1);
    if (!last) return [curr];
    const merged = mergeReplacePair(last, curr);
    return [...head, ...merged];
  }, [] as Replace[]);
};

export const getDiff = (original: string, fixed: string) => {
  const changes = diff(original, fixed);
  const replaceSet = convertDiffToReplaceSet(changes);
  return reduceReplaceSet(reduceReplaceSet(replaceSet));
};
