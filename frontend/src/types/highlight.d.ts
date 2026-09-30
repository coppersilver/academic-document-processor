// Custom Highlight API declarations for TypeScript

declare class Highlight {
  constructor(...ranges: Range[]);
  add(range: Range): void;
  clear(): void;
  delete(range: Range): boolean;
  has(range: Range): boolean;
  readonly size: number;
  priority: number;
  type: string;
}

interface HighlightRegistry extends Map<string, Highlight> {}

declare namespace CSS {
  const highlights: HighlightRegistry | undefined;
}
