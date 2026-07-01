import React from 'react';

import {
  IconBulb,
  IconArmchair,
  IconHanger,
  IconBath,
  IconToiletPaper,
  IconParking,
  IconSnowflake,
  IconFlame,
  IconSpeakerphone,
  IconDroplet,
  IconWifi,
  IconBallFootball,
  IconShirtSport,
  IconFirstAidKit,
  IconPennant,
  IconCoffee,
  IconProps,
} from '@tabler/icons-react-native';

export const AmenityName = {
  LIGHTING: 'LIGHTING',
  SEATING: 'SEATING',
  LOCKER_ROOMS: 'LOCKER_ROOMS',
  SHOWERS: 'SHOWERS',
  TOILETS: 'TOILETS',
  PARKING: 'PARKING',
  AIR_CONDITIONED: 'AIR_CONDITIONED',
  HEATING: 'HEATING',
  SOUND_SYSTEM: 'SOUND_SYSTEM',
  WATER_FOUNTAIN: 'WATER_FOUNTAIN',
  WIFI: 'WIFI',
  BALL_INCLUDED: 'BALL_INCLUDED',
  EQUIPMENT_RENTAL: 'EQUIPMENT_RENTAL',
  FIRST_AID: 'FIRST_AID',
  REFEREE_SERVICE: 'REFEREE_SERVICE',
  CAFETERIA: 'CAFETERIA',
} as const;

export type Amenity = keyof typeof AmenityName;

export const amenityIcons: Record<Amenity, React.FC<IconProps>> = {
  [AmenityName.LIGHTING]: IconBulb,
  [AmenityName.SEATING]: IconArmchair,
  [AmenityName.LOCKER_ROOMS]: IconHanger,
  [AmenityName.SHOWERS]: IconBath,
  [AmenityName.TOILETS]: IconToiletPaper,
  [AmenityName.PARKING]: IconParking,
  [AmenityName.AIR_CONDITIONED]: IconSnowflake,
  [AmenityName.HEATING]: IconFlame,
  [AmenityName.SOUND_SYSTEM]: IconSpeakerphone,
  [AmenityName.WATER_FOUNTAIN]: IconDroplet,
  [AmenityName.WIFI]: IconWifi,
  [AmenityName.BALL_INCLUDED]: IconBallFootball,
  [AmenityName.EQUIPMENT_RENTAL]: IconShirtSport,
  [AmenityName.FIRST_AID]: IconFirstAidKit,
  [AmenityName.REFEREE_SERVICE]: IconPennant,
  [AmenityName.CAFETERIA]: IconCoffee,
};
