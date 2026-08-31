import { InvoiceData } from '../types';

export const getSalesInvoiceTotal = (invoice: Partial<InvoiceData>): number => {
  if (Number.isFinite(Number(invoice.grandTotal)) && Number(invoice.grandTotal) > 0) return Number(invoice.grandTotal);
  const subtotal = (invoice.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const afterDiscount = Math.max(0, subtotal - (Number(invoice.discountAmount) || 0));
  return invoice.isTaxInclusive === false ? afterDiscount * 1.15 : afterDiscount;
};

export const getInvoicePaymentStatus = (paid: number, total: number): InvoiceData['status'] => {
  if (paid >= total - 0.01) return 'paid';
  return paid > 0 ? 'partial' : 'pending';
};
