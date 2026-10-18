// Safety net: native-only (react-native-device-info).
const DeviceInfo = {
  getVersion: () => '1.0.0',
  getBuildNumber: () => '1',
  getReadableVersion: () => '1.0.0.1',
  getModel: () => 'web',
  getSystemVersion: () => 'web',
  isEmulator: async () => false,
};
export default DeviceInfo;
