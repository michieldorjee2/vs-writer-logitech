import { useRef } from 'react';
import { useMouseHovered } from 'react-use';

const GridOverlay = ({
    fade = false,
    opacity = 0.1,
    highlightOpacity = 0.1
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const { elX, elY, elH } = useMouseHovered(ref, {
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
            {ref.current && (
                <div
                    className="design-grid-overlay pointer-events-none absolute left-0 top-0 z-[3] size-full"
                    style={{
                        maskImage: `radial-gradient(circle at center, black 0px, transparent ${ref.current.clientHeight / 2}px)`,
                        maskPosition: `${elX + ref.current.clientWidth / 2}px ${elY + ref.current.clientHeight / 2}px`,
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
