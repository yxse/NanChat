import { useState, useEffect, useMemo, useContext } from "react";

import { FaExchangeAlt } from "react-icons/fa";
import { FaAddressBook, FaCheck, FaCopy } from "react-icons/fa6";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { networks } from "../utils/networks";
import { Button, NavBar, Popup, Toast, CheckList, SearchBar, Space, DotLoading, Image, Modal, List, Input, Form, NoticeBar, Badge, Divider } from "antd-mobile";
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
import { AddressBookFill, BellOutline, DeleteOutline, EditSOutline, GlobalOutline, UnorderedListOutline, UserContactOutline } from "antd-mobile-icons";
import NetworksSwitch from "./app/NetworksSwitch";
import { LedgerContext } from "./Popup";
import { BiHistory } from "react-icons/bi";
import { FiAtSign } from "react-icons/fi";
import { showActionSheet } from "antd-mobile/es/components/action-sheet/action-sheet";
import ProfileHome from "./messaging/components/profile/ProfileHome";

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
  <Popup
  visible={networksSwitchVisible}
  onClose={() => setNetworksSwitchVisible(false)}
  closeOnMaskClick={true}
  >
  <NetworksSwitch />
</Popup>
</>
}

export function CopyToClipboard({ text, hideCopyIcon = false, textToDisplay }: { text: string, hideCopyIcon?: boolean, textToDisplay?: string }) {
  return (
    <div
    style={{alignItems: 'baseline'}}
      className="flex items-center group py-1 rounded cursor-pointer justify-center"
      role="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => {
            Toast.show({
              content: "Copied!",
              duration: 1000,
            });
          },
          (err) => {
            Toast.show({
              content: "Failed to copy",
            });
          },
        );
      }}
    >
      <p className="text-blue-300 text-bold group-hover:opacity-80 transition-all break-all text-sm text-center mt-4">
        {textToDisplay ? textToDisplay : text}
      </p>
      {
        !hideCopyIcon && <div>
          <div className="ml-2 hover:opacity-80 transition-all focus:outline-none  group-hover:block group-active:!hidden text-center">
            <FaCopy className="text-blue-300" />
          </div>
          <div>
            <FaCheck className="ml-2 text-blue-300 hidden group-active:block transition-all" />
          </div>
        </div>
      }
    </div>
  );
}

export default function Settings({ isNavOpen, setNavOpen }: { isNavOpen: boolean, setNavOpen: Function }) {
  const {ledger, setLedger} = useContext(LedgerContext);

  const [isVisible, setIsVisible] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const navigate = useNavigate();
  const [option, setSelectedOption] = useState({
    value: "XNO",
    label: "XNO",
    hex: "#6495ED",
  });
  const { cache } = useSWRConfig()

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

    return (<>
      <div className="" onClick={() => setVisible(true)}>
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
      <Popup
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
      </Popup></>
    )
  }

  const ChangeRep = () => {
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();
    return <>
      <Popup
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
      </Popup>
      <div className="w-full" onClick={() => setVisible(true)}>
        Change Representative
      </div>
    </>
  }
  return (
    <>
      <div
className="mb-24"
      // id="slider"
      >
        {/* <NavBar
          className="text-slate-400 text-xxl app-navbar "
          onBack={() => {
            navigate("/");
          }}
          backArrow={true}>
          <span className="">Settings</span>
        </NavBar> */}
        <div
          className={``}
        >
          <List>
          <List.Item
              prefix={<BsCurrencyExchange size={24} />}
              clickable={true}>
              <SelectBaseCurrency />
            </List.Item>
            <List.Item
              prefix={<AiOutlineFormatPainter size={24} />}
              onClick={() => {
                Modal.show({
                  closeOnMaskClick: true,
                  title: "Theme",
                  content: (
                    <div>
                      <CheckList
                        onChange={(val) => {
                          console.log(val);
                        }}
                      >
                        <CheckList.Item
                          value="dark"
                          onClick={() => {
                            document.body.classList = "dark-theme";
                            document.documentElement.setAttribute("data-prefers-color-scheme", "dark");
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
                          }}
                        >
                          Light
                        </CheckList.Item>
                        <CheckList.Item
                          value="light"
                          onClick={() => {
                            document.body.classList = "natrium-theme";
                            document.documentElement.setAttribute("data-prefers-color-scheme", "dark");
                          }}
                        >
                          Blue
                        </CheckList.Item>
                      </CheckList>
                    </div>
                  ),
                });

              }}>
              Theme
            </List.Item>
            
            <List.Item
              prefix={<BellOutline fontSize={24} />}
            >Notifications</List.Item>
          </List>
  <div className="my-4" />

          <List>
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
<List.Item
              prefix={<MdHowToVote size={24} />}
              clickable>
              <ChangeRep />
            </List.Item>
           </List>
          <div className="my-4" />
          <List>
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
        
          <div className="my-4" />
          <List>
            {/* Currently /sign works only for requested signature, standalone sign might be not much useful for user */}
            {/* <List.Item
              prefix={<EditSOutline fontSize={24} />}
            >Sign a Message</List.Item> */}
            



          </List>
          <div className="my-4" />
          <List>
            <List.Item
              prefix={
                <DeleteOutline fontSize={24} />
              }
              onClick={() => {
                // clean all history cache
                let count = 0
                for (var key in localStorage) {
                  if (key.startsWith("history-")) {
                    localStorage.removeItem(key)
                    count++
                  }
                }
                cache.clear()
                localStorage.removeItem("app-cache")
                Toast.show({
                  icon: "success",
                  content: `Cleared ${count} history items from cache`
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
              onClick={() => {
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
                            text: 'Remove Secret Phrase and Log Out', 
                            danger: true,
                            description: '',
                            onClick: () => {
                            actionSheet.close()
                            actionSheet1.close()
                            localStorage.removeItem('seed')
                            localStorage.removeItem('encryptedMasterKey')
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
                  className="text-center text-xl text-red-500">
                  Make sure you have saved the secret recovery phrase of your wallet. You will not be able to recover your funds without it.
                  </div>
                })
                    
              }}
            >
              Log Out
            </List.Item>
          </List>
          <div className="m-2 space-y-3 mb-4">
            {
              !localStorage.getItem('seed') &&
              <Button
                className="w-full"
                onClick={() => {
                  global.seed = null;
                  window.location.reload();
                }}
              >
                Lock Wallet
              </Button>
            }
            <div className="mt-4">
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
