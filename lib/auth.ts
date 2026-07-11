// Web Crypto API — works in browser, no extra packages needed

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'wealthos-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

const AUTH_KEYS = {
  email: 'wealthos_auth_email',
  passwordHash: 'wealthos_auth_hash',
  authEnabled: 'wealthos_auth_enabled',
  lastActive: 'wealthos_last_active',
  lockTimeout: 'wealthos_lock_timeout', // minutes
};

// Initialize default user credentials (vikas@gmail.com & password@1234)
if (typeof window !== 'undefined') {
  const currentEmail = localStorage.getItem(AUTH_KEYS.email);
  if (!currentEmail || currentEmail === 'vikas@gmail.com') {
    localStorage.setItem(AUTH_KEYS.email, 'vikas@gmail.com');
    // Overwrite hash to ensure password@1234 is set for vikas@gmail.com
    hashPassword('password@1234').then((hash) => {
      localStorage.setItem(AUTH_KEYS.passwordHash, hash);
    });
  }
  if (!localStorage.getItem(AUTH_KEYS.authEnabled)) {
    localStorage.setItem(AUTH_KEYS.authEnabled, 'true');
  }
}

export function isAuthEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTH_KEYS.authEnabled) === 'true';
}

export function getAuthEmail(): string {
  if (typeof window === 'undefined') return 'vikas@gmail.com';
  return localStorage.getItem(AUTH_KEYS.email) || 'vikas@gmail.com';
}

export function getPasswordHash(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_KEYS.passwordHash);
}

export async function setCredentials(email: string, password?: string): Promise<void> {
  localStorage.setItem(AUTH_KEYS.email, email);
  if (password) {
    const hash = await hashPassword(password);
    localStorage.setItem(AUTH_KEYS.passwordHash, hash);
  }
  localStorage.setItem(AUTH_KEYS.authEnabled, 'true');
}

export async function setPassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  localStorage.setItem(AUTH_KEYS.passwordHash, hash);
  localStorage.setItem(AUTH_KEYS.authEnabled, 'true');
}

export function disableAuth(): void {
  localStorage.setItem(AUTH_KEYS.authEnabled, 'false');
}

export function getLockTimeout(): number {
  const v = localStorage.getItem(AUTH_KEYS.lockTimeout);
  return v ? Number(v) : 15; // default 15 minutes
}

export function setLockTimeout(minutes: number): void {
  localStorage.setItem(AUTH_KEYS.lockTimeout, String(minutes));
}

export function updateLastActive(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEYS.lastActive, Date.now().toString());
  }
}

export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const last = localStorage.getItem(AUTH_KEYS.lastActive);
  if (!last) return true;
  const elapsed = (Date.now() - Number(last)) / 60000; // minutes
  return elapsed > getLockTimeout();
}

