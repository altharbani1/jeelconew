export function formatInvoiceMoney(value: number): string;
export function calculateInvoiceAmounts(items: Array<{ total?: number }>, discountAmount?: number, isTaxInclusive?: boolean): {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  baseAmount: number;
  taxAmount: number;
  grandTotal: number;
};
export function amountInArabicWords(amount: number): string;
