/**
 * Web entry (Vite). Mirrors /index.js for native: registers src/App with react-native-web.
 * Used for Playwright / axe testing and optional web hosting. See docs/MIGRATION.md (web section).
 * The Ionicons @font-face is installed by src/platform/icons.web.tsx on first render.
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from '../src/App';

const APP_NAME = 'Fastline';
AppRegistry.registerComponent(APP_NAME, () => App);
const rootTag = document.getElementById('root');
if (!rootTag) throw new Error('Missing #root element');
// react-native-web accepts a DOM element; its public typings are absent, so the options object is untyped.
(AppRegistry.runApplication as (name: string, params: { rootTag: HTMLElement }) => void)(APP_NAME, { rootTag });
