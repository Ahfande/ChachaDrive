/**
 * ============================================
 * CHACHA20-POLY1305.JS
 * ============================================
 * Implementasi murni JavaScript dari algoritma AEAD
 * ChaCha20-Poly1305 sesuai RFC 8439, digunakan sebagai
 * mekanisme client-side encryption pada SecureCloud.
 *
 * Setiap file dienkripsi/didekripsi di sisi klien (browser)
 * SEBELUM meninggalkan perangkat pengguna, sehingga data
 * yang tersimpan pada media penyimpanan selalu berbentuk
 * ciphertext (sesuai rancangan pada proposal skripsi).
 *
 * Tidak ada dependensi eksternal / library pihak ketiga.
 * ============================================
 */

const ChaCha20Poly1305 = (function () {
    'use strict';

    // ---------- Util dasar ----------
    function rotl(x, n) {
        return ((x << n) | (x >>> (32 - n))) >>> 0;
    }

    function u32le(bytes, offset) {
        return (
            (bytes[offset] |
                (bytes[offset + 1] << 8) |
                (bytes[offset + 2] << 16) |
                (bytes[offset + 3] << 24)) >>> 0
        );
    }

    function writeU32le(target, offset, value) {
        target[offset] = value & 0xff;
        target[offset + 1] = (value >>> 8) & 0xff;
        target[offset + 2] = (value >>> 16) & 0xff;
        target[offset + 3] = (value >>> 24) & 0xff;
    }

    // ---------- ChaCha20 core ----------
    const CONSTANTS = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

    function quarterRound(s, a, b, c, d) {
        s[a] = (s[a] + s[b]) >>> 0; s[d] ^= s[a]; s[d] = rotl(s[d], 16);
        s[c] = (s[c] + s[d]) >>> 0; s[b] ^= s[c]; s[b] = rotl(s[b], 12);
        s[a] = (s[a] + s[b]) >>> 0; s[d] ^= s[a]; s[d] = rotl(s[d], 8);
        s[c] = (s[c] + s[d]) >>> 0; s[b] ^= s[c]; s[b] = rotl(s[b], 7);
    }

    // Menghasilkan 64 byte keystream untuk 1 blok ChaCha20
    function chacha20Block(key32, counter, nonce12) {
        const state = new Uint32Array(16);
        state[0] = CONSTANTS[0]; state[1] = CONSTANTS[1];
        state[2] = CONSTANTS[2]; state[3] = CONSTANTS[3];
        for (let i = 0; i < 8; i++) state[4 + i] = u32le(key32, i * 4);
        state[12] = counter >>> 0;
        state[13] = u32le(nonce12, 0);
        state[14] = u32le(nonce12, 4);
        state[15] = u32le(nonce12, 8);

        const working = Uint32Array.from(state);
        for (let round = 0; round < 10; round++) {
            // Column rounds
            quarterRound(working, 0, 4, 8, 12);
            quarterRound(working, 1, 5, 9, 13);
            quarterRound(working, 2, 6, 10, 14);
            quarterRound(working, 3, 7, 11, 15);
            // Diagonal rounds
            quarterRound(working, 0, 5, 10, 15);
            quarterRound(working, 1, 6, 11, 12);
            quarterRound(working, 2, 7, 8, 13);
            quarterRound(working, 3, 4, 9, 14);
        }

        const out = new Uint8Array(64);
        for (let i = 0; i < 16; i++) {
            const val = (working[i] + state[i]) >>> 0;
            writeU32le(out, i * 4, val);
        }
        return out;
    }

    // XOR keystream dengan data (dipakai untuk enkripsi maupun dekripsi)
    function chacha20Xor(key32, initialCounter, nonce12, data) {
        const out = new Uint8Array(data.length);
        let counter = initialCounter;
        for (let offset = 0; offset < data.length; offset += 64) {
            const block = chacha20Block(key32, counter, nonce12);
            const chunkLen = Math.min(64, data.length - offset);
            for (let i = 0; i < chunkLen; i++) {
                out[offset + i] = data[offset + i] ^ block[i];
            }
            counter = (counter + 1) >>> 0;
        }
        return out;
    }

    // ---------- Poly1305 MAC (RFC 8439, aritmatika BigInt) ----------
    const P1305 = (1n << 130n) - 5n;
    const MASK128 = (1n << 128n) - 1n;

    function poly1305Mac(key32, msg) {
        // clamp r
        const rBytes = key32.slice(0, 16);
        rBytes[3] &= 15; rBytes[7] &= 15; rBytes[11] &= 15; rBytes[15] &= 15;
        rBytes[4] &= 252; rBytes[8] &= 252; rBytes[12] &= 252;

        let r = 0n;
        for (let i = 15; i >= 0; i--) r = (r << 8n) | BigInt(rBytes[i]);

        let s = 0n;
        for (let i = 15; i >= 0; i--) s = (s << 8n) | BigInt(key32[16 + i]);

        let acc = 0n;
        const len = msg.length;
        for (let offset = 0; offset < len; offset += 16) {
            const chunkLen = Math.min(16, len - offset);
            let n = 0n;
            for (let i = chunkLen - 1; i >= 0; i--) {
                n = (n << 8n) | BigInt(msg[offset + i]);
            }
            n |= (1n << BigInt(chunkLen * 8)); // tambahkan byte 0x01 (pad)
            acc = (acc + n) % P1305;
            acc = (acc * r) % P1305;
        }

        acc = (acc + s) & MASK128;

        const tag = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            tag[i] = Number(acc & 0xffn);
            acc >>= 8n;
        }
        return tag;
    }

    function poly1305KeyGen(key32, nonce12) {
        const block = chacha20Block(key32, 0, nonce12);
        return block.slice(0, 32);
    }

    // Menyusun pesan untuk MAC: AAD (padded) || ciphertext (padded) || len(AAD) || len(ciphertext)
    function buildMacData(aad, ciphertext) {
        function pad16(n) { return (16 - (n % 16)) % 16; }
        const aadPad = pad16(aad.length);
        const ctPad = pad16(ciphertext.length);
        const total = aad.length + aadPad + ciphertext.length + ctPad + 16;
        const out = new Uint8Array(total);
        let o = 0;
        out.set(aad, o); o += aad.length + aadPad;
        out.set(ciphertext, o); o += ciphertext.length + ctPad;

        const lenAad = BigInt(aad.length);
        const lenCt = BigInt(ciphertext.length);
        for (let i = 0; i < 8; i++) out[o + i] = Number((lenAad >> BigInt(8 * i)) & 0xffn);
        for (let i = 0; i < 8; i++) out[o + 8 + i] = Number((lenCt >> BigInt(8 * i)) & 0xffn);
        return out;
    }

    function constantTimeEqual(a, b) {
        if (a.length !== b.length) return false;
        let diff = 0;
        for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
        return diff === 0;
    }

    // ---------- AEAD API ----------
    /**
     * Mengenkripsi plaintext menggunakan ChaCha20-Poly1305.
     * @returns {Uint8Array} ciphertext || tag (16 byte tag di akhir)
     */
    function encrypt(key32, nonce12, plaintext, aad) {
        aad = aad || new Uint8Array(0);
        const ciphertext = chacha20Xor(key32, 1, nonce12, plaintext);
        const otk = poly1305KeyGen(key32, nonce12);
        const macData = buildMacData(aad, ciphertext);
        const tag = poly1305Mac(otk, macData);

        const result = new Uint8Array(ciphertext.length + 16);
        result.set(ciphertext, 0);
        result.set(tag, ciphertext.length);
        return result;
    }

    /**
     * Mendekripsi data (ciphertext || tag). Melempar error bila
     * tag tidak valid (data telah dimodifikasi / rusak).
     */
    function decrypt(key32, nonce12, ciphertextWithTag, aad) {
        aad = aad || new Uint8Array(0);
        const tag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
        const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

        const otk = poly1305KeyGen(key32, nonce12);
        const macData = buildMacData(aad, ciphertext);
        const expectedTag = poly1305Mac(otk, macData);

        if (!constantTimeEqual(tag, expectedTag)) {
            throw new Error('Autentikasi gagal: file rusak atau kunci tidak valid (Poly1305 tag mismatch)');
        }

        return chacha20Xor(key32, 1, nonce12, ciphertext);
    }

    function randomBytes(len) {
        const b = new Uint8Array(len);
        crypto.getRandomValues(b);
        return b;
    }

    function generateKey() {
        return randomBytes(32);
    }

    function generateNonce() {
        return randomBytes(12);
    }

    // ---------- Encoding helpers ----------
    function bytesToBase64(bytes) {
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function base64ToBytes(b64) {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    return {
        encrypt,
        decrypt,
        generateKey,
        generateNonce,
        randomBytes,
        bytesToBase64,
        base64ToBytes
    };
})();
