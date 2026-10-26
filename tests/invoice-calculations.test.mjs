import assert from 'node:assert/strict';
import test from 'node:test';
import { amountInArabicWords, calculateInvoiceAmounts, formatInvoiceMoney } from '../lib/invoiceCalculations.mjs';

test('invoice amounts round to halalas and show the discount in the taxable base', () => {
  assert.deepEqual(calculateInvoiceAmounts([{ total: 100.005 }, { total: 50 }], 10, true), {
    subtotal: 150.01,
    discount: 10,
    taxableAmount: 140.01,
    baseAmount: 121.75,
    taxAmount: 18.26,
    grandTotal: 140.01,
  });
  assert.equal(formatInvoiceMoney(150), '150.00');
});

test('exclusive VAT is rounded consistently and discount is capped at subtotal', () => {
  assert.deepEqual(calculateInvoiceAmounts([{ total: 10 }], 25, false), {
    subtotal: 10,
    discount: 10,
    taxableAmount: 0,
    baseAmount: 0,
    taxAmount: 0,
    grandTotal: 0,
  });
  assert.equal(calculateInvoiceAmounts([{ total: 10 }], 0, false).grandTotal, 11.5);
});

test('amount in words includes riyals and halalas for small, large and fractional totals', () => {
  assert.equal(amountInArabicWords(0), 'صفر ريال فقط لا غير');
  assert.equal(amountInArabicWords(1), 'ريال واحد فقط لا غير');
  assert.equal(amountInArabicWords(2), 'ريالان فقط لا غير');
  assert.equal(amountInArabicWords(1234.5), 'ألف و مئتان و أربعة و ثلاثون ريالاً و خمسون هللة فقط لا غير');
  assert.equal(amountInArabicWords(1000000), 'مليون ريال فقط لا غير');
});
