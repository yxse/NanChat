import {
    BarcodeScanner,
    BarcodeFormat,
    LensFacing,
  } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { Button, Modal, Toast } from 'antd-mobile';
import { ScanCodeOutline } from 'antd-mobile-icons';
import { cloneElement, useEffect } from 'react';
import { Scanner as ScannerWeb } from '@yudiel/react-qr-scanner';

const defaultScanButton = <ScanCodeOutline
fontSize={24}
className="cursor-pointer text-gray-200 mr-4 mt-4"
/>;

const ScannerNative = ({onScan, children = defaultScanButton, defaultOpen}) => {
    let isScanning = false;

    const handleScanClick = () => {
        let modal = Modal.show({
            onClose: () => {
                stopScan();
            },
            showCloseButton: true,
            bodyClassName: "bg-transparent scanner-active",
            style: {
                visibility: "visible",
                display: "flex",
                height: "100vh",
                width: "100%",
            },
            maskClassName: "bg-transparent",
            closeOnMaskClick: true,
            title: null,
            content: (
                <div className=''>
                <div className="square"></div>
                <div className="m-4 text-sm text-center" style={{marginTop: "300px"}}>
                  Scan QR Code
                </div>
              </div>
            ),
        });
        startScan(onScan, modal);
    };
    useEffect(() => {
        if (!isScanning && defaultOpen) {
            handleScanClick();
            isScanning = true; // Prevent multiple opening
        }
    }
    , []);

    

    return (
        <div className='scanner'>
            {/* On clone l'élément enfant en lui ajoutant le onClick */}
            {cloneElement(children, {
                onClick: handleScanClick
            })}
        </div>
    );
};

const ScannerWebComponent = ({onScan, children = defaultScanButton, defaultOpen}) => {
    let isScanning = false;
    const handleScanClick = () => {
        let modal = Modal.show({
            closeOnMaskClick: true,
            title: "Scan QR Code",
            content: (
                <div>
                    <div style={{ height: 256 }}>
                        <ScannerWeb
                            onScan={(result) => {
                                onScan(result[0].rawValue);
                                modal.close();
                            }}
                        />
                    </div>
                    {/* <div className="text-gray-400 m-4 text-sm text-center">

                    </div> */}
                </div>
            )
        });
    }

    useEffect(() => {
        if (!isScanning && defaultOpen) {
            handleScanClick();
            isScanning = true; // Prevent multiple opening
        }
    }, []);

    return (
        <div className='scanner'>
            {cloneElement(children, {
                onClick: handleScanClick
            })}
        </div>
    );
}

export const Scanner = ({onScan, children = defaultScanButton, defaultOpen = false}) => {
    if (Capacitor.isNativePlatform()) {
        return <ScannerNative onScan={onScan} children={children} defaultOpen={defaultOpen}  />;
    } else {
        return <ScannerWebComponent onScan={onScan} children={children} defaultOpen={defaultOpen} />;
    }
};
  const startScan = async (onScan, modal) => {
    
    // The camera is visible behind the WebView, so that you can customize the UI in the WebView.
    // However, this means that you have to hide all elements that should not be visible.
    // You can find an example in our demo repository.
    // In this case we set a class `barcode-scanner-active`, which then contains certain CSS rules for our app.
    document.querySelector('body')?.classList.add('barcode-scanner-active');
    
    // Add the `barcodeScanned` listener
    const listener = await BarcodeScanner.addListener(
      'barcodeScanned',
      async result => {
        // Make all elements in the WebView visible again
        document
          .querySelector('body')
          ?.classList.remove('barcode-scanner-active');
        if (onScan) {
            onScan(result.barcode.displayValue);
        }
        
        modal.close();
        console.log(result.barcode);
      },
    );
  
    // Start the barcode scanner
    await BarcodeScanner.startScan({formats: [BarcodeFormat.QrCode]});
    await setZoomRatio();
  };
  
  const stopScan = async () => {
    // Make all elements in the WebView visible again
    document.querySelector('body')?.classList.remove('barcode-scanner-active');
  
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

