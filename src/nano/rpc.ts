// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

import { networks } from "../utils/networks";

/**
 * Simple RPC client for Nano node
 */
export default class RPC {
  constructor(ticker) {
    this.rpcURL = networks[ticker].rpc;
    this.worURL = networks[ticker].rpc;
    this.headerAuth = {
      "Content-Type": "application/json",
      // "nodes-api-key": import.meta.env.VITE_PUBLIC_NODES_API_KEY,
    };
    if (networks[ticker].rpcAuth) {
      this.headerAuth["nodes-api-key"] = networks[ticker].rpcAuth;
    }
  }

  acocunt_history = async (account, count, offset, reverse = false) => {
    let body = {
      action: "account_history",
      account: account,
      count: count,
      raw: "true",
      "offset": offset,
      "reverse": reverse,
    };
    let r = await this.req(body);
    return r;
  };
  account_balance = async (account) => {
    let params = {
      action: "account_balance",
      account: account,
      include_only_confirmed: "false", // allow better ux when receiving, else balance may be inaccurate if fetching balance when receiving in same time
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
      use_peers: "true",
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
