import type { Locality } from "@hagz/contracts";
import {
  IconBuildingCastle,
  IconBuildingCommunity,
  IconBuildingSkyscraper,
  IconHome,
  IconLayoutGrid,
  IconMap,
  IconMap2,
  IconMapPin,
  IconMapPins,
  type Icon,
} from "@tabler/icons-react";

// One icon per kind of location, shared by the add and edit modals.

const kindIcon: Record<Locality, Icon> = {
  REGION: IconMap,
  EMIRATE: IconBuildingCastle,
  GOVERNORATE: IconMap2,
  MUNICIPALITY: IconBuildingCommunity,
  WILAYAT: IconMapPins,
  CITY: IconBuildingSkyscraper,
  DISTRICT: IconLayoutGrid,
  AREA: IconMapPin,
  NEIGHBORHOOD: IconHome,
};

export function KindIcon({ kind, size = "1rem" }: { kind: Locality; size?: string }) {
  const Item = kindIcon[kind];
  return <Item style={{ width: size, height: size }} stroke={1.75} />;
}
