import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderPush } from '../lib/pushPayload.mjs';
test('only valid new-order payloads can navigate to an order', () => {
  const orderId = '00000000-0000-4000-8000-000000000001';
  const organizationId = '00000000-0000-4000-8000-000000000002';
  assert.deepEqual(parseOrderPush({ type: 'new_order', orderId, organizationId }), { orderId, organizationId });
  for (const data of [null, {}, { type: 'ready', orderId, organizationId }, { type: 'new_order', orderId: '/admin', organizationId }, { type: 'new_order', orderId }]) {
    assert.equal(parseOrderPush(data), null);
  }
});
