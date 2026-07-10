// ===== English Plus - Security Library (v4) =====
// PIN Hashing (SHA-256) + AES-GCM Encryption

// ===== PIN Hashing using Web Crypto API (SHA-256 + salt) =====
const PIN_SALT = 'english_plus_v4_salt_2026';

export async function hashPin(pin: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback: simple hash (not as secure, but works)
    let hash = 0;
    const str = pin + PIN_SALT;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(36);
  }
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + PIN_SALT);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback
    let hash = 0;
    const str = pin + PIN_SALT;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(36);
  }
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

// ===== AES-GCM Encryption for backups =====
// Uses Web Crypto API for AES-GCM (industry standard)

async function deriveKey(password: string): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('english_plus_aes_salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
}

export async function encryptAES(data: string, password: string): Promise<string> {
  const key = await deriveKey(password);
  if (!key) {
    // Fallback to XOR if Web Crypto not available
    return encryptXOR(data, password);
  }
  try {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );
    // Combine IV + encrypted data as base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch {
    return encryptXOR(data, password);
  }
}

export async function decryptAES(encrypted: string, password: string): Promise<string> {
  const key = await deriveKey(password);
  if (!key) {
    return decryptXOR(encrypted, password);
  }
  try {
    const combined = new Uint8Array(atob(encrypted).split('').map(c => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return decryptXOR(encrypted, password);
  }
}

// XOR fallback (legacy compatibility)
function encryptXOR(data: string, key: string): string {
  if (!key) return data;
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

function decryptXOR(encrypted: string, key: string): string {
  if (!key) return encrypted;
  try {
    const data = decodeURIComponent(escape(atob(encrypted)));
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return '';
  }
}
