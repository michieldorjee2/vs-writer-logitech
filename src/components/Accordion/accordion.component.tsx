import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import useMeasure from 'react-use-measure';

interface AccordionItemProps {
    title: string;
    defaultOpen?: boolean;
    backgroundStyle?: boolean;
    children: React.ReactNode;
}

const AccordionItem: React.FC<AccordionItemProps> = (props) => {
    const {
        title = '',
        defaultOpen,
        backgroundStyle,
        children
    } = props;
    const [isActive, setActive] = useState(defaultOpen);
    const [ref, { height }] = useMeasure();
    const { current: headerId } = useRef(
        'accordion-' + title ? title.replace(/[^a-zA-Z]/g, '') : ''
    );
    const { current: contentId } = useRef(
        'accordionContent-' + title ? title.replace(/[^a-zA-Z]/g, '') : ''
    );

    const spring = useSpring(isActive ? height : 0, {
        stiffness: 120,
        damping: 20
    });

    useEffect(() => {
        spring.set(isActive ? height : 0);
    }, [isActive, height]);

    return (
        <div
            className={`relative ${backgroundStyle ? 'before:absolute before:bottom-[-1px] before:left-[-1px] before:right-[-1px] before:top-[-1px] before:rounded-[2.5rem]' : ''}`}
        >
            <div
                className={`relative
                ${backgroundStyle ? 'mb-5 rounded-lg border border-vulcan-85 lg:mb-3' : 'border-b-2 border-white border-opacity-20'}
                `}
            >
                <h3 className="not-rte no-toc">
                    <button
                        id={headerId}
                        className={`relative w-full py-4 text-left text-xl font-medium
                            ${backgroundStyle ? 'pl-5 pr-20' : ''}
                            ${isActive ? 'text-bright-gray' : ''}`}
                        type="button"
                        aria-expanded={isActive}
                        onClick={() => {
                            setActive(!isActive);
                        }}
                        aria-controls={contentId}
                    >
                        <span>{title}</span>
                        <span
                            className={`border-athens-gray border-right-0 absolute bottom-0 top-0 flex items-center before:top-1/2 after:top-1/2 ${backgroundStyle ? 'right-[3.7rem]' : 'right-0'}`}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 18 18"
                                fill="none"
                                className={`origin-center transition duration-300 ${isActive ? 'rotate-[-180deg]' : ''}`}
                            >
                                <path
                                    d="M9.00008 1V17"
                                    stroke="#e9ebf1"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                    className={`origin-center transition duration-300 ${isActive ? 'rotate-90' : ''}`}
                                />
                                <path
                                    d="M1 9L17 9"
                                    stroke="#e9ebf1"
                                    strokeWidth="2"
                                    strokeLinecap="square"
                                />
                            </svg>
                        </span>
                    </button>
                </h3>
                <motion.div
                    style={{ overflow: 'hidden', height: spring }}
                    id={contentId}
                    aria-labelledby={headerId}
                    aria-hidden={!isActive}
                >
                    <div
                        className={`rte pb-4 pt-2 last:mb-0 md:pb-10 md:pt-6 ${backgroundStyle ? 'pl-4 pr-4 md:pl-6 md:pr-6' : ''}`}
                        ref={ref}
                    >
                        {children}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export interface AccordionProps {
    accordionItems: Array<{
        title: string;
        defaultOpen?: boolean;
        children?: React.ReactNode;
    }>;
    title?: string;
    backgroundStyle?: boolean;
    className?: string;
}

const Accordion: React.FC<AccordionProps> = (props) => {
    const {
        accordionItems,
        title,
        className = '',
        backgroundStyle = true,
        ...rest
    } = props;

    return (
        <>
            {title && (
                <h2 className="t-heading-2 pb-4">
                    {title}
                </h2>
            )}
            <div className={`relative ${className}`} {...rest}>
                {accordionItems &&
                    accordionItems.length > 0 &&
                    accordionItems.map((item, index) => (
                        <AccordionItem
                            {...item}
                            key={index}
                            defaultOpen={item.defaultOpen}
                            backgroundStyle={backgroundStyle}
                        >
                            {item.children}
                        </AccordionItem>
                    ))}
            </div>
        </>
    );
};

export default Accordion;
