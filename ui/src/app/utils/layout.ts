import { CombinationType, GroundType } from "@/app/dashboard/pitches/create/steps/Layout";

export const generateDefaultGroundName = (grounds: GroundType[]) => {
  // Collect used single letters (A–Z) from names like "Ground X"
  const used = new Set<string>();

  for (const g of grounds) {
    const match = g.name.trim().match(/^ground\s+([A-Z])$/i);
    if (match) used.add(match[1].toUpperCase());
  }

  // Find first unused letter
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // A=65
    if (!used.has(letter)) {
      return `Ground ${letter}`;
    }
  }

  // All letters taken → switch to numbers
  let n = 1;
  while (true) {
    const candidate = `ground ${n}`;
    if (!grounds.some(g => g.name.trim().toLowerCase() === candidate)) {
      return `Ground ${n}`;
    }
    n++;
  }
}

export const createCombinationKey = (grounds: string[]) => {
    return grounds.slice().sort().join('.');
};

export const doesCombinationExist = (target: string, combinations: CombinationType[]) => {
    return combinations.some((combination: CombinationType) => {
        const key = createCombinationKey(combination.grounds);
        return key === target;
    });
};
