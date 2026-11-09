// Checks NanoBox.swift (notification service extension) against vectors produced by the
// JS implementation. Not part of the Xcode project; runs anywhere Swift is installed:
//   cd ios/App && swiftc NanChatNotificationService/NanoBox.swift NanoBoxTests/main.swift -o /tmp/nanobox-tests \
//     && /tmp/nanobox-tests NanoBoxTests/vectors.json
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let vectors = try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [[String: String]]
var failures = 0
for v in vectors {
    let curve = NanoBox.curveSecretKey(fromNanoPrivateKey: NanoBox.bytes(fromHex: v["recipientPrivateKey"]!)!)
    if curve != NanoBox.bytes(fromHex: v["recipientCurve"]!)! { print("curve mismatch"); failures += 1 }
    let plain = NanoBox.open(v["enc"]!, senderAddress: v["sender"]!, recipientCurveSecretKey: curve)
    if plain != v["msg"]! { print("decrypt mismatch", v["msg"]!.prefix(20), plain as Any); failures += 1 }
    // tampered ciphertext must fail
    var data = [UInt8](Data(base64Encoded: v["enc"]!)!); data[data.count - 1] ^= 1
    if NanoBox.open(Data(data).base64EncodedString(), senderAddress: v["sender"]!, recipientCurveSecretKey: curve) != nil { print("tamper accepted"); failures += 1 }
    // bad checksum address must fail
    var addr = Array(v["sender"]!); addr[addr.count - 1] = addr[addr.count - 1] == "1" ? "3" : "1"
    if NanoBox.open(v["enc"]!, senderAddress: String(addr), recipientCurveSecretKey: curve) != nil { print("bad address accepted"); failures += 1 }
}
// blake2b known answer: blake2b-512("abc")
let abc = Blake2b.hash(Array("abc".utf8), outputLength: 64).map { String(format: "%02x", $0) }.joined()
if abc != "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923" { print("blake2b KAT fail"); failures += 1 }
let big = Blake2b.hash([UInt8](repeating: 7, count: 300), outputLength: 32).map { String(format: "%02x", $0) }.joined()
// multi-block input (300 bytes), expected value from blakejs
if big != "0191c3eb5a6d2128509033fab49cb00a21416257a4c104cff5ee37d156e04db2" { print("blake2b multi-block fail"); failures += 1 }
print(failures == 0 ? "ALL \(vectors.count) VECTORS PASS" : "FAILURES: \(failures)")
exit(failures == 0 ? 0 : 1)
