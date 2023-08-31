export function splitLines(text: string): string[] {
  return text.replaceAll(/\r\n?/g, "\n").split("\n");
}

export function toArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

export function toString(x: string | string[]): string {
  return Array.isArray(x) ? x.join("\n") : x;
}
