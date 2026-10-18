import Share from 'react-native-share';

/** Native share sheet is always present; kept async so callers match the web variant. */
export async function canShareFiles(): Promise<boolean> {
  return true;
}

/** Shares a local PNG (file path or file:// URI from react-native-view-shot). */
export async function sharePng(uri: string, title: string): Promise<void> {
  const url = /^(file|content|data):/.test(uri) ? uri : `file://${uri}`;
  await Share.open({ url, type: 'image/png', title, failOnCancel: false });
}
