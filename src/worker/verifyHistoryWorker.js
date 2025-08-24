import { tools } from 'multi-nano-web';

self.onmessage = async function(e) {

    console.log("[workred] received", e.data, e.data.history)
      try {
        const {verifiedHashes, lastVerifiedHash} = verifyHistoryIntegrity(e.data.account, e.data.history, e.data.blocks, e.data.ticker, e.data.accountPublicKey)
        self.postMessage({ 
          status: 'success', 
          verifiedHashes: verifiedHashes,
          lastVerifiedHash: lastVerifiedHash
        });
      } catch (error) {
        self.postMessage({ 
          status: 'error', 
          error: error.message
        });
      }
};

const verifyHistoryIntegrity = (account, history, blocks, ticker, accountPublicKey) => {
  const verifiedHashes = {}
  console.time("[worker] verifyHistory " + account + " " + history.history.length + " blocks");
  for (let i = 0; i < history.history.length; i++) {
    const block = history.history[i];
    block.account = block.subtype === "epoch" ? block.account : account // correct block account
    const isValidHash = tools.verifyBlockHash(block, block.hash);
    if (!isValidHash) {
      throw new Error("Block hash verification failed for " + block.hash);
    }
    verifyBlock(account, block, block.subtype, block.hash, accountPublicKey)
    if (blocks[`verified-${block.hash}`] != null && blocks[`verified-${block.hash}`] !== ticker){ 
      throw new Error("Block already verified on another network: " + blocks[`verified-${block.hash}`] + " " + block.hash);
    }
    // ensure previous block is verified too
    // if open block (previous=000..) no need to check
    const keyPrevious = `verified-${block.previous}`
    if (block.previous !== "0".repeat(64) && 
      verifiedHashes[keyPrevious] == null // if not in memory
      && blocks[keyPrevious] == null // if not already saved
    ){
      debugger
      throw new Error("Previous block not yet verified: " + block.previous);
    }
    if (block.previous !== "0".repeat(64) && blocks[keyPrevious] !== ticker && verifiedHashes[keyPrevious] !== ticker){
      throw new Error("Previous block already verified on another network: " + blocks[keyPrevious] + " " + block.previous );
    }
    verifiedHashes[`verified-${block.hash.trim()}`] = ticker
  }
  const lastVerifiedHash = history.history[history.history.length -1].hash.trim()
  console.timeEnd("[worker] verifyHistory " + account + " " + history.history.length + " blocks");
  // save last block data 
  return {verifiedHashes, lastVerifiedHash}
}

const verifyBlock = (account, blockContents, subtype, hash, accountPublicKey) => {
    // https://docs.nano.org/releases/network-upgrades/#epoch-blocks
    const epochV2SignerAccount = 'nano_3qb6o6i1tkzr6jwr5s7eehfxwg9x6eemitdinbpi7u8bjjwsgqfj4wzser3x';
    if (subtype === "epoch"){
      if (blockContents.account !== epochV2SignerAccount){
          throw new Error("Frontier epoch block account verification failed");
      }
      const publicKey = tools.addressToPublicKey(epochV2SignerAccount);
      const valid = tools.verifyBlock(publicKey, blockContents);
      if (valid !== true) {
        throw new Error("Epoch block signature verification failed: " + hash)
      }
    }
    else{
      const valid = tools.verifyBlock(accountPublicKey, blockContents);
      if (valid !== true) {
        throw new Error("Block signature verification failed: " + hash)
      }
    }
    return true
  }