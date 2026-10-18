import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootParamList } from './types';

/** Shared ref so code outside components (router, notifications) can navigate. */
export const navigationRef = createNavigationContainerRef<RootParamList>();
