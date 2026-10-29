const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const paymentTermsValid = terms => Array.isArray(terms) && terms.length > 0
  && terms.every(term => term && typeof term.name === 'string' && term.name.trim()
    && Number.isFinite(Number(term.percentage)) && Number(term.percentage) > 0 && Number(term.percentage) <= 100)
  && Math.abs(terms.reduce((sum, term) => sum + Number(term.percentage), 0) - 100) <= 0.000001;

export const allocateContractPayments = (total, terms) => {
  if (!Number.isFinite(Number(total)) || money(total) <= 0 || !Number.isSafeInteger(Math.round(Number(total) * 100)) || !paymentTermsValid(terms)) return [];
  const halalas = Math.round(money(total) * 100);
  const rows = terms.map((term, index) => {
    const exact = halalas * Number(term.percentage) / 100;
    return { term, index, units: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const remaining = halalas - rows.reduce((sum, row) => sum + row.units, 0);
  const ranked = [...rows].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remaining; i += 1) ranked[i % ranked.length].units += 1;
  return rows.map(row => ({ ...row.term, percentage: Number(row.term.percentage), amount: row.units / 100 }));
};

export const validateContract = contract => {
  if (!contract.firstPartyName?.trim() || !contract.secondPartyName?.trim()) return 'يرجى إدخال اسمي طرفي العقد.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.date || '')
    || Number.isNaN(Date.parse(contract.date))
    || new Date(contract.date).toISOString().slice(0, 10) !== contract.date) return 'يرجى إدخال تاريخ عقد صحيح.';
  if (!Number.isFinite(Number(contract.totalValue)) || money(contract.totalValue) <= 0 || !Number.isSafeInteger(Math.round(Number(contract.totalValue) * 100))) return 'يجب أن تكون قيمة العقد أكبر من صفر وضمن حدود الحساب المالي الدقيقة.';
  const counts = [contract.elevatorCount, contract.stops, contract.durationMonths, contract.internalDoorsCount ?? 1, contract.externalDoorsCount ?? 1];
  if (counts.some(value => !Number.isSafeInteger(Number(value)) || Number(value) <= 0)) return 'عدد المصاعد والوقفات والأبواب ومدة التنفيذ يجب أن تكون أعداداً صحيحة أكبر من صفر.';
  if (!paymentTermsValid(contract.paymentTerms)) return 'يجب أن تكون نسب الدفعات موجبة وأن يساوي مجموعها 100%، مع تسمية كل دفعة.';
  return null;
};

export const importQuoteIntoContract = (current, quote, customers) => {
  const source = quote?.data && !quote.details ? { ...quote, ...quote.data } : (quote || {});
  const details = source.details || source;
  const items = Array.isArray(source.items) ? source.items : [];
  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unitPrice);
    const hasQuantityAndPrice = item.quantity != null && item.unitPrice != null;
    if (hasQuantityAndPrice && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error('يتضمن عرض السعر كميات أو أسعاراً غير صالحة.');
    const line = hasQuantityAndPrice ? quantity * unitPrice : Number(item.total);
    if (!Number.isFinite(line) || line < 0) throw new Error('يتضمن عرض السعر مبالغ غير صالحة. راجع بنوده أولاً.');
    return sum + money(line);
  }, 0);
  const taxRate = Number(details.taxRate ?? 15);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('نسبة ضريبة عرض السعر غير صالحة.');
  const customerName = details.customerName || source.customerName || '';
  const explicitId = details.customerId || source.customerId;
  const candidates = explicitId
    ? customers.filter(customer => customer.id === explicitId)
    : customers.filter(customer => customer.fullName === customerName);
  const customer = candidates.length === 1 ? candidates[0] : null;
  const specs = source.techSpecs && typeof source.techSpecs === 'object' ? source.techSpecs : {};
  return {
    contract: {
      ...current,
      secondPartyName: customer?.fullName || customerName,
      secondPartyId: customer?.id || '',
      location: details.projectName || source.projectName || '',
      totalValue: money(money(subtotal) + money(money(subtotal) * taxRate / 100)),
      // Generic quotation lines also contain accessories: their quantities do not count elevators.
      elevatorCount: current.elevatorCount || 1,
      elevatorType: specs.elevatorType || current.elevatorType,
      paymentTerms: Array.isArray(details.paymentTerms) && details.paymentTerms.length
        ? details.paymentTerms.map(term => ({ ...term })) : current.paymentTerms,
      firstPartyObligations: details.firstPartyObligations || current.firstPartyObligations,
      secondPartyObligations: details.secondPartyObligations || current.secondPartyObligations,
      handoverAndWarranty: details.handoverAndWarranty || current.handoverAndWarranty,
      worksDuration: details.worksDuration || current.worksDuration
    },
    specs,
    customerNeedsSelection: !customer
  };
};

export const contractDraftKey = (companyId, userId) =>
  companyId && userId ? `jilco_contract_draft::${companyId}::${userId}` : null;

export const readContractDraft = (storage, key) => {
  if (!key) return null;
  try {
    const draft = JSON.parse(storage.getItem(key) || 'null');
    return draft && typeof draft.id === 'string' && typeof draft.data?.number === 'string'
      && Array.isArray(draft.data.paymentTerms) && draft.specs && typeof draft.specs === 'object' ? draft : null;
  } catch { return null; }
};

export const writeContractDraft = (storage, key, draft) => {
  if (!key) return false;
  try { storage.setItem(key, JSON.stringify(draft)); return true; }
  catch { return false; }
};
