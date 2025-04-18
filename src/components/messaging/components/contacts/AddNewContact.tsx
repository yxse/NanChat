import { Button, Card, Form, Input } from "antd-mobile"
import { networks } from "../../../../utils/networks";

export const InputAddressAndNetwork = ({ form, setSelectNetworkVisible }) => {
    const network = Form.useWatch('network', form)
    return (<>
        <Form.Item
            name={'network'}
            label='Network' onClick={() => setSelectNetworkVisible(true)}>
            <Input
                placeholder='Network'
            />
        </Form.Item>
        {
            (network === "ALL" || networks[network]) &&
            <Form.Item label='Address' name={'address'}>
                <Input
                    placeholder={(networks[network]?.prefix || 'nano') + '_'}
                />
            </Form.Item>
        }
    </>);
};

export const CardAddNewContact = ({
    setAddContactVisible,
    defaultName, 
    defaultNetwork,
    defaultAddress,
    handleAddContact,
    form,
    setSelectNetworkVisible
}) => {
    return <Card>
        <div className="text-center text-xl p-2 mb-4">
            Add Contact
        </div>

        <Form 
        initialValues={{
            name: defaultName || "",
            network: defaultNetwork || "",
            address: defaultAddress || "",
        }}
        layout='horizontal' form={form}>
            <Form.Item label='Name' name={'name'}>
                <Input
                autoFocus
                    placeholder='Name'
                />
            </Form.Item>
            <InputAddressAndNetwork 
            setSelectNetworkVisible={setSelectNetworkVisible}
            form={form} />
        </Form>
        <Button
            className='w-full mt-4'
            onClick={() => {
                form.validateFields().then((values) => {
                    handleAddContact(values);
                    setAddContactVisible(false);
                }).catch((err) => {
                    console.log(err);
                })
            }}
            size='large'
            color='primary'
            shape='rounded'
        >
            Add Contact
        </Button>
        <Button
            className='w-full my-4'
            onClick={() => setAddContactVisible(false)}
            size='large'
            shape='rounded'

        >
            Close
        </Button>
    </Card>
}