export function clipboardImageFiles(event: Pick<ClipboardEvent, 'clipboardData'>): File[] {
  const items = Array.from(event.clipboardData?.items ?? [])

  return items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}
