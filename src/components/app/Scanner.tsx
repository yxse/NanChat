import {
    BarcodeScanner,
    BarcodeFormat,
    LensFacing,
  } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { Button, Modal, Popup, Toast } from 'antd-mobile';
import { CloseCircleOutline, PicturesOutline, ScanCodeOutline } from 'antd-mobile-icons';
import { cloneElement, useEffect, useState } from 'react';
import { Scanner as ScannerWeb } from '@yudiel/react-qr-scanner';
import { FilePicker } from '@capawesome/capacitor-file-picker';

import "barcode-detector/polyfill";

const defaultScanButton = <ScanCodeOutline
fontSize={24}
className="cursor-pointer text-gray-200 mr-4 mt-4"
/>;

const ScannerNative = ({onScan, children = defaultScanButton, defaultOpen, onClose}) => {
    const [visible, setVisible] = useState(defaultOpen);
    let isScanning = false;

    const handleScanClick = () => {
        setVisible(true);
        // let modal = Modal.show({
        //     onClose: () => {
        //         stopScan();
        //         if (onClose) onClose();
        //     },
        //     showCloseButton: true,
        //     bodyClassName: "bg-transparent scanner-active",
        //     style: {
        //         visibility: "visible",
        //         display: "flex",
        //         height: "100vh",
        //         width: "100%",
        //     },
        //     maskClassName: "bg-transparent",
        //     closeOnMaskClick: true,
        //     title: null,
        //     content: (
        //         <div className=''>
        //         <div className="square"></div>
        //         <div className="m-4 text-sm text-center" style={{marginTop: "300px", userSelect: "none", WebkitUserSelect: "none"}}>
        //           Scan QR Code
        //         </div>
        //       </div>
        //     ),
        // });
        startScan(onScan, setVisible);
    };
    useEffect(() => {
        if (!isScanning && defaultOpen) {
            handleScanClick();
            isScanning = true; // Prevent multiple opening
        }
    }
    , []);

    

    return (
        <div className='scanner' onClick={handleScanClick}>
          <Popup
          destroyOnClose
          showCloseButton
          style={{
                    visibility: "visible",
                    display: "flex",
                    // height: "100dvh",
                    height: "500px",
                    width: "100%",
            }}
          onClose={() => {
            stopScan();
            setVisible(false)
            if (onClose) onClose();
          }}
          maskClassName='bg-transparent'
          bodyClassName='bg-transparent scanner-active'
          visible={visible}
          closeOnSwipe
          onMaskClick={() => {
            stopScan();
            setVisible(false)
          }}
          closeIcon={<CloseCircleOutline fontSize={24} />}
          bodyStyle={{ height: 'calc(100vh - var(--safe-area-inset-top))' }}
        >
<div className=''>
                <div className="square">

                <div className="m-4 text-sm text-center" style={{userSelect: "none", WebkitUserSelect: "none", marginTop: "220px"}}>
                  Scan QR Code
                </div>
                </div>
                {
                  Capacitor.getPlatform() === 'web' ? null :
                  <div 
                  style={{
                    position: 'absolute',
                    bottom: "calc(32px + var(--safe-area-inset-bottom))",
                  right: 32,
                }}
                onClick={() => {
                  readBarcodeFromImage().then((result) => {
                    if (result) {
                      if (onScan) {
                        try {
                          onScan(result.displayValue);
                        } catch (error) {
                          console.error('Error in onScan callback:', error);
                        }
                      }
                      setVisible(false)
                      stopScan();
                    }
                    else{
                      Toast.show({icon: 'fail', content: 'No QR code found in image'});
                    }
                  }).catch((e) => {
                    console.error(e);
                    Toast.show({icon: 'fail', content: 'Failed to read image'});
                  });
                }}
                >
                  <div style={{ }}>
                 <Button size='large' shape='rounded'>
                    <PicturesOutline fontSize={24} />
                  </Button>
                  <div className='text-sm text-center' style={{marginTop: 4, userSelect: "none", WebkitUserSelect: "none"}}>
                   Photos
                  </div>
                  </div>
                </div>
                }
              </div>
        </Popup>
            {/* On clone l'élément enfant en lui ajoutant le onClick */}
            {/* {cloneElement(children, {
                onClick: handleScanClick
            })} */}
            {children}
        </div>
    );
};

// const ScannerWebComponent = ({onScan, children = defaultScanButton, defaultOpen, onClose}) => {
//     let isScanning = false;
//     const handleScanClick = () => {
//         let modal = Modal.show({
//           onClose: () => { if (onClose) onClose(); },
//             closeOnMaskClick: true,
//             title: "Scan QR Code",
//             content: (
//                 <div>
//                     <div style={{ height: 256 }}>
//                         <ScannerWeb
//                             onScan={(result) => {
//                                 onScan(result[0].rawValue);
//                                 modal.close();
//                             }}
//                         />
//                     </div>
//                     {/* <div className="text-gray-400 m-4 text-sm text-center">

//                     </div> */}
//                 </div>
//             )
//         });
//     }

//     useEffect(() => {
//         if (!isScanning && defaultOpen) {
//             handleScanClick();
//             isScanning = true; // Prevent multiple opening
//         }
//     }, []);

//     return (
//         <div className='scanner' onClick={handleScanClick}>
//             {/* {cloneElement(children, {
//                 onClick: handleScanClick
//             })} */}
//             {children}
//         </div>
//     );
// }

export const Scanner = ({onScan, children = defaultScanButton, defaultOpen = false, onClose}) => {
  return <ScannerNative onScan={onScan} children={children} defaultOpen={defaultOpen} onClose={onClose} />;
    // if (Capacitor.isNativePlatform()) {
    //     return <ScannerNative onScan={onScan} children={children} defaultOpen={defaultOpen} onClose={onClose} />;
    // } else {
    //     return <ScannerWebComponent onScan={onScan} children={children} defaultOpen={defaultOpen} onClose={onClose} />;
    // }
};
  const startScan = async (onScan, setVisible) => {
    
    // The camera is visible behind the WebView, so that you can customize the UI in the WebView.
    // However, this means that you have to hide all elements that should not be visible.
    // You can find an example in our demo repository.
    // In this case we set a class `barcode-scanner-active`, which then contains certain CSS rules for our app.
    document.querySelector('body')?.classList.add('barcode-scanner-active');
    const videoElement = document.createElement('video');
  videoElement.style.position = 'fixed';
  videoElement.style.top = '50%';
  videoElement.style.left = '50%';
  videoElement.style.transform = 'translate(-50%, -50%)';
  videoElement.style.width = '80%';  // 80% of viewport width
  videoElement.style.maxWidth = '600px';  // optional: set a maximum size
  videoElement.style.height = 'auto';
  videoElement.style.visibility = 'visible';

    if (Capacitor.getPlatform() === 'web') {
      document.body.appendChild(videoElement);
    }
    
    // Add the `barcodeScanned` listener
    const listener = await BarcodeScanner.addListener(
      'barcodesScanned',
      async result => {
        // Make all elements in the WebView visible again
        console.log(result.barcodes[0]);
        document
          .querySelector('body')
          ?.classList.remove('barcode-scanner-active');
        if (onScan) {
          try {
            onScan(result.barcodes[0].displayValue);
          } catch (error) {
            console.error('Error in onScan callback:', error);            
          }
          }
          
        stopScan();
        setVisible(false);
      },
    );
  
    // Start the barcode scanner
    await BarcodeScanner.startScan({
      formats: [BarcodeFormat.QrCode],
      videoElement: Capacitor.getPlatform() === 'web' ? videoElement : undefined,
    });
    // await setZoomRatio();
  };
  
  const stopScan = async () => {
    // Make all elements in the WebView visible again
    document.querySelector('body')?.classList.remove('barcode-scanner-active');
    // document.querySelector('video')?.remove();
  
    // Remove all listeners
    await BarcodeScanner.removeAllListeners();
  
    // Stop the barcode scanner
    await BarcodeScanner.stopScan();

  };
  
  const scanSingleBarcode = async () => {
    return new Promise(async resolve => {
      document.querySelector('body')?.classList.add('barcode-scanner-active');
  
      const listener = await BarcodeScanner.addListener(
        'barcodeScanned',
        async result => {
          await listener.remove();
          document
            .querySelector('body')
            ?.classList.remove('barcode-scanner-active');
          await BarcodeScanner.stopScan();
          resolve(result.barcode);
        },
      );
  
      await BarcodeScanner.startScan();
    });
  };
  
  const scan = async () => {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });
    return barcodes;
  };
  
  const isSupported = async () => {
    const { supported } = await BarcodeScanner.isSupported();
    return supported;
  };
  
  const enableTorch = async () => {
    await BarcodeScanner.enableTorch();
  };
  
  const disableTorch = async () => {
    await BarcodeScanner.disableTorch();
  };
  
  const toggleTorch = async () => {
    await BarcodeScanner.toggleTorch();
  };
  
  const isTorchEnabled = async () => {
    const { enabled } = await BarcodeScanner.isTorchEnabled();
    return enabled;
  };
  
  const isTorchAvailable = async () => {
    const { available } = await BarcodeScanner.isTorchAvailable();
    return available;
  };
  
  const setZoomRatio = async () => {
    await BarcodeScanner.setZoomRatio({ zoomRatio: 1.5 });
  };
  
  const getZoomRatio = async () => {
    const { zoomRatio } = await BarcodeScanner.getZoomRatio();
    return zoomRatio;
  };
  
  const getMinZoomRatio = async () => {
    const { zoomRatio } = await BarcodeScanner.getMinZoomRatio();
    return zoomRatio;
  };
  
  const getMaxZoomRatio = async () => {
    const { zoomRatio } = await BarcodeScanner.getMaxZoomRatio();
    return zoomRatio;
  };
  
  const openSettings = async () => {
    await BarcodeScanner.openSettings();
  };
  
  const isGoogleBarcodeScannerModuleAvailable = async () => {
    const { available } =
      await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    return available;
  };
  
  const installGoogleBarcodeScannerModule = async () => {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
  };
  
  const checkPermissions = async () => {
    const { camera } = await BarcodeScanner.checkPermissions();
    return camera;
  };
  
  const requestPermissions = async () => {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera;
  };


    const readBarcodeFromImage = async () => {
    const { files } = await FilePicker.pickImages({ limit: 1 });
    const path = files[0]?.path;
    if (!path) {
      return;
    }

    const { barcodes } = await BarcodeScanner.readBarcodesFromImage({
      path,
      formats: [BarcodeFormat.QrCode],
    });
    return barcodes[0];
  }