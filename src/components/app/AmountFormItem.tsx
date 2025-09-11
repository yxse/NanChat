import { useTranslation } from "react-i18next";
import { useWallet } from "../useWallet";
import useSWR from "swr";
import { fetchFiatRates, fetchPrices } from "../../nanswap/swap/service";
import { fetchBalance } from "./Network";
import useLocalStorageState from "use-local-storage-state";
import { Form, Input } from "antd-mobile";
import { CgArrowsExchangeV } from "react-icons/cg";
import { formatAmountMega } from "../../utils/format";
import { convertAddress } from "../../utils/convertAddress";
import BigNumber from "bignumber.js";

export const AmountFormItem = ({ form, amountType, setAmountType, ticker , type="send", label = "", rulesMinMax}) => {
  const { t } = useTranslation();
  const {wallet} = useWallet()
  const activeAccount = convertAddress(wallet.accounts.find((account) => account.accountIndex === wallet.activeIndex)?.address, ticker);

  const { data: fiatRates, isLoading, error } = useSWR('fiat', fetchFiatRates);
  const { data: balance, isLoading: balanceLoading } = useSWR(
    "balance-" + ticker + "-" + activeAccount,
    () => fetchBalance(ticker, activeAccount),
  );
  const { data: prices, isLoading: isLoadingPrices } = useSWR(
    "prices",
    fetchPrices,
  );
  const [selected] = useLocalStorageState("baseCurrency", {defaultValue: "USD"})

  const isAmountFiat = amountType === "fiat";
  const formItemName = isAmountFiat ? "amountFiat" : "amount";
  // const label = isAmountFiat ? t('amountFiat', { currency: selected }) : t('amount');
  const currency = isAmountFiat ? selected : ticker;

  const getFiatRate = () => {
    if (!fiatRates || !fiatRates[selected]) return 1;
    return fiatRates[selected];
  };

  const switchAmountType = () => {
    const newAmountType = isAmountFiat ? "crypto" : "fiat";
    setAmountType(newAmountType);
    const currentAmount = form.getFieldValue(formItemName);
    if (!currentAmount) return;
    const fiatRate = getFiatRate();
    const newAmount = isAmountFiat
      ? currentAmount / (prices[ticker]?.usd * fiatRate)
      : currentAmount * prices[ticker]?.usd * fiatRate;
    form.setFieldValue(newAmountType === "fiat" ? "amountFiat" : "amount", newAmount);
  };

  const setMaxAmount = () => {
    const fiatRate = getFiatRate();
    const maxAmount = isAmountFiat ? balance * prices[ticker]?.usd * fiatRate : balance;
    form.setFieldValue(formItemName, maxAmount);
    updateOtherAmountField(maxAmount);
  };

  const getAvailableAmount = () => {
    const fiatRate = getFiatRate();
    if (prices?.[ticker] == null) return "..";
    const fiatAmount = (balance * prices[ticker]?.usd * fiatRate).toFixed(2);
    return isAmountFiat
      ? `${fiatAmount} ${selected} (${formatAmountMega(balance, ticker)} ${ticker})`
      : `${formatAmountMega(balance, ticker)} ${ticker}`;
  };

  const updateOtherAmountField = (value) => {
    const fiatRate = getFiatRate();
    const otherFieldName = isAmountFiat ? "amount" : "amountFiat";
    const convertedValue = isAmountFiat
      ? value / (prices[ticker]?.usd * fiatRate)
      : value * prices[ticker]?.usd * fiatRate;
    form.setFieldValue(otherFieldName, convertedValue);
  };

  const handleInputChange = (e) => {
    const value = e
    if (isNaN(value)) return;
    updateOtherAmountField(value);
  };

  if (isLoading) return <div>{t('loading', 'Loading...')}</div>;
  if (error) return <div>{t('errorLoadingFiatRates', 'Error loading fiat rates')}</div>;

  const rules = [
    
   
  ]
  if (type === "send" || type === "airdrop") {
    rules.push({
      validateTrigger: "onConfirm",
      required: true,
      message: t('pleaseEnterAmount'),
      type: "number",
      transform: (value) => parseFloat(value),
    });
    rules.push({
      validateTrigger: "onConfirm",
      validator: async (rule, value) => {
        if (value <= 0) {
          throw new Error(t('amountMustBeGreaterThanZero'));
        }
      },
    });
    rules.push( {
      validateTrigger: "onConfirm", // allow to not show error while typing amount, only on submit
      required: true,
      message: t('availableAmount', { amount: getAvailableAmount() }),
      type: "number",
      // transform: (value) => parseFloat(value),
      min: 0,
      validator: async (rule, value) => {
        if (new BigNumber(value).isGreaterThan(balance)) {
          throw new Error("Not enough balance");
        }
      },
      // max: isAmountFiat ? +balance * prices[ticker].usd * getFiatRate() : +balance,
  });
}
if (type === "airdrop"){
    rules.push( {
      validateTrigger: "onConfirm", // allow to not show error while typing amount, only on submit
      required: true,
      message: t('max') + " " + rulesMinMax?.max + " " + ticker + " per Red Packet",
      type: "number",
      transform: (value) => parseFloat(value),
      max: rulesMinMax?.max, 
    });
    rules.push( {
      validateTrigger: "onConfirm", // allow to not show error while typing amount, only on submit
      required: true,
      type: "number",
      transform: (value) => parseFloat(value),
      min: rulesMinMax?.min, 
    });
  }

  return (
    <Form.Item
    normalize={(value, prevValue) => {
      value = value?.replace(/,/g, ".") // fix issue with comma in input, like netherlands region with english language on iOS
      if (isNaN(value)) return prevValue;
      return value;
    }}
    className="form-list"
      name={formItemName}
      label={label}
      style={type == "airdrop" ? {"textAlign": "left", "--align-items": "center"} : {}}
      validateFirst
      required={false}
      extra={
        type == "airdrop" ? currency : // show currency only for airdrop
        <div 
        className="flex justify-between space-x-2 items-center mr-22">
          <div
          style={{}}
           className="flex items-center cursor-pointer" onClick={switchAmountType}>
            {currency}
            <CgArrowsExchangeV size={20} />
          </div>
          {
            type === "send" &&
          <span 
          style={{ borderBottom: "1px dashed", cursor: "pointer" }}
           onClick={setMaxAmount}>
            {t('max')}
          </span>
          }
        </div>
      }
      rules={rules}
    >
      <Input
      style={type === "airdrop" ? {"--text-align": "right"} : {}}
      id="amount"
      className="form-list"
      step={"any"}
      autoComplete="off"
      autoFocus={type === "receive"}
        clearable
        type="text"
        inputMode="decimal"
        onChange={handleInputChange}
        placeholder={type === "airdrop" ? "0.0": t('enterAmount')}
      />
    </Form.Item>
  );
};