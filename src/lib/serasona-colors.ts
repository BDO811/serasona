import palette from "../../design-system/tokens/native-colors.json";

/** Same Bone and Signal source used to generate all Apple color assets. */
export function serasonaColor(token: keyof typeof palette.light, appearance: "light" | "dark" = "light"): string {
  return `#${palette[appearance][token]}`;
}
