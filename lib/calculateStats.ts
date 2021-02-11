// used as the tie breaker when one song has more than one chart with the same max feet
const difficultyPriority = [
  "expert",
  "challenge",
  "difficult",
  "basic",
  "beginner",
];

function getMostDifficultChart(
  types: StepchartType[],
  charts: Record<string, Stepchart>
) {
  const maxFeet = Math.max(...types.map((t) => t.feet));

  const maxFeetTypes = types.filter((t) => t.feet === maxFeet);

  for (let i = 0; i < difficultyPriority.length; ++i) {
    const matchingType = maxFeetTypes.find(
      (mft) => mft.difficulty === difficultyPriority[i]
    );

    if (matchingType) {
      return charts[matchingType.slug];
    }
  }

  throw new Error("getMostDifficultChart, failed to get a chart");
}

function isJump(d: Arrow["direction"]): boolean {
  const nonZeroes = d.split("").reduce<number>((total, cardinal) => {
    if (cardinal !== "0") {
      return total + 1;
    }
    return total;
  }, 0);

  return nonZeroes === 2;
}

function isFreeze(d: Arrow["direction"]): boolean {
  return d.indexOf("2") > -1;
}

function isGallop(
  d: Arrow,
  p: Arrow | undefined,
  g: Arrow | undefined
): boolean {
  if (!p) {
    return false;
  }

  if (d.beat !== 4) {
    return false;
  }

  // jumps are never gallops
  if (isJump(d.direction)) {
    return false;
  }

  // the gallop must move to a new direction,
  // otherwise it's at the least a mini drill
  if (d.direction === p.direction) {
    return false;
  }

  if (p.beat === 12 || p.beat === 16) {
    // only consider it a gallop if it's isolated
    if (!g || p.offset - g.offset >= 1 / 8) {
      return d.offset - p.offset < 1 / 8;
    }
  }

  return false;
}

function isDrill(d: Arrow, p: Arrow | undefined): boolean {
  if (!p) {
    return false;
  }

  if (isJump(d.direction)) {
    return false;
  }

  if (d.direction !== p.direction) {
    return false;
  }

  return d.offset - p.offset <= 1 / 8;
}

function calculateStats(
  types: StepchartType[],
  charts: Record<string, Stepchart>
): Stats {
  const chart = getMostDifficultChart(types, charts);

  const jumps = chart.arrows.filter((a) => isJump(a.direction));
  const freezes = chart.arrows.filter((a) => isFreeze(a.direction));
  const gallops = chart.arrows.filter((a, i, array) =>
    isGallop(a, array[i - 1], array[i - 2])
  );
  const drills = chart.arrows.filter((a, i, array) => isDrill(a, array[i - 1]));

  return {
    jumps: jumps.length,
    crossovers: 0,
    drills: drills.length,
    freezes: freezes.length,
    gallops: gallops.length,
    stops: chart.stops.length,
  };
}

export { calculateStats };