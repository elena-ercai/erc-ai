'use client';

import { BookOpen } from 'lucide-react';
import { SimplePage } from '@/lib/app-components';

export default function ResourcesRoute() {
  return <SimplePage title="Resources" subtitle="Practical guidance, checklists, and trade-readiness resources for exporters." active="/resources" icon={BookOpen} />;
}
