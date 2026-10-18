// Safety net: native-only (react-native-share).
const fail = async (): Promise<never> => {
  throw new Error('react-native-share is not available on web');
};
const Share = { open: fail, shareSingle: fail };
export default Share;
