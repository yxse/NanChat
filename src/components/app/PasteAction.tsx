import React, { useEffect } from 'react'
import { BiPaste } from 'react-icons/bi';
import { parseURI } from '../../utils/format';
import { Modal, Toast } from 'antd-mobile';
import { ModalReceive } from './Network';
import { useNavigate } from 'react-router-dom';
import { PasteIcon } from './Icons';
import { ScanCodeOutline } from 'antd-mobile-icons';
import { Scanner } from './Scanner';
// import { Scanner } from '@yudiel/react-qr-scanner';

function PasteAction({mode = "paste", uri = ""}) {
  const [visible, setVisible] = React.useState(false);
  const [activeTicker, setActiveTicker] = React.useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (uri) {
      executeURI(uri);
    }
  }
  , [uri])

  function executeURI(uri: string) {
    try {
      let parsed = parseURI(uri);
      if (parsed)
        Toast.show({
          content: JSON.stringify(parsed),
        });
      setActiveTicker(parsed.ticker);
      setVisible(true);
      let amount = parsed.megaAmount;
      let params = '?to=' + parsed.address
      if (amount) {
        params += '&amount=' + amount;
      }
      navigate({
        search: `?amount=${amount}&to=${parsed.address}`,
      });
    } catch (error) {
      Toast.show({
        content: "Paste a valid Address, Message to sign or URI",
      });
    }
  }

  const Paste = () => {
    return <PasteIcon fontSize={24}
    className="cursor-pointer text-gray-200 mr-4 mt-4 active:text-gray-400"
    onClick={() => {
      navigator.clipboard.readText().then((text) => {
        executeURI(text);
      })
    }}
  />
  }

  const Scan = () => {
    return <Scanner
      onScan={(result) => {
        executeURI(result);
      }}
    >
    <ScanCodeOutline
    fontSize={24}
    className="cursor-pointer text-gray-200 mr-4 mt-4"
    />
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
          navigate("");
        }}
        action={"send"}
        ticker={activeTicker}
        modalVisible={visible}
        setModalVisible={setVisible}
        setAction={() => { }}
      />
    </>
  )
}

export default PasteAction