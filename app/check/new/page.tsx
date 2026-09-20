'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shipment } from '@/lib/models';
import { getHsCodeSources, HsCodeSource } from '@/lib/hs-code-sources';
import {
  AppShell, PageHeader, Stepper, PrimaryButton, SectionTitle,
  CountrySelect, Field, cx,
} from '@/lib/app-components';
import {
  AlertTriangle, ArrowRight, Bot, ChevronDown, ChevronLeft,
  Info, Search, X,
} from 'lucide-react';

const REQUIRED_FIELDS: (keyof Shipment)[] = [
  'productName', 'hsCode', 'exportingCountry', 'destinationCountry', 'countryOfOrigin',
];

function isValidHsCode(code: string): boolean {
  const cleaned = code.replace(/[^0-9]/g, '');
  return cleaned.length === 6 || cleaned.length === 8;
}

function blankShipment(): Shipment {
  return {
    productName: '', hsCode: '', productCategory: '', productCharacteristics: '',
    exportingCountry: '', destinationCountry: '', countryOfOrigin: '',
    buyerImporter: '', plannedImportDate: '', endUse: '',
    supplyChainInformation: '', certificates: '',
  };
}

const FIELD_HELP: Record<string, string> = {
  productName: 'Tell me what product you plan to export. A clear name or description helps ERC AI identify relevant regulations.',
  hsCode: 'What is the HS Code for your product? It must be 6 or 8 digits. If you don\'t know it, use the lookup button to find the official source for your export country.',
  exportingCountry: 'Which country or territory are you exporting from? This determines which HS Code lookup source and export-side regulations apply.',
  destinationCountry: 'Which country or market are you exporting to? This determines which destination-side regulations and requirements apply.',
  countryOfOrigin: 'Where was the product manufactured or produced? This affects rules of origin, trade agreements, and sustainability regulations. It is not assumed to be the same as the export country.',
  buyerImporter: 'Do you have a specific buyer or importer? Providing this enables buyer risk screening. You can skip this field.',
  productCategory: 'What category does your product fall under? (e.g., electronics, textiles, metals) This helps narrow down applicable regulations.',
  productCharacteristics: 'What are the key characteristics of your product? (e.g., material, composition, end-use details) This improves classification accuracy.',
  endUse: 'What is the intended use of the product in the destination market? This may affect export control and regulatory requirements.',
  supplyChainInformation: 'Do you have supply-chain details? (e.g., sourcing of raw materials, manufacturing location) This helps with origin and sustainability checks.',
  certificates: 'Do you have any certificates or documents ready? (e.g., Mill Certificate, Certificate of Origin) This helps assess evidence readiness.',
  plannedImportDate: 'When do you plan to import the goods? This helps determine whether a regulation is active, upcoming, transitional, or no longer applicable.',
};

export default function NewCheckPage() {
  return (
    <Suspense fallback={null}>
      <NewCheckForm />
    </Suspense>
  );
}

function NewCheckForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new') === '1';

  // On ?new=1, check if a draft exists. If so, show a confirmation dialog
  // before clearing anything. The user must explicitly choose to replace.
  const [showNewCheckDialog, setShowNewCheckDialog] = useState(false);
  const [draftCleared, setDraftCleared] = useState(!isNew);

  useEffect(() => {
    if (isNew && typeof window !== 'undefined') {
      const hasDraft = !!localStorage.getItem('erc-shipment');
      if (hasDraft) {
        setShowNewCheckDialog(true);
      } else {
        // No draft to replace — proceed directly
        setDraftCleared(true);
      }
    }
  }, [isNew]);

  const confirmNewCheck = () => {
    localStorage.removeItem('erc-shipment');
    localStorage.removeItem('erc-hs-confirmed');
    setShowNewCheckDialog(false);
    setDraftCleared(true);
  };

  const cancelNewCheck = () => {
    // Keep the draft — go back to draft mode (no ?new=1)
    setShowNewCheckDialog(false);
    router.replace('/check/new');
  };

  // For new checks: start blank. For return-from-review: restore draft.
  const [shipment, setShipment] = useState<Shipment>(() => {
    if (typeof window !== 'undefined' && !isNew) {
      try {
        const saved = localStorage.getItem('erc-shipment');
        if (saved) return { ...blankShipment(), ...JSON.parse(saved) };
      } catch { /* ignore */ }
    }
    return blankShipment();
  });
  const [error, setError] = useState('');
  const [showErcie, setShowErcie] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showHsSearch, setShowHsSearch] = useState(false);
  // Confirmation is tied to the exact {product, code, country} triple.
  // Changing any of the three — or starting a new draft — voids it.
  const [hsConfirmed, setHsConfirmed] = useState<{ product: string; code: string; country: string } | null>(() => {
    if (typeof window !== 'undefined' && !isNew) {
      try { return JSON.parse(localStorage.getItem('erc-hs-confirmed') || 'null'); } catch { return null; }
    }
    return null;
  });

  // When ?new=1 is present, wipe draft storage so nothing leaks from the previous check.
  // This is now handled by the confirmation dialog above — no auto-clear here.
  // (kept as a no-op guard for safety)
  useEffect(() => {
    // clearing is done in confirmNewCheck after user confirms
  }, [isNew]);

  const update = (key: keyof Shipment) => (value: string) => {
    setShipment((prev) => ({ ...prev, [key]: value }));
    setError('');
    // Void HS confirmation if HS code or product name changes
    if (key === 'hsCode' || key === 'productName') setHsConfirmed(null);
  };

  const updateExportCountry = (value: string) => {
    setShipment((prev) => ({ ...prev, exportingCountry: value }));
    setError('');
    setHsConfirmed(null);
  };

  const hsNeedsConfirm =
    !!shipment.hsCode &&
    !!shipment.exportingCountry &&
    !!shipment.productName &&
    (hsConfirmed?.product !== shipment.productName ||
     hsConfirmed?.code !== shipment.hsCode ||
     hsConfirmed?.country !== shipment.exportingCountry);

  const confirmHs = () => {
    const triple = { product: shipment.productName, code: shipment.hsCode, country: shipment.exportingCountry };
    setHsConfirmed(triple);
    if (typeof window !== 'undefined') {
      localStorage.setItem('erc-hs-confirmed', JSON.stringify(triple));
    }
    setError('');
  };

  const hsSources: HsCodeSource[] = useMemo(
    () => getHsCodeSources(shipment.exportingCountry),
    [shipment.exportingCountry],
  );

  const completedCount = REQUIRED_FIELDS.filter((k) => {
    const v = shipment[k];
    return v && v.trim() && v.trim() !== 'Unknown';
  }).length;

  const run = () => {
    const missing = REQUIRED_FIELDS.filter((k) => {
      const v = shipment[k];
      return !v || !v.trim() || v.trim() === 'Unknown';
    });
    if (missing.length > 0) {
      setError('Please complete all required fields before continuing.');
      return;
    }
    const hsClean = (shipment.hsCode || '').replace(/[^0-9]/g, '');
    if (hsClean.length !== 6 && hsClean.length !== 8) {
      setError('HS Code must be 6 or 8 digits.');
      return;
    }
    if (hsNeedsConfirm) {
      setError('Please confirm the HS Code for this shipment before continuing.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('erc-shipment', JSON.stringify(shipment));
    }
    router.push('/check/review');
  };

  return (
    <AppShell active="/check/new">
      <PageHeader
        title="Shipment Intake"
        subtitle="Tell us about your shipment. We'll check applicable regulations, risks, and possible reliefs for your target market."
        action={<Stepper step={1} />}
      />
      {showNewCheckDialog && (
        <div className="modal-backdrop" onClick={cancelNewCheck}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="ercie-hs-header">
              <AlertTriangle size={22} />
              <h2>Start a new check?</h2>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#555', margin: '12px 0 20px' }}>
              You have an unfinished draft. Starting a new check will permanently discard it and its HS Code confirmation.
              To continue where you left off, choose Cancel.
            </p>
            <div className="form-actions" style={{ gap: '10px' }}>
              <button className="secondary-button" onClick={cancelNewCheck}>Cancel (keep draft)</button>
              <button className="primary-button" onClick={confirmNewCheck}>Start new check</button>
            </div>
          </div>
        </div>
      )}
      <div className="intake-layout">
        {/* ── Main form ────────────────────────────────────────────────────── */}
        <form
          className="content-card intake-form"
          onSubmit={(e) => { e.preventDefault(); run(); }}
        >
          {/* Ask Ercie button */}
          <div className="intake-ercie-bar">
            <button
              type="button"
              className="ercie-toggle-btn"
              onClick={() => setShowErcie(true)}
            >
              <Bot size={16} /> Ask Ercie
            </button>
            <span className="intake-progress-text">
              {completedCount}/{REQUIRED_FIELDS.length} required fields completed
            </span>
          </div>

          {/* Section 1: Product Information */}
          <SectionTitle number="1" title="Product Information" />
          <Field label="Product name / description" required value={shipment.productName} onChange={update('productName')} />
          <div className="field-row">
            <div className="field-hs-wrap">
              <Field label="HS Code" required value={shipment.hsCode} onChange={update('hsCode')} />
              {hsNeedsConfirm && (
                <div className="hs-confirm-banner">
                  <AlertTriangle size={14} />
                  <span>You are using HS <strong>{shipment.hsCode}</strong> for this shipment (export country: <strong>{shipment.exportingCountry}</strong>). Please confirm this is the code you intend to use.</span>
                  <button type="button" className="hs-confirm-btn" onClick={confirmHs}>
                    I confirm HS {shipment.hsCode} for this shipment (export country: {shipment.exportingCountry})
                  </button>
                </div>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => setShowHsSearch(true)}
                disabled={!shipment.exportingCountry}
                title={shipment.exportingCountry ? 'Search HS Code' : 'Select export country first'}
              >
                <Search size={14} /> HS Code Lookup
              </button>
            </div>
            <Field label="Product category" value={shipment.productCategory} onChange={update('productCategory')} />
          </div>
          <Field label="Key product characteristics" multiline value={shipment.productCharacteristics} onChange={update('productCharacteristics')} />

          {/* Section 2: Trade Information */}
          <SectionTitle number="2" title="Trade Information" />
          <div className="field-row two">
            <CountrySelect label="Export country" required value={shipment.exportingCountry} onChange={updateExportCountry} />
            <CountrySelect label="Destination country" required value={shipment.destinationCountry} onChange={update('destinationCountry')} />
            <CountrySelect label="Country of origin" required value={shipment.countryOfOrigin} onChange={update('countryOfOrigin')} />
            <label className="field">
              <span>Buyer / Importer <small className="field-optional">(optional)</small></span>
              <input value={shipment.buyerImporter} onChange={(e) => update('buyerImporter')(e.target.value)} placeholder="Buyer or importer name" />
            </label>
            <label className="field">
              <span>Planned Import / Entry Date</span>
              <input type="date" value={shipment.plannedImportDate} onChange={(e) => update('plannedImportDate')(e.target.value)} />
            </label>
            <Field label="End use" multiline value={shipment.endUse} onChange={update('endUse')} />
          </div>

          {/* Optional fields toggle */}
          <button
            type="button"
            className="optional-toggle"
            onClick={() => setShowOptional(!showOptional)}
          >
            <ChevronDown
              size={16}
              className={cx('optional-chevron', showOptional && 'optional-chevron-open')}
            />
            {showOptional ? 'Hide' : 'Show'} additional fields
          </button>

          {showOptional && (
            <div className="optional-fields">
              <Field label="Supply-chain information" multiline value={shipment.supplyChainInformation} onChange={update('supplyChainInformation')} />
              <Field label="Known certificates / documents" value={shipment.certificates} onChange={update('certificates')} />
            </div>
          )}

          {/* Country of origin note */}
          <div className="ercie-notice ercie-notice-inline">
            <Info size={14} />
            <span>Country of origin is where the product was manufactured. It is not assumed to be the same as the export country.</span>
          </div>

          {/* HS Code lookup modal */}
          {showHsSearch && (
            <HsCodeLookupModal
              sources={hsSources}
              exportCountry={shipment.exportingCountry}
              onClose={() => setShowHsSearch(false)}
            />
          )}

          {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}

          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => {
              setShipment(blankShipment());
              setError('');
              setHsConfirmed(null);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('erc-shipment');
                localStorage.removeItem('erc-hs-confirmed');
              }
            }}>
              Clear
            </button>
            <PrimaryButton type="submit">Confirm <ArrowRight size={17} /></PrimaryButton>
          </div>
        </form>

        {/* ── Side panel: required fields checklist ─────────────────────────── */}
        <aside className="checks-panel content-card ercie-side-panel">
          <h2>Required Information</h2>
          <p>Complete all required fields to run the risk check.</p>
          <div className="ercie-checks-list">
            {REQUIRED_FIELDS.map((key) => {
              const v = shipment[key];
              const done = v && v.trim() && v.trim() !== 'Unknown';
              const label = shipmentFieldLabel(key);
              return (
                <div key={key} className={cx('ercie-check-item', done && 'ercie-check-done')}>
                  {done ? (
                    <span className="ercie-check-icon-done" />
                  ) : (
                    <span className="ercie-check-pending" />
                  )}
                  <span>{label}*</span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="ercie-toggle-btn ercie-toggle-btn-side"
            onClick={() => setShowErcie(true)}
          >
            <Bot size={16} /> Ask Ercie for help
          </button>
        </aside>
      </div>

      {/* ── Ercie side panel (drawer) ────────────────────────────────────────── */}
      {showErcie && (
        <ErcieHelpDrawer onClose={() => setShowErcie(false)} />
      )}
    </AppShell>
  );
}

function shipmentFieldLabel(key: keyof Shipment): string {
  const labels: Record<keyof Shipment, string> = {
    productName: 'Product name / description',
    hsCode: 'HS Code',
    exportingCountry: 'Export country',
    destinationCountry: 'Destination country',
    countryOfOrigin: 'Country of origin',
    buyerImporter: 'Buyer / Importer',
    productCategory: 'Product category',
    productCharacteristics: 'Key product characteristics',
    plannedImportDate: 'Planned import date',
    endUse: 'End use',
    supplyChainInformation: 'Supply-chain information',
    certificates: 'Known certificates / documents',
  };
  return labels[key] || key;
}

// ─── Ercie Help Drawer ────────────────────────────────────────────────────────

function ErcieHelpDrawer({ onClose }: { onClose: () => void }) {
  const [selectedField, setSelectedField] = useState<string>('productName');
  const helpText = FIELD_HELP[selectedField] || '';
  return (
    <>
      <div className="ercie-drawer-backdrop" onClick={onClose} />
      <aside className="ercie-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ercie-drawer-header">
          <div className="ercie-avatar"><Bot size={22} /></div>
          <div>
            <strong>Ercie</strong>
            <small>Your export risk assistant</small>
          </div>
          <button className="ercie-drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ercie-drawer-ai-notice">
          <Info size={14} />
          <span>Ercie&apos;s AI conversation feature is not yet connected. Below is guidance for each field.</span>
        </div>

        <div className="ercie-drawer-body">
          <p className="ercie-drawer-intro">
            Select a field to see guidance from Ercie.
          </p>
          <div className="ercie-drawer-field-list">
            {Object.keys(FIELD_HELP).map((key) => (
              <button
                key={key}
                className={cx('ercie-drawer-field-btn', selectedField === key && 'ercie-drawer-field-active')}
                onClick={() => setSelectedField(key)}
              >
                {shipmentFieldLabel(key as keyof Shipment)}
              </button>
            ))}
          </div>
          <div className="ercie-drawer-help-text">
            <Bot size={16} />
            <p>{helpText}</p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── HS Code Lookup Modal ─────────────────────────────────────────────────────

function HsCodeLookupModal({
  sources, exportCountry, onClose,
}: {
  sources: HsCodeSource[];
  exportCountry: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ercie-hs-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="ercie-hs-header">
          <Search size={20} />
          <h2>Official HS Code Lookup</h2>
        </div>
        <p className="ercie-hs-country">Export country: <strong>{exportCountry}</strong></p>
        {sources.length > 0 ? (
          <div className="ercie-hs-sources">
            {sources.map((src) => (
              <a
                key={src.url}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ercie-hs-source-link"
              >
                <div>
                  <strong>{src.label}</strong>
                  {src.note && <small>{src.note}</small>}
                </div>
                <ArrowRight size={16} />
              </a>
            ))}
            <p className="ercie-hs-help">
              Links open in a new tab. Your form data is preserved when you return.
            </p>
          </div>
        ) : (
          <div className="ercie-hs-no-source">
            <AlertTriangle size={24} />
            <strong>No verified HS Code lookup source for this country yet.</strong>
            <p>Please check with the customs authority or your customs broker for the correct HS Code.</p>
          </div>
        )}
        <button className="primary-button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
