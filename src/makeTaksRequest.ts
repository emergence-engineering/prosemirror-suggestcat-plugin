import { EditorView } from "prosemirror-view";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { CompletePluginState, Status, TaskType } from "./types";
import { completePluginKey } from "./utils";

const val = "Hello world";
let index = 0;

const makeRequest = async (
  apiKey: string,
  text: string,
): Promise<{ result: string | null; done: boolean }> => {
  return new Promise((resolve) => {
    if (index <= val.length) {
      return resolve({ result: val[index++], done: false });
    }
    return resolve({ result: null, done: true });
  });
};

export const completeRequest = async (
  pluginState: CompletePluginState,
  view: EditorView,
  apiKey: string,
) => {
  // get last 2 paragraphs from state.doc
  const { doc } = view.state;
  const paragraphNodes: string[] = [];
  doc.descendants((node: Node) => {
    if (node.type.name === "paragraph") {
      paragraphNodes.push(node.textContent);
    }
  });

  let text = "";
  if (paragraphNodes.length >= 2) {
    text = paragraphNodes.slice(-2).join(" ");
  } else {
    text = paragraphNodes.join(" ");
  }

  let streamData: { result: string | null; done: boolean } = {
    result: null,
    done: false,
  };
  let result = streamData.result;
  let res = "";
  while (!streamData.done) {
    /* eslint-disable no-await-in-loop */
    streamData = await makeRequest(text, apiKey);
    console.log({ streamData });
    result = streamData.result;

    res += result || "";
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: TaskType.complete,
        status: Status.streaming,
        result: res,
      }),
    );
  }

  view.dispatch(
    view.state.tr.setMeta(completePluginKey, {
      type: TaskType.complete,
      status: Status.finished,
      result: res,
    }),
  );
};

export const makeLongerRequest = (
  pluginState: CompletePluginState,
  state: EditorState,
  apiKey: string,
) => {
  // TODO implement
};

export const makeShorterRequest = (
  pluginState: CompletePluginState,
  state: EditorState,
  apiKey: string,
) => {
  // TODO implement
};
