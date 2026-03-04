import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { AnchorHTMLAttributes } from 'react';
import { ButtonHTMLAttributes } from 'react';

type IconName =
    | null
    | 'arrowDown'
    | 'arrowRight'
    | 'arrowLeft'
    | 'play'
    | 'close';

interface ButtonPropsBase {
    buttonStyle?: 'primary' | 'secondary' | 'emphasized';
    children?: ReactNode;
    className?: string[];
    small?: boolean;
    iconLocation?: 'left' | 'right';
    icon?: IconName;
    disabled?: boolean;
    isLoading?: boolean;
    target?: string;
}

interface ButtonPropsAsButton extends ButtonHTMLAttributes<HTMLButtonElement> {
    href?: never;
    buttonType?: 'button' | 'submit' | 'reset';
}

interface ButtonPropsAsAnchor extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    buttonType?: never;
}

export type ButtonProps = ButtonPropsBase &
    (ButtonPropsAsButton | ButtonPropsAsAnchor);

// Inline SVG icons to avoid SVGR dependency
const iconSvgs: Record<string, React.ReactNode> = {
    arrowright: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.333 8h9.334M8.667 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    arrowdown: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3.333v9.334M4 8.667l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    arrowleft: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.667 8H3.333M7.333 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
    play: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2l10 6-10 6V2z" fill="currentColor"/>
        </svg>
    ),
    close: (
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    ),
};

function Icon(iconName: IconName) {
    if (!iconName) return null;
    const svg = iconSvgs[iconName.toLowerCase()];
    if (!svg) return null;
    return <span className={`icon-${iconName} inline-block w-4 h-4`}>{svg}</span>;
}

// Tailwind classes to build out all button variants.
const buttonVariants = {
    primary: {
        bg: 'bg-gray-200',
        hover: 'hover:bg-[#c9cbd1] focus:bg-[#c9cbd1]',
        color: '!text-vulcan',
        icon: {
            hover: 'group-hover:bg-[#c9cbd1] group-focus:bg-[#c9cbd1]'
        },
        pressed: {
            noIcon: 'active:bg-gray-200',
            iconBg: 'group-active:bg-vulcan',
            iconColor: 'group-active:text-gray-200'
        }
    },
    secondary: {
        bg: 'bg-vulcan-90',
        hover: 'hover:bg-[#434752] focus:bg-[#434752]',
        color: '!text-gray-200',
        icon: {
            hover: 'group-hover:bg-[#434752] group-focus:bg-[#434752]'
        },
        pressed: {
            noIcon: 'active:bg-vulcan-90',
            iconBg: 'group-active:bg-gray-200',
            iconColor: 'group-active:text-vulcan'
        }
    },
    emphasized: {
        bg: 'bg-theme-color',
        hover: 'hover:bg-[var(--theme-button-hover)] focus:bg-[var(--theme-button-hover)]',
        color: '!text-[var(--theme-color-contrast)]',
        icon: {
            hover: 'group-hover:bg-[var(--theme-button-hover)] group-focus:bg-bg-[var(--theme-button-hover)]'
        },
        pressed: {
            noIcon: 'active:bg-theme-color',
            iconBg: 'group-active:bg-[var(--theme-color-contrast)]',
            iconColor: 'group-active:text-theme-color'
        }
    },
    disabled: {
        bg: 'bg-gray-500',
        hover: '',
        color: '!text-gray-400',
        icon: {
            hover: ''
        },
        pressed: {
            noIcon: '',
            iconBg: '',
            iconColor: ''
        }
    }
};

export const Button: React.FC<ButtonProps> = ({
    href,
    children,
    className = '',
    buttonStyle = 'primary',
    buttonType = 'button',
    iconLocation = 'right',
    icon,
    disabled = false,
    isLoading = false,
    ...rest
}) => {
    const Tag = href ? 'a' : 'button';
    const buttonProps = {
        ...(Tag === 'button' && { type: buttonType }),
        ...rest,
        disabled: disabled || isLoading ? true : undefined,
        href
    };

    const getButtonColor = () => {
        let variant =
            buttonVariants[buttonProps.disabled ? 'disabled' : buttonStyle];

        if (!variant) {
            variant = buttonVariants['primary'];
        }

        if (variant) {
            let buttonClasses = {
                wrapper: `${variant.bg} ${icon ? '' : variant.pressed.noIcon} ${icon ? '' : variant.hover} ${variant.color} disabled:hover:cursor-not-allowed disabled:bg-gray-500 disabled:!text-gray-400`,
                icon: `${variant.icon.hover} ${variant.pressed.iconBg} ${variant.pressed.iconColor} rounded-[4px] transition-colors ease-in-out`
            };

            return buttonClasses;
        } else {
            return {
                wrapper: '',
                icon: ''
            };
        }
    };

    return (
        <Tag
            title={isLoading ? 'Loading' : ''}
            {...(buttonProps as object)}
            className={`button group relative inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-1 text-center text-base font-medium leading-5 !no-underline transition-colors ease-in-out ${getButtonColor().wrapper} ${className}`}
        >
            <span className="inline-flex items-center justify-center">
                {isLoading ? (
                    <>Loading...</>
                ) : (
                    <>
                        {iconLocation === 'left' && icon && (
                            <span
                                className={`inline-flex h-[1.8rem] w-[1.8rem] items-center justify-center ${getButtonColor().icon}`}
                            >
                                {Icon(icon)}
                            </span>
                        )}
                        <span className="px-2">{children}</span>
                        {iconLocation === 'right' && icon && (
                            <span
                                className={`inline-flex h-[1.8rem] w-[1.8rem] items-center justify-center ${getButtonColor().icon}`}
                            >
                                {Icon(icon)}
                            </span>
                        )}
                    </>
                )}
            </span>
        </Tag>
    );
};

export default Button;
