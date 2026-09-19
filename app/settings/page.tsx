'use client';

import { Settings } from 'lucide-react';
import { SimplePage } from '@/lib/app-components';

export default function SettingsRoute() {
  return <SimplePage title="Settings" subtitle="Manage your workspace preferences and report defaults." active="/settings" icon={Settings} />;
}
