import "./HighlightCard.scss";

// Club shown next to the value (e.g. the club with the best win streak)
type HighlightClub = {
  name: string;
  crestUrl: string;
};

// Props for the HighlightCard component: a title, the headline value and a line of context under it
type HighlightCardProps = {
  title: string;
  value: string;
  description: string;
  club?: HighlightClub; // When set, the card shows the club's crest and uses `value` as the club name
};

// Small stat card for the season highlights row
export default function HighlightCard({
  title,
  value,
  description,
  club,
}: HighlightCardProps) {
  return (
    <article className="highlight-card">
      <h3 className="highlight-card__title">{title}</h3>
      <div className="highlight-card__content">
        {/* Club cards show crest + name (smaller text), the rest show a single number */}
        <p
          className={`highlight-card__value${club ? " highlight-card__value--club" : ""}`}
        >
          {club && (
            <img
              className="highlight-card__crest"
              src={club.crestUrl}
              alt={`${club.name} crest`}
            />
          )}
          <span className="highlight-card__value-text" title={club?.name}>
            {value}
          </span>
        </p>
        <p className="highlight-card__description">{description}</p>
      </div>
    </article>
  );
}
