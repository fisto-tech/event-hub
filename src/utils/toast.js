let listener = null;

export function showToast(message, type = 'success') {
  const payload = { id: Date.now(), message, type };
  if (listener) listener(payload);
}

export function subscribeToast(fn) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
