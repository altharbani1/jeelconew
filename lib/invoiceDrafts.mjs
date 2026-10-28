export const invoiceDraftKey = (companyId, userId) =>
  companyId && userId ? `jilco_invoice_draft::${companyId}::${userId}` : null;

export const readInvoiceDraft = (storage, key) => {
  if (!key) return null;
  try {
    const draft = JSON.parse(storage.getItem(key) || 'null');
    return draft && typeof draft.number === 'string' && Array.isArray(draft.items) ? draft : null;
  } catch {
    return null;
  }
};

export const writeInvoiceDraft = (storage, key, draft) => {
  if (!key) return false;
  try {
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
};
