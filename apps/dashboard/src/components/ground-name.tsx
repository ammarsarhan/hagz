import { Text } from "./text";

// A ground's name inside a line of text, struck through once staff have deleted it (user,
// 2026-11-27): a regular on it ends after its last confirmed week. Our Text sets its own ink, so
// the span takes the line's classes to look like the rest of it.
export function GroundName({
  ground,
  className,
}: {
  ground: { name: string | null; deleted: boolean };
  className: string;
}) {
  if (!ground.name) return null;
  if (!ground.deleted) return ground.name;
  return <Text className={`${className} line-through`}>{ground.name}</Text>;
}
