// Safety net: native-only (react-native-nitro-modules).
export const NitroModules = {
  createHybridObject: (name: string): never => {
    throw new Error(`Nitro hybrid object "${name}" is not available on web`);
  },
  hasHybridObject: () => false,
};
