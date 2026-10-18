/**
 * Web build (react-native-web + Vite 8). Used for Playwright / axe testing and optional web hosting.
 * Native builds use Metro (metro.config.js) and never read this file. See docs/MIGRATION.md (web section).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

const root = path.dirname(fileURLToPath(import.meta.url));
const stub = (name: string) => path.resolve(root, 'web/stubs', name);

// Native-only packages that must never execute on web. src/platform/*.web.ts(x) siblings are the real
// implementations; these aliases are a safety net so a stray import cannot crash the bundle.
const nativeStubs: Record<string, string> = {
  '@notifee/react-native': stub('notifee.ts'),
  'react-native-iap': stub('iap.ts'),
  'react-native-nitro-modules': stub('nitro-modules.ts'),
  'react-native-change-icon': stub('change-icon.ts'),
  'react-native-share': stub('share.ts'),
  'react-native-blob-util': stub('blob-util.ts'),
  'react-native-haptic-feedback': stub('haptic-feedback.ts'),
  'react-native-device-info': stub('device-info.ts'),
  'react-native-config': stub('config.ts'),
  'react-native-localize': stub('localize.ts'),
  'react-native-linear-gradient': stub('linear-gradient.tsx'),
  '@react-native-community/datetimepicker': stub('datetimepicker.tsx'),
  '@react-native-vector-icons/ionicons/static': stub('vector-icons.tsx'),
  '@react-native-vector-icons/ionicons': stub('vector-icons.tsx'),
};

const webExtensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];

export default defineConfig(({ mode }) => ({
  root: path.resolve(root, 'web'),
  publicDir: path.resolve(root, 'web/public'),
  envDir: root,
  // Only VITE_* variables are exposed (see web/stubs/config.ts / src/lib/config).
  build: {
    outDir: path.resolve(root, 'dist-web'),
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 2500,
    // react-native-* packages ship JSX inside .js files.
    rolldownOptions: { moduleTypes: { '.js': 'jsx' } },
  },
  server: { host: true, port: 8081, strictPort: true, fs: { allow: [root] } },
  preview: { host: true, port: 8081, strictPort: true },
  plugins: [
    // Reanimated 4 / worklets: the babel plugin must run on app source (auto-workletizes useAnimatedStyle & co).
    babel({
      include: [/[\\/]src[\\/].*\.[jt]sx?$/, /[\\/]web[\\/].*\.[jt]sx?$/],
      exclude: [/node_modules/],
      plugins: ['react-native-worklets/plugin'],
    }),
    react(),
  ],
  resolve: {
    extensions: webExtensions,
    // Order matters: more specific keys first. The 'react-native' exact alias must not swallow 'react-native-*'.
    alias: [
      ...Object.entries(nativeStubs).map(([find, replacement]) => ({ find: new RegExp(`^${find}$`), replacement })),
      { find: /^react-native$/, replacement: stub('react-native.ts') },
      { find: /^@react-native\/assets-registry\/registry$/, replacement: 'react-native-web/dist/modules/AssetRegistry/index.js' },
      { find: /^react-native\/Libraries\/Utilities\/codegenNativeComponent$/, replacement: stub('empty.ts') },
    ],
    dedupe: ['react', 'react-dom', 'react-native-web'],
  },
  define: {
    __DEV__: JSON.stringify(mode !== 'production'),
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env.EXPO_OS': JSON.stringify('web'),
    // react-native-reanimated / worklets / gifted-charts read these at module scope.
    'process.env.JEST_WORKER_ID': 'undefined',
    global: 'globalThis',
  },
  optimizeDeps: {
    // react-native-* packages ship JSX / Flow inside .js files.
    rolldownOptions: {
      resolve: { extensions: webExtensions },
      moduleTypes: { '.js': 'jsx' },
    },
    include: ['react-native-web'],
    exclude: [],
  },
}));
