import { type ReactNode } from 'react';

interface HeroGradientProps {
    id?: string;
    children: ReactNode;
}

const HeroGradient: React.FC<HeroGradientProps> = ({ id, children }) => {
    return (
        <div id={id} className="relative overflow-hidden">
            {/* Content layer */}
            <div className="outer-padding relative z-[3] flex min-h-[600px] items-center py-32 lg:min-h-[700px]">
                <div className="container">
                    <div className="row">
                        <div className="col-12 lg:col-8 lg:offset-2 text-center">
                            <div className="rte">{children}</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Brand background — deep fir base with rationed lime/teal glow.
                The new brand avoids gradients on flat sections, but a hero
                earns a single restrained light source. */}
            <div
                className="absolute inset-0 z-[1]"
                style={{
                    background: [
                        'radial-gradient(ellipse at 50% 8%, rgba(171, 255, 68, 0.16) 0%, transparent 55%)',
                        'radial-gradient(ellipse at 78% 28%, rgba(145, 219, 218, 0.10) 0%, transparent 50%)',
                        'radial-gradient(ellipse at 50% 92%, rgba(8, 37, 26, 0.9) 0%, transparent 60%)',
                        'linear-gradient(180deg, #0d3a29 0%, #08251a 100%)'
                    ].join(', ')
                }}
            />
            {/* Lime hairline grid motif (styled via ancestor .cmp-takeout scope) */}
            <div className="gf-grid pointer-events-none absolute inset-0 z-[2]" />
            {/* Bottom fade into the page background */}
            <div className="absolute bottom-0 left-0 z-[2] h-32 w-full bg-gradient-to-t from-fir-dark to-transparent" />
        </div>
    );
};

export default HeroGradient;
