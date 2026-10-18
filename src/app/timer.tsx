import { Redirect } from 'expo-router';

/** Deep-link alias: fastline://timer opens the Timer tab (spec 6). */
export default function TimerAlias() {
  return <Redirect href="/" />;
}
