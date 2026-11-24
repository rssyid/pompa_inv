export interface EstateOrderSortable {
  sortOrder?: number | null;
  code?: string | null;
}

function getOrderGroup(item: EstateOrderSortable): number {
  if (!item.code) return 2;
  if ((item.sortOrder ?? 0) > 0) return 0;
  return 1;
}

/** Compare estates so positive sortOrder values lead ascending, followed by 0/unnumbered alphabetically, then unassigned rows. */
export function compareEstateOrder(a: EstateOrderSortable, b: EstateOrderSortable): number {
  const groupDiff = getOrderGroup(a) - getOrderGroup(b);
  if (groupDiff !== 0) return groupDiff;

  if (getOrderGroup(a) === 0) {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
  }

  return (a.code ?? "").localeCompare(b.code ?? "");
}

/** Return a new array sorted by estate sortOrder and code tie-breaker. */
export function sortEstatesByOrder<T extends EstateOrderSortable>(items: T[]): T[] {
  return [...items].sort(compareEstateOrder);
}
