import { ADMIN_GUIDE_CORE } from './adminGuideCore';
import { ADMIN_GUIDE_REST } from './adminGuideRest';

export type { AdminGuideLesson } from './adminGuideCore';

export const ADMIN_GUIDE = [...ADMIN_GUIDE_CORE, ...ADMIN_GUIDE_REST];
