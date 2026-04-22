/**
 * Recovery Key Service
 *
 * Handles BIP39 mnemonic generation and encryption/decryption of Private Keys
 * for account recovery when Master Password is forgotten.
 *
 * Security: Recovery mnemonic is NEVER sent to server.
 */

import * as bip39 from 'bip39';

/**
 * 1. Generate 12-word BIP39 mnemonic (128-bit entropy, like MetaMask)
 * @returns Array of 12 words
 */
export function generateRecoveryMnemonic(): string[] {
    const mnemonic = bip39.generateMnemonic(128); // 128 bits = 12 words
    return mnemonic.split(' ');
}

/**
 * 2. Convert mnemonic to encryption key (AES-256)
 * @param mnemonic - Space-separated 12 words or array of words
 * @returns CryptoKey for AES-256-GCM
 */
export async function deriveRecoveryKey(
    mnemonic: string | string[]
): Promise<CryptoKey> {
    const mnemonicString = Array.isArray(mnemonic) ? mnemonic.join(' ') : mnemonic;

    // Validate mnemonic first
    if (!bip39.validateMnemonic(mnemonicString)) {
        throw new Error('Invalid recovery mnemonic');
    }

    // Convert to seed (512 bits)
    const seed = await bip39.mnemonicToSeed(mnemonicString);

    // Use a fixed salt for recovery key derivation (deterministic)
    const fixedSalt = new TextEncoder().encode('wordai-recovery-key-v1');

    // Import seed as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        seed.slice(0, 32), // Use first 32 bytes
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // Derive AES-256 key using PBKDF2
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: fixedSalt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * 3. Encrypt Private Key with Recovery Key
 * @param privateKey - User's RSA private key
 * @param mnemonic - 12-word recovery phrase
 * @returns Base64 encrypted data (IV + ciphertext)
 */
export async function encryptWithRecoveryKey(
    privateKey: CryptoKey,
    mnemonic: string | string[]
): Promise<string> {
    const recoveryKey = await deriveRecoveryKey(mnemonic);

    // Export private key to raw format (PKCS8)
    const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', privateKey);

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        recoveryKey,
        privateKeyRaw
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * 4. Decrypt Private Key with Recovery Key
 * @param encryptedData - Base64 encrypted private key
 * @param mnemonic - 12-word recovery phrase
 * @returns Decrypted RSA private key
 */
export async function decryptWithRecoveryKey(
    encryptedData: string,
    mnemonic: string | string[]
): Promise<CryptoKey> {
    const recoveryKey = await deriveRecoveryKey(mnemonic);

    // Decode base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        recoveryKey,
        encrypted
    );

    // Import as RSA private key
    return crypto.subtle.importKey(
        'pkcs8',
        decrypted,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
    );
}

/**
 * 5. Validate mnemonic words
 * @param words - Space-separated string or array of words
 * @returns true if valid BIP39 mnemonic
 */
export function validateMnemonic(words: string | string[]): boolean {
    const mnemonic = Array.isArray(words) ? words.join(' ') : words;
    return bip39.validateMnemonic(mnemonic);
}

/**
 * 6. Get BIP39 wordlist (for autocomplete or validation)
 * @returns Array of 2048 BIP39 English words
 */
export function getWordlist(): string[] {
    return bip39.wordlists.english;
}

/**
 * 7. Format mnemonic for display (add word numbers)
 * @param words - Array of 12 words
 * @returns Array of formatted strings like "1. abandon"
 */
export function formatMnemonicForDisplay(words: string[]): string[] {
    return words.map((word, index) => `${index + 1}. ${word}`);
}

/**
 * 8. Parse user input (handles various formats)
 * @param input - User input (with or without numbers, extra spaces, etc.)
 * @returns Cleaned array of words
 */
export function parseMnemonicInput(input: string): string[] {
    return input
        .toLowerCase()
        .replace(/\d+\./g, '') // Remove "1.", "2.", etc.
        .split(/\s+/) // Split by any whitespace
        .filter(word => word.length > 0);
}
