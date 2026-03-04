import { Asset } from '../../Media/types/media-asset'

export interface QuoteProps {
    quote: string;
    spokesperson: string;
    spokespersonImage?: Asset<'image'>;
    jobTitle: string;
    company: string;
    logo?: Asset<'image'>;
    quotesLength: number;
    gradientColor: string;
    quoteMarksColor: string;
    theme: 'blue' | 'green' | 'light-blue' | 'orange' | 'purple';
    index: number;
    size: 'default' | 'small';
}
