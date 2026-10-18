import DeviceInfo from 'react-native-device-info';

export function getAppVersion(): string {
  try { return DeviceInfo.getVersion() || '1.0.0'; } catch { return '1.0.0'; }
}
