/**
 * Regression tests for fixed DAXIN bugs
 */
const fs = require('fs');
const path = require('path');
const htmlPath = path.join(process.env.USERPROFILE, 'Desktop', 'cursor', 'DAXIN', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const s = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const els = {};
function makeEl(id) {
  if (!els[id]) {
    const el = {
      id, value: '', textContent: '', innerHTML: '',
      style: { display: '' }, className: '',
      disabled: false, scrollIntoView() {},
      addEventListener() {}, removeEventListener() {},
    };
    el.classList = {
      add(c) { if (!el.className.includes(c)) el.className = (el.className + ' ' + c).trim(); },
      remove(c) { el.className = el.className.replace(new RegExp('\\b' + c + '\\b', 'g'), '').trim(); },
      toggle(c, on) {
        if (on === true) el.classList.add(c);
        else if (on === false) el.classList.remove(c);
        else if (el.className.includes(c)) el.classList.remove(c);
        else el.classList.add(c);
      },
    };
    els[id] = el;
  }
  return els[id];
}
global.document = {
  getElementById: (id) => makeEl(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => makeEl('x'),
  body: { appendChild() {} },
  activeElement: null,
};
global.window = global;
global.window.scrollTo = () => {};
global.alert = (m) => { global.__alerts = (global.__alerts || []).concat([m]); };
global.confirm = () => true;
['allocRatio','allocRatioVal','s-total','s-applied','s-won','s-await','clearLedger','pnlCard','p-count','p-gross','p-net','ledgerList','calcList','calcSummaryCard','calcSummary','allocResult','conflictResult','prefList','ipoList','brokerList','sum-acct','acctBreakdown','aiEntryCard','aiAllocCard','aiEndpoint','aiStatus','totalCashAll','allocBudget','budgetNote','acctLimitList','pnlModePro','pnlModeFull','strat-b','strat-spread','stratDesc'].forEach(makeEl);
makeEl('allocRatio').value = '100';

let code = s
  .replace(/\bconst \$ =/g, 'global.$ =')
  .replace(/\bconst esc =/g, 'global.esc =')
  .replace(/\bconst fmt =/g, 'global.fmt =')
  .replace(/\bconst hk =/g, 'global.hk =')
  .replace(/\bconst LS_LEDGER=/g, 'global.LS_LEDGER=')
  .replace(/\bconst LS_BROKERS=/g, 'global.LS_BROKERS=')
  .replace(/\bconst LS_IPOS=/g, 'global.LS_IPOS=')
  .replace(/\bconst LS_PLAN=/g, 'global.LS_PLAN=')
  .replace(/\bconst LS_LAST_COMMIT=/g, 'global.LS_LAST_COMMIT=')
  .replace(/\bconst LS_PNL_MODE=/g, 'global.LS_PNL_MODE=')
  .replace(/\bconst LS_AI=/g, 'global.LS_AI=')
  .replace(/\bconst HK_HOLIDAYS=/g, 'global.HK_HOLIDAYS=')
  .replace(/\bconst PALETTE=/g, 'global.PALETTE=')
  .replace(/\bconst STRAT_DESC=/g, 'global.STRAT_DESC=')
  .replace(/\bconst DEFAULT_AI_ENDPOINT=/g, 'global.DEFAULT_AI_ENDPOINT=')
  .replace(/\bconst _mem =/g, 'global._mem =')
  .replace(/\bconst num =/g, 'global.num =');

eval(code);

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.log('FAIL', msg); failed++; }
  else console.log('PASS', msg);
}

function reset() {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.keys(els).forEach((k) => delete els[k]);
  ['allocRatio','allocRatioVal','s-total','s-applied','s-won','s-await','clearLedger','pnlCard','p-count','p-gross','p-net','ledgerList','calcList','calcSummaryCard','calcSummary','allocResult','conflictResult','prefList','ipoList','brokerList','sum-acct','acctBreakdown','aiEntryCard','aiAllocCard','aiEndpoint','aiStatus','totalCashAll','allocBudget','budgetNote','acctLimitList','pnlModePro','pnlModeFull','strat-b','strat-spread','stratDesc'].forEach(makeEl);
  makeEl('allocRatio').value = '100';
  window._currentPlan = null;
  window.allocStrategy = 'groupB';
  global.__alerts = [];
}
function seedBrokers(list) {
  lsSet(LS_BROKERS, list.map((b, i) => ({
    id: i + 1, name: b.name, cashOffset: b.cashOffset ?? 0, cashTime: b.cashTime || '12:00',
    marginOffset: b.marginOffset ?? 0, marginTime: b.marginTime || '10:00',
    rate: b.rate ?? 5, fee: b.fee ?? 100,
    accounts: (b.accounts || []).map((a, j) => ({
      id: (i + 1) * 1000 + j + 1, holder: a.holder, name: a.name || '', amount: a.amount,
    })),
  })));
}
function addIpoObj(p) {
  const ipo = Object.assign(blankIpo(), p);
  const a = getIpos().filter((x) => x.name || x.priceHigh);
  a.push(ipo); saveIpos(a); return ipo;
}

console.log('=== REGRESSION ===');

// 1) adjustLots cannot exceed budget
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', amount: 500000 }] }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: '超预算', priceHigh: '50', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true,
  });
  makeEl('allocRatio').value = '30';
  runAllocation();
  const p = _currentPlan.plan[0];
  const al = p.allocations[0];
  const budget = _currentPlan.budget;
  adjustLots(p.ipoId, al.accId, 9999);
  const used = al.lots * al.occupyPerLot;
  assert(used <= budget + 0.01, `手调不超预算 used=${used} budget=${budget}`);
}

// 2) adjustLots respects other IPO occupy
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', amount: 100000 }] }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: 'A', priceHigh: '10', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true, priority: 1,
  });
  addIpoObj({
    name: 'B', priceHigh: '10', lotSize: '100',
    listing: '2026-07-14', applyDate: '2026-07-07', fund: 'cash', wanted: true, priority: 2,
  });
  runAllocation();
  const p0 = _currentPlan.plan[0];
  const al0 = p0.allocations[0];
  adjustLots(p0.ipoId, al0.accId, 9999);
  const total = _currentPlan.plan.reduce((s, p) => s + p.allocations.reduce((ss, a) => ss + a.lots * a.occupyPerLot, 0), 0);
  assert(total <= 100000 + 0.01, `多票合计不超账户现金 total=${total}`);
}

// 3) commitBatch idempotent
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', amount: 100000 }] }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: '台账', priceHigh: '10', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true,
  });
  runAllocation();
  commitBatch();
  commitBatch();
  commitBatch();
  assert(getLedger().length === 1, `台账幂等 len=${getLedger().length}`);
  assert((__alerts || []).some((a) => String(a).includes('已经加入')), '重复提交有提示');
}

// 4) PnL pro-rata default
{
  reset();
  seedBrokers([{ name: '富途', rate: 5, fee: 100, accounts: [{ holder: '本人', amount: 800000 }] }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: '息差', priceHigh: '50', priceLow: '50', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'margin', lev: 90, wanted: true,
  });
  window.allocStrategy = 'groupB';
  runAllocation();
  commitBatch();
  const row = getLedger()[0];
  row.resultOut = true;
  row.wonShares = 100;
  row.finalPrice = 50;
  row.sellPrice = 55;
  const pnl = ledgerPnL(row);
  assert(pnl.mode === 'pro_rata', '默认按中签摊息');
  assert(pnl.net > 0, `摊息后净利应为正 net=${pnl.net} interest=${pnl.interest}`);
  setPnlMode('full');
  const pnl2 = ledgerPnL(row);
  assert(pnl2.mode === 'full' && pnl2.net < pnl.net, '全额息模式净利更低');
}

// 5) small position one account
{
  reset();
  seedBrokers([{
    name: '富途',
    accounts: [
      { holder: '本人', amount: 50000 },
      { holder: '配偶', amount: 50000 },
    ],
  }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: '小仓', priceHigh: '50', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true, position: 'small',
  });
  runAllocation();
  assert(_currentPlan.plan[0].allocations.length === 1, `小仓仅1户 got=${_currentPlan.plan[0].allocations.length}`);
}

// 6) plan persists
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', amount: 100000 }] }]);
  lsSet(LS_IPOS, []);
  addIpoObj({
    name: '持久', priceHigh: '20', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true,
  });
  runAllocation();
  const saved = lsGetObj(LS_PLAN, null);
  assert(saved && saved.plan && saved.plan.length === 1, '方案已写入 LS_PLAN');
  window._currentPlan = null;
  const restored = lsGetObj(LS_PLAN, null);
  _currentPlan = restored;
  syncPlanToIpos();
  assert(getIpos()[0]._allocations && getIpos()[0]._allocations.length > 0, '恢复后 _allocations 存在');
}

// 7) cutoff hint used
{
  reset();
  seedBrokers([{ name: '富途', cashOffset: -1, cashTime: '16:00', accounts: [{ holder: '本人', amount: 100000 }] }]);
  const hint = brokerCutoffHint('富途', false);
  assert(hint.includes('前1个工作日') && hint.includes('16:00'), `截止提示 ${hint}`);
}

// 8) account nick
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', name: '主户', amount: 100000 }] }]);
  const a = allAccounts()[0];
  assert(acctLabel(a) === '富途 / 主户', `昵称展示 ${acctLabel(a)}`);
}

// 9) conflict inclusive same day
{
  reset();
  seedBrokers([{ name: '富途', accounts: [{ holder: '本人', amount: 50000 }] }]);
  lsSet(LS_IPOS, []);
  // Force two overlapping with release day = apply day of other via manual plan
  addIpoObj({
    name: 'C1', priceHigh: '50', lotSize: '100',
    listing: '2026-07-13', applyDate: '2026-07-06', fund: 'cash', wanted: true,
  });
  runAllocation();
  // result day of 7/13 listing = 7/9
  const ipo = getIpos()[0];
  const der = deriveDates(ipo.listing);
  assert(toISO(der.resultDay) === '2026-07-09', 'result day');
  // manually set allocation cost high and check load includes release day
  ipo._allocations = [{
    broker: '富途', name: '本人', holder: '本人', lots: 10, cost: 50000,
    subscribe: 50000, isMargin: false,
  }];
  saveIpos(getIpos());
  // inject second ipo applying on result day
  addIpoObj({
    name: 'C2', priceHigh: '50', lotSize: '100',
    listing: '2026-07-16', applyDate: '2026-07-09', fund: 'cash', wanted: true,
  });
  // need plan for both - set manually
  const all = getIpos();
  all[1]._allocations = [{
    broker: '富途', name: '本人', holder: '本人', lots: 1, cost: 5000,
    subscribe: 5000, isMargin: false,
  }];
  saveIpos(all);
  checkConflict();
  const htmlOut = makeEl('conflictResult').innerHTML;
  assert(htmlOut.includes('超额') || htmlOut.includes('⚠️'), '同日释放+申购应检出冲突(或接近超额)');
}

// 10) pref empty copy
{
  reset();
  renderPrefList();
  assert(makeEl('prefList').innerHTML.includes('录入'), '空态指向录入页');
}

console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
