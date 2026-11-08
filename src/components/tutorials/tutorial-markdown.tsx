import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TutorialOrientationSettings } from "@/components/tutorials/tutorial-orientation-settings";
import { CubeU, CubeD, CubeF, CubeB, CubeR, CubeL } from "@/components/tutorials/cube-inline-labels";
import { TutorialAlgorithmPlayer } from "@/components/tutorials/tutorial-algorithm-player";
import { TutorialCubePlayground } from "@/components/tutorials/tutorial-cube-playground";
import { TutorialCubeStage, TutorialSolveFlow } from "@/components/tutorials/tutorial-cube-stage";
import { TutorialNotationGallery } from "@/components/tutorials/tutorial-notation-gallery";
import { TutorialPllRecognition } from "@/components/tutorials/tutorial-pll-recognition";
import { toTutorialHeadingId } from "@/lib/tutorials/tutorial-headings";

type TutorialWidgetProps = Record<string, string>;
type TutorialWidgetRenderer = (props: TutorialWidgetProps) => ReactNode;

const TUTORIAL_WIDGETS: Record<string, TutorialWidgetRenderer> = {
  "algorithm-player": ({ title, algorithm, note, setupAlgorithm }) => (
    <TutorialAlgorithmPlayer title={title} algorithm={algorithm} note={note} setupAlgorithm={setupAlgorithm} />
  ),
  "orientation-settings": () => <TutorialOrientationSettings />,
  "cube-playground": () => <TutorialCubePlayground />,
  "cube-stage": ({ stage }) => <TutorialCubeStage stage={stage} />,
  "solve-flow": () => <TutorialSolveFlow />,
  "notation-gallery": ({ group }) => <TutorialNotationGallery group={group} />,
  "pll-recognition": ({ group }) => <TutorialPllRecognition group={group} />,
};

const TUTORIAL_FACES: Record<string, typeof CubeU> = { U: CubeU, D: CubeD, F: CubeF, B: CubeB, R: CubeR, L: CubeL };

function parseWidgetProps(source: string | undefined) {
  if (!source) return {};
  const value = JSON.parse(source) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tutorial widget props must be a JSON object");
  }

  const props: TutorialWidgetProps = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") throw new Error(`Tutorial widget prop ${key} must be a string`);
    props[key] = entry;
  }
  return props;
}

function renderWidget(name: string, propsSource: string | undefined, key: string) {
  const render = TUTORIAL_WIDGETS[name];
  if (!render) throw new Error(`Unknown tutorial widget: ${name}`);
  return <Fragment key={key}>{render(parseWidgetProps(propsSource))}</Fragment>;
}

export function TutorialMarkdown({ markdown }: { markdown: string }) {
  const widgetPattern = /^<!--\s*tutorial-widget:([a-z0-9-]+)(?:\s+(\{.*\}))?\s*-->$/gm;
  const content: ReactNode[] = [];
  let cursor = 0;
  const components = {
    // `face:U` embeds the current face label; move notation such as `U` stays plain code.
    code: ({ children, className }: { children?: ReactNode; className?: string }) => {
      const face = /^face:([UDFBRL])$/.exec(String(children))?.[1];
      const Face = face ? TUTORIAL_FACES[face] : null;
      return Face ? <Face /> : <code className={className}>{children}</code>;
    },
    h2: ({ children }: { children?: ReactNode }) => {
      const title = String(children);
      return <h2 id={toTutorialHeadingId(title)}>{children}</h2>;
    },
  };

  for (const match of markdown.matchAll(widgetPattern)) {
    const index = match.index ?? 0;
    const markdownChunk = markdown.slice(cursor, index);
    if (markdownChunk.trim()) {
      content.push(
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} key={`markdown-${cursor}`}>
          {markdownChunk}
        </ReactMarkdown>,
      );
    }
    content.push(renderWidget(match[1], match[2], `widget-${index}`));
    cursor = index + match[0].length;
  }

  const finalChunk = markdown.slice(cursor);
  if (finalChunk.trim()) {
    content.push(
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} key={`markdown-${cursor}`}>
        {finalChunk}
      </ReactMarkdown>,
    );
  }

  return <div className="tutorial-markdown">{content}</div>;
}
