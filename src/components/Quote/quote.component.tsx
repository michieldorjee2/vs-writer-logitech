import { QuoteProps } from './types/Quote';
import StandardQuote from './partial/_default';
import SmallQuote from './partial/_small';

const Quote = (props: QuoteProps) => {
    const { size = 'default' } = props;

    return (
        <>
            {size === 'default' && <StandardQuote {...(props as any)} />}
            {size === 'small' && <SmallQuote {...(props as any)} />}
        </>
    );
};
export default Quote;
