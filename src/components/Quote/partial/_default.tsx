import { QuoteProps } from '../types/Quote';

const Quote = (props: QuoteProps) => {
    const {
        quote,
        spokespersonImage,
        spokesperson,
        company,
        jobTitle,
        logo,
        quotesLength,
        theme = 'blue',
        index
    } = props;

    let quoteMarksColor: string = '';
    let borderColor: string = '';
    let dynamicStyles: string = '';

    switch (theme) {
        case 'light-blue':
            quoteMarksColor = '#00CCFF';
            borderColor = 'border-[var(--light-blue-60-shade)]';
            break;
        case 'purple':
            quoteMarksColor = '#9E4AFF';
            borderColor = 'border-[var(--purple-80-shade)]';
            break;
        case 'green':
            quoteMarksColor = '#3BE081';
            borderColor = 'border-[var(--green-60-shade)]';
            break;
        case 'orange':
            quoteMarksColor = '#ff8110';
            borderColor = 'border-[var(--orange-60-shade)]';
            break;
        default:
            quoteMarksColor = '#194BFF';
            borderColor = 'border-optimizely-blue-80-shade';
            break;
    }

    if (quotesLength === 1) {
        dynamicStyles = 'max-w-[75%] mx-auto';
    }

    if (quotesLength === 3 && index === 1) {
        dynamicStyles = 'col-span-6 xxl:col-span-5 xxl:col-start-2';
    }

    if (quotesLength === 3 && index === 2) {
        dynamicStyles =
            'col-span-6 md:col-span-5 md:col-start-2 xxl:col-span-2 xxl:col-start-1';
    }

    if (quotesLength === 4 && index === 2) {
        dynamicStyles = 'xxl:col-span-3 xxl:col-start-2';
    }

    return (
        <div
            className={`not-rte rounded border hover:shadow-card-hover focus:shadow-card-hover ${borderColor} ${dynamicStyles} mx-auto max-w-5xl`}
        >
            <div className="rounded bg-vulcan">
                <article className={`rounded p-8 text-white`}>
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <g>
                            <path
                                d="M24 8.60304V0C10.7518 0.016077 0.016077 10.7518 0 24H8.60304C8.61376 15.5009 15.5009 8.61376 24 8.60304H24Z"
                                fill={`${quoteMarksColor}`}
                            />
                        </g>
                    </svg>
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <g>
                            <path
                                d="M24 8.60304V0C10.7518 0.016077 0.016077 10.7518 0 24H8.60304C8.61376 15.5009 15.5009 8.61376 24 8.60304H24Z"
                                fill={`${quoteMarksColor}`}
                            />
                        </g>
                    </svg>
                    <div className="my-6">
                        {quote}
                    </div>
                    <div className="flex flex-row">
                        {spokespersonImage?.assetAttributes?.url && (
                            <div className="mr-3">
                                <img
                                    className="aspect-square w-10 rounded-full"
                                    alt={`${spokesperson}`}
                                    src={spokespersonImage.assetAttributes.url}
                                />
                            </div>
                        )}
                        <div className="flex flex-col">
                            <p className="not-rte text-sm font-medium">
                                {spokesperson}
                            </p>
                            <p className="not-rte text-sm">
                                <span>{jobTitle}</span>
                                <span>
                                    {jobTitle && company && ', '}
                                    {company}
                                </span>
                            </p>
                            {logo?.assetAttributes?.url && (
                                <div>
                                    <img
                                        className="mt-3 h-[3rem] !max-w-[125px]"
                                        src={logo?.assetAttributes?.url}
                                        alt={logo?.assetAttributes.alt}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};
export default Quote;
