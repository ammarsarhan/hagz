import type { Icon } from "@tabler/icons-react-native";
import type { GroundSport } from "@/lib/grounds";
import { IconBallBasketball, IconBallFootball, IconBallTennis, IconBallVolleyball } from "./icons";

// Each sport's ball, as the ground flow shows it (Figma 352:2) and the layout marks a ground too
// small for its name.
export const SPORT_ICONS: Record<GroundSport, Icon> = {
  FOOTBALL: IconBallFootball,
  // Tabler has no padel ball; a padel ball is a tennis ball.
  PADEL: IconBallTennis,
  TENNIS: IconBallTennis,
  BASKETBALL: IconBallBasketball,
  VOLLEYBALL: IconBallVolleyball,
};
