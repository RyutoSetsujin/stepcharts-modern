import { RawStepchart } from "./parseStepchart";

const metaTagsToConsume = ["title", "artist", "banner"];

function getMeasureLines(lines: string[], i: number): string[] {
  const measureLines: string[] = [];

  while (
    i < lines.length &&
    !lines[i].startsWith(",") &&
    !lines[i].startsWith(";")
  ) {
    measureLines.push(lines[i++]);
  }

  return measureLines;
}

const offsetToBeat: Array<[number, Arrow["beat"]]> = [
  [2500, 4],
  [1250, 8],
  [1667, 6],
  [833, 12],
  [625, 16],
];

function determineBeat(index: number, measureLength: number): Arrow["beat"] {
  const fractionPerEntry = Math.round((1 / measureLength) * 10000);

  const offset = index * fractionPerEntry;

  const match = offsetToBeat.find((otb) => offset % otb[0] === 0);

  if (!match) {
    // didn't find anything? then it's a weirdo like a 5th note or 32nd note, they get colored
    // the same as 16ths
    return 16;
  }

  return match[1];
}

function convertMeasureLinesToArrows(measureLines: string[]): Arrow[] {
  return measureLines.map((mline, i) => {
    return {
      // remove freeze arrows, they are captured separately
      direction: mline.replace(/3/g, "0") as Arrow["direction"],
      beat: determineBeat(i, measureLines.length),
      measureBeatHeight: measureLines.length as Arrow["measureBeatHeight"],
    };
  });
}

function getMeasureLength(lines: string[], i: number): number {
  let measureLength = 0;

  for (; i < lines.length && lines[i][0] !== ";" && lines[i][0] !== ","; ++i) {
    measureLength += 1;
  }

  return measureLength;
}

function parseSm(sm: string, _titleDir: string): RawStepchart {
  const lines = sm.split("\n").map((l) => l.trim());

  let i = 0;

  const sc: Partial<RawStepchart> = {
    arrows: {},
    availableTypes: [],
    banner: null,
  };

  function parseBpms(bpmString: string) {
    const entries = bpmString.split(",");

    const bpms = entries.map((e) => {
      return Math.floor(Number(e.split("=")[1]));
    });

    // remove the simfile hacks like 190, 189
    const filteredBpms = bpms.filter((b, _index, others) => {
      return !others.some((o) => o - b === 1);
    });

    sc.bpm = Array.from(new Set(filteredBpms));
  }

  function parseFreezes(
    lines: string[],
    i: number,
    trimAmount: number
  ): FreezeBody[] {
    const freezes: FreezeBody[] = [];
    const open: Record<number, Partial<FreezeBody> | undefined> = {};

    let curBeat = 0;
    let curMeasureLength = getMeasureLength(lines, i);

    for (; i < lines.length && !lines[i].startsWith(";"); ++i) {
      const line = lines[i];

      if (line[0] === ",") {
        curMeasureLength = getMeasureLength(lines, i + 1);
        continue;
      }

      if (line.indexOf("2") === -1 && line.indexOf("3") === -1) {
        curBeat += 1 / curMeasureLength;
        continue;
      }

      const cleanedLine = line.replace(/[^23]/g, "0");

      for (let d = 0; d < cleanedLine.length; ++d) {
        if (cleanedLine[d] === "2") {
          if (open[d]) {
            console.warn(
              sc.title,
              "error parsing freezes, found a new starting freeze before a previous one finished"
            );
          }
          open[d] = {
            direction: d as FreezeBody["direction"],
            startBeat: curBeat - trimAmount * 0.25,
          };
        } else if (cleanedLine[d] === "3") {
          if (!open[d]) {
            console.warn(
              sc.title,
              "error parsing freezes, needed to close a freeze that never opened"
            );
            continue;
          }

          open[d]!.endBeat = curBeat - trimAmount * 0.25 + 1 / curMeasureLength;
          freezes.push(open[d] as FreezeBody);
          open[d] = undefined;
        }
      }

      curBeat += 1 / curMeasureLength;
    }

    return freezes;
  }

  function parseNotes(lines: string[], i: number): number {
    // move past #NOTES into the note metadata
    i++;
    const mode = lines[i++].replace("dance-", "").replace(":", "");
    i++; // skip author for now
    const difficulty = lines[i++].replace(":", "").toLowerCase();
    const feet = Number(lines[i++].replace(":", ""));
    i++; // skip groove meter data for now

    // skip couple, versus, etc for now
    if (mode !== "single" && mode !== "double") {
      return i + 1;
    }

    // now i is pointing at the first measure
    let arrows: Arrow[] = [];

    const firstMeasureIndex = i;

    do {
      const measureLines = getMeasureLines(lines, i);
      i += measureLines.length;

      arrows = arrows.concat(convertMeasureLinesToArrows(measureLines));
    } while (i < lines.length && lines[i++].trim() !== ";");

    // trim off empty leading measures
    let startI = 0;
    while (
      startI < arrows.length &&
      (arrows[startI].direction === "0000" ||
        arrows[startI].direction === "00000000")
    ) {
      startI += 1;
    }

    arrows = arrows.slice(startI);

    // trim off empty trailing measures
    // TODO: I think this does trim right, but it
    // isn't showing up correctly in StepchartPage
    let endI = arrows.length - 1;
    while (
      endI > 0 &&
      (arrows[endI].direction === "0000" ||
        arrows[endI].direction === "00000000")
    ) {
      endI -= 1;
    }

    const freezes = parseFreezes(lines, firstMeasureIndex, startI);

    arrows = arrows.slice(0, endI);

    sc.arrows![`${mode}-${difficulty}`] = { arrows, freezes };
    sc.availableTypes!.push({
      slug: `${mode}-${difficulty}`,
      mode,
      difficulty: difficulty as any,
      feet,
    });

    return i + 1;
  }

  function parseTag(lines: string[], index: number): number {
    const line = lines[index];

    const r = /#([A-Za-z]+):([^;]*)/;
    const result = r.exec(line);

    if (result) {
      const tag = result[1].toLowerCase();
      const value = result[2];

      if (metaTagsToConsume.includes(tag)) {
        // @ts-ignore
        sc[tag] = value;
      } else if (tag === "bpms") {
        parseBpms(value);
      } else if (tag === "notes") {
        return parseNotes(lines, index);
      }
    }

    return index + 1;
  }

  try {
    while (i < lines.length) {
      const line = lines[i];

      if (!line.length || line.startsWith("//")) {
        i += 1;
        continue;
      }

      if (line.startsWith("#")) {
        i = parseTag(lines, i);
      } else {
        i += 1;
      }
    }

    return sc as RawStepchart;
  } catch (e) {
    throw new Error(`error, ${e.message}, ${e.stack}, parsing ${sm}`);
  }
}

export { parseSm };
