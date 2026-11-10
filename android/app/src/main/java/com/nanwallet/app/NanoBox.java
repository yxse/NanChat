package com.nanchat.app;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;

/**
 * Native port of `box.decrypt` from multi-nano-web, so message previews can be decrypted
 * without the WebView (app killed or in the background). Java port of
 * ios/App/NanChatNotificationService/NanoBox.swift: keep the two in sync.
 *
 * Format (same as the JS side): base64(nonce[24] || mac[16] || ciphertext), sealed with
 * NaCl crypto_box (X25519 + XSalsa20-Poly1305). The sender's Nano (ed25519) public key is
 * converted to Curve25519 the standard way. The recipient's Curve25519 secret key is computed
 * by the app (blake2b instead of sha512, see src/services/notificationKeys.ts): this code never
 * sees a key able to sign blocks.
 *
 * Plain Java on purpose (no dependency, no Android API) so it can be tested on any JDK against
 * vectors produced by multi-nano-web: see android/NanoBoxTests.
 * Ported from TweetNaCl (public domain) and poly1305-donna.
 */
final class NanoBox {
    static final int NONCE_LENGTH = 24;

    private NanoBox() {}

    /**
     * Decrypts a message sent by {@code senderAddress} to the owner of {@code recipientCurveSecretKey}.
     * Returns null when anything is invalid (bad address, bad base64, MAC mismatch, not UTF-8).
     */
    static String open(String encrypted, String senderAddress, byte[] recipientCurveSecretKey) {
        if (encrypted == null || senderAddress == null || recipientCurveSecretKey == null || recipientCurveSecretKey.length != 32) {
            return null;
        }
        byte[] edPublicKey = NanoAddress.publicKey(senderAddress);
        if (edPublicKey == null) return null;
        byte[] curvePublicKey = Curve25519.convertEd25519PublicKey(edPublicKey);
        byte[] data;
        try {
            data = Base64.getDecoder().decode(encrypted.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (data.length < NONCE_LENGTH + Poly1305.TAG_LENGTH) return null;
        byte[] nonce = Arrays.copyOfRange(data, 0, NONCE_LENGTH);
        byte[] boxed = Arrays.copyOfRange(data, NONCE_LENGTH, data.length);
        byte[] shared = Curve25519.scalarMult(recipientCurveSecretKey, curvePublicKey);
        byte[] key = Salsa20.hsalsa20(new byte[16], shared);
        byte[] plain = SecretBox.open(boxed, nonce, key);
        if (plain == null) return null;
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(plain))
                    .toString();
        } catch (CharacterCodingException e) {
            return null;
        }
    }

    /** Curve25519 secret key used by multi-nano-web for a Nano private key: blake2b-512, clamped. */
    static byte[] curveSecretKey(byte[] nanoPrivateKey) {
        byte[] d = Blake2b.hash(nanoPrivateKey, 64);
        d[0] &= (byte) 248;
        d[31] &= 127;
        d[31] |= 64;
        return Arrays.copyOf(d, 32);
    }

    static byte[] fromHex(String hex) {
        if (hex == null || hex.length() % 2 != 0) return null;
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            int hi = Character.digit(hex.charAt(2 * i), 16);
            int lo = Character.digit(hex.charAt(2 * i + 1), 16);
            if (hi < 0 || lo < 0) return null;
            out[i] = (byte) ((hi << 4) | lo);
        }
        return out;
    }

    static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b & 0xff));
        return sb.toString();
    }

    // ---------------------------------------------------------------- Nano address

    static final class NanoAddress {
        private static final String ALPHABET = "13456789abcdefghijkmnopqrstuwxyz";

        /** Public key of a nano_ / xrb_ (or other ticker prefixed) address, checksum verified. */
        static byte[] publicKey(String address) {
            int underscore = address.lastIndexOf('_');
            if (underscore < 0) return null;
            String encoded = address.substring(underscore + 1);
            if (encoded.length() != 60) return null;
            int[] keyBits = decode(encoded.substring(0, 52));
            int[] checksumBits = decode(encoded.substring(52));
            if (keyBits == null || checksumBits == null) return null;
            // 52 chars = 260 bits: 4 padding bits then the 256 bit key
            byte[] publicKey = bytesFromBits(Arrays.copyOfRange(keyBits, 4, keyBits.length));
            byte[] checksum = bytesFromBits(checksumBits);
            byte[] hash = Blake2b.hash(publicKey, 5);
            byte[] expected = new byte[5];
            for (int i = 0; i < 5; i++) expected[i] = hash[4 - i];
            if (!Arrays.equals(checksum, expected)) return null;
            return publicKey;
        }

        private static int[] decode(String chars) {
            int[] bits = new int[chars.length() * 5];
            for (int i = 0; i < chars.length(); i++) {
                int v = ALPHABET.indexOf(chars.charAt(i));
                if (v < 0) return null;
                for (int shift = 4; shift >= 0; shift--) {
                    bits[i * 5 + (4 - shift)] = (v >> shift) & 1;
                }
            }
            return bits;
        }

        private static byte[] bytesFromBits(int[] bits) {
            byte[] out = new byte[bits.length / 8];
            for (int i = 0; i < out.length * 8; i++) {
                if (bits[i] == 1) out[i / 8] |= (byte) (0x80 >>> (i % 8));
            }
            return out;
        }
    }

    // ---------------------------------------------------------------- Curve25519 (TweetNaCl, 16 x 16-bit limbs)

    static final class Curve25519 {
        private static long[] gf() {
            return new long[16];
        }

        private static long[] gf(long... initial) {
            long[] g = new long[16];
            System.arraycopy(initial, 0, g, 0, initial.length);
            return g;
        }

        private static final long[] GF1 = gf(1);
        private static final long[] C121665 = gf(0xDB41, 1);

        private static void car(long[] o) {
            for (int i = 0; i < 16; i++) {
                o[i] += 1L << 16;
                long c = o[i] >> 16;
                if (i < 15) {
                    o[i + 1] += c - 1;
                } else {
                    o[0] += 38 * (c - 1);
                }
                o[i] -= c << 16;
            }
        }

        private static void sel(long[] p, long[] q, long b) {
            long c = ~(b - 1);
            for (int i = 0; i < 16; i++) {
                long t = c & (p[i] ^ q[i]);
                p[i] ^= t;
                q[i] ^= t;
            }
        }

        private static byte[] pack(long[] n) {
            long[] t = n.clone();
            long[] m = gf();
            car(t);
            car(t);
            car(t);
            for (int j = 0; j < 2; j++) {
                m[0] = t[0] - 0xffed;
                for (int i = 1; i < 15; i++) {
                    m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1);
                    m[i - 1] &= 0xffff;
                }
                m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
                long b = (m[15] >> 16) & 1;
                m[14] &= 0xffff;
                sel(t, m, 1 - b);
            }
            byte[] o = new byte[32];
            for (int i = 0; i < 16; i++) {
                o[2 * i] = (byte) (t[i] & 0xff);
                o[2 * i + 1] = (byte) (t[i] >> 8);
            }
            return o;
        }

        private static long[] unpack(byte[] n) {
            long[] o = gf();
            for (int i = 0; i < 16; i++) {
                o[i] = (n[2 * i] & 0xff) + ((long) (n[2 * i + 1] & 0xff) << 8);
            }
            o[15] &= 0x7fff;
            return o;
        }

        private static long[] add(long[] a, long[] b) {
            long[] o = gf();
            for (int i = 0; i < 16; i++) o[i] = a[i] + b[i];
            return o;
        }

        private static long[] sub(long[] a, long[] b) {
            long[] o = gf();
            for (int i = 0; i < 16; i++) o[i] = a[i] - b[i];
            return o;
        }

        private static long[] mul(long[] a, long[] b) {
            long[] t = new long[31];
            for (int i = 0; i < 16; i++) {
                for (int j = 0; j < 16; j++) {
                    t[i + j] += a[i] * b[j];
                }
            }
            for (int i = 0; i < 15; i++) {
                t[i] += 38 * t[i + 16];
            }
            long[] o = Arrays.copyOf(t, 16);
            car(o);
            car(o);
            return o;
        }

        private static long[] square(long[] a) {
            return mul(a, a);
        }

        private static long[] invert(long[] i) {
            long[] c = i.clone();
            for (int a = 253; a >= 0; a--) {
                c = square(c);
                if (a != 2 && a != 4) c = mul(c, i);
            }
            return c;
        }

        /** X25519: n * p (both 32 bytes). */
        static byte[] scalarMult(byte[] n, byte[] p) {
            byte[] z = n.clone();
            z[31] = (byte) ((n[31] & 127) | 64);
            z[0] &= (byte) 248;
            long[] x = unpack(p);
            long[] a = gf(1), b = x.clone(), c = gf(), d = gf(1);
            for (int i = 254; i >= 0; i--) {
                long r = ((z[i >> 3] & 0xff) >>> (i & 7)) & 1;
                sel(a, b, r);
                sel(c, d, r);
                long[] e = add(a, c);
                a = sub(a, c);
                c = add(b, d);
                b = sub(b, d);
                d = square(e);
                long[] f = square(a);
                a = mul(c, a);
                c = mul(b, e);
                e = add(a, c);
                a = sub(a, c);
                b = square(a);
                c = sub(d, f);
                a = mul(c, C121665);
                a = add(a, d);
                c = mul(c, a);
                a = mul(d, f);
                d = mul(b, x);
                b = square(e);
                sel(a, b, r);
                sel(c, d, r);
            }
            return pack(mul(a, invert(c)));
        }

        /** Birational map from the ed25519 y coordinate: u = (1 + y) / (1 - y). */
        static byte[] convertEd25519PublicKey(byte[] pk) {
            long[] y = unpack(pk);
            long[] a = add(GF1, y);
            long[] b = invert(sub(GF1, y));
            return pack(mul(a, b));
        }
    }

    // ---------------------------------------------------------------- Salsa20 / XSalsa20

    static final class Salsa20 {
        private static final byte[] SIGMA = "expand 32-byte k".getBytes(StandardCharsets.US_ASCII);

        private static int load32(byte[] b, int o) {
            return (b[o] & 0xff) | (b[o + 1] & 0xff) << 8 | (b[o + 2] & 0xff) << 16 | (b[o + 3] & 0xff) << 24;
        }

        private static byte[] core(byte[] input, byte[] key, boolean hsalsa) {
            int[] j = new int[16];
            j[0] = load32(SIGMA, 0);
            j[5] = load32(SIGMA, 4);
            j[10] = load32(SIGMA, 8);
            j[15] = load32(SIGMA, 12);
            for (int i = 0; i < 4; i++) {
                j[1 + i] = load32(key, 4 * i);
                j[11 + i] = load32(key, 16 + 4 * i);
                j[6 + i] = load32(input, 4 * i);
            }
            int[] x = j.clone();
            for (int round = 0; round < 10; round++) {
                qr(x, 0, 4, 8, 12); qr(x, 5, 9, 13, 1); qr(x, 10, 14, 2, 6); qr(x, 15, 3, 7, 11);
                qr(x, 0, 1, 2, 3); qr(x, 5, 6, 7, 4); qr(x, 10, 11, 8, 9); qr(x, 15, 12, 13, 14);
            }
            int[] words;
            if (hsalsa) {
                words = new int[] {x[0], x[5], x[10], x[15], x[6], x[7], x[8], x[9]};
            } else {
                words = new int[16];
                for (int i = 0; i < 16; i++) words[i] = x[i] + j[i];
            }
            byte[] out = new byte[words.length * 4];
            for (int i = 0; i < words.length; i++) {
                int w = words[i];
                out[4 * i] = (byte) w;
                out[4 * i + 1] = (byte) (w >>> 8);
                out[4 * i + 2] = (byte) (w >>> 16);
                out[4 * i + 3] = (byte) (w >>> 24);
            }
            return out;
        }

        private static void qr(int[] x, int a, int b, int c, int d) {
            x[b] ^= Integer.rotateLeft(x[a] + x[d], 7);
            x[c] ^= Integer.rotateLeft(x[b] + x[a], 9);
            x[d] ^= Integer.rotateLeft(x[c] + x[b], 13);
            x[a] ^= Integer.rotateLeft(x[d] + x[c], 18);
        }

        static byte[] hsalsa20(byte[] input, byte[] key) {
            return core(input, key, true);
        }

        /** XSalsa20 keystream XOR (24 byte nonce). */
        static byte[] xsalsa20Xor(byte[] message, byte[] nonce, byte[] key) {
            byte[] subKey = hsalsa20(Arrays.copyOfRange(nonce, 0, 16), key);
            byte[] block = new byte[16];
            System.arraycopy(nonce, 16, block, 0, 8);
            byte[] out = new byte[message.length];
            int offset = 0;
            while (offset < message.length) {
                byte[] stream = core(block, subKey, false);
                int n = Math.min(64, message.length - offset);
                for (int i = 0; i < n; i++) out[offset + i] = (byte) (message[offset + i] ^ stream[i]);
                offset += n;
                // increment the 64-bit little-endian block counter
                int carry = 1;
                for (int i = 8; i < 16; i++) {
                    carry += block[i] & 0xff;
                    block[i] = (byte) carry;
                    carry >>>= 8;
                }
            }
            return out;
        }
    }

    // ---------------------------------------------------------------- Poly1305 (poly1305-donna, 26-bit limbs)

    static final class Poly1305 {
        static final int TAG_LENGTH = 16;
        private static final long MASK = 0x3ffffff;
        private static final long U32 = 0xffffffffL;

        private static long le32(byte[] b, int o) {
            return ((b[o] & 0xff) | (b[o + 1] & 0xff) << 8 | (b[o + 2] & 0xff) << 16 | (long) (b[o + 3] & 0xff) << 24) & U32;
        }

        static byte[] authenticate(byte[] message, byte[] key) {
            long r0 = le32(key, 0) & 0x3ffffff;
            long r1 = (le32(key, 3) >>> 2) & 0x3ffff03;
            long r2 = (le32(key, 6) >>> 4) & 0x3ffc0ff;
            long r3 = (le32(key, 9) >>> 6) & 0x3f03fff;
            long r4 = (le32(key, 12) >>> 8) & 0x00fffff;
            long s1 = r1 * 5, s2 = r2 * 5, s3 = r3 * 5, s4 = r4 * 5;
            long h0 = 0, h1 = 0, h2 = 0, h3 = 0, h4 = 0;

            int offset = 0;
            byte[] block = new byte[16];
            while (offset < message.length) {
                Arrays.fill(block, (byte) 0);
                int n = Math.min(16, message.length - offset);
                System.arraycopy(message, offset, block, 0, n);
                long hibit = 1L << 24;
                if (n < 16) {
                    block[n] = 1;
                    hibit = 0;
                }
                offset += n;

                h0 += le32(block, 0) & MASK;
                h1 += (le32(block, 3) >>> 2) & MASK;
                h2 += (le32(block, 6) >>> 4) & MASK;
                h3 += (le32(block, 9) >>> 6) & MASK;
                h4 += (le32(block, 12) >>> 8) | hibit;

                long d0 = h0 * r0 + h1 * s4 + h2 * s3 + h3 * s2 + h4 * s1;
                long d1 = h0 * r1 + h1 * r0 + h2 * s4 + h3 * s3 + h4 * s2;
                long d2 = h0 * r2 + h1 * r1 + h2 * r0 + h3 * s4 + h4 * s3;
                long d3 = h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * s4;
                long d4 = h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;

                long c = d0 >>> 26; h0 = d0 & MASK;
                d1 += c; c = d1 >>> 26; h1 = d1 & MASK;
                d2 += c; c = d2 >>> 26; h2 = d2 & MASK;
                d3 += c; c = d3 >>> 26; h3 = d3 & MASK;
                d4 += c; c = d4 >>> 26; h4 = d4 & MASK;
                h0 += c * 5;
                c = h0 >>> 26; h0 &= MASK;
                h1 += c;
            }

            // full carry
            long c = h1 >>> 26; h1 &= MASK;
            h2 += c; c = h2 >>> 26; h2 &= MASK;
            h3 += c; c = h3 >>> 26; h3 &= MASK;
            h4 += c; c = h4 >>> 26; h4 &= MASK;
            h0 += c * 5; c = h0 >>> 26; h0 &= MASK;
            h1 += c;

            // compute h - p and select it if non negative
            long g0 = h0 + 5; c = g0 >>> 26; g0 &= MASK;
            long g1 = h1 + c; c = g1 >>> 26; g1 &= MASK;
            long g2 = h2 + c; c = g2 >>> 26; g2 &= MASK;
            long g3 = h3 + c; c = g3 >>> 26; g3 &= MASK;
            long g4 = h4 + c - (1L << 26);

            long keepH = g4 >> 63; // all ones if g4 < 0 (h < p)
            h0 = (h0 & keepH) | (g0 & ~keepH);
            h1 = (h1 & keepH) | (g1 & ~keepH);
            h2 = (h2 & keepH) | (g2 & ~keepH);
            h3 = (h3 & keepH) | (g3 & ~keepH);
            h4 = (h4 & keepH) | (g4 & ~keepH);

            // h % 2^128 + s
            long w0 = (h0 | (h1 << 26)) & U32;
            long w1 = ((h1 >>> 6) | (h2 << 20)) & U32;
            long w2 = ((h2 >>> 12) | (h3 << 14)) & U32;
            long w3 = ((h3 >>> 18) | (h4 << 8)) & U32;
            long f = w0 + le32(key, 16);
            long t0 = f & U32;
            f = w1 + le32(key, 20) + (f >>> 32);
            long t1 = f & U32;
            f = w2 + le32(key, 24) + (f >>> 32);
            long t2 = f & U32;
            f = w3 + le32(key, 28) + (f >>> 32);
            long t3 = f & U32;

            byte[] tag = new byte[16];
            long[] words = {t0, t1, t2, t3};
            for (int i = 0; i < 4; i++) {
                tag[4 * i] = (byte) words[i];
                tag[4 * i + 1] = (byte) (words[i] >>> 8);
                tag[4 * i + 2] = (byte) (words[i] >>> 16);
                tag[4 * i + 3] = (byte) (words[i] >>> 24);
            }
            return tag;
        }
    }

    // ---------------------------------------------------------------- SecretBox (XSalsa20-Poly1305, NaCl framing without the zero padding)

    static final class SecretBox {
        /** {@code boxed} is mac[16] || ciphertext, as returned by TweetNaCl secretbox. */
        static byte[] open(byte[] boxed, byte[] nonce, byte[] key) {
            if (boxed.length < Poly1305.TAG_LENGTH || nonce.length != 24 || key.length != 32) return null;
            int length = boxed.length - Poly1305.TAG_LENGTH;
            byte[] ciphertext = Arrays.copyOfRange(boxed, Poly1305.TAG_LENGTH, boxed.length);
            // first 32 bytes of keystream are the one-time Poly1305 key, the message follows
            byte[] stream = Salsa20.xsalsa20Xor(new byte[32 + length], nonce, key);
            byte[] expected = Poly1305.authenticate(ciphertext, Arrays.copyOf(stream, 32));
            int diff = 0;
            for (int i = 0; i < Poly1305.TAG_LENGTH; i++) diff |= expected[i] ^ boxed[i];
            if (diff != 0) return null;
            byte[] plain = new byte[length];
            for (int i = 0; i < length; i++) plain[i] = (byte) (ciphertext[i] ^ stream[32 + i]);
            return plain;
        }
    }

    // ---------------------------------------------------------------- BLAKE2b (unkeyed)

    static final class Blake2b {
        private static final long[] IV = {
            0x6a09e667f3bcc908L, 0xbb67ae8584caa73bL, 0x3c6ef372fe94f82bL, 0xa54ff53a5f1d36f1L,
            0x510e527fade682d1L, 0x9b05688c2b3e6c1fL, 0x1f83d9abfb41bd6bL, 0x5be0cd19137e2179L,
        };

        private static final int[][] SIGMA = {
            {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
            {14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3},
            {11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4},
            {7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8},
            {9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13},
            {2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9},
            {12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11},
            {13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10},
            {6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5},
            {10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0},
        };

        static byte[] hash(byte[] input, int outputLength) {
            if (outputLength <= 0 || outputLength > 64) throw new IllegalArgumentException("outputLength");
            long[] h = IV.clone();
            h[0] ^= 0x01010000L ^ outputLength;

            int offset = 0;
            // every full block except the last one
            while (input.length - offset > 128) {
                compress(h, Arrays.copyOfRange(input, offset, offset + 128), offset + 128, false);
                offset += 128;
            }
            byte[] lastBlock = new byte[128];
            System.arraycopy(input, offset, lastBlock, 0, input.length - offset);
            compress(h, lastBlock, input.length, true);

            byte[] out = new byte[64];
            for (int i = 0; i < 8; i++) {
                for (int b = 0; b < 8; b++) out[i * 8 + b] = (byte) (h[i] >>> (8 * b));
            }
            return Arrays.copyOf(out, outputLength);
        }

        private static void compress(long[] h, byte[] block, long counter, boolean last) {
            long[] m = new long[16];
            for (int i = 0; i < 16; i++) {
                long w = 0;
                for (int b = 0; b < 8; b++) w |= (long) (block[i * 8 + b] & 0xff) << (8 * b);
                m[i] = w;
            }
            long[] v = new long[16];
            System.arraycopy(h, 0, v, 0, 8);
            System.arraycopy(IV, 0, v, 8, 8);
            v[12] ^= counter;
            if (last) v[14] = ~v[14];
            for (int round = 0; round < 12; round++) {
                int[] s = SIGMA[round % 10];
                g(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
                g(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
                g(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
                g(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
                g(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
                g(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
                g(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
                g(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
            }
            for (int i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
        }

        private static void g(long[] v, int a, int b, int c, int d, long x, long y) {
            v[a] = v[a] + v[b] + x;
            v[d] = Long.rotateRight(v[d] ^ v[a], 32);
            v[c] = v[c] + v[d];
            v[b] = Long.rotateRight(v[b] ^ v[c], 24);
            v[a] = v[a] + v[b] + y;
            v[d] = Long.rotateRight(v[d] ^ v[a], 16);
            v[c] = v[c] + v[d];
            v[b] = Long.rotateRight(v[b] ^ v[c], 63);
        }
    }
}
