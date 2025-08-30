// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

import { Toast } from "antd-mobile";
import { networks } from "../utils/networks";

/**
 * Simple RPC client for Nano node
 */

function saveWorkCache(hash, work) {
  const keyCache = "works-cache";
  let cached = localStorage.getItem(keyCache);
  if (!cached) {
    cached = {};
  } else {
    cached = JSON.parse(cached);
  }
  cached[hash] = work;
  localStorage.setItem(keyCache, JSON.stringify(cached));
}
function removeWork(work){
  const keyCache = "works-cache";
  let cached = localStorage.getItem(keyCache);
  if (!cached) {
    cached = {};
  } else {
    cached = JSON.parse(cached);
  }
  for (const [hash, value] of Object.entries(cached)) {
    if (value === work) {
      delete cached[hash];
      console.log("removed work from cache", work);
      break;
    }
  }
  localStorage.setItem(keyCache, JSON.stringify(cached));
}
function getWorkCache(hash) {
  const keyCache = "works-cache";
  let cached = localStorage.getItem(keyCache);
  if (!cached) {
    return false
  }
  cached = JSON.parse(cached);
  return cached[hash];
}
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

  acocunt_history = async (account, count, offset, reverse = false, head) => {
    let body = {
      action: "account_history",
      account: account,
      count: count,
      raw: "true",
      "offset": offset,
      "reverse": reverse,
    };
    if (head){
      body.head = head;
    }
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
    // check cache
    if (hash === undefined) {
      throw new Error("work_generate hash is undefined");
    }
    let cached = getWorkCache(hash);
    if (cached) {
      console.log("work_generate cache hit");
      return cached;
    }
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
    // save in cache
    saveWorkCache(hash, r.work);
    return r.work;
  };
  receivable = async (account, minAmountRaw) => {
    if (minAmountRaw == 0){
      minAmountRaw = 1; // ensure threshold at least 1 raw or it will not return the amount in the response
    }
    let params = {
      action: "pending",
      account: account,
      threshold: minAmountRaw,
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
    
    console.log("process", r);
    // remove work from cache
    removeWork(block.work);
    
    return r;
  };

  req = async (params) => {
    let url = this.rpcURL;
    if (params.action === "work_generate") {
      url = this.worURL;
    }
    let data
    try {
      data = await fetch(url, {
        method: "POST",
        headers: this.headerAuth,
        body: JSON.stringify(params),
      });
    } catch (error) {
      console.error("RPC error", error);
      Toast.show({content: `Cannot connect to ${url}. Please try again later. (${error})`, icon: 'fail'});
      throw new Error(`RPC error: ${error}`);
    }

    // console.log("ratelimit-limit: " + data.headers.get('ratelimit-limit'));
    // console.log("ratelimit-remaining: " + data.headers.get('ratelimit-remaining'));
    // console.log("ratelimit-reset: " + data.headers.get('ratelimit-reset'));
    if (data.ok){
      data = await data.json();
      return data;
    }
    else{
      console.error("RPC error", data);
      if (data.status === 429){
        data.text().then((text) => {
          Toast.show({content: text, icon: 'fail'});
        });
        throw new Error(`RPC error: ${data.statusText}`);
      }
      else{
        Toast.show({content: "Cannot connect " + url + ". Please try again later. Status: " + data.status, icon: 'fail'});
        throw new Error(`RPC error: ${data.status}`);
      }
    }
  };
}
