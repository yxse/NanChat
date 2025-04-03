import { useState, useEffect, useMemo, useContext } from "react";

import { FaExchangeAlt } from "react-icons/fa";
import { FaAddressBook, FaCheck, FaCopy } from "react-icons/fa6";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { networks } from "../utils/networks";
import { Button, NavBar, Popup, Toast, CheckList, SearchBar, Space, DotLoading, Image, Modal, List, Input, Form, NoticeBar, Badge, Divider, CenterPopup } from "antd-mobile";
import { LedgerService } from "../ledger.service";
import { ConnectLedger, connectLedger, LedgerSelect } from "./Initialize/Start";
import NetworkList from "./app/NetworksList";
import { useNavigate } from "react-router-dom";
import useSWR, { useSWRConfig } from "swr";
import { fetchFiatRates, getCurrencyLogo } from "../nanswap/swap/service";
import { CircleFlag } from "react-circle-flags";
import useLocalStorageState from "use-local-storage-state";
import { MdBackup, MdContactMail, MdHowToVote, MdLogout, MdOutlineCleaningServices, MdOutlineFingerprint, MdOutlinePassword, MdOutlineSecurity, MdOutlineSettingsBackupRestore, MdOutlineTimer, MdSettingsBackupRestore } from "react-icons/md";
import { getAccount } from "./getAccount";
import * as webauthn from '@passwordless-id/webauthn'
import { AiOutlineContacts, AiOutlineFormatPainter } from "react-icons/ai";
import { RiContactsFill } from "react-icons/ri";
import BackupSecretPhrase from "./app/BackupSecretPhrase";
import { decrypt, encrypt } from "../worker/crypto";
import { BsCurrencyExchange } from "react-icons/bs";
import { AddressBookFill, BellOutline, DeleteOutline, DownlandOutline, EditSOutline, ExclamationCircleOutline, ExclamationTriangleOutline, GlobalOutline, LockOutline, UnorderedListOutline, UserContactOutline } from "antd-mobile-icons";
import NetworksSwitch from "./app/NetworksSwitch";
import { LedgerContext } from "./Popup";
import { BiHistory } from "react-icons/bi";
import { FiAtSign } from "react-icons/fi";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import ProfileHome from "./messaging/components/profile/ProfileHome";
import { getSeed, removeSeed } from "../utils/storage";
import { copyToClipboard } from "../utils/format";
import { useWindowDimensions } from "../hooks/use-windows-dimensions";
import { useHideNavbarOnMobile } from "../hooks/use-hide-navbar";

export const ResponsivePopup =  ({ children, visible, onClose, closeOnMaskClick = true, ...props }) => {
  const { isMobile } = useWindowDimensions();
  if (isMobile) {
    return <Popup visible={visible} onClose={onClose} closeOnMaskClick={closeOnMaskClick}  {...props}>
      {children}
    </Popup>
  }
  return <CenterPopup visible={visible} onClose={onClose} closeOnMaskClick={closeOnMaskClick} 
  {...props}
  bodyStyle={{...props.bodyStyle, width: 500}}
   >
    {children}
  </CenterPopup>
}

export const ManageNetworks = ({}) => {
  const [networksSwitchVisible, setNetworksSwitchVisible] = useState(false)
  return  <>
  {/* <List.Item
    prefix={<GlobalOutline fontSize={24} />}
    onClick={() => {
      setNetworksSwitchVisible(true)
    }}
  >
    Networks
  </List.Item> */}
  <div className="text-center mt-8 text-sm text-gray-400 cursor-pointer" onClick={() => setNetworksSwitchVisible(true)}>
          Manage networks
  </div>
  <ResponsivePopup
  visible={networksSwitchVisible}
  onClose={() => setNetworksSwitchVisible(false)}
  closeOnMaskClick={true}
  >
  <NetworksSwitch />
</ResponsivePopup>
</>
}

export function CopyToClipboard({ text, hideCopyIcon = false, textToDisplay }: { text: string, hideCopyIcon?: boolean, textToDisplay?: string }) {
  return (
    <div
    style={{alignItems: 'baseline', color: 'var(--adm-color-text-secondary)'}}
      className="flex items-center group py-1 rounded cursor-pointer justify-center"
      role="button"
      onClick={() => {
        copyToClipboard(text).then(() => {
            Toast.show({
              content: "Copied!",
              duration: 1000,
            });
          },
        );
      }}
    >
      <p className=" text-bold group-hover:opacity-80 transition-all break-all text-sm text-center mb-4">
        {textToDisplay ? textToDisplay : text}
      </p>
      {
        !hideCopyIcon && <div>
          <div className="ml-2 hover:opacity-80 transition-all focus:outline-none  group-hover:block group-active:!hidden text-center">
            <FaCopy className="" />
          </div>
          <div>
            <FaCheck className="ml-2  hidden group-active:block transition-all" />
          </div>
        </div>
      }
    </div>
  );
}
export const showLogoutSheet = async () => {
  let actionSheet1 = showActionSheet({
    actions: [
      { key: '1',
        text: 'Continue',
        danger: false,
        description: '',
        onClick: () => {
        // actionSheet1.close()
        let actionSheet = showActionSheet({
          actions: [
            { key: '1',
              text: <div className="flex items-center gap-2 justify-center">
                <ExclamationCircleOutline />
                Remove Secret Phrase and Log Out</div>,
              danger: true,
              description: '',
              onClick: async () => {
              await removeSeed()
              actionSheet.close()
              actionSheet1.close()
              window.location.reload()
            }
          },
          { 
            key: '2',
            text: 'Cancel', onClick: () => {
              actionSheet.close()
              actionSheet1.close()
            }
          }
          ]
        })
        // localStorage.clear()
        // navigate("/")
      }
    },
    { 
      key: '2',
      text: 'Cancel', onClick: () => {
        actionSheet1.close()
      }
    }
    ]
    , extra: <div
    className="text-center text-xl flex items-center justify-center gap-2"
    style={{color: 'var(--adm-color-warning)'}}
    ><ExclamationTriangleOutline fontSize={24} style={{minWidth: 24}} />
    Make sure you have saved the secret recovery phrase of your wallet. You will not be able to recover your funds without it.
    </div>
  })
}
      
export default function Settings({ isNavOpen, setNavOpen }: { isNavOpen: boolean, setNavOpen: Function }) {
  const {ledger, setLedger} = useContext(LedgerContext);
  const [isPasswordEncrypted, setIsPasswordEncrypted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const navigate = useNavigate();
  const [option, setSelectedOption] = useState({
    value: "XNO",
    label: "XNO",
    hex: "#6495ED",
  });
  const { cache } = useSWRConfig()
  useHideNavbarOnMobile(true)
  const options = [
    { value: "XNO", label: "XNO", hex: "#6495ED" },
    { value: "XDG", label: "XDG", hex: "#A7C7E7" },
    { value: "XRO", label: "XRO", hex: "#F0FFFF" },
    { value: "BAN", label: "BAN", hex: "#FFFF8F" },
  ];

  const moveBackward = () => {
    const currentIndex = options.findIndex((x) => x.label === option.label);
    const newIndex = (currentIndex - 1 + options.length) % options.length;
    setSelectedOption(options[newIndex]);
  };

  const moveForward = () => {
    const currentIndex = options.findIndex((x) => x.label === option.label);
    const newIndex = (currentIndex + 1) % options.length;
    setSelectedOption(options[newIndex]);
  };

  useEffect(() => {
    const replacePrefixes = () => {
      let newAddress = address;
      options.forEach((opt) => {
        if (address && address.startsWith(opt.value)) {
          newAddress = address.replace(opt.value, option.value);
        }
      });
      setAddress(newAddress?.replace("nano", "xno") as string);
    };

    // replacePrefixes();
    let newAddress =
      networks[option.value].prefix + "_" + address?.split("_")[1];
    setAddress(newAddress);
  }, [address, option, options]);

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), 600);

    (async () => {
      let account = await getAccount(option.value);
      setAddress(account);
    })();

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    getSeed().then((seed) => {
      setIsPasswordEncrypted(seed.isPasswordEncrypted);
    })
  }
  , [])


  const SelectBaseCurrency = () => {
    const { data, isLoading, error } = useSWR('fiat', fetchFiatRates)
    const [visible, setVisible] = useState(false)
    const [selected, setSelected] = useLocalStorageState("baseCurrency", { defaultValue: "USD" })
    const [searchText, setSearchText] = useState('')
    const filteredItems = useMemo(() => {
      if (searchText) {
        return Object.keys(data).filter(item => item.toLowerCase().includes(searchText.toLowerCase())).reduce((obj, key) => {
          obj[key] = data[key]
          return obj
        }
          , {})
        return items.filter(item => item.includes(searchText))
      } else {
        return data
      }
    }, [data, searchText])

    return (<List.Item
      onClick={() => setVisible(true)}
      prefix={<BsCurrencyExchange size={24} />}
      clickable={true}>
      <div className="" >
        <div className="flex flex-row justify-between ">
          <div>
            Base Currency
          </div>
          <div className="flex items-center space-x-2">
            <div>
              {selected}
            </div>
          </div>
        </div>
      </div>
      <ResponsivePopup
        visible={visible}
        onMaskClick={() => {
          setVisible(false)
        }}
        destroyOnClose
      >
        <div className="searchBarContainer">
          <SearchBar
            placeholder='Search Currency'
            value={searchText}
            onChange={v => {
              setSearchText(v)
            }}
          />
        </div>
        <div className="checkListContainer">
          {
            isLoading && <DotLoading />
          }
          {
            error && <div>Error loading currencies</div>
          }
          {
            !isLoading && !error &&
            <CheckList
              className=""
              defaultValue={selected ? [selected] : []}
              onChange={val => {
                if (val.length > 0) {
                  setSelected(val[0])
                  setVisible(false)
                }
              }}
            >
              {
                data && Object.keys(filteredItems).map((currency) => (
                  <CheckList.Item key={currency} value={currency}>
                    <div className="flex items-center space-x-2">
                      {/* <CircleFlag countryCode={currency.slice(0, 2).toLowerCase()} width="30" cdnUrl={} /> */}
                      <Image src={getCurrencyLogo(currency)} className="w-8 h-8" />
                      <div>
                        {currency}
                      </div>
                    </div>
                  </CheckList.Item>
                ))
              }
            </CheckList>
          }
        </div>
      </ResponsivePopup></List.Item>
    )
  }

  const ChangeRep = () => {
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();
    return <>
      <ResponsivePopup
        visible={visible}
        onClose={() => {
          setVisible(false);
        }}
        onClick={() => setVisible(false)}
        closeOnMaskClick={true}
      >
        <div>
          <div className="text-2xl  text-center p-2">
            Change Representative
          </div>
        </div>
        <NetworkList showRepresentative={true} hidePrice={true} onClick={(ticker) => {
          // setNavOpen(false);
          navigate('/' + ticker + "/" + "representative");
        }} />
      </ResponsivePopup>
      <List.Item
       onClick={() => setVisible(true)}
              prefix={<MdHowToVote size={24} />}
              clickable>
      <div className="w-full">
        Change Representative
      </div>
            </List.Item>
    </>
  }
  return (
    <>
      <div
className="mb-24"
      // id="slider"
      >
        <NavBar
          className=" app-navbar "
          onBack={() => {
            navigate("/me");
          }}
          backArrow={true}>
          <span className="">Settings</span>
        </NavBar>
        <div
          className={``}
        >
          <List mode="card">
          
              <SelectBaseCurrency />
            
            <List.Item
              prefix={<AiOutlineFormatPainter size={24} />}
              onClick={() => {
                Modal.show({
                  closeOnMaskClick: true,
                  title: "Theme",
                  content: (
                    <div>
                      <CheckList
                      defaultValue={localStorage.getItem("theme") ? [localStorage.getItem("theme")] : ["system"]}
                      onChange={(val) => {
                          // setTheme(val);
                          console.log(val);
                          localStorage.setItem("theme", val[0]);
                        }}
                      >
                        <CheckList.Item
                          value="dark"
                          onClick={() => {
                            document.body.classList = "dark-theme";
                            document.documentElement.setAttribute("data-prefers-color-scheme", "dark");
                            // setTheme("dark");
                          }}
                        >
                          Dark
                        </CheckList.Item>
                        <CheckList.Item
                          value="light"
                          onClick={() => {
                            document.body.classList = "light-theme";
                            // set light data preferred
                            document.documentElement.setAttribute("data-prefers-color-scheme", "light");
                            // setTheme("light");
                          }}
                        >
                          Light
                        </CheckList.Item>
                        <CheckList.Item
                          value="natrium"
                          onClick={() => {
                            document.body.classList = "natrium-theme";
                            document.documentElement.setAttribute("data-prefers-color-scheme", "dark");
                            // setTheme("natrium");
                          }}
                        >
                          Natrium
                        </CheckList.Item>
                        <CheckList.Item
                          value="system"
                          onClick={() => {
                            localStorage.removeItem("theme");
                            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                              document.body.classList = "dark-theme";
                              document.documentElement.setAttribute("data-prefers-color-scheme", "dark");
                            }
                            else {
                              document.body.classList = "light-theme";
                              document.documentElement.setAttribute("data-prefers-color-scheme", "light");
                            }
                          }}
                        >
                          System
                        </CheckList.Item>
                      </CheckList>
                    </div>
                  ),
                });

              }}>
              Theme
            </List.Item>
            
            <List.Item
            onClick={() => {
              navigate("/settings/notification")
            }}
              prefix={<BellOutline fontSize={24} />}
            >Notifications</List.Item>
          </List>
  <div className="my-4" />

          <List mode="card">
          {/* <ManageNetworks /> */}
          
            <List.Item prefix={<MdOutlineSecurity size={24} />}
              onClick={() => {
                navigate("/settings/security")
              }}
            >Security</List.Item>
            {
              !ledger &&
            <BackupSecretPhrase />
            }

              <ChangeRep />
            
           </List>
          <div className="my-4" />
          <List mode="card">
            <List.Item prefix={<BiHistory size={24} />} onClick={() => navigate("/swap")}>
              Swap History
            </List.Item>
            <List.Item
             prefix={<FiAtSign size={24} />}
              onClick={() => {
                navigate("/settings/alias");
              }}
              
            >
            <div className="flex justify-between">
            <div>
            Nano Alias
            </div>
            </div>
            </List.Item>
          </List>
        
          {/* <div className="my-4" /> */}
          {/* <List> */}
            {/* Currently /sign works only for requested signature, standalone sign might be not much useful for user */}
            {/* <List.Item
              prefix={<EditSOutline fontSize={24} />}
            >Sign a Message</List.Item> */}
            



          {/* </List> */}
          <div className="my-4" />
          <List mode="card">
            <List.Item 
            prefix={<DownlandOutline fontSize={24} />}
            onClick={() => navigate('/files')}>
              Downloaded files
            </List.Item>
          </List>
          <div className="my-4" />
          <List mode="card">
            <List.Item
              prefix={
                <DeleteOutline fontSize={24} />
              }
              onClick={() => {
                // clean all history cache
                let count = 0
                for (var key in localStorage) {
                  if (key.startsWith("history-") || key.startsWith("work-") || key.startsWith("message-") || key.startsWith("chat_")) {
                    localStorage.removeItem(key)
                    count++
                  }
                }
                cache.clear()
                localStorage.removeItem("app-cache")
                Toast.show({
                  icon: "success",
                  content: `Cleared ${count} items from cache`
                })
              }}
            >
              Clear Cache
            </List.Item>
            {/* <List.Item
              prefix={<DeleteOutline fontSize={24} color="red" />}
              onClick={() => localStorage.removeItem("contacts")}
            >
              Remove all contacts
            </List.Item> */}
            <List.Item
              prefix={<MdLogout fontSize={24} color="red" />}
              onClick={async () => {
                await showLogoutSheet()
              }}
            >
              Log Out
            </List.Item>
          </List>
          <div className="m-2 space-y-3 mb-4">
            {
              isPasswordEncrypted &&
              <Button
              shape="rounded"
              size="large"
                className="w-full"
                onClick={() => {
                  window.location.reload();
                }}
              >
                <Space className="flex items-center justify-center">
                  <LockOutline />
                Lock Wallet
                </Space>
              </Button>
            }
            <div className="mt-4 pb-4">
            <LedgerSelect 
            onConnect={() => {
              navigate("/")
            }}
              onDisconnect={() => {
                navigate("/")
              }}
            />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
