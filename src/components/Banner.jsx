// Shown on every screen (spec section 1). The text is fixed on purpose.
export const BANNER_TEXT = 'Illustrative data. Not real company figures.';

export default function Banner() {
  return (
    <div className="banner" role="note">
      {BANNER_TEXT}
    </div>
  );
}
