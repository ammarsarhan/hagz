import type { Icon } from "@tabler/icons-react-native";
import type { Sport } from "@/lib/search";
import { IconBallBasketball, IconBallFootball, IconBallTennis, IconBallVolleyball } from "./icons";

// Each sport's ball, as the staff app shows them (its components/sport-icons.ts).
export const SPORT_ICONS: Record<Sport, Icon> = {
  FOOTBALL: IconBallFootball,
  // Tabler has no padel ball; a padel ball is a tennis ball.
  PADEL: IconBallTennis,
  TENNIS: IconBallTennis,
  BASKETBALL: IconBallBasketball,
  VOLLEYBALL: IconBallVolleyball,
};
