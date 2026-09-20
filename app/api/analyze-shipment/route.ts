import { NextRequest, NextResponse } from 'next/server';
import { analyzeShipment } from '@/services/ai';
import { adaptToLegacyReport } from '@/services/ai/adapter';
import type { Shipment } from '@/lib/models';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shipment: Shipment = body.shipment;

    const requiredFields: (keyof Shipment)[] = [
      'productName', 'hsCode', 'exportingCountry', 'countryOfOrigin', 'destinationCountry',
    ];
    const missing = requiredFields.filter(
      (field) => !shipment?.[field] || shipment[field].trim() === '' || shipment[field].trim() === 'Unknown',
    );

    if (missing.length > 0) {
      return NextResponse.json(
        { error: 'Shipment analysis could not be completed. Required fields are missing.' },
        { status: 400 },
      );
    }

    // Validate HS Code format (6 or 8 digits, no 7-digit)
    const hsCodeClean = (shipment.hsCode || '').replace(/[^0-9]/g, '');
    if (hsCodeClean.length !== 6 && hsCodeClean.length !== 8) {
      return NextResponse.json(
        { error: 'HS Code must be 6 or 8 digits.' },
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
