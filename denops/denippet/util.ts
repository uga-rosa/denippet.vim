export function splitLines(text: string): string[] {
  return text.replaceAll(/\r\n?/g, "\n").split("\n");
}

export async function asyncFilter<T>(
  array: T[],
  callback: (x: T) => Promise<boolean>,
): Promise<T[]> {
  const bits = await Promise.all(array.map(callback));
  return array.filter((_, i) => bits[i]);
}
