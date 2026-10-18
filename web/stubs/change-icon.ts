// Safety net: native-only (react-native-change-icon). App icons cannot be changed on web.
export const changeIcon = async (_name: string): Promise<string> => {
  throw new Error('App icons can only be changed in the Android and iOS apps.');
};
export const getIcon = async (): Promise<string> => 'Default';
export const resetIcon = async (): Promise<void> => undefined;
