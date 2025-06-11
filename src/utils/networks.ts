export const networks = {
  XNO: {
    name: "Nano",
    id: "nano",
    decimals: 30,
    decimalsToShow: 5,
    prefix: "nano",
    logo: "https://bucket.nanwallet.com/logo/XNO.svg",
    defaultRep: "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq", 
    rpc: import.meta.env.VITE_PUBLIC_BACKEND + "/nodes/XNO",
    icon: "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D",
    rank: 1,
  },
  // "BTC-NANSWAP": {
  //   name: "NanBitcoin",
  //   id: "nanbtc",
  //   ticker: "btc",
  //   decimals: 29,
  //   prefix: "nanbtc",
  //   logo: "https://cdn.discordapp.com/attachments/1057888614618505226/1291757371374174279/btc_nanswap.svg?ex=6701424d&is=66fff0cd&hm=9f3fb196e07a2b50dae33d53c1216db23ab08b14465ce29b4bfcb6d89ac627cc&",
  //   defaultRep: "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
  //   rpc: "https://nodes.nanwallet.com/BAN",
  
  // },
  // USDC: {
  //   name: "NanUSDC",
  //   id: "nanusdc",
  //   decimals: 29,
  //   prefix: "nanusdc",
  //   logo: "https://cdn.discordapp.com/attachments/1057888614618505226/1291770469342511104/usdc_nanswap.svg?ex=67014e7f&is=66fffcff&hm=232cacaa94b59132bcabcbf539d2283d7c711426ea413c72891e0fdf9246c4ba&",
  //   defaultRep: "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
  //   rpc: "https://nodes.nanwallet.com/BAN",
  
  // },
  BAN: {
    name: "Banano",
    id: "banano",
    decimals: 29,
    decimalsToShow: 2,
    prefix: "ban",
    logo: "https://bucket.nanwallet.com/logo/BAN.svg",
    defaultRep: "ban_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
    rpc: import.meta.env.VITE_PUBLIC_BACKEND + "/nodes/BAN",
    icon: "https://i.nanwallet.com/u/plain/https%3A%2F%2Fmonkey.banano.cc%2Fapi%2Fv1%2Fmonkey%2F",
  },
  XDG: {
    name: "DogeNano",
    id: "dogenano",
    decimals: 26,
    decimalsToShow: 2,
    prefix: "xdg",
    logo: "https://bucket.nanwallet.com/logo/XDG.png",
    defaultRep: "xdg_1e4ecrhmcws6kwiegw8dsbq5jstq7gqj7fspjmgiu11q55s6xnsnp3t9jqxf",
    rpc: import.meta.env.VITE_PUBLIC_BACKEND + "/nodes/XDG",
    icon: "https://i.nanwallet.com/u/plain/https%3A%2F%2Fdoggycon.dogenano.io%2Fapi%2Fv1%2Fpilou%2F",
  },
  ANA: {
    name: "Ananos",
    id: "ananos",
    decimals: 28,
    decimalsToShow: 0,
    prefix: "ana",
    logo: "https://bucket.nanwallet.com/logo/ANA.png",
    defaultRep: "ana_1nanswapnscbjjr6nd8bjbyp7o3gby1r8m18rbmge3mj8y5bihh71sura9dx",
    rpc: import.meta.env.VITE_PUBLIC_BACKEND + "/nodes/ANA",
  },
  XRO: {
    name: "RaiblocksOne",
    id: "raiblocksone",
    faucetId: 'raiblocks1', // because nanswap xro faucet different for a mysterious reason
    decimals: 30,
    decimalsToShow: 1,
    prefix: "xro",
    logo: "https://bucket.nanwallet.com/logo/XRO.png",
    defaultRep: "xro_1nanswapnscbjjr6nd8bjbyp7o3gby1r8m18rbmge3mj8y5bihh71sura9dx",
    rpc: import.meta.env.VITE_PUBLIC_BACKEND + "/nodes/XRO",
  },
  ...JSON.parse(localStorage.getItem("newNetworks")),
    ...JSON.parse(localStorage.getItem("customNetworks")),
};
// console.log(networks);
export const customNetworks = () => {
  const customNetworks = localStorage.getItem("customNetworks");
  return customNetworks ? JSON.parse(customNetworks) : [];
}

export const activeNetworks = Object.keys(networks).filter((ticker) => !JSON.parse(localStorage.getItem("hiddenNetworks"))?.includes(ticker));