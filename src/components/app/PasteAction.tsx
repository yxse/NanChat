import React, { useEffect, useState } from 'react'
import { BiPaste } from 'react-icons/bi';
import { parseURI, pasteFromClipboard } from '../../utils/format';
import { Modal, Toast } from 'antd-mobile';
import { ModalReceive } from './Network';
import { useNavigate } from 'react-router-dom';
import { PasteIcon } from './Icons';
import { ScanCodeOutline } from 'antd-mobile-icons';
import { Scanner } from './Scanner';
import { WebviewOverlay } from '@teamhive/capacitor-webview-overlay';
import { SignPopup } from '../../api-invoke/Sign';
// import { Scanner } from '@yudiel/react-qr-scanner';

function PasteAction({mode = "paste", uri = "", setUri, text, scanOpen, setScanOpen}) {
  const [visible, setVisible] = React.useState(false);
  const [visibleSign, setVisibleSign] = React.useState(false);
  const [activeTicker, setActiveTicker] = React.useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (uri) {
      executeURI(uri);
    }
  }
  , [uri]);

  function executeURI(uri: string) {
    try {
      if (uri.startsWith("nanauth://sign?") 
        || uri.startsWith("nanauth://sign/?") // for tauri
      ) { 
        // navigate(uri.replace("nanauth://sign?", "/sign?"));
        setVisibleSign(true);
        return;
      }
      if (uri.startsWith("https://nanchat.com/chat/")) { // handle chat group/my qrcode join
        uri = uri.replace("https://nanchat.com", "");
        navigate(uri)
        return
      }
      if (uri.startsWith("https://nanchat.com/?uri=")) { // handle universal link
        uri = uri.replace("https://nanchat.com/?uri=", "");
        uri = decodeURIComponent(uri);
      }
        
      let parsed = parseURI(uri);
      if (parsed)
        // Toast.show({
        //   content: JSON.stringify(parsed),
        // });
      setActiveTicker(parsed.ticker);
      setVisible(true);
      if (setUri){
        setUri(""); // Clear the URI, fix not opening the same URI twice
      }
      let amount = parsed.megaAmount;
      let params = '?to=' + parsed.address
      if (amount) {
        params += '&amount=' + amount;
      }
      navigate({
        search: `?amount=${amount}&to=${parsed.address}`,
      });
    } catch (error) {
      console.error(error);
      Toast.show({
        content: "Paste a valid Address, Message to sign or URI",
      });
    }
  }

  const Paste = () => {
    return <PasteIcon fontSize={24}
    className="cursor-pointer"
    onClick={() => {
      pasteFromClipboard().then((text) => {
        executeURI(text);
      });
    }}
  />
  }

  const Scan = () => {
    return <Scanner
    onClose={() => {if (setScanOpen) setScanOpen(false)}}
    defaultOpen={scanOpen}
      onScan={(result) => {
        executeURI(result);
      }}
    >
      {
        text ? text : 
    <ScanCodeOutline
    fontSize={24}
    className="cursor-pointer"
    />
  }
    </Scanner>
    // onClick={() => {
    //   Modal.show({
    //     // style: { width: "100%", height: "268px" },
    //     // bodyStyle: { height: "268px" },
    //     closeOnMaskClick: true,
    //     title: "Scan QR Code",
    //     content: (
    //       <div>
    //         <div style={{ height: 256 }}>
    //           <Scanner
    //           formats={['qr_code']}
    //             //   styles={
    //             onScan={(result) => {
    //               executeURI(result[0].rawValue);
    //               Modal.clear();
    //             }}
    //           />
    //         </div>
    //         <div className="text-gray-400 m-4 text-sm">
    //           Scan an Address, a Message to sign or a URI
    //         </div>
    //       </div>
    //     ),
    //   });
    // }}
  }
  return (
    <>
      {mode === "scan" && <Scan />}
      {mode === "paste" && <Paste />}
      <ModalReceive
        onClose={() => {
          setVisible(false);
          setActiveTicker(null);
          navigate(location.pathname);
          WebviewOverlay.toggleSnapshot(false);
        }}
        action={"send"}
        ticker={activeTicker}
        modalVisible={visible}
        setModalVisible={setVisible}
        setAction={() => { }}
      />
      <SignPopup 
        visible={visibleSign}
        setVisible={setVisibleSign}
        uri={uri}
        setUri={setUri}
        onSign={(result) => {
          WebviewOverlay.toggleSnapshot(false);
          setVisibleSign(false);
        }}
      />
    </>
  )
}

export default PasteAction