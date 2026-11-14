import React, { useRef, useState } from 'react';
import { Building, MapPin, CreditCard, Check, ChevronRight, ChevronLeft, Upload, X, Sparkles } from 'lucide-react';

export default function NewBusinessWizardModal({
  shopProfile,
  branches,
  taxSettings,
  paymentMethods,
  categories,
  apiFetch,
  compressLogoImage,
  onCompleted,
  onClose,
}) {
  const defaultBranch = (branches || []).find(b => b.isDefault) || (branches || [])[0] || null;
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [identity, setIdentity] = useState({
    name: shopProfile?.name || '',
    tagline: shopProfile?.tagline || '',
    currency: shopProfile?.currency || 'KSh',
    phone: shopProfile?.phone || '',
    location: shopProfile?.location || '',
    logo: shopProfile?.logo || '',
  });

  const [branchInfo, setBranchInfo] = useState({
    id: defaultBranch?.id || '',
    name: defaultBranch?.name || 'Main Branch',
    address: defaultBranch?.address || shopProfile?.location || '',
    phone: defaultBranch?.phone || shopProfile?.phone || '',
  });

  const [taxInfo, setTaxInfo] = useState({
    salesTaxEnabled: !!taxSettings?.salesTaxEnabled,
    salesTaxRate: Number(taxSettings?.salesTaxRate ?? 16),
    salesTaxName: taxSettings?.salesTaxName || 'VAT',
    purchaseTaxEnabled: !!taxSettings?.purchaseTaxEnabled,
    purchaseTaxRate: Number(taxSettings?.purchaseTaxRate ?? 16),
    purchaseTaxName: taxSettings?.purchaseTaxName || 'VAT',
    taxInclusive: taxSettings?.taxInclusive !== false,
  });

  const [pmNames, setPmNames] = useState(() => {
    const existing = (paymentMethods || []).map(m => m.name).filter(Boolean);
    return existing.length > 0 ? existing : ['Cash', 'M-Pesa', 'Card / Bank'];
  });
  const [newPmName, setNewPmName] = useState('');

  const [starterCategories, setStarterCategories] = useState(() => {
    const existing = (categories || []).map(c => c.name).filter(Boolean);
    return existing.length > 0 ? existing : ['General Merchandise', 'Beverages', 'Electronics'];
  });
  const [newCatName, setNewCatName] = useState('');

  const addPm = () => {
    const clean = newPmName.trim();
    if (!clean) return;
    if (!pmNames.some(p => p.toLowerCase() === clean.toLowerCase())) {
      setPmNames(prev => [...prev, clean]);
    }
    setNewPmName('');
  };

  const addCategory = () => {
    const clean = newCatName.trim();
    if (!clean) return;
    if (!starterCategories.some(c => c.toLowerCase() === clean.toLowerCase())) {
      setStarterCategories(prev => [...prev, clean]);
    }
    setNewCatName('');
  };

  const handleSkip = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/business-wizard-complete', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not dismiss setup wizard');
        return;
      }
      onClose?.();
    } catch (err) {
      setErrorMsg(err?.message || 'Network error');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    if (busyRef.current) return;
    if (!identity.name.trim()) {
      setStep(1);
      setErrorMsg('Business name is required.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setErrorMsg('');
    try {
      const nextProfile = {
        ...(shopProfile || {}),
        name: identity.name.trim(),
        tagline: identity.tagline.trim(),
        currency: (identity.currency || 'KSh').trim() || 'KSh',
        phone: identity.phone.trim(),
        location: identity.location.trim(),
        logo: identity.logo || '',
      };

      const profRes = await apiFetch('/api/shop-profile', {
        method: 'POST',
        body: JSON.stringify(nextProfile),
      });
      if (!profRes.ok) {
        const d = await profRes.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save business profile');
      }

      let updatedBranch = null;
      if (branchInfo.id && branchInfo.name.trim()) {
        const brRes = await apiFetch(`/api/branches/${branchInfo.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: branchInfo.name.trim(),
            address: branchInfo.address.trim(),
            phone: branchInfo.phone.trim(),
            isDefault: true,
          }),
        });
        if (brRes.ok) {
          updatedBranch = {
            ...(defaultBranch || {}),
            id: branchInfo.id,
            name: branchInfo.name.trim(),
            address: branchInfo.address.trim(),
            phone: branchInfo.phone.trim(),
            isDefault: true,
          };
        }
      } else if (!branchInfo.id && branchInfo.name.trim()) {
        const brRes = await apiFetch('/api/branches', {
          method: 'POST',
          body: JSON.stringify({
            name: branchInfo.name.trim(),
            address: branchInfo.address.trim(),
            phone: branchInfo.phone.trim(),
            isDefault: true,
          }),
        });
        if (brRes.ok) {
          const brData = await brRes.json().catch(() => ({}));
          if (brData?.branch) updatedBranch = brData.branch;
        }
      }

      const taxPayload = {
        ...(taxSettings || {}),
        salesTaxEnabled: !!taxInfo.salesTaxEnabled,
        salesTaxRate: Number(taxInfo.salesTaxRate) || 0,
        salesTaxName: taxInfo.salesTaxName.trim() || 'VAT',
        purchaseTaxEnabled: !!taxInfo.purchaseTaxEnabled,
        purchaseTaxRate: Number(taxInfo.purchaseTaxRate) || 0,
        purchaseTaxName: taxInfo.purchaseTaxName.trim() || 'VAT',
        taxInclusive: !!taxInfo.taxInclusive,
      };
      await apiFetch('/api/tax-settings', {
        method: 'PUT',
        body: JSON.stringify(taxPayload),
      });

      const existingPmMap = new Map((paymentMethods || []).map(p => [String(p.name || '').toLowerCase(), p]));
      const nextPms = pmNames.map((name, idx) => {
        const prev = existingPmMap.get(name.toLowerCase());
        return prev || {
          id: `pm-wiz-${Date.now()}-${idx}`,
          name,
          startingBalance: 0,
          currentBalance: 0,
        };
      });
      if (nextPms.length > 0) {
        await apiFetch('/api/tenant-settings', {
          method: 'PUT',
          body: JSON.stringify({ paymentMethods: nextPms, wizardCompleted: 1 }),
        });
      }

      const existingCatSet = new Set((categories || []).map(c => String(c.name || '').toLowerCase()));
      const createdCats = [];
      for (const catName of starterCategories) {
        if (!existingCatSet.has(catName.toLowerCase())) {
          const cRes = await apiFetch('/api/categories', {
            method: 'POST',
            body: JSON.stringify({ name: catName }),
          });
          if (cRes.ok) {
            const cData = await cRes.json().catch(() => ({}));
            if (cData?.id) createdCats.push({ id: cData.id, name: catName });
          }
        }
      }

      const doneRes = await apiFetch('/api/business-wizard-complete', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!doneRes.ok) {
        const d = await doneRes.json().catch(() => ({}));
        throw new Error(d.error || 'Could not finalize setup');
      }

      onCompleted?.({
        shopProfile: nextProfile,
        updatedBranch,
        taxSettings: taxPayload,
        paymentMethods: nextPms,
        createdCategories: createdCats,
      });
    } catch (err) {
      setErrorMsg(err?.message || 'Could not complete setup');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">New Business Setup Wizard</h3>
              <p className="text-[11px] text-slate-400">Step {step} of 3 — Configure your workspace before trading</p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleSkip}
            className="text-xs text-slate-400 hover:text-white disabled:opacity-50 px-2 py-1 rounded flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>{busy ? 'Closing…' : 'Skip for now'}</span>
          </button>
        </div>

        <div className="px-5 pt-4 flex items-center gap-2">
          {[
            { id: 1, label: 'Business Identity', icon: Building },
            { id: 2, label: 'Branch & Tax', icon: MapPin },
            { id: 3, label: 'Payments & Categories', icon: CreditCard },
          ].map(s => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => setStep(s.id)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-bold'
                    : done
                    ? 'bg-slate-800/70 border-slate-700 text-slate-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  done ? 'bg-emerald-500 text-slate-950' : active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {done ? <Check className="w-3 h-3" /> : s.id}
                </span>
                <Icon className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4 text-xs max-h-[65vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-xs">
              {errorMsg}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  {identity.logo ? (
                    <img src={identity.logo} alt="Logo" className="h-12 w-16 object-contain rounded border border-slate-700 bg-white/5 p-1" />
                  ) : (
                    <div className="h-12 w-16 rounded border border-dashed border-slate-700 flex items-center justify-center text-slate-500 bg-slate-900">
                      <Building className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-white">Business Logo (Optional)</p>
                    <p className="text-[10px] text-slate-400">Shown on POS receipts, invoices, and statements.</p>
                  </div>
                </div>
                <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{identity.logo ? 'Change Logo' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0];
                      if (!f || !compressLogoImage) return;
                      try {
                        const compressed = await compressLogoImage(f);
                        setIdentity(prev => ({ ...prev, logo: compressed }));
                      } catch (_) {
                        setErrorMsg('Could not process logo image.');
                      }
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Business Name *</label>
                  <input
                    type="text"
                    value={identity.name}
                    onChange={e => setIdentity({ ...identity, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="e.g. Acme Retail Ltd"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Currency Code / Symbol</label>
                  <input
                    type="text"
                    value={identity.currency}
                    onChange={e => setIdentity({ ...identity, currency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="KSh"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tagline / Receipt Subtitle</label>
                  <input
                    type="text"
                    value={identity.tagline}
                    onChange={e => setIdentity({ ...identity, tagline: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="Quality Goods & Service"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Business Phone</label>
                  <input
                    type="text"
                    value={identity.phone}
                    onChange={e => setIdentity({ ...identity, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="+254..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 block mb-1">Primary Address / Location</label>
                  <input
                    type="text"
                    value={identity.location}
                    onChange={e => setIdentity({ ...identity, location: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white"
                    placeholder="Street, Building, City"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <p className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider">Primary Branch / Location</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={branchInfo.name}
                      onChange={e => setBranchInfo({ ...branchInfo, name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Branch Phone</label>
                    <input
                      type="text"
                      value={branchInfo.phone}
                      onChange={e => setBranchInfo({ ...branchInfo, phone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Branch Address</label>
                    <input
                      type="text"
                      value={branchInfo.address}
                      onChange={e => setBranchInfo({ ...branchInfo, address: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <p className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Tax Configuration</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                    <span className="text-slate-200 font-semibold">Enable Sales Tax</span>
                    <input
                      type="checkbox"
                      checked={taxInfo.salesTaxEnabled}
                      onChange={e => setTaxInfo({ ...taxInfo, salesTaxEnabled: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer">
                    <span className="text-slate-200 font-semibold">Enable Purchase Tax</span>
                    <input
                      type="checkbox"
                      checked={taxInfo.purchaseTaxEnabled}
                      onChange={e => setTaxInfo({ ...taxInfo, purchaseTaxEnabled: e.target.checked })}
                      className="rounded border-slate-700 text-emerald-500"
                    />
                  </label>
                  <div>
                    <label className="text-slate-400 block mb-1">Tax Label (e.g. VAT)</label>
                    <input
                      type="text"
                      value={taxInfo.salesTaxName}
                      onChange={e => setTaxInfo({ ...taxInfo, salesTaxName: e.target.value, purchaseTaxName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={taxInfo.salesTaxRate}
                      onChange={e => {
                        const r = parseFloat(e.target.value) || 0;
                        setTaxInfo({ ...taxInfo, salesTaxRate: r, purchaseTaxRate: r });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxInfo.taxInclusive}
                    onChange={e => setTaxInfo({ ...taxInfo, taxInclusive: e.target.checked })}
                    className="rounded border-slate-700 text-emerald-500"
                  />
                  <span>Item prices include tax (tax-inclusive pricing)</span>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <p className="font-bold text-emerald-400 uppercase text-[10px] tracking-wider">Payment Channels</p>
                <div className="flex flex-wrap gap-1.5">
                  {pmNames.map(pm => (
                    <span key={pm} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px]">
                      {pm}
                      {pmNames.length > 1 && (
                        <button type="button" onClick={() => setPmNames(prev => prev.filter(x => x !== pm))} className="text-slate-500 hover:text-red-400">×</button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPmName}
                    onChange={e => setNewPmName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPm(); } }}
                    placeholder="Add payment channel (e.g. Bank Transfer)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                  <button type="button" onClick={addPm} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold rounded-lg border border-slate-700">
                    Add
                  </button>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <p className="font-bold text-sky-400 uppercase text-[10px] tracking-wider">Starter Product Categories</p>
                <div className="flex flex-wrap gap-1.5">
                  {starterCategories.map(cat => (
                    <span key={cat} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px]">
                      {cat}
                      <button type="button" onClick={() => setStarterCategories(prev => prev.filter(x => x !== cat))} className="text-slate-500 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                    placeholder="Add starter category"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                  />
                  <button type="button" onClick={addCategory} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold rounded-lg border border-slate-700">
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            disabled={busy || step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1))}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setErrorMsg('');
                  if (step === 1 && !identity.name.trim()) {
                    setErrorMsg('Please enter your business name.');
                    return;
                  }
                  setStep(s => Math.min(3, s + 1));
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleFinish}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{busy ? 'Saving setup…' : 'Finish Setup'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
