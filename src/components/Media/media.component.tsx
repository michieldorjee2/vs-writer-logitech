// Minimal stub - not used for logo grid in image mode
interface MediaBlockProps {
    asset?: { assetAttributes?: { url?: string; alt?: string; additionalStyleClassNames?: string } | null } | null;
    [extra: string]: unknown;
}

const MediaBlock = (props: MediaBlockProps) => {
    if (props.asset?.assetAttributes?.url) {
        return <img src={props.asset.assetAttributes.url} alt={props.asset.assetAttributes.alt || ''} />;
    }
    return null;
};

export default MediaBlock;
