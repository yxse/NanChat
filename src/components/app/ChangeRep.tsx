import { BiInfoCircle, BiPaste, BiReceipt } from "react-icons/bi";
import { networks } from "../../utils/networks";
import { SlArrowDownCircle, SlArrowUp, SlArrowUpCircle } from "react-icons/sl";
import { AiOutlineSwap } from "react-icons/ai";
import {
  Button,
  Card,
  DotLoading,
  Form,
  Input,
  Modal,
  NavBar,
  NoticeBar,
  Result,
  TextArea,
  Toast,
} from "antd-mobile";
import { ScanCodeOutline, TextOutline } from "antd-mobile-icons";

import { useContext, useEffect, useState } from "react";
import Receive from "./Receive";
import { QRCodeSVG } from "qrcode.react";
import { CopyToClipboard } from "../Settings";
import { getAccount } from "../getAccount";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR, { mutate } from "swr";
import { MdContentPaste } from "react-icons/md";
import { Representative, RepresentativeList } from "./NetworksList";
import { WalletContext } from "../Popup";
import { convertAddress, pasteFromClipboard } from "../../utils/format";
import { Scanner } from "./Scanner";
import { PasteIcon } from "./Icons";
import { useTranslation } from 'react-i18next';

export default function ChangeRep() {
  const { t } = useTranslation();
  // const [result, setResult] = useState<string>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [newRep, setNewRep] = useState<string>(null); // to refresh on change of rep when account not yet opened
  const [form] = Form.useForm();
  const { ticker } = useParams();
  const {wallet} = useContext(WalletContext);
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  async function changeRep(ticker, rep) {
    await wallet.wallets[ticker].change({
      account: activeAccount,
      newRep: rep,
    });
  }

  return (
    <div className="">
      <div className="">
        <div className="">
          <NavBar 
          className="app-navbar "
          onBack={() => navigate(`/me/settings`)}>
            {t('changeRepresentative', { network: networks[ticker].name })}
          </NavBar>
          <Card style={{maxWidth: 600, marginLeft: 'auto', marginRight: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
          <div className="flex justify-center m-2">
            <img
              src={networks[ticker].logo}
              alt={`${ticker} logo`}
              width={48}
            />
          </div>

          <Modal
            visible={open}
            onClose={() => setOpen(false)}
            title={t('onlineRepresentatives')}
            closeOnMaskClick
            content={
              <RepresentativeList ticker={ticker} onClick={async (address) => {
                await changeRep(ticker, address)
                setOpen(false);
                mutate("representative-" + ticker);
                setNewRep(address);
              }} />
            }
            showCloseButton
          />
          <Representative ticker={ticker} condensed={false} newLocalRep={newRep} />


          <div 
          style={{maxWidth: 600, marginLeft: 'auto', marginRight: 'auto'}}
          className="flex justify-between flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-2 m-2 mt-8">
            <Button
              block
              size="large"
              shape="rounded"
              color="primary"
              onClick={() => {
                setOpen(true);
              }}
            >
              {t('pickFromAList')}
            </Button>
            <Button
            size="large"
            shape="rounded"
              loading={isLoading}
              block
              color="default"
              onClick={() => {
                let modal = Modal.show({
                  closeOnMaskClick: true,
                  title: t('setRepresentative'),
                  content: (
                    <>
                      <Form
                        initialValues={{
                          address: searchParams.get("address") || "",
                        }}
                        form={form}
                        className="mt-4"
                        layout="vertical"
                        onFinish={async (values) => {
                          try {
                            await changeRep(ticker, values.address);
                            mutate("representative-" + ticker);
                            setNewRep(values.address);
                          } catch (error) {
                            console.error("Error changing rep:", error);
                            Toast.show({
                              content: error.message,
                            });
                          }
                        }}
                      >
                        <div className="flex justify-between">
                          <Form.Item
                            label={t('address')}
                            name={"address"}
                            style={{ width: "100%" }}
                          >
                            <TextArea
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              placeholder={t('newRepresentativeAddress')}
                              rows={2}
                            />
                          </Form.Item>
                          <Scanner 
                            onScan={(result) => {
                              form.setFieldValue("address", result);
                            }} 
                            >
                               <ScanCodeOutline
                            fontSize={24}
                            className="cursor-pointer text-gray-200 mr-3 mt-4"
                            />
                            </Scanner>
                          <PasteIcon fontSize={24} className="cursor-pointer text-gray-200 mr-4 mt-4"
                            onClick={() => {
                              try {
                                (async () =>
                                  form.setFieldValue("address", await pasteFromClipboard()))();
                              }
                              catch (error) {
                                console.error("Error pasting:", error);
                                Toast.show({
                                  content: t('errorPasting'),
                                });
                              }
                            }
                            }
                          />
                        </div>
                        <Button type="submit" color="primary" block onClick={async () => {
                          modal.close();
                        }}>
                          {t('changeRepresentative')}
                        </Button>
                      </Form>
                    </>
                  ),
                });
              }}
            >
              {t('manualEntry')}
            </Button>
          </div>

          <div className="text-base text-gray-400 text-left m-4 pb-16 mb-96 overflow-y-scroll  mt-10">
            <BiInfoCircle className="inline mr-2" />
            <span className="text-sm font-bold underline cursor-pointer"
              onClick={() => {
                Modal.show({
                  closeOnMaskClick: true,
                  title: t('whatIsARepresentative'),
                  content: (
                    <ul className="list-disc list-inside">
                      <li>{t('representativeExplanation1')}</li>
                      <li>{t('representativeExplanation2')}</li>
                      <li>{t('representativeExplanation3')}</li>
                      <li>{t('representativeExplanation4')}</li>
                    </ul>
                  ),
                });
              }}
            >{t('whatIsARepresentative')}</span>

          </div>
      </Card>
        </div>
      </div>
    </div>
  );
}
