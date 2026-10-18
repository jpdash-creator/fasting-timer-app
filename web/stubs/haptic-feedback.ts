// Safety net: native-only (react-native-haptic-feedback). No-op on web.
export const trigger = (_type?: string, _options?: unknown): void => undefined;
export default { trigger };
