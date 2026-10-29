import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateContractPayments, validateContract, importQuoteIntoContract, contractDraftKey, readContractDraft, writeContractDraft } from '../lib/contractCalculations.mjs';

const terms = [{name:'First',percentage:40},{name:'Second',percentage:30},{name:'Third',percentage:20},{name:'Final',percentage:10}];
const base = {number:'FA-2026-001',date:'2026-10-28',firstPartyName:'Company',secondPartyName:'Customer A',secondPartyId:'a',location:'Riyadh',totalValue:100,elevatorCount:1,stops:2,durationMonths:2,internalDoorsCount:1,externalDoorsCount:2,paymentTerms:terms};

test('contract import follows quote tax, clears the old customer link, and excludes accessory counts', () => {
  const quote = {details:{customerName:'Customer B',taxRate:0},items:[{quantity:1,unitPrice:100,total:100},{quantity:5,unitPrice:2,total:10}]};
  const result = importQuoteIntoContract(base,quote,[{id:'a',fullName:'Customer A'},{id:'b',fullName:'Customer B'}]);
  assert.equal(result.contract.totalValue,110);
  assert.equal(result.contract.secondPartyId,'b');
  assert.equal(result.contract.elevatorCount,1);
  assert.equal(importQuoteIntoContract(base,{...quote,details:{...quote.details,taxRate:20}},[]).contract.totalValue,132);
  const ambiguous = importQuoteIntoContract(base,quote,[{id:'b',fullName:'Customer B'},{id:'b2',fullName:'Customer B'}]);
  assert.equal(ambiguous.contract.secondPartyId,'');
  assert.equal(ambiguous.customerNeedsSelection,true);
});

test('wrapped and legacy-flat quote imports retain actual totals and explicit customer identity', () => {
  const result = importQuoteIntoContract(base,{data:{customerName:'Old name',customerId:'b',taxRate:5,items:[{total:100}]}},[{id:'b',fullName:'Renamed customer'}]);
  assert.equal(result.contract.totalValue,105);
  assert.equal(result.contract.secondPartyName,'Renamed customer');
  assert.equal(result.contract.secondPartyId,'b');
  assert.throws(() => importQuoteIntoContract(base,{items:[{quantity:-1,unitPrice:2,total:2}]},[]));
});

test('contract payments always reconcile to the total at halala precision', () => {
  for (const value of [0.01,0.03,0.50,100.01,9999.99]) {
    const allocated = allocateContractPayments(value,terms);
    assert.equal(allocated.reduce((sum,row)=>sum+Math.round(row.amount*100),0),Math.round(value*100));
    assert.ok(allocated.every(row=>row.amount>=0));
  }
  const many = Array.from({length:100},(_,index)=>({name:String(index),percentage:1}));
  assert.equal(allocateContractPayments(0.50,many).reduce((sum,row)=>sum+Math.round(row.amount*100),0),50);
  assert.deepEqual(allocateContractPayments(100,[{name:'Invalid',percentage:120}]),[]);
});

test('contract validation rejects incomplete terms, invalid dates, values and counts', () => {
  assert.equal(validateContract(base),null);
  for (const changed of [{totalValue:-1},{totalValue:0.001},{totalValue:Infinity},{date:'2026-02-30'},{elevatorCount:1.5},{stops:0},{durationMonths:-2},{paymentTerms:[null]},{paymentTerms:[{name:'First',percentage:60}]},{paymentTerms:[{name:'First',percentage:-20},{name:'Second',percentage:120}]}]) {
    assert.ok(validateContract({...base,...changed}));
  }
});

test('contract drafts survive navigation and are isolated by company and user', () => {
  const values = new Map();
  const storage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const key = contractDraftKey('company-a','user-a');
  const draft = {id:'stable-id',data:base,specs:{capacity:'630kg'}};
  assert.equal(writeContractDraft(storage,key,draft),true);
  assert.deepEqual(readContractDraft(storage,key),draft);
  assert.equal(readContractDraft(storage,contractDraftKey('company-b','user-a')),null);
  assert.equal(readContractDraft(storage,contractDraftKey('company-a','user-b')),null);
  values.set(key,'bad JSON');
  assert.equal(readContractDraft(storage,key),null);
  assert.equal(contractDraftKey(null,'user-a'),null);
});
