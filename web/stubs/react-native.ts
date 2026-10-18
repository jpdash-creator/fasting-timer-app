// 'react-native' on web = react-native-web plus the few native-only exports that third-party
// packages import at module scope (they must exist, but are never used on web).
export * from 'react-native-web';

export const TurboModuleRegistry = {
  get: <T>(_name: string): T | null => null,
  getEnforcing: <T>(name: string): T => {
    throw new Error(`Native module "${name}" is not available on web`);
  },
};

export const codegenNativeComponent = (name: string) => name;
export const codegenNativeCommands = <T>(): T => ({}) as T;
