import React from "react";
import {
  GetStaticPathsContext,
  GetStaticPathsResult,
  GetStaticPropsContext,
  GetStaticPropsResult,
} from "next";
import { getAllStepchartData } from "../../../lib/getAllStepchartData";
import { TitlePage } from "../../../components/TitlePage";
import { parseStepchart } from "../../../lib/parseStepchart";

type NextTitleIndexPageProps = {
  mix: Mix;
  title: Title;
  types: string[];
};

export async function getStaticPaths(
  context: GetStaticPathsContext
): Promise<GetStaticPathsResult> {
  const allData = getAllStepchartData();
  const allStepcharts = allData.reduce<Stepchart[]>((building, mix) => {
    return building.concat(mix.songs);
  }, []);

  return {
    paths: allStepcharts.map((stepchart) => ({
      params: { mix: stepchart.mix.mixDir, title: stepchart.title.titleDir },
    })),
    fallback: false,
  };
}

export async function getStaticProps(
  context: GetStaticPropsContext
): Promise<GetStaticPropsResult<NextTitleIndexPageProps>> {
  const mixDir = context.params!.mix as string;
  const titleDir = context.params!.title as string;

  const allData = getAllStepchartData();
  const sc = allData
    .find((m) => m.mixDir === mixDir)!
    .songs.find((s) => s.title.titleDir === titleDir)!;

  const results = {
    props: {
      mix: sc.mix,
      title: sc.title,
      types: sc.availableTypes,
    },
  };

  return results;
}

export default function NextTitleIndexPage(props: NextTitleIndexPageProps) {
  return <TitlePage {...props} />;
}