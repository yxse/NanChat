import { NoAvatar } from "./components/icons/NoAvatar";
import ProfilePicture from "./components/profile/ProfilePicture";

export const AccountAvatar = ({ width = 48, account, src = null }) => {
  let icon;
  if (account == null) {
    // url = "https://i.nanwallet.com/u/plain/https%3A%2F%2Fnatricon.com%2Fapi%2Fv1%2Fnano%3Faddress%3D" + account + "%26outline%3Dtrue"
    icon = <NoAvatar height={width} width={width} borderRadius={8}/>;
  }
  else {
    icon = <ProfilePicture address={account} width={width} src={src} borderRadius={8}/>;
    //  <img style={{borderRadius: 8}} src={url} alt="account-pfp" width={width} />
  }
  return icon;
};
