export function stringify(any: unknown) {
  return JSON.stringify(any, (key, value) =>
    value instanceof Object && !(value instanceof Array)
      ? Object.keys(value)
          .sort()
          .reduce((sorted, key) => {
            sorted[key] = value[key];
            return sorted;
          }, {} as Record<string, unknown>)
      : value
  );
}
