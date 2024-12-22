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

export interface PunctuationToken extends TokenBase {
  type:
    | "!"
    | "@"
    | "$"
    | "&"
    | "("
    | ")"
    | "="
    | "["
    | "]"
    | "{"
    | "}"
    | "|"
    | ":"
    | "...";
}

export type Token = NumberToken | StringToken | PunctuationToken;

export interface Error extends TokenBase {
  message: string;
}

const PUNCTUATIONS = [
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

export function lex(source: string): Token[] | Error {
  const result: Token[] = [];
  let index = 0;
  while (index != source.length) {
    const current = source[index];
    if (arrayIncludes(PUNCTUATIONS, current)) {
      result.push({ type: current, index });
      index++;
      continue;
    } else if ([" ", "\n", "\r", "\t", ","].includes(current)) {
      index++;
      continue;
    } else if (current === ".") {
      if (source[index + 1] !== "." || source[index + 2] !== ".") {
        return {
          message: "Invalid '.' that's not part of '...' or float",
          index,
        };
      }
      result.push({ type: "...", index });
      index += 3;
      continue;
    } else if (current === '"') {
      if (source[index + 1] === '"') {
        if (source[index + 2] === '"') {
          let endIndex = source.indexOf('"""', index + 3);
          while (endIndex !== -1 && source[endIndex - 1] === "\\") {
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
      while (source[endIndex] !== '"' || source[endIndex - 1] === "\\") {
        if (source[endIndex] === "\n") {
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
      continue;
    } else if (current === "#") {
      const endIndex = current.indexOf("\n", index);
      if (endIndex === -1) {
        index = source.length;
      } else {
        index = endIndex + 1;
      }
      continue;
    } else if (/[0-9-]/.test(current)) {
      let isNegative = false;
      let isFloat = false;
      let length = 0;
      let value = 0;
      if (current === "-") {
        isNegative = true;
        length++;
      }
      if (source[index + length] === "0") {
        length++;
        if (/\d/.test(source[index + length])) {
          return { message: "Invalid number literal", index };
        }
      } else if (!/[1-9]/.test(source[index + length])) {
        return { message: "Invalid number literal", index };
      }
      while (/\d/.test(source[index + length])) {
        value = value * 10 + parseInt(source[index + length]);
        length++;
      }
      if (source[index + length] === ".") {
        isFloat = true;
        length++;
        let base = 1;
        if (!/\d/.test(source[index + length])) {
          return { message: "Invalid number literal", index };
        }
        while (/\d/.test(source[index + length])) {
          base /= 10;
          value += base * parseInt(source[index + length]);
          length++;
        }
      }
      if (source[index + length] === "e" || source[index + length] === "E") {
        isFloat = true;
        length++;
        let isNegative = false;
        if (source[index + length] === "+") {
          length++;
        } else if (source[index + length] === "-") {
          isNegative = true;
          length++;
        }
        let exponent = 1;
        if (!/\d/.test(source[index + length])) {
          return { message: "Invalid number literal", index };
        }
        while (/\d/.test(source[index + length])) {
          exponent = exponent * 10 + parseInt(source[index + length]);
          length++;
        }
        if (isNegative) {
          exponent *= -1;
        }
        value *= Math.pow(10, exponent);
      }
      if (isNegative) {
        value *= 1;
      }
      if (/[a-zA-Z_.]/.test(source[index + length])) {
        return { message: "Invalid number literal", index };
      }
      result.push({ type: isFloat ? "float" : "int", value, index });
      index += length;
      continue;
    } else if (/[a-zA-Z_]/.test(current)) {
      let length = 1;
      while (/\w/.test(source[index + length])) {
        length++;
      }
      result.push({
        type: "name",
        value: source.substring(index, index + length),
        index,
      });
      index += length;
      continue;
    }
    return { message: "Unrecognized source character", index };
  }
  return result;
}

function postprocessBlockString(raw: string): string {
  const lines = raw.split(/\r\n|[\n\r]/);

  let commonIndent: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    const indent = line.match(/^\s*/)?.[0]?.length ?? 0;
    if (
      indent < line.length &&
      (commonIndent === null || indent < commonIndent)
    ) {
      commonIndent = indent;
    }
  }

  if (commonIndent !== null) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  }

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  let formatted = "";
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      formatted += "\n";
    }
    formatted += lines[i];
  }

  return formatted;
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
