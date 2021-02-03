import React from "react";
import { Root } from "./layout/Root";
import { ImageFrame } from "./ImageFrame";
import { Banner } from "./Banner";
import { PageItem } from "./PageItem";

type MixPageProps = {
  mix: Mix;
  titles: Title[];
};

function buildTitleUrl(mix: Mix, title: string) {
  return `/${mix.mixDir}/${title}`;
}

function MixPage({ mix, titles }: MixPageProps) {
  return (
    <Root
      title={mix.mixName}
      metaForTitle=""
      metaDescription=""
      socialMediaImg=""
    >
      <div className="flex flex-col sm:flex-row items-center">
        <ImageFrame className="mb-8">
          <img
            src={require(`../stepcharts/${mix.mixDir}/mix-banner.png`)}
            width={280}
            height={80}
            alt={`${mix.mixName} banner`}
          />
        </ImageFrame>
        <ul className="flex flex-col items-center space-y-4">
          {titles.map((title) => {
            return (
              <li key={title.actualTitle}>
                <a href={buildTitleUrl(mix, title.titleDir)}>
                  <PageItem title={title.actualTitle}>
                    <Banner banner={title.banner} />
                  </PageItem>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </Root>
  );
}

export { MixPage };
