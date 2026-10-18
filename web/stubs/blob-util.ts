// Safety net: native-only (react-native-blob-util). Web export uses Blob downloads in src/platform.
const fail = async (): Promise<never> => {
  throw new Error('react-native-blob-util is not available on web');
};
const ReactNativeBlobUtil = {
  fs: { dirs: { CacheDir: '', DocumentDir: '' }, writeFile: fail, unlink: fail, exists: async () => false },
  config: () => ({ fetch: fail }),
  fetch: fail,
};
export default ReactNativeBlobUtil;
