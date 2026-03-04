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
    <svg className="mx-auto h-6 w-6 text-green" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const Cross = () => (
    <svg className="mx-auto h-6 w-6 text-red" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const renderCell = (value: boolean | string) => {
    if (typeof value === 'boolean') return value ? <Check /> : <Cross />;
    return <span className="text-gray-300 text-sm">{value}</span>;
};

const ComparisonTable = ({ rows, opalLabel = 'Optimizely Opal', writerLabel = 'Writer AI' }: ComparisonTableProps) => (
    <div className="overflow-x-auto rounded-lg border border-vulcan-85">
        <table className="w-full border-collapse text-left">
            <thead>
                <tr className="border-b border-vulcan-85 bg-vulcan-95">
                    <th className="py-5 px-6 text-lg font-medium text-gray-200 w-1/2">Feature</th>
                    <th className="py-5 px-6 text-lg font-medium text-center text-optimizely-blue w-1/4">{opalLabel}</th>
                    <th className="py-5 px-6 text-lg font-medium text-center text-gray-400 w-1/4">{writerLabel}</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => (
                    <tr key={i} className="border-b border-vulcan-85/50 transition-colors hover:bg-vulcan-95/50">
                        <td className="py-4 px-6 text-gray-200 font-light">{row.feature}</td>
                        <td className="py-4 px-6 text-center">{renderCell(row.opal)}</td>
                        <td className="py-4 px-6 text-center">{renderCell(row.writer)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default ComparisonTable;
