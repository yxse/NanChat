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
    const epochAccount = block.subtype === "epoch" ? block.account : null
    if (epochAccount){
      // verrify that the previous block had the same balance and represenntative
      // to prevent malicous epoch block attack
      if (i == 0){
        // not sure if there can be an epoch block as first block
        if (block.balance !== "0"){
          throw new Error("Epoch block balance verification failed for " + block.hash);
        }
      }
      else{
          const previousBlock = history.history[i-1]
          if (block.balance !== previousBlock.balance){
            throw new Error("Epoch block balance verification failed for " + block.hash);
          }
          if (block.representative !== previousBlock.representative){
            throw new Error("Epoch block representative verification failed for " + block.hash);
          }
      }
    }
    block.account = account // correct block account
    const isValidHash = tools.verifyBlockHash(block, block.hash);
    if (!isValidHash) {
      throw new Error("Block hash verification failed for " + block.hash);
    }
    if (i < history.history.length-1 && history.history[i+1].previous !== block.hash){
      // verify that each block of history is correctly linked together 
      // ensure that no other network block could be inserted
      throw new Error("Block hash not linked, verification failed for " + block.hash);
    }
    verifyBlock(account, block, block.subtype, block.hash, accountPublicKey, epochAccount)
    if (blocks[`verified-${block.hash}`] != null && blocks[`verified-${block.hash}`] !== ticker){ 
      throw new Error("Block already verified on another network: " + blocks[`verified-${block.hash}`] + " " + block.hash);
    }
    // ensure previous block is verified too
    // if open block (previous=000..) no need to check
    const keyPrevious = `verified-${block.previous}`
    const isOpen = block.previous === "0".repeat(64) && i == 0
    if (!isOpen && 
      verifiedHashes[keyPrevious] == null // if not in memory
      && blocks[keyPrevious] == null // if not already saved
    ){
      debugger
      throw new Error("Previous block not yet verified: " + block.previous);
    }
    if (!isOpen && blocks[keyPrevious] !== ticker && verifiedHashes[keyPrevious] !== ticker){
      throw new Error("Previous block already verified on another network: " + blocks[keyPrevious] + " " + block.previous );
    }
    verifiedHashes[`verified-${block.hash.trim()}`] = ticker
  }
  const lastVerifiedHash = history.history[history.history.length -1].hash.trim()
  console.timeEnd("[worker] verifyHistory " + account + " " + history.history.length + " blocks");
  // save last block data 
  return {verifiedHashes, lastVerifiedHash}
}

const verifyBlock = (account, blockContents, subtype, hash, accountPublicKey, epochAccount) => {
    // https://docs.nano.org/releases/network-upgrades/#epoch-blocks

    const upgrades = {
      "v1": {
        signer: "nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3",
        link: "65706F636820763120626C6F636B000000000000000000000000000000000000"
      },
      "v2": {
        signer: "nano_3qb6o6i1tkzr6jwr5s7eehfxwg9x6eemitdinbpi7u8bjjwsgqfj4wzser3x",
        link: "65706F636820763220626C6F636B000000000000000000000000000000000000"
      }
    }
    if (subtype === "epoch"){
      let upgradeVersion = null
      Object.keys(upgrades).forEach(v => {
        if (blockContents.link === upgrades[v].link){
          upgradeVersion = v
        }
      })
      if (upgradeVersion === null){
        throw new Error("Frontier epoch block link verification failed");
      }

      if (epochAccount !== upgrades[upgradeVersion].signer){
        throw new Error("Frontier epoch block account verification failed");
      }
      const epochSignerAccount = upgrades[upgradeVersion].signer
      const publicKey = tools.addressToPublicKey(epochSignerAccount)
      blockContents.account = account
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