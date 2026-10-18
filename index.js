/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import notifee from '@notifee/react-native';
import App from './src/App';
import { handleNotificationEvent } from './src/services/notificationEvents';
import { name as appName } from './app.json';

// Must be registered at module top level (outside any component) so taps while the app is in the
// background or killed are delivered. Foreground taps are handled in services/notifications.ts.
notifee.onBackgroundEvent(handleNotificationEvent);

AppRegistry.registerComponent(appName, () => App);
