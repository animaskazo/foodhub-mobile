export function customerFields(customer = {}) {
  return {
    customer_name: String(customer.name ?? '').trim() || null,
    customer_phone: String(customer.phone ?? '').trim() || null,
  };
}
