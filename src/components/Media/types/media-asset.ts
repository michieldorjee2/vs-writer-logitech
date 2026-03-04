export type AssetType = 'image' | 'video' | 'lottie';

type AssetTypes = {
    image: AssetImage;
    video: AssetVideo;
    lottie: AssetLottie;
};

type VideoObject = {
    src: string;
    type?: string;
    width?: number;
    height?: number;
};

type AssetBase = {
    type: AssetType;
    isVisible?: boolean;
    lazy?: boolean;
    background?: boolean;
    curved?: boolean;
    roundedCorners?: boolean;
    assetAttributes: {}
}

interface AssetImage extends AssetBase {
    mediaLink?: string;
    zoomable?: boolean;
    hasLightLogo?: boolean;
    isSolutionPartner?: boolean;
    assetAttributes: {
        url: string;
        alt: string;
        width?: number;
        height?: number;
        muted?: boolean;
        autoplay?: boolean;
        uploadData?: Date;
        showTranscripts: boolean;
        additionalStyleClassNames?: string;
    };
};

interface AssetVideo extends AssetBase {
    assetAttributes: {
        url: VideoObject | VideoObject[];
        loop?: boolean;
        thumbnail?: string;
        alt: string;
        width?: number;
        height?: number;
        muted?: boolean;
        autoplay?: boolean;
        uploadData?: Date;
        showTranscripts: boolean;
        closeCaptionEnabledDefault: boolean;
    };
    vttUrl?: {
        src: string;
        kind: string;
        label?: string;
        language: string;
        default?: boolean;
    }[];
};

interface AssetLottie extends AssetBase {
    AssetLink?: string;
    assetAttributes: {
        url: string;
        loop?: boolean;
        alt: string;
        width?: number;
        height?: number;
        autoplay?: boolean;
    };
};

export type Asset<T extends AssetType> = AssetTypes[T];
