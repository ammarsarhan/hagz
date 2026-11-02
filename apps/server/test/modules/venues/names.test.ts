import { describe, expect, it } from "vitest";
import { initialsOf, nameIn } from "@/modules/venues/domain/names";

describe("initials", () => {
  it.each([
    ["Omar Saleh", "OS"],
    ["Mohamed Ahmed Ali", "MA"],
    ["mona", "M"],
    ["  Youssef   Hany  ", "YH"],
    ["عمر صالح", "عص"],
    ["", ""],
  ])("%j → %j", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe("translated names", () => {
  const translations = [
    { language: "AR", name: "ملعب الهدف" },
    { language: "EN", name: "Goal Arena" },
  ];

  it("uses the wanted language, else any, else none", () => {
    expect(nameIn(translations, "EN")).toBe("Goal Arena");
    expect(nameIn(translations.slice(0, 1), "EN")).toBe("ملعب الهدف");
    expect(nameIn([], "EN")).toBeNull();
  });
});
