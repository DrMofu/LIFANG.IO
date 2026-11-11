import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TutorialOrientationSettings } from "@/components/tutorials/tutorial-orientation-settings";
import { CubeU, CubeD, CubeF, CubeB, CubeR, CubeL } from "@/components/tutorials/cube-inline-labels";
import { TutorialAlgorithmPlayer } from "@/components/tutorials/tutorial-algorithm-player";
import { TutorialCubePlayground } from "@/components/tutorials/tutorial-cube-playground";
import { TutorialCubeStage, TutorialSolveFlow, type TutorialCubeStageProps } from "@/components/tutorials/tutorial-cube-stage";
import { TutorialCubeSequence, type TutorialCubeSequenceProps } from "@/components/tutorials/tutorial-cube-sequence";
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
  "solve-flow": () => <TutorialSolveFlow />,
  "notation-gallery": ({ group }) => <TutorialNotationGallery group={group} />,
  "pll-recognition": ({ group }) => <TutorialPllRecognition group={group} />,
};

const TUTORIAL_FACES: Record<string, typeof CubeU> = { U: CubeU, D: CubeD, F: CubeF, B: CubeB, R: CubeR, L: CubeL };

function parseWidgetObject(source: string | undefined): Record<string, unknown> {
  if (!source) return {};
  const value = JSON.parse(source) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tutorial widget props must be a JSON object");
  }

  return value as Record<string, unknown>;
}

function parseWidgetProps(source: string | undefined) {
  const props: TutorialWidgetProps = {};
  for (const [key, entry] of Object.entries(parseWidgetObject(source))) {
    if (typeof entry !== "string") throw new Error(`Tutorial widget prop ${key} must be a string`);
    props[key] = entry;
  }
  return props;
}

function parseCubeStageProps(source: string | undefined): TutorialCubeStageProps {
  const { title, items } = parseWidgetObject(source);
  if (typeof title !== "string" || !Array.isArray(items) || items.length === 0) {
    throw new Error("Tutorial cube stage requires a title and non-empty items");
  }

  return {
    title,
    items: items.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new Error("Tutorial cube stage item must be an object");
      const { title, content, facelets, cameraLatitude } = item as Record<string, unknown>;
      if (typeof title !== "string" || typeof content !== "string"
        || typeof facelets !== "string" || !/^[URFDLBX]{54}$/.test(facelets)
        || (cameraLatitude !== undefined && (typeof cameraLatitude !== "number" || !Number.isFinite(cameraLatitude)))) {
        throw new Error("Invalid tutorial cube stage item: expected title, content, 54 facelets and optional cameraLatitude");
      }
      return { title, content, facelets, cameraLatitude };
    }),
  };
}

function parseCubeSequenceProps(source: string | undefined): TutorialCubeSequenceProps {
  const { cubes, transitions, content } = parseWidgetObject(source);
  if (!Array.isArray(cubes) || cubes.length === 0
    || !Array.isArray(transitions) || transitions.length !== cubes.length - 1
    || transitions.some((text: unknown) => typeof text !== "string")
    || (content !== undefined && typeof content !== "string")) {
    throw new Error("Tutorial cube sequence requires cubes, one transition per gap and optional content");
  }

  return {
    content,
    transitions,
    cubes: cubes.map((cube: unknown) => {
      if (!cube || typeof cube !== "object") throw new Error("Tutorial sequence cube must be an object");
      const { facelets, cameraLatitude, cameraLongitude } = cube as Record<string, unknown>;
      if (typeof facelets !== "string" || !/^[URFDLBX]{54}$/.test(facelets)
        || (cameraLatitude !== undefined && (typeof cameraLatitude !== "number" || !Number.isFinite(cameraLatitude)))
        || (cameraLongitude !== undefined && (typeof cameraLongitude !== "number" || !Number.isFinite(cameraLongitude)))) {
        throw new Error("Invalid tutorial sequence cube: expected 54 facelets and optional camera angles");
      }
      return { facelets, cameraLatitude, cameraLongitude };
    }),
  };
}

function renderWidget(name: string, propsSource: string | undefined, key: string) {
  if (name === "cube-sequence") {
    return <TutorialCubeSequence key={key} {...parseCubeSequenceProps(propsSource)} />;
  }
  if (name === "cube-stage") {
    return <TutorialCubeStage key={key} {...parseCubeStageProps(propsSource)} />;
  }
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
