export function AmbientCanvas({ variant }: { variant: "farm" | "gov" }) {
  return (
    <div className="ambient-canvas" data-variant={variant} aria-hidden="true">
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
    </div>
  );
}
