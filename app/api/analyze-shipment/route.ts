import { NextRequest, NextResponse } from 'next/server';
import { analyzeShipment } from '@/services/ai';
import { adaptToLegacyReport } from '@/services/ai/adapter';
import type { Shipment } from '@/lib/models';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shipment: Shipment = body.shipment;

    if (!shipment || !shipment.productName || !shipment.exportingCountry || !shipment.destinationCountry) {
      return NextResponse.json(
        { error: 'Shipment analysis could not be completed.' },
        { status: 400 },
      );
    }

    const report = await analyzeShipment(shipment);
    const legacyReport = adaptToLegacyReport(report);

    return NextResponse.json(legacyReport);
  } catch {
    return NextResponse.json(
      { error: 'Shipment analysis could not be completed.' },
      { status: 500 },
    );
  }
}
