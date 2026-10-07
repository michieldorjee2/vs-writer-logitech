/** One logo or media tile. Every field is optional because the grid reads them defensively. */
export interface LogoMediaItem {
    asset?: {
        type?: string;
        assetAttributes?: { url?: string; alt?: string; caption?: string; linkUrl?: string };
    } | null;
}

export interface LogoGridProps {
    logoMedia?: LogoMediaItem[];
    heading?: string;
    nonLogos?: boolean;
    mediaComponents?: boolean;
}
