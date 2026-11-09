import Foundation

// Native port of `box.decrypt` from multi-nano-web, so the notification service
// extension can decrypt message previews without the WebView.
//
// Format (same as the JS side): base64(nonce[24] || mac[16] || ciphertext), sealed with
// NaCl crypto_box (X25519 + XSalsa20-Poly1305). The sender's Nano (ed25519) public key is
// converted to Curve25519 the standard way. The recipient's Curve25519 secret key is
// computed by the app (blake2b instead of sha512, see `NotificationKeys.ts`) and stored in
// the shared keychain: the extension never sees a key able to sign blocks.
//
// Pure Swift on purpose (no libsodium dependency). Ported from TweetNaCl (public domain)
// and poly1305-donna; verified against vectors produced by multi-nano-web.
enum NanoBox {
    static let nonceLength = 24

    /// Decrypts a message sent by `senderAddress` to the owner of `recipientCurveSecretKey`.
    /// Returns nil when anything is invalid (bad address, bad base64, MAC mismatch, not UTF-8).
    static func open(_ encrypted: String, senderAddress: String, recipientCurveSecretKey sk: [UInt8]) -> String? {
        guard sk.count == 32,
              let edPublicKey = NanoAddress.publicKey(from: senderAddress),
              let curvePublicKey = Curve25519.convertEd25519PublicKey(edPublicKey),
              let data = Data(base64Encoded: encrypted),
              data.count >= nonceLength + Poly1305.tagLength else { return nil }
        let bytes = [UInt8](data)
        let nonce = Array(bytes[0..<nonceLength])
        let boxed = Array(bytes[nonceLength...])
        let shared = Curve25519.scalarMult(sk, curvePublicKey)
        let key = Salsa20.hsalsa20(input: [UInt8](repeating: 0, count: 16), key: shared)
        guard let plain = SecretBox.open(boxed, nonce: nonce, key: key) else { return nil }
        return String(bytes: plain, encoding: .utf8)
    }

    /// Curve25519 secret key used by multi-nano-web for a Nano private key: blake2b-512, clamped.
    static func curveSecretKey(fromNanoPrivateKey privateKey: [UInt8]) -> [UInt8] {
        var d = Blake2b.hash(privateKey, outputLength: 64)
        d[0] &= 248
        d[31] &= 127
        d[31] |= 64
        return Array(d[0..<32])
    }

    static func bytes(fromHex hex: String) -> [UInt8]? {
        let chars = Array(hex.utf8)
        guard chars.count % 2 == 0 else { return nil }
        var out = [UInt8]()
        out.reserveCapacity(chars.count / 2)
        var i = 0
        while i < chars.count {
            guard let hi = hexValue(chars[i]), let lo = hexValue(chars[i + 1]) else { return nil }
            out.append(hi << 4 | lo)
            i += 2
        }
        return out
    }

    private static func hexValue(_ c: UInt8) -> UInt8? {
        switch c {
        case 48...57: return c - 48
        case 97...102: return c - 87
        case 65...70: return c - 55
        default: return nil
        }
    }
}

// MARK: - Nano address

enum NanoAddress {
    private static let alphabet = Array("13456789abcdefghijkmnopqrstuwxyz".utf8)

    /// Public key of a `nano_` / `xrb_` (or other ticker prefixed) address, checksum verified.
    static func publicKey(from address: String) -> [UInt8]? {
        guard let underscore = address.lastIndex(of: "_") else { return nil }
        let encoded = Array(address[address.index(after: underscore)...].utf8)
        guard encoded.count == 60 else { return nil }
        guard let keyBits = decode(Array(encoded[0..<52])), let checksumBits = decode(Array(encoded[52..<60])) else { return nil }
        // 52 chars = 260 bits: 4 padding bits then the 256 bit key
        let publicKey = bytes(fromBits: Array(keyBits[4...]))
        let checksum = bytes(fromBits: checksumBits)
        let expected = Array(Blake2b.hash(publicKey, outputLength: 5).reversed())
        guard checksum == expected else { return nil }
        return publicKey
    }

    private static func decode(_ chars: [UInt8]) -> [UInt8]? {
        var bits = [UInt8]()
        bits.reserveCapacity(chars.count * 5)
        for c in chars {
            guard let v = alphabet.firstIndex(of: c) else { return nil }
            for shift in stride(from: 4, through: 0, by: -1) {
                bits.append(UInt8((v >> shift) & 1))
            }
        }
        return bits
    }

    private static func bytes(fromBits bits: [UInt8]) -> [UInt8] {
        var out = [UInt8](repeating: 0, count: bits.count / 8)
        for (i, bit) in bits.enumerated() where bit == 1 {
            out[i / 8] |= 0x80 >> UInt8(i % 8)
        }
        return out
    }
}

// MARK: - Curve25519 (TweetNaCl field arithmetic, 16 x 16-bit limbs)

enum Curve25519 {
    typealias GF = [Int64]

    private static func gf(_ initial: [Int64] = []) -> GF {
        var g = GF(repeating: 0, count: 16)
        for (i, v) in initial.enumerated() { g[i] = v }
        return g
    }

    private static let gf1 = gf([1])
    private static let c121665 = gf([0xDB41, 1])

    private static func car(_ o: inout GF) {
        for i in 0..<16 {
            o[i] += 1 << 16
            let c = o[i] >> 16
            if i < 15 {
                o[i + 1] += c - 1
            } else {
                o[0] += 38 * (c - 1)
            }
            o[i] -= c << 16
        }
    }

    private static func sel(_ p: inout GF, _ q: inout GF, _ b: Int64) {
        let c = ~(b - 1)
        for i in 0..<16 {
            let t = c & (p[i] ^ q[i])
            p[i] ^= t
            q[i] ^= t
        }
    }

    private static func pack(_ n: GF) -> [UInt8] {
        var t = n
        var m = gf()
        car(&t)
        car(&t)
        car(&t)
        for _ in 0..<2 {
            m[0] = t[0] - 0xffed
            for i in 1..<15 {
                m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1)
                m[i - 1] &= 0xffff
            }
            m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1)
            let b = (m[15] >> 16) & 1
            m[14] &= 0xffff
            sel(&t, &m, 1 - b)
        }
        var o = [UInt8](repeating: 0, count: 32)
        for i in 0..<16 {
            o[2 * i] = UInt8(truncatingIfNeeded: t[i] & 0xff)
            o[2 * i + 1] = UInt8(truncatingIfNeeded: t[i] >> 8)
        }
        return o
    }

    private static func unpack(_ n: [UInt8]) -> GF {
        var o = gf()
        for i in 0..<16 {
            o[i] = Int64(n[2 * i]) + (Int64(n[2 * i + 1]) << 8)
        }
        o[15] &= 0x7fff
        return o
    }

    private static func add(_ a: GF, _ b: GF) -> GF {
        var o = gf()
        for i in 0..<16 { o[i] = a[i] + b[i] }
        return o
    }

    private static func sub(_ a: GF, _ b: GF) -> GF {
        var o = gf()
        for i in 0..<16 { o[i] = a[i] - b[i] }
        return o
    }

    private static func mul(_ a: GF, _ b: GF) -> GF {
        var t = [Int64](repeating: 0, count: 31)
        for i in 0..<16 {
            for j in 0..<16 {
                t[i + j] += a[i] * b[j]
            }
        }
        for i in 0..<15 {
            t[i] += 38 * t[i + 16]
        }
        var o = Array(t[0..<16])
        car(&o)
        car(&o)
        return o
    }

    private static func square(_ a: GF) -> GF { mul(a, a) }

    private static func invert(_ i: GF) -> GF {
        var c = i
        for a in stride(from: 253, through: 0, by: -1) {
            c = square(c)
            if a != 2 && a != 4 { c = mul(c, i) }
        }
        return c
    }

    /// X25519: n * p (both 32 bytes).
    static func scalarMult(_ n: [UInt8], _ p: [UInt8]) -> [UInt8] {
        var z = n
        z[31] = (n[31] & 127) | 64
        z[0] &= 248
        let x = unpack(p)
        var a = gf([1]), b = x, c = gf(), d = gf([1])
        for i in stride(from: 254, through: 0, by: -1) {
            let r = Int64((z[i >> 3] >> UInt8(i & 7)) & 1)
            sel(&a, &b, r)
            sel(&c, &d, r)
            var e = add(a, c)
            a = sub(a, c)
            c = add(b, d)
            b = sub(b, d)
            d = square(e)
            let f = square(a)
            a = mul(c, a)
            c = mul(b, e)
            e = add(a, c)
            a = sub(a, c)
            b = square(a)
            c = sub(d, f)
            a = mul(c, c121665)
            a = add(a, d)
            c = mul(c, a)
            a = mul(d, f)
            d = mul(b, x)
            b = square(e)
            sel(&a, &b, r)
            sel(&c, &d, r)
        }
        return pack(mul(a, invert(c)))
    }

    /// Birational map from the ed25519 y coordinate: u = (1 + y) / (1 - y).
    static func convertEd25519PublicKey(_ pk: [UInt8]) -> [UInt8]? {
        guard pk.count == 32 else { return nil }
        let y = unpack(pk)
        let a = add(gf1, y)
        let b = invert(sub(gf1, y))
        return pack(mul(a, b))
    }
}

// MARK: - Salsa20 / XSalsa20

enum Salsa20 {
    private static let sigma = Array("expand 32-byte k".utf8)

    private static func load32(_ b: [UInt8], _ o: Int) -> UInt32 {
        UInt32(b[o]) | UInt32(b[o + 1]) << 8 | UInt32(b[o + 2]) << 16 | UInt32(b[o + 3]) << 24
    }

    private static func rotl(_ v: UInt32, _ n: UInt32) -> UInt32 { (v << n) | (v >> (32 - n)) }

    private static func core(input: [UInt8], key: [UInt8], hsalsa: Bool) -> [UInt8] {
        var j = [UInt32](repeating: 0, count: 16)
        j[0] = load32(sigma, 0)
        j[5] = load32(sigma, 4)
        j[10] = load32(sigma, 8)
        j[15] = load32(sigma, 12)
        for i in 0..<4 {
            j[1 + i] = load32(key, 4 * i)
            j[11 + i] = load32(key, 16 + 4 * i)
            j[6 + i] = load32(input, 4 * i)
        }
        var x = j
        func qr(_ a: Int, _ b: Int, _ c: Int, _ d: Int) {
            x[b] ^= rotl(x[a] &+ x[d], 7)
            x[c] ^= rotl(x[b] &+ x[a], 9)
            x[d] ^= rotl(x[c] &+ x[b], 13)
            x[a] ^= rotl(x[d] &+ x[c], 18)
        }
        for _ in 0..<10 {
            qr(0, 4, 8, 12); qr(5, 9, 13, 1); qr(10, 14, 2, 6); qr(15, 3, 7, 11)
            qr(0, 1, 2, 3); qr(5, 6, 7, 4); qr(10, 11, 8, 9); qr(15, 12, 13, 14)
        }
        let words: [UInt32]
        if hsalsa {
            words = [x[0], x[5], x[10], x[15], x[6], x[7], x[8], x[9]]
        } else {
            words = (0..<16).map { x[$0] &+ j[$0] }
        }
        var out = [UInt8]()
        out.reserveCapacity(words.count * 4)
        for w in words {
            out += [UInt8(truncatingIfNeeded: w), UInt8(truncatingIfNeeded: w >> 8),
                    UInt8(truncatingIfNeeded: w >> 16), UInt8(truncatingIfNeeded: w >> 24)]
        }
        return out
    }

    static func hsalsa20(input: [UInt8], key: [UInt8]) -> [UInt8] {
        core(input: input, key: key, hsalsa: true)
    }

    /// XSalsa20 keystream XOR (24 byte nonce).
    static func xsalsa20Xor(_ message: [UInt8], nonce: [UInt8], key: [UInt8]) -> [UInt8] {
        let subKey = hsalsa20(input: Array(nonce[0..<16]), key: key)
        var block = Array(nonce[16..<24]) + [UInt8](repeating: 0, count: 8)
        var out = [UInt8](repeating: 0, count: message.count)
        var offset = 0
        while offset < message.count {
            let stream = core(input: block, key: subKey, hsalsa: false)
            let n = min(64, message.count - offset)
            for i in 0..<n { out[offset + i] = message[offset + i] ^ stream[i] }
            offset += n
            // increment the 64-bit little-endian block counter
            var carry: UInt16 = 1
            for i in 8..<16 {
                carry += UInt16(block[i])
                block[i] = UInt8(truncatingIfNeeded: carry)
                carry >>= 8
            }
        }
        return out
    }
}

// MARK: - Poly1305 (poly1305-donna, 26-bit limbs)

enum Poly1305 {
    static let tagLength = 16

    private static func le32(_ b: [UInt8], _ o: Int) -> UInt32 {
        UInt32(b[o]) | UInt32(b[o + 1]) << 8 | UInt32(b[o + 2]) << 16 | UInt32(b[o + 3]) << 24
    }

    static func authenticate(_ message: [UInt8], key: [UInt8]) -> [UInt8] {
        let r0 = UInt64(le32(key, 0) & 0x3ffffff)
        let r1 = UInt64((le32(key, 3) >> 2) & 0x3ffff03)
        let r2 = UInt64((le32(key, 6) >> 4) & 0x3ffc0ff)
        let r3 = UInt64((le32(key, 9) >> 6) & 0x3f03fff)
        let r4 = UInt64((le32(key, 12) >> 8) & 0x00fffff)
        let s1 = r1 * 5, s2 = r2 * 5, s3 = r3 * 5, s4 = r4 * 5
        var h0: UInt32 = 0, h1: UInt32 = 0, h2: UInt32 = 0, h3: UInt32 = 0, h4: UInt32 = 0
        let mask: UInt32 = 0x3ffffff

        var offset = 0
        while offset < message.count {
            var block = [UInt8](repeating: 0, count: 16)
            let n = min(16, message.count - offset)
            for i in 0..<n { block[i] = message[offset + i] }
            var hibit: UInt32 = 1 << 24
            if n < 16 {
                block[n] = 1
                hibit = 0
            }
            offset += n

            h0 &+= le32(block, 0) & mask
            h1 &+= (le32(block, 3) >> 2) & mask
            h2 &+= (le32(block, 6) >> 4) & mask
            h3 &+= (le32(block, 9) >> 6) & mask
            h4 &+= (le32(block, 12) >> 8) | hibit

            let H0 = UInt64(h0), H1 = UInt64(h1), H2 = UInt64(h2), H3 = UInt64(h3), H4 = UInt64(h4)
            let d0 = H0 * r0 + H1 * s4 + H2 * s3 + H3 * s2 + H4 * s1
            var d1 = H0 * r1 + H1 * r0 + H2 * s4 + H3 * s3 + H4 * s2
            var d2 = H0 * r2 + H1 * r1 + H2 * r0 + H3 * s4 + H4 * s3
            var d3 = H0 * r3 + H1 * r2 + H2 * r1 + H3 * r0 + H4 * s4
            var d4 = H0 * r4 + H1 * r3 + H2 * r2 + H3 * r1 + H4 * r0

            var c = d0 >> 26; h0 = UInt32(d0 & UInt64(mask))
            d1 += c; c = d1 >> 26; h1 = UInt32(d1 & UInt64(mask))
            d2 += c; c = d2 >> 26; h2 = UInt32(d2 & UInt64(mask))
            d3 += c; c = d3 >> 26; h3 = UInt32(d3 & UInt64(mask))
            d4 += c; c = d4 >> 26; h4 = UInt32(d4 & UInt64(mask))
            h0 &+= UInt32(c) &* 5
            let c2 = h0 >> 26; h0 &= mask
            h1 &+= c2
        }

        // full carry
        var c = h1 >> 26; h1 &= mask
        h2 &+= c; c = h2 >> 26; h2 &= mask
        h3 &+= c; c = h3 >> 26; h3 &= mask
        h4 &+= c; c = h4 >> 26; h4 &= mask
        h0 &+= c &* 5; c = h0 >> 26; h0 &= mask
        h1 &+= c

        // compute h - p and select it if non negative
        var g0 = h0 &+ 5; c = g0 >> 26; g0 &= mask
        var g1 = h1 &+ c; c = g1 >> 26; g1 &= mask
        var g2 = h2 &+ c; c = g2 >> 26; g2 &= mask
        var g3 = h3 &+ c; c = g3 >> 26; g3 &= mask
        var g4 = h4 &+ c &- (1 << 26)

        var selectMask = (g4 >> 31) &- 1
        g0 &= selectMask; g1 &= selectMask; g2 &= selectMask; g3 &= selectMask; g4 &= selectMask
        selectMask = ~selectMask
        h0 = (h0 & selectMask) | g0
        h1 = (h1 & selectMask) | g1
        h2 = (h2 & selectMask) | g2
        h3 = (h3 & selectMask) | g3
        h4 = (h4 & selectMask) | g4

        // h % 2^128 + s
        let w0 = h0 | (h1 << 26)
        let w1 = (h1 >> 6) | (h2 << 20)
        let w2 = (h2 >> 12) | (h3 << 14)
        let w3 = (h3 >> 18) | (h4 << 8)
        var f = UInt64(w0) + UInt64(le32(key, 16))
        let t0 = UInt32(truncatingIfNeeded: f)
        f = UInt64(w1) + UInt64(le32(key, 20)) + (f >> 32)
        let t1 = UInt32(truncatingIfNeeded: f)
        f = UInt64(w2) + UInt64(le32(key, 24)) + (f >> 32)
        let t2 = UInt32(truncatingIfNeeded: f)
        f = UInt64(w3) + UInt64(le32(key, 28)) + (f >> 32)
        let t3 = UInt32(truncatingIfNeeded: f)

        var tag = [UInt8]()
        tag.reserveCapacity(16)
        for w in [t0, t1, t2, t3] {
            tag += [UInt8(truncatingIfNeeded: w), UInt8(truncatingIfNeeded: w >> 8),
                    UInt8(truncatingIfNeeded: w >> 16), UInt8(truncatingIfNeeded: w >> 24)]
        }
        return tag
    }
}

// MARK: - SecretBox (XSalsa20-Poly1305, NaCl framing without the zero padding)

enum SecretBox {
    /// `boxed` is mac[16] || ciphertext, as returned by TweetNaCl `secretbox`.
    static func open(_ boxed: [UInt8], nonce: [UInt8], key: [UInt8]) -> [UInt8]? {
        guard boxed.count >= Poly1305.tagLength, nonce.count == 24, key.count == 32 else { return nil }
        let tag = Array(boxed[0..<Poly1305.tagLength])
        let ciphertext = Array(boxed[Poly1305.tagLength...])
        // first 32 bytes of keystream are the one-time Poly1305 key, the message follows
        let stream = Salsa20.xsalsa20Xor([UInt8](repeating: 0, count: 32 + ciphertext.count), nonce: nonce, key: key)
        let polyKey = Array(stream[0..<32])
        let expected = Poly1305.authenticate(ciphertext, key: polyKey)
        var diff: UInt8 = 0
        for i in 0..<Poly1305.tagLength { diff |= expected[i] ^ tag[i] }
        guard diff == 0 else { return nil }
        var plain = [UInt8](repeating: 0, count: ciphertext.count)
        for i in 0..<ciphertext.count { plain[i] = ciphertext[i] ^ stream[32 + i] }
        return plain
    }
}

// MARK: - BLAKE2b (unkeyed)

enum Blake2b {
    private static let iv: [UInt64] = [
        0x6a09e667f3bcc908, 0xbb67ae8584caa73b, 0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1,
        0x510e527fade682d1, 0x9b05688c2b3e6c1f, 0x1f83d9abfb41bd6b, 0x5be0cd19137e2179,
    ]

    private static let sigma: [[Int]] = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
        [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
        [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
        [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
        [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
        [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
        [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
        [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
        [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
    ]

    private static func rotr(_ x: UInt64, _ n: UInt64) -> UInt64 { (x >> n) | (x << (64 - n)) }

    static func hash(_ input: [UInt8], outputLength: Int) -> [UInt8] {
        precondition(outputLength > 0 && outputLength <= 64)
        var h = iv
        h[0] ^= 0x01010000 ^ UInt64(outputLength)

        func compress(_ block: [UInt8], counter: UInt64, last: Bool) {
            var m = [UInt64](repeating: 0, count: 16)
            for i in 0..<16 {
                var w: UInt64 = 0
                for b in 0..<8 { w |= UInt64(block[i * 8 + b]) << UInt64(8 * b) }
                m[i] = w
            }
            var v = h + iv
            v[12] ^= counter
            if last { v[14] = ~v[14] }
            func g(_ a: Int, _ b: Int, _ c: Int, _ d: Int, _ x: UInt64, _ y: UInt64) {
                v[a] = v[a] &+ v[b] &+ x
                v[d] = rotr(v[d] ^ v[a], 32)
                v[c] = v[c] &+ v[d]
                v[b] = rotr(v[b] ^ v[c], 24)
                v[a] = v[a] &+ v[b] &+ y
                v[d] = rotr(v[d] ^ v[a], 16)
                v[c] = v[c] &+ v[d]
                v[b] = rotr(v[b] ^ v[c], 63)
            }
            for round in 0..<12 {
                let s = sigma[round % 10]
                g(0, 4, 8, 12, m[s[0]], m[s[1]])
                g(1, 5, 9, 13, m[s[2]], m[s[3]])
                g(2, 6, 10, 14, m[s[4]], m[s[5]])
                g(3, 7, 11, 15, m[s[6]], m[s[7]])
                g(0, 5, 10, 15, m[s[8]], m[s[9]])
                g(1, 6, 11, 12, m[s[10]], m[s[11]])
                g(2, 7, 8, 13, m[s[12]], m[s[13]])
                g(3, 4, 9, 14, m[s[14]], m[s[15]])
            }
            for i in 0..<8 { h[i] ^= v[i] ^ v[i + 8] }
        }

        var offset = 0
        // every full block except the last one
        while input.count - offset > 128 {
            compress(Array(input[offset..<offset + 128]), counter: UInt64(offset + 128), last: false)
            offset += 128
        }
        var lastBlock = [UInt8](repeating: 0, count: 128)
        for i in 0..<(input.count - offset) { lastBlock[i] = input[offset + i] }
        compress(lastBlock, counter: UInt64(input.count), last: true)

        var out = [UInt8]()
        out.reserveCapacity(64)
        for word in h {
            for b in 0..<8 { out.append(UInt8(truncatingIfNeeded: word >> UInt64(8 * b))) }
        }
        return Array(out[0..<outputLength])
    }
}
