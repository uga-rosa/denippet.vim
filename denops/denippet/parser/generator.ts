type ParserResult<T = unknown> = {
  parsed: true;
  value: T;
  pos: number;
} | {
  parsed: false;
  value?: undefined;
  pos: number;
};

export type Parser<T> = (input: string, pos: number) => ParserResult<T>;

type ParserMapFn<T, U> = (value: T) => U;

type TupleParsers<T extends unknown[]> = { [K in keyof T]: Parser<T[K]> };

function unmatch<T>(
  pos: number,
): ParserResult<T> {
  return {
    parsed: false,
    pos: pos,
  };
}

export function takeUntil(
  targets: string[],
  specials: string[],
): Parser<{ raw: string; esc: string }> {
  return (input, pos) => {
    let new_pos = pos;
    const raw: string[] = [];
    const esc: string[] = [];

    while (new_pos < input.length) {
      const c = input.charAt(new_pos);

      if (c === "\\") {
        raw.push("\\");
        new_pos += 1;
        const nextChar = input.charAt(new_pos);

        if (!targets.includes(nextChar) && !specials.includes(nextChar)) {
          esc.push("\\");
        }

        raw.push(nextChar);
        esc.push(nextChar);
        new_pos += 1;
      } else {
        if (targets.includes(c)) {
          break;
        }
        raw.push(c);
        esc.push(c);
        new_pos += 1;
      }
    }

    if (new_pos === pos) {
      return unmatch(pos);
    }

    return {
      parsed: true,
      value: {
        raw: raw.join(""),
        esc: esc.join(""),
      },
      pos: new_pos,
    };
  };
}

export function map<T, U>(
  parser: Parser<T>,
  mapFn: ParserMapFn<T, U>,
): Parser<U> {
  return (input, pos) => {
    const result = parser(input, pos);
    if (result.parsed) {
      return {
        parsed: true,
        value: mapFn(result.value!),
        pos: result.pos,
      };
    } else {
      return unmatch(pos);
    }
  };
}

export function lazy<T>(factory: () => Parser<T>): Parser<T> {
  return (input, pos) => {
    return factory()(input, pos);
  };
}

export function token<T extends string>(token: T): Parser<T> {
  return (input, pos) => {
    const maybeToken = input.substring(pos, pos + token.length);
    if (maybeToken === token) {
      return {
        parsed: true,
        value: maybeToken as T,
        pos: pos + token.length,
      };
    }
    return unmatch(pos);
  };
}

export function pattern(p: string): Parser<string> {
  const regexp = new RegExp("^" + p);
  return (input, pos) => {
    const maybeMatch = input.slice(pos).match(regexp);
    if (maybeMatch) {
      return {
        parsed: true,
        value: maybeMatch[0],
        pos: pos + maybeMatch[0].length,
      };
    }
    return unmatch(pos);
  };
}

export function many<T>(parser: Parser<T>): Parser<T[]> {
  return (input, pos) => {
    const values: T[] = [];
    let new_pos = pos;

    while (new_pos < input.length) {
      const result = parser(input, new_pos);

      if (!result.parsed) {
        break;
      }

      values.push(result.value!);
      new_pos = result.pos;
    }

    if (values.length > 0) {
      return {
        parsed: true,
        value: values,
        pos: new_pos,
      };
    }

    return unmatch(pos);
  };
}

export function opt<T>(parser: Parser<T>): Parser<T | undefined> {
  return (input, pos) => {
    const result = parser(input, pos);
    return {
      parsed: true,
      value: result.value,
      pos: result.pos,
    };
  };
}

export function or<T extends unknown[]>(
  ...parsers: TupleParsers<T>
): Parser<T[number]> {
  return (input, pos) => {
    for (const parser of parsers) {
      const result = parser(input, pos);
      if (result.parsed) {
        return result;
      }
    }

    return unmatch(pos);
  };
}

export function seq<T extends unknown[]>(
  ...parsers: TupleParsers<T>
): Parser<T> {
  return (input, pos) => {
    const values: unknown[] = [];
    let new_pos = pos;

    for (const parser of parsers) {
      const result = parser(input, new_pos);
      if (result.parsed) {
        values.push(result.value!);
        new_pos = result.pos;
      } else {
        return unmatch(pos);
      }
    }

    return {
      parsed: true,
      value: values as T,
      pos: new_pos,
    };
  };
}
