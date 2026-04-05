export type TroopType = "shield" | "spear" | "bow";
export type Rarity = "SSR" | "SR";

export interface MockHero {
  id: string;
  name: string;
  generation: number;
  rarity: Rarity;
  troopType: TroopType;
  imageUrl: string;
}

const IMG_BASE =
  "https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/";

export const MOCK_HEROES: MockHero[] = [
  // Generation 1
  { id: "bahiti", name: "バヒティ", generation: 1, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Bahiti.png" },
  { id: "sergey", name: "セルゲイ", generation: 1, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Sergey.png" },
  { id: "madeline", name: "マデリン", generation: 1, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Madeline.png" },
  // Generation 2
  { id: "smith", name: "スミス", generation: 2, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Smith.png" },
  { id: "charlie", name: "チャーリー", generation: 2, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Charlie.png" },
  { id: "cloris", name: "クロリス", generation: 2, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Cloris.png" },
  // Generation 3
  { id: "eugene", name: "ユージン", generation: 3, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Eugene.png" },
  { id: "jessie", name: "ジェシー", generation: 3, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Jessie.png" },
  { id: "natalia", name: "ナタリア", generation: 3, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Natalia.png" },
  // Generation 4
  { id: "flint", name: "フリント", generation: 4, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Flint.png" },
  { id: "philly", name: "フィリー", generation: 4, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Philly.png" },
  { id: "zinman", name: "ジンマン", generation: 4, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Zinman.png" },
  // Generation 5
  { id: "jeronimo", name: "ジェロニモ", generation: 5, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Jeronimo.png" },
  { id: "alonso", name: "アロンソ", generation: 5, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Alonso.png" },
  { id: "gina", name: "ジーナ", generation: 5, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Gina.png" },
  // Generation 6
  { id: "patrick", name: "パトリック", generation: 6, rarity: "SSR", troopType: "shield", imageUrl: IMG_BASE + "2024/12/Patrick.png" },
  { id: "mia", name: "ミア", generation: 6, rarity: "SSR", troopType: "spear", imageUrl: IMG_BASE + "2024/12/Mia.png" },
  { id: "wayne", name: "ウェイン", generation: 6, rarity: "SSR", troopType: "bow", imageUrl: IMG_BASE + "2024/12/Wayne.png" },
];
