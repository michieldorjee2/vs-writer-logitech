import { type ReactNode } from 'react';

interface HeroGradientProps {
    children: ReactNode;
}

const HeroGradient: React.FC<HeroGradientProps> = ({ children }) => {
    return (
        <div className="relative overflow-hidden">
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
            {/* Gradient background (CSS replaces THREE.js canvas) */}
            <div
                className="absolute inset-0 z-[1]"
                style={{
                    background: [
                        'radial-gradient(ellipse at 30% 50%, rgba(134, 29, 255, 0.4) 0%, transparent 60%)',
                        'radial-gradient(ellipse at 70% 30%, rgba(0, 55, 255, 0.5) 0%, transparent 50%)',
                        'radial-gradient(ellipse at 50% 80%, rgba(27, 6, 51, 0.8) 0%, transparent 60%)',
                        'linear-gradient(180deg, #10141d 0%, #0e1122 100%)'
                    ].join(', ')
                }}
            />
            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 z-[2] h-32 w-full bg-gradient-to-t from-vulcan to-transparent" />
        </div>
    );
};

export default HeroGradient;
