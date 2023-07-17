/* eslint-disable no-console */
import { Fragment, Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { defaultCompleteOptions } from "./defaults";
import { completeRequest, makeShorterLonger } from "./makeTaksRequest";
import {
  CompletePluginState,
  OpenAiPromptsWithoutParam, OpenAiPromptsWithParam,
  Status,
} from "./types";
import { completePluginKey, isCompleteMeta } from "./utils";

/*
 * idle - initial state, waiting for task
 * new - make request in view
 * streaming - update state in apply method and wait for finished
 * finished - update state in apply method and wait for accepted or rejected
 * accepted - insert/replace text in view and set status to done, also used for clearing an error
 * rejected - set status to done
 * done - used for clearing pluginState, do not use, it is just for internal state management
 * error - whenever an error occurs, this field gets populated so you can display it for the user, use `accepted`* meta to clear it
 */
export const completePlugin = (
  apiKey: string,
  options = defaultCompleteOptions,
) =>
  new Plugin<CompletePluginState>({
    key: completePluginKey,
    state: {
      init() {
        return { status: Status.idle };
      },
      apply(tr, pluginState, prevState, state) {
        const meta = tr.getMeta(completePluginKey);
        console.log({ meta });

        if (
          pluginState.status === Status.done ||
          pluginState.status === Status.rejected
        ) {
          return { status: Status.idle };
        }

        if (meta && isCompleteMeta(meta)) {
          if (pluginState.type && meta.type !== pluginState.type) {
            return pluginState;
          }

          return {
            ...pluginState,
            ...meta,
          };
        }

        return pluginState;
      },
    },
    view() {
      return {
        update(view, prevState) {
          const pluginState: CompletePluginState = completePluginKey.getState(
            view.state,
          );
          /* eslint-disable prefer-destructuring */
          let tr = view.state.tr;
          if (pluginState.status === Status.new) {
            switch (pluginState.type) {
              case OpenAiPromptsWithoutParam.Complete:
                completeRequest(pluginState, view, apiKey);
                console.log("complete");
                break;
              case OpenAiPromptsWithoutParam.MakeLonger:
              case OpenAiPromptsWithoutParam.MakeShorter:
              case OpenAiPromptsWithoutParam.Improve:
              case OpenAiPromptsWithoutParam.Simplify:
              case OpenAiPromptsWithoutParam.Explain:
              case OpenAiPromptsWithoutParam.ActionItems:
              case OpenAiPromptsWithParam.Translate:
              case OpenAiPromptsWithParam.ChangeTone:
                makeShorterLonger(
                  pluginState.type,
                  pluginState,
                  view,
                  apiKey,
                  options.maxSelection,
                  pluginState.params,
                );
                console.log("improve selected text");
                break;
              default:
                break;
            }
          }
          if (pluginState.status === Status.accepted) {
            if (pluginState.error) {
              tr.setMeta(completePluginKey, {
                type: pluginState.type,
                status: Status.done,
              });
              view.dispatch(tr);
              return;
            }

            switch (pluginState.type) {
              case OpenAiPromptsWithoutParam.Complete:
                tr = tr.insertText(
                  pluginState.result || "",
                  view.state.doc.nodeSize - 2,
                );
                tr.setMeta(completePluginKey, {
                  type: OpenAiPromptsWithoutParam.Complete,
                  status: Status.done,
                });
                view.dispatch(tr);
                console.log("complete accepted");
                break;
              case OpenAiPromptsWithoutParam.MakeLonger:
              case OpenAiPromptsWithoutParam.MakeShorter:
              case OpenAiPromptsWithoutParam.Improve:
              case OpenAiPromptsWithoutParam.Simplify:
              case OpenAiPromptsWithoutParam.Explain:
              case OpenAiPromptsWithoutParam.ActionItems:
                if (pluginState.selection && pluginState.result) {
                  const fragment = Fragment.fromArray(
                    Array.from(pluginState.result).map((char) =>
                      view.state.schema.text(char),
                    ),
                  );
                  tr.selection.replace(tr, new Slice(fragment, 0, 0));
                }
                tr.setMeta(completePluginKey, {
                  type: pluginState.type,
                  status: Status.done,
                });
                view.dispatch(tr);
                console.log("makeShorterLonger accepted");
                break;
              default:
                break;
            }
          }
        },
      };
    },
  });
