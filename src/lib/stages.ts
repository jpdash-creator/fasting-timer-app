import type { StageDef } from '../types';
import { t } from './i18n';

export { STAGES, stageAt, stagesReached } from './stageData';

export const stageLabel = (id: StageDef['id']) => t(`stages.${id}.label`);
export const stageDescription = (id: StageDef['id']) => t(`stages.${id}.description`);
