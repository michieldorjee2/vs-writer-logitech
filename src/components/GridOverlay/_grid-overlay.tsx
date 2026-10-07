import { useRef } from 'react';
import useMouseHovered from 'react-use/lib/useMouseHovered';

const GridOverlay = ({
    fade = false,
    opacity = 0.1,
    highlightOpacity = 0.1
}) => {
    const ref = useRef<HTMLDivElement>(null);
    // elW/elH are the element's measured size, from the same hook that reports
    // the pointer. Reading ref.current.clientWidth/Height here instead read a ref
    // during render, which React does not track (react-hooks/refs).
    const { elX, elY, elW, elH } = useMouseHovered(ref, {
        bound: true,
        whenHovered: false
    });

    return (
        <div
            ref={ref}
            className="pointer-events-none absolute left-0 top-0 size-full"
        >
            {fade && (
                <div className="absolute left-0 top-0 z-[4] h-44 w-full bg-gradient-to-b from-vulcan to-transparent"></div>
            )}
            <div
                className="design-grid-overlay pointer-events-none absolute left-0 top-0 z-[2] size-full"
                style={{ opacity: opacity }}
            ></div>
            {elH > 0 && (
                <div
                    className="design-grid-overlay pointer-events-none absolute left-0 top-0 z-[3] size-full"
                    style={{
                        maskImage: `radial-gradient(circle at center, black 0px, transparent ${elH / 2}px)`,
                        maskPosition: `${elX + elW / 2}px ${elY + elH / 2}px`,
                        opacity: highlightOpacity
                    }}
                ></div>
            )}
            {fade && (
                <div className="absolute bottom-0 left-0 z-[4] h-44 w-full bg-gradient-to-t from-vulcan to-transparent"></div>
            )}
        </div>
    );
};

export default GridOverlay;
