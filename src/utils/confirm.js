/** @returns {boolean} */
export function confirmDelete(itemLabel = 'this item') {
  return window.confirm(`Are you sure you want to delete ${itemLabel}? This action cannot be undone.`);
}
