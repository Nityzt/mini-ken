import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunState } from './run-state.ts';
import { buy, LOOKS, SHOP_ITEMS, shopKi, STALLS, wear } from './shop.ts';

test('each regional shop carries its own wearable, cosmetic colors', () => {
  const stalls = ['beachShop', 'parkShop', 'steelShop', 'fallsShop'] as const;
  const sold = stalls.flatMap((stall) => STALLS[stall]);
  assert.equal(new Set(sold).size, sold.length, 'regional stock does not overlap');
  for (const stall of stalls) assert.ok(STALLS[stall].length >= 2, stall);
  for (const id of sold) {
    const item = SHOP_ITEMS[id];
    assert.ok(item.price > 0 && LOOKS[id], id);
    const before = { ...createRunState(), money: item.price };
    const bought = buy(before, id);
    assert.equal(bought.look, id);
    assert.equal(bought.money, 0);
    assert.equal(shopKi(bought), shopKi(before), 'regional colors only change appearance');
    assert.equal(wear(bought, id).look, '', 'can remove a purchased look');
  }
});

test('regional armor survives the save format and is available in inventory', async () => {
  const { parseRun } = await import('./save.ts');
  const { inventoryOf } = await import('./items.ts');
  const purchased = buy({ ...createRunState(), money: 500 }, 'tideColors');
  const restored = parseRun(JSON.parse(JSON.stringify(purchased)));
  assert.ok(restored);
  assert.equal(restored.look, 'tideColors');
  assert.ok(inventoryOf(restored).includes('shop:tideColors'));
});
