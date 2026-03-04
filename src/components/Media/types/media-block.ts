import { Asset, AssetType } from "./media-asset";

export interface MediaBlockProps {
    children?: React.ReactNode;
    background?: boolean;
    blockBackground: boolean;
    asset: Asset<AssetType>;
    solutionPartner?: boolean;
    hasLightLogo?: boolean;
    layout?: 'left' | 'center' | 'right';
    roundedCorners: boolean;
    resourcesHero?: boolean;
    onVideoPlayingChange?: (isPlaying: boolean) => void;
    playClick?: boolean;
    resetPlayClick?: (value: boolean) => void;
}
