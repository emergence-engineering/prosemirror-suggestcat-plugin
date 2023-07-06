import { EditorView } from "prosemirror-view";
import { EditorState, TextSelection } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { CompletePluginState, Status, TaskType } from "./types";
import { completePluginKey } from "./utils";

const request = async (
  apiKey: string,
  text: string,
  pluginState: CompletePluginState,
  view: EditorView,
  task: TaskType,
  selection?: TextSelection,
) => {
  let res = "";
  try {
    const response = await fetch(
      "https://prosemirror-ai-plugin.web.app/api/suggestion",
      {
        method: "POST",
        cache: "no-cache",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer -qKivjCv6MfQSmgF438PjEY7RnLfqoVe",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",

          modelParams: {
            input: [text],
            task,
            params: {
              // targetLanguage: "German"
            },
          },
        }),
      },
    );

    const reader = response.body?.getReader();

    const processStream: any = async ({ done, value }: any) => {
      if (done) {
        return;
      }
      const chunk = new TextDecoder().decode(value);
      try {
        res += JSON.parse(chunk)[Object.keys(JSON.parse(chunk))[0]];
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

// write the above dunction using server-sent events
const sseRequest = async (
  apiKey: string,
  text: string,
  pluginState: CompletePluginState,
  view: EditorView,
  task: TaskType,
  selection?: TextSelection,
) => {
  const eventSource = new EventSource(
    "https://suggestion-gw5lxik4dq-uc.a.run.app",
  );

  let res = "";

  eventSource.onmessage = (event) => {
    console.log("data", event.data);
    res += event.data;
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: task,
        status: Status.streaming,
        result: res,
        ...(selection && { selection }),
      }),
    );
  };

  eventSource.onerror = (error) => {
    console.error("Error:", error);
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: task,
        status: Status.error,
        result: error,
        ...(selection && { selection }),
      }),
    );
  };

  eventSource.addEventListener("close", () => {
    view.dispatch(
      view.state.tr.setMeta(completePluginKey, {
        type: task,
        status: Status.finished,
        result: pluginState.result,
        ...(selection && { selection }),
      }),
    );
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

  request(apiKey, text, pluginState, view, TaskType.complete);
};

export const makeShorterLonger = (
  task: TaskType,
  pluginState: CompletePluginState,
  view: EditorView,
  apiKey: string,
  maxSelection: number,
) => {
  const selection = view.state.selection as TextSelection;

  if (!selection) {
    console.log("No selection");
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
  console.log({ selectedText });
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
  sseRequest(apiKey, text, pluginState, view, task, selection);
};
