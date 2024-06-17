// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * Simple RPC client for Nano node
 */
export default class RPC {
  constructor(ticker) {
    this.rpcURL = import.meta.env.VITE_PUBLIC_RPC_URL + ticker;
    this.worURL = import.meta.env.VITE_PUBLIC_RPC_URL + ticker;
    this.headerAuth = {
      "Content-Type": "application/json",
      "nodes-api-key": import.meta.env.VITE_PUBLIC_NODES_API_KEY,
    };
  }

  acocunt_history = async (account, offset) => {
    let body = {
      action: "account_history",
      account: account,
      count: "50",
      raw: "false",
      // "offset": offset,
    };
    let r = await this.req(body);
    return r;
  };
  account_balance = async (account) => {
    let params = {
      action: "account_balance",
      account: account,
    };
    let r = await this.req(params);
    return r;
  };

  account_info = async (account) => {
    let params = {
      action: "account_info",
      account: account,
      representative: "true",
    };
    let r = await this.req(params);
    return r;
  };
  blocks_info = async (hashes) => {
    let params = {
      action: "blocks_info",
      hashes: hashes,
      pending: "true",
      source: "true",
    };
    let r = await this.req(params);
    return r;
  }
  work_generate = async (hash) => {
    let params = {
      action: "work_generate",
      hash: hash,
    };

    let r = await this.req(params);
    if (r.work === undefined) {
      throw new Error(
        `work_generate failed on ${this.worURL}: ${JSON.stringify(r)}`,
      );
    }
    return r.work;
  };
  receivable = async (account) => {
    let params = {
      action: "pending",
      account: account,
      threshold: "1",
    };

    // console.log(params);
    let r = await this.req(params);
    // console.log(r);
    return r.blocks;
  };
  process = async (block, subtype) => {
    let params = {
      action: "process",
      json_block: "true",
      subtype: subtype,
      block: block,
    };

    let r = await this.req(params);
    return r;
  };

  req = async (params) => {
    let url = this.rpcURL;
    if (params.action === "work_generate") {
      url = this.worURL;
    }
    let data = await fetch(url, {
      method: "POST",
      headers: this.headerAuth,
      body: JSON.stringify(params),
    });

    // console.log("ratelimit-limit: " + data.headers.get('ratelimit-limit'));
    // console.log("ratelimit-remaining: " + data.headers.get('ratelimit-remaining'));
    // console.log("ratelimit-reset: " + data.headers.get('ratelimit-reset'));
    try {
      data = await data.json();
      return data;
    } catch (error) {
      return { error: error.message };
    }
  };
}
