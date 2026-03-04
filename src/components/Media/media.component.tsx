// Minimal stub - not used for logo grid in image mode
const MediaBlock = (props: any) => {
    if (props.asset?.assetAttributes?.url) {
        return <img src={props.asset.assetAttributes.url} alt={props.asset.assetAttributes.alt || ''} />;
    }
    return null;
};

export default MediaBlock;
