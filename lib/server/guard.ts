// Lightweight replacement for the `server-only` package: importing anything
// from lib/server/* into a client component throws at module-eval time, so
// server secrets can never be bundled into browser code.
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/server/* is server-only and must not be imported into client code.'
  );
}

export {};
