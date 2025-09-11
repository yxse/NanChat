import { Modal } from "antd-mobile";
import { AccountAvatar } from "./AccountAvatar";
import { QRCodeSVG } from "qrcode.react";
import icon from "../../../public/icons/nanchat.svg";


export const showAccountQRCode = (me) => {
  Modal.show({
      showCloseButton: true,
      closeOnMaskClick: true,
      content: (
        <div className="flex justify-start items-center flex-col">
          <div className="text-xl mb-4 flex justify-start gap-2" style={{width: '200px'}}>
          <AccountAvatar
          account={me?._id}
          // url={me?.profilePicture?.url}
          width={42}
          />
          {me?.name}
          </div>
          {/* <div className="text-sm mb-2">
          {formatAddress(me?._id)}
          </div> */}
          <QRCodeSVG
            id="qrcode"
            imageSettings={{
              src: icon,
              height: 24,
              width: 24,
              excavate: false,
            }}
            includeMargin
            value={`https://nanchat.com/chat/${me?._id}`}
            size={200}
            style={{borderRadius: 8}}
          />
          <div className="text-base mt-4 text-center mb-4" style={{ color: 'var(--adm-color-text-secondary)' }}>
            Scan to start an end-to-end encrypted chat with me
          </div>
        </div>
      )
    })
};
