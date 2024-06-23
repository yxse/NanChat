import { wallet as walletLib, block } from "multi-nano-web";
import RPC from "./rpc";
import { BigNumber } from "bignumber.js";
import AsyncLock from "async-lock";
import { Modal, Toast } from "antd-mobile";
import { mutate } from "swr";
import { rawToMega } from "./accounts";
import { setRepresentative } from "../components/Settings";

var lock = new AsyncLock();

export class Wallet {
  /**
   * Simple wallet for Nano with in memory external key management
   * Suppport custom prefix & decimal to allows custom nano network (eg: banano, dogenano, etc)
   *
   * @param {String} RPC_URL Node RPC URL
   * @param {String} WORK_URL Work server URL for work_generate
   * @param {String} WS_URL Node Websocket URL
   * @param {String} [seed] Default seed, use create to create new seed
   * @param {String} defaultRep Default representative for openBlock
   * @param {Boolean} [autoReceive=true] Auto receive when receive websocket confirmation
   * @param {String} [prefix=nano] Prefix for addresses, eg: nano, ban, xdg
   * @param {Number} [decimal=30] Number of decimal, eg: 1 nano = 10^30 raw, 1 banano = 10^29 raw, 1 xdg = 10^24 raw
   * @param {Object} [customHeaders={}] Custom headers for RPC requests
   * @param {Boolean} [wsSubAll=true] If true, subscribe to all websocket confirmation
   *
   */
  constructor({
    RPC_URL,
    WORK_URL,
    WS_URL,
    seed,
    defaultRep,
    autoReceive = true,
    prefix = "nano_",
    decimal = 30,
    wsSubAll = false,
    ticker = "XNO",
  }) {
    this.mapAccounts = new Map();
    this.lastIndex = 0;
    this.seed = seed;
    this.prefix = prefix;
    this.decimal = decimal;
    this.defaultRep = defaultRep; // used for openBlock only
    this.ticker = ticker;
    this.rpc = new RPC(ticker);
    this.websocket;
    this.cacheSendHash = new Map();
    if (WS_URL !== undefined) {
      this.websocket = new WebSocket(WS_URL);
      this.websocket.onerror = (err) => {
        console.log("Cannot connect to websocket");
        console.log(err.message);
      };
      this.websocket.onopen = () => {
        console.log("Connected to websocket");
        if (wsSubAll) {
          this.subscribeConfirmation();
        } else if (this.mapAccounts.size > 0) {
          this.subscribeConfirmation(Array.from(this.mapAccounts.keys()));
        }
      };
      this.websocket.onmessage = async (msg) => {
        let data_json = JSON.parse(msg.data);
        this.wsOnMessage(data_json);
        if (autoReceive) {
          this.wsAutoReceiveSend(data_json);
        }
      };
    }
  }

  /**
   * subscribe to all websocketconfirmation or to a list of accounts if provided
   * @param {[string]} accounts List of accounts to subscribe to confirmation
   */
  subscribeConfirmation = (accounts) => {
    const confirmation_subscription = {
      action: "subscribe",
      topic: "confirmation",
      ack: true,
    };
    if (accounts !== undefined) {
      confirmation_subscription["options"] = {
        accounts: accounts,
      };
    }
    this.websocket.send(JSON.stringify(confirmation_subscription));
  };

  /**
   * @typedef {Object} Wallet
   * @property {string} seed - Wallet seed
   * @property {number} address - Wallet first address
   */

  /**
   * Create a new in memory wallet from random entropy
   * Make sure to save the seed returned!
   * @returns {Wallet}
   *
   */
  createWallet = () => {
    let wallet = walletLib.generateLegacy();
    this.seed = wallet.seed;
    this.createAccounts(1);
    return {
      seed: wallet.seed,
      address: wallet.accounts[0].address.replace("nano_", this.prefix),
    };
  };

  /**
   * create new in memory accounts derived from the seed
   * @param {[string]} nbAccounts Number of accounts to create
   * @returns {[string]} Array of addresses
   */
  createAccounts = (nbAccounts) => {
    if (this.seed === undefined) {
      throw new Error(
        "No seed defined. Create a wallet first with createWallet() or use a seed in the wallet constructor",
      );
    }
    let accounts = []
    if (global.ledger) {
      accounts = [{
        address: global.account,
      },
      ]
    }
    else {
      accounts = walletLib.accounts(
        this.seed,
        this.lastIndex,
        this.lastIndex + nbAccounts,
      );
    }
    this.lastIndex += nbAccounts;
    accounts.forEach((account) => {
      account["address"] = account.address.replace("nano_", this.prefix);
      this.mapAccounts.set(account.address, account);
    });
    let addresses = accounts.map((account) => account.address);
    console.log("Created accounts: " + addresses);
    if (
      this.websocket !== undefined &&
      this.websocket.readyState === WebSocket.OPEN
    ) {
      this.subscribeConfirmation(addresses);
    } else {
      console.log("Websocket not yet connected, retrying in 0.5s");
      setTimeout(() => {
        // this.subscribeConfirmation(addresses);
      }, 500);
    }
    return addresses;
  };

  /**
   * Send amount from source to destination.
   * source must be in the wallet
   * @param {string} source
   * @param {string} destination
   * @param {string} amount Amount in RAW
   * @returns {Object} RPC response, eg: {"hash": "ABCABCABC"}
   */
  send = async ({ source, destination, amount }) => {
    // we put a lock on source to allows concurrent send to be executed synchronously
    // otherwise concurrent sends would create fork or bad blocks
    return lock.acquire(source, async () => {
      const account_info = await this.rpc.account_info(source);
      if (account_info.error !== undefined) {
        return { error: account_info.error };
      }
      const data = {
        walletBalanceRaw: account_info.balance,
        fromAddress: source,
        toAddress: destination,
        representativeAddress: account_info.representative,
        frontier: account_info.frontier, // Previous block
        amountRaw: amount, // The amount to send in RAW
        work: await this.rpc.work_generate(account_info.frontier),
      };
      let signedBlock = null
      if (global.ledger) {
        //https://www.roosmaa.net/hw-app-nano/#blockdata
        const newBalance = new BigNumber(data.walletBalanceRaw).minus(data.amountRaw)
        const formattedBlock = {
          previousBlock: data.frontier,
          representative: data.representativeAddress,
          balance: newBalance.toFixed(0),
          recipient: destination
        }
        console.log({formattedBlock})
        await global.ledger.updateCache(0, data.frontier, this.ticker)
        // Modal.show({
        //   closeOnMaskClick: true,
        //   content: "Ledger should show: Send 0.001 NANO to nano_1nrtcu8ij14kb4ue8g1q8wn93r9xif7hbimb5aznz4z49up3r5jgzhsqkpgq"
        // });
        let amountForLedgerDisplay = +(+rawToMega("XNO", data.amountRaw)).toFixed(8)
        let amountForLedgerDisplayTicker = +(+rawToMega(this.ticker, data.amountRaw)).toFixed(8)
        Toast.show({
          icon: "loading",
          content: `Review the transaction on your Ledger. 
You are sending ${amountForLedgerDisplayTicker} ${this.ticker}. 
Ledger should show nano unit (${amountForLedgerDisplay} NANO) and nano prefix (nano_)`,
          duration: 300000
        });
        let signatureAndHash = await global.ledger.signBlock(0, formattedBlock)
        signedBlock = {
          "type": "state",
          account: source,
          previous: data.frontier,
          representative: data.representativeAddress,
          balance: newBalance.toFixed(0),
          link: global.publicKey,
          signature: signatureAndHash.signature,
          work: data.work,
        }
        console.log(signedBlock)
      }
      else{
        let pk = this.getPrivateKey(source);
        signedBlock = block.send(data, pk); // Returns a correctly formatted and signed block ready to be sent to the blockchain
      }

      let r = await this.rpc.process(signedBlock, "send");
      this.rpc.work_generate(r.hash); // pre-cache work (on server) for next send
      return r;
    });
  };

  receive = async (account, pendingTx) => {
    return lock.acquire(account, async () => {
      const account_info = await this.rpc.account_info(account);
      let data = {
        toAddress: account,
        transactionHash: pendingTx.hash,
        amountRaw: pendingTx.amount,
      };
      const isOpenBlock = account_info.error === "Account not found";
      if (isOpenBlock) {
        // open block
        data["walletBalanceRaw"] = "0";
        data["representativeAddress"] = this.defaultRep; // default rep
        data["frontier"] =
          "0000000000000000000000000000000000000000000000000000000000000000";
        data["work"] = await this.rpc.work_generate(this.getPublicKey(account));
      } else {
        // normal receive
        data["walletBalanceRaw"] = account_info.balance;
        data["representativeAddress"] = account_info.representative;
        data["frontier"] = account_info.frontier;
        data["work"] = await this.rpc.work_generate(account_info.frontier);
      }

      let signedBlock = null
      if (global.ledger) {
        //https://www.roosmaa.net/hw-app-nano/#blockdata
        const newBalance = isOpenBlock ? new BigNumber(data.amountRaw) : new BigNumber(data.walletBalanceRaw).plus(data.amountRaw)
        const formattedBlock = {
          representative: data.representativeAddress,
          balance: newBalance.toFixed(0),
          sourceBlock: pendingTx.hash
        }
        if (!isOpenBlock){
          formattedBlock["previousBlock"] = data.frontier
        }

        console.log({formattedBlock})
        Toast.show({
          icon: "loading",
          content: "Review the transaction on your Ledger to receive",
          duration: 300000
        });
        if (!isOpenBlock){
          await global.ledger.updateCache(0, data.frontier, this.ticker)
        }
        let signatureAndHash = await global.ledger.signBlock(0, formattedBlock)
        signedBlock = {
          "type": "state",
          account: account,
          previous: data.frontier,
          representative: data.representativeAddress,
          balance: newBalance.toFixed(0),
          link: pendingTx.hash,
          signature: signatureAndHash.signature,
          work: data.work,
        }
        console.log(signedBlock)
      }
      else {
        const privateKey = this.getPrivateKey(account);
        signedBlock = block.receive(data, privateKey); // Returns a correctly formatted and signed block ready to be sent to the blockchain
      }
      let r = await this.rpc.process(signedBlock, "receive");
      this.rpc.work_generate(r.hash); // pre-cache work (on server) for next receive
      return r;
    });
  };
   
  change = async ({account, newRep}) => {
    return lock.acquire(account, async () => {
      Toast.show({
        icon: "loading",
        content: "Changing representative ...",
      });
      const account_info = await this.rpc.account_info(account);
      if (account_info.error) {
        if (account_info.error === "Account not found") {
          setRepresentative(this.ticker, newRep) // only update local storage since account not yet opened
          Toast.show({
            icon: "success",
          });
          return
        }
        Toast.show({
          icon: "fail",
        });
        return
      }
      const data = {
        // Your current balance, from account info
        walletBalanceRaw: account_info.balance,
    
        // Your wallet address
        address: account,
    
        // The new representative
        representativeAddress: newRep,
    
        // Previous block, from account info
        frontier: account_info.frontier,
        // Generate work on the server side or with a DPOW service
        // This is optional, you don't have to generate work before signing the transaction
        work: await this.rpc.work_generate(account_info.frontier),
    }

      let signedBlock = null
      if (global.ledger) {
        //https://www.roosmaa.net/hw-app-nano/#blockdata
        const formattedBlock = {
          previousBlock: data.frontier,
          representative: data.representativeAddress,
          balance: data.walletBalanceRaw,
        };
        console.log({formattedBlock})
        Toast.show({
          icon: "loading",
          content: "Review the transaction on your Ledger",
          duration: 300000
        });
        await global.ledger.updateCache(0, data.frontier, this.ticker)
        let signatureAndHash = await global.ledger.signBlock(0, formattedBlock)
        signedBlock = {
          "type": "state",
          account: account,
          previous: data.frontier,
          representative: data.representativeAddress,
          balance: data.walletBalanceRaw,
          link: "0000000000000000000000000000000000000000000000000000000000000000",
          signature: signatureAndHash.signature,
          work: data.work,
        }
        console.log(signedBlock)
      }
      else {
        const privateKey = this.getPrivateKey(account);
        signedBlock = block.representative(data, privateKey); // Returns a correctly formatted and signed block ready to be sent to the blockchain
      }
      let r = await this.rpc.process(signedBlock, "receive");
      Toast.show({
        icon: "success",
      });
      this.rpc.work_generate(r.hash); // pre-cache work (on server) for next receive
      return r;
    });
  };
   
  receiveAll = async (account) => {
    let hashes = await this.rpc.receivable(account);
    for (const hash in hashes) {
      const pendingTx = {
        hash: hash,
        amount: hashes[hash],
      };
      this.receive(account, pendingTx);
    }
    return { started: true };
  };
  getAccounts = () => {
    return Array.from(this.mapAccounts.keys());
  };
  getAccount = (address) => {
    return this.mapAccounts.get(address);
  };

  getPrivateKey = (address) => {
    let account = this.mapAccounts.get(address);
    if (account === undefined) {
      throw new Error(address + " not found in wallet");
    }
    return account.privateKey;
  };
  getPublicKey = (address) => {
    if (global.publicKey) {
      return global.publicKey
    }
    let account = this.mapAccounts.get(address);
    if (account === undefined) {
      throw new Error(address + " not found in wallet");
    }
    return account.publicKey;
  };

  megaToRaw = function (amount) {
    let value = new BigNumber(amount.toString());
    return value.shiftedBy(this.decimal).toFixed(0);
  };
  rawToMega = function (amount) {
    let value = new BigNumber(amount.toString());
    return value.shiftedBy(-this.decimal).toFixed(this.decimal, 1);
  };
  wsAutoReceiveSend = async function (data_json) {
    if (
      data_json.topic === "confirmation" &&
      data_json.message !== undefined &&
      data_json.message.block.subtype === "send"
    ) {
      if (this.cacheSendHash.has(data_json.message.hash)) { // prevent receiving the same send twice (eg: if multiple websocket event for same block)
        console.log("Already received this send: " + data_json.message.hash);
        return;
      }
      this.cacheSendHash.set(data_json.message.hash, "");
      let pendingTx = {
        hash: data_json.message.hash,
        amount: data_json.message.amount,
      };
      let accountDb = this.getAccount(data_json.message.block.link_as_account);
      if (accountDb === null || accountDb === undefined) {
        return;
      }
      Toast.show({
        icon: "loading",
        content: "Receiving " + +this.rawToMega(pendingTx.amount) + " " + this.ticker,
      });
      // console.log("Receiving new send on : " + data_json.message.block.link_as_account)
      let pk = accountDb.privateKey;
      let pubk = accountDb.publicKey;
      let received = await this.receive(
        data_json.message.block.link_as_account,
        pendingTx,
        pk,
        pubk,
      );
      Toast.show({
        icon: "success",
        content: "Received " + +this.rawToMega(pendingTx.amount) + " " + this.ticker,
      });
      mutate("history-" + this.ticker);
      mutate("balance-" + this.ticker);
      console.log(received);
    }
  };
  wsOnMessage = async function (data_json) {
    return;
  };
}
