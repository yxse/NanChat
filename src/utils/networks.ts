export const networks = {
  XNO: {
    name: "Nano",
    id: "nano",
    decimals: 30,
    prefix: "nano",
    logo: "https://nanswap.com/logo/XNO.svg",
    defaultRep: "nano_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq", 
    rpc: "https://nodes.nanswap.com/XNO",
    rpcAuth: import.meta.env.VITE_PUBLIC_NODES_API_KEY,
  },
  BAN: {
    name: "Banano",
    id: "banano",
    decimals: 29,
    prefix: "ban",
    logo: "https://nanswap.com/logo/BAN.svg",
    defaultRep: "ban_1banexkcfuieufzxksfrxqf6xy8e57ry1zdtq9yn7jntzhpwu4pg4hajojmq",
    rpc: "https://nodes.nanswap.com/BAN",
    rpcAuth: import.meta.env.VITE_PUBLIC_NODES_API_KEY,
  },
  XDG: {
    name: "DogeNano",
    id: "dogenano",
    decimals: 26,
    prefix: "xdg",
    logo: "https://dogenano.io/static/media/XDG.023c3302.png",
    defaultRep: "xdg_1e4ecrhmcws6kwiegw8dsbq5jstq7gqj7fspjmgiu11q55s6xnsnp3t9jqxf",
    rpc: "https://nodes.nanswap.com/XDG",
    rpcAuth: import.meta.env.VITE_PUBLIC_NODES_API_KEY,
  },
  ANA: {
    name: "Ananos",
    id: "ananos",
    decimals: 28,
    prefix: "ana",
    logo: "https://nanswap.com/logo/ANA.png",
    defaultRep: "ana_1nanswapnscbjjr6nd8bjbyp7o3gby1r8m18rbmge3mj8y5bihh71sura9dx",
    rpc: "https://nodes.nanswap.com/ANA",
    rpcAuth: import.meta.env.VITE_PUBLIC_NODES_API_KEY,
  },
  XRO: {
    name: "RaiblocksOne",
    id: "raiblocksone",
    decimals: 30,
    prefix: "xro",
    logo: "https://nanswap.com/logo/XRO.png",
    defaultRep: "xro_1nanswapnscbjjr6nd8bjbyp7o3gby1r8m18rbmge3mj8y5bihh71sura9dx",
    rpc: "https://nodes.nanswap.com/XRO",
    rpcAuth: import.meta.env.VITE_PUBLIC_NODES_API_KEY,
  },
    ...JSON.parse(localStorage.getItem("customNetworks")),
};
console.log(networks);
export const customNetworks = () => {
  const customNetworks = localStorage.getItem("customNetworks");
  return customNetworks ? JSON.parse(customNetworks) : [];
}

export const activeNetworks = Object.keys(networks).filter((ticker) => !JSON.parse(localStorage.getItem("hiddenNetworks"))?.includes(ticker));