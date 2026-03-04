import { QuoteListProps } from './types/quote-list-props';
import Quote from '../Quote/quote.component';

const QuoteList = ({ quotes }: QuoteListProps) => {
    const quotesLength = quotes.length;

    if (quotesLength === 4) {
        return (
            <div className="max-w-[1400px] mx-auto p-4 sm:px-14 sm:py-6 xxl:p-20">
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-4 xxl:col-span-3 lg:pt-28">
                        <Quote {...quotes[0]} quotesLength={quotesLength} index={0} />
                    </div>
                    <div className="col-span-12 lg:col-span-4 xxl:col-span-5 grid gap-6">
                        <div className="grid grid-cols-1">
                            <Quote {...quotes[1]} quotesLength={quotesLength} theme='light-blue' index={1} />
                        </div>
                        <div className="grid xxl:grid-cols-4">
                            <Quote {...quotes[2]} quotesLength={quotesLength} theme='purple' index={2} />
                        </div>
                    </div>
                    <div className="col-span-12 lg:col-span-4 lg:pt-[354px] xxl:pt-[274px]">
                        <Quote {...quotes[3]} quotesLength={quotesLength} theme='green' index={3} />
                    </div>
                </div>
            </div>
        );
    }

    if (quotesLength === 3) {
        return (
            <div className="max-w-[1400px] mx-auto p-4 md:px-14 md:py-16 xxl:px-44 xxl:py-6">
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 md:col-span-5 md:pt-44 xxl:pt-28">
                        <Quote {...quotes[0]} quotesLength={quotesLength} index={0} />
                    </div>
                    <div className="col-span-12 md:col-span-7 grid gap-6">
                        <div className="grid grid-cols-6">
                            <Quote {...quotes[1]} quotesLength={quotesLength} theme='light-blue' index={1} />
                        </div>
                        <div className="grid grid-cols-6 xxl:grid-cols-3">
                            <Quote {...quotes[2]} quotesLength={quotesLength} theme='purple' index={2} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (quotesLength === 2) {
        return (
            <div className="max-w-[1400px] mx-auto p-4 md:px-14 md:py-16 xxl:px-44 xxl:py-8">
                <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 md:col-span-1">
                        <Quote {...quotes[0]} quotesLength={quotesLength} index={0} />
                    </div>
                    <div className="col-span-2 md:col-span-1 md:pt-32">
                        <Quote {...quotes[1]} quotesLength={quotesLength} theme='purple' index={1} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto py-32">
            <Quote {...quotes[0]} quotesLength={quotesLength} index={0} />
        </div>
    );
};
export default QuoteList;
