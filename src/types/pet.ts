export interface PetSpecies {
  _id: string;
  name_cn: string;
  name_en: string;
  spriteUrl: string;
  spriteGrid: { cols: number; rows: number };
  spriteFrameSize: { w: number; h: number };
  frames: Record<PetState, { row: number; col: number; count: number; fps: number }>;
  status: "on_shelf" | "off_shelf";
}

export type PetState = "idle" | "happy" | "sleeping";

export interface PetSkin {
  _id: string;
  speciesId: string;
  name_cn: string;
  thumbnailUrl: string;
  spriteUrl: string;
  unlockCondition: { type: string; threshold?: number } | null;
}

export interface PetStateDoc {
  _id: string;
  currentSpeciesId: string;
  currentSkinId: string | null;
  level: number;
  experience: number;
  totalExperience: number;
  totalContributionFen: number;
  ownedSpeciesIds: string[];
  ownedSkinIds: string[];
  lastFedAt: string | null;
}

export interface BadgeDef {
  _id: string;
  name_cn: string;
  iconUrl: string;
  tier: "bronze" | "silver" | "gold";
  unlock: { type: "pet_level"; threshold: number };
  perks: string[];
  displayOnHome: boolean;
}

export interface UserBadge {
  _id: string;
  openid: string;
  badgeId: string;
  earnedAt: string;
  displayOrder: number;
}

export interface PetFoodSku {
  _id: string;
  name: string;
  pointsPrice: number;
  priceFen: number;
  experience: number;
  description: string;
  sortOrder: number;
}

export interface CharityOrg {
  _id: string;
  name_cn: string;
  logoUrl: string;
}

export interface PetPanel {
  pet: PetStateDoc;
  species: PetSpecies;
  skin: PetSkin | null;
  badges: UserBadge[];
  charity: {
    totalContributionFen: number;
    currentMonthFen: number;
    currentOrg: CharityOrg | null;
  };
}
