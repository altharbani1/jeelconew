import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual TypeScript service with a controlled Supabase transport.
// A successful legacy upsert intentionally remains available: the regression
// would incorrectly report success if a failed contract RPC fell back to it.
const source = ts.transpileModule(
  readFileSync(new URL('../services/cloudService.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function createService({ rpcResult = () => ({ data: true, error: null }), legacyRows = [], legacyError = null } = {}) {
  const calls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ method: 'rpc', name, args });
      return rpcResult(name, args);
    },
    from(table) {
      calls.push({ method: 'from', table });
      const query = {
        select(columns) { calls.push({ method: 'select', table, columns }); return query; },
        eq(column, value) { calls.push({ method: 'eq', table, column, value }); return query; },
        single: async () => ({ data: { company_id: 'company-a' }, error: null }),
        upsert: async () => { calls.push({ method: 'upsert', table }); return { data: null, error: null }; },
        then(resolve, reject) { return Promise.resolve({ data: legacyRows, error: legacyError }).then(resolve, reject); },
      };
      return query;
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: name => {
      if (name === './supabaseClient') return { supabase };
      if (name === 'lz-string') return { default: {} };
      throw new Error(`Unexpected module: ${name}`);
    },
    console: { error() {}, log() {}, warn() {} },
  });
  return { service: exports.cloudService, calls };
}

const contract = (id = 'contract-id', number = 'FA-2026-001') => ({
  id,
  data: {
    number, date: '2026-10-29', firstPartyName: 'Company', secondPartyName: 'Customer',
    totalValue: 1000, paymentTerms: [{ name: 'Full payment', percentage: 100 }],
  },
  specs: { capacity: '630 kg' },
});

test('contract save failure never succeeds through the legacy store', async () => {
  for (const failure of [
    () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
    () => { throw new Error('network failed'); },
    () => ({ data: false, error: null }),
  ]) {
    const { service, calls } = createService({ rpcResult: failure });
    assert.equal(await service.saveRecord('jilco_contracts_archive', 'contract-id', contract()), false);
    assert.deepEqual(calls.map(call => call.method), ['rpc']);
    assert.equal(calls[0].name, 'save_contract_record');
  }
});

test('contract save uses the atomic RPC and a stable identity independent of the number', async () => {
  const { service, calls } = createService();
  assert.equal(await service.saveRecord('jilco_contracts_archive', 'contract-id', contract()), true);
  assert.deepEqual(calls.map(call => call.method), ['rpc']);
  assert.equal(calls[0].name, 'save_contract_record');
  assert.equal(calls[0].args.p_contract.legacy_id, 'contract-id');
  assert.equal(calls[0].args.p_contract.number, 'FA-2026-001');
  assert.equal(calls[0].args.p_contract.technical_specs.capacity, '630 kg');
  assert.equal(calls[0].args.p_contract.payment_terms[0].percentage, 100);

  const flat = { ...contract().data, specs: {} };
  assert.equal(await service.saveRecord('jilco_contracts_archive', 'stable-fallback-id', flat), true);
  assert.equal(calls[1].args.p_contract.legacy_id, 'stable-fallback-id');
});

test('contract delete requires the RPC to confirm a matched deletion', async () => {
  for (const [result, expected] of [
    [{ data: true, error: null }, true],
    [{ data: false, error: null }, false],
    [{ data: null, error: { message: 'denied' } }, false],
  ]) {
    const { service, calls } = createService({ rpcResult: () => result });
    assert.equal(await service.deleteRecord('jilco_contracts_archive', 'stable-id'), expected);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'delete_contract_record');
    assert.equal(calls[0].args.p_legacy_id, 'stable-id');
  }
});

test('contract migration is tenant scoped and counts only confirmed saves', async () => {
  const { service, calls } = createService({
    legacyRows: [
      { record_id: 'old-key-a', data: contract('id-a', 'FA-2026-001') },
      { record_id: 'old-key-b', data: contract('id-b', 'FA-2026-002') },
      { record_id: 'missing-number', data: { id: 'id-c', data: {} } },
    ],
    rpcResult: (name, args) => ({ data: name !== 'save_contract_record' || args.p_contract.legacy_id === 'id-a', error: null }),
  });
  const result = await service.migrateLegacyContracts();
  assert.equal(result.migrated, 1);
  assert.equal(result.failed, 2);
  assert.ok(calls.some(call => call.method === 'eq' && call.table === 'jilco_realtime_data'
    && call.column === 'company_id' && call.value === 'company-a'));
  assert.deepEqual(calls.filter(call => call.method === 'rpc').map(call => call.name), [
    'reserve_existing_contract_number', 'save_contract_record',
    'reserve_existing_contract_number', 'save_contract_record',
  ]);
  assert.equal(calls.some(call => call.method === 'upsert'), false);
});

test('failed contract migration read reports failure instead of an empty success', async () => {
  const { service, calls } = createService({ legacyError: { message: 'read denied' } });
  const result = await service.migrateLegacyContracts();
  assert.equal(result.migrated, 0);
  assert.equal(result.failed, 1);
  assert.equal(calls.some(call => call.method === 'rpc'), false);
});
