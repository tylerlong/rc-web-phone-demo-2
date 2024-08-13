export const trimPrefix = (s, prefix) => {
  if (s.startsWith(prefix)) {
    return s.slice(prefix.length);
  }
  return s;
};
