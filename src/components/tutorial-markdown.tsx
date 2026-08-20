import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TutorialAlgorithmPlayer } from "@/components/tutorial-algorithm-player";
import { TutorialCubePlayground } from "@/components/tutorial-cube-playground";
import { TutorialCubeStage } from "@/components/tutorial-cube-stage";
import { TutorialNotationGallery } from "@/components/tutorial-notation-gallery";
import { toTutorialHeadingId } from "@/lib/tutorial-headings";

type TutorialWidgetProps = Record<string, string>;
type TutorialWidgetRenderer = (props: TutorialWidgetProps) => ReactNode;

const TUTORIAL_WIDGETS: Record<string, TutorialWidgetRenderer> = {
  "algorithm-player": ({ title, algorithm, note }) => (
    <TutorialAlgorithmPlayer title={title} algorithm={algorithm} note={note} />
  ),
  "cube-playground": () => <TutorialCubePlayground />,
  "cube-stage": ({ stage }) => <TutorialCubeStage stage={stage} />,
  "notation-gallery": ({ group }) => <TutorialNotationGallery group={group} />,
};

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
