/**
 * Cryptographic utilities for secure API key storage
 * Server-side only encryption using Node.js crypto module
 */

import crypto from 'crypto';

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-fallback-key-for-development';

// Ensure key is 32 bytes (256 bits) for AES-256
const getEncryptionKey = () => {
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
};

/**
 * Encrypt a string value using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {string} - Encrypted value as base64 string
 */
export function encrypt(text) {
  if (!text || typeof text !== 'string') {
    return text; // Return as-is if invalid input
  }

  try {
    // Use AES-256-GCM for authenticated encryption
    const algorithm = 'aes-256-gcm';
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 128-bit IV
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    cipher.setAAD(Buffer.from('api-key', 'utf8')); // Additional authenticated data
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    
    return Buffer.from(result).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    return text; // Fallback to plaintext in development
  }
}

/**
 * Decrypt an encrypted string value
 * @param {string} encryptedData - The encrypted data as base64 string
 * @returns {string} - Decrypted text
 */
export function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData; // Return as-is if invalid input
  }

  try {
    // Check if data looks encrypted (base64 format)
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
    if (!decoded.includes(':')) {
      return encryptedData; // Assume it's already plaintext
    }

    const algorithm = 'aes-256-gcm';
    const key = getEncryptionKey();
    
    // Split components
    const [ivHex, authTagHex, encrypted] = decoded.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      return encryptedData; // Invalid format, return as-is
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAAD(Buffer.from('api-key', 'utf8')); // Same AAD as encryption
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt API key. Check ENCRYPTION_KEY.');
  }
}

/**
 * Check if a string appears to be encrypted
 * @param {string} value - The value to check
 * @returns {boolean} - True if appears encrypted
 */
export function isEncrypted(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Simple heuristic: encrypted values are base64 and contain colons when decoded
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return decoded.includes(':') && decoded.split(':').length === 3;
  } catch {
    return false;
  }
}

/**
 * Securely hash a value for comparison (one-way)
 * @param {string} value - The value to hash
 * @returns {string} - SHA-256 hash as hex string
 */
export function hashValue(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random key for encryption
 * @param {number} length - Length in bytes (default 32)
 * @returns {string} - Random key as hex string
 */
export function generateKey(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Mask a sensitive value for display purposes
 * @param {string} value - The value to mask
 * @param {number} showStart - Characters to show at start (default 8)
 * @param {number} showEnd - Characters to show at end (default 4)
 * @returns {string} - Masked value
 */
export function maskValue(value, showStart = 8, showEnd = 4) {
  if (!value || typeof value !== 'string' || value.length <= showStart + showEnd) {
    return value;
  }

  const start = value.substring(0, showStart);
  const end = value.substring(value.length - showEnd);
  
  return `${start}...${end}`;
}

export default { encrypt, decrypt, isEncrypted, hashValue, generateKey, maskValue };