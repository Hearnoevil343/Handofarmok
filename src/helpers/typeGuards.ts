export const isArrayOfArrays = <T>(arr: unknown): arr is T[][] => {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => Array.isArray(item));
};
