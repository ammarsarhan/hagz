import React from 'react';
import {
  IconBallFootball,
  IconBallBasketball,
  IconPingPong,
  IconProps,
  IconBallVolleyball,
  IconBallTennis,
} from '@tabler/icons-react-native';

export const GroundSport = {
  FOOTBALL: 'FOOTBALL',
  BASKETBALL: 'BASKETBALL',
  PADEL: 'PADEL',
  TENNIS: 'TENNIS',
  VOLLEYBALL: 'VOLLEYBALL',
} as const;

export type Sport = keyof typeof GroundSport;

export const sportIcons: Record<Sport, React.FC<IconProps>> = {
  [GroundSport.FOOTBALL]: IconBallFootball,
  [GroundSport.BASKETBALL]: IconBallBasketball,
  [GroundSport.PADEL]: IconPingPong,
  [GroundSport.TENNIS]: IconBallTennis,
  [GroundSport.VOLLEYBALL]: IconBallVolleyball,
};
