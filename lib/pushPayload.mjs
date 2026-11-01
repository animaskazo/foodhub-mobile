const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseOrderPush(data) {
  if (data?.type !== 'new_order' || !uuid.test(data.orderId) || !uuid.test(data.organizationId)) return null;
  return { orderId: data.orderId, organizationId: data.organizationId };
}
