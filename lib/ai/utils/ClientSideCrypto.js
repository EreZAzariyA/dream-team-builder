/**
 * Client-side encryption utilities for API keys
 * Uses Web Crypto API for secure localStorage storage
 */

export class ClientSideCrypto {
  static async generateKey() {
    if (typeof window === 'undefined') return null;
    
    try {
      const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // not extractable
        ['encrypt', 'decrypt']
      );
      return key;
    } catch (error) {
      console.warn('Failed to generate encryption key:', error);
      return null;
    }
  }

  static async getOrCreateKey() {
    if (typeof window === 'undefined') return null;
    
    // Try to get existing key from session storage
    const existingKey = sessionStorage.getItem('ai_crypto_key');
    if (existingKey) {
      try {
        const keyData = JSON.parse(existingKey);
        return await window.crypto.subtle.importKey(
          'raw',
          new Uint8Array(keyData),
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        console.warn('Failed to import existing key:', error);
      }
    }

    // Generate new key
    const key = await this.generateKey();
    if (key) {
      try {
        const exported = await window.crypto.subtle.exportKey('raw', key);
        sessionStorage.setItem('ai_crypto_key', JSON.stringify(Array.from(new Uint8Array(exported))));
      } catch (error) {
        console.warn('Failed to store encryption key:', error);
      }
    }
    return key;
  }

  static async encrypt(text) {
    if (typeof window === 'undefined' || !text) return text;
    
    try {
      const key = await this.getOrCreateKey();
      if (!key) return text; // Fallback to plaintext

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn('Client-side encryption failed:', error);
      return text; // Fallback to plaintext
    }
  }

  static async decrypt(encryptedData) {
    if (typeof window === 'undefined' || !encryptedData) return encryptedData;
    
    try {
      // Check if data looks encrypted (base64)
      if (!/^[A-Za-z0-9+/]+=*$/.test(encryptedData)) {
        return encryptedData; // Assume plaintext
      }

      const key = await this.getOrCreateKey();
      if (!key) return encryptedData;

      const combined = new Uint8Array(atob(encryptedData).split('').map(char => char.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.warn('Client-side decryption failed:', error);
      return encryptedData; // Return as-is if decryption fails
    }
  }

  static isEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    // Simple check for base64 format
    return /^[A-Za-z0-9+/]+=*$/.test(value) && value.length > 20;
  }
}

export default ClientSideCrypto;