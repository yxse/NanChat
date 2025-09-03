import { Toast } from "antd-mobile";
import { t } from "i18next";

/**
 * Handles cryptocurrency transaction sending with validation and error handling
 * @param {Object} params - Transaction parameters
 * @param {string} params.fromAddress - Sender's address
 * @param {string} params.toAddress - Recipient's address
 * @param {string|number} params.amount - Amount to send
 * @param {string} params.ticker - Currency ticker (e.g., 'NANO')
 * @param {Object} params.wallet - Wallet instance
 * @param {Object} params.form - Form instance for clearing fields
 * @param {Function} params.setIsLoading - Loading state setter
 * @param {Function} params.setResult - Result state setter
 * @param {Function} params.setSentAmount - Sent amount state setter
 * @param {Function} params.setSentTo - Sent to address state setter
 * @param {Function} params.setConfirmPopupOpen - Confirm popup state setter
 * @param {Function} params.setSuccessPopupOpen - Success popup state setter
 * @param {Function} params.mutate - SWR mutate function for cache invalidation
 * @param {Function} params.navigate - Navigation function
 * @param {Object} params.location - Location object
 * @param {Promise} params.dataBlockedAccount - Promise for blocked account check
 * @param {Promise} params.dataSend - Promise for send data
 * @param {Function} params.customNetworks - Custom networks checker
 * @param {Function} [params.onSent] - Optional callback after successful send
 * @returns {Promise<void>}
 */
export const sendTransaction = async ({
  fromAddress,
  toAddress,
  amount,
  ticker,
  wallet,
  form,
  setIsLoading,
  setResult,
  setSentAmount,
  setSentTo,
  setConfirmPopupOpen,
  setSuccessPopupOpen,
  mutate,
  navigate,
  location,
  dataBlockedAccount,
  dataSend,
  customNetworks,
  onSent
}) => {
  try {
    setIsLoading(true);
    console.log('Transaction params:', { fromAddress, toAddress, amount });

    // Check for blocked accounts (skip for ledger)
    if (!global.ledger) {
      console.log('Checking blocked account:', dataBlockedAccount);
      const isBlocked = await dataBlockedAccount;
      
      if (isBlocked?.blocked) {
        console.error('Error sending: Account blocked', isBlocked);
        Toast.show({
          icon: "fail",
          content: t('canceledBlocked'),
        });
        return;
      }
    }

    // Validate network and frontier
    console.log('Validating send data:', dataSend);
    const data = await dataSend;
    
    const isCustomNetwork = customNetworks()?.[ticker];
    const hasExistingFrontier = data.existingFrontier.error !== "Block not found";
    const tickerMismatch = data.existingFrontier.ticker !== ticker && !isCustomNetwork;

    if ((isCustomNetwork && hasExistingFrontier) || tickerMismatch) {
      console.error('Error sending: Network validation failed', data.existingFrontier.error);
      Toast.show({
        icon: "fail",
        content: t('canceledMalicious', { 
          wrongTicker: data.existingFrontier.ticker, 
          ticker 
        }),
      });
      return;
    }

    // Execute the transaction
    console.log('Executing transaction with data:', { data });
    const result = await wallet.wallets[ticker].send(data);
    setResult(result);

    if (result.error) {
      console.error('Error sending: Transaction failed', result.error);
      Toast.show({
        icon: "fail",
        content: t('errorSending', { error: result.error }),
      });
      return;
    }

    // Handle successful transaction
    setSentAmount(amount);
    setSentTo(toAddress);
    form.setFieldsValue({ address: "", amount: "" });

    // Navigation logic
    if (location.pathname !== '/' && !location.pathname.startsWith('/chat')) {
      navigate(location.pathname, { replace: true });
    }

    // Update UI state
    setConfirmPopupOpen(false);
    setSuccessPopupOpen(true);

    // Invalidate cache
    mutate("balance-" + ticker);
    mutate("history-" + ticker);

    // Call success callback if provided
    if (onSent) {
      onSent(ticker, result.hash);
    }

  } catch (error) {
    console.error('Error sending: Unexpected error', error);
    Toast.show({
      content: t('errorSending', { error: error.toString() }),
      duration: 5000,
    });
  } finally {
    setIsLoading(false);
    setConfirmPopupOpen(false);
  }
};