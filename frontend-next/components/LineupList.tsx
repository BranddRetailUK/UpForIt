export type LineupToken = {
  text: string;
  tone?: "accent" | "bar";
  lead?: boolean;
};

export type LineupRow = LineupToken[];

type LineupListProps = {
  rows: LineupRow[];
};

export default function LineupList({ rows }: LineupListProps) {
  return (
    <div className="lineup-rows">
      {rows.map((row, rowIndex) => (
        <div
          className={`lineup-row${row.some((token) => token.lead) ? " lineup-row--lead" : ""}`}
          key={`row-${rowIndex}`}
        >
          {row.map((token, tokenIndex) => (
            <span
              className={`lineup-name${token.tone ? ` lineup-name--${token.tone}` : ""}`}
              key={`${token.text}-${tokenIndex}`}
            >
              {token.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
