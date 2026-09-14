export function normalize(
  value: number,
  numerator: number,
  denominator: number,
) {
  return Math.floor((value / numerator) * denominator);
}

export const randomChoice = <T>(list: Array<T>) => {
  return list[Math.floor(Math.random() * list.length)];
};

export const createTitleForCopy = (title: string, titles: string[]) => {
  const copyRegex = /(.+) COPY(?: \((\d+)\))?$/;
  const match = title.match(copyRegex);

  let finalTitle = "";

  if (match) {
    const baseTitle = match[1];
    const currentNumber = match[2];

    if (currentNumber) {
      const nextNumber = parseInt(currentNumber, 10) + 1;
      finalTitle = `${baseTitle} COPY (${nextNumber})`;
    } else {
      finalTitle = `${baseTitle} COPY (1)`;
    }
  } else {
    finalTitle = `${title} COPY`;
  }

  let counter = 1;
  const baseForGuard = match ? match[1] : title;

  while (titles.includes(finalTitle)) {
    finalTitle = `${baseForGuard} COPY (${counter})`;
    counter++;
  }

  return finalTitle;
};
