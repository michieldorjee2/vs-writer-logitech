interface ComparisonRow {
    feature: string;
    opal: boolean | string;
    writer: boolean | string;
}

interface ComparisonTableProps {
    rows: ComparisonRow[];
    opalLabel?: string;
    writerLabel?: string;
}

const Check = () => (
    <svg className="mx-auto h-6 w-6 text-lime" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const Cross = () => (
    <svg className="mx-auto h-6 w-6 text-fir-n6" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

// Opal/Optimizely column highlights wins in lime; competitor column stays muted.
const renderCell = (value: boolean | string, emphasize = false) => {
    if (typeof value === 'boolean') return value ? <Check /> : <Cross />;
    return <span className={`${emphasize ? 'text-cream' : 'text-fir-n5'} text-[1.4rem]`}>{value}</span>;
};

const ComparisonTable = ({ rows, opalLabel = 'Optimizely Opal', writerLabel = 'Writer AI' }: ComparisonTableProps) => (
    <div className="overflow-x-auto rounded-[24px] border border-fir-light/50">
        <table className="w-full border-collapse text-left text-[1.6rem]">
            <thead>
                <tr className="border-b border-fir-light/40 bg-fir">
                    <th className="py-5 px-6 text-[1.8rem] font-medium text-cream w-1/2">Feature</th>
                    <th className="py-5 px-6 text-[1.8rem] font-display font-semibold text-center text-lime w-1/4 bg-lime/[0.06]">{opalLabel}</th>
                    <th className="py-5 px-6 text-[1.8rem] font-medium text-center text-fir-n6 w-1/4">{writerLabel}</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className="border-b border-fir-light/20 transition-colors hover:bg-fir/60">
                        <td className="py-4 px-6 text-fir-n4 font-light">{row.feature}</td>
                        <td className="py-4 px-6 text-center bg-lime/[0.05]">{renderCell(row.opal, true)}</td>
                        <td className="py-4 px-6 text-center">{renderCell(row.writer)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default ComparisonTable;
