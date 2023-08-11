import { EditorView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";
import { Node } from "prosemirror-model";
import {
  CompletePluginState,
  MoodParams,
  OpenAiPromptsWithoutParam,
  Status,
  TaskType,
  TranslationParams,
} from "./types";
import { completePluginKey } from "./utils";

const request = async (
  apiKey: string,
  text: string,
  pluginState: CompletePluginState,
  view: EditorView,
  task: TaskType,
  selection?: TextSelection,
  params?: MoodParams | TranslationParams,
) => {
  let res = "";
  const controller = new AbortController();
  try {
    const response = await fetch("https://suggestion-gw5lxik4dq-uc.a.run.app", {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer -qKivjCv6MfQSmgF438PjEY7RnLfqoVe",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-3.5-turbo",

        modelParams: {
          input: [text],
          task,
          params,
        },
      }),
    });

    const reader = response.body?.getReader();

    const processStream: any = async ({ done, value }: any) => {
      if (done) {
        return;
      }

      if (completePluginKey.getState(view.state)?.isCancelled) {
        await controller.abort();
        return;
      }

      const chunk = new TextDecoder().decode(value);

      try {
        res += chunk;
        view.dispatch(
          view.state.tr.setMeta(completePluginKey, {
            type: task,
            status: Status.streaming,
            result: res,
            ...(selection && { selection }),
          }),
        );
      } catch (error) {
        console.error("Could not parse stream message", chunk, error);
      }
      // Continue processing the stream
      /* eslint-disable-next-line consistent-return */
      return reader?.read().then(processStream);
    };

    await reader?.read().then(processStream);
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: task,
        status: Status.finished,
        result: res,
        ...(selection && { selection }),
      }),
    );
  } catch (error) {
    console.error("Error:", error);
  }
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

  request(apiKey, text, pluginState, view, OpenAiPromptsWithoutParam.Complete);
};

export const makeShorterLonger = (
  task: TaskType,
  pluginState: CompletePluginState,
  view: EditorView,
  apiKey: string,
  maxSelection: number,
  params?: MoodParams | TranslationParams,
) => {
  const selection = view.state.selection as TextSelection;

  if (!selection) {
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        task,
        status: Status.done,
      }),
    );
    return;
  }

  // if selection is too big
  const selectedText = view.state.doc.textBetween(selection.from, selection.to);
  if (selectedText.length > maxSelection) {
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: task,
        status: Status.error,
        error: "Selection is too big",
      }),
    );
    return;
  }

  const text = view.state.doc.textBetween(selection.from, selection.to, "\n");
  request(apiKey, text, pluginState, view, task, selection, params);
};
