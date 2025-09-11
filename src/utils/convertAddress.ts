import { networks } from "./networks";


export const convertAddress = (address, ticker) => {
  if (address == null) {
    return "";
  }
  // if (address.startsWith("nano_")) {
  //   return address.replace("nano_", networks[ticker]?.prefix + "_");
  // }
  return networks[ticker]?.prefix + "_" + address.split("_")[1];
};
