/** Web: sharing a captured image is not supported (the screen shows the "unavailable" message). */
export async function canShareFiles(): Promise<boolean> {
  return false;
}

export async function sharePng(_uri: string, _title: string): Promise<void> {
  throw new Error('share unavailable on web');
}
