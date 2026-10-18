import pkg from '../../package.json';

export function getAppVersion(): string {
  return (pkg as { version?: string }).version ?? '1.0.0';
}
