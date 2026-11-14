import type { Icon } from "@tabler/icons-react-native";
import type { components } from "@hagz/api";
import {
  IconAirConditioning,
  IconArmchair,
  IconBallFootball,
  IconBarbell,
  IconBath,
  IconBike,
  IconBuildingStore,
  IconBulb,
  IconBus,
  IconCash,
  IconCoffee,
  IconCookie,
  IconCreditCard,
  IconDeviceCctv,
  IconDeviceTv,
  IconDots,
  IconDroplet,
  IconFirstAidKit,
  IconFriends,
  IconHanger,
  IconIceCream,
  IconLock,
  IconMoodKid,
  IconParking,
  IconPlugConnected,
  IconPool,
  IconPray,
  IconRun,
  IconScoreboard,
  IconShieldCheck,
  IconShirt,
  IconSpeakerphone,
  IconToiletPaper,
  IconToolsKitchen2,
  IconTrophy,
  IconUmbrella,
  IconVideo,
  IconWheelchair,
  IconWifi,
} from "./icons";

type AmenityIconName = components["schemas"]["AmenityIcon"];

// The API names an amenity's icon in Hagz's own words (AmenityIcon) and each app draws it: here, the
// nearest Tabler icon. Typed as a full record, so an icon added to the API is a type error until it's
// drawn here.
const ICONS: Record<AmenityIconName, Icon> = {
  parking: IconParking,
  bike_parking: IconBike,
  changing_rooms: IconHanger,
  showers: IconBath,
  toilets: IconToiletPaper,
  lockers: IconLock,
  prayer_room: IconPray,
  seating: IconArmchair,
  covered: IconUmbrella,
  air_conditioning: IconAirConditioning,
  floodlights: IconBulb,
  wifi: IconWifi,
  charging: IconPlugConnected,
  screen: IconDeviceTv,
  sound: IconSpeakerphone,
  cafe: IconCoffee,
  restaurant: IconToolsKitchen2,
  snacks: IconCookie,
  water: IconDroplet,
  ice_cream: IconIceCream,
  ball_rental: IconBallFootball,
  kit_rental: IconShirt,
  scoreboard: IconScoreboard,
  video: IconVideo,
  tournaments: IconTrophy,
  gym: IconBarbell,
  pool: IconPool,
  warm_up: IconRun,
  kids_area: IconMoodKid,
  family: IconFriends,
  accessible: IconWheelchair,
  first_aid: IconFirstAidKit,
  security: IconShieldCheck,
  cctv: IconDeviceCctv,
  transport: IconBus,
  card_payment: IconCreditCard,
  cash: IconCash,
  shop: IconBuildingStore,
  other: IconDots,
};

export function AmenityIcon({
  name,
  size,
  color,
}: {
  name: AmenityIconName;
  size: number;
  color: string;
}) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={1.75} />;
}
