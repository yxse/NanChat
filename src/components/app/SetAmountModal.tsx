import { Form, Modal } from 'antd-mobile';
import React, { useState } from 'react'
import { AmountFormItem } from './AmountFormItem';

function SetAmountModal({ticker, visible, setVisible, onOk}) {
  const [form] = Form.useForm();
  const [amountType, setAmountType] = useState("crypto");
  return (
    <Modal
    bodyClassName='disable-keyboard-resize'
    actions={[
      {
        key: "ok",
        text: "Ok",
        primary: true,
        onClick: () => {
          setVisible(false);
          onOk(form.getFieldValue('amount'));
        },
      },
      {
        style: { 
          color: 'var(--adm-color-text)',
         },
        key: "cancel",
        text: "Cancel",
        onClick: () => {
          setVisible(false);
        },
      },
    ]
    }
     content={
      <Form form={form} layout='vertical'>
        <AmountFormItem
        ticker={ticker}
        amountType={amountType}
        form={form}
        setAmountType={setAmountType}
        type='receive'
        />
      </Form>
    } closeOnMaskClick={true} visible={visible} onClose={() => {
      setVisible(false);
     }} />
  )
}

export default SetAmountModal