'use client';

import { Report } from '@/lib/app-components';

export default function ResultsPage({ params }: { params: { id: string } }) {
  return <Report id={params.id} />;
}
