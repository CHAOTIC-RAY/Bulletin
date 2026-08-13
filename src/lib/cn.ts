export type ClassValue = string | false | null | undefined | 0;

/** Tiny className joiner (no dep). Filters falsy, joins with space. */
export const cn = (...parts: ClassValue[]): string => parts.filter(Boolean).join(" ");
