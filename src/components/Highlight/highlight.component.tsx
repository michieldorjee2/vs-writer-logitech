import { useRef, type ReactNode } from 'react';
import useMouseHovered from 'react-use/lib/useMouseHovered';

interface GlowProps {
    elX: number;
    elY: number;
    elH: number;
}

const Glow = ({ elX, elY }: GlowProps) => {
    return (
        <div className="pointer-events-none absolute inset-0 z-10">
            <div
                className="pointer-events-none absolute h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime opacity-0 blur-[80px] transition-[opacity,background-color] duration-500 ease-in-out group-hover:opacity-20"
                style={{
                    transform: `translate(-50%, -50%) translate(${elX}px, ${elY}px)`
                }}
            />
        </div>
    );
};

interface HighlightSectionProps {
    id?: string;
    children: ReactNode;
}

export const HighlightSection = ({ id, children }: HighlightSectionProps) => {
    const ref = useRef<HTMLElement>(null);
    const { elX, elY, elH } = useMouseHovered(ref, {
        bound: true,
        whenHovered: false
    });

    return (
        <section
            id={id}
            ref={ref}
            className="group relative select-none overflow-hidden bg-gradient-to-b from-fir-dark via-fir to-fir-dark py-20 before:absolute before:inset-0 before:bg-[radial-gradient(300px_100.04%_at_50%_0%,rgba(171,255,68,0.18)_0%,rgba(13,58,41,0)_100%)] hover:after:opacity-100"
        >
            <div className="rte relative z-[3] mx-auto max-w-[680px] text-center">
                {children}
            </div>
            <Glow elX={elX} elY={elY} elH={elH} />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-fir-dark via-fir to-fir-dark opacity-0 transition-opacity duration-500 ease-in-out group-hover:opacity-100" />
        </section>
    );
};

export default HighlightSection;
