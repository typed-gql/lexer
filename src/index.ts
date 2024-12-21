export interface TokenBase {
  index: number;
}

export interface NumberToken extends TokenBase {
  type: "int" | "float";
  value: number;
}

export interface StringToken extends TokenBase {
  type: "name" | "string";
  value: string;
}

export interface PunctationToken extends TokenBase {
  type: (typeof PUNCTATIONS)[number] | "...";
}

export type Token = NumberToken | StringToken | PunctationToken;

export interface Error extends TokenBase {
  message: string;
}

const PUNCTATIONS = [
  "!",
  "@",
  "$",
  "&",
  "(",
  ")",
  "=",
  "[",
  "]",
  "{",
  "}",
  "|",
  ":",
] as const;

function arrayIncludes<T extends string>(
  array: readonly T[],
  string: string
): string is T {
  return (array as readonly string[]).includes(string);
}

function indexOf(from: string, search: string, offset: number): number {
  const result = from.indexOf(search, offset);
  if (result === -1) {
    return -1;
  } else {
    return result - offset;
  }
}

export function lex(source: string): Token[] | Error {
  const result: Token[] = [];
  let index = 0;
  while (index != source.length) {
    const current = source.charAt(index);
    if (arrayIncludes(PUNCTATIONS, current)) {
      result.push({ index, type: current });
      index++;
      continue;
    } else if ([" ", "\n", "\r", "\t", ","].includes(current)) {
      index++;
      continue;
    }
    if (
      current === "." &&
      (source.charAt(index + 1) !== "." || source.charAt(index + 2) !== ".")
    ) {
      return {
        message: "Invalid '.' that's not part of '...'",
        index,
      };
    }
    if (current === '"') {
      if (source.charAt(index + 1) === '"') {
        if (source.charAt(index + 2) === '"') {
          let endIndex = source.indexOf('"""', index + 3);
          while (endIndex !== -1 && source.charAt(endIndex - 1) === "\\") {
            if (endIndex === -1) {
              return { message: "Unterminated block string", index };
            }
            endIndex = source.indexOf('"""', endIndex + 3);
          }
          result.push({
            type: "string",
            value: postprocessBlockString(
              source.substring(index + 3, endIndex)
            ),
            index,
          });
          index = endIndex + 3;
          continue;
        }
        result.push({ type: "string", value: "", index });
        index += 2;
        continue;
      }
      let endIndex = index + 1;
      while (
        source.charAt(endIndex) !== '"' ||
        source.charAt(endIndex - 1) === "\\"
      ) {
        if (source.charAt(endIndex) === "\n") {
          return { message: "Unterminated string", index };
        }
        endIndex++;
      }
      let postprocessResult = postprocessString(
        source.substring(index + 1, endIndex)
      );
      if (postprocessResult.error) {
        return { message: postprocessResult.message, index };
      }
      result.push({ type: "string", value: postprocessResult.value, index });
      index = endIndex + 1;
    } else if (current === "#") {
      const endIndex = current.indexOf("\n", index);
      if (endIndex === -1) {
        index = source.length;
      } else {
        index = endIndex + 1;
      }
      continue;
    }
    // TODO: number tokens
    return { message: "Unrecognized source character", index };
  }
  return result;
}

function postprocessBlockString(raw: string): string {
  return raw;
  // TODO:
}

type PostprocessStringResult =
  | { error: true; message: string }
  | { error: false; value: string };

function postprocessString(raw: string): PostprocessStringResult {
  let result = raw.replace(/\\([\\/bfnrt"'])/g, (_, char) => {
    switch (char) {
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case '"':
        return '"';
      case "\\":
        return "\\";
      case "/":
        return "/";
      default:
        return char;
    }
  });

  result = result.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
    const codePoint = parseInt(hex, 16);
    if (isNaN(codePoint)) {
      return "\\u" + hex;
    }
    return String.fromCharCode(codePoint);
  });

  if (result.includes("\\")) {
    return { error: true, message: "Invalid escape sequence" };
  }

  return { error: false, value: result };
}
