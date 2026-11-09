// Generates vectors.json with multi-nano-web (the JS implementation used by the app).
// Run from the repo root: node ios/App/NanoBoxTests/generate-vectors.cjs > ios/App/NanoBoxTests/vectors.json
const { wallet, box } = require('multi-nano-web');
const Ed25519 = require('multi-nano-web/dist/lib/ed25519').default;
const crypto = require('crypto');
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;

const msgs = ["hello", " ", "héllo 👋 世界", "x".repeat(15), "y".repeat(16), "z".repeat(17), "long ".repeat(300)];
const out = msgs.map((msg, i) => {
  const sender = wallet.generateLegacy(crypto.randomBytes(32).toString('hex')).accounts[0];
  const recipient = (i % 2
    ? wallet.generate(crypto.randomBytes(32).toString('hex'))
    : wallet.generateLegacy(crypto.randomBytes(32).toString('hex'))).accounts[0];
  const enc = box.encrypt(msg, recipient.address, sender.privateKey);
  if (box.decrypt(enc, sender.address, recipient.privateKey) !== msg) throw new Error('JS roundtrip failed');
  const curve = new Ed25519().convertKeys({ privateKey: recipient.privateKey, publicKey: recipient.publicKey });
  return {
    enc,
    sender: i === 3 ? sender.address.replace('nano_', 'xrb_') : sender.address,
    recipientPrivateKey: recipient.privateKey,
    recipientCurve: curve.privateKey,
    msg,
  };
});
console.log(JSON.stringify(out, null, 1));
