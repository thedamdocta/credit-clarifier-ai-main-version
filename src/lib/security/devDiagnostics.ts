const NOOP = () => undefined;

export const devDiagnostics = new Proxy({} as Console, {
  get() {
    return NOOP;
  },
});
