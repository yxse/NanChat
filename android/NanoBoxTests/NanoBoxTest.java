package com.nanchat.app;

// Checks NanoBox.java (Android message previews) against the vectors produced by the JS
// implementation (ios/App/NanoBoxTests/vectors.json, shared with the Swift port).
// Not part of the Gradle build; runs on any JDK 8+, from the repo root:
//   javac -d android/app/build/nanobox-tests android/app/src/main/java/com/nanwallet/app/NanoBox.java android/NanoBoxTests/NanoBoxTest.java
//   java -cp android/app/build/nanobox-tests com.nanchat.app.NanoBoxTest ios/App/NanoBoxTests/vectors.json

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class NanoBoxTest {
    public static void main(String[] args) throws Exception {
        String json = new String(Files.readAllBytes(Paths.get(args[0])), StandardCharsets.UTF_8);
        List<Map<String, String>> vectors = parse(json);
        int failures = 0;
        for (Map<String, String> v : vectors) {
            byte[] curve = NanoBox.curveSecretKey(NanoBox.fromHex(v.get("recipientPrivateKey")));
            if (!NanoBox.toHex(curve).equals(v.get("recipientCurve"))) { System.out.println("curve mismatch"); failures++; }
            String plain = NanoBox.open(v.get("enc"), v.get("sender"), curve);
            if (!v.get("msg").equals(plain)) { System.out.println("decrypt mismatch " + v.get("msg") + " / " + plain); failures++; }
            // tampered ciphertext must fail
            byte[] data = Base64.getDecoder().decode(v.get("enc"));
            data[data.length - 1] ^= 1;
            if (NanoBox.open(Base64.getEncoder().encodeToString(data), v.get("sender"), curve) != null) { System.out.println("tamper accepted"); failures++; }
            // bad checksum address must fail
            String sender = v.get("sender");
            char last = sender.charAt(sender.length() - 1);
            String badAddress = sender.substring(0, sender.length() - 1) + (last == '1' ? '3' : '1');
            if (NanoBox.open(v.get("enc"), badAddress, curve) != null) { System.out.println("bad address accepted"); failures++; }
            // wrong key must fail
            byte[] wrong = curve.clone();
            wrong[0] ^= 8;
            if (NanoBox.open(v.get("enc"), sender, wrong) != null) { System.out.println("wrong key accepted"); failures++; }
        }
        if (NanoBox.open("not base64!", vectors.get(0).get("sender"), new byte[32]) != null) { System.out.println("bad base64 accepted"); failures++; }
        // blake2b known answer: blake2b-512("abc")
        String abc = NanoBox.toHex(NanoBox.Blake2b.hash("abc".getBytes(StandardCharsets.US_ASCII), 64));
        if (!abc.equals("ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923")) { System.out.println("blake2b KAT fail"); failures++; }
        byte[] sevens = new byte[300];
        java.util.Arrays.fill(sevens, (byte) 7);
        // multi-block input (300 bytes), expected value from blakejs
        if (!NanoBox.toHex(NanoBox.Blake2b.hash(sevens, 32)).equals("0191c3eb5a6d2128509033fab49cb00a21416257a4c104cff5ee37d156e04db2")) { System.out.println("blake2b multi-block fail"); failures++; }
        System.out.println(failures == 0 ? "ALL " + vectors.size() + " VECTORS PASS" : "FAILURES: " + failures);
        System.exit(failures == 0 ? 0 : 1);
    }

    // Minimal parser for the vectors file: an array of flat objects with string values.
    private static int pos;
    private static String src;

    private static List<Map<String, String>> parse(String json) {
        src = json;
        pos = 0;
        List<Map<String, String>> out = new ArrayList<>();
        expect('[');
        while (peek() != ']') {
            Map<String, String> obj = new HashMap<>();
            expect('{');
            while (peek() != '}') {
                String key = string();
                expect(':');
                obj.put(key, string());
                if (peek() == ',') pos++;
            }
            expect('}');
            out.add(obj);
            if (peek() == ',') pos++;
        }
        return out;
    }

    private static char peek() {
        while (Character.isWhitespace(src.charAt(pos))) pos++;
        return src.charAt(pos);
    }

    private static void expect(char c) {
        if (peek() != c) throw new IllegalStateException("expected " + c + " at " + pos);
        pos++;
    }

    private static String string() {
        expect('"');
        StringBuilder sb = new StringBuilder();
        while (true) {
            char c = src.charAt(pos++);
            if (c == '"') return sb.toString();
            if (c != '\\') { sb.append(c); continue; }
            char e = src.charAt(pos++);
            switch (e) {
                case 'n': sb.append('\n'); break;
                case 't': sb.append('\t'); break;
                case 'r': sb.append('\r'); break;
                case 'b': sb.append('\b'); break;
                case 'f': sb.append('\f'); break;
                case 'u': sb.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16)); pos += 4; break;
                default: sb.append(e);
            }
        }
    }
}
