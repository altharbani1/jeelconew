import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceDraftKey, readInvoiceDraft, writeInvoiceDraft } from '../lib/invoiceDrafts.mjs';
import { belongsToCustomer } from '../lib/customerMatching.mjs';

test('invoice drafts survive reopening and remain isolated by company and user', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) };
  const key = invoiceDraftKey('company-a','user-a');
  const draft = {number:'INV-1',customerId:'customer-a',items:[{quantity:2,unitPrice:5,total:10}]};
  assert.equal(writeInvoiceDraft(storage,key,draft),true);
  assert.deepEqual(readInvoiceDraft(storage,key),draft);
  assert.equal(readInvoiceDraft(storage,invoiceDraftKey('company-b','user-a')),null);
  assert.equal(readInvoiceDraft(storage,invoiceDraftKey('company-a','user-b')),null);
  assert.equal(invoiceDraftKey(null,'user-a'),null);
  values.set(key,'broken JSON');
  assert.equal(readInvoiceDraft(storage,key),null);
  assert.equal(writeInvoiceDraft({setItem(){throw Error('quota');}},key,draft),false);
});

test('customer links survive renames and ambiguous legacy names never duplicate debt', () => {
  const a = {id:'a',fullName:'Same name'}, b = {id:'b',fullName:'Same name'};
  const invoice = {customerId:'a',customerName:'Old name'};
  assert.equal(belongsToCustomer(invoice,a,[a,b],'customerName'),true);
  assert.equal(belongsToCustomer(invoice,b,[a,b],'customerName'),false);
  assert.equal(belongsToCustomer({customerName:'Same name'},a,[a,b],'customerName'),false);
  assert.equal(belongsToCustomer({customerName:'Same name'},a,[a],'customerName'),true);
});
