import { QuoteProps } from '../types/Quote';

const Quote = (props: QuoteProps) => {
    const { quote, spokesperson, company, jobTitle } = props;

    return (
        <div className={`not-rte max-w-[500px] rounded border border-vulcan-85`}>
            <div className="rounded bg-vulcan">
                <article className={`bg-gradient-vulcan rounded p-6 text-white`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g>
                            <path d="M24 8.60304V0C10.7518 0.016077 0.016077 10.7518 0 24H8.60304C8.61376 15.5009 15.5009 8.61376 24 8.60304H24Z" fill="#2C313F" />
                        </g>
                    </svg>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g>
                            <path d="M24 8.60304V0C10.7518 0.016077 0.016077 10.7518 0 24H8.60304C8.61376 15.5009 15.5009 8.61376 24 8.60304H24Z" fill="#2C313F" />
                        </g>
                    </svg>
                    <div className="my-3 font-medium leading-7">
                        {quote}
                    </div>
                    <div className="flex flex-row">
                        <div className="flex flex-col">
                            <p className="not-rte text-sm font-medium">
                                <strong className="inline-block pr-3">{spokesperson}</strong>
                                <span className="text-sm font-light">
                                    <span>{jobTitle}</span>
                                    <span>
                                        {jobTitle && company && ', '}
                                        {company}
                                    </span>
                                </span>
                            </p>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};
export default Quote;
