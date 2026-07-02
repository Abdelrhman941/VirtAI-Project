export function normalizeMarkdown(input: string): string {
  let out = input;
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
  out = out.replace(
    /^((?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]\s*)+)\n+(?=#+\s)/gmu,
    '$1 ',
  );
  return out;
}
