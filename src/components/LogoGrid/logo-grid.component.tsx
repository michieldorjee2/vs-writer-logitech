import { useState, useEffect, useRef, forwardRef } from 'react';
import MediaBlock from '../Media/media.component';
import { useWindowSize, useRafLoop } from 'react-use';
import { motion, useMotionValue } from 'framer-motion';
import { LogoGridProps } from './types/LogoGridProps';

type MarqueeItemProps = {
    nonLogos: boolean;
    children: React.ReactNode;
    isInMiddleThird: boolean;
};

const MarqueeItem = forwardRef(
    ({ nonLogos, children, isInMiddleThird }: MarqueeItemProps, parentRef: any) => {
        const itemRef = useRef<HTMLDivElement>(null);
        const rectRef = useRef<DOMRect | null>(null);

        const x = useMotionValue(0);
        const speed = isInMiddleThird ? 0.33 : 1;

        const size = useWindowSize();

        const setX = () => {
            if (!itemRef.current || !rectRef.current) {
                return;
            }

            const xPercentage = (x.get() / rectRef.current.width) * 100;

            if (xPercentage < -100) {
                x.set(0);
            }

            if (xPercentage > 100) {
                x.set(-rectRef.current.width);
            }

            itemRef.current.style.transform = `translate3d(${xPercentage}%, 0, 0)`;
        };

        useEffect(() => {
            if (itemRef.current) {
                rectRef.current = itemRef.current.getBoundingClientRect();
            }
        }, [size.width, size.height]);

        const loop = () => {
            if (parentRef?.current?.dataset.ispaused == 'true') {
                return;
            }
            x.set(x.get() - speed);
            setX();
        };

        const [_, loopStart] = useRafLoop(loop, false);

        useEffect(() => {
            loopStart();
        }, [loopStart]);

        return (
            <motion.div
                className={`flex min-w-full shrink-0 items-center justify-around ${!nonLogos ? 'gap-24 pr-24' : 'gap-[64px] pr-[64px]'}`}
                ref={itemRef}
            >
                {children}
            </motion.div>
        );
    }
);

type MarqueeProps = {
    nonLogos: boolean;
    children: React.ReactNode;
};

const Marquee = ({ nonLogos, children }: MarqueeProps) => {
    const marqueeRef = useRef<HTMLDivElement>(null);

    const [isInMiddleThird, setIsInMiddleThird] = useState(false);

    const [isAnimationPaused, setIsAnimationPaused] = useState(false);

    function isPaused() {
        return isAnimationPaused;
    }

    useEffect(() => {
        const handleScroll = () => {
            if (!marqueeRef.current) {
                return;
            }

            const rect = marqueeRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const middleThirdStart = viewportHeight / 3;
            const middleThirdEnd = (viewportHeight * 2) / 3;

            if (rect.top < middleThirdEnd && rect.bottom > middleThirdStart) {
                setIsInMiddleThird(true);
            } else {
                setIsInMiddleThird(false);
            }
        };

        window.addEventListener('scroll', handleScroll);

        handleScroll(); // Call initially to set the correct state

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <div
            className="mx-auto w-[1236px] overflow-hidden"
            onMouseEnter={() => {
                setIsAnimationPaused(true);
            }}
            onMouseLeave={() => {
                setIsAnimationPaused(false);
            }}
            data-ispaused={isAnimationPaused}
            ref={marqueeRef}
        >
            <div className="mask-logo-grid flex items-center">
                <MarqueeItem
                    ref={marqueeRef}
                    nonLogos={nonLogos}
                    isInMiddleThird={isInMiddleThird}
                >
                    {children}
                </MarqueeItem>
                <MarqueeItem
                    ref={marqueeRef}
                    nonLogos={nonLogos}
                    isInMiddleThird={isInMiddleThird}
                >
                    {children}
                </MarqueeItem>
            </div>
        </div>
    );
};

const LogoGrid = (props: LogoGridProps) => {
    const { logoMedia, heading, nonLogos, mediaComponents = false } = props;
    const size = useWindowSize();

    const isMediumScreenStatic =
        size.width >= 768 && size.width < 1024 && logoMedia.length < 4;
    const isLargeScreenStatic = size.width >= 1024 && logoMedia.length < 5;

    function renderStatic() {
        return (
            <div className="mx-auto w-[1236px] overflow-hidden">
                <div className="flex flex-wrap items-center justify-center gap-24 px-20">
                    {logoMedia.map((mediaItem, index) => (
                        <div className={`${!nonLogos ? 'h-[3.2rem]' : 'flex shrink-0 justify-center h-[284px] w-[168px] flex-col items-center'} ${nonLogos && mediaItem?.asset?.assetAttributes?.caption ? 'border border-vulcan-85 rounded-xl' : ''}`} key={'logo-grid-' + index}>
                            {!mediaComponents ? (
                                <>
                                    {mediaItem?.asset?.assetAttributes?.linkUrl && (
                                        <a
                                            href={
                                                mediaItem.asset.assetAttributes.linkUrl
                                            }
                                            aria-label={
                                                mediaItem?.asset?.assetAttributes?.alt
                                            }
                                        >
                                            {mediaItem?.asset?.assetAttributes?.url && (
                                                <img
                                                    className={`${!nonLogos ? 'h-[3.2rem]' : 'max-w-[120px] max-h-[200px]'}`}
                                                    src={
                                                        mediaItem.asset.assetAttributes
                                                            .url
                                                    }
                                                    alt={
                                                        mediaItem.asset.assetAttributes
                                                            .alt
                                                    }
                                                    width={!nonLogos ? 96 : 120}
                                                    height={!nonLogos ? 32 : 200}
                                                    loading="lazy"
                                                    key={
                                                        'logo-grid-image-' + index
                                                    }
                                                />
                                            )}
                                        </a>
                                    )}
                                    {!mediaItem?.asset?.assetAttributes?.linkUrl && (
                                        <>
                                            {mediaItem?.asset?.assetAttributes?.url && (
                                                <img
                                                    className={`${!nonLogos ? 'h-[3.2rem]' : 'max-w-[120px] max-h-[200px]'}`}
                                                    alt={
                                                        mediaItem.asset.assetAttributes
                                                            .alt
                                                    }
                                                    src={
                                                        mediaItem.asset.assetAttributes
                                                            .url
                                                    }
                                                    width={!nonLogos ? 96 : 120}
                                                    height={!nonLogos ? 32 : 200}
                                                    loading="lazy"
                                                    key={
                                                        'logo-grid-image-' + index
                                                    }
                                                />
                                            )}
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    {mediaItem?.asset?.assetAttributes?.linkUrl && (
                                        <a
                                            href={
                                                mediaItem.asset.assetAttributes
                                                    .linkUrl
                                            }
                                            aria-label={
                                                mediaItem?.asset?.assetAttributes?.alt
                                            }
                                        >
                                            {mediaItem?.asset?.assetAttributes?.url && (
                                                <div className="w-full max-w-[120px] max-h[200px]">
                                                    <MediaBlock
                                                        layout="center"
                                                        blockBackground={false}
                                                        asset={{
                                                            ...mediaItem.asset,
                                                            assetAttributes: {
                                                                ...mediaItem.asset?.assetAttributes,
                                                                additionalStyleClassNames: '!w-auto h-auto mx-auto'
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </a>
                                    )}

                                    {!mediaItem?.asset?.assetAttributes?.linkUrl && (
                                        <>
                                            {mediaItem?.asset?.assetAttributes?.url && (
                                                <div className="w-full max-w-[120px] max-h-[200px]">
                                                    <MediaBlock
                                                        layout="center"
                                                        blockBackground={false}
                                                        asset={{
                                                            ...mediaItem.asset,
                                                            assetAttributes: {
                                                                ...mediaItem.asset?.assetAttributes,
                                                                additionalStyleClassNames: '!w-auto h-auto mx-auto'
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}

                            {nonLogos && mediaItem.asset?.assetAttributes?.caption && (
                                <p className="max-w-[120px] mt-4 text-sm text-center">
                                    {mediaItem.asset?.assetAttributes?.caption}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            {heading && <h2 className="t-heading-2 text-center">{heading}</h2>}

            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-center overflow-hidden py-[6rem]">
                {isMediumScreenStatic || isLargeScreenStatic ? (
                    renderStatic()
                ) : (
                    <Marquee nonLogos={nonLogos}>
                        {logoMedia.map((mediaItem, index) => (
                            <div
                                className={`flex shrink-0 justify-center ${!nonLogos ? 'h-[3.2rem]' : 'h-[284px] w-[168px] flex-col items-center'} ${nonLogos && mediaItem?.asset?.assetAttributes?.caption ? 'border border-vulcan-85 rounded-xl' : ''}`}
                                key={'logo-grid-' + index}
                            >
                                {!mediaComponents ? (
                                    <>
                                        {mediaItem?.asset?.assetAttributes?.linkUrl && (
                                            <a
                                                href={
                                                    mediaItem.asset.assetAttributes
                                                        .linkUrl
                                                }
                                                aria-label={
                                                    mediaItem?.asset?.assetAttributes?.alt
                                                }
                                            >
                                                {mediaItem?.asset?.assetAttributes?.url && (
                                                    <img
                                                        className={`${!nonLogos ? 'h-[3.2rem]' : 'max-w-[120px] max-h-[200px]'}`}
                                                        src={
                                                            mediaItem.asset
                                                                .assetAttributes.url
                                                        }
                                                        alt={
                                                            mediaItem.asset
                                                                .assetAttributes.alt
                                                        }
                                                        width={!nonLogos ? 96 : 120}
                                                        height={!nonLogos ? 32 : 200}
                                                        loading="lazy"
                                                        key={
                                                            'logo-grid-image-' + index
                                                        }
                                                    />
                                                )}
                                            </a>
                                        )}

                                        {!mediaItem?.asset?.assetAttributes?.linkUrl && (
                                            <>
                                                {mediaItem?.asset?.assetAttributes?.url && (
                                                    <img
                                                        className={`${!nonLogos ? 'h-[3.2rem]' : 'max-w-[120px] max-h-[200px]'}`}
                                                        src={
                                                            mediaItem.asset
                                                                .assetAttributes.url
                                                        }
                                                        alt={
                                                            mediaItem.asset
                                                                .assetAttributes.alt
                                                        }
                                                        width={!nonLogos ? 96 : 120}
                                                        height={!nonLogos ? 32 : 200}
                                                        loading="lazy"
                                                        key={
                                                            'logo-grid-image-' + index
                                                        }
                                                    />
                                                )}
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {mediaItem?.asset?.assetAttributes?.linkUrl && (
                                            <a
                                                href={
                                                    mediaItem.asset.assetAttributes
                                                        .linkUrl
                                                }
                                                aria-label={
                                                    mediaItem?.asset?.assetAttributes?.alt
                                                }
                                            >
                                                {mediaItem?.asset?.assetAttributes?.url && (
                                                    <div className="w-full max-w-[120px] max-h-[200px]">
                                                        <MediaBlock
                                                            layout="center"
                                                            blockBackground={false}
                                                            asset={{
                                                                ...mediaItem.asset,
                                                                assetAttributes: {
                                                                    ...mediaItem.asset?.assetAttributes,
                                                                    additionalStyleClassNames: '!w-auto h-auto mx-auto'
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </a>
                                        )}

                                        {!mediaItem?.asset?.assetAttributes?.linkUrl && (
                                            <>
                                                {mediaItem?.asset?.assetAttributes?.url && (
                                                    <div className="w-full max-w-[120px] max-h-[200px]">
                                                        <MediaBlock
                                                            layout="center"
                                                            blockBackground={false}
                                                            asset={{
                                                                ...mediaItem.asset,
                                                                assetAttributes: {
                                                                    ...mediaItem.asset?.assetAttributes,
                                                                    additionalStyleClassNames: '!w-auto h-auto mx-auto'
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {nonLogos && mediaItem.asset?.assetAttributes?.caption && (
                                    <p className="max-w-[120px] mt-4 text-sm text-center">
                                        {mediaItem.asset.assetAttributes.caption}
                                    </p>
                                )}
                            </div>
                        ))}
                    </Marquee>
                )}
            </div>
        </>
    );
};

export default LogoGrid;
