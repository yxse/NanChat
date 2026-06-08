const Sticker = ({ stickerId, height = "75px" }) => (
    <img src={stickerId} style={{ height, marginBottom: 0, objectFit: 'contain' }} />
);

export default Sticker;
