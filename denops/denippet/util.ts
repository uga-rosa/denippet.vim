export function splitLines(text: string): string[] {
  return text.replaceAll(/\r\n?/g, "\n").split("\n");
}
